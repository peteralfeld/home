/* =========================================================================
   flip.js — the picture turned inside out (v271; Peter 11/13, after his 450-seed game of the series: "do you
   think [the rings] are an intrinsic property of the position, or do they depend heavily on what region is
   chosen as the outside?").

   NESTING. Two regions are neighbors when a curve has one on each side. A region's DEPTH is the fewest curves to
   cross from the outside to it; the picture's nesting is the mean depth, each region counted by the spots on its
   boundaries. Which region is outside is the drawing's choice, not the position's (on a sphere there is none), and
   a move that "encloses most of the board" is, with another outside, a small loop round the little it leaves out.
   That game ended with a mean depth of 15.2 — rings round everything, 166,800 px of curve; with the best region
   outside it is 5.6, as its neighbors in the series are (4 to 7).

   THE FLIP makes a chosen region the outside without drawing anything anew: c is the point of that region with
   the most room, and along every ray from c the point at distance r goes to distance (the ray's length to an
   ellipse round the picture) − r. Near c and far from c change places; distances along a ray are kept; it is one
   to one and continuous away from c, so no curves can come to cross and the position is the same. The picture is
   then brought back to the size it had. What it gives is distorted — stretched round near the new outside,
   squeezed where the old outside was — and is meant for R, which takes it from there.
   (A circle inversion would do the same and keep angles, but it shrinks what is far from c by the square of the
   distance: clusters of the 450 game to a fraction of a pixel. An ellipse and not the picture's box: the box's
   corners put a kink into every curve, and R's points on two nested kinked curves came to lie on each other.)

   No reference to the page: loads in the page, in workers and in Node.
   ========================================================================= */
(function (root) {
  'use strict';
  var E = root.SproutsEngine || require('./engine.js');

  function bez(p, t) { var u = 1 - t; return [u * u * u * p[0][0] + 3 * u * u * t * p[1][0] + 3 * u * t * t * p[2][0] + t * t * t * p[3][0], u * u * u * p[0][1] + 3 * u * u * t * p[1][1] + 3 * u * t * t * p[2][1] + t * t * t * p[3][1]]; }
  /* a curve as a polyline: each piece at its ends and seven points between (a piece is a D or less long) */
  function polyline(e) { var out = [e.pieces[0][0].slice()]; e.pieces.forEach(function (p) { for (var i = 1; i <= 8; i++) out.push(bez(p, i / 8)); }); return out; }

  /* The regions of game g, their neighbors, and for each the mean depth of the picture were it the outside. */
  function nesting(g) {
    var an = E.analyse(g.spots, g.edges), R = an.regions, idx = new Map(), outer = -1;
    R.forEach(function (r, i) { idx.set(r, i); if (r.key === -1) outer = i; });
    var adj = R.map(function () { return {}; });
    for (var e = 0; e < g.edges.length; e++) { var a = idx.get(an.regionOfHalf(2 * e)), b = idx.get(an.regionOfHalf(2 * e + 1)); if (a !== b) { adj[a][b] = true; adj[b][a] = true; } }
    var w = R.map(function (r) { return r.spots.length; }), total = w.reduce(function (s, x) { return s + x; }, 0) || 1;
    var mean = R.map(function (r, s) {
      var dist = [], q = [s], sum = 0;
      dist[s] = 0;
      for (var k = 0; k < q.length; k++) { sum += dist[q[k]] * w[q[k]]; Object.keys(adj[q[k]]).forEach(function (v) { if (dist[v] === undefined) { dist[v] = dist[q[k]] + 1; q.push(Number(v)); } }); }
      return q.length === R.length ? sum / total : Infinity;
    });
    return { an: an, regions: R, outer: outer, mean: mean };
  }

  /* For every region, its point with the most room: the picture on a grid of CELL px, the distance of every cell
     to the nearest curve or spot, the cells cut into connected parts by the curves; a part belongs to the region
     its roomiest cell lies in. */
  var CELL = 2;
  function roomiest(g, polys, nest) {
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, i, j, k, v;
    polys.forEach(function (P) { P.forEach(function (p) { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; }); });
    g.spots.forEach(function (s) { if (s.x < x0) x0 = s.x; if (s.x > x1) x1 = s.x; if (s.y < y0) y0 = s.y; if (s.y > y1) y1 = s.y; });
    var pad = 4 * CELL, ox = x0 - pad, oy = y0 - pad, W = Math.ceil((x1 - x0 + 2 * pad) / CELL), H = Math.ceil((y1 - y0 + 2 * pad) / CELL), n = W * H;
    var blk = new Uint8Array(n), dt = new Float32Array(n).fill(1e9), lab = new Int32Array(n).fill(-1);
    function mark(x, y) { var a = Math.floor((x - ox) / CELL), b = Math.floor((y - oy) / CELL); if (a >= 0 && b >= 0 && a < W && b < H) blk[b * W + a] = 1; }
    polys.forEach(function (P) { for (var t = 1; t < P.length; t++) { var m = Math.ceil(Math.hypot(P[t][0] - P[t - 1][0], P[t][1] - P[t - 1][1]) / (CELL / 2)) || 1; for (var q = 0; q <= m; q++) mark(P[t - 1][0] + (P[t][0] - P[t - 1][0]) * q / m, P[t - 1][1] + (P[t][1] - P[t - 1][1]) * q / m); } });
    g.spots.forEach(function (s) { mark(s.x, s.y); });
    for (k = 0; k < n; k++) if (blk[k]) dt[k] = 0;
    for (j = 0; j < H; j++) for (i = 0; i < W; i++) { k = j * W + i; v = dt[k]; if (i > 0) v = Math.min(v, dt[k - 1] + 1); if (j > 0) { v = Math.min(v, dt[k - W] + 1); if (i > 0) v = Math.min(v, dt[k - W - 1] + Math.SQRT2); if (i < W - 1) v = Math.min(v, dt[k - W + 1] + Math.SQRT2); } dt[k] = v; }
    for (j = H - 1; j >= 0; j--) for (i = W - 1; i >= 0; i--) { k = j * W + i; v = dt[k]; if (i < W - 1) v = Math.min(v, dt[k + 1] + 1); if (j < H - 1) { v = Math.min(v, dt[k + W] + 1); if (i < W - 1) v = Math.min(v, dt[k + W + 1] + Math.SQRT2); if (i > 0) v = Math.min(v, dt[k + W - 1] + Math.SQRT2); } dt[k] = v; }
    var room = nest.regions.map(function () { return null; }), idx = new Map();
    nest.regions.forEach(function (r, t) { idx.set(r, t); });
    for (var s0 = 0; s0 < n; s0++) {
      if (blk[s0] || lab[s0] >= 0) continue;
      var q = [s0], best = s0; lab[s0] = s0;
      for (var h = 0; h < q.length; h++) {
        k = q[h]; i = k % W; j = (k - i) / W;
        if (dt[k] > dt[best]) best = k;
        if (i > 0 && !blk[k - 1] && lab[k - 1] < 0) { lab[k - 1] = s0; q.push(k - 1); }
        if (i < W - 1 && !blk[k + 1] && lab[k + 1] < 0) { lab[k + 1] = s0; q.push(k + 1); }
        if (j > 0 && !blk[k - W] && lab[k - W] < 0) { lab[k - W] = s0; q.push(k - W); }
        if (j < H - 1 && !blk[k + W] && lab[k + W] < 0) { lab[k + W] = s0; q.push(k + W); }
      }
      var bi = best % W, bj = (best - bi) / W, p = [ox + (bi + 0.5) * CELL, oy + (bj + 0.5) * CELL], r = nest.an.regionAt(p), ri = r ? idx.get(r) : nest.outer;
      if (ri === undefined) ri = nest.outer;
      if (!room[ri] || dt[best] * CELL > room[ri].room) room[ri] = { room: dt[best] * CELL, p: p };
    }
    return { room: room, box: [x0, y0, x1, y1] };
  }

  /* Game g turned inside out about c (room m there), box the picture's: a new game object, its curves polylines. */
  function turn(g, polys, c, m, box) {
    var cx = (box[0] + box[2]) / 2, cy = (box[1] + box[3]) / 2, ea = (box[2] - box[0]) / 2 * Math.SQRT2 + m, eb = (box[3] - box[1]) / 2 * Math.SQRT2 + m;
    var px = (c[0] - cx) / ea, py = (c[1] - cy) / eb, C0 = px * px + py * py - 1;
    function flip(p) {
      var dx = p[0] - c[0], dy = p[1] - c[1], r = Math.hypot(dx, dy), ux = dx / r, uy = dy / r, a = ux / ea, b = uy / eb, A = a * a + b * b, B = px * a + py * b;
      var r2 = (-B + Math.sqrt(B * B - A * C0)) / A - r;
      return [c[0] + r2 * ux, c[1] + r2 * uy];
    }
    /* a straight piece becomes an arc: cut until its image's pieces are short (4 px: far below the D that R spaces its points by) */
    function flipPoly(P) {
      var out = [flip(P[0])];
      function seg(a, b, fa, fb, lv) {
        if (lv < 14 && Math.hypot(fa[0] - fb[0], fa[1] - fb[1]) > 4) { var mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], fm = flip(mid); seg(a, mid, fa, fm, lv + 1); seg(mid, b, fm, fb, lv + 1); } else out.push(fb);
      }
      for (var i = 1; i < P.length; i++) seg(P[i - 1], P[i], out[out.length - 1], flip(P[i]), 0);
      return out;
    }
    var g2 = JSON.parse(JSON.stringify(g)), F = polys.map(flipPoly), X0 = Infinity, Y0 = Infinity, X1 = -Infinity, Y1 = -Infinity;
    g2.spots.forEach(function (s) { var f = flip([s.x, s.y]); s.x = f[0]; s.y = f[1]; });
    F.forEach(function (P) { P.forEach(function (p) { if (p[0] < X0) X0 = p[0]; if (p[0] > X1) X1 = p[0]; if (p[1] < Y0) Y0 = p[1]; if (p[1] > Y1) Y1 = p[1]; }); });
    /* back into the box the picture had, evenly */
    var k = Math.min((box[2] - box[0]) / (X1 - X0), (box[3] - box[1]) / (Y1 - Y0)), mx = (X0 + X1) / 2, my = (Y0 + Y1) / 2;
    g2.spots.forEach(function (s) { s.x = cx + (s.x - mx) * k; s.y = cy + (s.y - my) * k; });
    g2.edges.forEach(function (e, i) {
      var P = F[i].map(function (p) { return [cx + (p[0] - mx) * k, cy + (p[1] - my) * k]; });
      P[0] = [g2.spots[e.a].x, g2.spots[e.a].y]; P[P.length - 1] = [g2.spots[e.b].x, g2.spots[e.b].y];
      e.pieces = E.polylinePieces(P); delete e.h;
    });
    if (g2.thin) g2.thin = [];
    return g2;
  }

  /* The picture of game g turned inside out about the region with the least nesting:
     { game, from, to (the mean depth before and after), room, at } — or { none: why } when the outside is that region already. */
  function inside_out(g) {
    if (!g.edges.length) return { none: 'there are no curves' };
    var nest = nesting(g), best = -1;
    nest.mean.forEach(function (x, i) { if (best < 0 || x < nest.mean[best]) best = i; });
    if (!(nest.mean[best] < nest.mean[nest.outer])) return { none: 'no region would make a shallower outside than the present one', from: nest.mean[nest.outer] };
    var polys = g.edges.map(polyline), rm = roomiest(g, polys, nest);
    /* among the regions, the shallowest that has a point to turn about (a region too thin for the grid has none) */
    var order = nest.regions.map(function (r, i) { return i; }).filter(function (i) { return rm.room[i] && i !== nest.outer && nest.mean[i] < nest.mean[nest.outer]; })
                    .sort(function (a, b) { return nest.mean[a] - nest.mean[b] || a - b; });
    if (!order.length) return { none: 'the regions that would make a shallower outside are too thin to turn the picture about', from: nest.mean[nest.outer] };
    var ch = order[0], c = rm.room[ch].p, m = rm.room[ch].room;
    return { game: turn(g, polys, c, m, rm.box), from: nest.mean[nest.outer], to: nest.mean[ch], room: m, at: c, spots: nest.regions[ch].spots.slice() };
  }

  var api = { insideOut: inside_out, nesting: nesting, roomiest: roomiest, turn: turn, polyline: polyline };
  root.SproutsFlip = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : this);
