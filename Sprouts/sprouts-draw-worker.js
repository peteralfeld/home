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

   R (v226, Peter 11/1: the page took seconds to react to clicks and keys while R ran on its main thread): a job
   { id, redraw: true, game, o, keep, show } runs R — createRedraw(game, o, keep), the descent in slices, and when
   o.fill (R fills the whole area) the enlarging (fillArea) followed by the smoothing descent with the seeds kept
   (as the page's smoothAfterFill did, v222), then finishRedraw — sending its polylines every FRAME_MS while shown.
   Out for it: { id, picture, it, smoothing } and { id, done: true, …, smoothing }.

   In:  { id, game, mv (ai.js form) | null, player, outerFace | start, o, show }   a job (start: a GROW job)
        { id, show: true | false }                                       show its picture, or stop
        { id, drawn: true }                       (v242) the page has taken the last picture: the next may be sent
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
var FRAME_MS = 30;                               // R (v226): how often its picture goes to the page — the page's animation frame (ui.js RELAY_FRAME_MS)
var job = null;
/* ONE PICTURE AT A TIME (v242, Peter's 500-spot game of 11/2: the tab ran out of memory during an R at move 831). A
   picture of a large drawing is megabytes, and while the page's thread is busy (13–14 s routing a curve, every move
   late in that game) the pictures sent every frame queue up unread. So after a picture the job sends the next only
   when the page has said it took this one ({ id, drawn: true }); the work itself does not wait. */
function sendPicture(j, msg) { j.waiting = true; j.last = Date.now(); self.postMessage(msg); }
self.onmessage = function (e) {
  var d = e.data;
  if (d.drawn) { if (job && job.id === d.id) job.waiting = false; return; }
  if (!d.game) { if (job && job.id === d.id) job.show = d.show; return; }
  self.SproutsRelax.setHalfStumps(!!d.o.halfStumps);   // (v212: stumps count at half size with View → Stumps half size)
  if (d.redraw) {                                  // R (v226)
    job = { id: d.id, show: !!d.show, grow: null, st: Rd.createRedraw(d.game, d.o, !!d.keep), o: d.o, last: 0, redraw: true, filled: false, smoothing: false,
            before: Rd.leastClearance(d.game, d.o) };
    setTimeout(slice, 0);
    return;
  }
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
      if (j.show && !j.waiting && Date.now() - j.last > REPORT_MS) sendPicture(j, { id: j.id, picture: Zg.pictureOf(j.grow), it: j.grow.drawn });
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
  while (!done && Date.now() - t < (j.redraw ? FRAME_MS : SLICE_MS)) done = Rd.stepRedraw(st, 1);
  if (done && j.redraw && j.o.fill && !j.filled && !st.stuck) {   // (v226, as the page's smoothAfterFill: enlarge, then smooth with the seeds kept)
    j.filled = true;
    if (Rd.fillArea(st)) {
      var o2 = {}, k;
      for (k in st.o) o2[k] = st.o[k];
      o2.keepShape = false;
      j.pre = st; j.st = Rd.createRedraw(Rd.redrawCurrent(st), o2, true); j.smoothing = true;   // (pre: the enlarged picture, kept in case the smoothing cannot be finished — v233)
      if (j.show && !j.waiting) sendPicture(j, { id: j.id, picture: Rd.redrawCurrent(j.st), it: j.st.it, smoothing: true });
      j.last = Date.now();
      setTimeout(slice, 0);
      return;
    }
  }
  if (done) {
    var rr = Rd.finishRedraw(st), unsmoothed = false;
    /* (v233, Peter's 200-seed game of 11/1: the last R was refused because only the smoothing — the seeds held — could
       not be finished, "with the spots fixed — R moves them too"): then the enlarged picture as it was before the
       smoothing is finished instead */
    if (rr.error && j.pre) { var r0 = Rd.finishRedraw(j.pre); if (!r0.error) { rr = r0; unsmoothed = true; } }
    self.postMessage({ id: j.id, done: true, error: rr.error, game: rr.game, clearance: rr.clearance, corners: rr.corners || 0, small: rr.small || [],
                       dense: !!rr.dense, moved: rr.moved, it: st.it, stages: st.stages, smoothing: j.smoothing, unsmoothed: unsmoothed, before: j.before });
    job = null;
    return;
  }
  if (j.show && !j.waiting && Date.now() - j.last > (j.redraw ? FRAME_MS : REPORT_MS)) sendPicture(j, { id: j.id, picture: Rd.redrawCurrent(st), it: st.it, smoothing: j.smoothing });
  if (!j.redraw) self.postMessage({ id: j.id, gap: 1e6 + (gap(st) || 0), it: st.it });   // (a polish under way outranks any growth for the screen)
  setTimeout(slice, 0);
}
