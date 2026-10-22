/* =========================================================================
   layout.js — a drawing of a position from its combinatorial map ALONE, with
   no reference to the present picture (Z, 9/30: Peter's "draw the picture
   from scratch" when a move cannot be drawn even after R). DOM-free (global
   SproutsLayout, or require()). Needs geom.js, engine.js.

   THE MAP. Spots are vertices, curves are edges; each edge gives two
   half-edges (2e = a → b, 2e + 1 = b → a, as engine.js numbers them); at
   each vertex the half-edges leaving it are kept in their cyclic order (the
   rotation system, in the engine's sense: following "the half-edge just
   before my twin in the rotation at my head" walks round a face). A FACE
   (region) is a list of WALKS: the cycles of half-edges bounding it, and its
   isolated spots. mapOf reads all this off the present drawing through the
   engine; withMove adds a move to it combinatorially (the move as ai.js
   names it: region r, corner i of boundary j to corner i2 of boundary j2,
   the other boundaries S enclosed) — the same surgery as ai.js apply, on
   the rotation system instead of the spot lists.

   A CORNER is named by the half-edge h that leaves it: the gap in the
   rotation at tail(h) between h and the twin of the half-edge before h in
   the face walk. A new half-edge put in that gap (right after h in the
   rotation) lies in that face. Every construction below adds edges between
   two such corners of one face.

   THE DRAWING. A straight-line planar drawing of a simple triangulation on a
   (2n − 4) × (n − 2) grid (de Fraysseix, Pach, Pollack 1990: canonical
   ordering and the shift method) — polynomial area, no crossings by theorem,
   so nothing crowds exponentially as Tutte's did (9/24). The map is made a
   simple triangulation first, and every helper is removed afterwards:
     1. every edge gets a midpoint (kills parallel curves: a loop's two);
     2. the walks of each face are joined by BRIDGES (dummy edges), and every
        vertex with fewer than two edges gets a bridge to another corner of
        its face — so the graph is connected and every face is one closed
        walk (repeated vertices allowed: a bare path is walked on both
        sides); bridges get midpoints too;
     3. each face gets a FACE VERTEX f and a SPOKE f – d – u to every corner
        occurrence (d one per corner): the faces round f are hexagons
        f, d, u, m, u', d' — one per step of the walk — cut into four
        triangles by the chords m–d, m–d', d–d'. Every added edge names a
        thing that exists once (a midpoint, a corner, a face), so no edge is
        doubled: the graph is simple and every face a triangle.
   The chosen outer region's face vertex is the apex of the outer triangle,
   so the drawing's outside IS that region — any region may be the outer one
   (Peter, 9/24). The curves come out as two-leg polylines u – m – v; R's
   descent (redraw.js) then does the beautifying.
   ========================================================================= */
(function (root) {
  'use strict';
  var G = root.SproutsGeom || require('./geom.js');
  var E = root.SproutsEngine || require('./engine.js');

  /* ---------------- the map ---------------- */

  function newMap(nV) {
    var m = { nV: nV, half: [], rot: [], edges: [], faces: [] };
    for (var i = 0; i < nV; i++) m.rot.push([]);
    return m;
  }
  function addVertex(m) { m.rot.push([]); return m.nV++; }
  /* an edge u – v whose half u → v goes right after `afterU` in the rotation
     at u (null: anywhere — the rotation is empty or the order is free), and
     v → u after `afterV` at v; `real` = the game's edge index, or -1 */
  function addEdge(m, u, afterU, v, afterV, real) {
    var e = m.edges.length, h = 2 * e;
    m.edges.push({ a: u, b: v, real: real });
    m.half.push({ tail: u, head: v, edge: e }, { tail: v, head: u, edge: e });
    insert(m, u, afterU, h); insert(m, v, afterV, h + 1);
    return e;
  }
  function insert(m, v, after, h) {
    var r = m.rot[v];
    if (after === null || after === undefined) { r.push(h); return; }
    var k = r.indexOf(after);
    if (k < 0) throw new Error('layout: corner half ' + after + ' is not at vertex ' + v);
    r.splice(k + 1, 0, h);
  }
  function next(m, h) {                            // the engine's rule
    var twin = h ^ 1, r = m.rot[m.half[h].head], k = r.indexOf(twin);
    return r[(k - 1 + r.length) % r.length];
  }
  function walkFrom(m, h0) {
    var w = [], h = h0;
    do { w.push(h); h = next(m, h); } while (h !== h0);
    return w;
  }
  function allWalks(m) {
    var seen = new Uint8Array(m.half.length), out = [];
    for (var h = 0; h < m.half.length; h++) {
      if (seen[h]) continue;
      var w = walkFrom(m, h);
      w.forEach(function (x) { seen[x] = 1; });
      out.push(w);
    }
    return out;
  }
  function copyMap(m) {
    return { nV: m.nV, half: m.half.map(function (h) { return { tail: h.tail, head: h.head, edge: h.edge }; }),
             rot: m.rot.map(function (r) { return r.slice(); }), edges: m.edges.map(function (e) { return { a: e.a, b: e.b, real: e.real }; }),
             faces: m.faces.map(function (f) { return { key: f.key, walks: f.walks.map(function (w) { return w.halves ? { halves: w.halves.slice() } : { spot: w.spot }; }) }; }) };
  }
  /* subdivide edge e = (u, v): u – w – v; the half u → w keeps e's id, so a
     corner named by it is unchanged; returns the new vertex */
  function subdivide(m, e) {
    var w = addVertex(m), ed = m.edges[e], v = ed.b, h = 2 * e, t = h + 1, e2 = m.edges.length, h2 = 2 * e2;
    if (m.mids) { m.mids[w] = true; m.leaving[t] = h2 + 1; }   // the corner named by t (which now leaves w) is now after v → w
    m.edges.push({ a: w, b: v, real: -1, kind: ed.kind, faces: ed.faces });
    m.half.push({ tail: w, head: v, edge: e2 }, { tail: v, head: w, edge: e2 });
    if (m.side) { m.side[h2] = m.side[h]; m.side[h2 + 1] = m.side[t]; }
    m.half[h].head = w; m.half[t].tail = w; ed.b = w;
    m.rot[v][m.rot[v].indexOf(t)] = h2 + 1;
    m.rot[w] = [t, h2];
    return w;
  }

  /* The map of the drawing: the engine's half-edges, rotations recovered from
     its face cycles (the one before my twin in the rotation is my
     predecessor's successor), the regions as faces of walks. */
  function mapOf(game) {
    var an = E.analyse(game.spots, game.edges), m = newMap(game.spots.length);
    game.edges.forEach(function (e, ei) {
      m.edges.push({ a: e.a, b: e.b, real: ei });
      m.half.push({ tail: e.a, head: e.b, edge: ei }, { tail: e.b, head: e.a, edge: ei });
    });
    var succ = new Int32Array(m.half.length);     // succ[g] = the half after g in the rotation at tail(g)
    an.cycles.forEach(function (c) {
      var hs = c.halves;
      for (var k = 0; k < hs.length; k++) succ[hs[k].id] = hs[(k - 1 + hs.length) % hs.length].id ^ 1;
    });
    var done = new Uint8Array(m.half.length);
    for (var h = 0; h < m.half.length; h++) {
      if (done[h]) continue;
      for (var g = h; !done[g]; g = succ[g]) { done[g] = 1; m.rot[m.half[g].tail].push(g); }
    }
    an.regions.forEach(function (r) {
      m.faces.push({ key: r.key, walks: r.boundaries.map(function (bd) {
        return bd.cycle === undefined ? { spot: bd.spot } : { halves: an.cycles[bd.cycle].halves.map(function (x) { return x.id; }) };
      }) });
    });
    return m;
  }

  /* The map after the move mv (ai.js: r, j, i, j2, i2, x, y, two, S — the
     regions and boundaries in the engine's order, as fromAnalysis lists
     them). z = the new spot; the new edges x → z and z → y are the game's
     next pair. The rotation gets x → z right after corner i's half at x and
     y → z after corner i2's at y (a loop at one corner: y → z lands between
     h and x → z, so that the loop's inside is the walk through z → x —
     apply's B_a, which takes S). */
  function withMove(m0, mv) {
    var m = copyMap(m0), z = addVertex(m), F = m.faces[mv.r];
    var wx = F.walks[mv.j], wy = F.walks[mv.j2];
    var hx = wx.halves ? wx.halves[mv.i] : null, hy = wy.halves ? wy.halves[mv.i2] : null;
    var real = m0.edges.length;
    var e1 = addEdge(m, mv.x, hx, z, null, real);                           // N1 = x → z, T1 = z → x
    var e2 = addEdge(m, z, null, mv.y, hy, real + 1);                       // N2 = z → y, T2 = y → z
    var N1 = 2 * e1, T1 = N1 + 1;                   // (a loop at one corner: T2 went in after h too, so [h, T2, N1] — as wanted)
    /* the faces: every walk keeps its identity by its first half; the joined
       or split ones are found by their new halves */
    var walks = allWalks(m), ofHalf = {};
    walks.forEach(function (w, wi) { w.forEach(function (h) { ofHalf[h] = wi; }); });
    function same(w) { return w.halves ? { halves: walks[ofHalf[w.halves[0]]] } : w; }
    var faces = [];
    m.faces.forEach(function (f, fi) {
      if (fi !== mv.r) { faces.push({ key: f.key, walks: f.walks.map(same) }); return; }
      var rest = f.walks.filter(function (w, j) { return j !== mv.j && j !== mv.j2; }).map(same);
      if (mv.two) { faces.push({ key: f.key, walks: rest.concat([{ halves: walks[ofHalf[N1]] }]) }); return; }
      var A = { halves: walks[ofHalf[T1]] }, B = { halves: walks[ofHalf[N1]] };
      if (ofHalf[T1] === ofHalf[N1]) throw new Error('layout: the one-boundary move did not split its walk');
      var inS = {}; mv.S.forEach(function (k) { inS[k] = 1; });
      var As = [A], Bs = [B];
      f.walks.forEach(function (w, j) { if (j !== mv.j) (inS[j] ? As : Bs).push(same(w)); });
      faces.push({ key: f.key, walks: As }); faces.push({ key: f.key, walks: Bs });
    });
    m.faces = faces;
    return m;
  }

  /* ---------------- the triangulation ---------------- */

  function cornerOf(m, w) {                        // a corner of a walk: [vertex, the half after which to insert]
    if (!w.halves) return [w.spot, null];
    var h = w.halves[0]; if (m.leaving[h] !== undefined) h = m.leaving[h];
    return [m.half[h].tail, h];
  }
  function bridge(m, c1, c2, face) {              // a dummy edge between two corners of face `face`, with a midpoint
    var e = addEdge(m, c1[0], c1[1], c2[0], c2[1], -1);
    m.side[2 * e] = m.side[2 * e + 1] = face;
    m.edges[e].kind = 'bridge'; m.edges[e].faces = [face, face];
    return subdivide(m, e);
  }

  /* Steps 1 and 2 (midpoints, bridges) on a copy of the map: { m, mid } — or null for a lone spot. */
  function prepare(m0, outer) {
    var m = copyMap(m0), mid = [];
    m.faces = null;                                // the face lists below are the input's; walks are recomputed as needed
    m.side = [];                                   // side[h] = the input face that half-edge h borders
    m.mids = {};                                   // the midpoints (no spokes there: a hexagon runs from corner to corner through one)
    m.leaving = {};                                // for a half-edge whose tail became a midpoint: the half now leaving its old tail
    m0.faces.forEach(function (F, fi) { F.walks.forEach(function (w) { if (w.halves) w.halves.forEach(function (h) { m.side[h] = fi; }); }); });
    /* every edge of the triangulation records its KIND (real: a game curve's half; bridge; spoke: u – d or d – f;
       chord: m – d, m – d', d – d', f – m; rung: across a band) and the input FACES it lies in — the weights of the
       Tutte placement (weightsFor) are read off these */
    for (var e = 0, nE = m.edges.length; e < nE; e++) { m.edges[e].kind = 'real'; m.edges[e].faces = [m.side[2 * e], m.side[2 * e + 1]]; }
    for (e = 0; e < nE; e++) mid[e] = subdivide(m, e);
    /* 2. bridges: the walks of a face joined in a chain; then every vertex of
       fewer than two edges bridged to the corner after the next half of its
       face walk (a vertex of another walk of the same face — its own edge's
       other end when that is all there is: the two-spot start) */
    m0.faces.forEach(function (F, fi) {
      for (var k = 1; k < F.walks.length; k++) bridge(m, cornerOf(m, F.walks[k - 1]), cornerOf(m, F.walks[k]), fi);
    });
    if (m.nV === 1) return null;                   // one lone spot: nothing to lay out
    for (var again = true; again;) {
      again = false;
      for (var v = 0; v < m.nV; v++) {
        if (m.rot[v].length >= 2) continue;
        if (!m.rot[v].length) throw new Error('layout: spot ' + (v + 1) + ' is alone in its region with nothing to join');
        var h = m.rot[v][0], g = next(m, h);
        while (m.mids[m.half[g].tail]) g = next(m, g);   // to a corner of a real vertex (a midpoint stays a midpoint)
        bridge(m, [v, h], [m.half[g].tail, g], m.side[h]);
        again = true;
      }
    }
    return { m: m, mid: mid };
  }
  function tag(m, e, kind, face) { m.edges[e].kind = kind; m.edges[e].faces = [face, face]; return e; }
  /* 3 (one face): a face vertex f, a spoke f – d – u to every corner occurrence of the walk w, the hexagons cut by
     chords. Returns { fv, spokes: [f → d halves] }. */
  function star(m, w, fi) {
    var fv = addVertex(m), spokes = [];
    w.forEach(function (h) {
      var u = m.half[h].tail, d;
      if (m.mids[u]) return;
      d = addVertex(m);
      tag(m, addEdge(m, u, h, d, null, -1), 'ud', fi);                                    // u – d in the corner after h
      var s = tag(m, addEdge(m, d, 2 * (m.edges.length - 1) + 1, fv, null, -1), 'df', fi); // d – f after d → u
      spokes.push(2 * s + 1);                                           // f → d
    });
    spokes.forEach(function (s, t) {
      var hex = walkFrom(m, s);
      if (hex.length !== 6) throw new Error('layout: a face round a spoke has ' + hex.length + ' sides');
      var c1 = tag(m, addEdge(m, m.half[hex[3]].tail, hex[3], m.half[hex[1]].tail, hex[1], -1), 'md', fi);   // m – d
      var c2 = tag(m, addEdge(m, m.half[hex[3]].tail, hex[3], m.half[hex[5]].tail, hex[5], -1), 'md', fi);   // m – d'
      /* the quad f, d, m, d': cut by d – d', except in a face of two corners (a
         lens), whose second hexagon would double the first's — there by f – m */
      if (t === 1 && spokes.length === 2) tag(m, addEdge(m, m.half[hex[3]].tail, 2 * c2, fv, s, -1), 'fm', fi);
      else tag(m, addEdge(m, m.half[hex[1]].tail, 2 * c1 + 1, m.half[hex[5]].tail, hex[5], -1), 'dd', fi);
    });
    return { fv: fv, spokes: spokes };
  }

  /* The simple triangulation of the map with face `outer` on the outside, every face a star (for FPP):
     { t: the map, mid: real edge → its midpoint vertex, outerTri: [d0, d1, f] } */
  function triangulate(m0, outer) {
    var pr = prepare(m0, outer);
    if (!pr) return null;
    var m = pr.m, walks = allWalks(m), outerTri = null;
    walks.forEach(function (w) {
      var fi = m.side[w[0]], st = star(m, w, fi);
      if (!outerTri && fi === outer) outerTri = [m.half[st.spokes[0]].head, m.half[st.spokes[1]].head, st.fv];
    });
    if (!outerTri) throw new Error('layout: the outer region was not found among the faces');
    return { t: m, mid: pr.mid, outerTri: outerTri };
  }

  /* ---------------- the band triangulation (for the Tutte placement) ---------------- */

  /* The nesting of the faces with `outer` outside, by DEPTH in the dual graph (faces adjacent across a real edge;
     the outside at depth 0): an edge of a face leads INWARD when the face across it is deeper. A region that is a
     ring (its walk goes round an outer cycle, down a path, round an inner cycle and back) has the faces inside the
     inner cycle deeper — nothing a tree of components would see (10/22: the 60-seed rings are faces of ONE
     component); a ring cut into two crescents by two paths has them too, from both. Per face: own (corner
     occurrences), inside (the faces reached by inward steps, repeatedly), N = own + their own, depth. */
  function nesting(m0, outer, extraOwn) {
    var nF = m0.faces.length, adj = [], i;
    for (i = 0; i < nF; i++) adj.push([]);
    var side = [];
    m0.faces.forEach(function (F, fi) { F.walks.forEach(function (w) { if (w.halves) w.halves.forEach(function (h) { side[h] = fi; }); }); });
    m0.edges.forEach(function (e, ei) { var a = side[2 * ei], b = side[2 * ei + 1]; if (a !== b) { adj[a].push(b); adj[b].push(a); } });
    var depth = new Int32Array(nF).fill(-1), q = [outer]; depth[outer] = 0;
    for (i = 0; i < q.length; i++) adj[q[i]].forEach(function (g) { if (depth[g] < 0) { depth[g] = depth[q[i]] + 1; q.push(g); } });
    for (i = 0; i < nF; i++) if (depth[i] < 0) throw new Error('layout: face ' + i + ' is not reached from the outside');
    var info = [];
    for (i = 0; i < nF; i++) {
      var corners = 0; m0.faces[i].walks.forEach(function (w) { corners += w.halves ? w.halves.length : 1; });
      var own = corners + (extraOwn && extraOwn[i] ? extraOwn[i] : 0);   // own: the corners and what is placed inside later
      info.push({ own: own, corners: corners, inside: [], N: own, depth: depth[i], dom: {} });
    }
    for (i = 0; i < nF; i++) {
      var seen = {}, st = [i];
      while (st.length) { var f = st.pop(); adj[f].forEach(function (g) { if (!seen[g] && depth[g] > depth[f]) { seen[g] = 1; st.push(g); } }); }
      for (var g in seen) { g = +g; info[i].inside.push(g); info[i].dom[g] = true; info[i].N += info[g].own; }
    }
    return info;
  }

  /* A ladder of rungs across the face walk w between its stretch A (positions aFrom..aTo in walk order) and the
     rest B: the polygon is split by the most balanced valid chord from A to B (a chord is valid when its ends
     differ and no edge joins them yet — a neighbouring face may have taken the same chord), each half again,
     until every piece is a triangle; when no A – B chord is valid, any valid chord. Each chord is put in the
     right corners (at each end after the half leaving it in the piece being split; the two pieces then leave
     the ends by the chord's halves), so the map stays a map. Returns false (nothing added) when a piece has no
     valid chord at all. */
  function ladder(m, w, fi, aFrom, aTo) {
    var n = w.length, P = [], k;
    for (k = aFrom; ; k = (k + 1) % n) { P.push({ v: m.half[w[k]].tail, leave: w[k], side: 0 }); if (k === aTo) break; }
    for (k = (aTo + 1) % n; k !== aFrom; k = (k + 1) % n) P.push({ v: m.half[w[k]].tail, leave: w[k], side: 1 });
    var has = {}; m.edges.forEach(function (e) { has[Math.min(e.a, e.b) + '-' + Math.max(e.a, e.b)] = 1; });
    var added = [];
    function key(u, v) { return Math.min(u, v) + '-' + Math.max(u, v); }
    function chord(P, i, j) {                       // the chord between entries i and j of P: splits P into two pieces
      var u = P[i], v = P[j], e = addEdge(m, u.v, u.leave, v.v, v.leave, -1);
      tag(m, e, 'rung', fi); has[key(u.v, v.v)] = 1; added.push(e);
      var P1 = [], P2 = [], t;
      for (t = i; t !== j; t = (t + 1) % P.length) P1.push(P[t]);
      P1.push({ v: v.v, leave: 2 * e + 1, side: v.side });
      for (t = j; t !== i; t = (t + 1) % P.length) P2.push(P[t]);
      P2.push({ v: u.v, leave: 2 * e, side: u.side });
      return [P1, P2];
    }
    function split(P) {
      if (P.length <= 3) return true;
      var L = P.length, i, j, best = null, score = Infinity;
      /* candidates: pairs not adjacent in P; A – B pairs first, the most balanced first */
      var nA = 0, nB = 0; P.forEach(function (x) { if (x.side) nB++; else nA++; });
      var ia = 0, ib = 0, fa = [], fb = [];
      P.forEach(function (x, t) { if (x.side) fb[t] = nB > 1 ? ib++ / (nB - 1) : 0.5; else fa[t] = nA > 1 ? ia++ / (nA - 1) : 0.5; });
      for (i = 0; i < L; i++) for (j = i + 2; j < L; j++) {
        if (i === 0 && j === L - 1) continue;
        var u = P[i], v = P[j];
        if (u.v === v.v || has[key(u.v, v.v)]) continue;
        var sc = u.side !== v.side ? Math.abs((u.side ? fb[i] : fa[i]) - (1 - (v.side ? fb[j] : fa[j]))) : 10 + Math.abs(j - i - L / 2);
        if (sc < score) { score = sc; best = [i, j]; }
      }
      if (!best) return false;
      var two = chord(P, best[0], best[1]);
      return split(two[0]) && split(two[1]);
    }
    if (split(P)) return true;
    added.reverse().forEach(function (e) {           // undo: the chords are the last edges added
      var h = 2 * e, ed = m.edges[e];
      m.rot[ed.a].splice(m.rot[ed.a].indexOf(h), 1); m.rot[ed.b].splice(m.rot[ed.b].indexOf(h + 1), 1);
      m.edges.pop(); m.half.pop(); m.half.pop();
    });
    if (band.debug) band.debug('ladder fails in face ' + fi + ' (' + n + ' halves)');
    return false;
  }

  /* The band triangulation with face `outer` outside: every region with faces inside it (nesting) is cut by a
     ladder between the stretch of its walk that holds no edge towards its content (A, the outer side) and the rest
     (B: the paths, the inner cycles, the bridges and the components inside); a region without content is a star.
     The outer region is a band between a RING of new vertices, one per vertex of its walk (to be pinned on a
     convex curve), and the walk. { t, mid, ring: [vertices], info: nesting, stars: faces drawn as stars }. */
  function band(m0, outer, extraOwn, outerStar) {
    var pr = prepare(m0, outer);
    if (!pr) return null;
    var m = pr.m, info = nesting(m0, outer, extraOwn), walks = allWalks(m), ring = null, stars = 0, ladders = 0, outerTri = null;
    /* the outer region's walk: the longest with that side (a leaf spot's second bridge cuts a pocket off a face) */
    var ow = null;
    walks.forEach(function (w) { if (m.side[w[0]] === outer && (!ow || w.length > ow.length)) ow = w; });
    walks.forEach(function (w) {
      var fi = m.side[w[0]], n = w.length, k;
      if (w === ow && outerStar) {                 // for FPP: the outer region a star, its first two corners and face vertex the outer triangle
        var st = star(m, w, fi); stars++;
        outerTri = [m.half[st.spokes[0]].head, m.half[st.spokes[1]].head, st.fv];
        return;
      }
      if (w === ow) {
        /* the ring: R_k – R_{k+1}, R_k – v_k and R_{k+1} – v_k (v_k the tail of w[k]); rotations as derived 10/22:
           at v_k: w[k], (v_k → R_{k+1}), (v_k → R_k), twin(w[k−1]); at R_k: R_{k−1}, v_{k−1}, v_k, R_{k+1} */
        ring = []; for (k = 0; k < n; k++) ring.push(addVertex(m));
        var rr = [], rv = [], rvn = [];
        for (k = 0; k < n; k++) rr.push(tag(m, addEdge(m, ring[k], null, ring[(k + 1) % n], null, -1), 'ring', fi));
        for (k = 0; k < n; k++) {
          rv.push(tag(m, addEdge(m, m.half[w[k]].tail, w[k], ring[k], null, -1), 'orung', fi));
          rvn.push(tag(m, addEdge(m, m.half[w[k]].tail, w[k], ring[(k + 1) % n], null, -1), 'orung', fi));
        }
        for (k = 0; k < n; k++) {
          var kp = (k - 1 + n) % n;
          m.rot[ring[k]] = [2 * rr[kp] + 1, 2 * rvn[kp] + 1, 2 * rv[k] + 1, 2 * rr[k]];
        }
        return;
      }
      /* the positions of w whose other side is inside this face, and those walked on both sides (a path or a
         chain of moves hanging into the face, a bridge): a stretch that hangs by one spot has no extent in a
         Tutte drawing unless rungs pull it across the face */
      var hole = [], doubled = [];
      for (k = 0; k < n; k++) {
        var h = w[k], e = m.edges[m.half[h].edge];
        if (e.kind === 'real' && m.side[h ^ 1] !== fi && info[fi].dom[m.side[h ^ 1]]) hole.push(k);
        else if (m.side[h ^ 1] === fi) doubled.push(k);
      }
      /* an inner cycle is paired with the WHOLE outer cycle (a dangle on the outer cycle gets its rungs from where
         it is); only a face with no content pairs its dangles against the rest */
      if (!hole.length) hole = doubled;
      if (hole.length) {
        /* A = the longest stretch between two hole positions (cyclically) */
        var best = -1, gap = -1;
        for (k = 0; k < hole.length; k++) { var g = (hole[(k + 1) % hole.length] - hole[k] + n) % n; if (g > gap) { gap = g; best = k; } }
        var aFrom = (hole[best] + 1) % n, aTo = (hole[(best + 1) % hole.length] - 1 + n) % n;
        if (gap >= 2 && ladder(m, w, fi, aFrom, aTo)) { ladders++; info[fi].kind = 'ladder'; info[fi].A = gap - 1; info[fi].B = n - gap + 1; info[fi].holes = hole.length; info[fi].doubled = doubled.length; return; }
      }
      star(m, w, fi); stars++; info[fi].kind = (info[fi].kind || '') + 'star';
    });
    if (!ring && !outerTri) throw new Error('layout: the outer region was not found among the faces');
    return { t: m, mid: pr.mid, ring: ring, outerTri: outerTri, info: info, stars: stars, ladders: ladders };
  }
  /* ---------------- FPP ---------------- */

  /* The canonical ordering of a simple triangulation with outer face
     (v1, v2, vn): peeling from the top — a vertex of the outer cycle other
     than v1, v2 with no chord (Kant). Returns the order (v1, v2, …, vn). */
  function canonicalOrder(m, tri) {
    var n = m.nV, v1 = tri[0], v2 = tri[1], vn = tri[2];
    var nbr = [], i;
    for (i = 0; i < n; i++) nbr.push([]);
    m.edges.forEach(function (e) { nbr[e.a].push(e.b); nbr[e.b].push(e.a); });
    var removed = new Uint8Array(n), order = new Array(n), C = [v1, vn, v2];
    for (var k = n - 1; k >= 2; k--) {
      var onC = new Int32Array(n).fill(-1);
      C.forEach(function (v, p) { onC[v] = p; });
      var pick = -1;
      for (var p = 1; p + 1 < C.length; p++) {
        var v = C[p], chord = false;
        for (var q = 0; q < nbr[v].length; q++) {
          var u = nbr[v][q];
          if (!removed[u] && onC[u] >= 0 && onC[u] !== p - 1 && onC[u] !== p + 1) { chord = true; break; }
        }
        if (!chord) { pick = p; break; }
      }
      if (pick < 0) throw new Error('layout: no vertex without a chord (not a triangulation?)');
      var vk = C[pick];
      order[k] = vk; removed[vk] = 1;
      /* its unremoved neighbours in rotation order, from C[pick-1] round to C[pick+1] */
      var ring = m.rot[vk].map(function (h) { return m.half[h].head; }).filter(function (u) { return !removed[u]; });
      var a = ring.indexOf(C[pick - 1]), b = ring.indexOf(C[pick + 1]), path = [], L = ring.length;
      if (a < 0 || b < 0) throw new Error('layout: the outer neighbours are not neighbours');
      for (var t = a; ; t = (t + 1) % L) { path.push(ring[t]); if (t === b) break; }
      if (path.length !== L) {                      // the other way round
        path = []; for (t = a; ; t = (t - 1 + L) % L) { path.push(ring[t]); if (t === b) break; }
        if (path.length !== L) throw new Error('layout: the neighbours do not form a path');
      }
      C = C.slice(0, pick - 1).concat(path, C.slice(pick + 2));
    }
    order[0] = v1; order[1] = v2;
    return order;
  }

  /* The shift method: integer coordinates on a (2n − 4) × (n − 2) grid. */
  function shiftPlace(m, order) {
    var n = m.nV, X = new Array(n), Y = new Array(n), L = new Array(n), i;
    var adj = [];
    for (i = 0; i < n; i++) { adj.push({}); L[i] = [i]; }
    m.edges.forEach(function (e) { adj[e.a][e.b] = 1; adj[e.b][e.a] = 1; });
    var v1 = order[0], v2 = order[1], v3 = order[2];
    X[v1] = 0; Y[v1] = 0; X[v2] = 2; Y[v2] = 0; X[v3] = 1; Y[v3] = 1;
    var C = [v1, v3, v2];
    for (var k = 3; k < n; k++) {
      var v = order[k], p = -1, q = -1;
      for (i = 0; i < C.length; i++) if (adj[v][C[i]]) { if (p < 0) p = i; q = i; }
      for (i = p; i <= q; i++) if (!adj[v][C[i]]) throw new Error('layout: the contour neighbours are not contiguous');
      for (i = p + 1; i < q; i++) L[C[i]].forEach(function (u) { X[u] += 1; });
      for (i = q; i < C.length; i++) L[C[i]].forEach(function (u) { X[u] += 2; });
      var wp = C[p], wq = C[q];
      X[v] = (X[wp] - Y[wp] + X[wq] + Y[wq]) / 2;
      Y[v] = (-X[wp] + Y[wp] + X[wq] + Y[wq]) / 2;
      var Lv = [v];
      for (i = p + 1; i < q; i++) Lv = Lv.concat(L[C[i]]);
      L[v] = Lv;
      C = C.slice(0, p + 1).concat([v], C.slice(q));
    }
    return { X: X, Y: Y };
  }

  /* ---------------- the whole thing ---------------- */

  /* A straight-line drawing of the map with face `outer` outside, fitted into
     W × H with a margin: { spots: [[x, y]], curves: [ [u, m, v] per real edge ] }
     — or null for a lone spot. */
  function draw(m, outer, W, H, margin, mode) {
    if (mode === undefined) mode = api.mode;         // (tests compare the two starts; the page uses the stars)
    var tr = mode === 'band' ? band(m, outer, null, true) : triangulate(m, outer);
    if (!tr) return null;
    var order = canonicalOrder(tr.t, tr.outerTri), P = shiftPlace(tr.t, order);
    var spots = [], curves = [], xs = [], ys = [];
    for (var v = 0; v < m.nV; v++) { spots.push([P.X[v], P.Y[v]]); xs.push(P.X[v]); ys.push(P.Y[v]); }
    m.edges.forEach(function (e, ei) {
      var w = tr.mid[ei];
      curves.push([spots[e.a], [P.X[w], P.Y[w]], spots[e.b]]);
      xs.push(P.X[w]); ys.push(P.Y[w]);
    });
    var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs), y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys);
    var s = Math.min((W - 2 * margin) / Math.max(1, x1 - x0), (H - 2 * margin) / Math.max(1, y1 - y0));
    var ox = (W - s * (x1 - x0)) / 2, oy = (H - s * (y1 - y0)) / 2;
    /* mirrored in x: the shift method walks the outer face the other way round
       than the engine's rotation (checked: the drawn map's key equals the input's) */
    function map(p) { return [ox + s * (x1 - p[0]), oy + s * (p[1] - y0)]; }
    return { spots: spots.map(map), curves: curves.map(function (c) { return c.map(map); }), grid: [x1 - x0, y1 - y0] };
  }

  /* The game drawn afresh: the position of `game`, or the position after the move mv (ai.js,
     as the computer names it; its curves get `player`), with the region of engine key `outerKey`
     outside (-1: the present outside); every curve a straight two-leg polyline, for R's descent
     (redraw.js, o.tight) to make into curves. The game object is a copy: spots, edges (pieces,
     player), moves, phase, player and the rest as before (+ 1 move). null for a lone spot. */
  /* outerFace (optional): the index of the outer face among the faces of the map after the move (see
     faceCount) — the keys are not enough: a move's two new regions share one (v118). */
  function freshGame(game, mv, player, outerKey, D, outerFace) {
    D = D || 40;
    var m = mapOf(game), spots = game.spots.map(function (s) { return { x: s.x, y: s.y, deg: s.deg }; });
    var edges = game.edges.map(function (e) { return { a: e.a, b: e.b, player: e.player }; });
    if (mv) {
      m = withMove(m, mv);
      spots.push({ x: 0, y: 0, deg: 2 }); spots[mv.x].deg++; spots[mv.y].deg++;
      var z = spots.length - 1;
      edges.push({ a: mv.x, b: z, player: player }, { a: z, b: mv.y, player: player });
    }
    var outer = 0;
    m.faces.forEach(function (f, i) { if (f.key === (outerKey === undefined ? -1 : outerKey)) outer = i; });
    if (outerFace !== undefined && outerFace >= 0 && outerFace < m.faces.length) outer = outerFace;
    var dr = draw(m, outer, game.W0, game.H0, MARGIN);
    if (!dr) return null;
    var g = JSON.parse(JSON.stringify(game));
    g.spots = spots.map(function (s, i) { return { x: dr.spots[i][0], y: dr.spots[i][1], deg: s.deg }; });
    /* each curve: its two legs, each cut into parts no longer than D — the descent (redraw.js,
       o.keepKnots) takes these points as they are, the corner at the midpoint among them */
    g.edges = edges.map(function (e, i) {
      var c = dr.curves[i], pts = [c[0]];
      for (var k = 1; k < c.length; k++) {
        var parts = Math.max(1, Math.ceil(G.dist(c[k - 1], c[k]) / D));
        for (var f = 1; f <= parts; f++) pts.push([c[k - 1][0] + f / parts * (c[k][0] - c[k - 1][0]), c[k - 1][1] + f / parts * (c[k][1] - c[k - 1][1])]);
      }
      e.pieces = E.polylinePieces(pts); return e;
    });
    if (mv) { g.moves = (g.moves || 0) + 1; g.player = 3 - player; }
    return g;
  }
  /* How many faces (regions) the position after the move has, and which of them freshGame would put
     outside by default (the present outside — for a move that splits it, the part it picks). */
  function faces(game, mv) {
    var m = mapOf(game), outer = 0;
    if (mv) m = withMove(m, mv);
    m.faces.forEach(function (f, i) { if (f.key === -1) outer = i; });
    return { count: m.faces.length, outer: outer };
  }
  var MARGIN = 40;                                 // the layout keeps this far from the window's sides (R fills the window)

  var api = { mapOf: mapOf, withMove: withMove, triangulate: triangulate, band: band, nesting: nesting, prepare: prepare, canonicalOrder: canonicalOrder, shiftPlace: shiftPlace, draw: draw, allWalks: allWalks, freshGame: freshGame, faces: faces };
  root.SproutsLayout = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : this);
