// BackgammonWorker.js
// Background thread for the parallel search. Reuses the exact game engine — game.js
// is DOM-free, so importScripts pulls in BackgammonGame, simulateBGMatch and the
// expectimax search verbatim (no duplicated logic to keep in sync).
//
// NOTE: Web Workers require an http(s) origin — this file (and the app) cannot be
// loaded from file://. Serve the folder over http (e.g. XAMPP: http://localhost/...).
//
// Two job types:
//   { cmd:'play_match', id, wA, wB, X, depthA, depthB }
//       -> plays a whole match on this thread (sync; blocking here is fine, it's not
//          the UI thread) and returns { id, result:{winner,scoreA,scoreB,games} }.
//   { cmd:'search', id, board:{points,bar,borneOff}, player, dice, plies, weights }
//       -> returns { id, val } = expectiRollValue: the value of `player`'s best reply
//          to `dice` from `board`, searched `plies` deep. One (my-move, opp-roll) task.

// location.search carries the ?v=<stamp> cache-buster the main thread put on the
// Worker URL, so game.js re-fetches in lockstep with the worker (a hard refresh does
// NOT reliably bust a worker's importScripts cache on its own — this does).
importScripts('game.js' + (self.location && self.location.search || ''));

// A persistent host so the search's internal scratch board (_searchScratch) is
// reused across tasks instead of reallocated each message.
const searchHost = new BackgammonGame();

self.onmessage = function (e) {
  const d = e.data;
  try {
    if (d.cmd === 'play_match') {
      const result = simulateBGMatch(d.wA, d.wB, d.X, d.depthA, d.depthB, d.collectStats);
      self.postMessage({ id: d.id, result });   // result.escHist rides back when collectStats
      return;
    }
    if (d.cmd === 'search') {
      const val = searchHost.expectiRollValue(d.board, d.player, d.dice, d.plies, d.weights);
      self.postMessage({ id: d.id, val });
      return;
    }
    self.postMessage({ id: d && d.id, error: 'unknown command' });
  } catch (err) {
    self.postMessage({ id: d && d.id, error: (err && err.message) || String(err) });
  }
};
