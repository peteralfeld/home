/**
 * Backgammon UI Controller
 * Binds DOM events and manages user interactions (clicks, drags, rolls).
 */

document.addEventListener('DOMContentLoaded', () => {

 let isNetworkGame = false;
  let localPlayerRole = null; // 1 = White, 2 = Red
  let peer = null;
  let conn = null;   

  const game = new BackgammonGame();
  
  // DOM Elements
  const boardEl = document.getElementById('backgammon-board');
  const diceContainerEl = document.getElementById('dice-container');
  const btnUndo = document.getElementById('btn-undo');
  const die1El = document.getElementById('die-1');
  const die2El = document.getElementById('die-2');
  const diceMovesList = document.getElementById('dice-moves-list');
  const gameMessageEl = document.getElementById('game-message');
  const turnDisplay = document.getElementById('turn-display');
  const turnText = document.getElementById('turn-text');
  const scoreP1 = document.getElementById('score-p1');
  const scoreP2 = document.getElementById('score-p2');
  const trayP1 = document.getElementById('tray-p1');
  const trayP2 = document.getElementById('tray-p2');
  const barP1El = document.getElementById('bar-p1');
  const barP2El = document.getElementById('bar-p2');
  const historyListEl = document.getElementById('history-list');
  
  // Doubling Cube DOM Elements
  const btnDouble = document.getElementById('btn-double');
  const cubeValueSpan = document.getElementById('cube-value');
  const cubeOwnerSpan = document.getElementById('cube-owner');
  const doublingCubeEl = document.getElementById('doubling-cube');

  // Selected source point for click-to-move interaction
  let selectedSource = null;
  // Store destination point options
  let legalDestinations = [];
  // Status check for initial roll-off
  let initialRollOff = true;
  // Track dice roll animation lock
  let isRolling = false;
  // Track active turn-end transitions to prevent overlapping timeouts
  let turnEndTimer = null;
  
  // AI execution variables
  let gameStarted = false;
  let aiActionTimeout = null;
  let animationOn = true;
  let isAIPlaying = false;

  const logLinesEl = document.getElementById('debug-log-lines');
  function sysLog(msg) {
    if (logLinesEl) {
      const time = new Date().toTimeString().split(' ')[0];
      logLinesEl.innerHTML += `\n[${time}] ${msg}`;
      logLinesEl.scrollTop = logLinesEl.scrollHeight;
    }
    console.log(msg);
  }

  function updateAnimationButton() {
    const btnAnim = document.getElementById('btn-animation');
    if (!btnAnim) return;
    if (animationOn) {
      btnAnim.style.background = '#10b981';
      btnAnim.style.color = '#ffffff';
      btnAnim.textContent = 'Animation: ON';
      btnAnim.style.boxShadow = '0 0 10px rgba(16, 185, 129, 0.4)';
      btnAnim.style.border = 'none';
    } else {
      btnAnim.style.background = 'rgba(255, 255, 255, 0.08)';
      btnAnim.style.color = 'var(--text-secondary)';
      btnAnim.textContent = 'Animation: OFF';
      btnAnim.style.boxShadow = 'none';
      btnAnim.style.border = '1px solid rgba(255,255,255,0.06)';
    }
  }

  // Initialize Board Visuals
  renderDie(die1El, 0);
  renderDie(die2El, 0);
  sysLog("[System] Event listeners binding...");
  updateUI();

  // Setup click listeners for points
  for (let i = 1; i <= 24; i++) {
    const pointEl = document.getElementById(`point-${i}`);
    pointEl.addEventListener('click', () => handlePointClick(i));
    
    // Drag over, enter, and drop listeners for points
    pointEl.addEventListener('dragover', (e) => handleDragOver(e, i));
    pointEl.addEventListener('dragenter', (e) => handleDragOver(e, i));
    pointEl.addEventListener('drop', (e) => handleDrop(e, i));
  }

  // Bar containers interaction
  barP1El.addEventListener('click', () => handleBarClick(1));
  barP2El.addEventListener('click', () => handleBarClick(2));
  
  // Setup click and drop listeners for bear off zones
  const bearOffP1 = document.getElementById('bear-off-p1');
  const bearOffP2 = document.getElementById('bear-off-p2');
  bearOffP1.addEventListener('click', () => handleBearOffClick(1));
  bearOffP2.addEventListener('click', () => handleBearOffClick(2));

  bearOffP1.addEventListener('dragover', (e) => handleDragOver(e, "off"));
  bearOffP1.addEventListener('dragenter', (e) => handleDragOver(e, "off"));
  bearOffP1.addEventListener('drop', (e) => handleDrop(e, "off"));
  
  bearOffP2.addEventListener('dragover', (e) => handleDragOver(e, "off"));
  bearOffP2.addEventListener('dragenter', (e) => handleDragOver(e, "off"));
  bearOffP2.addEventListener('drop', (e) => handleDrop(e, "off"));

  // Event Listeners
  diceContainerEl.addEventListener('click', () => {
    if (!gameStarted) return;
    if (game.playerTypes[game.currentPlayer] === 'ai') return;
    const canRoll = !game.hasRolled || initialRollOff;
    if (canRoll && !game.winner && !isRolling) {
      handleRollClick();
    }
  });
  btnUndo.addEventListener('click', () => {
    if (!gameStarted || game.playerTypes[game.currentPlayer] === 'ai') return;
    handleUndoClick();
  });
  // Restart Button Listener (skips query overlay)
  const btnRestart = document.getElementById('btn-restart');
  if (btnRestart) {
    btnRestart.addEventListener('click', () => {
      if (confirm("Are you sure you want to restart the game?")) {
        if (turnEndTimer) {
          clearTimeout(turnEndTimer);
          turnEndTimer = null;
        }
        if (aiActionTimeout) {
          clearTimeout(aiActionTimeout);
          aiActionTimeout = null;
        }
        isAIPlaying = false;
        game.reset();
        selectedSource = null;
        legalDestinations = [];
        initialRollOff = true;
        isRolling = false;
        gameStarted = false; 
        
        const btnStart = document.getElementById('btn-start-game');
        if (btnStart) {
          btnStart.disabled = false;
          btnStart.style.opacity = '1';
        }
        
          renderDie(die1El, 0);
          renderDie(die2El, 0);
        updateUI();
      }
    });
  }

  // Animation Toggle Listener
  const btnAnim = document.getElementById('btn-animation');
  if (btnAnim) {
    btnAnim.addEventListener('click', () => {
      animationOn = !animationOn;
      updateAnimationButton();
      sysLog(`[System] Animation toggled to ${animationOn ? 'ON' : 'OFF'}`);
    });
    updateAnimationButton();
  }

  btnDouble.addEventListener('click', () => {
    if (!gameStarted || game.playerTypes[game.currentPlayer] === 'ai') return;
    handleDoubleOffer();
  });
  doublingCubeEl.addEventListener('click', () => {
    if (!gameStarted || game.playerTypes[game.currentPlayer] === 'ai') return;
    handleDoubleOffer();
  });

  /**
   * Helper to render dots on a die face.
   */
  function renderDie(el, value) {
    el.innerHTML = '';
    const face = document.createElement('div');
    face.className = 'die-face';
    
    // 3x3 Grid mappings
    // 0 1 2
    // 3 4 5
    // 6 7 8
    const dotPositions = {
      1: [4],
      2: [0, 8],
      3: [0, 4, 8],
      4: [0, 2, 6, 8],
      5: [0, 2, 4, 6, 8],
      6: [0, 2, 3, 5, 6, 8]
    };
    
    const activeDots = dotPositions[value] || [];
    for (let i = 0; i < 9; i++) {
      const cell = document.createElement('div');
      cell.className = 'die-cell';
      if (activeDots.includes(i)) {
        const dot = document.createElement('div');
        dot.className = 'die-dot';
        cell.appendChild(dot);
      }
      face.appendChild(cell);
    }
    el.appendChild(face);
  }

  /**
   * Main render loop.
   */
  function updateUI() {
    sysLog("[Update] Board state logical: " + game.points.map((p, idx) => p.count > 0 ? `${idx}:${p.player}(${p.count})` : '').filter(Boolean).join(', '));
    
    // Render dice faces dynamically (blank/0 dots if not rolled yet, actual values if rolled)
    if (!isRolling) {
      if (game.hasRolled) {
        renderDie(die1El, game.dice[0]);
        renderDie(die2El, game.dice[1]);
      } else {
        renderDie(die1El, 0);
        renderDie(die2El, 0);
      }
    }

    // 1. Render all checkers on standard board points
    renderPoints();

    // 2. Render bar checkers
    renderBar();

    // 3. Render borne off checkers
    renderBorneOff();

    // 4. Update status scoreboard
    scoreP1.textContent = `${game.borneOff[1]} / 15`;
    scoreP2.textContent = `${game.borneOff[2]} / 15`;

// 5. Update header turn indicator
    if (turnDisplay && turnText) {
      if (game.currentPlayer) {
        turnDisplay.style.display = 'flex';
        if (game.currentPlayer === 1) {
          turnDisplay.className = 'player-turn-indicator player1-turn';
          turnText.textContent = `Player 1's Turn (White)`;
          document.body.classList.remove('player2-turn-active');
        } else {
          turnDisplay.className = 'player-turn-indicator player2-turn';
          turnText.textContent = `Player 2's Turn (Red)`;
          document.body.classList.add('player2-turn-active');
        }
      } else {
        turnDisplay.style.display = 'none';
        document.body.classList.remove('player2-turn-active');
      }
    } else {
      // Still toggle turn classes on body even if top panel is removed
      // UPDATE: Force red dice for the guest while waiting for the game to start
      if (game.currentPlayer === 2 || (!gameStarted && isNetworkGame && localPlayerRole === 2)) {
        document.body.classList.add('player2-turn-active');
      } else {
        document.body.classList.remove('player2-turn-active');
      }
    }
      
    // 6. Update Dice values list
    renderRemainingMovesTokens();

    // 7. Enable/disable undo button
    btnUndo.disabled = game.turnHistory.length <= 1;

    // 7b. Update Doubling Cube DOM elements
    cubeValueSpan.textContent = `${game.doublingCubeValue}x`;
    cubeOwnerSpan.textContent = game.doublingCubeOwner === null ? "Either Player" : (game.doublingCubeOwner === 1 ? "Player 1 (White)" : "Player 2 (Red)");
    doublingCubeEl.textContent = game.doublingCubeValue === 1 ? "64" : game.doublingCubeValue;
    btnDouble.disabled = !game.canDouble(game.currentPlayer);
// 7c. Update dice container styling classes (rollable/initial-roll-off)
    const canRoll = !game.hasRolled || initialRollOff;
    if (canRoll && !game.winner && !isRolling) {
      diceContainerEl.classList.add('rollable');
    } else {
      diceContainerEl.classList.remove('rollable');
    }

    // ADD THIS BLOCK: Toggle the red/white colors
    if (initialRollOff && !(isNetworkGame && localPlayerRole === 2 && !gameStarted)) {
      diceContainerEl.classList.add('initial-roll-off');
    } else {
      diceContainerEl.classList.remove('initial-roll-off');
    }

    // 7d. Render history list logs


// Inside handleRollClick in ui.js
if (initialRollOff) {
    const result = game.rollForFirstTurn();
    if (result.dice[0] !== result.dice[1]) {
        initialRollOff = false;
        // If playing network game, tell guest the game has started
        if (isNetworkGame && conn && conn.open) {
            conn.send({ type: 'roll_first', dice: result.dice });
        }
    } else {
        sysLog("[Roll] Tie! Rolling again...");
        // Ensure the UI updates immediately so the user knows they must roll again
        updateUI(); 
        isRolling = false; // Reset lock to allow re-roll
        return; // Stop here so we don't proceed to game.rollDice()
    }
}

    // 7d. Render history list logs
    renderHistoryList();

// 8. Handle messages and turn advancement
    if (game.winner) {
      gameMessageEl.textContent = `🎉 Game Over! Player ${game.winner === 1 ? '1 (White)' : '2 (Red)'} wins the game!`;
      btnUndo.disabled = true;
    } else if (!gameStarted) {
      // UPDATE: Show waiting message for guest, standard message for host
      if (isNetworkGame && localPlayerRole === 2) {
        gameMessageEl.textContent = "Waiting for the host to start the game...";
      } else {
        gameMessageEl.textContent = "Select players and click START GAME!";
      }
    } else if (initialRollOff) {
      gameMessageEl.textContent = "Click the dice to decide who starts!";
    } else if (!game.hasRolled) {
	gameMessageEl.textContent = `Player ${game.currentPlayer === 1 ? '1 (White)' : '2 (Red)'}: Click the dice to roll.`;
    } else {
      if (game.movesLeft.length === 0) {
        gameMessageEl.textContent = "Turn completed! Switching players...";
        if (turnEndTimer) clearTimeout(turnEndTimer);
        turnEndTimer = setTimeout(() => {
          turnEndTimer = null;
          game.endTurn();
          updateUI();
        }, 100);
      } else if (!game.hasLegalMoves()) {
        gameMessageEl.textContent = "No legal moves possible! Switching players...";
        if (turnEndTimer) clearTimeout(turnEndTimer);
        turnEndTimer = setTimeout(() => {
          turnEndTimer = null;
          game.endTurn();
          updateUI();
        }, 100);
      } else {
        if (turnEndTimer) {
          clearTimeout(turnEndTimer);
          turnEndTimer = null;
        }
        const movesStr = game.movesLeft.join(', ');
        gameMessageEl.textContent = `Drag your pieces. Moves left: [${movesStr}]`;
      }
    }

    if (gameStarted) {
      checkAndTriggerAITurn();
    }
  }

  /**
   * Render points on the board.
   */
  function renderPoints() {
    for (let i = 1; i <= 24; i++) {
      const pointEl = document.getElementById(`point-${i}`);
      // Remove any existing checker container
      const existingContainer = pointEl.querySelector('.checker-container');
      if (existingContainer) existingContainer.remove();

      const pointState = game.points[i];
      if (pointState.count > 0) {
        const container = document.createElement('div');
        container.className = 'checker-container';
        pointEl.appendChild(container);

        for (let c = 0; c < pointState.count; c++) {
          const checker = document.createElement('div');
          checker.className = `checker player-${pointState.player}`;
          
          // Apply stacking overlap for many checkers
          if (pointState.count > 5) {
            const containerRect = pointEl.getBoundingClientRect();
            const containerHeight = containerRect.height * 0.8;
            const checkerSize = containerRect.width * 0.8;
            const overlap = (containerHeight - (pointState.count * checkerSize)) / (pointState.count - 1);
            
            if (c > 0) {
              if (i >= 13) {
                checker.style.marginTop = `${overlap}px`;
              } else {
                checker.style.marginBottom = `${overlap}px`;
              }
            }
          }

          // Drag Start Handler
if (pointState.player === game.currentPlayer && game.hasRolled && game.movesLeft.length > 0 && !game.hasCheckersOnBar(game.currentPlayer) && game.playerTypes[game.currentPlayer] === 'human' && (!isNetworkGame || game.currentPlayer === localPlayerRole)) {
            checker.setAttribute('draggable', 'true');
            setupDragEvents(checker, i);
          }

          container.appendChild(checker);
        }
      }
    }
  }

  /**
   * Render bar containers.
   */
  function renderBar() {
    barP1El.innerHTML = '';
    barP2El.innerHTML = '';

    // Player 1 (White) Bar
    for (let c = 0; c < game.bar[1]; c++) {
      const checker = document.createElement('div');
      checker.className = 'checker player-1';
	if (game.currentPlayer === 1 && game.hasRolled && game.movesLeft.length > 0 && game.playerTypes[1] === 'human' && (!isNetworkGame || game.currentPlayer === localPlayerRole)) {
        checker.setAttribute('draggable', 'true');
        setupDragEvents(checker, "bar");
      }
      barP1El.appendChild(checker);
    }

    // Player 2 (Red) Bar
    for (let c = 0; c < game.bar[2]; c++) {
      const checker = document.createElement('div');
      checker.className = 'checker player-2';
	if (game.currentPlayer === 2 && game.hasRolled && game.movesLeft.length > 0 && game.playerTypes[2] === 'human' && (!isNetworkGame || game.currentPlayer === localPlayerRole)) {
        checker.setAttribute('draggable', 'true');
        setupDragEvents(checker, "bar");
      }
      barP2El.appendChild(checker);
    }
  }

  /**
   * Render borne-off trays.
   */
  function renderBorneOff() {
    trayP1.innerHTML = '';
    trayP2.innerHTML = '';

    for (let c = 0; c < game.borneOff[1]; c++) {
      const slab = document.createElement('div');
      slab.className = 'borne-checker player-1';
      trayP1.appendChild(slab);
    }

    for (let c = 0; c < game.borneOff[2]; c++) {
      const slab = document.createElement('div');
      slab.className = 'borne-checker player-2';
      trayP2.appendChild(slab);
    }
  }

  /**
   * Render remaining moves list as visual badge tokens.
   */
  function renderRemainingMovesTokens() {
    diceMovesList.innerHTML = '';
    if (!game.hasRolled || game.movesLeft.length === 0) return;
    
    // Sort moves descending for neatness
    const sortedMoves = [...game.movesLeft].sort((a,b) => b - a);
    sortedMoves.forEach(val => {
      const token = document.createElement('span');
      token.className = 'move-token';
      token.textContent = val;
      diceMovesList.appendChild(token);
    });
  }

  /**
   * Setup Drag events for checkers.
   */
  function setupDragEvents(checker, source) {
    checker.addEventListener('dragstart', (e) => {
      selectedSource = source;
      
      // Set transfer settings synchronously
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', source.toString());
      
      highlightLegalMoves(source);
      
      // Defer visual styling changes to the next event loop tick
      // to prevent Chrome/Safari from aborting the drag-and-drop operation
      setTimeout(() => {
        checker.classList.add('dragging');
        boardEl.classList.add('dragging-active');
      }, 0);
      
      sysLog(`[Drag] Dragstart on point ${source}. legalDestinations=[${legalDestinations.map(d => d.to).join(', ')}]`);
    });

    checker.addEventListener('dragend', () => {
      checker.classList.remove('dragging');
      boardEl.classList.remove('dragging-active');
      clearHighlights();
      selectedSource = null;
      sysLog(`[Drag] Dragend on point ${source}.`);
    });
  }

  /**
   * Handle Drag Over destination.
   */
  function handleDragOver(e, target) {
    if (legalDestinations.some(d => d.to === target || (target === 'off' && d.to === 'off'))) {
      e.preventDefault(); // allow drop
      e.dataTransfer.dropEffect = 'move';
    }
  }

  /**
   * Handle Drag Drop.
   */
  function handleDrop(e, target) {
    e.preventDefault();
    const sourceVal = selectedSource;
    
    let targetVal = target;
    if (target === 'off') {
      const offMove = legalDestinations.find(d => d.to === 'off');
      if (offMove) targetVal = 'off';
    }

    sysLog(`[Drop] Attempting drag-to-drop from ${sourceVal} to ${targetVal}`);
    if (game.makeMove(sourceVal, targetVal)) {
      sysLog(`[Drop] Drag-to-drop succeeded! remainingMoves=[${game.movesLeft.join(', ')}]`);
      selectedSource = null;
      updateUI();
    } else {
      sysLog(`[Drop] Drag-to-drop failed validation!`);
    }
  }

  /**
  * Handle rolling logic.
*/

function handleRollClick() {
    if (isRolling) return;
    isRolling = true;
    updateUI(); // Locks the dice visually

    // Wait 600ms for the CSS rolling animation to finish
    setTimeout(() => {
      if (initialRollOff) {
        const result = game.rollForFirstTurn();
        // If they didn't roll doubles, the game begins
        if (result.dice[0] !== result.dice[1]) {
          initialRollOff = false;
        } else {
          sysLog("[Roll] Tie! Rolling again...");
        }
      } else {
        game.rollDice();
      }
      isRolling = false;
      updateUI();
    }, 600);
  }
  /**
   * Handle doubling offer logic.
   */
  function handleDoubleOffer() {
    const player = game.currentPlayer;
    if (!game.canDouble(player)) {
      alert("You cannot double right now. You can only double on your turn, before rolling the dice, and if you own the cube.");
      return;
    }
    
    const opponentName = player === 1 ? "Player 2 (Red)" : "Player 1 (White)";
    const proposerName = player === 1 ? "Player 1 (White)" : "Player 2 (Red)";
    
    // Brief timeout to let the UI update if needed
    setTimeout(() => {
      const accept = confirm(`${opponentName}: ${proposerName} is offering to double the stakes. Do you accept? (Declining forfeits the game immediately).`);
      if (accept) {
        game.acceptDouble();
      } else {
        game.declineDouble();
      }
      updateUI();
    }, 50);
  }

  /**
   * Click interaction for points.
   */
  function handlePointClick(pointIdx) {
    if (!gameStarted || game.playerTypes[game.currentPlayer] === 'ai') return;
    const pointState = game.points[pointIdx];
    sysLog(`[Click] Point ${pointIdx} clicked. player=${pointState.player}, count=${pointState.count}, selectedSource=${selectedSource}, activePlayer=${game.currentPlayer}, hasRolled=${game.hasRolled}, movesLeft=${game.movesLeft.length}`);
    
    // 1. If a point is highlighted as a valid destination, execute the move
    const targetMove = legalDestinations.find(d => d.to === pointIdx);
    if (targetMove && selectedSource !== null) {
      sysLog(`[Move] Attempting click-to-move: from=${selectedSource} to=${pointIdx}`);
      if (game.makeMove(selectedSource, pointIdx)) {
        sysLog(`[Move] Click-to-move succeeded! remainingMoves=[${game.movesLeft.join(', ')}]`);
        selectedSource = null;
        clearHighlights();
        updateUI();
      } else {
        sysLog(`[Move] Click-to-move validation rejected!`);
      }
      return;
    }

    // 2. Select source checker
    // Prevent selecting normal checkers if player has checkers on bar
    if (game.hasCheckersOnBar(game.currentPlayer)) {
      sysLog(`[Click] Selection rejected: player has checkers on bar.`);
      return;
    }

    if (pointState.player === game.currentPlayer && game.hasRolled && game.movesLeft.length > 0) {
      clearHighlights();
      selectedSource = pointIdx;
      highlightLegalMoves(pointIdx);
      sysLog(`[Click] Selection set. legalDestinations=[${legalDestinations.map(d => d.to).join(', ')}]`);
      
      const pointEl = document.getElementById(`point-${pointIdx}`);
      pointEl.classList.add('highlight-source');
    } else {
      sysLog(`[Click] Selection cleared.`);
      selectedSource = null;
      clearHighlights();
    }
  }

  /**
   * Click interaction for central bar.
   */
  function handleBarClick(player) {
    if (!gameStarted || game.playerTypes[game.currentPlayer] === 'ai') return;
    if (game.currentPlayer !== player || !game.hasRolled || !game.hasCheckersOnBar(player)) {
      selectedSource = null;
      clearHighlights();
      return;
    }

    clearHighlights();
    selectedSource = "bar";
    highlightLegalMoves("bar");

    const barEl = player === 1 ? barP1El : barP2El;
    barEl.classList.add('highlight-source');
  }

  /**
   * Click interaction for bearing off trays.
   */
  function handleBearOffClick(player) {
    if (!gameStarted || game.playerTypes[game.currentPlayer] === 'ai') return;
    if (game.currentPlayer !== player || selectedSource === null) return;

    // Check if "off" is in legal destinations
    const targetMove = legalDestinations.find(d => d.to === "off");
    if (targetMove) {
      if (game.makeMove(selectedSource, "off")) {
        selectedSource = null;
        clearHighlights();
        updateUI();
      }
    }
  }

  /**
   * Highlight legal destinations.
   */
  function highlightLegalMoves(source) {
    legalDestinations = game.getLegalDestinations(source);
    
    legalDestinations.forEach(dest => {
      if (dest.to === "off") {
        const trayEl = game.currentPlayer === 1 ? bearOffP1 : bearOffP2;
        trayEl.classList.add('highlight-destination');
      } else {
        const pointEl = document.getElementById(`point-${dest.to}`);
        if (pointEl) {
          pointEl.classList.add('highlight-destination');
        }
      }
    });
  }

  /**
   * Clear all board highlights.
   */
  function clearHighlights() {
    legalDestinations = [];
    
    // Clear point highlights
    for (let i = 1; i <= 24; i++) {
      const pointEl = document.getElementById(`point-${i}`);
      pointEl.classList.remove('highlight-source', 'highlight-destination');
    }

    // Clear bar highlights
    barP1El.classList.remove('highlight-source');
    barP2El.classList.remove('highlight-source');

    // Clear bear off highlights
    bearOffP1.classList.remove('highlight-destination');
    bearOffP2.classList.remove('highlight-destination');
  }

  /**
   * Handle undo click.
   */
  function handleUndoClick() {
    if (turnEndTimer) {
      clearTimeout(turnEndTimer);
      turnEndTimer = null;
    }
    if (game.undo()) {
      selectedSource = null;
      clearHighlights();
      updateUI();
    }
  }

  /**
   * Handle reset click.
   */
  function handleResetClick() {
    if (confirm("Are you sure you want to reset the game?")) {
      if (turnEndTimer) {
        clearTimeout(turnEndTimer);
        turnEndTimer = null;
      }
      if (aiActionTimeout) {
        clearTimeout(aiActionTimeout);
        aiActionTimeout = null;
      }
      gameStarted = false;
      isAIPlaying = false;
      document.getElementById('start-menu-overlay').style.display = 'flex';
      game.reset();
      selectedSource = null;
      legalDestinations = [];
      initialRollOff = true;
      isRolling = false;
      renderDie(die1El, 1);
      renderDie(die2El, 1);
      updateUI();
    }
  }

  /**
   * Render history list for time travel replaying.
   */
  function renderHistoryList() {
    sysLog(`[History] Rendering list. count=${game.gameHistory.length}`);
    historyListEl.innerHTML = '';
    
    if (game.gameHistory.length === 0) {
      const emptyEl = document.createElement('div');
      emptyEl.className = 'history-empty';
      emptyEl.style.color = '#9ca3af';
      emptyEl.style.fontStyle = 'italic';
      emptyEl.style.textAlignment = 'center';
      emptyEl.style.padding = '0.5rem 0';
      emptyEl.style.fontSize = '0.8rem';
      emptyEl.textContent = 'No turns played yet.';
      historyListEl.appendChild(emptyEl);
      return;
    }

    // Create compact table
    const table = document.createElement('table');
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';
    table.style.fontSize = '0.75rem';
    table.style.color = '#ffffff';
    table.style.textAlign = 'left';

    // Header (sticky)
    const thead = document.createElement('thead');
    thead.style.position = 'sticky';
    thead.style.top = '0';
    thead.style.background = '#111827';
    thead.style.zIndex = '1';
    
    const headerRow = document.createElement('tr');
    headerRow.style.borderBottom = '1px solid rgba(255, 255, 255, 0.15)';
    headerRow.style.color = '#e5c158';
    headerRow.style.textTransform = 'uppercase';
    headerRow.style.fontSize = '0.65rem';
    headerRow.style.letterSpacing = '0.5px';

    const thNum = document.createElement('th');
    thNum.style.padding = '4px';
    thNum.textContent = '#';
    headerRow.appendChild(thNum);

    const thPlayer = document.createElement('th');
    thPlayer.style.padding = '4px';
    thPlayer.textContent = 'P';
    headerRow.appendChild(thPlayer);

    const thDice = document.createElement('th');
    thDice.style.padding = '4px';
    thDice.textContent = 'Dice';
    headerRow.appendChild(thDice);

    const thMoves = document.createElement('th');
    thMoves.style.padding = '4px';
    thMoves.textContent = 'Moves';
    headerRow.appendChild(thMoves);

    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');

    game.gameHistory.forEach((snapshot, idx) => {
      const row = document.createElement('tr');
      row.style.borderBottom = '1px solid rgba(255, 255, 255, 0.05)';
      row.style.cursor = 'pointer';
      row.style.transition = 'background 0.2s';
      row.title = 'Click to replay from this stage';

      row.addEventListener('mouseenter', () => {
        row.style.background = 'rgba(229, 193, 88, 0.15)';
      });
      row.addEventListener('mouseleave', () => {
        row.style.background = 'transparent';
      });

      row.addEventListener('click', () => {
        if (confirm(`Restore the game to this state? (This deletes all turns after this point).`)) {
          if (turnEndTimer) {
            clearTimeout(turnEndTimer);
            turnEndTimer = null;
          }
          if (game.restoreGameSnapshot(idx)) {
            selectedSource = null;
            clearHighlights();
            initialRollOff = false;
            
            renderDie(die1El, game.dice[0] || 1);
            renderDie(die2El, game.dice[1] || 1);
            
            updateUI();
          }
        }
      });

      // 1. Move/Turn number
      const tdNum = document.createElement('td');
      tdNum.style.padding = '4px';
      tdNum.style.fontWeight = 'bold';
      tdNum.textContent = idx + 1;
      row.appendChild(tdNum);

      // 2. Player (W or R)
      const tdPlayer = document.createElement('td');
      tdPlayer.style.padding = '4px';
      const pCode = snapshot.currentPlayer === 1 ? 'W' : (snapshot.currentPlayer === 2 ? 'R' : '-');
      tdPlayer.textContent = pCode;
      if (pCode === 'W') {
        tdPlayer.style.color = '#ffffff';
        tdPlayer.style.fontWeight = 'bold';
      } else {
        tdPlayer.style.color = '#f87171';
        tdPlayer.style.fontWeight = 'bold';
      }
      row.appendChild(tdPlayer);

      // 3. Dice
      const tdDice = document.createElement('td');
      tdDice.style.padding = '4px';
      tdDice.textContent = snapshot.dice && snapshot.dice[0] > 0 ? `${snapshot.dice[0]}-${snapshot.dice[1]}` : '-';
      row.appendChild(tdDice);

      // 4. Moves (e.g. 24-18 24-23)
      const tdMoves = document.createElement('td');
      tdMoves.style.padding = '4px';
      tdMoves.style.fontFamily = 'monospace';
      
      let movesText = '-';
      if (snapshot.playedMoves && snapshot.playedMoves.length > 0) {
        movesText = snapshot.playedMoves.map(m => {
          const fromStr = m.from === 'bar' ? 'bar' : m.from;
          const toStr = m.to === 'off' ? 'off' : m.to;
          const suffix = m.isHit ? 'bar' : '';
          return `${fromStr}-${toStr}${suffix}`;
        }).join(' ');
      }
      tdMoves.textContent = movesText;
      row.appendChild(tdMoves);

      tbody.appendChild(row);
    });

    table.appendChild(tbody);
    historyListEl.appendChild(table);

    // Auto scroll list
    historyListEl.scrollTop = historyListEl.scrollHeight;
    sysLog(`[History] HTML inside container: ${historyListEl.innerHTML}`);
  }

// Initialize player types but wait for manual start
  game.playerTypes[1] = document.getElementById('p1-type').value;
  game.playerTypes[2] = document.getElementById('p2-type').value;
  gameStarted = false;
  sysLog(`[System] Game ready, waiting for manual start.`);

document.getElementById('btn-start-game').addEventListener('click', () => {
    startGame(false);
});
    
  // Listen for live dropdown changes so players can swap AI in/out mid-game
document.getElementById('p1-type').addEventListener('change', (e) => {
    game.playerTypes[1] = e.target.value;
    sysLog(`[System] White player changed to ${e.target.value}`);
    updateUI(); // Refresh board so checkers instantly become draggable/un-draggable
    checkAndTriggerAITurn();
  });

  document.getElementById('p2-type').addEventListener('change', (e) => {
    game.playerTypes[2] = e.target.value;
    sysLog(`[System] Red player changed to ${e.target.value}`);
    updateUI(); // Refresh board so checkers instantly become draggable/un-draggable
    checkAndTriggerAITurn();
  });

    document.getElementById('board-view').addEventListener('change', (e) => {
    const view = e.target.value;
    const wrapper = document.querySelector('.board-wrapper');
    wrapper.classList.remove('view-red', 'view-home', 'view-outer');
    if (view !== 'white') {
      wrapper.classList.add(`view-${view}`);
    }
    sysLog(`[System] Board view changed to ${view}`);
  });

  /**
   * Triggers the AI routine if it is the AI player's turn.
   */
  function checkAndTriggerAITurn() {
    if (!gameStarted) return;
    if (game.winner) return;
    if (isAIPlaying) return;

      if (isNetworkGame) return; // Completely disable AI routines during network play
      if (game.playerTypes[1] !== 'ai' && game.playerTypes[2] !== 'ai') return; 

      if (initialRollOff) {
      if (!isRolling) {
        sysLog(`[AI] Game start. Automating initial roll decider...`);
        isRolling = true;
        setTimeout(() => {
          isRolling = false;
          handleRollClick();
        }, 300);
      }
      return;
    }

    const pType = game.playerTypes[game.currentPlayer];
    if (pType !== 'ai') return;
    if (isRolling) return;

    if (aiActionTimeout) clearTimeout(aiActionTimeout);

    if (!game.hasRolled) {
      sysLog(`[AI] Player ${game.currentPlayer} (AI) is rolling the dice...`);
      aiActionTimeout = setTimeout(() => {
        aiActionTimeout = null;
        handleRollClick();
      }, 300);
    } else if (game.movesLeft.length > 0 && game.hasLegalMoves()) {
      sysLog(`[AI] Player ${game.currentPlayer} (AI) is thinking...`);
      aiActionTimeout = setTimeout(() => {
        aiActionTimeout = null;
        const bestMoves = game.getBestAIMove();
        if (bestMoves && bestMoves.length > 0) {
          sysLog(`[AI] Chosen move sequence: ${bestMoves.map(m => `${m.from} -> ${m.to}`).join(', ')}`);
          isAIPlaying = true;
          executeAIMovesSequentially(bestMoves, 0);
        } else {
          sysLog(`[AI] No moves chosen (error or blocked).`);
        }
      }, 300);
    }
  }

  /**
   * Animates and executes the AI moves step by step.
   */
  function executeAIMovesSequentially(moves, index) {
    if (index >= moves.length) {
      isAIPlaying = false;
      updateUI();
      return;
    }

    const move = moves[index];
    sysLog(`[AI] Checker move step ${index + 1}/${moves.length}: ${move.from} -> ${move.to}`);

    // Highlight source and target
    clearHighlights();
    if (move.from === 'bar') {
      const barEl = game.currentPlayer === 1 ? barP1El : barP2El;
      barEl.classList.add('highlight-source');
    } else {
      const pt = document.getElementById(`point-${move.from}`);
      if (pt) pt.classList.add('highlight-source');
    }

    if (move.to === 'off') {
      const bearEl = game.currentPlayer === 1 ? bearOffP1 : bearOffP2;
      bearEl.classList.add('highlight-destination');
    } else {
      const pt = document.getElementById(`point-${move.to}`);
      if (pt) pt.classList.add('highlight-destination');
    }

    if (animationOn) {
      // Visual move takes 1 second
      animateCheckerMove(move.from, move.to).then(() => {
        // Execute the move logically in the game engine
        game.makeMove(move.from, move.to);
        clearHighlights();
        updateUI();

        // 0.5 second pause between moves
        setTimeout(() => {
          executeAIMovesSequentially(moves, index + 1);
        }, 500);
      });
    } else {
      // Instant movement
      setTimeout(() => {
        game.makeMove(move.from, move.to);
        clearHighlights();
        updateUI();

        // Very small pause when animation is OFF (e.g. 100ms)
        setTimeout(() => {
          executeAIMovesSequentially(moves, index + 1);
        }, 100);
      }, 50);
    }
  }

  /**
   * Animates a checker physically moving along a curved path in 1 second.
   */
  function animateCheckerMove(from, to) {
    return new Promise((resolve) => {
      let srcEl = null;
      if (from === 'bar') {
        const barContainer = game.currentPlayer === 1 ? barP1El : barP2El;
        const checkers = barContainer.querySelectorAll('.checker');
        if (checkers.length > 0) {
          srcEl = checkers[checkers.length - 1];
        }
      } else {
        const pointEl = document.getElementById(`point-${from}`);
        if (pointEl) {
          const checkers = pointEl.querySelectorAll('.checker');
          if (checkers.length > 0) {
            srcEl = checkers[checkers.length - 1];
          }
        }
      }

      let targetX = 0, targetY = 0;
      let isDestTop = false;
      
      if (to === 'off') {
        const bearEl = game.currentPlayer === 1 ? bearOffP1 : bearOffP2;
        const rect = bearEl.getBoundingClientRect();
        targetX = rect.left + rect.width / 2;
        targetY = rect.top + rect.height / 2;
        isDestTop = (game.currentPlayer === 2); // P2 bears off at top-right
} else {
        const destPointEl = document.getElementById(`point-${to}`);
        if (destPointEl) {
          const rect = destPointEl.getBoundingClientRect();
          const count = game.points[to].count;
          isDestTop = to >= 13;
          const view = document.getElementById('board-view').value;
          
          const margin = 15;
          
          if (view === 'white' || view === 'red') {
            // Standard vertical stacking
            const checkerSize = rect.width * 0.8;
            const offset = count * checkerSize * 0.7;
            targetX = rect.left + rect.width / 2;
            
            if (view === 'white') {
              targetY = isDestTop ? (rect.top + margin + offset) : (rect.bottom - margin - offset);
            } else { // view === 'red'
              targetY = isDestTop ? (rect.bottom - margin - offset) : (rect.top + margin + offset);
            }
          } else {
            // Horizontal stacking for rotated views (home/outer)
            // Use rect.height for size because the triangle is laying flat
            const checkerSize = rect.height * 0.8; 
            const offset = count * checkerSize * 0.7;
            targetY = rect.top + rect.height / 2;
            
            if (view === 'home') {
              // 90deg: Top points are Right, Bottom points are Left
              targetX = isDestTop ? (rect.right - margin - offset) : (rect.left + margin + offset);
            } else { // view === 'outer'
              // -90deg: Top points are Left, Bottom points are Right
              targetX = isDestTop ? (rect.left + margin + offset) : (rect.right - margin - offset);
            }
          }
        }
      }

      if (!srcEl) {
        resolve();
        return;
      }

      const srcRect = srcEl.getBoundingClientRect();
      const startX = srcRect.left + srcRect.width / 2;
      const startY = srcRect.top + srcRect.height / 2;

      // Create a temporary absolute-positioned checker that flies along a curve
      const flyer = document.createElement('div');
      flyer.className = `checker player-${game.currentPlayer}`;
      
      // Copy dimensions and styles
      flyer.style.position = 'fixed';
      flyer.style.width = srcRect.width + 'px';
      flyer.style.height = srcRect.height + 'px';
      flyer.style.left = srcRect.left + 'px';
      flyer.style.top = srcRect.top + 'px';
      flyer.style.zIndex = '999999';
      flyer.style.pointerEvents = 'none';
      flyer.style.boxShadow = '0 12px 30px rgba(0, 0, 0, 0.7)';
      
      // Apply background and borders from computed style to preserve theme
      const compStyle = window.getComputedStyle(srcEl);
      flyer.style.background = compStyle.background;
      flyer.style.border = compStyle.border;
      flyer.style.boxShadow = compStyle.boxShadow;
      
      document.body.appendChild(flyer);

      // Hide original source checker temporarily
      srcEl.style.opacity = '0';

      const startTime = performance.now();
      const duration = 1000; // Exact 1 second movement

      function tick(now) {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Position interpolation
        const currentX = startX + progress * (targetX - startX);
        const currentY = startY + progress * (targetY - startY);

        // Parabolic arc peak height
        const arcHeight = 150;
        const arcOffset = 4 * arcHeight * progress * (1 - progress);

        // Bend towards the horizontal center of the board
// Bend curve based on the current camera view
        let bendY = currentY;
        let bendX = currentX;
        const view = document.getElementById('board-view').value;
        const isLogicalTop = from === 'bar' ? (game.currentPlayer === 1) : (from >= 13);

if (view === 'white') {
          bendY += isLogicalTop ? arcOffset : -arcOffset;
        } else if (view === 'red') {
          bendY += isLogicalTop ? -arcOffset : arcOffset;
        } else if (view === 'home') {
          // Rotated 90deg: Logical Top points are on the Right, bend Left (-X)
          bendX += isLogicalTop ? -arcOffset : arcOffset;
        } else if (view === 'outer') {
          // Rotated -90deg: Logical Top points are on the Left, bend Right (+X)
          bendX += isLogicalTop ? arcOffset : -arcOffset;
        }	  

        flyer.style.left = (bendX - srcRect.width / 2) + 'px';
        flyer.style.top = (bendY - srcRect.height / 2) + 'px';
        if (progress < 1) {
          requestAnimationFrame(tick);
        } else {
          flyer.remove();
          resolve();
        }
      }

      requestAnimationFrame(tick);
    });
  }

/* =========================================
     NETWORK LOGIC (PeerJS)
  ========================================= */
  
  const btnHost = document.getElementById('btn-host');
  const btnJoin = document.getElementById('btn-join');
  const joinCodeInput = document.getElementById('join-code');
  const setupPanel = document.getElementById('network-setup');
  const statusPanel = document.getElementById('network-status');
  const connStatus = document.getElementById('conn-status');
  const roomCodeDisplay = document.getElementById('room-code-display');

  function initNetworkGame(role) {
    isNetworkGame = true;
    localPlayerRole = role;
    game.playerTypes[1] = 'human';
    game.playerTypes[2] = 'human';
    document.getElementById('p1-type').value = 'human';
    document.getElementById('p2-type').value = 'human';
    document.getElementById('p1-type').disabled = true;
    document.getElementById('p2-type').disabled = true;
    setupPanel.style.display = 'none';
    statusPanel.style.display = 'block';
    
    document.getElementById('btn-start-game').disabled = true;
    document.getElementById('btn-start-game').style.opacity = '0.5';
  }

function setupConnectionListeners(connection) {
    sysLog(`[Network] Setting up P2P data channel listeners...`);
    
    const handleOpen = () => {
      sysLog(`[Network] SUCCESS! Data channel is open.`);
      connStatus.textContent = "Connected! Game Active.";
      connStatus.style.color = "#10b981";
      
      if (localPlayerRole === 1) {
        connection.send({ 
            type: 'sync', 
            points: game.points, 
            bar: game.bar, 
            borneOff: game.borneOff 
        });
        document.getElementById('btn-start-game').disabled = false;
        document.getElementById('btn-start-game').style.opacity = '1';
      }
    };

    if (connection.open) handleOpen();
    else connection.on('open', handleOpen);

    // This is the single, correct data listener
    connection.on('data', (data) => {
	sysLog(`[Network] Received: ${data.type}`);

	if (data.type === 'roll_first') {
    isRolling = true;
    updateUI();
    setTimeout(() => {
      game.rollForFirstTurn(data.dice[0], data.dice[1]);
      initialRollOff = (data.dice[0] === data.dice[1]);
      isRolling = false;
      updateUI();
    }, 600);
  }
      
      if (data.type === 'sync') {
          game.points = data.points;
          game.bar = data.bar;
          game.borneOff = data.borneOff;
          updateUI();
      }
      
      if (data.type === 'start') {
          sysLog(`[Network] Start signal received from opponent.`);
          startGame(true); 
      }     
      
      if (data.type === 'roll_first') {
        isRolling = true;
        updateUI();
        setTimeout(() => {
          game.rollForFirstTurn(data.dice[0], data.dice[1]);
          initialRollOff = (data.dice[0] === data.dice[1]);
          isRolling = false;
          updateUI();
        }, 600);
      }
      
      if (data.type === 'roll') {
        isRolling = true;
        updateUI();
        setTimeout(() => {
          game.rollDice(data.dice[0], data.dice[1]);
          isRolling = false;
          updateUI();
        }, 600);
      }

if (data.type === 'move') {
    if (animationOn) {
      animateCheckerMove(data.from, data.to).then(() => {
        game.makeMove(data.from, data.to);
        // If the move completed the turn, switch player
        if (game.movesLeft.length === 0) game.endTurn(); 
        updateUI();
      });
    } else {
      game.makeMove(data.from, data.to);
      // If the move completed the turn, switch player
      if (game.movesLeft.length === 0) game.endTurn(); 
      updateUI();
    }
}

      if (data.type === 'undo') {
        game.undo();
        updateUI();
      }
    });

    connection.on('close', () => {
      connStatus.textContent = "Opponent Disconnected.";
      connStatus.style.color = "#ef4444";
    });
}
    
// --- HOSTING ---
  btnHost.addEventListener('click', () => {
    initNetworkGame(1);
    
    // Explicitly set the host view to 'white'
    document.getElementById('board-view').value = 'white';
    document.getElementById('board-view').dispatchEvent(new Event('change'));

    const roomCode = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    connStatus.textContent = "Waiting for opponent...";
    roomCodeDisplay.style.display = 'block';
    roomCodeDisplay.textContent = roomCode;

    sysLog(`[Network] Connecting to signaling server as Host: pointworks-bg-${roomCode}`);
    
    // Explicitly declaring Google's STUN servers to bypass NAT/Firewalls
    peer = new Peer('pointworks-bg-' + roomCode, {
      config: { 'iceServers': [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]}
    });
    
    peer.on('open', (id) => sysLog(`[Network] Host successfully registered on server! Waiting for Guest...`));
    peer.on('error', (err) => sysLog(`[Network Error] PeerJS Error: ${err.type} - ${err.message}`)); 
    
    peer.on('connection', (connection) => {
      sysLog(`[Network] Incoming connection detected from a Guest!`);
      conn = connection;
      setupConnectionListeners(conn);
    });
  });

  // --- JOINING ---
  btnJoin.addEventListener('click', () => {
    const code = joinCodeInput.value.trim().toUpperCase();
    if (!code) return;
    
    initNetworkGame(2);
    connStatus.textContent = "Connecting to Host...";
    
    // Explicitly set the guest view to 'red'
    document.getElementById('board-view').value = 'red'; 
    document.getElementById('board-view').dispatchEvent(new Event('change'));

    sysLog(`[Network] Connecting to signaling server as Guest...`);
    
    // Explicitly declaring Google's STUN servers to bypass NAT/Firewalls
    peer = new Peer({
      config: { 'iceServers': [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]}
    });
    
    peer.on('error', (err) => sysLog(`[Network Error] PeerJS Error: ${err.type} - ${err.message}`));
    peer.on('open', (id) => {
      sysLog(`[Network] Guest registered on server! Reaching out to room ${code}...`);
      
      conn = peer.connect('pointworks-bg-' + code);
      conn.on('error', (err) => sysLog(`[Network Error] Connection Error: ${err}`));
      setupConnectionListeners(conn);
    });
  });

  // --- BROADCAST HOOKS ---
  const originalMakeMove = game.makeMove.bind(game);
  game.makeMove = function(from, to) {
    const success = originalMakeMove(from, to);
    if (success && isNetworkGame && game.currentPlayer === localPlayerRole) {
       if (conn && conn.open) conn.send({ type: 'move', from, to });
    }
    return success;
  };

  const originalUndo = game.undo.bind(game);
  game.undo = function() {
    const success = originalUndo();
    if (success && isNetworkGame && game.currentPlayer === localPlayerRole) {
      if (conn && conn.open) conn.send({ type: 'undo' });
    }
    return success;
  };

  const originalRollClick = handleRollClick;

// In ui.js
handleRollClick = function() {
    // Only the active player should trigger a roll
    if (isNetworkGame && game.currentPlayer !== localPlayerRole) return; 
    
    if (isRolling) return;
    isRolling = true;
    updateUI(); 

    setTimeout(() => {
      // Host/Guest logic: Roll and send to other
      const result = game.rollDice(); // Generates locally
      if (isNetworkGame && conn && conn.open) {
          conn.send({ type: 'roll', dice: result.dice });
      }
      isRolling = false;
      updateUI();
    }, 600);
};

function startGame(isRemote = false) {
    if (gameStarted) return;
    
    if (!isRemote && isNetworkGame && conn && conn.open) {
        conn.send({ type: 'start' });
    }

    gameStarted = true;
    initialRollOff = true;
    game.currentPlayer = 1; // <--- ADD THIS LINE
    game.hasRolled = false; // <--- ENSURE THIS IS FALSE
    
    const btnStart = document.getElementById('btn-start-game');
    btnStart.disabled = true;
    btnStart.style.opacity = '0.5';
    
    sysLog(`[System] Game started!`);
    updateUI(); 
}

}); // <-- This final closing bracket MUST be the absolute last line of the file!
