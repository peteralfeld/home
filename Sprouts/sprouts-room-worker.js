/* =========================================================================
   sprouts-room-worker.js — the router's slow parts in a Web Worker: making
   room for a move (v137, Peter 10/1: room-making froze the page for seconds
   to a minute) and the marked route (v139: markedRoute's barrier search took
   up to 5.7 s on the page's thread in a 30-spot game). The page sends a job;
   the worker runs the same code the page runs without workers (moves.js
   roomFor, routeFor) and sends back the result. One job at a time; the page
   terminates the worker to stop a job (Space). Loads the scripts with the
   same ?v= query it was started with.

   Room:  In  { id, game, route, spotR, job (moves.js jobOf), spots, curves, pending: { ghost, clearance } }
          Out { id, res }   res as roomFor returns it: { game, start, fitted, what } or { fail, brief, why }
   Route: In  { id, kind: 'route', game, route, spotR, job (jobOf + encloseNone, bsideDir) }
          Out { id, res: { mr, why, note, said } }   mr as markedRoute returns it ({ path }, { plain }, null);
          why = ar.why; note = the note it left; said = its messages ([text, warn]), for the page to show
   Lower: In  as Route with kind: 'lower'; Out { id, res: { low, note, said } }   moves.js lowerFor (v139)
   ========================================================================= */
var q = self.location.search;
importScripts('geom.js' + q, 'relax.js' + q, 'route.js' + q, 'engine.js' + q, 'describe.js' + q, 'room.js' + q, 'moves.js' + q);
var S = { game: null, route: null, spotR: 6, note: null, hush: 1, say: function () {} };   // (hush: nothing to say — the page says it)
var Mk = self.SproutsMoves.create(S);
self.onmessage = function (e) {
  var d = e.data, res;
  S.game = d.game; S.route = d.route; S.spotR = d.spotR; S.note = null; S.hush = 1;
  if (d.kind === 'route' || d.kind === 'lower') {
    var said = [];
    S.say = function (text, warn) { said.push([text, !!warn]); };
    res = d.kind === 'route' ? Mk.routeFor(d.job) : Mk.lowerFor(d.job);
    S.say = function () {};
    res.note = S.note; res.said = said;
    self.postMessage({ id: d.id, res: res });
    return;
  }
  var ar = Mk.armedOf(d.job);
  if (!ar) res = { fail: true, brief: ['the region of the move was not found'], why: ['the region of the move was not found in the worker (a bug)'] };
  else res = Mk.roomFor(ar, d.job.b, d.spots, d.curves, d.pending);
  self.postMessage({ id: d.id, res: res });
};
