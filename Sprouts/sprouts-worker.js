/* =========================================================================
   sprouts-worker.js — a Web Worker that scores candidate moves for the
   computer players (v71, v73): Monte Carlo (random games) or the parity
   search, both in ai.js. Loads ai.js with the same ?v= query it was started
   with. The parity search's transposition table (canonical positions), the
   nimbers and the misère trees of solved parts live here for as long as the
   worker does.

   In:  { id, kind: 'keys', pos, moves }                 (v122: → { id, keys }, the canonical forms after each move)
        { id, kind: 'montecarlo', pos, cands, misere, trials | deadline }
        { id, kind: 'parity',     pos, cands, misere, depth, cap, deadline?, budget?, sharp? }
                                   (v173: sharp — the leaves judged by the longest game itself, not by the
                                    bound; mxBudget: bytes for its tables (ai.js mxStore); budget: the move's whole time — those computations stop there
                                    even in depth 1, which has no deadline)
        { id, kind: 'maxmoves', pos, mxBudget? }                    (v173: → { id, M }, the longest game from pos —
                                    no time limit; worked on in slices so that a newer request takes over
                                    at once, the tables of what was shown kept for it)
   Out: { id, progress: k }                 (parity: after each candidate)
        { id, wins: [...], games: [...] }   (Monte Carlo)
        { id, scores: [...] | null (deadline passed), nodes, hits, solved, entries }
   ========================================================================= */
importScripts('ai.js' + self.location.search);
var AI = self.SproutsAI, ctx = AI.newContext();
var TT_MAX = 2000000;                            // entries; the table is emptied when it grows past this
/* (v173) the longest game for the page, in slices of MX_SLICE ms: between slices a newer request (onmessage)
   replaces mxWant. Only what was shown is kept in the tables, so each slice starts where the last left off
   in effect; the slice length only decides how soon a new position is taken up. */
var MX_SLICE = 200, mxWant = null;
function mxSlice() {
  var w = mxWant;
  if (!w) return;
  ctx.mxDeadline = Date.now() + MX_SLICE;
  var M = AI.maxMoves(w.pos, ctx);
  if (M >= 0) { self.postMessage({ id: w.id, M: M }); if (mxWant === w) mxWant = null; }
  if (mxWant) setTimeout(mxSlice, 0);
}
self.onmessage = function (e) {
  var d = e.data;
  if (d.kind === 'keys') {                       // (v122) the canonical forms of the positions after the moves, for the page to drop equal ones
    self.postMessage({ id: d.id, keys: d.moves.map(function (mv) { return AI.canonical(AI.apply(d.pos, mv)); }) });
    return;
  }
  if (d.kind === 'montecarlo') {
    var r = d.deadline ? AI.monteCarloTimed(d.pos, d.cands, d.deadline, d.misere) : AI.monteCarlo(d.pos, d.cands, d.trials, d.misere);
    self.postMessage({ id: d.id, wins: r.wins, games: r.games });
    return;
  }
  if (d.kind === 'maxmoves') {                   // (v173) the M of the page's title and status line
    var busy = !!mxWant; mxWant = d; if (d.mxBudget) ctx.mxBudget = d.mxBudget;
    if (!busy) mxSlice();
    return;
  }
  if (ctx.nim.size > TT_MAX) ctx.nim.clear();   // (v83: the nimbers of solved parts)
  if (ctx.mis.size > TT_MAX || ctx.T.opts.length > TT_MAX || ctx.T.sum.size > TT_MAX || ctx.T.ol.size > TT_MAX) {   // (v86: the misère trees; the table's keys name trees by id, so it goes too)
    ctx.mis.clear(); ctx.T = AI.newStore(); ctx.tt.clear();
  }
  if (ctx.tt.size > TT_MAX) ctx.tt.clear();
  ctx.deadline = d.deadline || Infinity; ctx.mxDeadline = d.budget || ctx.deadline; ctx.sharp = !!d.sharp; if (d.mxBudget) ctx.mxBudget = d.mxBudget; ctx.aborted = false; ctx.nodes = 0; ctx.hits = 0; ctx.solved = 0;
  var scores = AI.paritySearch(d.pos, d.cands, d.depth, d.misere, d.cap, null, function (i) { self.postMessage({ id: d.id, progress: i + 1 }); }, ctx);
  self.postMessage({ id: d.id, scores: scores, nodes: ctx.nodes, hits: ctx.hits, solved: ctx.solved, entries: ctx.tt.size });
};
