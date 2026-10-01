/* =========================================================================
   moves.js — the router's pieces for a move from spot a to spot b, and
   making room for one (v137: moved out of ui.js so that making room can run
   in a Web Worker — sprouts-room-worker.js — instead of freezing the page).
   DOM-free (global SproutsMoves, or require()). Needs geom.js, relax.js,
   route.js, engine.js, room.js.

   create(S) gives the functions, working on S.game (the drawing they read;
   trialMove puts a trial drawing there for a while), with S.route (the
   Settings: d0, D, lambda, …), S.spotR (the spot radius), S.note / S.hush
   (a remark for the next move's status line; > 0 while a move is only being
   tried) and S.say(text, warn) (the status line). The page binds them to its
   own variables (ui.js MS); the worker to its own copies.

   The functions are as they were in ui.js (v136): marked routes
   (barrierCandidates, markedRoute, arcsOf, componentOf, enclosingCurves),
   loopStart, segIntersection, the band (makeBand, choosePort, tangentsAt,
   sideTest, arrivalSide), trialMove and armFor, cornerProbe; roomFor is the
   computing half of the page's makeRoomNow, and jobOf / armedOf carry an
   armed state to a worker and back into one (an armed state holds functions
   — the analysis' regionAt, the side test — that cannot be sent).
   ========================================================================= */
(function (root) {
  var G = root.SproutsGeom || require('./geom.js');
  var R = root.SproutsRelax || require('./relax.js');
  var Rt = root.SproutsRoute || require('./route.js');
  var E = root.SproutsEngine || require('./engine.js');
  var Rm = root.SproutsRoom || require('./room.js');
  var STEP = 4;          // arc-length spacing of a resampled polyline (ui.js uses it for strokes too)

  function create(S) {
    /* The route from the armed start to spot b that puts the marked spots on
       one side of the curve and all the others on the other. Returns {path}
       (a polyline from A to B), {plain: true} when the marks cannot apply (the
       plain route is drawn), or null after a message (still armed).

       How: candidate curves come from the parity search in route.js (a cut ray
       per boundary that has to change sides; the walk it returns is made a
       simple curve by inflate/enclosingCurves), and every candidate is judged
       by the engine — analysing the position it would make and reading off
       which side of the new curve each spot is on. Cuts are added only for
       boundaries the last candidate left on the wrong side, so k stays small. */
    /* Candidate curves A → B (v112) that put the marked boundaries on one side and all the others
       on the other, by barriers (route.js barrierTree): the marked boundaries are joined by one tree
       of grid cells, the unmarked ones by another that does not touch it, each tree also holding what
       goes with its side —
         a curve A → B (one boundary): the arc of A's boundary that goes with the marked side (ar.mArc
           from the computer: the half-edges from its corner at A to its corner at B, or their
           complement; by hand: the arc of a spot marked on it, else each arc in turn), and the
           other arc with the unmarked side; there any path between the trees is right;
         a loop: the rest of A's own boundary with the unmarked side (with the marked one when it is
           marked); the part holding the region's outer boundary (or the window's edge, the outside
           region's) stays outside the loop, the other must be inside it: one parity bit, from a
           ray out of that part;
         the outside region: the window's edge with the unmarked side.
       The trees keep clear of the two ends. Every candidate is judged by the engine afterwards
       (verdict in markedRoute); [] when the barriers cannot be built or no path finds its way. */
    function barrierCandidates(ar, b) {
      var a = ar.a, A = S.game.spots[a], B = S.game.spots[b], pa = [A.x, A.y], pb = [B.x, B.y], loop = a === b;
      var reg = ar.region, an = ar.an, cycles = an.cycles, pl = ar.planner, grid = pl.grid, obs = ar.obs, c = grid.cell;
      var mask = Rt.regionMask(grid, obs, pl.start), n = grid.nx * grid.ny;
      /* the ends' neighbourhoods, no barrier there: round A the corner the curve leaves by, round B the
         one it arrives by (ar.bside) — not the whole disc: where the boundary passes A or B once more
         (a spot twice on it), a disc would cut the barrier there and let the curve slip through. As far
         out as the angle rule reaches (ρ), which is where the way into a narrow corner runs. */
      var keepR = Math.max(pl.ring, pl.ctx.rho || 0) + c, sideA = sideTest(a, [pl.start[0] - pa[0], pl.start[1] - pa[1]]), sideB = loop ? sideA : ar.bside || null;
      var keep = new Uint8Array(n);
      for (var k = 0; k < n; k++) {
        var q = [(k % grid.nx + 0.5) * c, (Math.floor(k / grid.nx) + 0.5) * c];
        if ((G.dist(q, pa) < keepR && (!sideA || sideA(q))) || (G.dist(q, pb) < keepR && (!sideB || sideB(q)))) keep[k] = 1;
      }
      function geometry(bd) {                        // the points of a boundary: its curves, or its lone spot
        if (bd.cycle === undefined) return [[S.game.spots[bd.spot].x, S.game.spots[bd.spot].y]];
        var pts = [];
        cycles[bd.cycle].halves.forEach(function (h) { pts = pts.concat(h.pts); });
        return pts;
      }
      /* an arc: its half-edges, each with the side the region is on (the walk keeps the region on one
         side of every half-edge; which one, the corner probe says — cornerProbe) */
      function halvesLines(ci, list) {
        var h0 = cycles[ci].halves[0], pr = cornerProbe(an, ownBd, 0), d0v = [h0.pts[1][0] - h0.pts[0][0], h0.pts[1][1] - h0.pts[0][1]];
        var faceSign = d0v[0] * (pr[1] - h0.pts[0][1]) - d0v[1] * (pr[0] - h0.pts[0][0]) > 0 ? 1 : -1;
        return list.map(function (k) { return { pts: cycles[ci].halves[k].pts, sign: faceSign }; });
      }
      var M = [], U = [], mRef = false, uRef = false, outCi = reg.key >= 0 ? reg.key : -1, ownBd = reg.boundaries[ar.boundary];
      reg.boundaries.forEach(function (bd, k) {
        if (k === ar.boundary) return;
        var pts = geometry(bd), marked = !!ar.marks[k];
        (marked ? M : U).push(pts);
        if (bd.cycle !== undefined && bd.cycle === outCi) { if (marked) mRef = true; else uRef = true; }
      });
      var arcSplits = [null];
      if (loop) {
        var own = geometry(ownBd), ownMarked = Object.keys(ar.arcMarks).length > 0;
        if (own.length) (ownMarked ? M : U).push(own);
        if (ownBd.cycle !== undefined && ownBd.cycle === outCi) { if (ownMarked) mRef = true; else uRef = true; }
      } else {
        var ciA = ownBd.cycle;
        if (ciA === undefined) return [];
        var nh = cycles[ciA].halves.length, all = [];
        for (k = 0; k < nh; k++) all.push(k);
        var arcOf = null, mHalves = null;
        if (ar.mArc) mHalves = ar.mArc;
        else {
          arcOf = arcsOf(cycles[ciA], a, b, ar.start, ar);
          if (!arcOf) return [];
          var ms = Object.keys(ar.arcMarks).map(Number).filter(function (sp) { return sp !== a && sp !== b; })[0];
          if (ms !== undefined) { var hm = cycles[ciA].halves.filter(function (h) { return h.tail === ms; })[0], km = cycles[ciA].halves.indexOf(hm); mHalves = all.filter(function (k2) { return arcOf[k2] === arcOf[km]; }); }
        }
        arcSplits = mHalves ? [mHalves] : [all.filter(function (k2) { return arcOf[k2] === 1; }), all.filter(function (k2) { return arcOf[k2] === 2; })];
      }
      var out = [];
      arcSplits.forEach(function (mh) {
        var Ma = M.slice(), Ua = U.slice();
        if (mh) {
          var uh = [];
          for (var k3 = 0; k3 < cycles[ownBd.cycle].halves.length; k3++) if (mh.indexOf(k3) < 0) uh.push(k3);
          Ma.push({ arc: halvesLines(ownBd.cycle, mh) }); Ua.push({ arc: halvesLines(ownBd.cycle, uh) });
        }
        var cellsOf = function (list) { return list.map(function (pts) { return pts.arc ? Rt.sideCells(grid, mask, pts.arc, keep, pl.ring + c) : Rt.anchorCells(grid, mask, pts, keep, pl.ring + c); }); };   // (zones: as far as a thing keeps cells from having room beside a tree)
        var mCells = cellsOf(Ma), uCells = cellsOf(Ua);
        if (reg.key === -1) uCells.push(Rt.edgeCells(grid, mask, keep));   // the unbounded part goes with the unmarked side
        var union = function (lists, extra) { var f = new Uint8Array(n); if (extra) for (var k4 = 0; k4 < n; k4++) f[k4] = extra[k4]; lists.forEach(function (l) { l.forEach(function (k5) { f[k5] = 1; }); }); return f; };
        /* the INNER side first — the one the curve goes round: for a curve A → B the marked side
           with its arc; for a loop the side without the region's outer boundary (or the window's
           edge). Its tree runs only where the curve has room beside it (clearance d0 + a cell), if it
           can; the cells round it are then kept for the curve — the corridor it can always follow —
           and, for a loop, a stem from A out to that corridor; the other tree may not use them. */
        var outside = mRef ? 'M' : 'U';                // (a bounded region's outer boundary is among the items; the outside region's edge goes with U)
        var innerM = !loop || outside === 'U', inC = innerM ? mCells : uCells, outC = innerM ? uCells : mCells;
        var forbid1 = union([], keep);
        var t1 = Rt.barrierTree(grid, obs, mask, inC, forbid1, pl.d0 + c);
        if (!t1) return;
        var lane = Rt.around(grid, mask, t1);
        if (loop) {
          var st = Rt.stem(grid, obs, mask, pl.start, lane, t1);
          if (!st) return;
          for (var k8 = 0; k8 < n; k8++) if (st[k8] && !t1[k8]) lane[k8] = 1;
        }
        var forbid2 = union([], keep);
        for (var k9 = 0; k9 < n; k9++) if (t1[k9] || lane[k9]) forbid2[k9] = 1;
        var outC2 = outC.map(function (l) { return l.filter(function (k11) { return !forbid2[k11]; }); });   // (the corridor stays open through the other side's zones)
        var t2 = Rt.barrierTree(grid, obs, mask, outC2, forbid2, pl.d0 + c) || Rt.barrierTree(grid, obs, mask, outC2, forbid2);   // (the curve does not follow this tree: any free cell will do if need be)
        var trees = null;
        if (t2) { trees = new Uint8Array(n); for (var k7 = 0; k7 < n; k7++) trees[k7] = t1[k7] | t2[k7]; }
        if (!trees) return;
        var rays = [], wanted = [0];
        if (loop) {                                  // the part without the outer boundary (or the window's edge) must be inside the loop
          var inner = innerM ? Ma : Ua, src = null;       // (outside / innerM: above)
          inner.some(function (pts) { if (pts.length) { src = pts[Math.floor(pts.length / 2)]; return true; } return false; });
          if (src) {
            var r0 = null;
            for (var d = 0; d < 36 && !r0; d++) { var r = Rt.ray(src, 2 * Math.PI * (d + 0.37) / 36); if (G.distPointSeg(pa, r[0], r[1]) >= keepR) r0 = r; }
            if (!r0) return;
            rays = [r0]; wanted = [1];
          }
        }
        var path = Rt.pathWithParity(grid, obs, pl.start, pb, pl.ring, rays, wanted, ar.bside, trees);
        if (!path) return;
        if (loop || rays.length) {
          enclosingCurves(Rt.inflate(grid, obs, [pl.start].concat(path, [pb])), pa, pb, loop, obs).forEach(function (cd) {
            if (!R.polylineCrossesObstacle(obs, cd) && !R.polylineCrossesItself(cd)) out.push(cd);
          });
        } else {
          var cd = [pa].concat(path, [pb]);
          if (!R.polylineCrossesObstacle(obs, cd) && !R.polylineCrossesItself(cd)) out.push(cd);
        }
      });
      return out;
    }
    function markedRoute(ar, b) {
      var a = ar.a, A = S.game.spots[a], B = S.game.spots[b], pa = [A.x, A.y], pb = [B.x, B.y], loop = a === b;
      var reg = ar.region, obs = ar.obs, pl = ar.planner, i, j;
      var bK = -1;
      reg.boundaries.forEach(function (bd, k) { if (bd.spots.indexOf(b) >= 0) bK = k; });
      if (!loop && bK !== ar.boundary) {            // joins two boundaries: nothing is enclosed
        S.note = 'spots ' + (a + 1) + ' and ' + (b + 1) + ' are on different boundaries, so the curve encloses nothing: marks ignored';
        return { plain: true };
      }

      /* the things that have a side: one spot for each other boundary of the
         region; for a loop, the rest of A's own boundary; for a curve A→B, each
         marked spot of A's boundary (whose side the arcs fix — it says which
         side the marked side is) */
      var items = [];
      reg.boundaries.forEach(function (bd, k) {
        if (k !== ar.boundary) items.push({ spot: bd.spots[0], marked: !!ar.marks[k] });
        else if (loop) {
          var rest = bd.spots.filter(function (s) { return s !== a; });
          if (rest.length) items.push({ spot: rest[0], marked: Object.keys(ar.arcMarks).length > 0 });
        } else {
          Object.keys(ar.arcMarks).map(Number).forEach(function (s) { if (s !== a && s !== b) items.push({ spot: s, marked: true, arc: true }); });
        }
      });
      if (!items.some(function (it) { return it.marked; }) && !ar.encloseNone) {
        /* nothing marked, but the computer's arc is given (v112): everything else goes with the other
           arc — the barriers see to it (the plain shortest way may enclose something) */
        if (ar.mArc && !loop) { var b0 = barrierCandidates(ar, b); if (b0.length) return { path: b0[0] }; }
        return { plain: true };
      }
      /* In the outside region the unbounded part is itself an unmarked side:
         "enclose these" means the bounded pocket holds them, not that the curve
         merely passes them (Peter's game, 9/22: 5 → 2 round the path 1-3-4, the
         only other boundary, so nothing was left to be on the other side and the
         shortest route passed). A region with an outer boundary has that
         boundary among the items already. */
      if (reg.key === -1) items.push({ outside: true, marked: false });
      var pt = function (it) { return [S.game.spots[it.spot].x, S.game.spots[it.spot].y]; };

      /* A cut ray for each item, chosen so that the parity of a curve's
         crossings of it says which side of the curve the item is on, relative
         to a fixed REFERENCE: the point where the ray leaves the region for
         good. For that the ray must leave the region once and not come back:
         through the region's outer cycle (if it has one) exactly once, and,
         for a curve A→B, not through A's own boundary at all — unless that IS
         the outer cycle, when the arc it leaves by is noted (the two arcs are
         on opposite sides of any curve A→B, so the reference is "arc 1" and a
         ray leaving by arc 2 has its parity flipped). */
      var an = ar.an, cycles = an.cycles, ciA = reg.boundaries[ar.boundary].cycle, outCi = reg.key >= 0 ? reg.key : -1;
      var arcOf = null;                             // for cycle ciA: halves index -> 1 or 2
      if (!loop && ciA !== undefined) arcOf = arcsOf(cycles[ciA], a, b, ar.start, ar);
      function hits(r, cyc) {                       // crossings of ray r with a cycle, nearest first
        var out = [];
        cyc.halves.forEach(function (h, k) {
          for (var t = 1; t < h.pts.length; t++) {
            if (G.segCross(r[0], r[1], h.pts[t - 1], h.pts[t])) out.push({ k: k, d: G.dist(r[0], segIntersection(r[0], r[1], h.pts[t - 1], h.pts[t])) });
          }
        });
        return out.sort(function (x, y) { return x.d - y.d; });
      }
      items.forEach(function (it) {
        if (it.outside) return;                     // the reference the rays run to; no cut of its own
        var p = pt(it);
        it.ray = null; it.flip = 0;
        for (var d = 0; d < 36 && !it.ray; d++) {
          var r = Rt.ray(p, 2 * Math.PI * (d + 0.37) / 36), flip = 0, ok = true;
          if (outCi >= 0 && hits(r, cycles[outCi]).length !== 1) ok = false;
          if (ok && !loop && ciA !== undefined) {
            var hA = hits(r, cycles[ciA]);
            if (ciA === outCi) { if (!arcOf) ok = false; else flip = arcOf[hA[0].k] === 2 ? 1 : 0; }
            else if (hA.length) ok = false;
          }
          if (ok) { it.ray = r; it.flip = flip; }
        }
      });

      /* The engine's verdict on a candidate curve: which items are on the wrong
         side. The marked side is the side of the first marked item that has one
         (an arc item first: its side cannot be changed). */
      function verdict(cand) {
        var af = E.afterMove(S.game.spots, S.game.edges, a, b, cand);
        if (!af.split || !af.left || !af.right) return null;
        items.forEach(function (it) {
          var l = it.outside ? af.left.key === -1 : af.left.spots.indexOf(it.spot) >= 0;
          var r = it.outside ? af.right.key === -1 : af.right.spots.indexOf(it.spot) >= 0;
          it.side = l && !r ? 1 : r && !l ? 0 : -1;
        });
        var lead = items.filter(function (it) { return it.marked && it.side >= 0 && it.arc; })[0] ||
                   items.filter(function (it) { return it.marked && it.side >= 0; })[0];
        var mside;
        if (lead) mside = lead.side;
        else if (ar.encloseNone) {                    // nothing marked: the enclosure is the side away from the outside — everything must stay out of it
          var out = items.filter(function (it) { return it.outside && it.side >= 0; })[0];
          if (!out) return null;
          mside = 1 - out.side;
        } else return null;
        var wrong = items.filter(function (it) { return it.side >= 0 && (it.marked ? it.side !== mside : it.side === mside); });
        return { ok: !wrong.length, wrong: wrong, conflict: wrong.some(function (it) { return it.arc; }) };
      }

      /* v112: first the BARRIER route (route.js barrierTree) — no 2^k states; the parity search
         below is kept for what it cannot do */
      var bcands = barrierCandidates(ar, b);
      for (i = 0; i < bcands.length; i++) { var bv = verdict(bcands[i]); if (bv && bv.ok) return { path: bcands[i] }; }

      var cuts = items.filter(function (it) { return it.marked; });   // the marked ones always have cuts
      var cand = null;
      if (!loop) {
        var p0 = pl.pathTo(pb, ar.bside);
        if (!p0) { ar.why = 'room'; S.say(ar.bside ? 'No route to spot ' + (b + 1) + ' from that side.' : 'No route found.', true); return null; }
        cand = [pa].concat(p0, [pb]);
      }
      for (var round = 0; round <= Rt.MAX_CUTS; round++) {
        if (cand) {
          var v = verdict(cand);
          if (v && v.conflict) { S.say('The marked spots on the boundary of spot ' + (a + 1) + ' cannot all be enclosed together.', true); return null; }
          if (v && v.ok) return { path: cand };
          if (v) v.wrong.forEach(function (it) { if (!it.outside && cuts.indexOf(it) < 0) cuts.push(it); });
          else if (round > 0) break;               // the engine could not read the candidate
        }
        if (cuts.some(function (it) { return !it.ray; })) { S.note = 'cannot tell the sides apart here — drawn the shortest way'; return { plain: true, failed: true }; }
        if (cuts.length > Rt.MAX_CUTS) { S.note = 'too many boundaries in that region to route around the marks — drawn the shortest way'; return { plain: true, failed: true }; }
        /* the parities to look for: the marked ones away from the reference and
           the others with it — failing that, the other way round */
        var w1 = 0, w2 = 0;
        cuts.forEach(function (it, k) {
          if (it.marked ^ it.flip) w1 |= 1 << k;
          if (!it.marked ^ it.flip) w2 |= 1 << k;
        });
        var rays = cuts.map(function (it) { return it.ray; });
        var path = Rt.pathWithParity(pl.grid, obs, pl.start, pb, pl.ring, rays, [w1], ar.bside) || Rt.pathWithParity(pl.grid, obs, pl.start, pb, pl.ring, rays, [w2], ar.bside);
        if (!path) { ar.why = 'room'; S.say('No route found that encloses the marked spots.', true); return null; }
        var cands = enclosingCurves(Rt.inflate(pl.grid, obs, [pl.start].concat(path, [pb])), pa, pb, loop, obs);
        /* the candidates that cross nothing, each judged: the first the engine
           accepts is the route; otherwise the first one tells the next round
           which items are on the wrong side (for a loop the two arcs are a
           tiny one and the long one, v31, so taking the first blindly fails) */
        var valid = cands.filter(function (cd) { return !R.polylineCrossesObstacle(obs, cd) && !R.polylineCrossesItself(cd); });
        for (i = 0; i < valid.length; i++) {
          var vi = verdict(valid[i]);
          if (vi && vi.ok) return { path: valid[i] };
        }
        cand = valid[0] || null;
        if (!cand) break;
      }
      S.note = 'could not route around the marks — drawn the shortest way';
      return { plain: true, failed: true };   // (failed, v140: the marks could not be applied — a hand move is then not drawn unless asked; plain alone: they do not matter)
    }

    /* Which arc of the boundary cycle `cyc` (from the engine) each of its
       half-edges is on, for a curve from spot a to spot b: 1 from a's corner
       round to b's, 2 the rest. a's corner is the one facing `start`; b must
       have only one corner on the cycle. Null if the arcs cannot be told. */
    function arcsOf(cyc, a, b, start, ar) {
      var hv = cyc.halves, n = hv.length, atA = [], atB = [], k;
      hv.forEach(function (h, k) { if (h.tail === a) atA.push(k); if (h.tail === b) atB.push(k); });
      if (atB.length !== 1 || !atA.length) return null;
      var kA = atA[0];
      if (atA.length > 1) {                          // the corner whose sector holds the start direction
        var A = S.game.spots[a], ang = Math.atan2(start[1] - A.y, start[0] - A.x);
        kA = -1;
        atA.forEach(function (k) {
          var prev = hv[(k + n - 1) % n], back = Math.atan2(prev.pts[prev.pts.length - 2][1] - A.y, prev.pts[prev.pts.length - 2][0] - A.x);
          var lo = hv[k].angle, span = back - lo; span -= 2 * Math.PI * Math.floor(span / (2 * Math.PI));   // sector from the outgoing curve round to the incoming one
          var t = ang - lo; t -= 2 * Math.PI * Math.floor(t / (2 * Math.PI));
          var mid = lo + span / 2, probe = [A.x + 12 * Math.cos(mid), A.y + 12 * Math.sin(mid)];
          if (t < span && ar && ar.an.regionAt(probe) === ar.region) kA = k;
        });
        if (kA < 0) return null;
      }
      var kB = atB[0], out = [], len = (kB - kA + n) % n;
      for (k = 0; k < n; k++) out[k] = (k - kA + n) % n < len ? 1 : 2;
      return out;
    }

    /* Which spots are connected to spot s by curves (true at their indices). */
    function componentOf(s) {
      var parent = S.game.spots.map(function (sp, i) { return i; });
      function find(x) { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; }
      S.game.edges.forEach(function (e) { parent[find(e.a)] = find(e.b); });
      var root = find(s), out = {};
      S.game.spots.forEach(function (sp, i) { if (find(i) === root) out[i] = true; });
      return out;
    }

    /* The curves from A to B along the boundary of an inflated walk (see
       route.js inflate): the loop nearest the walk's first clean cell is cut at
       the edge nearest that cell and at the edge nearest its last clean cell,
       and each of the two arcs between the cuts, joined to A and to B (A again
       for a loop), is a candidate. A cut edge must be visible from the spot it
       joins. */
    function enclosingCurves(loops, pa, pb, loop, obs) {
      var head = [pa], L = null, best = Infinity, w1 = loops.first, w2 = loops.last;
      if (!w1) return [];
      loops.forEach(function (l) { l.forEach(function (v) { var d = G.dist(v, w1); if (d < best) { best = d; L = l; } }); });
      if (!L) return [];
      var n = L.length, end = loop ? pa : pb;
      function nearestEdge(p, from) {               // the edge nearest p whose ends `from` can see
        var order = L.map(function (v, i) { return i; }).sort(function (x, y) {
          return G.distPointSeg(p, L[x], L[(x + 1) % n]) - G.distPointSeg(p, L[y], L[(y + 1) % n]);
        });
        for (var t = 0; t < order.length && t < 12; t++) {
          var e = order[t];
          if (!R.polylineCrossesObstacle(obs, [L[e], from, L[(e + 1) % n]])) return e;
        }
        return order[0];
      }
      var e1 = nearestEdge(w1, pa), e2 = nearestEdge(w2, end), out = [], arc, t;
      arc = [];                                     // forward: from the far end of edge e1 round to the near end of e2
      for (t = (e1 + 1) % n; ; t = (t + 1) % n) { arc.push(L[t]); if (t === e2) break; }
      out.push(head.concat(arc, [end]));
      arc = [];                                     // backward: from the near end of e1 round to the far end of e2
      for (t = e1; ; t = (t + n - 1) % n) { arc.push(L[t]); if (t === (e2 + 1) % n) break; }
      out.push(head.concat(arc, [end]));
      if (e1 === e2) { out.push(head.concat([L[e1], L[(e1 + 1) % n]], [end])); out.push(head.concat([L[(e1 + 1) % n], L[e1]], [end])); }
      return out;
    }

    /* The starting circle for a loop round nothing at spot a of gm (null: none crosses nothing). */
    function loopStart(gm, a, obs) {
      var A = gm.spots[a], pa = [A.x, A.y];
      var ctx = { aIdx: a, bIdx: a, A: pa, B: pa, rho: S.route.D * Math.SQRT2, spotR: S.spotR };
      var best = null, bestClear = -Infinity;
      [1.5 * S.route.D, S.route.D, 0.6 * S.route.D].forEach(function (r) {
        for (var k = 0; k < 24; k++) {
          var ang = 2 * Math.PI * k / 24, cx = pa[0] + r * Math.cos(ang), cy = pa[1] + r * Math.sin(ang), pts = [];
          for (var m = 0; m <= 36; m++) { var t = ang + Math.PI + 2 * Math.PI * m / 36; pts.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]); }
          pts[0] = pa; pts[36] = pa;
          if (R.polylineCrossesObstacle(obs, pts)) continue;
          var clear = Infinity;
          for (m = 3; m < 34; m++) clear = Math.min(clear, R.rObs(obs, ctx, pts[m]));
          clear = Math.min(clear, r);              // a bigger loop is no better once it is roomy
          if (clear > bestClear) { bestClear = clear; best = pts; }
        }
      });
      return best && bestClear >= 1 ? best : null;
    }

    function segIntersection(a, b, c, d) {
      var r = [b[0] - a[0], b[1] - a[1]], s = [d[0] - c[0], d[1] - c[1]], den = r[0] * s[1] - r[1] * s[0];
      var t = den ? ((c[0] - a[0]) * s[1] - (c[1] - a[1]) * s[0]) / den : 0;
      return [a[0] + t * r[0], a[1] + t * r[1]];
    }

    /* P runs from spot a's centre to spot b's centre. It must cross nothing.
       R.createRoute relaxes it in two phases (see relax.js); between them the
       curve's departure direction at each spot is fixed by choosePort — Peter's
       rule: the bisector of the sector used at a spot with two curves; otherwise
       the route's own direction, kept at least MIN_ANGLE from any curve already
       there. */
    /* The elastic band for a move from a to b along the polyline P (in the
       current `game`), or a message string saying why not. */
    function makeBand(a, b, P, obs) {
      var A = S.game.spots[a], B = S.game.spots[b], pa = [A.x, A.y], pb = [B.x, B.y], loop = a === b;
      var ctx = { aIdx: a, bIdx: b, A: pa, B: pb, rho: S.route.D * Math.SQRT2, spotR: S.spotR };
      if (R.polylineCrossesObstacle(obs, P)) return 'The curve crosses something.';
      if (R.polylineCrossesItself(P)) return 'The curve crosses itself.';
      /* the sectors the curve leaves the spots through are those of P's first and
         last segments (the side the user chose); the band cannot cross a curve, so
         it stays in them, though its direction 3·d0 out may point elsewhere */
      var n = P.length - 1, sideA = [P[1][0] - pa[0], P[1][1] - pa[1]], sideB = [P[n - 1][0] - pb[0], P[n - 1][1] - pb[1]];
      var rt = R.createRoute(obs, ctx, P, { d0: S.route.d0, D: S.route.D, lambda: S.route.lambda }, function (rawA, rawB) {
        var portA = choosePort(a, rawA, sideA, loop ? [rawB] : []);
        if (!portA) return 'No room to leave spot ' + (a + 1) + ' on that side.';
        var portB = choosePort(b, rawB, sideB, loop ? [portA.dir] : []);
        if (!portB) return 'No room to arrive at spot ' + (b + 1) + ' from that side.';
        return { portA: portA, portB: portB };
      });
      if (!rt) return 'The curve passes through or touches something.';
      rt.move = { a: a, b: b, obs: obs, ctx: ctx };
      return rt;
    }

    /* The move a → b, planned from `start` and relaxed to the end, in the
       position gm — { E, rmin, pts } of the relaxed band, or null if it fails —
       without drawing anything (making room judges its candidates with this).
       opt.marks: an armed object whose marks the route must honour (its spots
       are what count: the marks are re-read in gm, see armFor); opt.d0: plan at
       that minimum clearance instead of the Settings' one; opt.phase1: only the
       band's first phase (free ends, no ports — for a ghost at a small
       clearance, where the ports fail near crowded spots). */
    /* The side by which the move of ar0 reaches spot b in the drawing `game` now (v112) — after making
       room the old test (sideTest keeps the curves' directions of when it was made) is stale: a spot
       that slides keeps the SIDE of its curve (ar0.bsign), any other the direction ar0.bdir. */
    function arrivalSide(b, ar0) {
      if (!ar0 || !ar0.bdir) return ar0 ? ar0.bside || null : null;
      if (ar0.bsign && Rm.slidable(S.game, b)) { var sp = Rm.spline(S.game, b), pn = Rm.pointAt(sp, sp.u); return sideTest(b, [ar0.bsign * pn.n[0], ar0.bsign * pn.n[1]]); }
      return sideTest(b, ar0.bdir);
    }
    function trialMove(gm, a, b, start, opt) {
      opt = opt || {};
      var saved = S.game, savedD0 = S.route.d0, savedNote = S.note;
      S.game = gm;                                    // choosePort, tangentsAt and markedRoute read `game`
      if (opt.d0) S.route.d0 = opt.d0;
      S.hush++;
      try {
        var obs = R.buildObstacles(gm, S.spotR), A = gm.spots[a], B = gm.spots[b], pa = [A.x, A.y], pb = [B.x, B.y], P;
        if (opt.marks && (Object.keys(opt.marks.marks).length || Object.keys(opt.marks.arcMarks).length)) {
          var ar = armFor(gm, a, start, opt.marks, obs);
          if (!ar) return null;
          ar.bside = arrivalSide(b, opt.marks);
          var mr = markedRoute(ar, b);
          if (!mr || !mr.path) return null;         // (a plain fallback is not what was asked for)
          P = G.resample(mr.path, STEP);
        } else if (a === b) {                          // a loop round nothing (v52): as loopAround starts it
          var lp = loopStart(gm, a, obs);
          if (!lp) return null;
          P = G.resample(lp, STEP);
        } else {
          var ctx = { aIdx: a, bIdx: -1, A: pa, B: pa, rho: S.route.D * Math.SQRT2, spotR: S.spotR };
          var path = Rt.planner(obs, ctx, S.route.d0, gm.W0, gm.H0, start, S.spotR).pathTo(pb, arrivalSide(b, opt.marks));   // (v112: by the intended side)
          if (!path) return null;
          P = G.resample([pa].concat(path, [pb]), STEP);
        }
        if (opt.phase1) {
          var rt1 = R.createRoute(obs, { aIdx: a, bIdx: b, A: pa, B: pb, rho: S.route.D * Math.SQRT2, spotR: S.spotR }, P,
                                  { d0: S.route.d0, D: S.route.D, lambda: S.route.lambda }, function () { return 'phase 1 only'; });
          if (!rt1) return null;
          R.advance(rt1, 2000);
          return { E: rt1.state.E, rmin: rt1.state.rmin, pts: rt1.pts };
        }
        var rt = makeBand(a, b, P, obs);
        if (typeof rt === 'string') return null;
        R.advance(rt, 2000);
        return rt.error ? null : { E: rt.state.E, rmin: rt.state.rmin, pts: rt.pts };
      } finally { S.game = saved; S.route.d0 = savedD0; S.note = savedNote; S.hush--; }
    }

    /* The armed state for a move from spot a (leaving from `start`) in position
       gm — `game` must be gm — with the marks of ar0 carried over: a marked
       boundary is found again by its spots (after spots slid or curves moved
       the boundaries are the same, but the analysis is new). Null if a's region
       cannot be found. */
    function armFor(gm, a, start, ar0, obs) {
      var an = E.analyse(gm.spots, gm.edges), A = gm.spots[a], pa = [A.x, A.y];
      var reg = A.deg === 2 ? an.regionAt(start) : an.regions.filter(function (r) { return r.spots.indexOf(a) >= 0; })[0];
      if (!reg) return null;
      var ctx = { aIdx: a, bIdx: -1, A: pa, B: pa, rho: S.route.D * Math.SQRT2, spotR: S.spotR };
      var ar = { a: a, spot: pa, start: start, obs: obs, an: an, region: reg, boundary: -1, marks: {}, arcMarks: {}, markedSpots: ar0.markedSpots,
                 planner: Rt.planner(obs, ctx, S.route.d0, gm.W0, gm.H0, start, S.spotR) };
      reg.boundaries.forEach(function (bd, k) { if (bd.spots.indexOf(a) >= 0) ar.boundary = k; });
      Object.keys(ar0.marks).forEach(function (k0) {
        var sp = ar0.region.boundaries[k0].spots;
        reg.boundaries.forEach(function (bd, k) { if (bd.spots.some(function (x) { return sp.indexOf(x) >= 0; })) ar.marks[k] = true; });
      });
      Object.keys(ar0.arcMarks).forEach(function (s) { ar.arcMarks[s] = true; });
      if (ar0.mArc) ar.mArc = ar0.mArc;
      if (ar0.bdir) { ar.bdir = ar0.bdir; ar.bsign = ar0.bsign; }             // (v112: the computer's arc — half-edge numbers on A's boundary, which making room does not change)
      return ar;
    }

    /* Unit tangents, pointing away from spot i, of the curves already at it. */
    function tangentsAt(i) {
      var out = [], sp = S.game.spots[i];
      S.game.edges.forEach(function (e) {
        var b = e.a === i ? e.pieces[0] : e.b === i ? e.pieces[e.pieces.length - 1] : null;
        if (!b) return;
        var q = e.a === i ? b[1] : b[2], v = [q[0] - sp.x, q[1] - sp.y], len = Math.hypot(v[0], v[1]) || 1;
        out.push([v[0] / len, v[1] / len]);
      });
      return out;
    }

    /* The ARRIVAL SIDE at spot b (v85, Peter 9/28): a test of whether a point q
       lies in the sector between b's curves that `dir` (from b) points into —
       the planner ends the path only in cells that pass it (route.js
       bestCellNear), so the curve reaches b by that side, and the band keeps
       to it (makeBand's sideB). Null when b has fewer than two curves: there
       is only one side. */
    function sideTest(b, dir) {
      var tans = tangentsAt(b).map(function (t) { return Math.atan2(t[1], t[0]); }).sort(function (x, y) { return x - y; });
      if (tans.length < 2) return null;
      var B = S.game.spots[b];
      function sector(th) { for (var k = 0; k < tans.length - 1; k++) if (th >= tans[k] && th < tans[k + 1]) return k; return tans.length - 1; }   // the last sector wraps round
      var want = sector(Math.atan2(dir[1], dir[0]));
      return function (q) { return sector(Math.atan2(q[1] - B.y, q[0] - B.x)) === want; };
    }

    var MIN_ANGLE = Math.PI / 6;   // a new curve leaves a spot at least 30° from any curve already there
    var MIN_HALF_SECTOR = 5 * Math.PI / 180;

    /* Where the new curve leaves spot i: { dir, q }. `raw` is the route's own
       direction there (measured 3·d0 out along the band); `side` is a direction
       in the sector between the curves at the spot that the route leaves
       through (the first segment of the initial polyline — the band cannot
       cross a curve, so it stays in that sector, but `raw` can point outside it
       when the band bends round a curve within 3·d0, as on a small loop);
       `extra` holds directions to keep away from besides the curves at the spot
       (the other leg of a loop). Two curves at the spot: `raw`, kept at least
       MIN_ANGLE from both curves bounding that sector — the bisector when the
       sector is too narrow for that (under 2·MIN_ANGLE). The bisector of a WIDE
       sector could point nearly opposite to the route (a 330° sector at a spot
       whose two curves leave side by side), which made the stub cross the
       route. One curve: `raw`, turned away to at least MIN_ANGLE from it. None:
       `raw`. The port distance q is 3·d0, or more when the nearest curve is
       close, so that the port itself is at least 1.5·d0 from it; null if the
       sector is too narrow to use. */
    function choosePort(i, raw, side, extra) {
      var tans = tangentsAt(i).concat(extra), ang = Math.atan2(raw[1], raw[0]), sideAng = Math.atan2(side[1], side[0]);
      var angs = tans.map(function (t) { return Math.atan2(t[1], t[0]); });
      function wrap(x) { return x - 2 * Math.PI * Math.round(x / (2 * Math.PI)); }
      function ccw(x) { x = wrap(x); return x <= 0 ? x + 2 * Math.PI : x; }   // an angle as a counter-clockwise turn in (0, 2π]
      var half = Math.PI, q = 3 * S.route.d0;
      if (angs.length >= 2) {
        var k = 0, best = Infinity;                 // the tangent just clockwise of `side`
        for (var j = 0; j < angs.length; j++) {
          var d = ccw(sideAng - angs[j]);
          if (d < best) { best = d; k = j; }
        }
        var next = 2 * Math.PI;                     // the next tangent counter-clockwise from it
        for (j = 0; j < angs.length; j++) {
          var e = ccw(angs[j] - angs[k]);
          if (j !== k && e < next) next = e;
        }
        var into = ccw(ang - angs[k]);              // raw, measured from that curve; outside the sector → its nearer edge
        if (into > next) into = into - next < 2 * Math.PI - into ? next : 0;
        if (next >= 2 * MIN_ANGLE) into = Math.min(Math.max(into, MIN_ANGLE), next - MIN_ANGLE);
        else into = next / 2;
        ang = angs[k] + into;
        half = Math.min(into, next - into);
      } else if (angs.length === 1) {
        var off = wrap(ang - angs[0]);
        if (Math.abs(off) < MIN_ANGLE) ang = angs[0] + (off >= 0 ? MIN_ANGLE : -MIN_ANGLE);
        half = Math.abs(wrap(ang - angs[0]));
      }
      if (half < MIN_HALF_SECTOR) return null;
      if (half < Math.PI / 2) q = Math.max(q, 1.5 * S.route.d0 / Math.sin(half));
      return { dir: [Math.cos(ang), Math.sin(ang)], q: q };
    }

    /* A point 12 px from spot x into corner i of its boundary bd (engine
       names): the sector from the half-edge leaving x there round to the twin
       of the one arriving — the face lies between them (engine.js next: the
       half-edge just below the twin in the rotation). What a drag into that
       sector would give updateSide. */
    function cornerProbe(an, bd, i) {
      var hv = an.cycles[bd.cycle].halves, n = hv.length, hOut = hv[i], hIn = hv[(i - 1 + n) % n];
      var pts = hIn.pts, L = pts.length, thetaT = Math.atan2(pts[L - 2][1] - pts[L - 1][1], pts[L - 2][0] - pts[L - 1][0]);
      var span = thetaT - hOut.angle;
      span -= 2 * Math.PI * Math.floor(span / (2 * Math.PI));
      if (span < 1e-9) span = 2 * Math.PI;           // one curve: the whole way round
      var th = hOut.angle + span / 2, sp = S.game.spots[hOut.tail];
      return [sp.x + 12 * Math.cos(th), sp.y + 12 * Math.sin(th)];
    }

    /* Making room for the move a → b of `ar` (an armed state: a, start, an, region, marks, arcMarks,
       markedSpots, mArc, bdir, bsign, bside) in the present game: sliding spots (if `spots`), then
       moving curves (if `curves`). What makeRoomNow computed on the page's own thread until v137;
       now also in a worker (sprouts-room-worker.js). pending: { ghost, clearance } of the refusal.
       The game is not changed. Returns { game, start, fitted, what } (the new drawing, the start to
       arm A from, the band moving curves fitted if it did, what was done) or { fail, brief, why }. */
    function roomFor(ar, b, spots, curves, pending) {
      var a = ar.a, regKey = ar.region.key, an = ar.an;
      var o = { d0: S.route.d0, D: S.route.D, lambda: S.route.lambda, spotR: S.spotR, rho: S.route.D * Math.SQRT2, ghost0: pending.ghost };
      var inRegion = function (q) { var r = an.regionAt(q); return !!r && r.key === regKey; };
      var pos = function (gm, i) { return [gm.spots[i].x, gm.spots[i].y]; };
      var reach = function (gm, start) { return trialMove(gm, a, b, start, { marks: ar }); };   // the real test: route (round the marks, if any) and band
      var probeOf = function (gm, cand) {           // the start of a slid A: 12 px off its curve on the region's side
        var pn = Rm.pointAt(Rm.spline(gm, a), cand.u);
        return [pn.p[0] + 12 * cand.side * pn.n[0], pn.p[1] + 12 * cand.side * pn.n[1]];
      };
      var tries = [], res = null, start = ar.start, g2 = null, what = [], why = [], fitted = null;
      /* v112: a spot that slides keeps the side of its curve the move leaves or reaches it by (a spot on
         a bare path has a corner in this region on each side; either could be taken otherwise) */
      var sideAt = function (gm, z, q) {
        if (!Rm.slidable(gm, z)) return 0;
        var sp = Rm.spline(gm, z), pn = Rm.pointAt(sp, sp.u), d = (q[0] - pn.p[0]) * pn.n[0] + (q[1] - pn.p[1]) * pn.n[1];
        return d > 0 ? 1 : d < 0 ? -1 : 0;
      };
      var sideA = sideAt(S.game, a, ar.start) || undefined, sideB = ar.bsign || undefined;
      if (spots && Rm.slidable(S.game, b)) {           // 1. the destination
        res = Rm.slideFor(S.game, b, ar.start, a, inRegion, function (gm) { return reach(gm, ar.start); }, o, sideB);
        tries.push(res);
        if (!res.fail) { g2 = JSON.parse(JSON.stringify(S.game)); Rm.place(g2, b, res.u, 2 * S.spotR); what.push('slid spot ' + (b + 1) + ' along its curve ' + Math.round(G.dist(res.from, res.to)) + ' px'); }
      }
      if (spots && !g2 && Rm.slidable(S.game, a)) {    // 2. the start spot, then 3. both
        var bases = [S.game];
        if (res && res.fail && res.bestU !== null) { var gb = JSON.parse(JSON.stringify(S.game)); Rm.place(gb, b, res.bestU, 2 * S.spotR); bases.push(gb); }
        for (var k = 0; k < bases.length && !g2; k++) {
          var base = bases[k], ra = Rm.slideFor(base, a, pos(base, b), b, inRegion, function (gm, cand) { return reach(gm, probeOf(gm, cand)); }, o, sideA);
          tries.push(ra);
          if (!ra.fail) {
            g2 = JSON.parse(JSON.stringify(base)); Rm.place(g2, a, ra.u, 2 * S.spotR);
            start = probeOf(g2, ra);
            if (k === 1) what.push('slid spot ' + (b + 1) + ' along its curve ' + Math.round(G.dist(pos(S.game, b), pos(base, b))) + ' px');
            what.push('slid spot ' + (a + 1) + ' along its curve ' + Math.round(G.dist(ra.from, ra.to)) + ' px');
          }
        }
      }
      var brief = [];                                // the same reasons without the pixels, for the status line
      if (spots && !g2) {
        var best = Math.max.apply(null, tries.map(function (t) { return t.best; }).concat([pending.clearance !== undefined && pending.clearance !== null ? pending.clearance : -Infinity]));
        var who = [b, a].filter(function (i) { return Rm.slidable(S.game, i); }).map(function (i) { return i + 1; });
        var slideWhy = who.length ? 'sliding spot' + (who.length > 1 ? 's ' : ' ') + who.join(' and ') + ' does not give enough room' :
                                    'neither spot can slide (only a spot made by a move, with just its two curves, can)';
        brief.push(slideWhy);
        why.push(slideWhy + (best > -Infinity ? ' (the best way keeps ' + Math.max(0, Math.round(best)) + ' px clear)' : ''));
      }
      if (curves && !g2) {                           // 4. moving curves
        var mc = Rm.moveCurvesFor(S.game, a, ar.start, b, function (gm, st, opt) { return trialMove(gm, a, b, st, Object.assign({ marks: ar }, opt)); }, o);
        if (mc.fail) {
          brief.push('moving curves does not either: ' + (mc.brief || mc.reason));
          why.push('moving curves does not either: ' + mc.reason + (mc.best > -Infinity ? ' (the best way keeps ' + Math.max(0, Math.round(mc.best)) + ' px clear)' : ''));
        }
        else {
          g2 = mc.game; start = mc.start; fitted = mc.band;
          var mv = mc.moved.filter(function (m) { return m.px >= 0.5; }).sort(function (x, y) { return y.px - x.px; });
          what.push('moved curve' + (mv.length > 1 ? 's ' : ' ') + mv.map(function (m) { return m.name + ' (up to ' + Math.round(m.px) + ' px)'; }).join(', ') +
                    (mc.rounds > 1 ? ', in ' + mc.rounds + ' rounds' : ''));
        }
      }
      if (!g2) return { fail: true, brief: brief, why: why };
      return { game: g2, start: start, fitted: fitted, what: what };
    }

    /* An armed state as a message for the worker: what makes it, by value (v137). The side a click
       chose at B (bside, a function) goes as the direction it was made from (bsideDir). */
    function jobOf(ar, b) {
      return { a: ar.a, b: b, start: ar.start, regionKey: ar.region.key, marks: ar.marks, arcMarks: ar.arcMarks,
               markedSpots: ar.markedSpots, mArc: ar.mArc || null, bdir: ar.bdir || null, bsign: ar.bsign || null,
               bsideDir: ar.bsideDir || null };
    }
    /* …and back into an armed state, in the present game. Null if the region is not found. */
    function armedOf(j) {
      var an = E.analyse(S.game.spots, S.game.edges), reg = an.regions.filter(function (r) { return r.key === j.regionKey; })[0];
      if (!reg) return null;
      var ar = { a: j.a, start: j.start, an: an, region: reg, marks: j.marks, arcMarks: j.arcMarks, markedSpots: j.markedSpots };
      if (j.mArc) ar.mArc = j.mArc;
      if (j.bdir) { ar.bdir = j.bdir; ar.bsign = j.bsign; }
      if (j.bsideDir) { ar.bsideDir = j.bsideDir; ar.bside = sideTest(j.b, j.bsideDir); }
      return ar;
    }

    /* The router in a worker (v139): markedRoute for a job (jobOf, plus `encloseNone`), the armed state
       rebuilt in the present game — the planner from the same obstacles and start as the page's, so the
       same route. The side at B as the page finds it: the computer's (bdir, bsign) by arrivalSide — as
       aiTry and makeRoomNow do; a probe direction alone can point into the other side once the drawing
       has changed (a first try sent bdir as bsideDir: after room was made, "no route from that side"
       while the room check found 55 px, and room was made for ever) — a click's by its direction. */
    function routeFor(j) {
      var ar0 = armedOf(j);
      if (!ar0) return { mr: null, why: 'lost' };
      var ar = armFor(S.game, j.a, j.start, ar0, R.buildObstacles(S.game, S.spotR));
      if (!ar) return { mr: null, why: 'lost' };
      ar.bside = j.bdir ? arrivalSide(j.b, ar0) : ar0.bside || null;
      if (j.encloseNone) ar.encloseNone = true;
      ar.why = null;
      var mr = markedRoute(ar, j.b);
      return { mr: mr, why: ar.why || null };
    }

    /* …and the search for the best way round the marks with less room (v139: explainMarkedNoRoom's
       Rm.lowerClearance, 99 s on the page's thread once): { low: { d, t: { rmin, pts } } } or { low: null }. */
    function lowerFor(j) {
      var ar0 = armedOf(j);
      if (!ar0) return { low: null };
      var low = Rm.lowerClearance(function (d) { return trialMove(S.game, j.a, j.b, j.start, { marks: ar0, d0: d, phase1: true }); }, S.route.d0 / 2);
      return { low: low ? { d: low.d, t: { rmin: low.t.rmin, pts: low.t.pts } } : null };
    }

    return { routeFor: routeFor, lowerFor: lowerFor, barrierCandidates: barrierCandidates, markedRoute: markedRoute, arcsOf: arcsOf, componentOf: componentOf,
             enclosingCurves: enclosingCurves, loopStart: loopStart, segIntersection: segIntersection, makeBand: makeBand,
             arrivalSide: arrivalSide, trialMove: trialMove, armFor: armFor, tangentsAt: tangentsAt, sideTest: sideTest,
             choosePort: choosePort, cornerProbe: cornerProbe, roomFor: roomFor, jobOf: jobOf, armedOf: armedOf };
  }

  var api = { create: create, STEP: STEP };
  root.SproutsMoves = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : this);
