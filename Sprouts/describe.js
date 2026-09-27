/* =========================================================================
   describe.js — Sprouts positions and moves in words, for the log and for
   File → Save position. DOM-free (global SproutsDescribe, or require()).
   Needs engine.js.

   Spots are numbered from 1 as on screen. A BOUNDARY is written as the spots
   met walking once round it, starting at its lowest number: a path 1–7–2 is
   "1-7-2-7" (7 is passed on both sides), an isolated spot is just "5". A
   REGION is written as what bounds it and what it contains: "the region
   bounded by 5-8, containing 1-7-2-7 | 4 (5 lives)", or "the outside
   region, containing …". The engine keeps no lasting identity for a region,
   so a region is always named by its contents.
   ========================================================================= */
(function (root) {
  'use strict';
  var E = root.SproutsEngine || require('./engine.js');

  function num(s) { return String(s + 1); }

  /* The spots met going once round boundary bd of analysis an. */
  function walk(an, bd) {
    if (bd.cycle === undefined) return num(bd.spot);
    var t = an.cycles[bd.cycle].halves.map(function (h) { return h.tail; }), k = 0;
    t.forEach(function (s, i) { if (s < t[k]) k = i; });
    return t.slice(k).concat(t.slice(0, k)).map(num).join('-');
  }

  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }

  /* "the region bounded by …, containing … (n lives)" */
  function region(an, r) {
    var outer = null, inner = [];
    r.boundaries.forEach(function (bd) { if (bd.cycle !== undefined && bd.cycle === r.key) outer = bd; else inner.push(bd); });
    var s = outer ? 'the region bounded by ' + walk(an, outer) : 'the outside region';
    s += inner.length ? ', containing ' + inner.map(function (bd) { return walk(an, bd); }).join(' | ') : ', empty inside';
    return s + ' (' + plural(r.lives, 'life', 'lives') + (r.canMove ? '' : ', no move left') + ')';
  }

  /* The regions in a fixed order: the outside first, then by lowest spot. */
  function ordered(an) {
    function low(r) { return r.spots.length ? Math.min.apply(null, r.spots) : Infinity; }
    return an.regions.slice().sort(function (p, q) {
      if (p.key === -1) return -1;
      if (q.key === -1) return 1;
      return low(p) - low(q);
    });
  }

  function regionOfCycle(an, ci) {
    return an.regions.filter(function (r) { return r.boundaries.some(function (bd) { return bd.cycle === ci; }); })[0];
  }
  function cycleOfHalf(an, id) {
    for (var ci = 0; ci < an.cycles.length; ci++) {
      if (an.cycles[ci].halves.some(function (h) { return h.id === id; })) return ci;
    }
    return -1;
  }

  /* One move in words (several lines): `before` and `after` are game objects ({spots, edges,
     moves}) one move apart; the move appended its new spot z and its two
     edges a→z, z→b last. `name` is the mover's name. */
  function move(before, after, name) {
    var n = after.edges.length, e1 = after.edges[n - 2], e2 = after.edges[n - 1];
    var a = e1.a, z = e1.b, b = e2.b;
    var s = 'Move ' + after.moves + ' (' + name + '): ' + num(a) + ' → ' + num(b) + (a === b ? ' (a loop)' : '') +
            ', new spot ' + num(z) + '. ';
    var an0 = E.analyse(before.spots, before.edges), an1 = E.analyse(after.spots, after.edges);
    var r0 = an0.regionAt([after.spots[z].x, after.spots[z].y]);
    var r1 = regionOfCycle(an1, cycleOfHalf(an1, 2 * (n - 2))), r2 = regionOfCycle(an1, cycleOfHalf(an1, 2 * (n - 2) + 1));
    if (!r0 || !r1 || !r2) return s + '(Could not read the regions.)';
    if (r1 === r2) {
      var bw = function (x) { var bd = r0.boundaries.filter(function (bd) { return bd.spots.indexOf(x) >= 0; })[0]; return bd ? walk(an0, bd) : num(x); };
      return s + 'Joins ' + bw(a) + ' and ' + bw(b) + '; no new region.\n    In ' + region(an0, r0) + '.';
    }
    return s + 'A new region:\n    Splits ' + region(an0, r0) + ' into\n      ' + region(an1, r1) + ' and\n      ' + region(an1, r2) + '.';
  }

  /* The whole position in words. names(p) gives player p's name. */
  function position(game, names) {
    var an = E.analyse(game.spots, game.edges), lines = [], dead = 0;
    game.spots.forEach(function (sp) { if (sp.deg >= 3) dead++; });
    var rules = game.rules === 'misere' ? 'misère play' : 'normal play';
    if (game.phase === 'place') {
      lines.push('Sprouts position: spots being placed (' + game.spots.length + ' so far), ' + rules + '.');
    } else {
      lines.push('Sprouts position after ' + plural(game.moves, 'move', 'moves') + ', ' + rules + '. ' +
                 (game.phase === 'over' ? 'Game over: ' + names(game.player) + ' cannot move.' : names(game.player) + ' to move.'));
      var added = game.added || 0;
      lines.push('Started with ' + plural(game.spots.length - game.moves - added, 'spot', 'spots') +
                 (added ? ', ' + added + ' added by hand' : '') + '; now ' + game.spots.length +
                 ', of which ' + dead + ' dead (3 curves).');
    }
    lines.push('');
    lines.push('Regions (a boundary lists the spots met going once round it; a spot can appear twice):');
    ordered(an).forEach(function (r, i) { lines.push('  ' + (i + 1) + '. ' + region(an, r)); });
    lines.push('');
    lines.push('Spots (curves attached, lives left):');
    game.spots.forEach(function (sp, i) {
      lines.push('  ' + num(i) + ': ' + plural(sp.deg, 'curve', 'curves') + ', ' + (sp.deg >= 3 ? 'dead' : plural(3 - sp.deg, 'life', 'lives')));
    });
    return lines.join('\n');
  }

  var api = { walk: walk, region: region, move: move, position: position };
  root.SproutsDescribe = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : this);
