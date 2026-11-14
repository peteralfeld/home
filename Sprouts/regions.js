/* =========================================================================
   regions.js — Colors → Color regions (v274, Peter 11/14): every region but the outside gets one of
   five colors, different from the colors of all regions it shares a curve with. DOM-free (global
   SproutsRegions, or require()). Needs engine.js.

   - topology(an, nEdges): from E.analyse — the inner regions, each with its boundary cycles (as half-edge ids:
     2e = curve e from e.a to e.b, 2e + 1 = back) and which of them is its own face cycle; the neighbors
     (sharing a curve; the outside is left out — it keeps the Background colors).
   - assign(topo, prev, prevColor): a color 0..4 for each region. Colors stay put: a region takes over the color
     of the region of the previous picture it shares most half-edges with (a move adds curves and never renumbers
     the old ones), when no neighbor has it already; the rest take the next color in turn (1, 2, 3, 4, 5, 1, …,
     skipping those a neighbor has; Peter 11/14: taking the first free color made color 1 dominate — the turn is
     handed on from topology to topology in topo.next); if some region finds all five
     taken, the whole map is colored afresh (smallest-last order, a Kempe-chain swap where five neighbors hold
     all five colors — always possible in a plane map) and the five colors permuted to agree with as many
     inherited colors as possible.
   - choose(list, checked, used, onlyChecked): the five colors. list: [[name, '#rrggbb'], …] (the Background
     menu's); checked: the hex values checked; used: the hex values used elsewhere (Background, Background while
     computing); onlyChecked: colors taken only when checked (Medium gray — Peter 11/14: "It does not make sense to
     have a color that is so dominant"). More than five checked: the most distinct five of them; five or fewer:
     those and the most distinct completion from the unchecked ones neither used elsewhere nor onlyChecked. "Most distinct": the set whose closest pair
     — the Background colors counted too — is farthest apart in CIELAB (then the larger sum of all pairwise
     distances, then list order). Every subset is tried (C(19, 5) = 11,628 at most; the CIELAB values are kept, so a few milliseconds). All checked = none checked.
   - facesUpright(topo, edges): false when a face cycle no longer runs the way an inner face does (Z or the
     inside-out flip made another region the outside) — the topology must then be worked out again.
   ========================================================================= */
(function (root) {
  'use strict';

  function topology(an, nEdges) {
    var idx = new Map(), regions = [];
    an.regions.forEach(function (r) {
      if (r.key === -1) return;
      idx.set(r, regions.length);
      var cycles = [], face = -1, halves = [];
      r.boundaries.forEach(function (b) {
        if (b.cycle === undefined) return;
        if (b.cycle === r.key) face = cycles.length;
        var ids = an.cycles[b.cycle].halves.map(function (h) { return h.id; });
        cycles.push(ids);
        halves.push.apply(halves, ids);
      });
      regions.push({ cycles: cycles, face: face, halves: halves });
    });
    var adj = regions.map(function () { return []; }), seen = regions.map(function () { return {}; });
    for (var e = 0; e < nEdges; e++) {
      var a = idx.get(an.regionOfHalf(2 * e)), b = idx.get(an.regionOfHalf(2 * e + 1));
      if (a === undefined || b === undefined || a === b || seen[a][b]) continue;
      seen[a][b] = seen[b][a] = true;
      adj[a].push(b); adj[b].push(a);
    }
    return { regions: regions, adj: adj };
  }

  var K = 5;
  function assign(topo, prev, prevColor) {
    var n = topo.regions.length, adj = topo.adj, col = new Array(n).fill(-1), pref = new Array(n).fill(-1);
    if (prev && prevColor) {
      var owner = {};
      prev.regions.forEach(function (r, i) { r.halves.forEach(function (h) { owner[h] = i; }); });
      var claims = [];
      topo.regions.forEach(function (r, i) {
        var count = {};
        r.halves.forEach(function (h) { var o = owner[h]; if (o !== undefined) count[o] = (count[o] || 0) + 1; });
        var best = -1, bc = 0;
        Object.keys(count).forEach(function (o) { if (count[o] > bc) { bc = count[o]; best = +o; } });
        if (best >= 0 && prevColor[best] >= 0) { pref[i] = prevColor[best]; claims.push([bc, i]); }
      });
      claims.sort(function (p, q) { return q[0] - p[0] || p[1] - q[1]; });   // the largest overlaps first
      claims.forEach(function (c) {
        var i = c[1];
        if (!adj[i].some(function (j) { return col[j] === pref[i]; })) col[i] = pref[i];
      });
    }
    var turn = prev && prev.next !== undefined ? prev.next : 0;
    for (var i = 0; i < n; i++) {
      if (col[i] >= 0) continue;
      var taken = new Array(K).fill(false);
      adj[i].forEach(function (j) { if (col[j] >= 0) taken[col[j]] = true; });
      var c = inTurn(taken, turn);
      if (c < 0) return afresh(topo, pref, turn);
      col[i] = c; turn = (c + 1) % K;
    }
    topo.next = turn;
    return col;
  }

  /* the guaranteed five-coloring, then the permutation of the five colors that agrees with most of pref */
  /* the first color not taken, starting at turn and going round */
  function inTurn(taken, turn) {
    for (var k = 0; k < K; k++) { var c = (turn + k) % K; if (!taken[c]) return c; }
    return -1;
  }
  function afresh(topo, pref, turn) {
    var n = topo.regions.length, adj = topo.adj, deg = adj.map(function (a) { return a.length; });
    var gone = new Array(n).fill(false), order = [];
    for (var k = 0; k < n; k++) {                  // smallest last: each removed region has at most 5 neighbors left
      var v = -1;
      for (var i = 0; i < n; i++) if (!gone[i] && (v < 0 || deg[i] < deg[v])) v = i;
      gone[v] = true; order.push(v);
      adj[v].forEach(function (j) { if (!gone[j]) deg[j]--; });
    }
    var col = new Array(n).fill(-1);
    for (k = n - 1; k >= 0; k--) {
      v = order[k];
      var c = free(v);
      if (c < 0) c = kempe(v);
      if (c < 0) throw new Error('regions: no color left for a region (the map is not plane?)');
      col[v] = c;
    }
    function free(v) {
      var taken = new Array(K).fill(false);
      adj[v].forEach(function (j) { if (col[j] >= 0) taken[col[j]] = true; });
      if (pref[v] >= 0 && !taken[pref[v]]) return pref[v];
      var c = inTurn(taken, turn);
      if (c >= 0) turn = (c + 1) % K;
      return c;
    }
    /* v's colored neighbors hold all five colors: for some pair (p, q), the p–q chain from v's p-neighbor
       does not reach its q-neighbor; swapping p and q along that chain frees p for v */
    function kempe(v) {
      var nb = {};
      adj[v].forEach(function (j) { if (col[j] >= 0 && nb[col[j]] === undefined) nb[col[j]] = j; });
      for (var p = 0; p < K; p++) for (var q = 0; q < K; q++) {
        if (p === q || nb[p] === undefined || nb[q] === undefined) continue;
        var chain = [nb[p]], inChain = {}, hit = false;
        inChain[nb[p]] = true;
        for (var t = 0; t < chain.length && !hit; t++) {
          adj[chain[t]].forEach(function (j) {
            if (inChain[j] || (col[j] !== p && col[j] !== q)) return;
            if (j === nb[q]) hit = true;
            inChain[j] = true; chain.push(j);
          });
        }
        if (hit) continue;
        chain.forEach(function (j) { col[j] = col[j] === p ? q : p; });
        return p;
      }
      return -1;
    }
    var best = null, bestAgree = -1;
    permutations([0, 1, 2, 3, 4]).forEach(function (perm) {
      var agree = 0;
      for (var i = 0; i < n; i++) if (pref[i] >= 0 && perm[col[i]] === pref[i]) agree++;
      if (agree > bestAgree) { bestAgree = agree; best = perm; }
    });
    topo.next = turn;
    return col.map(function (c) { return best[c]; });
  }
  function permutations(a) {
    if (a.length <= 1) return [a.slice()];
    var out = [];
    a.forEach(function (x, i) {
      permutations(a.slice(0, i).concat(a.slice(i + 1))).forEach(function (p) { out.push([x].concat(p)); });
    });
    return out;
  }

  /* sRGB '#rrggbb' → CIELAB (D65) */
  function lab(hex) {
    var v = [1, 3, 5].map(function (i) {
      var c = parseInt(hex.substr(i, 2), 16) / 255;
      return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    var x = (0.4124 * v[0] + 0.3576 * v[1] + 0.1805 * v[2]) / 0.95047,
        y = 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2],
        z = (0.0193 * v[0] + 0.1192 * v[1] + 0.9505 * v[2]) / 1.08883;
    function f(t) { return t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116; }
    var fx = f(x), fy = f(y), fz = f(z);
    return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
  }
  var labKept = {};
  function dist(p, q) { var a = labKept[p] || (labKept[p] = lab(p)), b = labKept[q] || (labKept[q] = lab(q)); return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); }

  function choose(list, checked, used, onlyChecked) {
    var hexes = list.map(function (c) { return c[1].toLowerCase(); });
    var ck = hexes.filter(function (h) { return checked.indexOf(h) >= 0; });
    var usedL = used.map(function (h) { return h.toLowerCase(); });
    var fixed, pool, need;
    if (ck.length > K) { fixed = []; pool = ck; need = K; }
    else {
      fixed = ck; need = K - ck.length;
      var only = (onlyChecked || []).map(function (h) { return h.toLowerCase(); });
      pool = hexes.filter(function (h) { return ck.indexOf(h) < 0 && usedL.indexOf(h) < 0 && only.indexOf(h) < 0; });
    }
    var best = null, bestMin = -1, bestSum = -1;
    combos(pool, need).forEach(function (sub) {
      var set = fixed.concat(sub), all = set.concat(usedL), mn = Infinity, sum = 0;
      for (var i = 0; i < set.length; i++) for (var j = i + 1; j < all.length; j++) {
        var d = dist(set[i], all[j]);
        if (d < mn) mn = d;
        sum += d;
      }
      if (mn > bestMin + 1e-9 || (Math.abs(mn - bestMin) <= 1e-9 && sum > bestSum + 1e-9)) { best = set; bestMin = mn; bestSum = sum; }
    });
    return hexes.filter(function (h) { return best.indexOf(h) >= 0; });   // in list order
  }
  function combos(a, k) {
    var out = [];
    (function rec(start, cur) {
      if (cur.length === k) { out.push(cur.slice()); return; }
      for (var i = start; i <= a.length - (k - cur.length); i++) { cur.push(a[i]); rec(i + 1, cur); cur.pop(); }
    })(0, []);
    return out;
  }

  /* the signed area of a face cycle, from its curve pieces sampled (screen coordinates: inner faces positive) */
  function facesUpright(topo, edges) {
    return topo.regions.every(function (r) {
      if (r.face < 0) return true;
      var a = 0, prev = null, first = null;
      r.cycles[r.face].forEach(function (h) {
        var ps = edges[h >> 1].pieces, back = h & 1;
        for (var k = 0; k < ps.length; k++) {
          var b = back ? ps[ps.length - 1 - k].slice().reverse() : ps[k];
          for (var s = 0; s < 4; s++) {
            var t = s / 4, u = 1 - t, p = [
              u * u * u * b[0][0] + 3 * u * u * t * b[1][0] + 3 * u * t * t * b[2][0] + t * t * t * b[3][0],
              u * u * u * b[0][1] + 3 * u * u * t * b[1][1] + 3 * u * t * t * b[2][1] + t * t * t * b[3][1]];
            if (prev) a += prev[0] * p[1] - p[0] * prev[1]; else first = p;
            prev = p;
          }
        }
      });
      if (prev && first) a += prev[0] * first[1] - first[0] * prev[1];
      return a > 0;
    });
  }

  var api = { topology: topology, assign: assign, choose: choose, facesUpright: facesUpright, K: K, dist: dist };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SproutsRegions = api;
})(typeof self !== 'undefined' ? self : this);
