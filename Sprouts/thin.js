/* =========================================================================
   thin.js — moves that are always drawn (the `thin` branch, Peter 10/30):
   for MAKING a move, spots are points and curves have no width ("infinitely
   thin is a euphemism for computer arithmetic"). A move's route is found in
   a constrained triangulation of the drawing — our own code — whose
   constraints are the curves' refined control polygons and whose vertices
   include every spot: a walk through the triangles of the move's region from
   a triangle at spot a to one at spot b, through the interiors of the
   triangles and their shared sides, can never cross or touch a curve or pass
   through a spot, however narrow the gap. The visual standards (clearance,
   spot discs) are kept where there is room by the ordinary router; this one
   is used where that fails.
   DOM-free (global SproutsThin, or require()). Needs geom.js.

   Robustness: the orientation test is exact (a floating-point filter, then
   BigInt arithmetic on the doubles' exact values), so the triangulation is
   valid whatever the input; the in-circle test is floating point and only
   decides which flips make the triangles nicer (Lawson flips, each one
   checked to keep the quadrilateral convex with the exact test).
   ========================================================================= */
(function (root) {
  'use strict';
  var G = root.SproutsGeom || require('./geom.js');

  /* ---------------- exact orientation ---------------- */
  var EPS = Math.pow(2, -53), ERRB = (3 + 16 * EPS) * EPS;
  var dv = new DataView(new ArrayBuffer(8));
  function decomp(x) {                         // x = m · 2^e exactly (m a BigInt)
    dv.setFloat64(0, x);
    var hi = dv.getUint32(0), lo = dv.getUint32(4), ex = (hi >>> 20) & 0x7ff;
    var m = (BigInt(hi & 0xfffff) << 32n) | BigInt(lo), e;
    if (ex === 0) e = -1074; else { m |= 1n << 52n; e = ex - 1075; }
    if (hi >>> 31) m = -m;
    return [m, e];
  }
  function exactOrient(ax, ay, bx, by, cx, cy) {
    var d = [ax, ay, bx, by, cx, cy].map(decomp), e0 = Infinity, i;
    for (i = 0; i < 6; i++) if (d[i][0] !== 0n && d[i][1] < e0) e0 = d[i][1];
    if (e0 === Infinity) return 0;
    var v = d.map(function (q) { return q[0] << BigInt(q[1] - e0); });
    var det = (v[2] - v[0]) * (v[5] - v[1]) - (v[3] - v[1]) * (v[4] - v[0]);
    return det > 0n ? 1 : det < 0n ? -1 : 0;
  }
  /* > 0: c is to the left of a → b (counter-clockwise, y up as in the formula; on the screen, y down, it is
     clockwise — only the sign's consistency matters here) */
  function orient(a, b, c) {
    var l = (b[0] - a[0]) * (c[1] - a[1]), r = (b[1] - a[1]) * (c[0] - a[0]), det = l - r;
    if (Math.abs(det) > ERRB * (Math.abs(l) + Math.abs(r))) return det;
    return exactOrient(a[0], a[1], b[0], b[1], c[0], c[1]);
  }
  /* > 0: d is certainly inside the circle through a, b, c (a, b, c counter-clockwise) — the determinant beyond
     its rounding error bound (Shewchuk's iccerrboundA); a doubtful case counts as not inside, so a flip and
     its reverse can never both be wanted (Lawson's flips cycled forever on near-cocircular spots) */
  var ICC = (10 + 96 * EPS) * EPS;
  function inCircle(a, b, c, d) {
    var adx = a[0] - d[0], ady = a[1] - d[1], bdx = b[0] - d[0], bdy = b[1] - d[1], cdx = c[0] - d[0], cdy = c[1] - d[1];
    var al = adx * adx + ady * ady, bl = bdx * bdx + bdy * bdy, cl = cdx * cdx + cdy * cdy;
    var bc = bdx * cdy - bdy * cdx, ca = cdx * ady - cdy * adx, ab = adx * bdy - ady * bdx;
    var det = al * bc + bl * ca + cl * ab;
    var perm = (Math.abs(bdx * cdy) + Math.abs(bdy * cdx)) * al + (Math.abs(cdx * ady) + Math.abs(cdy * adx)) * bl + (Math.abs(adx * bdy) + Math.abs(ady * bdx)) * cl;
    return det > ICC * perm ? det : 0;
  }
  /* segments p-q and r-s cross at a point inside both (not at an end) */
  function properCross(p, q, r, s) {
    var o1 = orient(p, q, r), o2 = orient(p, q, s);
    if (!(o1 > 0 && o2 < 0) && !(o1 < 0 && o2 > 0)) return false;
    var o3 = orient(r, s, p), o4 = orient(r, s, q);
    return (o3 > 0 && o4 < 0) || (o3 < 0 && o4 > 0);
  }

  /* ---------------- the triangulation ----------------
     Half-edges as in Delaunator: half-edge h goes from vertex T[h] to T[nxt(h)];
     triangle t has half-edges 3t, 3t+1, 3t+2 (counter-clockwise); A[h] is the
     opposite half-edge (−1 on the hull), C[h] the constraint (curve) it lies on
     (−1: none), VH[v] a half-edge leaving vertex v. */
  function nxt(h) { return h % 3 === 2 ? h - 2 : h + 1; }
  function prv(h) { return h % 3 === 0 ? h + 2 : h - 1; }

  function Mesh(P) {
    this.P = P; this.T = []; this.A = []; this.C = []; this.VH = new Array(P.length).fill(-1); this.last = 0;
  }
  Mesh.prototype.setTri = function (t, a, b, c) {
    var T = this.T; T[3 * t] = a; T[3 * t + 1] = b; T[3 * t + 2] = c;
    this.VH[a] = 3 * t; this.VH[b] = 3 * t + 1; this.VH[c] = 3 * t + 2;
  };
  Mesh.prototype.link = function (h, o, c) {
    this.A[h] = o; this.C[h] = c;
    if (o >= 0) { this.A[o] = h; this.C[o] = c; }
  };
  Mesh.prototype.newTri = function () { var t = this.T.length / 3; this.T.push(0, 0, 0); this.A.push(-1, -1, -1); this.C.push(-1, -1, -1); return t; };
  /* the triangle containing p (or with p on a side): walk from the last one */
  Mesh.prototype.locate = function (p) {
    var T = this.T, A = this.A, P = this.P, t = this.last, guard = 0, nT = T.length / 3;
    for (;;) {
      if (++guard > 4 * nT + 100) return this.scan(p);   // (a walk in a constrained triangulation can go round in circles)
      var s = (guard * 7) % 3, moved = false;
      for (var k = 0; k < 3; k++) {
        var h = 3 * t + (s + k) % 3;
        if (orient(P[T[h]], P[T[nxt(h)]], p) < 0) {
          if (A[h] < 0) throw new Error('thin: a point outside the triangulation');
          t = Math.floor(A[h] / 3); moved = true; break;
        }
      }
      if (!moved) { this.last = t; return t; }
    }
  };
  /* the triangle containing p, by looking at every one */
  Mesh.prototype.scan = function (p) {
    var T = this.T, P = this.P, nT = T.length / 3;
    for (var t = 0; t < nT; t++)
      if (orient(P[T[3 * t]], P[T[3 * t + 1]], p) >= 0 && orient(P[T[3 * t + 1]], P[T[3 * t + 2]], p) >= 0 && orient(P[T[3 * t + 2]], P[T[3 * t]], p) >= 0) { this.last = t; return t; }
    throw new Error('thin: a point outside the triangulation');
  };
  /* flip the side of half-edge h: the triangles (a, b, c) and (b, a, d) become (a, d, c) and (d, b, c) */
  Mesh.prototype.flip = function (h) {
    var T = this.T, A = this.A, C = this.C, o = A[h];
    var t = Math.floor(h / 3), u = Math.floor(o / 3);
    var a = T[h], b = T[nxt(h)], c = T[prv(h)], d = T[prv(o)];
    var x1 = A[nxt(o)], c1 = C[nxt(o)], x2 = A[prv(h)], c2 = C[prv(h)], x3 = A[prv(o)], c3 = C[prv(o)], x4 = A[nxt(h)], c4 = C[nxt(h)];
    this.setTri(t, a, d, c); this.setTri(u, d, b, c);
    this.link(3 * t, x1, c1); this.link(3 * t + 2, x2, c2);
    this.link(3 * u, x3, c3); this.link(3 * u + 1, x4, c4);
    this.link(3 * t + 1, 3 * u + 2, -1);
    return [t, u];
  };
  /* make the side h Delaunay, and the sides that a flip exposes (opposite the inserted vertex) */
  Mesh.prototype.legalize = function (h0) {
    var stack = [h0], T = this.T, A = this.A, C = this.C, P = this.P;
    while (stack.length) {
      var h = stack.pop(), o = A[h];
      if (o < 0 || C[h] !== -1) continue;
      var a = P[T[h]], b = P[T[nxt(h)]], c = P[T[prv(h)]], d = P[T[prv(o)]];
      if (inCircle(a, b, c, d) <= 0) continue;
      if (!(orient(a, d, c) > 0 && orient(d, b, c) > 0)) continue;   // (not convex: no flip)
      var tu = this.flip(h);
      stack.push(3 * tu[0], 3 * tu[1]);
    }
  };
  Mesh.prototype.insert = function (v) {
    var P = this.P, T = this.T, A = this.A, C = this.C, p = P[v], t = this.locate(p), k;
    var on = -1;
    for (k = 0; k < 3; k++) if (orient(P[T[3 * t + k]], P[T[nxt(3 * t + k)]], p) === 0) on = 3 * t + k;
    if (on < 0) {
      var a = T[3 * t], b = T[3 * t + 1], c = T[3 * t + 2];
      var xa = A[3 * t], ca = C[3 * t], xb = A[3 * t + 1], cb = C[3 * t + 1], xc = A[3 * t + 2], cc = C[3 * t + 2];
      var t1 = this.newTri(), t2 = this.newTri();
      this.setTri(t, a, b, v); this.setTri(t1, b, c, v); this.setTri(t2, c, a, v);
      this.link(3 * t, xa, ca); this.link(3 * t1, xb, cb); this.link(3 * t2, xc, cc);
      this.link(3 * t + 1, 3 * t1 + 2, -1); this.link(3 * t1 + 1, 3 * t2 + 2, -1); this.link(3 * t2 + 1, 3 * t + 2, -1);
      this.legalize(3 * t); this.legalize(3 * t1); this.legalize(3 * t2);
      return;
    }
    /* on the side `on` (a → b) of triangle (a, b, c), shared with (b, a, d): four triangles */
    var h = on, o = A[h], a2 = T[h], b2 = T[nxt(h)], c2 = T[prv(h)], ch = C[h];
    var xbc = A[nxt(h)], cbc = C[nxt(h)], xca = A[prv(h)], cca = C[prv(h)];
    var tA = Math.floor(h / 3), tB = this.newTri();
    this.setTri(tA, c2, a2, v); this.setTri(tB, b2, c2, v);
    this.link(3 * tA, xca, cca); this.link(3 * tB, xbc, cbc); this.link(3 * tA + 1, -1, ch); this.link(3 * tB + 1, 3 * tA + 2, -1);
    var outs = [3 * tA, 3 * tB];
    if (o >= 0) {
      var d2 = T[prv(o)], xad = A[nxt(o)], cad = C[nxt(o)], xdb = A[prv(o)], cdb = C[prv(o)];
      var tC = Math.floor(o / 3), tD = this.newTri();
      this.setTri(tC, a2, d2, v); this.setTri(tD, d2, b2, v);
      this.link(3 * tC, xad, cad); this.link(3 * tD, xdb, cdb); this.link(3 * tC + 1, 3 * tD + 2, -1);
      this.link(3 * tA + 1, 3 * tC + 2, ch);      // a → v / v → a
      this.link(3 * tB + 2, 3 * tD + 1, ch);      // v → b / b → v
      outs.push(3 * tC, 3 * tD);
    } else this.link(3 * tB + 2, -1, ch);
    for (k = 0; k < outs.length; k++) this.legalize(outs[k]);
  };
  /* the half-edges leaving vertex v, counter-clockwise */
  Mesh.prototype.around = function (v) {
    var out = [], h0 = this.VH[v], h = h0, guard = 0;
    if (h0 < 0) return out;
    for (;;) {                                  // clockwise first from h0 to the hull, if any
      out.push(h);
      var o = this.A[prv(h)];
      if (o < 0) break;
      h = o;
      if (h === h0 || ++guard > 1e6) return out;
    }
    h = h0;                                     // hit the hull: collect the other way too
    for (;;) {
      var q = this.A[h];
      if (q < 0) break;
      h = nxt(q);
      out.unshift(h);
      if (++guard > 1e6) break;
    }
    return out;
  };
  Mesh.prototype.halfEdge = function (u, v) {
    var hs = this.around(u);
    for (var i = 0; i < hs.length; i++) if (this.T[nxt(hs[i])] === v) return hs[i];
    return -1;
  };
  /* Insert the constraint u → v (id: the curve it belongs to). Returns null, or { cross: [id, id2] } when it
     crosses a constraint already in (two curves' polygons cross: they must be refined). */
  Mesh.prototype.constrain = function (u, v, id) {
    var P = this.P, T = this.T, A = this.A, C = this.C, self = this;
    var todo = [[u, v]], guard = 0;
    while (todo.length) {
      var seg = todo.pop(), s = seg[0], e = seg[1];
      if (s === e) continue;
      var h = this.halfEdge(s, e);
      if (h >= 0) { this.link(h, A[h], id); continue; }
      /* the triangle at s that the segment leaves through */
      var hs = this.around(s), first = -1, split = -1, ps = P[s], pe = P[e], k;
      for (k = 0; k < hs.length && first < 0 && split < 0; k++) {
        var x = T[nxt(hs[k])], y = T[prv(hs[k])], ox = orient(ps, P[x], pe), oy = orient(ps, P[y], pe);
        if (ox === 0 && (P[x][0] - ps[0]) * (pe[0] - ps[0]) + (P[x][1] - ps[1]) * (pe[1] - ps[1]) > 0) split = x;
        else if (ox > 0 && oy < 0) first = nxt(hs[k]);
      }
      if (split >= 0) { todo.push([split, e], [s, split]); continue; }
      if (first < 0) throw new Error('thin: a constraint leaves no triangle');
      /* the sides it crosses, as vertex pairs */
      var crossed = [], hh = first;
      for (;;) {
        if (++guard > 1e7) throw new Error('thin: constraint walk did not end');
        if (C[hh] !== -1) return { cross: [id, C[hh]] };
        crossed.push([T[hh], T[nxt(hh)]]);
        var o = A[hh];
        if (o < 0) throw new Error('thin: a constraint leaves the triangulation');
        var w = T[prv(o)];
        if (w === e) break;
        var ow = orient(ps, pe, P[w]);
        if (ow === 0) { split = w; break; }
        /* o goes y → x; its triangle (y, x, w): the side crossed next is x → w or w → y */
        hh = properCross(ps, pe, P[T[nxt(o)]], P[w]) ? nxt(o) : prv(o);
      }
      if (split >= 0) { todo.push([split, e]); e = split; }
      /* Sloan: flip the crossed sides away */
      var queue = crossed, rounds = 0;
      while (queue.length) {
        if (++rounds > 1e7) throw new Error('thin: flips did not end');
        var pq = queue.shift(), h2 = this.halfEdge(pq[0], pq[1]);
        if (h2 < 0) continue;
        var a = P[T[h2]], b = P[T[nxt(h2)]], c = P[T[prv(h2)]], d = P[T[prv(A[h2])]];
        if (!(orient(a, d, c) > 0 && orient(d, b, c) > 0)) { queue.push(pq); continue; }
        var vc = T[prv(h2)], vd = T[prv(A[h2])];
        this.flip(h2);
        if (vc !== s && vc !== e && vd !== s && vd !== e && properCross(ps, P[e], P[vc], P[vd])) queue.push([vc, vd]);
      }
      var hf = this.halfEdge(s, e);
      if (hf < 0) throw new Error('thin: a constraint is missing after the flips');
      this.link(hf, A[hf], id);
    }
    return null;
  };

  /* A curve's refined control polygon (geom.js refinedPolygon) — except that a STRAIGHT piece (a thin move's
     polyline, engine.js polylinePieces: its inner control points at a third and two thirds, collinear but for
     rounding) gives its end point only: its inner points would make slivers of area 1e-14 that a walk can
     pass within rounding of. eps[k]: the tolerance for piece k. Returns the points, and for each leg (from
     pts[i] to pts[i + 1]) its piece and how far that piece is from its polygon. */
  function polygonOf(pieces, eps) {
    var pts = [pieces[0][0]], piece = [], within = [];
    pieces.forEach(function (b, k) {
      var g1 = Math.hypot(b[0][0] - 2 * b[1][0] + b[2][0], b[0][1] - 2 * b[1][1] + b[2][1]);
      var g2 = Math.hypot(b[1][0] - 2 * b[2][0] + b[3][0], b[1][1] - 2 * b[2][1] + b[3][1]);
      var gap = Math.max(g1, g2) / 3, len = G.dist(b[0], b[3]);
      if (gap <= 1e-12 * (1 + len)) { pts.push(b[3]); piece.push(k); within.push(gap); return; }
      /* a piece within its tolerance of its chord (its control points are, and so the piece — it lies in their
         hull): the chord alone (a thin move's smooth curve has thousands of short pieces; their control
         polygons, three legs each, made every later triangulation three times as large) */
      var dev = Math.max(G.distPointSeg(b[1], b[0], b[3]), G.distPointSeg(b[2], b[0], b[3]));
      if (dev <= eps[k]) { pts.push(b[3]); piece.push(k); within.push(dev); return; }
      var rp = G.refinedPolygon([b], eps[k], Infinity);
      for (var i = 1; i < rp.pts.length; i++) { pts.push(rp.pts[i]); piece.push(k); within.push(rp.eps); }
    });
    return { pts: pts, piece: piece, eps: within };
  }
  /* the polygon tolerances, one per piece of every curve: 0.25 px to begin with (as relax.js), or what a
     curve's pieces were refined to before (remembered by its pieces array, which a curve keeps until it is
     redrawn) */
  var refinedTo = typeof WeakMap !== 'undefined' ? new WeakMap() : null;
  function startEps(gm) {
    return gm.edges.map(function (e) {
      var r = refinedTo && refinedTo.get(e.pieces);
      return r && r.length === e.pieces.length ? r.slice() : e.pieces.map(function () { return 0.25; });
    });
  }
  function remember(gm, eps) { if (refinedTo) gm.edges.forEach(function (e, i) { refinedTo.set(e.pieces, eps[i].slice()); }); }

  /* ---------------- the drawing as a triangulation ----------------
     gm: { spots, edges, W0, H0 }; eps[ei][k]: the polygon tolerance for piece k of curve ei. Vertices: the
     window's corners, the spots, every point of every refined polygon. Constraints: the window's sides
     (id −2) and every polygon leg (id = its number L; legEdge[L], legPiece[L] say whose, legEps[L] how far
     the curve may be from it). Returns { mesh, vid (spot → vertex), legEdge, legPiece, legEps } or
     { cross: [L, …] }: legs that cross another (all of them — each skipped and the next tried). */
  function build(gm, eps) {
    var P = [], key = new Map();
    function vtx(p) {
      var k = p[0] + ',' + p[1], i = key.get(k);
      if (i === undefined) { i = P.length; P.push([p[0], p[1]]); key.set(k, i); }
      return i;
    }
    var W = gm.W0, H = gm.H0, M = 16 * Math.max(W, H);
    /* the big triangle round everything (its vertices are 0, 1, 2) */
    vtx([-M, -M]); vtx([3 * M, -M]); vtx([-M, 3 * M]);
    var corners = [vtx([0, 0]), vtx([W, 0]), vtx([W, H]), vtx([0, H])];
    var vid = gm.spots.map(function (s) { return vtx([s.x, s.y]); });
    var polys = gm.edges.map(function (e, ei) {
      var rp = polygonOf(e.pieces, eps[ei]);
      return { ids: rp.pts.map(vtx), piece: rp.piece, eps: rp.eps };
    });
    var mesh = new Mesh(P);
    var t0 = mesh.newTri(); mesh.setTri(t0, 0, 1, 2);
    if (orient(P[0], P[1], P[2]) < 0) mesh.setTri(t0, 0, 2, 1);
    for (var i = 3; i < P.length; i++) mesh.insert(i);
    var k;
    for (k = 0; k < 4; k++) { var r = mesh.constrain(corners[k], corners[(k + 1) % 4], -2); if (r) return { cross: [] }; }
    var legEdge = [], legPiece = [], legEps = [], cross = [];
    for (var ei = 0; ei < polys.length; ei++) {
      var pl = polys[ei], ids = pl.ids;
      for (k = 1; k < ids.length; k++) {
        var L = legEdge.length;
        legEdge.push(ei); legPiece.push(pl.piece[k - 1]); legEps.push(pl.eps[k - 1]);
        var r2 = mesh.constrain(ids[k - 1], ids[k], L);
        if (r2) r2.cross.forEach(function (x) { if (x >= 0) cross.push(x); });
      }
    }
    if (cross.length) return { cross: cross, legEdge: legEdge, legPiece: legPiece, legEps: legEps };
    /* a SPOT nearer to a polygon leg than the leg's curve may be from it: the polygon may pass on the other side
       of the spot than the curve does — refined like a crossing (measured 10/31, Peter's loops through the gap at
       spot 1: a curve 0.056 px from it, its polygon on the far side, and the hug round that polygon enclosed 1) */
    vid.forEach(function (v) {
      mesh.around(v).forEach(function (h) {
        var o = nxt(h), id = mesh.C[o];
        if (id >= 0 && !(G.distPointSeg(P[v], P[mesh.T[o]], P[mesh.T[nxt(o)]]) > legEps[id])) cross.push(id);
      });
    });
    if (cross.length) return { cross: cross, legEdge: legEdge, legPiece: legPiece, legEps: legEps };
    return { mesh: mesh, vid: vid, legEdge: legEdge, legPiece: legPiece, legEps: legEps, W: W, H: H, polyIds: polys.map(function (p) { return p.ids; }), edges: gm.edges };
  }
  /* build, refining the polygons of curves whose polygons cross until they do not */
  function triangulate(gm, eps0) {
    var eps = (eps0 || startEps(gm)).map(function (a) { return a.slice(); });
    for (;;) {
      var r = build(gm, eps);
      if (!r.cross) { r.eps = eps; remember(gm, eps); return r; }
      if (!r.cross.length) return null;           // (the window's sides: something lies across them)
      var refined = false;                       // (a straight piece is its own polygon: nothing to refine)
      r.cross.forEach(function (L) {
        var e = r.legEdge[L], k = r.legPiece[L], to = r.legEps[L] / 16;
        if (r.legEps[L] > 1e-12 && to < eps[e][k] && to >= 1e-9) { eps[e][k] = to; refined = true; }
      });
      if (!refined) return null;                 // (the curves themselves cross or touch)
    }
  }

  /* The curves that cross or touch others: their indices in gm.edges (empty if none) — as triangulate, the
     polygons refined where they cross until they do not, or until a crossing is left that refining does not
     remove (for a picture kept as shown: ui.js freezeRelaying) */
  function crossingCurves(gm) {
    var eps = startEps(gm).map(function (a) { return a.slice(); });
    for (;;) {
      var r = build(gm, eps);
      if (!r.cross) return [];
      if (!r.cross.length) return [-1];          // (something lies across the window's sides)
      var refined = false, left = {};
      r.cross.forEach(function (L) {
        var e = r.legEdge[L], k = r.legPiece[L], to = r.legEps[L] / 16;
        if (r.legEps[L] > 1e-12 && to < eps[e][k] && to >= 1e-9) { eps[e][k] = to; refined = true; } else left[e] = 1;
      });
      if (!refined) return Object.keys(left).map(Number);
    }
  }

  /* ---------------- the router ----------------
     A walk through the triangles of the move's region. The curve goes from spot a to the middle of a side of
     its first triangle, from there to the middle of a side of the next triangle, and so on, and from the
     middle of the last side straight to spot b (that last triangle has b as a corner): every leg joins two
     points on the boundary of one triangle (or its corner), so it lies inside it — the curve crosses and
     touches nothing. (Not through the triangles' centroids: a sliver's centroid lies on its long side.)
     The walk chosen is the shortest when every leg's length counts as is where the leg has `enough` room
     (the minimum clearance) and is stretched by enough/room where it has less: as short as can be, as
     wide as can be where it is narrow. (Tried first and measured on a 100-seed game: the widest walk, then
     the shortest as wide — the widest goes round everything, and the shortest as wide as the narrowest
     place on the way hugs every other corner at that width: each curve then halved the gaps it passed, and
     after some 30 moves they were 1e-12 px.) */
  function Heap() { this.k = []; this.v = []; }
  Heap.prototype.push = function (key, val) {
    var k = this.k, v = this.v, i = k.length; k.push(key); v.push(val);
    while (i > 0) { var j = (i - 1) >> 1; if (k[j] <= key) break; k[i] = k[j]; v[i] = v[j]; i = j; }
    k[i] = key; v[i] = val;
  };
  Heap.prototype.pop = function () {
    var k = this.k, v = this.v, top = v[0], tk = k[0], lk = k.pop(), lv = v.pop(), n = k.length;
    if (n) {
      var i = 0;
      for (;;) { var l = 2 * i + 1, r = l + 1, m = i, mk = lk;
        if (l < n && k[l] < mk) { m = l; mk = k[l]; }
        if (r < n && k[r] < mk) { m = r; mk = k[r]; }
        if (m === i) break; k[i] = k[m]; v[i] = v[m]; i = m; }
      k[i] = lk; v[i] = lv;
    }
    this.topKey = tk;
    return top;
  };
  Heap.prototype.size = function () { return this.k.length; };

  function Router(gm, tri) {
    this.gm = gm; this.tri = tri; this.mesh = tri.mesh;
    var m = this.mesh, P = m.P, T = m.T, n = T.length / 3;
    this.cen = new Array(n);
    for (var t = 0; t < n; t++) {
      var a = P[T[3 * t]], b = P[T[3 * t + 1]], c = P[T[3 * t + 2]];
      this.cen[t] = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3];
    }
  }
  /* FREE POINTS for the hug (Router.hug): the middle of every side of the triangles `tris` that is no curve,
     and every centroid, inserted (the constraints kept) — but not in an EAR, a triangle with two sides
     curves (a dent of a curve's polygon, or the corner between two curves at a spot: a dead end no
     connecting path needs, which the hug fills — split, it would draw the hug into it); and none nearer to a
     curve's polygon than twice what the curve may be from it (the curve itself may pass nearer — in a
     shallow dent of a polygon, say — and the hug crosses a triangle side between a curve's point and a free
     one at its middle). The triangulation's own vertices are all spots and
     points of curves — obstacles; a connecting path needs points of its own to run through. Returns the
     number of vertices before (every vertex from there on is free). */
  Router.prototype.refineFree = function (tris) {
    var m = this.mesh, P = m.P, T = m.T, A = m.A, C = m.C, n0 = P.length, pts = [], seen = new Set();
    function ear(t) { return (C[3 * t] !== -1) + (C[3 * t + 1] !== -1) + (C[3 * t + 2] !== -1) >= 2; }
    var og = obstacleGrid(this.tri), legEps = this.tri.legEps, skipped = this.skipped = {};
    function clear(p) {                            // p twice as far from every curve's polygon as the curve may be from it
      var ok = true;
      og.g.querySeg(p, p, 2 * og.maxEps, function (it) {
        if (it >= og.ns) return;
        var h = og.segs[it];
        if (C[h] >= 0 && !(G.distPointSeg(p, P[T[h]], P[T[nxt(h)]]) > 2 * legEps[C[h]])) { ok = false; skipped[C[h]] = 1; }
      });
      return ok;
    }
    tris.forEach(function (t) {
      if (ear(t)) return;
      for (var k = 0; k < 3; k++) {
        var h = 3 * t + k, u = T[h], v = T[nxt(h)], key = u < v ? u + ',' + v : v + ',' + u;
        if (C[h] !== -1 || seen.has(key) || (A[h] >= 0 && ear(Math.floor(A[h] / 3)))) continue;
        seen.add(key);
        var q = [(P[u][0] + P[v][0]) / 2, (P[u][1] + P[v][1]) / 2];
        if (clear(q)) pts.push(q);
      }
      var a = P[T[3 * t]], b = P[T[3 * t + 1]], c = P[T[3 * t + 2]], cq = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3];
      if (clear(cq)) pts.push(cq);
    });
    pts.forEach(function (p) { var v = P.length; P.push(p); m.insert(v); });
    var nT = T.length / 3;
    this.cen = new Array(nT);
    for (var t = 0; t < nT; t++) {
      var a2 = P[T[3 * t]], b2 = P[T[3 * t + 1]], c2 = P[T[3 * t + 2]];
      this.cen[t] = [(a2[0] + b2[0] + c2[0]) / 3, (a2[1] + b2[1] + c2[1]) / 3];
    }
    this.adj = null; this.tri.grid = null;
    return n0;
  };
  Router.prototype.live = function (t) { var T = this.mesh.T; return T[3 * t] > 2 && T[3 * t + 1] > 2 && T[3 * t + 2] > 2; };
  /* THE SIDE at spot s that direction dir (from s) points into, as a test of points: whether q lies in a
     triangle at s of the same sector — the triangles round s between two of its curves' polygon legs.
     (Testing directions against the curves' tangents at s put a triangle whose curves bend away
     near s on the wrong side: a centroid can lie beyond a tangent while the triangle lies between the
     curves.) Kept up to date as vertices are inserted (refineFree). */
  Router.prototype.sideAt = function (s, dir) {
    var m = this.mesh, v = this.tri.vid[s], P = m.P, T = m.T, A = m.A, C = m.C, n = -1, set = null;
    function wedge(p) {                            // the triangle at v whose corner at v holds the direction to p
      var hs = m.around(v), c = P[v];
      for (var i = 0; i < hs.length; i++) {
        var h = hs[i], x = P[T[nxt(h)]], y = P[T[prv(h)]];
        if (orient(c, x, p) >= 0 && orient(c, p, y) >= 0) return Math.floor(h / 3);
      }
      return -1;
    }
    function sector() {
      if (n === T.length) return;
      n = T.length; set = new Set();
      var t0 = wedge([P[v][0] + dir[0], P[v][1] + dir[1]]);
      if (t0 < 0) return;
      var stack = [t0];
      set.add(t0);
      while (stack.length) {
        var t = stack.pop();
        for (var k = 0; k < 3; k++) {
          var h = 3 * t + k;
          if ((T[h] !== v && T[nxt(h)] !== v) || C[h] !== -1 || A[h] < 0) continue;   // (across a side at v that is no curve)
          var u = Math.floor(A[h] / 3);
          if (!set.has(u)) { set.add(u); stack.push(u); }
        }
      }
    }
    return function (q) { sector(); return set.has(wedge(q)); };
  };
  /* the triangles at spot s whose centroid passes ok (null: all) */
  Router.prototype.at = function (s, ok) {
    var self = this, v = this.tri.vid[s];
    return this.mesh.around(v).map(function (h) { return Math.floor(h / 3); })
      .filter(function (t) { return self.live(t) && (!ok || ok(self.cen[t])); });
  };
  /* the middle of side h — in one of the two triangles at it: rounded, the middle of a side next to a curve
     leg nearly in line with it can fall beyond that leg (measured 10/31: a walk crossing a sharp spike of a
     straight-legged curve), so it is moved into h's triangle by as little as does that */
  Router.prototype.mid = function (h) {
    var m = this.mesh, P = m.P, T = m.T, a = P[T[h]], b = P[T[nxt(h)]], q = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    function inTri(p, t) { return t >= 0 && orient(P[T[3 * t]], P[T[3 * t + 1]], p) >= 0 && orient(P[T[3 * t + 1]], P[T[3 * t + 2]], p) >= 0 && orient(P[T[3 * t + 2]], P[T[3 * t]], p) >= 0; }
    var t = Math.floor(h / 3), u = m.A[h] >= 0 ? Math.floor(m.A[h] / 3) : -1;
    if (inTri(q, t) || inTri(q, u)) return q;
    var c = P[T[prv(h)]];
    for (var f = 1e-12; f < 1; f *= 4) { var q2 = [q[0] + f * (c[0] - q[0]), q[1] + f * (c[1] - q[1])]; if (inTri(q2, t)) return q2; }
    return q;
  };
  /* how far the leg p-q stays from the corners of triangle t (but the spot it starts or ends at, `skip`):
     the room the leg has in t — the triangle's sides that are curves start and end at its corners, and a
     leg between the middles of two sides runs parallel to the third at half the height of the corner
     between them, as far from that side as from the corner */
  Router.prototype.legRoom = function (t, p, q, skip) {
    var P = this.mesh.P, T = this.mesh.T, r = Infinity;
    for (var k = 0; k < 3; k++) { var v = T[3 * t + k]; if (v !== skip) r = Math.min(r, G.distPointSeg(P[v], p, q)); }
    return r;
  };
  /* the walk from spot a to spot b: okA, okB the side tests (null: any side). Returns the polyline from a's
     centre to b's, or null. A state of the search is a side crossed (the half-edge h of the triangle
     entered, the walk at its middle) — and, for a loop, whether h is the first side crossed (the walk may
     not go straight back to a from there). The width of a walk is the least room of its legs (legRoom). */
  Router.prototype.route = function (a, b, okA, okB, enough) {
    var self = this, m = this.mesh, T = m.T, A = m.A, C = m.C, F = a === b ? 2 : 1;
    var P = m.P, va = this.tri.vid[a], vb = this.tri.vid[b], pa = P[va], pb = P[vb], loop = a === b;
    var src = this.at(a, okA), tgt = {};
    this.at(b, okB).forEach(function (t) { tgt[t] = 1; });
    if (!src.length || !Object.keys(tgt).length) return null;
    var mids = new Map();
    function mid(h) { var q = mids.get(h); if (!q) { q = self.mid(h); mids.set(h, q); mids.set(A[h], q); } return q; }
    function open(h) { return A[h] >= 0 && C[h] === -1 && self.live(Math.floor(A[h] / 3)); }
    var D0 = enough || 1;
    /* (room within a few units in the last place of the picture's coordinates is none: a leg across a
       triangle nearly flat at a corner passes the corner at about that, on either side of it once rounded —
       measured 10/31, a walk across the tip of a sharp spike of a straight-legged curve, refused by the
       certificate round after round) */
    var ULP = 8 * Number.EPSILON * Math.max(this.tri.W, this.tri.H);
    function cost(len, room) { return room > ULP ? len * Math.max(1, D0 / room) : Infinity; }
    function search() {
      var heap = new Heap(), best = new Map(), prev = new Map(), done = new Set(), goal = null;
      function offer(st, k, pv) { if (k === Infinity || done.has(st)) return; if (!best.has(st) || k < best.get(st)) { best.set(st, k); prev.set(st, pv); heap.push(k, st); } }
      src.forEach(function (s) {
        if (!loop && tgt[s]) {                       // a and b corners of one triangle: through its centroid
          var c = self.cen[s];
          offer('d' + s, cost(G.dist(pa, c), self.legRoom(s, pa, c, va)) + cost(G.dist(c, pb), self.legRoom(s, c, pb, vb)), { direct: s });
        }
        for (var k = 0; k < 3; k++) {
          var h = 3 * s + k;
          if (T[h] === va || T[nxt(h)] === va || !open(h)) continue;   // (only the side opposite a: a leg along a side at a could lie on another curve's later)
          var md = mid(h);
          offer(A[h] * F + (F - 1), cost(G.dist(pa, md), self.legRoom(s, pa, md, va)), { from: null, h: h });
        }
      });
      while (heap.size()) {
        var st = heap.pop(), key = heap.topKey;
        if (typeof st === 'string') { goal = st; break; }
        if (done.has(st)) continue;
        done.add(st);
        var first = st % F === 1, h = Math.floor(st / F), t = Math.floor(h / 3), md = mid(h);
        if (tgt[t] && !(loop && first) && T[h] !== vb && T[nxt(h)] !== vb)   // the curve may end here: straight on to b (from the side opposite b)
          offer('g' + st, key + cost(G.dist(md, pb), self.legRoom(t, md, pb, vb)), { from: st, end: true });
        for (var k2 = 0; k2 < 3; k2++) {
          var h2 = 3 * t + k2;
          if (h2 === h || !open(h2)) continue;
          var m2 = mid(h2);
          offer(A[h2] * F, key + cost(G.dist(md, m2), self.legRoom(t, md, m2, -1)), { from: st, h: h2 });
        }
      }
      return goal ? { key: best.get(goal), goal: goal, prev: prev } : null;
    }
    var sh = search();
    if (!sh) return null;
    var g = sh.prev.get(sh.goal);
    if (g.direct !== undefined) return [pa, this.cen[g.direct], pb];
    var hs = [];
    for (var st2 = g.from; st2 !== null; ) { var pv = sh.prev.get(st2); hs.push(pv.h); st2 = pv.from; }
    hs.reverse();
    /* a walk that passes a triangle twice is cut short there — straight across it from where it first
       entered to where it last leaves */
    for (;;) {                                   // (each cut shortens the walk)
      var tris = [Math.floor(hs[0] / 3)].concat(hs.map(function (h) { return Math.floor(A[h] / 3); })), seen = new Map(), cut = null;
      for (var k3 = 0; k3 < tris.length && !cut; k3++) {
        if (seen.has(tris[k3]) && !(loop && seen.get(tris[k3]) === 0 && k3 === tris.length - 1)) cut = [seen.get(tris[k3]), k3];
        else if (!seen.has(tris[k3])) seen.set(tris[k3], k3);
      }
      if (!cut) break;
      hs.splice(cut[0], cut[1] - cut[0]);         // (tris[i] … tris[j − 1] and the sides between: the walk leaves tris[i] by hs[j])
      if (!hs.length) return loop ? null : [pa, this.cen[tris[0]], pb];   // (a and b corners of one triangle after all)
    }
    var raw = [pa].concat(hs.map(function (h) { return self.mid(h); }), [pb]);
    return this.simplify(raw, va, vb, D0);
  };
  /* How far the leg p-q is from the drawing — its curves' polygons (less how far the curves may be from
     them) and its spots, up to upTo (no farther is looked) — or −1 if it crosses any; at a curve's end spots (va at its first leg, vb at its
     last) the curves meeting there and the spot itself do not count. */
  Router.prototype.legClear = function (p, q, va, vb, first, last, upTo) {
    var tri = this.tri, og = obstacleGrid(tri), m = this.mesh, P = m.P, T = m.T, C = m.C, segs = og.segs, ns = og.ns, r = upTo;
    og.g.querySeg(p, q, upTo + og.maxEps, function (it) {   // (only whether it has upTo matters)
      if (r < 0) return;
      if (it >= ns) {
        var v = tri.vid[it - ns];
        if ((first && v === va) || (last && v === vb)) return;
        r = Math.min(r, G.distPointSeg(P[v], p, q));
        return;
      }
      var h = segs[it], u0 = T[h], u1 = T[nxt(h)];
      if ((first && (u0 === va || u1 === va)) || (last && (u0 === vb || u1 === vb))) { if (properCross(p, q, P[u0], P[u1])) r = -1; return; }
      if (properCross(p, q, P[u0], P[u1])) { r = -1; return; }
      var d = Math.min(G.distPointSeg(P[u0], p, q), G.distPointSeg(P[u1], p, q), G.distPointSeg(p, P[u0], P[u1]), G.distPointSeg(q, P[u0], P[u1]));
      r = Math.min(r, d - (C[h] >= 0 ? tri.legEps[C[h]] : 0));
    });
    return r;
  };
  /* The walk's polyline made shorter and with fewer corners: from each point, straight on to a far one of
     the following points (see below) such that the straight leg crosses nothing, keeps at least the room of the legs it
     replaces (or `enough`, the minimum clearance, if it has that) and encloses no spot with them (so the
     curve goes round everything as before — the same move). */
  Router.prototype.simplify = function (pts, va, vb, enough) {
    var self = this, n = pts.length, P = this.mesh.P, tri = this.tri, og = obstacleGrid(tri);
    var room = [];                               // room[i]: of the leg from pts[i - 1] to pts[i]
    for (var i = 1; i < n; i++) room[i] = this.legClear(pts[i - 1], pts[i], va, vb, i === 1, i === n - 1, enough);
    function enclosesNone(poly) {                // no spot inside the polygon (a spot on it cannot be: legs keep room)
      var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      poly.forEach(function (p) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); });
      var ok = true;
      og.g.query(x0, y0, x1, y1, function (it) {
        if (!ok || it < og.ns) return;
        var v = tri.vid[it - og.ns], p = P[v];
        if (v === va || v === vb) return;
        if (G.pointInPolygon(p, poly)) ok = false;
      });
      return ok;
    }
    /* the polyline's own legs, and the new ones as they come: a new leg must cross none (a hug doubles back
       along its connecting paths) */
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    pts.forEach(function (p) { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); });
    var own = new BoxGrid(x0 - 1, y0 - 1, x1 + 1, y1 + 1, n), ends = [];
    for (i = 1; i < n; i++) { own.addSeg(pts[i - 1], pts[i], 0, i); ends[i] = [pts[i - 1], pts[i]]; }
    function crossesOwn(i0, k) {
      var p = pts[i0], q = pts[k], bad = false;
      own.querySeg(p, q, 0, function (t) {
        if (bad || (t > i0 && t <= k)) return;   // (the legs it replaces)
        if (properCross(p, q, ends[t][0], ends[t][1])) bad = true;
      });
      return bad;
    }
    var self2 = this, out = [pts[0]], i0 = 0;
    function fits(k) {                             // straight from pts[i0] to pts[k]?
      if (va === vb && (i0 === 0 ? k > n - 3 : k === n - 1 && out.length < 3)) return false;   // (a loop keeps two points at least besides its spot: straight back to it, it would be a point, or a line there and back)
      var least = Infinity;
      for (var q = i0 + 1; q <= k; q++) least = Math.min(least, room[q]);
      var r = self2.legClear(pts[i0], pts[k], va, vb, i0 === 0, k === n - 1, least);
      return r > 0 && r >= least && !crossesOwn(i0, k) && enclosesNone(pts.slice(i0, k + 1));
    }
    while (i0 < n - 1) {
      /* as far forward as a leg fits — found by doubling the reach, then halving between the last that fitted
         and the first that did not (one leg after another took minutes on drawings of thousands of curve pieces;
         a leg found this way may stop short of the farthest that would fit, which is no harm) */
      var j = i0 + 1, bad = -1;
      for (var step = 1; j + step < n; step *= 2) { if (fits(j + step)) j = j + step; else { bad = j + step; break; } }
      if (bad < 0 && j < n - 1 && fits(n - 1)) j = n - 1;
      else if (bad > 0) while (bad - j > 1) { var md = (j + bad) >> 1; if (fits(md)) j = md; else bad = md; }
      out.push(pts[j]);
      if (j > i0 + 1) { var id = ends.length; ends.push([pts[i0], pts[j]]); own.addSeg(pts[i0], pts[j], 0, id); }
      i0 = j;
    }
    if (out.length === 2) out = [out[0], [(out[0][0] + out[1][0]) / 2, (out[0][1] + out[1][1]) / 2], out[1]];   // (a curve has two legs at least: its new spot rides between)
    return out;
  };
  /* THE HUG (thin branch, 10/31; Peter: "it is clear in that picture where the curves must go"): the curve of a
     marked move as the OUTLINE of what it encloses. o: { va, vb (vertices of the move's spots; equal for a
     loop), arc: the marked arc as directed polygon legs [u, v] from va to vb (empty for a loop), holes: the
     marked boundaries [{ verts: Set, legs: [[u, v]] }], base: for a loop, a's own boundary when it is marked
     ({ verts, legs }), left: whether the region is on the arc's left, okA: the side test at a, n0: the first free vertex (refineFree), region: the move's
     triangles (after refineFree), d0: the clearance wanted }.
     1. The BLOB: the arc (for a loop, the spot a), and each marked boundary joined to the blob so far by the
        shortest path along triangle sides through free points (Prim: the nearest boundary first; length
        counted as the walk counts it, dearer where there is less room than d0). Each path
        touches the blob once, so the blob is a tree with the boundaries hanging on it: it fences nothing in.
     2. Its OUTLINE, traced on the region's side: from a, round every vertex of the blob in turn, the curve
        crosses each side at that vertex that is not the blob's — at its middle, or a third of the way along
        when the side's far end is the blob's too (a side passed from both its ends) — and so to b. Every leg
        joins two points of one triangle's boundary: it crosses and touches nothing, and it encloses the blob
        and nothing else. The polyline from a's centre to b's, or null. */
  Router.prototype.hug = function (o) {
    var self = this, m = this.mesh, T = m.T, A = m.A, C = m.C, P = m.P, region = o.region, loop = o.va === o.vb;
    this.unconnected = false;
    function ek(u, v) { return u < v ? u + ',' + v : v + ',' + u; }
    var BV = new Set(), BE = new Set(), arcDir = new Set(), hole = new Map();
    o.arc.forEach(function (l) { BE.add(ek(l[0], l[1])); arcDir.add(l[0] + '>' + l[1]); BV.add(l[0]); BV.add(l[1]); });
    BV.add(o.va); BV.add(o.vb);
    o.holes.forEach(function (h, i) { h.verts.forEach(function (v) { hole.set(v, i); }); });
    if (o.base) { o.base.verts.forEach(function (v) { BV.add(v); }); o.base.legs.forEach(function (l) { BE.add(ek(l[0], l[1])); }); }   // (a loop's own boundary, when marked)
    /* the vertices next to each in the region, along sides that are no curve */
    var adj = new Map();
    region.forEach(function (t) {
      for (var k = 0; k < 3; k++) {
        var h = 3 * t + k;
        if (C[h] !== -1) continue;
        var u = T[h], v = T[nxt(h)];
        if (!adj.has(u)) adj.set(u, new Set());
        adj.get(u).add(v);
      }
    });
    /* the room at a free vertex: how far it is from the drawing (the corners and curve sides of its
       triangles) — a connecting path pays for going where there is little (as the walk, Router.route), or
       it would run along the curves, and the outline between it and them */
    var roomAt = new Map();
    function room(w) {
      if (roomAt.has(w)) return roomAt.get(w);
      var r = Infinity;
      m.around(w).forEach(function (h) {
        var t = Math.floor(h / 3);
        for (var k = 0; k < 3; k++) {
          var x = T[3 * t + k], g = 3 * t + k;
          if (x !== w && (x < o.n0)) r = Math.min(r, G.dist(P[w], P[x]));
          if (C[g] !== -1 && T[g] !== w && T[nxt(g)] !== w) r = Math.min(r, G.distPointSeg(P[w], P[T[g]], P[T[nxt(g)]]));
        }
      });
      roomAt.set(w, r);
      return r;
    }
    /* an arc's curves can have the region on both sides (a boundary that goes along them twice, as round a
       path that ends at a spot): a connecting path leaves an arc's point on the marked side only — the
       side the outline goes along (on the arc's left, from a to b, when o.left) */
    var wedges = new Map();
    for (var i = 1; i < o.arc.length; i++) {
      var u0 = o.arc[i][0], pv = o.left ? o.arc[i - 1][0] : o.arc[i][1], nx = o.left ? o.arc[i][1] : o.arc[i - 1][0];
      if (!wedges.has(u0)) wedges.set(u0, []);
      wedges.get(u0).push([nx, pv]);               // (from the next point counterclockwise round to the previous one)
    }
    function onSide(u, w) {
      var ws = wedges.get(u);
      if (!ws) return true;
      return ws.some(function (x) {
        var c = P[u], n = P[x[0]], q = P[x[1]], p = P[w];
        if (orient(c, n, q) > 0) return orient(c, n, p) > 0 && orient(c, p, q) > 0;
        return !(orient(c, q, p) >= 0 && orient(c, p, n) >= 0);
      });
    }
    /* 1. the blob */
    var joined = new Set(), first = true;
    function addHole(i) { joined.add(i); o.holes[i].verts.forEach(function (v) { BV.add(v); }); o.holes[i].legs.forEach(function (l) { BE.add(ek(l[0], l[1])); }); }
    while (joined.size < o.holes.length) {
      var heap = new Heap(), dist = new Map(), prev = new Map(), done = new Set(), hit = -1;
      BV.forEach(function (v) {
        if (!loop && (v === o.va || v === o.vb)) return;   // (nothing hangs on a or b: the curve starts and ends there)
        if (loop && v === o.va && !first) return;          // (one path from a loop's spot: the curve leaves and returns by it)
        dist.set(v, 0); prev.set(v, -1); heap.push(0, v);
      });
      while (heap.size()) {
        var u = heap.pop(), d = heap.topKey;
        if (done.has(u)) continue;
        done.add(u);
        if (hole.has(u) && !joined.has(hole.get(u)) && !BV.has(u)) { hit = u; break; }
        (adj.get(u) || new Set()).forEach(function (w) {
          if (done.has(w)) return;
          var free = w >= o.n0 && !BV.has(w), goal = hole.has(w) && !joined.has(hole.get(w));
          if (!free && !goal) return;
          if (!onSide(u, w)) return;
          if (u === o.va && loop && o.okA && !o.okA([(P[u][0] + P[w][0]) / 2, (P[u][1] + P[w][1]) / 2])) return;   // (a loop leaves a by its sector)
          var nd = d + G.dist(P[u], P[w]) * Math.max(1, o.d0 / Math.min(free ? room(w) : Infinity, u >= o.n0 && !BV.has(u) ? room(u) : Infinity));
          if (!dist.has(w) || nd < dist.get(w)) { dist.set(w, nd); prev.set(w, u); heap.push(nd, w); }
        });
      }
      if (hit < 0) { self.unconnected = true; return null; }   // (moves.js thinRoute refines what kept free points out)
      for (var x = hit; prev.get(x) >= 0; x = prev.get(x)) { var y = prev.get(x); BE.add(ek(x, y)); BV.add(x); BV.add(y); }
      addHole(hole.get(hit));
      first = false;
    }
    /* 2. the outline */
    function isArc(u, v) { return BE.has(ek(u, v)) && (arcDir.has(u + '>' + v) || arcDir.has(v + '>' + u)); }
    function tourSide(h) {                         // half-edge h (its triangle on its left) runs along the blob on the region's side
      var u = T[h], v = T[nxt(h)];
      if (!BE.has(ek(u, v)) || !region.has(Math.floor(h / 3))) return false;
      if (isArc(u, v)) return arcDir.has(u + '>' + v);   // (an arc's curve is the blob on its marked side only)
      return true;
    }
    /* the blob's EARS filled: a triangle with two sides along the blob (a dent of a curve's polygon, a corner
       between curves at a spot) — the outline would go into it, nearer to the curves than their polygons are
       to them; its third side becomes the blob's. Nothing is cut off (the triangle is empty, its other sides
       are the blob). Not at a or b: the curve starts and ends there. */
    region = new Set(region);
    for (var grown = true; grown;) {
      grown = false;
      region.forEach(function (t) {
        var n = 0, k3 = -1;
        for (var k = 0; k < 3; k++) { if (tourSide(3 * t + k)) n++; else k3 = k; }
        if (n !== 2 || C[3 * t + k3] !== -1) return;
        for (k = 0; k < 3; k++) if (T[3 * t + k] === o.va || T[3 * t + k] === o.vb) return;
        var h3 = 3 * t + k3;
        BE.add(ek(T[h3], T[nxt(h3)])); region.delete(t); grown = true;
      });
    }
    function pt(v, w) { var f = BV.has(w) ? 1 / 3 : 1 / 2; return [P[v][0] + f * (P[w][0] - P[v][0]), P[v][1] + f * (P[w][1] - P[v][1])]; }
    var start, endV, endH = -1, reverse = false;   // (the tour ends with the arc's last leg: b may be on the arc twice)
    if (o.arc.length) {
      /* along the arc from a to b with the region on its left — or, if the region is on its right, from b to a
         (o.left says which: a curve with the region on both sides — its boundary goes along it twice — has
         a region's triangle on either) */
      var h0 = m.halfEdge(o.arc[0][0], o.arc[0][1]);
      if (o.left) { if (h0 < 0 || !region.has(Math.floor(h0 / 3))) return null; start = h0; endV = o.vb; endH = m.halfEdge(o.arc[o.arc.length - 1][0], o.arc[o.arc.length - 1][1]); }
      else {
        reverse = true;
        arcDir = new Set(Array.from(arcDir).map(function (k) { var uv = k.split('>'); return uv[1] + '>' + uv[0]; }));
        var l = o.arc[o.arc.length - 1];
        start = m.halfEdge(l[1], l[0]); endV = o.va; endH = m.halfEdge(o.arc[0][1], o.arc[0][0]);
        if (start < 0 || !region.has(Math.floor(start / 3))) return null;
      }
    } else {
      /* a loop: out along the blob's first side at a that lies in a's sector */
      start = -1; endV = o.va;
      m.around(o.va).forEach(function (h) {
        if (start >= 0 || !tourSide(h)) return;
        var t = Math.floor(h / 3);
        if (!o.okA || o.okA(self.cen[t])) start = h;
      });
      if (start < 0) return null;
    }
    var pts = [], h = start, guard = 0;
    for (;;) {
      if (++guard > 4 * T.length) return null;
      var v = T[nxt(h)];
      if (endH >= 0 ? h === endH : v === endV) break;
      var g = nxt(h);
      for (;;) {
        if (++guard > 4 * T.length) return null;
        var w = T[nxt(g)];
        if (BE.has(ek(v, w))) { if (!tourSide(g)) return null; h = g; break; }
        if (C[g] !== -1) return null;              // (a curve not of the blob: cannot be)
        pts.push(pt(v, w));
        var op = A[g];
        if (op < 0 || !region.has(Math.floor(op / 3))) return null;
        g = nxt(op);
      }
    }
    var startV = reverse ? o.vb : o.va;
    var out = [P[startV]].concat(pts, [P[endV]]);
    if (reverse) out.reverse();
    return out.length >= 3 ? out : null;
  };
  /* The triangles of the region a walk from the triangles `from` can reach (across sides that are no curve). */
  Router.prototype.regionOf = function (from) {
    var m = this.mesh, A = m.A, C = m.C, seen = new Set(from), stack = from.slice();
    while (stack.length) {
      var t = stack.pop();
      for (var k = 0; k < 3; k++) {
        var h = 3 * t + k, o = A[h];
        if (o < 0 || C[h] !== -1) continue;
        var u = Math.floor(o / 3);
        if (!seen.has(u) && this.live(u)) { seen.add(u); stack.push(u); }
      }
    }
    return seen;
  };
  /* a loop at spot s round nothing: inside one triangle at s */
  Router.prototype.loopNothing = function (s, ok) {
    var ts = this.at(s, ok), P = this.mesh.P, T = this.mesh.T, v = this.tri.vid[s];
    if (!ts.length) return null;
    var best = ts[0], bw = -1;                  // the triangle with the widest angle at s
    for (var i = 0; i < ts.length; i++) {
      var t = ts[i], k = T[3 * t] === v ? 0 : T[3 * t + 1] === v ? 1 : 2, x = P[T[3 * t + (k + 1) % 3]], y = P[T[3 * t + (k + 2) % 3]], p = P[v];
      var ang = Math.abs(Math.atan2((x[0] - p[0]) * (y[1] - p[1]) - (x[1] - p[1]) * (y[0] - p[0]), (x[0] - p[0]) * (y[0] - p[0]) + (x[1] - p[1]) * (y[1] - p[1])));
      if (ang > bw) { bw = ang; best = t; }
    }
    var kk = T[3 * best] === v ? 0 : T[3 * best + 1] === v ? 1 : 2, p0 = P[v], x0 = P[T[3 * best + (kk + 1) % 3]], y0 = P[T[3 * best + (kk + 2) % 3]], c0 = this.cen[best];
    return [p0, [(p0[0] + x0[0] + c0[0]) / 3, (p0[1] + x0[1] + c0[1]) / 3], [(p0[0] + y0[0] + c0[0]) / 3, (p0[1] + y0[1] + c0[1]) / 3], p0];
  };
  function router(gm, eps) { var tr = triangulate(gm, eps); return tr ? new Router(gm, tr) : null; }

  /* a uniform grid of boxes: add(box, item), query(box, f) calls f once per item whose box meets it */
  function BoxGrid(x0, y0, x1, y1, n) {
    this.x0 = x0; this.y0 = y0;
    this.cell = Math.max(1e-9, Math.sqrt(Math.max(1e-18, (x1 - x0) * (y1 - y0)) / Math.max(1, n)), Math.max(x1 - x0, y1 - y0) / 2048);
    this.nx = Math.floor((x1 - x0) / this.cell) + 1; this.ny = Math.floor((y1 - y0) / this.cell) + 1;
    this.cells = new Map(); this.stamp = []; this.round = 0;
  }
  BoxGrid.prototype.range = function (lx, ly, hx, hy) {
    var c = this.cell;
    return [Math.max(0, Math.floor((lx - this.x0) / c)), Math.max(0, Math.floor((ly - this.y0) / c)),
            Math.min(this.nx - 1, Math.floor((hx - this.x0) / c)), Math.min(this.ny - 1, Math.floor((hy - this.y0) / c))];
  };
  BoxGrid.prototype.add = function (lx, ly, hx, hy, item) {
    var r = this.range(lx, ly, hx, hy);
    for (var i = r[0]; i <= r[2]; i++) for (var j = r[1]; j <= r[3]; j++) {
      var k = i * 65536 + j, L = this.cells.get(k);
      if (!L) { L = []; this.cells.set(k, L); }
      L.push(item);
    }
  };
  BoxGrid.prototype.query = function (lx, ly, hx, hy, f, fresh) {
    var r = this.range(lx, ly, hx, hy), st = this.stamp, rd = fresh === false ? this.round : ++this.round;
    for (var i = r[0]; i <= r[2]; i++) for (var j = r[1]; j <= r[3]; j++) {
      var L = this.cells.get(i * 65536 + j);
      if (!L) continue;
      for (var q = 0; q < L.length; q++) { var it = L[q]; if (st[it] !== rd) { st[it] = rd; f(it); } }
    }
  };
  /* a segment (grown by r) as the boxes of its pieces no longer than a cell — a long diagonal segment's
     own box would cover a square of cells (out of memory on a 100-seed game's long legs) */
  BoxGrid.prototype.addSeg = function (p, q, r, item) {
    var n = Math.max(1, Math.ceil(G.dist(p, q) / this.cell));
    for (var i = 0; i < n; i++) {
      var a = [p[0] + (q[0] - p[0]) * i / n, p[1] + (q[1] - p[1]) * i / n], b = [p[0] + (q[0] - p[0]) * (i + 1) / n, p[1] + (q[1] - p[1]) * (i + 1) / n];
      this.add(Math.min(a[0], b[0]) - r, Math.min(a[1], b[1]) - r, Math.max(a[0], b[0]) + r, Math.max(a[1], b[1]) + r, item);
    }
  };
  BoxGrid.prototype.querySeg = function (p, q, r, f) {
    var n = Math.max(1, Math.ceil(G.dist(p, q) / this.cell));
    ++this.round;
    for (var i = 0; i < n; i++) {
      var a = [p[0] + (q[0] - p[0]) * i / n, p[1] + (q[1] - p[1]) * i / n], b = [p[0] + (q[0] - p[0]) * (i + 1) / n, p[1] + (q[1] - p[1]) * (i + 1) / n];
      this.query(Math.min(a[0], b[0]) - r, Math.min(a[1], b[1]) - r, Math.max(a[0], b[0]) + r, Math.max(a[1], b[1]) + r, f, false);
    }
  };
  /* the drawing's constraint segments (by half-edge) and spots, in a grid (once per triangulation) */
  function obstacleGrid(tri) {
    if (tri.grid) return tri.grid;
    var m = tri.mesh, P = m.P, T = m.T, A = m.A, C = m.C, segs = [];
    for (var h = 0; h < T.length; h++) if (C[h] !== -1 && (A[h] < 0 || h < A[h])) segs.push(h);   // (the curves, and the window's sides: −2)
    var W = tri.W, H = tri.H, g = new BoxGrid(-1, -1, W + 1, H + 1, segs.length + tri.vid.length);
    segs.forEach(function (h, i) { g.addSeg(P[T[h]], P[T[nxt(h)]], 0, i); });
    var ns = segs.length;
    tri.vid.forEach(function (v, s) { var p = P[v]; g.add(p[0], p[1], p[0], p[1], ns + s); });
    var maxEps = 0; tri.legEps.forEach(function (e) { if (e > maxEps) maxEps = e; });
    tri.grid = { g: g, segs: segs, ns: ns, maxEps: maxEps };
    return tri.grid;
  }
  /* ---------------- the certificate ----------------
     A curve (its refined polygon `pts`, within `eps` of the curve — a number, or one per leg: eps[i − 1] for
     the leg from pts[i − 1] to pts[i]) from spot a to spot b, against the drawing as triangulated (each curve
     within legEps[L] of its polygon's leg L): it must cross nothing and touch nothing — every leg farther from
     every other curve's polygon than the two tolerances together, from every spot but its own ends, and from
     its own legs that are not its neighbours. At its end spots the legs that meet there are only required not
     to cross (the curves meet there). Returns { ok, clearance, near: [L], bad: { leg: least margin } }: the
     clearance is the least margin found; near, the legs of the drawing's curves that were too near (their
     pieces to be refined); bad, the curve's own legs (1-based, as i above) that were. */
  function certify(tri, pts, eps, a, b) {
    var m = tri.mesh, P = m.P, T = m.T, C = m.C, va = tri.vid[a], vb = tri.vid[b], n = pts.length, i;
    var per = typeof eps !== 'number', maxE = 0;
    function E(i) { return per ? eps[i - 1] : eps; }   // (the tolerance of leg i)
    for (i = 1; i < n; i++) maxE = Math.max(maxE, E(i));
    var og = obstacleGrid(tri), segs = og.segs, ns = og.ns, reach = og.maxEps + maxE;
    var worst = Infinity, near = {}, bad = {};
    function mark(i, mg) { if (mg < worst) worst = mg; if (!(mg > 0) && !(bad[i] <= mg)) bad[i] = mg; }
    /* AT AN END SPOT the curve and the drawing's curves meet, so no distance can be asked there — but not
       crossing their polygons' legs is not enough: a leg stands for its piece of curve only within a tolerance,
       and a leg of ours nearly in line with it can cross the curve itself (measured 10/31: an end leg 0.02 px
       from a curve at b, across it). Exact instead: a piece of curve lies in the hull of its control points, so
       a leg of ours from the spot outside that hull's corner at the spot meets the piece nowhere else. The
       piece is the part of the curve the polygon leg stands for (de Casteljau halves, from the spot, until its
       control point or its end is the leg's other end). */
    function apart(id, at, other, far) {
      var e = tri.edges && tri.edges[tri.legEdge[id]];
      if (!e) return true;
      var pc = e.pieces[tri.legPiece[id]], c = P[at], o = P[other];
      if (G.dist(pc[0], c) > G.dist(pc[3], c)) pc = [pc[3], pc[2], pc[1], pc[0]];
      for (var k = 0; k < 64; k++) {
        if (G.dist(pc[1], o) <= 1e-12 * (1 + G.dist(pc[0], o)) || G.dist(pc[3], o) <= 1e-12 * (1 + G.dist(pc[0], o))) break;
        pc = G.splitPiece(pc, 0.5)[0];
      }
      /* the directions from the spot to the piece's other control points span a corner: is ours outside it? */
      var ds = [pc[1], pc[2], pc[3]].filter(function (x) { return G.dist(x, c) > 0; });
      if (!ds.length) return true;
      var lo = ds[0], hi = ds[0];
      ds.forEach(function (x) { if (orient(c, x, lo) > 0) lo = x; if (orient(c, hi, x) > 0) hi = x; });   // (the corner from lo counterclockwise to hi; less than a half turn: a piece leaves its spot one way)
      if (orient(c, lo, hi) < 0) return false;    // (the hull wraps round the spot: no telling)
      return orient(c, lo, far) < 0 || orient(c, far, hi) < 0;
    }
    function segDist(p, q, r, s) {
      if (properCross(p, q, r, s)) return -1;
      return Math.min(G.distPointSeg(p, r, s), G.distPointSeg(q, r, s), G.distPointSeg(r, p, q), G.distPointSeg(s, p, q));
    }
    for (i = 1; i < n; i++) {
      var p = pts[i - 1], q = pts[i], ei = E(i);
      og.g.querySeg(p, q, og.maxEps + ei, function (it) {
        if (it >= ns) {                            // a spot
          var v = tri.vid[it - ns];
          if ((v === va && i === 1) || (v === vb && i === n - 1)) return;
          mark(i, G.distPointSeg(P[v], p, q) - ei);
          return;
        }
        var h = segs[it], u0 = T[h], u1 = T[nxt(h)], id = C[h], room = (id >= 0 ? tri.legEps[id] : 0) + ei;
        var d = segDist(p, q, P[u0], P[u1]);
        if ((i === 1 && (u0 === va || u1 === va)) || (i === n - 1 && (u0 === vb || u1 === vb))) {   // (meeting at an end spot)
          if (d < 0 || (id >= 0 && !apart(id, u0 === va || u0 === vb ? u0 : u1, u0 === va || u0 === vb ? u1 : u0, i === 1 ? q : p))) { mark(i, -1); if (id >= 0) near[id] = 1; }
          return;
        }
        var mg = d - room;
        mark(i, mg);
        if (!(mg > 0) && id >= 0) near[id] = 1;
      });
    }
    /* itself: legs that are not neighbours must not cross, and must be farther apart than the curve can be
       from them together — for a curve with tolerances, legs nearer along the polygon than 2π times the two
       together are neighbours (the curve cannot fold back to within them of itself in less) */
    var arc = [0], x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (i = 0; i < n; i++) {
      if (i) arc.push(arc[i - 1] + G.dist(pts[i - 1], pts[i]));
      x0 = Math.min(x0, pts[i][0]); y0 = Math.min(y0, pts[i][1]); x1 = Math.max(x1, pts[i][0]); y1 = Math.max(y1, pts[i][1]);
    }
    var lg = new BoxGrid(x0 - 1, y0 - 1, x1 + 1, y1 + 1, n);
    for (i = 1; i < n; i++) lg.addSeg(pts[i - 1], pts[i], E(i), i);   // (each leg's box grown by its own tolerance, and found by the other's)
    for (i = 1; i < n; i++) {
      var p2 = pts[i - 1], q2 = pts[i];
      lg.querySeg(p2, q2, E(i), function (t2) {
        if (t2 <= i + 1) return;
        var both = E(i) + E(t2);
        if (a === b && i === 1 && t2 === n - 1) { if (properCross(pts[0], pts[1], pts[n - 2], pts[n - 1])) { mark(i, -1); mark(t2, -1); } return; }   // (a loop's two ends meet at its spot)
        if (both > 0 && arc[t2 - 1] - arc[i] < 2 * Math.PI * both) { if (properCross(p2, q2, pts[t2 - 1], pts[t2])) { mark(i, -1); mark(t2, -1); } return; }
        var d2 = segDist(p2, q2, pts[t2 - 1], pts[t2]) - both;
        mark(i, d2); mark(t2, d2);
      });
    }
    return { ok: worst > 0, clearance: worst, near: Object.keys(near).map(Number), bad: bad };
  }

  var api = { orient: orient, exactOrient: exactOrient, properCross: properCross, Mesh: Mesh, build: build, triangulate: triangulate, crossingCurves: crossingCurves, router: router, Router: Router, certify: certify, polygonOf: polygonOf, startEps: startEps, remember: remember, nxt: nxt, prv: prv };
  root.SproutsThin = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : this);
