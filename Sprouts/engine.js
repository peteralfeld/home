/* =========================================================================
   engine.js — the combinatorial state of a Sprouts position, computed from
   the drawing: regions, their boundaries, the spots on them and their lives.
   DOM-free (global SproutsEngine, or require()). Needs geom.js.

   The drawing is a planar map. Each curve gives two half-edges; at each spot
   the half-edges are sorted by the direction in which they leave it (the
   rotation system), and following "next = the half-edge after my twin in the
   rotation at my head" traces the boundary cycles of the faces. Within one
   connected component of the map the cycle of smallest signed area (the only
   negative one) is the component's OUTER cycle; the others bound the
   component's inner faces.
   A region is either an inner face of some component or the unbounded
   outside; a component's outer cycle and each isolated spot belong to the
   smallest inner face that contains them, else to the outside. A region's
   lives are the lives (3 − degree) of the distinct spots on its boundaries,
   and a move exists in it iff those lives total at least two (two spots with
   a life each, or one spot with two — a loop).
   ========================================================================= */
(function (root) {
  'use strict';
  var G = root.SproutsGeom || require('./geom.js');

  function signedArea(poly) {
    var a = 0;
    for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) a += poly[j][0] * poly[i][1] - poly[i][0] * poly[j][1];
    return a / 2;
  }

  /* spots: [{x, y, deg}], edges: [{a, b, pieces}]. */
  function analyse(spots, edges) {
    var nS = spots.length, i, j;

    /* half-edges: 2e = edge e from a to b, 2e+1 = the reverse */
    var half = [];
    edges.forEach(function (e, ei) {
      var pts = G.refinedPolygon(e.pieces, 0.5, 16).pts;
      var rev = pts.slice().reverse();
      half.push({ id: 2 * ei, edge: ei, tail: e.a, head: e.b, pts: pts, angle: Math.atan2(pts[1][1] - pts[0][1], pts[1][0] - pts[0][0]) });
      half.push({ id: 2 * ei + 1, edge: ei, tail: e.b, head: e.a, pts: rev, angle: Math.atan2(rev[1][1] - rev[0][1], rev[1][0] - rev[0][0]) });
    });

    /* rotation system: the half-edges leaving each spot, by angle */
    var out = [];
    for (i = 0; i < nS; i++) out.push([]);
    half.forEach(function (h) { out[h.tail].push(h); });
    out.forEach(function (list) { list.sort(function (p, q) { return p.angle - q.angle; }); });
    var posAt = new Array(half.length);
    out.forEach(function (list) { list.forEach(function (h, k) { posAt[h.id] = k; }); });

    /* next(h): arrive at head(h) along h; turn to the half-edge just before
       h's twin in the rotation there (the face stays on one fixed side) */
    function next(h) {
      var twin = half[h.id ^ 1], list = out[h.head], k = posAt[twin.id];
      return list[(k - 1 + list.length) % list.length];
    }

    /* connected components of the map, by union-find over spots */
    var parent = [];
    for (i = 0; i < nS; i++) parent.push(i);
    function find(x) { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; }
    edges.forEach(function (e) { parent[find(e.a)] = find(e.b); });

    /* the boundary cycles */
    var seen = new Uint8Array(half.length), cycles = [];
    half.forEach(function (h0) {
      if (seen[h0.id]) return;
      var cyc = { halves: [], poly: [], spots: {}, comp: find(h0.tail) }, h = h0;
      do {
        seen[h.id] = 1;
        cyc.halves.push(h);
        cyc.spots[h.tail] = true;
        for (var k = 0; k + 1 < h.pts.length; k++) cyc.poly.push(h.pts[k]);
        h = next(h);
      } while (h !== h0);
      cyc.area = signedArea(cyc.poly);
      cycles.push(cyc);
    });

    /* per component: with this traversal (screen coordinates, y down) the
       inner faces come out with POSITIVE signed area and the component's outer
       cycle with negative area (zero for a tree, which has no inner face) —
       so the outer cycle is the one of smallest signed area */
    var outerOf = {};
    cycles.forEach(function (c, ci) {
      if (!(c.comp in outerOf) || c.area < cycles[outerOf[c.comp]].area) outerOf[c.comp] = ci;
    });
    var faces = [];                               // inner faces = regions with an outer boundary
    cycles.forEach(function (c, ci) { if (outerOf[c.comp] !== ci) faces.push(ci); });

    /* the region a point lies in: the smallest inner face containing it, else the outside (-1) */
    function regionOf(p) {
      var best = -1, bestArea = Infinity;
      faces.forEach(function (ci) {
        var c = cycles[ci];
        if (Math.abs(c.area) < bestArea && G.pointInPolygon(p, c.poly)) { best = ci; bestArea = Math.abs(c.area); }
      });
      return best;
    }

    /* assemble the regions: key -1 = outside, else the cycle index of the face */
    var regions = {};
    function region(key) {
      if (!regions[key]) regions[key] = { key: key, boundaries: [], spots: {} };
      return regions[key];
    }
    region(-1);
    faces.forEach(function (ci) {
      var r = region(ci);
      r.boundaries.push({ cycle: ci, spots: Object.keys(cycles[ci].spots).map(Number) });
      Object.keys(cycles[ci].spots).forEach(function (s) { r.spots[s] = true; });
    });
    /* A point just outside a component: off the middle of the longest side of
       its outer cycle, on the side not inside that cycle's polygon. (A point
       ON the cycle would be ambiguous — it may lie on another cycle too.) */
    function outsidePoint(c) {
      var poly = c.poly, best = 0, bl = -1, i, j;
      for (i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        var l = G.dist(poly[i], poly[j]);
        if (l > bl) { bl = l; best = i; }
      }
      var p = poly[best], q = poly[(best + poly.length - 1) % poly.length], len = bl || 1;
      var m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2], nx = -(q[1] - p[1]) / len, ny = (q[0] - p[0]) / len;
      var s1 = [m[0] + 0.5 * nx, m[1] + 0.5 * ny], s2 = [m[0] - 0.5 * nx, m[1] - 0.5 * ny];
      return G.pointInPolygon(s1, poly) ? s2 : s1;
    }
    Object.keys(outerOf).forEach(function (comp) {
      var ci = outerOf[comp], c = cycles[ci];
      var r = region(regionOf(c.area < 0 ? outsidePoint(c) : c.poly[0]));
      r.boundaries.push({ cycle: ci, spots: Object.keys(c.spots).map(Number) });
      Object.keys(c.spots).forEach(function (s) { r.spots[s] = true; });
    });
    for (i = 0; i < nS; i++) {
      if (out[i].length) continue;                // isolated spot
      var r = region(regionOf([spots[i].x, spots[i].y]));
      r.boundaries.push({ spot: i, spots: [i] });
      r.spots[i] = true;
    }

    var list = Object.keys(regions).map(function (k) { return regions[k]; });
    list.forEach(function (r) {
      r.spots = Object.keys(r.spots).map(Number);
      r.lives = 0;
      r.spots.forEach(function (s) { r.lives += Math.max(0, 3 - spots[s].deg); });
      r.canMove = r.lives >= 2;
    });
    return {
      regions: list, cycles: cycles,
      canMove: list.some(function (r) { return r.canMove; }),
      /* the region containing the point p */
      regionAt: function (p) { return regions[regionOf(p)]; }
    };
  }

  /* Cubic pieces that trace the polyline exactly (each segment a straight
     piece), so that a candidate curve can be analysed as if it were drawn. */
  function polylinePieces(pts) {
    var pieces = [];
    for (var i = 1; i < pts.length; i++) {
      var a = pts[i - 1], b = pts[i];
      pieces.push([a, [a[0] + (b[0] - a[0]) / 3, a[1] + (b[1] - a[1]) / 3], [a[0] + 2 * (b[0] - a[0]) / 3, a[1] + 2 * (b[1] - a[1]) / 3], b]);
    }
    return pieces;
  }

  /* The position after a move from spot a to spot b along the polyline pts
     (which starts at a and ends at b): the analysis, and the regions on the
     two sides of the new curve — equal when the move splits no region. */
  function afterMove(spots, edges, a, b, pts) {
    var sp = spots.map(function (s) { return { x: s.x, y: s.y, deg: s.deg }; });
    var mid = Math.floor(pts.length / 2), z = sp.length, m = pts[mid];
    sp.push({ x: m[0], y: m[1], deg: 2 });
    sp[a].deg++; sp[b].deg++;
    var ed = edges.concat([{ a: a, b: z, pieces: polylinePieces(pts.slice(0, mid + 1)) }, { a: z, b: b, pieces: polylinePieces(pts.slice(mid)) }]);
    var an = analyse(sp, ed);
    var p = pts[mid - 1], q = pts[mid + 1], tx = q[0] - p[0], ty = q[1] - p[1], tl = Math.sqrt(tx * tx + ty * ty) || 1;
    var left = an.regionAt([m[0] - 4 * ty / tl, m[1] + 4 * tx / tl]), right = an.regionAt([m[0] + 4 * ty / tl, m[1] - 4 * tx / tl]);
    return { analysis: an, left: left, right: right, split: left !== right };
  }

  var api = { analyse: analyse, signedArea: signedArea, polylinePieces: polylinePieces, afterMove: afterMove };
  root.SproutsEngine = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : this);
