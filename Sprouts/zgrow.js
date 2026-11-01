/* =========================================================================
   zgrow.js — a drawing of a position GROWN from a spot (Peter, 10/23 and
   10/29: "local and growing outward"; the candidate replacement for Z's
   FPP start, whose lattice near-touches are what the polish cannot undo).
   DOM-free (global SproutsGrow, or require()). Needs geom, engine, room,
   redraw, layout.

   THE IDEA. The position is only its combinatorial map (layout.js mapOf,
   plus withMove for the computer's pending move). Nothing is laid out: the
   picture is grown. A spot is placed when a curve first reaches it, at
   about D from the spot it is reached from, in the angular sector the map's
   rotation leaves for that curve; the curve is a straight leg (two legs
   through a midpoint when both ends are already down). Between growth
   stages the compact R (redraw.js) rearranges the partial drawing, its
   room-by-lives term weighted by WHAT EACH REGION STILL HAS TO RECEIVE —
   the spots not yet placed that will go into it — instead of by lives, so
   that a region makes room for its content before the content arrives.

   CONTAINMENT ORDER. Components are grown outermost first (depth in the
   dual graph from the chosen outer region), and a component that sits
   inside a region is started inside that region once the region's
   enclosing cycle is drawn — so nothing is ever enclosed that is not yet
   placed, and no curve ever has to wrap scattered spots.

   THE INVARIANT, checked and never assumed: the partial drawing realises
   the partial map. (1) At every placed spot the drawn curves leave in the
   cyclic order the map's rotation prescribes (a new curve is put in its
   sector, and the sector is read off the present drawing, so this holds by
   construction and is re-checked). (2) The regions of the drawing (engine
   analyse) are exactly the classes of the map's faces merged across the
   undrawn edges, with the drawing's outside the class of the chosen outer
   region. (1) + (2) are what a straight leg can get wrong when it closes a
   cycle: the wrong side of the plane ends up bounded, or a thing already
   drawn ends up on the wrong side. Then other midpoints are tried; a
   component whose first cycle came out the wrong way round is mirrored
   (handedness is free until a cycle closes or a spot has three curves).

   What it does NOT do (yet): route a curve round things (the router), so a
   closing curve that cannot be two straight legs is DEFERRED — R between
   stages opens the picture, and it is tried again; if it never fits, the
   build fails and names it.

   Stepwise, so a worker can yield and show its picture:
     createGrow(target, opt) -> st     stepGrow(st, ms) -> done?
     finishGrow(st) -> { game, ok, stuck, failures, relaxes, ... }
     grow(target, opt)                 all at once
   target: targetOf(game, mv, player) — { m, spots: [{deg}], edges: [{a, b,
   player}], W0, H0, ... }; opt: { o: redraw's options, start: a spot,
   seed }.
   ========================================================================= */
(function (root) {
  'use strict';
  var G = root.SproutsGeom || require('./geom.js');
  var E = root.SproutsEngine || require('./engine.js');
  var Rm = root.SproutsRoom || require('./room.js');
  var Rd = root.SproutsRedraw || require('./redraw.js');
  var Ly = root.SproutsLayout || require('./layout.js');
  var R = root.SproutsRelax || require('./relax.js');
  var Rt = root.SproutsRoute || require('./route.js');

  var TWO = 2 * Math.PI;
  function norm(a) { a %= TWO; return a < 0 ? a + TWO : a; }
  function mulberry(a) {
    return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }

  /* The position to grow: the map of `game` (after the move mv, made by `player`, if given), its
     spots' degrees and its edges — what layout.js freshGame reads before it draws. */
  function targetOf(game, mv, player) {
    var m = Ly.mapOf(game), spots = game.spots.map(function (s) { return { deg: s.deg }; });
    var edges = game.edges.map(function (e) { return { a: e.a, b: e.b, player: e.player }; });
    if (mv) {
      m = Ly.withMove(m, mv);
      spots.push({ deg: 2 }); spots[mv.x].deg++; spots[mv.y].deg++;
      var z = spots.length - 1;
      edges.push({ a: mv.x, b: z, player: player }, { a: z, b: mv.y, player: player });
    }
    var t = { m: m, spots: spots, edges: edges, W0: game.W0, H0: game.H0, moves: (game.moves || 0) + (mv ? 1 : 0),
              player: mv ? 3 - player : game.player, phase: game.phase, rules: game.rules, added: game.added };
    return t;
  }

  /* ---------------- the map's structure ---------------- */

  function structure(t, outerFace) {
    var m = t.m, n = t.spots.length, nE = t.edges.length, i, h;
    var faceOfHalf = new Int32Array(2 * nE).fill(-1), faceOfSpot = new Int32Array(n).fill(-1);
    m.faces.forEach(function (f, fi) {
      f.walks.forEach(function (w) {
        if (w.halves) w.halves.forEach(function (hh) { faceOfHalf[hh] = fi; });
        else faceOfSpot[w.spot] = fi;
      });
    });
    var outer = outerFace;
    if (outer === undefined || outer < 0 || outer >= m.faces.length) { outer = -1; m.faces.forEach(function (f, fi) { if (f.key === -1 && outer < 0) outer = fi; }); }
    if (outer < 0) throw new Error('zgrow: the map has no outside');
    /* depth of every face from the outer one across the real edges; encl[f] = the walk of f that holds the
       edge across which f was first reached (its enclosing boundary — any shallower neighbour is across it) */
    var depth = new Int32Array(m.faces.length).fill(-1), encl = new Int32Array(m.faces.length).fill(-1), queue = [outer];
    depth[outer] = 0;
    for (var q = 0; q < queue.length; q++) {
      var f = queue[q];
      m.faces[f].walks.forEach(function (w, wi) {
        if (!w.halves) return;
        w.halves.forEach(function (hh) {
          var g = faceOfHalf[hh ^ 1];
          if (g < 0 || depth[g] >= 0) return;
          depth[g] = depth[f] + 1; queue.push(g);
          var wg = m.faces[g].walks;
          for (var k = 0; k < wg.length; k++) if (wg[k].halves && wg[k].halves.indexOf(hh ^ 1) >= 0) { encl[g] = k; break; }
        });
      });
    }
    /* components of the position (spots joined by edges; a lone spot its own) */
    var comp = new Int32Array(n).fill(-1), comps = [], nbrs = [];
    for (i = 0; i < n; i++) nbrs.push([]);
    t.edges.forEach(function (e, ei) { nbrs[e.a].push({ to: e.b, edge: ei }); nbrs[e.b].push({ to: e.a, edge: ei }); });
    for (i = 0; i < n; i++) {
      if (comp[i] >= 0) continue;
      var id = comps.length, stack = [i], mem = [];
      comp[i] = id;
      while (stack.length) { var u = stack.pop(); mem.push(u); nbrs[u].forEach(function (nb) { if (comp[nb.to] < 0) { comp[nb.to] = id; stack.push(nb.to); } }); }
      comps.push({ id: id, members: mem, face: -1 });
    }
    /* the face each component sits in: the one that has the component's outer walk as a content walk */
    m.faces.forEach(function (f, fi) {
      f.walks.forEach(function (w, wi) {
        if (wi === encl[fi]) return;
        var v = w.halves ? m.half[w.halves[0]].tail : w.spot;
        comps[comp[v]].face = fi;
      });
    });
    comps.forEach(function (c) { if (c.face < 0) throw new Error('zgrow: component of spot ' + (c.members[0] + 1) + ' sits in no face'); });
    /* the rotation at every spot as EDGE ids, in the engine's order (increasing angle) */
    var rotE = [];
    for (i = 0; i < n; i++) rotE.push(m.rot[i].map(function (hh) { return m.half[hh].edge; }));
    return { faceOfHalf: faceOfHalf, faceOfSpot: faceOfSpot, outer: outer, depth: depth, encl: encl, comp: comp, comps: comps, nbrs: nbrs, rotE: rotE };
  }

  /* ---------------- the state ---------------- */

  function createGrow(t, opt) {
    opt = opt || {};
    var o = opt.o || { d0: 6, D: 40, lambda: 1, spotR: 6, rho: 40 * Math.SQRT2 };
    var S = structure(t, opt.outerFace), n = t.spots.length;
    var st = {
      /* the spots are grown as the smallest the Spot size slider allows (Peter, 10/22: the layout independent of
         the spot size; a 30-spot game grew whole at radius 6 and stuck at the game's 10) — the polish at the
         end grows them to their size (redraw.js o.tight), smaller where there is no room if • allows */
      t: t, S: S, o: o, W: t.W0, H: t.H0, spotR: Math.min(o.spotR || 6, o.minSpotR || 3), D: o.D, d0: o.d0, step: 2 * o.D,   // step: the growth's spacing — roomy; the polish compacts
      g: { W0: t.W0, H0: t.H0, spots: [], edges: [], moves: t.moves, player: t.player, phase: t.phase, rules: t.rules, added: t.added },
      at: new Int32Array(n).fill(-1), edgeAt: new Int32Array(t.edges.length).fill(-1), gEdge: [], have: {},   // have[te] = its g edge; gEdge[k] = the target edge of g.edges[k]
      placed: 0, drawn: 0, routed: 0, failures: [], stuck: null, relaxes: 0, relaxFailed: 0, relaxWhy: {}, relaxSteps: 0,
      ci: -1, order: null, layer: [], tasks: [], later: [], relax: null, done: false, retried: {},
      rng: mulberry(opt.seed || 1), segs: null, log: opt.log || null, stageR: opt.stageR !== false
    };
    var start = opt.start === undefined ? -1 : opt.start;
    st.order = S.comps.slice().sort(function (a, b) {
      var da = S.depth[a.face], db = S.depth[b.face];
      if (da !== db) return da - db;
      var sa = start >= 0 && S.comp[start] === a.id, sb = start >= 0 && S.comp[start] === b.id;
      if (sa !== sb) return sa ? -1 : 1;
      return b.members.length - a.members.length || a.id - b.id;
    });
    st.start = start;
    return st;
  }

  /* ---------------- geometry of the partial drawing ---------------- */

  function pos(st, v) { var s = st.g.spots[st.at[v]]; return [s.x, s.y]; }
  function dirty(st) { st.segs = null; st.an = null; }
  function segsOf(st) {
    if (st.segs) return st.segs;
    var out = [];
    st.g.edges.forEach(function (e, k) {
      var pts = G.refinedPolygon(e.pieces, 0.5, 16).pts;
      for (var i = 1; i < pts.length; i++) out.push({ a: pts[i - 1], b: pts[i], e: k });
    });
    return st.segs = out;
  }
  function analysed(st) { return st.an || (st.an = E.analyse(st.g.spots, st.g.edges)); }
  /* the angle at which g's edge k leaves g's spot s (as the engine measures it: the first step of the refined polygon) */
  function angleAt(st, k, s) {
    var e = st.g.edges[k], pts = G.refinedPolygon(e.pieces, 0.5, 16).pts;
    if (e.a === s) return Math.atan2(pts[1][1] - pts[0][1], pts[1][0] - pts[0][0]);
    var L = pts.length;
    return Math.atan2(pts[L - 2][1] - pts[L - 1][1], pts[L - 2][0] - pts[L - 1][0]);
  }
  /* The sector in which target edge te must leave spot v: from the nearest drawn edge before it in the
     rotation to the nearest drawn after it (the whole circle when none or one is drawn), and te's place
     j among the k undrawn edges in that sector, in rotation order — its ideal direction is at (j + 1)/(k + 1). */
  function sector(st, v, te) {
    var rot = st.S.rotE[v], i = rot.indexOf(te), L = rot.length, k, prev = -1, next = -1, between = [];
    if (i < 0) throw new Error('zgrow: edge ' + te + ' is not at spot ' + (v + 1));
    for (k = 1; k < L; k++) { var p = rot[(i - k + L) % L]; if (st.edgeAt[p] >= 0) { prev = p; break; } }
    if (prev < 0) return { lo: 0, wid: TWO, j: i, k: L, free: true };
    for (k = 1; k < L; k++) { var q = rot[(i + k) % L]; if (st.edgeAt[q] >= 0) { next = q; break; } }
    for (k = 1; k < L; k++) { var r = rot[(i - k + L) % L]; if (st.edgeAt[r] >= 0) break; between.unshift(r); }
    var j = between.length; between.push(te);
    for (k = 1; k < L; k++) { var r2 = rot[(i + k) % L]; if (st.edgeAt[r2] >= 0) break; between.push(r2); }
    var gv = st.at[v];
    var a0 = angleAt(st, st.edgeAt[prev], gv);
    if (prev === next) return { lo: a0, wid: TWO, j: j, k: between.length };
    var a1 = angleAt(st, st.edgeAt[next], gv), w = norm(a1 - a0);
    return { lo: a0, wid: w > 1e-9 ? w : TWO, j: j, k: between.length };
  }
  /* te's own SLICE of its sector: the sector shared out among the undrawn edges in it, in rotation order — so
     that every curve drawn now leaves room, in the right place, for the ones still to come, and the cyclic
     order at the spot is right by construction once it has one drawn curve */
  function slice(sec) { return { lo: sec.lo + sec.wid * sec.j / sec.k, wid: sec.wid / sec.k }; }
  function ideal(sec) { var s = slice(sec); return s.lo + s.wid / 2; }
  function inSlice(sec, a) { var s = slice(sec), d = norm(a - s.lo); return d > 1e-9 && d < s.wid - 1e-9; }

  function segDist(p0, p1, a, b) {
    if (G.segCross(p0, p1, a, b)) return 0;
    return Math.min(G.distPointSeg(p0, a, b), G.distPointSeg(p1, a, b), G.distPointSeg(a, p0, p1), G.distPointSeg(b, p0, p1));
  }
  /* The least clearance of the leg p0 → p1 from everything drawn, except: the curves at the g-spots `from`
     and `to` (-1: none) do not count within ρ = spot radius + d0 of that spot, where they all meet (the
     slice says they diverge), and those spots do not count at all. Other spots count from their discs. */
  function legClear(st, p0, p1, from, to) {
    var rho = st.spotR + st.d0, segs = segsOf(st), g = st.g, best = Infinity;
    var pf = from >= 0 ? [g.spots[from].x, g.spots[from].y] : null, pt = to >= 0 ? [g.spots[to].x, g.spots[to].y] : null;
    for (var i = 0; i < segs.length; i++) {
      var s = segs[i], e = g.edges[s.e];
      if ((pf && (e.a === from || e.b === from) && G.distPointSeg(pf, s.a, s.b) < rho) || (pt && (e.a === to || e.b === to) && G.distPointSeg(pt, s.a, s.b) < rho)) {
        if (G.segCross(p0, p1, s.a, s.b)) return 0;   // (no distance asked there — but no crossing either)
        continue;
      }
      var d = segDist(p0, p1, s.a, s.b);
      if (d < best) best = d;
    }
    for (var k = 0; k < g.spots.length; k++) {
      if (k === from || k === to) continue;
      var sp = g.spots[k], dd = G.distPointSeg([sp.x, sp.y], p0, p1) - st.spotR;
      if (dd < best) best = dd;
    }
    /* the window's sides */
    var m = Math.min(p0[0], p1[0], p0[1], p1[1], st.W - p0[0], st.W - p1[0], st.H - p0[1], st.H - p1[1]);
    if (m < best) best = m;
    return best;
  }
  /* the least clearance of a new spot at q from everything drawn (its disc counted), not counting the legs of its own */
  function spotClear(st, q, skip) {
    var segs = segsOf(st), g = st.g, best = Infinity;
    for (var i = 0; i < segs.length; i++) { if (skip >= 0 && segs[i].e === skip) continue; var d = G.distPointSeg(q, segs[i].a, segs[i].b); if (d < best) best = d; }
    for (var k = 0; k < g.spots.length; k++) { var d2 = G.dist(q, [g.spots[k].x, g.spots[k].y]) - st.spotR; if (d2 < best) best = d2; }
    var m = Math.min(q[0], q[1], st.W - q[0], st.H - q[1]);
    if (m < best) best = m;
    return best - st.spotR;
  }

  /* ---------------- the invariant ---------------- */

  /* Union-find over the map's faces, merged across every undrawn edge (and the one `except`, if given) */
  function classes(st, except, also) {           // except: a drawn edge taken as undrawn; also: an undrawn one taken as drawn
    var S = st.S, nF = st.t.m.faces.length, par = new Int32Array(nF);
    for (var i = 0; i < nF; i++) par[i] = i;
    function find(x) { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; }
    for (var te = 0; te < st.t.edges.length; te++) {
      if ((st.edgeAt[te] >= 0 && te !== except) || te === also) continue;
      var a = find(S.faceOfHalf[2 * te]), b = find(S.faceOfHalf[2 * te + 1]);
      if (a !== b) par[a] = b;
    }
    var count = 0;
    for (i = 0; i < nF; i++) if (find(i) === i) count++;
    return { find: find, count: count };
  }
  function faceOfPlaced(st, v) {              // a face at target spot v (all its faces are one class while it has no drawn edge)
    return st.t.spots[v].deg === 0 || !st.S.rotE[v].length ? st.S.faceOfSpot[v] : st.S.faceOfHalf[st.t.m.rot[v][0]];
  }
  /* Does the drawing g realise the partial map? (1) rotations; (2) regions = classes, outside = the outer class.
     back: g spot -> target spot. Returns null when it does, else a reason. */
  function realises(st, g, except) {
    var S = st.S, t = st.t, back = [], v, k;
    for (v = 0; v < t.spots.length; v++) if (st.at[v] >= 0) back[st.at[v]] = v;
    var gEdge = st.gEdge;
    /* (1) at every spot with 3 drawn curves: the geometric order equals the map's */
    var ends = g.spots.map(function () { return []; });
    g.edges.forEach(function (e, kk) {
      var pts = G.refinedPolygon(e.pieces, 0.5, 16).pts, L = pts.length;
      ends[e.a].push({ te: gEdge[kk], ang: Math.atan2(pts[1][1] - pts[0][1], pts[1][0] - pts[0][0]) });
      ends[e.b].push({ te: gEdge[kk], ang: Math.atan2(pts[L - 2][1] - pts[L - 1][1], pts[L - 2][0] - pts[L - 1][0]) });
    });
    for (k = 0; k < g.spots.length; k++) {
      if (ends[k].length < 3) continue;
      var geo = ends[k].slice().sort(function (p, q) { return p.ang - q.ang; }).map(function (x) { return x.te; });
      var want = S.rotE[back[k]].filter(function (te) { return st.edgeAt[te] >= 0 || te === except; });
      var i0 = want.indexOf(geo[0]), ok = want.length === geo.length;
      for (var i = 0; ok && i < geo.length; i++) if (want[(i0 + i) % want.length] !== geo[i]) ok = false;
      if (!ok) return 'the curves at spot ' + (back[k] + 1) + ' are in the wrong order';
    }
    /* (2) */
    var cl = classes(st, except), an = E.analyse(g.spots, g.edges), seen = {}, outsideClass = cl.find(S.outer);
    if (an.regions.length !== cl.count) return 'the drawing has ' + an.regions.length + ' regions where the map has ' + cl.count;
    for (var r = 0; r < an.regions.length; r++) {
      var rg = an.regions[r], c = -1;
      for (var b = 0; b < rg.boundaries.length; b++) {
        var bd = rg.boundaries[b], cs = [];
        if (bd.cycle !== undefined) an.cycles[bd.cycle].halves.forEach(function (h) { cs.push(cl.find(S.faceOfHalf[2 * gEdge[h.edge] + (h.id & 1)])); });
        else cs.push(cl.find(faceOfPlaced(st, back[bd.spot])));
        for (var q = 0; q < cs.length; q++) { if (c < 0) c = cs[q]; else if (cs[q] !== c) return 'a region of the drawing mixes two regions of the map'; }
      }
      if (seen[c]) return 'two regions of the drawing are one region of the map';
      seen[c] = true;
      if ((rg.key === -1) !== (c === outsideClass)) return 'the wrong region is outside';
    }
    return null;
  }

  /* ---------------- placing and drawing ---------------- */

  /* corners cut (Chaikin, `rounds` times) between the fixed ends — the smooth curves R fits through a
     polyline's points overshoot at a sharp corner and cross a neighbour; a rounded polyline they follow */
  function rounded(pts, rounds) {
    for (var r = 0; r < rounds; r++) {
      if (pts.length < 3) return pts;
      var out = [pts[0]];
      for (var i = 1; i < pts.length; i++) {
        var a = pts[i - 1], b = pts[i];
        if (i > 1) out.push([0.75 * a[0] + 0.25 * b[0], 0.75 * a[1] + 0.25 * b[1]]);
        if (i < pts.length - 1) out.push([0.25 * a[0] + 0.75 * b[0], 0.25 * a[1] + 0.75 * b[1]]);
      }
      out.push(pts[pts.length - 1]);
      pts = out;
    }
    return pts;
  }
  /* the polyline pts for the curve from g-spot gu to gv, rounded where that still keeps clear of everything */
  function roundedClear(st, pts, gu, gv) {
    var tries = [rounded(G.resample(pts, st.D / 2), 2), G.resample(pts, st.D / 2), pts];   // (resampled: a raw grid path has a point every cell, and R cannot move points that dense)
    for (var k = 0; k < tries.length; k++) {
      var sm = tries[k], ok = true;
      for (var i = 1; i < sm.length && ok; i++) if (!(legClear(st, sm[i - 1], sm[i], gu, gv) > 0) || !selfClear(sm.slice(0, i), sm[i - 1], sm[i], 0)) ok = false;
      if (ok) return sm;
    }
    return pts;
  }
  function legPieces(st, pts) {                   // the polyline cut into parts no longer than D (redraw's keepKnots takes them as points)
    var out = [pts[0]], D = st.D / 2;
    for (var k = 1; k < pts.length; k++) {
      var parts = Math.max(1, Math.ceil(G.dist(pts[k - 1], pts[k]) / D));
      for (var f = 1; f <= parts; f++) out.push([pts[k - 1][0] + f / parts * (pts[k][0] - pts[k - 1][0]), pts[k - 1][1] + f / parts * (pts[k][1] - pts[k - 1][1])]);
    }
    return E.polylinePieces(out);
  }
  function place(st, v, p) { st.at[v] = st.g.spots.length; st.g.spots.push({ x: p[0], y: p[1], deg: 0, n: v + 1 }); st.placed++; dirty(st); }
  /* add target edge te to g as the polyline pts (oriented from a to b) */
  function addEdge(st, te, pts) {
    var e = st.t.edges[te], pa = pos(st, e.a);
    if (G.dist(pts[0], pa) > G.dist(pts[pts.length - 1], pa)) pts = pts.slice().reverse();   // the polyline runs from a to b
    st.have[te] = { a: st.at[e.a], b: st.at[e.b], player: e.player, pieces: legPieces(st, pts) };
    st.g.spots[st.at[e.a]].deg++; st.g.spots[st.at[e.b]].deg++;
    st.drawn++; rebuild(st);
  }
  function removeEdge(st, te) {
    var e = st.t.edges[te];
    delete st.have[te];
    st.g.spots[st.at[e.a]].deg--; st.g.spots[st.at[e.b]].deg--;
    st.drawn--; rebuild(st);
  }
  /* g.edges from the drawn edges: a move's two curves side by side at an even index (redraw.js pairs
     edges 2m, 2m + 1 that chain, and treats the pair as one curve through the move's spot), then the
     curves whose partner is not drawn yet, kept from chaining into false pairs where it can be */
  function rebuild(st) {
    var te, pairs = [], singles = [], n = st.t.edges.length;
    for (te = 0; te + 1 < n; te += 2) {
      if (st.have[te] && st.have[te + 1]) pairs.push(te, te + 1);
      else { if (st.have[te]) singles.push(te); if (st.have[te + 1]) singles.push(te + 1); }
    }
    if (n % 2 && st.have[n - 1]) singles.push(n - 1);
    var order = pairs.slice();
    for (var i = 0; i < singles.length; i++) {
      var x = singles[i];
      if (order.length % 2 === 0 || st.have[order[order.length - 1]].b !== st.have[x].a) { order.push(x); continue; }
      var j = i + 1;                               // would chain at an even index: take a later single that does not
      while (j < singles.length && st.have[order[order.length - 1]].b === st.have[singles[j]].a) j++;
      if (j < singles.length) { order.push(singles[j]); singles.splice(j, 1); i--; } else order.push(x);
    }
    st.gEdge = order; st.g.edges = order.map(function (k) { return st.have[k]; });
    st.edgeAt.fill(-1);
    order.forEach(function (k, idx) { st.edgeAt[k] = idx; });
    dirty(st);
  }
  /* A curve from the placed spot u along target edge te to the unplaced spot v: v is put at the first
     candidate (lengths D, 1.5 D, 2 D, 3 D, 0.75 D; at each, the ideal direction in the sector, then
     turned a little either way) whose leg keeps d0 and whose spot stands clear. */
  function growSpot(st, u, v, te) {
    var sec = sector(st, u, te), a0 = ideal(sec), sl = slice(sec), gu = st.at[u], pu = pos(st, u), D = st.step;
    var lens = [1, 0.75, 0.5, 1.5, 2, 3], turns = [0, 1 / 8, -1 / 8, 1 / 4, -1 / 4, 3 / 8, -3 / 8];
    var rho = st.spotR + st.d0;
    for (var li = 0; li < lens.length; li++) {
      for (var ti = 0; ti < turns.length; ti++) {
        var a = a0 + turns[ti] * sl.wid;
        if (!inSlice(sec, a)) continue;
        var q = [pu[0] + lens[li] * D * Math.cos(a), pu[1] + lens[li] * D * Math.sin(a)];
        if (q[0] < rho || q[1] < rho || q[0] > st.W - rho || q[1] > st.H - rho) continue;
        if (legClear(st, pu, q, gu, -1) < st.d0) continue;
        if (spotClear(st, q, -1) < st.d0) continue;
        place(st, v, q); addEdge(st, te, [pu, q]);
        return null;
      }
    }
    /* no straight leg: the router — a place for v reached from u's slice by the grid planner (the way may
       bend out of a pocket), the nearest of a ring of places round u that stands clear */
    var obs = R.buildObstacles(st.g, st.spotR), ctx = { aIdx: gu, bIdx: -1, A: pu, B: pu, rho: st.D * Math.SQRT2, spotR: st.spotR };
    var cell = Math.max(2, Math.min(8, 0.7 * st.d0)), out = rho + cell, p1 = null;
    for (var d1 = out; d1 <= 1.5 * st.D && !p1; d1 += cell) {
      var q1 = [pu[0] + d1 * Math.cos(a0), pu[1] + d1 * Math.sin(a0)];
      if (legClear(st, pu, q1, gu, -1) >= st.d0 && spotClear(st, q1, -1) + st.spotR >= st.d0) p1 = q1;
    }
    if (p1) {
      var pl = Rt.planner(obs, ctx, st.d0, st.W, st.H, p1, st.spotR), places = [];
      for (var ri = 0; ri < lens.length; ri++) for (var k = 0; k < 24; k++) {
        var ang = a0 + TWO * k / 24, q2 = [pu[0] + lens[ri] * D * Math.cos(ang), pu[1] + lens[ri] * D * Math.sin(ang)];
        if (q2[0] < rho || q2[1] < rho || q2[0] > st.W - rho || q2[1] > st.H - rho || spotClear(st, q2, -1) < st.d0) continue;
        places.push({ q: q2, turn: Math.abs(norm(ang - a0 + Math.PI) - Math.PI), r: lens[ri] });
      }
      places.sort(function (x, y) { return x.r - y.r || x.turn - y.turn; });
      for (var pi = 0; pi < places.length; pi++) {
        var path = pl.pathTo(places[pi].q, null);
        if (!path) continue;
        var pts = [pu, p1].concat(path, [places[pi].q]), kept = [pu, p1], i = 1, last = pts.length - 1;
        while (i < last) { var jj = last; while (jj > i + 1 && (legClear(st, pts[i], pts[jj], gu, -1) < st.d0 || !selfClear(kept, pts[i], pts[jj], st.d0))) jj--; kept.push(pts[jj]); i = jj; }
        var ok = true;
        for (i = 1; i < kept.length && ok; i++) if (!(legClear(st, kept[i - 1], kept[i], gu, -1) > 0) || !selfClear(kept.slice(0, i), kept[i - 1], kept[i], 0)) ok = false;
        if (!ok) continue;
        place(st, v, places[pi].q); addEdge(st, te, roundedClear(st, kept, gu, st.at[v]));
        st.routed++;
        return null;
      }
    }
    return 'no room for spot ' + (v + 1) + ' beside ' + (u + 1);
  }

  /* A curve between two placed spots: two straight legs through a midpoint beside the chord
     (offsets 0, ±D/2, ±D, ±2D, …); the first that keeps d0, leaves and arrives in the right
     sectors, and (when it closes a cycle) leaves the drawing realising the map. */
  function closeEdge(st, u, v, te) {
    var pu = pos(st, u), pv = pos(st, v), gu = st.at[u], gv = st.at[v], D = st.step, t = st.t;
    var su = sector(st, u, te), sv = sector(st, v, te);
    var chord = G.dist(pu, pv) || 1e-9, nx = -(pv[1] - pu[1]) / chord, ny = (pv[0] - pu[0]) / chord, mid = [(pu[0] + pv[0]) / 2, (pu[1] + pv[1]) / 2];
    var offs = [0, 0.5, -0.5, 1, -1, 2, -2, 3, -3, 4, -4, 6, -6], why = 'no straight legs for the curve ' + (u + 1) + '-' + (v + 1);
    var same = sameComponent(st, gu, gv), need = 0;
    if (same) {                                   // RESERVE: a cycle that will hold k spots is closed no nearer than the room they need
      var io = insideOf(st, te, u);
      if (io && !io.error) need = roomFor(st, toComeIn(st, io.cl, io.cwIn ? io.cw : io.ccw));
    }
    for (var oi = 0; oi < offs.length; oi++) {
      if (need && Math.abs(offs[oi]) * D < need) continue;
      var m = [mid[0] + offs[oi] * D * nx, mid[1] + offs[oi] * D * ny], pts = offs[oi] ? [pu, m, pv] : [pu, pv];
      if (m[0] < 0 || m[1] < 0 || m[0] > st.W || m[1] > st.H) continue;
      var a1 = Math.atan2(pts[1][1] - pu[1], pts[1][0] - pu[0]), a2 = Math.atan2(pts[pts.length - 2][1] - pv[1], pts[pts.length - 2][0] - pv[0]);
      if (!inSlice(su, a1) || !inSlice(sv, a2)) { why = 'the curve ' + (u + 1) + '-' + (v + 1) + ' cannot leave or arrive in its sector'; continue; }
      if (pts.length === 3) { if (legClear(st, pu, m, gu, gv) < st.d0 || legClear(st, m, pv, gu, gv) < st.d0) continue; }
      else if (legClear(st, pu, pv, gu, gv) < st.d0) continue;
      addEdge(st, te, roundedClear(st, pts, gu, gv));
      if (same) {
        var bad = realises(st, st.g, undefined);
        if (bad) { removeEdge(st, te); why = 'the curve ' + (u + 1) + '-' + (v + 1) + ': ' + bad; continue; }
      }
      return null;
    }
    return why;
  }
  /* the spots not yet placed that will go into class c of the map with te drawn (cl = classes(st, undefined, te)) */
  function toComeIn(st, cl, c) {
    var k = 0;
    for (var v = 0; v < st.t.spots.length; v++) if (st.at[v] < 0 && cl.find(faceOfPlaced(st, v)) === c) k++;
    return k;
  }
  /* the room k spots need: a disc of radius D √k (one of radius D each) */
  function roomFor(st, k) { return k ? st.D * Math.sqrt(k) : 0; }

  /* ---------------- the router ---------------- */

  /* the plain shortest way, with a side test at the end and blocked cells (route.js's planner has neither) */
  function plainPath(grid, obs, start, p, ring, side, blocked) { return Rt.pathWithParity(grid, obs, start, p, ring, [], [0], side, blocked); }
  /* The half of target edge te that leaves target spot v */
  function halfFrom(st, te, v) { return st.t.edges[te].a === v ? 2 * te : 2 * te + 1; }
  /* The walks of the partial map with te drawn too, as lists of half ids (target numbering) */
  function partialWalks(st, te) {
    var t = st.t, S = st.S, rotP = [], v, h;
    for (v = 0; v < t.spots.length; v++) rotP.push(S.rotE[v].filter(function (e) { return st.edgeAt[e] >= 0 || e === te; }).map(function (e) { return halfFrom(st, e, v); }));
    var head = function (hh) { var e = t.edges[hh >> 1]; return hh & 1 ? e.a : e.b; };
    function nxt(hh) { var tw = hh ^ 1, r = rotP[head(hh)], k = r.indexOf(tw); return r[(k - 1 + r.length) % r.length]; }
    function walk(h0) { var w = [], x = h0; do { w.push(x); x = nxt(x); } while (x !== h0); return w; }
    return { walk: walk, head: head };
  }
  /* When te (from u, between two spots of one drawn component) closes a cycle — the regions on its two sides
     differ — which side is the cycle's INSIDE (v210). Each side's walk in the partial map with te drawn,
     less its arms (edges it passes twice), is a closed curve through te; a side is inside when that curve of
     its own separates it from the outer face — the full map's faces joined across every other edge (Jordan;
     the faces on one side of a closed curve are joined by edges not on it). When te is a chord of a bounded
     region both sides pass, and either is right; when te closes a curve round a hole of the region (a drawn
     component inside it), only one does. "The side that is not the outside" (before v210) chose wrongly when
     both sides are bounded regions — the triangle 29-34-35 of the 30-spot game; 28 of 32 growths in Peter's
     30-seed run of 10/30 died of it. Returns null when te closes no cycle, else { h, cl, cw, ccw, cwIn, W }:
     the classes clockwise and counterclockwise of te at u, whether the inside is the clockwise one, and the
     inside's walk (halves). */
  function insideOf(st, te, u) {
    var t = st.t, S = st.S, h = halfFrom(st, te, u), cl = classes(st, undefined, te);
    var cw = cl.find(S.faceOfHalf[h]), ccw = cl.find(S.faceOfHalf[h ^ 1]);
    if (cw === ccw) return null;
    var pw = partialWalks(st, te), W1 = pw.walk(h), W2 = pw.walk(h ^ 1);
    function inside(W, face) {
      var once = {}, nF = t.m.faces.length, par = new Int32Array(nF), i;
      W.forEach(function (x) { once[x >> 1] = (once[x >> 1] || 0) + 1; });
      for (i = 0; i < nF; i++) par[i] = i;
      function find(x) { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; }
      for (var e = 0; e < t.edges.length; e++) if (once[e] !== 1) { var a = find(S.faceOfHalf[2 * e]), b = find(S.faceOfHalf[2 * e + 1]); if (a !== b) par[a] = b; }
      return find(face) !== find(S.outer);
    }
    var cwIn = inside(W1, S.faceOfHalf[h]), ccwIn = inside(W2, S.faceOfHalf[h ^ 1]);
    if (!cwIn && !ccwIn) return { h: h, cl: cl, cw: cw, ccw: ccw, error: 'neither side of the cycle it closes is inside it' };
    return { h: h, cl: cl, cw: cw, ccw: ccw, cwIn: cwIn, W: cwIn ? W1 : W2 };
  }
  /* The partial map's regions (the classes of the map's faces across the undrawn edges) by depth from the outer
     one across the drawn edges: for each class the face by which it was first reached (its enclosing face;
     the outer region's is the chosen outer face), and the things drawn inside it — each component of the
     drawing whose outer walk faces it, and each placed spot without a curve yet — with a face of the
     thing's on that side (its class after a cut tells which side it goes). */
  function nesting(st) {
    var S = st.S, t = st.t, g = st.g, cl = classes(st), nF = t.m.faces.length, k, v;
    var par = []; for (k = 0; k < g.spots.length; k++) par.push(k);
    function find(x) { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; }
    g.edges.forEach(function (e) { par[find(e.a)] = find(e.b); });
    var compOf = []; for (k = 0; k < g.spots.length; k++) compOf[k] = find(k);
    var back = []; for (v = 0; v < t.spots.length; v++) if (st.at[v] >= 0) back[st.at[v]] = v;
    /* adjacency of classes across drawn edges */
    var adj = {}, enclosing = {}, depth = {}, c0 = cl.find(S.outer), queue = [c0];
    function link(a, b, face) { (adj[a] = adj[a] || []).push({ to: b, face: face }); }
    for (k = 0; k < g.edges.length; k++) {
      var te = st.gEdge[k], fa = S.faceOfHalf[2 * te], fb = S.faceOfHalf[2 * te + 1], ca = cl.find(fa), cb = cl.find(fb);
      if (ca !== cb) { link(ca, cb, fb); link(cb, ca, fa); }
    }
    depth[c0] = 0; enclosing[c0] = S.outer;
    for (var q = 0; q < queue.length; q++) {
      var c = queue[q];
      (adj[c] || []).forEach(function (x) { if (depth[x.to] === undefined) { depth[x.to] = depth[c] + 1; enclosing[x.to] = x.face; queue.push(x.to); } });
    }
    /* the things inside each class: a component is inside the class of its outer walk — the one of its walks
       whose class is shallowest (its outer walk faces the region it sits in) */
    var holes = {}, seenComp = {};
    for (k = 0; k < g.spots.length; k++) {
      var comp = compOf[k], best = null;
      if (seenComp[comp] !== undefined) continue;
      if (!g.spots[k].deg) {                     // a lone spot
        var f0 = faceOfPlaced(st, back[k]), cc = cl.find(f0);
        (holes[cc] = holes[cc] || []).push({ comp: comp, spot: back[k], face: f0 });
        seenComp[comp] = true; continue;
      }
      for (var j = 0; j < g.spots.length; j++) {
        if (compOf[j] !== comp) continue;
        var rotv = t.m.rot[back[j]];
        for (var r = 0; r < rotv.length; r++) {
          var hh = rotv[r];
          if (st.edgeAt[hh >> 1] < 0) continue;
          var f = S.faceOfHalf[hh], cf = cl.find(f);
          if (depth[cf] === undefined) continue;
          if (!best || depth[cf] < best.d) best = { d: depth[cf], face: f, spot: back[j], cls: cf };
        }
      }
      if (best) (holes[best.cls] = holes[best.cls] || []).push({ comp: comp, spot: best.spot, face: best.face });
      seenComp[comp] = true;
    }
    return { cl: cl, enclosing: enclosing, depth: depth, holes: holes, compOf: compOf };
  }
  /* The curve te between the placed spots u and v, where straight legs cannot do it: the shortest way on
     the grid (route.js) from a point just outside u in the curve's slice to one just outside v in its
     slice. When te closes a cycle, the way must also WIND RIGHT: the region of the drawing it splits has
     its two sides decided by the map (the class of each), so the way must cross a ray out of u's inner
     wedge an odd number of times in all (with the drawn part of the cycle), and a ray out of every other
     thing drawn in that region (a hole: another component, or a lone spot) an odd number of times when the
     map puts the thing inside, even when outside — route.js's parity search. The polyline is pulled
     straight wherever a leg can be (its two stubs kept, so the curve leaves and arrives as the map wants),
     and judged like the straight legs — the engine's reading of the drawing is the arbiter. */
  function routeEdge(st, u, v, te) {
    var pu = pos(st, u), pv = pos(st, v), gu = st.at[u], gv = st.at[v], S = st.S, t = st.t;
    var su = sector(st, u, te), sv = sector(st, v, te), au = ideal(su), av = ideal(sv);
    var obs = R.buildObstacles(st.g, st.spotR), ctx = { aIdx: gu, bIdx: gv, A: pu, B: pv, rho: st.D * Math.SQRT2, spotR: st.spotR };
    var cell = Math.max(2, Math.min(8, 0.7 * st.d0)), rho = st.spotR + st.d0, out = rho + cell, name = 'the curve ' + (u + 1) + '-' + (v + 1);
    /* the way starts just outside u along te's ideal direction — farther out where the slice is narrow and
       the curves beside it leave no clear point nearer (up to 1.5 D; the stub is R's to shape afterwards) */
    var p1 = null;
    for (var pass = 0; pass < 2 && !p1; pass++) {      // (second pass: a tight stub, clear of everything but not by d0 — the polish opens it)
      for (var d1 = out; d1 <= 1.5 * st.D && !p1; d1 += cell) {
        var q1 = [pu[0] + d1 * Math.cos(au), pu[1] + d1 * Math.sin(au)], lc = legClear(st, pu, q1, gu, -1), sc = spotClear(st, q1, -1) + st.spotR;
        if (pass ? lc > 0 && sc > 0 : lc >= st.d0 && sc >= st.d0) p1 = q1;
      }
    }
    if (!p1) return name + ' cannot leave ' + (u + 1) + ' in its slice';
    var pl = Rt.planner(obs, ctx, st.d0, st.W, st.H, p1, st.spotR), grid = pl.grid, ring = Math.max(pl.ring, 1.5 * st.D);   // (the hop into v may be long where its slice is narrow)
    /* the way starts at p1, just outside u in te's slice, and ends with a straight hop to v from a cell in v's
       slice; neither spot's disc may be entered (the end spots are no obstacle to the planner), and next to u
       the way keeps to the slice, so that it leaves as the map wants */
    var blocked = new Uint8Array(grid.nx * grid.ny), near = rho + 2 * cell;
    for (var cy = 0; cy < grid.ny; cy++) for (var cx = 0; cx < grid.nx; cx++) {
      var q = [(cx + 0.5) * cell, (cy + 0.5) * cell], du = G.dist(q, pu), dv = G.dist(q, pv);
      if (du <= rho || dv <= rho) blocked[cy * grid.nx + cx] = 1;
      else if (du <= near && !inSlice(su, Math.atan2(q[1] - pu[1], q[0] - pu[0]))) blocked[cy * grid.nx + cx] = 1;
    }
    var side = function (q) { return inSlice(sv, Math.atan2(q[1] - pv[1], q[0] - pv[0])); };
    var same = sameComponent(st, gu, gv), rays = [], wanted = 0, phantom = null;
    if (same) {
      var io = insideOf(st, te, u), h = halfFrom(st, te, u), cl = io ? io.cl : null, cw = io ? io.cw : 0, ccw = io ? io.ccw : 0;
      if (io && io.error) return name + ': ' + io.error;
      if (io) {
        /* te and the drawn curves on the inside's walk close a curve C (insideOf). The wedge at u inside C is
           that side's wedge, and a thing already drawn must end up inside C exactly when the map puts it on
           that side. C's drawn part: the edges that walk passes once (an arm, passed twice, is no part of
           the cycle). */
        var nest = nesting(st), c0 = nest.cl.find(S.faceOfHalf[h]), cwIn = io.cwIn;
        var inner = cwIn ? cw : ccw, W = io.W, once = {}, cycleEdges = {};
        W.forEach(function (x) { once[x >> 1] = (once[x >> 1] || 0) + 1; });
        Object.keys(once).forEach(function (e) { if (once[e] === 1 && +e !== te) cycleEdges[e] = 1; });
        var cycSegs = [];
        Object.keys(cycleEdges).forEach(function (e) { var pts = G.refinedPolygon(st.g.edges[st.edgeAt[+e]].pieces, 0.5, 16).pts; for (var i = 1; i < pts.length; i++) cycSegs.push([pts[i - 1], pts[i]]); });
        function crossings(ray) { var c = 0; for (var i = 0; i < cycSegs.length; i++) if (G.segCross(ray[0], ray[1], cycSegs[i][0], cycSegs[i][1])) c++; return c; }
        function want(ray, inside) { rays.push(ray); if (((inside ? 1 : 0) + crossings(ray)) % 2) wanted |= 1 << (rays.length - 1); }
        /* u's inner wedge: from te's direction clockwise to the next drawn curve, or from the previous one to te */
        var prevA = su.lo, nextA = su.lo + su.wid, wedgeMid = inner === cw ? (au + norm(nextA - au) / 2) : (au - norm(au - prevA) / 2);
        if (st.dbg) console.log('cw', cw, 'ccw', ccw, 'inner', inner, 'cycleEdges', Object.keys(cycleEdges), 'W', io.W, 'wedgeMid', wedgeMid.toFixed(2), 'crossings', crossings(Rt.ray(pu, wedgeMid)));
        want(Rt.ray(pu, wedgeMid), true);           // (u's disc is blocked above: a walk cannot tick the parity off by nipping round the ray's foot)
        /* RESERVE (Peter's decision 1): the k spots the cycle will hold get a phantom disc of the room they
           need, in the inner wedge beside u, that the way must keep clear of — tried first with it, then without */
        var k = toComeIn(st, cl, inner), rr = roomFor(st, k);
        if (rr) {
          var cc = [pu[0] + (rho + rr) * Math.cos(wedgeMid), pu[1] + (rho + rr) * Math.sin(wedgeMid)], disc = [];
          for (var ai = 0; ai <= 24; ai++) disc.push([cc[0] + rr * Math.cos(TWO * ai / 24), cc[1] + rr * Math.sin(TWO * ai / 24)]);
          phantom = disc;
        }
        /* the ARMS in the region — the drawn trees hanging into it from the cycle, from the region's boundary and
           from its holes (an edge with the region's class on both sides): the one whose class is the inner side
           goes inside C, the rest outside. At a spot with fewer than three drawn curves the rotation does not yet
           pin an arm to a side, so each tree gets a ray, from one of its spots off the cycle. */
        var par2 = {}, armCls = {}, arms = [];
        function f2(x) { while (par2[x] !== x) { par2[x] = par2[par2[x]]; x = par2[x]; } return x; }
        for (var ae = 0; ae < t.edges.length; ae++) {
          if (st.edgeAt[ae] < 0 || ae === te || cycleEdges[ae]) continue;
          var ca2 = cl.find(S.faceOfHalf[2 * ae]), cb2 = cl.find(S.faceOfHalf[2 * ae + 1]);
          if (ca2 !== cb2 || (ca2 !== cw && ca2 !== ccw)) continue;
          var ea = t.edges[ae].a, eb = t.edges[ae].b;
          if (par2[ea] === undefined) par2[ea] = ea; if (par2[eb] === undefined) par2[eb] = eb;
          par2[f2(ea)] = f2(eb); armCls[ae] = ca2;
        }
        /* (v210) a tree that meets the cycle at a spot with three drawn curves once te is drawn is pinned there by
           the rotation — te leaves and arrives in its slice — and gets no ray: an arm at u or v on a
           two-curve cycle (the lens of a loop, 15-6 in the 30-spot game 13-36-32) was asked to be enclosed
           by a ray from its tip as well, and no way met both */
        var onCycle = {}, drawnDeg = {};
        onCycle[u] = onCycle[v] = 1;
        Object.keys(cycleEdges).forEach(function (e) { onCycle[t.edges[+e].a] = onCycle[t.edges[+e].b] = 1; });
        for (var de = 0; de < t.edges.length; de++) if (st.edgeAt[de] >= 0 || de === te) { drawnDeg[t.edges[de].a] = (drawnDeg[t.edges[de].a] || 0) + 1; drawnDeg[t.edges[de].b] = (drawnDeg[t.edges[de].b] || 0) + 1; }
        var pinned = {};
        Object.keys(armCls).forEach(function (ae) {
          [t.edges[+ae].a, t.edges[+ae].b].forEach(function (x) { if (onCycle[x] && drawnDeg[x] >= 3) pinned[f2(x)] = 1; });
        });
        var armRoot = {};
        Object.keys(armCls).forEach(function (ae) {
          var ea = t.edges[+ae].a, eb = t.edges[+ae].b, r0 = f2(ea), tip = (ea !== u && ea !== v) ? ea : (eb !== u && eb !== v) ? eb : -1;
          if (tip < 0 || armRoot[r0] || pinned[r0]) return;
          armRoot[r0] = 1; arms.push({ spot: tip, inside: armCls[ae] === inner });
        });
        for (var ar = 0; ar < arms.length; ar++) {
          if (rays.length >= Rt.MAX_CUTS) return name + ': too many things in its region to get round';
          var pa = pos(st, arms[ar].spot);
          want(Rt.ray(pa, Math.atan2(pa[1] - pu[1], pa[0] - pu[0])), arms[ar].inside);
        }
        /* every other thing drawn in that region — a component whose outer walk faces it, a lone spot in it:
           in or out as the map says */
        var holes = nest.holes[c0] || [];
        for (var b = 0; b < holes.length; b++) {
          var ho = holes[b];
          if (ho.comp === nest.compOf[gu]) continue;      // te's own component: its arms follow the rotations
          var cls = cl.find(ho.face);
          if (rays.length >= Rt.MAX_CUTS) return name + ': too many things in its region to get round';
          var ps = pos(st, ho.spot), dir = Math.atan2(ps[1] - pu[1], ps[0] - pu[0]);
          want(Rt.ray(ps, dir), cls === inner);
        }
      }
    }
    if (st.dbg) console.log("rays", JSON.stringify(rays.map(function (r) { return [r[0].map(Math.round), Math.atan2(r[1][1]-r[0][1], r[1][0]-r[0][0]).toFixed(2)]; })), "wanted", wanted, "p1", p1.map(Math.round));
    var path = null;
    if (phantom) {                                // the grid anew with the phantom disc among the obstacles
      var obs2 = R.buildObstacles(st.g, st.spotR, [phantom]), pl2 = Rt.planner(obs2, ctx, st.d0, st.W, st.H, p1, st.spotR);
      path = Rt.pathWithParity(pl2.grid, obs2, p1, pv, ring, rays, [wanted], side, blocked);
      if (path) { obs = obs2; grid = pl2.grid; } else st.noRoomReserved = (st.noRoomReserved || 0) + 1;
    }
    if (!path) path = rays.length ? Rt.pathWithParity(grid, obs, p1, pv, ring, rays, [wanted], side, blocked) : plainPath(grid, obs, p1, pv, ring, side, blocked);
    if (st.dbg) console.log('variants: planner', !!pl.pathTo(pv, null), 'side', !!pl.pathTo(pv, side), 'plain+side+blocked', !!plainPath(grid, obs, p1, pv, pl.ring, side, blocked), 'parity no side/blocked', rays.length ? !!Rt.pathWithParity(grid, obs, p1, pv, pl.ring, rays, [wanted], null, null) : '-', 'parity side', rays.length ? !!Rt.pathWithParity(grid, obs, p1, pv, pl.ring, rays, [wanted], side, null) : '-', 'parity blocked', rays.length ? !!Rt.pathWithParity(grid, obs, p1, pv, pl.ring, rays, [wanted], null, blocked) : '-', 'parity other mask', rays.length ? !!Rt.pathWithParity(grid, obs, p1, pv, pl.ring, rays, [wanted ^ 1], side, blocked) : '-');
    if (!path) return "no way through for " + name + (rays.length ? ' round what must be enclosed' : '');
    /* a parity WALK may double back on itself (out to a ray and back); then it is inflated (route.js, as
       the page's marked routes are) and the two ways round the inflated outline are the candidates */
    var candidates = [];
    if (rays.length) {
      var loops = Rt.inflate(grid, obs, path), L = null, bestD = Infinity;
      if (loops.first) loops.forEach(function (l) { l.forEach(function (q) { var dd = G.dist(q, loops.first); if (dd < bestD) { bestD = dd; L = l; } }); });
      if (L) {
        var n = L.length, w1 = loops.first, w2 = loops.last;
        function nearestEdge(q) { var e = 0, bd = Infinity; for (var x = 0; x < n; x++) { var dd = G.distPointSeg(q, L[x], L[(x + 1) % n]); if (dd < bd) { bd = dd; e = x; } } return e; }
        var e1 = nearestEdge(w1), e2 = nearestEdge(w2), arc, tt;
        arc = []; for (tt = (e1 + 1) % n; ; tt = (tt + 1) % n) { arc.push(L[tt]); if (tt === e2) break; }
        candidates.push([pu, p1].concat(arc, [pv]));
        arc = []; for (tt = e1; ; tt = (tt + n - 1) % n) { arc.push(L[tt]); if (tt === (e2 + 1) % n) break; }
        candidates.push([pu, p1].concat(arc, [pv]));
      }
    }
    candidates.push([pu, p1].concat(path, [pv]));
    var why = null;
    for (var ci = 0; ci < candidates.length && why !== 'ok'; ci++) {
      /* an inflated outline runs 1.5 cells beside the walk, which passed right by the end spots (they are no
         obstacle to the planner): the stretch inside either spot's reach is dropped, and the hop in must
         arrive in v's slice */
      var pts = candidates[ci].filter(function (q, qi, arr) { return qi < 2 || qi === arr.length - 1 || (G.dist(q, pu) > rho && G.dist(q, pv) > rho); });
      if (pts.length < 3 || !inSlice(sv, Math.atan2(pts[pts.length - 2][1] - pv[1], pts[pts.length - 2][0] - pv[0]))) { why = 'the routed ' + name + ' arrives at ' + (v + 1) + ' outside its slice'; continue; }
      var last = pts.length - 1, i, kept = [pts[0], pts[1]];
      /* pull straight: from pts[i] the farthest point a clear leg reaches — a leg that crosses the rays as the
         stretch it replaces did (the winding is round the spot u itself: a shortcut past the ray would undo it) */
      var pre = [0];
      for (i = 1; i < pts.length; i++) pre.push(pre[i - 1] ^ rayMask(rays, pts[i - 1], pts[i]));
      i = 1;
      while (i < last) {
        var jj = last;
        while (jj > i + 1 && (legClear(st, pts[i], pts[jj], gu, gv) < st.d0 || !selfClear(kept, pts[i], pts[jj], st.d0) || rayMask(rays, pts[i], pts[jj]) !== (pre[jj] ^ pre[i]) || (jj === last && !inSlice(sv, Math.atan2(pts[i][1] - pv[1], pts[i][0] - pv[0]))))) jj--;
        kept.push(pts[jj]); i = jj;
      }
      var tries = [kept, pts];
      for (var k = 0; k < tries.length; k++) {
        var poly = tries[k], touch = false;
        for (i = 1; i < poly.length && !touch; i++) if (!(legClear(st, poly[i - 1], poly[i], gu, gv) > 0) || !selfClear(poly.slice(0, i), poly[i - 1], poly[i], 0)) touch = true;   // (the planner allows less than d0 near the ends; R opens it up)
        if (st.dbg) { var tl = []; for (i = 1; i < poly.length; i++) tl.push(legClear(st, poly[i - 1], poly[i], gu, gv).toFixed(1) + (selfClear(poly.slice(0, i), poly[i - 1], poly[i], 0) ? '' : 'S')); console.log('candidate', ci, k === 0 ? 'pulled' : 'raw', poly.length, 'pts', touch ? 'TOUCH' : 'ok', tl.join(' ')); }
        if (touch) { why = 'the routed ' + name + ' touches something'; continue; }
        addEdge(st, te, roundedClear(st, poly, gu, gv));
        if (same) { var bad = realises(st, st.g); if (bad) { removeEdge(st, te); why = 'the routed ' + name + ': ' + bad; if (st.dbg) console.log('  realises:', bad, JSON.stringify(poly.map(function (q) { return q.map(Math.round); }))); continue; } }
        st.routed++;
        why = 'ok'; break;
      }
    }
    return why === 'ok' ? null : why;
  }
  function rayMask(rays, a, b) { var m = 0; for (var i = 0; i < rays.length; i++) if (G.segCross(a, b, rays[i][0], rays[i][1])) m ^= 1 << i; return m; }
  /* does the leg a → b keep `gap` (> gap, or > 0 when gap is 0) from the legs of `before` not touching it? */
  function selfClear(before, a, b, gap) {
    for (var i = 1; i + 1 < before.length; i++) {   // (the last leg of `before` ends at a: adjacent, skipped)
      var d = segDist(a, b, before[i - 1], before[i]);
      if (gap ? d < gap : !(d > 0)) return false;
    }
    return true;
  }
  function sameComponent(st, ga, gb) {            // joined by drawn curves?
    var par = []; for (var i = 0; i < st.g.spots.length; i++) par.push(i);
    function find(x) { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; }
    st.g.edges.forEach(function (e) { par[find(e.a)] = find(e.b); });
    return find(ga) === find(gb);
  }
  /* Where to start a component: inside the drawing's region that is its face's class — the roomiest of
     many random points there (the window for the outside; the box of the region's cycle otherwise). */
  function placeInside(st, face) {
    var an = analysed(st), cl = classes(st), want = cl.find(face), S = st.S, back = [], v, k;
    for (v = 0; v < st.t.spots.length; v++) if (st.at[v] >= 0) back[st.at[v]] = v;
    var region = null;
    for (k = 0; k < an.regions.length && !region; k++) {
      var rg = an.regions[k], bd = rg.boundaries[0];
      if (rg.key === -1) { if (want === cl.find(S.outer)) region = rg; continue; }
      var h = an.cycles[bd.cycle].halves[0], c = cl.find(S.faceOfHalf[2 * st.gEdge[h.edge] + (h.id & 1)]);
      if (c === want) region = rg;
    }
    if (!region && !st.g.spots.length) return [st.W / 2, st.H / 2];
    if (!region) return null;
    var rho = st.spotR + st.d0, box = [rho, rho, st.W - rho, st.H - rho];
    if (region.key !== -1) {
      var poly = an.cycles[region.key].poly, x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      poly.forEach(function (p) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); });
      box = [Math.max(box[0], x0), Math.max(box[1], y0), Math.min(box[2], x1), Math.min(box[3], y1)];
    }
    var best = null, tries = region.key === -1 ? 400 : 200;
    for (k = 0; k < tries; k++) {
      var q = [box[0] + st.rng() * (box[2] - box[0]), box[1] + st.rng() * (box[3] - box[1])];
      var r = an.regionAt(q);
      if (r !== region) continue;
      var cq = spotClear(st, q, -1);
      if (!best || cq > best.c) best = { c: cq, q: q };
    }
    return best && best.c >= st.d0 ? best.q : null;
  }

  /* ---------------- R between stages ---------------- */

  /* The partial drawing scaled about its middle to fill the window less a margin, when it is smaller — a
     uniform scaling keeps every angle and crossing as it is (the position cannot change) and opens every
     clearance alike; the compact R then only has to share the room out. */
  function fitWindow(st) {
    var g = st.g, x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, m = st.step;
    g.spots.forEach(function (s) { x0 = Math.min(x0, s.x); x1 = Math.max(x1, s.x); y0 = Math.min(y0, s.y); y1 = Math.max(y1, s.y); });
    g.edges.forEach(function (e) { e.pieces.forEach(function (pc) { pc.forEach(function (p) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }); }); });
    var f = Math.min((st.W - 2 * m) / Math.max(1, x1 - x0), (st.H - 2 * m) / Math.max(1, y1 - y0));
    if (!(f > 1.05)) return false;
    var cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, nx = st.W / 2, ny = st.H / 2;
    function map(p) { return [nx + f * (p[0] - cx), ny + f * (p[1] - cy)]; }
    g.spots.forEach(function (s) { var q = map([s.x, s.y]); s.x = q[0]; s.y = q[1]; });
    g.edges.forEach(function (e) { e.pieces = e.pieces.map(function (pc) { return pc.map(map); }); });
    dirty(st);
    return true;
  }
  /* R on the partial drawing, each region's room weighted by the spots it still has to receive */
  function startRelax(st, why) {
    if (!st.g.edges.length) return false;
    fitWindow(st);
    var cl = classes(st), S = st.S, toCome = {}, v;
    for (v = 0; v < st.t.spots.length; v++) if (st.at[v] < 0) { var c = cl.find(faceOfPlaced(st, v)); toCome[c] = (toCome[c] || 0) + 1; }
    /* the weight of a region of the partial drawing: the spots its class still has to receive (redraw.js asks
       again after every re-spacing, so the weights survive it) */
    var gEdge = st.gEdge.slice(), finalLives = {};
    st.t.m.faces.forEach(function (f, fi) {                // the lives the region will have when finished: its floor
      var spots = {}, L = 0;
      f.walks.forEach(function (w) { if (w.halves) w.halves.forEach(function (h) { spots[st.t.m.half[h].tail] = 1; }); else spots[w.spot] = 1; });
      Object.keys(spots).forEach(function (v) { L += Math.max(0, 3 - st.t.spots[+v].deg); });
      var c = cl.find(fi); finalLives[c] = (finalLives[c] || 0) + L;
    });
    function lives(an, ri) {
      var rg = an.regions[ri], c;
      if (rg.key === -1) c = cl.find(S.outer);
      else { var h = an.cycles[rg.key].halves[0]; c = cl.find(S.faceOfHalf[2 * gEdge[h.edge] + (h.id & 1)]); }
      /* the room for k spots still to come: a disc of radius D√k (a disc of radius D each). In redraw's energy
         a region of L lives settles, against the length term's tension (10 per px, v207), where
         10 · 2πρ = π (D/2)² · L · 2/ρ, i.e. ρ = D² L / 40 — so L = 40 √k / D puts it at ρ = D √k. (The
         count itself, or a multiple, is wrong at both ends: that ρ grows with L, so a few spots got no
         room at all and a whole position to come blew its region up to the window, pinning the loop's
         two curves together in a corner.) Plus the lives the region ends with: the room the finished
         picture needs anyway. */
      return 40 * Math.sqrt(toCome[c] || 0) / st.D + (finalLives[c] || 0);
    }
    var o = Object.assign({}, st.o, { keepKnots: true, tight: false, restaging: false, lives: lives, spotR: st.spotR });
    st.relax = { rd: Rd.createRedraw(st.g, o, false), key: Rm.positionKey(st.g), why: why, steps: 0 };
    return true;
  }
  function stepRelax(st, count) {
    var r = st.relax;
    if (!Rd.stepRedraw(r.rd, count)) { r.steps += count; return false; }
    /* the POLYLINES the descent ends with, not smooth curves through their points: the partial drawing stays
       a polyline drawing throughout (the descent keeps polylines from crossing — PrEd — and the engine,
       the router and the clearance tests all read them exactly; the smooth curves R fits through such
       points overshoot at the corners a growing drawing is full of, and were refused again and again);
       the picture gets its splines from the polish at the end */
    var out = { game: Rd.redrawCurrent(r.rd) };
    st.relax = null; st.relaxes++; st.relaxSteps += r.rd.it;
    if (Rm.positionKey(out.game) !== r.key) { st.relaxFailed++; st.relaxWhy['it changed the position'] = (st.relaxWhy['it changed the position'] || 0) + 1; return true; }
    out.game.spots.forEach(function (s, i) { s.n = st.g.spots[i].n; });
    st.g = out.game;
    st.gEdge.forEach(function (te, k) { st.have[te] = st.g.edges[k]; });
    dirty(st);
    return true;
  }

  /* ---------------- the growth ---------------- */

  function tasksOf(st, spots) {
    var out = [], S = st.S;
    spots.forEach(function (u) { S.nbrs[u].forEach(function (nb) { if (st.edgeAt[nb.edge] < 0) out.push({ u: u, v: nb.to, te: nb.edge }); }); });
    return out;
  }
  /* one task: draw the edge; null when drawn, else why not */
  function tryTask(st, tk) {
    if (st.edgeAt[tk.te] >= 0) return null;
    if (st.at[tk.u] < 0 && st.at[tk.v] >= 0) { var s = tk.u; tk.u = tk.v; tk.v = s; }
    if (st.at[tk.u] < 0) return 'neither end of the curve ' + (tk.u + 1) + '-' + (tk.v + 1) + ' is placed';
    if (st.at[tk.v] < 0) { var w = growSpot(st, tk.u, tk.v, tk.te); if (!w) st.layer.push(tk.v); return w; }
    var why = closeEdge(st, tk.u, tk.v, tk.te);
    if (why) why = routeEdge(st, tk.u, tk.v, tk.te);
    return why;
  }
  function stepOnce(st) {
    if (st.relax) { stepRelax(st, 20); return false; }
    if (st.tasks.length) {
      var tk = st.tasks.shift(), why = tryTask(st, tk), tries = st.retried[tk.te] || 0;
      if (!why) return false;
      st.retried[tk.te] = tries + 1;
      if (tries === 0) { st.tasks.unshift(tk); startRelax(st, why); return false; }   // once more after an R
      if (tries === 1) { st.later.push(tk); return false; }                             // again when the component is grown
      st.failures.push(why); if (!st.stuck) st.stuck = { a: tk.u, b: tk.v, why: why };
      return false;
    }
    if (st.layer.length) {                        // the next layer of the breadth-first growth: R first, then its tasks
      var next = st.layer.filter(function (x, i, a) { return a.indexOf(x) === i; });
      st.layer = [];
      st.tasks = tasksOf(st, next);
      if (st.tasks.length && st.stageR) startRelax(st, 'stage');   // (R between layers; else only when a curve or a place fails)
      return false;
    }
    if (st.later.length) {                        // deferred curves: an R, then each once more, then they are failures
      st.tasks = st.later; st.later = [];
      startRelax(st, 'deferred');
      return false;
    }
    st.ci++;
    if (st.ci >= st.order.length) { st.done = true; return true; }
    var c = st.order[st.ci], S = st.S;
    var root = S.comp[st.start] === c.id ? st.start : c.members.slice().sort(function (x, y) { return st.t.spots[y].deg - st.t.spots[x].deg || x - y; })[0];
    var p = placeInside(st, c.face);
    if (!p && !st.retried['place' + c.id]) { st.retried['place' + c.id] = 1; st.ci--; startRelax(st, 'place'); return false; }
    if (!p) { st.failures.push('nowhere to start the component of spot ' + (root + 1)); return false; }
    place(st, root, p);
    st.tasks = tasksOf(st, [root]);
    return false;
  }
  function stepGrow(st, ms) {
    var t0 = Date.now();
    do { if (stepOnce(st)) return true; } while (Date.now() - t0 < (ms || 0));
    return false;
  }
  function finishGrow(st) {
    var t = st.t, out = null;
    var all = true;
    for (var v = 0; v < t.spots.length; v++) if (st.at[v] < 0) all = false;
    if (all) {
      var back = [];
      for (v = 0; v < t.spots.length; v++) back[st.at[v]] = v;
      out = { W0: st.W, H0: st.H, spots: [], edges: [], moves: t.moves, player: t.player, phase: t.phase, rules: t.rules, added: t.added };
      for (v = 0; v < t.spots.length; v++) { var s = st.g.spots[st.at[v]]; out.spots.push({ x: s.x, y: s.y, deg: s.deg }); }
      for (var te = 0; te < t.edges.length; te++) { var e = st.have[te]; if (!e) { all = false; break; } out.edges.push({ a: back[e.a], b: back[e.b], player: e.player, pieces: e.pieces, h: e.h }); }
    }
    var ok = all && !!out && st.drawn === t.edges.length;
    if (ok && t.spots.length > 1) { var bad = realises(st, st.g); if (bad) { ok = false; st.failures.push('the finished drawing: ' + bad); } }
    if (st.stuck) {
      if (st.at[st.stuck.a] >= 0) st.g.spots[st.at[st.stuck.a]].mark = true;
      if (st.at[st.stuck.b] >= 0) st.g.spots[st.at[st.stuck.b]].mark = true;
    }
    return { game: ok ? out : null, partial: st.g, ok: ok, failures: st.failures, stuck: st.stuck, relaxes: st.relaxes, relaxFailed: st.relaxFailed,
             relaxWhy: st.relaxWhy, relaxSteps: st.relaxSteps, placed: st.placed, drawn: st.drawn, routed: st.routed };
  }
  function grow(t, opt) {
    var st = createGrow(t, opt);
    while (!stepGrow(st, 1000)) {}
    return finishGrow(st);
  }

  /* The start spots for parallel growths of the position of `game` (after mv, if given): every spot of an
     outermost component (one in the outer region), the highest degree first — a growth starts from one of
     these; a spot deeper in the nesting cannot start, its region is drawn first. */
  function starts(game, mv, player) {
    var t = targetOf(game, mv, player), S = structure(t), out = [];
    for (var v = 0; v < t.spots.length; v++) if (S.depth[S.comps[S.comp[v]].face] === 0) out.push(v);
    out.sort(function (a, b) { return t.spots[b].deg - t.spots[a].deg || a - b; });
    return out;
  }
  /* The partial drawing as a game with the position's own spot numbers, for the page to show while it grows:
     every spot of the position (the unplaced ones far off screen, with no curves), the drawn curves between
     them — the page draws it, labels it and reads it by the real indices (it keeps `game` pointing at the
     picture on screen while Z runs, and the computer's own code may read it meanwhile) */
  function pictureOf(st) {
    var t = st.t, g = st.g, out = { W0: g.W0, H0: g.H0, moves: t.moves, player: t.player, phase: t.phase, rules: t.rules, added: t.added, spots: [], edges: [] };
    for (var v = 0; v < t.spots.length; v++) { var s = st.at[v] >= 0 ? g.spots[st.at[v]] : null; out.spots.push(s ? { x: s.x, y: s.y, deg: s.deg } : { x: -1e4, y: -1e4, deg: 0 }); }
    var back = []; for (v = 0; v < t.spots.length; v++) if (st.at[v] >= 0) back[st.at[v]] = v;
    g.edges.forEach(function (e) { out.edges.push({ a: back[e.a], b: back[e.b], player: e.player, pieces: e.pieces }); });
    return out;
  }
  var api = { starts: starts, fitWindow: fitWindow, pictureOf: pictureOf, __p: { insideOf: insideOf, nesting: nesting, classes: classes, halfFrom: halfFrom, spotClear: spotClear, routeEdge: routeEdge, sector: sector, slice: slice, inSlice: inSlice, legClear: legClear, pos: pos, realises: realises, addEdge: addEdge, removeEdge: removeEdge }, targetOf: targetOf, createGrow: createGrow, stepGrow: stepGrow, finishGrow: finishGrow, grow: grow, structure: structure };
  root.SproutsGrow = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : this);
