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
  var Th = root.SproutsThin || require('./thin.js');
  var STEP = 4;          // arc-length spacing of a resampled polyline (ui.js uses it for strokes too)
  var TOL = 1.5;         // largest allowed distance between the relaxed band and the fitted spline (ui.js uses it too)
  var CERT = 0.6;        // the fitted spline must keep this share of the minimum clearance (ui.js finishBand, trialMove)

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
          arcOf = arcsOf(cycles[ciA], a, b, ar.start);
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
        } else if (mh && G.dist(pa, pb) < 2 * keepR) {
          /* (v178) A and B so close that their neighbourhoods (keep: no barrier there) meet — Peter's 60-seed
             game, 27 → 63 with 63 the next spot along 27's curve: the shortest way slipped from A to B between
             the trees, round nothing. As for a loop: the curve and the marked arc together must go round the
             marked side, so a ray from a marked boundary crosses them an odd number of times — the curve's
             share is wanted odd or even as the arc's own crossings make it. */
          /* v182 (Peter's 60-seed game, 36 → 167 enclosing 140-21, 36-167-44 a short path in the middle of the
             region bounded by 21-140): when the marked side holds the region's OUTER boundary (mRef), that side
             is the outside of the closed curve (curve + marked arc) in the plane, and what must lie inside it is
             the unmarked side — an unmarked boundary, else the other arc at its point farthest from both ends
             (here 44: the curve goes round the stub 167-44). Before, the ray came from the outer boundary and
             asked for it inside: no path, "could not route around the marks". The ray keeps away from the ends'
             neighbourhoods (keep) if it can, else only from the parts of the curve the walk does not cover
             (within the rings round A and B): 44 is 23 px from 167. */
          var srcM = null;
          (mRef ? U : M).some(function (pts) { if (pts.length) { srcM = pts[Math.floor(pts.length / 2)]; return true; } return false; });
          if (!srcM && mRef) {
            var far = -1;
            uh.forEach(function (kh) { cycles[ownBd.cycle].halves[kh].pts.forEach(function (q) { var f = Math.min(G.dist(q, pa), G.dist(q, pb)); if (f > far) { far = f; srcM = q; } }); });
          }
          if (srcM) {
            var r1 = null;
            [keepR, pl.ring].forEach(function (away) {
              for (var d1 = 0; d1 < 36 && !r1; d1++) {
                var rr = Rt.ray(srcM, 2 * Math.PI * (d1 + 0.37) / 36);
                if (G.distPointSeg(pa, rr[0], rr[1]) >= away && G.distPointSeg(pb, rr[0], rr[1]) >= away) r1 = rr;
              }
            });
            if (!r1) return;
            var arcCross = 0;
            mh.forEach(function (kh) { var hp = cycles[ownBd.cycle].halves[kh].pts; for (var q = 0; q + 1 < hp.length; q++) if (G.segCross(hp[q], hp[q + 1], r1[0], r1[1])) arcCross++; });
            rays = [r1]; wanted = [(1 + arcCross) % 2];
            /* and the strip between A and B is closed to the curve: else it leaves A along the arc and has
               to come back to B past A, within a few pixels of it (Peter's game: "No room: the curve comes too
               close to something to be smoothed"). Cells beside the segment A–B whose foot lies between the
               two, nearer it than the ends' neighbourhoods reach — except where the walk starts (beside A) and
               the cells it may end in (B's ring): the curve leaves A away from B and reaches B from beyond it. */
            var strip = new Uint8Array(n), abx = pb[0] - pa[0], aby = pb[1] - pa[1], ab2 = abx * abx + aby * aby;
            for (var k12 = 0; k12 < n; k12++) {
              strip[k12] = trees[k12];
              var qc = [(k12 % grid.nx + 0.5) * c, (Math.floor(k12 / grid.nx) + 0.5) * c], tf = ((qc[0] - pa[0]) * abx + (qc[1] - pa[1]) * aby) / ab2;
              if (tf > 0 && tf < 1 && G.distPointSeg(qc, pa, pb) < keepR && G.dist(qc, pl.start) > 2 * c && G.dist(qc, pb) > pl.ring) strip[k12] = 1;
            }
            trees = strip;
          }
        }
        var path = Rt.pathWithParity(grid, obs, pl.start, pb, pl.ring, rays, wanted, ar.bside, trees);
        if (!path) return;
        if (loop) {                                  // (v178: a curve A → B with a ray keeps its walk — the outline would lose the side B is reached by)
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
      if (!loop && ciA !== undefined) arcOf = arcsOf(cycles[ciA], a, b, ar.start);
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
       round to b's, 2 the rest. a's corner is the one facing `start`; b's, when
       b has two on the cycle, the one facing the direction `bdir` from b (the
       side the move reaches b from), or the `pick`-th. Null if the arcs cannot be told. */
    function arcsOf(cyc, a, b, start, bdir, pick) {
      var hv = cyc.halves, n = hv.length, atA = [], atB = [], k;
      hv.forEach(function (h, k) { if (h.tail === a) atA.push(k); if (h.tail === b) atB.push(k); });
      if (!atB.length || !atA.length) return null;
      function corner(at, s, ang) {                // the corner of spot s whose sector holds the direction ang
        var P0 = S.game.spots[s], kk = -1;
        at.forEach(function (k) {
          var prev = hv[(k + n - 1) % n], back = Math.atan2(prev.pts[prev.pts.length - 2][1] - P0.y, prev.pts[prev.pts.length - 2][0] - P0.x);
          var lo = hv[k].angle, span = back - lo; span -= 2 * Math.PI * Math.floor(span / (2 * Math.PI));   // sector from the outgoing curve round to the incoming one
          var t = ang - lo; t -= 2 * Math.PI * Math.floor(t / (2 * Math.PI));
          if (t < span) kk = k;
        });
        return kk;
      }
      var kA = atA.length > 1 ? corner(atA, a, Math.atan2(start[1] - S.game.spots[a].y, start[0] - S.game.spots[a].x)) : atA[0];
      var kB = atB.length === 1 ? atB[0] : bdir ? corner(atB, b, Math.atan2(bdir[1], bdir[0])) : pick !== undefined ? atB[pick] : -1;
      if (kA < 0 || kB === undefined || kB < 0) return null;
      var out = [], len = (kB - kA + n) % n;
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

    /* The starting circle for a loop round nothing at spot a of gm (null: every circle crosses something).
       v181 (Peter's game of 10/19, 34 → 34 in a pocket 29–39 px wide): every size is tried, not a list
       (it tried radii 1.5·D, D and 0.6·D only — even the smallest, 48 px across, crossed the pocket's
       curves, and the computer's move went to R and Z for nothing). In each of 24 directions, the circle
       through the spot of every whole-pixel radius up to 1.5·D (the largest tried before); a circle's
       worth is the least of its clearance from everything else and the room inside it — its width less
       the discs of the spot and of the new spot riding opposite (a bigger loop is no better once it is
       roomy); the best of all is taken. A circle too tight
       for the band to start from is returned all the same: makeBand refuses it for lack of room, and
       room is made for it like any other move. */
    function loopStart(gm, a, obs) {
      var A = gm.spots[a], pa = [A.x, A.y];
      var ctx = { aIdx: a, bIdx: a, A: pa, B: pa, rho: S.route.D * Math.SQRT2, spotR: S.spotR };
      var best = null, bestClear = -Infinity, top = Math.floor(1.5 * S.route.D);
      for (var k = 0; k < 24; k++) {
        var ang = 2 * Math.PI * k / 24;
        for (var r = 1; r <= top; r++) {
          var inside = 2 * (r - S.spotR);
          if (!(inside > bestClear)) continue;    // (its worth cannot beat the best)
          var cx = pa[0] + r * Math.cos(ang), cy = pa[1] + r * Math.sin(ang), pts = [];
          for (var m = 0; m <= 36; m++) { var t = ang + Math.PI + 2 * Math.PI * m / 36; pts.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]); }
          pts[0] = pa; pts[36] = pa;
          if (R.polylineCrossesObstacle(obs, pts)) continue;
          var clear = inside;
          for (m = 3; m < 34 && clear > bestClear; m++) clear = Math.min(clear, R.rObs(obs, ctx, pts[m]));
          if (clear > bestClear) { bestClear = clear; best = pts; }
        }
      }
      return best;
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
    /* v164 (Peter's game of 10/14: 20 → 7 by clicking, "The curve passes through or touches something"):
       the part of a route inside its end spots' discs is replaced by a straight piece from the spot to
       where the route leaves the disc. Inside a disc the route means nothing (curves are drawn to the
       spot's center), but a route turning there — leaving spot 20 westward and bending south toward 7 —
       had its fourth point 22 px along it yet only 0.7 px outside spot 20's disc (30 px wide since v160),
       which the band's rule against coming back to its own end spots (rSelf: dA < SELF_RATIO · s) counts
       as clearance 0.7 < MIN_START: the band could not start. Kept only if the straight pieces cross
       nothing (makeBand's checks below); else the route as it was. */
    function leaveDiscs(P, pa, pb, r) {
      var n = P.length - 1, i = 1, j = n - 1;
      while (i < n && G.dist(P[i], pa) < r) i++;
      while (j > i && G.dist(P[j], pb) < r) j--;
      if (i >= n || j < i || (i === 1 && j === n - 1)) return P;   // (all of it inside, or nothing to cut)
      return [P[0]].concat(P.slice(i, j + 1), [P[n]]);
    }
    /* The elastic band for a move from a to b along the polyline P (in the
       current `game`), or a message string saying why not. */
    function makeBand(a, b, P, obs) {
      var A = S.game.spots[a], B = S.game.spots[b], pa = [A.x, A.y], pb = [B.x, B.y], loop = a === b;
      var ctx = { aIdx: a, bIdx: b, A: pa, B: pb, rho: S.route.D * Math.SQRT2, spotR: S.spotR };
      var P1 = leaveDiscs(P, pa, pb, S.spotR);
      if (P1 !== P && !R.polylineCrossesObstacle(obs, P1) && !R.polylineCrossesItself(P1)) P = P1;
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
      if (!rt) return 'No room: the curve comes too close to something to be smoothed.';   // (v165: was "The curve passes through or touches something." — a refusal for lack of room, ui.js startRoute)
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
      var saved = S.game, savedD0 = S.route.d0, savedNote = S.note, savedCell = S.route.cellD0;
      S.game = gm;                                    // choosePort, tangentsAt and markedRoute read `game`
      /* v148: at a lower clearance the grids are told the Settings' clearance (ctx.cellD0): a marked
         route's parity search on their finer cells may be no larger than at the Settings' (route.js) */
      if (opt.d0) { if (S.route.cellD0 === undefined) S.route.cellD0 = savedD0; S.route.d0 = opt.d0; }
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
          var ctx = { aIdx: a, bIdx: -1, A: pa, B: pa, rho: S.route.D * Math.SQRT2, spotR: S.spotR, cellD0: S.route.cellD0 };
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
        if (rt.error) return null;
        /* v183 (Peter's 60-seed game by hand, 26 → 26: the band kept 11 px, the fitted spline 1.5 px; making
           room said "the move fits already" and did nothing, and R had to): the fitted spline is judged too, as
           finishBand judges it — its clearance, scaled to the band's (÷ CERT), counts when it falls short */
        var rmin = rt.state.rmin, at = rt.state.rminAt;
        if (rmin >= S.route.d0) {
          var fit = G.fitClamped(G.resample(rt.pts, STEP), rt.dirA, rt.dirB, TOL, { minPiece: 12 });
          var cert = R.certify(obs, rt.move.ctx, fit.pieces, CERT * S.route.d0);
          if (!cert.ok && cert.clearance / CERT < rmin) { rmin = cert.clearance / CERT; at = cert.at; }
        }
        return { E: rt.state.E, rmin: rmin, at: at, pts: rt.pts };   // (at, v213: where the narrowest place is)
      } finally { S.game = saved; S.route.d0 = savedD0; S.note = savedNote; S.hush--; if (savedCell === undefined) delete S.route.cellD0; }
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
      var ctx = { aIdx: a, bIdx: -1, A: pa, B: pa, rho: S.route.D * Math.SQRT2, spotR: S.spotR, cellD0: S.route.cellD0 };
      var ar = { a: a, spot: pa, start: start, obs: obs, an: an, region: reg, boundary: -1, marks: {}, arcMarks: {}, markedSpots: ar0.markedSpots,
                 planner: Rt.planner(obs, ctx, S.route.d0, gm.W0, gm.H0, start, S.spotR) };
      reg.boundaries.forEach(function (bd, k) { if (bd.spots.indexOf(a) >= 0) ar.boundary = k; });
      /* v208: the start may lie in a region A does not border — roomFor probes a slid spot from a point 12 px
         off its curve, which can fall across something — and then there is no armed state: the trial move does
         not fit from there. (markedRoute read reg.boundaries[-1].cycle and the room worker died with "a script
         error", twice in Peter's 30-seed game of 10/30.) */
      if (ar.boundary < 0) return null;
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
          var ms = (mc.seeds || []).filter(function (m) { return m.px >= 0.5; }).sort(function (x, y) { return y.px - x.px; });   // (v188: seeds moved out of the way)
          var parts = [];
          if (ms.length) parts.push('moved spot' + (ms.length > 1 ? 's ' : ' ') + ms.map(function (m) { return m.name + ' (' + Math.round(m.px) + ' px)'; }).join(', '));
          if (mv.length) parts.push('moved curve' + (mv.length > 1 ? 's ' : ' ') + mv.map(function (m) { return m.name + ' (up to ' + Math.round(m.px) + ' px)'; }).join(', '));
          what.push(parts.join(' and ') + (mc.rounds > 1 ? ', in ' + mc.rounds + ' rounds' : ''));
        }
      }
      if (!g2) return { fail: true, brief: brief, why: why };
      return { game: g2, start: start, fitted: fitted, what: what };
    }

    /* THE THIN ROUTE (thin branch, Peter 10/30: "infinitely small points, and infinitely thin lines"): the
       move of the armed state ar to spot b as a polyline from a's centre to b's that crosses and touches
       nothing however narrow the way — a walk through the triangulation of the drawing (thin.js), or, when
       the move encloses something, the hug (thinMarked). The sides at a and b are the triangulation's
       (Router.sideAt), from the direction of the click (start, bsideDir) or the computer's corner (bdir).
       { path, tri, router, clearance } or { fail: why }. Spots are points here: the curve may pass over a
       spot's disc, never through its centre. */
    function thinRoute(ar, b) {
      var gm = S.game, a = ar.a, A = gm.spots[a], eps = Th.startEps(gm), why = null;
      var sideA = A.deg === 2 && ar.start ? [ar.start[0] - A.x, ar.start[1] - A.y] : null, okA;
      var sideB = b !== a && gm.spots[b].deg === 2 ? ar.bsideDir || ar.bdir || null : null, okB;   // (bdir: the computer's)
      var marked = Object.keys(ar.marks || {}).length || Object.keys(ar.arcMarks || {}).length || ar.encloseNone || ar.mArc;
      /* the curves' polygons are refined where the walk comes nearer to a curve than its polygon is to it */
      for (var round = 0; round < 24; round++) {
        var rt = Th.router(gm, eps);
        if (rt) eps = rt.tri.eps;                  // (refined where curves' polygons crossed)
        if (!rt) return { fail: 'the drawing could not be triangulated' };
        /* the sides at a and b, as the triangulation has them */
        okA = sideA ? rt.sideAt(a, sideA) : null;
        okB = sideB ? rt.sideAt(b, sideB) : ar.bside || null;
        var P = null;
        if (marked) {
          P = thinMarked(ar, b, rt, okA, okB);
          if (!P) {
            /* a narrow way that free points kept out of — nearer to a curve's polygon than twice its tolerance
               (thin.js refineFree): those polygons refined, and again (measured: a loop round a component through
               a gap of a pixel, refused at once) */
            var sk = rt.unconnected ? Object.keys(rt.skipped || {}).map(Number) : [], tr0 = rt.tri, more = false;
            sk.forEach(function (L) { var e = tr0.legEdge[L], k = tr0.legPiece[L], to = tr0.legEps[L] / 16; if (tr0.legEps[L] > 1e-12 && to >= 1e-9 && to < eps[e][k]) { eps[e][k] = to; more = true; } });
            if (!more) return { fail: 'no way round the marked spots was found' };
            why = 'no way round the marked spots was found';
            continue;
          }
        }
        if (!P) P = a === b ? rt.loopNothing(a, okA) : rt.route(a, b, okA, okB, S.route.d0);
        if (!P) return { fail: 'spot ' + (b + 1) + ' cannot be reached from that side' };
        var cert = Th.certify(rt.tri, P, 0, a, b);
        if (cert.ok) { Th.remember(gm, eps); return { path: P, tri: rt.tri, router: rt, clearance: cert.clearance }; }
        if (!cert.near.length) { why = 'the curve would touch a spot or itself'; break; }
        var tr = rt.tri;
        cert.near.forEach(function (L) { var e = tr.legEdge[L], k = tr.legPiece[L]; eps[e][k] = Math.min(eps[e][k], tr.legEps[L] / 16); });
        why = 'the way is narrower than the arithmetic can certify';
      }
      return { fail: why };
    }
    /* A thin route that honours the marks (thin branch) — by THE HUG (thin.js Router.hug, 10/31): the curve is
       the outline of what it must enclose. The blob: for a move a → b on one boundary, the arc of that
       boundary that goes with the marked side (the computer names it: mArc; a marked spot on it says which;
       else both arcs are tried); for a loop, the spot a, with a's own boundary when that is marked; and every
       marked boundary hung on it by the shortest path through free points. (Before: walls on both sides and
       crossing parities of cut rays — the walls fenced each other in, the parities came with curves that
       crossed themselves.) Each candidate is judged by the engine: every boundary must be on its side
       (relative to the outside, or the region's outer boundary, when there is one), loose seeds counted for
       the computer (ar.seedsAlike). The polyline, or null. */
    function thinMarked(ar, b, rt, okA, okB) {
      var gm = S.game, a = ar.a, loop = a === b, reg = ar.region, an = ar.an, own = reg.boundaries[ar.boundary], tv = rt.tri.vid;
      var cyc = own.cycle !== undefined ? an.cycles[own.cycle] : null;     // (none: a is a lone spot)
      if (!loop && (!cyc || own.spots.indexOf(b) < 0)) return rt.route(a, b, okA, okB, S.route.d0);   // (b on another boundary: the move encloses nothing)
      /* the judge: what has a side, and which */
      var items = [], anchor = -1;
      reg.boundaries.forEach(function (bd, k) {
        if (k === ar.boundary) {
          if (loop) { var rest = bd.spots.filter(function (sp) { return sp !== a; }); if (rest.length) items.push({ spot: rest[0], marked: Object.keys(ar.arcMarks).length > 0 }); }
          return;
        }
        if (reg.key >= 0 && bd.cycle === reg.key) { anchor = items.length; items.push({ spot: bd.spots[0], marked: !!ar.marks[k], anchor: true }); return; }
        items.push({ spot: bd.spots[0], marked: !!ar.marks[k], seed: bd.spot !== undefined && gm.spots[bd.spot].deg === 0 });
      });
      if (reg.key === -1) { anchor = items.length; items.push({ outside: true, marked: false, anchor: true }); }
      function judge(P) {
        var af = E.afterMove(gm.spots, gm.edges, a, b, P);
        if (!af.split || !af.left || !af.right) return false;
        var sd = items.map(function (it) {
          var l = it.outside ? af.left.key === -1 : af.left.spots.indexOf(it.spot) >= 0, r = it.outside ? af.right.key === -1 : af.right.spots.indexOf(it.spot) >= 0;
          return l && !r ? 1 : r && !l ? 0 : -1;
        });
        if (anchor >= 0) { if (sd[anchor] < 0) return false; sd = sd.map(function (v, i) { return i === anchor ? -1 : v < 0 ? -1 : v ^ sd[anchor]; }); }
        var sides = anchor < 0 ? [0, 1] : [items[anchor].marked ? 0 : 1];   // (the anchor's side is 0: the marked go there if it is marked itself)
        for (var si = 0; si < sides.length; si++) {
          var ms = sides[si];
          var good = true, inS = 0, needS = 0;
          items.forEach(function (it, i) {
            if (i === anchor || sd[i] < 0) return;
            if (ar.seedsAlike && it.seed) { if (it.marked) needS++; if (sd[i] === ms) inS++; return; }
            if (sd[i] !== (it.marked ? ms : 1 - ms)) good = false;
          });
          if (good && inS === needS) return true;
        }
        return false;
      }
      /* the blob's parts as triangulation vertices and polygon legs */
      var ids = rt.tri.polyIds;
      function legsOfHalf(h) { var q = ids[h.edge]; if (h.id & 1) q = q.slice().reverse(); var out = []; for (var k = 1; k < q.length; k++) out.push([q[k - 1], q[k]]); return out; }
      function part(bd) {
        if (bd.cycle === undefined) return { verts: new Set([tv[bd.spot]]), legs: [] };
        var verts = new Set(), legs = [];
        an.cycles[bd.cycle].halves.forEach(function (h) { legsOfHalf(h).forEach(function (l) { legs.push(l); verts.add(l[0]); verts.add(l[1]); }); });
        bd.spots.forEach(function (sp) { verts.add(tv[sp]); });
        return { verts: verts, legs: legs };
      }
      var holes = [];
      reg.boundaries.forEach(function (bd, k) { if (k !== ar.boundary && ar.marks[k]) holes.push(part(bd)); });
      var n0 = rt.refineFree(Array.from(rt.regionOf(rt.at(a, okA))));
      var region = rt.regionOf(rt.at(a, okA));
      var o = { va: tv[a], vb: tv[b], holes: holes, okA: okA, n0: n0, region: region, arc: [], d0: S.route.d0 };
      /* the outline goes into every corner between curves at a spot to its tip, near both curves there:
         straightened (simplify: across the corner's mouth, no spot cut off — the same move) */
      function hug() { var Q = rt.hug(o); return Q ? rt.simplify(Q, o.va, o.vb, S.route.d0) : null; }
      if (loop) {
        var ownMarked = Object.keys(ar.arcMarks || {}).length > 0;
        if (!holes.length && !ownMarked) return rt.loopNothing(a, okA);
        if (ownMarked && cyc) o.base = part(own);
        var P1 = hug();
        return P1 && judge(P1) ? P1 : null;
      }
      /* the arcs of a's boundary from a to b: arcOf[k] = 1 for the half-edges from a's corner round to b's */
      /* (b twice on the boundary, no side chosen at it: each of its corners in turn) */
      var arcOfs = ar.mArc && ar.mArc.length ? [cyc.halves.map(function (h, k) { return ar.mArc.indexOf(k) >= 0 ? 1 : 2; })]
        : [0, 1].map(function (pick) { return arcsOf(cyc, a, b, ar.start, ar.bsideDir || ar.bdir, pick); }).filter(function (x, i, all) { return x && (i === 0 || JSON.stringify(x) !== JSON.stringify(all[0])); });
      var n = cyc.halves.length, arcOf;
      function arcLegs(which) {                    // the legs of arc `which`, directed from a to b
        var k0 = -1;
        for (var k = 0; k < n; k++) if (arcOf[k] === which && arcOf[(k - 1 + n) % n] !== which) k0 = k;
        if (k0 < 0) return null;
        var legs = [];
        for (var j = 0; j < n && arcOf[(k0 + j) % n] === which; j++) legsOfHalf(cyc.halves[(k0 + j) % n]).forEach(function (l) { legs.push(l); });
        o.left = true;                             // (the engine's boundary cycles have their region on the left)
        if (legs.length && legs[0][0] !== tv[a]) { legs = legs.reverse().map(function (l) { return [l[1], l[0]]; }); o.left = false; }   // (a run from b round to a)
        return legs.length && legs[0][0] === tv[a] && legs[legs.length - 1][1] === tv[b] ? legs : null;
      }
      for (var c = 0; c < arcOfs.length; c++) {
        arcOf = arcOfs[c];
        var mk = ar.mArc && ar.mArc.length ? 1 : 0;
        Object.keys(ar.arcMarks || {}).map(Number).forEach(function (sp) { cyc.halves.forEach(function (h, k) { if (h.tail === sp && sp !== a && sp !== b) mk = arcOf[k]; }); });
        var tries = mk ? [mk] : [1, 2];
        for (var i = 0; i < tries.length; i++) {
          var legs = arcLegs(tries[i]);
          if (!legs || !legs.length) continue;
          o.arc = legs;
          var P2 = hug();
          if (P2 && judge(P2)) return P2;
        }
      }
      return null;
    }

    /* The curve for a thin route's path: SMOOTH, with no pixel sizes (Peter 10/31: "Shouldn't pixel size be
       entirely irrelevant?" — "Let's get rid of the band entirely!"). A curve THROUGH points of the polyline
       with no corners (throughPoints, leaving a and reaching b along the polyline's end legs),
       first through its own corners; checked against the drawing piece by piece (thin.js certify, each piece's
       polygon within its own tolerance). Where a piece fails, by comparison, not by size: if it would pass with
       its polygon exact (its margin is no worse than its tolerance), its polygon is made four times closer to
       it; else it gets a point halfway along the polyline between its ends — the spline then follows the
       polyline more closely there, and in the limit it is the polyline, which crosses and touches nothing. So
       tight stretches get as many points as their room needs, wide ones keep few. The floor is the
       arithmetic's (1e-9 px, as thin.js): below it, the polyline itself (straight pieces: exact).
       (Before, 10/30–31: an elastic band relaxed from the polyline, its points STEP = 4 px apart, then one
       spline through them — refused wherever the room was a fraction of those 4 px: 2 thin curves in 3.)
       { pieces, h, smooth, clearance } */
    var ARITH = 1e-9;
    /* A curve through the points Q with no corners, made of one cubic piece per leg: at each inner point the
       direction halfway between those of its two legs, the handles a third of the leg along it (leaving Q[0]
       in direction dA, reaching the last in dB). LOCAL — a new point changes only the pieces next to it (the
       C2 spline through the points, G.interpolate, rang far along the curve where legs of very different
       lengths met, and adding points made it worse: measured, a 6082-leg polygon still crossing) — and as
       the points come closer the pieces come closer to the legs, at a corner too. */
    function throughPoints(Q, dA, dB) {
      var n = Q.length, m = [dA], pieces = [], h = [];
      for (var i = 1; i + 1 < n; i++) {
        var l0 = G.dist(Q[i - 1], Q[i]) || 1, l1 = G.dist(Q[i], Q[i + 1]) || 1;
        var x = (Q[i][0] - Q[i - 1][0]) / l0 + (Q[i + 1][0] - Q[i][0]) / l1, y = (Q[i][1] - Q[i - 1][1]) / l0 + (Q[i + 1][1] - Q[i][1]) / l1, l = Math.hypot(x, y);
        m.push(l > 0 ? [x / l, y / l] : [(Q[i + 1][0] - Q[i][0]) / l1, (Q[i + 1][1] - Q[i][1]) / l1]);   // (a leg straight back: the next leg's direction)
      }
      m.push(dB);
      m[1] = dA; m[n - 2] = dB;                    // (the first and last pieces straight: see smoothThin)
      for (i = 0; i + 1 < n; i++) {
        var d = G.dist(Q[i], Q[i + 1]) / 3;
        pieces.push([Q[i], [Q[i][0] + m[i][0] * d, Q[i][1] + m[i][1] * d], [Q[i + 1][0] - m[i + 1][0] * d, Q[i + 1][1] - m[i + 1][1] * d], Q[i + 1]]);
        h.push(3 * d);
      }
      return { pieces: pieces, h: h };
    }
    function thinCurve(res, a, b, smooth) {
      var P = res.path;
      if (smooth !== false && P.length >= 3 && res.tri) {
        var c = smoothThin(res, a, b);
        if (c) return c;
      }
      var pieces = E.polylinePieces(P);
      return { pieces: pieces, h: pieces.map(function (pc) { return G.dist(pc[0], pc[3]); }), smooth: false, clearance: res.clearance };
    }
    function smoothThin(res, a, b) {
      var P = res.path, n = P.length, k, m = res.tri.mesh, va = res.tri.vid[a], vb = res.tri.vid[b];
      if (n < 3) return null;
      /* THE ENDS: straight only as far as the end leg runs inside its first triangle at the spot — there a leg is
         only required not to cross the curves meeting at the spot (thin.js certify exempts a curve's end legs);
         beyond, the curve bends freely. (The whole end leg straight, 10/31: after simplify an end leg can be
         hundreds of px — Peter's loop at 5, a straight 287 px leg.) */
      function exit(v, p, q) {                     // where the leg p → q from vertex v leaves its triangle at v (or q)
        var hs = m.around(v), Pm = m.P;
        for (var t = 0; t < hs.length; t++) {
          var h = hs[t], x = Pm[m.T[Th.nxt(h)]], y = Pm[m.T[Th.prv(h)]];
          if (!(Th.orient(p, x, q) >= 0 && Th.orient(p, q, y) >= 0)) continue;   // (q's direction in this triangle's corner at v)
          var d1 = (q[0] - p[0]) * (y[1] - x[1]) - (q[1] - p[1]) * (y[0] - x[0]);
          if (!d1) return q;
          var f = ((x[0] - p[0]) * (y[1] - x[1]) - (x[1] - p[1]) * (y[0] - x[0])) / d1;
          return f > 0 && f < 1 ? [p[0] + f * (q[0] - p[0]), p[1] + f * (q[1] - p[1])] : q;
        }
        return q;
      }
      var e1 = exit(va, P[0], P[1]), e2 = exit(vb, P[n - 1], P[n - 2]);
      P = [P[0]].concat(e1 === P[1] ? [] : [e1], P.slice(1, n - 1), e2 === P[n - 2] ? [] : [e2], [P[n - 1]]);
      n = P.length;
      if (n < 4) return null;                      // (two legs only: a corner between its end legs — it stays a polyline)
      var U = [0];
      for (k = 1; k < n; k++) U.push(U[k - 1] + G.dist(P[k - 1], P[k]));
      function at(s) {                             // the polyline's point at arc length s
        var lo = 0, hi = n - 1;
        while (hi - lo > 1) { var md = (lo + hi) >> 1; if (U[md] <= s) lo = md; else hi = md; }
        var t = (s - U[lo]) / ((U[hi] - U[lo]) || 1);
        return t <= 0 ? P[lo] : t >= 1 ? P[hi] : [P[lo][0] + t * (P[hi][0] - P[lo][0]), P[lo][1] + t * (P[hi][1] - P[lo][1])];
      }
      function unit(p, q) { var l = G.dist(p, q) || 1; return [(q[0] - p[0]) / l, (q[1] - p[1]) / l]; }
      var dA = unit(P[0], P[1]), dB = unit(P[n - 2], P[n - 1]);
      /* the curve's points (arc lengths along the polyline): to begin with, only the ends of its straight end
         pieces — ONE piece between them, as loose as it comes, cutting every corner; a point is added halfway
         along the polyline only where the certificate finds a piece too near something. Wide stretches keep
         long loose pieces, tight places get points where they need them. (10/31 first: a piece was also cut
         wherever its middle strayed farther from the polyline than the polyline had room — the curve then
         clung to the polyline everywhere, a polygon with rounded corners, and thousands of pieces.) */
      /* the room of each leg of the polyline (up to half its length), for the polygons' tolerances */
      var rr = res.router, room = [];
      for (k = 0; k + 1 < n; k++) {
        var lk = U[k + 1] - U[k], rk = rr ? rr.legClear(P[k], P[k + 1], va, vb, k === 0, k === n - 2, lk / 2) : lk / 2;
        room.push(rk > 0 ? rk : lk / 2);
      }
      function roomOf(s0, s1) {                    // the least room of the polyline's legs between s0 and s1
        var r = Infinity;
        for (var q = 0; q + 1 < n; q++) if (U[q + 1] > s0 && U[q] < s1) r = Math.min(r, room[q]);
        return r;
      }
      /* a piece's polygon tolerance, to begin with: half the least room of its stretch of the polyline (no more
         is of any use; a looser one — the control polygon — made the certificate look far and wide: out of
         memory), made four times closer where the certificate asks for it. A piece cut in two: each half from
         its own stretch, or as close as its parent had been made (a half that took its parent's tolerance
         always gave every piece the least room of the whole curve: 196,767 polygon points for 2466 pieces) */
      function tolOf(s0, s1) { return Math.min((s1 - s0) / 2, roomOf(s0, s1)) / 2; }
      function half(j, s0, s1) { return tight[j] ? Math.min(tol[j], tolOf(s0, s1)) : tolOf(s0, s1); }
      var sv = [0, U[1], U[n - 2], U[n - 1]], tol = [0, tolOf(U[1], U[n - 2]), 0], tight = [false, false, false];   // (tight: made closer by the certificate)
      for (;;) {
        var fit = throughPoints(sv.map(at), dA, dB), pts = [fit.pieces[0][0]], legE = [], legN = [], legPc = [];
        fit.pieces.forEach(function (pc, j) {
          if (j === 0 || j === fit.pieces.length - 1) { pts.push(pc[3]); legE.push(0); legN.push(0); legPc.push(j); return; }   // (the straight end pieces: one leg each, the end legs certify exempts at the spots)
          var rp = G.refinedPolygon([pc], tol[j], Infinity), nj = roomOf(sv[j], sv[j + 1]) / 2;
          for (var q = 1; q < rp.pts.length; q++) { pts.push(rp.pts[q]); legE.push(rp.eps); legN.push(nj); legPc.push(j); }
        });
        /* (v229) a piece keeps HALF THE ROOM of its stretch of the polyline from every spot and every other curve
           (legN) — not just "touching nothing": a loose piece used to bow past a spot at 0.0007 px of its centre
           (Peter's 200-seed game of 11/1), and R could not move the picture afterwards. Cut nearer the polyline,
           which has that room, the curve always gets it. */
        var cert = Th.certify(res.tri, pts, legE, a, b, legN), worst = {};   // (worst: each failing piece — its worst margin, and the tolerance it had)
        if (cert.ok) {
          /* touching nothing is not yet the same move: a piece could have jumped a spot between two rounds — so
             no spot may lie between the curve and the polyline (even–odd round the two; the curve's polygon is
             farther from every spot than it is from the curve, so the polygon's side is the curve's). A spot
             there: the piece nearest to it gets a point. */
          var ring = P.concat(pts.slice().reverse()), off = [];
          S.game.spots.forEach(function (sp, si) { if (si !== a && si !== b && G.pointInPolygon([sp.x, sp.y], ring)) off.push([sp.x, sp.y]); });
          if (!off.length) return { pieces: fit.pieces, h: fit.h, smooth: true, clearance: cert.clearance };
          /* the piece that has it: between the piece and its stretch of the polyline (the piece nearest to the spot
             need not be — cutting that one again and again, it came down to the arithmetic and the curve stayed
             a polyline: Peter's loop at 7, 10/31) */
          var start = [0];
          for (var L0 = 1; L0 <= legPc.length; L0++) if (L0 === legPc.length || legPc[L0] !== legPc[L0 - 1]) start.push(L0);
          off.forEach(function (q) {
            for (var jj = 1; jj + 1 < fit.pieces.length; jj++) {
              var ring2 = pts.slice(start[jj], start[jj + 1] + 1), back = [];
              for (var kk = 0; kk < n; kk++) if (U[kk] > sv[jj] && U[kk] < sv[jj + 1]) back.push(P[kk]);
              ring2 = ring2.concat(back.reverse());
              if (G.pointInPolygon(q, ring2)) worst[jj] = { mg: -1, e: 0 };
            }
          });
        }
        Object.keys(cert.bad).forEach(function (L) {
          var j = legPc[L - 1], mg = cert.bad[L];
          if (!(worst[j] && worst[j].mg <= mg)) worst[j] = { mg: mg, e: legE[L - 1] };
        });
        var sv2 = [sv[0]], tol2 = [], tight2 = [], changed = false;
        delete worst[0]; delete worst[sv.length - 2];   // (the straight end pieces stay, the polyline's end legs — when they are found too near, it is to a piece next to them, which changes)
        for (var j = 0; j + 1 < sv.length; j++) {
          var w = worst[j];
          if (w && w.mg + w.e > 0 && tol[j] / 4 >= ARITH) {            // (its polygon too loose)
            tol2.push(tol[j] / 4); tight2.push(true); changed = true;
          } else if (w && sv[j + 1] - sv[j] >= 2 * ARITH) {           // (the spline too far from the polyline)
            var mid = (sv[j] + sv[j + 1]) / 2;
            sv2.push(mid); tol2.push(half(j, sv[j], mid), half(j, mid, sv[j + 1])); tight2.push(tight[j], tight[j]); changed = true;
            sv2.push(sv[j + 1]);
            continue;
          } else { tol2.push(tol[j]); tight2.push(tight[j]); }
          sv2.push(sv[j + 1]);
        }
        if (!changed) return null;
        sv = sv2; tol = tol2; tight = tight2;
      }
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
    /* A move drawn thin in a worker (v227, Peter 11/1: the page took seconds to react while a long or enclosing
       thin move was routed on its thread): the armed state rebuilt as routeFor does, plus what the thin router
       reads besides (boundary, seedsAlike, encloseNone), then thinRoute and thinCurve as the page runs them.
       { cv: { pieces, h, smooth, clearance } } or { fail: why }. */
    function thinFor(j) {
      var ar = armedOf(j);
      if (!ar) return { fail: 'the region of the move was not found in the worker (a bug)' };
      ar.boundary = j.boundary;
      if (j.seedsAlike) ar.seedsAlike = true;
      if (j.encloseNone) ar.encloseNone = true;
      if (j.bdir) ar.bside = arrivalSide(j.b, ar);
      var res = thinRoute(ar, j.b);
      if (!res.path) return { fail: res.fail };
      var cv = thinCurve(res, j.a, j.b);
      return { cv: { pieces: cv.pieces, h: cv.h, smooth: !!cv.smooth, clearance: cv.clearance } };
    }
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
             choosePort: choosePort, cornerProbe: cornerProbe, roomFor: roomFor, jobOf: jobOf, armedOf: armedOf, thinRoute: thinRoute, thinCurve: thinCurve, thinFor: thinFor };
  }

  var api = { create: create, STEP: STEP, TOL: TOL, CERT: CERT };
  root.SproutsMoves = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : this);
