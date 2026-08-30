/**
 * net-selfplay.js — self-play generation and TD(lambda) learning, in ONE place.
 *
 * Host-agnostic for the same reason BackgammonWorker.js importScripts game.js instead of
 * duplicating the engine: training now has three callers — the serial trainer, Node
 * worker_threads, and the browser's LEARN button — and the learning rule must not exist in
 * three copies that can drift apart.
 *
 * DOM-free. Node requires it; a worker importScripts it after game.js and net.js.
 *
 * ⚠️ DICE ARE SEEDED HERE. Self-play used to draw from Math.random, which made a run
 * unreproducible and made "did going parallel change anything?" unanswerable — the whole
 * point of the equivalence test is that the same seeds give the same games, so the only
 * remaining difference between serial and parallel is how stale the generating net is.
 */

let _bg, _net;
function bgLib() {
  if (_bg === undefined) {
    _bg = (typeof BackgammonGame !== 'undefined') ? { BackgammonGame, makeBGRng, bgGameSeed }
        : (typeof require === 'function' ? require('./game.js') : null);
  }
  if (!_bg) throw new Error('game.js is not loaded');
  return _bg;
}
function netLib() {
  if (_net === undefined) {
    _net = (typeof BG_NET !== 'undefined' && BG_NET) ? BG_NET
         : (typeof require === 'function' ? require('./net.js') : null);
  }
  if (!_net) throw new Error('net.js is not loaded');
  return _net;
}

/**
 * Depth 1 in this project's numbering: apply each legal complete turn, evaluate the result,
 * take the best. (The literature calls this 0-ply — see AIs.html.) The resulting position is
 * the OPPONENT's to move, so the net's equity there is the opponent's; ours is its negative.
 */
function bestStateByNet(g, net, player) {
  const NET = netLib();
  const states = g.generateAllCompleteTurnMoves(player, g.movesLeft);
  if (!states.length) return null;
  const opp = player === 1 ? 2 : 1;
  let best = null, bestEq = -Infinity;
  for (const st of states) {
    const term = NET.terminalOutcome(st.points, st.bar, st.borneOff, player);
    const eq = term ? NET.equityOf(term)
                    : -NET.evaluatePosition(net, st.points, st.bar, st.borneOff, opp).equity;
    if (eq > bestEq) { bestEq = eq; best = st; }
  }
  return best;
}

/**
 * One cubeless self-play game. Returns the trace of positions to train on, plus the outcome
 * as a one-hot from WHITE's point of view. A position is recorded when a side is ABOUT TO
 * ROLL, which is exactly the situation the net is asked about when a search reaches a leaf.
 */
function playSelfPlayGame(net, seed) {
  const BG = bgLib(), NET = netLib();
  const G = BG.BackgammonGame || BG;
  const g = new G();
  if (seed !== undefined && seed !== null) g.rng = BG.makeBGRng(seed);
  g.playerTypes[1] = 'ai'; g.playerTypes[2] = 'ai';
  g.rollForFirstTurn();
  const trace = [{ sparse: NET.encode(g.points, g.bar, g.borneOff, g.currentPlayer), mover: g.currentPlayer }];
  let guard = 0;
  while (!g.winner && guard++ < 100000) {
    const st = bestStateByNet(g, net, g.currentPlayer);
    if (st) for (const m of st.moves) g.makeMove(m.from, m.to, false);
    if (g.winner) break;
    g.endTurn();
    trace.push({ sparse: NET.encode(g.points, g.bar, g.borneOff, g.currentPlayer), mover: g.currentPlayer });
    g.rollDice();
  }
  const whiteView = NET.terminalOutcome(g.points, g.bar, g.borneOff, 1);
  // The movers MUST alternate: every turn ends with endTurn(), including a turn with no legal
  // move. The TD target depends on it (position t+1 is the OPPONENT's to move, so its
  // distribution has to be swapped), and getting it wrong trains the net against its own
  // mirror image — no crash, no NaN, just a permanent mediocre plateau. So assert it.
  for (let i = 1; i < trace.length; i++) {
    if (trace[i].mover === trace[i - 1].mover) throw new Error('movers did not alternate at step ' + i);
  }
  return { trace, whiteView, turns: trace.length };
}

/**
 * Learn from ONE finished game: walk the trace backwards, form the lambda-return target at
 * each position, and take a gradient step per position — in game order, exactly as the
 * original serial trainer did. Returns the statistics the caller aggregates for reporting.
 *
 *  MC (lambda = 1): every position carries the SAME label, the outcome that happened. Simple
 *      and unbiased, but it hands the net ~60 perfectly correlated targets per game, which is
 *      what forced the learning rate down and stalled the 8/28 run.
 *  TD (lambda = 0): a position's target is its SUCCESSOR's estimate. Since the successor is
 *      the OPPONENT's to move, that estimate must be SWAPPED into this position's frame. Only
 *      the last position gets ground truth; walking backwards propagates it the length of the
 *      game in one sweep instead of one step per visit.
 */
function learnFromGame(net, grads, played, lam, lr) {
  const NET = netLib();
  const { trace, whiteView } = played;
  const last = trace.length - 1;
  let G = null;                       // the lambda-return at t+1, in the SUCCESSOR's frame
  let lossSum = 0, n = 0, pwinSum = 0, pwinSq = 0;
  for (let t = last; t >= 0; t--) {
    const step = trace[t];
    let target;
    if (t === last) {
      target = step.mover === 1 ? whiteView : NET.swapOutcomes(whiteView);
    } else {
      // G_t = swap( (1-lam)*V(s_t+1) + lam*G_t+1 ). Both terms are in the SUCCESSOR's frame,
      // so they blend directly and the swap into this position's frame happens once, at the end.
      const v = NET.forwardSparse(net, trace[t + 1].sparse).p;
      const blend = new Array(6);
      for (let k = 0; k < 6; k++) blend[k] = (1 - lam) * v[k] + lam * G[k];
      target = NET.swapOutcomes(blend);
    }
    const fwd = NET.forwardSparse(net, step.sparse);
    lossSum += NET.lossCrossEntropy(fwd.p, target); n++;
    const pw = fwd.p[0] + fwd.p[1] + fwd.p[2];
    pwinSum += pw; pwinSq += pw * pw;
    NET.zeroGrads(grads);
    NET.backward(net, fwd, step.sparse, target, grads);
    NET.applyGradients(net, grads, lr);
    G = target;                       // now the lambda-return at t, in THIS position's frame
  }
  return { lossSum, n, pwinSum, pwinSq, turns: trace.length };
}

/** The seed for game `i` of a run — the same derivation DUPLO uses for a match's games. */
function gameSeed(runSeed, i) { return bgLib().bgGameSeed(runSeed, i); }

const BG_SELFPLAY = { bestStateByNet, playSelfPlayGame, learnFromGame, gameSeed };
if (typeof globalThis !== 'undefined') globalThis.BG_SELFPLAY = BG_SELFPLAY;
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') module.exports = BG_SELFPLAY;
