/* =========================================================================
   ai.js — the game of Sprouts as the computer plays it: positions as pure
   combinatorics (no geometry), the legal moves, and the players.
   DOM-free (global SproutsAI, or require()). Needs nothing.

   POSITION (the paper's "set representation", Applegate–Jacobson–Sleator):
     { n, deg, regions: [ { boundaries: [ [spot, spot, …], … ] }, … ] }
   A boundary is the cyclic list of spot CORNERS met walking once round it
   with the region always on the same side — exactly the tails of the
   engine's half-edge cycle (engine.js), so a spot with d ≥ 1 curves has d
   corners in all (a spot on a bare path appears twice on one boundary; a
   spot on a cycle once on each side), an isolated spot is a boundary [s] of
   its own. Lives = 3 − deg; a region's lives are those of its DISTINCT spots.
   Which region is the unbounded one is not recorded: the game is the same
   on the sphere.

   MOVE: from corner i of boundary j to corner i2 of boundary j2 of region r,
   the new spot z = n.
   - TWO boundaries (j ≠ j2) are joined into one:
       [x, …round B_j…, x, z, y, …round B_j2…, y, z]
     (an isolated x contributes a single x: its one "corner" is not split).
     Nothing else changes; the route taken does not matter.
   - ONE boundary (j = j2): the region is split. With B_j read from x's
     corner, y at offset p (p = 0: a loop at one corner, needs 2 lives):
       B_a = [x, …, y, z]  (the walk from x to y, then z),
       B_b = [y, …, x, z]  (the rest of the way round, then z; p = 0: the
                            whole boundary and x again; isolated x: [x, z]).
     The region's OTHER boundaries go to either side: the move says which
     set S goes with B_a — every subset is a different move (2^k for k
     live others; boundaries without a life may go to either side without
     changing the game, and are put with B_b).
   The mirror image of the whole position is a different position here
   (boundaries are oriented); the game does not care, canonical forms will.
   ========================================================================= */
(function (root) {
  'use strict';

  /* The position of an engine analysis (engine.js analyse). Keeps, for each
     region and boundary, where it came from (`key`, `idx`), so that a move
     found here can be handed to the router by the engine's names. */
  function fromAnalysis(an, spots) {
    var pos = { n: spots.length, deg: spots.map(function (s) { return s.deg; }), regions: [] };
    an.regions.forEach(function (r) {
      var reg = { key: r.key, boundaries: [], idx: [] };
      r.boundaries.forEach(function (bd, k) {
        reg.boundaries.push(bd.cycle === undefined ? [bd.spot] : an.cycles[bd.cycle].halves.map(function (h) { return h.tail; }));
        reg.idx.push(k);
      });
      pos.regions.push(reg);
    });
    return pos;
  }

  function lives(pos, s) { return Math.max(0, 3 - pos.deg[s]); }
  function boundaryLives(pos, bd) {
    var seen = {}, t = 0;
    bd.forEach(function (s) { if (!seen[s]) { seen[s] = 1; t += lives(pos, s); } });
    return t;
  }
  function regionLives(pos, reg) {
    var seen = {}, t = 0;
    reg.boundaries.forEach(function (bd) { bd.forEach(function (s) { if (!seen[s]) { seen[s] = 1; t += lives(pos, s); } }); });
    return t;
  }
  function canMove(pos) { return pos.regions.some(function (reg) { return regionLives(pos, reg) >= 2; }); }

  /* The legal moves, as FAMILIES: one per (region, corner, corner), each
     standing for its 2^k choices of the boundaries enclosed (k = the live
     other boundaries of the region; `others` lists them). A family's
     `count` is 2^k; `expand(fam, S)` names one move of it. Listing every
     move outright is hopeless with many boundaries in one region (20
     isolated spots: 2^19 loops from each of them). */
  function families(pos) {
    var out = [];
    pos.regions.forEach(function (reg, r) {
      var live = [];                              // the boundaries with a life
      reg.boundaries.forEach(function (bd, j) { if (boundaryLives(pos, bd) > 0) live.push(j); });
      reg.boundaries.forEach(function (bd, j) {
        var others = live.filter(function (k) { return k !== j; });
        for (var i = 0; i < bd.length; i++) {
          var x = bd[i];
          if (lives(pos, x) === 0) continue;
          /* one boundary: the corners from i on (i2 = i needs two lives at x) */
          for (var i2 = i; i2 < bd.length; i2++) {
            var y = bd[i2];
            if (i2 === i ? lives(pos, x) < 2 : (y === x || lives(pos, y) === 0)) continue;
            out.push({ r: r, j: j, i: i, j2: j, i2: i2, x: x, y: y, others: others, count: Math.pow(2, others.length) });
          }
          /* two boundaries: every live corner of every later boundary */
          for (var j2 = j + 1; j2 < reg.boundaries.length; j2++) {
            var b2 = reg.boundaries[j2];
            for (var k = 0; k < b2.length; k++) {
              if (lives(pos, b2[k]) === 0) continue;
              out.push({ r: r, j: j, i: i, j2: j2, i2: k, x: x, y: b2[k], others: [], count: 1 });
            }
          }
        }
      });
    });
    return out;
  }

  /* One move of a family: S = the indices (into the region's boundaries) of
     the other boundaries that go with B_a (one-boundary moves; [] otherwise). */
  function expand(fam, S) {
    return { r: fam.r, j: fam.j, i: fam.i, j2: fam.j2, i2: fam.i2, x: fam.x, y: fam.y, S: S || [], two: fam.j !== fam.j2 };
  }

  /* All moves of every family — for tests and small positions only. */
  function allMoves(pos) {
    var out = [];
    families(pos).forEach(function (fam) {
      for (var m = 0; m < fam.count; m++) {
        var S = fam.others.filter(function (k, t) { return (m >> t) & 1; });
        out.push(expand(fam, S));
      }
    });
    return out;
  }

  function rotate(bd, i) { return bd.slice(i).concat(bd.slice(0, i)); }

  /* The position after the move. */
  function apply(pos, mv) {
    var z = pos.n, deg = pos.deg.slice();
    deg.push(2); deg[mv.x]++; deg[mv.y]++;
    var reg = pos.regions[mv.r], B = reg.boundaries, out = { n: z + 1, deg: deg, regions: [] };
    pos.regions.forEach(function (rg, r) { if (r !== mv.r) out.regions.push({ boundaries: rg.boundaries }); });
    if (mv.two) {
      var bx = pos.deg[mv.x] === 0 ? [mv.x] : rotate(B[mv.j], mv.i).concat([mv.x]);
      var by = pos.deg[mv.y] === 0 ? [mv.y] : rotate(B[mv.j2], mv.i2).concat([mv.y]);
      var merged = bx.concat([z], by, [z]);
      var rest = B.filter(function (bd, j) { return j !== mv.j && j !== mv.j2; });
      out.regions.push({ boundaries: rest.concat([merged]) });
    } else {
      var W = rotate(B[mv.j], mv.i), p = (mv.i2 - mv.i + W.length) % W.length;
      var Ba = W.slice(0, p + 1).concat([z]);
      var Bb = pos.deg[mv.x] === 0 ? [mv.x, z] : W.slice(p).concat([mv.x, z]);
      var inS = {}; mv.S.forEach(function (k) { inS[k] = 1; });
      var A = [Ba], Bs = [Bb];
      B.forEach(function (bd, j) { if (j !== mv.j) (inS[j] ? A : Bs).push(bd); });
      out.regions.push({ boundaries: A });
      out.regions.push({ boundaries: Bs });
    }
    return out;
  }

  /* An exact name of the position (spot numbers kept, so two descriptions of
     the same drawing agree): each boundary in its least rotation, boundaries
     sorted within a region, regions sorted. Not the paper's canonical form
     (that drops dead spots and renames) — the standing test between the
     combinatorial move and the drawn one wants exactness. */
  function boundaryKey(bd) {
    var best = null;
    for (var i = 0; i < bd.length; i++) {
      var s = rotate(bd, i).join(',');
      if (best === null || s.length < best.length || (s.length === best.length && s < best)) best = s;
    }
    return best;
  }
  function key(pos) {
    return pos.regions.map(function (reg) {
      return reg.boundaries.map(boundaryKey).sort().join(' | ');
    }).sort().join(' || ');
  }
  /* The same without the boundaries that have no life left: they belong to
     no move any more, and a one-boundary move may put them on either side
     without changing the game (apply puts them with B_b; the router puts
     them where the route happens to go). What the drawn position is compared
     with. */
  function gameKey(pos) {
    return pos.regions.map(function (reg) {
      return reg.boundaries.filter(function (bd) { return boundaryLives(pos, bd) > 0; }).map(boundaryKey).sort().join(' | ');
    }).filter(function (s) { return s; }).sort().join(' || ');
  }

  /* ---------------- the canonical form (the paper's, near enough) ----------------
     What the game still depends on: the regions with two or more lives, their
     boundaries without the dead spots, boundaries with no live spot dropped.
     A spot is written as its lives (1, 2, 3); a one-life spot can appear twice
     (on a bare path, or on a cycle between two regions) and gets a letter so
     that its two occurrences are known to be the same spot; two- and
     three-life spots appear once and need no name. Each boundary is read from
     the rotation that makes its lives-string least, boundaries are sorted
     within a region and regions sorted, letters given in order of first
     appearance; the mirror image (every boundary reversed) is done too and the
     lesser string is the form. Ties in the order (two boundaries with the same
     lives-string) can make the naming depend on the spot numbers, so equal
     positions may get different forms — a missed table hit, never a wrong one,
     since a form still describes exactly one position. */
  function reduce(pos) {
    var regs = [];
    pos.regions.forEach(function (reg) {
      if (regionLives(pos, reg) < 2) return;
      var bds = [];
      reg.boundaries.forEach(function (bd) { var b = bd.filter(function (t) { return lives(pos, t) > 0; }); if (b.length) bds.push(b); });
      regs.push(bds);
    });
    return regs;
  }
  function livesString(pos, bd) {                 // the least rotation of the boundary's lives, and where it starts
    var n = bd.length, best = null, at = 0, i, k;
    var lv = bd.map(function (t) { return lives(pos, t); });
    for (i = 0; i < n; i++) {
      var better = false, same = true;
      if (best === null) better = true;
      else for (k = 0; k < n; k++) { var a = lv[(i + k) % n], b = lv[(best + k) % n]; if (a !== b) { better = a < b; same = false; break; } }
      if (better) { best = i; }
    }
    var str = '';
    for (k = 0; k < n; k++) str += lv[(best + k) % n];
    return { str: str, at: best };
  }
  function canonicalOf(pos, regs) {
    var items = regs.map(function (bds) {
      var list = bds.map(function (bd) { var ls = livesString(pos, bd); return { bd: bd, str: ls.str, at: ls.at }; });
      list.sort(function (u, v) { return u.str < v.str ? -1 : u.str > v.str ? 1 : 0; });
      return { list: list, str: list.map(function (x) { return x.str; }).join('|') };
    });
    items.sort(function (u, v) { return u.str < v.str ? -1 : u.str > v.str ? 1 : 0; });
    var names = {}, next = 0, out = [];
    items.forEach(function (it) {
      out.push(it.list.map(function (x) {
        var n = x.bd.length, str = '';
        for (var k = 0; k < n; k++) {
          var t = x.bd[(x.at + k) % n], l = lives(pos, t);
          if (l === 1) { if (!(t in names)) names[t] = String.fromCharCode(97 + (next++ % 26)) + (next > 26 ? Math.floor((next - 1) / 26) : ''); str += names[t]; }
          else str += l;
        }
        return str;
      }).join('|'));
    });
    return out.join('/');
  }
  function canonical(pos) {
    var regs = reduce(pos), a = canonicalOf(pos, regs);
    var b = canonicalOf(pos, regs.map(function (bds) { return bds.map(function (bd) { return bd.slice().reverse(); }); }));
    return a < b ? a : b;
  }

  /* Moves in words, for the log: "3 → 5", "3 → 3 enclosing 4, 6-7". */
  function describe(pos, mv) {
    var s = (mv.x + 1) + ' → ' + (mv.y + 1);
    if (!mv.two) {
      var reg = pos.regions[mv.r], names = mv.S.map(function (k) {
        var seen = {}, out = [];
        reg.boundaries[k].forEach(function (t) { if (!seen[t]) { seen[t] = 1; out.push(t + 1); } });
        return out.join('-');
      });
      s += names.length ? ' enclosing ' + names.join(', ') : (reg.boundaries.length > 1 ? ' enclosing nothing' : '');
    }
    return s;
  }

  /* ---------------- players ---------------- */

  /* Random (Peter, 9/27): a family at random among all, then how many of the
     other boundaries go with B_a at random (0 … k, so small loops are as
     likely as big ones), then which ones. Null when no move exists. */
  function randomOf(fam, rnd) {
    rnd = rnd || Math.random;
    var pool = fam.others.slice(), m = Math.floor(rnd() * (pool.length + 1)), S = [];
    while (S.length < m) S.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
    return expand(fam, S.sort(function (a, b) { return a - b; }));
  }
  function randomMove(pos, rnd) {
    rnd = rnd || Math.random;
    var fams = families(pos);
    return fams.length ? randomOf(fams[Math.floor(rnd() * fams.length)], rnd) : null;
  }

  /* ---------------- what the searching players see ----------------

     Moves left = L − s: L the lives on the board (known), s the lives that
     survive to the end (what the game is about). A life is a SURE survivor
     when no region holding its spot has two lives — no move can ever use it,
     since regions only split and lose lives. Bounds on the moves left:
       M = min(L − max(sure survivors, 1), Σ over regions of (lives − 1)⁺)
           (the last move leaves a spot with a life, so at least one life
            survives — Peter, 9/27, v77; a region in play keeps at least one
            life; shared spots make the sum an over-count, still an upper
            bound),
       m = ⌈(3L − V + p) / 4⌉, V the spots now, p the dead spots all of whose
           neighbours are dead (v76; the count behind "a game lasts at least
           2n moves": at the end every spot is a survivor — one life, two
           dead neighbours of its own — or dead, so spots = V + k = s + 2s + p'
           with s = L − k survivors and p' ≥ p pharisees, whence
           k = (3L − V + p')/4; a survivor whose two edges go to one spot has
           one neighbour, which the count as written ignores — checked
           exhaustively instead: never above the true minimum on the 305,142
           positions reachable from 1–5 spots, 0.9 moves under it on average;
           exactly 2n at the start). "One move per region with two lives",
           the old m, was NOT a bound: a shared spot's life can go to a move in
           the other region.
     In NORMAL play the player to move wants the moves left ODD (the 1-spot
     game lasts 2 moves and its first player loses); in misère, even. */
  function bounds(pos) {
    var L = 0, sure = 0, sum = 0, regOf = [], nb = [], s;
    for (s = 0; s < pos.n; s++) { L += lives(pos, s); regOf.push([]); nb.push({}); }
    pos.regions.forEach(function (reg, r) {
      var rl = regionLives(pos, reg);
      if (rl >= 2) sum += rl - 1;
      reg.boundaries.forEach(function (bd) {
        for (var k = 0; k < bd.length; k++) {
          var t = bd[k], u = bd[(k + 1) % bd.length];
          if (regOf[t].indexOf(r) < 0) regOf[t].push(r);
          if (bd.length > 1) { nb[t][u] = 1; nb[u][t] = 1; }   // consecutive corners are joined by a curve
        }
      });
    });
    var p = 0;
    for (s = 0; s < pos.n; s++) {
      if (!lives(pos, s)) { if (Object.keys(nb[s]).every(function (j) { return lives(pos, Number(j)) === 0; })) p++; continue; }
      if (regOf[s].every(function (r) { return regionLives(pos, pos.regions[r]) < 2; })) sure += lives(pos, s);
    }
    var M = Math.min(L - Math.max(sure, L > 0 ? 1 : 0), sum), m = Math.max(0, Math.ceil((3 * L - pos.n + p) / 4));   // (v77, Peter: the last move leaves a life, so M ≤ L − 1)
    return { L: L, M: M, m: Math.min(m, M), p: p };
  }

  /* A random game to the end from pos: the number of moves made. */
  function playout(pos, rnd) {
    var k = 0, mv;
    while ((mv = randomMove(pos, rnd))) { pos = apply(pos, mv); k++; }
    return k;
  }

  /* Monte Carlo: for each candidate move, `trials` random games from the
     position after it; the score is the share the mover wins (the mover made
     the last move iff the number of moves after it is even — normal play;
     odd in misère). `report(i)` after each candidate, if given. */
  function monteCarlo(pos, cands, trials, misere, rnd, report) {
    rnd = rnd || Math.random;
    var wins = [], games = [];
    cands.forEach(function (mv, i) {
      var after = apply(pos, mv), w = 0;
      for (var t = 0; t < trials; t++) { var k = playout(after, rnd); if ((k % 2 === 0) !== !!misere) w++; }
      wins.push(w); games.push(trials);
      if (report) report(i);
    });
    return { wins: wins, games: games };
  }
  /* The same against the clock: rounds over all the candidates, one game
     each, until `deadline` (ms as Date.now()); every candidate gets the same
     number of games, at least one. */
  function monteCarloTimed(pos, cands, deadline, misere, rnd) {
    rnd = rnd || Math.random;
    var afters = cands.map(function (mv) { return apply(pos, mv); }), wins = cands.map(function () { return 0; }), games = 0;
    do {
      for (var i = 0; i < cands.length; i++) { var k = playout(afters[i], rnd); if ((k % 2 === 0) !== !!misere) wins[i]++; }
      games++;
    } while (Date.now() < deadline);
    return { wins: wins, games: cands.map(function () { return games; }) };
  }

  /* The value of a position for the player to move, at a leaf: no move → a
     loss in normal play (−2), a win in misère (+2); otherwise ±1/(1 + M − m):
     + when M has the parity the mover wants, and the nearer m is to M the
     surer it is. */
  function evaluate(pos, misere) {
    if (!canMove(pos)) return misere ? 2 : -2;
    var b = bounds(pos), want = misere ? 0 : 1;
    return (b.M % 2 === want ? 1 : -1) / (1 + b.M - b.m);
  }

  /* The children of a position for the search: every move of every family,
     except that a family with more than `cap` ways to choose the enclosed
     boundaries contributes `cap` random distinct ones (a stopgap until the
     canonical form tells interchangeable boundaries apart — see the notes). */
  function children(pos, cap, rnd) {
    var out = [], seen = {}, regCount = {};        // regCount[s]: how many regions spot s is on
    pos.regions.forEach(function (reg) { var here = {}; reg.boundaries.forEach(function (bd) { bd.forEach(function (t) { here[t] = 1; }); }); Object.keys(here).forEach(function (t) { regCount[t] = (regCount[t] || 0) + 1; }); });
    var push = function (mv) { var k = canonical(apply(pos, mv)); if (!seen[k]) { seen[k] = 1; out.push(mv); } };
    families(pos).forEach(function (fam) {
      if (!fam.others.length) { push(expand(fam, [])); return; }
      /* interchangeable other boundaries: the same lives-string and nothing
         beyond them (no spot on another region), e.g. all the isolated spots */
      var classes = {}, order = [], reg = pos.regions[fam.r];
      fam.others.forEach(function (k) {
        var bd = reg.boundaries[k], sig = bd.every(function (t) { return regCount[t] === 1; }) ? 'self:' + livesString(pos, bd).str : 'own:' + k;
        if (!classes[sig]) { classes[sig] = []; order.push(sig); }
        classes[sig].push(k);
      });
      var total = order.reduce(function (t, sig) { return t * (classes[sig].length + 1); }, 1);
      if (total <= cap) {
        var counts = order.map(function () { return 0; });
        for (;;) {
          var S = [];
          order.forEach(function (sig, c) { for (var u = 0; u < counts[c]; u++) S.push(classes[sig][u]); });
          push(expand(fam, S.sort(function (u, v) { return u - v; })));
          var c = 0;
          while (c < order.length) { if (++counts[c] <= classes[order[c]].length) break; counts[c] = 0; c++; }
          if (c === order.length) break;
        }
      } else {                                    // still too many: `cap` random ones (a stopgap)
        var got = {}, tries = 0;
        while (Object.keys(got).length < cap && tries++ < 4 * cap) { var mv = randomOf(fam, rnd), kk = mv.S.join(','); if (!got[kk]) { got[kk] = 1; push(mv); } }
      }
    });
    return out;
  }

  /* Alpha-beta (negamax) to `depth` plies, on `evaluate` at the leaves, with
     a TRANSPOSITION TABLE keyed by the canonical form (ctx.tt, a Map that may
     outlive the search: {d: plies searched, v, f: 0 exact, 1 a lower bound,
     −1 an upper bound}) and a DEADLINE (ctx.deadline, ms as Date.now(); the
     clock is read every 256 nodes; once past, ctx.aborted is set and the
     values coming back mean nothing). */
  function newContext(deadline) { return { tt: new Map(), deadline: deadline || Infinity, nodes: 0, aborted: false, hits: 0 }; }
  function negamax(pos, depth, alpha, beta, misere, cap, rnd, ctx) {
    if (depth <= 0 || !canMove(pos)) return evaluate(pos, misere);
    if ((++ctx.nodes & 255) === 0 && Date.now() > ctx.deadline) ctx.aborted = true;
    if (ctx.aborted) return 0;
    var key = (misere ? 'm' : 'n') + canonical(pos), e = ctx.tt.get(key), alpha0 = alpha;
    if (e && e.d >= depth) {
      ctx.hits++;
      if (e.f === 0) return e.v;
      if (e.f === 1 && e.v > alpha) alpha = e.v;
      if (e.f === -1 && e.v < beta) beta = e.v;
      if (alpha >= beta) return e.v;
    }
    var kids = children(pos, cap, rnd), best = -Infinity;
    for (var i = 0; i < kids.length; i++) {
      var v = -negamax(apply(pos, kids[i]), depth - 1, -beta, -alpha, misere, cap, rnd, ctx);
      if (ctx.aborted) return 0;
      if (v > best) best = v;
      if (v > alpha) alpha = v;
      if (alpha >= beta) break;
    }
    ctx.tt.set(key, { d: depth, v: best, f: best <= alpha0 ? -1 : best >= beta ? 1 : 0 });
    return best;
  }

  /* Parity search: each candidate's value for the mover, searching `depth`
     plies (the candidate itself is the first). Null when the deadline cut
     it short. */
  function paritySearch(pos, cands, depth, misere, cap, rnd, report, ctx) {
    rnd = rnd || Math.random; ctx = ctx || newContext();
    var out = [];
    for (var i = 0; i < cands.length; i++) {
      var v = -negamax(apply(pos, cands[i]), depth - 1, -Infinity, Infinity, misere, cap, rnd, ctx);
      if (ctx.aborted) return null;
      out.push(v);
      if (report) report(i);
    }
    return out;
  }

  var api = { bounds: bounds, playout: playout, monteCarlo: monteCarlo, monteCarloTimed: monteCarloTimed, evaluate: evaluate, children: children,
              negamax: negamax, paritySearch: paritySearch, newContext: newContext, canonical: canonical, reduce: reduce,
              fromAnalysis: fromAnalysis, families: families, expand: expand, allMoves: allMoves, apply: apply, key: key, gameKey: gameKey,
              canMove: canMove, regionLives: regionLives, lives: lives, describe: describe, randomOf: randomOf, randomMove: randomMove };
  root.SproutsAI = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : this);
