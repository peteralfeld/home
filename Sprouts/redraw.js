/* =========================================================================
   redraw.js — "Redraw from scratch" (Peter, 9/24: the nuclear option): lay
   the whole drawing out anew, SPOTS INCLUDED, when local repair (sliding
   spots, moving curves, adjusting) cannot make room. DOM-free (global
   SproutsRedraw, or require()). Needs geom.js, engine.js, room.js.

   Every curve becomes a polyline: its end spots and points along it about D
   apart. Spots and points then move together to the MINIMUM of one energy —
   the energy a curve minimises when it is drawn (the band, relax.js), for all
   curves at once (v51; Peter, 9/24: A and R should work like the curves do):
     E = Σ length                          + λ Σ_points w · Σ_near φ   (+ room by lives, below)
       + D² Σ θ²/ℓ                           bending (the elastic energy ∫κ² ds:
                                             a bend tighter than D costs more
                                             than its length)
       + D Σ (θ − 2π/k)²                     equal angles at a spot with k curves
                                             (straight through 2, 120° for 3)
       + D Σ (t·n)²                          a move's spot with a third curve: it
                                             leaves at right angles (v48)
       + spacing                             points evenly spread along a curve
                                             (moves them only along it)
   w = a point's share of its curve's length; "near" = each other curve once
   (its nearest point), the curve itself where it comes back (closer than
   0.75 × the arc between, as in the band), each spot, the window's sides.
   φ(r) = ((1/r − 1/H) / (1/c − 1/H))²: 1 at the comfort distance c, like
   (c/r)² closer in, falling smoothly to 0 at the band's horizon H = 256 px.
   c = 2 D across a region that still has a move (room for a new curve with D
   on each side), D across one without; the window's sides 2 D if the outside
   has a move, else D (Peter, 9/24: keep space round the drawing for new
   curves). A spot counts as a stretch D of curve (this places a spot with no
   curves).
       − π D² Σ lives · log(area)            ROOM BY LIVES (v52): each region with a
                                             move left pushes out in proportion to its
                                             lives; each life is worth a disc of radius D
   (v45–v50 had this pressure against a weak tension, κ = 0.03: curves wound
   into mazes to gain area; v51 dropped it and live regions were squeezed.)
   Descent: L-BFGS with a line search on E itself, run until the drawing no
   longer changes visibly — the last stretch of steps moved nothing by a pixel,
   or gained less than a pixel's worth of energy a step (v54; v51–v53 ran
   on to the rounding of the arithmetic, thousands of steps for nothing anyone
   sees; v45–v50 took 300 steps of a cooling size: where they stopped was
   arbitrary). When a curve's length no longer suits its number of points,
   it is re-spaced and the descent goes on (v53: unless the new points would
   cross — the position text alone cannot see two curves crossing twice).
   With the spots fixed (A, v53) the points move only ACROSS their curves and
   are spread evenly along them again after every step: the crowding is
   charged per point, so otherwise the descent slides points out of crowded
   stretches, and the smooth curve through the sparse points that are left
   wanders across a neighbour. R keeps the descent as it was (v52).
   NOTHING CAN CROSS: each vertex moves at most a third of its distance to
   anything it could hit (every segment not its own, the window), so no vertex
   reaches a segment during a step (PrEd, Bertault 2000). The position
   therefore cannot change; the engine's description is compared at the end
   anyway (the invariant).
   Finally each curve (a move's two curves as one) is the clamped C² spline
   THROUGH its points, cut at its move's spot, and every curve is certified. A
   curve whose pieces suit its length keeps its knots as its points, so a
   second press starts where the first ended and changes nothing.

   Tried first and dropped (9/24): starting from TUTTE's barycentric layout of
   the position's map, augmented into a triangulation (frame, ties between
   the boundaries of a region, a vertex per face corner) — a genuinely fresh
   start in which any region could have become the outer one. It is exact
   in theory and useless in practice here: nested positions crowd it
   exponentially — least gaps of 1e-7 to 1e-10 px in 13–20-spot games, beyond
   what doubles can hold, so it crossed itself — and where it was valid the
   start from the present picture ended with more room anyway.
   ========================================================================= */
(function (root) {
  'use strict';
  var G = root.SproutsGeom || require('./geom.js');
  var E = root.SproutsEngine || require('./engine.js'), Eng = E;
  var Rm = root.SproutsRoom || require('./room.js');

  var H = 256, CELL = 64;     // the horizon of crowding and its grid: the band's (relax.js RANGE × CELL)
  var SELF_RATIO = 0.75;      // a curve crowds itself where two parts are closer than this × the arc between (relax.js)
  var RAMP = 0.9;             // … fully; the crowding fades out between RAMP and 1 of that ratio (smooth, not a switch:
                              //  the descent stuck on the switch — Z, 9/30; v53 had found the same)
  var ONE = [1, 0, 0];
  /* the weight of a self term at distance d with arc `sig` between: 1 below RAMP · SELF_RATIO · sig, 0 above
     SELF_RATIO · sig, a smoothstep between; returns [ψ, ∂ψ/∂d, ∂ψ/∂sig] */
  function selfWeight(d, sig) {
    var x = d / (SELF_RATIO * sig);
    if (!(x < 1)) return [0, 0, 0];
    if (x <= RAMP) return ONE;
    var t = (1 - x) / (1 - RAMP), dpsi = 6 * t * (1 - t) / (1 - RAMP);   // dψ/dt · dt/dx = −dψ/dx
    return [t * t * (3 - 2 * t), -dpsi / (SELF_RATIO * sig), dpsi * x / sig];
  }

  /* A move's two curves, x → z and z → y, are ONE curve through its spot z
     (Peter, 9/24: "the curve from 2 to 3 through 4 should be smooth") —
     whatever else meets z. (room.js unitsOf joins them only while z has no
     third curve, since only then can z slide along them: v46 drew them
     apart once z had one, with a corner at z.) Edges come in move pairs
     2m, 2m + 1; anything else stays a curve of its own. [{edges, a, b, z}] */
  function moveUnits(game) {
    var out = [], e = game.edges;
    for (var i = 0; i < e.length; i++) {
      if (i % 2 === 0 && i + 1 < e.length && e[i].b === e[i + 1].a) { out.push({ edges: [i, i + 1], a: e[i].a, b: e[i + 1].b, z: e[i].b }); i++; }
      else out.push({ edges: [i], a: e[i].a, b: e[i].b, z: -1 });
    }
    return out;
  }

  /* o: { d0, D, spotR, rho }; fixSpots: the spots stay where they are (Room → Adjust
     the drawing, v46) — except a move's own spot, which lies on its move's curve and
     moves with it (v48: also once it has a third curve).
     The state for stepRedraw / redrawCurrent / finishRedraw. */
  /* The fewest points inside edge e: none — a curve shorter than D is drawn straight (or through
     its move's spot) — except that a loop's two edges need one each, so that the loop encloses
     something. (v46–v52 put at least 2 on every edge, for the control polygon of v46, which v51
     no longer uses: on the 32 px curve 10-11-9 of Peter's before.json (9/25) that made legs of
     5 px, and a point 2 px from a leg of its own curve then counted as crowding of its own curve —
     an energy step of 10⁴ when it switched on, which no line search gets past: A stalled; v53.) */
  function leastPoints(game, ei) {
    var e = game.edges, m = ei - ei % 2;
    return m + 1 < e.length && e[m].b === e[m + 1].a && e[m].a === e[m + 1].b ? 1 : 0;
  }
  function createRedraw(game, o, fixSpots) {
    var nS = game.spots.length, an = E.analyse(game.spots, game.edges), i;
    var P = game.spots.map(function (s) { return [s.x, s.y]; });
    /* paths[e]: the vertex indices along edge e, from e.a to e.b */
    var paths = game.edges.map(function (e, ei) {
      var pts = G.refinedPolygon(e.pieces, 0.5, 16).pts, S = [0];
      for (i = 1; i < pts.length; i++) S.push(S[i - 1] + G.dist(pts[i], pts[i - 1]));
      var L = S[S.length - 1], x = L / o.D, path = [e.a], q = 1, least = leastPoints(game, ei);
      /* a curve whose pieces already number one of the two counts nearest L / D (as every curve R
         or A drew does: it goes through its points) keeps its knots as its points — so a second
         press starts exactly where the first ended (v51) */
      var nk = e.pieces.length - 1, xk = 0;          // (counted along the knots, as respace counts)
      for (var j1 = 0; j1 < e.pieces.length; j1++) xk += G.dist(e.pieces[j1][0], e.pieces[j1][3]) / o.D;
      if (o.keepKnots || (nk >= least && (nk === Math.max(least, Math.floor(xk)) || nk === Math.max(least, Math.ceil(xk))))) {   // (keepKnots: Z's start — its points every D or less ALONG the two legs, the corner kept: sampled anew, a leg cut the corner and crossed a neighbour)
        for (var j0 = 0; j0 < nk; j0++) { path.push(P.length); P.push(e.pieces[j0][3].slice()); }
        path.push(e.b);
        return path;
      }
      var k = Math.max(least, Math.round(x));
      for (var j = 1; j <= k; j++) {                // at exactly j/(k+1) of the length (a snap to the polygon's
        var at = L * j / (k + 1);                   //  vertices put points ON the end spot of a short curve)
        while (q < S.length - 1 && S[q] < at) q++;
        var t = (at - S[q - 1]) / ((S[q] - S[q - 1]) || 1), p0 = pts[q - 1], p1 = pts[q];
        path.push(P.length); P.push([p0[0] + t * (p1[0] - p0[0]), p0[1] + t * (p1[1] - p0[1])]);
      }
      path.push(e.b);
      return path;
    });
    var segs = [];
    paths.forEach(function (p) { for (var t = 1; t < p.length; t++) segs.push([p[t - 1], p[t]]); });
    var units = moveUnits(game);
    var lines = units.map(function (u) {
      var ln = paths[u.edges[0]].slice();
      if (u.edges.length === 2) ln = ln.concat(paths[u.edges[1]].slice(1));
      return ln;
    });
    /* the room each curve wants on each side (v51): 2 D where the region there still has a move —
       room for a new curve with D on each side of it (the loop rule of v17, now for every curve) —
       and only d0, the legal minimum, where it has none. The window's sides: 2 D if the outside
       region has a move, else d0 (Peter, 9/24: keep space for new curves round the drawing). */
    var comfort = game.edges.map(function (e) {        // (read 1 px off the curve itself, a → b: a point 1 px off a
      var q = G.refinedPolygon(e.pieces, 0.25, 4).pts;  //  chord of it can lie across the curve — v52)
      var m = Math.max(1, Math.floor(q.length / 2)), A = q[m - 1], B = q[m];
      var mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2, tx = B[0] - A[0], ty = B[1] - A[1], tl = Math.sqrt(tx * tx + ty * ty) || 1;
      return [1, -1].map(function (sg) { var r = an.regionAt([mx - sg * ty / tl, my + sg * tx / tl]); return r && r.canMove ? 2 * o.D : o.D; });
    });
    var borderComfort = an.regions.some(function (r) { return r.key === -1 && r.canMove; }) ? 2 * o.D : o.D;
    /* for each point inside a curve: its line u, its place k there, its edge e; for each segment its
       line and place; for each line where its own spots lie on it */
    var vinfo = new Array(P.length), segLine = [], segK = [], segEdge = [], segs2 = [], spotAt = [];
    lines.forEach(function (ln, u) {
      var un = units[u], zk = un.edges.length === 2 ? paths[un.edges[0]].length - 1 : Infinity, at = {};
      ln.forEach(function (v, k) {
        if (v < nS) (at[v] = at[v] || []).push(k);
        else vinfo[v] = { u: u, k: k, e: un.edges[k < zk ? 0 : 1] };
        if (k > 0) { segs2.push([ln[k - 1], v]); segLine.push(u); segK.push(k - 1); segEdge.push(un.edges[k <= zk ? 0 : 1]); }
      });
      spotAt.push(at);
    });
    segs = segs2;
    function cycleVerts(ci) {
      var out = [];
      an.cycles[ci].halves.forEach(function (h) {
        var p = paths[h.edge].slice();
        if (h.id & 1) p.reverse();
        out = out.concat(p.slice(0, p.length - 1));
      });
      return out;
    }
    var regions = an.regions.map(function (r) {
      return { lives: r.canMove ? r.lives : 0, outside: r.key === -1,
               cycles: r.boundaries.filter(function (bd) { return bd.cycle !== undefined; }).map(function (bd) { return cycleVerts(bd.cycle); }) };
    });
    var fixed = new Uint8Array(P.length);
    if (fixSpots) {
      for (i = 0; i < nS; i++) fixed[i] = 1;
      units.forEach(function (u) { if (u.z >= 0) fixed[u.z] = 0; });   // a move's spot lies on its curve and moves with it
    }
    /* at a move's spot with a third curve: [z, the point before z, the point after z, the third curve's first point] */
    var tees = [];
    units.forEach(function (u) {
      if (u.z < 0 || game.spots[u.z].deg < 3) return;
      paths.forEach(function (p, k) {
        if (k === u.edges[0] || k === u.edges[1]) return;
        if (p[0] === u.z) tees.push([u.z, paths[u.edges[0]][paths[u.edges[0]].length - 2], paths[u.edges[1]][1], p[1]]);
        else if (p[p.length - 1] === u.z) tees.push([u.z, paths[u.edges[0]][paths[u.edges[0]].length - 2], paths[u.edges[1]][1], p[p.length - 2]]);
      });
    });
    /* at every other spot with two or more curve ends (original and hand-added spots): its ends'
       first points, in order round the spot (the order cannot change: nothing crosses) */
    var zs = {}, corners = [];
    units.forEach(function (u) { if (u.z >= 0) zs[u.z] = true; });
    for (i = 0; i < nS; i++) {
      if (zs[i]) continue;
      var nb = [];
      paths.forEach(function (p) { if (p[0] === i) nb.push(p[1]); if (p[p.length - 1] === i) nb.push(p[p.length - 2]); });
      if (nb.length < 2) continue;
      nb.sort(function (u, v) { return Math.atan2(P[u][1] - P[i][1], P[u][0] - P[i][0]) - Math.atan2(P[v][1] - P[i][1], P[v][0] - P[i][0]); });
      corners.push({ s: i, nb: nb });
    }
    var st = { game: game, o: o, key0: Rm.positionKey(game), corners: corners, regions: regions, fixSpots: !!fixSpots, comfort: comfort, borderComfort: borderComfort, vinfo: vinfo, segLine: segLine, segK: segK, segEdge: segEdge, spotAt: spotAt, P: P, nS: nS, paths: paths, segs: segs, lines: lines, units: units, fixed: fixed, tees: tees,
               box: [0, 0, game.W0, game.H0], it: 0, done: false, spotR: o.spotR || 0, stages: 0 };
    /* A TIGHT start (o.tight — Z, 9/30: a fresh layout has curves a few px apart, through spots'
       discs): the spots are shrunk to half the least gap between a spot and a curve, so that their
       crowding is not so stiff that the descent cannot move anything else; when the descent
       settles, stepRedraw starts it again with the spots grown to what now fits (restage), until
       they have their size. */
    if (o.tight) st.spotR = Math.min(st.spotR, leastSpotGap(st) / 2);
    return st;
  }
  function leastSpotGap(st) {                      // the least distance from a spot to a segment of another curve
    var P = st.P, least = Infinity;
    for (var s = 0; s < st.nS; s++) for (var k = 0; k < st.segs.length; k++) {
      if (st.spotAt[st.segLine[k]][s] !== undefined) continue;
      least = Math.min(least, G.distPointSeg(P[s], P[st.segs[k][0]], P[st.segs[k][1]]));
    }
    return least;
  }
  function restage(st) {                           // false when the spots could not grow: the descent is stuck (Peter's
    var n2 = createRedraw(redrawCurrent(st), st.o, st.fixSpots);   //  30-spot game, 9/30: the page restarted for ever)
    if (!(n2.spotR > st.spotR)) return false;
    n2.it = st.it; n2.stages = st.stages + 1; n2.E0 = st.E0; n2.jiggles = st.jiggles; n2.seed = st.seed;
    Object.keys(st).forEach(function (k) { delete st[k]; });
    Object.assign(st, n2);
    return true;
  }

  /* The energy at P (see the top). With g and cap: its gradient into g (n × [x, y]) and
     cap[i] = how far vertex i may move this step (PrEd: a third of its distance to anything it
     could hit — every segment not its own, the window's sides — counted up to the horizon H:
     beyond it a third of H keeps it clear whatever the other side does). Segments are found
     through a grid of CELL-sized cells, H / CELL rings round each vertex. */
  function evaluate(st, P, g, cap) {
    var n = P.length, o = st.o, D = o.D, lam = o.lambda === undefined ? 1 : o.lambda, box = st.box, E = 0, i, k;
    var segs = st.segs, lines = st.lines, vinfo = st.vinfo, spotR = st.spotR;
    /* φ for a comfort distance c: 1 at c, growing like (c/r)² towards 0, falling smoothly to 0 at H */
    /* r is a distance less a pad (a spot's radius, where a spot is measured; else 0). Where r is
       below EPS (a pixel) φ goes on as φ of r' = EPS · d / (EPS + pad), d = r + pad the plain
       distance: continuous at r = EPS, finite where a curve runs through a spot's disc (a fresh
       layout, Z, starts so), and INFINITE as d → 0 — a barrier. (v113–v119 went on LINEARLY below
       EPS, finite even at d = 0: on Peter's 30-spot game of 9/30 the descent from a fresh layout
       pressed spot 76 onto a curve until 4e-14 px apart, where PrEd holds a point for good — 14 of
       50 layouts crawled on for 25 minutes and more. v120.) */
    var h1 = 1 / H, EPS = 1;
    function phi0(r, c) { if (r >= H) return 0; var q = (1 / r - h1) / (1 / c - h1); return q * q; }
    function phi01(r, c) { if (r >= H) return 0; var den = 1 / c - h1, q = (1 / r - h1) / den; return -2 * q / (den * r * r); }
    function phi(r, c, pad) { if (r >= EPS) return phi0(r, c); pad = pad || 0; return phi0(EPS * (r + pad) / (EPS + pad), c); }
    function phi1(r, c, pad) { if (r >= EPS) return phi01(r, c); pad = pad || 0; return phi01(EPS * (r + pad) / (EPS + pad), c) * EPS / (EPS + pad); }
    if (g) for (i = 0; i < n; i++) { g[i][0] = 0; g[i][1] = 0; cap[i] = H; }
    function push(v, fx, fy) { g[v][0] += fx; g[v][1] += fy; }
    /* f · ∇(arc length of legs kFrom … kTo−1 of a line): ± the unit vector of each leg at its ends */
    function pushArc(arc, f) {
      var ln = lines[arc[0]];
      for (var j = arc[1]; j < arc[2]; j++) {
        var a1 = ln[j], b1 = ln[j + 1], ex = P[b1][0] - P[a1][0], ey = P[b1][1] - P[a1][1], el = Math.sqrt(ex * ex + ey * ey) || 1e-12;
        push(b1, f * ex / el, f * ey / el); push(a1, -f * ex / el, -f * ey / el);
      }
    }
    /* ROOM BY LIVES: −W Σ lives · log(area) over the regions that still have a move (the outside's
       area also gets the window's), W = π D² — each life is worth a disc of radius D: a region's
       pressure, W · lives / area per unit of boundary, meets the pull of its curves' length where
       its area is about W · lives. (v45–v50 had it against a weak tension, κ = 0.03, and curves
       wound into mazes to gain area; v51 dropped it and live regions got squeezed — Peter, 9/24:
       "shouldn't that region be much larger? It has three lives left!") */
    var PW = Math.PI * D * D;
    for (var ri = 0; ri < st.regions.length; ri++) {
      var rg = st.regions[ri];
      if (!rg.lives) continue;
      var A = rg.outside ? (box[2] - box[0]) * (box[3] - box[1]) : 0;
      rg.cycles.forEach(function (c) { A += Eng.signedArea(c.map(function (v) { return P[v]; })); });
      if (!(A > 0)) return Infinity;
      E -= PW * rg.lives * Math.log(A);
      if (!g) continue;
      var fp = -PW * rg.lives / A / 2;
      rg.cycles.forEach(function (c) {
        for (var q = 0, m = c.length; q < m; q++) {
          var pv = P[c[(q + m - 1) % m]], nx = P[c[(q + 1) % m]];
          g[c[q]][0] += fp * (nx[1] - pv[1]); g[c[q]][1] += fp * (pv[0] - nx[0]);
        }
      });
    }
    /* arc length along each line (for the self rule) */
    var S = lines.map(function (ln) {
      var s = [0];
      for (var t = 1; t < ln.length; t++) s.push(s[t - 1] + G.dist(P[ln[t]], P[ln[t - 1]]));
      return s;
    });
    /* LENGTH, and even spacing of the points along each curve (a gauge: it only moves them along) */
    st.paths.forEach(function (p) {
      var m = p.length - 1, L = 0, ls = [], us = [], t;
      for (t = 0; t < m; t++) {
        var vx = P[p[t + 1]][0] - P[p[t]][0], vy = P[p[t + 1]][1] - P[p[t]][1], l = Math.sqrt(vx * vx + vy * vy) || 1e-12;
        ls.push(l); us.push([vx / l, vy / l]); L += l;
      }
      var mu = L / m, v2 = 0;
      for (t = 0; t < m; t++) v2 += (ls[t] - mu) * (ls[t] - mu);
      E += L + v2 / mu;
      if (!g) return;
      for (t = 0; t < m; t++) {
        var c = 1 + 2 * (ls[t] - mu) / mu - v2 / (mu * mu * m);
        push(p[t + 1], c * us[t][0], c * us[t][1]); push(p[t], -c * us[t][0], -c * us[t][1]);
      }
    });
    /* the grid */
    var cells = new Map();
    for (k = 0; k < segs.length; k++) {
      var a = segs[k][0], b = segs[k][1];
      var x0 = Math.floor(Math.min(P[a][0], P[b][0]) / CELL), x1 = Math.floor(Math.max(P[a][0], P[b][0]) / CELL);
      var y0 = Math.floor(Math.min(P[a][1], P[b][1]) / CELL), y1 = Math.floor(Math.max(P[a][1], P[b][1]) / CELL);
      for (var cx = x0; cx <= x1; cx++) for (var cy = y0; cy <= y1; cy++) {
        var ck = cx * 65536 + cy, lst = cells.get(ck);
        if (!lst) cells.set(ck, lst = []);
        lst.push(k);
      }
    }
    /* seen[k] = the stamp of the point that last met segment k: this evaluation's number × n + the point
       (v54: v45–v53 reset the marks after every point, O(points × segments) per evaluation) */
    var seen = st.seen || (st.seen = new Float64Array(segs.length)), stampBase = (st.evals = (st.evals || 0) + 1) * n;
    var nL = lines.length, bestD = new Float64Array(nL), bestK = new Int32Array(nL), bestT = new Float64Array(nL), bestW = new Array(nL), bestA = new Array(nL), bestS = new Float64Array(nL), mark = new Int32Array(nL).fill(-1), touched = [];
    var RING = Math.ceil(H / CELL), cB = st.borderComfort;
    for (var y = 0; y < n; y++) {
      var X = Math.floor(P[y][0] / CELL), Y = Math.floor(P[y][1] / CELL), vi = vinfo[y], u = vi ? vi.u : -1, Su = vi ? S[u] : null, sy = vi ? Su[vi.k] : 0;
      touched.length = 0;
      for (var dx = -RING; dx <= RING; dx++) for (var dy = -RING; dy <= RING; dy++) {
        var list = cells.get((X + dx) * 65536 + Y + dy);
        if (!list) continue;
        for (var li = 0; li < list.length; li++) {
          k = list[li];
          if (seen[k] === stampBase + y) continue;
          seen[k] = stampBase + y;
          a = segs[k][0]; b = segs[k][1];
          if (y === a || y === b) continue;
          var vx = P[b][0] - P[a][0], vy = P[b][1] - P[a][1], L2 = vx * vx + vy * vy;
          var t = L2 > 0 ? Math.max(0, Math.min(1, ((P[y][0] - P[a][0]) * vx + (P[y][1] - P[a][1]) * vy) / L2)) : 0;
          var ux = P[y][0] - P[a][0] - t * vx, uy = P[y][1] - P[a][1] - t * vy, dd = Math.sqrt(ux * ux + uy * uy);
          if (!(dd > 0)) return Infinity;
          if (g) { if (dd < cap[y]) cap[y] = dd; if (dd < cap[a]) cap[a] = dd; if (dd < cap[b]) cap[b] = dd; }
          if (dd >= H) continue;
          var v = st.segLine[k];
          var ka, s0, s1, sig, wt = ONE, arc = null;
          if (!vi) {                                // a spot: the other curves, and its own where it has come back
            if (y >= st.nS) continue;
            var own = st.spotAt[v][y];
            if (own !== undefined) {                // (Z, 9/30: a curve's far part passed 0.06 px from its own spot
              ka = st.segK[k]; s0 = S[v][ka]; s1 = S[v][ka + 1]; sig = Infinity;   //  between two of its points — the points'
              for (var oi = 0; oi < own.length; oi++) {                            //  term below never saw the segment)
                var sp = S[v][own[oi]], sg1 = sp < s0 ? s0 - sp : sp > s1 ? sp - s1 : 0;
                if (sg1 < sig) { sig = sg1; arc = sp < s0 ? [v, own[oi], ka] : [v, ka + 1, own[oi]]; }
              }
              wt = selfWeight(dd, sig);
              if (!wt[0]) continue;
            }
          } else if (v === u) {                     // its own curve: only where it has come back (as in the band)
            ka = st.segK[k]; s0 = Su[ka]; s1 = Su[ka + 1];
            sig = sy < s0 ? s0 - sy : sy > s1 ? sy - s1 : 0;
            arc = sy < s0 ? [v, vi.k, ka] : [v, ka + 1, vi.k];
            wt = selfWeight(dd, sig);
            if (!wt[0]) continue;
          }
          /* of a line's segments the one that crowds most: the nearest, weighted by ψ for the
             curve's own — the nearest alone jumped when it changed to a segment of another weight
             (a hairpin of 14-42 in Peter's 30-spot game, 9/30: E rose 260 for a step of 1e-6 px) */
          var score = wt[0] / (dd * dd);
          if (mark[v] !== y) { mark[v] = y; bestS[v] = -1; touched.push(v); }
          if (score > bestS[v]) { bestS[v] = score; bestD[v] = dd; bestK[v] = k; bestT[v] = t; bestW[v] = wt; bestA[v] = arc; }
        }
      }
      if (!vi) {
        /* a SPOT against the curves near it (not its own), each once: λ D φ — a spot counts as a
           stretch D of curve — with the comfort of the side of that curve it lies on */
        for (var tj = 0; tj < touched.length; tj++) {
          v = touched[tj]; k = bestK[v]; t = bestT[v]; a = segs[k][0]; b = segs[k][1];
          var rr = bestD[v] - spotR;             // (inside the disc, rr ≤ 0: see phi — a fresh layout (Z)
          if (!(bestD[v] > 0)) return Infinity;  //  starts with curves through spots' discs)
          var sxv = P[b][0] - P[a][0], syv = P[b][1] - P[a][1], qx0 = P[a][0] + t * sxv, qy0 = P[a][1] + t * syv;
          var cc = st.comfort[st.segEdge[k]][(P[y][0] - qx0) * -syv + (P[y][1] - qy0) * sxv >= 0 ? 0 : 1];
          var wS = bestW[v];
          E += lam * D * wS[0] * phi(rr, cc, spotR);
          if (!g) continue;
          var ff = lam * D * (wS[0] * phi1(rr, cc, spotR) + wS[1] * phi(rr, cc, spotR)) / bestD[v], ffx = ff * (P[y][0] - qx0), ffy = ff * (P[y][1] - qy0);
          push(y, ffx, ffy); push(a, -ffx * (1 - t), -ffy * (1 - t)); push(b, -ffx * t, -ffy * t);
          if (wS[2]) pushArc(bestA[v], lam * D * wS[2] * phi(rr, cc, spotR));
        }
        continue;
      }
      /* CROWDING at this point: λ w Σ φ over what is near — each other curve once (its nearest
         point), its own where it comes back, each spot, the window's sides — with the comfort of
         the side it lies on */
      var ln = lines[u], pv = P[ln[vi.k - 1]], nx = P[ln[vi.k + 1]], py = P[y];
      var la = G.dist(py, pv), lb = G.dist(nx, py), w = (la + lb) / 2;
      var tx = nx[0] - pv[0], ty = nx[1] - pv[1], tl = Math.sqrt(tx * tx + ty * ty) || 1e-12, nX = -ty / tl, nY = tx / tl;
      var cf = st.comfort[vi.e], Phi = 0;
      function side(qx, qy) { return (qx - py[0]) * nX + (qy - py[1]) * nY >= 0 ? cf[0] : cf[1]; }
      for (var ti = 0; ti < touched.length; ti++) {
        v = touched[ti]; var r = bestD[v]; k = bestK[v]; t = bestT[v]; a = segs[k][0]; b = segs[k][1];
        var qx = P[a][0] + t * (P[b][0] - P[a][0]), qy = P[a][1] + t * (P[b][1] - P[a][1]), c = side(qx, qy);
        var wC = bestW[v];
        Phi += wC[0] * phi(r, c);
        if (!g) continue;
        var f = lam * w * (wC[0] * phi1(r, c) + wC[1] * phi(r, c)) / r, fx = f * (py[0] - qx), fy = f * (py[1] - qy);
        push(y, fx, fy); push(a, -fx * (1 - t), -fy * (1 - t)); push(b, -fx * t, -fy * t);
        if (wC[2]) pushArc(bestA[v], lam * w * wC[2] * phi(r, c));
      }
      for (var s = 0; s < st.nS; s++) {
        var sx = P[s][0] - py[0], sy2 = P[s][1] - py[1], ds = Math.sqrt(sx * sx + sy2 * sy2), rs = ds - spotR, pad = spotR;
        if (rs >= H) continue;
        var own = st.spotAt[u][s], wP = ONE;        // its own curve's spots: only where it has come back
        if (own !== undefined) {
          rs = ds; pad = 0;                         // (from the centre: a short curve's points lie within a spot's radius of its ends)
          var sg = Infinity, arcP = null;
          for (var oi = 0; oi < own.length; oi++) {
            var ko = own[oi], sg1 = Math.abs(sy - Su[ko]);
            if (sg1 < sg) { sg = sg1; arcP = ko < vi.k ? [u, ko, vi.k] : [u, vi.k, ko]; }
          }
          wP = selfWeight(rs, sg);
          if (!wP[0]) continue;
        }
        if (!(ds > 0)) return Infinity;
        c = side(P[s][0], P[s][1]);
        Phi += wP[0] * phi(rs, c, pad);
        if (!g) continue;
        f = lam * w * (wP[0] * phi1(rs, c, pad) + wP[1] * phi(rs, c, pad)) / ds; fx = -f * sx; fy = -f * sy2;   // (drs/dy = dds/dy)
        push(y, fx, fy); push(s, -fx, -fy);
        if (wP[2]) pushArc(arcP, lam * w * wP[2] * phi(rs, c, pad));
      }
      var walls = [py[0] - box[0], box[2] - py[0], py[1] - box[1], box[3] - py[1]];
      for (var wi = 0; wi < 4; wi++) {
        if (!(walls[wi] > 0)) return Infinity;
        Phi += phi(walls[wi], cB);
        if (!g) continue;
        f = lam * w * phi1(walls[wi], cB);
        push(y, wi === 0 ? f : wi === 1 ? -f : 0, wi === 2 ? f : wi === 3 ? -f : 0);
      }
      E += lam * w * Phi;
      if (g) {                                      // w's own gradient
        var fw = lam * Phi / 2, ax = (py[0] - pv[0]) / (la || 1e-12), ay = (py[1] - pv[1]) / (la || 1e-12), bx = (nx[0] - py[0]) / (lb || 1e-12), by = (nx[1] - py[1]) / (lb || 1e-12);
        push(y, fw * (ax - bx), fw * (ay - by)); push(ln[vi.k - 1], -fw * ax, -fw * ay); push(ln[vi.k + 1], fw * bx, fw * by);
      }
    }
    /* BENDING: D² Σ |second difference|² / ℓ³ ≈ D² Σ θ² / ℓ = D² ∫ κ² ds, the elastic energy: a bend
       tighter than D costs more than its length (ℓ the mean of the two legs) */
    var cBend = D * D;
    for (var li2 = 0; li2 < lines.length; li2++) {
      var L3 = lines[li2];
      for (var q = 1; q + 1 < L3.length; q++) {
        var p0 = P[L3[q - 1]], p1 = P[L3[q]], p2 = P[L3[q + 1]];
        var ax2 = p1[0] - p0[0], ay2 = p1[1] - p0[1], bx2 = p2[0] - p1[0], by2 = p2[1] - p1[1];
        var lA = Math.sqrt(ax2 * ax2 + ay2 * ay2), lB = Math.sqrt(bx2 * bx2 + by2 * by2), ell = (lA + lB) / 2;
        if (!(ell > 0)) return Infinity;
        var sx2 = bx2 - ax2, sy3 = by2 - ay2, s2 = sx2 * sx2 + sy3 * sy3, e3 = ell * ell * ell;
        E += cBend * s2 / e3;
        if (!g) continue;
        var c2 = 2 * cBend / e3, c3 = -3 * cBend * s2 / (e3 * ell) / 2;
        var uax = lA > 0 ? ax2 / lA : 0, uay = lA > 0 ? ay2 / lA : 0, ubx = lB > 0 ? bx2 / lB : 0, uby = lB > 0 ? by2 / lB : 0;
        push(L3[q - 1], c2 * sx2 - c3 * uax, c2 * sy3 - c3 * uay);
        push(L3[q], -2 * c2 * sx2 + c3 * (uax - ubx), -2 * c2 * sy3 + c3 * (uay - uby));
        push(L3[q + 1], c2 * sx2 + c3 * ubx, c2 * sy3 + c3 * uby);
      }
    }
    /* a T at a move's spot with a third curve (v48): D Σ (t·n)² over the two halves' first legs n,
       t the third curve's — it leaves at right angles */
    for (var tI = 0; tI < st.tees.length; tI++) {
      var T = st.tees[tI], z = P[T[0]], tv = [P[T[3]][0] - z[0], P[T[3]][1] - z[1]], tln = Math.sqrt(tv[0] * tv[0] + tv[1] * tv[1]) || 1e-9, tu = [tv[0] / tln, tv[1] / tln];
      for (var hh = 1; hh <= 2; hh++) {
        var vv = T[hh], Lg = [P[vv][0] - z[0], P[vv][1] - z[1]], ll = Math.sqrt(Lg[0] * Lg[0] + Lg[1] * Lg[1]) || 1e-9, nu = [Lg[0] / ll, Lg[1] / ll];
        var cs = tu[0] * nu[0] + tu[1] * nu[1];
        E += D * cs * cs;
        if (!g) continue;
        var ft = 2 * D * cs;
        var gT = [ft * (nu[0] - cs * tu[0]) / tln, ft * (nu[1] - cs * tu[1]) / tln], gL = [ft * (tu[0] - cs * nu[0]) / ll, ft * (tu[1] - cs * nu[1]) / ll];
        push(T[3], gT[0], gT[1]); push(vv, gL[0], gL[1]); push(T[0], -gT[0] - gL[0], -gT[1] - gL[1]);
      }
    }
    /* ANGLES at a spot (Peter's cusp at 7, 9/24): the curves leave it at equal angles — straight
       through a spot with two, 120° apart with three: D Σ (θ − 2π/k)² over the k angles between
       neighbouring first legs */
    for (var ci = 0; ci < st.corners.length; ci++) {
      var C = st.corners[ci], sp = C.s, kk = C.nb.length, want = 2 * Math.PI / kk;
      for (q = 0; q < kk; q++) {
        var U = C.nb[q], W = C.nb[(q + 1) % kk];
        var uxx = P[U][0] - P[sp][0], uyy = P[U][1] - P[sp][1], wx = P[W][0] - P[sp][0], wy = P[W][1] - P[sp][1];
        var th = Math.atan2(uxx * wy - uyy * wx, uxx * wx + uyy * wy);
        if (th <= 0) th += 2 * Math.PI;
        E += D * (th - want) * (th - want);
        if (!g) continue;
        var fa = 2 * D * (th - want), u2 = uxx * uxx + uyy * uyy, w2 = wx * wx + wy * wy;
        var gux = fa * uyy / u2, guy = -fa * uxx / u2, gwx = -fa * wy / w2, gwy = fa * wx / w2;
        push(U, gux, guy); push(W, gwx, gwy); push(sp, -gux - gwx, -guy - gwy);
      }
    }
    /* SPOTS against spots and the window's sides (a spot counts as a stretch D of curve: this is
       what places a spot with no curves) */
    for (i = 0; i < st.nS; i++) {
      for (var j = i + 1; j < st.nS; j++) {
        var dij = G.dist(P[i], P[j]);
        if (!(dij > 0)) return Infinity;
        if (g) { if (dij < cap[i]) cap[i] = dij; if (dij < cap[j]) cap[j] = dij; }
        if (dij >= H) continue;
        E += lam * D * phi(dij, D);
        if (!g) continue;
        var fs = lam * D * phi1(dij, D) / dij, qx2 = fs * (P[i][0] - P[j][0]), qy2 = fs * (P[i][1] - P[j][1]);
        push(i, qx2, qy2); push(j, -qx2, -qy2);
      }
      var ws = [P[i][0] - box[0] - spotR, box[2] - P[i][0] - spotR, P[i][1] - box[1] - spotR, box[3] - P[i][1] - spotR];
      for (wi = 0; wi < 4; wi++) {
        if (!(ws[wi] > 0)) return Infinity;
        E += lam * D * phi(ws[wi], cB);
        if (!g) continue;
        f = lam * D * phi1(ws[wi], cB);
        push(i, wi === 0 ? f : wi === 1 ? -f : 0, wi === 2 ? f : wi === 3 ? -f : 0);
      }
    }
    /* every point inside the window */
    for (i = 0; i < n; i++) {
      var wl = P[i][0] - box[0], wr = box[2] - P[i][0], wt = P[i][1] - box[1], wb = box[3] - P[i][1];
      if (!(wl > 0 && wr > 0 && wt > 0 && wb > 0)) return Infinity;
      if (g) cap[i] = Math.min(cap[i], wl, wr, wt, wb);
    }
    return E;
  }

  /* One descent step: L-BFGS (the last MEM steps) on the free vertices, the step cut back
     uniformly until no vertex moves more than a third of its cap (so nothing can cross), then
     halved until the energy falls (Armijo). When no step lowers the energy, even along the plain
     gradient, the drawing has converged (v51: before, a fixed 300 steps with a cooling step size
     — where it stopped was arbitrary, and each press of R or A went on further). */
  /* Slide the inner points of each edge along its polyline Q towards even spacing: every point
     of the edge by the same fraction of the way (measured along the polyline, so that their order
     is kept — moving each as far as it could reorder them and fold the curve), the fraction the
     largest that keeps each within what is left of its third of the cap after the step from P,
     so that nothing can cross. */
  function even(st, P, Q) {
    st.paths.forEach(function (p) {
      var m = p.length - 1, S = [0], t;
      if (m < 2) return;
      for (t = 1; t <= m; t++) S.push(S[t - 1] + G.dist(Q[p[t]], Q[p[t - 1]]));
      var L = S[m];
      if (!(L > 0)) return;
      function at(a) {                             // the point of the polyline at arc length a
        var q = 1;
        while (q < m && S[q] < a) q++;
        var f = (a - S[q - 1]) / ((S[q] - S[q - 1]) || 1), A = Q[p[q - 1]], B = Q[p[q]];
        return [A[0] + f * (B[0] - A[0]), A[1] + f * (B[1] - A[1])];
      }
      var frac = 1;
      for (t = 1; t < m; t++) {
        var i = p[t], T = at(L * t / m), dl = G.dist(T, Q[i]);
        if (!(dl > 0)) continue;
        var room = st.fixed[i] ? 0 : st.cap[i] / 3 - G.dist(Q[i], P[i]);
        frac = Math.min(frac, Math.max(0, room) / dl);
      }
      if (!(frac > 0)) return;
      var moved = [];
      for (t = 1; t < m; t++) moved.push(at((1 - frac) * S[t] + frac * L * t / m));
      for (t = 1; t < m; t++) { Q[p[t]][0] = moved[t - 1][0]; Q[p[t]][1] = moved[t - 1][1]; }
    });
  }
  var MEM = 8;
  function descend(st) {
    var P = st.P, n = P.length, i, k;
    if (!st.g) {
      st.g = P.map(function () { return [0, 0]; }); st.cap = new Float64Array(n);
      st.E = evaluate(st, P, st.g, st.cap); st.S = []; st.Y = [];
      if (st.E0 === undefined) st.E0 = st.E;
    }
    var g = st.g, free = st.fixed, gv = new Float64Array(2 * n);
    /* With the spots fixed (A, v53): a curve's points move only ACROSS their curve — the part of
       the gradient along it is dropped, as the band does (relax.js, v8). The quadrature charges
       crowding per point, so it rewards points for sliding out of crowded stretches: with the
       spots fixed that left 120–180 px legs on curves meant to have a point every D (Peter's
       before.json, 9/25), and the smooth curve through such sparse points crossed its neighbour.
       R keeps v52's descent, which Peter is happy with; whether it should have this too is open.
       The descent from Z's tight start (o.tight) has it too (v116): without it the points drained
       there as well, and the curves through them failed on the 30-spot game of 9/30. */
    function across(vec, Q) {
      if (!st.fixSpots && !st.o.tight) return;
      for (var y = 0; y < n; y++) {
        var vi = st.vinfo[y];
        if (!vi || free[y]) continue;
        var ln = st.lines[vi.u], a = Q[ln[vi.k - 1]], b = Q[ln[vi.k + 1]];
        var tx = b[0] - a[0], ty = b[1] - a[1], tl = Math.sqrt(tx * tx + ty * ty);
        if (!(tl > 0)) continue;
        var s = (vec[2 * y] * tx + vec[2 * y + 1] * ty) / (tl * tl);
        vec[2 * y] -= s * tx; vec[2 * y + 1] -= s * ty;
      }
    }
    for (i = 0; i < n; i++) if (!free[i]) { gv[2 * i] = g[i][0]; gv[2 * i + 1] = g[i][1]; }
    across(gv, P);
    function dot(u, v) { var s = 0; for (var j = 0; j < u.length; j++) s += u[j] * v[j]; return s; }
    for (var attempt = 0; attempt < 2; attempt++) {
      var d = Float64Array.from(gv), al = [];     // two-loop recursion: d = −H g
      for (k = st.S.length - 1; k >= 0; k--) {
        var rho = 1 / dot(st.Y[k], st.S[k]), a = rho * dot(st.S[k], d);
        al[k] = [a, rho];
        for (i = 0; i < d.length; i++) d[i] -= a * st.Y[k][i];
      }
      if (st.S.length) {
        var last = st.S.length - 1, gam = dot(st.S[last], st.Y[last]) / dot(st.Y[last], st.Y[last]);
        for (i = 0; i < d.length; i++) d[i] *= gam;
      }
      for (k = 0; k < st.S.length; k++) {
        var bb = al[k][1] * dot(st.Y[k], d);
        for (i = 0; i < d.length; i++) d[i] += st.S[k][i] * (al[k][0] - bb);
      }
      for (i = 0; i < d.length; i++) d[i] = -d[i];
      var slope = dot(gv, d);
      if (!(slope < 0)) { st.S = []; st.Y = []; continue; }
      /* each vertex's move is clipped to a third of its cap (so nothing can cross); the first
         step without memory goes as far as the largest cap allows */
      var dmax = 0;
      for (i = 0; i < n; i++) dmax = Math.max(dmax, Math.sqrt(d[2 * i] * d[2 * i] + d[2 * i + 1] * d[2 * i + 1]));
      if (!(dmax > 0)) break;
      var alpha = st.S.length ? 1 : H / 3 / dmax, Q = P.map(function (p) { return p.slice(); }), En = Infinity;
      for (var h = 0; h < 60; h++) {
        var gd = 0, far = 0, rel = 0;
        for (i = 0; i < n; i++) {
          var mx = alpha * d[2 * i], my = alpha * d[2 * i + 1], ml = Math.sqrt(mx * mx + my * my), lim = st.cap[i] / 3;
          if (ml > lim) { mx *= lim / ml; my *= lim / ml; }
          Q[i][0] = P[i][0] + mx; Q[i][1] = P[i][1] + my;
          gd += gv[2 * i] * mx + gv[2 * i + 1] * my;
          far = Math.max(far, Math.abs(mx) + Math.abs(my));
          rel = Math.max(rel, (Math.abs(mx) + Math.abs(my)) / Math.min(1, st.cap[i] || 1));
        }
        /* A step that moves no point by a 3·MEM-th of a pixel is no step: 3·MEM of them together would
           not move a point by the pixel the stop rule below asks for (v107). v51–v106 halved on, up
           to 60 times: near convergence 40–45 energy evaluations per step for moves of 1e-11 px —
           on Peter's game of 9/29 (63 spots) 2100 of R's 3600 evaluations, 17 of its 30 s. v113–v116
           exempted Z's tight start; there 26,000 trials for 1,800 steps took 127 of 138 s on the 30-spot
           game of 9/30, a quarter of the accepted steps moving points by less than 1e-3 px — the
           descent pressing against an energy jump, which a jiggle gets past far sooner (v117).
           But from a tight start a point closer than a pixel to something may need steps that
           small: there its own cap (a third of its gap) is the measure instead of the pixel (v118;
           with the pixel alone Z failed at once, after 36–105 steps, for 3 of 16 outer regions). */
        if ((st.o.tight ? rel : far) * 3 * MEM < 1) { En = Infinity; break; }
        En = evaluate(st, Q, null);
        if (En <= st.E + 1e-4 * gd && En < st.E) break;
        alpha /= 2;
      }
      if (!(En < st.E)) { if (st.S.length) { st.S = []; st.Y = []; continue; } break; }
      /* With the spots fixed the points of each curve are then spread evenly along its polyline
         again (v53). They move only across their curve (`across`), but "across" is across the
         chord between a point's neighbours, and where the polyline bends the points still drift
         apart or together — 14 → 89 px legs on a 40 px spacing were seen. The energy is that of
         the spread points. */
      if (st.fixSpots || st.o.tight) even(st, P, Q);
      /* DONE when the last 3 · MEM steps (time for L-BFGS to learn the curvature afresh twice over)
         together moved no point by a whole pixel — the smallest change that can be seen — or
         gained less than a pixel's worth of energy a step (E is measured in pixels of length: a
         gain of one is a curve one pixel shorter). (v54; Peter, 9/26: "stopping at good looking
         configurations rather than going 10 times longer with little or no improvement is actually
         preferable". v51–v53 asked for a tenth of a pixel, or a gain down at the arithmetic's
         rounding, and ran thousands of steps for changes nobody sees: 7016 → 946 steps on the
         20-05-56 fixture for the same picture. A rule relative to the run's own gain — less than a
         hundredth of it — stopped 2–3 times sooner still, but a second press then went on to move
         spots 70–130 px: the drawing was not at rest.) A second press now moves spots a few px at most. */
      var mv = 0;
      for (i = 0; i < n; i++) mv = Math.max(mv, Math.abs(Q[i][0] - P[i][0]) + Math.abs(Q[i][1] - P[i][1]));
      var hist = st.hist || (st.hist = []);
      hist.push([st.E - En, mv]);
      if (hist.length > 3 * MEM) hist.shift();
      var tot = 0, far = 0; hist.forEach(function (x) { tot += x[0]; far += x[1]; });
      if (hist.length === 3 * MEM && (far < 1 || tot < 3 * MEM)) {
        if (st.confirmed) return false;
        st.confirmed = true;                        // once more with L-BFGS's memory cleared: a fresh start (a second
        st.S = []; st.Y = []; st.hist = []; return true;   //  press) must find nothing more either (v52)
      }
      var tiny = st.E - En < 1000 * 2.2e-16 * Math.abs(st.E);
      var g2 = Q.map(function () { return [0, 0]; }), cap2 = new Float64Array(n);
      En = evaluate(st, Q, g2, cap2);
      var sv = new Float64Array(2 * n), yv = new Float64Array(2 * n), g2v = new Float64Array(2 * n);
      for (i = 0; i < n; i++) if (!free[i]) { g2v[2 * i] = g2[i][0]; g2v[2 * i + 1] = g2[i][1]; }
      across(g2v, Q);
      for (i = 0; i < n; i++) {
        sv[2 * i] = Q[i][0] - P[i][0]; sv[2 * i + 1] = Q[i][1] - P[i][1];
        yv[2 * i] = g2v[2 * i] - gv[2 * i]; yv[2 * i + 1] = g2v[2 * i + 1] - gv[2 * i + 1];
        P[i][0] = Q[i][0]; P[i][1] = Q[i][1];
      }
      if (tiny) { st.S = []; st.Y = []; }            // a tiny gain along L-BFGS's direction: try the plain gradient next
      else if (dot(sv, yv) > 0) { st.S.push(sv); st.Y.push(yv); if (st.S.length > MEM) { st.S.shift(); st.Y.shift(); } }
      st.g = g2; st.cap = cap2; st.E = En;
      return true;
    }
    return false;                                   // no step lowers the energy: converged
  }

  /* Converged on this discretization: are the points still about D apart? A curve that grew
     or shrank gets a point every ≈ D again (as createRedraw spaces them) and the descent goes on;
     when no curve needs a different number of points, it is done — and a second press, which
     spaces them the same way, starts where this one ended. */
  function respace(st) {
    if (st.o.tight) return subdivide(st);
    var need = false;
    st.paths.forEach(function (p, e) {
      var L = 0;
      for (var t = 1; t < p.length; t++) L += G.dist(st.P[p[t]], st.P[p[t - 1]]);
      var k = p.length - 2, x = L / st.o.D, least = leastPoints(st.game, e);   // keep k while it is one of the two counts nearest L / D
      if (k !== Math.max(least, Math.floor(x)) && k !== Math.max(least, Math.ceil(x))) need = true;
    });
    if (!need) return false;
    var ns = createRedraw(finishWith(st, false, true).game, st.o, st.fixSpots);
    /* in a tight place the new points would cross: then take them ON the present polylines
       instead (v106) — the descent kept those clear of each other (PrEd), so points anywhere on
       them cannot cross. (Points from the smooth splines, as before, where they do not cross: the
       fixtures' pictures stay as they were — from the polylines they came out up to 2 px tighter.)
       On Peter's game of 9/29 (63 spots) a curve that had grown from 70 to 294 px with no point
       inside could not be re-spaced from its spline, and R was refused. */
    if (polylinesCross(ns)) ns = createRedraw(redrawCurrent(st), st.o, st.fixSpots);
    /* if even those cross, or the position changed: keep the present points. (Two curves crossing each other
       twice leave the rotation system at every spot as it was, so the position text alone did not
       see it — Peter's before.json, 9/25: A went on with two curves crossed and was refused at the
       end; v53) */
    if (Rm.positionKey(redrawCurrent(ns)) !== st.key0 || polylinesCross(ns)) return false;
    /* counts met before: they flip back and forth (a curve's length at a whole number of D) — stop
       here. (v51 stopped after 8 re-spacings, which a drawing that grows a lot can need; v52) */
    var counts = ns.paths.map(function (p) { return p.length; }).join(',');
    st.counts = st.counts || {};
    if (st.counts[counts]) return false;
    st.counts[counts] = true;
    ['P', 'regions', 'paths', 'segs', 'lines', 'units', 'fixed', 'tees', 'corners', 'comfort', 'borderComfort', 'vinfo', 'segLine', 'segK', 'segEdge', 'spotAt'].forEach(function (k) { st[k] = ns[k]; });
    if (st.fixSpots) st.game.spots.forEach(function (s, i) { if (st.fixed[i]) { st.P[i][0] = s.x; st.P[i][1] = s.y; } });
    st.g = null; st.seen = null; st.hist = null; st.confirmed = false; st.respaced = (st.respaced || 0) + 1;
    return true;
  }

  /* Re-spacing from a TIGHT start (Z): every leg longer than D is cut into equal parts no longer
     than D, and nothing else changes — the polylines stay exactly where they are, so nothing can
     cross and the position cannot change. (Z's start has its points ON its straight legs, o.keepKnots,
     and respace's createRedraw kept them as they were: no curve was ever re-spaced, the descent
     drained the points out of crowded stretches — legs of 200–330 px with turns of 50–120° between
     them on the 30-spot game of 9/30 — the bending term, D² θ²/ℓ, is cheap on long legs, and the
     spline through such points swung wide of its polyline and touched its neighbours.) */
  function subdivide(st) {
    var g = redrawCurrent(st), D = st.o.D, any = false;
    g.edges.forEach(function (e, ei) {
      var Q = st.paths[ei].map(function (v) { return st.P[v]; }), R = [Q[0]];
      for (var j = 1; j < Q.length; j++) {
        var parts = Math.ceil(G.dist(Q[j - 1], Q[j]) / D);
        if (parts > 1) any = true;
        for (var f = 1; f < parts; f++) R.push([Q[j - 1][0] + f / parts * (Q[j][0] - Q[j - 1][0]), Q[j - 1][1] + f / parts * (Q[j][1] - Q[j - 1][1])]);
        R.push(Q[j].slice());
      }
      e.pieces = E.polylinePieces(R);
    });
    if (!any) return false;
    adopt(st, createRedraw(g, Object.assign({}, st.o, { keepKnots: true }), st.fixSpots));
    st.respaced = (st.respaced || 0) + 1;
    return true;
  }
  /* st takes over the points and everything built on them from ns (a createRedraw of the same drawing's
     curves with other points); the descent starts afresh. */
  function adopt(st, ns) {
    ['P', 'regions', 'paths', 'segs', 'lines', 'units', 'fixed', 'tees', 'corners', 'comfort', 'borderComfort', 'vinfo', 'segLine', 'segK', 'segEdge', 'spotAt'].forEach(function (k) { st[k] = ns[k]; });
    st.g = null; st.seen = null; st.hist = null; st.confirmed = false;
  }

  /* Do any two segments of the polylines cross (segments with a common end excepted)? Found
     through a grid of CELL-sized cells. */
  function polylinesCross(st) {
    var P = st.P, segs = st.segs, cells = new Map();
    for (var k = 0; k < segs.length; k++) {
      var a = segs[k][0], b = segs[k][1], hit = false;
      var x0 = Math.floor(Math.min(P[a][0], P[b][0]) / CELL), x1 = Math.floor(Math.max(P[a][0], P[b][0]) / CELL);
      var y0 = Math.floor(Math.min(P[a][1], P[b][1]) / CELL), y1 = Math.floor(Math.max(P[a][1], P[b][1]) / CELL);
      for (var cx = x0; cx <= x1 && !hit; cx++) for (var cy = y0; cy <= y1 && !hit; cy++) {
        var ck = cx * 65536 + cy, lst = cells.get(ck);
        if (!lst) { cells.set(ck, [k]); continue; }
        for (var i = 0; i < lst.length && !hit; i++) {
          var c = segs[lst[i]][0], d = segs[lst[i]][1];
          if (a === c || a === d || b === c || b === d) continue;
          if (G.segCross(P[a], P[b], P[c], P[d])) hit = true;
        }
        lst.push(k);
      }
      if (hit) return true;
    }
    return false;
  }
  function stepRedraw(st, count) {
    while (count-- > 0 && !st.done) {
      if (descend(st)) st.it++;
      else if (!respace(st)) {
        if (st.o.tight && jiggle(st)) continue;
        if (st.o.tight && st.spotR < (st.o.spotR || 0) && restage(st)) continue;   // the spots grow (see createRedraw)
        st.done = true;
      }
    }
    return st.done;
  }
  /* From a tight start (Z) the descent STICKS on the energy's jumps (the comfort side of a
     neighbour, which of a curve's own parts is nearest — v53 knew them): every step along the
     gradient raises E, though the drawing is nowhere near settled. A JIGGLE: every free point moves
     a little at random (within a sixth of its cap: nothing can cross), and the descent goes on
     from there with its memory cleared. Kept while the jiggles pay: given up after two in a row
     that did not bring E below the best so far by the stop rule's measure (a pixel's worth a step
     over 3·MEM steps — v117; v115 asked for 1e-6 of |E|), or after twelve in all. A jiggle can also
     end WORSE than the drawing it started from (seen on every Z case of 9/30): so the best drawing
     met is kept, and the descent ends there (v117; before, it ended wherever the last jiggle had
     led — 400 px of energy above the best on the 9-spot game). */
  function jiggle(st) {
    var gain = st.bestE === undefined ? Infinity : st.bestE - st.E;
    if (gain > 3 * MEM) { st.bestE = st.E; st.idle = 0; st.best = JSON.parse(JSON.stringify(redrawCurrent(st))); }   // (a deep copy:
    else st.idle = (st.idle || 0) + 1;                                                                                  //  redrawCurrent's pieces share P's points)
    if (st.idle >= 2 || (st.jiggles || 0) >= 12) {
      if (st.best && st.E > st.bestE) {             // back to the best drawing met (the same points: nothing to check)
        var ns = createRedraw(st.best, Object.assign({}, st.o, { keepKnots: true }), st.fixSpots);
        adopt(st, ns);
        st.E = st.bestE; st.S = []; st.Y = [];
      }
      return false;
    }
    var P = st.P, n = P.length;
    function rnd() { st.seed = (st.seed * 1103515245 + 12345) % 2147483648; return st.seed / 2147483648; }   // the same jiggles every time (tests)
    if (st.seed === undefined) st.seed = 1;
    for (var i = 0; i < n; i++) {
      if (st.fixed[i]) continue;
      var th = 2 * Math.PI * rnd(), r = st.cap[i] / 6 * rnd();
      P[i][0] += r * Math.cos(th); P[i][1] += r * Math.sin(th);
    }
    st.g = null; st.S = []; st.Y = []; st.hist = []; st.confirmed = false;
    st.jiggles = (st.jiggles || 0) + 1;
    return true;
  }

  /* The drawing as it is now, curves as their polylines (for the animation). */
  function redrawCurrent(st) {
    var g = JSON.parse(JSON.stringify(st.game)), P = st.P;
    g.spots.forEach(function (s, i) { s.x = P[i][0]; s.y = P[i][1]; });
    g.edges.forEach(function (e, k) { e.pieces = E.polylinePieces(st.paths[k].map(function (v) { return P[v]; })); });
    return g;
  }

  function unit(v) { var l = Math.sqrt(v[0] * v[0] + v[1] * v[1]) || 1; return [v[0] / l, v[1] / l]; }
  /* A curve with no corners (Peter, 9/24: "we should not have sharp corners in a curve"): the
     clamped C² spline THROUGH the converged polyline (chord-length knots), leaving and arriving
     along its end legs (or dirA / dirB). The bending energy has already smoothed the polyline, so
     the spline turns gently between its points; and since it passes through them, a second press
     starts from the polyline the first one ended with (v51; v46–v50 took the polyline as the
     CONTROL POLYGON, which rounds its corners inwards — every press started somewhere else). */
  function smoothCurve(Q, dirA, dirB, dense) {
    if (dense) {                                    // also through the middle of every leg (true), or through points
      var R = [Q[0]];                               //  splitting every leg into parts no longer than `dense`: it hugs the polyline
      for (var j = 1; j < Q.length; j++) {
        var parts = dense === true ? 2 : Math.ceil(G.dist(Q[j - 1], Q[j]) / dense);
        for (var f = 1; f < parts; f++) R.push([Q[j - 1][0] + f / parts * (Q[j][0] - Q[j - 1][0]), Q[j - 1][1] + f / parts * (Q[j][1] - Q[j - 1][1])]);
        R.push(Q[j]);
      }
      Q = R;
    }
    var n = Q.length;
    return G.interpolate(Q, dirA || unit([Q[1][0] - Q[0][0], Q[1][1] - Q[0][1]]),
                         dirB || unit([Q[n - 1][0] - Q[n - 2][0], Q[n - 1][1] - Q[n - 2][1]]));
  }
  /* The splines: each unit's smooth curve. A move's spot z with only the
     move's two curves rides on it: it goes where the curve passes nearest it,
     cut there, so the two curves join C² and z can still slide. A spot z with
     a third curve stays where it is, and the two halves are drawn separately
     through it with ONE tangent there — halfway between the legs arriving and leaving
     — so the move's curve has no corner at z (C¹). Then the checks.
     Returns { game, error, moved (largest spot move, px), clearance (least certified, px) }. */
  function finishRedraw(st) {
    var r = finishWith(st, false);
    if (!r.error) return r;
    var r2 = finishWith(st, true);                  // tight places: the splines also through the legs' middles —
    if (!r2.error && leastRadius(r2.game) >= st.o.spotR) { r2.dense = true; return r2; }   //  unless that bends a curve tighter than a spot
    /* v106 (Peter's game of 9/29): the descent charges crowding per point, so points drain out of
       crowded stretches — legs of 100–230 px on a spacing D of 40, or three points within 3 px and
       then one leg of 90 — and a spline through such points wanders off its polyline, which is the
       part the descent kept clear. So: the points spread evenly along each curve's polyline again
       (the polyline unchanged), and the spline also through points splitting every leg into parts
       no longer than D — it hugs the polyline. */
    var ev = evenly(st);
    var r3 = finishWith(ev, st.o.D);
    if (!r3.error && leastRadius(r3.game) >= st.o.spotR) { r3.dense = true; return r3; }
    /* Last: where a move's spot has a third curve, its two halves may meet at a corner there (each
       leaves along its own leg) instead of with one tangent. At a sharp corner of the polyline at
       such a spot the one tangent (halfway between the legs) points along the third curve or back
       into the corner, and the curve hooks (9/29: 43-51-7 at 51, 36-38-1 at 38). */
    var corners = {}, r4 = r3;
    for (;;) {                                      // corners only at the spots where the curves that fail meet
      var more = false;
      Rm.unitsOf(r4.game).forEach(function (u) {
        if (Rm.certOf(r4.game, u, st.o) > 0) return;
        ev.units.forEach(function (w) { if (w.z >= 0 && (w.z === u.a || w.z === u.b) && !corners[w.z]) { corners[w.z] = true; more = true; } });
      });
      if (!more) break;
      r4 = finishWith(ev, st.o.D, false, corners);
      if (!r4.error) { r4.dense = true; r4.corners = Object.keys(corners).length; return r4; }
    }
    return r;
  }
  /* A copy of the state with each edge's points spread evenly along its polyline, as many as
     createRedraw would give it; the polylines, the position and everything else are as in st. */
  function evenly(st) {
    var g = redrawCurrent(st), D = st.o.D;
    g.edges.forEach(function (e, ei) {
      var Q = st.paths[ei].map(function (v) { return st.P[v]; }), S = [0], t, q = 1;
      for (t = 1; t < Q.length; t++) S.push(S[t - 1] + G.dist(Q[t], Q[t - 1]));
      var L = S[S.length - 1], k = Math.max(leastPoints(st.game, ei), Math.round(L / D)), out = [Q[0]];
      for (var j = 1; j <= k; j++) {
        var at = L * j / (k + 1);
        while (q < S.length - 1 && S[q] < at) q++;
        var f = (at - S[q - 1]) / ((S[q] - S[q - 1]) || 1);
        out.push([Q[q - 1][0] + f * (Q[q][0] - Q[q - 1][0]), Q[q - 1][1] + f * (Q[q][1] - Q[q - 1][1])]);
      }
      out.push(Q[Q.length - 1]);
      e.pieces = E.polylinePieces(out);            // (createRedraw keeps these points: their number is the one it wants)
    });
    var ns = createRedraw(g, st.o, st.fixSpots);
    ns.key0 = st.key0; ns.game = st.game;           // measured against the drawing R started from
    return ns;
  }
  /* The least radius of curvature over all curves, sampled (41 points a piece). */
  function leastRadius(g) {
    var best = Infinity;
    g.edges.forEach(function (e) {
      e.pieces.forEach(function (b) {
        for (var k = 0; k <= 40; k++) {
          var t = k / 40, d1 = [], d2 = [];
          for (var c = 0; c < 2; c++) {
            d1[c] = 3 * ((1 - t) * (1 - t) * (b[1][c] - b[0][c]) + 2 * (1 - t) * t * (b[2][c] - b[1][c]) + t * t * (b[3][c] - b[2][c]));
            d2[c] = 6 * ((1 - t) * (b[2][c] - 2 * b[1][c] + b[0][c]) + t * (b[3][c] - 2 * b[2][c] + b[1][c]));
          }
          var sp = Math.sqrt(d1[0] * d1[0] + d1[1] * d1[1]), cr = Math.abs(d1[0] * d2[1] - d1[1] * d2[0]);
          if (cr > 0) best = Math.min(best, sp * sp * sp / cr);
        }
      });
    });
    return best;
  }
  function finishWith(st, dense, unchecked, corners) {
    var o = st.o, g = JSON.parse(JSON.stringify(st.game)), P = st.P;
    g.spots.forEach(function (s, i) { s.x = P[i][0]; s.y = P[i][1]; });
    /* At a spot with just two curve ends (not a move's own spot) the curve runs smoothly THROUGH
       it: each end leaves along the direction halfway between its own first leg and the reverse of
       the other's, so the two meet with one tangent (C¹) — before, each left along its own first
       leg, and the angle the energy left between them showed as a kink (the loop at 4, 9/24). */
    var through = {};
    st.corners.forEach(function (C) {
      if (C.nb.length !== 2) return;
      var u0 = unit([P[C.nb[0]][0] - P[C.s][0], P[C.nb[0]][1] - P[C.s][1]]), u1 = unit([P[C.nb[1]][0] - P[C.s][0], P[C.nb[1]][1] - P[C.s][1]]);
      through[C.nb[0]] = unit([u0[0] - u1[0], u0[1] - u1[1]]); through[C.nb[1]] = unit([u1[0] - u0[0], u1[1] - u0[1]]);
    });
    function ends(ln) {                             // [leaving the first spot, arriving at the last], or null for the first leg
      var a = through[ln[1]], b = through[ln[ln.length - 2]];
      return [ln[0] < st.nS && a ? a : null, ln[ln.length - 1] < st.nS && b ? [-b[0], -b[1]] : null];
    }
    st.units.forEach(function (u, ui) {
      var dd = ends(st.lines[ui]);
      var c = u.edges.length === 1 || Rm.slidable(st.game, u.z) ? smoothCurve(st.lines[ui].map(function (v) { return P[v]; }), dd[0], dd[1], dense) : null;
      if (u.edges.length === 1) { g.edges[u.edges[0]].pieces = c.pieces; g.edges[u.edges[0]].h = c.h; return; }
      if (!Rm.slidable(st.game, u.z)) { throughSpot(g, u, st.lines[ui].map(function (v) { return P[v]; }), st.paths[u.edges[0]].length - 1, dense, dd, !!(corners && corners[u.z])); return; }
      var Hc = 0; c.h.forEach(function (x) { Hc += x; });
      var sp = { pieces: c.pieces, h: c.h, H: Hc };
      var m = Math.min(2 * o.spotR, Hc / 3);        // kept off the ends: two spot radii, or a third on a short curve
      var uz = Math.min(Hc - m, Math.max(m, Rm.paramOf(sp, P[u.z])));
      var cc = Rm.cut(sp, uz), e1 = g.edges[u.edges[0]], e2 = g.edges[u.edges[1]];
      e1.pieces = cc.left.pieces; e1.h = cc.left.h; e2.pieces = cc.right.pieces; e2.h = cc.right.h;
      g.spots[u.z].x = cc.point[0]; g.spots[u.z].y = cc.point[1];
    });
    if (unchecked) return { game: g };
    var moved = 0;
    g.spots.forEach(function (s, i) { moved = Math.max(moved, G.dist([s.x, s.y], [st.game.spots[i].x, st.game.spots[i].y])); });
    var clearance = leastClearance(g, o), error = null;
    if (Rm.positionKey(g) !== st.key0)
      error = Rm.positionKey(redrawCurrent(st)) === st.key0 ?
              'the smooth curves would cross where the drawing is too tight' + (st.fixSpots ? ' with the spots fixed — R moves them too' : '') :
              'the new drawing would not be the same position (a bug: please save the game)';
    else if (!(clearance > 0)) error = 'a curve came too close to something' + (st.fixSpots ? ': too tight with the spots fixed — R moves them too' : '');
    return { game: g, error: error, moved: moved, clearance: clearance };
  }

  /* A move's two halves through its spot, Q[k] = z, with one tangent at z. */
  function throughSpot(g, u, Q, k, dense, dd, corner) {
    var z = Q[k], a = unit([z[0] - Q[k - 1][0], z[1] - Q[k - 1][1]]), b = unit([Q[k + 1][0] - z[0], Q[k + 1][1] - z[1]]);
    var d = unit([a[0] + b[0], a[1] + b[1]]);      // halfway between arriving and leaving
    var left = smoothCurve(Q.slice(0, k + 1), dd[0], corner ? a : d, dense), right = smoothCurve(Q.slice(k), corner ? b : d, dd[1], dense);
    g.edges[u.edges[0]].pieces = left.pieces; g.edges[u.edges[0]].h = left.h;
    g.edges[u.edges[1]].pieces = right.pieces; g.edges[u.edges[1]].h = right.h;
  }

  /* The least certified clearance of a drawing's curves (for the log: before and after). */
  function leastClearance(game, o) {
    var c = Infinity;
    Rm.unitsOf(game).forEach(function (u) { c = Math.min(c, Rm.certOf(game, u, o)); });
    return c;
  }

  var api = { createRedraw: createRedraw, stepRedraw: stepRedraw, redrawCurrent: redrawCurrent, finishRedraw: finishRedraw,
              leastClearance: leastClearance, leastRadius: leastRadius, evaluate: evaluate };
  root.SproutsRedraw = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : this);
