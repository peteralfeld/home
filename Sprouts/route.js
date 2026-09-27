/* =========================================================================
   route.js — finding a route for a move the user did not draw: "from A
   (leaving on this side) to B, the shortest way". DOM-free (global
   SproutsRoute, or require()). Needs geom.js and relax.js.

   The free space is sampled on a square grid: a cell is free when its centre
   has effective clearance >= d0 (or nearly, see buildGrid) — the clearance the elastic band uses, with
   the angle rule applied near EVERY spot to that spot's own curves
   (ctx.scaleAll), so that the approach to a destination in a narrow corner
   between its two curves is open, as it will be for the band. Near a spot
   that is not the destination this only opens a dead-end pocket, since the
   spot itself blocks a disc of radius d0 + spotR. Dijkstra from the start
   gives the distance to every free cell at once, which answers both "which
   spots can be reached from here?" and "what is the shortest path to B?".
   The 8-connected grid path is within a few percent of the true shortest
   path and in the same homotopy class; the elastic band then tightens it
   into the exact geodesic with clearance. A curve blocks a band of width
   2 d0 and the cell is at most 0.7 d0, so the flood cannot leak through one.
   ========================================================================= */
(function (root) {
  'use strict';
  var G = root.SproutsGeom || require('./geom.js');
  var R = root.SproutsRelax || require('./relax.js');

  /* Sample the free space. ctx is the routing context for the start spot
     (aIdx = the spot, bIdx = -1: no destination yet). */
  function buildGrid(obs, ctx, d0, W, H) {
    var cell = Math.max(2, Math.min(8, 0.7 * d0));
    var nx = Math.ceil(W / cell), ny = Math.ceil(H / cell);
    var free = new Uint8Array(nx * ny), near = new Uint8Array(nx * ny), reach = ctx.rho + cell, slack = cell / Math.SQRT2;
    var clear = new Float32Array(nx * ny).fill(-Infinity);   // each centre's effective clearance (for `widest`)
    for (var j = 0; j < ny; j++) {
      for (var i = 0; i < nx; i++) {
        var p = [(i + 0.5) * cell, (j + 0.5) * cell], k = j * nx + i;
        if (p[0] >= W || p[1] >= H) continue;
        var r = R.rObs(obs, ctx, p);
        clear[k] = r;
        /* A cell is free when its centre has clearance d0 (1), or MARGINAL (2)
           when some point of it may have: a channel just over 2 d0 wide leaves
           a band of free points thinner than a cell, which the centres can all
           miss (Peter's game of 9/22: a 23 px channel at d0 = 10). The band
           settles the real clearance afterwards. */
        if (r >= d0) free[k] = 1;
        else if (r >= d0 - slack) { free[k] = 2; near[k] = 1; }
        /* Hops between two centres with clearance d0 cannot jump a curve (they
           would be 2 d0 > cell*sqrt2 apart); a hop from a marginal cell can, and
           near a spot the blocked strip along its curves narrows to an angle and
           can be thinner than a cell — so those hops are checked for crossings. */
        for (var s = 0; s < obs.spots.length && !near[k]; s++) if (G.dist(p, obs.spots[s].p) < reach) near[k] = 1;
      }
    }
    return { cell: cell, nx: nx, ny: ny, free: free, near: near, clear: clear, W: W, H: H };
  }

  function centre(grid, k) {
    return [(k % grid.nx + 0.5) * grid.cell, (Math.floor(k / grid.nx) + 0.5) * grid.cell];
  }

  /* Whether cell k keeps clear of everything: its centre's PLAIN clearance
     (no angle rule) exceeds half its diagonal plus the least clearance a band
     can start from. The walk that inflate turns into a curve (below) must use
     such cells: the boundary of the inflated set runs along cell borders, and
     a cell that a curve passes through, or nearly touches, puts a crossing or
     a touch into it (Peter's game of 9/23: a walk past spot 7 used cells cut
     by 7's own curve — free only by the angle rule near a spot — and the one
     candidate crossed that curve). A free cell that is not flagged `near` is
     clean: away from spots its centre's clearance is plain and at least d0,
     and d0 > 0.495·d0 + 1 ≥ cell/√2 + 1 for any d0 ≥ 2. So only the `near`
     cells (close to a spot, or marginal) are tested; cached. */
  var PLAIN = { aIdx: -2, bIdx: -2, A: [0, 0], B: [0, 0], rho: 0 };
  function cleanCell(grid, obs, k) {
    if (!grid.near[k]) return true;
    if (!grid.clean) grid.clean = new Uint8Array(grid.nx * grid.ny);
    if (!grid.clean[k]) grid.clean[k] = R.rObs(obs, PLAIN, centre(grid, k)) > grid.cell / Math.SQRT2 + R.MIN_START ? 1 : 2;
    return grid.clean[k] === 1;
  }

  /* Free cells whose centre lies within `radius` of p. */
  function cellsNear(grid, p, radius) {
    var out = [], c = grid.cell;
    var i0 = Math.max(0, Math.floor((p[0] - radius) / c)), i1 = Math.min(grid.nx - 1, Math.floor((p[0] + radius) / c));
    var j0 = Math.max(0, Math.floor((p[1] - radius) / c)), j1 = Math.min(grid.ny - 1, Math.floor((p[1] + radius) / c));
    for (var j = j0; j <= j1; j++) {
      for (var i = i0; i <= i1; i++) {
        var k = j * grid.nx + i;
        if (grid.free[k] && G.dist(centre(grid, k), p) <= radius) out.push(k);
      }
    }
    return out;
  }

  /* Dijkstra over the free cells from the point `start` (seeded with the free
     cells around it that can be reached from it without crossing a curve — the
     start may sit right next to one). Returns { dist, prev } over all cells. */
  function distances(grid, start, obs) {
    var n = grid.nx * grid.ny, dist = new Float64Array(n).fill(Infinity), prev = new Int32Array(n).fill(-1);
    var heap = [], nx = grid.nx, ny = grid.ny, c = grid.cell;
    function push(k, d) {                        // binary heap of [d, k]
      heap.push([d, k]);
      for (var i = heap.length - 1; i > 0;) {
        var p = (i - 1) >> 1;
        if (heap[p][0] <= heap[i][0]) break;
        var t = heap[p]; heap[p] = heap[i]; heap[i] = t; i = p;
      }
    }
    function pop() {
      var top = heap[0], last = heap.pop();
      if (heap.length) {
        heap[0] = last;
        for (var i = 0;;) {
          var l = 2 * i + 1, r = l + 1, m = i;
          if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
          if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
          if (m === i) break;
          var t = heap[m]; heap[m] = heap[i]; heap[i] = t; i = m;
        }
      }
      return top;
    }
    cellsNear(grid, start, 2 * c).forEach(function (k) {
      var q = centre(grid, k), d = G.dist(q, start);
      if (d < dist[k] && !R.polylineCrossesObstacle(obs, [start, q])) { dist[k] = d; push(k, d); }
    });
    var dx = [1, -1, 0, 0, 1, 1, -1, -1], dy = [0, 0, 1, -1, 1, -1, 1, -1];
    while (heap.length) {
      var top = pop(), k = top[1];
      if (top[0] > dist[k]) continue;
      var i = k % nx, j = (k - i) / nx;
      for (var q = 0; q < 8; q++) {
        var ii = i + dx[q], jj = j + dy[q];
        if (ii < 0 || jj < 0 || ii >= nx || jj >= ny) continue;
        var kk = jj * nx + ii;
        if (!grid.free[kk]) continue;
        if (q >= 4 && !(grid.free[j * nx + ii] && grid.free[jj * nx + i])) continue;  // no squeezing between corners
        if ((grid.near[k] || grid.near[kk]) && R.polylineCrossesObstacle(obs, [centre(grid, k), centre(grid, kk)])) continue;
        var nd = dist[k] + (q < 4 ? c : c * Math.SQRT2);
        if (nd < dist[kk]) { dist[kk] = nd; prev[kk] = k; push(kk, nd); }
      }
    }
    return { dist: dist, prev: prev };
  }

  /* The best free cell near p (within radius) by distance-from-start plus the
     straight hop to p — a hop that crosses nothing: a cell on the far side of
     a curve ending at p is not an approach to p; -1 if none is reachable. */
  function bestCellNear(grid, dd, p, radius, obs) {
    var best = -1, bd = Infinity;
    cellsNear(grid, p, radius).forEach(function (k) {
      var q = centre(grid, k), d = dd.dist[k] + G.dist(q, p);
      if (d < bd && !R.polylineCrossesObstacle(obs, [q, p])) { bd = d; best = k; }
    });
    return best;
  }

  /* How much room the best way from `start` to near p has: over all grid
     paths (through ANY cells, crossing nothing), the largest possible value of
     the smallest effective clearance met on the way — a widest-path search.
     Answers "why is B not lit?": B is reachable at minimum clearance d0 about
     when this is ≥ d0. A hop is checked for crossings when one of its cells is
     within a cell of something (otherwise it cannot cross: every point of the
     hop is within cell/√2 of one of its centres).
     widestField does the search once from `start` ({best, prev} per cell);
     widestTo reads it at a point p: { clearance, at } (at = the centre of the
     narrowest cell on the way), or null if nothing near p is reached. One
     field serves many end points (room.js tries every point of a curve). */
  function cellsAround(grid, q, radius) {        // all cells (free or not) with centre within radius of q
    var out = [], c = grid.cell, nx = grid.nx, ny = grid.ny;
    var i0 = Math.max(0, Math.floor((q[0] - radius) / c)), i1 = Math.min(nx - 1, Math.floor((q[0] + radius) / c));
    var j0 = Math.max(0, Math.floor((q[1] - radius) / c)), j1 = Math.min(ny - 1, Math.floor((q[1] + radius) / c));
    for (var j = j0; j <= j1; j++) for (var i = i0; i <= i1; i++) {
      var k = j * nx + i;
      if (grid.clear[k] > -Infinity && G.dist(centre(grid, k), q) <= radius) out.push(k);
    }
    return out;
  }
  function widestField(grid, obs, start) {
    var n = grid.nx * grid.ny, nx = grid.nx, ny = grid.ny, c = grid.cell, clear = grid.clear;
    var best = new Float32Array(n).fill(-Infinity), prev = new Int32Array(n).fill(-1), heap = [];
    function push(k, v) {                         // max-heap of [v, k]
      heap.push([v, k]);
      for (var i = heap.length - 1; i > 0;) {
        var q = (i - 1) >> 1;
        if (heap[q][0] >= heap[i][0]) break;
        var t = heap[q]; heap[q] = heap[i]; heap[i] = t; i = q;
      }
    }
    function pop() {
      var top = heap[0], last = heap.pop();
      if (heap.length) {
        heap[0] = last;
        for (var i = 0;;) {
          var l = 2 * i + 1, rr = l + 1, m = i;
          if (l < heap.length && heap[l][0] > heap[m][0]) m = l;
          if (rr < heap.length && heap[rr][0] > heap[m][0]) m = rr;
          if (m === i) break;
          var t = heap[m]; heap[m] = heap[i]; heap[i] = t; i = m;
        }
      }
      return top;
    }
    cellsAround(grid, start, 2 * c).forEach(function (k) {
      if (R.polylineCrossesObstacle(obs, [start, centre(grid, k)])) return;
      if (clear[k] > best[k]) { best[k] = clear[k]; push(k, clear[k]); }
    });
    var dx = [1, -1, 0, 0, 1, 1, -1, -1], dy = [0, 0, 1, -1, 1, -1, 1, -1];
    while (heap.length) {
      var top = pop(), k = top[1];
      if (top[0] < best[k]) continue;
      var i = k % nx, j = (k - i) / nx;
      for (var q = 0; q < 8; q++) {
        var ii = i + dx[q], jj = j + dy[q];
        if (ii < 0 || jj < 0 || ii >= nx || jj >= ny) continue;
        var kk = jj * nx + ii;
        if (clear[kk] === -Infinity) continue;
        var v = Math.min(best[k], clear[kk]);
        if (v <= best[kk]) continue;
        /* near a spot the angle rule inflates the clearance of cells right next to
           that spot's curves, so there a hop is checked whatever the clearance
           (as in distances; before v36 this leaked through curves near spots) */
        if ((clear[k] < c || clear[kk] < c || grid.near[k] || grid.near[kk]) && R.polylineCrossesObstacle(obs, [centre(grid, k), centre(grid, kk)])) continue;
        best[kk] = v; prev[kk] = k; push(kk, v);
      }
    }
    return { best: best, prev: prev };
  }
  function widestTo(field, grid, obs, p, ring) {
    var end = -1, bv = -Infinity;
    cellsAround(grid, p, ring).forEach(function (k) {
      if (field.best[k] > bv && !R.polylineCrossesObstacle(obs, [centre(grid, k), p])) { bv = field.best[k]; end = k; }
    });
    if (end < 0) return null;
    var at = end;
    for (var t = end; t >= 0; t = field.prev[t]) if (grid.clear[t] < grid.clear[at]) at = t;
    return { clearance: bv, at: centre(grid, at) };
  }
  function widest(grid, obs, start, p, ring) { return widestTo(widestField(grid, obs, start), grid, obs, p, ring); }

  /* A planner for moves starting at spot aIdx (leaving from `start`, which is
     the spot itself or a point a little way into the chosen region).
     spotRadius is the drawn radius; ring = how far from a spot's centre the
     path may end. */
  function planner(obs, ctx, d0, W, H, start, spotRadius) {
    ctx.scaleAll = true;
    var grid = buildGrid(obs, ctx, d0, W, H), dd = distances(grid, start, obs);
    var ring = d0 + spotRadius + 1.5 * grid.cell;
    return {
      grid: grid, ring: ring, start: start, ctx: ctx, d0: d0, W: W, H: H,
      reachable: function (p) { return bestCellNear(grid, dd, p, ring, obs) >= 0; },
      /* the room on the best way to p (see widest) */
      room: function (p) { return widest(grid, obs, start, p, ring); },
      /* Polyline of cell centres from the start's neighbourhood to near p, or null. */
      pathTo: function (p) {
        var k = bestCellNear(grid, dd, p, ring, obs);
        if (k < 0) return null;
        var pts = [];
        for (; k >= 0; k = dd.prev[k]) pts.push(centre(grid, k));
        return pts.reverse();
      }
    };
  }

  /* ---------------- routes that enclose a chosen set of boundaries ----------------

     A closed curve encloses a point iff it crosses a ray from that point an odd
     number of times. So give a boundary of the region a "cut": a ray from one
     of its spots. Which side of a path from start to B the boundary ends up on
     changes exactly when the parity of the path's crossings of the cut
     changes (the ray's far end is off in territory the path never reaches),
     and a Dijkstra over (cell, parity vector) finds the shortest path with any
     wanted parity vector. 2^k states for k cuts. ui.js chooses the rays and
     checks each result properly with the engine. */

  var MAX_CUTS = 7;
  var RAY_LEN = 1e6;

  /* A cut ray from p in the direction of angle `ang`, as a segment. */
  function ray(p, ang) { return [p, [p[0] + RAY_LEN * Math.cos(ang), p[1] + RAY_LEN * Math.sin(ang)]]; }

  /* Crossing parity of the polyline pts with each cut ray (rays = segments). */
  function crossings(pts, rays) {
    var mask = 0;
    for (var i = 1; i < pts.length; i++) {
      for (var c = 0; c < rays.length; c++) {
        if (G.segCross(pts[i - 1], pts[i], rays[c][0], rays[c][1])) mask ^= (1 << c);
      }
    }
    return mask;
  }

  /* Shortest grid path from `start` to near p whose crossing parity with the
     cut rays is one of `wanted` (an array of masks). Returns the polyline of
     cell centres, or null. */
  function pathWithParity(grid, obs, start, p, ring, rays, wanted) {
    var k = rays.length, states = 1 << k, n = grid.nx * grid.ny, nx = grid.nx, ny = grid.ny, c = grid.cell;
    var dist = new Float64Array(n * states).fill(Infinity), prev = new Int32Array(n * states).fill(-1);
    function hopMask(a, b) {
      var m = 0;
      for (var i = 0; i < k; i++) if (G.segCross(a, b, rays[i][0], rays[i][1])) m ^= (1 << i);
      return m;
    }
    var heap = [];
    function push(s, d) {
      heap.push([d, s]);
      for (var i = heap.length - 1; i > 0;) {
        var q = (i - 1) >> 1;
        if (heap[q][0] <= heap[i][0]) break;
        var t = heap[q]; heap[q] = heap[i]; heap[i] = t; i = q;
      }
    }
    function pop() {
      var top = heap[0], last = heap.pop();
      if (heap.length) {
        heap[0] = last;
        for (var i = 0;;) {
          var l = 2 * i + 1, rr = l + 1, m = i;
          if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
          if (rr < heap.length && heap[rr][0] < heap[m][0]) m = rr;
          if (m === i) break;
          var t = heap[m]; heap[m] = heap[i]; heap[i] = t; i = m;
        }
      }
      return top;
    }
    cellsNear(grid, start, 2 * c).forEach(function (cell) {
      var q = centre(grid, cell);
      if (R.polylineCrossesObstacle(obs, [start, q])) return;
      var s = cell * states + hopMask(start, q), d = G.dist(q, start);
      if (d < dist[s]) { dist[s] = d; push(s, d); }
    });
    var dx = [1, -1, 0, 0, 1, 1, -1, -1], dy = [0, 0, 1, -1, 1, -1, 1, -1];
    while (heap.length) {
      var top = pop(), s = top[1];
      if (top[0] > dist[s]) continue;
      var cell = Math.floor(s / states), mask = s - cell * states, i = cell % nx, j = (cell - i) / nx, pc = centre(grid, cell);
      for (var q = 0; q < 8; q++) {
        var ii = i + dx[q], jj = j + dy[q];
        if (ii < 0 || jj < 0 || ii >= nx || jj >= ny) continue;
        var kk = jj * nx + ii;
        if (!grid.free[kk]) continue;
        if (q >= 4 && !(grid.free[j * nx + ii] && grid.free[jj * nx + i])) continue;
        var qc = centre(grid, kk);
        /* only clean cells (see cleanCell), except close to the two ends,
           where the cells beside the end spots are cut by their curves */
        if (!cleanCell(grid, obs, kk) && G.dist(qc, start) > ring && G.dist(qc, p) > ring) continue;
        if ((grid.near[cell] || grid.near[kk]) && R.polylineCrossesObstacle(obs, [pc, qc])) continue;
        var s2 = kk * states + (mask ^ hopMask(pc, qc)), nd = dist[s] + (q < 4 ? c : c * Math.SQRT2);
        if (nd < dist[s2]) { dist[s2] = nd; prev[s2] = s; push(s2, nd); }
      }
    }
    /* the best end state: a cell near p, with a wanted parity after the final hop to p */
    var best = -1, bd = Infinity;
    cellsNear(grid, p, ring).forEach(function (cell) {
      var q = centre(grid, cell), last = hopMask(q, p);
      if (R.polylineCrossesObstacle(obs, [q, p])) return;
      wanted.forEach(function (w) {
        var s = cell * states + (w ^ last), d = dist[s] + G.dist(q, p);
        if (d < bd) { bd = d; best = s; }
      });
    });
    if (best < 0) return null;
    var pts = [];
    for (var st = best; st >= 0; st = prev[st]) pts.push(centre(grid, Math.floor(st / states)));
    return pts.reverse();
  }

  /* ---------------- from a grid walk to a simple curve ----------------

     The parity search returns a WALK: it may travel the same cells twice, out
     to something it must get round and back again, and the band cannot start
     from a curve that touches itself. So the walk is inflated: F = the cells
     it visits, their free neighbours (reached without crossing anything), and
     every pocket of cells they enclose. F's boundary is a simple closed curve
     that separates exactly what the walk did — a doubled stretch becomes two
     legs of it, three cells apart.
     Only CLEAN cells of the walk go into F (see cleanCell), so that F's
     boundary, which runs along cell borders, neither crosses nor touches
     anything. The walk's cells next to its two end spots are not clean (the
     spots' own curves pass through them), so F stops short of the ends and
     the caller joins the spots on where the walk's clean part begins and
     ends (Peter's game of 9/23: 4 → 10 round everything, both candidates
     crossed a curve at 4 or at 10). Returns the boundary loops of F (usually
     one), each as a list of grid-corner points, clockwise on screen, with
     `first` and `last`: the centres of the walk's first and last clean cells
     (no loops, and no `first`, if the walk has no clean cell). */
  function inflate(grid, obs, pts) {
    var nx = grid.nx, ny = grid.ny, c = grid.cell, n = nx * ny, F = new Uint8Array(n), k, i, j, q;
    var dx = [1, -1, 0, 0, 1, 1, -1, -1], dy = [0, 0, 1, -1, 1, -1, 1, -1];
    function cellOf(p) {
      return Math.min(ny - 1, Math.max(0, Math.floor(p[1] / c))) * nx + Math.min(nx - 1, Math.max(0, Math.floor(p[0] / c)));
    }
    var walk = pts.map(cellOf).filter(function (k) { return grid.free[k] && cleanCell(grid, obs, k); });
    if (!walk.length) return [];
    walk.forEach(function (k) { F[k] = 1; });
    walk.forEach(function (k) {
      var i = k % nx, j = (k - i) / nx, pc = centre(grid, k);
      for (var q = 0; q < 8; q++) {
        var ii = i + dx[q], jj = j + dy[q];
        if (ii < 0 || jj < 0 || ii >= nx || jj >= ny) continue;
        var kk = jj * nx + ii;
        if (F[kk] || !grid.free[kk] || !cleanCell(grid, obs, kk) || R.polylineCrossesObstacle(obs, [pc, centre(grid, kk)])) continue;
        F[kk] = 1;
      }
    });
    /* fill the pockets: whatever is not connected (8-wise) to the border */
    var out = new Uint8Array(n), stack = [];
    for (k = 0; k < n; k++) {
      i = k % nx; j = (k - i) / nx;
      if ((i === 0 || j === 0 || i === nx - 1 || j === ny - 1) && !F[k]) { out[k] = 1; stack.push(k); }
    }
    while (stack.length) {
      k = stack.pop(); i = k % nx; j = (k - i) / nx;
      for (q = 0; q < 8; q++) {
        var ii = i + dx[q], jj = j + dy[q];
        if (ii < 0 || jj < 0 || ii >= nx || jj >= ny) continue;
        var kk = jj * nx + ii;
        if (!F[kk] && !out[kk]) { out[kk] = 1; stack.push(kk); }
      }
    }
    for (k = 0; k < n; k++) if (!out[k]) F[k] = 1;
    /* no pinches: where F meets itself only at a corner, fill a cell in */
    for (j = 0; j + 1 < ny; j++) {
      for (i = 0; i + 1 < nx; i++) {
        k = j * nx + i;
        var a = F[k], b = F[k + 1], d = F[k + nx], e = F[k + nx + 1];
        if (a && e && !b && !d) F[grid.free[k + 1] || !grid.free[k + nx] ? k + 1 : k + nx] = 1;
        else if (b && d && !a && !e) F[grid.free[k] || !grid.free[k + nx + 1] ? k : k + nx + 1] = 1;
      }
    }
    /* the boundary, as directed unit edges between corners, F on the right */
    var W1 = nx + 1, edges = new Map();
    function add(v, w) { if (!edges.has(v)) edges.set(v, []); edges.get(v).push(w); }
    for (k = 0; k < n; k++) {
      if (!F[k]) continue;
      i = k % nx; j = (k - i) / nx;
      var v00 = j * W1 + i, v10 = v00 + 1, v01 = v00 + W1, v11 = v01 + 1;
      if (j === 0 || !F[k - nx]) add(v00, v10);
      if (i === nx - 1 || !F[k + 1]) add(v10, v11);
      if (j === ny - 1 || !F[k + nx]) add(v11, v01);
      if (i === 0 || !F[k - 1]) add(v01, v00);
    }
    var loops = [];
    edges.forEach(function (targets, v0) {
      while (targets.length) {
        var loop = [], v = v0, prev = -1, w;
        do {
          loop.push(v);
          var opts = edges.get(v);
          if (!opts || !opts.length) break;
          /* at a corner with two ways on, turn right (keeps loops apart) */
          w = opts[0];
          if (opts.length > 1 && prev >= 0) {
            var din = v - prev, best = -Infinity;
            opts.forEach(function (o) {
              var dout = o - v, cross = (din === 1 ? 1 : din === -1 ? -1 : 0) * (dout === W1 ? 1 : dout === -W1 ? -1 : 0) - (din === W1 ? 1 : din === -W1 ? -1 : 0) * (dout === 1 ? 1 : dout === -1 ? -1 : 0);
              if (cross > best) { best = cross; w = o; }
            });
          }
          opts.splice(opts.indexOf(w), 1);
          prev = v; v = w;
        } while (v !== v0);
        /* drop the corners along straight runs */
        var pts2 = [];
        for (var t = 0; t < loop.length; t++) {
          var p0 = loop[(t + loop.length - 1) % loop.length], p1 = loop[t], p2 = loop[(t + 1) % loop.length];
          if (p1 - p0 !== p2 - p1) pts2.push([(p1 % W1) * c, Math.floor(p1 / W1) * c]);
        }
        if (pts2.length >= 3) loops.push(pts2);
      }
    });
    loops.first = centre(grid, walk[0]);
    loops.last = centre(grid, walk[walk.length - 1]);
    return loops;
  }

  var api = { buildGrid: buildGrid, distances: distances, planner: planner, widest: widest,
              widestField: widestField, widestTo: widestTo,
              ray: ray, crossings: crossings, pathWithParity: pathWithParity, MAX_CUTS: MAX_CUTS, inflate: inflate };
  root.SproutsRoute = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : this);
