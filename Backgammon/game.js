/**
 * Backgammon Game Engine
 * Manages game state, turn flow, and rule validation.
 */

class BackgammonGame {
  constructor() {
    this.reset();
  }

  reset() {
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

    // History stack for supporting Undo functionality
    // Stores deep copies of game state at each sub-move during the turn.
    this.turnHistory = [];

    // Global game history for time travel and logs
    this.gameHistory = [];
    this.playedMovesThisTurn = [];
    this.turnCount = 0;
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
    return { currentPlayer: this.currentPlayer, dice: this.dice };
  }

  /**
   * Roll dice for standard turn.
   */
rollDice(d1 = null, d2 = null) {
  if (this.hasRolled && d1 === null) return null; // Prevent re-rolling unless receiving remote data

  const roll1 = d1 !== null ? d1 : Math.floor(Math.random() * 6) + 1;
  const roll2 = d2 !== null ? d2 : Math.floor(Math.random() * 6) + 1;
  
  this.dice = [roll1, roll2];
  this.hasRolled = true;
    if (this.hasRolled) return null;

    const d1 = Math.floor(Math.random() * 6) + 1;
    const d2 = Math.floor(Math.random() * 6) + 1;
    
    this.dice = [d1, d2];
    this.hasRolled = true;
    
    if (d1 === d2) {
      // Doubles get 4 moves of that value
      this.movesLeft = [d1, d1, d1, d1];
    } else {
      this.movesLeft = [d1, d2];
    }

    this.turnHistory = [];
    this.saveStateToHistory(); // Save the initial state of the turn for undos

    this.turnCount++;
    const playerColor = this.currentPlayer === 1 ? "White" : "Red";

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
    
    // We want the board to be in the state AFTER snapshot.currentPlayer's moves.
    // So the next active player is the opponent of snapshot.currentPlayer!
    this.currentPlayer = snapshot.currentPlayer === 1 ? 2 : 1;
    this.dice = [0, 0];
    this.movesLeft = [];
    this.hasRolled = false;
    
    this.winner = snapshot.winner;
    this.doublingCubeValue = snapshot.doublingCubeValue;
    this.doublingCubeOwner = snapshot.doublingCubeOwner;
    this.turnCount = snapshot.turnCount;

    // Truncate game history
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
   * Evaluates the board state from the perspective of the specified player.
   * Returns a numerical score. Symmetric evaluation: Score(Player) - Score(Opponent).
   */
  evaluateBoardState(points, bar, borneOff, player) {
    const opp = player === 1 ? 2 : 1;

    // Helper to calculate pip count
    const getPipCount = (pNum) => {
      let pips = bar[pNum] * 25;
      for (let i = 1; i <= 24; i++) {
        if (points[i].player === pNum) {
          pips += points[i].count * (pNum === 1 ? i : (25 - i));
        }
      }
      return pips;
    };

    // Helper to extract features for a player
    const getFeatures = (pNum, oppNum) => {
      const features = {
        blots: 0,
        blocks: 0,
        prime_2: 0,
        prime_3: 0,
        prime_4: 0,
        prime_5: 0,
        prime_6: 0,
        trapped_2: 0,
        trapped_3: 0,
        trapped_4: 0,
        trapped_5: 0,
        trapped_6: 0,
        anchors: 0,
        borneOff: borneOff[pNum]
      };

      // 1. Blots and Blocks
      for (let i = 1; i <= 24; i++) {
        if (points[i].player === pNum) {
          if (points[i].count === 1) {
            features.blots++;
          } else if (points[i].count >= 2) {
            features.blocks++;
            
            // Check for opponent home board anchors
            if (pNum === 1 && i >= 19 && i <= 24) {
              features.anchors++;
            } else if (pNum === 2 && i >= 1 && i <= 6) {
              features.anchors++;
            }
          }
        }
      }

      // 2. Primes and trapped checkers
      let currentPrimeStart = null;
      const primesList = [];

      for (let i = 1; i <= 24; i++) {
        const isBlocked = points[i].player === pNum && points[i].count >= 2;
        if (isBlocked) {
          if (currentPrimeStart === null) {
            currentPrimeStart = i;
          }
        } else {
          if (currentPrimeStart !== null) {
            const len = i - currentPrimeStart;
            if (len >= 2) {
              primesList.push({ start: currentPrimeStart, end: i - 1, length: Math.min(len, 6) });
            }
            currentPrimeStart = null;
          }
        }
      }
      if (currentPrimeStart !== null) {
        const len = 25 - currentPrimeStart;
        if (len >= 2) {
          primesList.push({ start: currentPrimeStart, end: 24, length: Math.min(len, 6) });
        }
      }

      // Process each prime
      for (const prime of primesList) {
        const len = prime.length;
        features[`prime_${len}`]++;

        let trapped = 0;
        if (pNum === 1) {
          for (let i = 1; i < prime.start; i++) {
            if (points[i].player === oppNum) {
              trapped += points[i].count;
            }
          }
          trapped += bar[oppNum];
        } else {
          for (let i = prime.end + 1; i <= 24; i++) {
            if (points[i].player === oppNum) {
              trapped += points[i].count;
            }
          }
          trapped += bar[oppNum];
        }
        features[`trapped_${len}`] += trapped;
      }

      return features;
    };

    const pPips = getPipCount(player);
    const oPips = getPipCount(opp);

    const fP = getFeatures(player, opp);
    const fO = getFeatures(opp, player);

    // Normalized Weights configuration (Max = 1000)
    const weights = {
      pip_diff: 11,
      blots: -167,
      blocks: 89,
      prime_2: 56,
      prime_3: 111,
      prime_4: 222,
      prime_5: 500,
      prime_6: 1000,
      trapped_2: 17,
      trapped_3: 33,
      trapped_4: 89,
      trapped_5: 222,
      trapped_6: 556,
      anchors: 133,
      borneOff: 333
    };

    let score = 0;
    score += weights.pip_diff * (oPips - pPips);
    score += weights.blots * (fP.blots - fO.blots);
    score += weights.blocks * (fP.blocks - fO.blocks);

    for (let L = 2; L <= 6; L++) {
      score += weights[`prime_${L}`] * (fP[`prime_${L}`] - fO[`prime_${L}`]);
      score += weights[`trapped_${L}`] * (fP[`trapped_${L}`] - fO[`trapped_${L}`]);
    }

    score += weights.anchors * (fP.anchors - fO.anchors);
    score += weights.borneOff * (fP.borneOff - fO.borneOff);

    return score;
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
   * Evaluates all possible full-turn move choices and returns the move sequence that achieves
   * the highest static evaluation score. Returns null if no moves are possible.
   */
  getBestAIMove() {
    const possibleStates = this.generateAllCompleteTurnMoves(this.currentPlayer, this.movesLeft);
    if (possibleStates.length === 0) return null;
    
    let bestState = null;
    let bestScore = -Infinity;
    
    for (const state of possibleStates) {
      const score = this.evaluateBoardState(state.points, state.bar, state.borneOff, this.currentPlayer);
      if (score > bestScore) {
        bestScore = score;
        bestState = state;
      }
    }
    
    return bestState ? bestState.moves : null;
  }
}

// Export class if running in Node environment for testing, otherwise leave global
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
  module.exports = BackgammonGame;
}
