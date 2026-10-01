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
  function livesString(pos, bd) {                 // the least rotation of the boundary's lives, and every rotation that gives it
    var n = bd.length, best = null, i, k, str = '';
    var lv = bd.map(function (t) { return lives(pos, t); });
    for (i = 0; i < n; i++) {
      var better = false;
      if (best === null) better = true;
      else for (k = 0; k < n; k++) { var a = lv[(i + k) % n], b = lv[(best + k) % n]; if (a !== b) { better = a < b; break; } }
      if (better) best = i;
    }
    for (k = 0; k < n; k++) str += lv[(best + k) % n];
    var ats = [];
    for (i = 0; i < n; i++) { for (k = 0; k < n && lv[(i + k) % n] === lv[(best + k) % n]; k++) { /* on */ } if (k === n) ats.push(i); }
    return { str: str, ats: ats };
  }
  /* The form of `regs` (the reduced regions, each a list of boundaries) —
     the least string over every way of writing the position (v84, a TRUE
     canonical form: the old one let the order of tied boundaries and
     regions, and the rotation among tied ones, follow the spot numbers, so
     equal positions got different strings — one part in three, measured).
     Boundaries are ordered by their lives-strings and regions by the joined
     strings of theirs; only TIES are left to choose, and only where letters
     are involved (boundaries without a one-life spot are interchangeable
     when tied). A boundary whose one-life spots all lie on it alone
     ("local": a bare path) is interchangeable with a tied one of its kind,
     and its rotation is chosen on its own (the least pattern); a boundary
     with a SHARED spot (a cycle's spot, on a boundary of another region too)
     is branched over — its order among the tied and its rotation — and so
     are tied regions holding shared spots. Branch and bound on the string
     being built; ties among the rest are settled by the letters' first
     appearance. */
  function canonicalOf(pos, regs) {
    var seenIn = {}, all = [];                    // one-life spot → the boundaries (info records) it lies on
    var R = regs.map(function (bds) {
      var list = bds.map(function (bd) {
        var ls = livesString(pos, bd), b = { bd: bd, str: ls.str, ats: ls.ats, letters: false, shared: false, sig: ls.str }, here = {};
        bd.forEach(function (t) { if (lives(pos, t) === 1) { b.letters = true; if (!here[t]) { here[t] = 1; (seenIn[t] = seenIn[t] || []).push(b); } } });
        all.push(b);
        return b;
      });
      return { list: list, shared: false };
    });
    /* refined signatures (one round): a boundary's, its lives-string plus the
       lives-strings of the boundaries its shared spots also lie on; a region's,
       its boundaries' sorted signatures. Tied items are then rarely more than
       interchangeable ones. */
    R.forEach(function (reg) { reg.str = reg.list.map(function (x) { return x.str; }).sort().join('|'); reg.list.forEach(function (b) { b.reg = reg; }); });
    all.forEach(function (b) {
      var links = [];
      b.bd.forEach(function (t) { if (lives(pos, t) === 1 && seenIn[t].length > 1) { b.shared = true; seenIn[t].forEach(function (o) { if (o !== b) links.push(o.str + '@' + o.reg.str); }); } });
      if (links.length) b.sig = b.str + '#' + links.sort().join(',');
    });
    var bySig = function (u, v) { return u.sig < v.sig ? -1 : u.sig > v.sig ? 1 : 0; };
    R.forEach(function (reg) {
      reg.list.sort(bySig);
      reg.sig = reg.list.map(function (x) { return x.sig; }).join('|');
      reg.shared = reg.list.some(function (x) { return x.shared; });
    });
    R.sort(bySig);
    var best = null, names = [], named = [];      // names[spot] = its letter; named: the spots named so far, in order (undone on backtracking)
    var work = 0, greedy = false, STOP = {};      // (the branch and bound's steps, and the way out when they are too many — see below)
    function step() { if (!greedy && ++work > CANON_WORK) throw STOP; }
    function letter(k) { return String.fromCharCode(97 + (k % 26)) + (k >= 26 ? Math.floor(k / 26) : ''); }
    /* the string of boundary b from rotation `at`, naming new letters as they appear */
    function emit(b, at) {
      var n = b.bd.length, out = '';
      for (var k = 0; k < n; k++) {
        var t = b.bd[(at + k) % n], l = lives(pos, t);
        if (l === 1) { if (names[t] === undefined) { names[t] = letter(named.length); named.push(t); } out += names[t]; }
        else out += l;
      }
      return out;
    }
    function unname(to) { while (named.length > to) names[named.pop()] = undefined; }
    /* a local boundary: its least pattern over its rotations (the pattern does not depend on the letters' names) */
    function emitLocal(b) {
      var bestAt = b.ats[0];
      if (b.ats.length > 1) {
        var bestPat = null, mark = named.length;
        b.ats.forEach(function (at) { var pat = emit(b, at); unname(mark); if (bestPat === null || pat < bestPat) { bestPat = pat; bestAt = at; } });
      }
      return emit(b, bestAt);
    }
    /* may a string that starts with `prefix` still be the least? */
    function hopeless(prefix) { return best !== null && !(best.length >= prefix.length && best.lastIndexOf(prefix, 0) === 0) && prefix > best; }
    /* the regions: the tie group of the first remaining one; a group with shared spots is branched over, else taken in order */
    function regions(done, prefix) {
      if (done.length === R.length) { if (best === null || prefix < best) best = prefix; return; }
      if (hopeless(prefix)) return;
      step();
      var f = 0;
      while (done.indexOf(f) >= 0) f++;
      var group = [];
      for (var j = f; j < R.length; j++) if (R[j].sig === R[f].sig && done.indexOf(j) < 0) group.push(j);
      var sep = done.length ? '/' : '';
      if (!group.some(function (j) { return R[j].shared; })) {
        var mark = named.length, out = prefix;
        group.forEach(function (j, u) { out = boundaries(R[j].list, [], out + (u ? '/' : sep)); });   // (no branching inside: boundaries returns the string)
        regions(done.concat(group), out);
        unname(mark);
        return;
      }
      (greedy ? group.slice(0, 1) : group).forEach(function (j) {
        var mark = named.length;
        boundariesB(R[j].list, [], prefix + sep, function (p2) { regions(done.concat([j]), p2); });
        unname(mark);
      });
    }
    /* the boundaries of a region with no shared spots: deterministic, returns the string */
    function boundaries(list, done, prefix) {
      var out = prefix;
      for (var i = 0; i < list.length; i++) {
        if (i) out += '|';
        out += list[i].letters ? emitLocal(list[i]) : list[i].str;
      }
      return out;
    }
    /* the boundaries of a region with shared spots: the tie groups; a group with shared spots is branched over (member and rotation) */
    function boundariesB(list, done, prefix, then) {
      if (done.length === list.length) { then(prefix); return; }
      if (hopeless(prefix)) return;
      step();
      var sep = done.length ? '|' : '', f = 0;
      while (done.indexOf(f) >= 0) f++;
      var group = [];
      for (var j = f; j < list.length; j++) if (list[j].sig === list[f].sig && done.indexOf(j) < 0) group.push(j);
      if (!group.some(function (j) { return list[j].shared; })) {   // no shared spots in the group: any order; local letters rotated on their own
        var mark = named.length, out = prefix;
        group.forEach(function (j, u) { out += (u ? '|' : sep) + (list[j].letters ? emitLocal(list[j]) : list[j].str); });
        boundariesB(list, done.concat(group), out, then);
        unname(mark);
        return;
      }
      if (greedy) {                               // the least next string alone, no branching (see below)
        var pick = null;
        group.forEach(function (j) {
          var b = list[j];
          (b.shared ? b.ats : [null]).forEach(function (at) {
            var mark = named.length, str = at === null ? emitLocal(b) : emit(b, at);
            unname(mark);
            if (pick === null || str < pick.str) pick = { j: j, at: at, str: str };
          });
        });
        var m2 = named.length, b2 = list[pick.j], s2 = pick.at === null ? emitLocal(b2) : emit(b2, pick.at);
        boundariesB(list, done.concat([pick.j]), prefix + sep + s2, then);
        unname(m2);
        return;
      }
      group.forEach(function (j) {
        var b = list[j], ats = b.shared ? b.ats : [null];
        ats.forEach(function (at) {
          var mark = named.length, str = at === null ? emitLocal(b) : emit(b, at);
          boundariesB(list, done.concat([j]), prefix + sep + str, then);
          unname(mark);
        });
      });
    }
    /* A BUDGET (v122): when the branch and bound takes more than CANON_WORK steps, the form is
       finished GREEDILY — at every tie the least next string, no branching — and the least of that
       and whatever complete string was found is the form. Still a way of writing this position and
       no other (never a wrong table hit); equal positions may then get different forms (a missed
       hit, a duplicate candidate). Not reached on 20 random 30-spot games once positions are
       written part by part (canonical); it is the guard against a part that is itself a large
       tangle of tied regions. */
    try { regions([], ''); }
    catch (e) {
      if (e !== STOP) throw e;
      greedy = true; unname(0); canonFallbacks++;
      regions([], '');
    }
    return best === null ? '' : best;
  }
  /* The form of a position: its PARTS' forms (see parts: regions joined by a shared live spot),
     sorted and joined by '+' — each part written on its own, letters from 'a' in each (no spot lies
     in two parts), its mirror image taken on its own (a sum of games does not care how each part is
     turned). v122: written as one, the branch and bound over the tied regions of many small parts
     (all "11", "111"…) took seconds on some 30-spot positions — on Peter's game of 10/1 the page
     froze for minutes while the computer's candidates were sorted out. A position of one part is
     written as before, so a part's form is the same alone or in a sum. */
  var CANON_WORK = (typeof process !== 'undefined' && process.env && Number(process.env.CANON_WORK)) || 20000, canonFallbacks = 0;     // (see canonicalOf; canonFallbacks counts the greedy ones, for tests)
  function canonical(pos) {
    var ps = parts(pos);
    if (ps.length <= 1) return canonicalPart(pos);
    return ps.map(canonicalPart).sort().join('+');
  }
  function canonicalPart(pos) {
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
    var out = [], regCount = {};                   // regCount[s]: how many regions spot s is on
    pos.regions.forEach(function (reg) { var here = {}; reg.boundaries.forEach(function (bd) { bd.forEach(function (t) { here[t] = 1; }); }); Object.keys(here).forEach(function (t) { regCount[t] = (regCount[t] || 0) + 1; }); });
    var push = function (mv) { out.push(mv); };   // (v84: no dedup by canonical form here — the table catches equal children at their own node, and alpha-beta never visits many of them; before, every child was canonicalized up front)
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

  /* ---------------- exact play by parts (nimbers, v83) ----------------
     A position is the SUM of independent games — its PARTS — when its
     regions fall into collections that share no live spot (the paper, 3.3:
     the connected components of the region graph, regions joined by a spot
     of degree two lying on both). A move in one part changes nothing in the
     others, and the player chooses the part to move in. Under NORMAL play the
     Sprague–Grundy theorem then applies: every part has a NIMBER (the least
     non-negative integer that is not the nimber of any successor — the mex
     rule; a part with no move has 0), the nimber of the sum is the XOR of the
     parts' nimbers, and the player to move LOSES exactly when the XOR is 0.
     So a position is solved exactly as soon as each of its parts is small
     enough to solve on its own — the cost is the sum of the parts' trees,
     where the whole-position search pays their product (every interleaving
     of the parts' moves) — and a part with nimber 0 can be dropped from a
     position without changing its value (val(L ⊕ V) = val(V)). Nimbers are
     memoized on the canonical form (ctx.nim, a Map that outlives a search).
     None of this holds for misère (the paper, 3.3); misère has its own
     theory by parts below (v86). Regions with under two lives have no move and are no part. */
  function parts(pos) {
    var live = [], regOf = {}, r;
    pos.regions.forEach(function (reg, i) { if (regionLives(pos, reg) >= 2) live.push(i); });
    live.forEach(function (i) {                   // the live spots on each region; a spot on two live regions joins them
      pos.regions[i].boundaries.forEach(function (bd) { bd.forEach(function (t) { if (lives(pos, t) > 0) { if (!regOf[t]) regOf[t] = []; if (regOf[t].indexOf(i) < 0) regOf[t].push(i); } }); });
    });
    var comp = {}, out = [];
    live.forEach(function (i) {
      if (comp[i] !== undefined) return;
      var stack = [i], members = [];
      comp[i] = out.length;
      while (stack.length) {
        r = stack.pop(); members.push(r);
        pos.regions[r].boundaries.forEach(function (bd) { bd.forEach(function (t) {
          (regOf[t] || []).forEach(function (j) { if (comp[j] === undefined) { comp[j] = out.length; stack.push(j); } });
        }); });
      }
      out.push({ n: pos.n, deg: pos.deg, regions: members.sort(function (a, b) { return a - b; }).map(function (j) { return pos.regions[j]; }) });
    });
    return out;
  }
  /* The nimber of a position (the XOR of its parts'); −1 when the deadline
     cut the computation short (ctx.aborted). Every successor is needed (no
     pruning); equal successors meet in the memo. */
  function nimber(pos, ctx) {
    var x = 0, ps = parts(pos);
    for (var i = 0; i < ps.length; i++) {
      var p = ps[i], key = canonical(p), g = ctx.nim.get(key);
      if (g === undefined) {
        ctx.nodes++; late(ctx);
        if (ctx.aborted) return -1;
        var seen = {}, kids = children(p, Infinity);
        for (var k = 0; k < kids.length; k++) {
          var v = nimber(apply(p, kids[k]), ctx);
          if (ctx.aborted) return -1;
          seen[v] = 1;
        }
        g = 0; while (seen[g]) g++;
        ctx.nim.set(key, g);
      }
      x ^= g;
    }
    return x;
  }
  /* What the search knows of a position at `depth` plies from its horizon.
     When the position is a SUM (two or more parts), each part whose bound M
     (at most that many moves are left in it) is within the depth — the
     search would look to its end anyway — is solved for its nimber
     (memoized). A position that is one part is searched as before: the mex
     rule prunes nothing, alpha-beta does, and the theory adds nothing to an
     undivided game (a fixed depth ≥ M at the start would otherwise solve the
     whole game by nimbers — minutes for 5 spots, where the search takes
     seconds). All parts solved → { exact: true, value: ±2 } for the player
     to move (the XOR of the nimbers and of `heap`, see below, 0 = lost).
     Else { exact: false, pos, heap }: the solved parts are TAKEN OUT of the
     position and replaced by a NIM HEAP — the XOR of their nimbers with the
     heap that came in (the paper's section 5: a solved part with a nimber
     above 0 need not be searched on, a heap of that size is the same game;
     a lost part, nimber 0, vanishes: val(L ⊕ V) = val(V)). The search goes
     on with the unsolved parts and the heap (v84; v83 dropped only the lost
     parts). */
  function solveParts(pos, depth, ctx, canon, heap) {   // canon: canonical(pos) if already known — it is the one part's, when there is one
    var ps = parts(pos), x = heap || 0, all = true, keep = [];
    for (var i = 0; i < ps.length; i++) {
      var p = ps[i], key = ps.length === 1 && canon ? canon : canonical(p), g = ctx.nim.get(key);
      if (g === undefined && ps.length >= 2 && bounds(p).M <= depth) { g = nimber(p, ctx); if (ctx.aborted) return { exact: false, pos: pos, heap: x }; ctx.solved++; }
      if (g === undefined) { all = false; keep.push(p); }
      else x ^= g;
    }
    if (all) return { exact: true, value: x ? 2 : -2 };
    if (keep.length === ps.length) return { exact: false, pos: pos, heap: x };
    var regions = [];
    keep.forEach(function (p) { regions = regions.concat(p.regions); });
    return { exact: false, pos: { n: pos.n, deg: pos.deg, regions: regions }, heap: x };
  }

  /* ---------------- misère play by parts (v86) ----------------
     Under misère play a part has no nimber: whether a part is won or lost
     on its own does not say how it behaves beside another. What does is its
     MISÈRE CANONICAL TREE (Conway, On Numbers and Games ch. 12; Lemoine &
     Viennot's "reduced canonical trees" for misère Sprouts): its game tree
     with equal options merged and REVERSIBLE options removed, which is the
     same tree for two games exactly when they are indistinguishable — the
     same outcome beside any third game. Two parts with the same tree can
     stand in for each other in any sum, so a solved part is replaced by its
     tree (a number, the tree's id in a store), and a position all of whose
     parts are solved is decided by the outcome of the sum of the trees.
     The rules used (checked by brute force on all games born by day 4 —
     Conway's count, 22 — and on sums of them):
     - equal (Conway): G = H iff both have the same misère outcome, every
       option of G equals an option of H or has an option equal to H, and
       every option of H equals an option of G or has an option equal to G;
     - simplify: an option x of G = S may be removed when x has an option
       equal to S − {x} — unless S − {x} is empty and G is a misère loss for
       the player to move (the empty game is a win in misère);
     - nim heaps are canonical, and *m + *n = *(m XOR n) when m or n is 0
       or 1 (so * + * = 0); a sum of heaps only is decided by the misère nim
       rule (mover wins iff XOR ≠ 0, except when every heap is 0 or 1:
       then iff the XOR is 0).
     Tree ids: 0 is the empty game. out[id]: true when the player to move in
     it WINS (misère). The store lives in the search context (ctx.T) with the
     trees of the parts (ctx.mis, keyed by canonical form); the transposition
     table's keys carry tree ids, so the three are cleared together. */
  function newStore() { return { opts: [[]], out: [true], heap: [0], heaps: [0], key: new Map([['', 0]]), sum: new Map(), ol: new Map() }; }
  function outSet(T, S) { if (!S.length) return true; for (var i = 0; i < S.length; i++) if (!T.out[S[i]]) return true; return false; }
  /* is tree y equal to the game whose options are the trees R (Conway's test)? */
  function treeEquals(T, y, R) {
    if (T.out[y] !== outSet(T, R)) return false;
    var oy = T.opts[y], i, j, k;
    for (i = 0; i < R.length; i++) if (oy.indexOf(R[i]) < 0 && T.opts[R[i]].indexOf(y) < 0) return false;
    for (j = 0; j < oy.length; j++) {
      if (R.indexOf(oy[j]) >= 0) continue;
      var o2 = T.opts[oy[j]], ok = false;
      for (k = 0; k < o2.length && !ok; k++) if (treeEquals(T, o2[k], R)) ok = true;
      if (!ok) return false;
    }
    return true;
  }
  /* the tree of the game whose options are the trees S */
  function mkTree(T, S) {
    S = S.filter(function (x, i) { return S.indexOf(x) === i; }).sort(function (a, b) { return a - b; });
    var key = S.join(','), id = T.key.get(key), outS, i, k;
    if (id !== undefined) return id;
    outS = outSet(T, S);
    for (i = 0; i < S.length; i++) {             // a reversible option: the game is the game without it
      var R = S.slice(0, i).concat(S.slice(i + 1)), ox = T.opts[S[i]];
      if (!R.length && !outS) continue;
      for (k = 0; k < ox.length; k++) if (treeEquals(T, ox[k], R)) { id = mkTree(T, R); T.key.set(key, id); return id; }
    }
    id = T.opts.length; T.opts.push(S); T.out.push(outS);
    var h = S.length;
    for (i = 0; i < S.length; i++) if (T.heap[S[i]] !== i) { h = -1; break; }
    T.heap.push(h); if (h >= 0) T.heaps[h] = id;
    T.key.set(key, id);
    return id;
  }
  function heapTree(T, n) { while (T.heaps.length <= n) mkTree(T, T.heaps.slice()); return T.heaps[n]; }
  /* the tree of the sum of two trees (memoized) */
  function treeSum(T, a, b) {
    if (a === 0) return b;
    if (b === 0) return a;
    var ha = T.heap[a], hb = T.heap[b];
    if (ha >= 0 && hb >= 0 && (ha <= 1 || hb <= 1)) return heapTree(T, ha ^ hb);
    if (a > b) { var t = a; a = b; b = t; }
    var key = a + '+' + b, id = T.sum.get(key), S = [];
    if (id !== undefined) return id;
    T.opts[a].forEach(function (x) { S.push(treeSum(T, x, b)); });
    T.opts[b].forEach(function (x) { S.push(treeSum(T, a, x)); });
    id = mkTree(T, S); T.sum.set(key, id);
    return id;
  }
  /* A list of trees standing for their sum, in a normal form: empty games
     dropped, the 0/1 heaps folded into one heap (a * joins a larger heap if
     there is one), sorted. Larger trees are NOT summed into one: the sum's
     tree can be far bigger than the pair (Lemoine–Viennot kept lists too). */
  function normList(T, L) {
    var out = [], one = 0, big = -1, i;
    for (i = 0; i < L.length; i++) {
      var h = T.heap[L[i]];
      if (L[i] === 0) continue;
      if (h === 1) { one ^= 1; continue; }
      if (h >= 2 && big < 0) { big = out.length; }
      out.push(L[i]);
    }
    if (one) { if (big >= 0) out[big] = heapTree(T, T.heap[out[big]] ^ 1); else out.push(heapTree(T, 1)); }
    return out.sort(function (a, b) { return a - b; });
  }
  /* The misère outcome of the sum of a normal list: true = the player to move wins. */
  function listWins(T, L) {
    var x = 0, big = false, heaps = true, i;
    for (i = 0; i < L.length; i++) { var h = T.heap[L[i]]; if (h < 0) { heaps = false; break; } x ^= h; if (h >= 2) big = true; }
    if (heaps) return big ? x !== 0 : x === 0;
    var key = L.join('.'), w = T.ol.get(key);
    if (w !== undefined) return w;
    w = false;
    for (i = 0; i < L.length && !w; i++) {
      var o = T.opts[L[i]];
      for (var k = 0; k < o.length && !w; k++) { var L2 = L.slice(); L2[i] = o[k]; if (!listWins(T, normList(T, L2))) w = true; }
    }
    T.ol.set(key, w);
    return w;
  }
  /* The misère tree of a position (the sum of its parts' trees); −1 when the
     deadline cut it short. Parts are memoized on the canonical form. */
  function misTree(pos, ctx, canon) {
    var T = ctx.T, ps = parts(pos), t, u, i;
    if (ps.length !== 1) {
      t = 0;
      for (i = 0; i < ps.length; i++) { u = misTree(ps[i], ctx); if (u < 0) return -1; t = treeSum(T, t, u); }
      return t;
    }
    var key = canon || canonical(pos);
    t = ctx.mis.get(key);
    if (t !== undefined) return t;
    ctx.nodes++; late(ctx);
    if (ctx.aborted) return -1;
    var kids = children(pos, Infinity), ids = [];
    for (i = 0; i < kids.length; i++) { u = misTree(apply(pos, kids[i]), ctx); if (u < 0) return -1; ids.push(u); }
    t = mkTree(T, ids);
    ctx.mis.set(key, t);
    return t;
  }
  /* solveParts for misère: the same rule for which parts to solve (a sum,
     M within the depth); a solved part joins `list` as its tree. All solved →
     exact, from the outcome of the list. */
  function solvePartsMisere(pos, depth, ctx, canon, list) {
    var ps = parts(pos), L = (list || []).slice(), keep = [];
    for (var i = 0; i < ps.length; i++) {
      var p = ps[i], key = ps.length === 1 && canon ? canon : canonical(p), t = ctx.mis.get(key);
      if (t === undefined && ps.length >= 2 && bounds(p).M <= depth) { t = misTree(p, ctx, key); if (ctx.aborted) return { exact: false, pos: pos, list: list || [] }; ctx.solved++; }
      if (t === undefined) keep.push(p); else L.push(t);
    }
    L = normList(ctx.T, L);
    if (!keep.length) return { exact: true, value: listWins(ctx.T, L) ? 2 : -2 };
    if (keep.length === ps.length) return { exact: false, pos: pos, list: L };
    var regions = [];
    keep.forEach(function (p) { regions = regions.concat(p.regions); });
    return { exact: false, pos: { n: pos.n, deg: pos.deg, regions: regions }, list: L };
  }

  /* Alpha-beta (negamax) to `depth` plies, on `evaluate` at the leaves, with
     a TRANSPOSITION TABLE keyed by the canonical form (ctx.tt, a Map that may
     outlive the search: {d: plies searched, v, f: 0 exact, 1 a lower bound,
     −1 an upper bound}) and a DEADLINE (ctx.deadline, ms as Date.now(); the
     clock is read at every position, leaves included; once past, ctx.aborted is set and the
     values coming back mean nothing). v123: it was read every 256 nodes, and leaves were not
     counted — in a large position a worker could finish a whole depth (depth 1 always, depth 2
     with ~128 candidates) without once looking: Peter's 5 s budget ran to 20–46 s. A clock read
     costs nanoseconds against a position's microseconds to milliseconds. */
  function late(ctx) { if (!ctx.aborted && Date.now() > ctx.deadline) ctx.aborted = true; return ctx.aborted; }
  function newContext(deadline) { return { tt: new Map(), nim: new Map(), mis: new Map(), T: newStore(), deadline: deadline || Infinity, nodes: 0, aborted: false, hits: 0, solved: 0 }; }
  /* A value of ±2 is EXACT (no move, or solved by parts) and holds at any depth: stored as such. */
  /* `heap`: what stands beside the position for the solved parts — in normal
     play a nim heap (solveParts; a move may take it down to any smaller
     size), in misère a normal list of trees (solvePartsMisere, v86; a move
     may replace one tree by one of its options). */
  function negamax(pos, depth, alpha, beta, misere, cap, rnd, ctx, heap) {
    heap = heap || (misere ? [] : 0);
    if (late(ctx)) return 0;
    var T = ctx.T;
    /* no move in the position: only the solved parts' moves are left — exact */
    var over = function () { return misere ? (listWins(T, heap) ? 2 : -2) : heap ? 2 : -2; };
    if (!canMove(pos)) return over();
    var canon = canonical(pos);
    if (!ctx.noParts) {                            // exact by parts where the search can afford it (v83, misère v86; ctx.noParts: without, for comparisons)
      var sp = misere ? solvePartsMisere(pos, depth, ctx, canon, heap) : solveParts(pos, depth, ctx, canon, heap);
      if (ctx.aborted) return 0;
      if (sp.exact) return sp.value;
      if (sp.pos !== pos) { pos = sp.pos; canon = canonical(pos); }
      heap = misere ? sp.list : sp.heap;
      if (!canMove(pos)) return over();
    }
    if (depth <= 0) return evaluate(pos, misere);   // (the heap is not in the heuristic: a leaf with solved parts beside an unsolved part is judged by the part)
    ctx.nodes++; late(ctx);
    if (ctx.aborted) return 0;
    var extra = misere ? (heap.length ? '+' + heap.join('.') : '') : (heap ? '+' + heap : '');
    var key = (misere ? 'm' : 'n') + canon + extra, e = ctx.tt.get(key), alpha0 = alpha;
    if (e && e.d >= depth) {
      ctx.hits++;
      if (e.f === 0) return e.v;
      if (e.f === 1 && e.v > alpha) alpha = e.v;
      if (e.f === -1 && e.v < beta) beta = e.v;
      if (alpha >= beta) return e.v;
    }
    var kids = children(pos, cap, rnd), best = -Infinity, v, i;
    for (i = 0; i < kids.length; i++) {
      v = -negamax(apply(pos, kids[i]), depth - 1, -beta, -alpha, misere, cap, rnd, ctx, heap);
      if (ctx.aborted) return 0;
      if (v > best) best = v;
      if (v > alpha) alpha = v;
      if (alpha >= beta) break;
    }
    var others = [];                               // the moves beside the position: in the heap, to any smaller size; in a tree of the list, to one of its options
    if (misere) {
      var seen = {};
      heap.forEach(function (t, j) { T.opts[t].forEach(function (o) { var L = heap.slice(); L[j] = o; L = normList(T, L); var k = L.join('.'); if (!seen[k]) { seen[k] = 1; others.push(L); } }); });
    } else for (var h = 0; h < heap; h++) others.push(h);
    for (i = 0; i < others.length && alpha < beta; i++) {
      v = -negamax(pos, depth - 1, -beta, -alpha, misere, cap, rnd, ctx, others[i]);
      if (ctx.aborted) return 0;
      if (v > best) best = v;
      if (v > alpha) alpha = v;
    }
    ctx.tt.set(key, { d: Math.abs(best) === 2 && best > alpha0 && best < beta ? Infinity : depth, v: best, f: best <= alpha0 ? -1 : best >= beta ? 1 : 0 });
    return best;
  }

  /* Parity search: each candidate's value for the mover, searching `depth`
     plies (the candidate itself is the first). Null when the deadline cut
     it short. A value of ±2 is exact (v83: solved by parts, or the end of
     the game); when every candidate's is, the position is solved. */
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

  var api = { canonFallbacks: function () { return canonFallbacks; }, bounds: bounds, parts: parts, nimber: nimber, solveParts: solveParts, misTree: misTree, solvePartsMisere: solvePartsMisere, listWins: listWins, normList: normList,
              newStore: newStore, mkTree: mkTree, treeSum: treeSum, heapTree: heapTree, playout: playout, monteCarlo: monteCarlo, monteCarloTimed: monteCarloTimed, evaluate: evaluate, children: children,
              negamax: negamax, paritySearch: paritySearch, newContext: newContext, canonical: canonical, reduce: reduce,
              fromAnalysis: fromAnalysis, families: families, expand: expand, allMoves: allMoves, apply: apply, key: key, gameKey: gameKey,
              canMove: canMove, regionLives: regionLives, lives: lives, describe: describe, randomOf: randomOf, randomMove: randomMove };
  root.SproutsAI = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : this);
