// BackgammonWorker.js
// Background thread for the parallel search. Reuses the exact game engine — game.js
// is DOM-free, so importScripts pulls in BackgammonGame, simulateBGMatch and the
// expectimax search verbatim (no duplicated logic to keep in sync).
//
// NOTE: Web Workers require an http(s) origin — this file (and the app) cannot be
// loaded from file://. Serve the folder over http (e.g. XAMPP: http://localhost/...).
//
// Four job types:
//   { cmd:'selfplay', id, spec, layers, seeds }
//       -> plays len(seeds) self-play games with that frozen net and returns their traces.
//          Used by LEARN; the learning itself never leaves the main thread.
//   { cmd:'install_net', netId, net }
//       -> caches one net under netId. FIRE AND FORGET: it sends no reply, so it never
//          disturbs runJobsParallel's one-response-per-job accounting. See below for why
//          this exists at all.
//   { cmd:'play_match', id, wA, wB, X, depthA, depthB, seed }
//       -> plays a whole match on this thread (sync; blocking here is fine, it's not
//          the UI thread) and returns { id, result:{winner,scoreA,scoreB,games} }.
//   { cmd:'search', id, board:{points,bar,borneOff}, player, dice, plies, weights }
//       -> returns { id, val } = expectiRollValue: the value of `player`'s best reply
//          to `dice` from `board`, searched `plies` deep. One (my-move, opp-roll) task.
//
// ⚠️ A NET BRAIN IS NOT SHIPPED WITH THE JOB. A linear brain is 24 numbers and travels
// with every message for free; a net is ~16k floats (~130 kB per structured clone), and
// ONE interactive move at depth 2 farms out several hundred search tasks. Sending the net
// each time would clone tens of megabytes per move and make nets look slow for a reason
// that has nothing to do with the net. So the main thread installs a net ONCE per worker
// and jobs carry only its netId; resolveBrain puts the cached net back. postMessage is
// FIFO per worker, so an install posted before a job is always there when the job runs.

// location.search carries the ?v=<stamp> cache-buster the main thread put on the
// Worker URL, so game.js re-fetches in lockstep with the worker (a hard refresh does
// NOT reliably bust a worker's importScripts cache on its own — this does).
// net.js FIRST: game.js resolves BG_NET lazily, but the net brains need it present, and
// it carries the same cache-buster for the same reason game.js does.
importScripts('net.js' + (self.location && self.location.search || ''));
importScripts('game.js' + (self.location && self.location.search || ''));
// The same self-play code the Node trainer runs, so LEARN in the browser and net-train.js
// cannot drift apart. Generation is ~87% of training; only that part comes here.
importScripts('net-selfplay.js' + (self.location && self.location.search || ''));

// A persistent host so the search's internal scratch board (_searchScratch) is
// reused across tasks instead of reallocated each message.
const searchHost = new BackgammonGame();

// netId -> net, installed by the main thread. Lives as long as the worker does; the pool
// is recycled (and the cache with it) whenever the Workers count changes.
const netCache = new Map();

// Put the cached net back into a stripped net brain. Throws rather than guessing: a search
// silently running on the wrong brain is far worse than a job that fails loudly.
function resolveBrain(W) {
  if (!W || W.kind !== 'net') return W;
  if (W.net) return W;
  const net = netCache.get(W.netId);
  if (!net) throw new Error('net "' + W.netId + '" was never installed on this worker');
  return { ...W, net };
}

self.onmessage = function (e) {
  const d = e.data;
  try {
    if (d.cmd === 'install_net') {
      netCache.set(d.netId, d.net);
      return;                       // deliberately no reply — see the header note
    }
    if (d.cmd === 'play_match') {
      // d.seed is DUPLO's per-pair match seed; undefined on ordinary runs, in which
      // case simulateBGMatch's own default (null = Math.random dice) applies.
      const result = simulateBGMatch(resolveBrain(d.wA), resolveBrain(d.wB), d.X, d.depthA, d.depthB, d.seed);
      self.postMessage({ id: d.id, result });
      return;
    }
    if (d.cmd === 'selfplay') {
      // Generate games with a FROZEN copy of the net. All learning stays on the main thread,
      // in game order — the only thing parallelism changes is that a round's games were
      // played by the net as it stood when the round began.
      const net = { spec: d.spec, layers: d.layers, trainedGames: 0 };
      self.postMessage({ id: d.id, games: d.seeds.map((s) => BG_SELFPLAY.playSelfPlayGame(net, s)) });
      return;
    }
    if (d.cmd === 'search') {
      const val = searchHost.expectiRollValue(d.board, d.player, d.dice, d.plies, resolveBrain(d.weights));
      self.postMessage({ id: d.id, val });
      return;
    }
    self.postMessage({ id: d && d.id, error: 'unknown command' });
  } catch (err) {
    self.postMessage({ id: d && d.id, error: (err && err.message) || String(err) });
  }
};
