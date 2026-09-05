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
  // Diagnostics (network debugging): de-dup keys so a per-turn state fingerprint and a
  // divergence warning each log once per distinct state, not on every render / heartbeat.
  let lastFpKey = null;
  let lastDivergenceKey = null;
  // Auto-reconnect (recovers a one-directional inbound stall — the iPad-Safari failure mode).
  let currentRoomCode  = null;       // room code of the active network game (for reconnect)
  let lastInboundAt    = 0;          // Date.now() of the last received network message
  let inboundWatchdog  = null;       // interval that reconnects when inbound goes silent
  let reconnecting     = false;      // guard while an auto-reconnect is in flight
  const INBOUND_SILENCE_MS = 10000;  // no inbound this long (heartbeats are 3s) → reconnect
  // Backlog-skip high-water mark (see makeFirebaseConnection). Firebase push() keys are
  // chronologically ordered, so "already handled" is a COMPARISON that survives a reconnect,
  // not a snapshot taken at attach time that swallows whatever arrived while we were rebuilding.
  let inboundHighWater     = null;   // highest inbound key consumed on this room+role
  let inboundHighWaterRoom = null;   // which room+role the mark belongs to

  /**
   * Send a game message to the peer.
   *
   * ⚠️ NEVER gate a game message on `conn.open`. BOTH transports write to a DURABLE queue
   * (Firebase push / relay.php append), so a message handed over while `open` is momentarily
   * false still reaches the peer — it waits in the room until the peer's listener picks it up.
   * The old `if (conn && conn.open) conn.send(...)` guard protected nothing and silently DROPPED
   * the message during the ~200ms window of a reconnect, while the caller went on to apply the
   * action locally — so the two sides ended up permanently disagreeing with no error anywhere.
   * That is how a cube ACCEPT was lost on 8/25 and froze the game (see the freeze-after-double
   * note in CLAUDE.md). The heartbeat is the one exception and keeps its `open` check: it is a
   * snapshot of NOW, and a stale one delivered late would be worse than a missed beat.
   */
  function netSend(obj) {
    if (!isNetworkGame || !conn) return false;
    if (!conn.open) sysLog(`[Network] Sending ${obj && obj.type} while the channel re-opens (it waits in the room).`);
    try { conn.send(obj); } catch (e) { sysLog('[Network] send failed: ' + e.message); return false; }
    return true;
  }

  // Compact board signature (points + bar + off) for desync detection/logging.
  function boardSig(points, bar, borneOff) {
    const pts = points.map((p, i) => (p.count > 0 ? `${i}:${p.player}(${p.count})` : '')).filter(Boolean).join(',');
    return `${pts} | bar ${bar[1]}/${bar[2]} | off ${borneOff[1]}/${borneOff[2]}`;
  }

  // 'Host' / 'Guest' for THIS machine in a network game, else null. Stamps downloads (move list,
  // console log, screenshot filename) so a saved file says which side produced it.
  function netRole() { return isNetworkGame ? (localPlayerRole === 1 ? 'Host' : 'Guest') : null; }

  // True when THIS machine is the waiting side of a network game: an online game is under way
  // and the player on roll is the OTHER machine's seat. Drives the two waiting-side cues --
  // the "<X> is thinking" status line and the greyed-out dice (see CLAUDE.md). Deliberately
  // false off-network, in examination mode, before the game starts and once there's a winner,
  // so purely local play and the end-of-game message are untouched.
  function waitingForOpponent() {
    return isNetworkGame && gameStarted && !setupMode && !game.winner
        && localPlayerRole !== null && game.currentPlayer !== null
        && game.currentPlayer !== localPlayerRole;
  }

  // The waiting side's stand-in for the on-roll player's own instruction line.
  function thinkingMessage() {
    return `${game.currentPlayer === 1 ? 'White' : 'Red'} is thinking`;
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
        // Authoritative turn ownership from the sender (corrects any drift from a missed turn).
        if (action.data.nextPlayer !== undefined) game.currentPlayer = action.data.nextPlayer;
        if (action.data.turnCount !== undefined) game.turnCount = action.data.turnCount;
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
  let gameRecorded    = false;   // Auto Record fired for this game (one file per game)

  // ── Per-turn WALL CLOCK (for the recorded move list) ────────────────────────
  // Time from a turn arriving at a seat until that turn ends. Deliberately wall clock,
  // not AI search time: it is what the person at the board actually waited. For an AI
  // seat that therefore includes the fixed 300 ms roll + 300 ms think delays and, with
  // Animation ON, 1000 ms of travel + 500 ms of pause per checker sub-move — so a
  // depth-1 AI turn reads ~3,600 ms of which well under a millisecond is the search.
  // Paused while the AI is stopped, so a game left paused doesn't bank the wait.
  let turnMs = 0;                    // ms already banked for the turn in progress
  let turnMark = null;               // nowMs() when the clock last started; null = paused
  const playerMs    = { 1: 0, 2: 0 };   // total wall clock per seat, this game
  const playerTurns = { 1: 0, 2: 0 };   // turns completed per seat, this game
  const nowMs = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const clockRun     = () => { if (turnMark == null) turnMark = nowMs(); };
  const clockPause   = () => { if (turnMark != null) { turnMs += nowMs() - turnMark; turnMark = null; } };
  const clockRead    = () => turnMs + (turnMark == null ? 0 : nowMs() - turnMark);
  const clockRestart = () => { turnMs = 0; turnMark = nowMs(); };
  // New game: zero the per-seat totals and start the first turn's clock.
  function gameClockReset() { playerMs[1] = playerMs[2] = 0; playerTurns[1] = playerTurns[2] = 0; clockRestart(); }
  // Bank a finished turn onto its history snapshot and the seat's running totals.
  function bankTurn(player, snap) {
    const ms = clockRead();
    if (player === 1 || player === 2) { playerMs[player] += ms; playerTurns[player]++; }
    if (snap) snap.elapsedMs = ms;
    clockRestart();
  }

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

  // Net Analysis (default ON): when a HUMAN seat's play is being scored, use the net
  // selected in the NN row (row 18) rather than the brain menu in the AI row (row 13).
  // Turning it OFF restores the row-13 menu. Declared early for the same reason as
  // showScoreOn — renderHistoryList() reads it during the first render.
  let netAnalysisOn = true;

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
  // When a game is launched from a hand-set-up position (START/PLAY in examination mode), we
  // remember that position here so Restart restarts from IT rather than the standard opening.
  // Null for ordinary games (cleared by startGame / performRestart / initNetworkGame).
  let setupOriginBoard = null;

  // ── DUPLO (interactive) ──────────────────────────────────────────────────────
  // The dice of the current LOCAL game come from a seeded stream, and the seed is kept
  // here so the DUPLO button can replay the very same rolls with the two participants
  // swapped between the seats. `starter` records HOW the game began: null means a
  // roll-off decided the opener — a replay re-runs that roll-off on the same stream, so
  // the same opening dice come up and therefore the same COLOUR opens, which is now the
  // OTHER participant. Otherwise it is the forced opener to reuse.
  // Network games are deliberately left unseeded: the host rolls and broadcasts, and
  // swapping seats across the wire is out of scope.
  let liveGame = { seed: null, starter: null };
  // The game DUPLO will replay. Frozen the moment a game ends, so the finished game stays
  // the target while you look at the final position — pressing DUPLO then always mirrors the
  // game you just played, never something else. Cleared by START and RESTART (you have
  // explicitly moved on), but NOT by DUPLO itself, so pressing DUPLO twice returns you to
  // the original orientation with the same dice.
  let duploTarget = null;

  function beginSeededGame(seed, starter) {
    if (isNetworkGame) { liveGame = { seed: null, starter: null }; game.rng = null; return; }
    const s = (seed == null) ? duploBaseSeed() : (seed >>> 0);
    game.rng = makeBGRng(s);
    liveGame = { seed: s, starter: (starter == null ? null : starter) };
    sysLog('[DUPLO-diag] seed installed ' + s + (seed == null ? '  (NEW stream)' : '  (REPLAY of a recorded seed)')
      + ', opener = ' + (starter == null ? 'roll-off' : 'forced ' + starter));
  }

  // Everything DUPLO needs to replay a game: the board it started from, and the rolls in
  // order, each tagged with the side that received it. Only REAL rolls — a doubling-accept
  // snapshot carries [0,0] dice and does not alternate players, so including it would shift
  // the whole sequence by one turn. Same filter game.js uses for time travel.
  function captureGameForDuplo() {
    const h = game.gameHistory;
    if (!h || !h.length) return null;
    const init = h.find((sn) => sn.isInitial) || h[0];
    const rolls = h.filter((sn) => !sn.isInitial && sn.dice[0] && sn.dice[1])
                   .map((sn) => ({ p: sn.currentPlayer, d: [sn.dice[0], sn.dice[1]] }));
    if (!rolls.length) return null;                     // nothing has been rolled yet
    return { points: JSON.parse(JSON.stringify(init.points)),
             bar: { ...init.bar }, borneOff: { ...init.borneOff },
             opener: rolls[0].p, rolls };
  }

  // DUPLO button — play the SAME game again with the luck the other way round.
  //
  // ⚠ THE PLAYERS DO NOT MOVE. Alice keeps the White seat and receives the rolls Bob
  // received; the board is MIRRORED so that her side of it is the side he played, and the
  // opening roll goes to the other colour. Two people therefore swap games without swapping
  // chairs, which is what makes this work for humans (two seats reading "Human" are
  // indistinguishable, so swapping them changed nothing) and over the network (host and
  // guest keep their roles). For a symmetric opening the mirror is invisible; from a
  // hand-set-up board it is what makes the duplicate a duplicate at all.
  //
  // The dice come from the RECORDED rolls, not from a re-seeded stream, so the replay needs
  // no shared RNG and works the same locally and online.
  function duploReplay() {
    if (isNetworkGame && localPlayerRole !== 1) {
      gameMessageEl.textContent = 'DUPLO is run by the host.'; return;
    }
    const cap = duploTarget || captureGameForDuplo();
    if (!cap) { gameMessageEl.textContent = 'DUPLO: play a game first — DUPLO replays it with the luck reversed.'; return; }
    sysLog('[DUPLO-diag] DUPLO pressed. ' + cap.rolls.length + ' recorded rolls, opener was player '
      + cap.opener + ', source ' + (duploTarget ? 'FINISHED game' : 'game in progress')
      + ', setupOrigin ' + (setupOriginBoard ? 'yes' : 'no'));
    const keep = duploTarget;
    applyRestartNewGame(cap.opener === 1 ? 2 : 1, null, false, cap);
    duploTarget = keep || cap;                          // pressing DUPLO twice returns to the original
    if (isNetworkGame) netSend({ type: 'duplo', cap });
    gameMessageEl.textContent = 'DUPLO — the same game with the luck reversed: '
      + (cap.opener === 1 ? 'Red' : 'White') + ' opens, and each side now plays the other\'s dice.';
    sysLog('[DUPLO] Replaying with the board mirrored and the rolls handed to the other side.');
  }
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
      netSend({ type: 'accept' });
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

  // DUPLO Button Listener — replay the same dice with the seats swapped.
  const btnDuplo = document.getElementById('btn-duplo');
  if (btnDuplo) {
    btnDuplo.addEventListener('click', () => duploReplay());
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
        link.download = `bg-screenshot-${netRole() ? netRole() + '-' : ''}${Date.now()}.png`;
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
        link.download = `bg-board-${netRole() ? netRole() + '-' : ''}${Date.now()}.png`;
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
  // ── Recorded move list ──────────────────────────────────────────────────────
  // ONE generator for both Export → Move List and Auto Record, so the two files can
  // never drift apart. This is the DOWNLOADED list: it carries the running pip count for
  // each side and the wall-clock time the mover spent, neither of which appears in the
  // control column's history table (renderHistoryList) — that stays exactly as it was.
  const msText = (ms) => numCommas(Math.round(ms));
  function durText(ms) {
    const sec = ms / 1000;
    if (sec < 60) return sec.toFixed(1) + 's';
    const m = Math.floor(sec / 60);
    return m + 'm ' + (sec - m * 60).toFixed(1) + 's';
  }

  // A brain's 24 numbers, 12 per line, as an aligned key row over a value row.
  function brainParamBlock(name, indent) {
    const w = game.personalityWeights(name);
    if (!w) return indent + '(parameters unavailable)\n';
    let out = '';
    for (let i = 0; i < BRAIN_KEYS.length; i += 12) {
      const keys = BRAIN_KEYS.slice(i, i + 12);
      out += indent + keys.map((k) => k.padStart(7, ' ')).join('') + '\n';
      out += indent + keys.map((k) => String(w[k] == null ? '?' : w[k]).padStart(7, ' ')).join('') + '\n';
    }
    return out;
  }

  function buildMoveListText(auto) {
    const now = new Date();
    // Seat label: brain name for an AI, else "Human".
    const seatLabel = (p) => game.playerTypes[p] === 'ai' ? `${game.aiNames[p]} (AI)` : 'Human';
    const seatName  = (p) => (p === 1 ? 'White' : 'Red');
    const withScore = showScoreOn;

    let txt = 'Backgammon Game - Move History\n';
    txt += `BG v. ${bgVersion()}\n`;
    txt += `Date: ${now.toLocaleDateString()} ${now.toLocaleTimeString()}\n`;
    if (auto) txt += 'Recorded automatically at game end (Auto Record).\n';
    if (netRole()) txt += `Downloaded by: ${netRole()} (this machine)\n`;
    txt += `White: ${seatLabel(1)}, Red: ${seatLabel(2)}\n`;
    // Describe the starting position: "Standard Start" for the ordinary opening, else the
    // actual board (from the initial time-travel snapshot).
    const initSnap = game.gameHistory.find((s) => s.isInitial) || game.gameHistory[0];
    if (initSnap) {
      txt += isStandardStart(initSnap.points, initSnap.bar, initSnap.borneOff)
        ? 'Initial position: Standard Start\n'
        : `Initial position: ${describeBoard(initSnap.points, initSnap.bar, initSnap.borneOff)}\n`;
    }
    txt += '\n';
    // Pip counts are the position AFTER the turn; Time is the mover's wall clock for it.
    // The six probabilities are written out in full rather than three plus a subtraction:
    // W's three and R's three are not recoverable from each other, only their totals are.
    // All White-view, all with two decimals — a backgammon is often well under 1%, so
    // whole percents would print 0 down the whole column.
    txt += 'Turn  Player  Dice   ' + 'Moves'.padEnd(26) + ' ' + 'Pip W'.padStart(6)
         + ' ' + 'Pip R'.padStart(6) + ' ' + 'Time ms'.padStart(10)
         + (withScore ? '  ' + 'Score'.padStart(6)
             + ' ' + 'W win%'.padStart(7) + ' ' + 'W gam%'.padStart(7) + ' ' + 'W bg%'.padStart(7)
             + ' ' + 'R win%'.padStart(7) + ' ' + 'R gam%'.padStart(7) + ' ' + 'R bg%'.padStart(7)
             : '') + '\n\n';

    // A doubling-accept snapshot carries no dice ([0,0]) and no checker moves — it just
    // records the new cube value. It is NOT its own turn: fold "DC=N" into the Moves column
    // of the proposer's actual roll (the very next real snapshot), so the doubling shows on
    // the turn it happened and the turn numbering stays continuous.
    let displayTurn = 0;
    let pendingDC = null;
    game.gameHistory.forEach((snap) => {
      const isDouble = !snap.isInitial && !snap.dice[0] && !snap.dice[1];
      if (isDouble) { pendingDC = snap.doublingCubeValue; return; }   // fold into the next row

      const turnNum = String(displayTurn++).padStart(4, ' '); // idx 0 is initial → Turn 0
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
      if (pendingDC != null) {   // proposer doubled before this roll → annotate the move
        movesText = (movesText === '-' ? '' : movesText + ' ') + `DC=${pendingDC}`;
        pendingDC = null;
      }
      // Pip counts for the position this snapshot holds, and the mover's wall clock.
      const pipW = String(game.pipCountP(snap.points, snap.bar, 1)).padStart(6, ' ');
      const pipR = String(game.pipCountP(snap.points, snap.bar, 2)).padStart(6, ' ');
      const tStr = (snap.elapsedMs == null ? '-' : msText(snap.elapsedMs)).padStart(10, ' ');

      txt += `${turnNum}  ${pCode}   ${diceStr}  ${movesText.padEnd(26, ' ')} ${pipW} ${pipR} ${tStr}`;
      if (withScore) {
        const pw = snapshotWhiteWin(snap);
        const dist = snapshotNetDist(snap);
        const scoreTxt = (pw === null) ? fmtBrainValue(snapshotScore(snap), false) : Math.round(100 * pw) + '%';
        txt += '  ' + scoreTxt.padStart(6, ' ');
        // A linear-scored row has no probabilities; leave the six blank rather than zero.
        txt += dist ? dist.map((v) => (100 * v).toFixed(2).padStart(7, ' ')).join(' ')
                    : '       '.repeat(6);
        txt += '\n';
      } else txt += '\n';
    });
    // Edge case: a double with no following roll (e.g. game ended on it) — show it on its own.
    if (pendingDC != null) txt += `${String(displayTurn).padStart(4, ' ')}         -    DC=${pendingDC}\n`;

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

    // ── Who played, how long they took, and (for an AI) with what parameters ──
    txt += '\nPlayers\n';
    for (const p of [1, 2]) {
      const dep = game.playerTypes[p] === 'ai' ? `   depth ${playerDepth(p)}` : '';
      txt += `  ${seatName(p).padEnd(6, ' ')}${seatLabel(p)}${dep}\n`;
    }

    txt += '\nTime spent\n';
    for (const p of [1, 2]) {
      const n = playerTurns[p], ms = playerMs[p];
      txt += n
        ? `  ${seatName(p).padEnd(6, ' ')}${String(n).padStart(3, ' ')} moves   total ${durText(ms).padEnd(10, ' ')} average ${msText(ms / n)} ms/move\n`
        : `  ${seatName(p).padEnd(6, ' ')}  0 moves\n`;
    }

    const aiSeats = [1, 2].filter((p) => game.playerTypes[p] === 'ai');
    if (aiSeats.length) {
      // One block per distinct brain — a brain playing both seats is printed once.
      const bySeat = {};
      for (const p of aiSeats) (bySeat[game.aiNames[p]] = bySeat[game.aiNames[p]] || []).push(seatName(p));
      txt += '\nAI parameters\n';
      for (const nm of Object.keys(bySeat)) {
        txt += `  ${nm} (${bySeat[nm].join(', ')})\n`;
        txt += brainParamBlock(nm, '  ');
      }
    }
    return txt;
  }

  // Write the record to a file. `auto` marks the Auto Record copy (own filename + header
  // line) so an auto-saved game is never confused with one you exported by hand.
  function downloadMoveList(auto) {
    const txt = buildMoveListText(auto);
    const link = document.createElement('a');
    link.download = `backgammon-${auto ? 'record' : 'moves'}-${Date.now()}.txt`;
    link.href = URL.createObjectURL(new Blob([txt], { type: 'text/plain' }));
    link.click();
    sysLog(auto ? '[System] Auto Record — game record downloaded.' : '[System] Move list downloaded.');
  }


  // ── Loading a recorded game back in ─────────────────────────────────────────
  // A downloaded record carries everything needed to replay the game exactly: the initial
  // position (either "Standard Start" or the same describeBoard() string) and then, per
  // turn, the mover, the dice and the moves in Magriel notation. Replay runs through
  // makeMove(..., false) — the path network replay already uses — and endTurn(), so
  // gameHistory is rebuilt exactly the way a live game builds it and the move list, time
  // travel, MOV and Board Value all work with no extra plumbing.
  //
  // Validation is ALL-OR-NOTHING and happens during a replay onto a scratch board, so a
  // bad file can never leave a half-loaded game behind. The recorded pip columns double as
  // a checksum: if the replayed board disagrees with the file at any turn, the file is
  // refused with the turn named, rather than silently loading a subtly wrong game.
  const GAME_RECORD_TAG = 'Backgammon Game - Move History';
  const looksLikeGameRecord = (text) => text.trimStart().startsWith(GAME_RECORD_TAG);

  // Inverse of describeBoard(): "White: 24(2) 13(5) | Red: 1(2) | Bar W:0 R:0 | Off W:0 R:0"
  function parseBoardDescription(str) {
    const m = str.match(/White:\s*(.*?)\s*\|\s*Red:\s*(.*?)\s*\|\s*Bar\s*W:\s*(\d+)\s*R:\s*(\d+)\s*\|\s*Off\s*W:\s*(\d+)\s*R:\s*(\d+)/);
    if (!m) return null;
    const points = Array(25).fill(null).map(() => ({ player: null, count: 0 }));
    const fill = (spec, pl) => {
      if (spec === '-') return true;
      for (const tok of spec.split(/\s+/).filter(Boolean)) {
        const t = tok.match(/^(\d+)\((\d+)\)$/);
        if (!t) return false;
        const i = +t[1], c = +t[2];
        if (i < 1 || i > 24 || c < 1 || points[i].player !== null) return false;
        points[i] = { player: pl, count: c };
      }
      return true;
    };
    if (!fill(m[1], 1) || !fill(m[2], 2)) return null;
    const board = { points, bar: { 1: +m[3], 2: +m[4] }, borneOff: { 1: +m[5], 2: +m[6] } };
    // 15 checkers a side or it isn't a backgammon position.
    for (const pl of [1, 2]) {
      let n = board.bar[pl] + board.borneOff[pl];
      for (let i = 1; i <= 24; i++) if (points[i].player === pl) n += points[i].count;
      if (n !== 15) return null;
    }
    return board;
  }

  // "13/7", "6/3*", "bar/22", "24/off", "8/5(2)" → one entry per checker moved, or null.
  // Destination types must match what getRawDestinations() produces, because makeMove
  // compares them with === : a NUMBER for a point, the string "off" for a bear-off.
  function parseMoveToken(tok) {
    const m = tok.match(/^(bar|\d+)\/(off|\d+)\*?(?:\((\d+)\))?$/i);
    if (!m) return null;
    const from = /^bar$/i.test(m[1]) ? 'bar' : Number(m[1]);
    const to   = /^off$/i.test(m[2]) ? 'off' : Number(m[2]);
    const n = m[3] ? Number(m[3]) : 1;
    if (!n || n > 4) return null;
    return Array.from({ length: n }, () => ({ from, to }));
  }

  // Turn rows. The Moves cell can overflow its column, so the numeric tail is anchored to
  // the end of the line and Moves is whatever is left. Magriel tokens always contain "/",
  // which is what stops the non-greedy Moves group from eating a pip count.
  // ⚠️ Everything after the Time column is DERIVED and must be ignored on the way back in:
  // the Score cell (an integer for a linear brain, "62%" for a net) and, since 8/29, six
  // probability columns. The file round-trips on mover / dice / moves / pips alone — the pip
  // columns are the checksum — so the tail is deliberately swallowed rather than parsed.
  const RECORD_ROW_RE = /^\s*(\d+)\s+(White|Red)\s+(\S+)\s+(.*?)\s+(\d+)\s+(\d+)\s+([\d,]+|-)(?:\s+(-?[\d,]+%?|WIN|LOSS))?(?:\s+[-\d.,%\s]*)?\s*$/;

  // Pull a record apart into { starter, initial, turns, win }. Returns { err } on the first
  // thing that doesn't make sense, with a message worth showing the user.
  function parseGameRecord(text) {
    const lines = String(text).replace(/\r/g, '').split('\n');
    let initial = null;
    const initLine = lines.find((l) => l.startsWith('Initial position:'));
    if (initLine) {
      const spec = initLine.slice('Initial position:'.length).trim();
      if (spec !== 'Standard Start') {
        initial = parseBoardDescription(spec);
        if (!initial) return { err: 'the "Initial position" line could not be read.' };
      }
    }

    const turns = [];
    let starter = null, expected = 0;
    for (const line of lines) {
      const m = line.match(RECORD_ROW_RE);
      if (!m) continue;
      const turn = Number(m[1]);
      if (turn !== expected) return { err: `turn numbering jumps from ${expected - 1} to ${turn}.` };
      expected++;
      const player = m[2] === 'White' ? 1 : 2;
      const pipW = Number(m[5]), pipR = Number(m[6]);
      const ms = m[7] === '-' ? null : Number(m[7].replace(/,/g, ''));

      if (turn === 0) { starter = player; continue; }   // the initial snapshot, not a played turn

      const d = m[3].match(/^(\d)-(\d)$/);
      if (!d) return { err: `turn ${turn}: "${m[3]}" is not a dice roll.` };

      // Strip the folded cube annotation, then expand the Magriel tokens.
      let movesText = m[4].trim(), dc = null;
      const dcm = movesText.match(/\bDC=(\d+)\b/);
      if (dcm) { dc = Number(dcm[1]); movesText = movesText.replace(dcm[0], '').trim(); }
      const moves = [];
      if (movesText && movesText !== '-') {
        for (const tok of movesText.split(/\s+/)) {
          const parsed = parseMoveToken(tok);
          if (!parsed) return { err: `turn ${turn}: "${tok}" is not a move.` };
          moves.push(...parsed);
        }
      }
      turns.push({ turn, player, d1: Number(d[1]), d2: Number(d[2]), moves, dc, ms, pipW, pipR });
    }

    if (!turns.length) return { err: 'it contains no turns.' };
    if (starter == null) starter = turns[0].player;

    // The Players footer: who held each seat, and at what depth. Restoring these matters for
    // more than tidiness — the move list's Score column is computed with the moving seat's
    // brain (scoringWeights), so a game reloaded into two Human seats would re-score itself
    // against the editor's brain and quietly disagree with the file it came from.
    const seats = [];
    for (const line of lines) {
      const ai = line.match(/^  (White|Red)\s+(.+?)\s+\(AI\)(?:\s+depth\s+(\d+))?\s*$/);
      if (ai) { seats.push({ player: ai[1] === 'White' ? 1 : 2, name: ai[2].trim(), depth: ai[3] ? Number(ai[3]) : null }); continue; }
      const hu = line.match(/^  (White|Red)\s+Human\s*$/);
      if (hu) seats.push({ player: hu[1] === 'White' ? 1 : 2, name: null, depth: null });
    }

    // The result line, for a game that ended on a declined double (no bear-off on the board).
    let win = null;
    for (const line of lines) {
      const r = line.match(/^\s*(White|Red)\s+(defeated|gammoned|backgammoned)\s+(White|Red)\s*$/);
      if (r) { win = r[1] === 'White' ? 1 : 2; break; }
    }
    return { starter, initial, turns, win, seats };
  }

  // Replay a record into the live game. Returns true on success; on failure nothing has
  // been touched, because the replay runs on a scratch game first.
  function loadGameRecord(text) {
    const reject = (why) => {
      gameMessageEl.textContent = 'Game record rejected — ' + why;
      sysLog('[Import] Game record rejected — ' + why);
      return false;
    };
    if (isNetworkGame) return reject('a network game is in progress.');

    const rec = parseGameRecord(text);
    if (rec.err) return reject(rec.err);

    // Replay onto a scratch engine, so a file that fails halfway leaves the real game alone.
    const g = new BackgammonGame();
    g.restart();
    if (rec.initial) {
      g.points = JSON.parse(JSON.stringify(rec.initial.points));
      g.bar = { ...rec.initial.bar };
      g.borneOff = { ...rec.initial.borneOff };
    }
    g.doublingCubeValue = 1; g.doublingCubeOwner = null; g.winner = null; g.winByDecline = false;
    g.beginGameWithStarter(rec.starter);
    g.futureRolls = []; g.futureRollIndex = 0;

    for (const t of rec.turns) {
      if (g.winner) return reject(`turn ${t.turn} comes after the game was already won.`);
      g.turnCount = t.turn;
      g.currentPlayer = t.player;
      g.playedMovesThisTurn = [];
      g.turnHistory = [];

      // A cube annotation in the file was folded in from a separate accept-snapshot — dice
      // [0,0], no moves — that acceptDouble() pushes BEFORE the proposer rolls. Recreate that
      // snapshot rather than just setting the cube value, or the reloaded list would lose the
      // "DC=N" the renderer folds back in. Mirrors acceptDouble() exactly.
      if (t.dc != null) {
        g.doublingCubeValue = t.dc;
        g.doublingCubeOwner = t.player === 1 ? 2 : 1;
        g.dice = [0, 0]; g.movesLeft = []; g.hasRolled = false;
        g.saveGameSnapshot(`${t.player === 1 ? 'White' : 'Red'} offered double. Accepted (${t.dc}x).`);
      }

      g.hasRolled = true;
      g.dice = [t.d1, t.d2];
      g.movesLeft = (t.d1 === t.d2) ? [t.d1, t.d1, t.d1, t.d1] : [t.d1, t.d2];

      for (const mv of t.moves) {
        if (!g.makeMove(mv.from, mv.to, false)) {
          return reject(`turn ${t.turn}: ${mv.from}/${mv.to} is not legal in the replayed position.`);
        }
      }
      // The file's own pip columns are the checksum on the replay.
      const pw = g.pipCountP(g.points, g.bar, 1), pr = g.pipCountP(g.points, g.bar, 2);
      if (pw !== t.pipW || pr !== t.pipR) {
        return reject(`turn ${t.turn}: pip counts disagree (file ${t.pipW}/${t.pipR}, replay ${pw}/${pr}).`);
      }
      // A live game never calls endTurn on the winning move — the snapshot is taken directly —
      // so mirror that here, or the loaded history would differ from a played one.
      if (g.winner) {
        g.saveGameSnapshot(`Turn ${t.turn} (${t.player === 1 ? 'White' : 'Red'}): Rolled ${t.d1}, ${t.d2}`);
      } else {
        BackgammonGame.prototype.endTurn.call(g);   // the raw engine method: no broadcast, no clock
      }
      const snap = g.gameHistory[g.gameHistory.length - 1];
      if (snap) snap.elapsedMs = t.ms;
    }
    // A game that ended on a declined double leaves no bear-off win on the board.
    if (!g.winner && rec.win) { g.winner = rec.win; g.winByDecline = true; }

    // ── Commit: the replay succeeded, so adopt it. ──
    haltEverything();
    if (setupMode) exitSetup();
    for (const k of ['points', 'bar', 'borneOff', 'currentPlayer', 'dice', 'movesLeft', 'hasRolled',
                     'winner', 'winByDecline', 'doublingCubeValue', 'doublingCubeOwner',
                     'turnCount', 'gameHistory', 'turnHistory', 'playedMovesThisTurn',
                     'futureRolls', 'futureRollIndex']) game[k] = g[k];

    // Put the seats back. A brain the record names but this roster doesn't have (an imported
    // champion that was never re-imported) can't be restored — say so and leave that seat Human
    // rather than scoring the game against the wrong weights.
    const missing = [];
    for (const seat of rec.seats) {
      const typeEl  = document.getElementById(seat.player === 1 ? 'p1-type'  : 'p2-type');
      const depthEl = document.getElementById(seat.player === 1 ? 'p1-depth' : 'p2-depth');
      if (!typeEl) continue;
      const known = seat.name && [...typeEl.options].some((o) => o.value === seat.name);
      if (seat.name && !known) missing.push(seat.name);
      typeEl.value = known ? seat.name : 'human';
      if (depthEl && seat.depth != null && [...depthEl.options].some((o) => o.value === String(seat.depth))) {
        depthEl.value = String(seat.depth);
      }
      syncDepthMenu(seat.player);
    }
    if (rec.seats.length) syncPlayersFromMenus();

    gameStarted = true;          // so the list renders and the nav bar works
    aiStopped = true;            // a loaded game never auto-plays; press START to take it on
    isAIPlaying = false;
    initialRollOff = false;
    setupOriginBoard = null;
    selectedSource = null; legalDestinations = [];
    historyNavBuffer = []; historyNavIndex = null;
    // A finished record has already been scored and already been written to disk — don't
    // tally it again, and don't let Auto Record download a copy of the file we just read.
    // An UNfinished one is genuinely resumable, so leave those guards open.
    const finished = !!game.winner;
    gameScored = finished; gameRecorded = finished; winTurnRecorded = finished;
    // Show the times the record was made with, not the milliseconds the replay just took.
    clockPause();
    playerMs[1] = playerMs[2] = 0; playerTurns[1] = playerTurns[2] = 0;
    for (const t of rec.turns) if (t.ms != null) { playerMs[t.player] += t.ms; playerTurns[t.player]++; }

    const btnStart = document.getElementById('btn-start-game');
    if (btnStart) { btnStart.disabled = false; btnStart.style.opacity = '1'; }
    clearHistoryScoreCache();
    renderHistoryList();
    updateUI();
    sysLog(`[Import] Game record loaded — ${rec.turns.length} turns.`);
    if (missing.length) sysLog(`[Import] Not in this roster, seat left Human: ${missing.join(', ')}`);
    gameMessageEl.textContent = missing.length
      ? `Game record loaded — ${rec.turns.length} turns. Unknown AI: ${missing.join(', ')} — that seat is Human.`
      : `Game record loaded — ${rec.turns.length} turns. Click a row to replay from it.`;
    return true;
  }

  const exportMovesEl = document.getElementById('export-moves');
  if (exportMovesEl) {
    exportMovesEl.addEventListener('click', () => {
      if (game.gameHistory.length === 0) { alert('No moves have been played yet!'); return; }
      downloadMoveList(false);
    });
  }

  // Console Log
  const exportConsoleEl = document.getElementById('export-console');
  if (exportConsoleEl) {
    exportConsoleEl.addEventListener('click', () => {
      if (consoleLog.length === 0) { alert('Console log is empty.'); return; }
      const link = document.createElement('a');
      link.download = `backgammon-console-${Date.now()}.txt`;
      const who = netRole() ? `Downloaded by: ${netRole()} (this machine)\n` : '';
      const header = `BG v. ${bgVersion()}  —  ${new Date().toLocaleString()}\n${who}\n`;
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
      if (isNetScore(weights)) {
        // Board Value is a per-feature breakdown of the 22 linear eval terms. A net has no
        // features to break down — its 16k parameters are not a decomposition of the score.
        const msg = scoringAIName(onRoll) + ' is a net brain — it has no per-feature breakdown to export.';
        gameMessageEl.textContent = msg;
        sysLog('[Export] Board Value refused — ' + msg);
        return;
      }
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
      // Examination mode → whatever row 12 analyses with; play mode → the on-roll seat's
      // brain, or the analysis brain if that seat is human (see analysisBrainName).
      const brainName = setupMode
        ? setupAnalysisName()
        : (game.playerTypes[player] === 'ai' ? game.aiNames[player] : analysisBrainName());
      const W = setupMode
        ? setupAnalysisWeights()
        : (game.playerTypes[player] === 'ai' ? game.aiWeights[player] : game.personalityWeights(analysisBrainName()));
      const board = { points: game.points, bar: game.bar, borneOff: game.borneOff };   // CURRENT position
      const rolls = [[2,1],[3,1],[3,2],[4,1],[4,2],[4,3],[5,1],[5,2],[5,3],[5,4],[6,1],[6,2],[6,3],[6,4],[6,5],
                     [1,1],[2,2],[3,3],[4,4],[5,5],[6,6]];

      let csv = `BG v. ${bgVersion()}  —  ${new Date().toLocaleString()}\n`;
      csv += `Move table — ${brainName}, depth ${depth}, ${who} on roll\n`;
      csv += `Position:,"${describeBoard()}"\nDice,Best move,${isNetScore(W) ? 'Equity (White view),White win %' : 'Score (White view)'}\n`;
      try {
        for (let k = 0; k < rolls.length; k++) {
          const [d1, d2] = rolls[k];
          const dice = d1 === d2 ? [d1, d1, d1, d1] : [d1, d2];
          if (label) label.textContent = `${k + 1}/${rolls.length}…`;
          gameMessageEl.textContent = `Move table (${brainName} d${depth}, ${who}): ${k + 1}/${rolls.length} — ${d1}-${d2}…`;
          const ranked = await rankMovesFor(board, player, dice, depth, W);
          const best = ranked[0];
          const mv = best ? best.moves.map((m) => `${m.from === 'bar' ? 'bar' : m.from}/${m.to === 'off' ? 'off' : m.to}`).join(', ') : '(none)';
          const pct = best ? winPctByMove(W, board, player, dice).get(moveText(best.moves)) : null;
          csv += `${d1} ${d2},"${mv}",${best ? fmtBrainValue(best.value, isNetScore(W)) : ''}`
               + (isNetScore(W) ? ',' + (pct == null ? '' : pct) : '') + '\n';
        }
        if (isNetScore(W)) {
          // A net has no parameter row to print: 16k floats are not a table, and the numbers
          // in the Score column are equity, not the +-1000 band the linear brains use.
          csv += `\nBrain,${brainName}\nKind,neural net (scores are EQUITY in points, not the +-1000 weight band)\n`;
          csv += `Hidden,${(W.net.spec.hidden || []).join(' x ')}\nActivation,${W.net.spec.activation}\n`;
          csv += `Trained games,${W.net.trainedGames || 0}\nParameters,${BG_NET.netParamCount(W.net)}\n`;
        } else {
          csv += `\nParameters,${BRAIN_KEYS.join(',')}\n`;
          csv += `${brainName},${BRAIN_KEYS.map((k) => (W[k] != null ? W[k] : 0)).join(',')}\n`;
        }
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
  // Auto Record (default OFF). When on, a full game record downloads automatically the
  // moment a game ends — the same file Export → Move List produces on demand.
  let autoRecordOn = false;
  // DUPLO (default ON) — duplicate-bridge pairing for Tournament and Compete. Matches
  // run in PAIRS: both halves get the SAME match seed (hence identical dice) with the
  // seats swapped, so dice luck cancels between them. Both batch paths ALREADY swapped
  // seats on alternate matches (`swap = k % 2 === 1`); DUPLO simply makes the two halves
  // of a pair share a seed. A brain played against itself therefore nets EXACTLY zero
  // (see duplo-selfplay-test.js). Does not affect how any single game is played.
  let duploOn = true;

  // Initialise badges to their defaults
  updateSettingBadge('badge-doubling', doublingOn);
  updateSettingBadge('badge-autostart', autoStartOn);
  updateSettingBadge('badge-timetravel', timeTravelOn);
  updateSettingBadge('badge-autorecord', autoRecordOn);
  updateSettingBadge('badge-duplo', duploOn);
  updateSettingBadge('badge-showscore', showScoreOn);
  updateSettingBadge('badge-netanalysis', netAnalysisOn);
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

  // Auto Record row
  const settingAutoRecordEl = document.getElementById('setting-autorecord');
  if (settingAutoRecordEl) {
    settingAutoRecordEl.addEventListener('click', () => {
      autoRecordOn = !autoRecordOn;
      updateSettingBadge('badge-autorecord', autoRecordOn);
      sysLog(`[System] Auto Record toggled to ${autoRecordOn ? 'ON' : 'OFF'}`);
    });
  }

  // DUPLO row
  const settingDuploEl = document.getElementById('setting-duplo');
  if (settingDuploEl) {
    settingDuploEl.addEventListener('click', () => {
      duploOn = !duploOn;
      updateSettingBadge('badge-duplo', duploOn);
      sysLog('[System] DUPLO toggled to ' + (duploOn ? 'ON' : 'OFF'));
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

  // Net Analysis row
  const settingNetAnalysisEl = document.getElementById('setting-netanalysis');
  if (settingNetAnalysisEl) {
    settingNetAnalysisEl.addEventListener('click', async () => {
      netAnalysisOn = !netAnalysisOn;
      updateSettingBadge('badge-netanalysis', netAnalysisOn);
      sysLog('[System] Net Analysis toggled to ' + (netAnalysisOn ? 'ON' : 'OFF'));
      const sel = document.getElementById('nn-brain');
      const name = sel && sel.value;
      if (netAnalysisOn && name && !nnMissing(name)) await ensureNetLoaded(name);
      clearHistoryScoreCache();
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
      netSend({ type: 'decline' });
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

    // Per-turn state fingerprint (network games only) for cross-machine post-mortem diffing.
    // Logged once per distinct (turnCount, currentPlayer, hasRolled, BOARD) — i.e. at each roll,
    // each hand-off, and any checker change — so the two consoles line up and the first mismatch
    // is obvious. The board belongs in the key: it used to be keyed on turn state alone, so a
    // corruption that moved checkers WITHOUT touching turnCount/currentPlayer/hasRolled printed
    // nothing at all (the 8/16 stale-`sync` revert was invisible in the guest log until the
    // heartbeat caught it ~40 s later). Costs one extra line per sub-move; worth it.
    if (isNetworkGame) {
      const fpKey = `${game.turnCount}/${game.currentPlayer}/${game.hasRolled}/${boardSig(game.points, game.bar, game.borneOff)}`;
      if (fpKey !== lastFpKey) {
        lastFpKey = fpKey;
        sysLog(`[State] t=${game.turnCount} p=${game.currentPlayer} rolled=${game.hasRolled} off=${game.borneOff[1]}/${game.borneOff[2]} | ${boardSig(game.points, game.bar, game.borneOff)}`);
      }
    }

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

    // Waiting side of a network game: grey the dice (they're the opponent's roll, and this
    // machine can't roll them). Styled in style.css as .dice-container.waiting-opponent.
    diceContainerEl.classList.toggle('waiting-opponent', waitingForOpponent());

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
        gameMessageEl.textContent = `${byName} Doubles. ${respName}, press the playing dice to accept the double, or the doubling cube to reject it, and resign.`;
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
          bankTurn(game.currentPlayer, game.gameHistory[game.gameHistory.length - 1]);
        }
        clockPause();   // the game is over — stop banking wall clock
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
      if (!gameScored) {
        addScore(winner, pts); gameScored = true;
        // Freeze this finished game as DUPLO's target (see duploTarget). Network games are
        // included now: the replay reads recorded rolls, so it needs no shared dice stream.
        duploTarget = captureGameForDuplo() || duploTarget;
      }
      // Auto Record: one game record per completed game, written the moment the game ends.
      // Guarded like gameScored, because this branch re-runs on every render.
      if (autoRecordOn && !gameRecorded) { gameRecorded = true; downloadMoveList(true); }
      btnUndo.disabled = true;
    } else if (!gameStarted) {
      // Three cases: the connected guest waits, the connected host gets the two-step
      // instruction (Start, then roll off), and local play keeps the pick-your-players line
      // (on the network the seats are already fixed by role, so there is nothing to select).
      if (isNetworkGame && localPlayerRole === 2) {
        gameMessageEl.textContent = "Wait for the host to start the game!";
      } else if (isNetworkGame) {
        gameMessageEl.textContent = "Click the Start button to start the game and the playing dice to determine who goes first.";
      } else {
        gameMessageEl.textContent = "Ready to go! To play, select players and click on Start";
      }
    } else if (initialRollOff) {
      gameMessageEl.textContent = (isNetworkGame && localPlayerRole === 2)
        ? "Wait for the host to make the initial roll."
        : "Click the dice to decide who starts!";
    } else if (!game.hasRolled) {
	gameMessageEl.textContent = waitingForOpponent()
        ? thinkingMessage()
        : `${game.currentPlayer === 1 ? 'White' : 'Red'}: Click the dice to roll.`;
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
  // Total deadlock: a hand-set-up position where NEITHER player can play ANY roll. Without this
  // guard the two sides just take turns rolling forever. Detect it, freeze, and say so.
  if (!game.hasAnyLegalMove(1) && !game.hasAnyLegalMove(2)) {
    gameMessageEl.textContent = "No player can play.  Very clever!";
    if (turnEndTimer)    { clearTimeout(turnEndTimer);    turnEndTimer    = null; }
    if (aiActionTimeout) { clearTimeout(aiActionTimeout); aiActionTimeout = null; }
    aiStopped = true; isAIPlaying = false;
    return;
  }
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
        gameMessageEl.textContent = waitingForOpponent()
          ? thinkingMessage()
          : (game.currentPlayer === 1 ? 'White to move descending' : 'Red to move ascending');
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

// Forward declaration only. The REAL handleRollClick is assigned further down (search
// "Define handleRollClick inside the DOMContentLoaded block") — that one is the only one that
// ever runs. A stale duplicate BODY used to sit here, silently overwritten by that assignment;
// a DUPLO diagnostic added to it on 8/24 never fired and cost a debugging round, so it was
// deleted. Every caller runs from an event listener or a setTimeout, so the binding is always
// assigned before it is used.
let handleRollClick;

  /**
   * A player (on roll, owning or sharing the cube) offers a double by clicking the cube.
   * This locks the dice and hands the decision to the opponent. Nothing is committed to
   * the cube until the opponent accepts.
   */
  function handleDoubleOffer() {
    if (pendingDouble) return;
    if (setupOriginBoard) {                                     // examination (set-up) game → no doubling
      gameMessageEl.textContent = "Doubling is off for set-up (examination) games.";
      return;
    }
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
    netSend({ type: 'double' });
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
    setupOriginBoard  = null;   // full reset → back to the standard start for Restart too
    liveGame          = { seed: null, starter: null };   // DUPLO: nothing to replay after a full reset
    duploTarget       = null;
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
    duploTarget = null;   // RESTART explicitly begins the next game -> DUPLO follows it
    // In a remote game the host is in control of restart; the guest's button does nothing.
    if (isNetworkGame && localPlayerRole !== 1) return;

    // A game launched from a set-up position → replay the EXACT same start: same board (restored
    // in applyRestartNewGame), same opening player, and same opening dice — NOT alternated.
    if (setupOriginBoard && setupOriginBoard.starter) {
      applyRestartNewGame(setupOriginBoard.starter);
      return;
    }

    // No game has been played yet this session -> behave like the Start button (a roll-off
    // decides the first opener). startGame() also notifies the guest in a network game.
    if (lastStarter == null) {
      startGame(false);
      return;
    }

    // A game has been played -> alternate the opener and launch the next game immediately.
    const newStarter = (lastStarter === 1) ? 2 : 1;
    if (isNetworkGame && localPlayerRole === 1 && conn) {
      // Wipe the room's message backlog FIRST, then send restart as the first message of the
      // fresh game — so the room never carries a stale multi-game history for a later reconnect.
      const sendRestart = () => conn.send({ type: 'restart', starter: newStarter });
      if (conn.clearQueues) conn.clearQueues().then(sendRestart); else sendRestart();
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
  function applyRestartNewGame(starter, seed = null, rollOff = false, duplo = null) {
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
    if (duplo) {
      // The duplicate is played from the MIRROR of the position the original started from:
      // point p becomes point 25-p and the colours swap, so this seat now holds what the
      // other seat held. mirrorPosition is net.js's, the same one the encoder uses, so the
      // reflection is the one eval-symmetry-test.js already covers.
      const m = BG_NET.mirrorPosition(duplo.points, duplo.bar, duplo.borneOff);
      game.points   = m.points;
      game.bar      = { ...m.bar };
      game.borneOff = { ...m.borneOff };
      // A game launched from a set-up board keeps its origin, mirrored to match, so RESTART
      // still reproduces what is now on the screen (and doubling stays off for both halves).
      if (setupOriginBoard) setupOriginBoard = { points: JSON.parse(JSON.stringify(m.points)),
        bar: { ...m.bar }, borneOff: { ...m.borneOff }, starter, dice: null };
    } else if (setupOriginBoard) {   // launched from a set-up position → restart from THAT board
      game.points   = JSON.parse(JSON.stringify(setupOriginBoard.points));
      game.bar      = { ...setupOriginBoard.bar };
      game.borneOff = { ...setupOriginBoard.borneOff };
    }
    syncPlayersFromMenus();              // re-apply the White/Red menu picks after the reset
    // DUPLO: install the dice stream BEFORE any roll is drawn. `seed` is null for an
    // ordinary restart (fresh stream) and the recorded seed for a DUPLO replay.
    beginSeededGame(seed, rollOff ? null : starter);
    if (duplo) {
      game.beginGameWithStarter(starter);   // the OTHER colour opens
      // ⚠ THE TAGS ARE FLIPPED HERE, ON PURPOSE. rollDice replays a buffered roll only if it
      // belongs to the side now on roll, and drops the whole buffer otherwise — the guard that
      // stops a player being handed the opponent's dice by accident. Handing each side the
      // other's dice is precisely what a duplicate IS, so the swap is done when the buffer is
      // built and the guard goes on doing its job.
      game.futureRolls = duplo.rolls.map((r) => ({ p: r.p === 1 ? 2 : 1, d: [r.d[0], r.d[1]] }));
      game.futureRollIndex = 0;
      sysLog('[DUPLO-diag] replay armed: ' + game.futureRolls.length + ' rolls, opener player ' + starter);
    } else if (rollOff) {
      game.rollForFirstTurn();           // same stream -> same opening dice -> same colour opens
      starter = game.currentPlayer;
      sysLog('[DUPLO-diag] replayed roll-off -> dice ' + game.dice[0] + '-' + game.dice[1] + ', opener player ' + starter);
    } else {
      game.beginGameWithStarter(starter);  // forced opener (records the "Start of Game" snapshot)
    }
    // For a set-up game, replay the SAME opening dice too (skip the random first roll).
    if (setupOriginBoard && setupOriginBoard.dice) {
      const dd = setupOriginBoard.dice;
      game.dice = [dd[0], dd[1]];
      game.movesLeft = (dd[0] === dd[1]) ? [dd[0], dd[0], dd[0], dd[0]] : [dd[0], dd[1]];
      game.hasRolled = true;
    }
    gameStarted      = true;
    lastStarter      = starter;
    gameScored       = false;   // new game to tally; scores themselves are preserved
    winTurnRecorded  = false;
    gameRecorded     = false;
    gameClockReset();

    // No overlay / Start needed — the game is already running.
    const overlay = document.getElementById('start-menu-overlay');
    if (overlay) overlay.style.display = 'none';
    const btnStart = document.getElementById('btn-start-game');
    if (btnStart) { btnStart.disabled = true; btnStart.style.opacity = '0.5'; }

    // Show the dice if this restart already rolled (DUPLO roll-off replay, or a set-up
    // game replaying its forced opening); blank for a forced opener that has yet to roll.
    renderDie(die1El, game.hasRolled ? game.dice[0] : 0);
    renderDie(die2El, game.hasRolled ? game.dice[1] : 0);
    updateUI();   // -> checkAndTriggerAITurn (AI opener) / checkAndAutoRoll (human, if Auto Roll)
  }

/**
   * Render history list for time travel replaying with a fixed header
   * and a constant-height scrollable body.
   */
  // The brain that analyses a HUMAN's play. With Net Analysis ON (the default) that is
  // the net chosen in the NN row (row 18) — normally the strongest net on the roster;
  // with it OFF, the brain menu in the AI row (row 13). A listed net is registered as a
  // brain BEFORE its weights arrive, so a net with no `net` yet falls through to row 13
  // for this render; the row-18 and settings handlers load it and re-score.
  // Reached through getElementById because this runs during the first render, before the
  // late `nnBrainSel` / `editBrainSel` consts exist.
  function analysisBrainName() {
    if (netAnalysisOn) {
      const el = document.getElementById('nn-brain');
      const n = el && el.value;
      const w = n ? game.personalityWeights(n) : null;
      if (w && w.kind === 'net' && w.net) { analysisBrainName.noted = ''; return n; }
      // Falling through here silently changes the Score column from a win % to the ±1000
      // band, which is exactly how a net that failed to load went unnoticed on the deployed
      // site. Say it once: this runs for every row of every render, so it is de-duped on the
      // net's name, and the flag lives on the function itself -- a `let` out here would be in
      // its temporal dead zone at the first render, this file's recurring bug.
      if (n && analysisBrainName.noted !== n) {
        analysisBrainName.noted = n;
        sysLog('[Nets] ' + n + ' is not loaded, so a human seat is analysed by the AI-row brain '
               + 'and the Score column is in band units, not win %.');
      }
    }
    const ed = document.getElementById('edit-brain');
    return (ed && ed.value) || 'Origin';
  }

  // Which weights to score a given (on-roll) player's perspective with:
  //  - an AI seat uses its own weights;
  //  - a human facing an AI uses the AI opponent's weights;
  //  - human vs human uses the analysis brain (see analysisBrainName).
  function scoringWeights(player) {
    if (game.playerTypes[player] === 'ai') return game.aiWeights[player];
    const opp = player === 1 ? 2 : 1;
    if (game.playerTypes[opp] === 'ai') return game.aiWeights[opp];
    return game.personalityWeights(analysisBrainName());
  }

  // Score of a snapshot's (post-move) position, always in WHITE's view (positive =
  // good for White, negative = good for Red) — one fixed frame so the column reads
  // consistently and a dance shows the same value twice instead of flipping sign.
  // The scoring AI is still the side on roll there (matters only for mixed brains).
  // Cached on the snapshot (evaluated once) until the scoring context changes.
  // Who is on roll at a snapshot's position. One definition, because the VALUE and the two
  // places that FORMAT it must agree on which brain (and therefore which units) apply.
  function snapshotOnRoll(snapshot) {
    return snapshot.isInitial ? snapshot.currentPlayer : (snapshot.currentPlayer === 1 ? 2 : 1);
  }

  // The six outcome probabilities for a snapshot, always in WHITE's view (White single /
  // gammon / backgammon, then Red's three). One fixed frame, like the Score column, so a
  // column means the same thing on every row instead of flipping with whoever is on roll.
  // Null when a LINEAR brain scored that row — it has no probabilities at all.
  function snapshotNetDist(snapshot) {
    if (snapshot._dist !== undefined) return snapshot._dist;
    const onRoll = snapshotOnRoll(snapshot);
    const W = scoringWeights(onRoll);
    if (!isNetScore(W) || !W.net) return (snapshot._dist = null);
    const p = BG_NET.evaluatePosition(W.net, snapshot.points, snapshot.bar, snapshot.borneOff, onRoll).p;
    // ⚠ ALWAYS A PLAIN ARRAY. net.js answers with a Float64Array, and swapOutcomes returns a
    // plain one — so returning `p` unchanged made this function's type depend on who was on
    // roll. Float64Array.prototype.map COERCES its callback's result back to a number, so
    // formatting the row with .map(v => v.toFixed(2).padStart(7)) silently threw the padding
    // and the trailing zeros away on exactly half the rows of the exported move list.
    snapshot._dist = (onRoll === 1) ? Array.from(p) : BG_NET.swapOutcomes(p);
    return snapshot._dist;
  }

  /** P(White wins) for a snapshot, or null if a linear brain scored it. */
  function snapshotWhiteWin(snapshot) {
    const d = snapshotNetDist(snapshot);
    return d ? d[0] + d[1] + d[2] : null;
  }

  function snapshotScore(snapshot) {
    if (snapshot._score !== undefined) return snapshot._score;
    const onRoll = snapshotOnRoll(snapshot);
    snapshot._score = game._leafValue(snapshot.points, snapshot.bar, snapshot.borneOff, scoringWeights(onRoll), onRoll);
    return snapshot._score;
  }

  // Drop cached history scores so they recompute (after a player or scoring-AI change).
  function clearHistoryScoreCache() {
    game.gameHistory.forEach((s) => { delete s._score; delete s._dist; });
  }

  // Name of the AI whose weights score a given player (mirrors scoringWeights).
  function scoringAIName(player) {
    if (game.playerTypes[player] === 'ai') return game.aiNames[player];
    const opp = player === 1 ? 2 : 1;
    if (game.playerTypes[opp] === 'ai') return game.aiNames[opp];
    return analysisBrainName();
  }

  // Compact text description of the current board.
  function describeBoard(points = game.points, bar = game.bar, borneOff = game.borneOff) {
    const pts = (pl) => {
      const arr = [];
      for (let i = 1; i <= 24; i++) if (points[i].player === pl) arr.push(`${i}(${points[i].count})`);
      return arr.join(' ') || '-';
    };
    return `White: ${pts(1)} | Red: ${pts(2)} | Bar W:${bar[1]} R:${bar[2]} | Off W:${borneOff[1]} R:${borneOff[2]}`;
  }

  // True iff the given board is the standard opening position (nothing on the bar or borne off,
  // stacks exactly as setupInitial/restart lay them out).
  function isStandardStart(points, bar, borneOff) {
    if (bar[1] || bar[2] || borneOff[1] || borneOff[2]) return false;
    const want = { 24: [1, 2], 13: [1, 5], 8: [1, 3], 6: [1, 5], 1: [2, 2], 12: [2, 5], 17: [2, 3], 19: [2, 5] };
    for (let i = 1; i <= 24; i++) {
      const w = want[i];
      if (w) { if (points[i].player !== w[0] || points[i].count !== w[1]) return false; }
      else if (points[i].count !== 0) return false;
    }
    return true;
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
      // A doubling-accept snapshot ([0,0] dice, no moves) is not its own turn: fold "DC=N" into
      // the Moves column of the proposer's actual roll (the next real snapshot) and skip the
      // blank row, so numbering stays continuous.
      let displayTurn = 0;
      let pendingDC = null;
      game.gameHistory.forEach((snapshot, idx) => {
        const isDouble = !snapshot.isInitial && !snapshot.dice[0] && !snapshot.dice[1];
        if (isDouble) { pendingDC = snapshot.doublingCubeValue; return; }  // fold into next row
        const rowNum = displayTurn++;

        const row = document.createElement('tr');
        row.style.borderBottom = '1px solid rgba(255, 255, 255, 0.05)';
        row.style.cursor = 'pointer';
        row.title = 'Click to replay from this stage';

        row.addEventListener('click', () => {
          if (!timeTravelOn) return;   // time travel off (setting-gated; guest defaults off)
          ensureNavBuffer();
          navigateTo(idx);
          // Sync the host's jump to this stage over to the guest.
          netSend({ type: 'nav', action: 'goto', idx });
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
        if (pendingDC != null) {   // proposer doubled before this roll → annotate the move
          movesText = (movesText === '-' ? '' : movesText + ' ') + `DC=${pendingDC}`;
          pendingDC = null;
        }

        let displayDice = snapshot.isInitial ? '-' : `${snapshot.dice[0] || '-'}-${snapshot.dice[1] || '-'}`;
        let displayPCode = snapshot.isInitial ? '-' : pCode;

        let scoreCell = '';
        if (showScore) {
          // A net's column is P(WHITE WINS) as a whole percent — the one number a person can
          // read at a glance — not its equity. A linear brain keeps its own arbitrary score.
          // Both are White-view, so the colour rule is the same either side of the middle.
          const pw = snapshotWhiteWin(snapshot);
          const pct = (pw === null) ? null : Math.round(100 * pw);
          const scoreTxt = (pct === null) ? fmtBrainValue(snapshotScore(snapshot), false) : pct + '%';
          // A percentage takes the house rule (winPctColor). A linear brain has no
          // probability, so its band score goes by sign — same idea, its own zero point.
          const lin = (pct === null) ? snapshotScore(snapshot) : 0;
          const scoreColor = (pct !== null) ? winPctColor(pct)
                                            : (lin > 0 ? '#ffffff' : (lin < 0 ? '#f87171' : '#9ca3af'));
          scoreCell = `<td style="padding: 2px 4px; font-family: monospace; font-weight: bold; color: ${scoreColor};">${scoreTxt}</td>`;
        }
        row.innerHTML = `
          <td style="padding: 2px 4px; font-weight: bold;">${rowNum}</td>
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

    // Set history up to this point; future rolls come from the buffer. Each entry is TAGGED
    // with the player who rolled it and only REAL rolls are kept (skip the initial snapshot and
    // the [0,0]-dice doubling-accept snapshots) — otherwise the extra/non-alternating entries
    // shift the sequence by a turn and each side replays the other side's dice. The player tag
    // is re-checked when a roll consumes an entry (see handleRollClick), so any residual
    // misalignment discards the buffer and rolls fresh instead of copying the opponent.
    game.gameHistory         = JSON.parse(JSON.stringify(historyNavBuffer.slice(0, idx + 1)));
    game.futureRolls         = historyNavBuffer.slice(idx + 1)
      .filter(s => !s.isInitial && s.dice[0] && s.dice[1])
      .map(s => ({ p: s.currentPlayer, d: [s.dice[0], s.dice[1]] }));
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
    clockPause();      // don't bank the pause as time the player spent on this turn
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
      if (e.isTrusted) netSend({ type: 'nav', action: 'first' });
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
      if (e.isTrusted) netSend({ type: 'nav', action: 'back' });
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
      if (e.isTrusted) netSend({ type: 'nav', action: 'fwd' });
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
      if (e.isTrusted) netSend({ type: 'nav', action: 'last' });
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

  // STOP button — in examination/setup mode it exits setup back to the initial position;
  // otherwise it just PAUSES the AIs at the current position (START resumes from there). It
  // never resets an ongoing game — that's what Restart / Reset are for.
  const btnStop = document.getElementById('btn-stop');
  if (btnStop) {
    btnStop.addEventListener('click', (e) => {
      if (setupMode) { exitSetup(); return; }
      // STOP also halts a running BATCH job. Its tooltip has always promised this
      // ("Pause the AI (or stop a run)") but the handler only ever paused the interactive
      // AI, so LEARN, Compete, Tournament and Evolve could not be stopped from the board —
      // only by entering setup mode via EX/CL/IN, which happens to call haltEverything().
      // Each of these stop paths preserves its output: LEARN installs and downloads the
      // net, Evolve has already written a CSV per champion, and Tournament/Compete now
      // write a CSV marked STOPPED EARLY.
      let halting = null;
      if (learnRunning)           { learnStop = true;      halting = 'LEARN'; }
      else if (evolveRunning)     { evolveStop = true;     halting = 'evolution'; }
      else if (tournamentRunning) { tournamentStop = true; halting = 'the run'; }
      if (halting) {
        gameMessageEl.textContent = 'Stopping ' + halting + ' — results will be saved.';
        return;                       // there is no interactive game to pause underneath
      }
      stopAI();
      if (gameStarted && !game.winner) gameMessageEl.textContent = "Game Stopped.  Press the Start button to continue.";
      if (e.isTrusted && localPlayerRole === 1) {
        netSend({ type: 'stop_ai' });
      }
    });
  }
    
  // Build both player menus: "Human" at the top (default), then every AI personality.
  // Nets on top (alphabetical, which is also their performance order by convention), then
  // the linear roster in ITS order. The user's expectation is that the nets are the stronger
  // class, so they are the ones you reach first.
  function menuBrainNames() {
    const all = game.aiPersonalityNames();
    const nets = all.filter((n) => game.isNetPersonality(n));
    const shipped = nnNames().filter((n) => nets.includes(n));
    const other = nets.filter((n) => !shipped.includes(n)).sort();   // imported / freshly learned
    return [...shipped, ...other, ...all.filter((n) => !game.isNetPersonality(n))];
  }

  // ---- The shipped net roster (NNs/manifest.json) ----------------------------
  // The manifest drives the menus; the FILES load LAZILY, on first use. Nine nets is ~3 MB
  // that most sessions never touch, the page has to look complete before any of them exist,
  // and "is it actually there?" is then answered at the moment it matters — which is where
  // the user asked for the message.
  //
  // ⚠️ The fetch carries the SAME cache-buster as game.js. Without it you replace a net file,
  // reload, and get the previous net with nothing to say anything is wrong — the identical
  // trap already recorded for the worker's importScripts.
  // Lazy: WORKER_SRC is declared with the worker pool, well below this point.
  const nnStamp = () => WORKER_SRC.slice(WORKER_SRC.indexOf(String.fromCharCode(63)));
  let nnRoster = [];                                    // [{ name, file, state, why }]
  const nnEntry   = (name) => nnRoster.find((e) => e.name === name);
  const nnNames   = () => nnRoster.map((e) => e.name);
  const nnMissing = (name) => { const e = nnEntry(name); return !!e && e.state === 'missing'; };

  // Every listed net is registered at once as a brain with NO weights yet, so the menus, the
  // toggle row and the player rows are complete from the first paint. Nothing may PLAY one
  // until ensureNetLoaded has filled it in — every path that can reach the engine awaits it.
  function registerNetRoster(list) {
    nnRoster = list.map((e) => ({ name: e.name, file: e.file, state: 'unknown', why: '' }));
    game.importPersonalities(nnRoster.map((e) => ({
      name: e.name,
      weights: { kind: 'net', name: e.name, netId: e.name + '@shipped', net: null },
    })));
  }

  // The parameter label: the same fields as a trained net's FILE NAME
  // (games-W-L-phi-lambda), so what the menu shows and what sits in NNs/ are visibly the
  // same thing — plus the SEED, which the file name does not carry. The file name tells two
  // runs apart by its timestamp; in the roster there was nothing at all, and two nets of the
  // same recipe read as identical (they collided as "N80-L1-lrelu-100k-lam07" and were told
  // apart only by an import's "#2"). The seed is the thing that actually differs, so it is
  // the thing to show. An older file with no seed recorded prints no s-field rather than a 1.
  // Everything needed to reproduce a net, on one line, for the field beside the row-18 menu:
  //   N=800,000  H=80+80  phi=sigmoid  lambda=0.7  lr=0.01  s=1  W=32
  // H joins the hidden layers with + because they are STACKED, not multiplied: 80+80 is two
  // layers of 80, and the old 80x80 read like a matrix shape. W is the worker count, which
  // fixes perRound = workers x 8 and with it the whole self-play schedule — the same seed on
  // 32 workers and on 16 are two different runs. It is recorded from 8/31 on, so every net
  // trained before that honestly reads W=?. A star on the seed marks a net whose training was
  // CONTINUED: runSeed = seed ^ gamesBefore, so 200k continued to 800k is a different dice
  // stream from 800k in one go, and the bare seed would not say so.
  function netParamText(spec, games) {
    if (!spec) return '';
    const h = spec.hidden || [];
    return [
      'N=' + (games || 0).toLocaleString(),
      'H=' + (h.length ? h.join('+') : '0'),
      'φ=' + (spec.activation || '?'),
      'λ=' + (spec.lambda === undefined ? '?' : spec.lambda),
      'lr=' + (spec.lr === undefined ? '?' : spec.lr),
      's=' + (spec.seed === undefined ? '?' : spec.seed) + (spec.continued ? '*' : ''),
      'W=' + (spec.workers === undefined ? '?' : spec.workers),
    ].join(' ');
  }

  // Pull the spec out of the first few hundred bytes of a net file. The JSON begins
  //   {"kind":"bgnet","spec":{...},"trainedGames":N,"layers":[ ...
  // so everything the row-18 field needs is in the head; the 330 kB of weights is not touched.
  function headSpec(text) {
    const m = text.match(/"spec"\s*:\s*\{[^}]*\}/);
    if (!m) return null;
    const g = text.match(/"trainedGames"\s*:\s*(\d+)/);
    try { return { spec: JSON.parse('{' + m[0] + '}').spec, games: g ? +g[1] : 0 }; } catch (err) { return null; }
  }

  // Find out whether a net file is there AND what it is, without downloading it. A ranged GET
  // gives both; HEAD gives only the first. ⚠️ A server that ignores Range answers 200 with the
  // WHOLE file, which for nine nets would be the 3 MB the lazy loading exists to avoid — so the
  // range is tried on ONE file, and if it is not honoured the rest fall back to HEAD.
  async function probeNet(e, useRange) {
    try {
      // ⚠ The ranged probe MUST NOT share a cache key with ensureNetLoaded's full GET.
      // Measured 8/31 on the deployed site: after a 206 for this URL, GitHub Pages (Fastly)
      // answers the plain GET with status 200, the file's real Content-Length, and only the
      // 512 probed bytes of body -- so JSON.parse throws and a perfectly good net is marked
      // "not installed". Apache in front of XAMPP does not do it, which is why this only ever
      // bit on GitHub and never on localhost. HEAD does not poison a later GET (tested), so
      // only the ranged branch needs the extra key.
      const res = await fetch('NNs/' + e.file + nnStamp() + (useRange ? '&probe=1' : ''),
                              useRange ? { headers: { Range: 'bytes=0-511' } } : { method: 'HEAD' });
      if (!res.ok) { e.state = 'missing'; e.why = 'HTTP ' + res.status; return res.status; }
      if (res.status === 206) { const hd = headSpec(await res.text()); if (hd) { e.spec = hd.spec; e.games = hd.games; } return res.status; }
      if (res.status === 200 && useRange) {
        // The server ignored Range and sent the whole file. Keep it rather than throw it away:
        // this becomes an eager load of exactly ONE net, and the label then comes from the real
        // spec instead of a guess. (The other eight still fall back to HEAD — see the caller.)
        try {
          const net = BG_NET.loadNet(JSON.parse(await res.text()));
          const w = game.personalityWeights(e.name);
          if (w) { w.net = net; w.netId = e.name + '@' + (++netImportSeq); }
          e.state = 'ready';
          e.spec = net.spec; e.games = net.trainedGames;
        } catch (err) { /* leave it unloaded; first use will fetch it properly */ }
      }
      return res.status;
    } catch (err) {
      if (location.protocol === 'file:') { e.state = 'missing'; e.why = 'file:// cannot read local files'; }
      return 0;
    }
  }

  /** Fetch one shipped net if it is not already in memory. True when it is ready to play. */
  async function ensureNetLoaded(name) {
    const e = nnEntry(name);
    if (!e) return true;                       // an imported net is loaded by definition
    if (e.state === 'ready') return true;
    // Two attempts, and the retry is not paranoia: a CDN that has answered a ranged probe for
    // this file can serve the plain GET out of that partial entry (see probeNet), so the parse
    // fails on a file that is perfectly good. The probe now carries its own cache key, and
    // `cache: 'reload'` is the belt to that brace -- it bypasses the HTTP cache outright.
    const attempt = async (opts) => {
      const res = await fetch('NNs/' + e.file + nnStamp(), opts);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return BG_NET.loadNet(await res.json());
    };
    let net;
    try {
      net = await attempt(undefined);
    } catch (first) {
      try {
        net = await attempt({ cache: 'reload' });
        sysLog('[Nets] ' + name + ' failed once (' + ((first && first.message) || first)
               + ') and loaded on a cache-bypassing retry.');
      } catch (err) {
        e.state = 'missing';
        e.why = (err && err.message) || String(err);
        // Say so. A silent catch here reads on screen as "the file is not on the server", and
        // it also changes the Score column's units (see analysisBrainName).
        sysLog('[Nets] ' + name + ' could NOT be loaded — ' + e.why + '. It is shown as not '
               + 'installed; a human seat falls back to the AI-row brain for analysis.');
        buildNetToggles();
        return false;
      }
    }
    const w = game.personalityWeights(name);
    w.net = net;
    w.netId = name + '@' + (++netImportSeq);  // fresh id, so no worker can hold a stale one
    e.state = 'ready';
    e.spec = net.spec; e.games = net.trainedGames;     // the real thing, replacing the probe's head read
    // A seat may hold a COPY taken before the weights arrived (setPlayerAI spreads), so
    // re-seat anyone already sitting on this name.
    [1, 2].forEach((p) => { if (game.playerTypes[p] === 'ai' && game.aiNames[p] === name) game.setPlayerAI(p, name); });
    sysLog('[Nets] ' + name + ' loaded — ' + (net.spec.hidden || []).join('x') + ' ' + net.spec.activation
           + ', ' + (net.trainedGames || 0).toLocaleString() + ' games, '
           + BG_NET.netParamCount(net).toLocaleString() + ' parameters.');
    buildNetToggles();
    refreshNetSelect(nnBrainSel ? nnBrainSel.value : undefined);   // the label is known now
    syncNetSelectTitle();
    return true;
  }

  /** Load every net among `names` that a run needs. Returns the ones that could not load. */
  async function ensureNetsLoaded(names) {
    const bad = [];
    for (const n of names) {
      if (!game.isNetPersonality(n)) continue;
      if (!(await ensureNetLoaded(n))) bad.push(n);
    }
    return bad;
  }

  /** Why a net is unavailable, in words that say what to do about it. */
  function netMissingMessage(names) {
    const is = names.length === 1 ? 'is' : 'are';
    return names.join(', ') + ' ' + is + ' not installed — '
      + (location.protocol === 'file:'
          ? 'net files cannot be read from a file:// page; serve the app over http (XAMPP).'
          : 'no such file in NNs/ yet.');
  }

  // Read the manifest, probe what is there, then rebuild everything that lists brains.
  async function loadNetManifest() {
    try {
      const res = await fetch('NNs/manifest.json' + nnStamp());
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      if (!data || !Array.isArray(data.nets) || !data.nets.length) throw new Error('no nets listed');
      registerNetRoster(data.nets);
      // One ranged probe first: if the server honours it (206) every net can be labelled for
      // the price of a few hundred bytes each; if not, fall back to existence-only HEADs.
      const first = await probeNet(nnRoster[0], true);
      const ranged = (first === 206);
      await Promise.all(nnRoster.slice(1).map((e) => probeNet(e, ranged)));
      if (!ranged) sysLog('[Nets] the server did not honour a ranged request, so the menu can only '
                          + 'label a net once it has been loaded.');
      refreshAllBrainUI();
      preloadAnalysisNet();        // the analysis brain for a human seat — see Net Analysis
      const ready = nnRoster.filter((e) => e.state !== 'missing').length;
      sysLog('[Nets] roster: ' + nnNames().join(', ') + ' — ' + ready + ' of ' + nnRoster.length
             + ' installed; files load on first use.');
    } catch (err) {
      sysLog('[Nets] no roster (' + ((err && err.message) || err) + '). The net rows stay empty; '
             + 'imported nets still work.');
    }
  }


  function populatePlayerMenus() {
    const names = menuBrainNames();
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
        o.textContent = nnMissing(n) ? n + ' (not installed)' : n;
        if (nnMissing(n)) o.className = 'nn-missing';
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

  // The last value each seat actually accepted, so a refused change can be PUT BACK. A menu
  // naming a brain the game is not really using would be worse than the message.
  const lastSeat = { 1: document.getElementById('p1-type').value, 2: document.getElementById('p2-type').value };

  // Listen for live dropdown changes so players can swap Human/AI in/out mid-game. A shipped
  // net is fetched here, on the way in — this is the first moment its file is actually needed.
  async function seatChanged(player, sel) {
    const v = sel.value;
    if (v !== 'human' && game.isNetPersonality(v) && !(await ensureNetLoaded(v))) {
      const msg = netMissingMessage([v]);
      gameMessageEl.textContent = msg;
      sysLog('[Nets] seat refused — ' + msg);
      populatePlayerMenus();               // repaint so the entry now reads "(not installed)"
      sel.value = lastSeat[player];
      applyPlayerMenu(player);
      syncDepthMenu(player);
      return;
    }
    lastSeat[player] = v;
    applyPlayerMenu(player);
    syncDepthMenu(player);      // enable/disable that side's depth menu for AI/Human
    clearHistoryScoreCache();   // scoring AI may have changed
    sysLog('[System] ' + (player === 1 ? 'White' : 'Red') + ' player set to ' + v);
    updateUI(); // Refresh board so checkers instantly become draggable/un-draggable
    checkAndTriggerAITurn();
  }

  document.getElementById('p1-type').addEventListener('change', (e) => seatChanged(1, e.target));
  document.getElementById('p2-type').addEventListener('change', (e) => seatChanged(2, e.target));

  // ── AI parameter editor ───────────────────────────────────
  const editBrainSel  = document.getElementById('edit-brain');
  const brainParamsEl = document.getElementById('brain-params');
  const BRAIN_KEYS = ['PC', 'BO', 'EC1', 'EC0', 'HB', 'AN', 'DO', 'IO', 'DP', 'IP', 'DE', 'F0', 'F1', 'F2', 'F3', 'F4', 'F5', 'BE', 'G5', 'G7', 'G4', 'GA', 'DT', 'AT'];

  // ---- Net brains ------------------------------------------------------------
  // A net brain carries NO cube thresholds. DT/AT exist because a heuristic score has no
  // probabilistic meaning, so those had to be free parameters evolution could find; a net
  // predicts the outcome distribution, so its take point and doubling point are COMPUTED
  // from it (Janowski — see net.js and game.js's _netShouldDouble).
  const isNetScore = (W) => !!(W && W.kind === 'net');

  // A value from a brain, formatted in the brain's own units. The two are NEVER rescaled
  // into each other (the user's decision, 8/28), so the FORMAT is the only thing on screen
  // saying which you are reading: an integer in the +-1000 band from a linear brain, three
  // decimals of signed equity from a net.
  function fmtBrainValue(v, isNet) {
    if (isNet) return (v >= 0 ? '+' : '') + v.toFixed(3);
    if (v >= 1e8) return 'WIN';
    if (v <= -1e8) return 'LOSS';
    return String(Math.round(v));
  }

  // ONE convention for every probability the program shows: P(WHITE WINS), as a whole
  // number from 0 to 100, in WHITE's view wherever it appears — so 40 always means Red is
  // ahead, whoever happens to be on roll. Equity says by how much; this says how often.
  // Null when the brain is linear, which has no probabilities at all.
  function whiteWinPct(W, points, bar, borneOff, onRoll) {
    if (!isNetScore(W) || !W.net) return null;
    const p = BG_NET.evaluatePosition(W.net, points, bar, borneOff, onRoll).p;
    const d = (onRoll === 1) ? p : BG_NET.swapOutcomes(p);
    return Math.round(100 * (d[0] + d[1] + d[2]));
  }

  // The house colour rule for such a percentage: below 50 Red is ahead, so it is drawn red;
  // 50 and above is White's, drawn white. Applied to the ROUNDED number that is actually on
  // screen, so the colour and the digits can never contradict each other.
  const winPctColor = (pct) => (pct < 50 ? '#f87171' : '#ffffff');

  // Turn a parsed net file into a brain the roster can hold. The name is SYSTEMATIC
  // (N80-L1-lrelu-30k) because nets arrive in dozens and have to be told apart by what they
  // are; the LOTR names belong to the small, ordered, hand-curated linear roster. netId is
  // fresh on every import, so re-importing under a name a worker has already cached can
  // never leave that worker searching with the previous net.
  let netImportSeq = 0;
  function netBrainFromFile(obj) {
    const net = BG_NET.loadNet(obj);                 // throws with a reason a person can act on
    let name = (obj.name && String(obj.name).trim()) || BG_NET.netName(net);
    const taken = game.aiPersonalityNames();
    if (taken.includes(name)) { let k = 2; while (taken.includes(name + '#' + k)) k++; name += '#' + k; }
    return { name, weights: { kind: 'net', name, netId: name + '@' + (++netImportSeq), net } };
  }
  // Short hover reminders of what each evolvable weight means (shown as the field's tooltip).
  const BRAIN_TITLES = {
    PC:  'PC — pip count (the race); negative weight, so ahead-in-the-race is good',
    BO:  'BO — checkers borne off',
    EC1: 'EC1 — rolls with exactly one legal move (encumbrance; negative)',
    EC0: 'EC0 — rolls with no legal move (encumbrance; negative)',
    HB:  'HB — home-board points made (excludes the golden 4- and 5-points)',
    AN:  'AN — anchors in the opponent home (excludes the golden anchor; gated on being behind)',
    DO:  'DO — blot exposure: direct shots, far',
    IO:  'IO — blot exposure: indirect shots, far',
    DP:  'DP — blot exposure: direct shots, near',
    IP:  'IP — blot exposure: indirect shots, near',
    DE:  'DE — disengagement bonus: race away when ahead (move-selection only, not the static score)',
    F0:  'F0 — freedom/containment: sealed (entombed or closed out)',
    F1:  'F1 — freedom/containment: 1 of 6 die-values escapes the prime',
    F2:  'F2 — freedom/containment: 2 of 6 die-values escape',
    F3:  'F3 — freedom/containment: 3 of 6 die-values escape',
    F4:  'F4 — freedom/containment: 4 of 6 die-values escape',
    F5:  'F5 — freedom/containment: 5 of 6 escape (nearly free)',
    BE:  'BE — bar entombment: extra penalty per expected frozen turn for a checker on the bar',
    G5:  'G5 — the golden point (the 5-point), per-point made-point value',
    G7:  'G7 — the bar/7-point, per-point made-point value',
    G4:  'G4 — the 4-point, per-point made-point value',
    GA:  'GA — the golden anchor (opponent 5-point), held from behind; gated on being behind',
    DT:  'DT — doubling threshold: offer/redouble when own score exceeds DT',
    AT:  'AT — accept threshold: accept a double unless own score is below −AT',
  };

  // `prefer` (optional): select this brain if it exists — used by Import so the brain you just
  // brought in is the one showing in the editor menu and its weights fill the parameter fields.
  // Otherwise keep whatever was selected, falling back to the first entry.
  function refreshBrainSelect(prefer) {
    if (!editBrainSel) return;
    const prev = editBrainSel.value;
    editBrainSel.innerHTML = '';
    // Linear brains only. A net has no 24 weights to edit, nothing to Export as a parameter
    // set and nothing for Def to restore, so it belongs on its own row rather than here.
    game.aiPersonalityNames().filter((n) => !game.isNetPersonality(n)).forEach((n) => {
      const o = document.createElement('option');
      o.value = n; o.textContent = n;
      editBrainSel.appendChild(o);
    });
    const has = (v) => [...editBrainSel.options].some((o) => o.value === v);
    editBrainSel.value = (prefer && has(prefer)) ? prefer
      : (has(prev) ? prev : (editBrainSel.options[0] ? editBrainSel.options[0].value : ''));
  }

  function buildBrainParams() {
    if (!brainParamsEl) return;
    brainParamsEl.innerHTML = '';
    BRAIN_KEYS.forEach((k) => {
      const wrap = document.createElement('div');
      wrap.className = 'brain-param';
      const lab = document.createElement('label');
      lab.textContent = k; lab.htmlFor = 'bp-' + k;
      const tip = BRAIN_TITLES[k] || k;
      lab.title = tip;
      const inp = document.createElement('input');
      inp.type = 'number'; inp.id = 'bp-' + k;
      inp.title = tip;
      inp.addEventListener('change', () => {
        const name = editBrainSel.value;
        if (game.isNetPersonality(name)) return;   // a net has no linear weights to set
        game.setPersonalityWeight(name, k, parseInt(inp.value, 10) || 0);
        // If a seated player is this AI, refresh its live weights and M.
        [1, 2].forEach((p) => {
          if (game.playerTypes[p] === 'ai' && game.aiNames[p] === name) game.setPlayerAI(p, name);
        });
        // The move list's Score column is memoized per snapshot (`_score`) and computed with
        // `scoringWeights` — which, in a human-vs-human game, is THIS editor's brain. Editing a
        // weight must therefore invalidate it, or the column keeps showing the pre-edit numbers.
        // (MOV/PLAY/Move Table already read the fields live; this closes the same loop for the
        // history list.)
        clearHistoryScoreCache();
        renderHistoryList();
      });
      wrap.appendChild(lab); wrap.appendChild(inp);
      brainParamsEl.appendChild(wrap);
    });
  }

  function loadBrainParams() {
    if (!editBrainSel || !brainParamsEl) return;
    const name = editBrainSel.value;
    const w = game.personalityWeights(name);
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
  function refreshAllBrainUI(prefer) {
    refreshBrainSelect(prefer);
    loadBrainParams();
    buildTournamentToggles();
    buildNetToggles();
    refreshNetSelect(prefer);
    if (typeof syncNetSelectTitle === 'function') syncNetSelectTitle();
    populatePlayerMenus();
    syncPlayersFromMenus();
    // A roster change (Import, Def) can alter which brain scores the move list OR the weights of
    // the brain already doing it — either way the memoized snapshot scores are stale. Clearing
    // here covers every caller, so no future entry point can forget.
    clearHistoryScoreCache();
    renderHistoryList();
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
  // Validate ONE parsed personality. Returns a human-readable reason it is unusable, or null if
  // it is fine. The file is never executed (see installBrainsFromText), so this is the only thing
  // standing between a malformed download and a brain full of NaNs — a bad weight would silently
  // poison `evaluate` and every score derived from it, which is far harder to notice later than a
  // refused import now.
  function brainError(p) {
    if (!p || typeof p !== 'object' || Array.isArray(p)) return 'an entry is not an AI personality';
    if (typeof p.name !== 'string' || !p.name.trim())    return 'an entry has no name';
    const w = p.weights;
    if (!w || typeof w !== 'object' || Array.isArray(w)) return `"${p.name}" has no weights`;
    // A net brain has no 24 weights to check: net.js's loadNet already validated its shape,
    // its layer dimensions and every float in it before it got this far.
    if (w.kind === 'net') return null;
    const have    = Object.keys(w);
    const missing = BRAIN_KEYS.filter((k) => !(k in w));
    const extra   = have.filter((k) => !BRAIN_KEYS.includes(k));
    if (missing.length) {
      return `"${p.name}" has ${have.length} of ${BRAIN_KEYS.length} weights — missing ${missing.join(' ')}`;
    }
    if (extra.length) {
      return `"${p.name}" has unknown weight${extra.length === 1 ? '' : 's'} ${extra.join(' ')}`;
    }
    const bad = BRAIN_KEYS.filter((k) => typeof w[k] !== 'number' || !Number.isFinite(w[k]));
    if (bad.length) {
      return `"${p.name}": ${bad.join(' ')} ${bad.length === 1 ? 'is not a number' : 'are not numbers'}`;
    }
    return null;
  }

  // Parse + install one brain file's text. Shared by the IMPORT button and the sidebar drop
  // zone, so the two paths can never drift apart.
  //
  // The file is read as TEXT and never compiled or evaluated — running a downloaded .js would be
  // arbitrary code execution. Only the brace-delimited JSON span is used; the `const Name =`
  // wrapper, the header comments and the semicolon in an exported file are decoration.
  function installBrainsFromText(text) {
    let brains;
    try {
      // A real .json file parses as itself. ⚠️ This MUST come before the span extraction
      // below: a net file is full of "W":[ ... ] arrays, so the first-[-to-last-] match
      // swallows the whole file and then fails to parse — which silently refused every net
      // until a browser test caught it.
      const direct = JSON.parse(text);
      brains = Array.isArray(direct) ? direct : [direct];
    } catch (notJson) {
      // The WRAPPED form: an exported .js brain file is `const Name = { ... };` with header
      // comments, so only the brace/bracket span is JSON. The file is never executed — see
      // the comment above — so pulling the span out by hand is the whole parser.
      try {
        const arrM = text.match(/\[[\s\S]*\]/);          // array of personalities
        if (arrM) {
          brains = JSON.parse(arrM[0]);
        } else {
          const objM = text.match(/\{[\s\S]*\}/);        // or a single personality
          brains = objM ? [JSON.parse(objM[0])] : [];
        }
      } catch (err) {
        gameMessageEl.textContent = 'Could not read that personalities file.';
        return;
      }
    }
    if (!Array.isArray(brains) || !brains.length) {
      gameMessageEl.textContent = 'No AI personality found in that file.';
      return;
    }

    // A net file is a different shape (kind:'bgnet') with a different validator, so it is
    // converted to a brain here — one drop target takes either kind, the same principle as the
    // sidebar drop zone taking a brain file or a game record.
    try {
      brains = brains.map((b) => ((b && b.kind === 'bgnet') ? netBrainFromFile(b) : b));
    } catch (err) {
      const why = (err && err.message) || String(err);
      sysLog('[Import] rejected — ' + why);
      gameMessageEl.textContent = 'Net import rejected — ' + why + '.';
      return;
    }

    // ALL-OR-NOTHING: validate every entry BEFORE installing any of them, so a file with one bad
    // brain can't leave the roster half-updated. The first reason goes to the status line (which
    // holds three lines); every reason goes to the console log for a proper look.
    const errs = brains.map(brainError).filter(Boolean);
    if (errs.length) {
      errs.forEach((e) => sysLog(`[Import] rejected — ${e}`));
      gameMessageEl.textContent = `Import rejected — ${errs[0]}`
        + (errs.length > 1 ? ` (and ${errs.length - 1} more; see the console log)` : '') + '.';
      return;
    }

    game.importPersonalities(brains);
    // Show the imported brain straight away: select it in the editor menu (row 13), which makes
    // loadBrainParams fill the parameter fields (row 15) with ITS weights. With several in one
    // file, the first wins. Tournament selections are untouched.
    refreshAllBrainUI(brains[0].name);
    const n = brains.length;   // every entry validated, so parsed == installed
    gameMessageEl.textContent = `Imported ${n} AI personalit${n === 1 ? 'y' : 'ies'}: `
      + brains.map((p) => p.name).join(', ') + '.';
  }

  // Drag-and-drop has no label, so it can afford to take either kind of file and dispatch
  // on what the file actually is. The two BUTTONS stay single-purpose, so neither lies.
  function readImportFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = String(evt.target.result);
      if (looksLikeGameRecord(text)) loadGameRecord(text); else installBrainsFromText(text);
    };
    reader.onerror = () => { gameMessageEl.textContent = 'Could not read that file.'; };
    reader.readAsText(file);
  }

  // The AI editor's IMPORT does brains only — that row is about brains. Handed a game
  // record it says where the right button is instead of quietly doing the other thing.
  function readBrainFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = String(evt.target.result);
      if (looksLikeGameRecord(text)) {
        gameMessageEl.textContent = 'That is a game record — use the yellow IMPORT button under the move list.';
        sysLog('[Import] A game record was handed to the AI importer; use the move-list IMPORT button.');
        return;
      }
      installBrainsFromText(text);
    };
    reader.onerror = () => { gameMessageEl.textContent = 'Could not read that file.'; };
    reader.readAsText(file);
  }

  // Hidden picker behind the move-list IMPORT button (the keyboard / iPad route).
  const gameFileInput = document.createElement('input');
  gameFileInput.type = 'file';
  gameFileInput.accept = '.txt';
  gameFileInput.style.display = 'none';
  document.body.appendChild(gameFileInput);
  gameFileInput.addEventListener('change', (e) => { readImportFile(e.target.files[0]); e.target.value = ''; });
  document.getElementById('nav-import')?.addEventListener('click', () => gameFileInput.click());

  brainFileInput.addEventListener('change', (e) => {
    readBrainFile(e.target.files[0]);
    e.target.value = '';
  });
  document.getElementById('brain-import')?.addEventListener('click', () => brainFileInput.click());

  // ── Drag-and-drop import (sidebar) ───────────────────────────
  // Drop a champion file anywhere on the control column to import it — the fast path once you
  // already have the folder open. The IMPORT button stays: it's the keyboard/tablet route (iPad
  // has no drag-from-Finder gesture) and it's the visible affordance that hints dropping works.
  // The drop feeds readImportFile, which sniffs the text and hands a game record to
  // loadGameRecord and anything else to installBrainsFromText — one parse path each.
  //
  // Everything below is gated on the drag actually carrying FILES (`types` includes 'Files'), so
  // the board's checker drag-and-drop — which carries text, not files — is never intercepted.
  {
    const dropZone = document.querySelector('.sidebar-panel');
    const isFileDrag = (e) => {
      const t = e.dataTransfer && e.dataTransfer.types;
      return !!t && [...t].includes('Files');
    };
    let dragDepth = 0;   // dragenter/leave fire per child element; count instead of toggling.

    if (dropZone) {
      dropZone.addEventListener('dragenter', (e) => {
        if (!isFileDrag(e)) return;
        e.preventDefault();
        if (dragDepth++ === 0) dropZone.classList.add('brain-drop-active');
      });
      dropZone.addEventListener('dragover', (e) => {
        if (!isFileDrag(e)) return;
        e.preventDefault();                       // required, or 'drop' never fires
        e.dataTransfer.dropEffect = 'copy';
      });
      dropZone.addEventListener('dragleave', (e) => {
        if (!isFileDrag(e)) return;
        if (--dragDepth <= 0) { dragDepth = 0; dropZone.classList.remove('brain-drop-active'); }
      });
      dropZone.addEventListener('drop', (e) => {
        if (!isFileDrag(e)) return;
        e.preventDefault();
        dragDepth = 0;
        dropZone.classList.remove('brain-drop-active');
        const file = e.dataTransfer.files && e.dataTransfer.files[0];
        if (file) readImportFile(file);
      });
    }

    // Safety net: dropping a file ANYWHERE else in the window makes the browser navigate to it,
    // silently abandoning the game (and any live network match). Swallow file drops outside the
    // drop zone. Checker drags are untouched — they carry no files.
    window.addEventListener('dragover', (e) => { if (isFileDrag(e)) e.preventDefault(); });
    window.addEventListener('drop', (e) => {
      if (!isFileDrag(e)) return;
      if (dropZone && dropZone.contains(e.target)) return;   // handled above
      e.preventDefault();
      gameMessageEl.textContent = 'Drop an AI or game file on the control column (right side) to import it.';
    });
  }

  document.getElementById('brain-def')?.addEventListener('click', () => {
    game.resetPersonalities();
    refreshAllBrainUI();
    gameMessageEl.textContent = 'AI personalities reset to built-in values.';
  });

  // ── Tournament ────────────────────────────────────────────
  const tourneySelected  = new Set();
  // Names present at the LAST toggle-row build. Lets a rebuild tell "this brain was already here
  // and the user deselected it" from "this brain is new" — see buildTournamentToggles.
  let tourneyKnown       = new Set();
  let tourneyBuilt       = false;   // the first build picks the default field; later ones preserve it
  const tourneyTogglesEl = document.getElementById('tourney-toggles');
  let tournamentRunning  = false;
  let tournamentStop     = false;   // set by entering setup mode; halts a running tournament/compete

  // One letter toggle per personality (first initial). Everyone is selected by default.
  function buildTournamentToggles() {
    if (!tourneyTogglesEl) return;
    tourneyTogglesEl.innerHTML = '';
    // Roster order, exactly as the brain-editor and player menus list it — NOT re-sorted here.
    // Origin is already last in the AI_PERSONALITIES literal, and `importPersonalities` appends a
    // new brain after it, so an imported AI's letter lands at the END of this row, matching where
    // its name lands at the bottom of the menus. (This used to force Origin last, which pushed an
    // imported brain's letter to second-to-last — the one place the two orders disagreed.)
    const names = game.aiPersonalityNames().filter((n) => !game.isNetPersonality(n));
    // Rebuilds (import, Def) must NOT silently re-select everyone — that would discard a field the
    // user had narrowed by hand and quietly run the next tournament over the whole roster. Keep each
    // existing brain's current state; a brain we've never seen before joins selected (so a freshly
    // imported champion defaults to in).
    //
    // THE FIRST BUILD IS DIFFERENT: the default field is the best of each class, not everybody —
    // nine linear plus nine nets is 153 pairs against 36. "Best" is POSITIONAL, the first entry in
    // the row, which stays correct through every re-sort; hard-coding "Arwen" would select nothing
    // the day the roster is renamed.
    if (!tourneyBuilt) { if (names.length) tourneySelected.add(names[0]); tourneyBuilt = true; }
    else names.forEach((n) => { if (!tourneyKnown.has(n)) tourneySelected.add(n); });
    // Drop brains that no longer exist (e.g. Def discarded the imports) so the set can't leak.
    [...tourneySelected].forEach((n) => { if (!game.isNetPersonality(n) && !names.includes(n)) tourneySelected.delete(n); });
    tourneyKnown = new Set(names);
    names.forEach((n) => {
      const b = document.createElement('button');
      b.className = tourneySelected.has(n) ? 'tourney-toggle sel' : 'tourney-toggle';
      b.textContent = n.charAt(0).toUpperCase();
      b.title = n;
      b.addEventListener('click', () => {
        if (tourneySelected.has(n)) { tourneySelected.delete(n); b.classList.remove('sel'); }
        else { tourneySelected.add(n); b.classList.add('sel'); }
      });
      tourneyTogglesEl.appendChild(b);
    });
  }
  buildTournamentToggles();

  // ---- Row 17: the net participants ------------------------------------------
  // A separate row with its own all/none, because the two classes are selected apart: a
  // full 18-brain round robin is 153 pairs against 36, i.e. days rather than hours. The
  // letters are lower-cased in CSS rather than by the names, so an imported net still
  // reads as lower case here.
  const nnTogglesEl = document.getElementById('nn-toggles');
  let nnKnown = new Set();
  let nnBuilt = false;

  function netRosterNames() { return menuBrainNames().filter((n) => game.isNetPersonality(n)); }

  function buildNetToggles() {
    if (!nnTogglesEl) return;
    nnTogglesEl.innerHTML = '';
    const names = netRosterNames();
    if (!nnBuilt && names.length) {
      // Default to the best INSTALLED net, so a copy with no net files yet simply runs the
      // linear best alone instead of failing on the first press of Tournament.
      const first = names.find((n) => !nnMissing(n));
      if (first) tourneySelected.add(first);
      nnBuilt = true;
    } else {
      names.forEach((n) => { if (!nnKnown.has(n)) tourneySelected.add(n); });
    }
    [...tourneySelected].forEach((n) => { if (game.isNetPersonality(n) && !names.includes(n)) tourneySelected.delete(n); });
    nnKnown = new Set(names);
    names.forEach((n) => {
      const b = document.createElement('button');
      b.className = 'tourney-toggle' + (tourneySelected.has(n) ? ' sel' : '') + (nnMissing(n) ? ' nn-missing' : '');
      b.textContent = n.charAt(0);
      b.title = nnMissing(n) ? n + ' — not installed' : n;
      b.addEventListener('click', () => {
        if (tourneySelected.has(n)) { tourneySelected.delete(n); b.classList.remove('sel'); }
        else { tourneySelected.add(n); b.classList.add('sel'); }
      });
      nnTogglesEl.appendChild(b);
    });
  }
  buildNetToggles();

  // ---- Row 18: which net LEARN acts on, and importing one ---------------------
  const nnBrainSel = document.getElementById('nn-brain');
  // Roster entries know their label from the probe; an imported or freshly trained net is
  // already in memory, so it can be asked directly.
  //
  // A net carrying its SYSTEMATIC name (N80-L1-lrelu-30k) already announces its architecture,
  // so it gets no suffix — the label is for the curated mythological names, which say nothing
  // about what is inside them. "N20-L1-lrelu-40-lam07  40-20-1-1-07" helps nobody.
  // The parameter line for a net by NAME, from its loaded weights when they are here and
  // from the probe's head read when they are not — so the field is filled before a net has
  // been touched, exactly like the menu itself.
  function netSpecAndGames(name) {
    const w = game.personalityWeights(name);
    if (w && w.net) return { spec: w.net.spec, games: w.net.trainedGames || 0 };
    const e = nnEntry(name);
    return (e && e.spec) ? { spec: e.spec, games: e.games || 0 } : null;
  }

  function netParamTextFor(name) {
    const sg = netSpecAndGames(name);
    return sg ? netParamText(sg.spec, sg.games) : '';
  }

  // A net carrying a SYSTEMATIC name (N80x80-L2-sigmoid-800k-lam07 — what a freshly trained
  // or imported net gets) now says the same thing as the field beside the menu, twice and
  // less legibly. Such a net shows as NN, numbered from the second one on so that no two
  // menu entries can read alike. A roster net keeps its own name.
  function isSystematicNetName(name) {
    const w = game.personalityWeights(name);
    return !!(w && w.net && name.replace(/#\d+$/, '') === BG_NET.netName(w.net));
  }

  function refreshNetSelect(prefer) {
    if (!nnBrainSel) return;
    const prev = nnBrainSel.value;
    nnBrainSel.innerHTML = '';
    let nnSeq = 0;
    netRosterNames().forEach((n) => {
      const o = document.createElement('option');
      o.value = n;
      const label = isSystematicNetName(n) ? (++nnSeq === 1 ? 'NN' : 'NN-' + nnSeq) : n;
      o.textContent = nnMissing(n) ? label + ' (not installed)' : label;
      if (nnMissing(n)) o.className = 'nn-missing';
      nnBrainSel.appendChild(o);
    });
    const has = (v) => [...nnBrainSel.options].some((o) => o.value === v);
    nnBrainSel.value = (prefer && has(prefer)) ? prefer
      : (has(prev) ? prev : (nnBrainSel.options[0] ? nnBrainSel.options[0].value : ''));
    syncNetParams();
  }

  // Row 19's fields hold the RECIPE OF THE NET SELECTED IN ROW 18, and follow the selection:
  // pick a net, change one field, press LEARN, and what comes out is that net with one thing
  // different. Applied only when the SELECTION ITSELF changes, so a number typed by hand
  // survives every other rebuild of this menu — and never during a run.
  //   ⚠️ Reached through getElementById, not through `learnEl`: this runs during the FIRST
  //   render and `learnEl` — like `learnRunning` — is declared several hundred lines further
  //   down, inside its dead zone. "A run is going" is therefore read off the DOM (the games
  //   field is disabled only while training) rather than from `learnRunning`. What makes the
  //   tail of this function safe is that nothing below can be reached until a net SPEC exists,
  //   and the roster is read by setTimeout(loadNetManifest, 0) — after the whole closure body.
  let learnDefaultsFor = null;
  function syncLearnDefaults() {
    const name = nnBrainSel ? nnBrainSel.value : '';
    if (!name || name === learnDefaultsFor) return;
    const gamesEl = document.getElementById('learn-games');
    if (!gamesEl || gamesEl.disabled) return;      // a run is in progress; leave its fields alone
    const sg = netSpecAndGames(name);
    if (!sg) return;                        // nothing known about it yet; a later call will
    learnDefaultsFor = name;
    const spec = sg.spec, h = spec.hidden || [];
    const el = (id) => document.getElementById(id);
    const put = (id, v) => { const x = el(id); if (x && v !== undefined && v !== null) x.value = String(v); };
    // A menu can only offer what it lists. Say so rather than silently showing the wrong
    // recipe for a net whose shape this row cannot express.
    const putChoice = (id, v, what) => {
      const x = el(id);
      if (!x || v === undefined || v === null) return;
      if ([...x.options].some((o) => o.value === String(v))) x.value = String(v);
      else sysLog('[Learn] ' + name + ' has ' + what + ' ' + v + ', which this row cannot offer — left as '
                  + x.value + '. Training from these fields will NOT reproduce it.');
    };
    put('learn-games', sg.games);
    put('learn-width', h[0]);
    putChoice('learn-layers', h.length, 'depth');
    putChoice('learn-phi', spec.activation, 'activation');
    put('learn-lambda', spec.lambda);
    put('learn-seed', spec.seed);
    if (h.length && !h.every((v) => v === h[0])) {
      sysLog('[Learn] ' + name + ' has uneven hidden layers (' + h.join('+') + '); the width field says '
             + h[0] + ' and one number cannot say more.');
    }
    syncLearnControls();                    // identity dims the depth menu; continue mode locks
  }

  // The read-only parameter field beside the menu. One writer, called from everywhere the
  // selection or a net's contents can change, so the field cannot drift from the menu.
  function syncNetParams() {
    syncLearnDefaults();
    const el = document.getElementById('nn-params');
    if (!el) return;
    const name = nnBrainSel ? nnBrainSel.value : '';
    const txt = name ? netParamTextFor(name) : '';
    el.value = txt;
    el.title = txt ? name + ' — ' + txt
                   + '\nN games, H hidden layers, φ activation, λ trace decay, lr learning rate, '
                   + 's training seed, W workers (the seed reproduces a run only at the same worker count).'
                   + (/\*/.test(txt) ? '\nThe star marks a net whose training was continued: the seed describes only its first run.' : '')
                   : 'Parameters of the selected net.';
  }
  /** One line describing a net, for the row-18 tooltip and the status line. */
  function netDescription(name) {
    const w = game.personalityWeights(name);
    if (!isNetScore(w)) return name;
    const e = nnEntry(name);
    if (e && e.state === 'missing') return name + ' — not installed (' + (e.why || 'no file') + ')';
    if (!w.net) return name + ' — a net brain; its weights load on first use.';
    const n = w.net;
    return name + ' — ' + ((n.spec.hidden || []).join('+') || 'no') + ' hidden, ' + n.spec.activation
      + (n.spec.lambda !== undefined ? ', lambda ' + n.spec.lambda : '')
      + ', ' + (n.trainedGames || 0).toLocaleString() + ' self-play games, '
      + BG_NET.netParamCount(n).toLocaleString() + ' parameters. Scores in equity; cube by Janowski.';
  }

  function syncNetSelectTitle() {
    if (nnBrainSel && nnBrainSel.value) nnBrainSel.title = netDescription(nnBrainSel.value);
    syncNetParams();
  }

  refreshNetSelect();
  // With Net Analysis ON the row-18 net scores a human's play, but a listed net's weights
  // arrive lazily — fetch the selected one as soon as the roster is known, so the Score
  // column is in equity from the first move instead of falling back to the row-13 brain
  // (different units) until the menu is touched. Called from loadNetManifest, because
  // before the manifest arrives there is no roster and this menu is still empty.
  async function preloadAnalysisNet() {
    const name = nnBrainSel && nnBrainSel.value;
    if (!netAnalysisOn || !name || nnMissing(name)) return;
    await ensureNetLoaded(name);
    clearHistoryScoreCache();
    renderHistoryList();
  }
  nnBrainSel?.addEventListener('change', async () => {
    const name = nnBrainSel.value;
    if (name && !nnMissing(name)) await ensureNetLoaded(name);   // so the description is real
    syncNetSelectTitle();
    gameMessageEl.textContent = netDescription(name);
    // This menu is also the analysis brain for a human seat, so the Score column moves with it.
    if (netAnalysisOn) { clearHistoryScoreCache(); renderHistoryList(); }
  });

  // Import is brains-only on row 13 and nets-only here, so neither button can lie about
  // what it does. Both land in installBrainsFromText, which dispatches on the file.
  const netFileInput = document.createElement('input');
  netFileInput.type = 'file';
  netFileInput.accept = '.json';
  netFileInput.style.display = 'none';
  document.body.appendChild(netFileInput);
  document.getElementById('nn-import')?.addEventListener('click', () => { netFileInput.value = ''; netFileInput.click(); });
  netFileInput.addEventListener('change', () => {
    const f = netFileInput.files && netFileInput.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (evt) => installBrainsFromText(String(evt.target.result));
    reader.onerror = () => { gameMessageEl.textContent = 'Could not read that file.'; };
    reader.readAsText(f);
  });

  document.getElementById('nn-all')?.addEventListener('click', () => {
    netRosterNames().forEach((n) => tourneySelected.add(n));
    [...nnTogglesEl.children].forEach((b) => b.classList.add('sel'));
  });
  document.getElementById('nn-none')?.addEventListener('click', () => {
    netRosterNames().forEach((n) => tourneySelected.delete(n));
    [...nnTogglesEl.children].forEach((b) => b.classList.remove('sel'));
  });

  // ---- Row 19: LEARN ---------------------------------------------------------
  // Training in the browser, because a player of the deployed game has no command line.
  // The generation runs on the same worker pool the search uses; the LEARNING stays on this
  // thread, in game order, exactly as net-train.js does it — net-selfplay.js is the single
  // copy of both, shared by this file, the Node trainer and the worker.
  //
  // ⚠️ THERE IS NO LEARNING-RATE CONTROL, deliberately. 0.01 is the only value with evidence
  // behind it (0.05 was measured walking backwards), and an invisible knob cannot be
  // misdiagnosed. What a bad run gets instead is the smoke alarm below: a loss TREND over
  // twenty rounds and a collapse in output variance are the only two failure modes ever seen
  // here, and both are visible in numbers the run already computes. Both thresholds are
  // measured against real runs rather than chosen — see the alarm itself.
  const LEARN_LR = 0.01;
  let learnRunning = false, learnStop = false;

  const learnEl = {
    btn:    document.getElementById('btn-learn'),
    from:   document.getElementById('learn-from'),
    games:  document.getElementById('learn-games'),
    width:  document.getElementById('learn-width'),
    layers: document.getElementById('learn-layers'),
    phi:    document.getElementById('learn-phi'),
    lambda: document.getElementById('learn-lambda'),
    seed:   document.getElementById('learn-seed'),
  };

  // In CONTINUE mode the architecture is fixed by the net being continued, so the controls
  // that describe it are locked rather than left to imply otherwise. Lambda locks too (the
  // user's call); Node keeps --lambda if that experiment is ever wanted.
  function syncLearnControls() {
    const cont = learnEl.from && learnEl.from.value === 'continue';
    [learnEl.width, learnEl.layers, learnEl.phi, learnEl.lambda, learnEl.seed].forEach((el) => {
      if (!el) return;
      el.disabled = cont || learnRunning;
      el.style.opacity = el.disabled ? '0.5' : '';
    });
    // Depth is meaningless for the identity activation: a composition of affine maps is
    // affine, so an identity net of any depth IS one 196->6 linear map. Say so by dimming.
    if (!cont && learnEl.phi && learnEl.layers && learnEl.phi.value === 'identity') {
      learnEl.layers.disabled = true; learnEl.layers.style.opacity = '0.5';
      learnEl.layers.title = 'Depth has no meaning with the identity activation: any number of '
        + 'affine layers collapses to one linear map (this is the linear control, not a brain).';
    } else if (learnEl.layers && !cont && !learnRunning) {
      learnEl.layers.title = 'Number of hidden layers (L)';
    }
    if (learnEl.games) learnEl.games.disabled = learnRunning;
    if (learnEl.from)  learnEl.from.disabled  = learnRunning;
  }
  learnEl.from?.addEventListener('change', syncLearnControls);
  learnEl.phi?.addEventListener('change', syncLearnControls);
  syncLearnControls();

  /** Generate `seeds.length` games with a frozen net — on the pool if there is one. */
  async function learnGenerate(net, seeds) {
    if (!workersAvailable || numWorkers < 1) {
      return seeds.map((s) => BG_SELFPLAY.playSelfPlayGame(net, s));
    }
    const share = Math.ceil(seeds.length / numWorkers);
    const parts = [];
    for (let i = 0; i < numWorkers; i++) {
      const ss = seeds.slice(i * share, (i + 1) * share);
      if (ss.length) parts.push(ss);
    }
    const payload = { spec: net.spec, layers: net.layers.map((L) => ({ nIn: L.nIn, nOut: L.nOut, W: L.W, b: L.b })) };
    const out = new Array(parts.length);
    await runJobsParallel(
      parts,
      (ss, i) => ({ cmd: 'selfplay', id: i, spec: payload.spec, layers: payload.layers, seeds: ss }),
      (data, ss, i) => { out[i] = data.games; },
    );
    return out.flat();           // seed order, so the LEARNING order is unchanged
  }

  /** Put a freshly trained net into the roster and select it, ready to play at once. */
  function installTrainedNet(net) {
    let name = BG_NET.netName(net);
    const taken = game.aiPersonalityNames();
    if (taken.includes(name)) { let k = 2; while (taken.includes(name + '#' + k)) k++; name += '#' + k; }
    game.importPersonalities([{ name, weights: { kind: 'net', name, netId: name + '@' + (++netImportSeq), net } }]);
    refreshAllBrainUI();
    refreshNetSelect(name);
    syncNetSelectTitle();
    return name;
  }

  /** The file name the user asked for: NN-<games>-<W>-<L>-<phi index>-<lambda>-<stamp>.json */
  function learnFileName(net, games) {
    const d = new Date(), p = (v) => String(v).padStart(2, '0');
    const stamp = d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes());
    const ai = BG_NET.ACTIVATION_ORDER.indexOf(net.spec.activation) + 1;
    const lam = String(net.spec.lambda === undefined ? '' : net.spec.lambda).replace('.', '');
    // A timestamp, not a version number: a page cannot see the user's disk, so it cannot
    // count existing files. This never collides and sorts chronologically.
    return 'NN-' + games + '-' + (net.spec.hidden || [])[0] + '-' + (net.spec.hidden || []).length
         + '-' + ai + '-' + lam + '-' + stamp + '.json';
  }

  function setLearnButton(running) {
    if (!learnEl.btn) return;
    learnEl.btn.textContent = running ? 'Stop L' : 'LEARN';
    learnEl.btn.style.background = running ? '#991b1b' : '';
  }

  async function runLearn() {
    if (tournamentRunning) { gameMessageEl.textContent = 'Wait for the tournament to finish.'; return; }
    if (evolveRunning)     { gameMessageEl.textContent = 'Stop evolution before training.'; return; }

    const GAMES = Math.max(1, parseInt(learnEl.games.value, 10) || 1);
    const cont  = learnEl.from.value === 'continue';
    let net, fromName = '';
    if (cont) {
      fromName = nnBrainSel ? nnBrainSel.value : '';
      if (!fromName) { gameMessageEl.textContent = 'Select a net brain to continue training.'; return; }
      if (!(await ensureNetLoaded(fromName))) { gameMessageEl.textContent = netMissingMessage([fromName]); return; }
      const src = game.personalityWeights(fromName).net;
      net = BG_NET.createNet(src.spec);
      net.spec.lambda = src.spec.lambda; net.spec.lr = src.spec.lr;
      net.spec.continued = true;
      // Two legs run at different worker counts have no single W, and saying 32 would be a
      // lie about half the games. Say so instead.
      const wNow = workersAvailable ? numWorkers : 1;
      net.spec.workers = (src.spec.workers === undefined || src.spec.workers === wNow) ? wNow : 'mixed';
      src.layers.forEach((L, i) => { net.layers[i].W.set(L.W); net.layers[i].b.set(L.b); });
      net.trainedGames = src.trainedGames || 0;
    } else {
      const W = Math.max(1, parseInt(learnEl.width.value, 10) || 80);
      const L = Math.max(1, parseInt(learnEl.layers.value, 10) || 1);
      const lam = Math.min(1, Math.max(0, parseFloat(learnEl.lambda.value)));
      if (!Number.isFinite(lam)) { gameMessageEl.textContent = 'Lambda must be a number between 0 and 1.'; return; }
      // The seed is LEFT BLANK by default and generated, so an ordinary run still costs the
      // user no decision, and it is recorded in the spec either way. Typing one buys the two
      // things the browser could not do before: a run that can be reproduced exactly, and two
      // runs that differ ONLY in the variable under test — the seed fixes both the initial
      // weights and the entire self-play dice sequence, so holding it fixed across arms
      // removes the largest nuisance term. (An 8/29 tournament put two nets of the SAME
      // recipe, differing only in seed, three ranks apart.)
      // ⚠️ It reproduces only at the same WORKERS COUNT: perRound = workers x 8 is the
      // staleness boundary, so the same seed on 32 workers and on 16 is two different runs.
      // An unreadable seed is REFUSED rather than quietly replaced by a random one — a knob
      // that silently ignores you is the same failure mode as an invisible one.
      const seedTxt = learnEl.seed ? String(learnEl.seed.value).trim() : '';
      let useSeed;
      if (seedTxt === '') {
        useSeed = (Math.random() * 0x7fffffff) | 0;
      } else {
        const v = Number(seedTxt);
        if (!Number.isInteger(v) || v < 0 || v > 0x7fffffff) {
          gameMessageEl.textContent = 'Seed must be a whole number from 0 to 2147483647, or blank for a random one.';
          return;
        }
        useSeed = v;
      }
      net = BG_NET.createNet({ hidden: new Array(L).fill(W), activation: learnEl.phi.value,
                               seed: useSeed });
      net.spec.lambda = lam;
      net.spec.lr = LEARN_LR;
      net.spec.workers = workersAvailable ? numWorkers : 1;
    }
    const LAM = net.spec.lambda === undefined ? 0.7 : net.spec.lambda;
    const before = net.trainedGames || 0;
    const runSeed = (net.spec.seed || 1) ^ before;

    learnRunning = true; learnStop = false;
    setLearnButton(true); syncLearnControls();
    sysLog('[Learn] start — ' + (cont ? 'continuing ' + fromName + ' at ' + before.toLocaleString() + ' games' : 'new net')
           + ', ' + GAMES.toLocaleString() + ' games, [' + (net.spec.hidden || []).join(',') + '] '
           + net.spec.activation + ', lambda ' + LAM + ', lr ' + LEARN_LR + ', seed ' + net.spec.seed
           + ', ' + (workersAvailable ? numWorkers + ' workers' : 'single thread') + '.');

    const grads = BG_NET.createGrads(net);
    // The round is sized by BANDWIDTH, not by any worry about staleness: the weights are
    // broadcast to every worker each round, so one game per round would spend more time
    // copying than playing. 8 per worker puts a round at a fraction of a percent of a real run.
    const perRound = Math.max(1, (workersAvailable ? numWorkers : 1) * 8);
    const t0 = Date.now();
    let doneN = 0, lossSum = 0, lossN = 0, pwinSum = 0, pwinSq = 0, warned = '';
    // The smoke alarm compares two consecutive blocks of rounds; see it below for why.
    const LOSS_BLOCK = 10;
    const lossHist = [];

    try {
      while (doneN < GAMES && !learnStop) {
        const k = Math.min(perRound, GAMES - doneN);
        const seeds = [];
        for (let i = 0; i < k; i++) seeds.push(BG_SELFPLAY.gameSeed(runSeed, before + doneN + i));
        const played = await learnGenerate(net, seeds);
        for (const g of played) {
          const st = BG_SELFPLAY.learnFromGame(net, grads, g, LAM, LEARN_LR);
          lossSum += st.lossSum; lossN += st.n; pwinSum += st.pwinSum; pwinSq += st.pwinSq;
          doneN++;
          if ((doneN % 16) === 0) await breathe();     // keep the page alive during the learn pass
        }
        const mean = pwinSum / lossN, varP = pwinSq / lossN - mean * mean;
        const loss = lossSum / lossN;
        const secs = (Date.now() - t0) / 1000;
        const rate = doneN / secs;
        // The smoke alarm. MEASURED 8/29 against two complete runs — a healthy 200,000-game
        // run in this browser, and a deliberately diverging one (Monte-Carlo targets at
        // lr 0.05, the documented failure) — because the rule it replaces was set by guess.
        //  - THE OLD RULE (this round's loss above the previous round's by 5%) fired on
        //    24.5% of the rounds of the HEALTHY run, evenly across every decile. A round is
        //    only 256 games and the median round-to-round change in loss is 4.87%, so the
        //    threshold sat almost exactly on the median of the noise it was measuring: a
        //    coin flip, which taught the console to be ignored for 782 rounds.
        //  - THE SIGNAL LIVES EARLY, which is the reverse of what the old note assumed.
        //    Over the first 20 rounds the healthy run's loss FELL 8.5% block-on-block while
        //    the diverging run's ROSE 22%. Past ~5,000 games the two are indistinguishable
        //    on loss, so a late rise carries no information and the old 5,000-game gate was
        //    suppressing the only window that did.
        // Hence: the mean of the last 10 rounds against the mean of the 10 before, at +5%.
        // Measured 5 false alarms in 762 healthy rounds (0.7%), and it fires on the diverging
        // run at ~5,000 games — early enough to abandon it. Needing 20 rounds to arm IS the
        // old 5,000-game gate at the default round size, so that gate is gone from here; it
        // stays on the variance alarm, which is a level test and does need the net past its
        // base-rate phase.
        // ⚠️ Loss is a WEAK instrument even so. It is cross-entropy against a lambda-return
        // the net generates itself, so its level is not comparable across lambda and its
        // floor is the position's own outcome entropy — the healthy run flattened at ~0.94
        // from 120,000 games while the net was still improving. Only a strength probe
        // against a fixed baseline would be a real progress measure.
        lossHist.push(loss);
        if (lossHist.length > 2 * LOSS_BLOCK) lossHist.shift();
        warned = '';
        if (lossHist.length === 2 * LOSS_BLOCK) {
          let prior = 0, recent = 0;
          for (let i = 0; i < LOSS_BLOCK; i++) { prior += lossHist[i]; recent += lossHist[i + LOSS_BLOCK]; }
          if (recent > prior * 1.05) warned = '  !! loss trending up over ' + (2 * LOSS_BLOCK) + ' rounds — lr may be too high';
        }
        if (!warned && varP < 0.01 && before + doneN >= 5000) warned = '  !! output variance collapsed';
        gameMessageEl.textContent = 'Learn: ' + doneN.toLocaleString() + '/' + GAMES.toLocaleString() + ' games'
          + ' · ' + rate.toFixed(0) + ' g/s · loss ' + loss.toFixed(4) + ' · var ' + varP.toFixed(4)
          + etaSuffix(doneN, GAMES, Date.now() - t0) + warned;
        if (warned) sysLog('[Learn] ' + doneN + ' games —' + warned);
        lossSum = 0; lossN = 0; pwinSum = 0; pwinSq = 0;
      }
    } catch (err) {
      sysLog('[Learn] failed — ' + ((err && err.message) || err));
      gameMessageEl.textContent = 'Training failed: ' + ((err && err.message) || err);
      learnRunning = false; setLearnButton(false); syncLearnControls();
      return;
    }

    net.trainedGames = before + doneN;
    const name = installTrainedNet(net);
    const file = learnFileName(net, net.trainedGames);
    downloadText(file, JSON.stringify({ kind: 'bgnet', spec: net.spec, trainedGames: net.trainedGames,
      layers: net.layers.map((L) => ({ nIn: L.nIn, nOut: L.nOut, W: Array.from(L.W), b: Array.from(L.b) })) }),
      'application/json');
    const secs = ((Date.now() - t0) / 1000).toFixed(0);
    gameMessageEl.textContent = (learnStop ? 'LEARN stopped at ' : 'LEARN finished — ')
      + doneN.toLocaleString() + ' games in ' + secs + 's. Saved ' + file
      + ' and added ' + name + ' to the roster, ready to play.';
    sysLog('[Learn] done — ' + name + ', ' + net.trainedGames.toLocaleString() + ' games total, ' + secs + 's; downloaded ' + file + '.');
    learnRunning = false; setLearnButton(false); syncLearnControls();
  }

  learnEl.btn?.addEventListener('click', () => {
    if (learnRunning) { learnStop = true; gameMessageEl.textContent = 'Stopping after this round...'; return; }
    runLearn();
  });

  // Read the manifest once the WHOLE closure body has run. It needs WORKER_SRC for the
  // cache-buster, and that is declared further down with the worker pool — calling it here
  // directly puts WORKER_SRC in its temporal dead zone, which the try/catch then reports as
  // "no roster" rather than as the load-order bug it is.
  setTimeout(loadNetManifest, 0);

  document.getElementById('tourney-all')?.addEventListener('click', () => {
    game.aiPersonalityNames().filter((n) => !game.isNetPersonality(n)).forEach((n) => tourneySelected.add(n));
    [...tourneyTogglesEl.children].forEach((b) => b.classList.add('sel'));
  });
  document.getElementById('tourney-none')?.addEventListener('click', () => {
    game.aiPersonalityNames().filter((n) => !game.isNetPersonality(n)).forEach((n) => tourneySelected.delete(n));
    [...tourneyTogglesEl.children].forEach((b) => b.classList.remove('sel'));
  });
  document.getElementById('btn-run-tournament')?.addEventListener('click', () => {
    if (evolveRunning) { gameMessageEl.textContent = 'Stop evolution before running a tournament.'; return; }
    if (learnRunning)  { gameMessageEl.textContent = 'Stop training before running a tournament.'; return; }
    if (!tournamentRunning) runTournament();
  });
  document.getElementById('btn-compete')?.addEventListener('click', () => {
    if (evolveRunning) { gameMessageEl.textContent = 'Stop evolution before running Compete.'; return; }
    if (learnRunning)  { gameMessageEl.textContent = 'Stop training before running Compete.'; return; }
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

  // AI lookahead depth for EVOLUTION, from the D menu on the Evolve row. The
  // tournament used to share this control, which is why it sat on the wrong row;
  // it now has its own (tournamentDepth below) and the two act independently.
  // 1 = one-ply static baseline.
  function lookaheadDepth() {
    const el = document.getElementById('batch-depth');
    let d = el ? parseInt(el.value, 10) : 1;
    if (isNaN(d) || d < 0) d = 1;          // 0 is valid (play first legal move)
    return d;
  }

  // Lookahead depth for the TOURNAMENT, from its own row. Compete is deliberately not
  // covered: it takes a depth per seat from the player rows, which is what lets one
  // brain play itself at two depths.
  function tournamentDepth() {
    const el = document.getElementById('tourney-depth');
    let d = el ? parseInt(el.value, 10) : 1;
    if (isNaN(d) || d < 0) d = 1;
    return d;
  }

  // Doubling for batch runs: 'none' | 'money' | 'match'. THE ROW MENU IS AUTHORITATIVE
  // FOR BATCH; the Settings Doubling toggle governs interactive play only, so the two
  // cannot contradict each other. 'none' kills the cube at ANY match length — before
  // this the only route to cubeless play was X = 1, which welded the cube to the match
  // length and made a cubeless match to 11 impossible.
  function cubeMode() {
    const el = document.getElementById('tourney-cube');
    const v = el ? el.value : 'money';
    return (v === 'none' || v === 'match') ? v : 'money';
  }
  function batchCubeOff() { return cubeMode() === 'none'; }

  // ---- shared progress + ETA, so the four status lines cannot drift apart ----
  // Coarse on purpose: never advertise precision the estimate does not have.
  function coarseTime(ms) {
    if (!isFinite(ms) || ms < 0) return '?';
    const s = ms / 1000;            if (s < 90) return Math.round(s) + 's';
    const m = s / 60;               if (m < 90) return Math.round(m) + ' min';
    const h = m / 60;               if (h < 36) return h.toFixed(1) + ' h';
    return (h / 24).toFixed(1) + ' days';
  }
  // Shown from the FIRST completed unit and deliberately NOT suppressed during warm-up:
  // a wild number in the first seconds is exactly what tells you the run you just
  // launched is days rather than minutes, which is while you can still stop it.
  function etaSuffix(done, total, msElapsed) {
    if (done <= 0 || total <= done) return '';
    return ' · ETA ~' + coarseTime((msElapsed / done) * (total - done));
  }
  // For a job with no meaningful end. Evolve gets this instead of an ETA: its
  // generation cap is a number you do not intend to reach, so "time to completion"
  // would estimate the arrival of something nobody is waiting for.
  function elapsedSuffix(msElapsed) { return ' · ' + coarseTime(msElapsed) + ' elapsed'; }

  // Matches per pair (tournament) / matches in the run (Compete), from #tourney-games.
  // With DUPLO on this is forced EVEN and the field is corrected in place — an odd
  // match would have no mirror, so its dice luck would not cancel.
  function batchMatches(deflt) {
    const el = document.getElementById('tourney-games');
    let n = Math.max(1, parseInt(el ? el.value : '', 10) || deflt);
    if (duploOn && n % 2 === 1) { n += 1; if (el) el.value = n; }
    return n;
  }

  // A fresh base seed per run, so two runs of the same job are not identical; pairs
  // within a run are separated by the same avalanche mix game.js uses per game.
  function duploBaseSeed() { return (Math.random() * 0x100000000) >>> 0; }
  function duploPairSeed(base, pairIndex) { return bgGameSeed(base, pairIndex); }

  // Cooperative yield: hands control back to the browser (so it can paint and stay
  // responsive) but only if enough wall-clock time has passed since the last yield.
  // Time-slicing keeps fast depth-1 runs from drowning in yield overhead while still
  // guaranteeing the main thread breathes at least every ~sliceMs during slow depth-2+
  // matches — which is what prevents Chrome's "Page unresponsive" dialog.
  //
  // ⚠️ THE YIELD IS A MessageChannel AND NOT setTimeout, AND THAT IS THE WHOLE POINT
  // (8/30). A HIDDEN TAB CLAMPS setTimeout TO >= 1000 ms, and after ~5 minutes hidden
  // Chrome's *intensive throttling* cuts it to once per MINUTE. LEARN is the only
  // worker-backed job that yields on this thread — runLearn's learning pass; Tournament
  // and Compete never do while workers are live, which is why only training slowed down
  // when the user switched desktops. And the loss was NOT the workers being throttled:
  // all 32 sat idle waiting for the main thread to wake up and dispatch the next round,
  // so a 0.65 s round became ~2 s, or ~60 s once intensive throttling kicked in. A
  // message callback is exempt from that throttling, still returns to the event loop,
  // and so still does the job setTimeout was here for. **Do not simplify it back.**
  // The queue makes it safe if two async chains ever await it at once: one message is
  // posted per waiter and they are resolved FIFO.
  const _breathChan = (typeof MessageChannel !== 'undefined') ? new MessageChannel() : null;
  const _breathQueue = [];
  if (_breathChan) _breathChan.port1.onmessage = () => { const r = _breathQueue.shift(); if (r) r(); };
  let _lastBreath = (typeof performance !== 'undefined' ? performance.now() : Date.now());
  function breathe(sliceMs = 50) {
    const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    if (now - _lastBreath < sliceMs) return Promise.resolve();
    _lastBreath = now;
    if (!_breathChan) return new Promise((r) => setTimeout(r, 0));   // no MessageChannel: as before
    return new Promise((r) => { _breathQueue.push(r); _breathChan.port2.postMessage(0); });
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
  // ---- Net brains on the pool ------------------------------------------------
  // A linear brain is 24 numbers and rides along with every job for free. A net is ~16k
  // floats, and ONE interactive move at depth 2 farms out several hundred jobs — sending
  // the net with each would clone tens of megabytes per move. So: install once per worker,
  // then send only the id. (The worker's resolveBrain puts it back; see its header.)
  const stripNet = (W) => (W && W.kind === 'net'
    ? { kind: 'net', name: W.name, netId: W.netId }
    : W);

  // Build the `prime` callback for a run that may involve nets — null when none does,
  // which is the overwhelmingly common case and costs nothing. postMessage is FIFO per
  // worker, so an install posted here is in place before the job posted right after it.
  function primeNets(brains) {
    const byId = new Map();
    brains.forEach((b) => { if (b && b.kind === 'net' && b.net && !byId.has(b.netId)) byId.set(b.netId, b); });
    if (!byId.size) return null;
    return (w) => {
      if (!w._nets) w._nets = new Set();
      byId.forEach((b, id) => {
        if (w._nets.has(id)) return;
        w.postMessage({ cmd: 'install_net', netId: id, net: b.net });
        w._nets.add(id);
      });
    };
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
  // prime(w), when given, is called with each worker before its first job of this run —
  // it is how a net brain gets installed once instead of travelling with every message.
  // `shouldStop` (optional) is polled before dispatching: once it returns true no NEW
  // jobs go out and the promise resolves as soon as the in-flight ones drain. Without
  // it the Stop button did nothing to a worker-backed tournament or Compete — the flag
  // was only ever checked in the no-workers fallback loop, so a long run could not be
  // stopped at all short of reloading the page.
  function runJobsParallel(jobs, makeMsg, onResult, prime, shouldStop) {
    return new Promise((resolve, reject) => {
      const total = jobs.length;
      if (total === 0) { resolve(); return; }
      let next = 0, done = 0, active = 0, halted = false;
      const pump = () => {
        if (!halted && shouldStop && shouldStop()) halted = true;
        if (halted) { if (active === 0) resolve(); return; }
        while (active < numWorkers && next < total) {
          const i = next++, job = jobs[i], w = getWorker();
          if (prime) prime(w);
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
  function runMatchesParallel(specs, onResult, shouldStop) {
    const brains = [];
    specs.forEach((s) => { brains.push(s.wA, s.wB); });
    return runJobsParallel(
      specs,
      (s) => ({ cmd: 'play_match', wA: stripNet(s.wA), wB: stripNet(s.wB), X: s.X, depthA: s.depthA, depthB: s.depthB, seed: s.seed, cubeOff: s.cubeOff }),
      (data, spec, i) => onResult(data.result, spec, i),
      primeNets(brains),
      shouldStop,
    );
  }

  // Local copy of the dice distribution for combining worker results on the main thread
  // (kept in lockstep with game.js's BG_DICE_DIST). The win sentinel that used to live here
  // is GONE: terminal values now differ by brain kind (+-BG_WIN for a linear brain, exact
  // equity for a net), so the root combination asks the engine — game._terminalValue and
  // game._rootBonus — instead of keeping a second copy of the rule.
  const UI_DICE_DIST = (() => { const r = []; for (let i = 1; i <= 6; i++) for (let j = i; j <= 6; j++) r.push([i, j, i === j ? 1 : 2]); return r; })();

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
      (t) => ({ cmd: 'search', board: t.board, player: opp, dice: t.dice, plies: depth - 1, weights: stripNet(W) }),
      (data, t) => { rollVals[t.si][t.ri] = data.val; if ((++done % 21) === 0) gameMessageEl.textContent = label; },
      primeNets([W]),
    );

    let bestState = null, bestVal = player === 1 ? -Infinity : Infinity;
    states.forEach((st, si) => {
      const term = game._terminalValue(st, W);
      let val;
      if (term !== null) val = term;
      else {
        let acc = 0;
        UI_DICE_DIST.forEach(([, , wt], ri) => { acc += wt * rollVals[si][ri]; });
        val = acc / 36;
      }
      // DE + the disengaged-race tie-break, from the engine, so the parallel root cannot
      // drift from _scoreRootCandidate (and is correctly zero for a net brain).
      val += game._rootBonus(st, W, player, parentContact);
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
    // Root addends come from the engine (DE + the race tie-break, zero for a net), so this
    // path and _scoreRootCandidate cannot drift.
    const rootBonus = (st) => game._rootBonus(st, W, player, parentContact);

    let scored;
    if (depth <= 1) {
      scored = states.map((st) => {
        const term = game._terminalValue(st, W);
        const val = term !== null ? term : game._leafValue(st.points, st.bar, st.borneOff, W, opp);
        return { moves: st.moves, value: val + rootBonus(st) };
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
        (t) => ({ cmd: 'search', board: t.board, player: opp, dice: t.dice, plies: depth - 1, weights: stripNet(W) }),
        (data, t) => { rollVals[t.si][t.ri] = data.val; },
        primeNets([W]),
      );
      scored = states.map((st, si) => {
        const term = game._terminalValue(st, W);
        let val;
        if (term !== null) val = term;
        else { let acc = 0; UI_DICE_DIST.forEach(([, , wt], ri) => { acc += wt * rollVals[si][ri]; }); val = acc / 36; }
        return { moves: st.moves, value: val + rootBonus(st) };
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
    // A human seat still uses this depth in setup (the analysis brain at that depth), so keep it
    // clearly readable — only a slight dim to hint it's inactive in ordinary play.
    depthSel.style.opacity = (typeSel.value === 'human') ? '0.85' : '1';
  }

  // Play nMatches matches to X points. Net (fitness) = A's match wins - B's match
  // wins, so a blown-up cube can never inflate the signal: a match win counts 1.
  // The A/B argument order is swapped on alternate matches to cancel any residual
  // first-game side bias (simulateBGMatch already alternates colours within a match).
  // With DUPLO on, the two halves of each pair also share a match seed, so they see
  // IDENTICAL dice with the seats swapped — luck cancels between them and a mutant
  // that plays the same as its parent nets EXACTLY 0 instead of drifting on noise.
  async function evoMatch(A, B, nMatches, label) {
    const X = matchLength();
    const depth = lookaheadDepth();
    const cubeOff = batchCubeOff();
    // DUPLO: matches run as mirrored pairs sharing a seed, so nMatches is forced even.
    // This is the GA's biggest win. A scout compares a parent against a MUTANT — two
    // nearly identical POLICIES — which is exactly where pairing cancels most. Measured
    // 8/24: ~10x effective sample at X=1 and ~2.9x at X=11 for a 4% mutant, against only
    // ~1.06x for two roster brains, whose weight vectors genuinely differ. Closeness in
    // STRENGTH is not closeness in policy; only the latter makes the halves correlate.
    if (duploOn && nMatches % 2 === 1) nMatches += 1;
    const duploBase = duploBaseSeed();
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
        specs.push({ wA: swap ? B : A, wB: swap ? A : B, X, depthA: depth, depthB: depth, swap, cubeOff,
          seed: duploOn ? duploPairSeed(duploBase, i >> 1) : null });
      }
      await runMatchesParallel(specs, (res, spec) => tally(res, spec.swap));
    } else {
      for (let i = 0; i < nMatches && !evolveStop; i++) {
        const swap = (i % 2 === 1);
        const res = await simulateBGMatchYielding(swap ? B : A, swap ? A : B, X, depth, depth, breathe,
          duploOn ? duploPairSeed(duploBase, i >> 1) : null, cubeOff);
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
    if (learnRunning) { gameMessageEl.textContent = 'Stop training before evolving.'; return; }
    const baseName = editBrainSel ? editBrainSel.value : 'Origin';
    if (game.isNetPersonality(baseName)) {
      // Not an oversight: the genetic algorithm mutates a 24-number vector, and a net has
      // 16k parameters trained by self-play instead. See net.js decision 4.
      gameMessageEl.textContent = baseName + ' is a net brain — nets learn by self-play training, not evolution.';
      sysLog('[Evolve] refused — ' + baseName + ' is a net brain (no GA; it is trained by self-play).');
      return;
    }
    const maxGens = Math.max(1, parseInt(document.getElementById('evo-gens').value, 10) || 1000);
    // Matches per sample. DUPLO pairs them, so this is forced even and the field is
    // corrected in place — an odd match would have no mirror.
    let n = Math.max(1, parseInt(document.getElementById('evo-games').value, 10) || 100);
    if (duploOn && n % 2 === 1) { n += 1; const evoEl = document.getElementById('evo-games'); if (evoEl) evoEl.value = n; }
    const R = Math.max(0, Math.min(100, parseInt(document.getElementById('evo-rate').value, 10) || 50));

    let parent = normalizeBrain({ ...game.personalityWeights(baseName) });
    let baseline = { ...parent };
    let bestScore = 0, multiplier = 10, champions = 0, gen = 0;
    const evoStart = Date.now();   // Evolve reports ELAPSED, never an ETA — see elapsedSuffix

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
      gameMessageEl.textContent = `Evolve ${baseName}: generation ${gen} · ${champions} champions · best +${bestScore}`
        + elapsedSuffix(Date.now() - evoStart);
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
  // CSV cell formatter: integers of 4+ digits get standard thousands commas, and are
  // then QUOTED so the embedded comma cannot split the cell. Anything else (short
  // numbers, decimals, strings) passes through untouched.
  const csvNum = (v) => {
    if (typeof v !== 'number' || !Number.isFinite(v) || !Number.isInteger(v)) return String(v);
    const s = numCommas(v);
    return s.indexOf(',') >= 0 ? '"' + s + '"' : s;
  };

  // Version stamp for exported files — read live from the page's version label so it
  // always matches the current build (the snapshot ritual only edits index.html).
  function bgVersion() {
    const el = document.getElementById('app-version');
    const m = el && el.textContent.match(/v\.\s*(\d+)/i);
    return m ? m[1] : '?';
  }

  // Same mechanism, honest MIME: a trained net is JSON, not a spreadsheet.
  function downloadText(filename, text, mime) {
    const blob = new Blob([text], { type: (mime || 'text/plain') + ';charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
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

  // Throughput block for the exported CSVs — emitted on every tournament and Compete run,
  // because collecting it is three counters and a clock. The number that
  // actually travels between machines is `ms per game x workers`: it is the per-worker
  // cost of a game, so running the SAME job once at Workers = 1 and once at Workers = max
  // gives (baseline ms/game) / (parallel ms/game) = the real parallel speedup, which is
  // what separates "this CPU is faster" from "this CPU scales better".
  // Snapshot of how the run was executed, for throughputCSV. Captured at the end of a
  // run so it reflects the pool that actually did the work.
  const perfBlock = (matches, games, ms, turns) => ({
    workers: workersAvailable ? numWorkers : 1,
    workersAvailable,
    cores: navigator.hardwareConcurrency || null,
    matches, games, ms, turns,
  });

  // How often the SAME brain won BOTH halves of a mirrored pair. This is the whole
  // story on DUPLO's precision: pairing cancels dice luck, so the two halves correlate
  // and sweeps become RARER than independent matches would make them. The effective
  // sample multiplier is baseline / sweepRate. Two identical brains never sweep — they
  // net exactly zero — and the closer two brains are, the rarer a sweep becomes, which
  // is why the gain is largest exactly where the roster is tightest.
  // ⚠ THE UNPAIRED BASELINE IS NOT 0.5. Independent matches sweep at p^2 + (1-p)^2,
  // which is 0.5 only for an EVENLY MATCHED pair: a 98%-vs-2% pairing sweeps 96% of the
  // time with no pairing at all. Hardcoding 0.5 understated every uneven field, and on
  // the 9/2 ten-net tournament (98% down to 1.6%) it printed 0.8 — i.e. claimed DUPLO
  // made the sample WORSE, which is impossible. So `groups[i]` names the brain-pair
  // match i belonged to, p is estimated per pairing, and the baselines are averaged
  // over pairs: a tournament pools all its pairings into ONE flat array and must not be
  // priced as though it were a single even match. Compete passes no groups (it has one
  // pairing) and still gets its own p rather than 0.5.
  function duploStats(wonFlags, n, groups) {
    if (!duploOn) return { on: false };
    let pairs = 0, sweeps = 0;
    const byPairing = new Map();                         // pairing key -> {pairs, aWins}
    for (let k = 0; 2 * k + 1 < n; k++) {
      const a = wonFlags[2 * k], b = wonFlags[2 * k + 1];
      if (a === undefined || b === undefined) continue;   // run stopped mid-pair
      pairs++;
      if (a === b) sweeps++;
      const key = groups ? groups[2 * k] : '';
      let g = byPairing.get(key);
      if (!g) byPairing.set(key, g = { pairs: 0, aWins: 0 });
      g.pairs++;
      if (a) g.aWins++;
      if (b) g.aWins++;
    }
    // Mean over pairings of p^2 + (1-p)^2, weighted by the mirrored pairs each
    // contributed. p is that pairing's own observed win rate, read off these same
    // flags — so this is a reference line for the multiplier, not a significance test.
    let wsum = 0;
    for (const g of byPairing.values()) {
      const p = g.aWins / (2 * g.pairs);
      wsum += g.pairs * (p * p + (1 - p) * (1 - p));
    }
    return {
      on: true, pairs, sweeps,
      rate: pairs ? sweeps / pairs : null,
      baseline: pairs ? wsum / pairs : null,
    };
  }

  function duploCSV(d) {
    if (!d) return '';
    let csv = '\nDUPLO\n';
    csv += 'DUPLO,' + (d.on ? 'ON' : 'OFF') + '\n';
    if (!d.on) return csv;
    csv += 'Mirrored pairs,' + csvNum(d.pairs) + '\n';
    csv += 'Pair sweeps (same brain won both halves),' + csvNum(d.sweeps) + '\n';
    csv += 'Sweep rate,' + (d.rate === null ? '?' : d.rate.toFixed(4)) + '\n';
    csv += 'Unpaired sweep rate for this field,' + (d.baseline === null ? '?' : d.baseline.toFixed(4)) + '\n';
    csv += 'Effective sample multiplier (unpaired baseline / sweep rate),'
        + (d.rate === null || d.baseline === null ? '?'
           : (d.sweeps === 0 ? '>' + (d.baseline * d.pairs).toFixed(1)
                             : (d.baseline / d.rate).toFixed(2))) + '\n';
    return csv;
  }

  // A net has no 24 weights, so writing it into the parameter table produced a row of
  // "undefined" 22 times. It gets its own block instead, saying what it actually is.
  function netParamsCSV(names, withRole) {
    let csv = '\nNet Brains:\n' + (withRole ? 'Role,' : '') + 'Name,Hidden,Phi,Lambda,Trained games,Parameters,Cube\n';
    names.forEach((entry) => {
      const n = withRole ? entry.name : entry;
      const w = game.personalityWeights(n), net = w && w.net;
      csv += (withRole ? entry.role + ',' : '') + n + ','
        + (net ? '"' + (net.spec.hidden || []).join(' x ') + '"' : '(not loaded)') + ','
        + (net ? net.spec.activation : '') + ','
        + (net && net.spec.lambda !== undefined ? net.spec.lambda : '') + ','
        + (net ? (net.trainedGames || 0) : '') + ','
        + (net ? BG_NET.netParamCount(net) : '') + ','
        + 'Janowski x=' + BG_NET.CUBE_X_CONTACT + ' contact / ' + BG_NET.CUBE_X_RACE + ' race\n';
    });
    csv += 'NB a net scores in EQUITY (points), not the +-1000 weight band, and has no DT/AT.\n';
    return csv;
  }

  function throughputCSV(p) {
    const ms = Math.max(0, p.ms || 0), games = p.games || 0, matches = p.matches || 0;
    const turns = p.turns || 0;               // AI decisions = "moves" (one per play of the dice)
    const per = (v, d) => (games ? v.toFixed(d) : '?');
    const perMove = (v, d) => (turns ? v.toFixed(d) : '?');
    let csv = '\nThroughput\n';
    csv += 'Workers,' + csvNum(p.workers) + (p.workersAvailable ? '' : ' (no Web Workers — single-threaded fallback)') + '\n';
    csv += 'Logical cores reported by the browser,' + (p.cores == null ? '?' : csvNum(p.cores)) + '\n';
    csv += 'Total matches,' + csvNum(matches) + '\n';
    csv += 'Total games,' + csvNum(games) + '\n';
    csv += 'Total moves (AI decisions),' + csvNum(turns) + '\n';
    csv += 'Games per match,' + (matches ? (games / matches).toFixed(2) : '?') + '\n';
    csv += 'Moves per game,' + (games && turns ? (turns / games).toFixed(2) : '?') + '\n';
    csv += 'Wall-clock time (s),' + (ms / 1000).toFixed(1) + '\n';
    csv += 'ms per game (wall),' + per(ms / games, 3) + '\n';
    csv += 'ms per move (wall),' + perMove(ms / turns, 4) + '\n';
    csv += 'ms per match (wall),' + (matches ? (ms / matches).toFixed(1) : '?') + '\n';
    csv += 'Games per second,' + (ms ? (1000 * games / ms).toFixed(1) : '?') + '\n';
    csv += 'Moves per second,' + (ms && turns ? (1000 * turns / ms).toFixed(1) : '?') + '\n';
    csv += 'ms per game x workers,' + per(p.workers * ms / games, 1) + '\n';
    csv += 'ms per move x workers,' + perMove(p.workers * ms / turns, 4) + '\n';
    return csv;
  }

  // Detailed CSV in the style of the Reversi tournament output. Standings are by
  // matches won; total game points are kept as a bounded secondary/tiebreak column.
  function buildTournamentCSV(names, mWins, mLoss, gpts, gplayed, h2h, matchesPer, X, tStart, tEnd, depth, perf, duplo, opts) {
    const ranked = names.slice().sort((a, b) => (mWins[b] - mWins[a]) || (gpts[b] - gpts[a]));
    let csv = 'Backgammon Tournament Results\n';
    csv += 'BG v. ' + bgVersion() + '\n';
    csv += 'Starting Date:,' + tStart.toLocaleString() + '\n';
    csv += 'Ending Date:,' + tEnd.toLocaleString() + '\n';
    csv += 'Duration:,"' + numCommas(tEnd - tStart) + ' ms"\n';
    csv += 'Players:,' + names.length + '\n';
    csv += 'Matches per Pair,' + csvNum(matchesPer) + '\n';
    csv += 'Match Length (play to),' + X + '\n';
    csv += 'Lookahead Depth (plies),' + (depth == null ? '?' : depth) + '\n';
    csv += 'Doubling:,' + (opts && opts.cubeOff ? 'none (cube dead at any match length)' : 'money (Janowski)') + '\n';
    if (opts && opts.stopped) csv += 'STOPPED EARLY,' + opts.played + ' of ' + opts.planned
      + ' matches played — "Matches per Pair" above is the SETTING, not what every pair actually got\n';
    csv += '\n';

    csv += 'Standings\nRank,Name,Matches Won,Matches Lost,Games Played,Game Points\n';
    ranked.forEach((n, i) => {
      const gp = gplayed ? (gplayed[n] || 0) : 0;   // individual GAMES played (a match is several games)
      csv += `${i + 1},${n},${csvNum(mWins[n])},${csvNum(mLoss[n])},${csvNum(gp)},${csvNum(gpts[n])}\n`;
    });
    csv += '\n';

    csv += 'Head-to-Head (net matches won, row minus column)\n';
    csv += 'Row vs Col,' + ranked.join(',') + '\n';
    ranked.forEach((r) => {
      const row = ranked.map((c) => (r === c ? '' : csvNum((h2h[r][c] || 0) - (h2h[c][r] || 0))));
      csv += `${r},${row.join(',')}\n`;
    });
    csv += '\n';

    const linParams = ranked.filter((n) => !game.isNetPersonality(n));
    const netParams = ranked.filter((n) => game.isNetPersonality(n));
    if (linParams.length) {
      csv += 'Player Parameters:\nName,' + PARAM_ORDER.join(',') + '\n';
      linParams.forEach((n) => {
        const w = game.personalityWeights(n);
        csv += n + ',' + PARAM_ORDER.map((k) => csvNum(w[k])).join(',') + '\n';
      });
    }
    if (netParams.length) csv += netParamsCSV(netParams, false);

    csv += duploCSV(duplo);
    if (perf) csv += throughputCSV(perf);
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

    // Load any shipped net these seats name BEFORE the run — a batch cannot stop halfway to
    // fetch a file, and the workers are handed the weights as they start.
    const absent = await ensureNetsLoaded([p1, p2]);
    if (absent.length) { gameMessageEl.textContent = 'Compete: ' + netMissingMessage(absent); return; }

    const wWhite = game.personalityWeights(p1), wRed = game.personalityWeights(p2);
    const dWhite = playerDepth(1), dRed = playerDepth(2);
    const X = matchLength();
    const nMatches = batchMatches(1000);            // DUPLO forces this even
    const cubeOff = batchCubeOff();                 // Doubling menu, independent of X

    tournamentRunning = true; tournamentStop = false;
    const btn = document.getElementById('btn-compete');
    if (btn) btn.disabled = true;
    const tStart = new Date();
    let winsWhite = 0, winsRed = 0;   // match wins for WP / RP
    let gptsWhite = 0, gptsRed = 0;   // total game points for WP / RP (tiebreak)
    let totalGames = 0, totalTurns = 0;   // individual games / AI decisions across the run
    // DUPLO: matches run as mirrored pairs (2k, 2k+1) sharing one seed — same dice,
    // seats swapped. wpWon[i] records who won match i so the sweep rate can be read off.
    const duploBase = duploBaseSeed();
    const wpWon = [];

    // Show status before work starts, and yield once so the browser paints it.
    gameMessageEl.textContent = `Compete starting… ${p1} d${dWhite} vs ${p2} d${dRed}, ${nMatches} matches to ${X}…`;
    await new Promise((r) => setTimeout(r, 0));

    let done = 0;
    // Tally one finished match (A is WP when !swap, else RP).
    const tally = (res, swap, idx) => {
      const whiteWon = swap ? (res.winner === 'B') : (res.winner === 'A');
      if (idx !== undefined) wpWon[idx] = whiteWon;
      if (whiteWon) winsWhite++; else winsRed++;
      gptsWhite += swap ? res.scoreB : res.scoreA;
      gptsRed   += swap ? res.scoreA : res.scoreB;
      totalGames += res.games;
      totalTurns += res.turns || 0;
      done++;
      gameMessageEl.textContent = `Compete: ${p1} d${dWhite} ${winsWhite} – ${winsRed} ${p2} d${dRed} · ${done}/${nMatches} to ${X}`
        + etaSuffix(done, nMatches, Date.now() - tStart.getTime());
    };

    if (workersAvailable) {
      // One match per worker — depth travels with the brain via the paired depths.
      const specs = [];
      for (let i = 0; i < nMatches; i++) {
        const swap = (i % 2 === 1);
        specs.push({
          wA: swap ? wRed : wWhite, wB: swap ? wWhite : wRed,
          X, depthA: swap ? dRed : dWhite, depthB: swap ? dWhite : dRed, swap, idx: i, cubeOff,
          seed: duploOn ? duploPairSeed(duploBase, i >> 1) : null,   // both halves of pair i>>1 share it
        });
      }
      await runMatchesParallel(specs, (res, spec) => tally(res, spec.swap, spec.idx), () => tournamentStop);
    } else {
      for (let i = 0; i < nMatches; i++) {
        if (tournamentStop) break;
        const swap = (i % 2 === 1);
        const res = await simulateBGMatchYielding(
          swap ? wRed : wWhite, swap ? wWhite : wRed, X,
          swap ? dRed : dWhite, swap ? dWhite : dRed, breathe,
          duploOn ? duploPairSeed(duploBase, i >> 1) : null, cubeOff);
        tally(res, swap, i);
        await new Promise((r) => setTimeout(r, 0));
      }
    }

    // A stopped run still writes its CSV with whatever was played — the contract LEARN
    // has always had (Stop there still installs and downloads the net). Counts come from
    // `done`, never the planned total, so a partial file cannot overstate its sample.
    const stopped = tournamentStop;
    const tEnd = new Date();
    const secs = ((tEnd - tStart) / 1000).toFixed(1);
    const lead = winsWhite === winsRed ? 'tie'
      : (winsWhite > winsRed ? `${p1} (WP, d${dWhite}) wins` : `${p2} (RP, d${dRed}) wins`);
    downloadCSV('BGCompeteResults.csv', buildCompeteCSV({
      p1, p2, dWhite, dRed, winsWhite, winsRed, gptsWhite, gptsRed,
      totalGames, nMatches: done, planned: nMatches, stopped, cubeOff, X, tStart, tEnd,
      perf: perfBlock(done, totalGames, tEnd - tStart, totalTurns),
      duplo: duploStats(wpWon, done),
    }));
    gameMessageEl.textContent = `Compete ${stopped ? 'STOPPED' : 'done'} — ${lead}: ${p1} d${dWhite} ${winsWhite} — ${winsRed} ${p2} d${dRed}. ${done}${stopped ? ' of ' + nMatches : ''} matches to ${X} in ${secs}s. Results saved.`;
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
    csv += 'Matches:,' + csvNum(r.nMatches) + '\n';
    if (r.stopped) csv += 'STOPPED EARLY,' + r.nMatches + ' of ' + r.planned
      + ' matches played — every block below is from the matches actually completed\n';
    csv += 'Doubling:,' + (r.cubeOff ? 'none (cube dead at any match length)' : 'money (Janowski)') + '\n';
    csv += 'Match Length (play to),' + r.X + '\n';
    csv += 'Total Games:,' + csvNum(r.totalGames) + '\n\n';

    csv += 'Standings\nRank,Role,Name,Depth,Matches Won,Matches Lost,Game Points\n';
    rows.forEach((row, i) => {
      csv += `${i + 1},${row.role},${row.name},${row.depth},${csvNum(row.won)},${csvNum(row.lost)},${csvNum(row.gpts)}\n`;
    });
    csv += '\nResult,' + (wpWins === rpWins
      ? 'Tie ' + csvNum(wpWins) + '-' + csvNum(rpWins)
      : (wpFirst ? `${r.p1} (WP, d${r.dWhite})` : `${r.p2} (RP, d${r.dRed})`) + ' wins ' + csvNum(Math.max(wpWins, rpWins)) + '-' + csvNum(Math.min(wpWins, rpWins))) + '\n\n';

    const seatsCSV = [{ role: 'WP (White)', name: r.p1, depth: r.dWhite },
                      { role: 'RP (Red)',   name: r.p2, depth: r.dRed }];
    const linSeats = seatsCSV.filter((s) => !game.isNetPersonality(s.name));
    const netSeats = seatsCSV.filter((s) => game.isNetPersonality(s.name));
    if (linSeats.length) {
      csv += 'Player Parameters:\nRole,Name,Depth,' + PARAM_ORDER.join(',') + '\n';
      linSeats.forEach((s) => {
        const w = game.personalityWeights(s.name);
        csv += s.role + ',' + s.name + ',' + s.depth + ',' + PARAM_ORDER.map((k) => csvNum(w[k])).join(',') + '\n';
      });
    }
    if (netSeats.length) csv += netParamsCSV(netSeats, true);
    csv += duploCSV(r.duplo);
    if (r.perf) csv += throughputCSV(r.perf);
    return csv;
  }

  async function runTournament() {
    const names = menuBrainNames().filter((n) => tourneySelected.has(n));
    if (names.length < 2) { gameMessageEl.textContent = 'Tournament: select at least 2 players.'; return; }
    const absent = await ensureNetsLoaded(names);
    if (absent.length) { gameMessageEl.textContent = 'Tournament: ' + netMissingMessage(absent); return; }
    const matchesPer = batchMatches(1000);          // DUPLO forces this even
    const X = matchLength();
    const depth = tournamentDepth();                // its own menu now, not Evolve's
    const cubeOff = batchCubeOff();

    let totalGames = 0, totalTurns = 0;                  // individual games / AI decisions across the whole run
    const mWins = {}, mLoss = {}, gpts = {}, gplayed = {}, h2h = {};
    names.forEach((n) => {
      mWins[n] = 0; mLoss[n] = 0; gpts[n] = 0; gplayed[n] = 0; h2h[n] = {};
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

    // Show status before work starts, and yield once so the browser paints it. At depth 2
    // the first match can take many seconds, so without this the panel looks dead until the
    // first result lands.
    gameMessageEl.textContent = `Tournament starting… ${names.length} AIs, ${numCommas(total)} matches to ${X} at depth ${depth}…`;
    await new Promise((r) => setTimeout(r, 0));

    let done = 0;

    // DUPLO: mirrored pairs sharing a seed. matchesPer is even, so every brain-pair
    // block starts at an even flat index and the pairs are (2k, 2k+1) globally.
    // aWonArr[i] records whether A won match i, for the sweep rate; aPairing[i] names
    // the brain-pair it belonged to, so the unpaired baseline is priced per pairing.
    const duploBase = duploBaseSeed();
    const aWonArr = [];
    const aPairing = [];
    let flatIdx = 0;

    // Tally one finished match given its pair/swap meta.
    const tally = (res, A, B, swap, idx) => {
      const aWon = swap ? (res.winner === 'B') : (res.winner === 'A');
      if (idx !== undefined) { aWonArr[idx] = aWon; aPairing[idx] = A + '\u0000' + B; }
      const winner = aWon ? A : B, loser = aWon ? B : A;
      const aScore = swap ? res.scoreB : res.scoreA, bScore = swap ? res.scoreA : res.scoreB;
      mWins[winner]++; mLoss[loser]++; h2h[winner][loser]++;
      gpts[A] += aScore; gpts[B] += bScore;
      const nGames = res.games || 0;                      // both brains played every game of the match
      gplayed[A] += nGames; gplayed[B] += nGames; totalGames += nGames;
      totalTurns += res.turns || 0;
      done++;
      gameMessageEl.textContent = `Tournament: ${done}/${total} matches to ${X}`
        + etaSuffix(done, total, Date.now() - tStart.getTime());
    };

    if (workersAvailable) {
      // Flatten every pair × match into specs and run them across the worker pool.
      const specs = [];
      for (const [A, B] of pairs) {
        const wA = game.personalityWeights(A), wB = game.personalityWeights(B);
        for (let k = 0; k < matchesPer; k++) {
          const swap = (k % 2 === 1);
          const fi = flatIdx++;
          specs.push({ wA: swap ? wB : wA, wB: swap ? wA : wB, X, depthA: depth, depthB: depth, A, B, swap, idx: fi, cubeOff,
            seed: duploOn ? duploPairSeed(duploBase, fi >> 1) : null });
        }
      }
      await runMatchesParallel(specs, (res, spec) => tally(res, spec.A, spec.B, spec.swap, spec.idx), () => tournamentStop);
    } else {
      for (const [A, B] of pairs) {
        if (tournamentStop) break;
        const wA = game.personalityWeights(A), wB = game.personalityWeights(B);
        for (let k = 0; k < matchesPer; k++) {
          if (tournamentStop) break;
          const swap = (k % 2 === 1);                          // balance first-game side bias
          const fi = flatIdx++;
          const res = await simulateBGMatchYielding(swap ? wB : wA, swap ? wA : wB, X, depth, depth, breathe,
            duploOn ? duploPairSeed(duploBase, fi >> 1) : null, cubeOff);
          tally(res, A, B, swap, fi);
          await new Promise((r) => setTimeout(r, 0));          // yield so the UI stays responsive
        }
      }
    }

    const stopped = tournamentStop;                 // still write the CSV — see runCompete
    const tEnd = new Date();
    const ranked = names.slice().sort((a, b) => (mWins[b] - mWins[a]) || (gpts[b] - gpts[a]));
    const secs = ((tEnd - tStart) / 1000).toFixed(1);
    downloadCSV('BGTournamentResults.csv', buildTournamentCSV(names, mWins, mLoss, gpts, gplayed, h2h, matchesPer, X, tStart, tEnd, depth,
      perfBlock(done, totalGames, tEnd - tStart, totalTurns), duploStats(aWonArr, done, aPairing),
      { stopped, played: done, planned: total, cubeOff }));
    gameMessageEl.textContent = `Tournament ${stopped ? 'STOPPED' : 'done'} — winner ${ranked[0]} (${mWins[ranked[0]]} matches). ${done}${stopped ? ' of ' + total : ''} matches to ${X} in ${secs}s. Results saved.`;
    sysLog(`[Tournament] ${done}${stopped ? ' of ' + total : ''} matches to ${X} in ${secs}s. Winner: ${ranked[0]} (${mWins[ranked[0]]} matches won).`);

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
      // Before rolling, decide whether to offer a double. Doubling is disabled for games launched
      // from a set-up position (examination) — otherwise a lopsided position ends instantly on a double.
      if (doublingOn && !setupOriginBoard && game.aiShouldDouble(game.currentPlayer)) {
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
      // Wipe both message queues (used by the host on restart) so the room never accumulates a
      // stale multi-game backlog. Returns a promise so the caller can send the fresh message after.
      clearQueues() {
        return Promise.all([
          roomRef.child('host2guest').set(null),
          roomRef.child('guest2host').set(null),
        ]).catch(() => {});
      },
      close() {
        // Clear our presence (the opponent sees us leave) AND detach the inbound/presence
        // listeners, so a "Leave" that does NOT reload the page leaves nothing live behind.
        try { meRef.set(null); } catch (e) {}
        try { otherRef.off(); } catch (e) {}
        try { inRef.off(); } catch (e) {}
        conn.open = false;
      },
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

    // Deliver only messages that arrive AFTER we attach. A (re)connect must NOT replay the
    // room's whole history: Firebase's child_added fires once for every EXISTING child, so on a
    // mid-game reconnect that would dump the entire game (every prior turn, plus old restart
    // messages) in a single burst and corrupt the move history — exactly the failure we hit. So
    // we first snapshot the keys already present, then deliver only genuinely new children; the
    // heartbeat's full-state adopt handles catching the board up. (A fresh room has no backlog,
    // so nothing is skipped and the normal handshake is unaffected — the host sends sync/start
    // only after both sides are present, i.e. after this listener is live.)
    // ⚠️ The skip is ORDINAL, not a snapshot. Firebase push() keys are chronologically ordered,
    // so the highest key we have consumed is a watermark that SURVIVES a reconnect: on re-attach
    // child_added replays the queue and everything above the mark is delivered, including whatever
    // the peer wrote while we were rebuilding. The old code re-snapshotted "what is here now" at
    // every attach and filed all of it as history — so a message that landed 200ms earlier, during
    // the teardown, was skipped forever. Combined with a watchdog that reconnects every 12s, that
    // is a message shredder (8/25: the guest's cube ACCEPT went into it and never came out).
    // The mark is per room+role and resets when either changes, so joining a NEW room still skips
    // that room's prior history exactly as before.
    const markKey = roomCode + '/' + role;
    if (inboundHighWaterRoom !== markKey) { inboundHighWaterRoom = markKey; inboundHighWater = null; }
    inRef.once('value', (initSnap) => {
      if (inboundHighWater === null) {
        // First attach to this room: everything already present predates us → skip it.
        let hw = '';
        initSnap.forEach((c) => { if (c.key > hw) hw = c.key; });
        inboundHighWater = hw;
      }
      inRef.on('child_added', (snap) => {
        if (snap.key <= inboundHighWater) return;   // at or below the watermark → already handled
        inboundHighWater = snap.key;
        let msg = snap.val();
        if (typeof msg === 'string') { try { msg = JSON.parse(msg); } catch (e) { return; } }
        if (msg) fire('data', msg);
      });
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

    // ⚠️ LATENT (dormant transport, NOT fixed — flagged 8/25): sinceIn restarts at 0 on every new
    // shim, so an auto-reconnect over the PHP relay would re-deliver the room's WHOLE queue — the
    // mirror image of the Firebase bug fixed above, and the history-corrupting replay the v140
    // change was written to stop. If 'php' is ever brought back into service, persist this index
    // across reconnects the way inboundHighWater does for Firebase. Left alone here because the
    // path is dormant (NET_TRANSPORT = 'firebase') and cannot be tested from this side.
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
      clearQueues() { return Promise.resolve(); },   // PHP relay: no persistent backlog to wipe
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
    setupOriginBoard = null;   // network games always start from the standard position
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

    // --- NETWORK HEARTBEAT / RESYNC (silent-deadlock recovery) ---------------------------
    // A whole turn's messages can be lost over the relay; then both sides sit idle, each
    // thinking it's the other's turn, and nothing further is sent to correct it (exactly the
    // "host says Red, guest says White" deadlock). So each side periodically broadcasts its
    // FULL authoritative state, anchored by turnCount (which increments on every roll, local
    // OR received — so a missed roll leaves the two turnCounts diverged). A side that is
    // STRICTLY BEHIND adopts the ahead side's state wholesale, catching up the missing turn;
    // at an equal turnCount with a divergent board the guest defers to the host (authoritative).
    // This also silently heals any single lost message within one heartbeat interval.
    let heartbeatTimer = null;
    const HEARTBEAT_MS = 3000;

    function heartbeatSnapshot() {
      return {
        type: 'heartbeat',
        turnCount: game.turnCount,
        currentPlayer: game.currentPlayer,
        hasRolled: game.hasRolled,
        dice: [...game.dice],
        movesLeft: [...game.movesLeft],
        points: game.points, bar: game.bar, borneOff: game.borneOff,
        cubeValue: game.doublingCubeValue, cubeOwner: game.doublingCubeOwner,
        // The pending offer travels too, so a peer whose accept/decline was lost can be
        // reconciled from the beat itself (see handleHeartbeat's cube reconciliation).
        pendingDouble: pendingDouble ? { by: pendingDouble.by } : null,
        winner: game.winner
      };
    }
    function sendHeartbeat() {
      if (!isNetworkGame || !gameStarted || game.winner) return;
      if (!conn || !conn.open) return;
      // isRolling is genuinely transient (well under a second) — skipping one beat is harmless.
      // pendingDouble is NOT: it lasts as long as a person takes to decide whether to take, which
      // is routinely longer than INBOUND_SILENCE_MS. Suppressing the beat there starved BOTH
      // watchdogs at the exact moment a cube decision was in flight, so both sides reconnected on
      // the same 12s cadence and the guest's accept fell into the gap (8/25 freeze-after-double).
      // The beat now keeps flowing through a pending double and advertises the offer.
      if (isRolling) return;
      conn.send(heartbeatSnapshot());
    }
    function startHeartbeat() { if (heartbeatTimer) clearInterval(heartbeatTimer); heartbeatTimer = setInterval(sendHeartbeat, HEARTBEAT_MS); }
    function stopHeartbeat()  { if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; } }

    // --- Inbound watchdog + auto safe-reconnect ------------------------------------------------
    // The heartbeat recovery only works if the BEHIND side can still RECEIVE. The real-world
    // failure (iPad Safari, backgrounded/throttled) is a one-directional stall: our inbound Firebase
    // listener goes dormant while our outbound keeps working, so we stop getting the peer's moves
    // AND heartbeats and can never adopt. The watchdog notices the inbound silence and rebuilds the
    // channel; the tab-foreground handler does the same the moment we come back on screen.
    function startInboundWatchdog() {
      stopInboundWatchdog();
      inboundWatchdog = setInterval(() => {
        if (!isNetworkGame || !gameStarted || game.winner || reconnecting) return;
        if (!conn || !conn.open) return;                 // a real disconnect flips conn.open; skip
        if (Date.now() - lastInboundAt > INBOUND_SILENCE_MS) {
          reconnectNetwork(`no inbound for ${Math.round((Date.now() - lastInboundAt) / 1000)}s`);
        }
      }, 4000);
    }
    function stopInboundWatchdog() { if (inboundWatchdog) { clearInterval(inboundWatchdog); inboundWatchdog = null; } }

    // Re-establish the network channel WITHOUT resetting the local game or flipping role. Backlog-
    // skip means the fresh listener won't replay history; the peer's next heartbeat re-syncs the
    // board, and adoptRemoteState then pulls the peer's full move history so the list stays intact.
    function reconnectNetwork(reason) {
      if (!isNetworkGame || !currentRoomCode || localPlayerRole == null || reconnecting) return;
      reconnecting = true;
      sysLog(`[Network] Auto-reconnect (${reason}) — re-establishing the channel.`);
      try { if (conn) conn.close(); } catch (e) {}
      if (NET_TRANSPORT === 'firebase' && fbDb) {
        try { fbDb.goOffline(); fbDb.goOnline(); } catch (e) {}   // force a fresh websocket
        conn = makeFirebaseConnection(currentRoomCode, localPlayerRole);
      } else {
        conn = makePhpConnection(currentRoomCode, localPlayerRole);
      }
      setupConnectionListeners(conn);
      lastInboundAt = Date.now();                        // grace period before the watchdog re-fires
      setTimeout(() => { reconnecting = false; }, 6000);
    }

    // iOS suspends a backgrounded tab's socket; on return to the foreground, resync if inbound is stale.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible') return;
      if (!isNetworkGame || !gameStarted || game.winner || reconnecting) return;
      if (!conn || !conn.open) return;
      if (Date.now() - lastInboundAt > 4000) reconnectNetwork('tab foregrounded');
    });

    // Jump wholesale to the opponent's authoritative full state. We can't replay the missed
    // individual moves, but the ahead side's board IS the truth, so we adopt it and resume.
    function adoptRemoteState(s) {
      game.points  = s.points;
      game.bar     = s.bar;
      game.borneOff = s.borneOff;
      game.currentPlayer = s.currentPlayer;
      game.turnCount = s.turnCount;
      game.hasRolled = !!s.hasRolled;
      game.dice = s.dice ? [...s.dice] : [0, 0];
      game.movesLeft = s.movesLeft ? [...s.movesLeft] : [];
      if (s.cubeValue !== undefined) game.doublingCubeValue = s.cubeValue;
      if (s.cubeOwner !== undefined) game.doublingCubeOwner = s.cubeOwner;
      game.winner = s.winner || null;
      game.playedMovesThisTurn = [];
      pendingDouble = null;
      if (turnEndTimer) { clearTimeout(turnEndTimer); turnEndTimer = null; }
      networkQueue = [];
      isProcessingQueue = false;
      game.checkWinner();
      updateUI();
      // We jumped the BOARD to the peer's authoritative state, but our move-history list may now
      // have a gap for the turn(s) we missed. Ask the peer for its full history so the list is
      // rebuilt intact (see the 'sync_request'/'sync_full' handlers).
      netSend({ type: 'sync_request' });
    }
    function handleHeartbeat(s) {
      if (!isNetworkGame || !gameStarted) return;
      if (isRolling) return;   // don't clobber a roll animation; the next heartbeat retries
      // Don't adopt while we're still applying an opponent's incremental move/end_turn
      // messages (queued OR mid drop-animation): the queue will drain and run endTurn(),
      // recording the turn normally. Adopting here would WIPE the pending end_turn (see
      // adoptRemoteState's `networkQueue = []`), so game.endTurn() never runs — dropping that
      // turn from the move history and diverging the turnCount anchors. That race is the real
      // cause of the "guest is missing a move / game becomes unplayable" desync. A genuinely
      // lost turn leaves the queue empty, so real deadlock recovery still fires on a later beat.
      if (isProcessingQueue || networkQueue.length) return;
      // Only adopt a STABLE between-turns boundary (the on-roll side hasn't rolled) or a final
      // position — never a mid-move snapshot, which would race the incremental move messages.
      if (s.hasRolled && !s.winner) return;
      // Never overwrite MY own in-progress turn (I've rolled and it's my move to make).
      const myLiveTurn = game.hasRolled && game.currentPlayer === localPlayerRole && !game.winner;
      if (myLiveTurn) return;

      // DIAGNOSTIC: at this stable boundary, log the FIRST moment the two sides disagree — before
      // the adopt below papers over it — so a diff of the two consoles pinpoints where/when the
      // game diverged. De-duped so a persistent divergence logs once, not every heartbeat.
      {
        const mineSig = boardSig(game.points, game.bar, game.borneOff);
        const peerSig = boardSig(s.points, s.bar, s.borneOff);
        // The cube is part of the state, so it belongs in the comparison. Leaving it out is why a
        // pure cube divergence logged nothing at all on 8/25 while the two sides sat disagreeing.
        const mineCube = `cube ${game.doublingCubeValue}/${game.doublingCubeOwner}${pendingDouble ? '+pending' : ''}`;
        const peerCube = `cube ${s.cubeValue}/${s.cubeOwner}${s.pendingDouble ? '+pending' : ''}`;
        if (s.turnCount !== game.turnCount || s.currentPlayer !== game.currentPlayer || mineSig !== peerSig || mineCube !== peerCube) {
          const key = `t${game.turnCount}/p${game.currentPlayer}|${mineSig}|${mineCube}||t${s.turnCount}/p${s.currentPlayer}|${peerSig}|${peerCube}`;
          if (key !== lastDivergenceKey) {
            lastDivergenceKey = key;
            sysLog(`[DIVERGENCE] mine  t${game.turnCount} p${game.currentPlayer} rolled=${game.hasRolled} | ${mineCube} | ${mineSig}`);
            sysLog(`[DIVERGENCE] peer  t${s.turnCount} p${s.currentPlayer} rolled=${!!s.hasRolled} | ${peerCube} | ${peerSig}`);
          }
        } else {
          lastDivergenceKey = null;
        }
      }

      // CUBE RECONCILIATION (8/25). A lost accept/decline leaves the two sides disagreeing about
      // the CUBE ALONE — turnCount, on-roll player and board all still match, so neither `behind`
      // nor `tieDeferToHost` fires and the old code sat next to the answer indefinitely (the host
      // held pendingDouble forever while the guest told it three times a second that the cube was
      // 2). The beat carries the peer's cube and, since Fix 1, its pending offer: if I am still
      // waiting on an offer the peer has already resolved, resolve it here the same way.
      if (pendingDouble && !s.pendingDouble) {
        if ((s.cubeValue || 1) > game.doublingCubeValue) {
          sysLog(`[Resync] Peer holds the cube at ${s.cubeValue} — its ACCEPT never arrived; applying it here.`);
          applyAcceptDouble();
          return;
        }
        if (s.winner && !game.winner) {
          sysLog('[Resync] Peer shows the game over — its DECLINE never arrived; applying it here.');
          applyDeclineDouble();
          return;
        }
      }

      const behind = s.turnCount > game.turnCount;
      // Same turnCount but a divergent handoff (only the end_turn was lost → whose-turn differs,
      // or a board drift): the guest defers to the host (authoritative). Convergence is safe —
      // any real end_turn that later arrives re-asserts the same authoritative nextPlayer/board.
      const tieDeferToHost = (s.turnCount === game.turnCount) && (localPlayerRole === 2) &&
        (game.currentPlayer !== s.currentPlayer ||
         boardSig(game.points, game.bar, game.borneOff) !== boardSig(s.points, s.bar, s.borneOff));
      if (behind || tieDeferToHost) {
        sysLog(`[Resync] Adopting opponent's authoritative state (mine t${game.turnCount}/p${game.currentPlayer} → t${s.turnCount}/p${s.currentPlayer}).`);
        adoptRemoteState(s);
      }
    }

    // Sever the online connection WITHOUT reloading the page (the "Leave" button). Clears our
    // presence so the opponent is notified, stops the heartbeat, detaches all listeners, and
    // restores the local single-machine controls so play can continue offline immediately.
    function leaveNetworkGame() {
      if (!isNetworkGame) return;
      const wasGuest = (localPlayerRole === 2);
      stopHeartbeat();
      stopInboundWatchdog();
      if (conn) { try { conn.close(); } catch (e) {} conn = null; }
      isNetworkGame  = false;
      localPlayerRole = null;
      currentRoomCode = null;
      reconnecting   = false;
      pendingDouble  = null;
      networkQueue   = [];
      isProcessingQueue = false;

      // A network game had forced both seats to Human and locked the type/depth menus — undo that.
      const p1t = document.getElementById('p1-type');
      const p2t = document.getElementById('p2-type');
      if (p1t) p1t.disabled = false;
      if (p2t) p2t.disabled = false;
      syncDepthMenu(1);
      syncDepthMenu(2);

      // Restore local privileges the network game disabled. Most guest restrictions (Restart,
      // rolling, drag, nav) are runtime checks on isNetworkGame and clear automatically now that
      // it's false; the two PERSISTENT changes must be undone explicitly:
      //  • the GUEST's Time Travel was forced OFF by initNetworkGame — turn it back on.
      if (wasGuest) { timeTravelOn = true; updateSettingBadge('badge-timetravel', timeTravelOn); }
      //  • the Start button was disabled during network setup — re-enable it for local play.
      const btnStart = document.getElementById('btn-start-game');
      if (btnStart) { btnStart.disabled = false; btnStart.style.opacity = '1'; }

      // Keep the network-status line visible (it just reports the disconnect); only free the
      // room-code field and update the status text.
      if (joinCodeInput) joinCodeInput.readOnly = false;
      if (connStatus) { connStatus.textContent = 'Not connected.'; connStatus.style.color = ''; }
      // Restore the HOST/JOIN buttons (the HOST label reverted from its role-indicator state).
      if (btnHost) { btnHost.textContent = 'HOST'; btnHost.disabled = false; btnHost.style.opacity = '1'; }
      if (btnJoin) { btnJoin.disabled = false; btnJoin.style.opacity = '1'; }

      sysLog('[Network] Left the online game — connection severed.');
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

      // Turn the HOST button into a disabled ROLE indicator for THIS machine — "HOST" on the host,
      // "GUEST" on the guest — so the role is visible on screen (and in screenshots). Also disable
      // JOIN, so nobody re-joins mid-game (that resets local state / replays history and wrecks it).
      if (btnHost) { btnHost.textContent = localPlayerRole === 1 ? 'HOST' : 'GUEST'; btnHost.disabled = true; btnHost.style.opacity = '0.6'; }
      if (btnJoin) { btnJoin.disabled = true; btnJoin.style.opacity = '0.6'; }

      if (localPlayerRole === 1) {
        // Pre-game handshake ONLY. `sync` is a blind, unconditional board overwrite on the
        // receiving side, which is safe exactly once: before play starts, when the host's board
        // is authoritative by construction. It is NOT safe on a mid-game re-open, because the
        // watchdog reconnects precisely WHEN THIS MACHINE'S INBOUND HAS STALLED — i.e. when our
        // board is most likely to be missing the guest's latest moves — so broadcasting it would
        // rewind the guest's own checkers. (That is exactly the 8/16 19:01 desync: a stale sync
        // at 19:01:58 reverted the guest's 19/24, silently, for ~40 s.) Mid-game reconciliation
        // is the heartbeat's job — it has the guards `sync` lacks (turnCount comparison, stable
        // boundary, queue check, never overwrite my own live turn).
        if (!gameStarted) {
          connection.send({
            type: 'sync',
            points: game.points,
            bar: game.bar,
            borneOff: game.borneOff
          });
        }
        document.getElementById('btn-start-game').disabled = false;
        document.getElementById('btn-start-game').style.opacity = '1';
      }
      startHeartbeat();   // begin periodic authoritative-state broadcasts (both sides)
      lastInboundAt = Date.now();   // channel is live; reset the inbound watchdog clock
      reconnecting = false;
      startInboundWatchdog();       // auto-reconnect if inbound later goes silent
    };

    if (connection.open) handleOpen();
    else connection.on('open', handleOpen);

connection.on('data', (data) => {
      lastInboundAt = Date.now();   // watchdog: mark that inbound is alive
      sysLog(`[Network] Received: ${data.type}`);

      if (data.type === 'sync') {
          // Pre-game only — see the send site in handleOpen. Once a game is under way the
          // heartbeat is the authoritative reconciler, and a `sync` (which carries no turnCount
          // and gets applied unconditionally) can only do harm: a reconnecting peer whose inbound
          // stalled would rewind our board to its stale copy.
          if (gameStarted) {
            sysLog('[Network] Ignoring mid-game sync (heartbeat is authoritative).');
          } else {
            game.points = data.points;
            game.bar = data.bar;
            game.borneOff = data.borneOff;
            updateUI();
          }
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
          // Duplicate guard: if a heartbeat already advanced us to/past this roll's turnCount,
          // applying it again would double-increment the anchor. Skip in that case.
          if (data.turnCount !== undefined && data.turnCount <= game.turnCount) {
            sysLog(`[Network] Ignoring already-applied roll (turn ${data.turnCount} ≤ local ${game.turnCount}).`);
          } else {
          // 1. Apply engine state instantly
          game.rollDice(data.dice[0], data.dice[1]);
          if (data.turnCount !== undefined) game.turnCount = data.turnCount;  // keep the anchor aligned
          // ⚠ DUPLO OVER THE NETWORK: each machine rolls only its OWN dice, so a buffered
          // replay would be consumed at half speed here and the head would then belong to the
          // other side — which rollDice's guard reads as misalignment and answers by throwing
          // the whole buffer away. Step over the entry the opponent just used, so both
          // machines walk the same buffer in lockstep and the guard keeps its meaning.
          const fr = game.futureRolls[game.futureRollIndex];
          if (fr && fr.p === data.player && fr.d[0] === data.dice[0] && fr.d[1] === data.dice[1]) {
            game.futureRollIndex++;
          }
          }

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
      else if (data.type === 'duplo') {
          // The host replays the finished game with the luck reversed. Seats do not move, so
          // host stays host and guest stays guest; both sides install the same mirrored board
          // and the same roll buffer.
          sysLog('[Network] DUPLO received (' + (data.cap ? data.cap.rolls.length : 0) + ' rolls).');
          if (data.cap) {
            applyRestartNewGame(data.cap.opener === 1 ? 2 : 1, null, false, data.cap);
            duploTarget = data.cap;
            gameMessageEl.textContent = 'DUPLO — the same game with the luck reversed.';
          }
      }
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

      // Periodic authoritative state — recovers a silent deadlock from a lost turn/message.
      else if (data.type === 'heartbeat') {
          handleHeartbeat(data);
      }

      // Move-list integrity: a side that just resynced its board (adoptRemoteState) asks the peer
      // for its authoritative full move history so its list has no gap.
      else if (data.type === 'sync_request') {
          netSend({ type: 'sync_full', history: game.gameHistory });
      }
      else if (data.type === 'sync_full') {
          if (Array.isArray(data.history) && data.history.length >= game.gameHistory.length) {
            game.gameHistory = JSON.parse(JSON.stringify(data.history));
            sysLog(`[Network] Move history rebuilt from peer (${game.gameHistory.length} entries).`);
            renderHistoryList();
          }
      }
    });

    connection.on('close', () => {
      connStatus.textContent = "Opponent Disconnected.";
      connStatus.style.color = "#ef4444";
      stopHeartbeat();
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
      .then(() => { currentRoomCode = roomCode; conn = makeFirebaseConnection(roomCode, 1); setupConnectionListeners(conn); })
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
      currentRoomCode = code;
      conn = makeFirebaseConnection(code, 2);
      setupConnectionListeners(conn);
    }).catch((e) => { sysLog('[Network] Join failed: ' + e.message); connStatus.textContent = "Join failed."; connStatus.style.color = '#ef4444'; });
  });

  // Allow pressing Enter in the code field to join (same as clicking JOIN)
  joinCodeInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') btnJoin.click();
  });

// --- LEAVE (sever the online connection; no confirmation) ---
  const btnQuit = document.getElementById('btn-quit');
  if (btnQuit) {
    btnQuit.addEventListener('click', () => {
      if (!isNetworkGame) { sysLog('[Network] Leave: not currently in an online game.'); return; }
      // Sever the connection only — no page reload (that's the "Reset" button's job).
      leaveNetworkGame();
    });
  }

// --- RESET (reload the page; no confirmation) ---
  const btnDefaults = document.getElementById('btn-defaults');
  if (btnDefaults) {
    btnDefaults.addEventListener('click', () => {
      window.location.reload();
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
       netSend({ type: 'move', from, to });
    }
    return success;
  };

  const originalUndo = BackgammonGame.prototype.undo;
  
  game.undo = function() {
    const success = originalUndo.apply(this);
    
    if (success && isNetworkGame && this.currentPlayer === localPlayerRole) {
      netSend({ type: 'undo' });
    }
    return success;
  };

    
const originalEndTurn = BackgammonGame.prototype.endTurn;
  
  game.endTurn = function() {
    // Record who the active player was before the engine switches it
    const activeBefore = this.currentPlayer;
    const snapsBefore  = this.gameHistory.length;
    const result = originalEndTurn.apply(this);

    // Bank this turn's wall clock onto the snapshot the engine just pushed (it only
    // pushes one when a player was actually on roll), then start the next seat's clock.
    if (activeBefore !== null && this.gameHistory.length > snapsBefore) {
      bankTurn(activeBefore, this.gameHistory[this.gameHistory.length - 1]);
    } else {
      clockRestart();
    }
    
    // Broadcast the explicit end-turn signal if we were the active player, and
    // include an authoritative board snapshot so the opponent reconciles to it each
    // turn (self-healing: corrects any drift from imperfect move replay).
    if (isNetworkGame && activeBefore === localPlayerRole) {
      netSend({
        type: 'end_turn',
        points: this.points, bar: this.bar, borneOff: this.borneOff,
        cubeValue: this.doublingCubeValue, cubeOwner: this.doublingCubeOwner,
        // Authoritative turn ownership so the receiver sets whose turn it is / the turn number
        // from the sender instead of inferring it by a local flip (which drifts if a turn was
        // ever missed). endTurn has already run here, so currentPlayer is the new on-roll side.
        nextPlayer: this.currentPlayer, turnCount: this.turnCount
      });
    }
    return result;
  };

  function startGame(isRemote = false) {
    if (gameStarted) {
      // If AI was stopped, START re-enables it and triggers the AI turn
      if (aiStopped) {
        aiStopped = false;
        clockRun();
        const btnStart = document.getElementById('btn-start-game');
        if (btnStart) { btnStart.disabled = true; btnStart.style.opacity = '0.5'; }
        sysLog('[System] AI resumed by START.');
        updateUI(); // triggers checkAndTriggerAITurn
      }
      return;
    }
    
    if (!isRemote) {
        netSend({ type: 'start' });
    }

    gameStarted = true;
    setupOriginBoard = null;    // ordinary game from the standard start → Restart uses the standard start
    beginSeededGame(null, null);   // DUPLO: fresh dice stream; the roll-off decides the opener
    duploTarget = null;            // explicitly beginning a new game -> DUPLO follows it
    initialRollOff = true;
    game.currentPlayer = 1;
    game.hasRolled = false;
    resetBothScores();          // Start zeros the running score (Restart keeps it)
    gameScored = false;
    winTurnRecorded = false;
    gameRecorded = false;
    gameClockReset();

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
    // DUPLO: when a seeded dice stream is installed on the engine (every LOCAL game),
    // every die must come from it or the game cannot be replayed. secureRoll() is the
    // fallback for network games, where the engine is deliberately left unseeded.
    // NB the engine's own reject-doubles loop in rollForFirstTurn() consumes draws in
    // exactly this pattern, so the replay in applyRestartNewGame stays in lockstep.
    const rollOne = () => (game.rng ? game._die() : secureRoll());
    // -------------------------

    let d1, d2;

    if (initialRollOff) {
        do {
            d1 = rollOne();
            d2 = rollOne();
        } while (d1 === d2);
        sysLog('[DUPLO-diag] live roll-off -> dice ' + d1 + '-' + d2 + ', seed in force ' + liveGame.seed);
        game.rollForFirstTurn(d1, d2);
        initialRollOff = false;
        lastStarter = game.currentPlayer;   // remember the opener so Restart can alternate
        // For an all-blank set-up launch, capture the roll-off so Restart can replay the same start.
        if (setupOriginBoard && !setupOriginBoard.starter) {
          setupOriginBoard.starter = game.currentPlayer;
          setupOriginBoard.dice = [d1, d2];
        }

        netSend({ type: 'roll_first', dice: [d1, d2] });
    } else {
        // Replay mode: reuse the pre-recorded dice for deterministic replay after
        // a time-travel restore. Falls back to secureRoll() once exhausted.
        //
        // GUARD: a buffered roll is replayed ONLY if it belongs to the side now on roll (each
        // entry is tagged with its player). If the next buffered entry is for the OTHER side,
        // the buffer is misaligned — discard it entirely and roll fresh rather than hand this
        // player the opponent's recorded dice (the "copies the opponent's roll" bug).
        const fr = game.futureRolls[game.futureRollIndex];
        if (fr && fr.p === game.currentPlayer) {
            [d1, d2] = fr.d;
            game.futureRollIndex++;
        } else {
            if (fr) {                       // misaligned buffered roll → drop the whole buffer
                game.futureRolls = [];
                game.futureRollIndex = 0;
            }
            d1 = rollOne();
            d2 = rollOne();
        }

        const result = game.rollDice(d1, d2);
        if (result) {
            // Tag with the post-roll turnCount + roller so the receiver keeps turnCount aligned
            // (the anchor the heartbeat uses to detect a missed turn).
            netSend({ type: 'roll', dice: [d1, d2], player: game.currentPlayer, turnCount: game.turnCount });
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
    setupKind = kind;
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
    historyListEl.innerHTML = '<div style="padding:6px 4px;font-size:0.72rem;font-weight:bold;">Entering Examination Mode</div>';  // green window until MOV / PLAY
    renderPoints(); renderBar(); renderBorneOff();
    const btnStart = document.getElementById('btn-start-game');
    if (btnStart) { btnStart.disabled = false; btnStart.style.opacity = '1'; }
  }

  function exitSetup() {
    setupMode = false;
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
  // The brain row 12 analyses with — MOV, PLAY, and the Move Table while in examination mode.
  //  - Net Analysis ON (the default): the row-18 net, the same brain that scores a human's
  //    play in the move list. A net has no editable parameters, so the row-15 fields do not
  //    apply — which was already true whenever a net was picked in row 13.
  //  - Net Analysis OFF: the row-13 personality with the row-15 parameter fields overlaid
  //    LIVE, so that editing a weight and pressing MOV again shows its effect at once.
  // Falls back to the row-13 brain for any render where the chosen net's weights have not
  // arrived yet (see analysisBrainName).
  function setupAnalysisName() {
    if (netAnalysisOn) {
      const n = analysisBrainName();
      if (isNetScore(game.personalityWeights(n))) return n;
    }
    return (editBrainSel && editBrainSel.value) || 'Arwen';
  }
  function setupAnalysisWeights() {
    const base = game.personalityWeights(setupAnalysisName());
    if (isNetScore(base)) return base;   // no editable fields to overlay
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

  function facesText(faces) { return faces[0] === faces[1] ? `${faces[0]}-${faces[0]}` : `${faces[0]}-${faces[1]}`; }

  // P(White wins) for every candidate move, keyed by the move text renderMoveList prints.
  // The RANKING number is the search's equity, `depth` plies deep; this is the net's STATIC
  // read of the position the move leads to — the very thing the move list's Score column
  // shows once the move has been played, with the same convention (White's view, the
  // opponent on roll there). At depth 2 or more the two therefore answer slightly different
  // questions, and a move can win more often while being worth fewer points.
  function winPctByMove(W, board, player, dice) {
    const map = new Map();
    if (!isNetScore(W) || !W.net) return map;
    const opp = player === 1 ? 2 : 1;
    const s = new game.constructor();
    s.points = board.points; s.bar = board.bar; s.borneOff = board.borneOff;
    s.generateAllCompleteTurnMoves(player, dice).forEach((st) => {
      map.set(moveText(st.moves), whiteWinPct(W, st.points, st.bar, st.borneOff, opp));
    });
    return map;
  }

  function renderMoveList(ranked, player, faces, isNet, winPct) {
    const who = player === 1 ? 'White' : 'Red';
    const units = isNet ? ' — White win % and equity' : '';
    let html = `<div style="font-size:0.72rem;font-weight:bold;padding:2px 4px;border-bottom:1px solid rgba(255,255,255,0.25);flex:0 0 auto;">${who} ${facesText(faces)} — ${ranked.length} move${ranked.length === 1 ? '' : 's'} (best first)${units}</div>`;
    if (ranked.length === 0) {
      html += `<div style="padding:6px 4px;font-size:0.72rem;">No legal moves — ${who} dances.</div>`;
    } else {
      html += `<div style="overflow-y:auto;flex:1 1 auto;">`;
      ranked.forEach((r, i) => {
        const txt = moveText(r.moves);
        const pct = winPct ? winPct.get(txt) : null;
        const pctCell = (pct == null) ? ''
          : `<span style="font-variant-numeric:tabular-nums;font-weight:bold;color:${winPctColor(pct)};min-width:34px;text-align:right;">${pct}%</span>`;
        html += `<div style="display:flex;align-items:baseline;gap:8px;padding:2px 4px;font-size:0.72rem;${i === 0 ? 'background:rgba(255,255,255,0.14);' : ''}"><span style="flex:1 1 auto;">${txt}</span>${pctCell}<span style="font-variant-numeric:tabular-nums;opacity:0.9;min-width:48px;text-align:right;">${fmtBrainValue(r.value, isNet)}</span></div>`;
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
    const W = setupAnalysisWeights();
    const ranked = await rankMovesFor(board, player, dice, depth, W);
    if (!setupMode) return;   // exited during the await
    renderMoveList(ranked, player, faces, isNetScore(W), winPctByMove(W, board, player, dice));
    gameMessageEl.textContent = setupBaseMsg;
  }

  // START (row 5) in examination mode does the SAME as PLAY: launch a real, recorded game
  // from the current position with the WP/RP participants — for every setup kind (EX/CL/IN).
  function doSTART() {
    if (!setupMode) return;
    startGameFromCurrentBoard();
  }

  // Launch a normal, fully-recorded game from whatever is currently on the board, using the
  // WP/RP participants (rows 6/7). Exits examination mode and hands off to the normal pipeline
  // (updateUI → checkAndTriggerAITurn), which drives any AI seat, lets a human seat play, and
  // populates the move list (row 10) with the usual time-travel navigation and analysis.
  function startGameFromCurrentBoard() {
    const allBlank = setupAllBlank();
    setupMode = false;
    clearSetupHighlight();
    // Remember this launch position so Restart replays THIS set-up position with the SAME opening
    // player and the SAME opening dice (not alternated / re-rolled). starter/dice are filled just
    // below for a resolved opening, or at the roll-off (handleRollClick) for an all-blank launch.
    setupOriginBoard = {
      points:   JSON.parse(JSON.stringify(game.points)),
      bar:      { ...game.bar },
      borneOff: { ...game.borneOff },
      starter:  null,
      dice:     null,
    };
    // Fresh game from the current board: clear history + cube, keep the position.
    game.gameHistory = []; game.turnHistory = []; game.playedMovesThisTurn = [];
    game.turnCount = 0; game.futureRolls = []; game.futureRollIndex = 0;
    game.doublingCubeValue = 1; game.doublingCubeOwner = null; game.winner = null;
    historyNavBuffer = []; historyNavIndex = null;
    gameStarted = true; aiStopped = false;
    beginSeededGame(null, null);   // DUPLO: fresh dice stream for this set-up launch
    gameScored = false; winTurnRecorded = false; gameRecorded = false;
    gameClockReset();
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
      lastStarter = player;                 // record the opener so Restart takes the replay path
      setupOriginBoard.starter = player;    // replay the SAME opener + dice on Restart
      setupOriginBoard.dice = [faces[0], faces[1]];
    }
    clearSetupDice();
    updateUI();   // normal pipeline resumes; checkAndTriggerAITurn drives any AI side
  }

  // The PLAY button: apply the single best move for the on-roll side and hand the roll to the
  // other side — a one-move analysis stepper (pairs with MOV, which just lists/ranks the moves).
  // Stays in examination mode. START (row 5) is the one that launches a full recorded game.
  async function doPLAY() {
    if (!setupMode) return;
    const { player, dice, faces } = resolveMoverAndDice();
    showDiceForSide(player, faces);
    const who = player === 1 ? 'White' : 'Red';
    const board = { points: game.points, bar: game.bar, borneOff: game.borneOff };
    const ranked = await rankMovesFor(board, player, dice, playerDepth(player), setupAnalysisWeights());
    if (!setupMode) return;   // exited during the await
    if (ranked.length === 0) {
      gameMessageEl.textContent = `Examination Mode — ${who} dances on ${facesText(faces)}.`;
      setupOnRoll = player === 1 ? 2 : 1;
      clearSetupDice();
      return;
    }
    const best = ranked[0].moves;
    // Apply the chosen sequence via the engine. makeMove reads currentPlayer/movesLeft, so set
    // them first; validateMax=false since the sequence is already legal. When animation is on,
    // fly each sub-move before committing it (mirrors the AI path).
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

  document.getElementById('btn-ex')?.addEventListener('click', () => enterSetup('examine'));
  document.getElementById('btn-clear')?.addEventListener('click', () => enterSetup('clear'));
  document.getElementById('btn-initial')?.addEventListener('click', () => enterSetup('initial'));
  document.getElementById('btn-mov')?.addEventListener('click', doMOV);
  document.getElementById('btn-play')?.addEventListener('click', doPLAY);

}); // This closing brace now correctly wraps all your event-dependent logic.
