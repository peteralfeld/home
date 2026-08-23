/**
 * Backgammon Game Engine
 * Manages game state, turn flow, and rule validation.
 */

/**
 * Default AI "personality" — the baseline weight vector.
 * White's-view static score = sum of w_i * (feature(White) - feature(Red)),
 * except the collapsed blot terms which are already computed from White's view.
 * Weights are integers normalized so max|w| = 1000.
 *
 *   PC  normalized pip count            (term w*pip/20)        -80
 *   BO  checkers borne off              (term w*(boW-boR)/15) +500
 *   EC1 rolls allowing exactly one move (term w*EC1/36)       -133
 *   EC0 rolls allowing no move          (term w*EC0/36)       -400
 *   HB  home-board points made (standing)                     +133
 *   AN  anchors, gated on being behind in the race            +200
 *   DO/IO/DP/IP  collapsed blot threat-vs-exposure features   +1000/600/500/300
 *   DE  disengagement bonus (move-selection only, not static) +667
 *   F0..F5  freedom/containment: checkers by escape-count 0..5 -1000..-200
 *           (past-the-front-of-the-wall; F6 free = no weight; replaced PH)
 */
// Alphabetical names are kept in descending order of tournament performance:
// Arwen = strongest ... Hamfast = weakest. Re-sorted after each evolution. Origin
// is the fixed historic baseline and is listed last (bottom of the player menus).
// Weights normalized to max|w| = 1000 over the 22 eval weights; DT/AT (doubling
// thresholds, same score units) travel inline with each brain. NOTE: the PC weights
// here go with the /20 pip divisor in evaluate() (rescaled from the old /167 — same
// play, just a saner band for the number).
const AI_PERSONALITIES = {
  // Named brains kept in performance order (Arwen strongest ... Hamfast weakest); re-sort
  // after each tournament. Origin is the fixed historic baseline and never changes.
  Arwen: { PC: -603, BO: 1000, EC1: -70, EC0: -970, HB: 29, AN: -68, DO: 10, IO: 10, DP: 290, IP: 59, DE: 4, F0: -16, F1: -19, F2: -20, F3: -6, F4: -7, F5: -1, BE: 8, G5: 291, G7: 13, G4: 38, GA: -47, DT: 308, AT: 735 },  // 1st
  Bilbo: { PC: -435, BO: 633, EC1: -62, EC0: -1000, HB: 28, AN: -46, DO: 6, IO: 11, DP: 205, IP: 60, DE: 3, F0: -13, F1: -14, F2: -21, F3: -9, F4: -5, F5: -1, BE: 9, G5: 228, G7: 6, G4: 31, GA: -41, DT: 241, AT: 836 },  // 2nd
  Celebrian: { PC: -412, BO: 738, EC1: -60, EC0: -1000, HB: 23, AN: -41, DO: 6, IO: 10, DP: 168, IP: 58, DE: 3, F0: -11, F1: -12, F2: -19, F3: -8, F4: -4, F5: -1, BE: 7, G5: 190, G7: 6, G4: 25, GA: -33, DT: 236, AT: 686 },  // 3rd
  Dwalin: { PC: -778, BO: 834, EC1: -184, EC0: -1000, HB: 66, AN: -32, DO: 18, IO: 9, DP: 373, IP: 22, DE: 4, F0: -13, F1: -13, F2: -22, F3: -3, F4: -10, F5: -2, BE: 10, G5: 382, G7: 17, G4: 26, GA: -43, DT: 400, AT: 999 },  // 4th
  Eowyn: { PC: -433, BO: 22, EC1: -140, EC0: -1000, HB: 66, AN: -19, DO: 19, IO: 12, DP: 267, IP: 32, DE: 4, F0: -8, F1: -15, F2: -22, F3: -6, F4: -8, F5: -2, BE: 7, G5: 181, G7: 21, G4: 30, GA: -80, DT: 330, AT: 588 },  // 5th
  Frodo: { PC: -903, BO: 32, EC1: -153, EC0: -1000, HB: 58, AN: -47, DO: 18, IO: 13, DP: 469, IP: 46, DE: 6, F0: -8, F1: -16, F2: -25, F3: -12, F4: -10, F5: -6, BE: 16, G5: 281, G7: 18, G4: 44, GA: -61, DT: 398, AT: 1009 },  // 6th
  Galadriel: { PC: -1000, BO: 492, EC1: -118, EC0: -771, HB: 27, AN: -46, DO: 9, IO: 13, DP: 298, IP: 45, DE: 4, F0: -7, F1: -8, F2: -25, F3: -6, F4: -9, F5: -2, BE: 11, G5: 227, G7: 12, G4: 23, GA: -52, DT: 322, AT: 716 },  // 7th
  Hamfast: { PC: -978, BO: 351, EC1: -117, EC0: -1000, HB: 268, AN: -3, DO: 9, IO: 4, DP: 347, IP: 25, DE: 67, F0: -73, F1: -57, F2: -7, F3: -20, F4: -21, F5: -4, BE: 14, G5: 277, G7: 105, G4: 39, GA: -9, DT: 220, AT: 857 },  // 8th
  Origin:    { PC: -80,  BO: 500,  EC1: -133, EC0: -400, HB: 133, AN: 200, DO: 1000, IO: 600,  DP: 500,  IP: 300, DE: 667,  F0: 0,    F1: 0,    F2: 0,    F3: 0,    F4: 0,    F5: 0,    BE: 0,   G5: 133, G7: 0, G4: 133, GA: 200, DT: 100, AT: 200  }
};

// The baseline AI. Each personality is normalized so max|w| = 1000.
const DEFAULT_WEIGHTS = AI_PERSONALITIES.Origin;

// Immutable snapshot of the built-in roster, for the "Def" (reset) action.
const BUILTIN_PERSONALITIES = JSON.parse(JSON.stringify(AI_PERSONALITIES));

// --- Lookahead (expectimax) support -------------------------------------------
// The 21 distinct dice rolls with their multiplicities out of 36: a non-double
// (i<j) happens two ways (weight 2), a double one way (weight 1). Weights sum to
// 36, so a chance-node expectation is Σ weightᵢ·valueᵢ / 36. Used to average over
// the opponent's (and our own future) rolls in the search tree.
const BG_DICE_DIST = (() => {
  const rolls = [];
  for (let i = 1; i <= 6; i++) {
    for (let j = i; j <= 6; j++) {
      rolls.push([i, j, i === j ? 1 : 2]);
    }
  }
  return rolls;              // 21 entries, Σ weight = 36
})();

// A terminal (all 15 borne off) is worth more than any static score, so the
// search always prefers a real win/loss to any heuristic position. White-view:
// +BG_WIN if White has won, -BG_WIN if Red has won.
const BG_WIN = 1e9;

class BackgammonGame {
  constructor() {
    this.restart();
    // Plies of lookahead for the AI (1 = one-ply static, today's baseline). Set by
    // the UI / tournament / evolution; getBestAIMove() falls back to this field.
    this.searchDepth = 1;
  }

  restart() {
    // Board representation: points 1 to 24.
    // Index 0 is unused (or represents Player 1's borne off home zone).
    // Each point: { player: 1 | 2 | null, count: number }
    this.points = Array(25).fill(null).map(() => ({ player: null, count: 0 }));

    // Standard initial setup
    // Player 1 (White) moves counter-clockwise: 24 -> 1
    // Player 2 (Red) moves clockwise: 1 -> 24
    
    // Player 1 setup
    this.points[24] = { player: 1, count: 2 };
    this.points[13] = { player: 1, count: 5 };
    this.points[8]  = { player: 1, count: 3 };
    this.points[6]  = { player: 1, count: 5 };

    // Player 2 setup
    this.points[1]  = { player: 2, count: 2 };
    this.points[12] = { player: 2, count: 5 };
    this.points[17] = { player: 2, count: 3 };
    this.points[19] = { player: 2, count: 5 };

    // Bar state (hit checkers waiting to re-enter)
    this.bar = {
      1: 0, // Player 1 checkers on bar
      2: 0  // Player 2 checkers on bar
    };

    // Borne off state (checkers taken off board)
    this.borneOff = {
      1: 0,
      2: 0
    };

    this.currentPlayer = null; // Decided by initial roll or starts with 1
    this.dice = [0, 0];
    this.movesLeft = []; // Remaining die values for the current turn
    this.hasRolled = false;
    this.winner = null;
    // Set when the game ends because a doubling offer was declined; forces the win
    // to score as a single (cube value), not a gammon/backgammon.
    this.winByDecline = false;

    // Doubling cube state
    this.doublingCubeValue = 1;
    this.doublingCubeOwner = null; // null means either player can double, 1 = P1, 2 = P2

    // Player types configuration (human or ai)
    this.playerTypes = {
      1: 'human',
      2: 'human'
    };

    // AI weight personalities — one vector per player (like human players, each
    // AI evaluates with its own weights). Both default to the baseline AI.
    this.aiWeights = { 1: { ...AI_PERSONALITIES.Origin }, 2: { ...AI_PERSONALITIES.Origin } };
    // Which AI personality each player is using (when playerTypes[p] === 'ai').
    this.aiNames = { 1: 'Origin', 2: 'Origin' };

    // History stack for supporting Undo functionality
    // Stores deep copies of game state at each sub-move during the turn.
    this.turnHistory = [];

    // Global game history for time travel and logs
    this.gameHistory = [];
    this.playedMovesThisTurn = [];
    this.turnCount = 0;

    // Replay state: pre-recorded dice for deterministic replay after time travel.
    // Populated by restoreGameSnapshot(); consumed one entry per rollDice() call.
    this.futureRolls = [];
    this.futureRollIndex = 0;
  }

  /**
   * Board-setup helpers for the setup/analysis mode. They reset the board and turn
   * state ONLY — player types, AI seat selections (aiWeights/aiNames) and cube are
   * left to the caller-facing reset below, so the user's White/Red picks survive.
   */
  _setupResetTurn() {
    this.currentPlayer = null;
    this.dice = [0, 0];
    this.movesLeft = [];
    this.hasRolled = false;
    this.winner = null;
    this.winByDecline = false;
    this.doublingCubeValue = 1;
    this.doublingCubeOwner = null;
    this.turnHistory = [];
    this.gameHistory = [];
    this.playedMovesThisTurn = [];
    this.turnCount = 0;
    this.futureRolls = [];
    this.futureRollIndex = 0;
  }

  // CLEAR: empty board, all 30 checkers parked on the two borne-off trays.
  // CLEAR: board empty, all 15 of each colour sitting on its own BAR (White bar = point 25,
  // Red bar = point 0). Trays empty. So a game can be started straight from here with every
  // checker entering from the bar.
  setupClear() {
    this.points = Array(25).fill(null).map(() => ({ player: null, count: 0 }));
    this.bar = { 1: 15, 2: 15 };
    this.borneOff = { 1: 0, 2: 0 };
    this._setupResetTurn();
  }

  // INITIAL: the standard opening position (empty trays), same stacks as restart().
  setupInitial() {
    this.points = Array(25).fill(null).map(() => ({ player: null, count: 0 }));
    this.points[24] = { player: 1, count: 2 };
    this.points[13] = { player: 1, count: 5 };
    this.points[8]  = { player: 1, count: 3 };
    this.points[6]  = { player: 1, count: 5 };
    this.points[1]  = { player: 2, count: 2 };
    this.points[12] = { player: 2, count: 5 };
    this.points[17] = { player: 2, count: 3 };
    this.points[19] = { player: 2, count: 5 };
    this.bar = { 1: 0, 2: 0 };
    this.borneOff = { 1: 0, 2: 0 };
    this._setupResetTurn();
  }

  /**
   * Rank every legal complete turn for `player` from the CURRENT board with the given
   * `dice`, scored with `weights` at `depth` plies (the same currency getBestAIMove
   * uses, incl. the root-only DE bonus). Returns [{ moves, value }] sorted best-for-
   * mover first (White descending, Red ascending). Powers the MOV analysis list.
   */
  rankAIMoves(player, dice, depth, weights) {
    const states = this.generateAllCompleteTurnMoves(player, dice);
    if (states.length === 0) return [];
    const ctx = {
      depth, player, weights,
      opp: player === 1 ? 2 : 1,
      states,
      parentContact: this.hasContact(this.points, this.bar),
    };
    const scored = states.map((s) => ({ moves: s.moves, value: this._scoreRootCandidate(s, ctx) }));
    scored.sort((a, b) => (player === 1 ? b.value - a.value : a.value - b.value));
    return scored;
  }

  /**
   * Decide which player starts. Roll both dice; highest wins.
   * If equal, roll again. Returns the starting player and the rolled dice.
   */

  rollForFirstTurn(forceD1 = null, forceD2 = null) {
    let d1 = forceD1, d2 = forceD2;
    if (d1 === null || d2 === null) {
      do {
        d1 = Math.floor(Math.random() * 6) + 1;
        d2 = Math.floor(Math.random() * 6) + 1;
      } while (d1 === d2);
    }

    this.dice = [d1, d2];
    this.currentPlayer = d1 > d2 ? 1 : 2;
    this.movesLeft = [d1, d2];
    this.hasRolled = true;
    this.turnHistory = [];
    this.saveStateToHistory();

    this.turnCount = 1;

    // Save initial state snapshot for Time Travel (RS button)
    this.gameHistory.push({
      isInitial: true,
      points: JSON.parse(JSON.stringify(this.points)),
      bar: { ...this.bar },
      borneOff: { ...this.borneOff },
      currentPlayer: this.currentPlayer,
      dice: [...this.dice],
      movesLeft: [...this.movesLeft],
      hasRolled: true,
      winner: null,
      doublingCubeValue: this.doublingCubeValue,
      doublingCubeOwner: this.doublingCubeOwner,
      turnCount: 1,
      description: `Start of Game`,
      playedMoves: []
    });

    return { currentPlayer: this.currentPlayer, dice: this.dice };
  }

  /**
   * Begin a fresh game with a PREDETERMINED starter (no roll-off). The board must already
   * be reset via restart(); this sets who is on roll and records the initial "Start of Game"
   * time-travel snapshot, but does NOT roll — the opener rolls next through the normal path
   * (an AI rolls itself, a human auto-rolls if Auto Roll is on, else clicks Roll), a normal
   * roll with doubles allowed. Used by the Restart button to alternate the opener between
   * games (see handleRestartClick in ui.js).
   */
  beginGameWithStarter(starter) {
    this.currentPlayer = starter;
    this.dice = [0, 0];
    this.movesLeft = [];
    this.hasRolled = false;
    this.turnHistory = [];
    this.turnCount = 1;
    this.gameHistory = [];
    this.gameHistory.push({
      isInitial: true,
      points: JSON.parse(JSON.stringify(this.points)),
      bar: { ...this.bar },
      borneOff: { ...this.borneOff },
      currentPlayer: this.currentPlayer,
      dice: [0, 0],
      movesLeft: [],
      hasRolled: false,
      winner: null,
      doublingCubeValue: this.doublingCubeValue,
      doublingCubeOwner: this.doublingCubeOwner,
      turnCount: 1,
      description: `Start of Game`,
      playedMoves: []
    });
    return { currentPlayer: this.currentPlayer };
  }

/**
 * Roll dice for standard turn.
 */
rollDice(d1 = null, d2 = null) {
  // 1. If we have already rolled and no manual dice are provided, exit.
  if (this.hasRolled && d1 === null) return null;

  // 2. Determine dice values (either provided or random)
  const roll1 = d1 !== null ? d1 : Math.floor(Math.random() * 6) + 1;
  const roll2 = d2 !== null ? d2 : Math.floor(Math.random() * 6) + 1;
  
  // 3. Update game state
  this.dice = [roll1, roll2];
  this.hasRolled = true;
  
  if (roll1 === roll2) {
    // Doubles get 4 moves of that value
    this.movesLeft = [roll1, roll1, roll1, roll1];
  } else {
    this.movesLeft = [roll1, roll2];
  }

  this.turnHistory = [];
  this.saveStateToHistory(); // Save the initial state of the turn for undos

  this.turnCount++;

  return {
    dice: this.dice,
    movesLeft: [...this.movesLeft]
  };
}
    
  /**
   * Deep copy of important state properties for undo.
   */
  saveStateToHistory() {
    const stateCopy = {
      points: JSON.parse(JSON.stringify(this.points)),
      bar: { ...this.bar },
      borneOff: { ...this.borneOff },
      movesLeft: [...this.movesLeft]
    };
    this.turnHistory.push(stateCopy);
  }

  /**
   * Save a full snapshot of the game state for the history timeline (Time Travel).
   */
  saveGameSnapshot(description) {
    const snapshot = {
      points: JSON.parse(JSON.stringify(this.points)),
      bar: { ...this.bar },
      borneOff: { ...this.borneOff },
      currentPlayer: this.currentPlayer,
      dice: [...this.dice],
      movesLeft: [...this.movesLeft],
      hasRolled: this.hasRolled,
      winner: this.winner,
      doublingCubeValue: this.doublingCubeValue,
      doublingCubeOwner: this.doublingCubeOwner,
      turnCount: this.turnCount,
      description: description,
      playedMoves: [...this.playedMovesThisTurn]
    };
    this.gameHistory.push(snapshot);
  }

  /**
   * Restore a full snapshot from the history timeline and truncate subsequent history.
   */
  restoreGameSnapshot(index) {
    if (index < 0 || index >= this.gameHistory.length) return false;
    const snapshot = this.gameHistory[index];
    
    this.points = JSON.parse(JSON.stringify(snapshot.points));
    this.bar = { ...snapshot.bar };
    this.borneOff = { ...snapshot.borneOff };
    
    if (snapshot.isInitial) {
      // The initial snapshot represents the state *before* the first move.
      // We restore the exact player and dice.
      this.currentPlayer = snapshot.currentPlayer;
      this.dice = [...snapshot.dice];
      this.movesLeft = [...snapshot.movesLeft];
      this.hasRolled = snapshot.hasRolled;
      this.turnCount = snapshot.turnCount;
    } else {
      // Standard snapshots represent the state AFTER a player's moves.
      // So the next active player is the opponent.
      this.currentPlayer = snapshot.currentPlayer === 1 ? 2 : 1;
      this.dice = [0, 0];
      this.movesLeft = [];
      this.hasRolled = false;
      this.turnCount = snapshot.turnCount + 1;
    }
    
    this.winner = snapshot.winner;
    this.doublingCubeValue = snapshot.doublingCubeValue;
    this.doublingCubeOwner = snapshot.doublingCubeOwner;

    // Capture the dice sequence of all future turns so they can be replayed
    // deterministically. Moves remain the player's free choice. Each entry is TAGGED with
    // the player who rolled it, and only REAL rolls are kept — the doubling-accept snapshots
    // carry [0,0] dice (and don't alternate players), so including them would shift the whole
    // sequence by one turn and hand each side the other side's dice. Filtering + the player
    // tag (checked at consume time) makes that misalignment impossible.
    this.futureRolls = this.gameHistory.slice(index + 1)
      .filter(s => !s.isInitial && s.dice[0] && s.dice[1])
      .map(s => ({ p: s.currentPlayer, d: [s.dice[0], s.dice[1]] }));
    this.futureRollIndex = 0;

    // Truncate game history to this point (future turns will be re-written)
    this.gameHistory = this.gameHistory.slice(0, index + 1);
    
    // Reset turn-based history stack for undo support in the restored turn
    this.turnHistory = [];
    this.playedMovesThisTurn = [];
    this.saveStateToHistory();

    return true;
  }

  /**
   * Revert to the last saved state in the history stack.
   */
  undo() {
    if (this.turnHistory.length <= 1) return false; // Nothing to undo (only initial state left)
    
    this.turnHistory.pop(); // Pop the current state
    const prevState = this.turnHistory[this.turnHistory.length - 1]; // Peak previous state
    
    // Restore state
    this.points = JSON.parse(JSON.stringify(prevState.points));
    this.bar = { ...prevState.bar };
    this.borneOff = { ...prevState.borneOff };
    this.movesLeft = [...prevState.movesLeft];
    
    // Remove last move from active snapshot's playedMoves
    if (this.playedMovesThisTurn.length > 0) {
      this.playedMovesThisTurn.pop();
    }
    
    return true;
  }

  /**
   * Checks if player has any checkers on the bar.
   */
  hasCheckersOnBar(player) {
    return this.bar[player] > 0;
  }

  /**
   * Check if all checkers of a player are in their home board.
   * Player 1 home: points 1 to 6.
   * Player 2 home: points 19 to 24.
   */
  canBearOff(player) {
    if (this.hasCheckersOnBar(player)) return false;

    // Check points outside the home board
    if (player === 1) {
      // White moves 24 -> 1. Home is 1-6. Outside is 7-24.
      for (let i = 7; i <= 24; i++) {
        if (this.points[i].player === 1) return false;
      }
    } else {
      // Red moves 1 -> 24. Home is 19-24. Outside is 1-18.
      for (let i = 1; i <= 18; i++) {
        if (this.points[i].player === 2) return false;
      }
    }

    return true;
  }

  /**
   * Check if P1 or P2 has won.
   */
  checkWinner() {
    if (this.borneOff[1] === 15) {
      this.winner = 1;
    } else if (this.borneOff[2] === 15) {
      this.winner = 2;
    }
    return this.winner;
  }

  /**
   * Raw, per-die legal destinations from a starting point — each die is checked on
   * its own, WITHOUT the maximum-usage rule. Used internally for move execution and
   * as the candidate set that getLegalDestinations() filters.
   * fromPoint can be:
   * - A number 1 to 24
   * - "bar" (or represented internally as 25 for P1, 0 for P2)
   */
  getRawDestinations(fromPoint) {
    if (!this.hasRolled || this.movesLeft.length === 0) return [];
    
    const player = this.currentPlayer;
    const destinations = [];
    const isFromBar = fromPoint === "bar";

    // 1. Verify checker ownership at source
    if (isFromBar) {
      if (this.bar[player] === 0) return [];
    } else {
      const pIdx = parseInt(fromPoint);
      if (this.points[pIdx].player !== player) return [];
      // If we have checkers on bar, we MUST move them first!
      if (this.hasCheckersOnBar(player)) return [];
    }

    // Use unique move values from movesLeft to prevent duplicate calculations
    const uniqueDice = [...new Set(this.movesLeft)];

    for (const die of uniqueDice) {
      let target = null;

      if (player === 1) {
        // Player 1 (White) moves down (24 -> 1)
        if (isFromBar) {
          // Re-enter P2's home board: point 25 - die
          target = 25 - die;
        } else {
          target = parseInt(fromPoint) - die;
        }
      } else {
        // Player 2 (Red) moves up (1 -> 24)
        if (isFromBar) {
          // Re-enter P1's home board: point die
          target = die;
        } else {
          target = parseInt(fromPoint) + die;
        }
      }

      // Validate target point on board
      if (target >= 1 && target <= 24) {
        const destPoint = this.points[target];
        // Point is open if it belongs to current player, is empty, or is an opponent blot (1 checker)
        if (destPoint.player === null || destPoint.player === player || destPoint.count === 1) {
          destinations.push({
            to: target,
            dieUsed: die,
            isHit: destPoint.player !== null && destPoint.player !== player
          });
        }
      }
      // Validate bearing off
      else if (this.canBearOff(player)) {
        if (player === 1 && target <= 0) {
          // Player 1 bears off (target <= 0)
          const pIdx = parseInt(fromPoint);
          
          // Exact match
          if (pIdx === die) {
            destinations.push({ to: "off", dieUsed: die, isHit: false });
          } 
          // Die value is higher than the checker point.
          // This is only legal if there are no checkers on higher points in home board.
          else if (die > pIdx) {
            let hasCheckerHigher = false;
            for (let i = pIdx + 1; i <= 6; i++) {
              if (this.points[i].player === 1) {
                hasCheckerHigher = true;
                break;
              }
            }
            if (!hasCheckerHigher) {
              destinations.push({ to: "off", dieUsed: die, isHit: false });
            }
          }
        } 
        else if (player === 2 && target >= 25) {
          // Player 2 bears off (target >= 25)
          const pIdx = parseInt(fromPoint);
          const dist = 25 - pIdx;

          // Exact match
          if (dist === die) {
            destinations.push({ to: "off", dieUsed: die, isHit: false });
          }
          // Die value is higher than distance.
          // Only legal if no checkers on points further back (lower numbers).
          else if (die > dist) {
            let hasCheckerFurther = false;
            for (let i = 19; i < pIdx; i++) {
              if (this.points[i].player === 2) {
                hasCheckerFurther = true;
                break;
              }
            }
            if (!hasCheckerFurther) {
              destinations.push({ to: "off", dieUsed: die, isHit: false });
            }
          }
        }
      }
    }

    return destinations;
  }

  /**
   * The set of legal FIRST steps of the turn, as "from|to|die" keys, taken from the
   * maximum-usage complete-turn sequences. Encodes every rule: use both dice when
   * possible, play the higher die when only one can be used, and (for doubles) play
   * as many as possible.
   */
  // Board-state-only clone for exploring hypothetical moves.
  _cloneForSearch() {
    const g = new BackgammonGame();
    g.points = JSON.parse(JSON.stringify(this.points));
    g.bar = { ...this.bar };
    g.borneOff = { ...this.borneOff };
    g.movesLeft = [...this.movesLeft];
    g.dice = [...this.dice];
    g.hasRolled = this.hasRolled;
    g.currentPlayer = this.currentPlayer;
    g.winner = this.winner;
    return g;
  }

  _legalFirstSteps() {
    const player = this.currentPlayer;
    const rootSeqs = this._maxUsageSequences(player, this.movesLeft);
    if (rootSeqs.length === 0) return new Set();
    const maxDice = this.movesLeft.length - rootSeqs[0].diceLeftCount;   // most dice usable

    const sources = this.hasCheckersOnBar(player)
      ? ['bar']
      : Array.from({ length: 24 }, (_, k) => k + 1).filter((i) => this.points[i].player === player);

    // A first move is legal iff, after playing it, the player can still use maxDice-1
    // more dice. (Trial-based, because the memoised search records only one move order
    // per resulting position and would hide equivalent first moves.)
    const set = new Set();
    for (const src of sources) {
      for (const d of this.getRawDestinations(src)) {
        const clone = this._cloneForSearch();
        clone.makeMove(src, d.to, false);
        const sub = clone._maxUsageSequences(player, clone.movesLeft);
        const afterMax = clone.movesLeft.length - (sub.length ? sub[0].diceLeftCount : clone.movesLeft.length);
        if (1 + afterMax === maxDice) set.add(`${src}|${d.to}|${d.dieUsed}`);
      }
    }

    // "If only one die can be played, it must be the higher one."
    if (maxDice === 1 && this.movesLeft.length === 2 && this.movesLeft[0] !== this.movesLeft[1]) {
      const larger = Math.max(this.movesLeft[0], this.movesLeft[1]);
      const usesLarger = [...set].some((k) => k.endsWith('|' + larger));
      if (usesLarger) for (const k of [...set]) if (!k.endsWith('|' + larger)) set.delete(k);
    }
    return set;
  }

  /**
   * Legal destinations from a point WITH the maximum-usage rule applied: only moves
   * that can begin a turn using the greatest possible number of dice. This is what the
   * UI highlights and what a human's move is validated against.
   */
  getLegalDestinations(fromPoint) {
    const raw = this.getRawDestinations(fromPoint);
    if (raw.length === 0) return raw;
    const allowed = this._legalFirstSteps();
    const fromKey = fromPoint === "bar" ? "bar" : String(parseInt(fromPoint));
    return raw.filter((d) => allowed.has(`${fromKey}|${d.to}|${d.dieUsed}`));
  }

  /**
   * When a move is individually legal but disallowed by the maximum-usage rule, this
   * returns a short human-readable reason for the instruction line (else null).
   */
  maxUsageMessage() {
    const total = this.movesLeft.length;
    if (!this.hasRolled || total === 0) return null;
    const states = this._maxUsageSequences(this.currentPlayer, this.movesLeft);
    if (states.length === 0) return null;
    const minLeft = Math.min(...states.map((s) => s.diceLeftCount));
    const used = total - minLeft;
    if (used === 0) return null;
    const isDouble = total > 2 || this.movesLeft[0] === this.movesLeft[1];
    if (used >= total) {
      return isDouble
        ? "You must play all your dice — choose a move that keeps the rest playable."
        : "You must play both dice — this move would waste one. Try a different move, or play the dice in the other order.";
    }
    if (!isDouble && used === 1) {
      const larger = Math.max(this.movesLeft[0], this.movesLeft[1]);
      const firstDice = states.filter((s) => s.moves.length).map((s) => s.moves[0].dieUsed);
      if (firstDice.length && firstDice.every((d) => d === larger)) {
        return `Only one die can be played, so you must play the higher one (${larger}).`;
      }
      return "Only one die can be played this turn.";
    }
    return `You must play as many dice as you can (${used} of ${total}).`;
  }

  /**
   * Execute a move from -> to.
   * validateMax=true (default) enforces the maximum-usage rule (human/UI moves);
   * pass false for callers that already supply a legal max-usage sequence (AI
   * simulation), to avoid a redundant full-turn search per move.
   * Returns true if successful, false otherwise.
   */
  makeMove(from, to, validateMax = true) {
    const player = this.currentPlayer;
    const destinations = validateMax ? this.getLegalDestinations(from) : this.getRawDestinations(from);
    
    // Find matching destination in legal moves
    const targetMove = destinations.find(d => d.to === to);
    if (!targetMove) return false; // Illegal move

    const { dieUsed, isHit } = targetMove;

    // 1. Remove checker from source
    if (from === "bar") {
      this.bar[player]--;
    } else {
      const fromIdx = parseInt(from);
      this.points[fromIdx].count--;
      if (this.points[fromIdx].count === 0) {
        this.points[fromIdx].player = null;
      }
    }

    // 2. Put checker in destination
    if (to === "off") {
      this.borneOff[player]++;
    } else {
      const toIdx = parseInt(to);
      const destPoint = this.points[toIdx];

      if (isHit) {
        // Opponent blot hit!
        const opponent = player === 1 ? 2 : 1;
        this.bar[opponent]++;
        destPoint.player = player;
        destPoint.count = 1; // replaces opponent's checker
      } else {
        // Normal move
        destPoint.player = player;
        destPoint.count++;
      }
    }

    // 3. Remove die from remaining moves list
    const dieIndex = this.movesLeft.indexOf(dieUsed);
    if (dieIndex > -1) {
      this.movesLeft.splice(dieIndex, 1);
    }

    // 4. Save state to history for undoing
    this.saveStateToHistory();

    // 5. Check if game is won
    this.checkWinner();

    // Record this move to the playedMoves list for the current turn
    this.playedMovesThisTurn.push({ from, to, isHit });

    return true;
  }

  /**
   * Force end turn. Switch player and reset dice.
   */
  endTurn() {
    // Save completed turn snapshot before state advancing
    if (this.currentPlayer !== null) {
      let description = "";
      if (this.turnCount === 1) {
        const winnerColor = this.currentPlayer === 1 ? "White" : "Red";
        description = `Start: P1 rolled ${this.dice[0]}, P2 rolled ${this.dice[1]}. ${winnerColor} starts.`;
      } else {
        const playerColor = this.currentPlayer === 1 ? "White" : "Red";
        description = `Turn ${this.turnCount} (${playerColor}): Rolled ${this.dice[0]}, ${this.dice[1]}`;
      }
      this.saveGameSnapshot(description);
    }

    this.currentPlayer = this.currentPlayer === 1 ? 2 : 1;
    this.dice = [0, 0];
    this.movesLeft = [];
    this.hasRolled = false;
    this.turnHistory = [];
    this.playedMovesThisTurn = [];
  }

  /**
   * Determines if the player has any legal moves left.
   * Useful to auto-end turn if blocked (no moves possible).
   */
  hasLegalMoves() {
    if (!this.hasRolled || this.movesLeft.length === 0) return false;
    if (this.winner) return false;
    const states = this.generateAllCompleteTurnMoves(this.currentPlayer, this.movesLeft);
    return states.some((s) => s.moves.length > 0);
  }

  // True iff `player` can legally play at least one checker for SOME die value (1..6) from the
  // CURRENT board — i.e. the player is not permanently stuck (independent of what's actually
  // rolled). Non-destructive (the generator deep-copies before mutating). Used to detect a total
  // deadlock where NEITHER side can ever move — possible only in a hand-set-up position, where it
  // would otherwise leave both players rolling forever.
  hasAnyLegalMove(player) {
    for (let d = 1; d <= 6; d++) {
      const states = this.generateAllCompleteTurnMoves(player, [d]);
      if (states.some((s) => s.moves.length > 0)) return true;
    }
    return false;
  }

  /**
   * Check if the given player is allowed to double the stakes.
   */
  canDouble(player) {
    if (this.winner) return false;
    if (this.currentPlayer !== player) return false;
    if (this.hasRolled) return false;
    if (this.doublingCubeOwner !== null && this.doublingCubeOwner !== player) return false;
    return true;
  }

  /**
   * Action of accepting a doubling offer.
   * Multiplier doubles and opponent becomes the owner of the cube.
   */
  acceptDouble() {
    this.doublingCubeValue *= 2;
    const opponent = this.currentPlayer === 1 ? 2 : 1;
    this.doublingCubeOwner = opponent;

    const proposerName = this.currentPlayer === 1 ? "White" : "Red";
    this.saveGameSnapshot(`${proposerName} offered double. Accepted (${this.doublingCubeValue}x).`);
  }

  /**
   * Action of declining a doubling offer. Proposing player wins.
   */
  declineDouble() {
    this.winner = this.currentPlayer;
    // A declined double always scores a plain single for the current cube value —
    // never a gammon/backgammon, even though the loser has borne off nothing and
    // still has checkers all over the board. Flag it so scoring skips the multiplier.
    this.winByDecline = true;
  }

  /** Names of all available AI personalities (used to populate the player menus). */
  aiPersonalityNames() {
    return Object.keys(AI_PERSONALITIES);
  }

  /** The weight vector for a named personality (falls back to Origin). */
  personalityWeights(name) {
    return AI_PERSONALITIES[name] || AI_PERSONALITIES.Origin;
  }

  /** Set one weight of a personality (used by the parameter editor). */
  setPersonalityWeight(name, key, value) {
    if (AI_PERSONALITIES[name]) AI_PERSONALITIES[name][key] = value;
  }

  /** Add or update personalities from an imported array of { name, weights }.
   *  Existing personalities not in the file are kept (merge, not replace). */
  importPersonalities(arr) {
    if (!Array.isArray(arr)) return;
    arr.forEach((p) => {
      if (p && p.name && p.weights) {
        // Merge over Origin so any missing keys still get sensible values.
        AI_PERSONALITIES[p.name] = { ...BUILTIN_PERSONALITIES.Origin, ...p.weights };
      }
    });
  }

  /** Restore the built-in roster ("Def"). */
  resetPersonalities() {
    Object.keys(AI_PERSONALITIES).forEach((k) => delete AI_PERSONALITIES[k]);
    Object.keys(BUILTIN_PERSONALITIES).forEach((k) => { AI_PERSONALITIES[k] = { ...BUILTIN_PERSONALITIES[k] }; });
  }

  /** Assign an AI personality (by name) to a player. */
  setPlayerAI(player, name) {
    const w = AI_PERSONALITIES[name] || AI_PERSONALITIES.Origin;
    this.aiWeights[player] = { ...w };
    this.aiNames[player] = AI_PERSONALITIES[name] ? name : 'Origin';
    this.playerTypes[player] = 'ai';
  }

  /** Pip count for a player on a given (points, bar) state. */
  pipCountP(points, bar, p) {
    let pips = bar[p] * 25;
    for (let i = 1; i <= 24; i++) {
      if (points[i].player === p) pips += points[i].count * (p === 1 ? i : (25 - i));
    }
    return pips;
  }

  /** Can player p bear off in this state (all checkers home, none on bar)? */
  canBearOffState(points, bar, p) {
    if (bar[p] > 0) return false;
    if (p === 1) { for (let i = 7; i <= 24; i++) if (points[i].player === 1) return false; }
    else { for (let i = 1; i <= 18; i++) if (points[i].player === 2) return false; }
    return true;
  }

  /** All legal single-die moves for player p using one die value. */
  legalSingleMoves(points, bar, p, die) {
    const opp = p === 1 ? 2 : 1;
    const moves = [];
    const blocked = (pt) => points[pt].player === opp && points[pt].count >= 2;
    if (bar[p] > 0) {
      const entry = p === 1 ? 25 - die : die;
      if (entry >= 1 && entry <= 24 && !blocked(entry)) moves.push({ from: 'bar', to: entry });
      return moves;
    }
    const canOff = this.canBearOffState(points, bar, p);
    for (let i = 1; i <= 24; i++) {
      if (points[i].player !== p) continue;
      const target = p === 1 ? i - die : i + die;
      if (target >= 1 && target <= 24) {
        if (!blocked(target)) moves.push({ from: i, to: target });
      } else if (canOff) {
        if (p === 1 && target <= 0) {
          if (i === die) moves.push({ from: i, to: 'off' });
          else if (die > i) { let hi = false; for (let k = i + 1; k <= 6; k++) if (points[k].player === 1) { hi = true; break; } if (!hi) moves.push({ from: i, to: 'off' }); }
        } else if (p === 2 && target >= 25) {
          const dist = 25 - i;
          if (dist === die) moves.push({ from: i, to: 'off' });
          else if (die > dist) { let fu = false; for (let k = 19; k < i; k++) if (points[k].player === 2) { fu = true; break; } if (!fu) moves.push({ from: i, to: 'off' }); }
        }
      }
    }
    return moves;
  }

  /** Maximum number of dice player p can legally consume from a roll. */
  maxDiceUsable(points, bar, p, dice) {
    if (dice.length === 0) return 0;
    let best = 0;
    const opp = p === 1 ? 2 : 1;
    const uniq = [...new Set(dice)];
    for (const die of uniq) {
      const moves = this.legalSingleMoves(points, bar, p, die);
      for (const m of moves) {
        const np = points.map(pt => ({ player: pt.player, count: pt.count }));
        const nb = { 1: bar[1], 2: bar[2] };
        if (m.from === 'bar') nb[p]--;
        else { np[m.from].count--; if (np[m.from].count === 0) np[m.from].player = null; }
        if (m.to !== 'off') {
          const d = np[m.to];
          if (d.player === opp && d.count === 1) { nb[opp]++; d.player = p; d.count = 1; }
          else { d.player = p; d.count++; }
        }
        const nd = dice.slice(); nd.splice(nd.indexOf(die), 1);
        const used = 1 + this.maxDiceUsable(np, nb, p, nd);
        if (used > best) best = used;
        if (best === dice.length) return best;
      }
    }
    return best;
  }

  /** Encumbrance: over the 36 rolls, how many give p exactly 0 / exactly 1 usable die. */
  computeEC(points, bar, p) {
    let ec0 = 0, ec1 = 0;
    for (let d1 = 1; d1 <= 6; d1++) {
      for (let d2 = d1; d2 <= 6; d2++) {
        const mult = (d1 === d2) ? 1 : 2;
        const dice = (d1 === d2) ? [d1, d1, d1, d1] : [d1, d2];
        const usable = this.maxDiceUsable(points, bar, p, dice);
        if (usable === 0) ec0 += mult;
        else if (usable === 1) ec1 += mult;
      }
    }
    return { ec0, ec1 };
  }

  /** Points made (2+) in p's own home board. */
  homeBoardPoints(points, p) {
    const lo = p === 1 ? 1 : 19, hi = p === 1 ? 6 : 24;
    let c = 0; for (let i = lo; i <= hi; i++) if (points[i].player === p && points[i].count >= 2) c++;
    return c;
  }

  /** Anchors: points made (2+) in the opponent's home board. */
  anchorsP(points, p) {
    const lo = p === 1 ? 19 : 1, hi = p === 1 ? 24 : 6;
    let c = 0; for (let i = lo; i <= hi; i++) if (points[i].player === p && points[i].count >= 2) c++;
    return c;
  }

  /**
   * Is player `p`'s OWNER-RELATIVE n-point made (2+)? Owner-relative so it stays colour-
   * antisymmetric: White's n-point is board point n; Red's n-point is board point 25−n.
   * Used by the golden-point weights (G5/G7/G4 = owner's 5/bar/4-point; GA = owner's
   * 20-point = the opponent's 5-point, the golden anchor). Returns 1 or 0.
   */
  madeOwnerPoint(points, n, p) {
    const idx = p === 1 ? n : 25 - n;
    return (points[idx].player === p && points[idx].count >= 2) ? 1 : 0;
  }

  /**
   * Can `hitter` hit the blot at point b, directly (single die) and/or indirectly
   * (combined two+ dice with a legal intermediate landing)? Returns {direct, indirect}.
   * Simplification: when the hitter has a checker on the bar, only bar-entry hits and
   * single-checker enter-then-move hits are counted (a conservative under-count).
   */
  hitThreat(points, bar, hitter, b) {
    const owner = hitter === 1 ? 2 : 1;
    const blocked = (pt) => pt >= 1 && pt <= 24 && points[pt].player === owner && points[pt].count >= 2;
    const src = (dist) => hitter === 1 ? b + dist : b - dist;
    const occ = (pt) => pt >= 1 && pt <= 24 && points[pt].player === hitter;
    let direct = false, indirect = false;

    if (bar[hitter] > 0) {
      for (let d = 1; d <= 6; d++) { const e = hitter === 1 ? 25 - d : d; if (e === b) direct = true; }
      for (let d1 = 1; d1 <= 6 && !indirect; d1++) {
        const e = hitter === 1 ? 25 - d1 : d1;
        if (e >= 1 && e <= 24 && !blocked(e)) {
          for (let d2 = 1; d2 <= 6; d2++) { const cont = hitter === 1 ? e - d2 : e + d2; if (cont === b) { indirect = true; break; } }
        }
      }
      return { direct, indirect };
    }

    for (let d = 1; d <= 6; d++) if (occ(src(d))) { direct = true; break; }

    for (let a = 1; a <= 6 && !indirect; a++) {
      for (let c = a + 1; c <= 6; c++) {
        if (occ(src(a + c))) {
          const i1 = src(a), i2 = src(c);
          const open1 = i1 >= 1 && i1 <= 24 && !blocked(i1);
          const open2 = i2 >= 1 && i2 <= 24 && !blocked(i2);
          if (open1 || open2) { indirect = true; break; }
        }
      }
    }
    for (let d = 1; d <= 6 && !indirect; d++) {
      if (occ(src(2 * d)) && !blocked(src(d))) { indirect = true; break; }
      if (occ(src(3 * d)) && !blocked(src(d)) && !blocked(src(2 * d))) { indirect = true; break; }
      if (occ(src(4 * d)) && !blocked(src(d)) && !blocked(src(2 * d)) && !blocked(src(3 * d))) { indirect = true; break; }
    }
    return { direct, indirect };
  }

  /**
   * Collapsed blot term (White's view). Each blot is exposure for its owner and a
   * threat for the other side — the same event — so the 8 original X/T features
   * reduce to 4. A blot in its owner's own half is "near" (DP/IP); in the opponent's
   * half it is "far" (DO/IO). White hitting a Red blot is +; a White blot exposed is -.
   */
  blotContribution(points, bar, weights) {
    let s = 0;
    for (let i = 1; i <= 24; i++) {
      if (points[i].player === null || points[i].count !== 1) continue;
      const owner = points[i].player;
      const hitter = owner === 1 ? 2 : 1;
      const nearLo = owner === 1 ? 1 : 13, nearHi = owner === 1 ? 12 : 24;
      const near = i >= nearLo && i <= nearHi;
      const { direct, indirect } = this.hitThreat(points, bar, hitter, i);
      const sign = hitter === 1 ? 1 : -1;
      if (near) {
        if (direct) s += sign * weights.DP;
        if (indirect) s += sign * weights.IP;
      } else {
        if (direct) s += sign * weights.DO;
        if (indirect) s += sign * weights.IO;
      }
    }
    return s;
  }

  // Crossover count for `me`: how many quadrant boundaries all of me's checkers must still cross
  // to reach the home board (bar = 4 ... farthest quadrant = 3 ... home board = 0). Minimizing it
  // means rushing every checker toward home; used as a disengaged-race move-selection tie-break
  // (gammon/backgammon save), NOT part of the static score.
  crossoverCount(points, bar, me) {
    let c = 0;
    if (me === 1) {                       // White home = 1-6
      c += bar[1] * 4;
      for (let p = 7; p <= 24; p++) if (points[p].player === 1) c += points[p].count * Math.ceil((p - 6) / 6);
    } else {                              // Red home = 19-24
      c += bar[2] * 4;
      for (let p = 1; p <= 18; p++) if (points[p].player === 2) c += points[p].count * Math.ceil((19 - p) / 6);
    }
    return c;
  }

  // Pips still to travel before every checker is HOME, counted only for checkers OUTSIDE the home
  // board: White  Σ_{p>6} count·(p−6),  Red  Σ_{p<19} count·(19−p), bar = 19 either way. This is the
  // finer-grained successor to crossoverCount as the disengaged-race tie-break. crossoverCount is
  // quantized to quadrants, so it is flat for any move that does not step across a 6-point boundary
  // — e.g. 12/10 12/11 leaves three checkers in the 7-12 quadrant and scores the same as shuffling
  // 2/1 3/1 inside the home board, which is exactly the gammon-losing behaviour the tie-break was
  // meant to prevent. This measure moves on EVERY pip of real progress toward home and is unchanged
  // by any move inside the home board, so "bear a checker in" always outranks "shuffle at home".
  // 0 once all 15 are home. Max value 15·19 = 285, so eps·285 = 0.285 « 0.5 (see the tie-break).
  homeDistancePips(points, bar, me) {
    let d = 0;
    if (me === 1) {                       // White home = 1-6; bar = 25, i.e. 19 pips from home
      d += bar[1] * 19;
      for (let p = 7; p <= 24; p++) if (points[p].player === 1) d += points[p].count * (p - 6);
    } else {                              // Red home = 19-24; bar = 0, i.e. 19 pips from home
      d += bar[2] * 19;
      for (let p = 1; p <= 18; p++) if (points[p].player === 2) d += points[p].count * (19 - p);
    }
    return d;
  }

  /** True while the two sides can still hit each other (contact); false in a pure race. */
  hasContact(points, bar) {
    let wmax = bar[1] > 0 ? 25 : -1;
    if (wmax < 0) for (let i = 24; i >= 1; i--) if (points[i].player === 1) { wmax = i; break; }
    let rmin = bar[2] > 0 ? 0 : 26;
    if (rmin > 25) for (let i = 1; i <= 24; i++) if (points[i].player === 2) { rmin = i; break; }
    if (wmax < 0 || rmin > 25) return false;
    return wmax > rmin;
  }

  /**
   * Static board evaluation from White's view (positive = good for White),
   * as an integer. White maximizes, Red minimizes. `weights` is the evaluating
   * agent's own personality vector.
   */
  evaluate(points, bar, borneOff, weights) {
    let score = 0;

    // PC — normalized pip count (w negative: fewer White pips is better). Divisor 20
    // (was 167) is just a representation choice — brain PC weights were rescaled to
    // match, so play is unchanged; it keeps PC's weight in the same band as the others.
    const pipW = this.pipCountP(points, bar, 1), pipR = this.pipCountP(points, bar, 2);
    score += weights.PC * (pipW - pipR) / 20;

    // BO — checkers borne off (w positive: taking checkers off is good). Breaks the
    // pip-count tie between bearing a checker off and stacking it deeper in the home.
    score += weights.BO * (borneOff[1] - borneOff[2]) / 15;

    // EC — encumbrance / mobility
    const ecW = this.computeEC(points, bar, 1), ecR = this.computeEC(points, bar, 2);
    score += weights.EC1 * (ecW.ec1 - ecR.ec1) / 36;
    score += weights.EC0 * (ecW.ec0 - ecR.ec0) / 36;

    // F0-F5 — freedom / containment. Per side, count checkers by how many die-values
    // let them clear the prime in front of them (escapeCountForChecker): F0 = sealed
    // (entombed / closed out) ... F5 = nearly free. F6 (fully free) carries no signal,
    // so it is deliberately NOT a weight. Replaces the old PH prime term with a graded,
    // per-checker, evolvable containment measure.
    const fW = escapeBuckets(points, bar, 1), fR = escapeBuckets(points, bar, 2);
    for (let n = 0; n <= 5; n++) score += (weights['F' + n] || 0) * (fW[n] - fR[n]);

    // Golden points (per-point made-point VALUE, owner-relative, colour-antisymmetric).
    // Some points are worth far more than others: the 5-point (G5), bar/7-point (G7) and
    // 4-point (G4) are the prime-building "golden" points; the golden ANCHOR (GA) is the
    // opponent's 5-point held from the back (owner-20). Each is a separate evolvable weight;
    // HB and AN cover the *remaining* points so nothing is double-counted.
    // Point-structure terms (HB, golden points G5/G7/G4, anchors AN, golden anchor GA) are only
    // meaningful while the two sides can still hit each other. Once DISENGAGED (a pure race) a made
    // point blocks nobody and an anchor traps nobody, so these all drop to 0 — otherwise the AI
    // would keep shuffling/holding home-board points instead of racing its back checkers home
    // (which is what saves the gammon/backgammon). Blots and the F-prime terms already self-zero
    // in a race; this makes the remaining positional terms do the same. Colour-antisymmetric,
    // since hasContact() is a symmetric 0/1 scalar on antisymmetric difference terms.
    if (this.hasContact(points, bar)) {
      const md = (n, p) => this.madeOwnerPoint(points, n, p);

      // HB — home-board points made, EXCLUDING the golden home points (4,5): owner {1,2,3,6}.
      const hbW = this.homeBoardPoints(points, 1) - md(4, 1) - md(5, 1);
      const hbR = this.homeBoardPoints(points, 2) - md(4, 2) - md(5, 2);
      score += weights.HB * (hbW - hbR);

      // Golden offensive points: 5-point, bar point (7), 4-point.
      score += (weights.G5 || 0) * (md(5, 1) - md(5, 2));
      score += (weights.G7 || 0) * (md(7, 1) - md(7, 2));
      score += (weights.G4 || 0) * (md(4, 1) - md(4, 2));

      // AN — anchors (opponent's home), EXCLUDING the golden anchor (owner-20); gated behind.
      const anW = pipW > pipR ? (this.anchorsP(points, 1) - md(20, 1)) : 0;
      const anR = pipR > pipW ? (this.anchorsP(points, 2) - md(20, 2)) : 0;
      score += weights.AN * (anW - anR);

      // GA — golden anchor (the opponent's 5-point, owner-20); same behind-gate as AN.
      const gaW = pipW > pipR ? md(20, 1) : 0;
      const gaR = pipR > pipW ? md(20, 2) : 0;
      score += (weights.GA || 0) * (gaW - gaR);
    }

    // Blots — collapsed threat/exposure, already from White's view
    score += this.blotContribution(points, bar, weights);

    // BE — bar entombment. A checker on the bar freezes the whole army until it enters, so
    // it is worse than the same escape-count checker on a point. Price it at BE per expected
    // FROZEN TURN (barFreezeTurns): fixed durations for F1-F5, and for a sealed bar checker
    // (F0) the live "how long can the opponent hold his closed board" = (oppPip - 42)/8. Each
    // side's F0 reads the OPPONENT's pip count (he holds the sealing board), which keeps the
    // term colour-antisymmetric. A White bar checker hurts White (-), a Red one helps (+).
    const BE = weights.BE || 0;
    if (BE) {
      let wFreeze = 0, rFreeze = 0;
      for (let n = 0; n < bar[1]; n++) wFreeze += barFreezeTurns(escapeCountForChecker(points, 25, 1), pipR);
      for (let n = 0; n < bar[2]; n++) rFreeze += barFreezeTurns(escapeCountForChecker(points, 0, 2), pipW);
      score += BE * (rFreeze - wFreeze);
    }

    // Round half AWAY FROM ZERO (not JS's default half-to-+Infinity), so the score is
    // exactly colour-antisymmetric: evaluate(mirror) === -evaluate(original).
    return score < 0 ? -Math.round(-score) : Math.round(score);
  }

  /**
   * Same computation as evaluate(), but returns a per-feature breakdown for the
   * Board Value report. Each row: { code, meaning, white, red, v, weight, term }
   * where term = weight * v and the sum of terms is the White-view score.
   */
  evaluateBreakdown(points, bar, borneOff, weights) {
    const rows = [];

    const pipW = this.pipCountP(points, bar, 1), pipR = this.pipCountP(points, bar, 2);
    rows.push({ code: 'PC', meaning: 'Pip count', white: pipW, red: pipR, v: (pipW - pipR) / 20, weight: weights.PC });

    rows.push({ code: 'BO', meaning: 'Checkers borne off', white: borneOff[1], red: borneOff[2], v: (borneOff[1] - borneOff[2]) / 15, weight: weights.BO });

    const ecW = this.computeEC(points, bar, 1), ecR = this.computeEC(points, bar, 2);
    rows.push({ code: 'EC1', meaning: 'Rolls with one move', white: ecW.ec1, red: ecR.ec1, v: (ecW.ec1 - ecR.ec1) / 36, weight: weights.EC1 });
    rows.push({ code: 'EC0', meaning: 'Rolls with no move', white: ecW.ec0, red: ecR.ec0, v: (ecW.ec0 - ecR.ec0) / 36, weight: weights.EC0 });

    const fW = escapeBuckets(points, bar, 1), fR = escapeBuckets(points, bar, 2);
    for (let n = 0; n <= 5; n++) {
      rows.push({ code: 'F' + n, meaning: `Freedom bucket ${n} (checkers with ${n} escape rolls)`, white: fW[n], red: fR[n], v: (fW[n] - fR[n]), weight: (weights['F' + n] || 0) });
    }

    // Point-structure terms drop to 0 once disengaged (see evaluate()): a symmetric 0/1 gate on
    // their difference value, so the breakdown total keeps matching evaluate() in a pure race.
    const cg = this.hasContact(points, bar) ? 1 : 0;
    const md = (n, p) => this.madeOwnerPoint(points, n, p);
    const hbW = this.homeBoardPoints(points, 1) - md(4, 1) - md(5, 1);
    const hbR = this.homeBoardPoints(points, 2) - md(4, 2) - md(5, 2);
    rows.push({ code: 'HB', meaning: 'Home-board points (excl. 4,5)', white: hbW, red: hbR, v: cg * (hbW - hbR), weight: weights.HB });

    rows.push({ code: 'G5', meaning: 'Golden 5-point made', white: md(5, 1), red: md(5, 2), v: cg * (md(5, 1) - md(5, 2)), weight: (weights.G5 || 0) });
    rows.push({ code: 'G7', meaning: 'Bar point (7) made', white: md(7, 1), red: md(7, 2), v: cg * (md(7, 1) - md(7, 2)), weight: (weights.G7 || 0) });
    rows.push({ code: 'G4', meaning: 'Golden 4-point made', white: md(4, 1), red: md(4, 2), v: cg * (md(4, 1) - md(4, 2)), weight: (weights.G4 || 0) });

    const anW = pipW > pipR ? (this.anchorsP(points, 1) - md(20, 1)) : 0;
    const anR = pipR > pipW ? (this.anchorsP(points, 2) - md(20, 2)) : 0;
    rows.push({ code: 'AN', meaning: 'Anchors excl. golden (if behind)', white: anW, red: anR, v: cg * (anW - anR), weight: weights.AN });

    const gaW = pipW > pipR ? md(20, 1) : 0;
    const gaR = pipR > pipW ? md(20, 2) : 0;
    rows.push({ code: 'GA', meaning: 'Golden anchor (opp 5-pt, if behind)', white: gaW, red: gaR, v: cg * (gaW - gaR), weight: (weights.GA || 0) });

    // Blots collapsed to DO/IO/DP/IP; white = White blots at risk, red = Red blots at risk.
    const blot = { DO: { w: 0, r: 0 }, IO: { w: 0, r: 0 }, DP: { w: 0, r: 0 }, IP: { w: 0, r: 0 } };
    for (let i = 1; i <= 24; i++) {
      if (points[i].player === null || points[i].count !== 1) continue;
      const owner = points[i].player, hitter = owner === 1 ? 2 : 1;
      const nearLo = owner === 1 ? 1 : 13, nearHi = owner === 1 ? 12 : 24;
      const near = i >= nearLo && i <= nearHi;
      const { direct, indirect } = this.hitThreat(points, bar, hitter, i);
      const dirKey = near ? 'DP' : 'DO', indKey = near ? 'IP' : 'IO';
      if (direct) { owner === 1 ? blot[dirKey].w++ : blot[dirKey].r++; }
      if (indirect) { owner === 1 ? blot[indKey].w++ : blot[indKey].r++; }
    }
    [['DO', 'Direct hit, far board'], ['IO', 'Indirect hit, far board'],
     ['DP', 'Direct hit, near board'], ['IP', 'Indirect hit, near board']].forEach(([code, meaning]) => {
      const b = blot[code];
      // term is + when Red is more exposed than White (good for White)
      rows.push({ code, meaning, white: b.w, red: b.r, v: (b.r - b.w), weight: weights[code] });
    });

    // BE — bar entombment: expected frozen turns per side (F0 reads opponent pip). v = red - white.
    let wFreeze = 0, rFreeze = 0;
    for (let n = 0; n < bar[1]; n++) wFreeze += barFreezeTurns(escapeCountForChecker(points, 25, 1), pipR);
    for (let n = 0; n < bar[2]; n++) rFreeze += barFreezeTurns(escapeCountForChecker(points, 0, 2), pipW);
    rows.push({ code: 'BE', meaning: 'Bar entombment (frozen turns)', white: wFreeze, red: rFreeze, v: (rFreeze - wFreeze), weight: (weights.BE || 0) });

    let score = 0;
    rows.forEach((row) => { row.term = row.weight * row.v; score += row.term; });

    // Match evaluate(): round half away from zero for colour antisymmetry.
    const rounded = score < 0 ? -Math.round(-score) : Math.round(score);
    return { rows, score: rounded, contact: this.hasContact(points, bar), pipW, pipR };
  }

  /**
   * Generates all unique final board positions reachable by executing legal moves for the current dice.
   * Backgammon rules require you to play the maximum number of dice possible.
   * If you can play only one of the dice, you must play the larger one (if both are separately playable).
   */
  _maxUsageSequences(player, diceRolls) {
    const finalStates = [];
    const visitedStates = new Set();

    const serializeState = (points, bar, borneOff) => {
      const pStr = points.map(p => `${p.count}:${p.player || 0}`).join(',');
      return `${pStr}|${bar[1]}:${bar[2]}|${borneOff[1]}:${borneOff[2]}`;
    };

    const search = (currentPoints, currentBar, currentBorneOff, currentDice, moveSequence) => {
      const stateKey = serializeState(currentPoints, currentBar, currentBorneOff);
      if (visitedStates.has(stateKey + '|' + currentDice.join(','))) {
        return;
      }
      visitedStates.add(stateKey + '|' + currentDice.join(','));

      const uniqueDice = [...new Set(currentDice)];
      let branchExpanded = false;

      const hasBar = currentBar[player] > 0;
      const canBearOff = (() => {
        if (hasBar) return false;
        if (player === 1) {
          for (let i = 7; i <= 24; i++) {
            if (currentPoints[i].player === 1) return false;
          }
        } else {
          for (let i = 1; i <= 18; i++) {
            if (currentPoints[i].player === 2) return false;
          }
        }
        return true;
      })();

      const sources = [];
      if (hasBar) {
        sources.push("bar");
      } else {
        for (let i = 1; i <= 24; i++) {
          if (currentPoints[i].player === player) {
            sources.push(i);
          }
        }
      }

      for (const from of sources) {
        for (const die of uniqueDice) {
          let target = null;
          if (player === 1) {
            target = (from === "bar") ? (25 - die) : (from - die);
          } else {
            target = (from === "bar") ? die : (from + die);
          }

          let isValid = false;
          let targetLabel = target;
          let isHit = false;

          if (target >= 1 && target <= 24) {
            const dest = currentPoints[target];
            if (dest.player === null || dest.player === player || dest.count === 1) {
              isValid = true;
              isHit = dest.player !== null && dest.player !== player;
            }
          } 
          else if (canBearOff) {
            if (player === 1 && target <= 0) {
              if (from === die) {
                isValid = true;
                targetLabel = "off";
              } else if (die > from) {
                let hasHigher = false;
                for (let i = from + 1; i <= 6; i++) {
                  if (currentPoints[i].player === 1) { hasHigher = true; break; }
                }
                if (!hasHigher) {
                  isValid = true;
                  targetLabel = "off";
                }
              }
            } else if (player === 2 && target >= 25) {
              const dist = 25 - from;
              if (dist === die) {
                isValid = true;
                targetLabel = "off";
              } else if (die > dist) {
                let hasFurther = false;
                for (let i = 19; i < from; i++) {
                  if (currentPoints[i].player === 2) { hasFurther = true; break; }
                }
                if (!hasFurther) {
                  isValid = true;
                  targetLabel = "off";
                }
              }
            }
          }

          if (isValid) {
            branchExpanded = true;
            
            const nextPoints = JSON.parse(JSON.stringify(currentPoints));
            const nextBar = { ...currentBar };
            const nextBorneOff = { ...currentBorneOff };

            if (from === "bar") {
              nextBar[player]--;
            } else {
              nextPoints[from].count--;
              if (nextPoints[from].count === 0) nextPoints[from].player = null;
            }

            if (targetLabel === "off") {
              nextBorneOff[player]++;
            } else {
              const dest = nextPoints[targetLabel];
              if (isHit) {
                const opp = player === 1 ? 2 : 1;
                nextBar[opp]++;
                dest.player = player;
                dest.count = 1;
              } else {
                dest.player = player;
                dest.count++;
              }
            }

            const nextDice = [...currentDice];
            nextDice.splice(nextDice.indexOf(die), 1);

            search(nextPoints, nextBar, nextBorneOff, nextDice, [...moveSequence, { from, to: targetLabel, dieUsed: die }]);
          }
        }
      }

      if (!branchExpanded) {
        finalStates.push({
          points: currentPoints,
          bar: currentBar,
          borneOff: currentBorneOff,
          moves: moveSequence,
          diceLeftCount: currentDice.length
        });
      }
    };

    search(this.points, this.bar, this.borneOff, diceRolls, []);

    if (finalStates.length === 0) return [];
    
    let minDiceLeft = Math.min(...finalStates.map(s => s.diceLeftCount));
    let validCompleteStates = finalStates.filter(s => s.diceLeftCount === minDiceLeft);

    if (diceRolls.length === 2 && minDiceLeft === 1 && diceRolls[0] !== diceRolls[1]) {
      const largerDie = Math.max(...diceRolls);
      const hasMovesWithLarger = validCompleteStates.some(s => s.moves[0].dieUsed === largerDie);
      if (hasMovesWithLarger) {
        validCompleteStates = validCompleteStates.filter(s => s.moves[0].dieUsed === largerDie);
      }
    }

    return validCompleteStates;
  }

  /**
   * All maximum-usage complete turns, de-duplicated by final board position. The AI
   * only cares about distinct resulting positions, so it uses this. (Legal first-step
   * and rule-message logic use the pre-dedup list, since two move orders can reach the
   * same position yet represent two genuinely legal first moves.)
   */
  generateAllCompleteTurnMoves(player, diceRolls) {
    const states = this._maxUsageSequences(player, diceRolls);
    const unique = [];
    const seen = new Set();
    for (const s of states) {
      const sig = `${s.points.map((p) => `${p.count}:${p.player || 0}`).join(',')}|${s.bar[1]}:${s.bar[2]}|${s.borneOff[1]}:${s.borneOff[2]}`;
      if (!seen.has(sig)) { seen.add(sig); unique.push(s); }
    }
    return unique;
  }

  /**
   * Generate all unique complete-turn positions reachable from an ARBITRARY board
   * (not just `this`), for the given player and dice. Used by the lookahead search
   * to expand hypothetical positions. A single reusable scratch game is seeded with
   * the supplied board; `_maxUsageSequences` only ever reads the seed board (it deep-
   * copies before mutating), so pointing the scratch at these arrays is safe.
   */
  _statesFrom(board, player, dice) {
    const s = this._searchScratch || (this._searchScratch = new BackgammonGame());
    s.points = board.points;
    s.bar = board.bar;
    s.borneOff = board.borneOff;
    return s.generateAllCompleteTurnMoves(player, dice);
  }

  /**
   * Expectimax value of `board` (White's view) when `player` is on roll, looking
   * `plies` further plies ahead (plies >= 1). Every leaf is scored with the single
   * weight vector `W` (the deciding AI's own weights): White decision nodes maximize
   * that score, Red decision nodes minimize it, and each turn is a chance node that
   * averages over the 21 dice rolls. Terminal positions (all 15 borne off) short-
   * circuit to ±BG_WIN so a certain win/loss always outranks any heuristic.
   */
  _expecti(board, player, plies, W) {
    if (board.borneOff[1] >= 15) return BG_WIN;
    if (board.borneOff[2] >= 15) return -BG_WIN;

    let acc = 0;
    for (const [d1, d2, weight] of BG_DICE_DIST) {
      const dice = d1 === d2 ? [d1, d1, d1, d1] : [d1, d2];
      acc += weight * this.expectiRollValue(board, player, dice, plies, W);
    }
    return acc / 36;   // weights sum to 36
  }

  /**
   * Value of one dice outcome inside a chance node: `player` is on roll with `dice`
   * from `board`; returns the White-view value of `player`'s best reply, searching
   * `plies` deeper (static `evaluate` at the leaf). This is the atomic unit the
   * expectimax averages over — and the granularity a Web Worker computes for one
   * (my-move, opponent-roll) task during interactive play. A no-move roll yields a
   * single state equal to the board, so "pass" needs no special case.
   */
  expectiRollValue(board, player, dice, plies, W) {
    const opp = player === 1 ? 2 : 1;
    const states = this._statesFrom(board, player, dice);
    let best = player === 1 ? -Infinity : Infinity;   // White maximizes, Red minimizes
    for (const st of states) {
      let v;
      if (st.borneOff[1] >= 15) v = BG_WIN;
      else if (st.borneOff[2] >= 15) v = -BG_WIN;
      else if (plies <= 1) v = this.evaluate(st.points, st.bar, st.borneOff, W);
      else v = this._expecti(st, opp, plies - 1, W);

      if (player === 1) { if (v > best) best = v; }
      else { if (v < best) best = v; }
    }
    return best;
  }

  /**
   * Returns the best full-turn move sequence for the current player. White maximizes
   * the White-view score, Red minimizes it, using the mover's own weight vector as
   * the single evaluation currency for the whole search tree. `depth` plies of
   * lookahead (default this.searchDepth): depth 1 is one-ply static (today's
   * baseline); deeper searches average over future rolls via expectimax, scoring
   * leaves with the static `evaluate()`. A disengagement bonus (DE) is added at
   * selection time (root only) to any move that breaks contact when the mover is
   * ahead in the race (+DE for White, -DE for Red). Returns null if no moves exist.
   */
  // Shared setup for the move choosers. Resolves the search depth (per-side
  // this.searchDepths[player] wins when set — nullish checks so a depth of 0 isn't
  // lost — else this.searchDepth, default 1) and generates the candidate turns.
  // Returns null when no move is possible.
  _rootContext(depth) {
    const player = this.currentPlayer;
    if (depth === undefined) {
      const perSide = this.searchDepths && this.searchDepths[player];
      depth = (perSide != null) ? perSide : (this.searchDepth != null ? this.searchDepth : 1);
    }
    const states = this.generateAllCompleteTurnMoves(player, this.movesLeft);
    if (states.length === 0) return null;
    return {
      depth, player,
      weights: this.aiWeights[player],
      opp: player === 1 ? 2 : 1,
      states,
      parentContact: this.hasContact(this.points, this.bar),
    };
  }

  // White-view value of one candidate complete turn, incl. the root-only DE bonus.
  _scoreRootCandidate(state, ctx) {
    const { depth, player, weights, opp, parentContact } = ctx;
    const whiteWon = state.borneOff[1] >= 15;
    const redWon = state.borneOff[2] >= 15;
    let val;
    if (whiteWon) val = BG_WIN;
    else if (redWon) val = -BG_WIN;
    else if (depth <= 1) val = this.evaluate(state.points, state.bar, state.borneOff, weights);
    else val = this._expecti(state, opp, depth - 1, weights);   // look ahead

    // Disengagement bonus: one-time, on the move that turns contact into a pure race
    // (selection heuristic, not part of the static score; root only, never terminal).
    if (!whiteWon && !redWon && parentContact && !this.hasContact(state.points, state.bar)) {
      const pipW = this.pipCountP(state.points, state.bar, 1);
      const pipR = this.pipCountP(state.points, state.bar, 2);
      if (player === 1 && pipW < pipR) val += weights.DE;
      else if (player === 2 && pipR < pipW) val -= weights.DE;
    }
    val += this._raceHomeTieBreak(state, player);
    return val;
  }

  // Disengaged-race tie-break (move-selection only, like DE): once there's no contact PC is constant
  // across move choices (your own pip reduction is just the dice sum) and every positional term is
  // gated off, so the integer static score TIES for every legal turn — leaving generation order, which
  // favours the low-numbered home-board checkers, to decide. This nudges the mover toward the smaller
  // OWN homeDistancePips instead (rush stragglers home → save gammon/backgammon). Was crossoverCount,
  // which was quantized to quadrants and therefore blind to progress within one; see homeDistancePips.
  // eps is tiny (max effect 0.285 « 0.5) so it only breaks ties in the integer static score, never
  // overriding a real evaluation difference. Zero while in contact.
  _raceHomeTieBreak(state, player) {
    if (state.borneOff[1] >= 15 || state.borneOff[2] >= 15) return 0;
    if (this.hasContact(state.points, state.bar)) return 0;
    const eps = 0.001;
    return player === 1
      ? -eps * this.homeDistancePips(state.points, state.bar, 1)
      : +eps * this.homeDistancePips(state.points, state.bar, 2);
  }

  getBestAIMove(depth) {
    const ctx = this._rootContext(depth);
    if (!ctx) return null;
    // Depth 0: no evaluation — just play the first available legal complete turn.
    if (ctx.depth <= 0) return ctx.states[0].moves;

    let bestState = null, bestVal = ctx.player === 1 ? -Infinity : Infinity;
    for (const state of ctx.states) {
      const val = this._scoreRootCandidate(state, ctx);
      if (ctx.player === 1) { if (val > bestVal) { bestVal = val; bestState = state; } }
      else { if (val < bestVal) { bestVal = val; bestState = state; } }
    }
    return bestState ? bestState.moves : null;
  }

  // Async twin of getBestAIMove: identical result, but yields cooperatively so a deep
  // search never blocks the main thread long enough to trip "Page unresponsive". It
  // yields between root candidates AND, via _expectiTopYielding, between the 21 dice
  // outcomes of each candidate's top chance node — at depth 3 one candidate alone is
  // ~10 s, so per-candidate yielding isn't enough; per-roll caps a block at ~1/21 of
  // that. Depth is resolved per-side from this.searchDepths (set by the simulators).
  async getBestAIMoveYielding(breathe) {
    const ctx = this._rootContext(undefined);
    if (!ctx) return null;
    if (ctx.depth <= 0) return ctx.states[0].moves;

    let bestState = null, bestVal = ctx.player === 1 ? -Infinity : Infinity;
    for (const state of ctx.states) {
      const val = await this._scoreRootCandidateYielding(state, ctx, breathe);
      if (ctx.player === 1) { if (val > bestVal) { bestVal = val; bestState = state; } }
      else { if (val < bestVal) { bestVal = val; bestState = state; } }
      if (breathe) await breathe();
    }
    return bestState ? bestState.moves : null;
  }

  // Async version of _scoreRootCandidate: expands the top chance node with per-roll
  // yields (deeper levels stay sync). Returns the same value as _scoreRootCandidate.
  async _scoreRootCandidateYielding(state, ctx, breathe) {
    const { depth, player, weights, opp, parentContact } = ctx;
    const whiteWon = state.borneOff[1] >= 15;
    const redWon = state.borneOff[2] >= 15;
    let val;
    if (whiteWon) val = BG_WIN;
    else if (redWon) val = -BG_WIN;
    else if (depth <= 1) val = this.evaluate(state.points, state.bar, state.borneOff, weights);
    else val = await this._expectiTopYielding(state, opp, depth - 1, weights, breathe);

    if (!whiteWon && !redWon && parentContact && !this.hasContact(state.points, state.bar)) {
      const pipW = this.pipCountP(state.points, state.bar, 1);
      const pipR = this.pipCountP(state.points, state.bar, 2);
      if (player === 1 && pipW < pipR) val += weights.DE;
      else if (player === 2 && pipR < pipW) val -= weights.DE;
    }
    val += this._raceHomeTieBreak(state, player);
    return val;
  }

  // Top-level expectimax chance node with a yield between the 21 dice outcomes; the
  // subtree below the top uses the sync _expecti. The summation is identical to
  // _expecti, so the value (and therefore the chosen move) is unchanged.
  async _expectiTopYielding(board, player, plies, W, breathe) {
    if (board.borneOff[1] >= 15) return BG_WIN;
    if (board.borneOff[2] >= 15) return -BG_WIN;
    let acc = 0;
    for (const [d1, d2, weight] of BG_DICE_DIST) {
      const dice = d1 === d2 ? [d1, d1, d1, d1] : [d1, d2];
      acc += weight * this.expectiRollValue(board, player, dice, plies, W);
      if (breathe) await breathe();       // yield between dice outcomes
    }
    return acc / 36;
  }

  /**
   * The static score from `player`'s own perspective, using that player's own
   * weights. White uses the White-view score directly; Red uses its negation.
   */
  ownScore(player) {
    const score = this.evaluate(this.points, this.bar, this.borneOff, this.aiWeights[player]);
    return player === 1 ? score : -score;
  }

  /** AI decision: offer/redouble when the player's own score exceeds its DT threshold. */
  aiShouldDouble(player) {
    if (!this.canDouble(player)) return false;
    return this.ownScore(player) > (this.aiWeights[player].DT || 0);
  }

  /** AI decision: accept an offered double unless the player's own score is below -AT. */
  aiShouldAcceptDouble(player) {
    return this.ownScore(player) > -(this.aiWeights[player].AT || 0);
  }
}

/**
 * Escape count of ONE checker (the "freedom" primitive behind the F0-F5 eval features
 * and the escape-roll statistic). Counts how many of the six die-values let the checker
 * get PAST THE FRONT OF THE PRIME that contains it — not merely shuffle to an open
 * square behind the wall. So a checker sitting a few pips short of a prime with open
 * squares in front still reads as trapped (it can't clear the blockade this turn).
 *   - No prime ahead, or only a LONE blocking point (weave around it): count every open
 *     forward landing (bear-off / running off the far edge counts) — up to 6 = free.
 *   - Behind a prime of length >= 2: count only die-values that land past the prime's
 *     front (home-side end) on an open point (or bear off).
 *   - The BAR is a virtual point one pip behind the entry edge (White = 25, Red = 0), so
 *     entry is just the checker's first move and a bar checker behind a prime reads as
 *     sealed (0), whether the board is closed OR the prime sits just past the entry zone.
 * 0 = entombed/closed out ... 6 = free. Direction-dependent (White scans toward 1, Red
 * toward 24), so it MUST stay colour-antisymmetric — verify with eval-symmetry-test.js.
 */
function escapeCountForChecker(points, p, me) {
  const opp = me === 1 ? 2 : 1;
  const made = (t) => points[t].player === opp && points[t].count >= 2;
  let open = 0;
  if (me === 1) {                                   // White: p -> p-d, home past 1
    let b = -1;
    for (let t = p - 1; t >= 1; t--) if (made(t)) { b = t; break; }
    if (b === -1) {                                 // no wall ahead -> free
      for (let d = 1; d <= 6; d++) { const t = p - d; if (t < 1 || !made(t)) open++; }
      return open;
    }
    let f = b; while (f - 1 >= 1 && made(f - 1)) f--;   // front (home-side end) of the prime
    if (b - f + 1 === 1) {                          // lone point -> weave around it
      for (let d = 1; d <= 6; d++) { const t = p - d; if (t < 1 || !made(t)) open++; }
      return open;
    }
    for (let d = 1; d <= 6; d++) { const t = p - d; if (t < 1 || (t < f && !made(t))) open++; }
    return open;
  }
  let b = -1;                                       // Red: p -> p+d, home past 24
  for (let t = p + 1; t <= 24; t++) if (made(t)) { b = t; break; }
  if (b === -1) {
    for (let d = 1; d <= 6; d++) { const t = p + d; if (t > 24 || !made(t)) open++; }
    return open;
  }
  let f = b; while (f + 1 <= 24 && made(f + 1)) f++;    // front (home-side end) of the prime
  if (f - b + 1 === 1) {
    for (let d = 1; d <= 6; d++) { const t = p + d; if (t > 24 || !made(t)) open++; }
    return open;
  }
  for (let d = 1; d <= 6; d++) { const t = p + d; if (t > 24 || (t > f && !made(t))) open++; }
  return open;
}

/**
 * Bar-entombment freeze duration, in expected FROZEN TURNS, for one checker sitting on
 * the bar with the given escape-count. A checker on the bar freezes the WHOLE army until
 * it enters, so it is worse than the same escape-count checker on a point (the BE eval
 * weight prices this at BE per frozen turn). The duration is:
 *   - F1..F5: fixed, from the geometric miss model. If a bar checker enters on `e` of the
 *     six die-values, both dice miss with probability ((6-e)/6)^2, and the expected number
 *     of frozen turns is the geometric sum p_fail/(1-p_fail):
 *       e=1 -> 25/11 ≈ 2.27,  e=2 -> 0.80,  e=3 -> 1/3,  e=4 -> 0.125,  e=5 -> 1/35 ≈ 0.029.
 *   - F0 (sealed / closed out): the board holds as long as the OPPONENT can stall without
 *     breaking it, i.e. the remaining journey of his three spare checkers. A bare closed
 *     board is 12 checkers (2 per home point) = 42 pips, so his spare pips are oppPip - 42;
 *     divide by ~8 pips played per turn (doubles included). Capped at 8 turns.
 *   - F6 (fully free): 0 (not entombment; F6 carries no signal anyway).
 * NB direction-dependent (F0 reads the OPPONENT's pip count), so it must stay colour-
 * antisymmetric — re-run eval-symmetry-test.js after any change here.
 */
const BAR_FREEZE = [0, 25 / 11, 0.8, 1 / 3, 0.125, 1 / 35, 0]; // index = escape-count; [0] computed live
function barFreezeTurns(escCount, oppPip) {
  if (escCount === 0) {                         // sealed on the bar / closed out
    const t = (oppPip - 42) / 8;
    return t < 0 ? 0 : (t > 8 ? 8 : t);
  }
  return BAR_FREEZE[escCount];                   // 1..6 fixed (6 -> 0)
}

/** Per-side escape-count histogram [c0..c6] over all of `me`'s checkers (incl. the bar,
 *  each as a virtual checker at point 25 (White) / 0 (Red)). */
function escapeBuckets(points, bar, me) {
  const h = [0, 0, 0, 0, 0, 0, 0];
  const virt = me === 1 ? 25 : 0;
  for (let n = 0; n < bar[me]; n++) h[escapeCountForChecker(points, virt, me)]++;
  for (let p = 1; p <= 24; p++) {
    const pt = points[p];
    if (pt.count > 0 && pt.player === me) {
      const e = escapeCountForChecker(points, p, me);
      for (let c = 0; c < pt.count; c++) h[e]++;
    }
  }
  return h;
}

/**
 * Play one full AI-vs-AI game head-to-head (no UI, no doubling cube), returning
 * { winner, points } where points is 1 (single), 2 (gammon) or 3 (backgammon).
 * Used by the tournament runner.
 */
function simulateBGGame(wWhite, wRed, maxCube = Infinity, depthWhite = 1, depthRed = depthWhite) {
  const g = new BackgammonGame();
  g.playerTypes[1] = 'ai';
  g.playerTypes[2] = 'ai';
  g.aiWeights[1] = wWhite;
  g.aiWeights[2] = wRed;
  g.searchDepths = { 1: depthWhite, 2: depthRed };   // per-side lookahead plies
  g.rollForFirstTurn();

  let guard = 0, turns = 0;               // turns = AI decisions taken (one per play of the dice)
  while (!g.winner && guard++ < 100000) {
    turns++;
    const moves = g.getBestAIMove();
    if (moves && moves.length) {
      for (const m of moves) g.makeMove(m.from, m.to, false);  // already a legal max-usage sequence
    }
    if (g.winner) break;                 // bore off all 15 during the move
    g.endTurn();

    // The player now on roll may offer a double before rolling. The cube is
    // "live" only while doubling it stays within maxCube (match-play cap: never
    // raise the stake past what can decide the match; maxCube=1 kills doubling
    // entirely, giving cube-free single games for X=1 and Crawford).
    if (g.doublingCubeValue * 2 <= maxCube && g.aiShouldDouble(g.currentPlayer)) {
      const responder = g.currentPlayer === 1 ? 2 : 1;
      if (g.aiShouldAcceptDouble(responder)) {
        g.acceptDouble();                // cube doubles; the taker owns it
      } else {
        // Declined: the doubler wins the current stake, single, no gammon.
        return { winner: g.currentPlayer, points: g.doublingCubeValue, turns };
      }
    }
    g.rollDice();
  }

  return { ...scoreFinishedBGGame(g), turns };
}

/**
 * Score a game that ended by bearing off: { winner, points } where points is the
 * cube value × gammon multiplier (1 single, 2 gammon, 3 backgammon). Shared by the
 * sync and yielding game runners, which add their own `turns` count to the result.
 */
function scoreFinishedBGGame(g) {
  let points = 0;
  const winner = g.winner;
  if (winner) {
    const loser = winner === 1 ? 2 : 1;
    let mult = 1;
    if (g.borneOff[loser] === 0) {
      const lo = winner === 1 ? 1 : 19, hi = winner === 1 ? 6 : 24;
      let backg = g.bar[loser] > 0;
      for (let i = lo; i <= hi && !backg; i++) if (g.points[i].player === loser) backg = true;
      mult = backg ? 3 : 2;
    }
    points = g.doublingCubeValue * mult;
  }
  return { winner, points };
}

/**
 * Cooperative (async) twin of simulateBGGame: identical logic, but chooses each move
 * via g.getBestAIMoveYielding(breathe) and awaits breathe() between turns. This lets
 * the main thread yield WITHIN a single move's search (between root candidates), so
 * even a slow depth-3 move doesn't block long enough to trip "Page unresponsive".
 * `breathe` is optional; with none it behaves like the sync version (safe for Node).
 * MIRRORS simulateBGGame — keep the two in sync if the game/cube rules change.
 */
async function simulateBGGameYielding(wWhite, wRed, maxCube = Infinity, depthWhite = 1, depthRed = depthWhite, breathe = null) {
  const g = new BackgammonGame();
  g.playerTypes[1] = 'ai';
  g.playerTypes[2] = 'ai';
  g.aiWeights[1] = wWhite;
  g.aiWeights[2] = wRed;
  g.searchDepths = { 1: depthWhite, 2: depthRed };
  g.rollForFirstTurn();

  let guard = 0, turns = 0;               // mirrors simulateBGGame
  while (!g.winner && guard++ < 100000) {
    turns++;
    const moves = await g.getBestAIMoveYielding(breathe);
    if (moves && moves.length) {
      for (const m of moves) g.makeMove(m.from, m.to, false);
    }
    if (g.winner) break;
    g.endTurn();

    if (g.doublingCubeValue * 2 <= maxCube && g.aiShouldDouble(g.currentPlayer)) {
      const responder = g.currentPlayer === 1 ? 2 : 1;
      if (g.aiShouldAcceptDouble(responder)) g.acceptDouble();
      else return { winner: g.currentPlayer, points: g.doublingCubeValue, turns };
    }
    g.rollDice();
    if (breathe) await breathe();
  }

  return { ...scoreFinishedBGGame(g), turns };
}

/**
 * Play one match to X points between two AI weight sets, returning
 * { winner, scoreA, scoreB, games, turns }. winner is 'A' or 'B'; `turns` is the
 * total number of AI decisions (moves) played across the match — the denominator
 * for "ms per move" in the throughput block.
 *   - Colours alternate each game (A is White on even games) to cancel side bias.
 *   - The cube resets to 1 each game and games award cube x gammon multiplier.
 *   - Dead-cube cap: doubling can't raise the stake past what the trailing player
 *     needs to win the match (maxCube = X - min(scoreA, scoreB)). At X=1 this is 1,
 *     so the cube is dead and games are plain single games.
 *   - Crawford: the single game right after either side first reaches X-1 is played
 *     with no doubling (maxCube = 1), then doubling resumes.
 */
function simulateBGMatch(wA, wB, X, depthA = 1, depthB = depthA) {
  let scoreA = 0, scoreB = 0, games = 0, turns = 0, crawfordDone = false;
  while (scoreA < X && scoreB < X && games < 100000) {
    games++;
    const aWhite = (games % 2 === 1);
    const atMatchPoint = (scoreA === X - 1 || scoreB === X - 1);
    const crawford = atMatchPoint && !crawfordDone;   // the one no-double game
    const maxCube = crawford ? 1 : Math.max(1, X - Math.min(scoreA, scoreB));

    // Depth follows the brain (A/B), not the colour: whichever of A/B is White this
    // game searches at its own depth. With depthA === depthB this is a no-op.
    const dWhite = aWhite ? depthA : depthB;
    const dRed   = aWhite ? depthB : depthA;
    const res = simulateBGGame(aWhite ? wA : wB, aWhite ? wB : wA, maxCube, dWhite, dRed);
    // Map the game winner (White/Red) back to A/B and award points.
    const aWon = (res.winner === 1) === aWhite;
    if (aWon) scoreA += res.points; else scoreB += res.points;
    turns += res.turns || 0;

    if (crawford) crawfordDone = true;
  }
  return { winner: scoreA >= X ? 'A' : 'B', scoreA, scoreB, games, turns };
}

/**
 * Cooperative (async) twin of simulateBGMatch: identical match logic, but awaits an
 * injected `breathe()` after each game. The UI passes a time-sliced breathe so the
 * main thread yields periodically during a long match — this is what keeps the
 * browser from showing "Page unresponsive" while a depth-2+ match grinds. `breathe`
 * is optional; with none it behaves exactly like the sync version (safe for Node).
 * MIRRORS simulateBGMatch — keep the two loops in sync if the match rules change.
 */
async function simulateBGMatchYielding(wA, wB, X, depthA = 1, depthB = depthA, breathe = null) {
  let scoreA = 0, scoreB = 0, games = 0, turns = 0, crawfordDone = false;
  while (scoreA < X && scoreB < X && games < 100000) {
    games++;
    const aWhite = (games % 2 === 1);
    const atMatchPoint = (scoreA === X - 1 || scoreB === X - 1);
    const crawford = atMatchPoint && !crawfordDone;
    const maxCube = crawford ? 1 : Math.max(1, X - Math.min(scoreA, scoreB));

    const dWhite = aWhite ? depthA : depthB;
    const dRed   = aWhite ? depthB : depthA;
    // Use the yielding game runner so the thread also breathes WITHIN a move's
    // search (crucial at depth 3, where a single move can otherwise block for tens
    // of seconds and trip "Page unresponsive").
    const res = await simulateBGGameYielding(aWhite ? wA : wB, aWhite ? wB : wA, maxCube, dWhite, dRed, breathe);
    const aWon = (res.winner === 1) === aWhite;
    if (aWon) scoreA += res.points; else scoreB += res.points;
    turns += res.turns || 0;

    if (crawford) crawfordDone = true;
    if (breathe) await breathe();          // let the browser paint / stay responsive
  }
  return { winner: scoreA >= X ? 'A' : 'B', scoreA, scoreB, games, turns };
}

// Export class if running in Node environment for testing, otherwise leave global
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
  module.exports = BackgammonGame;
  module.exports.simulateBGGame = simulateBGGame;
  module.exports.simulateBGGameYielding = simulateBGGameYielding;
  module.exports.simulateBGMatch = simulateBGMatch;
  module.exports.simulateBGMatchYielding = simulateBGMatchYielding;
  module.exports.escapeCountForChecker = escapeCountForChecker;
  module.exports.escapeBuckets = escapeBuckets;
  module.exports.barFreezeTurns = barFreezeTurns;
}
