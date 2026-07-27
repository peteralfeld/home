/**
 * Backgammon UI Controller
 * Binds DOM events and manages user interactions (clicks, drags, rolls).
 */

document.addEventListener('DOMContentLoaded', () => {

  let isNetworkGame = false;
  let localPlayerRole = null; // 1 = White, 2 = Red
  let peer = null;
  let conn = null;   

  // --- NEW NETWORK QUEUE SYSTEM ---
  let networkQueue = [];
  let isProcessingQueue = false;

  // Compact board signature (points + bar + off) for desync detection/logging.
  function boardSig(points, bar, borneOff) {
    const pts = points.map((p, i) => (p.count > 0 ? `${i}:${p.player}(${p.count})` : '')).filter(Boolean).join(',');
    return `${pts} | bar ${bar[1]}/${bar[2]} | off ${borneOff[1]}/${borneOff[2]}`;
  }

  function processNetworkQueue() {
    if (isProcessingQueue || networkQueue.length === 0) return;
    isProcessingQueue = true;
    
    const action = networkQueue.shift();
    
    if (action.type === 'move') {
        // Apply the opponent's move faithfully. The sender already enforced all rules
        // (including maximum-usage); the receiver must NOT re-validate, or a disagreement
        // would silently drop the move and desync the boards. Pass validateMax=false.
        if (animationOn) {
          animateCheckerMove(action.data.from, action.data.to).then(() => {
            game.makeMove(action.data.from, action.data.to, false);
            updateUI();
            isProcessingQueue = false;
            processNetworkQueue(); // Process next in queue
          });
        } else {
          game.makeMove(action.data.from, action.data.to, false);
          updateUI();
          isProcessingQueue = false;
          processNetworkQueue();
        }
    } else if (action.type === 'undo') {
        game.undo();
        updateUI();
        isProcessingQueue = false;
        processNetworkQueue();
    } else if (action.type === 'end_turn') {
        game.endTurn();
        // Reconcile to the sender's authoritative board (self-healing against any desync).
        if (action.data && action.data.points) {
          const mine = boardSig(game.points, game.bar, game.borneOff);
          const auth = boardSig(action.data.points, action.data.bar, action.data.borneOff);
          if (mine !== auth) {
            sysLog(`[Desync] Board mismatch after turn ${game.turnCount} — reconciling to opponent's board.`);
            sysLog(`[Desync]   mine: ${mine}`);
            sysLog(`[Desync]   auth: ${auth}`);
          }
          game.points = action.data.points;
          game.bar = action.data.bar;
          game.borneOff = action.data.borneOff;
          if (action.data.cubeValue !== undefined) game.doublingCubeValue = action.data.cubeValue;
          if (action.data.cubeOwner !== undefined) game.doublingCubeOwner = action.data.cubeOwner;
          game.checkWinner();
        }
        updateUI();
        isProcessingQueue = false;
        processNetworkQueue();
    }
  }
  // --------------------------------

  const game = new BackgammonGame();
  
  // DOM Elements
  const boardEl = document.getElementById('backgammon-board');
  const diceContainerEl = document.getElementById('dice-container');
  const btnUndo = document.getElementById('btn-undo');
  const die1El = document.getElementById('die-1');
  const die2El = document.getElementById('die-2');
  const gameMessageEl = document.getElementById('game-message');
  const turnDisplay = document.getElementById('turn-display');
  const turnText = document.getElementById('turn-text');
  const barP1El = document.getElementById('bar-p1');
  const barP2El = document.getElementById('bar-p2');
  const historyListEl = document.getElementById('history-list');
  const bearOffP1 = document.getElementById('bear-off-p1');
  const bearOffP2 = document.getElementById('bear-off-p2');
  
  // Doubling Cube DOM Elements
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

  // Doubling: when a double is pending, { by: <player who offered> }.
  // While set, the dice are locked; the doubled player clicks the dice to accept
  // or the cube to decline.
  let pendingDouble = null;
  const opponentOf = (p) => (p === 1 ? 2 : 1);
  // Show Score (default ON): score column in the move list and the exported list.
  // Declared early because renderHistoryList() reads it during the first render.
  let showScoreOn = true;

  // Speak (default ON): read important instruction lines aloud (doubling offer, game over).
  let speakOn = true;
  let lastSpoken = '';
  let preferredVoice = null;
  // Pick a female English voice if one is available (voices may load asynchronously).
  function pickSpeechVoice() {
    if (!('speechSynthesis' in window)) return;
    const voices = window.speechSynthesis.getVoices();
    if (!voices.length) return;
    const female = /female|zira|hazel|samantha|susan|victoria|karen|moira|tessa|fiona|serena|catherine|google uk english female|google us english/i;
    preferredVoice =
      voices.find((v) => /^en/i.test(v.lang) && female.test(v.name)) ||
      voices.find((v) => female.test(v.name)) ||
      voices.find((v) => /^en/i.test(v.lang)) ||
      voices[0];
  }
  if ('speechSynthesis' in window) {
    pickSpeechVoice();
    window.speechSynthesis.onvoiceschanged = pickSpeechVoice;
  }
  function speakImportant(text) {
    if (!text) { lastSpoken = ''; return; }         // nothing important on screen now
    if (!speakOn || text === lastSpoken) return;    // off, or already said this line
    lastSpoken = text;
    if (!('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      if (preferredVoice) u.voice = preferredVoice;
      window.speechSynthesis.speak(u);
    } catch (e) { /* ignore speech errors */ }
  }
  let aiStopped   = false;  // true while AI is manually paused via STOP button
  let highlightOn = true;
  let autoRollOn  = false;
  let autoRollTimeout = null;
  let autoMoveOn  = false;

  // ── History Navigation state ────────────────────────────────────────
  // historyNavBuffer: deep-copy of the full game history captured when
  //   navigation starts, so forward navigation (> and >>) always works
  //   even after game.gameHistory has been truncated by restoreGameSnapshot.
  // historyNavIndex: null = showing live game state, 0..N-1 = viewing that slot.
  let historyNavBuffer = [];
  let historyNavIndex  = null;
  // ────────────────────────────────────────────────────────────────────

  // In-memory log buffer — written by sysLog, downloadable via Export > Console Log
  const consoleLog = [];

function sysLog(msg) {
    const time = new Date().toTimeString().slice(0, 8);
    consoleLog.push(`[${time}] ${msg}`);
    console.log(msg);
  }

/**
   * Update a settings badge to reflect current on/off state.
   */
  function updateSettingBadge(badgeId, isOn) {
    const badge = document.getElementById(badgeId);
    if (!badge) return;
    badge.textContent = isOn ? 'ON' : 'OFF';
    badge.classList.toggle('on', isOn);
    badge.classList.toggle('off', !isOn);
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
    if (!gameStarted) {
      // Auto Start: a dice click starts a local game (no need to click Start first);
      // for a human it also performs the opening roll so one click gets you going.
      if (autoStartOn && !isNetworkGame) {
        startGame(false);
        if (game.playerTypes[game.currentPlayer] !== 'ai' && !isRolling) handleRollClick();
      }
      return;
    }
    // A pending double: the doubled player clicks the dice to ACCEPT.
    if (pendingDouble) {
      const responder = opponentOf(pendingDouble.by);
      if (isNetworkGame && localPlayerRole !== responder) return; // only the doubled player responds
      if (isNetworkGame && conn && conn.open) conn.send({ type: 'accept' });
      applyAcceptDouble();
      return;
    }
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
  // Restart Button Listener — delegates to handleRestartClick() for correct network sync
  const btnRestart = document.getElementById('btn-restart');
  if (btnRestart) {
    btnRestart.addEventListener('click', () => handleRestartClick());
  }


// ── Export Menu ────────────────────────────────────────────
  const exportHeader  = document.getElementById('export-header');
  const exportPanel   = document.getElementById('export-panel');
  const exportChevron = document.getElementById('export-chevron');

  if (exportHeader) {
    exportHeader.addEventListener('click', () => {
      const isOpen = exportPanel.classList.toggle('open');
      exportChevron.classList.toggle('open', isOpen);
    });
  }

  // Screen Image
  const exportScreenEl = document.getElementById('export-screen');
  if (exportScreenEl) {
    exportScreenEl.addEventListener('click', async () => {
      const label = exportScreenEl.querySelector('.settings-item-label');
      const original = label.textContent;
      label.textContent = 'Selecting Tab…';

      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          preferCurrentTab: true,
          video: { displaySurface: 'browser' }
        });
        label.textContent = 'Capturing…';

        const video = document.createElement('video');
        video.srcObject = stream;
        await new Promise(resolve => {
          video.onloadedmetadata = () => { video.play(); resolve(); };
        });

        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
        stream.getTracks().forEach(t => t.stop());

        const link = document.createElement('a');
        link.download = `bg-screenshot-${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();

        sysLog('[System] Screenshot captured and downloaded.');
        label.textContent = original;

      } catch (err) {
        sysLog(`[Error] Screenshot failed: ${err.message}`);
        label.textContent = 'Cancelled';
        setTimeout(() => { label.textContent = original; }, 2000);
      }
    });
  }

  // Move List
  const exportMovesEl = document.getElementById('export-moves');
  if (exportMovesEl) {
    exportMovesEl.addEventListener('click', () => {
      if (game.gameHistory.length === 0) { alert('No moves have been played yet!'); return; }

      const now   = new Date();
      const p1Type = game.playerTypes[1].charAt(0).toUpperCase() + game.playerTypes[1].slice(1);
      const p2Type = game.playerTypes[2].charAt(0).toUpperCase() + game.playerTypes[2].slice(1);

      const withScore = showScoreOn;
      let txt = 'Backgammon Game - Move History\n';
      txt += `Date: ${now.toLocaleDateString()} ${now.toLocaleTimeString()}\n`;
      txt += `White: ${p1Type}, Red: ${p2Type}\n\n`;
      txt += withScore
        ? 'Turn  Player  Dice   ' + 'Moves'.padEnd(20) + ' Score\n\n'
        : 'Turn  Player  Dice   Moves\n\n';

      game.gameHistory.forEach((snap, idx) => {
        const turnNum = String(idx).padStart(4, ' '); // idx 0 is initial, so idx 1 becomes Turn 1
        const pCode   = snap.currentPlayer === 1 ? 'White' : 'Red  ';
        const diceStr = snap.isInitial ? ' -   ' : `${snap.dice[0] || '-'}-${snap.dice[1] || '-'}`.padEnd(5, ' ');

        let movesText = '-';
        if (snap.playedMoves?.length > 0) {
          // Magriel notation with grouping
          const groups = [];
          for (const m of snap.playedMoves) {
            const key  = `${m.from}/${m.to}${m.isHit ? '*' : ''}`;
            const last = groups[groups.length - 1];
            if (last && last.key === key) { last.count++; }
            else { groups.push({ key, count: 1 }); }
          }
          movesText = groups.map(g => g.count > 1 ? `${g.key}(${g.count})` : g.key).join(' ');
        }
        if (withScore) {
          const scoreStr = String(Math.round(snapshotScore(snap))).padStart(6, ' ');
          txt += `${turnNum}  ${pCode}   ${diceStr}  ${movesText.padEnd(20, ' ')} ${scoreStr}\n`;
        } else {
          txt += `${turnNum}  ${pCode}   ${diceStr}  ${movesText}\n`;
        }
      });

      txt += '\n';
      if (!game.winner) {
        txt += 'Game in progress\n';
      } else {
        const winnerStr = game.winner === 1 ? 'White' : 'Red';
        const loserStr  = game.winner === 1 ? 'Red'   : 'White';
        const loserIdx  = game.winner === 1 ? 2 : 1;
        let winType = 'defeated';
        if (!game.winByDecline && game.borneOff[loserIdx] === 0) {
          winType = 'gammoned';
          let isBackgammon = game.bar[loserIdx] > 0;
          if (!isBackgammon) {
            const s = game.winner === 1 ? 1 : 19, e = game.winner === 1 ? 6 : 24;
            for (let i = s; i <= e; i++) {
              if (game.points[i].player === loserIdx) { isBackgammon = true; break; }
            }
          }
          if (isBackgammon) winType = 'backgammoned';
        }
        txt += ` ${winnerStr} ${winType} ${loserStr}\n`;
      }

      const link = document.createElement('a');
      link.download = `backgammon-moves-${Date.now()}.txt`;
      link.href = URL.createObjectURL(new Blob([txt], { type: 'text/plain' }));
      link.click();
      sysLog('[System] Move list downloaded.');
    });
  }

  // Console Log
  const exportConsoleEl = document.getElementById('export-console');
  if (exportConsoleEl) {
    exportConsoleEl.addEventListener('click', () => {
      if (consoleLog.length === 0) { alert('Console log is empty.'); return; }
      const link = document.createElement('a');
      link.download = `backgammon-console-${Date.now()}.txt`;
      link.href = URL.createObjectURL(new Blob([consoleLog.join('\n')], { type: 'text/plain' }));
      link.click();
      sysLog('[System] Console log downloaded.');
    });
  }

  // Board Value — per-feature evaluation breakdown of the current position.
  const exportBoardEl = document.getElementById('export-boardvalue');
  if (exportBoardEl) {
    exportBoardEl.addEventListener('click', () => {
      const onRoll = game.currentPlayer || 1;
      const weights = scoringWeights(onRoll);
      const bd = game.evaluateBreakdown(game.points, game.bar, game.borneOff, weights);
      const onRollColor = onRoll === 1 ? 'White' : 'Red';
      const ownScore = onRoll === 1 ? bd.score : -bd.score;
      const now = new Date();

      let csv = 'Backgammon Board Value\n';
      csv += `Date:,${now.toLocaleDateString()} ${now.toLocaleTimeString()}\n`;
      csv += `AI player (weights used):,${scoringAIName(onRoll)}\n`;
      csv += `On roll:,${onRollColor}\n`;
      csv += `Phase:,${bd.contact ? 'Contact' : 'Race (no contact)'}\n`;
      csv += `Position:,"${describeBoard()}"\n\n`;

      csv += 'Terms are contributions to the White-view score (+ = good for White).\n';
      csv += 'Code,Meaning,White,Red,Value v,Weight w,Term (w x v)\n';
      bd.rows.forEach((r) => {
        csv += `${r.code},"${r.meaning}",${r.white},${r.red},${r.v.toFixed(3)},${r.weight},${Math.round(r.term)}\n`;
      });
      csv += `DE,"Disengagement bonus (move-only, not in static score)",,,0,${weights.DE},0\n`;
      csv += '\n';
      csv += `,,,,,Score (White view):,${bd.score}\n`;
      if (onRoll === 2) csv += `,,,,,Score (Red view):,${ownScore}\n`;

      const canDbl = game.canDouble(onRoll);
      const wouldTake = ownScore > -(weights.AT || 0);
      let dbl;
      if (canDbl && ownScore > (weights.DT || 0)) dbl = `Double now (score ${ownScore} > DT ${weights.DT}).`;
      else if (canDbl) dbl = `Do not double (score ${ownScore} <= DT ${weights.DT}).`;
      else dbl = `Cannot double now (only on your turn, before rolling, if you hold/share the cube).`;
      dbl += ` If offered a double: ${wouldTake ? 'take' : 'drop'} (score ${ownScore} vs -AT ${-(weights.AT || 0)}).`;
      csv += `,,,,,Doubling:,"${dbl}"\n`;
      csv += `,,,,,DE note:,"Disengagement bonus +/-${weights.DE} applies only to a move that breaks contact while ahead in pips; it is not part of a static position's value."\n`;

      downloadCSV('BoardValue.csv', csv);
      gameMessageEl.textContent = `Board value exported — ${onRollColor} view: ${ownScore}.`;
      sysLog('[System] Board value exported.');
    });
  }
    // ── Settings Menu ────────────────────────────────────────────
  const settingsHeader  = document.getElementById('settings-header');
  const settingsPanel   = document.getElementById('settings-panel');
  const settingsChevron = document.getElementById('settings-chevron');

  // Doubling on/off (default ON). When off, clicking the cube offers nothing.
  let doublingOn = true;
  // Auto Start (default OFF). When on, clicking the dice with no game running starts it.
  let autoStartOn = false;

  // Initialise badges to their defaults
  updateSettingBadge('badge-doubling', doublingOn);
  updateSettingBadge('badge-autostart', autoStartOn);
  updateSettingBadge('badge-showscore', showScoreOn);
  updateSettingBadge('badge-speak', speakOn);
  updateSettingBadge('badge-animation', animationOn);
  updateSettingBadge('badge-highlight',  highlightOn);
  updateSettingBadge('badge-autoroll',   autoRollOn);
  updateSettingBadge('badge-automove',   autoMoveOn);

  // Header click → open / close panel
  if (settingsHeader) {
    settingsHeader.addEventListener('click', () => {
      const isOpen = settingsPanel.classList.toggle('open');
      settingsChevron.classList.toggle('open', isOpen);
    });
  }

  // Animation row
  const settingAnimEl = document.getElementById('setting-animation');
  if (settingAnimEl) {
    settingAnimEl.addEventListener('click', () => {
      animationOn = !animationOn;
      updateSettingBadge('badge-animation', animationOn);
      sysLog(`[System] Animation toggled to ${animationOn ? 'ON' : 'OFF'}`);
    });
  }

  // Highlight row
  const settingHighlightEl = document.getElementById('setting-highlight');
  if (settingHighlightEl) {
    settingHighlightEl.addEventListener('click', () => {
      highlightOn = !highlightOn;
      updateSettingBadge('badge-highlight', highlightOn);
      sysLog(`[System] Highlight toggled to ${highlightOn ? 'ON' : 'OFF'}`);
      if (!highlightOn) {
        clearHighlights();
      } else if (selectedSource !== null) {
        highlightLegalMoves(selectedSource);
      }
    });
  }

  // Auto Roll row
  const settingAutorollEl = document.getElementById('setting-autoroll');
  if (settingAutorollEl) {
    settingAutorollEl.addEventListener('click', () => {
      autoRollOn = !autoRollOn;
      updateSettingBadge('badge-autoroll', autoRollOn);
      sysLog(`[System] Auto Roll toggled to ${autoRollOn ? 'ON' : 'OFF'}`);
      // If just enabled and dice are waiting, trigger immediately
      if (autoRollOn) checkAndAutoRoll();
    });
  }

  // Auto Move row
  const settingAutomoveEl = document.getElementById('setting-automove');
  if (settingAutomoveEl) {
    settingAutomoveEl.addEventListener('click', () => {
      autoMoveOn = !autoMoveOn;
      updateSettingBadge('badge-automove', autoMoveOn);
      sysLog(`[System] Auto Move toggled to ${autoMoveOn ? 'ON' : 'OFF'}`);
    });
  }

  // Doubling row
  const settingDoublingEl = document.getElementById('setting-doubling');
  if (settingDoublingEl) {
    settingDoublingEl.addEventListener('click', () => {
      doublingOn = !doublingOn;
      updateSettingBadge('badge-doubling', doublingOn);
      sysLog(`[System] Doubling toggled to ${doublingOn ? 'ON' : 'OFF'}`);
    });
  }

  // Auto Start row
  const settingAutostartEl = document.getElementById('setting-autostart');
  if (settingAutostartEl) {
    settingAutostartEl.addEventListener('click', () => {
      autoStartOn = !autoStartOn;
      updateSettingBadge('badge-autostart', autoStartOn);
      sysLog(`[System] Auto Start toggled to ${autoStartOn ? 'ON' : 'OFF'}`);
    });
  }

  // Show Score row
  const settingShowscoreEl = document.getElementById('setting-showscore');
  if (settingShowscoreEl) {
    settingShowscoreEl.addEventListener('click', () => {
      showScoreOn = !showScoreOn;
      updateSettingBadge('badge-showscore', showScoreOn);
      sysLog(`[System] Show Score toggled to ${showScoreOn ? 'ON' : 'OFF'}`);
      renderHistoryList();
    });
  }

  // Speak row
  const settingSpeakEl = document.getElementById('setting-speak');
  if (settingSpeakEl) {
    settingSpeakEl.addEventListener('click', () => {
      speakOn = !speakOn;
      updateSettingBadge('badge-speak', speakOn);
      sysLog(`[System] Speak toggled to ${speakOn ? 'ON' : 'OFF'}`);
      if (!speakOn && 'speechSynthesis' in window) window.speechSynthesis.cancel();
    });
  }

  doublingCubeEl.addEventListener('click', () => {
    if (!gameStarted) return;
    // A pending double: the doubled player clicks the cube to DECLINE (forfeit).
    if (pendingDouble) {
      const responder = opponentOf(pendingDouble.by);
      if (isNetworkGame && localPlayerRole !== responder) return; // only the doubled player responds
      if (isNetworkGame && conn && conn.open) conn.send({ type: 'decline' });
      applyDeclineDouble();
      return;
    }
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
    
// Render dice faces dynamically based on unused moves
    if (!isRolling) {
      if (game.hasRolled) {
        let moves = [...game.movesLeft];
        let d1Val = 0, d2Val = 0;

        if (game.dice[0] === game.dice[1]) {
          // Doubles: Show both dice if 2 or more moves remain. Show one if 1 move remains.
          if (moves.length >= 2) {
            d1Val = game.dice[0];
            d2Val = game.dice[1];
          } else if (moves.length === 1) {
            d1Val = 0;
            d2Val = game.dice[1]; // Keep the second die visible for the final move
          }
        } else {
          // Normal roll: Check if the specific die value is still in the unused moves list
          const idx1 = moves.indexOf(game.dice[0]);
          if (idx1 !== -1) {
            d1Val = game.dice[0];
            moves.splice(idx1, 1); // Remove from tracking array to prevent double counting
          }
          
          const idx2 = moves.indexOf(game.dice[1]);
          if (idx2 !== -1) {
            d2Val = game.dice[1];
            moves.splice(idx2, 1);
          }
        }
        
        // renderDie automatically draws a blank face with no pips if passed 0
        renderDie(die1El, d1Val);
        renderDie(die2El, d2Val);
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

      // 5. Update header turn indicator
    if (turnDisplay && turnText) {
      if (game.currentPlayer) {
        turnDisplay.style.display = 'flex';
        if (game.currentPlayer === 1) {
          turnDisplay.className = 'player-turn-indicator player1-turn';
          turnText.textContent = `White's Turn`;
          document.body.classList.remove('player2-turn-active');
        } else {
          turnDisplay.className = 'player-turn-indicator player2-turn';
          turnText.textContent = `Red's Turn`;
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
      
    // 7. Enable/disable undo button
    btnUndo.disabled = game.turnHistory.length <= 1;

// 7b. Update Doubling Cube DOM elements
    if (doublingCubeEl) {
      doublingCubeEl.classList.remove('owned-p1', 'owned-p2', 'double-pending');

      if (pendingDouble) {
        // Show the offered (doubled) stake in the taker's colour while awaiting a decision.
        const offered = game.doublingCubeValue === 1 ? 2 : game.doublingCubeValue * 2;
        doublingCubeEl.textContent = offered;
        const responder = opponentOf(pendingDouble.by);
        doublingCubeEl.classList.add(responder === 1 ? 'owned-p1' : 'owned-p2', 'double-pending');
      } else {
        doublingCubeEl.textContent = game.doublingCubeValue === 1 ? "64" : game.doublingCubeValue;
        if (game.doublingCubeOwner === 1) doublingCubeEl.classList.add('owned-p1');
        else if (game.doublingCubeOwner === 2) doublingCubeEl.classList.add('owned-p2');
      }
    }

      // 7c. Update dice container styling classes (rollable/initial-roll-off)
    const canRoll = (!game.hasRolled || initialRollOff) && !pendingDouble;
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
    renderHistoryList();

// 8. Handle messages and turn advancement
    if (pendingDouble) {
      const offered = game.doublingCubeValue === 1 ? 2 : game.doublingCubeValue * 2;
      const responder = opponentOf(pendingDouble.by);
      const byName = pendingDouble.by === 1 ? 'White' : 'Red';
      const respName = responder === 1 ? 'White' : 'Red';
      if (isNetworkGame && localPlayerRole === pendingDouble.by) {
        gameMessageEl.textContent = `You doubled to ${offered}. Waiting for ${respName}…`;
      } else {
        gameMessageEl.textContent = `${byName} Doubles. ${respName}, press the playing cubes to accept the double, or the doubling cube to reject it, and resign.`;
      }
      btnUndo.disabled = true;
    } else if (game.winner) {
      const winner = game.winner;
      const loser = winner === 1 ? 2 : 1;
      const winnerName = winner === 1 ? 'White' : 'Red';
      const loserName  = winner === 1 ? 'Red' : 'White';
      // Result multiplier: 1 = single, 2 = gammon, 3 = backgammon.
      // A declined double is always a plain single at the current cube value —
      // skip the gammon/backgammon test (the loser has borne off nothing and has
      // checkers all over the board, which would otherwise read as a backgammon).
      let mult = 1, verb = 'defeats';
      if (!game.winByDecline && game.borneOff[loser] === 0) {
        // Loser bore off nothing → at least a gammon; a backgammon if the loser
        // still has a checker on the bar or in the winner's home board.
        const homeLo = winner === 1 ? 1 : 19;
        const homeHi = winner === 1 ? 6 : 24;
        let inWinnerHome = game.bar[loser] > 0;
        for (let i = homeLo; i <= homeHi && !inWinnerHome; i++) {
          if (game.points[i].player === loser) inWinnerHome = true;
        }
        if (inWinnerHome) { mult = 3; verb = 'backgammons'; }
        else { mult = 2; verb = 'gammons'; }
      }
      const pts = game.doublingCubeValue * mult;
      gameMessageEl.textContent = game.winByDecline
        ? `Game over! ${loserName} declined the double. ${winnerName} wins ${pts} point${pts === 1 ? '' : 's'}.`
        : `Game over! ${winnerName} ${verb} ${loserName} and wins ${pts} point${pts === 1 ? '' : 's'}.`;
      btnUndo.disabled = true;
    } else if (!gameStarted) {
      // UPDATE: Show waiting message for guest, standard message for host
      if (isNetworkGame && localPlayerRole === 2) {
        gameMessageEl.textContent = "Waiting for the host to start the game...";
      } else {
        gameMessageEl.textContent = "Ready to go! To play, select players and click on Start";
      }
    } else if (initialRollOff) {
      gameMessageEl.textContent = "Click the dice to decide who starts!";
    } else if (!game.hasRolled) {
	gameMessageEl.textContent = `${game.currentPlayer === 1 ? 'White' : 'Red'}: Click the dice to roll.`;
} else {
      if (game.movesLeft.length === 0) {
        gameMessageEl.textContent = "Turn completed! Switching players...";
        
        // ADD THIS: Only the active player is allowed to auto-end the turn!
        if (isNetworkGame && game.currentPlayer !== localPlayerRole) return;

        if (turnEndTimer) clearTimeout(turnEndTimer);
        turnEndTimer = setTimeout(() => {
          turnEndTimer = null;
          game.endTurn();
          updateUI();
        }, 100);
} else if (!game.hasLegalMoves()) {
  gameMessageEl.textContent = "No legal moves possible! Switching players...";
  
  // Let the rolled dice stay visible on the screen!
  
  // 2. Only the active player is allowed to auto-end the turn!
  if (isNetworkGame && game.currentPlayer !== localPlayerRole) return;

  if (turnEndTimer) clearTimeout(turnEndTimer);
  
  // 3. Wait two seconds before ending the turn so players can read the dice
  turnEndTimer = setTimeout(() => {
    turnEndTimer = null;
    game.endTurn();
    updateUI();
  }, 2000); 
      } else {
          if (turnEndTimer) {
          clearTimeout(turnEndTimer);
          turnEndTimer = null;
        }
        gameMessageEl.textContent = `${game.currentPlayer === 1 ? 'White' : 'Red'} to move`;
      }
    }

    // Speak important lines aloud (doubling offer, game over). Never speak a doubling
    // prompt aimed at an AI responder — the AI answers on its own.
    if (game.winner) {
      speakImportant(gameMessageEl.textContent);
    } else if (pendingDouble
               && game.playerTypes[opponentOf(pendingDouble.by)] === 'human') {
      // Speak the doubling prompt on BOTH machines in a network game: the responder
      // hears "…DOUBLE. Click the dice…" and the offerer hears their own "You doubled
      // to N. Waiting…" line. (Suppressed only when the responder is an AI, which
      // answers on its own.)
      speakImportant(gameMessageEl.textContent);
    } else {
      speakImportant(null);
    }

    if (gameStarted) {
      checkAndTriggerAITurn();
      checkAndAutoRoll();
    }

    // Keep nav buttons in sync with current state
    updateNavButtons();
  }

  /**
   * Auto-roll dice for a human player when autoRollOn is enabled.
   * Fires after a short delay so the board finishes rendering first.
   */
  function checkAndAutoRoll() {
    if (!autoRollOn) return;
    if (!gameStarted) return;
    if (game.winner) return;
    if (pendingDouble) return;   // don't auto-roll while a double is pending
    if (game.hasRolled && !initialRollOff) return;  // already rolled
    if (isRolling) return;                           // animation in progress
    if (game.playerTypes[game.currentPlayer] === 'ai') return; // AI handles its own roll
    if (isNetworkGame && game.currentPlayer !== localPlayerRole) return;

    // Cancel any pending auto-roll before scheduling a new one
    if (autoRollTimeout) clearTimeout(autoRollTimeout);

    autoRollTimeout = setTimeout(() => {
      autoRollTimeout = null;
      // Re-check guards inside the timeout (state may have changed)
      if (!autoRollOn) return;
      if (game.hasRolled && !initialRollOff) return;
      if (isRolling) return;
      if (game.playerTypes[game.currentPlayer] === 'ai') return;
      handleRollClick();
    }, 400);
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
    bearOffP1.innerHTML = '';
    bearOffP2.innerHTML = '';

    for (let c = 0; c < game.borneOff[1]; c++) {
      const slab = document.createElement('div');
      slab.className = 'borne-checker player-1';
      bearOffP1.appendChild(slab);
    }

    for (let c = 0; c < game.borneOff[2]; c++) {
      const slab = document.createElement('div');
      slab.className = 'borne-checker player-2';
      bearOffP2.appendChild(slab);
    }
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
   * If a rejected move was individually legal but disallowed by the maximum-usage
   * rule, explain it in the instruction line. Returns true if such a message shown.
   */
  function notifyIfMaxBlocked(source, target) {
    const raw = game.getRawDestinations(source);
    if (!raw.some((d) => d.to === target)) return false;   // plain illegal, not a max-usage block
    const msg = game.maxUsageMessage() || 'You must play the maximum number of dice possible.';
    gameMessageEl.textContent = msg;
    speakImportant(msg);
    sysLog(`[Rule] Move ${source} -> ${target} blocked by the maximum-usage rule.`);
    return true;
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
      exitNavMode(); // player took a game action — exit history view
      sysLog(`[Drop] Drag-to-drop succeeded! remainingMoves=[${game.movesLeft.join(', ')}]`);
      selectedSource = null;
      updateUI();
    } else {
      sysLog(`[Drop] Drag-to-drop failed validation!`);
      notifyIfMaxBlocked(sourceVal, targetVal);
    }
  }

  /**
  * Handle rolling logic.
*/

function handleRollClick() {
    if (isRolling) return;
    if (pendingDouble) return;   // dice are locked until the double is resolved
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
   * A player (on roll, owning or sharing the cube) offers a double by clicking the cube.
   * This locks the dice and hands the decision to the opponent. Nothing is committed to
   * the cube until the opponent accepts.
   */
  function handleDoubleOffer() {
    if (pendingDouble) return;
    if (!doublingOn) {                                          // doubling disabled in Settings
      gameMessageEl.textContent = "Enable doubling in the settings!";
      return;
    }
    if (!gameStarted || initialRollOff) return;
    const player = game.currentPlayer;
    if (game.playerTypes[player] === 'ai') return;             // humans double, not the AI (yet)
    if (isNetworkGame && localPlayerRole !== player) return;    // only the player on roll may offer
    // Doubling is only legal on your turn before rolling (and if you hold/share the cube).
    // At any other time the cube click is simply ignored — no popup.
    if (!game.canDouble(player)) return;

    pendingDouble = { by: player };
    if (isNetworkGame && conn && conn.open) conn.send({ type: 'double' });
    updateUI();

    // Local game vs an AI opponent: the AI answers immediately.
    const responder = opponentOf(player);
    if (!isNetworkGame && game.playerTypes[responder] === 'ai') {
      setTimeout(() => {
        if (!pendingDouble) return;
        if (game.aiShouldAcceptDouble(responder)) applyAcceptDouble();
        else applyDeclineDouble();
      }, 700);
    }
  }

  /** Commit an accepted double (cube value doubles, ownership passes to the taker). */
  function applyAcceptDouble() {
    if (!pendingDouble) return;
    game.acceptDouble();
    pendingDouble = null;
    updateUI();
  }

  /** Commit a declined double: the doubler wins the current stake, game over. */
  function applyDeclineDouble() {
    if (!pendingDouble) return;
    game.declineDouble();
    pendingDouble = null;
    updateUI();
  }
/**
   * Click interaction for points.
   */
  function handlePointClick(pointIdx) {
    if (!gameStarted || game.playerTypes[game.currentPlayer] === 'ai') return;
    if (isNetworkGame && game.currentPlayer !== localPlayerRole) return;
    const pointState = game.points[pointIdx];
    sysLog(`[Click] Point ${pointIdx} clicked. player=${pointState.player}, count=${pointState.count}, selectedSource=${selectedSource}, activePlayer=${game.currentPlayer}, hasRolled=${game.hasRolled}, movesLeft=${game.movesLeft.length}`);
    
    // 1. If we already have a selected source, treat this click as a "drop"
    if (selectedSource !== null) {
      sysLog(`[Click] Target selected: ${pointIdx}. Attempting move.`);
      if (game.makeMove(selectedSource, pointIdx)) {
        selectedSource = null;
        clearHighlights();
        updateUI();
        return; // Move succeeded, exit
      }
      // Move rejected — if it was blocked by the maximum-usage rule, say so and keep
      // the current selection so the player can pick a different destination.
      if (notifyIfMaxBlocked(selectedSource, pointIdx)) return;
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

      // Auto Move: if exactly one destination exists, execute it immediately
      if (autoMoveOn && legalDestinations.length === 1) {
        executeAutoMove(pointIdx, legalDestinations[0].to);
        return;
      }

      // ONLY apply the visual highlight if the toggle is on
      if (highlightOn) {
        const pointEl = document.getElementById(`point-${pointIdx}`);
        pointEl.classList.add('highlight-source');
      }
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
    if (isNetworkGame && game.currentPlayer !== localPlayerRole) return;
    if (game.currentPlayer !== player || !game.hasRolled || !game.hasCheckersOnBar(player)) {
      selectedSource = null;
      clearHighlights();
      return;
    }

    clearHighlights();
    selectedSource = "bar";
    highlightLegalMoves("bar");

    // Auto Move: if exactly one entry point from bar, execute it immediately
    if (autoMoveOn && legalDestinations.length === 1) {
      executeAutoMove("bar", legalDestinations[0].to);
      return;
    }

    const barEl = player === 1 ? barP1El : barP2El;
    barEl.classList.add('highlight-source');
  }

  /**
   * Execute a single move automatically, with or without animation.
   * Called by Auto Move when only one legal destination exists.
   */
  function executeAutoMove(from, to) {
    sysLog(`[AutoMove] ${from} -> ${to}`);
    if (animationOn) {
      animateCheckerMove(from, to).then(() => {
        game.makeMove(from, to);
        selectedSource = null;
        clearHighlights();
        updateUI();
      });
    } else {
      game.makeMove(from, to);
      selectedSource = null;
      clearHighlights();
      updateUI();
    }
  }

  /**
   * Click interaction for bearing off trays.
   */
  function handleBearOffClick(player) {
    if (!gameStarted || game.playerTypes[game.currentPlayer] === 'ai') return;
    if (isNetworkGame && game.currentPlayer !== localPlayerRole) return;
    if (game.currentPlayer !== player || selectedSource === null) return;

    // Check if "off" is in legal destinations
    const targetMove = legalDestinations.find(d => d.to === "off");
    if (targetMove) {
      if (game.makeMove(selectedSource, "off")) {
        selectedSource = null;
        clearHighlights();
        updateUI();
      }
    } else {
      notifyIfMaxBlocked(selectedSource, "off");
    }
  }

/**
   *  Highlight legal destinations.
   */
  function highlightLegalMoves(source) {
    legalDestinations = game.getLegalDestinations(source);
    
    // Stop here if the user turned off visual highlights
    if (!highlightOn) return; 
    
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
   * Shared restart logic — used by both the host's button and the
   * guest receiving a remote 'restart' signal.
   */
  function performRestart() {
    if (turnEndTimer)     { clearTimeout(turnEndTimer);     turnEndTimer     = null; }
    if (aiActionTimeout)  { clearTimeout(aiActionTimeout);  aiActionTimeout  = null; }
    if (autoRollTimeout)  { clearTimeout(autoRollTimeout);  autoRollTimeout  = null; }

    gameStarted       = false;
    isAIPlaying       = false;
    selectedSource    = null;
    legalDestinations = [];
    initialRollOff    = true;
    isRolling         = false;
    networkQueue      = [];
    isProcessingQueue = false;

    game.restart();
    syncPlayersFromMenus();   // re-apply the White/Red menu picks after the reset

    // Start-menu overlay is optional (may have been removed from HTML)
    const overlay = document.getElementById('start-menu-overlay');
    if (overlay) overlay.style.display = 'flex';

    // Re-enable the Start button so the host can kick off a new game
    const btnStart = document.getElementById('btn-start-game');
    if (btnStart) { btnStart.disabled = false; btnStart.style.opacity = '1'; }

    renderDie(die1El, 0);
    renderDie(die2El, 0);
    updateUI();
  }

/**
   * Handle restart click.
   */
  function handleRestartClick() {
    if (confirm("Are you sure you want to restart the game?")) {
      // Notify the guest BEFORE resetting (connection is still live at this point)
      if (isNetworkGame && localPlayerRole === 1 && conn && conn.open) {
        conn.send({ type: 'restart' });
        sysLog('[Network] Sent restart signal to guest.');
      }
      performRestart();
    }
  }

/**
   * Render history list for time travel replaying with a fixed header
   * and a constant-height scrollable body.
   */
  // Which weights to score a given (on-roll) player's perspective with:
  //  - an AI seat uses its own weights;
  //  - a human facing an AI uses the AI opponent's weights;
  //  - human vs human uses the AI picked in the editor menu (default Origin).
  function scoringWeights(player) {
    if (game.playerTypes[player] === 'ai') return game.aiWeights[player];
    const opp = player === 1 ? 2 : 1;
    if (game.playerTypes[opp] === 'ai') return game.aiWeights[opp];
    const selEl = document.getElementById('edit-brain');
    return game.personalityWeights((selEl && selEl.value) || 'Origin');
  }

  // Score of a snapshot's (post-move) position from the perspective of the player
  // on roll there — the player whose move it is when you navigate to that row.
  // Cached on the snapshot (evaluated once) until the scoring context changes.
  function snapshotScore(snapshot) {
    if (snapshot._score !== undefined) return snapshot._score;
    const onRoll = snapshot.isInitial
      ? snapshot.currentPlayer
      : (snapshot.currentPlayer === 1 ? 2 : 1);
    const s = game.evaluate(snapshot.points, snapshot.bar, snapshot.borneOff, scoringWeights(onRoll));
    snapshot._score = onRoll === 1 ? s : -s;
    return snapshot._score;
  }

  // Drop cached history scores so they recompute (after a player or scoring-AI change).
  function clearHistoryScoreCache() {
    game.gameHistory.forEach((s) => { delete s._score; });
  }

  // Name of the AI whose weights score a given player (mirrors scoringWeights).
  function scoringAIName(player) {
    if (game.playerTypes[player] === 'ai') return game.aiNames[player];
    const opp = player === 1 ? 2 : 1;
    if (game.playerTypes[opp] === 'ai') return game.aiNames[opp];
    const selEl = document.getElementById('edit-brain');
    return (selEl && selEl.value) || 'Origin';
  }

  // Compact text description of the current board.
  function describeBoard() {
    const pts = (pl) => {
      const arr = [];
      for (let i = 1; i <= 24; i++) if (game.points[i].player === pl) arr.push(`${i}(${game.points[i].count})`);
      return arr.join(' ') || '-';
    };
    return `White: ${pts(1)} | Red: ${pts(2)} | Bar W:${game.bar[1]} R:${game.bar[2]} | Off W:${game.borneOff[1]} R:${game.borneOff[2]}`;
  }

  function renderHistoryList() {
    sysLog(`[History] Rendering list. count=${game.gameHistory.length}`);
    const showScore = showScoreOn;
    historyListEl.innerHTML = '';
    
    // 1. Create the fixed Header
    const tableHeader = document.createElement('table');
    tableHeader.style.width = '100%';
    tableHeader.style.borderCollapse = 'collapse';
    tableHeader.style.marginBottom = '4px';
    tableHeader.innerHTML = `
      <thead>
        <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.15); color: #e5c158; text-transform: uppercase; font-size: 0.65rem;">
          <th style="padding: 4px; width: 8%; text-align: left;">#</th>
          <th style="padding: 4px; width: 8%; text-align: left;">P</th>
          <th style="padding: 4px; width: 18%; text-align: left;">Dice</th>
          <th style="padding: 4px; width: ${showScore ? '46%' : '64%'}; text-align: left;">Moves</th>
          ${showScore ? '<th style="padding: 4px; width: 20%; text-align: left;">Score</th>' : ''}
        </tr>
      </thead>`;
    historyListEl.appendChild(tableHeader);

    // 2. Create the Scrollable Body Wrapper
    const scrollWrapper = document.createElement('div');
    // Reduced from 75px to 60px to fix partial row visibility
    scrollWrapper.style.height = '60px'; 
    scrollWrapper.style.overflowY = 'auto';
    scrollWrapper.style.width = '100%';
    
    const tableBody = document.createElement('table');
    tableBody.style.width = '100%';
    tableBody.style.borderCollapse = 'collapse';
    tableBody.style.fontSize = '0.75rem';
    tableBody.style.color = '#ffffff';

    const tbody = document.createElement('tbody');

    if (game.gameHistory.length === 0) {
      const emptyEl = document.createElement('tr');
      if (gameStarted) {
          emptyEl.innerHTML = `
            <td style="padding: 2px 4px; font-weight: bold;">0</td>
            <td style="padding: 2px 4px; color: #9ca3af; font-weight: bold;">-</td>
            <td style="padding: 2px 4px;">-</td>
            <td style="padding: 2px 4px; font-family: monospace;">-</td>
            ${showScore ? '<td style="padding: 2px 4px;">-</td>' : ''}
          `;
      } else {
          emptyEl.innerHTML = `<td colspan="${showScore ? 5 : 4}" style="text-align: center; color: #9ca3af; font-style: italic; padding: 10px;">No turns played yet.</td>`;
      }
      tbody.appendChild(emptyEl);
    } else {
      game.gameHistory.forEach((snapshot, idx) => {
        const row = document.createElement('tr');
        row.style.borderBottom = '1px solid rgba(255, 255, 255, 0.05)';
        row.style.cursor = 'pointer';
        row.title = 'Click to replay from this stage';

        row.addEventListener('click', () => {
          ensureNavBuffer();
          navigateTo(idx);
        });

        const pCode = snapshot.currentPlayer === 1 ? 'W' : 'R';
        const pColor = snapshot.currentPlayer === 1 ? '#ffffff' : '#f87171';
        
        let movesText = '-';
        if (snapshot.playedMoves?.length > 0) {
          // Build Magriel-style notation: x/y, bar/x, x/off, x/y*, x/y(n)
          const groups = [];
          for (const m of snapshot.playedMoves) {
            const moveKey = `${m.from}/${m.to}${m.isHit ? '*' : ''}`;
            const last = groups[groups.length - 1];
            if (last && last.key === moveKey) {
              last.count++;
            } else {
              groups.push({ key: moveKey, count: 1 });
            }
          }
          movesText = groups.map(g => g.count > 1 ? `${g.key}(${g.count})` : g.key).join(' ');
        }

        let displayDice = snapshot.isInitial ? '-' : `${snapshot.dice[0] || '-'}-${snapshot.dice[1] || '-'}`;
        let displayPCode = snapshot.isInitial ? '-' : pCode;

        let scoreCell = '';
        if (showScore) {
          const scoreVal = Math.round(snapshotScore(snapshot));
          const scoreColor = scoreVal > 0 ? '#86efac' : (scoreVal < 0 ? '#f87171' : '#9ca3af');
          scoreCell = `<td style="padding: 2px 4px; font-family: monospace; color: ${scoreColor};">${scoreVal}</td>`;
        }
        row.innerHTML = `
          <td style="padding: 2px 4px; font-weight: bold;">${idx}</td>
          <td style="padding: 2px 4px; color: ${pColor}; font-weight: bold;">${displayPCode}</td>
          <td style="padding: 2px 4px;">${displayDice}</td>
          <td style="padding: 2px 4px; font-family: monospace;">${movesText}</td>
          ${scoreCell}
        `;
        tbody.appendChild(row);
      });
    }

    tableBody.appendChild(tbody);
    scrollWrapper.appendChild(tableBody);
    historyListEl.appendChild(scrollWrapper);

    // Auto scroll to the most recent move
    scrollWrapper.scrollTop = scrollWrapper.scrollHeight;
  }

  // ── History Navigation Logic ─────────────────────────────────────────

  /**
   * Ensure historyNavBuffer is populated from the current game history.
   * Returns false if there is no history to navigate.
   */
  function ensureNavBuffer() {
    if (game.gameHistory.length === 0) return false;
    if (historyNavBuffer.length === 0) {
      historyNavBuffer = JSON.parse(JSON.stringify(game.gameHistory));
    }
    return true;
  }

  /**
   * Restore board state from historyNavBuffer[idx] for viewing / resuming.
   * Does NOT destroy historyNavBuffer so forward navigation stays possible.
   */
  function navigateTo(idx) {
    stopAI();               // navigating pauses AI so the board is readable
    if (!ensureNavBuffer()) return;
    idx = Math.max(0, Math.min(idx, historyNavBuffer.length - 1));
    historyNavIndex = idx;

    const snap = historyNavBuffer[idx];

    // Restore board visuals and engine state from snapshot
    game.points           = JSON.parse(JSON.stringify(snap.points));
    game.bar              = { ...snap.bar };
    game.borneOff         = { ...snap.borneOff };
    
    if (snap.isInitial) {
      game.currentPlayer    = snap.currentPlayer;
      game.dice             = [...snap.dice];
      game.movesLeft        = [...snap.movesLeft];
      game.hasRolled        = snap.hasRolled;
      game.turnCount        = snap.turnCount;
    } else {
      game.currentPlayer    = snap.currentPlayer === 1 ? 2 : 1; // opponent plays next
      game.dice             = [0, 0];
      game.movesLeft        = [];
      game.hasRolled        = false;
      game.turnCount        = snap.turnCount + 1;
    }
    
    game.winner           = snap.winner || null;
    game.doublingCubeValue = snap.doublingCubeValue;
    game.doublingCubeOwner = snap.doublingCubeOwner;

    // Set history up to this point; future rolls come from the buffer
    game.gameHistory         = JSON.parse(JSON.stringify(historyNavBuffer.slice(0, idx + 1)));
    game.futureRolls         = historyNavBuffer.slice(idx + 1).map(s => [...s.dice]);
    game.futureRollIndex     = 0;

    // Reset per-turn undo stack
    game.turnHistory         = [];
    game.playedMovesThisTurn = [];
    game.saveStateToHistory();

    updateNavButtons();
    updateUI();
  }

  /**
   * Clear navigation mode. Called when the player takes a game action
   * (roll, move) so the nav buttons reflect the new live state.
   */
  function exitNavMode() {
    if (historyNavIndex === null) return;
    historyNavIndex  = null;
    historyNavBuffer = [];
    updateNavButtons();
  }

  /**
   * Pause AI play. Cancels any in-progress AI timer and re-enables
   * the START button so the player can resume.
   */
  function stopAI() {
    if (!gameStarted) return;
    if (aiStopped) return; // already stopped
    aiStopped = true;
    if (aiActionTimeout) { clearTimeout(aiActionTimeout); aiActionTimeout = null; }
    isAIPlaying = false;
    // Re-enable START so the player has a way to resume AI
    const btnStart = document.getElementById('btn-start-game');
    if (btnStart) { btnStart.disabled = false; btnStart.style.opacity = '1'; }
    sysLog('[System] AI paused. Click START to resume.');
  }

  /**
   * Nav buttons are always visually enabled (green).
   * Click handlers contain their own guards for no-op cases.
   */
  function updateNavButtons() {
    // intentionally empty — no disabled toggling
  }

  // ── Button event listeners ────────────────────────────────────────────
  (function bindNavButtons() {
    const btnFirst = document.getElementById('nav-first');
    const btnBack  = document.getElementById('nav-back');
    const btnFwd   = document.getElementById('nav-fwd');
    const btnLast  = document.getElementById('nav-last');

    if (btnFirst) btnFirst.addEventListener('click', (e) => {
      ensureNavBuffer();
      navigateTo(0);
      if (e.isTrusted && isNetworkGame && localPlayerRole === 1 && conn && conn.open) conn.send({ type: 'nav', action: 'first' });
    });

    if (btnBack) btnBack.addEventListener('click', (e) => {
      ensureNavBuffer();
      if (historyNavIndex === null) {
        if (historyNavBuffer.length >= 2) {
            // Live state. Step back to the state BEFORE the most recent fully completed turn.
            navigateTo(historyNavBuffer.length - 2);
        } else if (historyNavBuffer.length === 1) {
            navigateTo(0);
        }
      } else if (historyNavIndex > 0) {
        navigateTo(historyNavIndex - 1);
      }
      if (e.isTrusted && isNetworkGame && localPlayerRole === 1 && conn && conn.open) conn.send({ type: 'nav', action: 'back' });
    });

    if (btnFwd) btnFwd.addEventListener('click', (e) => {
      if (historyNavIndex === null) return;
      if (historyNavIndex < historyNavBuffer.length - 1) {
        navigateTo(historyNavIndex + 1);
      } else {
        // Already at last snapshot — exit nav mode (return to live state)
        historyNavIndex  = null;
        historyNavBuffer = [];
        updateNavButtons();
        updateUI();
      }
      if (e.isTrusted && isNetworkGame && localPlayerRole === 1 && conn && conn.open) conn.send({ type: 'nav', action: 'fwd' });
    });

    if (btnLast) btnLast.addEventListener('click', (e) => {
      if (historyNavIndex === null) return;
      // Navigate to the final buffered snapshot, then exit nav mode
      navigateTo(historyNavBuffer.length - 1);
      historyNavIndex  = null;
      historyNavBuffer = [];
      updateNavButtons();
      // updateUI already called by navigateTo
      if (e.isTrusted && isNetworkGame && localPlayerRole === 1 && conn && conn.open) conn.send({ type: 'nav', action: 'last' });
    });
  })();
  // ─────────────────────────────────────────────────────────────────────

// Initialize player types but wait for manual start
  game.playerTypes[1] = document.getElementById('p1-type').value;
  game.playerTypes[2] = document.getElementById('p2-type').value;
  gameStarted = false;
  sysLog(`[System] Game ready, waiting for manual start.`);

document.getElementById('btn-start-game').addEventListener('click', () => {
    startGame(false);
});

  // STOP button — pause AI; START re-enables it
  const btnStop = document.getElementById('btn-stop');
  if (btnStop) {
    btnStop.addEventListener('click', (e) => {
      stopAI();
      if (e.isTrusted && isNetworkGame && localPlayerRole === 1 && conn && conn.open) {
        conn.send({ type: 'stop_ai' });
      }
    });
  }
    
  // Build both player menus: "Human" at the top (default), then every AI personality.
  function populatePlayerMenus() {
    const names = game.aiPersonalityNames();
    ['p1-type', 'p2-type'].forEach((id) => {
      const sel = document.getElementById(id);
      if (!sel) return;
      const prev = sel.value;
      sel.innerHTML = '';
      const human = document.createElement('option');
      human.value = 'human';
      human.textContent = 'Human';
      sel.appendChild(human);
      names.forEach((n) => {
        const o = document.createElement('option');
        o.value = n;
        o.textContent = n;
        sel.appendChild(o);
      });
      // Keep a still-valid previous choice; otherwise default to Human.
      sel.value = [...sel.options].some((o) => o.value === prev) ? prev : 'human';
    });
  }

  // Apply a menu's current value (Human or a named AI) to the game state.
  function applyPlayerMenu(player) {
    const sel = document.getElementById(player === 1 ? 'p1-type' : 'p2-type');
    if (!sel) return;
    if (sel.value === 'human') game.playerTypes[player] = 'human';
    else game.setPlayerAI(player, sel.value);
  }

  function syncPlayersFromMenus() {
    applyPlayerMenu(1);
    applyPlayerMenu(2);
  }

  populatePlayerMenus();
  syncPlayersFromMenus();

  // Listen for live dropdown changes so players can swap Human/AI in/out mid-game
  document.getElementById('p1-type').addEventListener('change', (e) => {
    applyPlayerMenu(1);
    clearHistoryScoreCache();   // scoring AI may have changed
    sysLog(`[System] White player set to ${e.target.value}`);
    updateUI(); // Refresh board so checkers instantly become draggable/un-draggable
    checkAndTriggerAITurn();
  });

  document.getElementById('p2-type').addEventListener('change', (e) => {
    applyPlayerMenu(2);
    clearHistoryScoreCache();   // scoring AI may have changed
    sysLog(`[System] Red player set to ${e.target.value}`);
    updateUI(); // Refresh board so checkers instantly become draggable/un-draggable
    checkAndTriggerAITurn();
  });

  // ── AI parameter editor ───────────────────────────────────
  const editBrainSel  = document.getElementById('edit-brain');
  const brainParamsEl = document.getElementById('brain-params');
  const BRAIN_KEYS = ['PC', 'EC1', 'EC0', 'PH', 'HB', 'AN', 'DO', 'IO', 'DP', 'IP', 'DE', 'DT', 'AT'];

  function refreshBrainSelect() {
    if (!editBrainSel) return;
    const prev = editBrainSel.value;
    editBrainSel.innerHTML = '';
    game.aiPersonalityNames().forEach((n) => {
      const o = document.createElement('option');
      o.value = n; o.textContent = n;
      editBrainSel.appendChild(o);
    });
    editBrainSel.value = [...editBrainSel.options].some((o) => o.value === prev)
      ? prev : (editBrainSel.options[0] ? editBrainSel.options[0].value : '');
  }

  function buildBrainParams() {
    if (!brainParamsEl) return;
    brainParamsEl.innerHTML = '';
    BRAIN_KEYS.forEach((k) => {
      const wrap = document.createElement('div');
      wrap.className = 'brain-param';
      const lab = document.createElement('label');
      lab.textContent = k; lab.htmlFor = 'bp-' + k;
      const inp = document.createElement('input');
      inp.type = 'number'; inp.id = 'bp-' + k;
      inp.addEventListener('change', () => {
        const name = editBrainSel.value;
        game.setPersonalityWeight(name, k, parseInt(inp.value, 10) || 0);
        // If a seated player is this AI, refresh its live weights and M.
        [1, 2].forEach((p) => {
          if (game.playerTypes[p] === 'ai' && game.aiNames[p] === name) game.setPlayerAI(p, name);
        });
      });
      wrap.appendChild(lab); wrap.appendChild(inp);
      brainParamsEl.appendChild(wrap);
    });
  }

  function loadBrainParams() {
    if (!editBrainSel) return;
    const w = game.personalityWeights(editBrainSel.value);
    BRAIN_KEYS.forEach((k) => {
      const inp = document.getElementById('bp-' + k);
      if (inp) inp.value = w[k];
    });
  }

  // Display an arbitrary weight set in the editor fields (used by evolution to show
  // the most recently crowned champion). Does not alter any stored personality.
  function showBrainInFields(brain) {
    BRAIN_KEYS.forEach((k) => {
      const inp = document.getElementById('bp-' + k);
      if (inp && brain[k] != null) inp.value = brain[k];
    });
  }

  // Rebuild every UI list that depends on the roster (after import / reset).
  function refreshAllBrainUI() {
    refreshBrainSelect();
    loadBrainParams();
    buildTournamentToggles();
    populatePlayerMenus();
    syncPlayersFromMenus();
  }

  if (editBrainSel) {
    refreshBrainSelect();
    buildBrainParams();
    loadBrainParams();
    editBrainSel.addEventListener('change', () => {
      loadBrainParams();
      clearHistoryScoreCache();   // human-vs-human games score with this menu's AI
      renderHistoryList();
    });
  }

  document.getElementById('brain-export')?.addEventListener('click', () => {
    const src = editBrainSel.value;               // weights come from the selected AI
    if (!src) return;
    const weights = game.personalityWeights(src);
    let fn = (document.getElementById('brain-filename').value || src).trim();
    const exportName = fn.replace(/\.js$/i, '').trim() || src;   // the personality is named after the file
    const clean = exportName.replace(/[^A-Za-z0-9]/g, '') || 'Brain';
    if (!/\.js$/i.test(fn)) fn += '.js';
    // A JS file that defines a personality named after the file.
    const content =
      `// Backgammon AI personality: ${exportName}\n` +
      `// ${new Date().toLocaleString()}\n\n` +
      `const ${clean} = ${JSON.stringify({ name: exportName, weights })};\n`;
    downloadCSV(fn, content);
  });

  let brainFileInput = document.createElement('input');
  brainFileInput.type = 'file';
  brainFileInput.accept = '.js,.json';
  brainFileInput.style.display = 'none';
  document.body.appendChild(brainFileInput);
  brainFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = String(evt.target.result);
        let brains;
        const arrM = text.match(/\[[\s\S]*\]/);          // array of personalities
        if (arrM) {
          brains = JSON.parse(arrM[0]);
        } else {
          const objM = text.match(/\{[\s\S]*\}/);        // or a single personality
          brains = objM ? [JSON.parse(objM[0])] : [];
        }
        if (!brains.length) throw new Error('no brains');
        game.importPersonalities(brains);
        refreshAllBrainUI();
        gameMessageEl.textContent = `Imported ${brains.length} AI personalit${brains.length === 1 ? 'y' : 'ies'}.`;
      } catch (err) {
        gameMessageEl.textContent = 'Could not read that personalities file.';
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  });
  document.getElementById('brain-import')?.addEventListener('click', () => brainFileInput.click());

  document.getElementById('brain-def')?.addEventListener('click', () => {
    game.resetPersonalities();
    refreshAllBrainUI();
    gameMessageEl.textContent = 'AI personalities reset to built-in values.';
  });

  // ── Tournament ────────────────────────────────────────────
  const tourneySelected  = new Set();
  const tourneyTogglesEl = document.getElementById('tourney-toggles');
  let tournamentRunning  = false;

  // One letter toggle per personality (first initial). Default: everyone except Origin.
  function buildTournamentToggles() {
    if (!tourneyTogglesEl) return;
    tourneyTogglesEl.innerHTML = '';
    // Origin goes last; everyone is selected by default.
    const names = game.aiPersonalityNames();
    const ordered = [...names.filter((n) => n !== 'Origin'), ...names.filter((n) => n === 'Origin')];
    ordered.forEach((n) => {
      const b = document.createElement('button');
      b.className = 'tourney-toggle sel';
      b.textContent = n.charAt(0).toUpperCase();
      b.title = n;
      tourneySelected.add(n);
      b.addEventListener('click', () => {
        if (tourneySelected.has(n)) { tourneySelected.delete(n); b.classList.remove('sel'); }
        else { tourneySelected.add(n); b.classList.add('sel'); }
      });
      tourneyTogglesEl.appendChild(b);
    });
  }
  buildTournamentToggles();

  document.getElementById('tourney-all')?.addEventListener('click', () => {
    game.aiPersonalityNames().forEach((n) => tourneySelected.add(n));
    [...tourneyTogglesEl.children].forEach((b) => b.classList.add('sel'));
  });
  document.getElementById('tourney-none')?.addEventListener('click', () => {
    tourneySelected.clear();
    [...tourneyTogglesEl.children].forEach((b) => b.classList.remove('sel'));
  });
  document.getElementById('btn-run-tournament')?.addEventListener('click', () => {
    if (evolveRunning) { gameMessageEl.textContent = 'Stop evolution before running a tournament.'; return; }
    if (!tournamentRunning) runTournament();
  });

  // ── Genetic evolution (Phase I: single-threaded) ──────────
  const EVO_EVAL = ['PC', 'EC1', 'EC0', 'PH', 'HB', 'AN', 'DO', 'IO', 'DP', 'IP', 'DE'];
  const EVO_ALL = [...EVO_EVAL, 'DT', 'AT'];  // the 13 evolvable numbers
  let evolveRunning = false;
  let evolveStop = false;

  // Normalize: eval weights to max|w| = 1000; DT/AT scaled by the same factor.
  function normalizeBrain(b) {
    let M = 0;
    EVO_EVAL.forEach((k) => { const a = Math.abs(b[k]); if (a > M) M = a; });
    if (M === 0) M = 1;
    const S = 1000 / M;
    EVO_EVAL.forEach((k) => {
      b[k] = Math.round(b[k] * S);
      if (b[k] === 0) b[k] = Math.random() < 0.5 ? 1 : -1;   // never let a weight stick at 0
    });
    b.DT = Math.max(1, Math.round(b.DT * S));
    b.AT = Math.max(1, Math.round(b.AT * S));
    return b;
  }

  // Mutate all 13 by up to R% each; force one change if nothing moved.
  function mutateBrain(parent, R) {
    const m = { ...parent };
    let changed = false;
    EVO_ALL.forEach((k) => {
      const delta = Math.round(parent[k] * (R / 100) * (Math.random() * 2 - 1));
      if (delta !== 0) { m[k] = parent[k] + delta; changed = true; }
    });
    if (!changed) {
      const k = EVO_ALL[Math.floor(Math.random() * EVO_ALL.length)];
      m[k] = parent[k] + (Math.random() < 0.5 ? 1 : -1);
    }
    return m;
  }

  // Shared match length (play-to-X points), read from the tournament dropdown.
  function matchLength() {
    const el = document.getElementById('match-length');
    let X = el ? parseInt(el.value, 10) : 11;
    if (!X || X < 1) X = 11;
    if (X % 2 === 0) X += 1;                 // safety: force odd
    return X;
  }

  // Play nMatches matches to X points. Net (fitness) = A's match wins - B's match
  // wins, so a blown-up cube can never inflate the signal: a match win counts 1.
  // The A/B argument order is swapped on alternate matches to cancel any residual
  // first-game side bias (simulateBGMatch already alternates colours within a match).
  async function evoMatch(A, B, nMatches, label) {
    const X = matchLength();
    let winsA = 0, winsB = 0;
    for (let i = 0; i < nMatches && !evolveStop; i++) {
      const swap = (i % 2 === 1);
      const res = simulateBGMatch(swap ? B : A, swap ? A : B, X);
      const aWon = swap ? (res.winner === 'B') : (res.winner === 'A');
      if (aWon) winsA++; else winsB++;
      if (label) gameMessageEl.textContent = `${label} — ${i + 1}/${nMatches} matches (to ${X})`;
      await new Promise((r) => setTimeout(r, 0));   // keep the UI alive between matches
    }
    return { net: winsA - winsB, winsA, winsB };
  }

  const evoAdd = (X, V, s) => { const o = {}; EVO_ALL.forEach((k) => { o[k] = X[k] + s * V[k]; }); return o; };
  const evoHalve = (V) => { const o = {}; EVO_ALL.forEach((k) => { o[k] = Math.trunc(V[k] / 2); }); return o; };
  const evoDouble = (V) => { const o = {}; EVO_ALL.forEach((k) => { o[k] = V[k] * 2; }); return o; };
  const evoEqual = (A, X) => EVO_ALL.every((k) => A[k] === X[k]);
  const evoAllZero = (V) => EVO_ALL.every((k) => V[k] === 0);

  // Deterministic line search along the mutation direction (up to 30 steps).
  async function evoLineSearch(parent, firstMutant, n, label) {
    let X = normalizeBrain({ ...firstMutant });
    let V = {}; EVO_ALL.forEach((k) => { V[k] = X[k] - parent[k]; });
    let expanding = true;
    for (let step = 0; step < 30 && !evolveStop; step++) {
      const A = normalizeBrain(evoAdd(X, V, +1));
      const B = normalizeBrain(evoAdd(X, V, -1));
      if (evoEqual(A, X) && evoEqual(B, X)) break;              // integer math collapsed
      const tag = `${label} step ${step + 1}`;
      const sAX = await evoMatch(A, X, n, tag); if (evolveStop) break;
      const sBX = await evoMatch(B, X, n, tag); if (evolveStop) break;
      const aWins = sAX.net > 0, bWins = sBX.net > 0;
      if (!aWins && !bWins) { expanding = false; V = evoHalve(V); }              // X is a local max
      else if (aWins && !bWins) { X = A; V = expanding ? evoDouble(V) : evoHalve(V); }
      else if (!aWins && bWins) { X = B; expanding = false; V = evoHalve(V); }   // overshot, reverse
      else { const sAB = await evoMatch(A, B, n, tag); X = sAB.net > 0 ? A : B; expanding = false; V = evoHalve(V); }
      if (evoAllZero(V)) break;
    }
    return X;
  }

  // Download one AI's parameters as a spreadsheet. Called for the original at the
  // start of a run and for each champion as it is crowned.
  function downloadBrainCSV(name, brain, note) {
    let csv = 'Backgammon AI Parameters\n';
    csv += 'Name,' + name + '\n';
    if (note) csv += 'Note,' + note + '\n';
    csv += 'Date,' + new Date().toLocaleString() + '\n\n';
    csv += 'Param,Value\n';
    BRAIN_KEYS.forEach((k) => { csv += k + ',' + (brain[k] != null ? brain[k] : 0) + '\n'; });
    downloadCSV(name + '.csv', csv);
  }

  async function runEvolution() {
    if (tournamentRunning) { gameMessageEl.textContent = 'Wait for the tournament to finish.'; return; }
    const baseName = editBrainSel ? editBrainSel.value : 'Origin';
    const maxGens = Math.max(1, parseInt(document.getElementById('evo-gens').value, 10) || 1000);
    const n = Math.max(1, parseInt(document.getElementById('evo-games').value, 10) || 50);
    const R = Math.max(0, Math.min(100, parseInt(document.getElementById('evo-rate').value, 10) || 50));

    let parent = normalizeBrain({ ...game.personalityWeights(baseName) });
    let baseline = { ...parent };
    let bestScore = 0, multiplier = 10, champions = 0, gen = 0;

    evolveRunning = true; evolveStop = false;
    const btn = document.getElementById('btn-evolve');
    if (btn) { btn.textContent = 'Stop Evolution'; btn.style.background = '#991b1b'; }
    sysLog(`[Evolve] Start from ${baseName}: maxGens=${maxGens}, matches/sample=${n}, matchLen=${matchLength()}, R=${R}%.`);

    // Two downloads up front (a run-info note, then the starting AI) so the browser's
    // multi-download approval is handled at the start, not whenever the first champion
    // happens to appear.
    const info = `Backgammon Evolution\n${new Date().toLocaleString()}\n`
      + `Commencing evolution of ${baseName}.\n\n`
      + `Parameters:\n`
      + `  Maximum generations: ${maxGens}\n`
      + `  Matches per sample: ${n}\n`
      + `  Match length (play to): ${matchLength()}\n`
      + `  Max % random change per weight: ${R}\n`;
    downloadCSV(`${baseName}-evolution.txt`, info);
    showBrainInFields(parent);
    downloadBrainCSV(`${baseName}-gen0`, parent, `original (start of evolution)`);

    while (gen < maxGens && !evolveStop) {
      gen++;
      const mutant = normalizeBrain(mutateBrain(parent, R));
      const scout = await evoMatch(mutant, parent, n, `Gen ${gen}: scout`);
      if (evolveStop) break;
      if (scout.net > 0) {
        sysLog(`[Evolve] Gen ${gen}: scout hit +${scout.net}. Line search...`);
        let X = normalizeBrain(await evoLineSearch(parent, mutant, n, `Gen ${gen}: line search`));
        if (evolveStop) break;
        sysLog(`[Evolve] Gen ${gen}: gauntlet (${n * multiplier} matches) vs baseline...`);
        const gaunt = await evoMatch(X, baseline, n * multiplier, `Gen ${gen}: gauntlet`);
        if (evolveStop) break;
        if (gaunt.net > bestScore) {
          bestScore = gaunt.net; parent = { ...X }; champions++;
          const champName = `${baseName}-evo-g${gen}`;
          showBrainInFields(X);                            // control column shows the latest champion
          downloadBrainCSV(champName, X, `champion #${champions}, gauntlet +${gaunt.net}`);
          sysLog(`[Evolve] Gen ${gen}: CHAMPION #${champions} (+${gaunt.net}), saved ${champName}.csv. ${champName} = ${JSON.stringify(X)}`);
          if (gaunt.winsB === 0) {                       // perfect sweep of the baseline
            baseline = { ...X }; bestScore = 0; multiplier *= 2;
            sysLog(`[Evolve] Gen ${gen}: PERFECT SWEEP — new baseline, multiplier ${multiplier}.`);
          }
        } else {
          sysLog(`[Evolve] Gen ${gen}: gauntlet +${gaunt.net} did not beat best +${bestScore}.`);
        }
      }
      gameMessageEl.textContent = `Evolving ${baseName}: gen ${gen}/${maxGens} · champions ${champions} · best +${bestScore}`;
      await new Promise((r) => setTimeout(r, 0));
    }

    evolveRunning = false;
    if (btn) { btn.textContent = 'Evolve'; btn.style.background = ''; }
    sysLog(`[Evolve] Stopped at generation ${gen}. ${champions} champion(s) this run, each saved as a CSV as it was crowned.`);
    gameMessageEl.textContent = `Evolution ended: ${gen} generations, ${champions} champion(s) saved.`;
  }

  document.getElementById('btn-evolve')?.addEventListener('click', () => {
    if (evolveRunning) { evolveStop = true; }
    else runEvolution();
  });

  const PARAM_ORDER = ['PC', 'EC1', 'EC0', 'PH', 'HB', 'AN', 'DO', 'IO', 'DP', 'IP', 'DE'];
  const numCommas = (n) => n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  function downloadCSV(filename, text) {
    const blob = new Blob([text], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  }

  // Detailed CSV in the style of the Reversi tournament output. Standings are by
  // matches won; total game points are kept as a bounded secondary/tiebreak column.
  function buildTournamentCSV(names, mWins, mLoss, gpts, h2h, matchesPer, X, tStart, tEnd) {
    const ranked = names.slice().sort((a, b) => (mWins[b] - mWins[a]) || (gpts[b] - gpts[a]));
    let csv = 'Backgammon Tournament Results\n';
    csv += 'Starting Date:,' + tStart.toLocaleString() + '\n';
    csv += 'Ending Date:,' + tEnd.toLocaleString() + '\n';
    csv += 'Duration:,"' + numCommas(tEnd - tStart) + ' ms"\n';
    csv += 'Players:,' + names.length + '\n';
    csv += 'Matches per Pair,' + matchesPer + '\n';
    csv += 'Match Length (play to),' + X + '\n\n';

    csv += 'Standings\nRank,Name,Matches Won,Matches Lost,Game Points\n';
    ranked.forEach((n, i) => { csv += `${i + 1},${n},${mWins[n]},${mLoss[n]},${gpts[n]}\n`; });
    csv += '\n';

    csv += 'Head-to-Head (net matches won, row minus column)\n';
    csv += 'Row vs Col,' + ranked.join(',') + '\n';
    ranked.forEach((r) => {
      const row = ranked.map((c) => (r === c ? '' : (h2h[r][c] || 0) - (h2h[c][r] || 0)));
      csv += `${r},${row.join(',')}\n`;
    });
    csv += '\n';

    csv += 'Player Parameters:\nName,' + PARAM_ORDER.join(',') + '\n';
    ranked.forEach((n) => {
      const w = game.personalityWeights(n);
      csv += n + ',' + PARAM_ORDER.map((k) => w[k]).join(',') + '\n';
    });
    return csv;
  }

  // Round-robin: each selected pair plays `matches/pair` matches to the shared
  // match length X. Standings are by matches won (cube-safe: a match win counts 1).
  // Progress shows in the instruction window; a detailed CSV downloads at the end.
  async function runTournament() {
    const names = game.aiPersonalityNames().filter((n) => tourneySelected.has(n));
    if (names.length < 2) { gameMessageEl.textContent = 'Tournament: select at least 2 players.'; return; }
    const matchesPer = Math.max(1, parseInt(document.getElementById('tourney-games').value, 10) || 10);
    const X = matchLength();

    const mWins = {}, mLoss = {}, gpts = {}, h2h = {};
    names.forEach((n) => {
      mWins[n] = 0; mLoss[n] = 0; gpts[n] = 0; h2h[n] = {};
      names.forEach((m) => { if (m !== n) h2h[n][m] = 0; });
    });

    const pairs = [];
    for (let i = 0; i < names.length; i++)
      for (let j = i + 1; j < names.length; j++) pairs.push([names[i], names[j]]);
    const total = pairs.length * matchesPer;

    tournamentRunning = true;
    const runBtn = document.getElementById('btn-run-tournament');
    if (runBtn) runBtn.disabled = true;
    const tStart = new Date();
    let done = 0;

    for (const [A, B] of pairs) {
      const wA = game.personalityWeights(A), wB = game.personalityWeights(B);
      for (let k = 0; k < matchesPer; k++) {
        const swap = (k % 2 === 1);                          // balance first-game side bias
        const res = simulateBGMatch(swap ? wB : wA, swap ? wA : wB, X);
        const aWon = swap ? (res.winner === 'B') : (res.winner === 'A');
        const winner = aWon ? A : B, loser = aWon ? B : A;
        const aScore = swap ? res.scoreB : res.scoreA, bScore = swap ? res.scoreA : res.scoreB;
        mWins[winner]++; mLoss[loser]++; h2h[winner][loser]++;
        gpts[A] += aScore; gpts[B] += bScore;
        done++;
        gameMessageEl.textContent = `Tournament running… ${done}/${total} matches to ${X} (${A} vs ${B})`;
        await new Promise((r) => setTimeout(r, 0));          // yield so the UI stays responsive
      }
    }

    const tEnd = new Date();
    const ranked = names.slice().sort((a, b) => (mWins[b] - mWins[a]) || (gpts[b] - gpts[a]));
    const secs = ((tEnd - tStart) / 1000).toFixed(1);
    downloadCSV('BGTournamentResults.csv', buildTournamentCSV(names, mWins, mLoss, gpts, h2h, matchesPer, X, tStart, tEnd));
    gameMessageEl.textContent = `Tournament done — winner ${ranked[0]} (${mWins[ranked[0]]} matches). ${total} matches to ${X} in ${secs}s. Results saved.`;
    sysLog(`[Tournament] ${total} matches to ${X} in ${secs}s. Winner: ${ranked[0]} (${mWins[ranked[0]]} matches won).`);

    if (runBtn) runBtn.disabled = false;
    tournamentRunning = false;
  }

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
    if (pendingDouble) return; // wait for the pending double to resolve first
    if (aiStopped)   return;  // AI paused by STOP button or nav action

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
      // Before rolling, decide whether to offer a double.
      if (doublingOn && game.aiShouldDouble(game.currentPlayer)) {
        sysLog(`[AI] Player ${game.currentPlayer} (AI) offers a double.`);
        aiActionTimeout = setTimeout(() => {
          aiActionTimeout = null;
          offerDoubleByAI(game.currentPlayer);
        }, 400);
        return;
      }
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

  // An AI offers a double on its turn; the opponent (human or AI) then responds.
  function offerDoubleByAI(player) {
    if (pendingDouble || !game.canDouble(player)) return;
    pendingDouble = { by: player };
    updateUI();                       // show the pending prompt and lock the dice
    const responder = opponentOf(player);
    if (game.playerTypes[responder] === 'ai') {
      setTimeout(() => {
        if (!pendingDouble) return;
        if (game.aiShouldAcceptDouble(responder)) applyAcceptDouble();
        else applyDeclineDouble();
      }, 700);
    }
    // If the responder is human, the dice/cube click handlers take the response.
  }

  /**

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
    
    // Wrap the visual highlighting in the toggle check
    if (highlightOn) {
      if (move.from === 'bar') {
        const barEl = game.currentPlayer === 1 ? barP1El : barP2El;
        if (barEl) barEl.classList.add('highlight-source');
      } else {
        const pt = document.getElementById(`point-${move.from}`);
        if (pt) pt.classList.add('highlight-source');
      }

      if (move.to === 'off') {
        const bearEl = game.currentPlayer === 1 ? bearOffP1 : bearOffP2;
        if (bearEl) bearEl.classList.add('highlight-destination');
      } else {
        const pt = document.getElementById(`point-${move.to}`);
        if (pt) pt.classList.add('highlight-destination');
      }
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

        // Very small pause when animation is OFF (e.g. 10ms)
        setTimeout(() => {
          executeAIMovesSequentially(moves, index + 1);
        }, 10);
      }, 10);
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

    // --- WIPE ANY PREVIOUS LOCAL STATE ---
    game.restart();
    initialRollOff = true;
    isRolling = false;
    gameStarted = false;
    renderDie(die1El, 0);
    renderDie(die2El, 0);
    // -------------------------------------

    game.playerTypes[1] = 'human';
    game.playerTypes[2] = 'human';
    document.getElementById('p1-type').value = 'human';
    document.getElementById('p2-type').value = 'human';
    document.getElementById('p1-type').disabled = true;
    document.getElementById('p2-type').disabled = true;
    
    // We removed the lines that hid the setup panel here.
    // Instead, we just reveal the connection status text.
    document.getElementById('network-status').style.display = 'block';
    
    // Hide the old big room code display box since we are using the text field now
    if (document.getElementById('room-code-display')) {
        document.getElementById('room-code-display').style.display = 'none';
    }
    
    document.getElementById('btn-start-game').disabled = true;
    document.getElementById('btn-start-game').style.opacity = '0.5';

    // Refresh the UI to apply the blank dice immediately
    updateUI(); 
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

connection.on('data', (data) => {
      sysLog(`[Network] Received: ${data.type}`);
      
      if (data.type === 'sync') {
          game.points = data.points;
          game.bar = data.bar;
          game.borneOff = data.borneOff;
          updateUI();
      }
      
      else if (data.type === 'start') {
          sysLog(`[Network] Start signal received from opponent.`);
          startGame(true); 
      }     
      
      else if (data.type === 'roll_first') {
          // 1. Apply engine state instantly
          game.rollForFirstTurn(data.dice[0], data.dice[1]);
          initialRollOff = false;
          
          // 2. Lock UI and visually animate
          isRolling = true;
          updateUI();
          setTimeout(() => {
            isRolling = false;
            updateUI();
          }, 600);
      }
      
      else if (data.type === 'roll') {
          // 1. Apply engine state instantly
          game.rollDice(data.dice[0], data.dice[1]);
          
          // 2. Lock UI and visually animate
          isRolling = true;
          updateUI();
          setTimeout(() => {
            isRolling = false;
            updateUI();
          }, 600);
      }

      // --- DOUBLING CUBE ---
      else if (data.type === 'double') {
          sysLog('[Network] Opponent offered a double.');
          pendingDouble = { by: game.currentPlayer };
          updateUI();
      }
      else if (data.type === 'accept') {
          sysLog('[Network] Opponent accepted the double.');
          applyAcceptDouble();
      }
      else if (data.type === 'decline') {
          sysLog('[Network] Opponent declined the double.');
          applyDeclineDouble();
      }

      // --- PUSH ALL BOARD MUTATIONS TO THE QUEUE ---
      else if (data.type === 'move' || data.type === 'undo' || data.type === 'end_turn') {
          networkQueue.push({ type: data.type, data: data });
          processNetworkQueue();
      }

      // Host restarted the game — mirror the reset on the guest's side
      else if (data.type === 'restart') {
          sysLog('[Network] Restart signal received from host. Resetting board...');
          performRestart();
      }
      
      // Host stopped AI or used time travel controls
      else if (data.type === 'stop_ai') {
          sysLog('[Network] Stop signal received from host.');
          stopAI();
      }
      else if (data.type === 'nav') {
          sysLog(`[Network] Nav action received from host: ${data.action}`);
          if (data.action === 'first') document.getElementById('nav-first')?.click();
          else if (data.action === 'back') document.getElementById('nav-back')?.click();
          else if (data.action === 'fwd') document.getElementById('nav-fwd')?.click();
          else if (data.action === 'last') document.getElementById('nav-last')?.click();
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
    
    // Update text AND color
    connStatus.textContent = "Waiting for opponent...";
    connStatus.style.color = "var(--accent-gold)"; 
    
    // Inject the code into the text field and lock it so it can't be typed over
    joinCodeInput.value = roomCode;
    joinCodeInput.readOnly = true; 
    
      sysLog(`[Network] Connecting to signaling server as Host: pointworks-bg-${roomCode}`);
    
peer = new Peer('pointworks-bg-' + roomCode, {
  config: { 'iceServers': [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { 
      urls: 'turn:openrelay.metered.ca:80', 
      username: 'openrelayproject', 
      credential: 'openrelayproject' 
    },
    { 
      urls: 'turn:openrelay.metered.ca:443', 
      username: 'openrelayproject', 
      credential: 'openrelayproject' 
    }
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
    
    // Update text AND color
    connStatus.textContent = "Connecting to Host...";
    connStatus.style.color = "var(--accent-gold)";
    
    // Explicitly set the guest view to 'red'
    document.getElementById('board-view').value = 'red'; 
    document.getElementById('board-view').dispatchEvent(new Event('change'));
    
    sysLog(`[Network] Connecting to signaling server as Guest...`);
    
peer = new Peer({
      config: { 'iceServers': [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { 
          urls: 'turn:openrelay.metered.ca:80', 
          username: 'openrelayproject', 
          credential: 'openrelayproject' 
        },
        { 
          urls: 'turn:openrelay.metered.ca:443', 
          username: 'openrelayproject', 
          credential: 'openrelayproject' 
        }
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

  // Allow pressing Enter in the code field to join (same as clicking JOIN)
  joinCodeInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') btnJoin.click();
  });

// --- QUIT GAME ---
  const btnQuit = document.getElementById('btn-quit');
  if (btnQuit) {
    btnQuit.addEventListener('click', () => {
      if (confirm("Are you sure you want to quit? This will disconnect the game and reset the board.")) {
        // A hard reload is the safest way to completely sever WebRTC connections and restore the initial UI state
        window.location.reload();
      }
    });
  }

// --- DEFAULTS & EXIT ---
  const btnDefaults = document.getElementById('btn-defaults');
  if (btnDefaults) {
    btnDefaults.addEventListener('click', () => {
      if (confirm("Restore default settings? This will clear all data and reload the page.")) {
        window.location.reload();
      }
    });
  }

  const btnExit = document.getElementById('btn-exit');
  if (btnExit) {
    btnExit.addEventListener('click', () => {
      if (confirm("Are you sure you want to exit the game?")) {
        // Attempt to close the browser tab natively
        window.close();
        
        // Fallback: Modern browsers sometimes block window.close() if the script didn't explicitly open the tab. 
        // This clears the screen and gives a safe-to-close message just in case.
        document.body.innerHTML = "<div style='display:flex; height:100vh; align-items:center; justify-content:center; flex-direction:column;'><h1 style='color:white; font-family:sans-serif;'>Game Closed.</h1><p style='color:#9ca3af; font-family:sans-serif;'>You can safely close this browser tab.</p></div>";
      }
    });
  }

// --- BROADCAST HOOKS ---
  // Store the original prototype methods safely
  const originalMakeMove = BackgammonGame.prototype.makeMove;
  
  game.makeMove = function(from, to, validateMax = true) {
    // Execute the original move logic, forwarding validateMax so network replay can
    // pass false and bypass the maximum-usage re-check (the sender already validated).
    const success = originalMakeMove.apply(this, [from, to, validateMax]);

    if (success && isNetworkGame && this.currentPlayer === localPlayerRole) {
       if (conn && conn.open) conn.send({ type: 'move', from, to });
    }
    return success;
  };

  const originalUndo = BackgammonGame.prototype.undo;
  
  game.undo = function() {
    const success = originalUndo.apply(this);
    
    if (success && isNetworkGame && this.currentPlayer === localPlayerRole) {
      if (conn && conn.open) conn.send({ type: 'undo' });
    }
    return success;
  };

    const originalRollClick = handleRollClick;
    
const originalEndTurn = BackgammonGame.prototype.endTurn;
  
  game.endTurn = function() {
    // Record who the active player was before the engine switches it
    const activeBefore = this.currentPlayer;
    const result = originalEndTurn.apply(this);
    
    // Broadcast the explicit end-turn signal if we were the active player, and
    // include an authoritative board snapshot so the opponent reconciles to it each
    // turn (self-healing: corrects any drift from imperfect move replay).
    if (isNetworkGame && activeBefore === localPlayerRole) {
      if (conn && conn.open) conn.send({
        type: 'end_turn',
        points: this.points, bar: this.bar, borneOff: this.borneOff,
        cubeValue: this.doublingCubeValue, cubeOwner: this.doublingCubeOwner
      });
    }
    return result;
  };

  function startGame(isRemote = false) {
    if (gameStarted) {
      // If AI was stopped, START re-enables it and triggers the AI turn
      if (aiStopped) {
        aiStopped = false;
        const btnStart = document.getElementById('btn-start-game');
        if (btnStart) { btnStart.disabled = true; btnStart.style.opacity = '0.5'; }
        sysLog('[System] AI resumed by START.');
        updateUI(); // triggers checkAndTriggerAITurn
      }
      return;
    }
    
    if (!isRemote && isNetworkGame && conn && conn.open) {
        conn.send({ type: 'start' });
    }

    gameStarted = true;
    initialRollOff = true;
    game.currentPlayer = 1;
    game.hasRolled = false;
    
    const btnStart = document.getElementById('btn-start-game');
    btnStart.disabled = true;
    btnStart.style.opacity = '0.5';
    
    sysLog(`[System] Game started!`);
    updateUI(); 
  }

// Define handleRollClick inside the DOMContentLoaded block
  handleRollClick = function() {
    if (isNetworkGame && game.currentPlayer !== localPlayerRole) return;

    if (isRolling) return;
    if (pendingDouble) return;   // dice are locked while a double is pending

    // Any roll commits to the current (possibly navigated-to) game state
    exitNavMode();

    // --- CRYPTOGRAPHIC RNG ---
    function secureRoll() {
        const array = new Uint8Array(1);
        window.crypto.getRandomValues(array);
        // 255 is not perfectly divisible by 6. The maximum multiple of 6 is 252.
        // Reject 252, 253, 254, and 255 to maintain a perfectly uniform distribution.
        while (array[0] >= 252) {
            window.crypto.getRandomValues(array);
        }
        return (array[0] % 6) + 1;
    }
    // -------------------------

    let d1, d2;

    if (initialRollOff) {
        do {
            d1 = secureRoll();
            d2 = secureRoll();
        } while (d1 === d2);
        
        game.rollForFirstTurn(d1, d2);
        initialRollOff = false;
        
        if (isNetworkGame && conn && conn.open) {
            conn.send({ type: 'roll_first', dice: [d1, d2] });
        }
    } else {
        // Replay mode: reuse the pre-recorded dice for deterministic replay after
        // a time-travel restore. Falls back to secureRoll() once exhausted.
        if (game.futureRollIndex < game.futureRolls.length) {
            [d1, d2] = game.futureRolls[game.futureRollIndex++];
        } else {
            d1 = secureRoll();
            d2 = secureRoll();
        }

        const result = game.rollDice(d1, d2); 
        if (result && isNetworkGame && conn && conn.open) {
            conn.send({ type: 'roll', dice: [d1, d2] });
        }
    }

    isRolling = true;
    updateUI(); 

    setTimeout(() => {
      isRolling = false;
      updateUI();
    }, 600);
  };

}); // This closing brace now correctly wraps all your event-dependent logic.
