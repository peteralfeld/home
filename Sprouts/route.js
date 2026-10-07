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

  /* A binary heap of (key, value) pairs in typed arrays (v148): the searches below kept
     [d, k] pairs as small JavaScript arrays — tens of bytes each, millions of them in a
     large window (Peter's 100-spot game in 3840×2103 crashed with "Aw, Snap" during a
     marked route). Twelve bytes a pair here, and the same sifting as before, so ties
     come out in the same order. `max`: the largest key on top (widestField). */
  function makeHeap(max) {
    var cap = 1024, keys = new Float64Array(cap), vals = new Int32Array(cap), size = 0;
    function less(a, b) { return max ? keys[a] > keys[b] : keys[a] < keys[b]; }
    function swap(a, b) { var tk = keys[a], tv = vals[a]; keys[a] = keys[b]; vals[a] = vals[b]; keys[b] = tk; vals[b] = tv; }
    return {
      get length() { return size; },
      push: function (key, val) {
        if (size === cap) {
          cap *= 2;
          var k2 = new Float64Array(cap), v2 = new Int32Array(cap);
          k2.set(keys); v2.set(vals); keys = k2; vals = v2;
        }
        keys[size] = key; vals[size] = val;
        for (var i = size++; i > 0;) {
          var q = (i - 1) >> 1;
          if (max ? keys[q] >= keys[i] : keys[q] <= keys[i]) break;
          swap(q, i); i = q;
        }
      },
      /* the top pair, removed: sets heap.key and returns its value */
      pop: function () {
        var topK = keys[0], topV = vals[0];
        size--;
        if (size > 0) {
          keys[0] = keys[size]; vals[0] = vals[size];
          for (var i = 0;;) {
            var l = 2 * i + 1, r = l + 1, m = i;
            if (l < size && less(l, m)) m = l;
            if (r < size && less(r, m)) m = r;
            if (m === i) break;
            swap(m, i); i = m;
          }
        }
        this.key = topK;
        return topV;
      },
      key: 0
    };
  }

  /* The sizes of the grids and searches (v148), for a watch line in the page's log while a
     worker searches: sprouts-room-worker.js sets it; null elsewhere. */
  var reporter = null;
  function setReporter(f) { reporter = f; }

  /* Sample the free space. ctx is the routing context for the start spot
     (aIdx = the spot, bIdx = -1: no destination yet). */
  /* grid.base (v148): how many cells the grid has at the Settings' clearance (ctx.cellD0, set by
     moves.js trialMove when it searches with less — d0/2, d0/4 …, the search for a narrower way —
     where the cells shrink with the clearance: at d0/4 they are 2 px, 2 million of them in a
     3840×2103 window). pathWithParity compares its size with it. */
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
    var bc = ctx.cellD0 ? Math.max(2, Math.min(8, 0.7 * ctx.cellD0)) : cell, base = Math.ceil(W / bc) * Math.ceil(H / bc);
    if (reporter) reporter({ what: 'grid', cells: nx * ny, cell: cell, d0: d0 });
    return { cell: cell, nx: nx, ny: ny, free: free, near: near, clear: clear, W: W, H: H, base: base };
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
    var heap = makeHeap(false), nx = grid.nx, ny = grid.ny, c = grid.cell;
    function push(k, d) { heap.push(d, k); }
    cellsNear(grid, start, 2 * c).forEach(function (k) {
      var q = centre(grid, k), d = G.dist(q, start);
      if (d < dist[k] && !R.polylineCrossesObstacle(obs, [start, q])) { dist[k] = d; push(k, d); }
    });
    var dx = [1, -1, 0, 0, 1, 1, -1, -1], dy = [0, 0, 1, -1, 1, -1, 1, -1];
    while (heap.length) {
      var k = heap.pop();
      if (heap.key > dist[k]) continue;
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
     a curve ending at p is not an approach to p; -1 if none is reachable.
     `side` (v85), if given, is a test of the cell's centre: only cells on the
     wanted side of p — in the sector between two of p's curves — may end the
     path, so the curve arrives at p by that side. */
  function bestCellNear(grid, dd, p, radius, obs, side) {
    var best = -1, bd = Infinity;
    cellsNear(grid, p, radius).forEach(function (k) {
      var q = centre(grid, k), d = dd.dist[k] + G.dist(q, p);
      if (d < bd && (!side || side(q)) && !R.polylineCrossesObstacle(obs, [q, p])) { bd = d; best = k; }
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
    var best = new Float32Array(n).fill(-Infinity), prev = new Int32Array(n).fill(-1), heap = makeHeap(true);
    function push(k, v) { heap.push(v, k); }
    cellsAround(grid, start, 2 * c).forEach(function (k) {
      if (R.polylineCrossesObstacle(obs, [start, centre(grid, k)])) return;
      if (clear[k] > best[k]) { best[k] = clear[k]; push(k, clear[k]); }
    });
    var dx = [1, -1, 0, 0, 1, 1, -1, -1], dy = [0, 0, 1, -1, 1, -1, 1, -1];
    while (heap.length) {
      var k = heap.pop();
      if (heap.key < best[k]) continue;
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
      reachable: function (p, side) { return bestCellNear(grid, dd, p, ring, obs, side) >= 0; },
      /* the room on the best way to p (see widest) */
      room: function (p) { return widest(grid, obs, start, p, ring); },
      /* Polyline of cell centres from the start's neighbourhood to near p, or null; `side` as in bestCellNear. */
      pathTo: function (p, side) {
        var k = bestCellNear(grid, dd, p, ring, obs, side);
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
  /* v148: the states are indexed among the cells the search actually touches (each cell's
     states allocated when it is first reached, its allowed hops worked out once, when it is
     first expanded), the heap is in typed arrays, and the search is an A* search: a state is
     taken in order of its distance so far plus the straight distance from its cell to p (no way
     on is shorter), and the search stops as soon as no state left can lead to a better end than
     the best found. The path is as short as before; of equally short ones another may come out. Before, it kept two arrays over the whole
     window's cells × 2^k and searched every reachable state: in Peter's 100-spot game in a
     3840×2103 window, with the finer cells of a search at a quarter of the clearance, 258
     million states — the likely cause of its "Aw, Snap".
     A search may have no more states than the larger of: the same search at the Settings'
     clearance (grid.base cells, see buildGrid, × 2^k — the search the move itself was refused
     by), and a plain search on this grid (one state per cell); past that it is given up (null,
     reported as such). So a search for a narrower way is never larger than one of the two
     searches the program makes anyway. */
  function pathWithParity(grid, obs, start, p, ring, rays, wanted, side, blocked) {   // side: as in bestCellNear (v85); blocked: cells the path may not use (barriers, v112)
    var k = rays.length, states = 1 << k, n = grid.nx * grid.ny, nx = grid.nx, ny = grid.ny, c = grid.cell;
    function hopMask(a, b) {
      var m = 0;
      for (var i = 0; i < k; i++) if (G.segCross(a, b, rays[i][0], rays[i][1])) m ^= (1 << i);
      return m;
    }
    var dx = [1, -1, 0, 0, 1, 1, -1, -1], dy = [0, 0, 1, -1, 1, -1, 1, -1];
    function hopsOf(cell) {                        // bit q: the hop in direction q is allowed
      var i = cell % nx, j = (cell - i) / nx, pc = centre(grid, cell), bits = 0;
      for (var q = 0; q < 8; q++) {
        var ii = i + dx[q], jj = j + dy[q];
        if (ii < 0 || jj < 0 || ii >= nx || jj >= ny) continue;
        var kk = jj * nx + ii;
        if (!grid.free[kk] || (blocked && blocked[kk])) continue;
        if (q >= 4 && !(grid.free[j * nx + ii] && grid.free[jj * nx + i])) continue;
        if (q >= 4 && blocked && (blocked[j * nx + ii] || blocked[jj * nx + i])) continue;   // (no slipping diagonally through a barrier)
        var qc = centre(grid, kk);
        /* only clean cells (see cleanCell), except close to the two ends,
           where the cells beside the end spots are cut by their curves */
        if (!cleanCell(grid, obs, kk) && G.dist(qc, start) > ring && G.dist(qc, p) > ring) continue;
        if ((grid.near[cell] || grid.near[kk]) && R.polylineCrossesObstacle(obs, [pc, qc])) continue;
        bits |= 1 << q;
      }
      return bits;
    }
    /* the touched cells: index[cell] → ix; their states ix * states + mask */
    var limit = Math.max(Math.floor(n / states), grid.base);   // (cells to touch, each with its 2^k states)
    var index = new Int32Array(n).fill(-1), m = 0, cap = 256, cells = new Int32Array(cap), hops = new Int16Array(cap).fill(-1);
    var dist = new Float64Array(cap * states).fill(Infinity), prev = new Int32Array(cap * states).fill(-1), over = false;
    function ixOf(cell) {
      if (index[cell] >= 0) return index[cell];
      if (m >= limit) { over = true; return -1; }
      if (m === cap) {
        cap *= 2;
        var c2 = new Int32Array(cap); c2.set(cells); cells = c2;
        var h2 = new Int16Array(cap).fill(-1); h2.set(hops); hops = h2;
        var d2 = new Float64Array(cap * states).fill(Infinity); d2.set(dist); dist = d2;
        var p2 = new Int32Array(cap * states).fill(-1); p2.set(prev); prev = p2;
      }
      cells[m] = cell; index[cell] = m;
      return m++;
    }
    if (reporter) reporter({ what: 'parity', of: n, base: grid.base, rays: k, cell: c });
    /* the end states: a cell near p, with a wanted parity after the final hop to p */
    var ends = [], endAt = {};
    cellsNear(grid, p, ring).forEach(function (cell) {
      var q = centre(grid, cell);
      if (side && !side(q)) return;
      if (blocked && blocked[cell]) return;
      if (R.polylineCrossesObstacle(obs, [q, p])) return;
      var e = { cell: cell, last: hopMask(q, p), hop: G.dist(q, p) };
      ends.push(e); endAt[cell] = e;
    });
    var heap = makeHeap(false), bestEnd = Infinity;
    cellsNear(grid, start, 2 * c).forEach(function (cell) {
      var q = centre(grid, cell);
      if ((blocked && blocked[cell]) || R.polylineCrossesObstacle(obs, [start, q])) return;
      var ix = ixOf(cell);
      if (ix < 0) return;
      var s = ix * states + hopMask(start, q), d = G.dist(q, start);
      if (d < dist[s]) { dist[s] = d; heap.push(d + G.dist(q, p), s); }
    });
    while (heap.length && !over) {
      var s = heap.pop(), f = heap.key;
      if (f >= bestEnd) break;                     // every end still to come is at least this far
      var ix = Math.floor(s / states), mask = s - ix * states, cell = cells[ix], i = cell % nx, j = (cell - i) / nx, pc = centre(grid, cell);
      var ds = dist[s];
      if (f > ds + G.dist(pc, p) + 1e-9) continue;   // (a stale entry: the state was reached shorter since)
      var e = endAt[cell];
      if (e && wanted.indexOf(mask ^ e.last) >= 0 && ds + e.hop < bestEnd) bestEnd = ds + e.hop;
      if (hops[ix] < 0) hops[ix] = hopsOf(cell);
      for (var q = 0; q < 8; q++) {
        if (!(hops[ix] & (1 << q))) continue;
        var kk = (j + dy[q]) * nx + i + dx[q], ik = ixOf(kk);
        if (ik < 0) break;
        var qc = centre(grid, kk), s2 = ik * states + (mask ^ hopMask(pc, qc)), nd = ds + (q < 4 ? c : c * Math.SQRT2);
        if (nd < dist[s2]) { dist[s2] = nd; prev[s2] = s; heap.push(nd + G.dist(qc, p), s2); }
      }
    }
    if (reporter) reporter({ what: 'parity done', cells: m, of: n, base: grid.base, rays: k, states: m * states, cell: c, over: over });
    if (over) return null;
    var best = -1, bd = Infinity;
    ends.forEach(function (e) {
      if (index[e.cell] < 0) return;
      wanted.forEach(function (w) {
        var s = index[e.cell] * states + (w ^ e.last), d = dist[s] + e.hop;
        if (d < bd) { bd = d; best = s; }
      });
    });
    if (best < 0) return null;
    var pts = [];
    for (var st = best; st >= 0; st = prev[st]) pts.push(centre(grid, cells[Math.floor(st / states)]));
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

  /* ---------------- barriers: routes that enclose a chosen set (v112) ----------------

     The parity search above needs 2^k states for k boundaries that must end
     up on a given side — hopeless with many (Peter's 30-spot game of 9/29:
     28 boundaries in the outside region, so the router gave up and drew
     another move). Instead: join the boundaries that must go to one side,
     and what they go with (an arc of the start spot's boundary, the window's
     edge), by a BARRIER TREE of grid cells; the same for the other side;
     the two trees must not touch. A path that uses no barrier cell cannot
     separate what a tree joins, so each side's things end up together, with
     their arc. Growing a tree costs a breadth-first search per member.

     regionMask: the cells of the region that `start` lies in — reachable
     from it without crossing a curve (4-connected). A hop between two cells
     can jump a curve only if one of them is not plainly free (see buildGrid),
     so only those hops are checked. */
  function hopOK(grid, obs, k, kk) {
    if (grid.free[k] === 1 && grid.free[kk] === 1 && !grid.near[k] && !grid.near[kk]) return true;
    return !R.polylineCrossesObstacle(obs, [centre(grid, k), centre(grid, kk)]);
  }
  var DX4 = [1, -1, 0, 0], DY4 = [0, 0, 1, -1];
  function regionMask(grid, obs, start) {
    var n = grid.nx * grid.ny, mask = new Uint8Array(n), queue = [], c = grid.cell;
    var i0 = Math.floor(start[0] / c), j0 = Math.floor(start[1] / c);
    for (var j = j0 - 2; j <= j0 + 2; j++) for (var i = i0 - 2; i <= i0 + 2; i++) {
      if (i < 0 || j < 0 || i >= grid.nx || j >= grid.ny) continue;
      var k = j * grid.nx + i;
      if (!R.polylineCrossesObstacle(obs, [start, centre(grid, k)])) { mask[k] = 1; queue.push(k); }
    }
    for (var h = 0; h < queue.length; h++) {
      var kq = queue[h], iq = kq % grid.nx, jq = (kq - iq) / grid.nx;
      for (var q = 0; q < 4; q++) {
        var ii = iq + DX4[q], jj = jq + DY4[q];
        if (ii < 0 || jj < 0 || ii >= grid.nx || jj >= grid.ny) continue;
        var kk = jj * grid.nx + ii;
        if (mask[kk] || !hopOK(grid, obs, kq, kk)) continue;
        mask[kk] = 1; queue.push(kk);
      }
    }
    return mask;
  }
  /* The cells of the region within r of the points pts (an anchor: a boundary's curves or spot,
     an arc, …), not in `avoid`. r: as far as the curves and spots keep cells from being free (the
     planner's ring), so that the anchor holds the whole zone round it that no path can use. */
  function anchorCells(grid, mask, pts, avoid, r) {
    var out = {}, c = grid.cell;
    pts.forEach(function (p) {
      var i0 = Math.floor((p[0] - r) / c), i1 = Math.floor((p[0] + r) / c), j0 = Math.floor((p[1] - r) / c), j1 = Math.floor((p[1] + r) / c);
      for (var j = Math.max(0, j0); j <= Math.min(grid.ny - 1, j1); j++) for (var i = Math.max(0, i0); i <= Math.min(grid.nx - 1, i1); i++) {
        var k = j * grid.nx + i;
        if (mask[k] && !(avoid && avoid[k]) && G.dist(centre(grid, k), p) <= r) out[k] = 1;
      }
    });
    return Object.keys(out).map(Number);
  }
  /* The cells of the region within r of the polylines (each {pts, sign}) on ONE side of them: the
     side sign·(left normal) of the segment nearest the cell (v112). An arc of a boundary is one SIDE
     of its curves — where a bare path has the region on both sides, its two sides are two different
     arcs, and a zone round the curve would give a tree both. */
  function sideCells(grid, mask, lines, avoid, r) {
    var n = grid.nx * grid.ny, best = new Float64Array(n).fill(Infinity), side = new Int8Array(n), c = grid.cell;
    lines.forEach(function (ln) {
      for (var t = 1; t < ln.pts.length; t++) {
        var a = ln.pts[t - 1], b = ln.pts[t], vx = b[0] - a[0], vy = b[1] - a[1], vv = vx * vx + vy * vy;
        var i0 = Math.max(0, Math.floor((Math.min(a[0], b[0]) - r) / c)), i1 = Math.min(grid.nx - 1, Math.floor((Math.max(a[0], b[0]) + r) / c));
        var j0 = Math.max(0, Math.floor((Math.min(a[1], b[1]) - r) / c)), j1 = Math.min(grid.ny - 1, Math.floor((Math.max(a[1], b[1]) + r) / c));
        for (var j = j0; j <= j1; j++) for (var i = i0; i <= i1; i++) {
          var k = j * grid.nx + i;
          if (!mask[k] || (avoid && avoid[k])) continue;
          var q = centre(grid, k), wx = q[0] - a[0], wy = q[1] - a[1];
          var u = vv > 0 ? Math.max(0, Math.min(1, (wx * vx + wy * vy) / vv)) : 0, ex = wx - u * vx, ey = wy - u * vy, d = Math.sqrt(ex * ex + ey * ey);
          if (d > r || d >= best[k]) continue;
          best[k] = d;
          var cr = vx * wy - vy * wx;              // > 0: on the left of a → b (screen coordinates: y down)
          side[k] = cr * ln.sign > 0 ? 1 : cr * ln.sign < 0 ? -1 : 0;
        }
      }
    });
    var out = [];
    for (var k2 = 0; k2 < n; k2++) if (best[k2] <= r && side[k2] >= 0) out.push(k2);
    return out;
  }
  /* The cells of the region on the window's edge (the unbounded part's anchor). */
  function edgeCells(grid, mask, avoid) {
    var out = [];
    for (var k = 0; k < grid.nx * grid.ny; k++) {
      var i = k % grid.nx, j = (k - i) / grid.nx;
      if ((i === 0 || j === 0 || i === grid.nx - 1 || j === grid.ny - 1) && mask[k] && !(avoid && avoid[k])) out.push(k);
    }
    return out;
  }
  /* A tree of cells joining the anchors, avoiding `forbid` and staying in the region. An anchor is
     given by its ZONE (anchorCells: the cells within reach of it); what the tree takes of it is its
     CORE — the zone's cells that no path could use anyway (not free, or not clean) — so the free cells
     round a thing stay open for the curve, also where they are near a thing of the other side.
     Between anchors the tree goes only where the curve has room beside it (clearance ≥ minClear,
     as the grid measures it) or through the zone of an anchor of its own: the first anchor, then
     repeatedly the shortest 4-connected way from the tree to the nearest zone not yet joined. So a
     tree keeps clear of everything it does not join. Returns the tree's cells (Uint8Array) or null
     when some anchor cannot be reached. */
  function barrierTree(grid, obs, mask, anchors, forbid, minClear) {
    var n = grid.nx * grid.ny, tree = new Uint8Array(n), owner = new Int32Array(n).fill(-1), left = 0;
    anchors = anchors.filter(function (a) { return a.length; });
    if (!anchors.length) return tree;
    var joined = new Uint8Array(anchors.length);
    var unusable = function (k) { return !grid.free[k] || !cleanCell(grid, obs, k); };   // (a curve can use neither: not free, or free by the angle rule only — see cleanCell)
    function take(t) {                             // anchor t joins: its core becomes tree (or, with no core, its whole zone)
      joined[t] = 1; left--;
      var core = anchors[t].filter(unusable);
      (core.length ? core : anchors[t]).forEach(function (k) { tree[k] = 1; });
    }
    anchors.forEach(function (a, t) { left++; a.forEach(function (k) { if (owner[k] < 0) owner[k] = t; }); });
    /* ONE search that goes on (v112): every cell's distance to the tree so far; when an anchor is
       reached, its way there and its core join the tree at distance 0 and the search continues from
       them (a fresh search per anchor cost k searches of the grid) */
    var dist = new Float64Array(n).fill(Infinity), prev = new Int32Array(n).fill(-1), heap = [];
    function push(k, d) {
      heap.push([d, k]);
      for (var i = heap.length - 1; i > 0;) { var p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; var t0 = heap[p]; heap[p] = heap[i]; heap[i] = t0; i = p; }
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
          var t1 = heap[m]; heap[m] = heap[i]; heap[i] = t1; i = m;
        }
      }
      return top;
    }
    function seed(k) { if (dist[k] > 0) { dist[k] = 0; prev[k] = -1; push(k, 0); } }
    take(0);
    for (var k0 = 0; k0 < n; k0++) if (tree[k0]) seed(k0);
    while (left > 0) {
      if (!heap.length) return null;
      var top = pop(), kq = top[1];
      if (top[0] > dist[kq]) continue;
      if (owner[kq] >= 0 && !joined[owner[kq]]) {  // an anchor reached: its way and (on to) its core join
        for (var kp = kq, kn; kp >= 0 && !tree[kp]; kp = kn) { kn = prev[kp]; tree[kp] = 1; seed(kp); }   // (the next one read before seed resets it)
        var t = owner[kq];
        /* on inside the zone to its core: a gap of free cells between the tree and the core would let
           a curve slip between them */
        if (!unusable(kq) && anchors[t].some(unusable)) {
          var prev2 = new Map([[kq, -1]]), q2 = [kq], end = -1;
          for (var h2 = 0; h2 < q2.length && end < 0; h2++) {
            var k2 = q2[h2], i2 = k2 % grid.nx, j2 = (k2 - i2) / grid.nx;
            for (var d4 = 0; d4 < 4; d4++) {
              var i3 = i2 + DX4[d4], j3 = j2 + DY4[d4];
              if (i3 < 0 || j3 < 0 || i3 >= grid.nx || j3 >= grid.ny) continue;
              var k3 = j3 * grid.nx + i3;
              if (prev2.has(k3) || owner[k3] !== t || (forbid && forbid[k3]) || !hopOK(grid, obs, k2, k3)) continue;
              prev2.set(k3, k2); q2.push(k3);
              if (unusable(k3)) { end = k3; break; }
            }
          }
          for (var k4 = end; k4 >= 0; k4 = prev2.get(k4)) { tree[k4] = 1; seed(k4); }
        }
        take(t);
        anchors[t].forEach(function (k5) { if (tree[k5]) seed(k5); });
        continue;
      }
      var iq = kq % grid.nx, jq = (kq - iq) / grid.nx;
      for (var q = 0; q < 4; q++) {
        var ii = iq + DX4[q], jj = jq + DY4[q];
        if (ii < 0 || jj < 0 || ii >= grid.nx || jj >= grid.ny) continue;
        var kk = jj * grid.nx + ii, nd = dist[kq] + 1;
        if (nd >= dist[kk] || !mask[kk] || (forbid && forbid[kk])) continue;
        var own = owner[kk] >= 0;
        if (!own && (!grid.free[kk] || (minClear !== undefined && grid.clear[kk] < minClear))) continue;
        if (!hopOK(grid, obs, kq, kk)) continue;
        dist[kk] = nd; prev[kk] = kq; push(kk, nd);
      }
    }
    return tree;
  }

  /* The cells of the region next to (8-neighbours of) the set `blob`, not in it. */
  function around(grid, mask, blob) {
    var n = grid.nx * grid.ny, out = new Uint8Array(n);
    for (var k = 0; k < n; k++) {
      if (!blob[k]) continue;
      var i = k % grid.nx, j = (k - i) / grid.nx;
      for (var dj = -1; dj <= 1; dj++) for (var di = -1; di <= 1; di++) {
        var ii = i + di, jj = j + dj;
        if (ii < 0 || jj < 0 || ii >= grid.nx || jj >= grid.ny) continue;
        var kk = jj * grid.nx + ii;
        if (mask[kk] && !blob[kk]) out[kk] = 1;
      }
    }
    return out;
  }
  /* The shortest way through free cells, not in `avoid`, from `start` to any cell of `goal`, as a
     set of cells with their neighbours (a stem the other tree may not cut); null if none. */
  function stem(grid, obs, mask, start, goal, avoid) {
    var n = grid.nx * grid.ny, prev = new Int32Array(n).fill(-2), queue = [], hit = -1;
    cellsNear(grid, start, 2 * grid.cell).forEach(function (k) { if (!avoid[k] && !R.polylineCrossesObstacle(obs, [start, centre(grid, k)])) { prev[k] = -1; queue.push(k); } });
    for (var h = 0; h < queue.length && hit < 0; h++) {
      var kq = queue[h];
      if (goal[kq]) { hit = kq; break; }
      var iq = kq % grid.nx, jq = (kq - iq) / grid.nx;
      for (var q = 0; q < 4; q++) {
        var ii = iq + DX4[q], jj = jq + DY4[q];
        if (ii < 0 || jj < 0 || ii >= grid.nx || jj >= grid.ny) continue;
        var kk = jj * grid.nx + ii;
        if (prev[kk] !== -2 || !mask[kk] || avoid[kk] || !(grid.free[kk] || goal[kk]) || !hopOK(grid, obs, kq, kk)) continue;
        prev[kk] = kq; queue.push(kk);
      }
    }
    if (hit < 0) return null;
    var line = new Uint8Array(n);
    for (var k = hit; k >= 0; k = prev[k]) line[k] = 1;
    var wide = around(grid, mask, line);
    for (k = 0; k < n; k++) if (line[k]) wide[k] = 1;
    return wide;
  }

  var api = { buildGrid: buildGrid, distances: distances, planner: planner, widest: widest,
              widestField: widestField, widestTo: widestTo,
              ray: ray, crossings: crossings, pathWithParity: pathWithParity, MAX_CUTS: MAX_CUTS, inflate: inflate,
              regionMask: regionMask, anchorCells: anchorCells, sideCells: sideCells, edgeCells: edgeCells, barrierTree: barrierTree, around: around, stem: stem,
              setReporter: setReporter };
  root.SproutsRoute = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : this);
