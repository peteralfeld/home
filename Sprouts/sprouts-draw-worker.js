/* =========================================================================
   sprouts-draw-worker.js — draws the picture afresh (Z) in a Web Worker
   (v118): the position (after the move, if any) laid out from its map alone
   with ONE chosen region outside (layout.js), then the tight descent and the
   splines (redraw.js). The page starts one job per region — every region may
   be the outer one, and which is best cannot be told in advance (9/30: the
   least clearance ranged from failing to 22 px over the 17 choices of one
   position) — on as many workers as the Workers menu allows, and keeps the
   best drawing. Loads the scripts with the same ?v= query it was started with.

   The descent runs in slices (SLICE_MS), yielding between them, so that the
   page can tell a running job to start or stop showing its picture (v119:
   when the job on screen is done, the page shows the most promising of those
   still running — Peter, 9/30: otherwise it looks as if the page got stuck).

   In:  { id, game, mv (ai.js form) | null, player, outerFace, o, show }   a job
        { id, show: true | false }                                       show its picture, or stop
   Out: { id, gap, it }                      now and then: the least gap between the polylines now (px) —
                                             how promising the job looks while it runs
        { id, picture, it }                  while shown: the polylines now
        { id, done: true, error, game, clearance, corners, dense, moved, it, stages }
   ========================================================================= */
var q = self.location.search;
importScripts('geom.js' + q, 'relax.js' + q, 'route.js' + q, 'engine.js' + q, 'describe.js' + q,
              'room.js' + q, 'redraw.js' + q, 'layout.js' + q);
var Ly = self.SproutsLayout, Rd = self.SproutsRedraw;
var REPORT_MS = 100;                             // how often a shown job sends its picture (the page draws at most that often)
var SLICE_MS = 50;                               // steps between yields (a message waits at most this long)
var job = null;
self.onmessage = function (e) {
  var d = e.data;
  if (!d.game) { if (job && job.id === d.id) job.show = d.show; return; }
  var g = Ly.freshGame(d.game, d.mv, d.player, -1, d.o.D, d.outerFace);
  if (!g) { self.postMessage({ id: d.id, done: true, error: 'no layout with that region outside' }); return; }
  job = { id: d.id, show: !!d.show, st: Rd.createRedraw(g, d.o, false), last: 0 };
  setTimeout(slice, 0);
};
function gap(st) {                               // the least distance of a point to anything it could hit (evaluate's caps are a third of it)
  var c = st.cap, m = Infinity;
  if (!c) return null;
  for (var i = 0; i < c.length; i++) if (c[i] < m) m = c[i];
  return m;
}
function slice() {
  var j = job, st = j.st, t = Date.now(), done = false;
  while (!done && Date.now() - t < SLICE_MS) done = Rd.stepRedraw(st, 1);
  if (done) {
    var r = Rd.finishRedraw(st);
    self.postMessage({ id: j.id, done: true, error: r.error, game: r.game, clearance: r.clearance, corners: r.corners || 0,
                       dense: !!r.dense, moved: r.moved, it: st.it, stages: st.stages });
    job = null;
    return;
  }
  if (j.show && Date.now() - j.last > REPORT_MS) { self.postMessage({ id: j.id, picture: Rd.redrawCurrent(st), it: st.it }); j.last = Date.now(); }
  self.postMessage({ id: j.id, gap: gap(st), it: st.it });
  setTimeout(slice, 0);
}
