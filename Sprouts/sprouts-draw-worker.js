/* =========================================================================
   sprouts-draw-worker.js — draws the picture afresh (Z) in a Web Worker
   (v118): the position (after the move, if any) laid out from its map alone
   with ONE chosen region outside (layout.js, FPP), then R as it is (v270) and
   the splines (redraw.js); the page starts one job per region, every region
   may be the outer one, and which is best cannot be told in advance (9/30:
   the least clearance ranged from failing to 22 px over the 17 choices of one
   position). On as many workers as the Workers menu allows; the page keeps
   the first or the best drawing. Loads the scripts with the
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

   R'S HELPERS (v269, Peter 11/12: "one worker for each patch"). R goes by patches (redraw.js, R BY PATCHES): boxes
   of the picture, each descended on its own, a round's boxes in four passes whose boxes are never neighbours. The
   worker with the R job stays in charge — it holds the state, re-spaces, finishes, sends the pictures. When a pass
   has more boxes than it has hands, it asks the page for helpers ({ id, wantHelpers: n }; never more in all than the
   job's `helpers`, which the page sets to one less than the Workers menu says — none: every box is done here, one
   after the other). The page keeps the helpers (workers of this same script, kept from one R to the next) and
   answers with one end of a message channel to each ({ id, ports }), the helper getting the other end
   ({ helper, port }): the boxes and their answers go straight between the two workers, not through the page.
   (A worker starting workers of its own would need no page, but the browser pane of the Claude app refuses that.)
   Each pass a box goes to every helper that is free, one is kept here, and then the next one nobody has; when every
   box left is with a helper, one of THOSE is done here as well, and the first answer counts — both are the same to
   the last bit (the boxes start from the pass's picture, not from one another's results). So nothing waits on a
   helper: one that fails or never answers costs its box's time only, and no time limit is needed to notice. A
   helper keeps its own copy of the state (sent again after a re-spacing) and gets, per box, the pass's picture as
   flat numbers; it sends back the points it moved.
   Page → in charge: { id, ports }   { id, helperLost: i, why }      Page → helper: { helper, port }
   Over a channel:   { helper, id, round, pass, k, box, fixed0, P [, st] }  a box;  { helper, drop [, over] }  leave it
                     { helper, id, round, pass, k, res: { free, xy, steps } }  back

   In:  { id, game, mv (ai.js form) | null, player, outerFace, o, show }   a job
        { id, show: true | false }                                       show its picture, or stop
        { id, drawn: true }                       (v242) the page has taken the last picture: the next may be sent
   Out: { id, gap, it }                      now and then: how promising the job looks while it runs — the least
                                             gap between the polylines (px)
        { id, picture, it }                  while shown: the polylines now
        { id, done: true, error, game, clearance, corners, dense, moved, it }
   ========================================================================= */
var q = self.location.search;
importScripts('geom.js' + q, 'relax.js' + q, 'route.js' + q, 'engine.js' + q, 'describe.js' + q,
              'room.js' + q, 'redraw.js' + q, 'layout.js' + q, 'flip.js' + q);
var Ly = self.SproutsLayout, Rd = self.SproutsRedraw;
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
  if (d.helper) { hport = d.port; hport.onmessage = function (ev) { helperIn(ev.data); }; helperIn({ drop: true, over: true }); return; }   // (v269) this worker is a helper: the channel to the worker in charge
  if (d.ports) { if (job && job.id === d.id) d.ports.forEach(function (p) { addHelper(p); }); return; }
  if (d.helperLost !== undefined) { if (job && job.id === d.id) loseHelper(helpers[d.helperLost], d.why); return; }
  if (d.drawn) { if (job && job.id === d.id) job.waiting = false; return; }
  if (!d.game) { if (job && job.id === d.id) job.show = d.show; return; }
  self.SproutsRelax.setHalfStumps(!!d.o.halfStumps);   // (v212: stumps count at half size with View → Stumps half size)
  if (d.clear) {                                   // (v253) a share of the least clearance: the page asks several workers at once
    self.postMessage({ id: d.id, clear: Rd.leastClearance(d.game, d.o, d.part, d.of) });
    return;
  }
  if (d.redraw) {                                  // R (v226)
    /* (v271) { …, flip: true }: the picture turned inside out first (flip.js), then R from there. When no region
       would make a shallower outside: { id, done, none: why } and nothing else. */
    var from = d.game, flip = null;
    if (d.flip) {
      flip = self.SproutsFlip.insideOut(d.game);
      if (flip.none) { self.postMessage({ id: d.id, done: true, none: flip.none, before: d.before }); return; }
      from = flip.game; flip = { from: flip.from, to: flip.to, room: flip.room };
    }
    job = { id: d.id, show: !!d.show, flip: flip, st: Rd.createRedraw(from, d.o, !!d.keep), o: d.o, last: 0, redraw: true, filled: false, smoothing: false, helpers: d.helpers || 0, asked: 0,
            before: typeof d.before === 'number' ? d.before : Rd.leastClearance(d.game, d.o) };   // (v253: the page's, when it knows it)
    setTimeout(slice, 0);
    return;
  }
  var g = Ly.freshGame(d.game, d.mv, d.player, -1, d.o.D, d.outerFace);   // Z
  if (!g) { self.postMessage({ id: d.id, done: true, error: 'no layout with that region outside' }); return; }
  job = { id: d.id, show: !!d.show, st: Rd.createRedraw(g, d.o, false), o: d.o, last: 0 };
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
  if (!j) return;
  var st = j.st, at = null;
  /* (v269) while helpers have boxes, ONE step and then the messages waiting (their answers): a pass of small boxes
     takes less than a frame, and its answers would lie unread until this worker's own slice ended — measured on a
     150-seed picture with 31 helpers: no faster than alone. */
  var span = j.redraw ? (helpers.some(function (h) { return h.job; }) ? 0 : FRAME_MS) : SLICE_MS;
  do {
    if (j.helpers) { var pr = st.pr, now = pr ? pr.round + ',' + pr.pass + ',' + pr.cur : ''; if (now !== at) { feed(j); at = now; } }   // (a pass or a box began: boxes for the helpers)
    done = Rd.stepRedraw(st, 1);
  } while (!done && Date.now() - t < span);
  if (done && j.o.fill && !j.filled && !st.stuck) {   // (v270: Z's layouts too — Z ends with R as it is)   // (v226, as the page's smoothAfterFill: enlarge, then smooth with the seeds kept)
    j.filled = true;
    if (Rd.fillArea(st)) {
      var o2 = {}, k;
      for (k in st.o) o2[k] = st.o[k];
      o2.keepShape = false;
      j.pre = st; j.st = Rd.createRedraw(Rd.redrawCurrent(st), o2, true); j.smoothing = true;   // (pre: the enlarged picture, kept in case the smoothing cannot be finished — v233)
      if (j.show && !j.waiting) sendPicture(j, { id: j.id, picture: Rd.redrawCurrent(j.st), it: j.st.it, smoothing: true });
      j.last = Date.now();
      again(j);
      return;
    }
  }
  if (done) {
    var rr = Rd.finishRedraw(st), unsmoothed = false;
    /* (v233, Peter's 200-seed game of 11/1: the last R was refused because only the smoothing — the seeds held — could
       not be finished, "with the spots fixed — R moves them too"): then the enlarged picture as it was before the
       smoothing is finished instead */
    if (rr.error && j.pre) { var r0 = Rd.finishRedraw(j.pre); if (!r0.error) { rr = r0; unsmoothed = true; } }
    self.postMessage({ id: j.id, done: true, error: rr.error, game: rr.game, clearance: rr.clearance, corners: rr.corners || 0, straight: rr.straight || 0,
                       dense: !!rr.dense, moved: rr.moved, it: st.it, smoothing: j.smoothing, unsmoothed: unsmoothed, before: j.before,
                       helpers: helpers.length, helped: j.helped || 0, lost: helpers.filter(function (h) { return h.dead; }).length, lostWhy: j.lostWhy || '', flip: j.flip || null });
    helpers.forEach(function (h) { h.port.postMessage({ helper: true, drop: true, over: true }); h.port.close(); }); helpers = [];
    job = null;
    return;
  }
  if (j.show && !j.waiting && Date.now() - j.last > (j.redraw ? FRAME_MS : REPORT_MS)) sendPicture(j, { id: j.id, picture: Rd.redrawCurrent(st), it: st.it, smoothing: j.smoothing });
  if (!j.redraw) self.postMessage({ id: j.id, gap: gap(st) || 0, it: st.it });
  again(j);
}
/* The next slice: for R through a message of its own, which waits its turn behind the messages already there and no
   longer (a timer of 0 waits 4 ms once they follow one another — nothing against a slice of 30, too much against a step). */
var tick = new MessageChannel();
tick.port1.onmessage = slice;
function again(j) { if (j.redraw) tick.port2.postMessage(0); else setTimeout(slice, 0); }

/* ---- R's helpers (v269; see the top) ---- */
var helpers = [];                                // in the worker in charge: { port, job: { round, pass, k } | null, gen, dead }
function addHelper(port) {
  var h = { port: port, job: null, gen: -1, dead: false };
  port.onmessage = function (e) {
    var m = e.data, hj = h.job;
    if (hj && hj.round === m.round && hj.pass === m.pass && hj.k === m.k) h.job = null;
    if (job && job.id === m.id && job.st.pr && !job.st.pr.res[m.k]) { Rd.patchTake(job.st, m.round, m.pass, m.k, m.res); if (job.st.pr.res[m.k] === m.res) job.helped = (job.helped || 0) + 1; }
  };
  helpers.push(h);
}
function loseHelper(h, why) {                    // it is not asked again; its box goes back to those nobody has
  if (!h || h.dead) return;
  var pp = Rd.patchPass(job.st), hj = h.job;
  h.dead = true; h.job = null; job.lostWhy = why || 'unknown';
  if (pp && hj && pp.round === hj.round && pp.pass === hj.pass) pp.out[hj.k] = false;
}
function feed(j) {
  var st = j.st, pp = Rd.patchPass(st), i, h;
  for (i = 0; i < helpers.length; i++) {           // a box that is settled (or whose pass is over) is left
    h = helpers[i];
    if (h.job && (!pp || h.job.round !== pp.round || h.job.pass !== pp.pass || pp.res[h.job.k])) { h.port.postMessage({ helper: true, drop: true }); h.job = null; }
  }
  if (!pp) return;
  var open = pp.list.filter(function (k) { return !pp.res[k] && !pp.out[k] && k !== pp.cur; }), gen = st.respaced || 0, keep = pp.cur < 0 ? 1 : 0;   // (one is left for this worker when it has none in hand)
  while (open.length > keep) {
    h = null;
    for (i = 0; i < helpers.length && !h; i++) if (!helpers[i].dead && !helpers[i].job) h = helpers[i];
    if (!h) break;
    var k = open.shift(), m = { helper: true, id: j.id, round: pp.round, pass: pp.pass, k: k, box: pp.boxes[k], fixed0: pp.fixed0, P: Rd.flatPoints(st) };
    if (h.gen !== gen) { m.st = Rd.helperState(st); h.gen = gen; }
    pp.out[k] = true; h.job = { round: pp.round, pass: pp.pass, k: k };
    h.port.postMessage(m);
  }
  var more = Math.min(open.length - keep - (j.asked - helpers.length), j.helpers - j.asked);   // boxes left over, beyond the helpers already on their way: more, as far as the page allows
  if (more > 0) { j.asked += more; self.postMessage({ id: j.id, wantHelpers: more }); }
}
var hst = null, hjob = null, hseq = 0, hport = null;   // in a helper: its copy of the state, the box in hand, the channel
function helperIn(d) {
  if (hjob && hjob.on) Rd.boxEnd(hst, hjob.fixed0, 0);   // (a new box, or told to leave this one)
  hjob = null; hseq++;
  if (d.drop) { if (d.over) hst = null; return; }   // (over: that R has ended — its state is let go)
  if (d.st) { hst = d.st; self.SproutsRelax.setHalfStumps(!!hst.o.halfStumps); }
  hjob = { id: d.id, round: d.round, pass: d.pass, k: d.k, fixed0: d.fixed0, steps: 0, on: Rd.helperBox(hst, d.box, d.fixed0, d.P) };
  setTimeout(helperSlice, 0, hseq);
}
function helperSlice(seq) {
  var j = hjob, t = Date.now(), over;
  if (seq !== hseq || !j) return;
  over = !j.on;
  while (!over && Date.now() - t < SLICE_MS) { if (Rd.descend(hst)) j.steps++; else over = true; }
  if (!over) { setTimeout(helperSlice, 0, seq); return; }
  var r = j.on ? Rd.boxEnd(hst, j.fixed0, j.steps) : { free: new Int32Array(0), xy: new Float64Array(0), steps: 0 };
  hjob = null;
  hport.postMessage({ helper: true, id: j.id, round: j.round, pass: j.pass, k: j.k, res: r });
}
