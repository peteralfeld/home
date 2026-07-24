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
 *   PC  normalized pip count            (term w*pip/167)      -667
 *   EC1 rolls allowing exactly one move (term w*EC1/36)       -133
 *   EC0 rolls allowing no move          (term w*EC0/36)       -400
 *   PH  longest prime * checkers trapped (steep, pure mult)   +667
 *   HB  home-board points made (standing)                     +133
 *   AN  anchors, gated on being behind in the race            +200
 *   DO/IO/DP/IP  collapsed blot threat-vs-exposure features   +1000/600/500/300
 *   DE  disengagement bonus (move-selection only, not static) +667
 */
const AI_PERSONALITIES = {
  Origin:    { PC: -667,  EC1: -133, EC0: -400,  PH: 667,  HB: 133, AN: 200,  DO: 1000, IO: 600, DP: 500,  IP: 300, DE: 667  },
  Arwen:     { PC: -1000, EC1: -89,  EC0: -267,  PH: 445,  HB: 89,  AN: 133,  DO: 667,  IO: 400, DP: 333,  IP: 200, DE: 445  },
  Bilbo:     { PC: -334,  EC1: -67,  EC0: -200,  PH: 334,  HB: 67,  AN: 100,  DO: 1000, IO: 500, DP: 250,  IP: 150, DE: 334  },
  Celebrian: { PC: -445,  EC1: -89,  EC0: -267,  PH: 445,  HB: 89,  AN: 133,  DO: 667,  IO: 400, DP: 333,  IP: 200, DE: 1000 },
  Dwalin:    { PC: -556,  EC1: -111, EC0: -333,  PH: 1000, HB: 111, AN: 167,  DO: 833,  IO: 500, DP: 417,  IP: 250, DE: 556  },
  Eowyn:     { PC: -667,  EC1: -500, EC0: -1000, PH: 667,  HB: 133, AN: 200,  DO: 1000, IO: 600, DP: 500,  IP: 300, DE: 667  },
  Frodo:     { PC: -556,  EC1: -111, EC0: -333,  PH: 556,  HB: 111, AN: 1000, DO: 833,  IO: 500, DP: 417,  IP: 250, DE: 556  },
  Galadriel: { PC: -667,  EC1: -133, EC0: -400,  PH: 667,  HB: 133, AN: 200,  DO: 1000, IO: 600, DP: 1000, IP: 500, DE: 667  },
  Hamfast:   { PC: -667,  EC1: -133, EC0: -400,  PH: 667,  HB: 500, AN: 200,  DO: 1000, IO: 600, DP: 500,  IP: 300, DE: 667  }
};

// The baseline AI. Each personality is normalized so max|w| = 1000.
const DEFAULT_WEIGHTS = AI_PERSONALITIES.Origin;

// Steep length factor for a prime of a given length (0 for < 2, 1.0 for full 6-prime).
const PRIME_FACTOR = { 2: 0.05, 3: 0.15, 4: 0.35, 5: 0.65, 6: 1.0 };

class BackgammonGame {
  constructor() {
    this.restart();
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
    this.aiWeights = { 1: { ...DEFAULT_WEIGHTS }, 2: { ...DEFAULT_WEIGHTS } };
    // M = sum of |static weights|, recomputed per weight vector. Used by score/M.
    this.maxScore = {
      1: this.computeMaxScore(this.aiWeights[1]),
      2: this.computeMaxScore(this.aiWeights[2])
    };
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
    // deterministically. Moves remain the player's free choice.
    this.futureRolls = this.gameHistory.slice(index + 1).map(s => [...s.dice]);
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
   * Gets list of legal target destinations from a starting point index.
   * fromPoint can be:
   * - A number 1 to 24
   * - "bar" (or represented internally as 25 for P1, 0 for P2)
   */
  getLegalDestinations(fromPoint) {
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
   * Execute a move from -> to.
   * Returns true if successful, false otherwise.
   */
  makeMove(from, to) {
    const player = this.currentPlayer;
    const destinations = this.getLegalDestinations(from);
    
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

    const player = this.currentPlayer;

    // If player has checkers on bar, check if they can move any out of the bar
    if (this.hasCheckersOnBar(player)) {
      return this.getLegalDestinations("bar").length > 0;
    }

    // Check all points on the board containing current player's checkers
    for (let i = 1; i <= 24; i++) {
      if (this.points[i].player === player) {
        if (this.getLegalDestinations(i).length > 0) {
          return true;
        }
      }
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
  }

  /**
   * M = sum of the absolute static weights (the maximum favorable score, since
   * every term tops out at +|w| for White). Recomputed per weight vector.
   * DE is excluded — it is a move-selection bonus, not part of the static score.
   */
  computeMaxScore(weights) {
    return Math.abs(weights.PC) + Math.abs(weights.EC1) + Math.abs(weights.EC0)
      + Math.abs(weights.PH) + Math.abs(weights.HB) + Math.abs(weights.AN)
      + Math.abs(weights.DO) + Math.abs(weights.IO) + Math.abs(weights.DP) + Math.abs(weights.IP);
  }

  /** Names of all available AI personalities (used to populate the player menus). */
  aiPersonalityNames() {
    return Object.keys(AI_PERSONALITIES);
  }

  /** Assign an AI personality (by name) to a player, recomputing its M. */
  setPlayerAI(player, name) {
    const w = AI_PERSONALITIES[name] || AI_PERSONALITIES.Origin;
    this.aiWeights[player] = { ...w };
    this.maxScore[player] = this.computeMaxScore(this.aiWeights[player]);
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

  /** Longest prime in p's home+outer board and how many opponent checkers it traps. */
  longestPrimeTrapped(points, bar, p) {
    const lo = p === 1 ? 1 : 13, hi = p === 1 ? 12 : 24;
    let bestLen = 0, bestStart = -1, bestEnd = -1, curStart = -1;
    for (let i = lo; i <= hi; i++) {
      const made = points[i].player === p && points[i].count >= 2;
      if (made) { if (curStart === -1) curStart = i; }
      else { if (curStart !== -1) { const len = i - curStart; if (len > bestLen) { bestLen = len; bestStart = curStart; bestEnd = i - 1; } curStart = -1; } }
    }
    if (curStart !== -1) { const len = hi + 1 - curStart; if (len > bestLen) { bestLen = len; bestStart = curStart; bestEnd = hi; } }
    if (bestLen < 2) return { len: 0, trapped: 0 };
    const opp = p === 1 ? 2 : 1;
    let trapped = bar[opp];
    if (p === 1) { for (let i = 1; i < bestStart; i++) if (points[i].player === 2) trapped += points[i].count; }
    else { for (let i = bestEnd + 1; i <= 24; i++) if (points[i].player === 1) trapped += points[i].count; }
    return { len: bestLen, trapped };
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

    // PC — normalized pip count (w negative: fewer White pips is better)
    const pipW = this.pipCountP(points, bar, 1), pipR = this.pipCountP(points, bar, 2);
    score += weights.PC * (pipW - pipR) / 167;

    // EC — encumbrance / mobility
    const ecW = this.computeEC(points, bar, 1), ecR = this.computeEC(points, bar, 2);
    score += weights.EC1 * (ecW.ec1 - ecR.ec1) / 36;
    score += weights.EC0 * (ecW.ec0 - ecR.ec0) / 36;

    // PH — longest prime * checkers trapped (steep length factor, pure multiply)
    const phW = this.longestPrimeTrapped(points, bar, 1);
    const phR = this.longestPrimeTrapped(points, bar, 2);
    const phValW = (PRIME_FACTOR[phW.len] || (phW.len >= 6 ? 1.0 : 0)) * phW.trapped;
    const phValR = (PRIME_FACTOR[phR.len] || (phR.len >= 6 ? 1.0 : 0)) * phR.trapped;
    score += weights.PH * (phValW - phValR);

    // HB — home-board points made (standing)
    score += weights.HB * (this.homeBoardPoints(points, 1) - this.homeBoardPoints(points, 2));

    // AN — anchors, only for the side that is behind in the race
    const anW = pipW > pipR ? this.anchorsP(points, 1) : 0;
    const anR = pipR > pipW ? this.anchorsP(points, 2) : 0;
    score += weights.AN * (anW - anR);

    // Blots — collapsed threat/exposure, already from White's view
    score += this.blotContribution(points, bar, weights);

    return Math.round(score);
  }

  /**
   * Generates all unique final board positions reachable by executing legal moves for the current dice.
   * Backgammon rules require you to play the maximum number of dice possible.
   * If you can play only one of the dice, you must play the larger one (if both are separately playable).
   */
  generateAllCompleteTurnMoves(player, diceRolls) {
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

    const uniqueCompleteStates = [];
    const seenSignatures = new Set();
    
    for (const state of validCompleteStates) {
      const sig = serializeState(state.points, state.bar, state.borneOff);
      if (!seenSignatures.has(sig)) {
        seenSignatures.add(sig);
        uniqueCompleteStates.push(state);
      }
    }

    return uniqueCompleteStates;
  }

  /**
   * Returns the best full-turn move sequence for the current player. White maximizes
   * the White-view score, Red minimizes it, each using its own weight vector. A
   * disengagement bonus (DE) is added at selection time to any move that breaks contact
   * when the mover is ahead in the race (+DE for White, -DE for Red). Returns null if
   * no moves are possible.
   */
  getBestAIMove() {
    const player = this.currentPlayer;
    const weights = this.aiWeights[player];
    const possibleStates = this.generateAllCompleteTurnMoves(player, this.movesLeft);
    if (possibleStates.length === 0) return null;

    const parentContact = this.hasContact(this.points, this.bar);
    let bestState = null;
    let bestVal = player === 1 ? -Infinity : Infinity;

    for (const state of possibleStates) {
      let val = this.evaluate(state.points, state.bar, state.borneOff, weights);

      // Disengagement bonus: one-time, on the move that turns contact into a pure race.
      if (parentContact && !this.hasContact(state.points, state.bar)) {
        const pipW = this.pipCountP(state.points, state.bar, 1);
        const pipR = this.pipCountP(state.points, state.bar, 2);
        if (player === 1 && pipW < pipR) val += weights.DE;
        else if (player === 2 && pipR < pipW) val -= weights.DE;
      }

      if (player === 1) { if (val > bestVal) { bestVal = val; bestState = state; } }
      else { if (val < bestVal) { bestVal = val; bestState = state; } }
    }

    return bestState ? bestState.moves : null;
  }

  /**
   * Normalized equity in ~[-1, 1] from the given player's own perspective
   * (+ good for that player), i.e. (White-view score / M), flipped for Red.
   */
  aiEquity(player) {
    const score = this.evaluate(this.points, this.bar, this.borneOff, this.aiWeights[player]);
    const M = this.maxScore[player] || 1;
    return player === 1 ? score / M : -score / M;
  }

  /** AI decision: should `player` offer a double now? (equity/M > 0.20) */
  aiShouldDouble(player) {
    if (!this.canDouble(player)) return false;
    return this.aiEquity(player) > 0.20;
  }

  /** AI decision: should `player` accept an offered double? (take unless equity/M <= -0.70) */
  aiShouldAcceptDouble(player) {
    return this.aiEquity(player) > -0.70;
  }
}

// Export class if running in Node environment for testing, otherwise leave global
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
  module.exports = BackgammonGame;
}
