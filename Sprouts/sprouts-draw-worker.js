/* =========================================================================
   sprouts-draw-worker.js — draws the picture afresh (Z) in a Web Worker
   (v118), by one of the Room menu's methods (v209, `route.zMethod`):
   FPP — the position (after the move, if any) laid out from its map alone
   with ONE chosen region outside (layout.js), then the tight descent and the
   splines (redraw.js); the page starts one job per region, every region may
   be the outer one, and which is best cannot be told in advance (9/30: the
   least clearance ranged from failing to 22 px over the 17 choices of one
   position). GROW — the position grown from ONE chosen start spot
   (zgrow.js); while it grows, `gap` is the number of curves drawn so far;
   when grown, the drawing is scaled up to fill the window and the same tight
   polish runs. Either way on as many workers as the Workers menu allows, and
   the page keeps the first or the best drawing. Loads the scripts with the
   same ?v= query it was started with.

   The work runs in slices (SLICE_MS), yielding between them, so that the
   page can tell a running job to start or stop showing its picture (v119:
   when the job on screen is done, the page shows the most promising of those
   still running — Peter, 9/30: otherwise it looks as if the page got stuck).

   In:  { id, game, mv (ai.js form) | null, player, outerFace | start, o, show }   a job (start: a GROW job)
        { id, show: true | false }                                       show its picture, or stop
   Out: { id, gap, it }                      now and then: how promising the job looks while it runs — during the
                                             polish 1e6 + the least gap between the polylines (px), during a growth
                                             the curves drawn so far (so a polish under way outranks any growth)
        { id, picture, it }                  while shown: the polylines now
        { id, done: true, error, game, clearance, corners, small, dense, moved, it, stages }   (small, v189: the spots drawn smaller)
   ========================================================================= */
var q = self.location.search;
importScripts('geom.js' + q, 'relax.js' + q, 'route.js' + q, 'engine.js' + q, 'describe.js' + q,
              'room.js' + q, 'redraw.js' + q, 'layout.js' + q, 'zgrow.js' + q);
var Ly = self.SproutsLayout, Rd = self.SproutsRedraw, Zg = self.SproutsGrow;
var REPORT_MS = 100;                             // how often a shown job sends its picture (the page draws at most that often)
var SLICE_MS = 50;                               // steps between yields (a message waits at most this long)
var job = null;
self.onmessage = function (e) {
  var d = e.data;
  if (!d.game) { if (job && job.id === d.id) job.show = d.show; return; }
  self.SproutsRelax.setHalfStumps(!!d.o.halfStumps);   // (v212: stumps count at half size with View → Stumps half size)
  if (d.start !== undefined) {                     // GROW
    var t = Zg.targetOf(d.game, d.mv, d.player);
    job = { id: d.id, show: !!d.show, grow: Zg.createGrow(t, { o: d.o, start: d.start }), st: null, o: d.o, last: 0 };
  } else {                                         // FPP
    var g = Ly.freshGame(d.game, d.mv, d.player, -1, d.o.D, d.outerFace);
    if (!g) { self.postMessage({ id: d.id, done: true, error: 'no layout with that region outside' }); return; }
    job = { id: d.id, show: !!d.show, grow: null, st: Rd.createRedraw(g, d.o, false), o: d.o, last: 0 };
  }
  setTimeout(slice, 0);
};
function gap(st) {                               // the least distance of a point to anything it could hit (evaluate's caps are a third of it)
  var c = st.cap, m = Infinity;
  if (!c) return null;
  for (var i = 0; i < c.length; i++) if (c[i] < m) m = c[i];
  return m;
}
function slice() {
  var j = job, t = Date.now(), done = false;
  if (j.grow) {
    while (!done && Date.now() - t < SLICE_MS) done = Zg.stepGrow(j.grow, 10);
    if (!done) {
      if (j.show && Date.now() - j.last > REPORT_MS) { self.postMessage({ id: j.id, picture: Zg.pictureOf(j.grow), it: j.grow.drawn }); j.last = Date.now(); }
      self.postMessage({ id: j.id, gap: j.grow.drawn, it: j.grow.drawn });
      setTimeout(slice, 0);
      return;
    }
    var r = Zg.finishGrow(j.grow);
    if (!r.ok) {
      self.postMessage({ id: j.id, done: true, error: 'the growth stopped: ' + (r.failures[0] || 'not every spot was placed') + ' (' + r.drawn + ' of ' + j.grow.t.edges.length + ' curves, ' + r.placed + ' of ' + j.grow.t.spots.length + ' spots)', it: r.drawn });
      job = null;
      return;
    }
    j.grown = { grow: j.grow, failures: r.failures };
    var g = r.game;
    Zg.fitWindow({ g: g, W: g.W0, H: g.H0, step: 2 * j.o.D });
    j.st = Rd.createRedraw(g, j.o, false); j.grow = null;
    t = Date.now();
  }
  var st = j.st;
  while (!done && Date.now() - t < SLICE_MS) done = Rd.stepRedraw(st, 1);
  if (done) {
    var rr = Rd.finishRedraw(st);
    self.postMessage({ id: j.id, done: true, error: rr.error, game: rr.game, clearance: rr.clearance, corners: rr.corners || 0, small: rr.small || [],
                       dense: !!rr.dense, moved: rr.moved, it: st.it, stages: st.stages });
    job = null;
    return;
  }
  if (j.show && Date.now() - j.last > REPORT_MS) { self.postMessage({ id: j.id, picture: Rd.redrawCurrent(st), it: st.it }); j.last = Date.now(); }
  self.postMessage({ id: j.id, gap: 1e6 + (gap(st) || 0), it: st.it });   // (a polish under way outranks any growth for the screen)
  setTimeout(slice, 0);
}
