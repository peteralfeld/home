/* =========================================================================
   room.js — making room for a move that does not fit (plan agreed with
   Peter, 9/23; see CLAUDE.md "making room"). DOM-free (global SproutsRoom,
   or require()). Needs geom.js, relax.js, route.js, engine.js, describe.js.

   Step 2: SLIDING SPOTS (and, for Ctrl+drag by hand, spots of degree 0 and
   1: see oneEdge … regionOfSpot; the dragging itself is in ui.js). A spot made by a move sits in the middle of that
   move's curve, which was fitted as ONE C² spline and cut in two at the
   spot (knot insertion). While the spot has only those two curves it can
   slide along the spline: cut it at another parameter instead. The shape
   does not change, so nothing can cross and no region changes — only where
   the spot is. The parameter of the spline is its h (≈ arc length).
   ========================================================================= */
(function (root) {
  'use strict';
  var G = root.SproutsGeom || require('./geom.js');
  var R = root.SproutsRelax || require('./relax.js');
  var Rt = root.SproutsRoute || require('./route.js');

  /* The two edges of the move that made spot z — {e1, e2}: e1 ends at z, e2
     starts there — if z still has only those two curves; else null. Moves
     are stored as edge pairs (2m, 2m+1), x → z and z → y, so the spot made by
     a move is the end of an even-numbered edge. (Not found from the spot's
     number: spots added by hand (v35) come between the moves' spots.) */
  function slidable(game, z) {
    if (!game.spots[z] || game.spots[z].deg !== 2) return null;
    for (var e1 = 0; e1 + 1 < game.edges.length; e1 += 2) {
      if (game.edges[e1].b === z) return game.edges[e1 + 1].a === z ? { e1: e1, e2: e1 + 1 } : null;
    }
    return null;                                  // an original spot (or one added by hand): its curves are separate fits
  }

  /* The whole spline through z: { pieces, h, H (total parameter), u (z's parameter) }. */
  function spline(game, z) {
    var s = slidable(game, z), a = game.edges[s.e1], b = game.edges[s.e2];
    var h = a.h.concat(b.h), H = 0, u = 0;
    h.forEach(function (x) { H += x; });
    a.h.forEach(function (x) { u += x; });
    return { pieces: a.pieces.concat(b.pieces), h: h, H: H, u: u };
  }

  /* The spline cut at parameter u: { left, right, point }. At (within 1 px
     of) an existing knot it is cut there, so no tiny piece is made. */
  function cut(sp, u) {
    var acc = 0, n = sp.pieces.length;
    for (var i = 0; i < n; i++) {
      if (acc + sp.h[i] >= u || i === n - 1) {
        var t = Math.min(1, Math.max(0, (u - acc) / sp.h[i]));
        if (t * sp.h[i] < 1 && i > 0) {
          return { left: { pieces: sp.pieces.slice(0, i), h: sp.h.slice(0, i) },
                   right: { pieces: sp.pieces.slice(i), h: sp.h.slice(i) }, point: sp.pieces[i][0] };
        }
        if ((1 - t) * sp.h[i] < 1 && i < n - 1) {
          return { left: { pieces: sp.pieces.slice(0, i + 1), h: sp.h.slice(0, i + 1) },
                   right: { pieces: sp.pieces.slice(i + 1), h: sp.h.slice(i + 1) }, point: sp.pieces[i][3] };
        }
        var two = G.splitPiece(sp.pieces[i], t);
        return { left: { pieces: sp.pieces.slice(0, i).concat([two[0]]), h: sp.h.slice(0, i).concat([t * sp.h[i]]) },
                 right: { pieces: [two[1]].concat(sp.pieces.slice(i + 1)), h: [(1 - t) * sp.h[i]].concat(sp.h.slice(i + 1)) },
                 point: two[0][3] };
      }
      acc += sp.h[i];
    }
  }

  /* The point of the spline at parameter u, and its unit normal (left of the direction of travel). */
  function pointAt(sp, u) {
    var acc = 0, n = sp.pieces.length;
    for (var i = 0; i < n; i++) {
      if (acc + sp.h[i] >= u || i === n - 1) {
        var t = Math.min(1, Math.max(0, (u - acc) / sp.h[i])), b = sp.pieces[i], dt = 1e-3;
        var p = G.pieceEval(b, t), q = G.pieceEval(b, Math.min(1, t + dt)), r = G.pieceEval(b, Math.max(0, t - dt));
        var tx = q[0] - r[0], ty = q[1] - r[1], l = Math.sqrt(tx * tx + ty * ty) || 1;
        return { p: p, n: [ty / l, -tx / l] };
      }
      acc += sp.h[i];
    }
  }

  /* The parameter of the point of the spline nearest p. */
  function paramOf(sp, p) {
    var best = Infinity, bu = 0, acc = 0, S = 24;
    sp.pieces.forEach(function (b, i) {
      for (var k = 0; k <= S; k++) {
        var d = G.dist(G.pieceEval(b, k / S), p);
        if (d < best) { best = d; bu = acc + sp.h[i] * k / S; }
      }
      acc += sp.h[i];
    });
    return bu;
  }

  /* Put spot z at parameter u of its spline (mutates game). The parameter is
     kept at least `margin` from both ends, so the spot stays clear of its
     neighbours along the curve. `sp`, if given, is the spline to cut (a
     drag by hand cuts the spline as it was at the press, so the knots of
     the intermediate positions do not pile up). */
  function place(game, z, u, margin, sp) {
    var s = slidable(game, z);
    sp = sp || spline(game, z);
    u = Math.min(sp.H - margin, Math.max(margin, u));
    var c = cut(sp, u), A = game.edges[s.e1], B = game.edges[s.e2];
    A.pieces = c.left.pieces; A.h = c.left.h;
    B.pieces = c.right.pieces; B.h = c.right.h;
    game.spots[z].x = c.point[0]; game.spots[z].y = c.point[1];
    return u;
  }

  function copyGame(game) { return JSON.parse(JSON.stringify(game)); }

  /* ---- a spot at the free end of one curve (degree 1) ----
     A degree-1 spot is an original spot with one curve, whose other end is
     the spot made by that move. `oneEdge` finds that curve; `oriented` gives
     its spline running from the other end z to the spot s (reversed if the
     edge is stored the other way), `writeOriented` stores such a spline
     back in the edge's own direction. */
  function oneEdge(game, s) {
    if (!game.spots[s] || game.spots[s].deg !== 1) return null;
    for (var i = 0; i < game.edges.length; i++) {
      var e = game.edges[i];
      if (e.a === s && e.b !== s) return { e: i, z: e.b, reversed: true };
      if (e.b === s && e.a !== s) return { e: i, z: e.a, reversed: false };
    }
    return null;
  }
  function reverseCurve(c) {
    return { pieces: c.pieces.slice().reverse().map(function (b) { return [b[3], b[2], b[1], b[0]]; }), h: c.h.slice().reverse() };
  }
  function oriented(game, s) {
    var o = oneEdge(game, s), e = game.edges[o.e], c = { pieces: e.pieces, h: e.h };
    if (o.reversed) c = reverseCurve(c);
    var H = 0; c.h.forEach(function (x) { H += x; });
    return { pieces: c.pieces, h: c.h, H: H, u: H };
  }
  function writeOriented(game, s, c) {
    var o = oneEdge(game, s), e = game.edges[o.e];
    if (o.reversed) c = reverseCurve(c);
    e.pieces = c.pieces; e.h = c.h;
  }
  /* Slide the free end s back along its curve to parameter u of `sp` (the
     curve as it was at the press, running z → s): the part beyond is cut
     off. Kept at least `margin` from z. */
  function trimTo(game, s, sp, u, margin) {
    u = Math.min(sp.H, Math.max(margin, u));
    var c = u >= sp.H ? { pieces: sp.pieces, h: sp.h } : cut(sp, u).left;
    writeOriented(game, s, c);
    var last = c.pieces[c.pieces.length - 1][3];
    game.spots[s].x = last[0]; game.spots[s].y = last[1];
    return u;
  }
  /* The region spot s lies in (s of degree 0 or 1: exactly one region has it). */
  function regionOfSpot(an, s) {
    return an.regions.filter(function (r) { return r.spots.indexOf(s) >= 0; })[0] || null;
  }

  /* The room each position of spot z along its spline would give a move to
     or from `from` (a point in the move's region): one widest-path search
     from `from` with z taken out of the picture (its disc and its angle rule
     gone), read off at every position (a grid cell apart) on each side of the
     curve that lies in the move's region (`inRegion(p)`). Near the curve the
     clearance is measured plainly — without the angle rule a spot there
     would get — so the estimate errs on the small side; the caller checks
     the chosen position properly. Returns [{u, room, side}]. */
  function roomAlong(game, z, from, fromIdx, inRegion, o) {
    var g2 = copyGame(game);
    g2.spots[z].x = -1e6; g2.spots[z].y = -1e6;
    var obs = R.buildObstacles(g2, o.spotR);
    var ctx = { aIdx: fromIdx, bIdx: -1, A: from, B: from, rho: o.rho, spotR: o.spotR, scaleAll: true };
    var grid = Rt.buildGrid(obs, ctx, o.d0, game.W0, game.H0), field = Rt.widestField(grid, obs, from);
    var ring = o.d0 + o.spotR + 1.5 * grid.cell, sp = spline(game, z), margin = 2 * o.spotR, out = [];
    for (var u = margin; u <= sp.H - margin; u += grid.cell) {
      var pn = pointAt(sp, u);
      [1, -1].forEach(function (side) {
        var q = [pn.p[0] + side * pn.n[0], pn.p[1] + side * pn.n[1]];   // 1 px off the curve, on that side
        if (!inRegion(q)) return;
        var w = Rt.widestTo(field, grid, obs, q, ring);
        if (w) out.push({ u: u, room: w.clearance, side: side, at: w.at });
      });
    }
    return out;
  }

  /* Slide spot z to make room for a move between it and `from`. A position
     is judged by the move itself: `trial(gameWithZThere, candidate)` is the
     caller's trial of the real move (planner and band) — { E, rmin } of the
     relaxed band, or null if it fails; the move FITS when rmin ≥ d0. Of the
     positions where it fits, the one whose curve has the lowest band energy
     wins — the band's own measure of length against crowding, with the
     Settings' D and λ, i.e. how every curve is judged (Peter's game of 9/23:
     clearance alone could not tell a 30 px curve from one round the whole
     drawing; their energies were 800 and 17 000).
     Positions a minimum clearance apart, on each side of the curve that faces
     the move's region, are taken in order of how far the spot would slide,
     both directions along the curve at once; one whose estimated room
     (roomAlong: the widest way there is, an upper bound) is below the minimum
     clearance gets no trial. The search ends at the FIRST VALLEY: when, in
     some direction, the move has fitted and the energy then rises (by more
     than the band's own precision, R.QUIET_E) — the spot slides as far as it
     must and on to the best place nearby, never round to the far side.
     Returns { u, side, E, room (the curve's clearance), from, to } or
     { fail, best (the largest estimated room), bestU, bestSide }. */
  /* wantSide (v112): only candidates on that side of z's curve (±1, as `side`) — the side the move
     leaves or reaches z by, where z's two corners are both in the region (a spot on a bare path) */
  function slideFor(game, z, from, fromIdx, inRegion, trial, o, wantSide) {
    var sp = spline(game, z), u0 = sp.u, all = roomAlong(game, z, from, fromIdx, inRegion, o), list = [], last = {};
    all.sort(function (x, y) { return x.u - y.u; });
    all.forEach(function (c) {                    // thin to one candidate per d0 of curve on each side
      if (last[c.side] === undefined || c.u - last[c.side] >= o.d0) { list.push(c); last[c.side] = c.u; }
    });
    list.sort(function (x, y) { return Math.abs(x.u - u0) - Math.abs(y.u - u0); });
    var best = null, dirs = {}, est = -Infinity, estC = null;
    list.forEach(function (c) { if (c.room > est) { est = c.room; estC = c; } });
    for (var i = 0; i < list.length; i++) {
      var c = list[i];
      if (c.room < o.d0) continue;                  // cannot fit there: no trial needed
      if (wantSide && c.side !== wantSide) continue;
      var dk = (c.u > u0 ? '+' : '-') + c.side, d = dirs[dk] || (dirs[dk] = { fitted: false, last: Infinity });
      var g2 = copyGame(game);
      place(g2, z, c.u, 2 * o.spotR);
      var t = trial(g2, c), E = t && t.rmin >= o.d0 ? t.E : Infinity;
      if (E < Infinity && (!best || E < best.E)) {
        best = { u: c.u, side: c.side, E: E, room: t.rmin, from: [game.spots[z].x, game.spots[z].y], to: [g2.spots[z].x, g2.spots[z].y] };
      }
      if (d.fitted && E > d.last + R.QUIET_E) break;   // past the first valley in this direction
      if (E < Infinity) d.fitted = true;
      d.last = E;
    }
    return best || { fail: true, best: est, bestU: estC ? estC.u : null, bestSide: estC ? estC.side : null };
  }

  /* ---------------- step 3: moving curves apart (v36) ----------------
     A move a → b that does not fit: the curves along its way are pushed apart.
     - The GHOST: the way the move would take if there were room — the planner's
       shortest path from the move's start at the clearance the widest way there
       actually has (route.js widest), so it goes through the narrowest place
       the move cannot avoid, and is as short as that allows.
     - The curves to move: those closer to the ghost than the minimum clearance
       d0 (the ghost counts only beyond ρ from a curve's own spots that are also
       the move's end spots: there the curves meet the ghost at the spot, and
       the angle between them is the ports' business).
     - Each moves as ONE C² spline (a move's two curves while its spot has only
       those — the spot rides along at its knot — otherwise one curve): its de
       Boor points relax under the band's energy with the ghost as an extra
       obstacle (relax.js createSplineBand); its ends and end directions stay.
       Where the ghost is near, pieces are first halved (knot insertion, the
       shape unchanged) for more freedom, down to twice the fitting's shortest
       piece.
     - Then the move itself is tried again (the caller's `trial`: planner and
       band). Rounds repeat — a new ghost through the widened place, the curves
       now too close to it — as long as the room on the widest way grows.
     - The position must stay the same: the engine's description (regions,
       boundaries, lives) is compared before and after (the invariant). */
  var D = root.SproutsDescribe || require('./describe.js');
  var E = root.SproutsEngine || require('./engine.js');
  var MIN_PIECE = 12;                             // the spline fit's shortest piece (ui.js fitClamped minPiece)

  /* The curves that move as one spline: [{edges, a, b, z}] (z = the spot riding on it, or -1). */
  function unitsOf(game) {
    var out = [], used = {};
    for (var e1 = 0; e1 + 1 < game.edges.length; e1 += 2) {
      var z = game.edges[e1].b, s = slidable(game, z);
      if (s && s.e1 === e1) { out.push({ edges: [e1, e1 + 1], a: game.edges[e1].a, b: game.edges[e1 + 1].b, z: z }); used[e1] = used[e1 + 1] = true; }
    }
    game.edges.forEach(function (e, i) { if (!used[i]) out.push({ edges: [i], a: e.a, b: e.b, z: -1 }); });
    return out;
  }
  function unitName(u) { return [u.a, u.z, u.b].filter(function (s) { return s >= 0; }).map(function (s) { return s + 1; }).join('-'); }
  function unitCurve(game, u) {
    var pieces = [], h = [];
    u.edges.forEach(function (i) { pieces = pieces.concat(game.edges[i].pieces); h = h.concat(game.edges[i].h); });
    return { pieces: pieces, h: h, split: game.edges[u.edges[0]].pieces.length };
  }
  function writeUnit(game, u, pieces, h, split) {
    if (u.edges.length === 1) { game.edges[u.edges[0]].pieces = pieces; game.edges[u.edges[0]].h = h; return; }
    var e1 = game.edges[u.edges[0]], e2 = game.edges[u.edges[1]];
    e1.pieces = pieces.slice(0, split); e1.h = h.slice(0, split);
    e2.pieces = pieces.slice(split); e2.h = h.slice(split);
    game.spots[u.z].x = pieces[split][0][0]; game.spots[u.z].y = pieces[split][0][1];
  }
  function positionKey(game) { return D.position(game, function () { return ''; }); }

  /* The ghost of the move from spot a (leaving from `start`) to spot b:
     { path, w, stubs, fits } or null (no way at all).
     - If the move can be planned at the minimum clearance, the ghost is the
       move itself, relaxed by the band (`trial`), even if it ends up closer
       than d0 to something: w = its clearance, fits = w ≥ d0. Its STUBS (spot →
       port, whose angle choosePort settled) are not part of it.
     - Otherwise the move planned at a lower clearance (lowerClearance, from the
       widest way's clearance w down — no way to b has more room than that) and
       relaxed by phase 1 of the band only (`trial` with {d0, phase1}: free
       ends, no ports — the ports are what fail at a small clearance near a
       crowded spot). Phase 1 ignores the curves at the end spots within ρ, so
       for those curves the ghost counts only beyond ρ from those spots.
     Either way the path is smooth and in the middle of whatever room there is;
     a grid path would print its steps into the curves pushed away from it.
     `trial(g, start, opt)` plans the move as the user asked for it — round
     the marked spots, if any (v37). */
  function ghostFor(game, a, start, b, o, trial) {
    var t = trial(game, start);
    if (t) return { path: t.pts.slice(1, t.pts.length - 1), w: t.rmin, stubs: true, fits: t.rmin >= o.d0, E: t.E, band: t.pts };
    var obs = R.buildObstacles(game, o.spotR), A = [game.spots[a].x, game.spots[a].y], B = [game.spots[b].x, game.spots[b].y];
    var ctx = { aIdx: a, bIdx: -1, A: A, B: A, rho: o.rho, spotR: o.spotR, scaleAll: true };
    var grid = Rt.buildGrid(obs, ctx, o.d0, game.W0, game.H0), ring = o.d0 + o.spotR + 1.5 * grid.cell;
    var wd = a === b ? null : Rt.widest(grid, obs, start, B, ring);
    var top = wd ? Math.min(wd.clearance, o.d0 / 2) : o.d0 / 2;
    if (wd && !(wd.clearance > R.MIN_START)) return null;
    var low = lowerClearance(function (d) { return trial(game, start, { d0: d, phase1: true }); }, top);
    if (!low) return null;
    return { path: low.t.pts, w: low.t.rmin, stubs: false, fits: false };
  }
  /* The largest of top, top/2, top/4, … (above the band's least starting
     clearance) at which trialAt(d) finds the move: { d, t } or null. Halving
     is a search schedule, not a threshold: it only decides how finely the
     available room is measured. */
  function lowerClearance(trialAt, top) {
    for (var d = top; d > R.MIN_START; d /= 2) {
      var t = trialAt(d);
      if (t) return { d: d, t: t };
    }
    return null;
  }
  /* The ghost as unit u sees it (a list of polylines): all of it, except, for a
     phase-1 ghost, within ρ of u's spots that are the move's end spots. */
  function ghostRuns(gh, game, u, a, b, rho) {
    if (gh.stubs) {
      /* the band ghost with its stubs (v40): near its end spots it is one more
         curve at that spot — tagged with them, so that a curve ending there
         measures it by angle (rObs's angle rule) and can turn its end away —
         except at a spot riding on u itself, where it would touch u: there the
         stub is left out (it starts at the port) */
      var pts = gh.band.slice(), s0 = a, s1 = b;
      if (u.z >= 0 && u.z === a) { pts.shift(); s0 = -1; }
      if (u.z >= 0 && u.z === b) { pts.pop(); s1 = -1; }
      return [{ pts: pts, s0: s0, s1: s1 }];
    }
    var ends = [u.a, u.b, u.z].filter(function (s) { return s >= 0 && (s === a || s === b); }).map(function (s) { return [game.spots[s].x, game.spots[s].y]; });
    var runs = [], cur = [];
    gh.path.forEach(function (p) {
      if (ends.some(function (e) { return G.dist(p, e) < rho; })) { if (cur.length > 1) runs.push(cur); cur = []; }
      else cur.push(p);
    });
    if (cur.length > 1) runs.push(cur);
    return runs;
  }
  /* What the ghost is closer to than d0, where it counts: { units: [{u, runs, d}],
     spot: {idx, d} | null, border: d | null }. A curve counts only away from its
     own end spots (beyond the stub length q = 3·d0 along it, the part a move of
     that curve can shift; its ends and end directions stay). A spot, or the edge
     of the drawing, cannot move: if the ghost passes one too closely, moving
     curves cannot make room there. */
  function inTheWay(g, gh, a, b, o) {
    var q = 3 * o.d0, out = { units: [], spot: null, border: null };
    unitsOf(g).forEach(function (u) {
      var runs = ghostRuns(gh, g, u, a, b, o.rho), c = unitCurve(g, u), pts = G.refinedPolygon(c.pieces, 0.5, 8).pts, S = [0];
      for (var i = 1; i < pts.length; i++) S.push(S[i - 1] + G.dist(pts[i], pts[i - 1]));
      var L = S[pts.length - 1], d = distToRuns(pts.filter(function (p, i) { return S[i] >= q && L - S[i] >= q; }), runs);
      if (d < o.d0) out.units.push({ u: u, runs: runs, d: d });
    });
    var all = ghostRuns(gh, g, { a: a, b: b, z: -1 }, a, b, o.rho);   // (a phase-1 ghost is trusted only beyond rho of its ends)
    g.spots.forEach(function (sp, i) {
      if (i === a || i === b) return;
      var d = distToRuns([[sp.x, sp.y]], all) - o.spotR;
      if (d < o.d0 && (!out.spot || d < out.spot.d)) out.spot = { idx: i, d: d };
    });
    all.forEach(function (r) { (r.pts || r).forEach(function (p) {
      var d = Math.min(p[0], p[1], g.W0 - p[0], g.H0 - p[1]);
      if (d < o.d0 && (out.border === null || d < out.border)) out.border = d;
    }); });
    out.units.sort(function (x, y) { return x.d - y.d; });
    return out;
  }
  /* The certified clearance of unit u from everything else in g (certify: refined
     control polygons; near u's own end spots by angle). */
  function certOf(g, u, o) {
    var g2 = copyGame(g);
    if (u.z >= 0) { g2.spots[u.z].x = -1e6; g2.spots[u.z].y = -1e6; }
    u.edges.slice().sort(function (x, y) { return y - x; }).forEach(function (i) { g2.edges.splice(i, 1); });
    var ctx = { aIdx: u.a, bIdx: u.b, A: [g.spots[u.a].x, g.spots[u.a].y], B: [g.spots[u.b].x, g.spots[u.b].y], rho: o.rho, spotR: o.spotR };
    return R.certify(R.buildObstacles(g2, o.spotR), ctx, unitCurve(g, u).pieces, 0.6 * o.d0).clearance;
  }
  function unitKey(u) { return u.edges.join(','); }
  /* FLOORS (v40): each curve's certified clearance may not fall below
     min(what it has at the start, 0.6·d0) — fixed once, at the start of making
     room or adjusting. Near a spot certify measures by angle from the curve's
     own points, so two curves ending at the same spots can measure each other
     differently; per-turn floors let that lopsidedness wear a curve down turn by
     turn (6-7 in the 20-05-56 game: 9.9 → 4.6 px once end directions could turn). */
  function floorsOf(g, o) {
    var f = {};
    unitsOf(g).forEach(function (u) { f[unitKey(u)] = Math.min(certOf(g, u, o), 0.6 * o.d0); });
    return f;
  }
  /* Would the new curve of u (in g2, already written) push a neighbour below its floor? */
  function breaksFloor(g2, u, floors, o) {
    if (!floors) return false;
    var mine = G.refinedPolygon(unitCurve(g2, u).pieces, 0.5, 8).pts;
    return unitsOf(g2).some(function (v) {
      if (unitKey(v) === unitKey(u) || floors[unitKey(v)] === undefined) return false;
      var theirs = G.refinedPolygon(unitCurve(g2, v).pieces, 0.5, 8).pts;
      if (distToRuns(theirs, [mine]) >= o.D) return false;
      return certOf(g2, v, o) < floors[unitKey(v)] - 1e-9;
    });
  }

  /* How far a curve's shape moved: the largest distance from an old sample to
     the new polyline near the same place (its two segments there). The same
     samples before and after (fixed parameters). */
  function shapeMoved(before, after) {
    var m = 0;
    for (var k = 1; k + 1 < before.length; k++) {
      m = Math.max(m, Math.min(G.distPointSeg(before[k], after[k - 1], after[k]), G.distPointSeg(before[k], after[k], after[k + 1])));
    }
    return m;
  }
  function distToRuns(pts, runs) {
    var best = Infinity;
    pts.forEach(function (p) { runs.forEach(function (r) { r = r.pts || r; for (var i = 1; i < r.length; i++) best = Math.min(best, G.distPointSeg(p, r[i - 1], r[i])); }); });
    return best;
  }

  /* Move unit u of `game` (in place) away from the ghost runs. Returns
     { moved (px), reached (d0 kept from the ghost), knots (inserted) } or null.
     The de Boor points free to move are those that move a piece near the ghost
     (its control polygon within the comfort distance D of it); each also moves
     up to three pieces on either side, over which the curve returns to its old
     course. The curve keeps its own pieces: its smoothness comes from having few
     of them, as when it was fitted — halving the pieces near the ghost (tried
     first, 9/23) let it kink where it returns to its old course. Knots are
     inserted (halving pieces: exact, the shape does not change) only while no
     de Boor point is free at all — a curve of one or two pieces. */
  /* Which end directions of unit u may turn (v48): not an end at the spot of
     the curve's own move — a move's two curves are one curve through its spot
     (Peter, 9/24), also once the spot has a third curve and the halves move
     one at a time. Edges come in move pairs 2m (x → z), 2m + 1 (z → y). */
  function freeEndsOf(game, u) {
    if (u.edges.length !== 1) return [true, true];
    var i = u.edges[0], j = i ^ 1, e = game.edges;
    if (!e[j]) return [true, true];
    return i % 2 === 0 ? [true, e[i].b !== e[j].a] : [e[i].a !== e[j].b, true];
  }
  function relaxUnit(game, u, runs, o, an, floors) {
    var c = unitCurve(game, u), pieces = c.pieces, h = c.h, split = c.split, knots = 0;
    function isNear(pc) { return distToRuns(pc, runs) < o.D; }   // (the control polygon holds the piece)
    var g2 = copyGame(game);
    if (u.z >= 0) { g2.spots[u.z].x = -1e6; g2.spots[u.z].y = -1e6; }
    u.edges.slice().sort(function (x, y) { return y - x; }).forEach(function (i) { g2.edges.splice(i, 1); });
    var certObs = R.buildObstacles(g2, o.spotR), obs = R.buildObstacles(g2, o.spotR, runs);
    var A = [game.spots[u.a].x, game.spots[u.a].y], B = [game.spots[u.b].x, game.spots[u.b].y];
    var ctx = { aIdx: u.a, bIdx: u.b, A: A, B: B, rho: o.rho, spotR: o.spotR }, sb = null;
    for (;;) {
      var near = [];
      pieces.forEach(function (pc, j) { if (isNear(pc)) near.push(j); });
      if (!near.length) return null;
      var opts = { obs: obs, certObs: certObs, ctx: ctx, curve: { pieces: pieces, h: h }, pieces: near, freeEnds: freeEndsOf(game, u),
                   params: { d0: o.d0, D: o.D, lambda: o.lambda }, q: 3 * o.d0, fd: o.fd,
                   certMin: floors && floors[unitKey(u)] !== undefined ? floors[unitKey(u)] : 0.6 * o.d0,
                   dead: an ? deadSides(game, u, an) : null };
      sb = R.createSplineBand(opts);
      if (sb || opts.fail !== 'free') break;
      var P = [], Hh = [], S = 0, more = false;
      pieces.forEach(function (pc, j) {
        if (near.indexOf(j) >= 0 && h[j] >= 2 * MIN_PIECE) {
          var two = G.splitPiece(pc, 0.5);
          P.push(two[0], two[1]); Hh.push(h[j] / 2, h[j] / 2); more = true; knots++;
        } else { P.push(pc); Hh.push(h[j]); }
        if (j < split) S = P.length;
      });
      if (!more) break;
      pieces = P; h = Hh; split = S;
    }
    if (!sb) return null;
    var before = sb.pts;
    R.iterateSpline(sb, 600);
    var moved = shapeMoved(before, sb.pts);
    if (!(moved > R.QUIET_MOVE)) return null;
    var g2 = copyGame(game);
    writeUnit(g2, u, R.splinePieces(sb), h, split);
    if (breaksFloor(g2, u, floors, o)) return null;
    writeUnit(game, u, R.splinePieces(sb), h, split);
    return { moved: moved, reached: sb.dh >= o.d0 - 1e-9, knots: knots, busy: sb.quiet < sb.iter };
  }

  /* Make room for a → b (leaving a from `start`) by moving curves. `trial(g, start)`
     is the real move in position g — { E, rmin } or null — as for sliding.
     Returns { game, start, moved: [{name, px}], rounds } or { fail, reason, best }. */
  function moveCurvesFor(game, a, start, b, trial, o) {
    var g = copyGame(game), key0 = positionKey(game), moved = {}, prevW = -Infinity, rounds = 0, best = -Infinity, floors = floorsOf(game, o);
    var A0 = [game.spots[a].x, game.spots[a].y], off = [start[0] - A0[0], start[1] - A0[1]];
    function startIn(gm) { return [gm.spots[a].x + off[0], gm.spots[a].y + off[1]]; }   // a may ride on a moved curve
    for (;;) {
      var gh = rounds === 0 && o.ghost0 ? o.ghost0 : ghostFor(g, a, startIn(g), b, o, trial);   // (o.ghost0: the caller has found it already)
      if (!gh) return { fail: true, reason: 'there is no way through at all', best: best };
      best = Math.max(best, gh.w);
      if (gh.fits) { if (rounds > 0) break; return { fail: true, reason: 'the move fits already', best: best }; }
      if (rounds > 0 && gh.w <= prevW + R.QUIET_MOVE) return { fail: true, reason: 'moving the curves stopped gaining room', best: best };
      prevW = gh.w;
      var way = inTheWay(g, gh, a, b, o), movers = way.units;
      if (way.spot) return { fail: true, reason: 'the way passes ' + Math.max(0, Math.round(way.spot.d)) + ' px from spot ' + (way.spot.idx + 1) + ', which cannot move',
                             brief: 'the way passes too close to spot ' + (way.spot.idx + 1) + ', which cannot move', best: best };
      if (way.border !== null) return { fail: true, reason: 'the way passes ' + Math.max(0, Math.round(way.border)) + ' px from the edge of the drawing',
                                        brief: 'the way passes too close to the edge of the drawing', best: best };
      if (!movers.length) return { fail: true, reason: 'the narrowest place is where curves meet at a spot', best: best };
      /* v40 (Peter, 9/24: "push the room making facility as far as we can"):
         not only the curves in the way move, but every curve within the comfort
         distance D of the ghost — sweep after sweep until all are quiet — so a
         curve pushed by the ghost can push its own neighbours in turn (17 → 1:
         20-1 had the strands of the loop 4-8 right behind it) */
      var any = false, an = E.analyse(g.spots, g.edges), sweep = 0, busy = true;
      var group = unitsOf(g).map(function (u) {
        var runs = ghostRuns(gh, g, u, a, b, o.rho);
        return { u: u, runs: runs, d: distToRuns(G.refinedPolygon(unitCurve(g, u).pieces, 0.5, 8).pts, runs) };
      }).filter(function (m) { return m.d < o.D; }).sort(function (x, y) { return x.d - y.d; });
      while (busy) {
        busy = false; sweep++;
        group.forEach(function (m) {
          var r = relaxUnit(g, m.u, m.runs, o, an, floors);
          if (!r) return;
          any = true;
          if (r.busy) busy = true;
          var nm = unitName(m.u);
          moved[nm] = (moved[nm] || 0) + r.moved;
        });
      }
      if (positionKey(g) !== key0) return { fail: true, reason: 'moving the curves would have changed the position (a bug: please save the game)', best: best };
      if (!any) return { fail: true, reason: 'the curves in the way cannot move', best: best };
      rounds++;
    }
    return { game: g, start: startIn(g), rounds: rounds, band: gh.band,   // (the move's band that fitted: the caller can start from it)
             moved: Object.keys(moved).map(function (nm) { return { name: nm, px: moved[nm] }; }) };
  }

  /* Which sides of unit u's curve (along R.normalAt, +, and against it, −) face
     a region with no move left: [plus, minus]. Read by the engine at a point
     1 px off the middle of the curve on each side. */
  function deadSides(g, u, an) {
    var c = unitCurve(g, u), pts = G.refinedPolygon(c.pieces, 0.25, 4).pts, k = Math.floor(pts.length / 2);
    if (k < 1 || k + 1 >= pts.length) return [false, false];
    var nrm = R.normalAt(pts, k, k), p = pts[k];
    return [1, -1].map(function (sg) { var r = an.regionAt([p[0] + sg * nrm[0], p[1] + sg * nrm[1]]); return !!r && !r.canMove; });
  }
  var api = { lowerClearance: lowerClearance, unitsOf: unitsOf, certOf: certOf, unitName: unitName, ghostFor: ghostFor, ghostRuns: ghostRuns, inTheWay: inTheWay, relaxUnit: relaxUnit, moveCurvesFor: moveCurvesFor, positionKey: positionKey,
              slidable: slidable, spline: spline, cut: cut, pointAt: pointAt, paramOf: paramOf, place: place,
              roomAlong: roomAlong, slideFor: slideFor,
              oneEdge: oneEdge, oriented: oriented, writeOriented: writeOriented, reverseCurve: reverseCurve,
              trimTo: trimTo, regionOfSpot: regionOfSpot };
  root.SproutsRoom = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : this);
