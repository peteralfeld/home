/* =========================================================================
   relax.js — obstacles, the clearance energy, and the elastic band that turns
   a user's stroke into a short, well-separated route. DOM-free (global
   SproutsRelax, or require()). Needs geom.js.

   The band minimises   E = ∫ (1 + λ φ(r)) ds   where r is the distance to the
   nearest obstacle and φ = ((D - dh)/(r - dh))²: equal to 1 at r = D, decaying
   like 1/r² beyond it and never quite zero, so a curve keeps drifting towards
   the middle of whatever room there is (Peter, 9/22: "leave as much space as
   possible"), and "infinite" at the barrier dh. The band is deformed
   continuously and can never pass through the barrier, so it stays in the
   homotopy class of the stroke it started from.
   ========================================================================= */
(function (root) {
  'use strict';
  var G = root.SproutsGeom || require('./geom.js');

  var CELL = 64;          // obstacle grid cell
  var RANGE = 4;          // a clearance query looks up to RANGE cells away; beyond that r = Infinity
  var BIG = 1e4;          // stands in for an infinite penalty
  var SELF_RATIO = 0.75;  // two parts of one curve repel if distance < SELF_RATIO * arc between them

  /* ---------------- obstacles ---------------- */

  function cellKey(cx, cy) { return (cx + 1024) * 4096 + (cy + 1024); }   // a number, not a string: Map lookups are hot

  /* scene: { W0, H0, spots: [{x,y}], edges: [{a, b, pieces}] }, spotR = drawn spot radius.
     Curves become refined control polygons: segments {a, b, eps, s0, s1} where the
     true curve is within eps of the segment chain and s0, s1 are the edge's end spots. */
  function buildObstacles(scene, spotR, extra) {
    var obs = { segs: [], spots: [], cells: new Map(), spotR: spotR };
    function cellList(cx, cy) {
      var key = cellKey(cx, cy), c = obs.cells.get(key);
      if (!c) { c = { segs: [], spots: [] }; obs.cells.set(key, c); }
      return c;
    }
    /* sa / sb: arc length along the curve from the segment to its end spots s0 / s1
       (phase 1 of the band ignores a curve's ends near the end spots by these) */
    function addSeg(a, b, eps, s0, s1, id, sa, sb) {
      var seg = { a: a, b: b, eps: eps, s0: s0, s1: s1, id: id, sa: sa, sb: sb,
                  x0: Math.min(a[0], b[0]), x1: Math.max(a[0], b[0]), y0: Math.min(a[1], b[1]), y1: Math.max(a[1], b[1]) };   // (its box: rObs skips it cheaply, v109)
      obs.segs.push(seg);
      var x0 = Math.floor(Math.min(a[0], b[0]) / CELL), x1 = Math.floor(Math.max(a[0], b[0]) / CELL);
      var y0 = Math.floor(Math.min(a[1], b[1]) / CELL), y1 = Math.floor(Math.max(a[1], b[1]) / CELL);
      for (var cx = x0; cx <= x1; cx++) for (var cy = y0; cy <= y1; cy++) cellList(cx, cy).segs.push(seg);
    }
    /* Every obstacle has an id — the four border sides, then each curve, then
       each spot — so that the penalty can be summed over DISTINCT obstacles
       (the distance to the nearest one alone has a kink midway between two
       obstacles, on which the band oscillated). */
    var W = scene.W0, H = scene.H0;
    addSeg([0, 0], [W, 0], 0, -1, -1, 0); addSeg([W, 0], [W, H], 0, -1, -1, 1);
    addSeg([W, H], [0, H], 0, -1, -1, 2); addSeg([0, H], [0, 0], 0, -1, -1, 3);
    scene.edges.forEach(function (e, ei) {
      var poly = G.refinedPolygon(e.pieces, 0.25, 16), pts = poly.pts, cum = [0], i;
      for (i = 1; i < pts.length; i++) cum.push(cum[i - 1] + G.dist(pts[i], pts[i - 1]));
      var L = cum[pts.length - 1];
      for (i = 1; i < pts.length; i++) addSeg(pts[i - 1], pts[i], poly.eps, e.a, e.b, 4 + ei, cum[i - 1], L - cum[i]);
    });
    scene.spots.forEach(function (s, idx) {
      var sp = { p: [s.x, s.y], idx: idx, id: 4 + scene.edges.length + idx };
      obs.spots.push(sp);
      cellList(Math.floor(s.x / CELL), Math.floor(s.y / CELL)).spots.push(sp);
    });
    /* extra: polylines that are obstacles too (making room, v36: the path a move
       that does not fit yet would take), with ids after the spots */
    var nx = 4 + scene.edges.length + scene.spots.length;
    (extra || []).forEach(function (pl, k) {       // a polyline, or { pts, s0, s1 }: the spots it ends at (for the angle rule there)
      var pts = pl.pts || pl, s0 = pl.pts ? pl.s0 : -1, s1 = pl.pts ? pl.s1 : -1;
      for (var i = 1; i < pts.length; i++) addSeg(pts[i - 1], pts[i], 0, s0, s1, nx + k, 0, 0);
    });
    obs.nIds = nx + (extra ? extra.length : 0);
    return obs;
  }

  /* ctx describes the curve being routed: { aIdx, bIdx, A, B, rho, spotR, scaleEnds?, scaleAll? }.
     Effective distance from p to the nearest obstacle. The end spots themselves
     are not obstacles. With scaleEnds, for curves that END at an end spot the
     distance is magnified by rho/|p - spot| inside radius rho, which turns the
     clearance requirement there into a requirement on the ANGLE between the
     curves (at angle theta the effective distance is about rho*sin(theta)).
     certify and the route planner use that; the band does not — its departure
     directions are fixed by ports (see createBand) and it works with plain
     distances, which keeps it well conditioned. */
  /* touched (with byId, v109): the ids byId holds a distance for, in the order met; only they are
     reset at the start (was byId.fill over every obstacle id, and the callers summed over all). */
  function rObs(obs, ctx, p, byId, byDir, touched) {
    var best = Infinity, fA = 1, fB = 1;
    if (touched) { for (var u = 0; u < touched.length; u++) byId[touched[u]] = Infinity; touched.length = 0; }
    else if (byId) byId.fill(Infinity);
    if (ctx.scaleEnds || ctx.scaleAll) {
      fA = Math.max(1, ctx.rho / (G.dist(p, ctx.A) || 1e-9));
      fB = Math.max(1, ctx.rho / (G.dist(p, ctx.B) || 1e-9));
    }
    var cx0 = Math.floor(p[0] / CELL), cy0 = Math.floor(p[1] / CELL);
    /* Rings of cells outward. Everything not yet looked at after ring k lies
       more than k*CELL away (and its effective distance is at least its real
       one), so once best <= k*CELL the search can stop. */
    for (var k = 1; k <= RANGE && best > (k - 1) * CELL; k++) {
      for (var cx = cx0 - k; cx <= cx0 + k; cx++) {
        for (var cy = cy0 - k; cy <= cy0 + k; cy++) {
          if (k > 1 && Math.abs(cx - cx0) < k && Math.abs(cy - cy0) < k) continue;   // inner rings are done
          var c = obs.cells.get(cellKey(cx, cy));
          if (!c) continue;
          for (var i = 0; i < c.segs.length; i++) {
            var s = c.segs[i];
            /* v109: the segment's box is at least lb from p, and the scale f below is ≥ 1: a segment that
               cannot come nearer than what is known already (best, and its obstacle's own least distance)
               changes nothing — skipped before the exact distance. The results are the same to the bit. */
            var bx = p[0] < s.x0 ? s.x0 - p[0] : p[0] > s.x1 ? p[0] - s.x1 : 0, by = p[1] < s.y0 ? s.y0 - p[1] : p[1] > s.y1 ? p[1] - s.y1 : 0;
            var lb = Math.sqrt(bx * bx + by * by) - s.eps;
            if (lb >= 0 && lb >= best && (!byId || lb >= byId[s.id])) continue;
            var d = G.distPointSeg(p, s.a, s.b) - s.eps, f = 1;
            if (ctx.skipEnds) {                   // phase 1: the curves at an end spot are ignored close to it
              /* "close to it" is measured ALONG the curve, and never more than 35 % of
                 its length from that end, so that a short curve — a small loop, whose
                 every point is within rho of its spots — keeps a visible middle;
                 otherwise the band settled flat on it (Peter's game, 9/22). */
              var lim = Math.min(ctx.rho, 0.35 * (s.sa + s.sb));
              if (G.dist(p, ctx.A) < ctx.rho && ((s.s0 === ctx.aIdx && s.sa < lim) || (s.s1 === ctx.aIdx && s.sb < lim))) continue;
              if (G.dist(p, ctx.B) < ctx.rho && ((s.s0 === ctx.bIdx && s.sa < lim) || (s.s1 === ctx.bIdx && s.sb < lim))) continue;
            }
            var fFrom = null;                     // the spot whose angle rule scales d (for the gradient)
            if (s.s0 === ctx.aIdx || s.s1 === ctx.aIdx) { f = fA; if (fA > 1) fFrom = ctx.A; }
            if ((s.s0 === ctx.bIdx || s.s1 === ctx.bIdx) && fB > f) { f = fB; fFrom = ctx.B; }
            var dRaw = d;
            if (ctx.scaleAll) {                   // the route planner: every spot's own curves count by angle near it
              if (s.s0 >= 0) f = Math.max(f, ctx.rho / (G.dist(p, obs.spots[s.s0].p) || 1e-9));
              if (s.s1 >= 0) f = Math.max(f, ctx.rho / (G.dist(p, obs.spots[s.s1].p) || 1e-9));
            }
            d *= f;
            if (d < best) best = d;
            if (byId && d < byId[s.id]) {
              if (touched && byId[s.id] === Infinity) touched.push(s.id);
              byId[s.id] = d;
              if (byDir) {                          // the gradient of this distance: from the nearest point of the segment towards p
                var vx = s.b[0] - s.a[0], vy = s.b[1] - s.a[1], wx = p[0] - s.a[0], wy = p[1] - s.a[1], vv = vx * vx + vy * vy;
                var tt = vv > 0 ? (wx * vx + wy * vy) / vv : 0; tt = tt < 0 ? 0 : tt > 1 ? 1 : tt;
                var ex = wx - tt * vx, ey = wy - tt * vy, el = Math.sqrt(ex * ex + ey * ey) || 1e-9;
                byDir[2 * s.id] = f * ex / el; byDir[2 * s.id + 1] = f * ey / el;
                if (fFrom && !ctx.scaleAll) {          // + d ∇f, f = ρ / |p - spot|
                  var qx = p[0] - fFrom[0], qy = p[1] - fFrom[1], q2 = qx * qx + qy * qy, q3 = q2 * Math.sqrt(q2) || 1e-9;
                  byDir[2 * s.id] -= dRaw * ctx.rho * qx / q3; byDir[2 * s.id + 1] -= dRaw * ctx.rho * qy / q3;
                }
              }
            }
          }
          for (i = 0; i < c.spots.length; i++) {
            var sp = c.spots[i];
            if (sp.idx === ctx.aIdx || sp.idx === ctx.bIdx) continue;
            var ds = G.dist(p, sp.p) - obs.spotR;
            if (ds < best) best = ds;
            if (byId && ds < byId[sp.id]) {
              if (touched && byId[sp.id] === Infinity) touched.push(sp.id);
              byId[sp.id] = ds;
              if (byDir) { var dl = ds + obs.spotR || 1e-9; byDir[2 * sp.id] = (p[0] - sp.p[0]) / dl; byDir[2 * sp.id + 1] = (p[1] - sp.p[1]) / dl; }
            }
          }
        }
      }
    }
    return best;
  }

  /* Does segment ab properly cross any obstacle segment? */
  function crossesObstacle(obs, a, b) {
    var x0 = Math.floor(Math.min(a[0], b[0]) / CELL), x1 = Math.floor(Math.max(a[0], b[0]) / CELL);
    var y0 = Math.floor(Math.min(a[1], b[1]) / CELL), y1 = Math.floor(Math.max(a[1], b[1]) / CELL);
    for (var cx = x0; cx <= x1; cx++) {
      for (var cy = y0; cy <= y1; cy++) {
        var c = obs.cells.get(cellKey(cx, cy));
        if (!c) continue;
        for (var i = 0; i < c.segs.length; i++) if (G.segCross(a, b, c.segs[i].a, c.segs[i].b)) return true;
      }
    }
    return false;
  }

  function polylineCrossesObstacle(obs, pts) {
    for (var i = 1; i < pts.length; i++) if (crossesObstacle(obs, pts[i - 1], pts[i])) return true;
    return false;
  }

  function polylineCrossesItself(pts) {
    for (var i = 1; i < pts.length; i++) {
      for (var j = i + 2; j < pts.length; j++) {
        if (G.segCross(pts[i - 1], pts[i], pts[j - 1], pts[j])) return true;
      }
    }
    return false;
  }

  /* ---------------- self-distance of a polyline ---------------- */

  function arcs(pts) {
    var S = new Float64Array(pts.length);
    for (var i = 1; i < pts.length; i++) S[i] = S[i - 1] + G.dist(pts[i], pts[i - 1]);
    return S;
  }

  /* Distance from p (at arc position s on the polyline) to the parts of the
     polyline that are far from it ALONG the curve but near it in the plane. */
  /* The cells (as for obstacles) each segment j (pts[j-1] → pts[j]) of a
     polyline touches, kept on the array itself. A point moved in place (a
     finite difference, a fraction of a pixel) leaves it good enough: it only
     says which segments to look at, their distances are measured afresh. */
  function selfIndex(pts) {
    if (pts._cells && pts._cells.n === pts.length) return pts._cells.map;
    var map = new Map();
    for (var j = 1; j < pts.length; j++) {
      var a = pts[j - 1], b = pts[j];
      var x0 = Math.floor(Math.min(a[0], b[0]) / CELL), x1 = Math.floor(Math.max(a[0], b[0]) / CELL);
      var y0 = Math.floor(Math.min(a[1], b[1]) / CELL), y1 = Math.floor(Math.max(a[1], b[1]) / CELL);
      for (var cx = x0; cx <= x1; cx++) for (var cy = y0; cy <= y1; cy++) {
        var key = cellKey(cx, cy), l = map.get(key);
        if (!l) map.set(key, l = []);
        l.push(j);
      }
    }
    Object.defineProperty(pts, '_cells', { value: { n: pts.length, map: map }, enumerable: false, configurable: true, writable: true });
    return map;
  }
  function rSelf(ctx, pts, S, p, s, dir) {
    var best = Infinity, loop = ctx.aIdx === ctx.bIdx, bj = -1;
    /* the two legs of a loop meet at its spot: there their separation is an
       angle, not a distance (phase 1 and certify; with ports it is not needed) */
    var legScale = loop && (ctx.scaleEnds || ctx.skipEnds) ? Math.max(1, ctx.rho / (G.dist(p, ctx.A) || 1e-9)) : 1;
    /* The polyline's own segments are looked up in its cell index, ring by ring
       outwards, with the obstacles' horizon (RANGE cells) — before v37 every
       query scanned the whole polyline, so a long band cost O(n²) per step
       (Peter's game of 9/24: 50 s to make room for a long loop). A segment
       spanning several cells is met more than once; that is harmless. */
    var idx = selfIndex(pts), cx0 = Math.floor(p[0] / CELL), cy0 = Math.floor(p[1] / CELL);
    for (var k = 1; k <= RANGE && best > (k - 1) * CELL; k++) {
      for (var cx = cx0 - k; cx <= cx0 + k; cx++) {
        for (var cy = cy0 - k; cy <= cy0 + k; cy++) {
          if (k > 1 && Math.abs(cx - cx0) < k && Math.abs(cy - cy0) < k) continue;
          var list = idx.get(cellKey(cx, cy));
          if (!list) continue;
          for (var t = 0; t < list.length; t++) {
            var j = list[t];
            var sigma = s < S[j - 1] ? S[j - 1] - s : s > S[j] ? s - S[j] : 0;
            if (sigma === 0) continue;
            /* cheap rejection first: the segment is at least max(|dx|,|dy|) minus its
               own length away from p */
            var q = pts[j], dx = q[0] - p[0], dy = q[1] - p[1];
            if (dx < 0) dx = -dx;
            if (dy < 0) dy = -dy;
            if ((dx > dy ? dx : dy) - (S[j] - S[j - 1]) >= SELF_RATIO * sigma) continue;
            if (best < Infinity) {                  // v109: its box no nearer than the best so far (legScale ≥ 1): no change
              var o0 = pts[j - 1], bx = p[0] - (o0[0] > q[0] ? o0[0] : q[0]), by = p[1] - (o0[1] > q[1] ? o0[1] : q[1]);
              var ax = (o0[0] < q[0] ? o0[0] : q[0]) - p[0], ay = (o0[1] < q[1] ? o0[1] : q[1]) - p[1];
              bx = bx > ax ? bx : ax; by = by > ay ? by : ay;
              if (bx < 0) bx = 0;
              if (by < 0) by = 0;
              if (Math.sqrt(bx * bx + by * by) * legScale >= best) continue;
            }
            var d = G.distPointSeg(p, pts[j - 1], pts[j]) * legScale;
            if (d >= SELF_RATIO * sigma) continue;
            if (d < best) { best = d; bj = j; }
          }
        }
      }
    }
    /* The curve's own end spots are not in the obstacle list, but the curve must
       not come back to them later on. This is also what keeps a loop around
       nothing from shrinking to a point. */
    var total = S[pts.length - 1];
    var dA = G.dist(p, ctx.A), dB = G.dist(p, ctx.B), from = null;
    if (loop) {                                   // the middle half of a loop keeps clear of its spot
      if (s > 0.25 * total && s < 0.75 * total && dA - ctx.spotR < best) { best = dA - ctx.spotR; from = ctx.A; }
    } else {
      if (dA < SELF_RATIO * s && dA - ctx.spotR < best) { best = dA - ctx.spotR; from = ctx.A; }
      if (dB < SELF_RATIO * (total - s) && dB - ctx.spotR < best) { best = dB - ctx.spotR; from = ctx.B; }
    }
    if (dir && best < Infinity) {                 // the gradient of best (with the other points held: as the finite differences had it)
      var qx, qy;
      if (from) { qx = from[0]; qy = from[1]; }
      else {
        var a = pts[bj - 1], b = pts[bj], vx = b[0] - a[0], vy = b[1] - a[1], vv = vx * vx + vy * vy;
        var tt = vv > 0 ? ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / vv : 0; tt = tt < 0 ? 0 : tt > 1 ? 1 : tt;
        qx = a[0] + tt * vx; qy = a[1] + tt * vy;
      }
      var ex = p[0] - qx, ey = p[1] - qy, el = Math.sqrt(ex * ex + ey * ey) || 1e-9;
      dir[0] = ex / el; dir[1] = ey / el;
      if (!from && legScale > 1) {                  // best = legScale · d with legScale = ρ / |p - A|
        var ax = p[0] - ctx.A[0], ay = p[1] - ctx.A[1], a2 = ax * ax + ay * ay, a3 = a2 * Math.sqrt(a2) || 1e-9;
        dir[0] = legScale * dir[0] - el * ctx.rho * ax / a3; dir[1] = legScale * dir[1] - el * ctx.rho * ay / a3;
      }
    }
    return best;
  }

  /* ---------------- the band ---------------- */

  /* pts: initial polyline from A to B (already known to cross nothing).
     fixedA / fixedB: true if pts[1] / pts[n-1] is a fixed PORT — a point a
     little way out from the spot in the direction the curve is to leave it.
     The stub spot→port is then part of the curve but not of the relaxation,
     and its clearance from the curves already at that spot (which it converges
     with) is not measured: the caller chose the port angle.
     params: { d0, D, lambda }. Returns null if the polyline has no clearance at all. */
  var MIN_START = 1;   // the least clearance a band can start from (px); route.js keeps its walks this far off too
  function createBand(obs, ctx, pts, fixedA, fixedB, params) {
    var band = {
      obs: obs, ctx: ctx, params: params, h: 8, mu: 1e-6, scratch: new Float64Array(obs.nIds), scratchDir: new Float64Array(2 * obs.nIds),
      fixedA: fixedA, fixedB: fixedB, pts: pts, dh: 0, iter: 0, quiet: 0, done: false, state: null
    };
    band.pts = respace(band);
    var st = evaluate(band, band.pts, 0);
    if (!(st.rmin > MIN_START)) return null;
    band.dh = Math.min(params.d0, 0.7 * st.rmin);
    band.state = evaluate(band, band.pts, band.dh);
    return band;
  }

  function freeRange(band, pts) {
    return { lo: band.fixedA ? 2 : 1, hi: pts.length - (band.fixedB ? 3 : 2) };
  }

  /* Re-space the free part of the band evenly (the fixed points stay). */
  function respace(band) {
    var pts = band.pts, n = pts.length - 1;
    var i0 = band.fixedA ? 1 : 0, i1 = band.fixedB ? n - 1 : n;
    var mid = G.resample(pts.slice(i0, i1 + 1), band.h);
    return pts.slice(0, i0).concat(mid, pts.slice(i1 + 1));
  }
  /* Re-space the band. Re-spacing changes E a little (the self-distance gates
     move with the points), so a mild unevenness is corrected only when that
     does not raise E; a bad one (points piling up on an end spot, where the
     self-distance becomes meaningless) is corrected regardless. */
  function applyRespace(band) {
    var pts = band.pts, worst = 1;
    for (var i = 1; i < pts.length; i++) {
      var q = G.dist(pts[i], pts[i - 1]) / band.h;
      worst = Math.max(worst, q, q > 0 ? 1 / q : Infinity);
    }
    if (worst < 1.15) return;
    var cand = respace(band);
    if (polylineCrossesObstacle(band.obs, cand)) return;
    var st = evaluate(band, cand, band.dh);
    if (st.rmin <= band.dh) return;
    if (worst < 2 && st.E > band.state.E) return;
    band.pts = cand; band.state = st;
  }

  function pen(r, D, dh) {
    if (r <= dh) return BIG;
    var q = (D - dh) / (r - dh);
    return Math.min(BIG, q * q);
  }

  /* Clearance of point p (at arc position s on pts): the smallest distance to
     anything, and the penalty summed over every obstacle within reach and
     over the band's own far parts. Uses band.scratch for the per-id distances. */
  /* As clearance, and the gradient of φ with respect to p (g: [x, y]), from the
     directions to the nearest point of each obstacle (v38: the spline band's
     exact gradient; the finite differences cost 12 clearances a point). */
  function pen1(r, D, dh) {                       // dφ/dr (0 where φ is capped)
    if (r <= dh) return 0;
    var q = (D - dh) / (r - dh);
    return q * q >= BIG ? 0 : -2 * q * q / (r - dh);
  }
  /* band.dead = [plus, minus] (the spline band, v38): the region on that side
     of the curve has no move left, so no curve will ever come into it — an
     obstacle on that side (seen along nrm, the curve's normal there) keeps the
     hard barrier but adds no crowding penalty: the room is worth nothing there. */
  function byNumber(x, y) { return x - y; }
  /* The list of ids band.scratch holds distances for (v109); the first time, every entry is emptied. */
  function touchedOf(band) {
    if (!band.touched) { band.touched = []; band.scratch.fill(Infinity); }
    return band.touched;
  }
  function clearanceGrad(band, pts, S, p, s, dh, g, nrm) {
    var byId = band.scratch, byDir = band.scratchDir, D = band.params.D, sd = [0, 0], dead = nrm && band.dead, ids = touchedOf(band);
    var r = rObs(band.obs, band.ctx, p, byId, byDir, ids), rs = rSelf(band.ctx, pts, S, p, s, sd);
    if (rs < r) r = rs;
    g[0] = 0; g[1] = 0;
    if (r <= dh) return { r: r, phi: BIG };
    function wasted(dx, dy) {                     // (dx, dy) points from the obstacle to p
      var side = -(dx * nrm[0] + dy * nrm[1]);
      return side > 0 ? dead[0] : side < 0 ? dead[1] : false;
    }
    var Ds = band.ctx.aIdx === band.ctx.bIdx ? 2 * D : D;
    var phi = 0, d1;
    if (rs < Infinity && !(dead && wasted(sd[0], sd[1]))) { phi += pen(rs, Ds, dh); d1 = pen1(rs, Ds, dh); g[0] += d1 * sd[0]; g[1] += d1 * sd[1]; }
    ids.sort(byNumber);                            // (in the order of the ids, as the sum over every id had it)
    for (var t = 0; t < ids.length; t++) {
      var i = ids[t];
      if (dead && wasted(byDir[2 * i], byDir[2 * i + 1])) continue;
      phi += pen(byId[i], D, dh); d1 = pen1(byId[i], D, dh); g[0] += d1 * byDir[2 * i]; g[1] += d1 * byDir[2 * i + 1];
    }
    if (phi >= BIG) { g[0] = 0; g[1] = 0; }
    return { r: r, phi: Math.min(BIG, phi) };
  }
  function clearance(band, pts, S, p, s, dh) {
    var byId = band.scratch, D = band.params.D, ids = touchedOf(band);
    var r = rObs(band.obs, band.ctx, p, byId, null, ids), rs = rSelf(band.ctx, pts, S, p, s);
    if (rs < r) r = rs;
    if (r <= dh) return { r: r, phi: BIG };
    /* A loop's two sides are its own region's whole boundary, and a move can
       still be made inside it (its spot and the new spot both have a life):
       they want 2 D between them, so that a curve inside has D on each side. */
    var Ds = band.ctx.aIdx === band.ctx.bIdx ? 2 * D : D;
    var phi = rs < Infinity ? pen(rs, Ds, dh) : 0;
    ids.sort(byNumber);
    for (var t = 0; t < ids.length; t++) phi += pen(byId[ids[t]], D, dh);
    return { r: r, phi: Math.min(BIG, phi) };
  }

  /* Clearance r and penalty φ at every interior point and every segment
     midpoint, the energy E, and the smallest clearance rmin. */
  function evaluate(band, pts, dh) {
    var n = pts.length - 1, S = arcs(pts), lam = band.params.lambda;
    var phiP = new Float64Array(n + 1), phiM = new Float64Array(n), rP = new Float64Array(n + 1);
    var gP = new Float64Array(2 * (n + 1)), gM = new Float64Array(2 * n), g = [0, 0];   // dφ/dp (v38: the exact gradient, see step)
    var rmin = Infinity, E = 0, k;
    var k0 = band.fixedA ? 1 : 0, k1 = band.fixedB ? n - 1 : n;   // the fixed stubs are left out
    for (k = k0 + 1; k < k1; k++) {
      var c = clearanceGrad(band, pts, S, pts[k], S[k], dh, g);
      if (c.r < rmin) rmin = c.r;
      rP[k] = c.r;
      phiP[k] = c.phi; gP[2 * k] = g[0]; gP[2 * k + 1] = g[1];
    }
    for (k = k0; k < k1; k++) {
      var m = [(pts[k][0] + pts[k + 1][0]) / 2, (pts[k][1] + pts[k + 1][1]) / 2];
      c = clearanceGrad(band, pts, S, m, (S[k] + S[k + 1]) / 2, dh, g);
      if (c.r < rmin) rmin = c.r;
      phiM[k] = c.phi; gM[2 * k] = g[0]; gM[2 * k + 1] = g[1];
      E += (S[k + 1] - S[k]) * (1 + lam * (phiP[k] + 4 * phiM[k] + phiP[k + 1]) / 6);
    }
    return { S: S, phiP: phiP, phiM: phiM, rP: rP, rmin: rmin, E: E, gP: gP, gM: gM };
  }

  /* Energy of the two segments meeting at point k, with point k moved to p:
     returns [length part, penalty part] so the two can be told apart. */
  function localEnergy(band, st, k, p) {
    var pts = band.pts, lam = band.params.lambda, dh = band.dh;
    function phi(q, s) { return clearance(band, pts, st.S, q, s, dh).phi; }
    var a = pts[k - 1], b = pts[k + 1];
    var m1 = [(a[0] + p[0]) / 2, (a[1] + p[1]) / 2], m2 = [(p[0] + b[0]) / 2, (p[1] + b[1]) / 2];
    var old = pts[k];
    pts[k] = p;                                   // the self-distance must see the moved point too
    var fk = phi(p, st.S[k]);
    var f1 = phi(m1, (st.S[k - 1] + st.S[k]) / 2), f2 = phi(m2, (st.S[k] + st.S[k + 1]) / 2);
    pts[k] = old;
    var l1 = G.dist(a, p), l2 = G.dist(p, b);
    return [l1 + l2, lam * (l1 * (st.phiP[k - 1] + 4 * f1 + fk) + l2 * (fk + 4 * f2 + st.phiP[k + 1])) / 6];
  }

  /* One descent step. The gradient is preconditioned with the stiffness matrix
     of the length term (an H1 gradient), which makes the step for pure length a
     Newton step: a free band straightens in a few iterations instead of
     diffusing. Returns the largest displacement made. */
  function step(band) {
    var pts = band.pts, st = band.state, fr = freeRange(band, pts), lo = fr.lo, hi = fr.hi;
    var nf = hi - lo + 1, k, i, delta = 0.05;
    if (nf < 1) { band.done = true; return 0; }

    var gx = new Array(nf), gy = new Array(nf), lam0 = band.params.lambda, S0 = st.S;
    function wSeg(j) { return 1 + lam0 * (st.phiP[j] + 4 * st.phiM[j] + st.phiP[j + 1]) / 6; }
    for (k = lo; k <= hi; k++) {
      var p = pts[k];
      if (band.fd) {
        /* central differences: a one-sided difference of a length has a bias of
           delta/h, larger than the true gradient of a nearly straight band */
        var ex1 = localEnergy(band, st, k, [p[0] + delta, p[1]]), ex0 = localEnergy(band, st, k, [p[0] - delta, p[1]]);
        var ey1 = localEnergy(band, st, k, [p[0], p[1] + delta]), ey0 = localEnergy(band, st, k, [p[0], p[1] - delta]);
        gx[k - lo] = (ex1[0] + ex1[1] - ex0[0] - ex0[1]) / (2 * delta);
        gy[k - lo] = (ey1[0] + ey1[1] - ey0[0] - ey0[1]) / (2 * delta);
        continue;
      }
      /* v38: the exact gradient — the two segments' lengths (weighted by 1 + λ φ
         on them) and λ/6 × length × (φ at the point + 2 × φ at each adjacent
         midpoint, which moves half as far), from the directions evaluate
         recorded; the finite differences above cost 12 clearance queries a
         point (Peter's marked loop of 9/24 took 20 s, mostly this) */
      var a = pts[k - 1], b = pts[k + 1], la = G.dist(p, a) || 1e-9, lb = G.dist(p, b) || 1e-9, wa = wSeg(k - 1), wb = wSeg(k);
      var L1 = S0[k] - S0[k - 1], L2 = S0[k + 1] - S0[k];
      gx[k - lo] = wa * (p[0] - a[0]) / la + wb * (p[0] - b[0]) / lb + lam0 / 6 * (L1 * (st.gP[2 * k] + 2 * st.gM[2 * (k - 1)]) + L2 * (st.gP[2 * k] + 2 * st.gM[2 * k]));
      gy[k - lo] = wa * (p[1] - a[1]) / la + wb * (p[1] - b[1]) / lb + lam0 / 6 * (L1 * (st.gP[2 * k + 1] + 2 * st.gM[2 * (k - 1) + 1]) + L2 * (st.gP[2 * k + 1] + 2 * st.gM[2 * k + 1]));
    }

    /* Preconditioner = the Hessian of E = ∫(1 + λφ) ds for displacements
       across the band: the Laplacian weighted by (1 + λφ) — the length term's
       stiffness, raised where the band is already paying a penalty — plus the
       penalty's own curvature λ h φ''(r) on the diagonal. The latter is taken
       from the formula, not from finite differences: a difference of the
       penalty PART of the energy also picks up φ times the length's curvature,
       which, put on the diagonal alone, screened the Laplacian and made the
       Newton step local and tiny (a long curve then crept 0.5 px per step). */
    var lam = band.params.lambda, Dd = band.params.D - band.dh, h = band.h;
    var sub = new Array(nf).fill(0), sup = new Array(nf).fill(0), dia = new Array(nf);
    for (i = 0; i < nf; i++) {
      k = lo + i;
      var wl = (1 + lam * (st.phiP[k - 1] + st.phiP[k]) / 2) / h, wr = (1 + lam * (st.phiP[k] + st.phiP[k + 1]) / 2) / h;
      var gap = st.rP[k] - band.dh, phi2 = gap > 1e-6 ? 6 * Dd * Dd / (gap * gap * gap * gap) : BIG;
      dia[i] = wl + wr + band.mu + lam * h * Math.min(BIG, phi2);
      if (i > 0) sub[i] = -wl;
      if (i + 1 < nf) sup[i] = -wr;
    }
    var directions = [
      [solveTri(sub, dia, sup, gx.map(neg)), solveTri(sub, dia, sup, gy.map(neg))],
      [gx.map(function (g) { return -g * band.h / 4; }), gy.map(function (g) { return -g * band.h / 4; })]
    ];
    function neg(g) { return -g; }
    /* Only the component ACROSS the band moves its shape. The component along
       it merely slides points, which the quadrature rewards where the penalty
       is low and re-spacing then undoes — an endless cycle near a port. */
    directions.forEach(function (dir) {
      for (var i = 0; i < nf; i++) {
        var a = pts[lo + i - 1], b = pts[lo + i + 1], tx = b[0] - a[0], ty = b[1] - a[1], tl = Math.sqrt(tx * tx + ty * ty) || 1;
        tx /= tl; ty /= tl;
        var along = dir[0][i] * tx + dir[1][i] * ty;
        dir[0][i] -= along * tx; dir[1][i] -= along * ty;
      }
    });

    for (var d = 0; d < directions.length; d++) {
      var vx = directions[d][0], vy = directions[d][1];
      /* Scale the whole direction so the largest move is 16 px — uniformly, so
         its shape survives (capping point by point distorted the Newton step
         of a long band into something the line search had to reject) — then
         cap each point at half its distance to the barrier so nothing is
         jumped over. */
      var ux = new Array(nf), uy = new Array(nf), reach = 0, longest = 0;
      for (i = 0; i < nf; i++) longest = Math.max(longest, Math.hypot(vx[i], vy[i]));
      var uniform = longest > 16 ? 16 / longest : 1;
      for (i = 0; i < nf; i++) {
        var len = Math.hypot(vx[i], vy[i]) * uniform;
        var cap = Math.max(0.25, 0.5 * (st.rP[lo + i] - band.dh));
        var sc = uniform * (len > cap ? cap / len : 1);
        ux[i] = vx[i] * sc; uy[i] = vy[i] * sc;
        reach = Math.max(reach, Math.min(len, cap));
      }
      for (var t = 1; t > 0.001; t /= 2) {
        var cand = pts.slice();
        for (i = 0; i < nf; i++) cand[lo + i] = [pts[lo + i][0] + ux[i] * t, pts[lo + i][1] + uy[i] * t];
        var ns = evaluate(band, cand, band.dh);
        if (ns.rmin > band.dh && ns.E < st.E - 1e-9 && !polylineCrossesObstacle(band.obs, cand) && !polylineCrossesItself(cand)) {
          var moved = shapeChange(pts, cand, lo, hi);
          band.pts = cand; band.state = ns;
          return moved;
        }
      }
    }
    return 0;
  }

  /* How far the band's SHAPE moved: the largest distance from a new point to
     the old polyline near it. Points sliding along the curve do not count —
     they change the self-distance gates and so the energy, and would otherwise
     keep a converged band "moving" forever. */
  function shapeChange(pts, cand, lo, hi) {
    var worst = 0;
    for (var k = lo; k <= hi; k++) {
      var best = Infinity;
      for (var j = Math.max(1, k - 3); j <= Math.min(pts.length - 1, k + 3); j++) {
        var d = G.distPointSeg(cand[k], pts[j - 1], pts[j]);
        if (d < best) best = d;
      }
      if (best > worst) worst = best;
    }
    return worst;
  }

  function solveTri(sub, dia, sup, rhs) {
    var n = dia.length, c = new Array(n), d = new Array(n), x = new Array(n), i;
    c[0] = sup[0] / dia[0]; d[0] = rhs[0] / dia[0];
    for (i = 1; i < n; i++) {
      var den = dia[i] - sub[i] * c[i - 1];
      c[i] = sup[i] / den; d[i] = (rhs[i] - sub[i] * d[i - 1]) / den;
    }
    x[n - 1] = d[n - 1];
    for (i = n - 2; i >= 0; i--) x[i] = d[i] - c[i] * x[i + 1];
    return x;
  }

  /* Run up to `count` iterations. After every step the band is re-spaced if
     its legs have become uneven (a shrinking band otherwise piles its points
     onto the end spots, where the self-distance becomes meaningless) and the hard clearance dh is raised
     towards d0 (continuation: a stroke drawn closer than d0 to something
     starts with a smaller barrier). */
  var QUIET_MOVE = 0.05;   // px: a step that moves the band less than this …
  var QUIET_E = 0.01;      // … AND lowers its energy by less than this is "quiet" (v96; before: or)
  function iterate(band, count) {
    for (var c = 0; c < count && !band.done; c++) {
      var before = band.state.E, moved = step(band);
      band.iter++;
      var small = moved < QUIET_MOVE && before - band.state.E < QUIET_E;   // (v96, Peter: BOTH small — a step that moved the shape little but still lowered E a lot stopped the band with a kink in it)
      /* quiet: a small step that did not raise the barrier either — as the spline band has it
         (v109). v8–v108 counted a step as quiet below d0 only if it moved nothing at all, so a band
         in a place too tight for d0 (0.7 · its least clearance < d0: the barrier cannot rise) never
         settled and ran to the caps, 80 + 600 iterations — every trial of a move that does not fit
         yet, when room is being made (Peter's game of 9/29, move 24: 9.5 of 31 s in one trial). */
      applyRespace(band);
      var dh = Math.max(band.dh, Math.min(band.params.d0, 0.7 * band.state.rmin)), raised = dh > band.dh + 1e-6;
      if (raised) { band.dh = dh; band.state = evaluate(band, band.pts, dh); }
      band.quiet = small && !raised ? band.quiet + 1 : 0;
      if (band.quiet >= 3 || band.iter >= 600) band.done = true;
    }
    return band.done;
  }

  /* ---------------- the two-phase route ----------------

     Phase 1 relaxes the polyline with free ends, ignoring the curves at each
     end spot within rho of it, so the band settles into its global shape
     without the (ill-conditioned) departure-angle problem. Phase 2 then fixes
     a port at each end — the caller's choosePorts(rawA, rawB) turns the
     phase-1 departure directions into {portA: {dir, q}, portB} by whatever
     rule it likes, or returns a string to refuse — and relaxes between the
     ports with plain distances. The result's dirA / dirB are the clamped end
     directions for the spline fit. */
  function createRoute(obs, ctx, P, params, choosePorts) {
    var ctx1 = Object.assign({}, ctx, { skipEnds: true });
    var band = createBand(obs, ctx1, P, false, false, params);
    if (!band) return null;
    return { phase: 1, band: band, obs: obs, ctx: ctx, params: params, choosePorts: choosePorts,
             pts: band.pts, state: band.state, iter: 0, done: false, error: null, dirA: null, dirB: null };
  }

  var PHASE1_MAX = 80;

  function rawDirection(pts, spot, reach) {
    var s = 0, k = 1;
    while (k + 1 < pts.length && s < reach) { s += G.dist(pts[k], pts[k - 1]); k++; }
    var v = [pts[k][0] - spot[0], pts[k][1] - spot[1]], len = Math.sqrt(v[0] * v[0] + v[1] * v[1]) || 1;
    return [v[0] / len, v[1] / len];
  }

  /* Run up to `count` steps; returns true when the route is finished (or has failed: see .error). */
  function advance(rt, count) {
    while (count > 0 && !rt.done) {
      var b = rt.band, before = b.iter;
      iterate(b, rt.phase === 1 ? Math.min(count, PHASE1_MAX - b.iter) : count);
      count -= b.iter - before;
      rt.iter += b.iter - before;
      rt.pts = b.pts; rt.state = b.state;
      if (!b.done && b.iter < PHASE1_MAX) continue;
      if (rt.phase === 2) { rt.done = true; break; }
      /* phase 1 finished: place the ports and start phase 2 from this shape */
      var A = rt.ctx.A, B = rt.ctx.B, q0 = 3 * rt.params.d0;
      var ports = rt.choosePorts(rawDirection(b.pts, A, q0), rawDirection(b.pts.slice().reverse(), B, q0));
      if (typeof ports === 'string') { rt.error = ports; rt.done = true; break; }
      var pa = ports.portA, pb = ports.portB, L = G.polylineLength(b.pts);
      if (pa.q + pb.q > 0.8 * L) {                // a short route: the ports must not overlap
        var shrink = 0.8 * L / (pa.q + pb.q);
        pa = { dir: pa.dir, q: pa.q * shrink }; pb = { dir: pb.dir, q: pb.q * shrink };
      }
      var qa = [A[0] + pa.q * pa.dir[0], A[1] + pa.q * pa.dir[1]], qb = [B[0] + pb.q * pb.dir[0], B[1] + pb.q * pb.dir[1]];
      var P = b.pts, lo = 0, hi = P.length - 1;
      while (lo <= hi && G.dist(P[lo], A) <= pa.q) lo++;
      while (hi >= lo && G.dist(P[hi], B) <= pb.q) hi--;
      var pts = [A, qa].concat(P.slice(lo, hi + 1), [qb, B]);
      if (polylineCrossesObstacle(rt.obs, pts) || polylineCrossesItself(pts)) { rt.error = 'The curve would cross something near a spot.'; rt.done = true; break; }
      var band2 = createBand(rt.obs, rt.ctx, pts, true, true, rt.params);
      if (!band2) { rt.error = 'The curve passes through or touches something near a spot.'; rt.done = true; break; }
      rt.phase = 2; rt.band = band2; rt.pts = band2.pts; rt.state = band2.state;
      rt.dirA = pa.dir; rt.dirB = [-pb.dir[0], -pb.dir[1]];
    }
    return rt.done;
  }

  /* ---------------- certificate for the finished spline ---------------- */

  /* Is every point of the curve at least dmin (effective distance) from every
     obstacle and from the far parts of itself? Works on the refined control
     polygon: a vertex check with margin eps + half a leg covers the whole curve,
     because distance is 1-Lipschitz. Returns { ok, clearance }. */
  function certify(obs, ctx0, pieces, dmin) {
    var ctx = Object.assign({}, ctx0, { scaleEnds: true });
    var maxLeg = Math.min(4, dmin), poly = G.refinedPolygon(pieces, 0.25, maxLeg);
    var pts = poly.pts, S = arcs(pts), worst = Infinity, margin = poly.eps + maxLeg / 2;
    for (var i = 1; i + 1 < pts.length; i++) {
      var r = Math.min(rObs(obs, ctx, pts[i]), rSelf(ctx, pts, S, pts[i], S[i]) - poly.eps) - margin;
      if (r < worst) worst = r;
    }
    return { ok: worst >= dmin, clearance: worst };
  }

  /* ---------------- the spline band (v36: moving a curve that is already drawn) ----------------

     The same energy as the band, E = ∫ (1 + λ Σφ) ds, but the unknowns are the
     de Boor points of the curve's own C² spline on its own knots (geom.js
     deBoorOf) — the plan agreed with Peter, 9/23: the curve stays one C² spline,
     nothing is refitted, and each de Boor point moves at most four pieces. The
     end points and end derivatives (the first two and last two de Boor points)
     are fixed, so the curve leaves its spots exactly as before and the order of
     the curves round every spot is kept.
     The curve is sampled at fixed parameters (every SAMPLE px of parameter,
     ≈ arc length), so each sample is a fixed linear combination of four de Boor
     points: p = W d. As in the band, the first and last q of the curve are
     STUBS: their length counts, their clearance does not (near its spots a
     curve's clearance from the other curves there is an angle, which the fixed
     end directions keep), and certify, which measures it by angle, checks them.
     A step: the gradient at the samples (central differences of the band's
     localEnergy, the component along the curve removed, as in the band),
     mapped to the de Boor points by Wᵀ; preconditioned by Wᵀ H W with H the
     band's Hessian (the Laplacian weighted by 1 + λφ plus λ h φ'' on the
     diagonal), so a step is a Newton step for length, as in the band;
     scaled uniformly so that no sample moves more than 16 px, nor more than
     half its distance to the barrier; then a backtracking line search that
     accepts only a step that lowers E, keeps every clearance above the
     barrier, crosses nothing, and whose spline is CERTIFIED (refined control
     polygons, against the real obstacles) no closer to anything than
     `certMin`. The barrier is raised towards d0 as room appears, as in the band.
     Done when three steps in a row achieve (almost) nothing and do not raise
     the barrier either — converged at d0, or stuck below it. */
  var SAMPLE = 8;
  function createSplineBand(o) {
    var h = o.curve.h.slice(), L = h.length, arr = G.deBoorOf(o.curve.pieces, h), i, j, k;
    var sp = [];
    for (j = 0; j < L; j++) { var n = Math.max(1, Math.ceil(h[j] / SAMPLE)); for (k = 0; k < n; k++) sp.push([j, k / n]); }
    sp.push([L - 1, 1]);
    /* the weights of sample k on de Boor points arr[j … j+3] (j = its piece) */
    var W = sp.map(function () { return new Float64Array(4); });
    for (var c = 0; c < 4 + L - 1; c++) {
      var e = []; for (i = 0; i < L + 3; i++) e.push([i === c ? 1 : 0]);
      var pcs = G.piecesFromDeBoor(e, h);
      sp.forEach(function (s, k) {
        var col = c - s[0];
        if (col < 0 || col > 3) return;
        var b = pcs[s[0]], t = s[1], u = 1 - t;
        W[k][col] = u * u * u * b[0][0] + 3 * t * u * u * b[1][0] + 3 * t * t * u * b[2][0] + t * t * t * b[3][0];
      });
    }
    /* free: the inner de Boor points (arr[2 … L]); with o.pieces (a list of piece
       indices) only those that move one of those pieces (piece j moves with arr[j … j+3]) */
    var freeIdx = new Int32Array(L + 3).fill(-1), m = 0, want = new Uint8Array(L + 3);
    if (o.pieces) o.pieces.forEach(function (j) { for (var q = j; q <= j + 3; q++) want[q] = 1; });
    /* o.freeEnds (v40): the end DIRECTIONS may turn too (arr[1], arr[L+1]; the
       end points arr[0], arr[L+2] stay): the stubs then count by their angle-
       scaled clearance (ctx.scaleEnds, as certify measures), so the curves at a
       spot fan out rather than hold their angles for ever (Peter's game of 9/24:
       17 → 1 had to arrive in a 30° wedge at 1; and the hooks at fixed ends).
       true, or [start, end] (v48): an end at the curve's own move's spot keeps its
       direction, so the move's two curves keep one tangent there */
    var fe = o.freeEnds === true ? [true, true] : o.freeEnds || [false, false], anyFree = fe[0] || fe[1];
    for (i = 1; i <= L + 1; i++) {
      if ((i === 1 && !fe[0]) || (i === L + 1 && !fe[1])) continue;
      if (!o.pieces || want[i]) freeIdx[i] = m++;
    }
    var sb = { obs: o.obs, certObs: o.certObs, ctx: o.ctx, params: o.params, h: h, L: L, arr: arr, sp: sp, W: W,
               freeIdx: freeIdx, m: m, scratch: new Float64Array(o.obs.nIds), scratchDir: new Float64Array(2 * o.obs.nIds), mu: 1e-6,
               dh: 0, iter: 0, quiet: 0, done: false, state: null, fd: !!o.fd, dead: o.dead && (o.dead[0] || o.dead[1]) ? o.dead : null };
    sb.pts = splinePoints(sb, arr);
    /* the samples that can move: those on a piece that a free de Boor point moves */
    var movable = new Uint8Array(L);
    for (j = 0; j < L; j++) for (var q2 = j; q2 <= j + 3; q2++) if (freeIdx[q2] >= 0) movable[j] = 1;
    sb.active = new Uint8Array(sp.length);
    sp.forEach(function (s, k) { if (movable[s[0]] || (s[1] === 0 && s[0] > 0 && movable[s[0] - 1])) sb.active[k] = 1; });
    var S = arcs(sb.pts), N = sb.pts.length - 1, tot = S[N];
    sb.lo = 0; while (sb.lo < N && S[sb.lo] < o.q) sb.lo++;
    sb.hi = N; while (sb.hi > 0 && tot - S[sb.hi] < o.q) sb.hi--;
    if (anyFree) {                                  // no stubs: everything but the two end points counts, by angle near the spots
      sb.lo = 1; sb.hi = N - 1;
      sb.ctx = Object.assign({}, o.ctx, { scaleEnds: true });
    }
    if (m < 1) { o.fail = 'free'; return null; }   // nothing free to move (o.fail says why there is no band)
    if (sb.hi - sb.lo < 2) { o.fail = 'stubs'; return null; }   // all stub
    var st = evaluateSpline(sb, sb.pts, 0, true);
    if (!(st.rmin > MIN_START)) { o.fail = 'touch'; return null; }
    sb.E00 = st.E;                                  // E with no barrier (dh = 0): comparable from one band to the next
    sb.dh = Math.min(o.params.d0, 0.7 * st.rmin);
    sb.state = evaluateSpline(sb, sb.pts, sb.dh, true);
    sb.certDmin = 0.6 * o.params.d0;               // (certify's legs are ≤ its dmin: never pass 0, nor a small floor)
    sb.certMin = Math.min(certify(sb.certObs, sb.ctx, splinePieces(sb), sb.certDmin).clearance, o.certMin);
    sb.E0 = sb.state.E;
    return sb;
  }
  function splinePoints(sb, arr) {
    return sb.sp.map(function (s, k) {
      var j = s[0], w = sb.W[k], a = arr[j], b = arr[j + 1], c = arr[j + 2], d = arr[j + 3];
      return [w[0] * a[0] + w[1] * b[0] + w[2] * c[0] + w[3] * d[0], w[0] * a[1] + w[1] * b[1] + w[2] * c[1] + w[3] * d[1]];
    });
  }
  function splinePieces(sb, arr) { return G.piecesFromDeBoor(arr || sb.arr, sb.h); }

  /* E: the length of the whole curve plus λ ∫ φ over the part between the stubs.
     Samples that cannot move keep their clearance from the last FULL evaluation
     (sb.cache: made at the start and whenever the barrier is raised); only the
     movable ones are measured again. (Their self-distance to the moving part is
     what that leaves out: the moving part measures the same distance itself.) */
  /* the unit normal (-t_y, t_x) of the polyline between points i and j (i = j: around point i) */
  function normalAt(pts, i, j) {
    var a = pts[Math.max(0, i === j ? i - 1 : i)], b = pts[Math.min(pts.length - 1, i === j ? i + 1 : j)];
    var tx = b[0] - a[0], ty = b[1] - a[1], l = Math.sqrt(tx * tx + ty * ty) || 1;
    return [-ty / l, tx / l];
  }
  function evaluateSpline(sb, pts, dh, full) {
    var n = pts.length - 1, S = arcs(pts), lam = sb.params.lambda, lo = sb.lo, hi = sb.hi, k, c, act = sb.active, cache = full ? null : sb.cache;
    var phiP = new Float64Array(n + 1), phiM = new Float64Array(n), rP = new Float64Array(n + 1).fill(Infinity), rM = new Float64Array(n).fill(Infinity), rmin = Infinity, E = 0;
    var gP = new Float64Array(2 * (n + 1)), gM = new Float64Array(2 * n), g = [0, 0];   // dφ/dp at the samples and the midpoints (movable ones)
    for (k = lo; k <= hi; k++) {
      if (cache && !act[k]) { rP[k] = cache.rP[k]; phiP[k] = cache.phiP[k]; }
      else { c = clearanceGrad(sb, pts, S, pts[k], S[k], dh, g, sb.dead && normalAt(pts, k, k)); rP[k] = c.r; phiP[k] = c.phi; gP[2 * k] = g[0]; gP[2 * k + 1] = g[1]; }
      if (rP[k] < rmin) rmin = rP[k];
    }
    for (k = 0; k < n; k++) {
      var len = S[k + 1] - S[k];
      if (k >= lo && k < hi) {
        if (cache && !act[k] && !act[k + 1]) { rM[k] = cache.rM[k]; phiM[k] = cache.phiM[k]; }
        else {
          c = clearanceGrad(sb, pts, S, [(pts[k][0] + pts[k + 1][0]) / 2, (pts[k][1] + pts[k + 1][1]) / 2], (S[k] + S[k + 1]) / 2, dh, g, sb.dead && normalAt(pts, k, k + 1));
          rM[k] = c.r; phiM[k] = c.phi; gM[2 * k] = g[0]; gM[2 * k + 1] = g[1];
        }
        if (rM[k] < rmin) rmin = rM[k];
        E += len * (1 + lam * (phiP[k] + 4 * phiM[k] + phiP[k + 1]) / 6);
      } else E += len;
    }
    var st = { S: S, phiP: phiP, phiM: phiM, rP: rP, rM: rM, rmin: rmin, E: E, gP: gP, gM: gM };
    if (full) sb.cache = st;
    return st;
  }

  function cholSolve(A, m, rhs) {               // A (m×m, SPD, row-major) is overwritten by its factor
    var i, j, k;
    for (j = 0; j < m; j++) {
      var d = A[j * m + j];
      for (k = 0; k < j; k++) d -= A[j * m + k] * A[j * m + k];
      if (!(d > 0)) return null;
      d = Math.sqrt(d); A[j * m + j] = d;
      for (i = j + 1; i < m; i++) {
        var v = A[i * m + j];
        for (k = 0; k < j; k++) v -= A[i * m + k] * A[j * m + k];
        A[i * m + j] = v / d;
      }
    }
    return function (b) {
      var y = new Float64Array(m), x = new Float64Array(m);
      for (i = 0; i < m; i++) { var v = b[i]; for (k = 0; k < i; k++) v -= A[i * m + k] * y[k]; y[i] = v / A[i * m + i]; }
      for (i = m - 1; i >= 0; i--) { v = y[i]; for (k = i + 1; k < m; k++) v -= A[k * m + i] * x[k]; x[i] = v / A[i * m + i]; }
      return x;
    };
  }

  function splineStep(sb) {
    var pts = sb.pts, st = sb.state, n = pts.length - 1, lo = sb.lo, hi = sb.hi, lam = sb.params.lambda;
    var gx = new Float64Array(n + 1), gy = new Float64Array(n + 1), delta = 0.05, k, i, i2;
    /* the exact gradient of E = Σ len_k (1 + λ (φ_k + 4 φ_mid + φ_k+1) / 6) at each
       movable sample: the lengths of its two segments (weighted), and its own φ
       and its two midpoints' φ (each midpoint moves half as far), from the
       directions evaluateSpline recorded (sb.fd: the old finite differences) */
    var gP = st.gP, gM = st.gM, S0 = st.S;
    function wSeg(j) { return j >= lo && j < hi ? 1 + lam * (st.phiP[j] + 4 * st.phiM[j] + st.phiP[j + 1]) / 6 : 1; }
    for (k = 1; k < n; k++) {
      if (!sb.active[k]) continue;                  // it cannot move: its gradient is not needed
      var p = pts[k], a = pts[k - 1], b = pts[k + 1];
      if (sb.fd && k > lo && k < hi) {
        var ex1 = localEnergy(sb, st, k, [p[0] + delta, p[1]]), ex0 = localEnergy(sb, st, k, [p[0] - delta, p[1]]);
        var ey1 = localEnergy(sb, st, k, [p[0], p[1] + delta]), ey0 = localEnergy(sb, st, k, [p[0], p[1] - delta]);
        gx[k] = (ex1[0] + ex1[1] - ex0[0] - ex0[1]) / (2 * delta);
        gy[k] = (ey1[0] + ey1[1] - ey0[0] - ey0[1]) / (2 * delta);
      } else {
        var la = G.dist(p, a) || 1e-9, lb = G.dist(p, b) || 1e-9, wa = wSeg(k - 1), wb = wSeg(k);
        gx[k] = wa * (p[0] - a[0]) / la + wb * (p[0] - b[0]) / lb; gy[k] = wa * (p[1] - a[1]) / la + wb * (p[1] - b[1]) / lb;
        var L1 = S0[k] - S0[k - 1], L2 = S0[k + 1] - S0[k];
        if (k - 1 >= lo && k - 1 < hi) {            // segment k-1: φ_k (weight L1/6) and its midpoint (4·L1/6, moving by half)
          gx[k] += lam * L1 / 6 * (gP[2 * k] + 2 * gM[2 * (k - 1)]); gy[k] += lam * L1 / 6 * (gP[2 * k + 1] + 2 * gM[2 * (k - 1) + 1]);
        }
        if (k >= lo && k < hi) {
          gx[k] += lam * L2 / 6 * (gP[2 * k] + 2 * gM[2 * k]); gy[k] += lam * L2 / 6 * (gP[2 * k + 1] + 2 * gM[2 * k + 1]);
        }
      }
      var tx = b[0] - a[0], ty = b[1] - a[1], tl = Math.sqrt(tx * tx + ty * ty) || 1, al = (gx[k] * tx + gy[k] * ty) / (tl * tl);
      gx[k] -= al * tx; gy[k] -= al * ty;          // only the component across the curve
    }
    /* H in sample space (tridiagonal), then Wᵀ H W over the free de Boor points */
    var S = st.S, wseg = new Float64Array(n), dia = new Float64Array(n + 1), Dd = sb.params.D - sb.dh;
    for (k = 0; k < n; k++) {
      var inW = k >= lo && k < hi;
      wseg[k] = (1 + (inW ? lam * (st.phiP[k] + st.phiP[k + 1]) / 2 : 0)) / Math.max(1e-6, S[k + 1] - S[k]);
    }
    for (k = 0; k <= n; k++) {
      dia[k] = (k > 0 ? wseg[k - 1] : 0) + (k < n ? wseg[k] : 0);
      if (k > lo && k < hi) {
        var gap = st.rP[k] - sb.dh, phi2 = gap > 1e-6 ? 6 * Dd * Dd / (gap * gap * gap * gap) : BIG;
        dia[k] += lam * (S[k + 1] - S[k - 1]) / 2 * Math.min(BIG, phi2);
      }
    }
    var m = sb.m, H = new Float64Array(m * m), gdx = new Float64Array(m), gdy = new Float64Array(m), fi = sb.freeIdx, W = sb.W, sp = sb.sp;
    for (k = 0; k <= n; k++) {
      var jk = sp[k][0], wk = W[k];
      for (i = 0; i < 4; i++) { var ca = fi[jk + i]; if (ca >= 0) { gdx[ca] += wk[i] * gx[k]; gdy[ca] += wk[i] * gy[k]; } }
      for (var l = Math.max(0, k - 1); l <= Math.min(n, k + 1); l++) {
        var hv = l === k ? dia[k] : -wseg[Math.min(k, l)], jl = sp[l][0], wl = W[l];
        for (i = 0; i < 4; i++) {
          ca = fi[jk + i]; if (ca < 0 || wk[i] === 0) continue;
          for (i2 = 0; i2 < 4; i2++) { var cb = fi[jl + i2]; if (cb >= 0) H[ca * m + cb] += wk[i] * hv * wl[i2]; }
        }
      }
    }
    var diagH = new Float64Array(m);
    for (i = 0; i < m; i++) { H[i * m + i] += sb.mu; diagH[i] = H[i * m + i]; }
    var solve = cholSolve(H, m), dirs = [];
    if (solve) { var vx = solve(gdx), vy = solve(gdy); for (i = 0; i < m; i++) { vx[i] = -vx[i]; vy[i] = -vy[i]; } dirs.push([vx, vy]); }
    dirs.push([gdx.map(function (g, i) { return -g / diagH[i]; }), gdy.map(function (g, i) { return -g / diagH[i]; })]);

    for (var d = 0; d < dirs.length; d++) {
      var ux = dirs[d][0], uy = dirs[d][1], dArr = sb.arr.map(function (q, i) { return fi[i] >= 0 ? [ux[fi[i]], uy[fi[i]]] : [0, 0]; });
      var dp = splinePoints(sb, dArr), scale = 1, longest = 0;
      for (k = 0; k <= n; k++) longest = Math.max(longest, Math.sqrt(dp[k][0] * dp[k][0] + dp[k][1] * dp[k][1]));
      if (!(longest > 0)) continue;
      if (longest > 16) scale = 16 / longest;
      for (k = lo; k <= hi; k++) {
        var len = Math.sqrt(dp[k][0] * dp[k][0] + dp[k][1] * dp[k][1]) * scale, cap = Math.max(0.25, 0.5 * (st.rP[k] - sb.dh));
        if (len > cap) scale *= cap / len;
      }
      for (var t = scale; t > scale / 1024; t /= 2) {
        var cand = sb.arr.map(function (q, i) { return fi[i] >= 0 ? [q[0] + t * ux[fi[i]], q[1] + t * uy[fi[i]]] : q; });
        var cp = splinePoints(sb, cand), ns = evaluateSpline(sb, cp, sb.dh);
        if (!(ns.rmin > sb.dh && ns.E < st.E - 1e-9)) continue;
        if (polylineCrossesObstacle(sb.obs, cp) || polylineCrossesItself(cp)) continue;
        if (certify(sb.certObs, sb.ctx, splinePieces(sb, cand), sb.certDmin).clearance < sb.certMin - 1e-9) continue;
        var moved = 0;
        for (k = 0; k <= n; k++) {                  // how far the SHAPE moved: across the curve
          var a2 = pts[Math.max(0, k - 1)], b2 = pts[Math.min(n, k + 1)], nx = -(b2[1] - a2[1]), ny = b2[0] - a2[0], nl = Math.sqrt(nx * nx + ny * ny) || 1;
          moved = Math.max(moved, Math.abs(((cp[k][0] - pts[k][0]) * nx + (cp[k][1] - pts[k][1]) * ny) / nl));
        }
        sb.arr = cand; sb.pts = cp; sb.state = ns;
        return moved;
      }
    }
    return 0;
  }

  function iterateSpline(sb, count) {
    for (var c = 0; c < count && !sb.done; c++) {
      var before = sb.state.E, moved = splineStep(sb);
      sb.iter++;
      /* small: the SHAPE moved less than QUIET_MOVE (across the curve), whatever the energy did (v110,
         Peter: "let's go shape only"). v96–v109 also asked for a small energy gain, as the elastic band
         does (iterate: there a step that moved little but gained a lot hid a kink); here the tail of
         such steps is the samples sliding ALONG the curve — which the sampled energy rewards, with no
         visible change: on Peter's move 25 of 9/29 3347 of 5169 steps, 66 of 87 s of making room. */
      var small = moved < QUIET_MOVE;
      var dh = Math.max(sb.dh, Math.min(sb.params.d0, 0.7 * sb.state.rmin)), raised = dh > sb.dh + 1e-6;
      if (raised) { sb.dh = dh; sb.state = evaluateSpline(sb, sb.pts, dh, true); }
      sb.quiet = small && !raised ? sb.quiet + 1 : 0;
      if (sb.quiet >= 3 || sb.iter >= 600) sb.done = true;
    }
    return sb.done;
  }

  var api = { normalAt: normalAt, energyNow: function (sb) { return evaluateSpline(sb, sb.pts, 0, true).E; }, _evaluateSpline: function (sb, pts, dh) { return evaluateSpline(sb, pts, dh, true); }, MIN_START: MIN_START, QUIET_E: QUIET_E, QUIET_MOVE: QUIET_MOVE,
    createSplineBand: createSplineBand, iterateSpline: iterateSpline, splinePieces: splinePieces,
    CELL: CELL, buildObstacles: buildObstacles, rObs: rObs,
    polylineCrossesObstacle: polylineCrossesObstacle, polylineCrossesItself: polylineCrossesItself,
    createBand: createBand, iterate: iterate, createRoute: createRoute, advance: advance, certify: certify
  };
  root.SproutsRelax = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : this);
