/**
 * net.js — neural-network brains for Backgammon.  DOM-free, so Node can require it
 * and BackgammonWorker.js can importScripts it, exactly like game.js.
 *
 * ── DECISIONS (settled 8/26, before any code) ────────────────────────────────────
 *  1. MOVER-RELATIVE encoding.  Every position is presented from the point of view of
 *     the side on roll; if that is Red the board is mirrored first.  Colour symmetry is
 *     then a property of the ENCODER, exact to the last bit, rather than something the
 *     network has to learn — and every training game teaches both colours at once.
 *     Consequence: Tesauro's 2 turn-indicator units are constant and therefore omitted,
 *     so the input is 196 wide, not 198.
 *  2. SOFTMAX over SIX mutually exclusive outcomes (my single/gammon/backgammon,
 *     opponent single/gammon/backgammon).  Six units, not five: the redundant degree of
 *     freedom is harmless (softmax is shift-invariant) and keeping all six is what makes
 *     the OUTPUT layer symmetric, which the mirror invariant needs.
 *  3. The CUBE IS NOT AN INPUT.  The net predicts the cubeless outcome distribution;
 *     doubling decisions are computed from those probabilities on top.
 *  4. NO GENETIC ALGORITHM.  Self-play learning replaces it.
 *
 * Since 8/28 this file SHIPS: game.js dispatches to it for net brains, index.html and
 * BackgammonWorker.js load it, and it is in the Makefile copy list and the snapshot set.
 */

// ── Input layout (196) ──────────────────────────────────────────────────────────
//   0.. 95  mover's   24 points x 4 units
//  96..191  opponent's 24 points x 4 units
//     192   mover's checkers on the bar
//     193   opponent's checkers on the bar
//     194   mover's checkers borne off
//     195   opponent's checkers borne off
const NET_INPUTS      = 196;
const POINT_UNITS     = 4;
const SIDE_STRIDE     = 96;
const IDX_BAR_MOVER   = 192;
const IDX_BAR_OPP     = 193;
const IDX_OFF_MOVER   = 194;
const IDX_OFF_OPP     = 195;

// Checker counts on the bar / borne off are unbounded-ish, so they are compressed to a
// tame range rather than fed raw.  Tesauro's original is reported variously as n/2 and
// as sqrt(n); we use sqrt(n), which keeps both inside [0, 3.9] and so sits in the same
// band as the 0/1 indicator units.  One-line change if we ever want to compare.
const compress = (n) => (n > 0 ? Math.sqrt(n) : 0);

/**
 * Mirror a position: swap the colours, reflect point i -> 25-i, swap bar and borne-off.
 * This is the SAME transformation eval-symmetry-test.js has been applying to ~20k
 * positions per run, promoted from test scaffolding to production code.
 */
function mirrorPosition(points, bar, borneOff) {
  const mp = new Array(25);
  mp[0] = { count: 0, player: null };
  for (let p = 1; p <= 24; p++) {
    const src = points[25 - p];
    const player = src && src.count > 0 ? (src.player === 1 ? 2 : 1) : null;
    mp[p] = { count: src ? src.count : 0, player };
  }
  return { points: mp, bar: { 1: bar[2], 2: bar[1] }, borneOff: { 1: borneOff[2], 2: borneOff[1] } };
}

/**
 * Encode a position from the MOVER's point of view.
 *
 * Returns a SPARSE representation — { idx, val, n } — because only ~27 of the 196
 * inputs are ever nonzero (measured: median 28, max 30, since the active count is
 * bounded by the 30 checkers, not by the input width).  Both the forward pass and the
 * first-layer gradient iterate over these, which is ~7x less work than dense.
 *
 * @param {Array}  points   points[1..24], each {count, player}
 * @param {Object} bar      {1: n, 2: n}
 * @param {Object} borneOff {1: n, 2: n}
 * @param {number} mover    1 = White on roll, 2 = Red on roll
 */
function encode(points, bar, borneOff, mover) {
  if (mover === 2) {
    const m = mirrorPosition(points, bar, borneOff);
    points = m.points; bar = m.bar; borneOff = m.borneOff;
  }
  // After normalisation the side on roll is ALWAYS player 1.
  const idx = [], val = [];
  for (let side = 0; side < 2; side++) {
    const owner = side === 0 ? 1 : 2;
    const base  = side * SIDE_STRIDE;
    for (let p = 1; p <= 24; p++) {
      const pt = points[p];
      if (!pt || pt.count === 0 || pt.player !== owner) continue;
      const n = pt.count;
      const b = base + (p - 1) * POINT_UNITS;
      // Truncated unary: "at least 1", "at least 2", "at least 3", then the scaled excess.
      if (n >= 1) { idx.push(b);     val.push(1); }
      if (n >= 2) { idx.push(b + 1); val.push(1); }
      if (n >= 3) { idx.push(b + 2); val.push(1); }
      if (n >  3) { idx.push(b + 3); val.push((n - 3) / 2); }
    }
  }
  if (bar[1]      > 0) { idx.push(IDX_BAR_MOVER); val.push(compress(bar[1])); }
  if (bar[2]      > 0) { idx.push(IDX_BAR_OPP);   val.push(compress(bar[2])); }
  if (borneOff[1] > 0) { idx.push(IDX_OFF_MOVER); val.push(compress(borneOff[1])); }
  if (borneOff[2] > 0) { idx.push(IDX_OFF_OPP);   val.push(compress(borneOff[2])); }
  return { idx, val, n: idx.length };
}

/** Dense view of an encoding — for tests and for hand-checking, never in the hot path. */
function encodeDense(points, bar, borneOff, mover) {
  const x = new Float64Array(NET_INPUTS);
  const s = encode(points, bar, borneOff, mover);
  for (let i = 0; i < s.n; i++) x[s.idx[i]] = s.val[i];
  return x;
}


// ── Outcomes ────────────────────────────────────────────────────────────────────
// The six mutually exclusive ways a game ends, always from the MOVER's point of view.
// Order is fixed everywhere: it is the order of the output units, of the equity vector,
// and of the one-hot training targets.
const OUT_MY_SINGLE = 0, OUT_MY_GAMMON = 1, OUT_MY_BACKGAMMON = 2;
const OUT_OP_SINGLE = 3, OUT_OP_GAMMON = 4, OUT_OP_BACKGAMMON = 5;
const NET_OUTPUTS   = 6;

// Points won for each outcome, from the mover's side. Equity is p . EQUITY_VECTOR —
// a fixed dot product with no free parameters, which is the whole reason for predicting
// probabilities instead of a score.
const EQUITY_VECTOR = [1, 2, 3, -1, -2, -3];

/** Equity in points, from the mover's point of view. */
function equityOf(p) {
  let e = 0;
  for (let k = 0; k < NET_OUTPUTS; k++) e += p[k] * EQUITY_VECTOR[k];
  return e;
}

/**
 * The same distribution seen from the other side of the table.
 * Used by the SEARCH (a child position is the opponent's to move) and by the TD target.
 * NB this is not a symmetry of the network — see the note in net-forward-test.js.
 */
function swapOutcomes(p) {
  return [p[3], p[4], p[5], p[0], p[1], p[2]];
}

/**
 * A finished game's outcome as a one-hot, from `mover`'s point of view. The network is
 * never asked about a terminal position: the answer is known exactly, and feeding it a
 * guess there would train it against its own noise.
 * Returns null if the game is not over.
 */
function terminalOutcome(points, bar, borneOff, mover) {
  const winner = borneOff[1] === 15 ? 1 : borneOff[2] === 15 ? 2 : null;
  if (!winner) return null;
  const loser = winner === 1 ? 2 : 1;
  let kind = 0;                                    // 0 single, 1 gammon, 2 backgammon
  if (borneOff[loser] === 0) {
    kind = 1;
    // Backgammon: the loser still has a checker on the bar or in the winner's home board.
    // Winner 1 bears off from 1-6, so its home is 1-6; winner 2's home is 19-24.
    const lo = winner === 1 ? 1 : 19, hi = winner === 1 ? 6 : 24;
    if (bar[loser] > 0) kind = 2;
    else for (let p = lo; p <= hi; p++) {
      if (points[p] && points[p].count > 0 && points[p].player === loser) { kind = 2; break; }
    }
  }
  const out = [0, 0, 0, 0, 0, 0];
  out[(winner === mover ? 0 : 3) + kind] = 1;
  return out;
}

// ── Activations ─────────────────────────────────────────────────────────────────
// phi is applied to every hidden unit. Leaky ReLU is the default deliberately: the
// depth dial must measure DEPTH, and a saturating phi would make deep configurations
// fail for reasons that have nothing to do with backgammon.
const ACTIVATIONS = {
  lrelu: { f: (z) => (z > 0 ? z : 0.01 * z), df: (z) => (z > 0 ? 1 : 0.01), heGain: 2 },
  relu:  { f: (z) => (z > 0 ? z : 0),        df: (z) => (z > 0 ? 1 : 0),    heGain: 2 },
  tanh:  { f: (z) => Math.tanh(z),           df: (z) => 1 - Math.tanh(z) ** 2, heGain: 1 },
  // Included for fidelity: TD-Gammon used a logistic sigmoid. NB tanh(z) = 2*sigmoid(2z) - 1,
  // so a sigmoid net and a tanh net represent the SAME function class — the difference is
  // only parametrisation and gradient scale (sigmoid' peaks at 1/4 against tanh's 1, so it
  // passes gradients four times more weakly per layer).
  sigmoid: { f: (z) => 1 / (1 + Math.exp(-z)),
             df: (z) => { const s = 1 / (1 + Math.exp(-z)); return s * (1 - s); }, heGain: 1 },
  // A CONTROL, not a brain. A composition of affine maps is affine, so an identity network
  // of ANY depth collapses exactly to one 196->6 linear map with softmax — multinomial
  // logistic regression on this encoding. That makes it the clean answer to "how much of the
  // net's strength is the nonlinearity rather than the representation?"; depth is meaningless
  // for it, which is why the UI dims the layer menu when it is chosen.
  identity: { f: (z) => z, df: () => 1, heGain: 1 },
};

// Menu order, and the numeric code each activation gets in a trained net's file name.
const ACTIVATION_ORDER = ['lrelu', 'relu', 'tanh', 'sigmoid', 'identity'];

// Self-contained PRNG (mulberry32), so net.js loads on its own in Node and in the
// worker without depending on game.js having been pulled in first.
function netRng(seed) {
  let a = (seed >>> 0) || 1;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Create a network.
 *
 *   createNet({ hidden: [80], activation: 'lrelu', seed: 1 })
 *
 * `hidden` is a list of layer widths, so [80] is one hidden layer, [80,40] is two —
 * the depth and width dials, in one place.
 *
 * ⚠️ INITIALISATION IS SCALED BY THE ACTIVE INPUT COUNT, NOT THE INPUT WIDTH. The
 * textbook He rule uses 1/fan_in, which assumes every input carries signal; ours are
 * ~86% zero (measured: median 28 of 196 active), so 1/196 would start every hidden unit
 * in the near-linear region doing nothing, and the net would crawl for a long time
 * before anything happened. We use the expected number of ACTIVE inputs instead.
 */
const EXPECTED_ACTIVE_INPUTS = 27;   // measured over 6,745 real self-play positions

function createNet(spec = {}) {
  const hidden     = spec.hidden || [80];
  const activation = spec.activation || 'lrelu';
  if (!ACTIVATIONS[activation]) throw new Error('unknown activation: ' + activation);
  const rng   = netRng(spec.seed === undefined ? 1 : spec.seed);
  // Box-Muller, so the initial weights are Gaussian rather than uniform.
  const gauss = () => {
    const u = Math.max(rng(), 1e-12), v = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  const sizes  = [NET_INPUTS, ...hidden, NET_OUTPUTS];
  const gain   = ACTIVATIONS[activation].heGain;
  const layers = [];
  for (let l = 0; l < sizes.length - 1; l++) {
    const nIn = sizes[l], nOut = sizes[l + 1];
    const isFirst = (l === 0), isLast = (l === sizes.length - 2);
    const fanIn = isFirst ? EXPECTED_ACTIVE_INPUTS : nIn;
    // Small output weights: leaky ReLU is unbounded, and large early logits saturate the
    // softmax (every probability pinned at 0 or 1, gradient stuck at +-1) so the net wastes
    // its first thousands of games unlearning confidence it had no reason to have.
    const sd = Math.sqrt(gain / fanIn) * (isLast ? 0.1 : 1);
    const W = new Float64Array(nOut * nIn);
    for (let i = 0; i < W.length; i++) W[i] = gauss() * sd;
    layers.push({ nIn, nOut, W, b: new Float64Array(nOut) });
  }
  return { spec: { hidden: [...hidden], activation, seed: spec.seed === undefined ? 1 : spec.seed },
           layers, trainedGames: 0 };
}

/** Total number of learnable parameters (weights + biases). */
function netParamCount(net) {
  return net.layers.reduce((a, L) => a + L.W.length + L.b.length, 0);
}

/** Numerically safe softmax: shift by the max, which softmax is invariant to. */
function softmaxInto(z) {
  let m = -Infinity;
  for (let i = 0; i < z.length; i++) if (z[i] > m) m = z[i];
  let s = 0;
  for (let i = 0; i < z.length; i++) { z[i] = Math.exp(z[i] - m); s += z[i]; }
  for (let i = 0; i < z.length; i++) z[i] /= s;
  return z;
}

/**
 * Forward pass from a SPARSE encoding.
 *
 * The first layer iterates over the ~27 active inputs rather than all 196 — the same
 * saving the backward pass gets, and the reason a wider input encoding costs memory
 * rather than milliseconds. Returns { p, z, a } — the probabilities plus the cached
 * pre-activations and activations, which backprop needs (phi'(z), not just a).
 */
function forwardSparse(net, sparse) {
  const zs = [], as = [];
  const phi = ACTIVATIONS[net.spec.activation].f;
  let input = null;
  for (let l = 0; l < net.layers.length; l++) {
    const L = net.layers[l];
    const z = new Float64Array(L.nOut);
    z.set(L.b);
    if (l === 0) {
      for (let k = 0; k < sparse.n; k++) {
        const col = sparse.idx[k], v = sparse.val[k];
        if (v === 1) { for (let j = 0; j < L.nOut; j++) z[j] += L.W[j * L.nIn + col]; }
        else         { for (let j = 0; j < L.nOut; j++) z[j] += L.W[j * L.nIn + col] * v; }
      }
    } else {
      for (let j = 0; j < L.nOut; j++) {
        const row = j * L.nIn;
        let acc = z[j];
        for (let i = 0; i < L.nIn; i++) acc += L.W[row + i] * input[i];
        z[j] = acc;
      }
    }
    zs.push(z);
    if (l === net.layers.length - 1) { as.push(softmaxInto(Float64Array.from(z))); }
    else { const a = new Float64Array(L.nOut); for (let j = 0; j < L.nOut; j++) a[j] = phi(z[j]); as.push(a); input = a; }
  }
  return { p: as[as.length - 1], z: zs, a: as };
}

/**
 * Evaluate a position for the side on roll. Returns the outcome distribution and the
 * equity in points, both from THAT side's point of view. A finished game is answered
 * exactly rather than by the network.
 */
function evaluatePosition(net, points, bar, borneOff, mover) {
  const term = terminalOutcome(points, bar, borneOff, mover);
  if (term) return { p: term, equity: equityOf(term), terminal: true };
  const p = forwardSparse(net, encode(points, bar, borneOff, mover)).p;
  return { p, equity: equityOf(p), terminal: false };
}

// ── Learning ────────────────────────────────────────────────────────────────────
// Two things get conflated in descriptions of "training", so they are kept apart here:
// WHERE THE TARGET COMES FROM (Monte-Carlo outcome, or the swapped next estimate — see
// the training loop) is a separate question from HOW THE WEIGHTS MOVE, which is all that
// lives below and is nothing but the chain rule.

/** Cross-entropy between a target distribution and the network's output. */
function lossCrossEntropy(p, target) {
  let L = 0;
  for (let k = 0; k < NET_OUTPUTS; k++) {
    if (target[k] > 0) L -= target[k] * Math.log(p[k] < 1e-300 ? 1e-300 : p[k]);
  }
  return L;
}

/** A zeroed gradient buffer shaped like the network. */
function createGrads(net) {
  return net.layers.map((L) => ({ dW: new Float64Array(L.W.length), db: new Float64Array(L.b.length) }));
}

function zeroGrads(grads) {
  for (const g of grads) { g.dW.fill(0); g.db.fill(0); }
}

/**
 * Backpropagation. ACCUMULATES into `grads` (so a whole game can be summed before a
 * single update, or applied per move for online learning).
 *
 * The output layer's error is simply p - target. That is not a simplification: pairing
 * softmax with cross-entropy makes the gradient with respect to the LOGITS exactly the
 * predicted-minus-actual difference, with no quotient rule and nothing that can blow up.
 *
 * The first layer's gradient is nonzero only in the ~27 ACTIVE input columns, so the
 * backward pass through the largest matrix touches those columns and no others — the
 * same saving the forward pass gets, for the same reason.
 *
 * `scale` multiplies the error (used by TD to weight a step).
 */
function backward(net, fwd, sparse, target, grads, scale = 1) {
  const df = ACTIVATIONS[net.spec.activation].df;
  const nL = net.layers.length;
  let delta = new Float64Array(NET_OUTPUTS);
  for (let k = 0; k < NET_OUTPUTS; k++) delta[k] = (fwd.p[k] - target[k]) * scale;

  for (let l = nL - 1; l >= 0; l--) {
    const L = net.layers[l], G = grads[l];
    const aPrev = l === 0 ? null : fwd.a[l - 1];
    for (let j = 0; j < L.nOut; j++) {
      const d = delta[j];
      if (d === 0) continue;
      G.db[j] += d;
      const row = j * L.nIn;
      if (l === 0) {
        for (let k = 0; k < sparse.n; k++) G.dW[row + sparse.idx[k]] += d * sparse.val[k];
      } else {
        for (let i = 0; i < L.nIn; i++) G.dW[row + i] += d * aPrev[i];
      }
    }
    if (l > 0) {
      const next = new Float64Array(L.nIn);
      for (let i = 0; i < L.nIn; i++) {
        let acc = 0;
        for (let j = 0; j < L.nOut; j++) acc += L.W[j * L.nIn + i] * delta[j];
        next[i] = acc * df(fwd.z[l - 1][i]);
      }
      delta = next;
    }
  }
}

/** One gradient-descent step. `scale` divides the accumulated gradient (e.g. a batch size). */
function applyGradients(net, grads, lr, scale = 1) {
  const s = lr / scale;
  for (let l = 0; l < net.layers.length; l++) {
    const L = net.layers[l], G = grads[l];
    for (let i = 0; i < L.W.length; i++) L.W[i] -= s * G.dW[i];
    for (let j = 0; j < L.b.length; j++) L.b[j] -= s * G.db[j];
  }
}

/** Forward, backward and update for one (position, target) pair. Returns the loss BEFORE the step. */
function trainStep(net, sparse, target, lr, grads) {
  const g = grads || createGrads(net);
  if (grads) zeroGrads(g);
  const fwd = forwardSparse(net, sparse);
  const loss = lossCrossEntropy(fwd.p, target);
  backward(net, fwd, sparse, target, g);
  applyGradients(net, g, lr);
  return loss;
}

// -- The cube (Janowski) -------------------------------------------------------
// A net predicts the whole outcome distribution, which is exactly what a real cube
// decision needs — so for a net brain the take point and the doubling point are
// COMPUTED, not tuned. (The linear brains keep DT/AT because a heuristic score has no
// probabilistic meaning: there is no way to derive a take point from "-603 x pip
// difference", so those thresholds had to be free parameters that evolution found.)
//
// Rick Janowski, "Take-Points in Money Games" (1993). Reduce the position to three
// numbers and interpolate between two solvable extremes — a DEAD cube (never used
// again) and a perfectly LIVE one (recubes at exactly the right moment) — with a single
// cube-life index x in [0,1].
//
// ⚠️ This is MONEY-GAME theory. It is a good approximation early in a match and wrong
// near the end, where the correct answer needs a match-equity table. That is a separate
// (already deferred) piece of work; see the Roadmap.
const CUBE_X_CONTACT = 0.7;   // gnubg uses roughly this for contact positions
const CUBE_X_RACE    = 0.6;   // ...and rather less once the armies have separated

/**
 * Janowski's three summary statistics, from the point of view of the side the given
 * distribution describes:
 *   p = probability of winning at all
 *   W = average cubeless value of the games won   (1 single, 2 gammon, 3 backgammon)
 *   L = average cubeless value of the games lost
 * Note p*W - (1-p)*L is exactly equityOf(dist) — a free assertion for any caller.
 * Returns null at p = 0 or 1, where W or L is 0/0 and the cube question is moot anyway.
 */
function cubeStats(dist) {
  const p = dist[0] + dist[1] + dist[2];
  const q = dist[3] + dist[4] + dist[5];
  if (p <= 0 || q <= 0) return null;
  return { p,
           W: (dist[0] + 2 * dist[1] + 3 * dist[2]) / p,
           L: (dist[3] + 2 * dist[4] + 3 * dist[5]) / q };
}

/**
 * The take point: the win probability at which taking and dropping are equal. x = 0
 * gives the dead-cube (L-0.5)/(W+L) — the classic 25% when W = L = 1 — and x = 1 the
 * live-cube 20%. The whole dead-to-live interpolation is that one term.
 */
function takePoint(W, L, x) { return (L - 0.5) / (W + L + 0.5 * x); }

/**
 * Cubeful equity PER UNIT OF CUBE VALUE, by who owns the cube ('me' = the side this p
 * belongs to, 'opp', or 'centre'). Owning the cube is worth exactly 0.5x; a centred cube
 * splits it, with the 4/(4-x) factor normalising.
 * Verified against W = L = 1, x = 1: centre(0.5) = 0, centre(0.8) = +1, centre(0.2) = -1.
 */
function cubefulEquity(p, W, L, x, owner) {
  const base = p * (W + L + 0.5 * x) - L;
  if (owner === 'me')  return base;
  if (owner === 'opp') return base - 0.5 * x;
  return (4 / (4 - x)) * (base - 0.25 * x);
}

// -- Loading a saved net -------------------------------------------------------
/**
 * Read a saved net (the JSON saveNet writes) and return a usable one, or throw with a
 * reason a person can act on. This is the net equivalent of ui.js's brainError: the only
 * thing standing between a malformed file and a brain full of NaNs, which would poison
 * every score derived from it and be far harder to notice later than a refused import.
 * Rehydrates the weight arrays into Float64Array — JSON gives plain arrays, and the
 * forward pass runs at every leaf of every search.
 */
function loadNet(obj) {
  const fail = (m) => { throw new Error(m); };
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) fail('that is not a net file');
  if (obj.kind !== 'bgnet') fail('that is not a net file (kind is not "bgnet")');
  const spec = obj.spec;
  if (!spec || typeof spec !== 'object') fail('the net file has no spec');
  if (!ACTIVATIONS[spec.activation]) fail('the net file has an unknown activation "' + spec.activation + '"');
  if (!Array.isArray(obj.layers) || !obj.layers.length) fail('the net file has no layers');
  const layers = obj.layers.map((L, i) => {
    if (!L || !Array.isArray(L.W) || !Array.isArray(L.b)) fail('layer ' + i + ' has no weights');
    if (!Number.isInteger(L.nIn) || !Number.isInteger(L.nOut) || L.nIn <= 0 || L.nOut <= 0) fail('layer ' + i + ' has a bad shape');
    if (L.W.length !== L.nIn * L.nOut) fail('layer ' + i + ' has ' + L.W.length + ' weights, expected ' + (L.nIn * L.nOut));
    if (L.b.length !== L.nOut) fail('layer ' + i + ' has ' + L.b.length + ' biases, expected ' + L.nOut);
    for (let k = 0; k < L.W.length; k++) if (!Number.isFinite(L.W[k])) fail('layer ' + i + ' has a non-finite weight');
    for (let k = 0; k < L.b.length; k++) if (!Number.isFinite(L.b[k])) fail('layer ' + i + ' has a non-finite bias');
    return { nIn: L.nIn, nOut: L.nOut, W: Float64Array.from(L.W), b: Float64Array.from(L.b) };
  });
  if (layers[0].nIn !== NET_INPUTS) fail('the net takes ' + layers[0].nIn + ' inputs; this build encodes ' + NET_INPUTS);
  const last = layers[layers.length - 1];
  if (last.nOut !== NET_OUTPUTS) fail('the net has ' + last.nOut + ' outputs, expected ' + NET_OUTPUTS);
  for (let i = 1; i < layers.length; i++) {
    if (layers[i].nIn !== layers[i - 1].nOut) fail('layers ' + (i - 1) + ' and ' + i + ' do not fit together');
  }
  return { spec: { ...spec }, layers, trainedGames: obj.trainedGames || 0 };
}

/**
 * The systematic name for a net: width x layers x activation x training volume —
 * N80-L1-lrelu-30k, and -lam07 once a file records its lambda. Deliberately NOT a LOTR
 * name: those belong to the hand-tuned and evolved roster, which is small and ordered,
 * whereas nets arrive in dozens and have to be told apart by what they ARE.
 */
function netName(net) {
  const h = (net.spec && net.spec.hidden) || [];
  const games = net.trainedGames || 0;
  const vol = games >= 1000 ? Math.round(games / 1000) + 'k' : String(games);
  const parts = ['N' + (h.length ? h.join('x') : '0'), 'L' + h.length, net.spec.activation, vol];
  if (net.spec.lambda !== undefined) parts.push('lam' + String(net.spec.lambda).replace('.', ''));
  return parts.join('-');
}

// -- Exports -------------------------------------------------------------------
// One namespace object, exported both ways: BG_NET as a global for the browser and the
// worker (net.js is a classic script, loaded before game.js), and module.exports for
// Node. One list, so the two cannot drift.
const BG_NET = { encode, encodeDense, mirrorPosition,
                 createNet, forwardSparse, evaluatePosition, netParamCount,
                 equityOf, swapOutcomes, terminalOutcome, softmaxInto,
                 lossCrossEntropy, createGrads, zeroGrads, backward, applyGradients, trainStep,
                 loadNet, netName,
                 cubeStats, takePoint, cubefulEquity, CUBE_X_CONTACT, CUBE_X_RACE,
                 ACTIVATION_ORDER,
                 ACTIVATIONS, EQUITY_VECTOR, EXPECTED_ACTIVE_INPUTS,
                 NET_INPUTS, NET_OUTPUTS, SIDE_STRIDE, POINT_UNITS,
                 IDX_BAR_MOVER, IDX_BAR_OPP, IDX_OFF_MOVER, IDX_OFF_OPP };

if (typeof globalThis !== 'undefined') globalThis.BG_NET = BG_NET;
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') module.exports = BG_NET;
