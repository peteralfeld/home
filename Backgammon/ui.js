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
  // Who opened the most recent game (1 or 2); null until a game has been played this
  // session. Restart alternates from this to switch the opener each game.
  let lastStarter = null;
  // Whether the current finished game's points have already been added to the score
  // fields (so the once-per-render updateUI winner branch tallies a game only once).
  let gameScored = false;
  // Whether the game-winning turn has been recorded in the move history (endTurn never runs
  // on the winning move); reset at the start of each game.
  let winTurnRecorded = false;

  // Per-seat running score (game points). Kept in the p1/p2-score fields. Start zeros
  // both; Restart preserves them; the Z buttons zero one; a win adds the game's points.
  const scoreEl = (player) => document.getElementById(player === 1 ? 'p1-score' : 'p2-score');
  function addScore(player, pts) {
    const el = scoreEl(player);
    if (el) el.value = (parseInt(el.value, 10) || 0) + pts;
  }
  function resetScore(player) { const el = scoreEl(player); if (el) el.value = 0; }
  function resetBothScores() { resetScore(1); resetScore(2); }
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

  // Statistics (default OFF): when on, a tournament collects diagnostic stats
  // (currently the escape-roll distribution) during simulation and appends them to
  // the results CSV. Off by default so ordinary batch runs pay nothing.
  let statsOn = false;

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
  let highlightOn = false;
  let autoRollOn  = false;
  let autoRollTimeout = null;

  // ── Board Setup & Analysis mode ───────────────────────────────────────
  // setupMode reroutes the board to free placement (drag/click, no legality),
  // repurposes the green window for the MOV analysis list, and drives CLEAR/
  // INITIAL/MOV/PLAY/START. setupOnRoll = the side to move next when stepping.
  let setupMode    = false;
  let setupSel     = null;   // two-click source location ('pN'|'bar1'|'bar2'|'tray1'|'tray2')
  let setupDragLoc = null;   // drag source location
  let setupOnRoll  = null;   // side to move next (1|2|null)
  let setupKind    = null;   // 'clear' | 'initial' | 'examine' (last entered)
  let setupBaseMsg = 'Examination Mode';   // idle instruction-line text while in setup
  let setupAutoStop = false;         // set by STOP/exit to break the examine auto-play loop
  let startedFromSetup = false;  // a game launched via START from setup → STOP resets it to initial
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

  // Bar drop targets (only active in setup mode; handleDragOver/handleDrop guard on it)
  barP1El.addEventListener('dragover', (e) => handleDragOver(e, 'bar1'));
  barP1El.addEventListener('dragenter', (e) => handleDragOver(e, 'bar1'));
  barP1El.addEventListener('drop', (e) => handleDrop(e, 'bar1'));
  barP2El.addEventListener('dragover', (e) => handleDragOver(e, 'bar2'));
  barP2El.addEventListener('dragenter', (e) => handleDragOver(e, 'bar2'));
  barP2El.addEventListener('drop', (e) => handleDrop(e, 'bar2'));

  // The whole bar column is also a drop target, so a checker can be dropped ANYWHERE
  // on the bar (setupMoveOne redirects bar1/bar2 → the moving checker's own colour).
  const barDividerEl = document.querySelector('.bar-divider');
  if (barDividerEl) {
    barDividerEl.addEventListener('dragover',  (e) => handleDragOver(e, 'bar1'));
    barDividerEl.addEventListener('dragenter', (e) => handleDragOver(e, 'bar1'));
    barDividerEl.addEventListener('drop',      (e) => handleDrop(e, 'bar1'));
  }
  
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
    if (setupMode) return;   // dice are inert while editing a setup position
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
  // Per-seat score reset buttons (Z). Zero one seat's running score; local only.
  document.getElementById('p1-scorereset')?.addEventListener('click', () => resetScore(1));
  document.getElementById('p2-scorereset')?.addEventListener('click', () => resetScore(2));


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

      // True bit-for-bit screen capture (actual rendered pixels) via getDisplayMedia.
      // It ONLY works on a "secure" page: https://…, http://localhost, http://127.0.0.1,
      // or a file:// page. A plain http://192.168.x.x LAN address is NOT secure, so the
      // browser hides the API and no prompt appears.
      if (!window.isSecureContext || !(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia)) {
        sysLog(`[Error] Screen capture unavailable — page is not a secure context (isSecureContext=${window.isSecureContext}). Load via http://localhost/Backgammon/ or your https (GitHub Pages) URL.`);
        label.textContent = 'Use localhost/https';
        setTimeout(() => { label.textContent = original; }, 3000);
        return;
      }

      // Close the export menu first so it isn't captured in the screenshot; wait for the
      // close transition (0.3s) to finish before the capture begins.
      exportPanel.classList.remove('open');
      exportChevron.classList.remove('open');
      await new Promise((r) => setTimeout(r, 350));

      label.textContent = 'Selecting Tab…';
      try {
        let stream;
        try {
          // Preferred: auto-hint the current tab (fewer clicks).
          stream = await navigator.mediaDevices.getDisplayMedia({ preferCurrentTab: true, video: { displaySurface: 'browser' } });
        } catch (eHint) {
          // Some Chrome builds reject those hints outright (no picker). Retry plain.
          sysLog(`[System] Screenshot: hinted request failed (${eHint.name}); retrying with a plain request…`);
          stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        }
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
        // NotAllowedError / AbortError = you dismissed the picker; anything else is a real failure.
        sysLog(`[Error] Screenshot failed: ${err.name}: ${err.message}`);
        label.textContent = (err.name === 'NotAllowedError' || err.name === 'AbortError') ? 'Cancelled' : (err.name || 'Failed');
        setTimeout(() => { label.textContent = original; }, 2500);
      }
    });
  }

  // Board Image — a PNG of JUST the board at full screen quality. Uses the same real-pixel
  // getDisplayMedia capture as Screen Image, then crops to the board's on-screen rectangle
  // (so it's crisp, unlike an html2canvas re-render).
  const exportBoardImgEl = document.getElementById('export-board-img');
  if (exportBoardImgEl) {
    exportBoardImgEl.addEventListener('click', async () => {
      const label = exportBoardImgEl.querySelector('.settings-item-label');
      const original = label.textContent;

      if (!window.isSecureContext || !(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia)) {
        sysLog(`[Error] Board image capture unavailable — page is not a secure context (isSecureContext=${window.isSecureContext}). Load via http://localhost/Backgammon/ or your https URL.`);
        label.textContent = 'Use localhost/https'; setTimeout(() => { label.textContent = original; }, 3000);
        return;
      }

      // Close the export menu so it isn't over the board when we capture.
      exportPanel.classList.remove('open');
      exportChevron.classList.remove('open');
      await new Promise((r) => setTimeout(r, 350));

      label.textContent = 'Selecting Tab…';
      try {
        let stream;
        try {
          stream = await navigator.mediaDevices.getDisplayMedia({ preferCurrentTab: true, video: { displaySurface: 'browser' } });
        } catch (eHint) {
          stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        }
        label.textContent = 'Capturing…';

        const video = document.createElement('video');
        video.srcObject = stream;
        await new Promise((resolve) => { video.onloadedmetadata = () => { video.play(); resolve(); }; });

        // Capture the whole framed board (border, point numbers, and bear-off trays), not
        // just the inner playing surface. Map its CSS-pixel rect to captured-pixel coords
        // (handles devicePixelRatio).
        const target = document.querySelector('.board-wrapper') || boardEl;
        const rect = target.getBoundingClientRect();
        const vw = (window.visualViewport && window.visualViewport.width)  || document.documentElement.clientWidth;
        const vh = (window.visualViewport && window.visualViewport.height) || document.documentElement.clientHeight;
        // getDisplayMedia can return a frame whose aspect ratio differs from the viewport (it
        // fills one axis and crops the other), so videoWidth/vw and videoHeight/vh disagree.
        // Using them per-axis under-scales one axis and clips the board's frame. Use a SINGLE
        // uniform scale — the larger — so the crop reaches the frame on the tighter axis.
        const s = Math.max(video.videoWidth / vw, video.videoHeight / vh);
        const sx = Math.max(0, Math.round(rect.left * s));
        const sy = Math.max(0, Math.round(rect.top  * s));
        const sw = Math.min(Math.round(rect.width  * s), video.videoWidth  - sx);
        const sh = Math.min(Math.round(rect.height * s), video.videoHeight - sy);

        // Square canvas, board centered, transparent padding on the shorter dimension.
        const side = Math.max(sw, sh);
        const canvas = document.createElement('canvas');
        canvas.width = side; canvas.height = side;
        const dx = Math.round((side - sw) / 2), dy = Math.round((side - sh) / 2);
        canvas.getContext('2d').drawImage(video, sx, sy, sw, sh, dx, dy, sw, sh);
        stream.getTracks().forEach((t) => t.stop());

        const link = document.createElement('a');
        link.download = `bg-board-${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();

        sysLog('[System] Board image captured and downloaded.');
        label.textContent = original;
      } catch (err) {
        sysLog(`[Error] Board image failed: ${err.name}: ${err.message}`);
        label.textContent = (err.name === 'NotAllowedError' || err.name === 'AbortError') ? 'Cancelled' : (err.name || 'Failed');
        setTimeout(() => { label.textContent = original; }, 2500);
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
      txt += `BG v. ${bgVersion()}\n`;
      txt += `Date: ${now.toLocaleDateString()} ${now.toLocaleTimeString()}\n`;
      txt += `White: ${p1Type}, Red: ${p2Type}\n\n`;
      txt += withScore
        ? 'Turn  Player  Dice   ' + 'Moves'.padEnd(20) + ' Score (White view)\n\n'
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
      const header = `BG v. ${bgVersion()}  —  ${new Date().toLocaleString()}\n\n`;
      link.href = URL.createObjectURL(new Blob([header + consoleLog.join('\n')], { type: 'text/plain' }));
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
      csv += `BG v. ${bgVersion()}\n`;
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

  // Move Table: best move for every roll from the CURRENT board (setup edits, a mid-
  // game position, or the initial position), for the on-roll side, using the AI
  // selected in the editor at the on-roll side's Depth menu. Worker pool via rankMovesFor. The 15
  // non-doubles come first (so they line up with an opening column), then the 6 doubles.
  const exportOpeningEl = document.getElementById('export-opening');
  if (exportOpeningEl) {
    exportOpeningEl.addEventListener('click', async () => {
      const label = exportOpeningEl.querySelector('.settings-item-label');
      const orig = label ? label.textContent : '';
      const player = setupMode ? (setupOnRoll || 1) : (game.currentPlayer || 1);
      const who = player === 1 ? 'White' : 'Red';
      const depth = playerDepth(player);   // the on-roll side's Depth menu (White = p1, Red = p2)
      // Examination mode → live editor fields; play mode → the on-roll seat's brain (Arwen if human).
      const brainName = setupMode
        ? ((editBrainSel && editBrainSel.value) || 'Arwen')
        : (game.playerTypes[player] === 'ai' ? game.aiNames[player] : 'Arwen');
      const W = setupMode ? editorWeights() : sideWeights(player);
      const board = { points: game.points, bar: game.bar, borneOff: game.borneOff };   // CURRENT position
      const rolls = [[2,1],[3,1],[3,2],[4,1],[4,2],[4,3],[5,1],[5,2],[5,3],[5,4],[6,1],[6,2],[6,3],[6,4],[6,5],
                     [1,1],[2,2],[3,3],[4,4],[5,5],[6,6]];

      let csv = `BG v. ${bgVersion()}  —  ${new Date().toLocaleString()}\n`;
      csv += `Move table — ${brainName}, depth ${depth}, ${who} on roll\n`;
      csv += `Position:,"${describeBoard()}"\nDice,Best move,Score (White view)\n`;
      try {
        for (let k = 0; k < rolls.length; k++) {
          const [d1, d2] = rolls[k];
          const dice = d1 === d2 ? [d1, d1, d1, d1] : [d1, d2];
          if (label) label.textContent = `${k + 1}/${rolls.length}…`;
          gameMessageEl.textContent = `Move table (${brainName} d${depth}, ${who}): ${k + 1}/${rolls.length} — ${d1}-${d2}…`;
          const ranked = await rankMovesFor(board, player, dice, depth, W);
          const best = ranked[0];
          const mv = best ? best.moves.map((m) => `${m.from === 'bar' ? 'bar' : m.from}/${m.to === 'off' ? 'off' : m.to}`).join(', ') : '(none)';
          csv += `${d1} ${d2},"${mv}",${best ? Math.round(best.value) : ''}\n`;
        }
        csv += `\nParameters,${BRAIN_KEYS.join(',')}\n`;
        csv += `${brainName},${BRAIN_KEYS.map((k) => (W[k] != null ? W[k] : 0)).join(',')}\n`;
        downloadCSV(`movetable-${brainName}-d${depth}.csv`, csv);
        gameMessageEl.textContent = `Move table exported — ${brainName}, depth ${depth}, ${who} on roll.`;
        sysLog(`[System] Move table exported (${brainName}, depth ${depth}, ${who} on roll).`);
      } catch (err) {
        sysLog('[Error] Move table failed: ' + (err && err.message));
        gameMessageEl.textContent = 'Move table failed — see log.';
      }
      if (label) label.textContent = orig;
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
  // Time Travel (default ON). When off, move-list clicks and the nav buttons don't
  // navigate the board (guards against accidental clicks). Host-driven remote nav still
  // applies. Applies to local and remote games.
  let timeTravelOn = true;

  // Initialise badges to their defaults
  updateSettingBadge('badge-doubling', doublingOn);
  updateSettingBadge('badge-autostart', autoStartOn);
  updateSettingBadge('badge-timetravel', timeTravelOn);
  updateSettingBadge('badge-showscore', showScoreOn);
  updateSettingBadge('badge-speak', speakOn);
  updateSettingBadge('badge-animation', animationOn);
  updateSettingBadge('badge-highlight',  highlightOn);
  updateSettingBadge('badge-autoroll',   autoRollOn);
  updateSettingBadge('badge-automove',   autoMoveOn);
  updateSettingBadge('badge-stats',      statsOn);

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

  // Time Travel row
  const settingTimeTravelEl = document.getElementById('setting-timetravel');
  if (settingTimeTravelEl) {
    settingTimeTravelEl.addEventListener('click', () => {
      timeTravelOn = !timeTravelOn;
      updateSettingBadge('badge-timetravel', timeTravelOn);
      sysLog(`[System] Time Travel toggled to ${timeTravelOn ? 'ON' : 'OFF'}`);
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

  // Statistics row
  const settingStatsEl = document.getElementById('setting-stats');
  if (settingStatsEl) {
    settingStatsEl.addEventListener('click', () => {
      statsOn = !statsOn;
      updateSettingBadge('badge-stats', statsOn);
      sysLog(`[System] Statistics toggled to ${statsOn ? 'ON' : 'OFF'}`);
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

    // Setup mode owns the board render and both text windows itself; skip the
    // normal dice/turn/history/message/AI pipeline entirely.
    if (setupMode) { renderPoints(); renderBar(); renderBorneOff(); return; }

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
        // Show the offered (doubled) stake while awaiting a decision. Colour the cube
        // by its CURRENT owner (centred = neutral grey), NOT the responder — ownership
        // only transfers on accept, so a pending offer must never look like the
        // responder already owns the cube. A pulsing glow marks the offer instead.
        const offered = game.doublingCubeValue === 1 ? 2 : game.doublingCubeValue * 2;
        doublingCubeEl.textContent = offered;
        if (game.doublingCubeOwner === 1) doublingCubeEl.classList.add('owned-p1');
        else if (game.doublingCubeOwner === 2) doublingCubeEl.classList.add('owned-p2');
        doublingCubeEl.classList.add('double-pending');
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
      // The game-winning move never goes through endTurn (the game is already over), so its
      // turn snapshot would otherwise be missing from the move history. Record it once here
      // so the final move (e.g. the last bear-off) shows in the list. Both machines detect
      // the win from the synced moves and record identically, so no extra network message.
      if (!winTurnRecorded) {
        winTurnRecorded = true;
        const gh = game.gameHistory;
        const already = gh.length && gh[gh.length - 1].turnCount === game.turnCount;
        if (!already && game.currentPlayer !== null && game.playedMovesThisTurn.length) {
          const c = game.currentPlayer === 1 ? 'White' : 'Red';
          game.saveGameSnapshot(`Turn ${game.turnCount} (${c}): Rolled ${game.dice[0]}, ${game.dice[1]}`);
        }
      }
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
      // Tally the winner's game points once (this branch re-runs on every render).
      if (!gameScored) { addScore(winner, pts); gameScored = true; }
      btnUndo.disabled = true;
    } else if (!gameStarted) {
      // UPDATE: Show waiting message for guest, standard message for host
      if (isNetworkGame && localPlayerRole === 2) {
        gameMessageEl.textContent = "Wait for the host to start the game!";
      } else {
        gameMessageEl.textContent = "Ready to go! To play, select players and click on Start";
      }
    } else if (initialRollOff) {
      gameMessageEl.textContent = (isNetworkGame && localPlayerRole === 2)
        ? "Wait for the host to make the initial roll."
        : "Click the dice to decide who starts!";
    } else if (!game.hasRolled) {
	gameMessageEl.textContent = `${game.currentPlayer === 1 ? 'White' : 'Red'}: Click the dice to roll.`;
} else {
      if (game.movesLeft.length === 0) {
        gameMessageEl.textContent = "Turn completed! Switching players...";

        // Only the active player auto-ends the turn.
        if (isNetworkGame && game.currentPlayer !== localPlayerRole) return;

        // Schedule the auto-end ONCE — do NOT clear-and-reschedule on every re-render, or
        // frequent updateUI() calls could perpetually postpone it (leaving the turn
        // unrecorded / the two machines out of sync). Re-validate before ending.
        if (!turnEndTimer) turnEndTimer = setTimeout(() => {
          turnEndTimer = null;
          if (game.hasRolled && game.movesLeft.length === 0 && !game.winner) { game.endTurn(); updateUI(); }
        }, 100);
} else if (!game.hasLegalMoves()) {
  gameMessageEl.textContent = "No legal moves possible! Switching players...";

  // Let the rolled dice stay visible on the screen!
  // Only the active player auto-ends the turn.
  if (isNetworkGame && game.currentPlayer !== localPlayerRole) return;

  // Schedule the no-move (dance) auto-end ONCE, after ~2s so players can read the dice.
  // Scheduling once (rather than clear-and-reschedule) prevents repeated re-renders from
  // perpetually postponing it — which would leave the dance turn unrecorded and desync the
  // two machines. Re-validate before ending in case the state changed meanwhile.
  if (!turnEndTimer) turnEndTimer = setTimeout(() => {
    turnEndTimer = null;
    if (game.hasRolled && !game.hasLegalMoves() && !game.winner) { game.endTurn(); updateUI(); }
  }, 2000);
      } else {
          if (turnEndTimer) {
          clearTimeout(turnEndTimer);
          turnEndTimer = null;
        }
        gameMessageEl.textContent = game.currentPlayer === 1 ? 'White to move descending' : 'Red to move ascending';
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

          if (setupMode) {
            checker.setAttribute('draggable', 'true');
            setupDragAttach(checker, 'p' + i);
          }

          container.appendChild(checker);
        }
      }
    }
  }

  // Overlap (negative top margin) so a crowded bar can show up to 15 checkers,
  // mirroring the point-stacking logic. Returns 0 (no overlap) when they fit.
  function barStackOverlap(barEl, count) {
    if (count < 2) return 0;
    const rect = barEl.getBoundingClientRect();
    const checkerSize = rect.width * 0.8;
    const gap = 5;   // the flex `gap` between bar checkers (see .bar-container)
    return Math.min(0, (rect.height * 0.95 - count * checkerSize) / (count - 1) - gap);
  }

  /**
   * Render bar containers.
   */
  function renderBar() {
    barP1El.innerHTML = '';
    barP2El.innerHTML = '';

    // Player 1 (White) Bar
    const barOverlap1 = barStackOverlap(barP1El, game.bar[1]);
    for (let c = 0; c < game.bar[1]; c++) {
      const checker = document.createElement('div');
      checker.className = 'checker player-1';
      if (c > 0) checker.style.marginTop = `${barOverlap1}px`;
	if (game.currentPlayer === 1 && game.hasRolled && game.movesLeft.length > 0 && game.playerTypes[1] === 'human' && (!isNetworkGame || game.currentPlayer === localPlayerRole)) {
        checker.setAttribute('draggable', 'true');
        setupDragEvents(checker, "bar");
      }
      if (setupMode) {
        checker.setAttribute('draggable', 'true');
        setupDragAttach(checker, 'bar1');
      }
      barP1El.appendChild(checker);
    }

    // Player 2 (Red) Bar
    const barOverlap2 = barStackOverlap(barP2El, game.bar[2]);
    for (let c = 0; c < game.bar[2]; c++) {
      const checker = document.createElement('div');
      checker.className = 'checker player-2';
      if (c > 0) checker.style.marginTop = `${barOverlap2}px`;
	if (game.currentPlayer === 2 && game.hasRolled && game.movesLeft.length > 0 && game.playerTypes[2] === 'human' && (!isNetworkGame || game.currentPlayer === localPlayerRole)) {
        checker.setAttribute('draggable', 'true');
        setupDragEvents(checker, "bar");
      }
      if (setupMode) {
        checker.setAttribute('draggable', 'true');
        setupDragAttach(checker, 'bar2');
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
      if (setupMode) {
        slab.style.pointerEvents = 'auto';   // CSS sets none; re-enable so slabs can be dragged out
        slab.setAttribute('draggable', 'true');
        setupDragAttach(slab, 'tray1');
        slab.addEventListener('dragover', (e) => handleDragOver(e, 'tray1'));
        slab.addEventListener('drop', (e) => handleDrop(e, 'tray1'));
      }
      bearOffP1.appendChild(slab);
    }

    for (let c = 0; c < game.borneOff[2]; c++) {
      const slab = document.createElement('div');
      slab.className = 'borne-checker player-2';
      if (setupMode) {
        slab.style.pointerEvents = 'auto';   // CSS sets none; re-enable so slabs can be dragged out
        slab.setAttribute('draggable', 'true');
        setupDragAttach(slab, 'tray2');
        slab.addEventListener('dragover', (e) => handleDragOver(e, 'tray2'));
        slab.addEventListener('drop', (e) => handleDrop(e, 'tray2'));
      }
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
    if (setupMode) { e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'; return; }
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
    if (setupMode) {
      let loc = target;
      if (target === 'off') loc = (e.currentTarget === bearOffP1) ? 'tray1' : 'tray2';
      else if (typeof target === 'number') loc = 'p' + target;
      setupDrop(loc);
      return;
    }
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
    if (setupMode) { setupClickLoc('p' + pointIdx); return; }
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
    if (setupMode) { setupClickLoc('bar' + player); return; }
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
    if (setupMode) { setupClickLoc('tray' + player); return; }
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
    startedFromSetup  = false;
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
    // In a remote game the host is in control of restart; the guest's button does nothing.
    if (isNetworkGame && localPlayerRole !== 1) return;

    // No game has been played yet this session -> behave like the Start button (a roll-off
    // decides the first opener). startGame() also notifies the guest in a network game.
    if (lastStarter == null) {
      startGame(false);
      return;
    }

    // A game has been played -> alternate the opener and launch the next game immediately.
    const newStarter = (lastStarter === 1) ? 2 : 1;
    if (isNetworkGame && localPlayerRole === 1 && conn && conn.open) {
      conn.send({ type: 'restart', starter: newStarter });
      sysLog(`[Network] Sent restart to guest (starter = player ${newStarter}).`);
    }
    applyRestartNewGame(newStarter);
  }

  /**
   * Reset the board and immediately begin a new game with `starter` on roll — no roll-off,
   * no separate Start click. The opener's first roll happens through the normal path: an AI
   * rolls itself, a human auto-rolls if Auto Roll is on, otherwise the human clicks Roll.
   * Used by Restart to alternate the opener each game, locally and (mirrored from the host)
   * over the network.
   */
  function applyRestartNewGame(starter) {
    if (turnEndTimer)    { clearTimeout(turnEndTimer);    turnEndTimer    = null; }
    if (aiActionTimeout) { clearTimeout(aiActionTimeout); aiActionTimeout = null; }
    if (autoRollTimeout) { clearTimeout(autoRollTimeout); autoRollTimeout = null; }

    aiStopped         = false;
    isAIPlaying       = false;
    selectedSource    = null;
    legalDestinations = [];
    initialRollOff    = false;   // opener is predetermined; the first roll is a normal roll
    isRolling         = false;
    pendingDouble     = null;
    networkQueue      = [];
    isProcessingQueue = false;

    game.restart();
    syncPlayersFromMenus();              // re-apply the White/Red menu picks after the reset
    game.beginGameWithStarter(starter);  // forced opener, awaiting the first (normal) roll
    gameStarted      = true;
    startedFromSetup = false;
    lastStarter      = starter;
    gameScored       = false;   // new game to tally; scores themselves are preserved
    winTurnRecorded  = false;

    // No overlay / Start needed — the game is already running.
    const overlay = document.getElementById('start-menu-overlay');
    if (overlay) overlay.style.display = 'none';
    const btnStart = document.getElementById('btn-start-game');
    if (btnStart) { btnStart.disabled = true; btnStart.style.opacity = '0.5'; }

    renderDie(die1El, 0);
    renderDie(die2El, 0);
    updateUI();   // -> checkAndTriggerAITurn (AI opener) / checkAndAutoRoll (human, if Auto Roll)
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

  // Score of a snapshot's (post-move) position, always in WHITE's view (positive =
  // good for White, negative = good for Red) — one fixed frame so the column reads
  // consistently and a dance shows the same value twice instead of flipping sign.
  // The scoring AI is still the side on roll there (matters only for mixed brains).
  // Cached on the snapshot (evaluated once) until the scoring context changes.
  function snapshotScore(snapshot) {
    if (snapshot._score !== undefined) return snapshot._score;
    const onRoll = snapshot.isInitial
      ? snapshot.currentPlayer
      : (snapshot.currentPlayer === 1 ? 2 : 1);
    snapshot._score = game.evaluate(snapshot.points, snapshot.bar, snapshot.borneOff, scoringWeights(onRoll));
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
    if (setupMode) return;   // the green window shows the MOV list in setup mode
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
          ${showScore ? '<th style="padding: 4px; width: 20%; text-align: left;" title="White\'s view: positive = good for White, negative = good for Red">Score</th>' : ''}
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
          if (!timeTravelOn) return;   // time travel off (setting-gated; guest defaults off)
          ensureNavBuffer();
          navigateTo(idx);
          // Sync the host's jump to this stage over to the guest.
          if (isNetworkGame && conn && conn.open) conn.send({ type: 'nav', action: 'goto', idx });
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
          // White view: positive (good for White) drawn white, negative (good for Red) red.
          const scoreColor = scoreVal > 0 ? '#ffffff' : (scoreVal < 0 ? '#f87171' : '#9ca3af');
          scoreCell = `<td style="padding: 2px 4px; font-family: monospace; font-weight: bold; color: ${scoreColor};">${scoreVal}</td>`;
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
    if (setupMode) return;  // history navigation is disabled during setup
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
      if (e.isTrusted && !timeTravelOn) return;   // time travel off (setting-gated; guest defaults off)
      ensureNavBuffer();
      navigateTo(0);
      if (e.isTrusted && isNetworkGame && conn && conn.open) conn.send({ type: 'nav', action: 'first' });
    });

    if (btnBack) btnBack.addEventListener('click', (e) => {
      if (e.isTrusted && !timeTravelOn) return;   // time travel off (setting-gated; guest defaults off)
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
      if (e.isTrusted && isNetworkGame && conn && conn.open) conn.send({ type: 'nav', action: 'back' });
    });

    if (btnFwd) btnFwd.addEventListener('click', (e) => {
      if (e.isTrusted && !timeTravelOn) return;   // time travel off (setting-gated; guest defaults off)
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
      if (e.isTrusted && isNetworkGame && conn && conn.open) conn.send({ type: 'nav', action: 'fwd' });
    });

    if (btnLast) btnLast.addEventListener('click', (e) => {
      if (e.isTrusted && !timeTravelOn) return;   // time travel off (setting-gated; guest defaults off)
      if (historyNavIndex === null) return;
      // Navigate to the final buffered snapshot, then exit nav mode
      navigateTo(historyNavBuffer.length - 1);
      historyNavIndex  = null;
      historyNavBuffer = [];
      updateNavButtons();
      // updateUI already called by navigateTo
      if (e.isTrusted && isNetworkGame && conn && conn.open) conn.send({ type: 'nav', action: 'last' });
    });
  })();
  // ─────────────────────────────────────────────────────────────────────

// Initialize player types but wait for manual start
  game.playerTypes[1] = document.getElementById('p1-type').value;
  game.playerTypes[2] = document.getElementById('p2-type').value;
  gameStarted = false;
  sysLog(`[System] Game ready, waiting for manual start.`);

document.getElementById('btn-start-game').addEventListener('click', () => {
    if (setupMode) { doSTART(); return; }   // START launches a game from the setup position
    startGame(false);
});

  // STOP button — in setup mode it exits setup back to the initial position;
  // otherwise it pauses AI (START re-enables it).
  const btnStop = document.getElementById('btn-stop');
  if (btnStop) {
    btnStop.addEventListener('click', (e) => {
      if (setupMode) { exitSetup(); return; }
      if (startedFromSetup) { startedFromSetup = false; performRestart(); return; }
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
  syncDepthMenu(1);
  syncDepthMenu(2);

  // Listen for live dropdown changes so players can swap Human/AI in/out mid-game
  document.getElementById('p1-type').addEventListener('change', (e) => {
    applyPlayerMenu(1);
    syncDepthMenu(1);           // enable/disable White's depth menu for AI/Human
    clearHistoryScoreCache();   // scoring AI may have changed
    sysLog(`[System] White player set to ${e.target.value}`);
    updateUI(); // Refresh board so checkers instantly become draggable/un-draggable
    checkAndTriggerAITurn();
  });

  document.getElementById('p2-type').addEventListener('change', (e) => {
    applyPlayerMenu(2);
    syncDepthMenu(2);           // enable/disable Red's depth menu for AI/Human
    clearHistoryScoreCache();   // scoring AI may have changed
    sysLog(`[System] Red player set to ${e.target.value}`);
    updateUI(); // Refresh board so checkers instantly become draggable/un-draggable
    checkAndTriggerAITurn();
  });

  // ── AI parameter editor ───────────────────────────────────
  const editBrainSel  = document.getElementById('edit-brain');
  const brainParamsEl = document.getElementById('brain-params');
  const BRAIN_KEYS = ['PC', 'BO', 'EC1', 'EC0', 'HB', 'AN', 'DO', 'IO', 'DP', 'IP', 'DE', 'F0', 'F1', 'F2', 'F3', 'F4', 'F5', 'BE', 'G5', 'G7', 'G4', 'GA', 'DT', 'AT'];

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
      `// BG v. ${bgVersion()}\n` +
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
  let tournamentStop     = false;   // set by entering setup mode; halts a running tournament/compete

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
  document.getElementById('btn-compete')?.addEventListener('click', () => {
    if (evolveRunning) { gameMessageEl.textContent = 'Stop evolution before running Compete.'; return; }
    if (!tournamentRunning) runCompete();
  });

  // ── Genetic evolution (Phase I: single-threaded) ──────────
  const EVO_EVAL = ['PC', 'BO', 'EC1', 'EC0', 'HB', 'AN', 'DO', 'IO', 'DP', 'IP', 'DE', 'F0', 'F1', 'F2', 'F3', 'F4', 'F5', 'BE', 'G5', 'G7', 'G4', 'GA'];
  const EVO_ALL = [...EVO_EVAL, 'DT', 'AT'];  // the 24 evolvable numbers (22 eval + DT/AT)
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

  // AI lookahead depth in plies (expectimax over the dice) for BATCH runs —
  // tournament and evolution — read from the batch-depth dropdown next to Evolve.
  // 1 = one-ply static baseline.
  function lookaheadDepth() {
    const el = document.getElementById('batch-depth');
    let d = el ? parseInt(el.value, 10) : 1;
    if (isNaN(d) || d < 0) d = 1;          // 0 is valid (play first legal move)
    return d;
  }

  // Cooperative yield: hands control back to the browser (so it can paint and stay
  // responsive) but only if enough wall-clock time has passed since the last yield.
  // Time-slicing keeps fast depth-1 runs from drowning in setTimeout overhead while
  // still guaranteeing the main thread breathes at least every ~sliceMs during slow
  // depth-2+ matches — which is what prevents Chrome's "Page unresponsive" dialog.
  let _lastBreath = (typeof performance !== 'undefined' ? performance.now() : Date.now());
  function breathe(sliceMs = 50) {
    const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    if (now - _lastBreath < sliceMs) return Promise.resolve();
    _lastBreath = now;
    return new Promise((r) => setTimeout(r, 0));
  }

  // ---- Web Worker pool -------------------------------------------------------
  // The search runs off the main thread (no popup, no pause overhead) and across
  // all cores. Requires an http(s) origin: on file:// `new Worker` throws, so we
  // detect availability once and fall back to the single-thread + breathe() path.
  let numWorkers = (navigator.hardwareConcurrency && navigator.hardwareConcurrency > 0)
    ? navigator.hardwareConcurrency : 4;
  // Cache-bust the worker on every page load. A hard refresh reloads the page and its
  // scripts but NOT reliably a worker's importScripts('game.js') subresource, so the
  // pool can keep running a stale game.js after an engine edit (this silently zeroed
  // the escape-roll stats). One fresh stamp per load forces both BackgammonWorker.js
  // and (via location.search inside it) game.js to re-fetch. Constant per load, so all
  // workers in a session share the URL and it's cached within the load, fresh across.
  const WORKER_SRC = 'BackgammonWorker.js?v=' + Date.now();
  let workerPool = [];
  let workersAvailable = false;
  try {
    const probe = new Worker(WORKER_SRC);
    // A missing/broken worker script 404s ASYNCHRONOUSLY (new Worker doesn't throw),
    // so catch that here and honestly flip to single-thread + update the field —
    // otherwise the app shows "N workers" while silently running on one core.
    probe.onerror = () => {
      if (!workersAvailable) return;
      workersAvailable = false;
      const el = document.getElementById('num-workers');
      if (el) { el.value = 0; el.disabled = true; el.title = 'Web Workers failed to load (is BackgammonWorker.js deployed alongside index.html?). Running single-threaded.'; }
      sysLog('[Workers] BackgammonWorker.js failed to load — running single-threaded. Check that it is deployed next to index.html.');
    };
    workerPool.push(probe);
    workersAvailable = true;
    sysLog(`[Workers] enabled — ${numWorkers} of ${navigator.hardwareConcurrency || '?'} cores.`);
  } catch (e) {
    workersAvailable = false;
    sysLog(`[Workers] unavailable (${e && e.message}); using single thread. Serve over http:// to enable.`);
  }
  function getWorker() { return workerPool.length ? workerPool.pop() : new Worker(WORKER_SRC); }
  function releaseWorker(w) { workerPool.push(w); }
  function terminateWorkers() { workerPool.forEach((w) => { try { w.terminate(); } catch (e) {} }); workerPool = []; }

  // Worker-count field (top line, right of the version label). Defaults to the core
  // count; the user can change it (as in Reversi). Changing it recycles the pool.
  (function initWorkerField() {
    const el = document.getElementById('num-workers');
    if (!el) return;
    if (!workersAvailable) { el.value = 0; el.disabled = true; el.title = 'Web Workers unavailable — serve the app over http:// (e.g. XAMPP) to enable parallel search.'; return; }
    el.value = numWorkers;
    el.addEventListener('change', () => {
      let n = parseInt(el.value, 10);
      const max = (navigator.hardwareConcurrency || 16);
      if (isNaN(n) || n < 1) n = 1;
      if (n > 64) n = 64;                    // sane upper bound
      numWorkers = n; el.value = n;
      terminateWorkers();                    // fresh workers spawn on next use at the new count
      sysLog(`[Workers] set to ${numWorkers} (of ${navigator.hardwareConcurrency || '?'} cores).`);
    });
  })();

  // Run a queue of jobs across up to numWorkers workers, keeping the pool busy.
  // makeMsg(job,i) builds the postMessage payload; onResult(data,job,i) consumes it.
  function runJobsParallel(jobs, makeMsg, onResult) {
    return new Promise((resolve, reject) => {
      const total = jobs.length;
      if (total === 0) { resolve(); return; }
      let next = 0, done = 0, active = 0;
      const pump = () => {
        while (active < numWorkers && next < total) {
          const i = next++, job = jobs[i], w = getWorker();
          active++;
          w.onmessage = (e) => {
            active--; releaseWorker(w);
            if (e.data && e.data.error) { reject(new Error(e.data.error)); return; }
            try { onResult(e.data, job, i); } catch (err) { reject(err); return; }
            done++;
            if (done === total) resolve(); else pump();
          };
          w.onerror = (err) => { active--; reject(err.error || new Error(err.message || 'worker error')); };
          w.postMessage(makeMsg(job, i));
        }
      };
      pump();
    });
  }

  // Play a list of match specs in parallel (one match per worker). Each spec:
  // { wA, wB, X, depthA, depthB, ...meta }. onResult(res, spec, i) tallies live.
  function runMatchesParallel(specs, onResult) {
    return runJobsParallel(
      specs,
      (s) => ({ cmd: 'play_match', wA: s.wA, wB: s.wB, X: s.X, depthA: s.depthA, depthB: s.depthB, collectStats: s.collectStats }),
      (data, spec, i) => onResult(data.result, spec, i),
    );
  }

  // Local copies of the dice distribution / win sentinel for combining worker
  // results on the main thread (kept in lockstep with game.js's BG_DICE_DIST/BG_WIN).
  const UI_DICE_DIST = (() => { const r = []; for (let i = 1; i <= 6; i++) for (let j = i; j <= 6; j++) r.push([i, j, i === j ? 1 : 2]); return r; })();
  const UI_BG_WIN = 1e9;

  // Compute the AI's move for `depth` >= 2 by farming each (my move × opponent dice
  // roll) out to the worker pool, then combining exactly as the sync search does:
  // value(m1) = Σ weight·expectiRollValue(afterM1, opp, roll, depth-1) / 36, White
  // maximizes / Red minimizes, plus the root-only DE bonus. Returns the same move as
  // game.getBestAIMove(depth).
  async function computeAIMoveParallel(depth) {
    const player = game.currentPlayer;
    const W = game.aiWeights[player];
    const opp = player === 1 ? 2 : 1;
    const states = game.generateAllCompleteTurnMoves(player, game.movesLeft);
    if (!states.length) return null;
    if (depth <= 0) return states[0].moves;
    if (depth <= 1) return game.getBestAIMove(1);   // one-ply is instant; no need to farm out

    const parentContact = game.hasContact(game.points, game.bar);
    const rollVals = states.map(() => new Array(UI_DICE_DIST.length).fill(0));

    // Build one task per (non-terminal m1, dice roll).
    const tasks = [];
    states.forEach((st, si) => {
      if (st.borneOff[1] >= 15 || st.borneOff[2] >= 15) return;   // terminal m1 scored directly
      UI_DICE_DIST.forEach(([d1, d2], ri) => {
        const dice = d1 === d2 ? [d1, d1, d1, d1] : [d1, d2];
        tasks.push({ si, ri, dice, board: { points: st.points, bar: st.bar, borneOff: st.borneOff } });
      });
    });

    let done = 0;
    const label = gameMessageEl.textContent;
    await runJobsParallel(
      tasks,
      (t) => ({ cmd: 'search', board: t.board, player: opp, dice: t.dice, plies: depth - 1, weights: W }),
      (data, t) => { rollVals[t.si][t.ri] = data.val; if ((++done % 21) === 0) gameMessageEl.textContent = label; },
    );

    let bestState = null, bestVal = player === 1 ? -Infinity : Infinity;
    states.forEach((st, si) => {
      let val;
      const whiteWon = st.borneOff[1] >= 15, redWon = st.borneOff[2] >= 15;
      if (whiteWon) val = UI_BG_WIN;
      else if (redWon) val = -UI_BG_WIN;
      else {
        let acc = 0;
        UI_DICE_DIST.forEach(([, , wt], ri) => { acc += wt * rollVals[si][ri]; });
        val = acc / 36;
      }
      if (!whiteWon && !redWon && parentContact && !game.hasContact(st.points, st.bar)) {
        const pipW = game.pipCountP(st.points, st.bar, 1), pipR = game.pipCountP(st.points, st.bar, 2);
        if (player === 1 && pipW < pipR) val += W.DE;
        else if (player === 2 && pipR < pipW) val -= W.DE;
      }
      if (player === 1) { if (val > bestVal) { bestVal = val; bestState = st; } }
      else { if (val < bestVal) { bestVal = val; bestState = st; } }
    });
    return bestState ? bestState.moves : null;
  }

  // Rank every legal complete turn for `player` from an ARBITRARY board, using the
  // worker pool for depth >= 2 (same tasks/combination as computeAIMoveParallel).
  // Returns [{ moves, value }] sorted best-for-mover — the parallel twin of
  // game.rankAIMoves, so MOV / PLAY / the opening table get real multithreading.
  async function rankMovesParallel(board, player, dice, depth, W) {
    const opp = player === 1 ? 2 : 1;
    const states = game._statesFrom(board, player, dice);
    if (!states.length) return [];
    const parentContact = game.hasContact(board.points, board.bar);
    const withDE = (st, val) => {
      const wWon = st.borneOff[1] >= 15, rWon = st.borneOff[2] >= 15;
      if (!wWon && !rWon && parentContact && !game.hasContact(st.points, st.bar)) {
        const pipW = game.pipCountP(st.points, st.bar, 1), pipR = game.pipCountP(st.points, st.bar, 2);
        if (player === 1 && pipW < pipR) val += W.DE;
        else if (player === 2 && pipR < pipW) val -= W.DE;
      }
      return val;
    };

    let scored;
    if (depth <= 1) {
      scored = states.map((st) => {
        const wWon = st.borneOff[1] >= 15, rWon = st.borneOff[2] >= 15;
        let val = wWon ? UI_BG_WIN : rWon ? -UI_BG_WIN : game.evaluate(st.points, st.bar, st.borneOff, W);
        return { moves: st.moves, value: withDE(st, val) };
      });
    } else {
      const rollVals = states.map(() => new Array(UI_DICE_DIST.length).fill(0));
      const tasks = [];
      states.forEach((st, si) => {
        if (st.borneOff[1] >= 15 || st.borneOff[2] >= 15) return;
        UI_DICE_DIST.forEach(([d1, d2], ri) => {
          const dd = d1 === d2 ? [d1, d1, d1, d1] : [d1, d2];
          tasks.push({ si, ri, dice: dd, board: { points: st.points, bar: st.bar, borneOff: st.borneOff } });
        });
      });
      await runJobsParallel(
        tasks,
        (t) => ({ cmd: 'search', board: t.board, player: opp, dice: t.dice, plies: depth - 1, weights: W }),
        (data, t) => { rollVals[t.si][t.ri] = data.val; },
      );
      scored = states.map((st, si) => {
        const wWon = st.borneOff[1] >= 15, rWon = st.borneOff[2] >= 15;
        let val;
        if (wWon) val = UI_BG_WIN; else if (rWon) val = -UI_BG_WIN;
        else { let acc = 0; UI_DICE_DIST.forEach(([, , wt], ri) => { acc += wt * rollVals[si][ri]; }); val = acc / 36; }
        return { moves: st.moves, value: withDE(st, val) };
      });
    }
    scored.sort((a, b) => (player === 1 ? b.value - a.value : a.value - b.value));
    return scored;
  }

  // Dispatch: worker-parallel rank for depth >= 2 when workers exist; otherwise a
  // synchronous rank on a scratch game seeded with `board` (so it works off any board).
  async function rankMovesFor(board, player, dice, depth, W) {
    if (workersAvailable && depth >= 2) return await rankMovesParallel(board, player, dice, depth, W);
    const s = new game.constructor();
    s.points = board.points; s.bar = board.bar; s.borneOff = board.borneOff;
    return s.rankAIMoves(player, dice, depth, W);
  }

  // Per-player interactive AI depth, read from that side's Depth menu (White = p1,
  // Red = p2). Lets the same AI play at different depths so the effect of depth is
  // visible. Only consulted when the player is an AI.
  function playerDepth(player) {
    const el = document.getElementById(player === 1 ? 'p1-depth' : 'p2-depth');
    let d = el ? parseInt(el.value, 10) : 1;
    if (isNaN(d) || d < 0) d = 1;          // 0 is valid (play first legal move)
    return d;
  }

  // A side's Depth menu only affects play when that side is an AI. We keep it
  // clickable at all times (so it can be pre-set, and never reads as a dead
  // control) and just dim it for Human to signal it's inactive for that side.
  function syncDepthMenu(player) {
    const typeSel = document.getElementById(player === 1 ? 'p1-type' : 'p2-type');
    const depthSel = document.getElementById(player === 1 ? 'p1-depth' : 'p2-depth');
    if (!typeSel || !depthSel) return;
    // A human seat still uses this depth in setup (Arwen at that depth), so keep it
    // clearly readable — only a slight dim to hint it's inactive in ordinary play.
    depthSel.style.opacity = (typeSel.value === 'human') ? '0.85' : '1';
  }

  // Play nMatches matches to X points. Net (fitness) = A's match wins - B's match
  // wins, so a blown-up cube can never inflate the signal: a match win counts 1.
  // The A/B argument order is swapped on alternate matches to cancel any residual
  // first-game side bias (simulateBGMatch already alternates colours within a match).
  async function evoMatch(A, B, nMatches, label) {
    const X = matchLength();
    const depth = lookaheadDepth();
    let winsA = 0, winsB = 0, done = 0;
    const tally = (res, swap) => {
      const aWon = swap ? (res.winner === 'B') : (res.winner === 'A');
      if (aWon) winsA++; else winsB++;
      done++;
      if (label) gameMessageEl.textContent = `${label} — ${done}/${nMatches} matches (to ${X})`;
    };

    if (workersAvailable) {
      // One match per worker, across the pool.
      const specs = [];
      for (let i = 0; i < nMatches; i++) {
        const swap = (i % 2 === 1);
        specs.push({ wA: swap ? B : A, wB: swap ? A : B, X, depthA: depth, depthB: depth, swap });
      }
      await runMatchesParallel(specs, (res, spec) => tally(res, spec.swap));
    } else {
      for (let i = 0; i < nMatches && !evolveStop; i++) {
        const swap = (i % 2 === 1);
        const res = await simulateBGMatchYielding(swap ? B : A, swap ? A : B, X, depth, depth, breathe);
        tally(res, swap);
        await new Promise((r) => setTimeout(r, 0));   // keep the UI alive between matches
      }
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
    csv += 'BG v. ' + bgVersion() + '\n';
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
    if (btn) { btn.textContent = 'Stop E'; btn.style.background = '#991b1b'; }
    sysLog(`[Evolve] Start from ${baseName}: maxGens=${maxGens}, matches/sample=${n}, matchLen=${matchLength()}, R=${R}%.`);

    // Two downloads up front (a run-info note, then the starting AI) so the browser's
    // multi-download approval is handled at the start, not whenever the first champion
    // happens to appear.
    const info = `Backgammon Evolution\nBG v. ${bgVersion()}\n${new Date().toLocaleString()}\n`
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

  const PARAM_ORDER = ['PC', 'BO', 'EC1', 'EC0', 'HB', 'AN', 'DO', 'IO', 'DP', 'IP', 'DE', 'F0', 'F1', 'F2', 'F3', 'F4', 'F5', 'BE', 'G5', 'G7', 'G4', 'GA'];
  const numCommas = (n) => n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  // Version stamp for exported files — read live from the page's version label so it
  // always matches the current build (the snapshot ritual only edits index.html).
  function bgVersion() {
    const el = document.getElementById('app-version');
    const m = el && el.textContent.match(/v\.\s*(\d+)/i);
    return m ? m[1] : '?';
  }

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
  function buildTournamentCSV(names, mWins, mLoss, gpts, h2h, matchesPer, X, tStart, tEnd, escHist) {
    const ranked = names.slice().sort((a, b) => (mWins[b] - mWins[a]) || (gpts[b] - gpts[a]));
    let csv = 'Backgammon Tournament Results\n';
    csv += 'BG v. ' + bgVersion() + '\n';
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

    // Statistics (only when the Statistics setting was on). Escape-roll distribution:
    // every checker, both sides, tallied once per ply by how many of the 6 die-values
    // give it an unblocked forward landing. 0 = sealed (entombment / closeout); 6 =
    // free. Tells us how often each containment level actually occurs in self-play.
    if (escHist) {
      const hist = escHist.slice(0, 7);                       // [0..6] = escape-roll histogram
      const tot = hist.reduce((a, b) => a + b, 0) || 1;
      csv += '\nStatistics\n';
      csv += 'Escape-roll distribution (checkers by number of open dice, both sides, every position)\n';
      csv += 'Open dice (escape rolls),' + [0, 1, 2, 3, 4, 5, 6].join(',') + '\n';
      csv += 'Count,' + hist.join(',') + '\n';
      csv += 'Percent,' + hist.map((c) => (100 * c / tot).toFixed(3)).join(',') + '\n';

      // BE effectiveness — how often the bar-entombment weight actually changed the move
      // the AI picked (re-ranking with BE zeroed). Measured at depth 1 only; a static bar
      // penalty mostly can't bite at one ply (see beBiteInto in game.js).
      const decisions = escHist[7] || 0, bites = escHist[8] || 0;
      csv += '\nBE effectiveness (depth-1 decisions where bar-entombment changed the chosen move)\n';
      if (decisions > 0) {
        csv += 'Decisions,Bites,Percent\n';
        csv += `${decisions},${bites},${(100 * bites / decisions).toFixed(3)}\n`;
      } else {
        csv += '(no depth-1 decisions measured — BE bite is only tracked at depth 1)\n';
      }
    }
    return csv;
  }

  // Round-robin: each selected pair plays `matches/pair` matches to the shared
  // match length X. Standings are by matches won (cube-safe: a match win counts 1).
  // Progress shows in the instruction window; a detailed CSV downloads at the end.
  // Compete: play the two AIs chosen in the player rows (WP = White, RP = Red)
  // head-to-head, each at ITS OWN depth (p1-depth / p2-depth). Colours alternate to
  // cancel side bias, but each brain keeps its depth. Requires both sides to be AIs.
  async function runCompete() {
    const p1 = document.getElementById('p1-type').value;   // White selection
    const p2 = document.getElementById('p2-type').value;   // Red selection
    if (p1 === 'human' || p2 === 'human') {
      gameMessageEl.textContent = 'Specify AI players to compete.';
      return;
    }

    const wWhite = game.personalityWeights(p1), wRed = game.personalityWeights(p2);
    const dWhite = playerDepth(1), dRed = playerDepth(2);
    const X = matchLength();
    const nMatches = Math.max(1, parseInt(document.getElementById('tourney-games').value, 10) || 50);

    tournamentRunning = true; tournamentStop = false;
    const btn = document.getElementById('btn-compete');
    if (btn) btn.disabled = true;
    const tStart = new Date();
    let winsWhite = 0, winsRed = 0;   // match wins for WP / RP
    let gptsWhite = 0, gptsRed = 0;   // total game points for WP / RP (tiebreak)
    let totalGames = 0;

    // Show status before work starts, and yield once so the browser paints it.
    gameMessageEl.textContent = `Compete starting… ${p1} d${dWhite} vs ${p2} d${dRed}, ${nMatches} matches to ${X}…`;
    await new Promise((r) => setTimeout(r, 0));

    let done = 0;
    // Tally one finished match (A is WP when !swap, else RP).
    const tally = (res, swap) => {
      const whiteWon = swap ? (res.winner === 'B') : (res.winner === 'A');
      if (whiteWon) winsWhite++; else winsRed++;
      gptsWhite += swap ? res.scoreB : res.scoreA;
      gptsRed   += swap ? res.scoreA : res.scoreB;
      totalGames += res.games;
      done++;
      gameMessageEl.textContent = `Compete… ${done}/${nMatches} (to ${X}) — ${p1} d${dWhite}: ${winsWhite}  ${p2} d${dRed}: ${winsRed}`;
    };

    if (workersAvailable) {
      // One match per worker — depth travels with the brain via the paired depths.
      const specs = [];
      for (let i = 0; i < nMatches; i++) {
        const swap = (i % 2 === 1);
        specs.push({
          wA: swap ? wRed : wWhite, wB: swap ? wWhite : wRed,
          X, depthA: swap ? dRed : dWhite, depthB: swap ? dWhite : dRed, swap,
        });
      }
      await runMatchesParallel(specs, (res, spec) => tally(res, spec.swap));
    } else {
      for (let i = 0; i < nMatches; i++) {
        if (tournamentStop) break;
        const swap = (i % 2 === 1);
        const res = await simulateBGMatchYielding(
          swap ? wRed : wWhite, swap ? wWhite : wRed, X,
          swap ? dRed : dWhite, swap ? dWhite : dRed, breathe);
        tally(res, swap);
        await new Promise((r) => setTimeout(r, 0));
      }
    }

    if (tournamentStop) { tournamentRunning = false; if (btn) btn.disabled = false; return; }
    const tEnd = new Date();
    const secs = ((tEnd - tStart) / 1000).toFixed(1);
    const lead = winsWhite === winsRed ? 'tie'
      : (winsWhite > winsRed ? `${p1} (WP, d${dWhite}) wins` : `${p2} (RP, d${dRed}) wins`);
    downloadCSV('BGCompeteResults.csv', buildCompeteCSV({
      p1, p2, dWhite, dRed, winsWhite, winsRed, gptsWhite, gptsRed,
      totalGames, nMatches, X, tStart, tEnd,
    }));
    gameMessageEl.textContent = `Compete done — ${lead}: ${p1} d${dWhite} ${winsWhite} — ${winsRed} ${p2} d${dRed}. ${nMatches} matches to ${X} in ${secs}s. Results saved.`;
    sysLog(`[Compete] ${p1}(d${dWhite}) ${winsWhite} vs ${p2}(d${dRed}) ${winsRed}, ${nMatches} matches to ${X} in ${secs}s.`);

    if (btn) btn.disabled = false;
    tournamentRunning = false;
  }

  // Compete summary CSV, in the style of buildTournamentCSV but for the two player-
  // row AIs at their own depths. Standings rank by match wins (game points tiebreak).
  function buildCompeteCSV(r) {
    const wpWins = r.winsWhite, rpWins = r.winsRed;
    const wpFirst = wpWins >= rpWins;
    const rows = [
      { role: 'WP (White)', name: r.p1, depth: r.dWhite, won: wpWins, lost: rpWins, gpts: r.gptsWhite },
      { role: 'RP (Red)',   name: r.p2, depth: r.dRed,   won: rpWins, lost: wpWins, gpts: r.gptsRed },
    ];
    if (!wpFirst) rows.reverse();

    let csv = 'Backgammon Compete Results\n';
    csv += 'BG v. ' + bgVersion() + '\n';
    csv += 'Starting Date:,' + r.tStart.toLocaleString() + '\n';
    csv += 'Ending Date:,' + r.tEnd.toLocaleString() + '\n';
    csv += 'Duration:,"' + numCommas(r.tEnd - r.tStart) + ' ms"\n';
    csv += 'White (WP):,' + r.p1 + ',depth,' + r.dWhite + '\n';
    csv += 'Red (RP):,' + r.p2 + ',depth,' + r.dRed + '\n';
    csv += 'Matches:,' + r.nMatches + '\n';
    csv += 'Match Length (play to),' + r.X + '\n';
    csv += 'Total Games:,' + r.totalGames + '\n\n';

    csv += 'Standings\nRank,Role,Name,Depth,Matches Won,Matches Lost,Game Points\n';
    rows.forEach((row, i) => {
      csv += `${i + 1},${row.role},${row.name},${row.depth},${row.won},${row.lost},${row.gpts}\n`;
    });
    csv += '\nResult,' + (wpWins === rpWins
      ? 'Tie ' + wpWins + '-' + rpWins
      : (wpFirst ? `${r.p1} (WP, d${r.dWhite})` : `${r.p2} (RP, d${r.dRed})`) + ' wins ' + Math.max(wpWins, rpWins) + '-' + Math.min(wpWins, rpWins)) + '\n\n';

    csv += 'Player Parameters:\nRole,Name,Depth,' + PARAM_ORDER.join(',') + '\n';
    const wWP = game.personalityWeights(r.p1), wRP = game.personalityWeights(r.p2);
    csv += 'WP (White),' + r.p1 + ',' + r.dWhite + ',' + PARAM_ORDER.map((k) => wWP[k]).join(',') + '\n';
    csv += 'RP (Red),'   + r.p2 + ',' + r.dRed   + ',' + PARAM_ORDER.map((k) => wRP[k]).join(',') + '\n';
    return csv;
  }

  async function runTournament() {
    const names = game.aiPersonalityNames().filter((n) => tourneySelected.has(n));
    if (names.length < 2) { gameMessageEl.textContent = 'Tournament: select at least 2 players.'; return; }
    const matchesPer = Math.max(1, parseInt(document.getElementById('tourney-games').value, 10) || 10);
    const X = matchLength();
    const depth = lookaheadDepth();
    const collectStats = statsOn;
    const escTotal = collectStats ? new Array(9).fill(0) : null;   // [0..6] escape-roll histogram, [7] BE decisions, [8] BE bites

    const mWins = {}, mLoss = {}, gpts = {}, h2h = {};
    names.forEach((n) => {
      mWins[n] = 0; mLoss[n] = 0; gpts[n] = 0; h2h[n] = {};
      names.forEach((m) => { if (m !== n) h2h[n][m] = 0; });
    });

    const pairs = [];
    for (let i = 0; i < names.length; i++)
      for (let j = i + 1; j < names.length; j++) pairs.push([names[i], names[j]]);
    const total = pairs.length * matchesPer;

    tournamentRunning = true; tournamentStop = false;
    const runBtn = document.getElementById('btn-run-tournament');
    if (runBtn) runBtn.disabled = true;
    const tStart = new Date();
    let done = 0;

    // Tally one finished match given its pair/swap meta.
    const tally = (res, A, B, swap) => {
      const aWon = swap ? (res.winner === 'B') : (res.winner === 'A');
      const winner = aWon ? A : B, loser = aWon ? B : A;
      const aScore = swap ? res.scoreB : res.scoreA, bScore = swap ? res.scoreA : res.scoreB;
      mWins[winner]++; mLoss[loser]++; h2h[winner][loser]++;
      gpts[A] += aScore; gpts[B] += bScore;
      if (escTotal && res.escHist) for (let i = 0; i < 9; i++) escTotal[i] += (res.escHist[i] || 0);
      done++;
      gameMessageEl.textContent = `Tournament running… ${done}/${total} matches to ${X} (${A} vs ${B})`;
    };

    if (workersAvailable) {
      // Flatten every pair × match into specs and run them across the worker pool.
      const specs = [];
      for (const [A, B] of pairs) {
        const wA = game.personalityWeights(A), wB = game.personalityWeights(B);
        for (let k = 0; k < matchesPer; k++) {
          const swap = (k % 2 === 1);
          specs.push({ wA: swap ? wB : wA, wB: swap ? wA : wB, X, depthA: depth, depthB: depth, A, B, swap, collectStats });
        }
      }
      await runMatchesParallel(specs, (res, spec) => tally(res, spec.A, spec.B, spec.swap));
    } else {
      for (const [A, B] of pairs) {
        if (tournamentStop) break;
        const wA = game.personalityWeights(A), wB = game.personalityWeights(B);
        for (let k = 0; k < matchesPer; k++) {
          if (tournamentStop) break;
          const swap = (k % 2 === 1);                          // balance first-game side bias
          const res = await simulateBGMatchYielding(swap ? wB : wA, swap ? wA : wB, X, depth, depth, breathe, collectStats);
          tally(res, A, B, swap);
          await new Promise((r) => setTimeout(r, 0));          // yield so the UI stays responsive
        }
      }
    }

    if (tournamentStop) { tournamentRunning = false; if (runBtn) runBtn.disabled = false; return; }
    const tEnd = new Date();
    const ranked = names.slice().sort((a, b) => (mWins[b] - mWins[a]) || (gpts[b] - gpts[a]));
    const secs = ((tEnd - tStart) / 1000).toFixed(1);
    // Guard against a silent all-zero histogram: if Statistics is on but nothing was
    // collected, the worker pool is almost certainly running a cached (pre-change)
    // game.js — a hard-refresh reloads the worker scripts. Warn instead of shipping 0s.
    if (collectStats && escTotal && escTotal.reduce((a, b) => a + b, 0) === 0) {
      sysLog('[Statistics] No escape-roll data collected — the worker pool is likely running a cached game.js. Hard-refresh (Ctrl+Shift+R) to reload the workers, then re-run.');
    }
    downloadCSV('BGTournamentResults.csv', buildTournamentCSV(names, mWins, mLoss, gpts, h2h, matchesPer, X, tStart, tEnd, escTotal));
    gameMessageEl.textContent = `Tournament done — winner ${ranked[0]} (${mWins[ranked[0]]} matches). ${total} matches to ${X} in ${secs}s. Results saved.`;
    sysLog(`[Tournament] ${total} matches to ${X} in ${secs}s. Winner: ${ranked[0]} (${mWins[ranked[0]]} matches won).`);

    if (runBtn) runBtn.disabled = false;
    tournamentRunning = false;
  }

    // Colour the closed View control to match the selected option: White = red-on-
    // white, Red = white-on-red, Home/Outer = white-on-blue.
    function syncViewColors() {
      const sel = document.getElementById('board-view');
      if (!sel) return;
      const palette = {
        white:   { bg: '#ffffff', fg: '#ef4444' },
        red:     { bg: '#ef4444', fg: '#ffffff' },
        home:    { bg: '#1d4ed8', fg: '#ffffff' },
        outer:   { bg: '#1d4ed8', fg: '#ffffff' },
        magriel: { bg: '#7c3aed', fg: '#ffffff' },
      };
      const c = palette[sel.value] || palette.red;
      sel.style.background = c.bg;
      sel.style.color = c.fg;
    }
    syncViewColors();

    document.getElementById('board-view').addEventListener('change', (e) => {
    const view = e.target.value;
    const wrapper = document.querySelector('.board-wrapper');
    wrapper.classList.remove('view-red', 'view-home', 'view-outer', 'view-magriel');
    if (view !== 'white') {
      wrapper.classList.add(`view-${view}`);
    }
    syncViewColors();
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
      aiActionTimeout = setTimeout(async () => {
        aiActionTimeout = null;
        const mover = game.currentPlayer;
        const depth = playerDepth(mover);
        let bestMoves;
        // Deep searches (depth >= 2) run on the worker pool when available so the UI
        // never blocks; depth 0/1 are instant on the main thread. If workers aren't
        // available, fall back to the synchronous search.
        if (workersAvailable && depth >= 2) {
          try { bestMoves = await computeAIMoveParallel(depth); }
          catch (err) { sysLog(`[AI] Worker search failed (${err && err.message}); using single thread.`); bestMoves = game.getBestAIMove(depth); }
        } else {
          bestMoves = game.getBestAIMove(depth);
        }
        // Guard: state may have changed during the await (stop/restart/turn change).
        if (!gameStarted || game.winner || game.currentPlayer !== mover || game.playerTypes[mover] !== 'ai') return;
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
          
          if (view === 'white' || view === 'red' || view === 'magriel') {
            // Standard vertical stacking (magriel = white orientation, mirrored L-R:
            // the horizontal flip is already baked into rect via getBoundingClientRect)
            const checkerSize = rect.width * 0.8;
            const offset = count * checkerSize * 0.7;
            targetX = rect.left + rect.width / 2;

            if (view === 'white' || view === 'magriel') {
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
     NETWORK LOGIC (Firebase Realtime Database relay)
  ========================================= */

  // Online play relays moves through a shared "room" in Firebase — no WebRTC, STUN,
  // TURN or NAT traversal, so it just works across any networks. Host writes to
  // host2guest and reads guest2host; guest does the opposite. Messages are stored as
  // JSON strings so arrays (like the 25-cell board) round-trip exactly.
  //
  // SETUP: paste your Firebase web config below (Firebase console → Project settings →
  // "Your apps" → SDK setup and configuration → Config). The web config is designed to
  // be public; access is controlled by Realtime Database security rules, not secrecy.
  const FIREBASE_CONFIG = {
    apiKey:      "AIzaSyDhjX4ULNwwHs4etViXMEqmsoDImVR8UBw",
    authDomain:  "pabg-1b336.firebaseapp.com",
    databaseURL: "https://pabg-1b336-default-rtdb.firebaseio.com",
    projectId:   "pabg-1b336",
    appId:       "1:1016658098456:web:41b4fd6992668c2d77c66d",
  };

  let fbDb = null, fbInitTried = false;
  function initFirebase() {
    if (fbDb) return fbDb;
    if (fbInitTried) return null;
    fbInitTried = true;
    if (typeof firebase === 'undefined') { sysLog('[Network] Firebase SDK not loaded (check the <script> tags in index.html).'); return null; }
    if (String(FIREBASE_CONFIG.databaseURL).indexOf('PASTE_HERE') !== -1) { sysLog('[Network] Online play not configured yet — fill in FIREBASE_CONFIG.'); return null; }
    try { firebase.initializeApp(FIREBASE_CONFIG); fbDb = firebase.database(); sysLog('[Network] Firebase ready.'); }
    catch (e) { sysLog('[Network] Firebase init failed: ' + e.message); return null; }
    return fbDb;
  }

  // A DataConnection-like shim over Firebase so setupConnectionListeners() and every
  // existing conn.send(...) / conn.on('data') call work unchanged. role: 1=host, 2=guest.
  function makeFirebaseConnection(roomCode, role) {
    const roomRef  = fbDb.ref('rooms/' + roomCode);
    const outRef   = roomRef.child(role === 1 ? 'host2guest' : 'guest2host');
    const inRef    = roomRef.child(role === 1 ? 'guest2host' : 'host2guest');
    const meRef    = roomRef.child(role === 1 ? 'hostPresent' : 'guestPresent');
    const otherRef = roomRef.child(role === 1 ? 'guestPresent' : 'hostPresent');

    const handlers = { open: [], data: [], close: [] };
    const fire = (evt, arg) => (handlers[evt] || []).forEach((cb) => { try { cb(arg); } catch (e) { sysLog('[Network] handler error: ' + e.message); } });

    const conn = {
      open: false,
      peerConnection: null,   // no WebRTC; the ICE-logging block below no-ops
      on(evt, cb) { if (handlers[evt]) handlers[evt].push(cb); },
      send(obj) { try { outRef.push(JSON.stringify(obj)); } catch (e) { sysLog('[Network] send failed: ' + e.message); } },
      close() { try { meRef.set(null); } catch (e) {} },
    };

    // Presence: announce self; auto-clear on tab close / refresh / disconnect.
    meRef.set(true);
    meRef.onDisconnect().remove();

    // "Open" when the other side is present; "close" when they leave.
    let opened = false;
    otherRef.on('value', (snap) => {
      const present = snap.val() === true;
      if (present && !opened) { opened = true; conn.open = true; sysLog('[Network] Peer present — channel open.'); fire('open'); }
      else if (!present && opened) { opened = false; conn.open = false; fire('close'); }
    });

    // Deliver incoming messages in order (child_added also replays any already-queued
    // ones, so nothing is missed by a listener attaching a beat late). The host clears
    // the room on create and neither side sends before both are present, so there are
    // no stale messages from a prior session.
    inRef.on('child_added', (snap) => {
      let msg = snap.val();
      if (typeof msg === 'string') { try { msg = JSON.parse(msg); } catch (e) { return; } }
      if (msg) fire('data', msg);
    });

    return conn;
  }

  /* ---------------------------------------------------------------------
     PHP LAN relay transport (relay.php on the same XAMPP origin).

     Same DataConnection-shaped shim as makeFirebaseConnection, so
     setupConnectionListeners() and every conn.send(...) call are unchanged.
     Where Firebase pushes over a live socket, this polls relay.php ~1×/sec:
     it appends outgoing messages to its own queue and drains the opposite
     queue by index. Presence is heartbeat-based (each poll stamps my time;
     the other side is "present" if seen within PRESENCE_TIMEOUT).

     Transport is chosen by NET_TRANSPORT: 'php' (LAN) or 'firebase' (internet).
     --------------------------------------------------------------------- */
  // Transport for online play. 'firebase' works everywhere (internet relay), so it
  // needs no XAMPP/LAN server — play from the GitHub link on any network. The PHP LAN
  // relay ('php') is kept below as a dormant option (see relay.php) but is not used.
  const NET_TRANSPORT = 'firebase';
  const PHP_RELAY_URL = 'relay.php';  // relative → same origin as the served game
  const PHP_POLL_MS   = 1000;

  function phpPost(params) {
    return fetch(PHP_RELAY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    }).then((r) => r.json());
  }
  function phpGet(params) {
    const qs = new URLSearchParams(params).toString();
    return fetch(PHP_RELAY_URL + '?' + qs).then((r) => r.json());
  }

  function makePhpConnection(roomCode, role) {
    const handlers = { open: [], data: [], close: [] };
    const fire = (evt, arg) => (handlers[evt] || []).forEach((cb) => { try { cb(arg); } catch (e) { sysLog('[Network] handler error: ' + e.message); } });

    let sinceIn = 0, opened = false, stopped = false, pollTimer = null;

    const onUnload = () => {
      try { navigator.sendBeacon(PHP_RELAY_URL, new Blob([JSON.stringify({ action: 'leave', room: roomCode, role })], { type: 'application/json' })); } catch (e) {}
    };

    const conn = {
      open: false,
      peerConnection: null,           // no WebRTC; the ICE-logging block no-ops
      on(evt, cb) { if (handlers[evt]) handlers[evt].push(cb); },
      send(obj) {
        phpPost({ action: 'send', room: roomCode, role, msg: JSON.stringify(obj) })
          .catch((e) => sysLog('[Network] send failed: ' + e.message));
      },
      close() {
        stopped = true;
        if (pollTimer) clearInterval(pollTimer);
        window.removeEventListener('beforeunload', onUnload);
        phpPost({ action: 'leave', room: roomCode, role }).catch(() => {});
      },
    };

    async function pollOnce() {
      if (stopped) return;
      try {
        const r = await phpGet({ action: 'poll', room: roomCode, role, since: sinceIn });
        if (!r || !r.ok) return;
        if (Array.isArray(r.messages) && r.messages.length) {
          for (const s of r.messages) {
            let msg = s;
            if (typeof msg === 'string') { try { msg = JSON.parse(msg); } catch (e) { continue; } }
            if (msg) fire('data', msg);
          }
        }
        if (typeof r.next === 'number') sinceIn = r.next;

        const present = !!r.otherPresent;
        if (present && !opened) { opened = true; conn.open = true; sysLog('[Network] Peer present — channel open.'); fire('open'); }
        else if (!present && opened) { opened = false; conn.open = false; fire('close'); }
      } catch (e) {
        // transient network hiccup — keep polling
      }
    }

    window.addEventListener('beforeunload', onUnload);
    pollOnce();                        // announce presence + fetch immediately
    pollTimer = setInterval(pollOnce, PHP_POLL_MS);
    return conn;
  }

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

    // Remote games default Time Travel OFF for the GUEST (guards against accidental
    // move-list clicks); the guest can still turn it on to time travel, which syncs to
    // the host. The HOST keeps whatever its setting already is (not forced on/off).
    if (role === 2) { timeTravelOn = false; updateSettingBadge('badge-timetravel', timeTravelOn); }

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
    syncDepthMenu(1);           // both sides human in a network game → depth menus off
    syncDepthMenu(2);
    
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

    // ICE diagnostics: surface why a data channel does/doesn't open. If you see it
    // reach "checking" then "failed"/"disconnected" (and no 'relay' candidates), the
    // peers can't form a direct path and need a working TURN relay.
    const wireIceLogging = () => {
      const pc = connection.peerConnection;
      if (!pc || pc.__iceLogged) return;
      pc.__iceLogged = true;
      pc.addEventListener('iceconnectionstatechange', () => sysLog(`[Network] ICE state: ${pc.iceConnectionState}`));
      pc.addEventListener('icegatheringstatechange', () => sysLog(`[Network] ICE gathering: ${pc.iceGatheringState}`));
      pc.addEventListener('icecandidate', (e) => { if (e.candidate) sysLog(`[Network] local candidate: ${e.candidate.type}/${e.candidate.protocol}`); });
    };
    wireIceLogging();
    setTimeout(wireIceLogging, 300);   // peerConnection may not exist yet at setup time

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
          lastStarter = game.currentPlayer;   // mirror the opener so Restart can alternate

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
          if (data.starter) {
            // New game with the host-chosen alternated opener (no roll-off, no Start click).
            sysLog(`[Network] Restart received (starter = player ${data.starter}).`);
            applyRestartNewGame(data.starter);
          } else {
            // Legacy/full reset back to the Start overlay.
            sysLog('[Network] Restart signal received from host. Resetting board...');
            performRestart();
          }
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
          else if (data.action === 'goto') navigateTo(data.idx);   // the other player jumped to a stage in the move list
      }
    });

    connection.on('close', () => {
      connStatus.textContent = "Opponent Disconnected.";
      connStatus.style.color = "#ef4444";
    });
}
    
  // --- PHP LAN transport: host / join ---
  function hostViaPhp() {
    initNetworkGame(1);
    document.getElementById('board-view').value = 'white';
    document.getElementById('board-view').dispatchEvent(new Event('change'));

    const roomCode = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    connStatus.textContent = "Waiting for opponent...";
    connStatus.style.color = "var(--accent-gold)";
    joinCodeInput.value = roomCode;
    joinCodeInput.readOnly = true;
    sysLog(`[Network] Hosting room ${roomCode} via LAN relay. Waiting for guest…`);

    phpPost({ action: 'create', room: roomCode })
      .then((r) => {
        if (!r || !r.ok) throw new Error(r && r.error ? r.error : 'create failed');
        conn = makePhpConnection(roomCode, 1);
        setupConnectionListeners(conn);
      })
      .catch((e) => { sysLog('[Network] Could not create room: ' + e.message); connStatus.textContent = "Could not reach relay.php."; connStatus.style.color = '#ef4444'; });
  }

  function joinViaPhp() {
    const code = joinCodeInput.value.trim();
    if (!code) return;
    initNetworkGame(2);
    connStatus.textContent = "Connecting to Host...";
    connStatus.style.color = "var(--accent-gold)";
    document.getElementById('board-view').value = 'red';
    document.getElementById('board-view').dispatchEvent(new Event('change'));
    sysLog(`[Network] Joining room ${code} via LAN relay…`);

    phpGet({ action: 'check', room: code })
      .then((r) => {
        if (!r || !r.present) {
          connStatus.textContent = `No game found for code ${code}.`;
          connStatus.style.color = '#ef4444';
          sysLog(`[Network] No host present at code ${code}.`);
          return;
        }
        conn = makePhpConnection(code, 2);
        setupConnectionListeners(conn);
      })
      .catch((e) => { sysLog('[Network] Join failed: ' + e.message); connStatus.textContent = "Could not reach relay.php."; connStatus.style.color = '#ef4444'; });
  }

// --- HOSTING ---
  btnHost.addEventListener('click', () => {
    if (NET_TRANSPORT === 'php') { hostViaPhp(); return; }

    const db = initFirebase();
    if (!db) { connStatus.textContent = "Online play not configured."; connStatus.style.color = '#ef4444'; return; }

    initNetworkGame(1);

    // Explicitly set the host view to 'white'
    document.getElementById('board-view').value = 'white';
    document.getElementById('board-view').dispatchEvent(new Event('change'));

    const roomCode = Math.floor(Math.random() * 1000).toString().padStart(3, '0');

    connStatus.textContent = "Waiting for opponent...";
    connStatus.style.color = "var(--accent-gold)";

    // Inject the code into the text field and lock it so it can't be typed over
    joinCodeInput.value = roomCode;
    joinCodeInput.readOnly = true;

    sysLog(`[Network] Hosting room ${roomCode} via Firebase. Waiting for guest…`);

    // Fresh room (wipes any stale data at this code), then open our side.
    db.ref('rooms/' + roomCode).set({ createdAt: firebase.database.ServerValue.TIMESTAMP })
      .then(() => { conn = makeFirebaseConnection(roomCode, 1); setupConnectionListeners(conn); })
      .catch((e) => { sysLog('[Network] Could not create room: ' + e.message); connStatus.textContent = "Could not create room."; connStatus.style.color = '#ef4444'; });
  });

// --- JOINING ---
  btnJoin.addEventListener('click', () => {
    if (NET_TRANSPORT === 'php') { joinViaPhp(); return; }

    const code = joinCodeInput.value.trim();
    if (!code) return;

    const db = initFirebase();
    if (!db) { connStatus.textContent = "Online play not configured."; connStatus.style.color = '#ef4444'; return; }

    initNetworkGame(2);

    connStatus.textContent = "Connecting to Host...";
    connStatus.style.color = "var(--accent-gold)";

    // Explicitly set the guest view to 'red'
    document.getElementById('board-view').value = 'red';
    document.getElementById('board-view').dispatchEvent(new Event('change'));

    sysLog(`[Network] Joining room ${code} via Firebase…`);

    // Confirm a host is actually in that room before joining.
    db.ref('rooms/' + code + '/hostPresent').once('value').then((snap) => {
      if (snap.val() !== true) {
        connStatus.textContent = `No game found for code ${code}.`;
        connStatus.style.color = '#ef4444';
        sysLog(`[Network] No host present at code ${code}.`);
        return;
      }
      conn = makeFirebaseConnection(code, 2);
      setupConnectionListeners(conn);
    }).catch((e) => { sysLog('[Network] Join failed: ' + e.message); connStatus.textContent = "Join failed."; connStatus.style.color = '#ef4444'; });
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
    startedFromSetup = false;   // ordinary game → STOP keeps its pause/resume behaviour
    initialRollOff = true;
    game.currentPlayer = 1;
    game.hasRolled = false;
    resetBothScores();          // Start zeros the running score (Restart keeps it)
    gameScored = false;
    winTurnRecorded = false;

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
        lastStarter = game.currentPlayer;   // remember the opener so Restart can alternate

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

  // ═══════════════════════════════════════════════════════════════════════
  //  Board Setup & Analysis mode (CLEAR / INITIAL / dice / MOV / PLAY / START)
  // ═══════════════════════════════════════════════════════════════════════
  const dieR1 = document.getElementById('setup-r1');
  const dieR2 = document.getElementById('setup-r2');
  const dieW1 = document.getElementById('setup-w1');
  const dieW2 = document.getElementById('setup-w2');
  let setupPickedEl = null;

  const randDie = () => Math.floor(Math.random() * 6) + 1;
  function clearSetupDice() { [dieR1, dieR2, dieW1, dieW2].forEach((el) => { if (el) el.value = ''; }); }

  // Convention (matches the View control): red-on-white = White, white-on-red = Red.
  // So the setup-r* menus are WHITE's dice and the setup-w* menus are RED's. Picking a
  // value on one side blanks the other (only one side rolls at a time).
  [dieR1, dieR2].forEach((el) => el && el.addEventListener('change', () => {
    if (el.value !== '') { if (dieW1) dieW1.value = ''; if (dieW2) dieW2.value = ''; setupOnRoll = 1; }
  }));
  [dieW1, dieW2].forEach((el) => el && el.addEventListener('change', () => {
    if (el.value !== '') { if (dieR1) dieR1.value = ''; if (dieR2) dieR2.value = ''; setupOnRoll = 2; }
  }));

  // Stop any game / tournament / evolution before entering setup.
  function haltEverything() {
    evolveStop = true;
    tournamentStop = true;
    aiStopped = true;
    isAIPlaying = false;
    if (aiActionTimeout) { clearTimeout(aiActionTimeout); aiActionTimeout = null; }
    if (turnEndTimer)    { clearTimeout(turnEndTimer);    turnEndTimer    = null; }
    if (autoRollTimeout) { clearTimeout(autoRollTimeout); autoRollTimeout = null; }
  }

  function enterSetup(kind) {
    haltEverything();
    setupMode = true;
    setupKind = kind; setupAutoStop = false;
    setupSel = null; setupDragLoc = null; setupOnRoll = null;
    selectedSource = null; legalDestinations = [];
    gameStarted = false;
    if (kind === 'clear') game.setupClear();
    else if (kind === 'initial') game.setupInitial();
    else {   // 'examine' — keep the current position; just reset dice/turn scaffolding
      setupOnRoll = game.currentPlayer || null;
      game.movesLeft = []; game.hasRolled = false; game.dice = [0, 0]; game.winner = null;
      game.turnHistory = []; game.playedMovesThisTurn = [];
    }
    renderDie(die1El, 0); renderDie(die2El, 0);
    clearSetupDice();
    clearSetupHighlight();
    setupBaseMsg = (kind === 'examine') ? 'Examination Mode, click STOP to exit.' : 'Examination Mode';
    gameMessageEl.textContent = setupBaseMsg;
    historyListEl.innerHTML = '';           // green window blank until MOV
    renderPoints(); renderBar(); renderBorneOff();
    const btnStart = document.getElementById('btn-start-game');
    if (btnStart) { btnStart.disabled = false; btnStart.style.opacity = '1'; }
  }

  function exitSetup() {
    setupMode = false;
    setupAutoStop = true;   // halt any examine auto-play loop
    setupSel = null; setupDragLoc = null; setupOnRoll = null;
    clearSetupHighlight();
    performRestart();   // back to the standard initial position + normal play state
  }

  // ── free board editing (drag + two-click); the 30 checkers are conserved ──
  function locColor(loc) {
    if (loc[0] === 'p') { const i = +loc.slice(1); return game.points[i].count > 0 ? game.points[i].player : null; }
    if (loc === 'bar1')  return game.bar[1] > 0 ? 1 : null;
    if (loc === 'bar2')  return game.bar[2] > 0 ? 2 : null;
    if (loc === 'tray1') return game.borneOff[1] > 0 ? 1 : null;
    if (loc === 'tray2') return game.borneOff[2] > 0 ? 2 : null;
    return null;
  }
  function canPlace(loc, color) {
    if (loc[0] === 'p') { const p = game.points[+loc.slice(1)]; return p.count === 0 || p.player === color; }
    if (loc === 'bar1' || loc === 'tray1') return color === 1;
    if (loc === 'bar2' || loc === 'tray2') return color === 2;
    return false;
  }
  function removeOne(loc) {
    if (loc[0] === 'p') { const p = game.points[+loc.slice(1)]; p.count--; if (p.count <= 0) { p.count = 0; p.player = null; } return; }
    if (loc === 'bar1')  game.bar[1]--;
    else if (loc === 'bar2')  game.bar[2]--;
    else if (loc === 'tray1') game.borneOff[1]--;
    else if (loc === 'tray2') game.borneOff[2]--;
  }
  function addOne(loc, color) {
    if (loc[0] === 'p') { const p = game.points[+loc.slice(1)]; if (p.count > 0 && p.player === color) p.count++; else { p.player = color; p.count = 1; } return; }
    if (loc === 'bar1')  game.bar[1]++;
    else if (loc === 'bar2')  game.bar[2]++;
    else if (loc === 'tray1') game.borneOff[1]++;
    else if (loc === 'tray2') game.borneOff[2]++;
  }
  function setupMoveOne(from, to) {
    if (from === to) return;
    const color = locColor(from);
    if (!color) return;
    if (to === 'bar1' || to === 'bar2') to = 'bar' + color;   // any spot on the bar → that checker's own bar area
    if (from === to) return;
    if (!canPlace(to, color)) { gameMessageEl.textContent = 'Examination Mode — a point can hold only one colour.'; return; }
    removeOne(from); addOne(to, color);
    gameMessageEl.textContent = setupBaseMsg;
    renderPoints(); renderBar(); renderBorneOff();
  }

  function setupLocEl(loc) {
    if (loc[0] === 'p')  return document.getElementById('point-' + loc.slice(1));
    if (loc === 'bar1')  return barP1El;
    if (loc === 'bar2')  return barP2El;
    if (loc === 'tray1') return bearOffP1;
    if (loc === 'tray2') return bearOffP2;
    return null;
  }
  function clearSetupHighlight() {
    if (setupPickedEl) { setupPickedEl.classList.remove('highlight-source'); setupPickedEl = null; }
  }
  function setupClickLoc(loc) {
    if (setupSel === null) {
      if (locColor(loc)) { setupSel = loc; setupPickedEl = setupLocEl(loc); if (setupPickedEl) setupPickedEl.classList.add('highlight-source'); }
      return;
    }
    if (loc === setupSel) { setupSel = null; clearSetupHighlight(); return; }
    setupMoveOne(setupSel, loc);
    setupSel = null; clearSetupHighlight();
  }
  function setupDragAttach(el, loc) {
    el.addEventListener('dragstart', (e) => {
      setupDragLoc = loc;
      if (e.dataTransfer) { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', loc); }
    });
    el.addEventListener('dragend', () => { setupDragLoc = null; });
  }
  function setupDrop(loc) {
    if (setupDragLoc) { setupMoveOne(setupDragLoc, loc); setupDragLoc = null; }
  }

  // ── dice resolution, MOV, PLAY, START ──
  function setupAllBlank() { return [dieR1, dieR2, dieW1, dieW2].every((el) => !el || el.value === ''); }

  // Resolve the side on roll and its dice. A lone die is filled at random; an all-
  // blank state rolls for a side (the pending stepping side, else an opening roll-off).
  function resolveMoverAndDice() {
    const whiteVals = [dieR1, dieR2].map((el) => el && el.value).filter((v) => v);  // setup-r* = White
    const redVals   = [dieW1, dieW2].map((el) => el && el.value).filter((v) => v);  // setup-w* = Red
    let player, faces;
    if (whiteVals.length)    { player = 1; faces = whiteVals.map(Number); }
    else if (redVals.length) { player = 2; faces = redVals.map(Number); }
    else if (setupOnRoll)    { player = setupOnRoll; faces = [randDie(), randDie()]; }
    else { let d1, d2; do { d1 = randDie(); d2 = randDie(); } while (d1 === d2); player = d1 > d2 ? 1 : 2; faces = [d1, d2]; }
    if (faces.length === 1) faces = [faces[0], randDie()];
    const dice = (faces[0] === faces[1]) ? [faces[0], faces[0], faces[0], faces[0]] : [faces[0], faces[1]];
    return { player, dice, faces: faces.slice(0, 2) };
  }
  function showDiceForSide(player, faces) {
    if (player === 1) { dieR1.value = String(faces[0]); dieR2.value = String(faces[1]); dieW1.value = ''; dieW2.value = ''; }
    else { dieW1.value = String(faces[0]); dieW2.value = String(faces[1]); dieR1.value = ''; dieR2.value = ''; }
  }
  // Weights for MOV / PLAY come LIVE from the brain-editor parameter fields (the white
  // number boxes), so editing a weight and pressing MOV again immediately shows its
  // effect. Falls back to the selected personality for any missing field.
  function editorWeights() {
    const base = game.personalityWeights((editBrainSel && editBrainSel.value) || 'Arwen');
    const w = { ...base };
    BRAIN_KEYS.forEach((k) => {
      const inp = document.getElementById('bp-' + k);
      if (inp && inp.value !== '') { const v = parseInt(inp.value, 10); if (!isNaN(v)) w[k] = v; }
    });
    return w;
  }
  function moveText(moves) {
    if (!moves || moves.length === 0) return '(no move)';
    return moves.map((m) => `${m.from === 'bar' ? 'bar' : m.from}/${m.to === 'off' ? 'off' : m.to}`).join(', ');
  }
  function fmtScore(v) { if (v >= 1e8) return 'WIN'; if (v <= -1e8) return 'LOSS'; return String(Math.round(v)); }
  function facesText(faces) { return faces[0] === faces[1] ? `${faces[0]}-${faces[0]}` : `${faces[0]}-${faces[1]}`; }

  function renderMoveList(ranked, player, faces) {
    const who = player === 1 ? 'White' : 'Red';
    let html = `<div style="font-size:0.72rem;font-weight:bold;padding:2px 4px;border-bottom:1px solid rgba(255,255,255,0.25);flex:0 0 auto;">${who} ${facesText(faces)} — ${ranked.length} move${ranked.length === 1 ? '' : 's'} (best first)</div>`;
    if (ranked.length === 0) {
      html += `<div style="padding:6px 4px;font-size:0.72rem;">No legal moves — ${who} dances.</div>`;
    } else {
      html += `<div style="overflow-y:auto;flex:1 1 auto;">`;
      ranked.forEach((r, i) => {
        html += `<div style="display:flex;justify-content:space-between;gap:8px;padding:2px 4px;font-size:0.72rem;${i === 0 ? 'background:rgba(255,255,255,0.14);' : ''}"><span>${moveText(r.moves)}</span><span style="font-variant-numeric:tabular-nums;opacity:0.9;">${fmtScore(r.value)}</span></div>`;
      });
      html += `</div>`;
    }
    historyListEl.innerHTML = html;
  }

  async function doMOV() {
    if (!setupMode) return;
    const { player, dice, faces } = resolveMoverAndDice();
    showDiceForSide(player, faces);
    setupOnRoll = player;
    const depth = playerDepth(player);
    const board = { points: game.points, bar: game.bar, borneOff: game.borneOff };
    if (depth >= 2 && workersAvailable) gameMessageEl.textContent = 'Examination Mode — computing…';
    const ranked = await rankMovesFor(board, player, dice, depth, editorWeights());
    if (!setupMode) return;   // exited during the await
    renderMoveList(ranked, player, faces);
    gameMessageEl.textContent = setupBaseMsg;
  }

  async function doPLAY() {
    if (!setupMode) return;
    const { player, dice, faces } = resolveMoverAndDice();
    showDiceForSide(player, faces);
    const who = player === 1 ? 'White' : 'Red';
    const board = { points: game.points, bar: game.bar, borneOff: game.borneOff };
    const ranked = await rankMovesFor(board, player, dice, playerDepth(player), editorWeights());
    if (!setupMode) return;   // exited during the await
    if (ranked.length === 0) {
      gameMessageEl.textContent = `Examination Mode — ${who} dances on ${facesText(faces)}.`;
      setupOnRoll = player === 1 ? 2 : 1;
      clearSetupDice();
      return;
    }
    const best = ranked[0].moves;
    // Apply the chosen sequence via the engine. makeMove reads currentPlayer/movesLeft,
    // so set them first; validateMax=false since the sequence is already legal. When
    // animation is on, fly each sub-move before committing it (mirrors the AI path).
    game.currentPlayer = player;
    game.dice = [faces[0], faces[1]];
    game.movesLeft = dice.slice();
    game.hasRolled = true;
    game.turnHistory = [];
    game.playedMovesThisTurn = [];
    for (const m of best) {
      if (animationOn) { renderPoints(); renderBar(); renderBorneOff(); await animateCheckerMove(m.from, m.to); }
      if (!setupMode) return;   // STOP/exit during the animation
      game.makeMove(m.from, m.to, false);
    }
    game.currentPlayer = null; game.movesLeft = []; game.hasRolled = false;
    renderPoints(); renderBar(); renderBorneOff();
    setupOnRoll = player === 1 ? 2 : 1;
    clearSetupDice();
    if (game.borneOff[1] >= 15 || game.borneOff[2] >= 15) {
      gameMessageEl.textContent = `Examination Mode — ${game.borneOff[1] >= 15 ? 'White' : 'Red'} has borne off all 15.`;
    } else {
      gameMessageEl.textContent = `Examination Mode — ${who} played ${moveText(best)} (${facesText(faces)}).`;
    }
  }

  // Examine START self-plays the position to the end (each side's AI, Arwen for a human
  // seat), animating when the toggle is on. STOP (setupAutoStop) halts it.
  async function autoPlayToEnd() {
    setupAutoStop = false;
    let guard = 0;
    while (setupMode && !setupAutoStop && game.borneOff[1] < 15 && game.borneOff[2] < 15 && guard < 4000) {
      guard++;
      await doPLAY();
      if (!animationOn) await new Promise((r) => setTimeout(r, 40));   // let the board repaint
    }
  }

  function doSTART() {
    if (!setupMode) return;
    if (setupKind === 'examine') { autoPlayToEnd(); return; }   // EX → play the position to the end
    const allBlank = setupAllBlank();
    setupMode = false;
    clearSetupHighlight();
    // Fresh game from the current board: clear history + cube, keep the position.
    game.gameHistory = []; game.turnHistory = []; game.playedMovesThisTurn = [];
    game.turnCount = 0; game.futureRolls = []; game.futureRollIndex = 0;
    game.doublingCubeValue = 1; game.doublingCubeOwner = null; game.winner = null;
    historyNavBuffer = []; historyNavIndex = null;
    gameStarted = true; aiStopped = false; startedFromSetup = true;
    const btnStart = document.getElementById('btn-start-game');
    if (btnStart) { btnStart.disabled = true; btnStart.style.opacity = '0.5'; }
    if (allBlank && !setupOnRoll) {
      initialRollOff = true; game.currentPlayer = 1; game.hasRolled = false;
    } else {
      const { player, dice, faces } = resolveMoverAndDice();
      initialRollOff = false;
      game.currentPlayer = player;
      game.dice = [faces[0], faces[1]];
      game.movesLeft = dice.slice();
      game.hasRolled = true;
      game.turnCount = 1;
    }
    clearSetupDice();
    updateUI();   // normal pipeline resumes; checkAndTriggerAITurn drives any AI side
  }

  document.getElementById('btn-ex')?.addEventListener('click', () => enterSetup('examine'));
  document.getElementById('btn-clear')?.addEventListener('click', () => enterSetup('clear'));
  document.getElementById('btn-initial')?.addEventListener('click', () => enterSetup('initial'));
  document.getElementById('btn-mov')?.addEventListener('click', doMOV);
  document.getElementById('btn-play')?.addEventListener('click', doPLAY);

}); // This closing brace now correctly wraps all your event-dependent logic.
