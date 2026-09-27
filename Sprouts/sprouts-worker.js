/* =========================================================================
   sprouts-worker.js — a Web Worker that scores candidate moves for the
   computer players (v71, v73): Monte Carlo (random games) or the parity
   search, both in ai.js. Loads ai.js with the same ?v= query it was started
   with. The parity search's transposition table (canonical positions) lives
   here for as long as the worker does.

   In:  { id, kind: 'montecarlo', pos, cands, misere, trials | deadline }
        { id, kind: 'parity',     pos, cands, misere, depth, cap, deadline? }
   Out: { id, progress: k }                 (parity: after each candidate)
        { id, wins: [...], games: [...] }   (Monte Carlo)
        { id, scores: [...] | null (deadline passed), nodes, hits, entries }
   ========================================================================= */
importScripts('ai.js' + self.location.search);
var AI = self.SproutsAI, ctx = AI.newContext();
var TT_MAX = 2000000;                            // entries; the table is emptied when it grows past this
self.onmessage = function (e) {
  var d = e.data;
  if (d.kind === 'montecarlo') {
    var r = d.deadline ? AI.monteCarloTimed(d.pos, d.cands, d.deadline, d.misere) : AI.monteCarlo(d.pos, d.cands, d.trials, d.misere);
    self.postMessage({ id: d.id, wins: r.wins, games: r.games });
    return;
  }
  if (ctx.tt.size > TT_MAX) ctx.tt.clear();
  ctx.deadline = d.deadline || Infinity; ctx.aborted = false; ctx.nodes = 0; ctx.hits = 0;
  var scores = AI.paritySearch(d.pos, d.cands, d.depth, d.misere, d.cap, null, function (i) { self.postMessage({ id: d.id, progress: i + 1 }); }, ctx);
  self.postMessage({ id: d.id, scores: scores, nodes: ctx.nodes, hits: ctx.hits, entries: ctx.tt.size });
};
