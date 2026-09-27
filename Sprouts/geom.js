/* =========================================================================
   geom.js — Sprouts geometry. DOM-free: loaded by the page as the global
   SproutsGeom, by a worker via importScripts, and by Node via require().

   A point is [x, y]. A cubic piece in B-form is [b0, b1, b2, b3].
   A curve is { pieces, h }: pieces[i] starts where pieces[i-1] ends, and
   h[i] is the parameter length of piece i (about its arc length). The knots
   are NOT uniform; the curve is C2 with respect to this parametrisation.
   ========================================================================= */
(function (root) {
  'use strict';

  function dist(p, q) { var dx = p[0] - q[0], dy = p[1] - q[1]; return Math.sqrt(dx * dx + dy * dy); }   // Math.hypot is several times slower

  function polylineLength(pts) {
    var L = 0;
    for (var i = 1; i < pts.length; i++) L += dist(pts[i], pts[i - 1]);
    return L;
  }

  /* Resample a polyline at (nearly) equal arc-length spacing `step`.
     The first and last points are kept exactly. */
  function resample(pts, step) {
    var clean = [pts[0]];
    for (var i = 1; i < pts.length; i++) {
      if (dist(pts[i], clean[clean.length - 1]) > 1e-9) clean.push(pts[i]);
    }
    if (clean.length < 2) return clean;
    var cum = [0];
    for (i = 1; i < clean.length; i++) cum.push(cum[i - 1] + dist(clean[i], clean[i - 1]));
    var L = cum[cum.length - 1];
    var n = Math.max(1, Math.round(L / step));
    var out = [clean[0]], seg = 1;
    for (var k = 1; k < n; k++) {
      var target = L * k / n;
      while (cum[seg] < target) seg++;
      var t = (target - cum[seg - 1]) / (cum[seg] - cum[seg - 1]);
      out.push([clean[seg - 1][0] + t * (clean[seg][0] - clean[seg - 1][0]),
                clean[seg - 1][1] + t * (clean[seg][1] - clean[seg - 1][1])]);
    }
    out.push(clean[clean.length - 1]);
    return out;
  }

  /* ---------------- segments and polygons ---------------- */

  /* Distance from point p to segment ab. */
  function distPointSeg(p, a, b) {
    var vx = b[0] - a[0], vy = b[1] - a[1], wx = p[0] - a[0], wy = p[1] - a[1];
    var vv = vx * vx + vy * vy, t = vv > 0 ? (wx * vx + wy * vy) / vv : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    var ex = wx - t * vx, ey = wy - t * vy;
    return Math.sqrt(ex * ex + ey * ey);
  }

  function orient(a, b, c) { return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]); }

  /* Do segments ab and cd cross at a point interior to both? Shared end
     points and collinear contact do not count (clearance tests catch those). */
  function segCross(a, b, c, d) {
    var o1 = orient(a, b, c), o2 = orient(a, b, d), o3 = orient(c, d, a), o4 = orient(c, d, b);
    return ((o1 > 0 && o2 < 0) || (o1 < 0 && o2 > 0)) && ((o3 > 0 && o4 < 0) || (o3 < 0 && o4 > 0));
  }

  function pointInPolygon(p, poly) {
    var inside = false;
    for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      var a = poly[i], b = poly[j];
      if ((a[1] > p[1]) !== (b[1] > p[1]) &&
          p[0] < a[0] + (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1])) inside = !inside;
    }
    return inside;
  }

  /* ---------------- cubic pieces ---------------- */

  function pieceEval(b, t) {
    var s = 1 - t, c0 = s * s * s, c1 = 3 * s * s * t, c2 = 3 * s * t * t, c3 = t * t * t;
    return [c0 * b[0][0] + c1 * b[1][0] + c2 * b[2][0] + c3 * b[3][0],
            c0 * b[0][1] + c1 * b[1][1] + c2 * b[2][1] + c3 * b[3][1]];
  }

  /* de Casteljau: split one piece at t into [left, right]. For a spline this
     is knot insertion: the curve is unchanged. */
  function splitPiece(b, t) {
    function mix(p, q) { return [p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])]; }
    var p01 = mix(b[0], b[1]), p12 = mix(b[1], b[2]), p23 = mix(b[2], b[3]);
    var p012 = mix(p01, p12), p123 = mix(p12, p23), mid = mix(p012, p123);
    return [[b[0], p01, p012, mid], [mid, p123, p23, b[3]]];
  }

  /* Bound on the distance from any point of the piece to its control polygon:
     (1/3) max |second difference| (Nairn, Peters & Lutterkort 1999, cubic
     case; checked numerically in geom-test.js). A midpoint split divides it by 4. */
  function polygonGap(b) {
    var d1 = Math.hypot(b[0][0] - 2 * b[1][0] + b[2][0], b[0][1] - 2 * b[1][1] + b[2][1]);
    var d2 = Math.hypot(b[1][0] - 2 * b[2][0] + b[3][0], b[1][1] - 2 * b[2][1] + b[3][1]);
    return Math.max(d1, d2) / 3;
  }

  /* Refine the control polygon of a curve, for testing only (the stored spline
     is untouched), until every piece is within epsMax of its polygon and no
     polygon leg is longer than maxLeg. Returns { pts, eps }: the curve lies
     within eps of the polyline pts. */
  function refinedPolygon(pieces, epsMax, maxLeg) {
    var pts = [pieces[0][0]], eps = 0;
    function emit(b, depth) {
      var gap = polygonGap(b);
      var leg = Math.max(dist(b[0], b[1]), dist(b[1], b[2]), dist(b[2], b[3]));
      if (depth < 12 && (gap > epsMax || leg > maxLeg)) {
        var two = splitPiece(b, 0.5);
        emit(two[0], depth + 1); emit(two[1], depth + 1);
      } else {
        if (gap > eps) eps = gap;
        pts.push(b[1], b[2], b[3]);
      }
    }
    for (var i = 0; i < pieces.length; i++) emit(pieces[i], 0);
    return { pts: pts, eps: eps };
  }

  var FLAT = 24;                                  // chords per piece for arc length
  function pieceLengths(b) {
    var cum = [0], prev = b[0];
    for (var i = 1; i <= FLAT; i++) {
      var p = pieceEval(b, i / FLAT);
      cum.push(cum[i - 1] + dist(p, prev));
      prev = p;
    }
    return cum;
  }

  function curveLength(pieces) {
    var L = 0;
    for (var i = 0; i < pieces.length; i++) L += pieceLengths(pieces[i])[FLAT];
    return L;
  }

  /* Cut a curve { pieces, h } at (about) half its arc length by inserting a
     knot there. If that falls within 15% of an existing knot the curve is cut
     at that knot instead, so no sliver piece is created.
     Returns { left: {pieces,h}, right: {pieces,h}, point }. */
  function splitCurveAtHalf(curve) {
    var pieces = curve.pieces, h = curve.h;
    var half = curveLength(pieces) / 2, acc = 0;
    for (var i = 0; i < pieces.length; i++) {
      var cum = pieceLengths(pieces[i]);
      if (acc + cum[FLAT] >= half || i === pieces.length - 1) {
        var want = half - acc, j = 1;
        while (j < FLAT && cum[j] < want) j++;
        var t = (j - 1 + (want - cum[j - 1]) / (cum[j] - cum[j - 1] || 1)) / FLAT;
        if (t < 0.15 && i > 0) {
          return { left: { pieces: pieces.slice(0, i), h: h.slice(0, i) },
                   right: { pieces: pieces.slice(i), h: h.slice(i) }, point: pieces[i][0] };
        }
        if (t > 0.85 && i < pieces.length - 1) {
          return { left: { pieces: pieces.slice(0, i + 1), h: h.slice(0, i + 1) },
                   right: { pieces: pieces.slice(i + 1), h: h.slice(i + 1) }, point: pieces[i][3] };
        }
        t = Math.min(0.85, Math.max(0.15, t));
        var two = splitPiece(pieces[i], t);
        return {
          left: { pieces: pieces.slice(0, i).concat([two[0]]), h: h.slice(0, i).concat([t * h[i]]) },
          right: { pieces: [two[1]].concat(pieces.slice(i + 1)), h: [(1 - t) * h[i]].concat(h.slice(i + 1)) },
          point: two[0][3]
        };
      }
      acc += cum[FLAT];
    }
  }

  /* ---------------- clamped C2 cubic splines on arbitrary knots ---------------- */

  /* Second derivatives M[0..m] of the cubic spline with values y at the knots
     t (increasing, any spacing) and end slopes s0, sm. */
  function clampedM(t, y, s0, sm) {
    var m = t.length - 1, n = m + 1, i;
    var sub = new Array(n).fill(0), dia = new Array(n), sup = new Array(n).fill(0), rhs = new Array(n);
    var h0 = t[1] - t[0], hl = t[m] - t[m - 1];
    dia[0] = h0 / 3; sup[0] = h0 / 6; rhs[0] = (y[1] - y[0]) / h0 - s0;
    for (i = 1; i < m; i++) {
      var ha = t[i] - t[i - 1], hb = t[i + 1] - t[i];
      sub[i] = ha / 6; dia[i] = (ha + hb) / 3; sup[i] = hb / 6;
      rhs[i] = (y[i + 1] - y[i]) / hb - (y[i] - y[i - 1]) / ha;
    }
    sub[m] = hl / 6; dia[m] = hl / 3; rhs[m] = sm - (y[m] - y[m - 1]) / hl;
    return solveTridiagonal(sub, dia, sup, rhs);
  }

  function solveTridiagonal(sub, dia, sup, rhs) {
    var n = dia.length, c = new Array(n), d = new Array(n), x = new Array(n), i;
    c[0] = sup[0] / dia[0]; d[0] = rhs[0] / dia[0];
    for (i = 1; i < n; i++) {
      var den = dia[i] - sub[i] * c[i - 1];
      c[i] = sup[i] / den;
      d[i] = (rhs[i] - sub[i] * d[i - 1]) / den;
    }
    x[n - 1] = d[n - 1];
    for (i = n - 2; i >= 0; i--) x[i] = d[i] - c[i] * x[i + 1];
    return x;
  }

  /* Values of the spline (t, y, M) at the increasing parameters u. */
  function evalSplineAt(t, y, M, u) {
    var out = new Float64Array(u.length), i = 0, m = t.length - 1;
    for (var j = 0; j < u.length; j++) {
      while (i < m - 1 && u[j] > t[i + 1]) i++;
      var h = t[i + 1] - t[i], b = (u[j] - t[i]) / h, a = 1 - b;
      out[j] = a * y[i] + b * y[i + 1] + ((a * a * a - a) * M[i] + (b * b * b - b) * M[i + 1]) * h * h / 6;
    }
    return out;
  }

  /* Solve the symmetric system G x = r for two right-hand sides (Gaussian
     elimination, partial pivoting). G is modified in place. */
  function solve2(G, r1, r2) {
    var k = G.length, i, j, c;
    for (c = 0; c < k; c++) {
      var p = c;
      for (i = c + 1; i < k; i++) if (Math.abs(G[i][c]) > Math.abs(G[p][c])) p = i;
      var tmp = G[c]; G[c] = G[p]; G[p] = tmp;
      var t1 = r1[c]; r1[c] = r1[p]; r1[p] = t1;
      var t2 = r2[c]; r2[c] = r2[p]; r2[p] = t2;
      for (i = c + 1; i < k; i++) {
        var f = G[i][c] / G[c][c];
        if (f === 0) continue;
        for (j = c; j < k; j++) G[i][j] -= f * G[c][j];
        r1[i] -= f * r1[c]; r2[i] -= f * r2[c];
      }
    }
    var x1 = new Array(k), x2 = new Array(k);
    for (i = k - 1; i >= 0; i--) {
      var s1 = r1[i], s2 = r2[i];
      for (j = i + 1; j < k; j++) { s1 -= G[i][j] * x1[j]; s2 -= G[i][j] * x2[j]; }
      x1[i] = s1 / G[i][i]; x2[i] = s2 / G[i][i];
    }
    return [x1, x2];
  }

  /* Least-squares fit on the given knots. P[j] has parameter u[j]; the spline
     interpolates the two end points and has the end derivatives dA, dB.
     Unknowns: the interior knot values. Returns { t, yx, yy, errs, err }. */
  function fitOnKnots(P, u, t, dA, dB) {
    var N = P.length, m = t.length - 1, k = m - 1, i, j, q;
    var zeros = new Array(m + 1).fill(0);
    var fx = zeros.slice(), fy = zeros.slice();
    fx[0] = P[0][0]; fy[0] = P[0][1]; fx[m] = P[N - 1][0]; fy[m] = P[N - 1][1];
    var baseX = evalSplineAt(t, fx, clampedM(t, fx, dA[0], dB[0]), u);   // the part fixed by the end data
    var baseY = evalSplineAt(t, fy, clampedM(t, fy, dA[1], dB[1]), u);
    var C = [];                                   // C[i][j]: cardinal spline of interior knot i+1 at u[j]
    for (i = 1; i <= k; i++) {
      var e = zeros.slice(); e[i] = 1;
      C.push(evalSplineAt(t, e, clampedM(t, e, 0, 0), u));
    }
    var yx = fx.slice(), yy = fy.slice();
    if (k > 0) {
      var G = [], rx = new Array(k).fill(0), ry = new Array(k).fill(0);
      for (i = 0; i < k; i++) {
        G.push(new Array(k).fill(0));
        for (q = 0; q < k; q++) {
          var s = 0;
          for (j = 0; j < N; j++) s += C[i][j] * C[q][j];
          G[i][q] = s;
        }
        G[i][i] += 1e-9;
        for (j = 0; j < N; j++) {
          rx[i] += C[i][j] * (P[j][0] - baseX[j]);
          ry[i] += C[i][j] * (P[j][1] - baseY[j]);
        }
      }
      var sol = solve2(G, rx, ry);
      for (i = 0; i < k; i++) { yx[i + 1] = sol[0][i]; yy[i + 1] = sol[1][i]; }
    }
    var errs = new Float64Array(N), err = 0;
    for (j = 0; j < N; j++) {
      var sx = baseX[j], sy = baseY[j];
      for (i = 0; i < k; i++) { sx += C[i][j] * yx[i + 1]; sy += C[i][j] * yy[i + 1]; }
      errs[j] = Math.hypot(sx - P[j][0], sy - P[j][1]);
      if (errs[j] > err) err = errs[j];
    }
    return { t: t, yx: yx, yy: yy, errs: errs, err: err };
  }

  /* B-form of the clamped spline with knots t and knot values (yx, yy). */
  function toBezier(t, yx, yy, dA, dB) {
    var Mx = clampedM(t, yx, dA[0], dB[0]), My = clampedM(t, yy, dA[1], dB[1]);
    var pieces = [], h = [];
    function ctrl(y, M, i, hi) {
      var slope = (y[i + 1] - y[i]) / hi;
      var s0 = slope - hi * (2 * M[i] + M[i + 1]) / 6;
      var s1 = slope + hi * (M[i] + 2 * M[i + 1]) / 6;
      return [y[i] + hi * s0 / 3, y[i + 1] - hi * s1 / 3];
    }
    for (var i = 0; i + 1 < t.length; i++) {
      var hi = t[i + 1] - t[i], cx = ctrl(yx, Mx, i, hi), cy = ctrl(yy, My, i, hi);
      pieces.push([[yx[i], yy[i]], [cx[0], cy[0]], [cx[1], cy[1]], [yx[i + 1], yy[i + 1]]]);
      h.push(hi);
    }
    return { pieces: pieces, h: h };
  }

  /* The clamped C2 cubic spline THROUGH the points Q (chord-length knots), leaving Q[0] in the
     unit direction dirA and arriving at the last point in the unit direction dirB (v51: redraw.js
     draws its converged polylines with it, so a second press starts where the first ended).
     Returns { pieces, h }. */
  function interpolate(Q, dirA, dirB) {
    var t = [0], i;
    for (i = 1; i < Q.length; i++) t.push(t[i - 1] + Math.max(1e-6, dist(Q[i], Q[i - 1])));
    return toBezier(t, Q.map(function (p) { return p[0]; }), Q.map(function (p) { return p[1]; }), dirA, dirB);
  }

  /* Fit a C2 cubic spline to the polyline P, leaving P[0] in the unit direction
     dirA and arriving at the last point in the unit direction dirB. The
     parameter is chord length, so the end derivatives are the unit directions.
     Starts from a single piece and refines LOCALLY: while the error exceeds
     tol, the worst piece that can still be halved gets one new knot.
     opts: { minPiece (shortest allowed piece, default 12), maxPieces (40) }.
     Returns { pieces, h, err }. */
  function fitClamped(P, dirA, dirB, tol, opts) {
    opts = opts || {};
    var minPiece = opts.minPiece || 12, maxPieces = opts.maxPieces || 40;
    var N = P.length, u = new Float64Array(N), j;
    for (j = 1; j < N; j++) u[j] = u[j - 1] + dist(P[j], P[j - 1]);
    var t = [0, u[N - 1]], fit;
    for (;;) {
      fit = fitOnKnots(P, u, t, dirA, dirB);
      if (fit.err <= tol || t.length - 1 >= maxPieces) break;
      var worst = -1, worstErr = tol, i = 0, pieceErr = new Array(t.length - 1).fill(0);
      for (j = 0; j < N; j++) {
        while (i < t.length - 2 && u[j] > t[i + 1]) i++;
        if (fit.errs[j] > pieceErr[i]) pieceErr[i] = fit.errs[j];
      }
      for (i = 0; i < pieceErr.length; i++) {
        if (pieceErr[i] > worstErr && t[i + 1] - t[i] >= 2 * minPiece) { worst = i; worstErr = pieceErr[i]; }
      }
      if (worst < 0) break;
      t = t.slice(0, worst + 1).concat([(t[worst] + t[worst + 1]) / 2], t.slice(worst + 1));
    }
    var curve = toBezier(fit.t, fit.yx, fit.yy, dirA, dirB);
    curve.err = fit.err;
    return curve;
  }

  /* ---------------- de Boor points (v36: moving curves) ----------------
     A clamped C² cubic spline of L pieces on knots with spacings h[0..L-1]
     (Δ_j = h[j]; Δ_{-1} = Δ_L = 0 at the clamped ends) has L + 3 de Boor
     points d_{-1} … d_{L+1}, stored here as arr[0 … L+2] (arr[j+1] = d_j).
     Piece j, over [u_j, u_{j+1}], has inner Bézier points
       b_{3j+1} = ((Δ_j + Δ_{j+1}) d_j + Δ_{j-1} d_{j+1}) / S_j,
       b_{3j+2} = (Δ_{j+1} d_j + (Δ_{j-1} + Δ_j) d_{j+1}) / S_j,  S_j = Δ_{j-1} + Δ_j + Δ_{j+1},
     and the junction b_{3j} = (Δ_j b_{3j-1} + Δ_{j-1} b_{3j+1}) / (Δ_{j-1} + Δ_j); the
     ends are b_0 = d_{-1}, b_1 = d_0, b_{3L-1} = d_L, b_{3L} = d_{L+1} (so the end
     points and end derivatives are four of the de Boor points). Moving d_j changes
     at most the pieces j-2 … j+1, and whatever the d are, the result is C² on these
     knots. geom-test.js checks the round trip and the C² joins. Points may have any
     dimension (arrays of numbers). */
  function lin(p, a, q, b) { var r = new Array(p.length); for (var i = 0; i < p.length; i++) r[i] = a * p[i] + b * q[i]; return r; }
  function deBoorOf(pieces, h) {
    var L = pieces.length, arr = new Array(L + 3);
    arr[0] = pieces[0][0].slice(); arr[1] = pieces[0][1].slice();
    arr[L + 1] = pieces[L - 1][2].slice(); arr[L + 2] = pieces[L - 1][3].slice();
    for (var j = 0; j + 1 < L; j++) {             // d_{j+1} from piece j's inner points
      var b1 = pieces[j][1], b2 = pieces[j][2], f = (h[j] + h[j + 1]) / h[j];
      arr[j + 2] = lin(b1, 1 - f, b2, f);
    }
    return arr;
  }
  function piecesFromDeBoor(arr, h) {
    var L = h.length, inner = [], out = [];
    function D(j) { return j < 0 || j >= L ? 0 : h[j]; }
    for (var j = 0; j < L; j++) {
      var S = D(j - 1) + D(j) + D(j + 1), dj = arr[j + 1], dk = arr[j + 2];
      inner.push([lin(dj, (D(j) + D(j + 1)) / S, dk, D(j - 1) / S), lin(dj, D(j + 1) / S, dk, (D(j - 1) + D(j)) / S)]);
    }
    for (j = 0; j < L; j++) {
      var b0 = j === 0 ? arr[0].slice() : out[j - 1][3];
      var b3 = j === L - 1 ? arr[L + 2].slice() : lin(inner[j][1], D(j + 1) / (D(j) + D(j + 1)), inner[j + 1][0], D(j) / (D(j) + D(j + 1)));
      out.push([b0, inner[j][0], inner[j][1], b3]);
    }
    return out;
  }

  var api = {
    deBoorOf: deBoorOf, piecesFromDeBoor: piecesFromDeBoor,
    dist: dist, polylineLength: polylineLength, resample: resample,
    distPointSeg: distPointSeg, segCross: segCross, pointInPolygon: pointInPolygon,
    pieceEval: pieceEval, splitPiece: splitPiece, polygonGap: polygonGap, refinedPolygon: refinedPolygon,
    curveLength: curveLength, splitCurveAtHalf: splitCurveAtHalf, fitClamped: fitClamped, interpolate: interpolate
  };
  root.SproutsGeom = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : this);
