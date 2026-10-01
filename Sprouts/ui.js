/* =========================================================================
   ui.js — Sprouts page controller: menus, canvas, pointer input, rendering.
   Geometry lives in geom.js (SproutsGeom), routing in relax.js (SproutsRelax).

   All game geometry is in WORLD coordinates. The world rectangle W0 x H0 is
   the size of the drawing area (in CSS pixels) when the game was started;
   when the window is resized the picture is scaled uniformly and centred.
   ========================================================================= */
(function () {
  'use strict';
  var G = SproutsGeom, R = SproutsRelax, Rt = SproutsRoute, E = SproutsEngine, D = SproutsDescribe, Rm = SproutsRoom, Rd = SproutsRedraw, Ly = SproutsLayout, AI = SproutsAI, Nt = SproutsNet;
  /* moves.js (v137): the router's pieces and making room, shared with the room worker. They read and
     write the page's own game, settings, spot size, note and hush through MS. */
  var Mv = SproutsMoves, MS = { say: function (text, warn, detail, plain) { say(text, warn, detail, plain); } };
  Object.defineProperty(MS, 'game', { get: function () { return game; }, set: function (v) { game = v; } });
  Object.defineProperty(MS, 'route', { get: function () { return route; } });
  Object.defineProperty(MS, 'spotR', { get: function () { return SPOT_R; } });
  Object.defineProperty(MS, 'note', { get: function () { return note; }, set: function (v) { note = v; } });
  Object.defineProperty(MS, 'hush', { get: function () { return hush; }, set: function (v) { hush = v; } });
  var Mk = Mv.create(MS);
  var tangentsAt = Mk.tangentsAt, sideTest = Mk.sideTest, choosePort = Mk.choosePort, makeBand = Mk.makeBand, arrivalSide = Mk.arrivalSide,
      trialMove = Mk.trialMove, armFor = Mk.armFor, loopStart = Mk.loopStart, markedRoute = Mk.markedRoute,
      segIntersection = Mk.segIntersection, cornerProbe = Mk.cornerProbe;

  var SPOT_R0 = 6, LINE_W0 = 2.5;   // spot radius and curve width at scale 1 (Settings → Spot size, Curve thickness: × 0.5 … 3, v44; defaults × 1.7, × 1.3 from Peter's game of 9/26, v56)
  var NUMBER_PX0 = 13, NUMBER_PX = NUMBER_PX0;   // spot numbers' font size at scale 1 (Settings → Number size: × 0.5 … 3, v56; default × 1.6 from Peter's game of 9/26, v58)
  var SPOT_R = 6;        // drawn radius of a spot — also what curves keep clear of (the disc), so a bigger spot needs more room
  var SNAP = 16;         // a stroke starts/ends at a spot if within this distance
  var STEP = Mv.STEP;    // arc-length spacing of the resampled stroke (moves.js)
  var TOL = 1.5;         // largest allowed distance between the relaxed band and the fitted spline
  var STEPS_PER_FRAME = 4;
  var RELAY_FRAME_MS = 30;   // A / R: descent steps per animation frame for about this long (v51: they run to convergence)
  var route = { d0: 10, D: 40, lambda: 1, animate: true, click: true, shiftSpots: true, shiftCurves: true, adjustAfter: false, redrawAfter: false, heroic: false, triangles: false, smallDead: true, deadNumbers: false, spotScale: 1.7, lineScale: 1.3, numberScale: 1.6 };   // the Settings and Room menus
  var LINE_W = 2.5;
  var MIN_SEP = 4 * SNAP; // least distance between initial spots

  /* v41 (Peter, 9/24): twelve colours as far apart as possible to the eye — the
     smallest CIEDE2000 difference between any two maximized (greedy farthest-point
     choice, then local search; red–green colour-blind differences counted too),
     gray fixed, white bold text legible on each (contrast ≥ 3 : 1) — closest pair
     ΔE 17.9. Third entry: the pastel background of the same hue (OKLCH lightness
     96.5 %, chroma 0.028). Sorted by hue. [name, colour, pastel] */
  var PALETTE = [
    ['Coral', '#f35a6c', '#ffeced'], ['Dark red', '#990000', '#ffede9'], ['Orange', '#fc6300', '#ffeee5'],
    ['Forest', '#126c3f', '#e5f9eb'], ['Sea green', '#51a27e', '#e4faee'], ['Cerulean', '#0193ae', '#e0f9ff'],
    ['Steel blue', '#2d6cab', '#e6f5ff'], ['Indigo', '#4812cf', '#f0f2ff'], ['Plum', '#633f63', '#feedfe'],
    ['Fuchsia', '#fc2dfc', '#ffedfd'], ['Rose', '#ac6488', '#ffecf6'], ['Gray', '#666666', '#f3f3f3']
  ];
  /* v55 (Peter, 9/26): eight plain colours added to every menu but the background,
     after the twelve. [name, colour, text colour in the menu] — black text where
     white would not be legible. */
  var EXTRA = [
    ['Black', '#000000', '#ffffff'], ['Red', '#ff0000', '#ffffff'], ['Green', '#008000', '#ffffff'],
    ['Blue', '#0000ff', '#ffffff'], ['Yellow', '#ffff00', '#000000'], ['Fluorescent yellow', '#ccff00', '#000000'],
    ['Fluorescent green', '#39ff14', '#000000'], ['Fluorescent red', '#ff355e', '#ffffff']
  ];
  /* The curve and spot menus: the twelve (white text) and the eight. */
  var COLOURS = PALETTE.map(function (c) { return [c[0], c[1], '#ffffff']; }).concat(EXTRA);
  /* Backgrounds: white and the twelve pastels. [name, colour, its text colour in the menu] */
  var BACKGROUNDS = [['White', '#ffffff', '#000000']].concat(PALETTE.map(function (c) { return ['Pale ' + c[0].toLowerCase(), c[2], c[1]]; }));
  /* Spots are coloured by degree: how many curve ends are attached (0–3). */
  var COLOUR_ROLES = [
    ['background', 'Background'], ['busy', 'Background while computing'], ['player1', 'Player 1 curves'], ['player2', 'Player 2 curves'],
    ['deg0', 'Spots with 0 curves'], ['deg1', 'Spots with 1 curve'], ['deg2', 'Spots with 2 curves'], ['deg3', 'Spots with 3 curves']
  ];
  /* defaults from Peter's game sprouts-2026-09-26T18-00-49.json (v56); spots with 2 curves Fuchsia (v66) */
  var colours = { background: '#e0f9ff', busy: '#ffffff', player1: '#0000ff', player2: '#ff0000',
                  deg0: '#ac6488', deg1: '#008000', deg2: '#fc2dfc', deg3: '#666666' };
  /* While the program is computing (the computer's turn, A, R, Z, making room) the background is
     Colors → Background while computing (v135, Peter; White by default — it was light gray #c8c8c8
     from v59/v89, which the background list does not offer). */
  var roomBusy = false;  // M or the automatic room-making is at work (makeRoom → makeRoomNow)
  var routeBusy = false; // a marked route is being found in the worker (v139, routeAsync)
  /* Busy (Background while computing): A/R/Z, room-making, the other computer — and the computer's whole turn
     (v134, Peter: it was gray only while thinking, white while its move was drawn and between R and
     its next try), from maybeAI until the move is accepted (aiCommitted) or the turn ends. */
  function computing() { return !!relaying || roomBusy || routeBusy || !!ai || netGray(); }
  function background() { return computing() ? colours.busy : colours.background; }
  function spotColour(sp) { return colours['deg' + Math.min(3, sp.deg)]; }
  /* While a drag is on, the spots a release would join — the destination and
     the start spot, or the start spot alone with two more ends for a loop —
     are shown in the colour they will have AFTER the move (Peter, 9/22:
     release as soon as the colour changes). */
  function shownColour(i) {
    var sp = game.spots[i], add = 0;
    if (stroke && stroke.dest >= 0 && (i === stroke.dest || i === stroke.from)) add = 1;
    else if (stroke && stroke.dest < 0 && stroke.loop && i === stroke.from) add = 2;
    return colours['deg' + Math.min(3, sp.deg + add)];
  }

  /* Spots that have a life left but no move from them (Peter, 9/26 — drawn as
     rings): one life only (with two or three a loop back to the spot itself is
     always a move — v63, Peter: v57 ringed a lone spot with 3 lives), and no
     other spot with a life in any region it borders. Combinatorial, from the
     engine. Kept for the game object and its counts: a move or an added spot
     changes the counts, undo and load replace the object. */
  var stuckKey = null, stuckSet = {};
  function stuckSpots() {
    if (game.phase === 'place') return {};
    if (stuckKey && stuckKey.game === game && stuckKey.ns === game.spots.length && stuckKey.ne === game.edges.length) return stuckSet;
    var set = {}, reach = {}, i;
    try {
      E.analyse(game.spots, game.edges).regions.forEach(function (r) {
        var live = r.spots.filter(function (s) { return game.spots[s].deg < 3; });
        if (live.length > 1) live.forEach(function (s) { reach[s] = true; });
      });
    } catch (err) { return {}; }
    for (i = 0; i < game.spots.length; i++) if (game.spots[i].deg === 2 && !reach[i]) set[i] = true;
    stuckKey = { game: game, ns: game.spots.length, ne: game.edges.length }; stuckSet = set;
    return set;
  }

  var canvas = document.getElementById('board');
  var stage = document.getElementById('stage');
  var ctx = canvas.getContext('2d');
  var statusEl = document.getElementById('status');

  /* spots: {x, y, deg} (lives = 3 - deg).  edges: {a, b, pieces, h, player} — a and b index spots. */
  var game = { W0: 1, H0: 1, spots: [], edges: [], player: 1, moves: 0, phase: 'play' };
  var history = [];      // JSON snapshots of `game`, for Undo
  var historyWhy = {};   // what the snapshot at history[i] was taken for, if not a move (for the Undo log line; not saved)
  var stroke = null;     // { from: spotIndex, pts: [[x,y],...] } while the pointer is down
  var band = null;       // the elastic band being relaxed, while a move is animating
  var relaying = null;   // { kind: 'adjust' | 'redraw', after, st, start, t0, before } while the drawing is adjusted (A) or redrawn (R)
  var lastTry = null;    // how the move being relaxed was chosen ({ ar } armed, or { st } a drag), to arm again if it has no room (v39)
  var armed = null;      // click-to-connect: { a, start, planner, targets } after the first click
  var showPolygons = false;
  var showNumbers = true;   // spots are numbered 1, 2, … in order of creation
  var view = { s: 1, ox: 0, oy: 0, cw: 1, ch: 1 };

  /* ---------------- status line ---------------- */
  var note = null;       // a remark to add to the next move's status line (e.g. why marks were ignored)
  var hush = 0;          // > 0 while a move is only being tried (making room): markedRoute's messages are not shown
  /* The status line speaks without pixels (Peter, 9/26, v63: not meaningful to a
     player); `detail`, the same with the numbers, goes to the log (and console). */
  /* Every status line of a game under way starts "Move N: " (Peter, 9/28,
     v91), N the move being made — the one to come, or at the end the one
     that cannot be made; the messages themselves no longer name it. Not
     while spots are being placed, nor for a guest before the host's game,
     nor (`plain`) for messages about starting or loading a new game (v92). */
  function say(text, warn, detail, plain) {
    if (hush) return;
    if (!plain && game && (game.phase === 'play' || game.phase === 'over') && !(net && net.role === 2 && !net.started)) text = 'Move ' + (game.moves + 1) + ': ' + text;
    if (ai && warn) ai.lastWarn = text;
    statusEl.textContent = text;
    statusEl.classList.toggle('warn', !!warn);
    if (warn || detail) log('Message: ' + (detail || text).replace(/\s{2,}/g, ' '));   // refusals and warnings are part of the record
  }
  /* ---------------- the log ----------------
     A human-readable record of the session (Peter, 9/23): each game's start,
     every move (the spots it joined, its new spot, the region it split or
     the boundaries it joined — see describe.js), undos, loads, the end, and
     any script error. Each line also goes to the browser console; File →
     Save log writes them all to a text file (a page cannot read back the
     console itself, so the log keeps its own copy). */
  var logLines = [];
  var marksUsed = null;  // the spots marked to enclose for the move being routed, for its log line
  var pendingRoom = null; // { a, b, room }: a move refused for lack of room, which M would make room for
  var roomSnapshot = false; // the undo snapshot was taken when room was made, so the move that follows shares it
  var roomCheck = false;  // explainMarkedNoRoom is about to run (connectTo's timeout) — for the computer's watch (v69)
  var slideDrag = null;  // while a spot is moved by hand (Ctrl+drag): see startSpotDrag
  /* Who plays (Player 1 / Player 2 menus, v69): 'human', 'random' (Monte Carlo
     and parity search to come, with their trials / depth). Not saved with a game. */
  var players = { 1: { kind: 'human', trials: 100, depth: 6, mcSeconds: null, parSeconds: null }, 2: { kind: 'parity', trials: 100, depth: 6, mcSeconds: null, parSeconds: 5 } };   // (v73: seconds per move instead of games / depth, when set; v74 defaults, Peter: Human vs Parity search with 5 s)
  var ai = null;         // the computer's move under way: see aiMove
  var aiFresh = null;    // the same for the picture drawn afresh with the computer's move (Z, v114: 2b in aiNext)
  var aiRedrew = null;   // the position (move count and ai.js gameKey) for which the computer last ran R itself because its best moves could not be drawn — once per position (v108: was the move count alone, which a new game or an undo could meet again)
  var AI_DELAY = 300;    // ms between one move's end and the computer's next, so that a move can be seen (the one knob of the AI's pace)
  /* Workers (v71): the pool of Web Workers the searching players use — as many as the machine has by default (menu Workers). */
  var workersMax = Math.max(1, navigator.hardwareConcurrency || 1), workersWanted = workersMax, pool = [], jobs = {}, jobId = 0;
  var AI_CAP = 64;       // the most ways of enclosing boundaries one family contributes to a search node (ai.js children; a stopgap, see the notes)
  function log(text) {
    var t = new Date().toTimeString().slice(0, 8);
    text.split('\n').forEach(function (line, i) { logLines.push((i ? '         ' : t + ' ') + line); });
    console.log(text);
    logDirty = true;
  }
  /* The log SURVIVES A CRASH (v121; Peter's page ran out of memory twice and froze once, and the
     log went with it): it is kept in the browser's local storage as it grows (at most every
     LOG_STORE_MS, and then every LOG_ALIVE_MS anyway with the time the page was last seen alive);
     on the next start the old one is kept apart, and File → "Save the log of the last session"
     writes it out. Local storage may be refused (a private window): then nothing is kept, quietly. */
  var LOG_KEY = 'sprouts-log', LOG_PREV = 'sprouts-log-previous', LOG_STORE_MS = 1000, LOG_ALIVE_MS = 10000, LOG_MAX = 2000000;
  var logDirty = false, logStored = 0, previousLog = null;
  function logHead() { return 'Sprouts log — ' + document.getElementById('app-version').textContent + ', started ' + logStarted + '\n\n'; }
  var logStarted = new Date().toString();
  function storeLog(now) {
    if (!logDirty && now - logStored < LOG_ALIVE_MS) return;
    var text = logHead() + logLines.join('\n') + '\n(the page was last seen running at ' + new Date(now).toTimeString().slice(0, 8) + ')\n';
    if (text.length > LOG_MAX) text = '… (the start is cut off)\n' + text.slice(text.length - LOG_MAX);
    try { localStorage.setItem(LOG_KEY, text); } catch (e) { /* refused or full: nothing kept */ }
    logDirty = false; logStored = now;
  }
  log('Page started: ' + (navigator.hardwareConcurrency || '?') + ' logical processors' + (navigator.deviceMemory ? ', at least ' + navigator.deviceMemory + ' GB of memory (as the browser rounds it)' : '') + '; ' + navigator.userAgent.replace(/^.*(Chrome\/[\d.]+).*$/, '$1') + '.');
  try { previousLog = localStorage.getItem(LOG_KEY); if (previousLog) localStorage.setItem(LOG_PREV, previousLog); else previousLog = localStorage.getItem(LOG_PREV); } catch (e) { previousLog = null; }
  if (previousLog) log('The log of the last session (up to the moment that page last ran) is kept: File → Save the log of the last session.');
  /* What the page is doing, for the log's watch lines */
  function busyWith() {
    var w = [];
    if (relaying) w.push(relaying.kind === 'fresh' ? 'drawing afresh (Z)' : relaying.kind === 'adjust' ? 'adjusting (A)' : 'rearranging (R)');
    if (roomBusy) w.push('making room');
    if (routeBusy) w.push('finding a way for a curve');
    if (ai && ai.thinking) w.push('the computer thinking');
    if (band) w.push('drawing a curve');
    return w.length ? w.join(', ') : 'nothing in particular';
  }
  /* MEMORY and WORKERS now and then (v121): the page's own JavaScript heap (Chrome tells only the
     page's, not the workers'), and how many workers are alive — thinking and drawing */
  function memoryText() {
    var m = performance.memory, mb = function (x) { return Math.round(x / 1048576); };
    return (m ? 'page heap ' + mb(m.usedJSHeapSize) + ' MB (limit ' + mb(m.jsHeapSizeLimit) + ' MB)' : 'page heap unknown') +
           '; workers alive: ' + pool.length + ' thinking, ' + drawPool.length + ' drawing; undo steps: ' + history.length;
  }
  var MEMORY_EVERY_MS = 300000, lastMemory = 0, lastTick = Date.now(), TICK_MS = 1000, wasHidden = false;   // (a hidden tab's timers are slowed by the browser: no watch line then)
  var lastBusy = 'nothing in particular';   // what the page was doing at the last tick — when the block began, near enough (v139: the
                                            // state after a block misnamed it — Peter's 17 s of 10/1 was room-making, logged as "drawing a curve")
  document.addEventListener('visibilitychange', function () { wasHidden = true; });
  setInterval(function () {
    var now = Date.now(), late = now - lastTick - TICK_MS, busy = busyWith();
    /* a tick far later than due: the page's own thread was blocked (a freeze, as far as the user can tell) */
    if (late > 5 * TICK_MS && !document.hidden && !wasHidden) log('Watch: the page did not respond for ' + (late / 1000).toFixed(0) + ' s (busy with: ' + lastBusy + (busy !== lastBusy ? '; afterwards: ' + busy : '') + '); ' + memoryText() + '.');
    lastTick = now; wasHidden = document.hidden; lastBusy = busy;
    if (now - lastMemory > MEMORY_EVERY_MS) { lastMemory = now; if (logLines.length) log('Watch: ' + memoryText() + '; busy with: ' + busyWith() + '.'); }
    storeLog(now);
  }, TICK_MS);
  function rulesName(r) { return r === 'misere' ? 'misère play' : 'normal play'; }
  window.addEventListener('error', function (e) {
    log('Script error: ' + e.message + (e.filename ? ' (' + e.filename.split('/').pop().split('?')[0] + ':' + e.lineno + ')' : ''));
  });
  window.addEventListener('unhandledrejection', function (e) { log('Script error: ' + (e.reason && e.reason.message || e.reason)); });

  /* Players are called by their curve colours ("Blue", "Red"); if both use the
     same colour, "Player 1" and "Player 2". */
  function playerName(p) {
    var mine = colours['player' + p], other = colours['player' + (3 - p)];
    if (mine === other) return 'Player ' + p;
    for (var i = 0; i < COLOURS.length; i++) if (COLOURS[i][1] === mine) return COLOURS[i][0];
    return 'Player ' + p;
  }
  function sayTurn() {
    var w = net && net.session.waiting;
    if (w) {                                      // (v79: my action is on its way to the other computer — the page is gray meanwhile)
      say(w.type === 'move' ? 'Your move is being drawn on the other computer…' : w.type === 'undo' ? 'Undoing on the other computer…' : 'Starting the game on the other computer…');
    } else if (net && net.role === 2 && !net.started) {
      say('Connected as guest.   Waiting for the host to start a game…');
    } else if (game.phase === 'place') {
      say('Click to place the spots (' + game.spots.length + ' so far), then press Enter or N to start.');
    } else if (game.phase === 'over') {
      sayGameOver();
    } else {
      say(playerName(game.player) + (net ? (game.player === net.role ? ' (you)' : ' (the other computer)') : '') + ' to move   ' + countsText());
    }
  }
  /* "L=9  m=2  M=7  K=1" (Peter, 9/27, v75; L 9/28, v91): L the lives left on
     the board (all of them, also those no curve can reach any more), m and M
     the least and most moves the game can still last (ai.js bounds: M exact,
     m the pharisee count of v76), K the spots with one life and nowhere to go
     (the rings). */
  function countsText() {
    if (game.phase !== 'play' && game.phase !== 'over') return '';
    var b = AI.bounds(AI.fromAnalysis(E.analyse(game.spots, game.edges), game.spots));
    return 'L=' + b.L + '  m=' + b.m + '  M=' + b.M + '  K=' + Object.keys(stuckSpots()).length;
  }
  /* The player to move has no move. Normal play: they lose; misère: they win. */
  /* (for the status line, `brief`: without the count of moves — say puts the move number in front) */
  function gameOverText(brief) {
    var stuck = playerName(game.player), other = playerName(3 - game.player);
    var misere = game.rules === 'misere';
    return stuck + " can't move — " + (misere ? stuck + ' wins (misère).' : other + ' wins.') + (brief ? '   Game over.' : '   Game over after ' + game.moves + ' moves.');
  }
  function sayGameOver() { say(gameOverText(true)); }

  /* ---------------- view ---------------- */
  function resizeCanvas() {
    var dpr = window.devicePixelRatio || 1;
    view.cw = stage.clientWidth; view.ch = stage.clientHeight;
    canvas.width = Math.max(1, Math.round(view.cw * dpr));
    canvas.height = Math.max(1, Math.round(view.ch * dpr));
    view.s = Math.min(view.cw / game.W0, view.ch / game.H0);
    view.ox = (view.cw - game.W0 * view.s) / 2;
    view.oy = (view.ch - game.H0 * view.s) / 2;
    draw();
  }
  function toWorld(e) {
    var r = canvas.getBoundingClientRect();
    return [(e.clientX - r.left - view.ox) / view.s, (e.clientY - r.top - view.oy) / view.s];
  }

  /* ---------------- drawing ---------------- */
  /* The page's title carries the game's numbers (v126, Peter): "Sprouts v. N" with no game (spots being
     placed), else "Sprouts v. N   yyy: P = …  L = …  m = …  M = …  K = …  R = …" — yyy the move number as
     on the status line, P the spots not made by moves (original and hand-added), L m M K as countsText,
     R the regions (the outside included). Updated from draw, but not while the page computes, redraws or
     animates a move, so the numbers change with each move only; recomputed only when the position's
     signature changes. */
  var titleKey = null;
  function updateTitle() {
    if (computing() || band) return;
    var v = 'Sprouts v. ' + (document.getElementById('app-version').textContent.match(/[\d.]+$/) || [''])[0];
    if (game.phase !== 'play' && game.phase !== 'over') { titleKey = null; if (document.title !== v) document.title = v; return; }
    var key = game.phase + '|' + game.moves + '|' + game.spots.length + '|' + game.edges.map(function (e) { return e.a + '-' + e.b; }).join(',');
    if (key === titleKey) return;
    titleKey = key;
    var an = E.analyse(game.spots, game.edges), b = AI.bounds(AI.fromAnalysis(an, game.spots));
    document.title = v + '   ' + (game.moves + 1) + ': P = ' + (game.spots.length - game.moves) + '  L = ' + b.L + '  m = ' + b.m + '  M = ' + b.M +
      '  K = ' + Object.keys(stuckSpots()).length + '  R = ' + an.regions.length;
  }
  function draw() {
    updateTitle();
    var dpr = window.devicePixelRatio || 1, i, j, e, b;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = background();
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr * view.s, 0, 0, dpr * view.s, dpr * view.ox, dpr * view.oy);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';

    for (i = 0; i < game.edges.length; i++) {
      e = game.edges[i];
      ctx.beginPath();
      ctx.moveTo(e.pieces[0][0][0], e.pieces[0][0][1]);
      for (j = 0; j < e.pieces.length; j++) {
        b = e.pieces[j];
        ctx.bezierCurveTo(b[1][0], b[1][1], b[2][0], b[2][1], b[3][0], b[3][1]);
      }
      ctx.strokeStyle = e.player === 1 ? colours.player1 : colours.player2;
      ctx.lineWidth = LINE_W;
      ctx.stroke();
    }

    if (showPolygons) {
      ctx.strokeStyle = '#888888'; ctx.fillStyle = '#888888'; ctx.lineWidth = 1;
      for (i = 0; i < game.edges.length; i++) {
        for (j = 0; j < game.edges[i].pieces.length; j++) {
          b = game.edges[i].pieces[j];
          ctx.beginPath();
          ctx.moveTo(b[0][0], b[0][1]); ctx.lineTo(b[1][0], b[1][1]);
          ctx.lineTo(b[2][0], b[2][1]); ctx.lineTo(b[3][0], b[3][1]);
          ctx.stroke();
          ctx.fillRect(b[1][0] - 2, b[1][1] - 2, 4, 4);
          ctx.fillRect(b[2][0] - 2, b[2][1] - 2, 4, 4);
          ctx.beginPath(); ctx.arc(b[3][0], b[3][1], 2, 0, 2 * Math.PI); ctx.fill();
        }
      }
    }

    if (slideDrag && slideDrag.mode === 'extend' && slideDrag.trail.length > 1) {   // the extension being drawn by hand
      ctx.beginPath(); ctx.moveTo(slideDrag.trail[0][0], slideDrag.trail[0][1]);
      for (i = 1; i < slideDrag.trail.length; i++) ctx.lineTo(slideDrag.trail[i][0], slideDrag.trail[i][1]);
      var eo = game.edges[slideDrag.one.e];
      ctx.strokeStyle = eo.player === 1 ? colours.player1 : colours.player2;
      ctx.globalAlpha = 0.5; ctx.lineWidth = LINE_W; ctx.stroke(); ctx.globalAlpha = 1;
    }
    var poly = stroke && stroke.pts.length > 1 ? [[game.spots[stroke.from].x, game.spots[stroke.from].y]].concat(stroke.pts) : band ? band.pts : null;
    if (poly) {
      ctx.beginPath();
      ctx.moveTo(poly[0][0], poly[0][1]);
      for (i = 1; i < poly.length; i++) ctx.lineTo(poly[i][0], poly[i][1]);
      ctx.strokeStyle = game.player === 1 ? colours.player1 : colours.player2;
      ctx.globalAlpha = 0.5; ctx.lineWidth = LINE_W; ctx.stroke(); ctx.globalAlpha = 1;
    }

    var chosen = stroke ? stroke.from : armed ? armed.a : -1;   // the spot a press or click settled on
    if (chosen >= 0) {
      ctx.beginPath(); ctx.arc(game.spots[chosen].x, game.spots[chosen].y, 3 * SPOT_R, 0, 2 * Math.PI);   // clear of a lit spot's doubled disc
      ctx.strokeStyle = game.player === 1 ? colours.player1 : colours.player2; ctx.lineWidth = 1.5; ctx.stroke();
    }
    var side = armed && armed.start !== armed.spot ? armed.start : stroke && stroke.side ? stroke.side : null;
    if (side) {                                  // the chosen side, as a short stub from the spot
      var from = armed ? armed.spot : [game.spots[stroke.from].x, game.spots[stroke.from].y];
      ctx.beginPath(); ctx.moveTo(from[0], from[1]); ctx.lineTo(side[0], side[1]);
      ctx.strokeStyle = game.player === 1 ? colours.player1 : colours.player2; ctx.lineWidth = LINE_W; ctx.stroke();
    }
    var blocked = armed ? armed.blocked : stroke ? stroke.blocked : null;
    if (blocked) {                               // allowed but no room: a dashed ring where a lit spot's disc would be
      ctx.setLineDash([3, 3]); ctx.lineWidth = 1.5;
      Object.keys(blocked).forEach(function (k) {
        var q = game.spots[k];
        ctx.beginPath(); ctx.arc(q.x, q.y, 2 * SPOT_R, 0, 2 * Math.PI); ctx.strokeStyle = shownColour(Number(k)); ctx.stroke();
      });
      ctx.setLineDash([]);
    }
    var stuck = stuckSpots(), orig = route.triangles ? originalSpots() : {};
    for (i = 0; i < game.spots.length; i++) {
      var sp = game.spots[i], sr = spotRadius(i);
      ctx.fillStyle = shownColour(i);
      if (isMarked(i)) {                         // marked to be enclosed: drawn as a square
        ctx.fillRect(sp.x - 1.1 * sr, sp.y - 1.1 * sr, 2.2 * sr, 2.2 * sr);
      } else if (orig[i]) {                      // Settings → Original spots as triangles (v98): the disc's area, point up; hollow where the disc would be a ring
        var tr = TRI * sr;
        triangle(sp.x, sp.y, tr); ctx.fill();
        if (stuck[i]) { triangle(sp.x, sp.y, Math.max(0, tr - 2 * LINE_W)); ctx.fillStyle = background(); ctx.fill(); }
      } else if (stuck[i]) {                     // lives left, no other spot to reach: a ring as thick as a curve, the background inside
        ctx.beginPath(); ctx.arc(sp.x, sp.y, sr, 0, 2 * Math.PI); ctx.fill();
        ctx.beginPath(); ctx.arc(sp.x, sp.y, Math.max(0, sr - LINE_W), 0, 2 * Math.PI); ctx.fillStyle = background(); ctx.fill();
      } else {
        ctx.beginPath(); ctx.arc(sp.x, sp.y, sr, 0, 2 * Math.PI); ctx.fill();
      }
    }
    if (showNumbers) {
      ctx.font = 'bold ' + NUMBER_PX + 'px Calibri, "Segoe UI", sans-serif';
      ctx.textBaseline = 'bottom';
      for (i = 0; i < game.spots.length; i++) {
        if (!route.deadNumbers && game.spots[i].deg >= 3) continue;   // Settings → no numbers on spots with no lives (G, v133; on by default, over S)
        var r = spotRadius(i), label = String(i + 1), lx = game.spots[i].x + r + 2, ly = game.spots[i].y - r + 2;
        ctx.lineWidth = 3 * NUMBER_PX / NUMBER_PX0; ctx.strokeStyle = background(); ctx.strokeText(label, lx, ly);
        ctx.fillStyle = shownColour(i); ctx.fillText(label, lx, ly);
      }
    }
  }

  /* An equilateral triangle, point up, centered on (x, y), R the distance from
     the center to a corner (v98). TRI: the R that gives a disc's area
     (3√3/4 R² = π r²); the band of a hollow one is LINE_W wide (the inner
     triangle's R is 2·LINE_W less: its sides are LINE_W in). */
  var TRI = Math.sqrt(4 * Math.PI / (3 * Math.sqrt(3)));
  function triangle(x, y, R) {
    ctx.beginPath();
    for (var k = 0; k < 3; k++) { var t = -Math.PI / 2 + 2 * Math.PI * k / 3; ctx[k ? 'lineTo' : 'moveTo'](x + R * Math.cos(t), y + R * Math.sin(t)); }
    ctx.closePath();
  }
  /* The original spots: every spot that is not a move's new spot — the game's
     starting spots and any added by hand (Ctrl+click). A move's edges come in
     pairs 2m, 2m + 1 through its spot (redraw.js moveUnits). */
  function originalSpots() {
    var out = {}, e = game.edges, i;
    for (i = 0; i < game.spots.length; i++) out[i] = true;
    for (i = 0; i + 1 < e.length; i += 2) if (e[i].b === e[i + 1].a) delete out[e[i].b];
    return out;
  }

  /* Possible destinations are drawn at twice their radius while a start spot is armed. */
  /* Settings → Dead spots half size (v130, Peter; on by default): a spot of degree 3 drawn at half the
     diameter. Drawing only — curves still keep clear of the full disc. */
  function spotRadius(i) {
    var t = armed ? armed.targets : stroke ? stroke.targets : null;
    if (t && t[i]) return 2 * SPOT_R;
    return route.smallDead && game.spots[i].deg >= 3 ? SPOT_R / 2 : SPOT_R;
  }
  function isMarked(i) { return !!(armed && armed.markedSpots[i]); }

  /* ---------------- game set-up ---------------- */
  function snapshot(why) { if (why) historyWhy[history.length] = why; history.push(JSON.stringify(game)); }

  function layoutCircle(n, W, H) {
    if (n === 1) return [[W / 2, H / 2]];
    var R = 0.36 * Math.min(W, H);
    if (2 * R * Math.sin(Math.PI / n) < MIN_SEP) return null;
    var pts = [];
    for (var i = 0; i < n; i++) {
      var a = -Math.PI / 2 + 2 * Math.PI * i / n;
      pts.push([W / 2 + R * Math.cos(a), H / 2 + R * Math.sin(a)]);
    }
    return pts;
  }
  /* v88 (Peter, 9/28; the default layout): the circle stretched to the
     window's shape — semi-axes in the ratio W : H (the circle's radius
     fraction of each side). Spots EQUALLY SPACED ALONG THE CURVE (by arc
     length, not by angle, which would bunch them at the ends of a long
     ellipse), the first at the top as on the circle. The arc length is
     summed over a fine polygon of the ellipse. */
  function layoutEllipse(n, W, H) {
    if (n === 1) return [[W / 2, H / 2]];
    var a = 0.36 * W, b = 0.36 * H, K = 64 * n, P = [], len = [0], i;
    for (i = 0; i <= K; i++) { var t = -Math.PI / 2 + 2 * Math.PI * i / K; P.push([W / 2 + a * Math.cos(t), H / 2 + b * Math.sin(t)]); if (i) len.push(len[i - 1] + G.dist(P[i - 1], P[i])); }
    var total = len[K], pts = [], k = 0;
    for (i = 0; i < n; i++) {
      var s = total * i / n;
      while (len[k + 1] < s) k++;
      var f = (s - len[k]) / (len[k + 1] - len[k]);
      pts.push([P[k][0] + f * (P[k + 1][0] - P[k][0]), P[k][1] + f * (P[k + 1][1] - P[k][1])]);
    }
    for (i = 0; i < n; i++) if (G.dist(pts[i], pts[(i + 1) % n]) < MIN_SEP) return null;
    return pts;
  }
  /* v62 (Peter, 9/26): equally spaced along the middle of the window's longer
     side — n spots cut it into n + 1 equal parts. */
  function layoutLine(n, W, H) {
    var horizontal = W >= H, L = horizontal ? W : H, gap = L / (n + 1), pts = [];
    if (n > 1 && gap < MIN_SEP) return null;
    for (var i = 1; i <= n; i++) pts.push(horizontal ? [i * gap, H / 2] : [W / 2, i * gap]);
    return pts;
  }
  function layoutRandom(n, W, H) {
    var margin = 3 * SNAP, pts = [];
    if (W <= 2 * margin || H <= 2 * margin) return null;
    for (var i = 0; i < n; i++) {
      var placed = false;
      for (var tries = 0; tries < 2000 && !placed; tries++) {
        var p = [margin + Math.random() * (W - 2 * margin), margin + Math.random() * (H - 2 * margin)];
        placed = pts.every(function (q) { return G.dist(p, q) >= MIN_SEP; });
        if (placed) pts.push(p);
      }
      if (!placed) return null;
    }
    return pts;
  }

  /* layout: the Game menu's unless given (key 0 asks for 'manual' without changing the menu).
     preview (v102): the new game only shows the menu's layout — a computer to move first waits for N */
  function newGame(layout, preview) {
    if (net && net.role === 2 && !netAllow) { say('Only the host starts games while connected (Net → Leave to play alone).', true, null, true); return; }   // (v79)
    var nb = net && !netAllow ? netBlock(true) : null;
    if (nb) { say(nb, true, null, true); return; }
    if (typeof layout !== 'string') layout = document.getElementById('opt-layout').value;
    var n = Math.floor(Number(document.getElementById('opt-spots').value));
    var W = stage.clientWidth, H = stage.clientHeight, pts = [];
    if (layout !== 'manual') {
      if (!(n >= 1)) { say('The number of spots must be at least 1.', true, null, true); return; }
      pts = layout === 'ellipse' ? layoutEllipse(n, W, H) : layout === 'circle' ? layoutCircle(n, W, H) : layout === 'line' ? layoutLine(n, W, H) : layoutRandom(n, W, H);
      if (!pts) { say('Unable to fit ' + n + ' spots in a window this size.', true, null, true); return; }
    }
    game = {
      W0: W, H0: H, edges: [], player: 1, moves: 0, added: 0,
      phase: layout === 'manual' ? 'place' : 'play', rules: document.getElementById('opt-rules').value,
      spots: pts.map(function (p) { return { x: p[0], y: p[1], deg: 0 }; })
    };
    history = []; historyWhy = {}; stroke = null; band = null; armed = null; pendingRoom = null; roomSnapshot = false; aiCancel(); aiHeld = !!preview; aiHalt = false; titleKey = null; browsing = false; redoList = [];
    log(layout === 'manual' ? 'New game: spots to be placed by hand, ' + rulesName(game.rules) + '.'
                            : 'New game: ' + n + (n === 1 ? ' spot (' : ' spots (') + layout + '), ' + rulesName(game.rules) + '.');
    resizeCanvas();
    netGameStarted();
    sayTurn();
    maybeAI();
  }

  function startPlay() {
    if (game.phase !== 'place') return;
    if (game.spots.length < 1) { say('Place at least one spot first.', true); return; }
    history = []; historyWhy = {};
    game.phase = 'play'; aiHeld = false; browsing = false; redoList = [];
    log('Play starts with ' + game.spots.length + ' spots placed by hand.');
    netGameStarted();
    sayTurn(); draw();
    maybeAI();
  }

  /* U. Connected (v79): either side may undo, and an undone MOVE is undone
     on the other computer too (a step that only changed the picture — room
     made, A, R, a spot moved by hand — is local, like the picture itself).
     `remote`: the other computer undid its last move — take steps off until
     a move is gone (my own picture steps on top of it go with it).
     Against the computer (v93, Peter): undoing the computer's move goes on
     back to the human's turn before it — the human's own last move goes too
     (else the computer would at once play again); when the move to undo is
     the computer's FIRST move of the game there is nothing of the human's to
     go back to, and N is offered instead. Two computers: one step, as before. */
  function undo(remote) {
    if (!history.length) { say('Nothing to undo.', true); return; }
    if (net && !remote) { var nb = netBlock(true); if (nb) { say(nb, true); return; } }
    var vsComputer = !net && !remote && (isAI(1) !== isAI(2));
    if (vsComputer) {
      var prev = JSON.parse(history[history.length - 1]);
      if (prev.moves < game.moves && prev.moves === 0 && isAI(prev.player)) { say('The only move so far is the computer\'s: type N to restart the game.', true); return; }
    }
    var was = game.moves, redo = net ? { game: JSON.stringify(game), entry: history[history.length - 1], why: historyWhy[history.length - 1] } : null;
    do undoStep(); while (remote && history.length && game.moves === was);
    if (vsComputer && game.moves < was) while (history.length && game.phase === 'play' && isAI(game.player)) undoStep();
    stroke = null; band = null; armed = null; if (!remote) aiCancel();
    if (net && !remote && game.moves < was) { netRedo = redo; net.session.undone(was); }
    sayTurn(); draw();
    maybeAI();
  }
  /* < and > (v97, Peter): back and forward through the game one MOVE at a
     time (a move and the picture steps on top of it — room made, A, R, spots
     moved — go and come back together). Unlike U, < takes back any move, the
     computer's too, and nothing is taken back with it; while browsing
     (`browsing`) the computer players wait, so a move can be made by hand in
     the computer's place — a move made anywhere ends the browsing, clears the
     way forward, and the game goes on from there. > at the end of the way
     forward is back at the present, and the computer plays again. The way
     forward (`redoList`) holds, for each step back, the states taken off and
     the position after it; it is dropped as soon as anything else changes
     the game. Not while connected. */
  var redoList = [], browsing = false;
  function stepBack() {
    if (net) { say('Not while connected: U undoes a move on both computers.', true); return; }
    if (!history.length || game.phase === 'place') { say('Nothing to go back to.', true); return; }
    aiCancel(); stroke = null; band = null; armed = null;
    var before = JSON.stringify(game), hist = history.slice(), why = Object.assign({}, historyWhy), was = game.moves;
    do undoStep(); while (history.length && game.moves === was);
    var k = history.length, w = {};
    Object.keys(why).forEach(function (i) { if (Number(i) >= k) w[i] = why[i]; });
    redoList.push({ game: before, hist: hist.slice(k), why: w, base: k, after: JSON.stringify(game) });
    browsing = true;
    sayTurn(); draw();
    maybeAI();
  }
  function stepForward() {
    var r = redoList[redoList.length - 1];
    if (r && (history.length !== r.base || JSON.stringify(game) !== r.after)) { redoList = []; r = null; }   // something else changed the game since
    if (!r) { say('Nothing to go forward to.', true); return; }
    aiCancel(); stroke = null; band = null; armed = null;
    redoList.pop();
    history = history.concat(r.hist);
    Object.keys(r.why).forEach(function (i) { historyWhy[i] = r.why[i]; });
    game = JSON.parse(r.game); pendingRoom = null; roomSnapshot = false;
    log('Redo move ' + game.moves + '.');
    browsing = redoList.length > 0;
    sayTurn(); draw();
    maybeAI();
  }
  function undoStep() {
    var was = game.moves, n = game.spots.length, placing = game.phase === 'place';
    var why = historyWhy[history.length - 1];
    delete historyWhy[history.length - 1];
    game = JSON.parse(history.pop()); pendingRoom = null; roomSnapshot = false;
    log(game.moves < was ? 'Undo move ' + was + '.' : placing ? 'Undo (spot placement).' : why ? 'Undo (' + why + ').' :
        game.spots.length < n ? 'Undo (spot ' + n + ' added by hand).' : 'Undo (spot moved by hand).');
  }

  /* ---------------- pointer input ---------------- */
  /* The nearest spot satisfying `ok(spot, index)` within `radius` (any distance
     if radius is omitted); -1 if none. Clicks need not be precise: the
     closest eligible spot is the one meant (Peter, 9/22). */
  function nearestSpot(p, ok, radius) {
    var best = -1, bd = radius === undefined ? Infinity : radius;
    for (var i = 0; i < game.spots.length; i++) {
      var sp = game.spots[i];
      if (ok && !ok(sp, i)) continue;
      var d = G.dist(p, [sp.x, sp.y]);
      if (d <= bd) { bd = d; best = i; }
    }
    return best;
  }
  function canStart(sp) { return sp.deg < 3; }

  function placeSpot(p) {
    if (p[0] < SPOT_R || p[1] < SPOT_R || p[0] > game.W0 - SPOT_R || p[1] > game.H0 - SPOT_R) return;
    var clear = game.spots.every(function (s) { return G.dist(p, [s.x, s.y]) >= MIN_SEP; });
    if (!clear) { say('Too close to another spot.', true); return; }
    snapshot();
    game.spots.push({ x: p[0], y: p[1], deg: 0 });
    sayTurn(); draw();
  }

  canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  canvas.addEventListener('pointerdown', function (e) {
    if (band || relaying || roomBusy || routeBusy) return;   // (roomBusy, routeBusy: room is made / a route found in a worker, v137, v139)
    var nb = net && (e.button === 0 || e.button === 2) ? netBlock(e.ctrlKey && e.button === 0) : null;   // (v79: not my turn, or the other computer is at work; Ctrl+drag moves spots any time)
    if (nb) { say(nb, true); return; }
    if (ai || (game.phase === 'play' && isAI(game.player) && !browsing)) { say(playerName(game.player) + ' is played by the computer (' + kindName(players[game.player].kind) + '); set it to Human in its menu to play yourself.', true); return; }
    var marking = e.button === 2 || (e.button === 0 && e.shiftKey);
    if (e.button !== 0 && !marking) return;
    closeMenus();
    var p = toWorld(e);
    if (marking) {                                // right-click (or Shift+click): mark a spot to be enclosed
      if (game.phase !== 'play') return;
      if (!armed) { say('First click the starting spot, then right-click the spots to enclose.', true); return; }
      toggleMark(nearestSpot(p));
      return;
    }
    if (game.phase === 'place') { placeSpot(p); return; }
    if (game.phase === 'over') { sayGameOver(); return; }
    if (e.ctrlKey) {                              // Ctrl+click where a spot fits: add one; else Ctrl+drag moves the nearest spot
      var fit = newSpotRoom(p);
      if (fit.ok && net) { say('No spots added by hand while connected: the other computer could not follow.', true); return; }   // (v79)
      if (fit.ok) { addSpot(p, fit); return; }
      if (startSpotDrag(nearestSpot(p), p, fit.why)) canvas.setPointerCapture(e.pointerId);
      return;
    }
    if (armed) {                                  // second click of click-to-connect: the nearest possible destination
      var any = nearestSpot(p);
      if (any === armed.a && !armed.targets[any]) { disarm('Cancelled.'); return; }
      if (armed.blocked[any]) { explainBlocked(any); return; }   // the rules allow it, the room does not: say so
      var t = nearestSpot(p, function (sp, i) { return armed.targets[i]; });
      if (t >= 0) { armed.bside = t !== armed.a ? sideOfClick(t, p) : null; armed.bsideDir = armed.bside ? [p[0] - game.spots[t].x, p[1] - game.spots[t].y] : null; connectTo(t); } else disarm('Cancelled.');   // (v85: a click just outside the spot picks the side it is reached from)
      return;
    }
    marksUsed = null; pendingRoom = null; roomSnapshot = false;
    var i = nearestSpot(p, canStart);
    if (i < 0) { say('No spot has a free connection.', true); return; }
    stroke = { from: i, pts: [p], side: null, targets: {}, planners: {}, dest: -1, loop: false, forgiving: true };   // (forgiving: a hand press may get the other side, v129)
    canvas.setPointerCapture(e.pointerId);
    if (route.click) {                            // light up the possible destinations at once
      stroke.obs = R.buildObstacles(game, SPOT_R);
      stroke.an = E.analyse(game.spots, game.edges);
      updateSide(stroke, p);
    }
    draw();
  });

  canvas.addEventListener('pointermove', function (e) {
    if (slideDrag) { moveSpotDrag(toWorld(e)); return; }
    if (!stroke) return;
    var p = toWorld(e), last = stroke.pts[stroke.pts.length - 1], d = G.dist(p, last);
    if (d < 1) return;
    stroke.pts.push(p);
    if (route.click) {
      if (game.spots[stroke.from].deg === 2) updateSide(stroke, p);
      /* the spot a release here would go to (none while A itself is nearest),
         and whether a return to A would now be a loop stroke (the drag has
         passed nearer another lit spot than A — the same test as pointerup) */
      var a = stroke.from, t = nearestSpot(p, function (sp, i) { return i === a || stroke.targets[i]; });
      stroke.dest = t === a ? -1 : t;
      if (t !== a && t >= 0 && game.spots[a].deg <= 1) stroke.loop = true;
    }
    draw();
  });

  /* Release. With click-to-connect on, what matters is where the pointer is
     released, not how far it travelled (Peter, 9/22: no arbitrary numbers):
     nearer to the starting spot than to any lit destination → a click, and
     the spot stays armed for a second click; otherwise the destination is the
     nearest lit spot, however far from the pointer (as forgiving as the
     press). The drag itself is used as the curve when it is a usable stroke,
     otherwise the route is found. A drag that goes out past another spot and
     comes back to A is a loop stroke, not a click. */
  canvas.addEventListener('pointerup', function () {
    if (slideDrag) { endSpotDrag(); return; }
    if (!stroke) return;
    var st = stroke, end = st.pts[st.pts.length - 1], a = st.from, A = game.spots[a];
    if (!route.click) { finishStroke(); return; }
    stroke = null;
    var t = nearestSpot(end, function (sp, i) { return i === a || st.targets[i] || (st.blocked && st.blocked[i]); });
    var blockedB = st.blocked && st.blocked[t] ? t : -1;   // released nearest a spot there is no room to reach
    if (blockedB >= 0) t = a;                     // … then it is a click on A, and the refusal is explained
    if (t === a) {
      /* back at A: a loop stroke if it went round something (some point of it
         was nearer another lit spot than A — `st.loop`, kept by pointermove),
         else a click */
      if (st.loop && blockedB < 0) { stroke = st; finishStroke(a); return; }
      if (!arm(st)) { draw(); return; }
      if (blockedB >= 0) explainBlocked(blockedB); else sayArmed();
      draw();
      return;
    }
    var b = t;                                    // the nearest lit spot other than A
    if (!strokeRoute(st, b)) {                    // the drag was not usable as a curve: route instead
      var pb = [game.spots[b].x, game.spots[b].y], side = sideOfClick(b, end), path = st.planner.pathTo(pb, side);   // (v85: released just outside the spot: reached by that side)
      if (!path && side) path = st.planner.pathTo(pb);
      if (!path) { say('No route found.', true); draw(); return; }
      startRoute(a, b, G.resample([[A.x, A.y]].concat(path, [pb]), STEP), st.obs, { st: st });
    }
  });
  canvas.addEventListener('pointercancel', function () { stroke = null; draw(); });

  /* The SPACE BAR stops or cancels (v101, Peter; was Esc, which Chrome keeps
     for leaving full screen): A/R under way, an armed move, the computer's
     thinking. Its default is suppressed — it would press a menu button that
     still has the focus — except in the menus' fields. */
  document.addEventListener('keydown', function (e) {
    if (e.key !== ' ' || e.ctrlKey || e.altKey || e.metaKey) return;
    var tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    e.preventDefault();
    if (aiHalt && !ai && !relaying && !band && !roomBusy && !routeBusy) { aiHalt = false; log('Continued (Space).'); maybeAI(); return; }   // a stopped game between two computers goes on
    if (bothAI() && game.phase === 'play' && !aiHalt) { aiHalt = true; log('Stopped (Space).'); }   // (v125) set first: finishRelaying below calls maybeAI
    if (relaying) { finishRelaying(false); return; }
    if (stopRoom()) return;
    if (stopRoute()) return;
    if (armed) disarm('Cancelled.');
    if (ai && (ai.timer || ai.thinking)) {
      aiCancel();
      if (aiHalt) maybeAI();                       // (says that the game is stopped)
      else say('Computer move cancelled — U, a move of yours, or N lets it move again; or set it to Human.', true);
    } else if (aiHalt && ai) say('Stopping after the move being drawn…   Space continues');
  });

  /* ---------------- click to connect ---------------- */

  /* Which side of the pressed spot the pointer is on, and the spots reachable
     from there. A spot with 0 or 1 curves is reachable all round; one with 2
     curves needs the pointer in a region it borders (the REGION containing the
     pointer decides — from the press itself, so that something lights up at
     once, and then wherever the drag goes), and the sector of the spot facing
     that region becomes the start. Planners are cached per side. */
  function updateSide(st, p) {
    var a = st.from, A = game.spots[a], pa = [A.x, A.y], key = 'all', start = pa;
    if (A.deg === 2) {
      var want = st.an.regionAt(p), ang = Math.atan2(p[1] - pa[1], p[0] - pa[0]);
      var tans = tangentsAt(a).map(function (t) { return Math.atan2(t[1], t[0]); }).sort(function (x, y) { return x - y; });
      var sectors = [];
      start = null;
      var bestOff = Infinity;
      for (var k = 0; k < tans.length; k++) {   // the sectors between consecutive tangents; the one pointed into is wanted
        var a0 = tans[k], a1 = tans[(k + 1) % tans.length] + (k + 1 < tans.length ? 0 : 2 * Math.PI);
        var mid = (a0 + a1) / 2, probe = [pa[0] + 12 * Math.cos(mid), pa[1] + 12 * Math.sin(mid)];
        sectors.push({ key: String(k), start: probe });
        if (st.an.regionAt(probe) !== want) continue;
        /* both sides of a spot on a bare path are the same region, so among the
           sectors that match, the one the pointer's direction lies in — or the
           nearest to it — is meant */
        var t = ang - a0; t -= 2 * Math.PI * Math.floor(t / (2 * Math.PI));
        var off = t <= a1 - a0 ? 0 : Math.min(t - (a1 - a0), 2 * Math.PI - t);
        if (off < bestOff) { bestOff = off; start = probe; key = String(k); }
      }
      if (!start) { st.key = null; st.side = null; st.planner = null; st.targets = {}; st.blocked = {}; return; }
      /* v129 (Peter): a side from which no spot can be reached at all (none even
         blocked for lack of room) gives way to the other side when that one leads
         somewhere — a press on a spot with two curves often points to the wrong
         side by a pixel's movement */
      var here = st.forgiving && sideSet(st, key, start);   // (only for a hand press: the computer, R's retry and room-making name their side exactly)
      if (here && !Object.keys(here.targets).length && !Object.keys(here.blocked).length) {
        for (var s = 0; s < sectors.length; s++) {
          if (sectors[s].key === key) continue;
          var other = sideSet(st, sectors[s].key, sectors[s].start);
          if (Object.keys(other.targets).length || Object.keys(other.blocked).length) { key = sectors[s].key; start = sectors[s].start; break; }
        }
      }
    }
    if (st.key === key) return;
    var set = sideSet(st, key, start);
    st.key = key; st.side = A.deg === 2 ? start : null;
    st.planner = set.planner; st.targets = set.targets; st.blocked = set.blocked;
  }
  /* The planner from one side of st.from (key: 'all', or a sector's index for a
     spot with two curves), the spots it reaches, and the BLOCKED ones: those the
     rules allow from this side (alive, on the region the move is made in) that
     cannot be reached for lack of room. Cached per side. */
  function sideSet(st, key, start) {
    st.sideSets = st.sideSets || {};
    if (st.sideSets[key]) return st.sideSets[key];
    var a = st.from, A = game.spots[a], pa = [A.x, A.y];
    if (!st.planners[key]) {
      var ctx = { aIdx: a, bIdx: -1, A: pa, B: pa, rho: route.D * Math.SQRT2, spotR: SPOT_R };
      st.planners[key] = Rt.planner(st.obs, ctx, route.d0, game.W0, game.H0, start, SPOT_R);
    }
    var planner = st.planners[key], targets = {}, blocked = {};
    game.spots.forEach(function (sp, i) {
      if (i === a ? sp.deg <= 1 : sp.deg < 3 && planner.reachable([sp.x, sp.y])) targets[i] = true;   // a spot with two free connections can loop to itself
    });
    var reg = A.deg === 2 ? st.an.regionAt(start) : st.an.regions.filter(function (r) { return r.spots.indexOf(a) >= 0; })[0];
    if (reg) reg.spots.forEach(function (i) { if (i !== a && game.spots[i].deg < 3 && !targets[i]) blocked[i] = true; });
    return (st.sideSets[key] = { planner: planner, targets: targets, blocked: blocked });
  }

  /* Use the drag as the curve from a to b if it can be: trimmed at both ends,
     self-loops cut, crossing nothing. Returns false if it cannot. */
  function strokeRoute(st, b) {
    var A = game.spots[st.from], B = game.spots[b], pa = [A.x, A.y], pb = [B.x, B.y];
    var keep = 0.6 * SNAP, lo = 0, hi = st.pts.length - 1;
    while (lo <= hi && G.dist(st.pts[lo], pa) < keep) lo++;
    while (hi >= lo && G.dist(st.pts[hi], pb) < keep) hi--;
    var mid = cutSelfLoops(st.pts.slice(lo, hi + 1));
    var P = G.resample([pa].concat(mid, [pb]), STEP);
    if (P.length < 3 || R.polylineCrossesObstacle(st.obs, P) || R.polylineCrossesItself(P)) return false;
    if (route.heroic) { heroicMove(st.from, b, [pa].concat(mid, [pb])); return true; }   // as drawn (a drag that crosses something is routed as before)
    startRoute(st.from, b, P, st.obs, { st: st });
    return true;
  }

  /* Room → Heroic (Peter, 9/26, v67): a hand-drawn curve is kept as drawn —
     no band, no smoothing: the stroke's own points (trimmed inside the two
     end spots, self-loops cut, pinned to the spot centres) joined by straight
     pieces. It must cross nothing and touch nothing (certified at 1 px, the
     rule strokes have always had — the minimum clearance does not apply;
     certify refines to legs no longer than its bound, so the bound cannot be 0). `P`: the polyline from
     a's centre to b's. Returns false after a message if it cannot be used. */
  function heroicMove(a, b, P) {
    var pts = [P[0]];
    for (var i = 1; i < P.length; i++) if (G.dist(P[i], pts[pts.length - 1]) >= 1 || i === P.length - 1) pts.push(P[i]);
    if (G.dist(pts[pts.length - 1], pts[pts.length - 2]) < 1 && pts.length > 2) pts.splice(pts.length - 2, 1);
    if (pts.length < 3) { say('Too short.', true); draw(); return false; }
    var obs = R.buildObstacles(game, SPOT_R), A = game.spots[a], B = game.spots[b];
    if (R.polylineCrossesObstacle(obs, pts)) { say('The curve crosses something.', true); draw(); return false; }
    if (R.polylineCrossesItself(pts)) { say('The curve crosses itself.', true); draw(); return false; }
    var pieces = E.polylinePieces(pts), h = pieces.map(function (pc) { return G.dist(pc[0], pc[3]); });
    var ctx = { aIdx: a, bIdx: b, A: [A.x, A.y], B: [B.x, B.y], rho: route.D * Math.SQRT2, spotR: SPOT_R };
    var cert = R.certify(obs, ctx, pieces, 1);
    if (!cert.ok) {
      say('The curve touches something. Draw it again.', true, 'Heroic curve refused: it touches something (clearance ' + cert.clearance.toFixed(1) + ' px).');
      draw(); return false;
    }
    armed = null; pendingRoom = null; lastTry = null;
    commitMove(a, b, { pieces: pieces, h: h }, 'heroic, as drawn: ' + pieces.length + ' straight pieces, clearance ' + cert.clearance.toFixed(1) + ' px');
    return true;
  }

  /* Arm spot st.from for a second click (click-to-connect), from the side
     updateSide chose; false after a message if that is not possible. */
  function arm(st) {
    var a = st.from, A = game.spots[a];
    if (A.deg === 2 && !st.side) { say('Spot ' + (a + 1) + ' has two curves: drag a little way from it into the region you want to use.', true); return false; }
    var n = Object.keys(st.targets).length;
    if (!n && !Object.keys(st.blocked || {}).length) { say('No spot can be reached from there.', true); return false; }
    armed = { a: a, spot: [A.x, A.y], start: st.side || [A.x, A.y], obs: st.obs, planner: st.planner, targets: st.targets,
              blocked: st.blocked || {}, an: st.an, marks: {}, arcMarks: {}, markedSpots: {} };
    /* the region the move is made in, and A's own boundary of it */
    armed.region = A.deg === 2 ? st.an.regionAt(st.side) : st.an.regions.filter(function (r) { return r.spots.indexOf(a) >= 0; })[0];
    armed.boundary = -1;
    armed.region.boundaries.forEach(function (bd, k) { if (bd.spots.indexOf(a) >= 0) armed.boundary = k; });
    return true;
  }

  function disarm(msg) { armed = null; pendingRoom = null; roomSnapshot = false; say(msg, true); draw(); }

  /* A destination the rules allow but the room does not (Peter, 9/23): say
     how much room the best way there has, against the minimum clearance, and
     offer M to make room. Stays armed. */
  function explainBlocked(b) {
    var B = game.spots[b], rm = armed.planner ? armed.planner.room([B.x, B.y]) : null;
    pendingRoom = { a: armed.a, b: b, room: rm };
    var why = rm ? 'the widest way there is too narrow' : 'there is no way through from this side';
    var detail = rm ? 'the widest way there keeps only ' + Math.max(0, Math.round(rm.clearance)) + ' px clear of the curves, and the minimum clearance is ' + route.d0 + ' px' : why;
    say('No room to reach spot ' + (b + 1) + ': ' + why + '.' + roomOffer() + '   —   or click another spot', true,
        'No room to reach spot ' + (b + 1) + ': ' + detail + '.');
    draw();
    if (route.shiftSpots || route.shiftCurves) makeRoom(true);   // Room → Shift spots / curves automatically
  }

  /* A marked move for which no way round the marks was found at the minimum
     clearance (v37, Peter 9/24: 13 round the loop 5-12 but not 4-8, threading
     between the strands of two interleaved loops): is it the room or the
     topology? The same search at lower clearances (room.js lowerClearance:
     halving from d0/2) tells: found → no room, offer M as for a blocked
     destination (and make room at once if a Room → Shift option is on);
     not found even so → the marks cannot be enclosed from this side. */
  function explainMarkedNoRoom(b, hushed, then) {   // (v139: the search in the worker; then(room-making started) when done — hushed: the computer's)
    var ar = armed, g0 = game;
    if (routeAsync(ar, b, hushed, function (low) {
      if (armed !== ar || game !== g0) { if (then) then(false); return; }
      if (hushed) hush++;
      try { markedNoRoom(ar, b, low); } finally { if (hushed) hush--; }
      if (then) then(roomBusy);
    }, 'lower')) return;
    if (hushed) hush++;
    try { markedNoRoom(ar, b, lowerHere(ar, b)); } finally { if (hushed) hush--; }
    if (then) then(roomBusy);
  }
  function markedNoRoom(ar, b, low) {
    var a = ar.a;
    if (!low) {
      pendingRoom = null;
      say('No route encloses the marked spots from this side, even without room: they cannot be separated from the others that way.', true);
      draw(); return;
    }
    pendingRoom = { a: a, b: b, room: { clearance: low.t.rmin }, marked: true,
                    ghost: { path: low.t.pts, w: low.t.rmin, stubs: false, fits: false } };   // (the first ghost for moving curves: no need to search again)
    say('No room to go round the marked spots: the best way round them is too narrow.' + roomOffer() + '   —   or Space', true,
        'No room to go round the marked spots: the best way round them keeps only ' + Math.max(0, Math.round(low.t.rmin)) +
        ' px clear of the curves, and the minimum clearance is ' + route.d0 + ' px.');
    draw();
    if (route.shiftSpots || route.shiftCurves) makeRoom(true);
  }

  /* ---------------- adjusting (A) and rearranging (R) the whole drawing ----------------
     One machine for both (redraw.js, v45/v46): every curve a polyline, spots
     and points moving together to the minimum of one energy — the band's
     (length + λ · crowding) for all curves at once, plus smoothness and equal
     angles at spots (v51) — nothing can cross on the way. Room → Rearrange the
     drawing (R, v60; was "Redraw from scratch") moves the spots too; Room → Adjust the drawing (A) keeps the
     original and hand-added ones (a spot made by a move moves with its curve).
     Animated, as many steps a frame as fit in RELAY_FRAME_MS, the polylines
     drawn as they go, until converged (a second press changes nothing); Space
     stops early and keeps what is there. Then every curve
     becomes a smooth spline (no corners) and is certified, and the position
     must be unchanged; otherwise nothing changes. Its own undo step — or,
     adjusting after a move (Room → Adjust the drawing after each move), part
     of the move's. Logged.
     Room → Draw the picture afresh (Z, v114; Peter 9/30: "a fundamentally new option … with A and R
     we have driven the polishing roughly as far as it can go"): the picture is laid out ANEW from
     the position alone (layout.js: the combinatorial map made a triangulation and drawn on a grid,
     no reference to the present picture), then the same descent from that start (redraw.js
     o.tight). With `fresh` = { mv, player, who, text, verdict, onFail }, the position drawn is the
     one AFTER the move mv (ai.js form) — the computer's way out when its move cannot be drawn even
     after R (aiNext 2b): the move is then made in the new picture without the router.
     With workers (v118) Z draws the position once for EVERY region as the outer one, side by side
     (freshParallel), and keeps the drawing with the most room; without them (a page opened as a
     file) only with the present outside, on the page's own thread as A and R. */
  function relayDrawing(kind, after, fresh) {
    if (relaying || band || game.phase === 'place' || !game.spots.length || (kind === 'adjust' && !game.edges.length)) return;
    /* A, R or Z while a move waits for room (v50, Peter 9/24: offer R when the move cannot be made otherwise; A too, v136):
       redraw, then try that move again — from the same region, the marks kept */
    var retry = !after && !fresh && pendingRoom && armed ?   // (A too since v136, Peter)
                { a: armed.a, b: pendingRoom.b, ar: armed, region: D.region(armed.an, armed.region) } : null;
    armed = null; pendingRoom = null; roomSnapshot = false; stroke = null;
    var o = { d0: route.d0, D: route.D, lambda: route.lambda, spotR: SPOT_R, rho: route.D * Math.SQRT2 }, from = game;
    if (kind === 'fresh') {
      o.tight = true; o.keepKnots = true;
      ensurePool();                               // (finds out whether workers can be had at all)
      if (!noWorkers) {
        relaying = { kind: kind, after: !!after, st: null, start: JSON.stringify(game), t0: Date.now(),
                     before: Rd.leastClearance(game, o), retry: retry, fresh: fresh || null };
        freshParallel(relaying, o);
        say(relayWord() + '…   Space stops');
        draw();
        return;
      }
      from = Ly.freshGame(game, fresh ? fresh.mv : null, fresh ? fresh.player : game.player, -1, route.D);   // (the present outside stays outside)
      if (!from) return;
    }
    relaying = { kind: kind, after: !!after, st: Rd.createRedraw(from, o, kind === 'adjust'), start: JSON.stringify(game), t0: Date.now(),
                 before: Rd.leastClearance(game, o), retry: retry, fresh: fresh || null };
    say(relayWord() + '…   Space stops');
    draw();                                       // the gray background at once, also when not animated
    if (route.animate) requestAnimationFrame(relayFrame); else setTimeout(function () { finishRelaying(true); }, 30);
  }
  /* Z on the workers (v118): one job per region of the position (after the move), that region
     outside; each worker takes the next region when it is done. When all are done, or Space stops
     it, the drawing with the largest least clearance is taken.
     ON SCREEN (v119, Peter: after the first job was done the page looked stuck): one running job's
     polylines as they go — first the present outside's; when the job on screen is done, the running
     job that looks most promising NOW, by the least gap between its polylines (each job reports it
     as it goes: the least distance of a point to anything it could hit) — a comparison, no rule of
     its own; the final smooth drawings are not shown until the best is chosen.
     STRAGGLERS (v120, Peter): once half the layouts are done, a layout still running when it has
     taken as long again as the slowest finished one did is given up (its worker is replaced) — a
     comparison with the others, no time limit of its own. (On his 30-spot game of 9/30, 14 of 50
     layouts ran on for 25 minutes; the cause, a spot pressed onto a curve, is fixed in redraw.js,
     but a layout can still be far slower than the rest.) */
  var drawPool = [];     // the workers that draw afresh (sprouts-draw-worker.js), started on demand, as many as the Workers menu says
  function freshParallel(rl, o) {
    var f = rl.fresh, mv = f ? f.mv : null, player = f ? f.player : game.player, base = JSON.parse(rl.start);
    var F = Ly.faces(base, mv), order = [F.outer], i;
    for (i = 0; i < F.count; i++) if (i !== F.outer) order.push(i);
    var n = Math.min(poolSize(), order.length);
    while (drawPool.length > poolSize()) drawPool.pop().terminate();
    while (drawPool.length < n) drawPool.push(new Worker('sprouts-draw-worker.js' + version()));
    var par = rl.par = { order: order, outer: F.outer, next: 0, done: 0, results: [], best: null, workers: n,
                         running: {}, shown: F.outer, shows: 1, slowest: 0, givenUp: 0 };   // running: face → { w, gap, t0 }
    function finished(m) {
      var j = par.running[m.face];
      if (j) m.secs = (Date.now() - j.t0) / 1000;
      if (j && !m.error) par.slowest = Math.max(par.slowest, Date.now() - j.t0);
      par.done++; par.results.push(m); delete par.running[m.face];
      if (!m.error && (!par.best || m.clearance > par.best.clearance)) par.best = m;
      /* DONE as soon as a layout is drawn with at least the room of the picture before (v121, Peter:
         "all we wish to accomplish is to draw the picture") — the others are not waited for */
      if (!m.error && !(m.clearance < rl.before)) { par.early = m; return; }
      if (m.face === par.shown) showNext();
    }
    function showNext() {                         // the running job with the widest gap now goes on screen
      var pick = null;
      Object.keys(par.running).forEach(function (k) {
        var j = par.running[k];
        if (pick === null || (j.gap || 0) > (par.running[pick].gap || 0)) pick = k;
      });
      par.shown = pick === null ? null : Number(pick);
      if (pick === null) return;
      par.shows++;
      par.running[pick].w.postMessage({ id: par.shown, show: true });
    }
    function give(w) {
      if (par.next >= order.length) return;
      var face = order[par.next++];
      par.running[face] = { w: w, gap: null, t0: Date.now() };
      w.onmessage = function (e) {
        var m = e.data;
        if (relaying !== rl || m.id !== face) return;
        if (m.gap !== undefined) { if (par.running[face]) par.running[face].gap = m.gap; return; }
        if (m.picture) { if (par.shown === face) { game = m.picture; draw(); } return; }
        m.face = face; finished(m);
        if (par.early || par.done === order.length) { finishRelaying(false); return; }
        sayProgress(); give(w);
        if (par.shown === null) showNext();       // (a job just started while none was on screen)
      };
      w.onerror = function (e) {
        e.preventDefault();
        if (relaying !== rl) return;
        log('Script error in a drawing worker: ' + e.message);
        finished({ face: face, error: 'a script error (' + e.message + ')' });
        if (par.early || par.done === order.length) finishRelaying(false); else give(w);
      };
      w.postMessage({ id: face, game: base, mv: mv, player: player, outerFace: face, o: o, show: face === par.shown });
    }
    function sayProgress() {
      if (relaying !== rl) return;
      var sh = par.shown === null ? '' : par.shown === F.outer ? '; on screen: the present outside' : '; on screen: the most promising layout still running';
      say(relayWord() + ': ' + par.done + ' of ' + order.length + ' layouts done, the first with at least ' + (isFinite(rl.before) ? Math.max(0, Math.round(rl.before)) + ' px' : 'some room') + ' is taken' +
          (par.best ? ' (the best so far keeps ' + Math.round(par.best.clearance) + ' px)' : '') + sh + ', ' + ((Date.now() - rl.t0) / 1000).toFixed(0) + ' s…   Space stops',
          false, null, false);
    }
    function stragglers() {                       // (see above)
      if (relaying !== rl || 2 * par.done < order.length || !par.slowest) return;
      Object.keys(par.running).forEach(function (k) {
        if (relaying !== rl) return;
        var j = par.running[k], face = Number(k);
        if (Date.now() - j.t0 <= 2 * par.slowest) return;
        j.w.terminate();
        var w = new Worker('sprouts-draw-worker.js' + version()), at = drawPool.indexOf(j.w);
        if (at >= 0) drawPool[at] = w;
        par.givenUp++;
        finished({ face: face, error: 'given up: it took as long again as the slowest finished layout' });
        if (par.early || par.done === order.length) { finishRelaying(false); return; }
        give(w);
        if (par.shown === null) showNext();
      });
    }
    par.timer = setInterval(function () { stragglers(); sayProgress(); }, 1000);
    drawPool.slice(0, n).forEach(give);
  }
  function outsideOf(g) { var an = E.analyse(g.spots, g.edges); return D.region(an, an.regions.filter(function (x) { return x.key === -1; })[0]).replace(/^the outside region, containing /, 'the region along ').replace(/^the outside region, empty inside/, 'an empty region'); }
  /* The result of Z on the workers, as finishRedraw would give it; a stop (Space) drops the jobs still running. */
  function freshResult(rl) {
    var par = rl.par, all = par.order.length;
    clearInterval(par.timer);
    if (par.done < all) { drawPool.forEach(function (w) { w.terminate(); }); drawPool = []; }
    var fails = par.results.filter(function (m) { return m.error; }), running = Object.keys(par.running).length;
    par.summary = par.results.slice().sort(function (a, b) { return (b.error ? -Infinity : b.clearance) - (a.error ? -Infinity : a.clearance); }).map(function (m) {
      return (m.face === par.outer ? 'the present outside' : 'region ' + (m.face + 1)) + ': ' + (m.error ? (/^given up/.test(m.error) ? 'given up (too slow)' : 'failed') : Math.round(m.clearance) + ' px' + (m.corners ? ', ' + m.corners + ' corner' + (m.corners > 1 ? 's' : '') : '')) +
             (m.secs !== undefined ? ' in ' + Math.round(m.secs) + ' s' : '');
    }).join('; ') + (running ? '; still running when it ended: ' + running + (all - par.next > 0 ? '; not started: ' + (all - par.next) : '') : all - par.next > 0 ? '; not started: ' + (all - par.next) : '');
    if (par.best) return par.best;
    return { error: par.done < all ? (par.done ? 'none of the ' + par.done + ' layouts finished so far could be drawn' : 'stopped before any layout was finished')
                                   : 'none of the ' + all + ' layouts (each region outside in turn) could be drawn: ' + (fails[0] ? fails[0].error : ''),
             clearance: -Infinity };
  }
  function relayWord() { return relaying.kind === 'adjust' ? 'Adjusting the drawing' : relaying.kind === 'fresh' ? 'Drawing the picture afresh' + (relaying.fresh ? ', with ' + relaying.fresh.text : '') : 'Rearranging the drawing'; }
  function relayFrame() {
    if (!relaying) return;
    var st = relaying.st;
    var t = performance.now();                    // it runs to convergence (v51): as many steps as fit in a frame
    do Rd.stepRedraw(st, 1); while (!st.done && performance.now() - t < RELAY_FRAME_MS);
    game = Rd.redrawCurrent(st);
    if (st.done) { finishRelaying(false); return; }
    say(relayWord() + ': step ' + st.it + ', ' + ((Date.now() - relaying.t0) / 1000).toFixed(0) + ' s…   Space stops');
    draw();
    requestAnimationFrame(relayFrame);
  }
  function finishRelaying(runToEnd) {
    var rl = relaying, st = rl.st, adjust = rl.kind === 'adjust', fresh = rl.kind === 'fresh', par = rl.par;
    if (runToEnd && st) while (!Rd.stepRedraw(st, 50)) { /* on */ }
    relaying = null;
    var r = par ? freshResult(rl) : Rd.finishRedraw(st), not = adjust ? 'Not adjusted: ' : fresh ? 'Not drawn afresh: ' : 'Not rearranged: ';
    game = JSON.parse(rl.start);
    if (r.error) {
      say(not + r.error, true, not + r.error + (par ? '' : ' (least clearance ' + r.clearance.toFixed(1) + ' px)') + (par && par.summary ? '\n    ' + par.summary : '')); draw();
      if (rl.fresh) rl.fresh.onFail(); else afterRelay();
      return;
    }
    if (!rl.after) snapshot(adjust ? 'drawing adjusted' : fresh && !rl.fresh ? 'drawing made afresh' : fresh ? undefined : 'drawing rearranged');
    game = r.game;
    var fmt = function (c) { return isFinite(c) ? Math.round(c) + ' px' : 'no curves'; };
    var what = adjust ? 'Adjusted the drawing' : fresh ? 'Drew the picture afresh' + (rl.fresh ? ', with the move ' + rl.fresh.text : '') : 'Rearranged the drawing';
    log(what + (rl.after ? ' after move ' + game.moves : '') +
        ((par ? par.done === par.order.length || par.early : st.done) ? '' : ' (stopped with Space)') + ': ' + (adjust ? '' : fresh ? '' : 'spots moved up to ' + Math.round(r.moved) + ' px; ') +
        'least clearance ' + fmt(rl.before) + ' before, ' + fmt(r.clearance) + ' now; ' + ((Date.now() - rl.t0) / 1000).toFixed(1) + ' s' +
        (par ? ' (' + (par.early ? 'the first layout drawn with at least the room before, after ' + par.done + ' of ' + par.order.length : par.done + ' of ' + par.order.length + ' layouts') +
               ' on ' + par.workers + ' workers, each region outside in turn' +
               (par.givenUp ? ', ' + par.givenUp + ' given up as too slow' : '') + '; the best: ' +
               (r.face === par.outer ? 'the present outside kept' : outsideOf(r.game) + ' outside') + ')' :
         fresh && st.stages ? ' (' + st.stages + ' restart' + (st.stages > 1 ? 's' : '') + ')' : '') +
        (r.corners ? '; the smooth curves did not fit: ' + r.corners + (r.corners > 1 ? ' corners' : ' corner') + ' at a spot with three curves' :
         r.dense ? '; drawn close to the polylines (the smooth curves did not fit)' : '') + '.');
    if (par) log('    The layouts (each with another region outside), least clearance: ' + par.summary + '.\n    ' + memoryText() + '.');
    if (rl.fresh) {                               // the computer's move, made in the new picture (the two curves are R's, certified)
      var f = rl.fresh;
      marksUsed = null; note = null; browsing = false; redoList = [];   // (the router's leftovers; a move ends browsing, as in commitMove)
      /* the log describes the move by where its spot lies in the picture BEFORE it — here the new
         picture without the move (a drawing of the position before), not the old picture */
      var before = JSON.parse(JSON.stringify(game));
      before.spots.pop(); before.edges.length -= 2; before.spots[f.mv.x].deg--; before.spots[f.mv.y].deg--; before.moves--; before.player = f.player;
      afterMoveMade({ a: f.mv.x, b: f.mv.y }, 'drawn afresh, ' + fmt(r.clearance), before);
      if (f.verdict && game.phase !== 'over') { log('    ' + f.who + ' ' + f.verdict + ' (the search saw the whole game).'); statusEl.textContent += '   —   ' + f.who + ' ' + f.verdict; }
      log('    ' + f.who + ' intended ' + f.text + ': drawn as intended, in a picture drawn afresh.');
      return;
    }
    sayTurn(); draw();
    statusEl.textContent += '   —   ' + (adjust ? 'adjusted' : fresh ? 'drawn afresh' : 'rearranged') + (rl.after ? '' : '   (U undoes it)');
    if (rl.retry) retryMove(rl.retry); else afterRelay();
  }
  /* After A or R: the other computer's move that waited for the rearranging (v79), else the computer's turn. */
  function afterRelay() {
    if (netRetry) { var r = netRetry; netRetry = null; netDraw(r.msg, r.done); return; }
    maybeAI();
  }
  /* The move that waited for room, tried again after a redraw: A armed again
     in the same region (found by its description: regions have no lasting
     identity, the redraw keeps the position), the marks found again by their
     spots, then B as if clicked. The redraw and the move are one undo step,
     as when room is made (roomSnapshot). */
  function retryMove(rt) {
    var a = rt.a, A = game.spots[a], pa = [A.x, A.y], an = E.analyse(game.spots, game.edges), p = pa;
    if (A.deg === 2) {                             // a point just off A in that region (12 px, like the side probes)
      p = null;
      for (var k = 0; k < 72 && !p; k++) {
        var q = [pa[0] + 12 * Math.cos(k * Math.PI / 36), pa[1] + 12 * Math.sin(k * Math.PI / 36)], r = an.regionAt(q);
        if (r && D.region(an, r) === rt.region) p = q;
      }
      if (!p) { say('Redrawn, but the region of the move ' + (a + 1) + ' → ' + (rt.b + 1) + ' was not found again (a bug: please save the game).', true); return; }
    }
    var st = { from: a, pts: [p], side: null, targets: {}, planners: {}, dest: -1, loop: false };
    st.obs = R.buildObstacles(game, SPOT_R); st.an = an;
    updateSide(st, p);
    if (!arm(st)) return;
    var re = armFor(game, a, armed.start, rt.ar, armed.obs);
    if (re && re.region.key === armed.region.key) { armed.marks = re.marks; armed.arcMarks = re.arcMarks; armed.markedSpots = rt.ar.markedSpots; }
    if (!armed.targets[rt.b]) {
      say('Redrawn, but there is still no room for ' + (a + 1) + ' → ' + (rt.b + 1) + '.   U undoes the redrawing', true); armed = null; draw(); return;
    }
    roomSnapshot = true;                           // (finishBand takes no snapshot of its own; one U undoes both)
    connectTo(rt.b);
  }

  /* ---------------- moving spots by hand (Ctrl+drag) ----------------
     Peter, 9/23:
     - a spot made by a move with just that move's two curves SLIDES along
       its curve (room.js place; the shape does not change);
     - a spot with no curves moves ANYWHERE IN ITS REGION: it follows the
       pointer while the place is allowed — in the same region, and its disc
       at least the minimum clearance from everything (plain distance ≥ d0 +
       spot radius, as a curve keeps from a spot) — else it stops at the last
       allowed point on the way;
     - a spot with one curve: the first movement decides. Back along the
       curve (the drag's direction has a positive component along the curve
       towards its other end) → it slides back and the curve is SHORTENED;
       otherwise the curve is EXTENDED along the drag, which may go anywhere
       in the region without crossing anything; on release the whole curve is
       relaxed by the band from its other end (keeping its direction there,
       so it still runs smoothly into the other half of its move) and
       refitted. If that fails, nothing changes.
     Every completed drag is its own undo step and is logged. */
  function startSpotDrag(z, p, hint) {
    if (z < 0) { if (hint) say(hint, true); return false; }
    if (route.heroic) { say('Heroic mode: spots are not moved by hand.' + (hint ? '   ' + hint : ''), true); return false; }   // (v68)
    var sp0 = game.spots[z], kind = null;
    if (Rm.slidable(game, z)) kind = 'slide';
    else if (sp0.deg === 0) kind = 'free';
    else if (Rm.oneEdge(game, z)) kind = 'end';
    if (!kind) {
      say('Spot ' + (z + 1) + ' cannot be moved: it has ' + sp0.deg + ' curves' + (sp0.deg === 2 ? ' that are not one curve through it' : '') + '.' +
          (hint ? '   ' + hint : ''), true);
      return false;
    }
    armed = null; pendingRoom = null; roomSnapshot = false;
    slideDrag = { z: z, kind: kind, press: p, before: JSON.stringify(game), orig: [sp0.x, sp0.y], moved: false };
    var an = E.analyse(game.spots, game.edges);
    if (kind === 'slide') slideDrag.sp = Rm.spline(game, z);
    if (kind === 'free' || kind === 'end') {
      var reg = Rm.regionOfSpot(an, z);
      slideDrag.an = an; slideDrag.regKey = reg ? reg.key : null;
      var g2 = JSON.parse(slideDrag.before);
      g2.spots[z].x = -1e6; g2.spots[z].y = -1e6;           // the spot itself is not an obstacle to its own new place
      if (kind === 'end') { slideDrag.one = Rm.oneEdge(game, z); slideDrag.sp = Rm.oriented(game, z); g2.edges.splice(slideDrag.one.e, 1); }
      slideDrag.obs = R.buildObstacles(g2, SPOT_R);
      slideDrag.g2 = g2;
    }
    say(kind === 'slide' ? 'Sliding spot ' + (z + 1) + ' along its curve…' : kind === 'free' ? 'Moving spot ' + (z + 1) + ' within its region…' :
        'Moving spot ' + (z + 1) + ': back along its curve shortens it, away from it extends it…');
    draw();
    return true;
  }
  var PLAIN = { aIdx: -2, bIdx: -2, A: [0, 0], B: [0, 0], rho: 0, spotR: SPOT_R };
  /* Ctrl+click adds a spot with no curves (v35, Peter 9/23) where one fits:
     inside the drawing, in a region, with plain clearance ≥ d0 + SPOT_R from
     every curve, spot and border — what a curve keeps from a spot, the same
     rule a spot with no curves obeys when moved. Where it does not fit, the
     press is too close to something, so it means the nearest spot (Ctrl+drag).
     The spot gets the next number and 3 lives; the turn and the move count
     are unchanged; one undo step; logged. */
  function newSpotRoom(p) {
    if (game.phase !== 'play') return { ok: false };
    if (p[0] < SPOT_R || p[1] < SPOT_R || p[0] > game.W0 - SPOT_R || p[1] > game.H0 - SPOT_R) return { ok: false, why: 'No new spot there: it is outside the drawing.' };
    var an = E.analyse(game.spots, game.edges), r = an.regionAt(p);
    if (!r) return { ok: false, why: 'No new spot there: it is on a curve.' };
    var clear = R.rObs(R.buildObstacles(game, SPOT_R), PLAIN, p), need = route.d0 + SPOT_R;
    if (clear < need) return { ok: false, why: 'No new spot there: it would be too close to a curve, spot or border.' };
    return { ok: true, an: an, region: r };
  }
  function addSpot(p, fit) {
    armed = null; pendingRoom = null; roomSnapshot = false;
    snapshot();
    game.spots.push({ x: p[0], y: p[1], deg: 0 });
    game.added = (game.added || 0) + 1;
    var n = game.spots.length;
    log('Spot ' + n + ' added by hand (Ctrl+click), in ' + D.region(fit.an, fit.region) + '.');
    sayTurn(); statusEl.textContent = 'Added spot ' + n + '.   ' + statusEl.textContent;
    draw();
  }
  /* May spot sd.z stand at p (degree 0, or the end of an extension)? */
  function spotAllowed(sd, p) {
    if (p[0] < SPOT_R || p[1] < SPOT_R || p[0] > game.W0 - SPOT_R || p[1] > game.H0 - SPOT_R) return false;
    var r = sd.an.regionAt(p);
    if (!r || r.key !== sd.regKey) return false;
    return R.rObs(sd.obs, PLAIN, p) >= route.d0 + SPOT_R;
  }
  function moveSpotDrag(p) {
    var sd = slideDrag, z = sd.z;
    if (sd.kind === 'slide') {
      Rm.place(game, z, Rm.paramOf(sd.sp, p), 2 * SPOT_R, sd.sp);
    } else if (sd.kind === 'free') {
      var from = [game.spots[z].x, game.spots[z].y], to = p;
      if (!spotAllowed(sd, to)) {                 // the farthest allowed point on the way there
        var lo = 0, hi = 1;
        for (var k = 0; k < 12; k++) { var mid = (lo + hi) / 2; if (spotAllowed(sd, [from[0] + mid * (p[0] - from[0]), from[1] + mid * (p[1] - from[1])])) lo = mid; else hi = mid; }
        to = [from[0] + lo * (p[0] - from[0]), from[1] + lo * (p[1] - from[1])];
      }
      game.spots[z].x = to[0]; game.spots[z].y = to[1];
    } else {                                      // 'end': decided by the first movement
      if (!sd.mode) {
        var d = [p[0] - sd.press[0], p[1] - sd.press[1]];
        if (d[0] === 0 && d[1] === 0) return;
        var L = sd.sp.pieces[sd.sp.pieces.length - 1], back = [L[2][0] - L[3][0], L[2][1] - L[3][1]];   // along the curve, towards its other end
        sd.mode = d[0] * back[0] + d[1] * back[1] > 0 ? 'back' : 'extend';
        sd.trail = [sd.orig.slice()];
      }
      if (sd.mode === 'back') {
        Rm.trimTo(game, z, sd.sp, Rm.paramOf(sd.sp, p), 2 * SPOT_R);
      } else {
        var last = sd.trail[sd.trail.length - 1];
        if (G.dist(p, last) < 1) return;
        var path = G.refinedPolygon(sd.sp.pieces, 0.5, 16).pts.concat(sd.trail.slice(1), [p]);
        if (spotAllowed(sd, p) && !R.polylineCrossesObstacle(sd.obs, [last, p]) && !R.polylineCrossesItself(path)) {
          sd.trail.push(p);
          game.spots[z].x = p[0]; game.spots[z].y = p[1];
        }
      }
    }
    sd.moved = true;
    draw();
  }
  function endSpotDrag() {
    var sd = slideDrag; slideDrag = null;
    if (!sd.moved) { sayTurn(); draw(); return; }
    var z = sd.z, now = game.spots[z], dist = Math.round(G.dist(sd.orig, [now.x, now.y]));
    if (sd.kind === 'end' && sd.mode === 'extend') {
      if (!extendCurve(sd)) { game = JSON.parse(sd.before); draw(); return; }
      history.push(sd.before);
      log('Spot ' + (z + 1) + ' moved ' + dist + ' px by hand; its curve extended.');
    } else {
      history.push(sd.before);
      log(sd.kind === 'slide' ? 'Spot ' + (z + 1) + ' slid along its curve by hand, ' + dist + ' px.' :
          sd.kind === 'free' ? 'Spot ' + (z + 1) + ' moved within its region by hand, ' + dist + ' px.' :
          'Spot ' + (z + 1) + ' slid back along its curve by hand, ' + dist + ' px; the curve shortened.');
    }
    sayTurn(); draw();
  }
  /* The curve of a degree-1 spot, extended along the drag: the old curve plus
     the trail, relaxed by the band from its other end z — with z's port fixed
     in the curve's present direction there — to the spot's new place, then
     refitted and certified. Writes it into `game` and returns true, or says
     why not and returns false. */
  function extendCurve(sd) {
    var z = sd.z, zz = sd.one.z, g2 = sd.g2, sp = sd.sp, trail = sd.trail;
    if (trail.length < 2) return false;
    var ps = trail[trail.length - 1], pz = [g2.spots[zz].x, g2.spots[zz].y];
    g2.spots[z].x = ps[0]; g2.spots[z].y = ps[1];
    var obs = R.buildObstacles(g2, SPOT_R);
    var ctx = { aIdx: zz, bIdx: z, A: pz, B: ps, rho: route.D * Math.SQRT2, spotR: SPOT_R };
    var P = G.resample(G.refinedPolygon(sp.pieces, 0.5, 16).pts.concat(trail.slice(1)), STEP);
    var b0 = sp.pieces[0], t0 = [b0[1][0] - b0[0][0], b0[1][1] - b0[0][1]], tl = Math.sqrt(t0[0] * t0[0] + t0[1] * t0[1]) || 1;
    var dirZ = [t0[0] / tl, t0[1] / tl], n = P.length - 1, sideS = [P[n - 1][0] - ps[0], P[n - 1][1] - ps[1]];
    var saved = game, rt;
    game = g2;                                    // choosePort reads `game`: the spot's new place, without its old curve
    try {
      rt = R.createRoute(obs, ctx, P, { d0: route.d0, D: route.D, lambda: route.lambda }, function (rawA, rawB) {
        var portB = choosePort(z, rawB, sideS, []);
        if (!portB) return 'No room at the new place of spot ' + (z + 1) + '.';
        return { portA: { dir: dirZ, q: 3 * route.d0 }, portB: portB };
      });
      if (rt) R.advance(rt, 2000);
    } finally { game = saved; }
    if (!rt) { say('The extended curve passes through or touches something.', true); return false; }
    if (rt.error) { say(rt.error, true); return false; }
    if (rt.state.rmin < route.d0 - 1e-6) { say('No room for the extended curve: it would come too close to something.', true, 'No room for the extended curve: the closest approach is ' + rt.state.rmin.toFixed(0) + ' px, less than the minimum clearance ' + route.d0 + '.'); return false; }
    var fit = G.fitClamped(G.resample(rt.pts, STEP), rt.dirA, rt.dirB, TOL, { minPiece: 12 });
    var cert = R.certify(obs, ctx, fit.pieces, 0.6 * route.d0);
    if (!cert.ok) { say('The refitted curve came too close to something. Try again.', true, 'The refitted curve came too close to something (clearance ' + cert.clearance.toFixed(1) + ' px). Try again.'); return false; }
    Rm.writeOriented(game, z, { pieces: fit.pieces, h: fit.h });
    var endP = fit.pieces[fit.pieces.length - 1][3];
    game.spots[z].x = endP[0]; game.spots[z].y = endP[1];
    return true;
  }

  /* M: make room for the move just refused (Room menu). First by SLIDING
     SPOTS (v33): spots made by a move slide along their curve (room.js):
     first the destination, then the start spot, then both. The position with
     the move fitting at the lowest band energy is taken, found by trying the
     move itself (planner and band, trialMove) at the positions nearest first,
     up to the first valley (see room.js slideFor). If no slide makes it fit,
     by MOVING CURVES (v36, room.js moveCurvesFor): the curves in the way are
     pushed apart, each as one C² spline by its de Boor points. Then the move
     is made as if the destination had been clicked again; making room and the
     move are one undo step. `auto`: called by Room → Shift … automatically,
     which uses only the kinds switched on there; M uses both. The work takes
     a few seconds, so the status line says so first, and the background turns
     gray (v65): the work starts after the next frame is painted (a timeout
     from inside requestAnimationFrame runs after that frame's paint). */
  /* What a refusal for lack of room offers: M, or in Heroic mode (no local
     room-making, v68) R, which rearranges and tries the move again. */
  function roomOffer() { return route.heroic ? '   A, R or Z: redraw and try again' : '   M: make room'; }
  /* Making room (M, or at once after a refusal for lack of room when Room → Shift … is on): in a
     worker since v137 (sprouts-room-worker.js, moves.js roomFor) — it took the page's thread for
     seconds to a minute (Peter's games of 10/1); the page stays responsive meanwhile, gray as busy,
     and Space stops it. Without workers (a page opened as a file) on the page's thread, as before. */
  var movesWorker = null, roomJob = null, routeJob = null, movesJobs = 0;   // (one worker for both, v139: sprouts-room-worker.js)
  function ensureMovesWorker() {
    if (movesWorker) return movesWorker;
    movesWorker = new Worker('sprouts-room-worker.js' + version());
    movesWorker.onmessage = function (e) {
      if (roomJob && e.data.id === roomJob.id) roomJob.done(e.data.res);
      else if (routeJob && e.data.id === routeJob.id) routeJob.done(e.data.res);
    };
    movesWorker.onerror = function (e) {
      e.preventDefault();                           // (logged here, not again by the page's own handler)
      log('Script error in the room worker: ' + e.message);
      if (roomJob) roomJob.done({ fail: true, brief: ['a script error'], why: ['a script error in the worker (' + e.message + ')'] });
      if (routeJob) routeJob.fallback();
    };
    return movesWorker;
  }
  /* stopped by Space: whatever it still reports is dropped — even an error from scripts it was still loading
     (v139: logged as a script error twice, the page's own handler too, without preventDefault) */
  function dropMovesWorker() {
    var w = movesWorker; movesWorker = null;
    w.onmessage = null; w.onerror = function (e) { e.preventDefault(); };
    w.terminate();
  }
  function makeRoom(auto) {
    if (route.heroic) { say('Heroic mode: curves and spots are not moved locally.   A, R or Z: redraw' + (pendingRoom && armed ? ' and try again' : ''), true); return; }
    if (!pendingRoom || !armed) { say('Nothing is waiting for room just now.', true); return; }
    say('Making room for ' + (armed.a + 1) + ' → ' + (pendingRoom.b + 1) + '…   Space stops');
    var ar = armed, pr = pendingRoom, b = pr.b, spots = !auto || route.shiftSpots, curves = !auto || route.shiftCurves;
    var pending = { ghost: pr.ghost || null, clearance: pr.room ? pr.room.clearance : null };
    roomBusy = true; draw();
    var done = function (res) {
      roomJob = null;
      try { if (armed === ar && pendingRoom === pr) makeRoomNow(res, ar, b, spots, curves); }
      finally { roomBusy = false; draw(); if (!relaying) maybeAI(); }   // (a move made at once, not animated, found roomBusy still set)
    };
    if (!noWorkers) {
      try {
        var w = ensureMovesWorker();
        roomJob = { id: ++movesJobs, done: done };
        w.postMessage({ id: roomJob.id, game: game, route: route, spotR: SPOT_R, job: Mk.jobOf(ar, b), spots: spots, curves: curves, pending: pending });
        return;
      } catch (e) { movesWorker = null; roomJob = null; log('No room worker (' + e.message + '): room is made on the page\'s own thread.'); }
    }
    requestAnimationFrame(function () {
      setTimeout(function () { done(Mk.roomFor(ar, b, spots, curves, pending)); }, 0);
    });
  }
  /* Space while room is being made in the worker: the job is dropped (the worker terminated); the
     move stays armed, M tries again. */
  function stopRoom() {
    if (!roomJob) return false;
    dropMovesWorker(); roomJob = null;
    roomBusy = false;
    log('Making room stopped (Space).');
    say('Making room stopped.   M tries again — or click another spot', true);
    draw();
    return true;
  }
  /* The marked route in the worker (v139): markedRoute's barrier search held the page's thread for up to
     5.7 s (headless 30-spot game, Parity vs Parity), several seconds at a stretch when the computer tried
     candidates in a row. The worker rebuilds the armed state (moves.js routeFor) and sends back the route,
     ar.why, the note and the messages, which are shown here unless `hushed` (the computer's tries). Then
     done(mr), the page still busy (routeBusy) until then; Space stops it (stopRoute). False when there is
     no worker — the caller runs markedRoute itself, as before. kind 'lower': explainMarkedNoRoom's search
     for the best way round the marks with less room instead (lowerHere; it took 99 s on the page once):
     done(low). */
  function lowerHere(ar, b) { return Rm.lowerClearance(function (d) { return trialMove(game, ar.a, b, ar.start, { marks: ar, d0: d, phase1: true }); }, route.d0 / 2); }
  function routeAsync(ar, b, hushed, done, kind) {
    kind = kind || 'route';
    if (noWorkers) return false;
    try { var w = ensureMovesWorker(); } catch (e) { movesWorker = null; log('No room worker (' + e.message + '): routes are found on the page\'s own thread.'); return false; }
    var job = Mk.jobOf(ar, b);
    job.encloseNone = !!ar.encloseNone;
    var finish = function (mr) { routeJob = null; routeBusy = false; draw(); done(mr); };
    routeJob = { id: ++movesJobs, ai: !!ai, ar: ar,
      done: function (res) {
        if (kind === 'route') { ar.why = res.why; note = res.note; }
        if (!hushed) res.said.forEach(function (m) { say(m[0], m[1]); });
        finish(kind === 'route' ? res.mr : res.low);
      },
      fallback: function () {                       // a script error in the worker: here, as without workers
        if (hushed) hush++;
        try { if (kind === 'route') ar.why = null; var r = kind === 'route' ? markedRoute(ar, b) : lowerHere(ar, b); } finally { if (hushed) hush--; }
        finish(r);
      } };
    routeBusy = true; draw();
    w.postMessage({ id: routeJob.id, kind: kind, game: game, route: route, spotR: SPOT_R, job: job });
    return true;
  }
  /* Space while a route is being found: the job dropped (the worker terminated). By hand the move stays
     armed (click the spot again); the computer's move is cancelled, as Space does while it thinks. */
  function stopRoute() {
    if (!routeJob) return false;
    var wasAI = routeJob.ai;
    dropMovesWorker(); routeJob = null;
    routeBusy = false;
    log('Finding a way stopped (Space).');
    if (wasAI && ai) {
      aiCancel();
      if (aiHalt) maybeAI();
      else say('Computer move cancelled — U, a move of yours, or N lets it move again; or set it to Human.', true);
    } else say('Finding a way stopped.   Click the spot again — or another spot', true);
    draw();
    return true;
  }
  /* The result of roomFor (in the worker or here) applied: the move armed again in the new drawing and
     made — or the refusal said. `ar` is the armed state the room was made for (still armed). */
  function makeRoomNow(res, ar, b, spots, curves) {
    var a = ar.a, g2 = res.fail ? null : res.game, start = res.start, fitted = res.fitted, what = res.what, brief = res.brief, why = res.why;
    if (!g2) {
      var off = [spots ? null : 'sliding spots', curves ? null : 'moving curves'].filter(Boolean);
      say('No room made for ' + (a + 1) + ' → ' + (b + 1) + (brief.length ? ': ' + brief.join('; ') : '') + '.' +
          (off.length ? '   M also tries ' + off.join(' and ') + '.' : '') + '   A, R or Z: redraw and try again', true,
          'No room made for ' + (a + 1) + ' → ' + (b + 1) + ': ' + why.join('; ') + ', minimum clearance ' + route.d0 + ' px.');
      roomSnapshot = false;                        // (after a redraw's retry, the redraw is its own undo step)
      return;
    }
    /* apply: one undo step for making room and the move */
    snapshot(); roomSnapshot = true;
    game = g2;
    log('Made room for ' + (a + 1) + ' → ' + (b + 1) + ': ' + what.join(', ') + '.');
    /* re-arm A from the same side, keep the marks, and connect */
    var marks = { markedSpots: ar.markedSpots };
    var st = { from: a, pts: [start], side: null, targets: {}, planners: {}, dest: -1, loop: false };
    st.obs = R.buildObstacles(game, SPOT_R); st.an = E.analyse(game.spots, game.edges);
    updateSide(st, start);
    pendingRoom = null;
    if (!arm(st)) { draw(); return; }
    var re = armFor(game, a, armed.start, ar, armed.obs);   // the marks, found again by their spots
    if (re && re.region.key === armed.region.key) { armed.marks = re.marks; armed.arcMarks = re.arcMarks; armed.markedSpots = marks.markedSpots; }
    /* v112: and what else says how the move goes — the computer's arc, its side at B (found again in
       the new drawing), a loop round nothing (before, these were lost here) */
    if (ar.mArc) armed.mArc = ar.mArc;
    if (ar.encloseNone) armed.encloseNone = true;
    if (ar.bdir) { armed.bdir = ar.bdir; armed.bsign = ar.bsign; }
    if (ar.bside) armed.bside = arrivalSide(b, ar);
    if (ar.bsideDir) armed.bsideDir = ar.bsideDir;   // (v137: what a worker gets instead of the side test)
    if (fitted) {                                  // moving curves tried the move itself: start from that band (it fitted, round the marks too)
      var ar2 = armed;
      marksUsed = Object.keys(ar2.markedSpots).map(Number).sort(function (x, y) { return x - y; });
      armed = null;
      startRoute(a, b, G.resample(fitted, STEP), ar2.obs);
      return;
    }
    if (!armed.targets[b]) { say('Room was made, but spot ' + (b + 1) + ' is still out of reach from this side.', true); draw(); return; }
    connectTo(b);
  }

  function sayArmed() {
    var n = Object.keys(armed.targets).length, m = Object.keys(armed.markedSpots).map(Number).sort(function (x, y) { return x - y; });
    var bl = Object.keys(armed.blocked || {}).map(function (i) { return Number(i) + 1; }).sort(function (x, y) { return x - y; });
    var text = 'Click the destination spot (' + n + ' possible' + (bl.length ? '; no room for ' + bl.join(', ') : '') + ')';
    if (m.length) text += '   —   enclosing spot' + (m.length > 1 ? 's ' : ' ') + m.map(function (i) { return i + 1; }).join(', ');
    say(text + '   —   right-click marks spots to enclose   —   click just outside a spot to choose its side   —   Space cancels');
  }

  /* ---------------- marking spots to enclose ----------------

     Between the two clicks, a right-click (or Shift+click) on a spot marks it
     to be enclosed by the new curve (Peter, 9/22): the curve will separate the
     marked spots from the unmarked ones. Marking a spot marks the whole
     boundary it is on (all those spots are on the same side of any curve);
     a spot on A's own boundary is marked alone and says which arc of that
     boundary the curve should enclose. Marking again unmarks. Marked spots are
     drawn as squares. */
  function toggleMark(s) {
    var ar = armed, reg = ar.region;
    if (s < 0) return;
    if (s === ar.a) { say('Spot ' + (s + 1) + ' is the starting spot.', true); return; }
    if (reg.spots.indexOf(s) < 0) { say('Spot ' + (s + 1) + ' is not on the boundary of the region you are using.', true); return; }
    var k = -1;
    reg.boundaries.forEach(function (bd, i) { if (bd.spots.indexOf(s) >= 0) k = i; });
    if (k === ar.boundary) {                      // on A's own boundary: marks just this spot (chooses the arc)
      if (ar.arcMarks[s]) delete ar.arcMarks[s]; else ar.arcMarks[s] = true;
    } else {
      if (ar.marks[k]) delete ar.marks[k]; else ar.marks[k] = true;
    }
    ar.markedSpots = {};
    Object.keys(ar.arcMarks).forEach(function (i) { ar.markedSpots[i] = true; });
    Object.keys(ar.marks).forEach(function (i) { reg.boundaries[i].spots.forEach(function (j) { ar.markedSpots[j] = true; }); });
    sayArmed(); draw();
  }


  /* A loop from spot a back to itself around nothing, made by two clicks on a:
     start from the circle through a that has the most room, then let the band
     settle it. Tries three sizes and 24 directions. `tried` (v52): the armed
     click, so that a loop with too little room is armed again and room made for
     it like any other move (before, it only said "No room"). */
  function loopAround(a, obs, tried) {
    var best = loopStart(game, a, obs);
    if (!best) { say('No room for a loop at spot ' + (a + 1) + '.', true); draw(); return; }
    startRoute(a, a, G.resample(best, STEP), obs, tried);
  }

  /* Second click: route from the armed start to spot b and hand over to the band. */
  function connectTo(b) {
    var ar = armed;
    plainOffer = null;
    marksUsed = Object.keys(ar.markedSpots).map(Number).sort(function (x, y) { return x - y; });
    if (Object.keys(ar.marks).length || Object.keys(ar.arcMarks).length || ar.encloseNone || ar.mArc) {   // (v112: as aiTry — also the computer's arc and a loop round nothing)
      ar.why = null;
      var g0 = game;
      if (routeAsync(ar, b, false, function (mr) { if (armed === ar && game === g0) connectRouted(ar, b, true, mr); })) { say('Finding a way round the marked spots…   Space stops'); return; }
      connectRouted(ar, b, true, markedRoute(ar, b));
      return;
    }
    connectRouted(ar, b, false);
  }
  /* Enter after the marks could not be applied (v140): the move the shortest way, the marks dropped */
  var plainOffer = null;
  function plainAnyway() {
    var o = plainOffer; plainOffer = null;
    if (!o || armed !== o.ar) return;
    marksUsed = null;
    note = 'the marks could not be applied — drawn the shortest way (Enter)';
    connectRouted(o.ar, o.b, false);
  }
  /* connectTo's second half (v139: after the marked route, which may come from the worker) */
  function connectRouted(ar, b, marked, mr) {
    if (marked) {
      if (!mr) {                                  // still armed, marks kept
        if (ar.why !== 'room') { draw(); return; }
        say('No way round the marked spots at the minimum clearance — looking for one with less room…');
        draw();
        roomCheck = true;
        setTimeout(function () { roomCheck = false; if (armed === ar) explainMarkedNoRoom(b); }, 30);
        return;
      }
      if (mr.plain && mr.failed) {                 // v140 (Peter): a hand move is drawn as marked or not at all — the shortest way only if asked (Enter)
        plainOffer = { ar: ar, b: b };
        say('The marks cannot be applied here: ' + String(note || 'no way round them').replace(/ — drawn the shortest way$/, '') +
            '.   Enter: the shortest way anyway (it may enclose other spots) — or draw the curve by hand, or click another spot', true);
        note = null; draw(); return;
      }
      armed = null;
      if (mr.path) { startRoute(ar.a, b, G.resample(mr.path, STEP), ar.obs, { ar: ar }); return; }
    }
    armed = null;
    if (b === ar.a) { loopAround(ar.a, ar.obs, { ar: ar }); return; }
    var B = game.spots[b], pb = [B.x, B.y];
    var path = ar.planner.pathTo(pb, ar.bside);
    if (!path) { say(ar.bside ? 'No route to spot ' + (b + 1) + ' from that side.' : 'No route found.', true); draw(); return; }
    startRoute(ar.a, b, G.resample([ar.spot].concat(path, [pb]), STEP), ar.obs, { ar: ar });
  }

  /* ---------------- freehand stroke ---------------- */

  /* `dest`: the end spot, when the caller has decided it (click-to-connect);
     otherwise the nearest eligible spot within 3·SNAP of the stroke's end. */
  function finishStroke(dest) {
    var st = stroke; stroke = null;
    var a = st.from, A = game.spots[a];
    var reject = function (msg) { say(msg, true); draw(); };
    var b = dest !== undefined ? dest : nearestSpot(st.pts[st.pts.length - 1], function (sp, i) { return i === a ? sp.deg <= 1 : sp.deg < 3; }, 3 * SNAP);
    if (b < 0) return reject('End the curve near a spot with a free connection.');
    var B = game.spots[b], loop = a === b;

    /* Drop the wobble inside the two end spots, cut off any loops the stroke
       makes with itself, then pin the ends to the spot centres. */
    var pa = [A.x, A.y], pb = [B.x, B.y], keep = 0.6 * SNAP, lo = 0, hi = st.pts.length - 1;
    while (lo <= hi && G.dist(st.pts[lo], pa) < keep) lo++;
    while (hi >= lo && G.dist(st.pts[hi], pb) < keep) hi--;
    var mid = cutSelfLoops(st.pts.slice(lo, hi + 1));
    if (loop && mid.length < 3) return reject('Too short to be a loop.');
    if (route.heroic) { heroicMove(a, b, [pa].concat(mid, [pb])); return; }   // Room → Heroic: as drawn
    var P = G.resample([pa].concat(mid, [pb]), STEP);
    if (P.length < 3) return reject('Too short.');
    startRoute(a, b, P, R.buildObstacles(game, SPOT_R));
  }

  /* Where a polyline crosses itself, drop the loop: the points between the two
     crossing segments are replaced by the crossing point. Repeated until clean. */
  function cutSelfLoops(pts) {
    for (var guard = 0; guard < 50; guard++) {
      var cut = false;
      for (var i = 1; i < pts.length && !cut; i++) {
        for (var j = i + 2; j < pts.length; j++) {
          if (G.segCross(pts[i - 1], pts[i], pts[j - 1], pts[j])) {
            var x = segIntersection(pts[i - 1], pts[i], pts[j - 1], pts[j]);
            pts = pts.slice(0, i).concat([x], pts.slice(j));
            cut = true; break;
          }
        }
      }
      if (!cut) break;
    }
    return pts;
  }

  /* ---------------- the shared pipeline: polyline -> band -> spline -> move ---------------- */


  function startRoute(a, b, P, obs, tried) {
    lastTry = tried || null;
    var reject = function (msg) { say(msg, true); draw(); };
    var rt = makeBand(a, b, P, obs);
    if (typeof rt === 'string') return reject(rt);
    band = rt;
    say('Relaxing…');
    if (route.animate) requestAnimationFrame(animateBand); else finishBand();
  }

  function animateBand() {
    if (!band) return;
    R.advance(band, STEPS_PER_FRAME);
    draw();
    if (band.done) finishBand(); else requestAnimationFrame(animateBand);
  }

  function finishBand() {
    var bd = band, mv = bd.move;
    band = null;
    R.advance(bd, 2000);
    /* the refusal for lack of room names no pixels; the log gets them (v63) */
    var TOO_CLOSE = 'No room: the curve would come too close to something.', detail = null;
    var reject = function (msg) { say(msg, true, detail && msg.replace(TOO_CLOSE, detail)); draw(); };
    if (bd.error) return reject(bd.error);
    if (bd.state.rmin < route.d0 - 1e-6) {
      var msg = TOO_CLOSE;
      detail = 'No room: the closest approach is ' + bd.state.rmin.toFixed(0) + ' px, less than the minimum clearance ' + route.d0 + '.';
      /* v39 (Peter, 9/24: 17 → 1 beside the short curve 1-17): the way was found
         but the band could not keep the minimum clearance — a refusal for lack of
         room like a destination that cannot be reached, so arm the move again and
         offer M (or make room at once, Room → Shift …) — unless room was just made
         for this very move, which must not go round in circles */
      var tr = lastTry; lastTry = null;
      if (tr && !roomSnapshot) {
        if (tr.ar) armed = tr.ar; else if (!arm(tr.st)) return reject(msg);
        pendingRoom = { a: mv.a, b: mv.b, room: { clearance: bd.state.rmin } };
        say(msg + roomOffer() + '   —   or click another spot', true, detail);
        draw();
        if (route.shiftSpots || route.shiftCurves) makeRoom(true);
        return;
      }
      if (roomSnapshot) {                        // room was made for this very move, and it still does not fit: offer R (v50)
        roomSnapshot = false;                     // (the room made stays, as its own undo step)
        msg += ' (Room was made for it, but not enough: U undoes that.)';
        if (tr && (tr.ar ? (armed = tr.ar) : arm(tr.st))) {
          pendingRoom = { a: mv.a, b: mv.b, room: { clearance: bd.state.rmin } };
          return reject(msg + '   A, R or Z: redraw and try again');
        }
      }
      return reject(msg);
    }
    var fit = G.fitClamped(G.resample(bd.pts, STEP), bd.dirA, bd.dirB, TOL, { minPiece: 12 });
    var cert = R.certify(mv.obs, mv.ctx, fit.pieces, 0.6 * route.d0);
    if (!cert.ok) { say('The fitted curve came too close to something. Try drawing it again.', true,
                        'The fitted curve came too close to something (clearance ' + cert.clearance.toFixed(1) + ' px). Try drawing it again.'); draw(); return; }

    commitMove(mv.a, mv.b, fit, fit.pieces.length + ' pieces, clearance ' + Math.min(cert.clearance, bd.state.rmin).toFixed(0) + ' px, ' + bd.iter + ' iterations');
  }

  /* The move a → b along the curve `fit` ({pieces, h}, from a's centre to b's):
     the new spot at half its length, two edges, the turn passes; logged with
     `curveInfo`. Shared by the band (finishBand) and heroic strokes. */
  function commitMove(a, b, fit, curveInfo) {
    var mv = { a: a, b: b };
    var cut = G.splitCurveAtHalf(fit), A = game.spots[mv.a], B = game.spots[mv.b];
    if (!roomSnapshot) snapshot();               // (after making room, its snapshot covers the move too)
    roomSnapshot = false; browsing = false; redoList = [];   // (v97: a move ends browsing with < >)
    var z = game.spots.length;
    game.spots.push({ x: cut.point[0], y: cut.point[1], deg: 2 });
    game.edges.push({ a: mv.a, b: z, pieces: cut.left.pieces, h: cut.left.h, player: game.player });
    game.edges.push({ a: z, b: mv.b, pieces: cut.right.pieces, h: cut.right.h, player: game.player });
    A.deg += 1; B.deg += 1;
    game.moves += 1;
    game.player = 3 - game.player;
    afterMoveMade(mv, curveInfo);
  }
  /* The bookkeeping once a move is in the game object (its spot and two curves added, the move
     counted, the turn passed): the end of the game, the log, the other computer, the turn line,
     what follows a move. Shared by commitMove and a move made in a picture drawn afresh (Z). */
  function afterMoveMade(mv, curveInfo, before) {
    if (!E.analyse(game.spots, game.edges).canMove) game.phase = 'over';
    pendingRoom = null;
    var line = D.move(before || JSON.parse(history[history.length - 1]), game, playerName(3 - game.player));
    if (marksUsed && marksUsed.length) line += '\n    Marked to enclose: ' + marksUsed.map(function (i) { return i + 1; }).join(', ') + '.';
    if (note) line += '\n    Note: ' + note + '.';
    line += '\n    Curve: ' + curveInfo + '.';
    line += '\n    ' + countsText().replace(/  /g, ', ') + '.';
    log(line);
    marksUsed = null;
    if (game.phase === 'over') log(gameOverText().replace(/\s{2,}/g, ' '));
    if (net && !(ai && ai.remote)) net.session.moved(game.moves - 1, netDescribe(mv.a, mv.b));   // (v79: my move goes to the other computer; sayTurn says so)
    sayTurn(); draw();
    if (note) { statusEl.textContent += '   —   ' + note; statusEl.classList.add('warn'); note = null; }
    var committed = game.moves;
    if (ai) aiCommitted();
    if (game.moves !== committed) return;        // (v79: the other computer's move was drawn as another move and taken back in aiCommitted)
    if (route.redrawAfter) relayDrawing('redraw', true);   // Room → Redraw from scratch after each move (undone with the move, v47)
    else if (route.adjustAfter) relayDrawing('adjust', true);   // Room → Adjust the drawing after each move (undone with the move)
    if (!relaying) { updateTitle(); maybeAI(); draw(); }   // (the title before the next computer turn begins — it is not updated while busy; the background white again if no computer moves)
  }

  /* The side a click (or a release) at p chooses at spot b: none when p is on
     the spot's disc (as drawn: lit spots are bigger) — then the shortest way. */
  function sideOfClick(b, p) {
    var B = game.spots[b];
    return G.dist(p, [B.x, B.y]) > spotRadius(b) ? sideTest(b, [p[0] - B.x, p[1] - B.y]) : null;
  }


  /* ---------------- commands ---------------- */
  /* F. When the BROWSER is in full screen (F11, or a shortcut started with
     --start-fullscreen) a page cannot leave it — there is no call for that —
     and asking for the page's own full screen on top of it only brings Chrome's
     "press and hold Esc" notice (Peter, 9/28): then F says F11 instead (v105). */
  function toggleFullScreen() {
    if (document.fullscreenElement) { document.exitFullscreen(); return; }
    var browserFull = window.matchMedia('(display-mode: fullscreen)').matches || (window.innerWidth === screen.width && window.innerHeight === screen.height);
    if (browserFull) { say('The browser is in full screen: press F11 to leave it.', true, null, true); return; }
    document.documentElement.requestFullscreen();
  }
  function togglePolygons() { showPolygons = !showPolygons; draw(); }
  function toggleNumbers() { showNumbers = !showNumbers; draw(); }
  function toggleTriangles() { var el = document.getElementById('opt-triangles'); el.checked = !el.checked; route.triangles = el.checked; draw(); }   // T (v132)
  function toggleDeadNumbers() { var el = document.getElementById('opt-deadnumbers'); el.checked = !el.checked; route.deadNumbers = !el.checked; draw(); }   // G (v133)
  function toggleSmallDead() { var el = document.getElementById('opt-smalldead'); el.checked = !el.checked; route.smallDead = el.checked; draw(); }   // H (v131)
  function savePNG() {
    canvas.toBlob(function (blob) { download('sprouts-' + stamp() + '.png', blob); }, 'image/png');
  }

  function download(name, blob) {
    var link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = name;
    link.click();
    setTimeout(function () { URL.revokeObjectURL(link.href); }, 1000);
  }

  /* The whole position as JSON: the game object, the routing settings, and the
     undo history (version 2, 9/23: the positions before each move, oldest
     first), so a position can be sent along with a bug report, loaded back,
     and moves undone to replay them with a fix. */
  function saveGame() {
    var text = JSON.stringify({ format: 'sprouts-game', version: 2, game: game, route: route, colours: colours,   // (colours: v42)
                                history: history.map(function (h) { return JSON.parse(h); }) }, null, 1);
    download('sprouts-' + stamp() + '.json', new Blob([text], { type: 'application/json' }));
  }
  /* The undo history of a version-1 file, which has none: rebuilt by taking the
     moves off one by one. A move appended its new spot and its two edges
     (x→z, z→y) last and changed nothing else but the two degrees, the move
     count and the player. */
  function rebuildHistory(g) {
    var out = [], cur = JSON.parse(JSON.stringify(g));
    while (cur.moves > 0 && cur.edges.length >= 2) {
      var e2 = cur.edges.pop(), e1 = cur.edges.pop();
      cur.spots.pop();
      cur.spots[e1.a].deg -= 1; cur.spots[e2.b].deg -= 1;
      cur.moves -= 1; cur.player = e1.player; cur.phase = 'play';
      out.unshift(JSON.stringify(cur));
    }
    return out;
  }
  function loadGame() {
    if (net) { say('No loading while connected: the other computer could not follow (Net → Leave first).', true, null, true); return; }   // (v79)
    var input = document.createElement('input');
    input.type = 'file'; input.accept = '.json,application/json';
    input.addEventListener('change', function () {
      var file = input.files[0];
      if (!file) return;
      file.text().then(function (text) {
        var data;
        try { data = JSON.parse(text); } catch (e) { say('Not a JSON file.', true, null, true); return; }
        if (!data || data.format !== 'sprouts-game' || !data.game || !data.game.spots) { say('Not a Sprouts game file.', true, null, true); return; }
        game = data.game; stroke = null; band = null; armed = null; pendingRoom = null; roomSnapshot = false; aiCancel(); aiHalt = false; titleKey = null;
        history = data.history ? data.history.map(function (h) { return JSON.stringify(h); }) : rebuildHistory(game); historyWhy = {}; browsing = false; redoList = [];
        if (data.route) applySettings(data.route);
        if (data.colours) applyColours(data.colours);
        if (game.rules) document.getElementById('opt-rules').value = game.rules;
        resizeCanvas(); sayTurn();
        statusEl.textContent += '   —   loaded ' + file.name;
        logLoaded(file.name);
        maybeAI();
      });
    });
    input.click();
  }
  /* The log lines for a loaded game: its start and every move so far,
     from its history (rebuilt for a version-1 file). */
  function logLoaded(name) {
    var states = history.map(function (h) { return JSON.parse(h); }).filter(function (g) { return g.phase !== 'place'; }).concat([game]);
    var first = states[0];
    if (game.phase === 'place') { log('Loaded ' + name + ': ' + game.spots.length + ' spots placed so far.'); return; }
    log('Loaded ' + name + ': started with ' + (first.spots.length - first.moves - (first.added || 0)) + ' spots, ' + rulesName(game.rules) + '. The game so far:');
    for (var i = 1; i < states.length; i++) {
      if (states[i].moves === states[i - 1].moves && states[i].spots.length === states[i - 1].spots.length + 1) {
        var an = E.analyse(states[i - 1].spots, states[i - 1].edges), q = states[i].spots[states[i].spots.length - 1], r = an.regionAt([q.x, q.y]);
        log('Spot ' + states[i].spots.length + ' added by hand (Ctrl+click)' + (r ? ', in ' + D.region(an, r) : '') + '.');
        continue;
      }
      if (states[i].moves !== states[i - 1].moves + 1) continue;
      var last = states[i].edges[states[i].edges.length - 1];
      log(D.move(states[i - 1], states[i], playerName(last.player)));
    }
    if (game.phase === 'over') log(gameOverText().replace(/\s{2,}/g, ' '));
  }

  function saveLog() {
    var head = 'Sprouts log — ' + document.getElementById('app-version').textContent + ', saved ' + new Date().toString() + '\n\n';
    download('sprouts-log-' + stamp() + '.txt', new Blob([head + logLines.join('\n') + '\n'], { type: 'text/plain' }));
  }
  function savePreviousLog() {
    if (!previousLog) { say('No log of an earlier session is kept in this browser.', true); return; }
    download('sprouts-log-previous-session-' + stamp() + '.txt', new Blob([previousLog], { type: 'text/plain' }));
  }
  function savePosition() {
    download('sprouts-position-' + stamp() + '.txt', new Blob([D.position(game, playerName) + '\n'], { type: 'text/plain' }));
  }

  /* The Settings saved with a game, put back on the sliders and switches (v28,
     Peter 9/23: a loaded game should replay exactly as it was played). The
     sliders' own input handlers set `route`, so the menu and `route` agree. */
  function applySettings(r) {
    function set(id, v) { var el = document.getElementById(id); el.value = v; el.dispatchEvent(new Event('input')); }
    if (typeof r.d0 === 'number') set('opt-d0', r.d0);
    if (typeof r.D === 'number') set('opt-D', r.D);
    if (typeof r.lambda === 'number' && r.lambda > 0) set('opt-lambda', Math.log10(r.lambda));
    if (typeof r.spotScale === 'number') set('opt-spotsize', r.spotScale);
    if (typeof r.lineScale === 'number') set('opt-linewidth', r.lineScale);
    if (typeof r.numberScale === 'number') set('opt-numbersize', r.numberScale);
    if (typeof r.animate === 'boolean') { document.getElementById('opt-animate').checked = r.animate; route.animate = r.animate; }
    if (typeof r.click === 'boolean') { document.getElementById('opt-click').checked = r.click; route.click = r.click; }
    if (typeof r.deadNumbers === 'boolean') { document.getElementById('opt-deadnumbers').checked = !r.deadNumbers; route.deadNumbers = r.deadNumbers; }
    if (typeof r.smallDead === 'boolean') { document.getElementById('opt-smalldead').checked = r.smallDead; route.smallDead = r.smallDead; }
    if (typeof r.triangles === 'boolean') { document.getElementById('opt-triangles').checked = r.triangles; route.triangles = r.triangles; }
    if (typeof r.shiftSpots === 'boolean') { document.getElementById('opt-shift-spots').checked = r.shiftSpots; route.shiftSpots = r.shiftSpots; }
    if (typeof r.shiftCurves === 'boolean') { document.getElementById('opt-shift-curves').checked = r.shiftCurves; route.shiftCurves = r.shiftCurves; }
    if (typeof r.adjustAfter === 'boolean') { document.getElementById('opt-adjust-after').checked = r.adjustAfter; route.adjustAfter = r.adjustAfter; }
    route.redrawAfter = r.redrawAfter === true && !route.adjustAfter;   // (files from before v47 have none)
    heroicSaved = null; route.heroic = false; setHeroic(r.heroic === true, true);   // the file's Shift values are what Heroic off restores   // (v67; v68: switches the local room-making off)
    document.getElementById('opt-redraw-after').checked = route.redrawAfter;
  }
  function stamp() { return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19); }

  var commands = { 'cmd-new': newOrStart, 'cmd-exit': exitPage, 'cmd-undo': undo, 'cmd-full': toggleFullScreen, 'cmd-poly': togglePolygons, 'cmd-numbers': toggleNumbers,
                   'cmd-png': savePNG, 'cmd-save': saveGame, 'cmd-load': loadGame,
                   'cmd-log': saveLog, 'cmd-log-prev': savePreviousLog, 'cmd-position': savePosition, 'cmd-adjust': function () { relayDrawing('adjust'); }, 'cmd-redraw': function () { relayDrawing('redraw'); }, 'cmd-fresh': function () { relayDrawing('fresh'); } };
  Object.keys(commands).forEach(function (id) {
    document.getElementById(id).addEventListener('click', function () { closeMenus(); if (!relaying && !roomBusy && !routeBusy) commands[id](); });
  });

  /* v102 (Peter): before the first move, a change of Layout or Spots in the Game
     menu shows at once (a new game laid out the new way; a computer that moves
     first still waits for N). Spots does not matter for Place by hand. Not
     while connected, nor while a field is half typed (no valid number). */
  function previewLayout(spotsChanged) {
    if (net || game.moves > 0 || relaying || band || roomBusy || routeBusy) return;
    var layout = document.getElementById('opt-layout').value, n = Math.floor(Number(document.getElementById('opt-spots').value));
    if (layout === 'manual' ? spotsChanged : !(n >= 1)) return;
    newGame(undefined, true);
  }
  document.getElementById('opt-layout').addEventListener('change', function () { if (this.value !== 'manual') lastLayout = this.value; previewLayout(false); });
  document.getElementById('opt-spots').addEventListener('input', function () { previewLayout(true); });

  /* Digit keys (Peter, 9/24, v49): 1 … 9 start a new game with that many spots in the Game menu's
     layout (v62, Peter 9/26; before: always a circle), and set its Spots, so N repeats it; 0 (v61; was
     10) a blank window — spots placed by clicking, Enter or N starts. v127 (Peter): 0 sets the menu's
     Layout to Place by hand, and a digit with Place by hand in the menu goes back to the layout used
     before it (Ellipse if none). */
  var lastLayout = 'ellipse';
  function quickGame(n) {
    var sel = document.getElementById('opt-layout');
    if (!n) { if (sel.value !== 'manual') lastLayout = sel.value; sel.value = 'manual'; newGame('manual'); return; }
    if (sel.value === 'manual') sel.value = lastLayout;
    document.getElementById('opt-spots').value = n;
    newGame();
  }
  /* N and Game → New game (v127, Peter): while spots are being placed by hand, they start the game
     from those spots (as Enter does); otherwise a new game. */
  function newOrStart() { if (game.phase === 'place') startPlay(); else newGame(); }
  /* X (v99, Peter): close the page. A browser lets a page close itself only
     when the tab was opened straight at it (a desktop shortcut, a link that
     opens a new tab — one entry in its history); otherwise it silently
     refuses, and the status line says what to do instead. */
  function exitPage() {
    if (net) netLeave();
    window.close();
    setTimeout(function () { say('The browser does not let the page close itself here: close the tab with Ctrl+W (or the window with Alt+F4).', true, null, true); }, 300);
  }
  var keys = { x: exitPage, '<': stepBack, '>': stepForward, n: newOrStart, u: undo, f: toggleFullScreen, c: togglePolygons, s: toggleNumbers, h: toggleSmallDead, t: toggleTriangles, g: toggleDeadNumbers, p: savePNG, enter: function () { if (game.phase === 'place') startPlay(); else plainAnyway(); }, m: function () { makeRoom(false); }, a: function () { relayDrawing('adjust'); }, r: function () { relayDrawing('redraw'); }, z: function () { relayDrawing('fresh'); } };
  for (var dk = 0; dk <= 9; dk++) keys[String(dk)] = quickGame.bind(null, dk);
  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    var tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'SELECT') return;
    if (relaying || roomBusy || routeBusy) return;   // (the space bar is handled above; roomBusy, routeBusy: in a worker, v137, v139)
    var fn = keys[e.key.toLowerCase()];
    if (fn) { e.preventDefault(); closeMenus(); fn(); }
  });

  /* ---------------- menus ---------------- */
  function closeMenus() {
    document.querySelectorAll('.menu.open').forEach(function (m) { m.classList.remove('open'); });
  }
  document.querySelectorAll('.menu-title').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      var menu = btn.parentNode, wasOpen = menu.classList.contains('open');
      closeMenus();
      if (!wasOpen) { menu.classList.add('open'); placePanel(menu); }
      e.stopPropagation();
    });
  });
  /* v94: the panels are position: fixed (the menu bar scrolls sideways and
     would clip them): under their title, kept inside the window. */
  function placePanel(menu) {
    var panel = menu.querySelector('.menu-panel'), r = menu.querySelector('.menu-title').getBoundingClientRect();
    panel.style.top = r.bottom + 'px';
    panel.style.left = Math.max(0, Math.min(r.left, window.innerWidth - panel.offsetWidth)) + 'px';
  }
  var menubar = document.getElementById('menubar');
  function placeOpen() { document.querySelectorAll('.menu.open').forEach(placePanel); }
  menubar.addEventListener('scroll', placeOpen);   // (an open panel follows its title)
  window.addEventListener('resize', placeOpen);
  /* the mouse wheel over the bar scrolls it sideways, when there is more than fits */
  menubar.addEventListener('wheel', function (e) {
    if (menubar.scrollWidth <= menubar.clientWidth || !e.deltaY || e.target.closest('.menu-panel')) return;
    menubar.scrollLeft += e.deltaY; e.preventDefault();
  }, { passive: false });
  document.querySelectorAll('.menu-panel').forEach(function (panel) {
    panel.addEventListener('click', function (e) { e.stopPropagation(); });
  });
  document.addEventListener('click', closeMenus);

  var colourPanel = document.getElementById('colour-panel'), colourSelects = {};
  /* The colours saved with a game (v42): put back where the menus offer them. */
  function applyColours(c) {
    Object.keys(colourSelects).forEach(function (role) {
      var cs = colourSelects[role];
      if (!c[role] || ![].some.call(cs.select.options, function (o) { return o.value === c[role]; })) return;
      cs.select.value = c[role]; colours[role] = c[role]; cs.paint();
    });
    sayTurn(); draw();
  }
  COLOUR_ROLES.forEach(function (role) {
    var label = document.createElement('label'), select = document.createElement('select');
    label.className = 'row';
    label.appendChild(document.createTextNode(role[1]));
    /* each item shows its colour: a colour with bold text in its menu ink (white,
       or black on the light ones), a background pastel with its own colour as text (as in the colour table); so does the
       closed menu, for the colour chosen */
    var list = role[0] === 'background' || role[0] === 'busy' ? BACKGROUNDS : COLOURS, ink = {};
    colourSelects[role[0]] = { select: select, paint: paint };
    list.forEach(function (c) {
      var opt = document.createElement('option');
      opt.value = c[1]; opt.textContent = c[0];
      ink[c[1]] = c[2];
      opt.style.backgroundColor = c[1]; opt.style.color = ink[c[1]]; opt.style.fontWeight = 'bold';
      select.appendChild(opt);
    });
    select.className = 'colour';
    function paint() { select.style.backgroundColor = select.value; select.style.color = ink[select.value]; }
    select.value = colours[role[0]];
    paint();
    select.addEventListener('change', function () { colours[role[0]] = select.value; paint(); sayTurn(); draw(); });
    label.appendChild(select);
    colourPanel.appendChild(label);
  });

  function bindSlider(id, valId, key, show, conv) {
    var input = document.getElementById(id), val = document.getElementById(valId);
    function update() { route[key] = conv(Number(input.value)); val.textContent = show(route[key]); }
    input.addEventListener('input', update);
    update();
  }
  bindSlider('opt-d0', 'val-d0', 'd0', function (v) { return v + ' px'; }, function (v) { return v; });
  bindSlider('opt-D', 'val-D', 'D', function (v) { return v + ' px'; }, function (v) { return v; });
  bindSlider('opt-lambda', 'val-lambda', 'lambda', function (v) { return v.toFixed(2); }, function (v) { return Math.pow(10, v); });
  /* v44 (Peter, 9/24): spot size and curve thickness, half to three times the old ones. The spot
     size is the disc curves keep clear of, so it counts for moves made from now on (curves
     already drawn stay; A adjusts them) */
  bindSlider('opt-spotsize', 'val-spotsize', 'spotScale', function (v) { SPOT_R = SPOT_R0 * v; return (2 * SPOT_R).toFixed(0) + ' px'; }, function (v) { return v; });
  bindSlider('opt-linewidth', 'val-linewidth', 'lineScale', function (v) { LINE_W = LINE_W0 * v; return LINE_W.toFixed(1) + ' px'; }, function (v) { return v; });
  bindSlider('opt-numbersize', 'val-numbersize', 'numberScale', function (v) { NUMBER_PX = NUMBER_PX0 * v; return NUMBER_PX.toFixed(1).replace(/\.0$/, '') + ' px'; }, function (v) { return v; });
  ['opt-spotsize', 'opt-linewidth', 'opt-numbersize'].forEach(function (id) { document.getElementById(id).addEventListener('input', function () { draw(); }); });
  document.getElementById('opt-animate').addEventListener('change', function (e) { route.animate = e.target.checked; });
  document.getElementById('opt-deadnumbers').addEventListener('change', function (e) { route.deadNumbers = !e.target.checked; draw(); });
  document.getElementById('opt-smalldead').addEventListener('change', function (e) { route.smallDead = e.target.checked; draw(); });
  document.getElementById('opt-triangles').addEventListener('change', function (e) { route.triangles = e.target.checked; draw(); });
  document.getElementById('opt-rules').addEventListener('change', function (e) { game.rules = e.target.value; log('Rules changed to ' + rulesName(game.rules) + '.'); sayTurn(); });
  document.getElementById('opt-click').addEventListener('change', function (e) { route.click = e.target.checked; if (!route.click && armed) disarm('Cancelled.'); });
  document.getElementById('opt-shift-spots').addEventListener('change', function (e) { route.shiftSpots = e.target.checked; log('Room: shift spots automatically ' + (route.shiftSpots ? 'on' : 'off') + '.'); });
  /* Heroic (v67) switches off and greys out the local room-making (v68, Peter
     9/26: moving curves assumes smooth splines, and heroic curves have corners);
     switching it off again puts the two Shift options back as they were.
     A and R lay everything out anew and stay available. */
  var heroicSaved = null;
  function setHeroic(on, quiet) {
    var sS = document.getElementById('opt-shift-spots'), sC = document.getElementById('opt-shift-curves');
    if (on && !route.heroic) heroicSaved = { spots: route.shiftSpots, curves: route.shiftCurves };
    if (on) { route.shiftSpots = route.shiftCurves = false; }
    else if (route.heroic && heroicSaved) { route.shiftSpots = heroicSaved.spots; route.shiftCurves = heroicSaved.curves; heroicSaved = null; }
    route.heroic = on;
    document.getElementById('opt-heroic').checked = on;
    sS.checked = route.shiftSpots; sC.checked = route.shiftCurves; sS.disabled = sC.disabled = on;
    sS.parentNode.classList.toggle('disabled', on); sC.parentNode.classList.toggle('disabled', on);
    if (!quiet) log('Room: heroic (hand-drawn curves kept as drawn; no local room-making) ' + (on ? 'on' : 'off') + '.');
  }
  document.getElementById('opt-heroic').addEventListener('change', function (e) { setHeroic(e.target.checked); });
  document.getElementById('opt-shift-curves').addEventListener('change', function (e) { route.shiftCurves = e.target.checked; log('Room: shift curves automatically ' + (route.shiftCurves ? 'on' : 'off') + '.'); });
  /* after each move: adjust (A) or redraw (R) — one or the other, R already does what A does (v47) */
  function setAfter(kind, on) {
    route.adjustAfter = kind === 'adjust' && on; route.redrawAfter = kind === 'redraw' && on;
    document.getElementById('opt-adjust-after').checked = route.adjustAfter;
    document.getElementById('opt-redraw-after').checked = route.redrawAfter;
    log('Room: ' + (kind === 'adjust' ? 'adjust the drawing' : 'rearrange the drawing') + ' after each move ' + (on ? 'on' : 'off') + '.');
  }
  document.getElementById('opt-adjust-after').addEventListener('change', function (e) { setAfter('adjust', e.target.checked); });
  document.getElementById('opt-redraw-after').addEventListener('change', function (e) { setAfter('redraw', e.target.checked); });

  /* ---------------- the computer's moves (v69) ----------------
     The computer thinks in the position alone (ai.js: regions, boundaries,
     corners — no geometry), chooses a move — from corner i of spot x to a
     corner of spot y, and for a one-boundary move which other boundaries S
     go with the arc from x to y — and only then has the ROUTER draw it, as
     if the human had clicked: x armed from the side of that corner (a probe
     point in the corner's sector, as a drag would give), the boundaries S
     marked, a spot of the arc from x to y marked (or of the other arc, with
     the complement marked), then the marked route (markedRoute) or the plain
     one, then the band. A refusal (no room, a curve too close) is not sent to
     the room-making: the computer tries another move — one random move of
     every family, in random order — and when none can be drawn it says so
     and offers R, after which it tries again.
     The standing test (aiCommitted): the drawn position, read off the new
     drawing, must be what apply() predicted — compared without the
     boundaries that have no life left, which may lie on either side. If it
     is another legal move between the same two spots, the router had a
     freedom the marks do not express (the corner it arrives at y by; an
     arc with no spot on it; a plain loop enclosing an isolated spot) and the
     log says what was drawn instead; if it is no legal move at all, that is
     a bug and the status line says so. */
  function kindName(k) { return { human: 'Human', random: 'Random', montecarlo: 'Monte Carlo', parity: 'Parity search' }[k] || k; }
  function isAI(p) { return players[p].kind !== 'human'; }
  function aiCancel() {
    if (ai && ai.timer) clearTimeout(ai.timer);
    if (ai && ai.thinking) { pool.forEach(function (w) { w.terminate(); }); pool = []; jobs = {}; }   // (the workers' answers would only be thrown away)
    var was = !!ai;
    ai = null;
    if (was) draw();                               // (the background no longer gray)
  }
  /* The computer's move, if it is its turn and nothing else is going on.
     A computer set to move first in a game with no move yet waits for N
     (aiHeld, v95, Peter: so the game's settings can still be changed); a
     game started by N or Enter with the computer first begins at once. */
  var aiHeld = false;
  /* Space stops a game between two computers (v125, Peter): the move being
     drawn is finished, no next move starts; Space again continues, N starts a
     new game. Cleared by a new or loaded game, or when a player becomes Human. */
  var aiHalt = false;
  function bothAI() { return isAI(1) && isAI(2) && !net; }
  function maybeAI() {
    if (aiHalt && !bothAI()) aiHalt = false;
    if (ai || band || relaying || roomBusy || routeBusy || stroke || armed || game.phase !== 'play' || !isAI(game.player)) return;
    if (aiHalt) { say('Stopped before move ' + (game.moves + 1) + ' (' + playerName(game.player) + ' to move).   Space continues   —   N starts a new game'); return; }
    if (browsing) { say(playerName(game.player) + ' (' + kindName(players[game.player].kind) + ') waits:   > goes forward, or make its move by hand.'); return; }
    if (aiHeld && game.moves === 0) { say(playerName(game.player) + ' (' + kindName(players[game.player].kind) + ') moves first: press N to start the game.'); return; }
    ai = { player: game.player, timer: setTimeout(aiMove, AI_DELAY) };
    say(playerName(game.player) + ' (' + kindName(players[game.player].kind) + ') to move');
  }
  function aiMove() {
    var a = ai, p = game.player;
    a.timer = null;
    a.who = playerName(p) + ' (' + kindName(players[p].kind) + ')';
    a.an = E.analyse(game.spots, game.edges); a.pos = AI.fromAnalysis(a.an, game.spots);
    var fams = AI.families(a.pos);
    if (!fams.length) { ai = null; log(a.who + ' has no move.'); sayTurn(); return; }   // (cannot happen: the game would be over)
    var kind = players[p].kind, shuffle = function (list) { for (var i = list.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = list[i]; list[i] = list[j]; list[j] = t; } return list; };
    a.failed = []; a.plain = [];
    if (kind === 'random') { a.queue = shuffle(fams).map(function (f) { return AI.randomOf(f); }); aiNext(); return; }
    /* Monte Carlo / parity search: EVERY move (v138: before, one random enclosure per family — Peter's
       11-spot game of 9/30 was lost at move 23, where the one winning move, 8 → 8 enclosing 6, was not
       among the six looked at; and "lost against best play" meant only "every move looked at loses").
       ai.js children with no cap: the enclosures by how many of each kind of interchangeable boundary;
       the positions they lead to are then merged by canonical form — on Peter's 30-spot games ≤ 1626
       moves, ≤ 340 distinct positions. The candidates go to the workers; the moves tied
       for the best value are then tried (aiScore, aiNext). The forms
       that tell equal positions apart are computed on the workers too (v122:
       on the page's thread they froze it for minutes on Peter's game of 10/1). */
    a.queue = shuffle(AI.children(a.pos, Infinity));
    a.thinking = true; a.t0 = Date.now(); draw();
    say(a.who + ' is sorting out its ' + a.queue.length + ' moves…');
    canonKeys(a.pos, a.queue, function (keys) {
      if (ai !== a) return;                        // cancelled meanwhile
      var seen = {}, cands = [];
      a.queue.forEach(function (mv, i) { if (!seen[keys[i]]) { seen[keys[i]] = 1; cands.push(mv); } });
      aiScore(a, p, kind, cands);
    });
  }
  /* the canonical forms of the positions after the moves, on the workers (each a share), then done(keys) */
  function canonKeys(pos, moves, done) {
    ensurePool();
    var onPage = function () { setTimeout(function () { done(moves.map(function (mv) { return AI.canonical(AI.apply(pos, mv)); })); }, 30); };
    if (!pool.length || moves.length < 2) { onPage(); return; }
    var n = Math.min(pool.length, moves.length), share = Math.ceil(moves.length / n), keys = new Array(moves.length), left = 0, failed = false;
    for (var w = 0; w < n; w++) {
      var from = w * share, part = moves.slice(from, from + share);
      if (!part.length) continue;
      left++;
      (function (from, id) {
        jobs[id] = { on: function (msg) {
          delete jobs[id];
          if (msg.keys) msg.keys.forEach(function (k, i) { keys[from + i] = k; }); else failed = true;
          if (--left === 0) { if (failed) onPage(); else done(keys); }
        } };
      })(from, ++jobId);
      pool[w].postMessage({ id: jobId, kind: 'keys', pos: pos, moves: part });
    }
  }
  function aiScore(a, p, kind, cands) {
    var pl = players[p], secs = kind === 'montecarlo' ? pl.mcSeconds : pl.parSeconds;
    var opt = { kind: kind, trials: pl.trials, depth: pl.depth, seconds: secs, cap: AI_CAP, misere: game.rules === 'misere', M: AI.bounds(a.pos).M };
    var label = kind === 'montecarlo' ? (secs ? secs + ' s of random games for ' : pl.trials + ' random games for each of ') + cands.length + ' moves'
                                      : (secs ? secs + ' s, ' : 'depth ' + pl.depth + ', ') + cands.length + ' moves';
    say(a.who + ' is thinking (' + label + ')…');
    score(a.pos, cands, opt, function (text) {
      if (ai !== a) return;
      say(a.who + ' is thinking (' + label + '): ' + text + ', ' + ((Date.now() - a.t0) / 1000).toFixed(0) + ' s…');
    }, function (scores, info, exact) {
      if (ai !== a) return;                        // cancelled meanwhile
      a.thinking = false;
      var order = cands.map(function (mv, i) { return i; }).sort(function (u, v) { return scores[v] - scores[u] || Math.random() - 0.5; });
      var best = scores[order[0]], ties = order.filter(function (i) { return scores[i] === best; });
      log(a.who + ' thought for ' + ((Date.now() - a.t0) / 1000).toFixed(1) + ' s (' + label + ', ' + poolSize() + ' worker' + (poolSize() > 1 ? 's' : '') + (noWorkers ? ' wanted, none: on the page' : '') + (info ? '; ' + info : '') + '): best ' +
          (kind === 'montecarlo' ? Math.round(100 * best) + ' % won' : 'value ' + best.toFixed(3)) + (ties.length > 1 ? ', ' + ties.length + ' moves tie' : '') +
          '; the candidates: ' + order.slice(0, 8).map(function (i) { return AI.describe(a.pos, cands[i]) + ' ' + (kind === 'montecarlo' ? Math.round(100 * scores[i]) + '%' : scores[i].toFixed(2)); }).join(', ') + (order.length > 8 ? ', …' : '') + '.');
      /* Only the moves tied for the best value: the computer's move is always drawn as intended
         (v111, Peter) — see aiNext. Each keeps its value (aiNext: which of the moves drawn the
         shortest way are among the best). */
      order.forEach(function (i) { cands[i].value = scores[i]; });
      a.queue = ties.map(function (i) { return cands[i]; });
      a.best = best;
      /* an exact search knows the outcome (v78, Peter): said after the move, on the status line and in the log */
      if (exact) a.verdict = best > 0 ? 'has a winning position' : 'is lost against best play' + (ties.length === cands.length ? ' (every move loses)' : '');   // (v83: exact also when every candidate was solved by parts, long before the depth reaches M)
      draw();
      aiNext();
    });
  }
  /* ---- the worker pool ---- */
  function poolSize() { return Math.min(workersWanted, workersMax); }
  function version() { var src = document.querySelector('script[src^="ui.js"]').getAttribute('src'); return src.indexOf('?') >= 0 ? src.slice(src.indexOf('?')) : ''; }
  var noWorkers = null;  // why workers cannot be had (a page opened as a file: Chrome allows no Worker from a file:// origin) — then the page's own thread scores, frozen meanwhile
  function ensurePool() {
    var n = poolSize();
    while (pool.length > n) pool.pop().terminate();
    while (pool.length < n && !noWorkers) {
      try {
        var w = new Worker('sprouts-worker.js' + version());
        w.onmessage = function (e) { var j = jobs[e.data.id]; if (j) j.on(e.data); };
        w.onerror = function (e) { log('Script error in a worker: ' + e.message); Object.keys(jobs).forEach(function (id) { jobs[id].on({ scores: null }); }); };
        pool.push(w);
      } catch (e) {
        noWorkers = location.protocol === 'file:' ? 'the page was opened as a file — open it through the web server (http://localhost/sprouts/) for workers' : e.message;
        document.getElementById('workers-title').textContent = 'Workers: none';
        log('No workers: ' + noWorkers + '. The computer thinks on the page\'s own thread instead (the page does not respond meanwhile).');
      }
    }
  }
  /* Score the candidates on the workers: cands are dealt round-robin, each
     worker's answers are put back in place; progress(k done) on the way, then done(scores). */
  /* Score the candidates: done(scores, info) in the end, progress(text) on
     the way.
     - Monte Carlo: EVERY worker gets all the candidates and plays its share
       of the games (opt.trials / workers each) or plays until the deadline
       (opt.seconds); wins and games are summed. Score = share won.
     - Parity search at a fixed depth (opt.depth): the candidates dealt
       round-robin, one job per worker.
     - Parity search with a budget (opt.seconds): ITERATIVE DEEPENING — depth
       1, 2, 3, … each depth on all workers at once with the deadline; the
       last depth that every worker finished decides (values from different
       depths are not comparable). The next depth is started only while the
       time left exceeds what the last one took (each depth takes longer than
       the one before), and not beyond opt.M, the bound on the moves left
       (the search is exact there).
     Without workers the same on the page's own thread (frozen meanwhile). */
  function score(pos, cands, opt, progress, done) {
    ensurePool();
    var solved = function (sc, d) { return !!sc && (d >= opt.M || sc.every(function (v) { return Math.abs(v) === 2; })); };   // (v83: every candidate exact — solved by parts — or the depth reaches M)
    var mc = opt.kind === 'montecarlo', t0 = Date.now(), deadline = opt.seconds ? t0 + 1000 * opt.seconds : null;
    var ratio = function (r) { return r.wins.map(function (w, i) { return r.games[i] ? w / r.games[i] : 0; }); };
    var mcInfo = function (r) { return r.games[0] + ' games each'; };
    if (!pool.length) {                            // no workers: on the page's thread, after the gray background has been painted
      setTimeout(function () {
        if (mc) { var r = deadline ? AI.monteCarloTimed(pos, cands, deadline, opt.misere) : AI.monteCarlo(pos, cands, opt.trials, opt.misere); done(ratio(r), mcInfo(r)); return; }
        if (!deadline) { var sc0 = AI.paritySearch(pos, cands, opt.depth, opt.misere, opt.cap); done(sc0, solved(sc0, opt.depth) ? 'exact' : null, solved(sc0, opt.depth)); return; }
        var last = null, d = 1, lastD = 0, ctx = AI.newContext(deadline), took = 0;
        for (;;) {
          ctx.deadline = d === 1 ? Infinity : deadline; ctx.aborted = false;   // (depth 1 always finishes: a move must be chosen — v123)
          var td = Date.now(), sc = AI.paritySearch(pos, cands, d, opt.misere, opt.cap, null, null, ctx);
          if (!sc) break;
          last = sc; lastD = d; took = Date.now() - td;
          if (solved(sc, d) || deadline - Date.now() <= took) break;
          d++;
        }
        done(last || cands.map(function () { return 0; }), 'depth ' + lastD + (last && lastD < d ? ' (depth ' + d + ' cut short)' : '') + (solved(last, lastD) ? ' — exact' : ''), solved(last, lastD));
      }, 30);
      return;
    }
    /* one round of jobs: job(w) → the message for worker w; onDone(results by worker) */
    function round(n, job, onProgress, onDone) {
      var results = new Array(n), left = n;
      for (var w = 0; w < n; w++) (function (w) {
        var id = ++jobId;
        jobs[id] = { on: function (msg) {
          if (msg.progress !== undefined) { if (onProgress) onProgress(w, msg.progress); return; }
          delete jobs[id]; results[w] = msg;
          if (--left === 0) onDone(results);
        } };
        pool[w].postMessage(Object.assign({ id: id, pos: pos }, job(w)));
      })(w);
    }
    if (mc) {
      var n = pool.length, each = Math.ceil(opt.trials / n);
      round(n, function () { return { kind: 'montecarlo', cands: cands, misere: opt.misere, trials: each, deadline: deadline }; }, null, function (res) {
        var wins = cands.map(function () { return 0; }), games = cands.map(function () { return 0; });
        res.forEach(function (r) { if (r.wins) r.wins.forEach(function (w, i) { wins[i] += w; games[i] += r.games[i]; }); });
        done(ratio({ wins: wins, games: games }), games[0] + ' games each');
      });
      if (deadline) { var tick = function () { if (jobs[jobId]) { progress(((Date.now() - t0) / 1000).toFixed(0) + ' s'); setTimeout(tick, 500); } }; setTimeout(tick, 500); }
      return;
    }
    var n2 = Math.min(pool.length, cands.length), parts = [];
    for (var w = 0; w < n2; w++) parts.push([]);
    cands.forEach(function (mv, i) { parts[i % n2].push(i); });
    var gather = function (res) {                  // the workers' scores back in the candidates' order; null if any was cut short
      var sc = new Array(cands.length), nodes = 0, hits = 0, solvedParts = 0;
      for (var w = 0; w < n2; w++) { if (!res[w].scores) return null; res[w].scores.forEach(function (v, k) { sc[parts[w][k]] = v; }); nodes += res[w].nodes; hits += res[w].hits; solvedParts += res[w].solved || 0; }
      sc.nodes = nodes; sc.hits = hits; sc.solved = solvedParts;
      return sc;
    };
    var jobFor = function (depth) { return function (w) { return { kind: 'parity', cands: parts[w].map(function (i) { return cands[i]; }), misere: opt.misere, depth: depth, cap: opt.cap, deadline: depth === 1 ? null : deadline }; }; };   // (depth 1 always finishes: a move must be chosen — v123)
    var prog = parts.map(function () { return 0; }), onProg = function (w, k) { prog[w] = k; progress((deadline ? 'depth ' + depthNow + ', ' : '') + prog.reduce(function (t, x) { return t + x; }, 0) + ' of ' + cands.length); };
    var depthNow = opt.depth;
    if (!deadline) { round(n2, jobFor(opt.depth), onProg, function (res) { var sc = gather(res); done(sc || cands.map(function () { return 0; }), sc ? sc.nodes + ' nodes, ' + sc.hits + ' table hits, ' + sc.solved + ' parts solved' + (solved(sc, opt.depth) ? ' — exact' : '') : null, solved(sc, opt.depth)); }); return; }
    var last = null, lastInfo = '', took = 0;
    depthNow = 1;
    var next = function () {
      var td = Date.now();
      round(n2, jobFor(depthNow), onProg, function (res) {
        var sc = gather(res);
        if (!sc) { done(last || cands.map(function () { return 0; }), lastInfo + ' (depth ' + depthNow + ' cut short)', false); return; }
        last = sc; took = Date.now() - td; lastInfo = 'depth ' + depthNow + ', ' + sc.nodes + ' nodes, ' + sc.hits + ' table hits, ' + sc.solved + ' parts solved';
        if (solved(sc, depthNow) || deadline - Date.now() <= took) { done(last, lastInfo + (solved(sc, depthNow) ? ' — exact' : ''), solved(sc, depthNow)); return; }
        depthNow++; prog = parts.map(function () { return 0; });
        next();
      });
    };
    next();
  }
  (function () {
    var sel = document.getElementById('opt-workers'), title = document.getElementById('workers-title');
    /* the numbers largest first (v90, Peter) */
    for (var k = workersMax; k >= 1; k--) { var o = document.createElement('option'); o.value = k; o.textContent = k; sel.appendChild(o); }
    sel.value = workersWanted; title.textContent = 'Workers: ' + workersWanted;
    sel.addEventListener('change', function () { workersWanted = Number(sel.value); title.textContent = 'Workers: ' + workersWanted; log('Workers: ' + workersWanted + ' of ' + workersMax + '.'); if (!ai) ensurePool(); });
  })();
  /* The next move to try: the first that the router starts drawing. The
     computer's move is ALWAYS drawn as intended (v111, Peter 9/29: "the move
     should always be drawn as intended. If necessary (continuation is
     impossible because a move cannot be drawn), the game should stop with a
     message to that effect. It's then up to the user to decide what to do";
     v108 put R first, but after R it still played worse moves, and any move
     the router drew in place of the intended one was accepted):
       1. the moves tied for the best value (a.queue; every move for Random),
          as intended; 1b. those of them whose marks the router cannot apply,
          the shortest way — kept only if the drawing is the intended move;
       2. none can be drawn: R, once for this position (aiRedrew) — the
          computer then thinks again in the rearranged drawing and starts at 1;
       3. still none: the game stops, said on the status line and in the log;
          R lets it try once more, or the user takes over.
     aiCommitted takes back any drawing that is not the intended position.
     The other computer's move (a.remote) keeps its own order: its candidates
     as intended, then the shortest way (checked there against the position
     sent), R once, then refused. */
  function aiFailed(a, mv, why) { if (why === 'plain' && !a.second) a.plain.push(mv); else a.failed.push(a.text + ' (' + why + ')'); }
  function aiNext() {
    var a = ai;
    while (a.queue.length) {
      var mv = a.queue.shift();
      if (!a.first) a.first = mv;                  // (the best move, for the fresh drawing — 2b)
      a.move = mv; a.text = AI.describe(a.pos, mv); a.expect = AI.gameKey(AI.apply(a.pos, mv));
      a.making = false;
      var why = aiTry(mv, a.second);
      if (!why) { say(a.who + ' plays ' + a.text + (a.making ? ' — making room for it…' : '…')); return; }
      aiFailed(a, mv, why);
    }
    var tried = function () { return a.failed.concat(a.plain.map(function (mv) { return AI.describe(a.pos, mv) + ' (its marks could not be applied)'; })).join('; '); };
    var bestPlain = a.plain.filter(function (mv) { return mv.value === a.best; });   // (Random: every move)
    if (!a.remote && a.stage === undefined && bestPlain.length) {   // 1b. the best moves the shortest way — kept only if that IS the move (aiCommitted)
      a.stage = 'verify'; a.second = true; a.queue = bestPlain; aiNext(); return;
    }
    a.second = false;
    var here = game.moves + ':' + AI.gameKey(a.pos);
    if (!a.remote && aiRedrew !== here) {         // 2. R, then all over again
      ai = null; aiRedrew = here;
      log(a.who + ' could not draw its move as intended: ' + tried() + '. Rearranging the drawing (R) to try again.');
      relayDrawing('redraw');
      if (!relaying) maybeAI();                    // (R could not start: on to 3 at once — aiRedrew is set)
      return;
    }
    if (a.remote && a.stage !== 'plain' && a.plain.length) { a.stage = 'plain'; a.second = true; a.queue = a.plain; aiNext(); return; }
    ai = null;
    if (a.remote) {                                // the other computer's move (v79): R once for this move, then it is refused there and taken back
      if (!a.remote.redrew) {                      // (for every move, not once per position as for the computer: a move taken back costs the other player more than R costs here)
        a.remote.redrew = true;
        log(a.who + ': its move ' + a.sent + ' could not be drawn here: ' + a.failed.join('; ') + '. Rearranging the drawing (R) to try again.');
        netRetry = { msg: a.remote, done: a.done };
        relayDrawing('redraw');
        if (relaying) return;
        netRetry = null;
      }
      log(a.who + ': its move ' + a.sent + ' could not be drawn here, even after rearranging: ' + a.failed.join('; ') + '. It is refused and taken back there.');
      say('The move of the other computer could not be drawn here, even after rearranging; it was refused and taken back there.', true);
      draw();
      a.done(false, 'no way to draw it, even after rearranging');
      return;
    }
    /* 2b. the picture drawn afresh WITH the move (Z, v114): the position after the best move laid out
       from its map alone and drawn by R — no router. Once per position, like R. */
    if (aiFresh !== here && a.first) {
      aiFresh = here;
      var f = { mv: a.first, player: game.player, who: a.who, text: AI.describe(a.pos, a.first), verdict: a.verdict, onFail: function () { aiStops(a, tried); } };
      log(a.who + ' could not draw its move as intended, even after rearranging: ' + tried() + '. Drawing the picture afresh (Z) with its move ' + f.text + '.');
      relayDrawing('fresh', false, f);
      if (relaying) return;
    }
    aiStops(a, tried);
  }
  function aiStops(a, tried) {                     // 3.
    log(a.who + ' cannot draw its move as intended, even after rearranging and drawing afresh: ' + tried() + '. The game stops here.');
    say(a.who + ' cannot draw its move as intended, even after rearranging and drawing afresh: the game stops here.   R or Z: try once more — or set ' + playerName(game.player) + ' to Human and draw a move by hand', true);
    draw();
  }
  /* A move that ended without a commit — the watch found the page idle
     (nothing relaxing, no room being made) with the move count unchanged: a
     refusal for lack of room, room that could not be made, a curve too close
     — wherever the human would now press M, R or click elsewhere. Any room
     made on the way stays (its own undo step). On to the next move. */
  function aiRefused(why) {
    var a = ai;
    a.failed.push(a.text + ' (' + why + ')');
    armed = null; pendingRoom = null; roomSnapshot = false; lastTry = null;
    aiNext();
  }
  var AI_WATCH_MS = 100;                          // how often the watch looks
  function aiWatch() {
    var a = ai;
    if (!a || a.timer || a.moves0 !== game.moves) return;   // over: cancelled, or committed (aiCommitted clears ai)
    if (band || relaying || roomBusy || routeBusy || roomCheck) { setTimeout(aiWatch, AI_WATCH_MS); return; }
    aiRefused((a.lastWarn || 'refused').replace(/\s{2,}.*$/, ''));
  }
  /* Hand the move to the router. Null when the band has started (or room is
     being made for it); else why not ('plain': the marks cannot be applied —
     with `plain` the shortest way is drawn instead, by the corners the move
     names, and aiCommitted keeps it only if it is the move). */
  function aiTry(mv, plain) {
    var a = ai, an = a.an, pos = a.pos, reg = an.regions[mv.r], x = mv.x, y = mv.y, X = game.spots[x], pa = [X.x, X.y];
    var probe = X.deg === 2 ? cornerProbe(an, reg.boundaries[mv.j], mv.i) : pa;
    var st = { from: x, pts: [probe], side: null, targets: {}, planners: {}, dest: -1, loop: false };
    st.obs = R.buildObstacles(game, SPOT_R); st.an = an;
    hush++;
    try { updateSide(st, probe); var ok = arm(st); } finally { hush--; }
    if (!ok) return 'cannot start at spot ' + (x + 1);
    var ar = armed; armed = null;
    if (ar.region.key !== reg.key) return 'the side of spot ' + (x + 1) + ' was not found';
    var Y0 = game.spots[y];
    if (y !== x && Y0.deg === 2) {                 // y has two corners: arrive by the one the move names (v85, the router's target side; v112: also in the second round — the move is its corners)
      var pby = cornerProbe(an, reg.boundaries[mv.j2], mv.i2);
      ar.bdir = [pby[0] - Y0.x, pby[1] - Y0.y];   // (v112: kept, so that the side can be found again after making room — arrivalSide)
      if (Rm.slidable(game, y)) { var spy = Rm.spline(game, y), pny = Rm.pointAt(spy, spy.u); ar.bsign = ar.bdir[0] * pny.n[0] + ar.bdir[1] * pny.n[1] > 0 ? 1 : -1; }
      ar.bside = sideTest(y, ar.bdir);
    }
    /* (v112: the marks and the arc first — making room, below, tries the move itself with them, and
       draws it with them afterwards; before, a move that needed room was tried and drawn without its
       marks, the shortest way) */
    if (!mv.two) {                                // which boundaries the arc from x to y takes with it
      var bd = pos.regions[mv.r].boundaries[mv.j], W = bd.slice(mv.i).concat(bd.slice(0, mv.i)), pI = (mv.i2 - mv.i + W.length) % W.length;
      var wA = W.slice(1, pI), wB = W.slice(pI + 1);   // the spots strictly inside each arc
      var only = function (arr, other) { return arr.filter(function (s) { return s !== x && s !== y && other.indexOf(s) < 0; }); };   // on that arc alone (a spot on both has no side)
      var arcA = only(wA, wB), arcB = only(wB, wA), S = mv.S, arc = null;
      if (pI > 0) {
        if (arcA.length) arc = arcA[0];
        else if (arcB.length) {                   // no spot on the arc from x to y: mark the other arc and the complement
          arc = arcB[0];
          S = [];
          pos.regions[mv.r].boundaries.forEach(function (b2, k) { if (k !== mv.j && mv.S.indexOf(k) < 0 && b2.some(function (s) { return AI.lives(pos, s) > 0; })) S.push(k); });
        }
        /* v112: the arc that goes with the marked side, exactly — the half-edges from corner i to corner
           i2 (engine names: half-edge k leaves the k-th corner), or the rest when the complement is marked;
           the barrier route (barrierCandidates) needs no spot on it to tell the arcs apart */
        var arcAH = [];
        for (var t = 0; t < pI; t++) arcAH.push((mv.i + t) % W.length);
        ar.mArc = S === mv.S ? arcAH : W.map(function (s, k) { return k; }).filter(function (k) { return arcAH.indexOf(k) < 0; });
      }
      S.forEach(function (k) { ar.marks[k] = true; });
      if (arc !== null) ar.arcMarks[arc] = true;
      /* no spot on either arc and nothing to enclose, in the outside region: the loop must go round NOTHING —
         markedRoute's parity search with every other boundary on the outside's side (v85; before, the shortest way,
         which enclosed whatever lay in it, "the router drew … enclosing 4 instead") */
      if (arc === null && pI > 0 && !S.length && reg.key === -1 && reg.boundaries.length > 1) ar.encloseNone = true;
      Object.keys(ar.arcMarks).forEach(function (i) { ar.markedSpots[i] = true; });
      Object.keys(ar.marks).forEach(function (k) { reg.boundaries[k].spots.forEach(function (j) { ar.markedSpots[j] = true; }); });
    }
    /* reachable, but not by the intended corner: that is room too (v112: before, the second round drew
       it by the other corner — another move) */
    var sided = !!(ar.bside && ar.targets[y] && !ar.planner.reachable([Y0.x, Y0.y], ar.bside));
    if (!ar.targets[y] && !ar.blocked[y]) return 'spot ' + (y + 1) + ' cannot be reached from that side';
    a.moves0 = game.moves; a.lastWarn = null;
    if (!ar.targets[y] || sided) {                 // the rules allow it, the room does not: as for a click — M's machinery, if Room → Shift … is on
      if (!(route.shiftSpots || route.shiftCurves) || route.heroic) return 'no room to reach spot ' + (y + 1) + (sided ? ' by the intended corner' : '');
      armed = ar; hush++;
      try { explainBlocked(y); } finally { hush--; }
      if (!roomBusy) { armed = null; pendingRoom = null; return 'no room to reach spot ' + (y + 1) + (sided ? ' by the intended corner' : ''); }
      a.making = true;                             // (explainBlocked's and makeRoom's messages were hushed: aiNext says what the gray means)
      setTimeout(aiWatch, AI_WATCH_MS);
      return null;
    }
    marksUsed = Object.keys(ar.markedSpots).map(Number).sort(function (u, v) { return u - v; });
    if (Object.keys(ar.marks).length || Object.keys(ar.arcMarks).length || ar.encloseNone || ar.mArc) {
      /* v139: the marked route in the worker; aiNext goes on from here when it comes back */
      var moves0 = game.moves;
      if (routeAsync(ar, y, true, function (mr) {
        if (ai !== a || game.moves !== moves0) return;   // (cancelled meanwhile)
        var why = aiRouted(a, mv, plain, ar, true, mr);
        if (!why) { if (a.making) say(a.who + ' plays ' + a.text + ' — making room for it…'); return; }
        aiFailed(a, mv, why); aiNext();
      })) return null;
      hush++;
      try { var mr = markedRoute(ar, y); } finally { hush--; }
      return aiRouted(a, mv, plain, ar, true, mr);
    }
    return aiRouted(a, mv, plain, ar, false);
  }
  /* aiTry's second half (v139: after the marked route, which may come from the worker): the route, the band.
     Null when the band has started or room is being made; else why not, as aiTry. */
  function aiRouted(a, mv, plain, ar, marked, mr) {
    var x = mv.x, y = mv.y, X = game.spots[x], pa = [X.x, X.y];
    var P, Y = game.spots[y], pb = [Y.x, Y.y];
    if (marked) {
      if (!mr) {
        /* no room round the marks: M's machinery, as for a click (v112: before, the computer gave the move up) */
        if (ar.why === 'room' && (route.shiftSpots || route.shiftCurves) && !route.heroic) {
          armed = ar;
          var sync = true, started = null, moves0 = game.moves;
          explainMarkedNoRoom(y, true, function (making) {   // (v139: may come back later, from the worker)
            if (sync) { started = making; return; }
            if (ai !== a || game.moves !== moves0) return;
            if (making) { a.making = true; say(a.who + ' plays ' + a.text + ' — making room for it…'); setTimeout(aiWatch, AI_WATCH_MS); return; }
            armed = null; pendingRoom = null;
            aiFailed(a, mv, 'no room round the marks'); aiNext();
          });
          sync = false;
          if (started === null) return null;      // (the search is in the worker)
          if (started) { a.making = true; setTimeout(aiWatch, AI_WATCH_MS); return null; }
          armed = null; pendingRoom = null;
        }
        return ar.why === 'room' ? 'no room round the marks' : 'no route round the marks';
      }
      if (mr.plain && !plain) { note = null; return 'plain'; }
      if (mr.plain) log(a.who + ': the marks of ' + a.text + ' could not be applied (' + note + '): drawn the shortest way.');
      if (!mr.plain) P = G.resample(mr.path, STEP);
    }
    if (!P && y === x) {
      var lp = loopStart(game, x, ar.obs);
      if (!lp) return 'no room for a loop';
      P = G.resample(lp, STEP);
    } else if (!P) {
      var path = ar.planner.pathTo(pb, ar.bside);   // (v112: by the intended corner of y — v85's target side was set but not passed here)
      if (!path) return 'no route found';
      P = G.resample([pa].concat(path, [pb]), STEP);
    }
    var rt = makeBand(x, y, P, ar.obs);
    if (typeof rt === 'string') return rt;
    band = rt; lastTry = { ar: ar };               // (a refusal for lack of room arms again and makes room, as for a click)
    if (route.animate) requestAnimationFrame(animateBand); else setTimeout(finishBand, 0);   // (not synchronous: finishBand may come back here)
    setTimeout(aiWatch, AI_WATCH_MS);
    return null;
  }
  var AI_CHECK = 1 << 16;                         // the most subsets aiCommitted tries when the drawn move is not the intended one
  function aiCommitted() {
    var a = ai; ai = null;
    var gotPos = AI.fromAnalysis(E.analyse(game.spots, game.edges), game.spots), got = AI.gameKey(gotPos);
    if (a.remote) {                                // the other computer's move (v79): the drawn position must be the one sent (or its mirror image)
      if (got === a.remote.key || got === a.remote.mkey) { log('    ' + a.who + ': ' + a.sent + ' drawn as on the other computer.'); a.done(true); return; }
      log('    ' + a.who + ': the router drew ' + a.text + ' as another move than the one sent (' + a.sent + '); taken back, trying another way.');
      undoStep();                                  // (the move's own snapshot; the log line of the move stays, followed by this one)
      a.failed.push(a.text + ' (drawn as another move)');
      ai = a; aiNext();
      return;
    }
    /* "as intended" = the same game (v111): the intended position exactly, or one with the same
       canonical form (ai.js: what the game depends on — e.g. its mirror image, which the router
       draws where an arc has no spot to say which side is which; the computer itself takes moves
       with the same canonical form for one and the same move) */
    var same = got === a.expect || AI.canonical(gotPos) === AI.canonical(AI.apply(a.pos, a.move));
    if (!same) {                                   // not the intended move (v111): taken back, as for the other computer's moves
      var other = null, big = false;
      AI.families(a.pos).forEach(function (fam) {
        if (other || !((fam.x === a.move.x && fam.y === a.move.y) || (fam.x === a.move.y && fam.y === a.move.x))) return;
        if (fam.count > AI_CHECK) { big = true; return; }
        for (var m = 0; m < fam.count && !other; m++) {
          var mv = AI.expand(fam, fam.others.filter(function (k, u) { return (m >> u) & 1; }));
          if (AI.gameKey(AI.apply(a.pos, mv)) === got) other = AI.describe(a.pos, mv) + ' (corners ' + mv.i + ' → ' + mv.i2 + ')';
        }
      });
      var drawn = other ? other + ', a legal move, not the one intended' : big ? 'another move (not identified: too many ways to enclose things here)' : 'NO LEGAL MOVE';
      log('    ' + a.who + ' intended ' + a.text + ' (corners ' + a.move.i + ' → ' + a.move.i2 + '); the router drew ' + drawn + '; taken back.');
      if (!other && !big) { log('    BUG: the drawn position is no legal move from ' + (a.move.x + 1) + ' to ' + (a.move.y + 1) + '. Please save the game.'); say('The computer\'s move was not drawn as a legal move (a bug: please save the game).', true); }
      undoStep();                                  // (the move's own snapshot; the log line of the move stays, followed by this one)
      a.failed.push(a.text + ' (drawn as another move)');
      ai = a; aiNext();
      return;
    }
    /* the exact verdict — not after the move that ends the game, where the game-over line says it (v100, Peter) */
    if (a.verdict && game.phase !== 'over') { log('    ' + a.who + ' ' + a.verdict + ' (the search saw the whole game).'); statusEl.textContent += '   —   ' + a.who + ' ' + a.verdict; }
    log('    ' + a.who + ' intended ' + a.text + ': drawn as intended' + (got === a.expect ? '.' : ' (an equivalent position: the same canonical form).'));
  }
  [1, 2].forEach(function (p) {
    var sel = document.getElementById('opt-player' + p), panel = sel.closest('.menu-panel');
    var rows = function () {
      panel.querySelectorAll('.row.montecarlo').forEach(function (r) { r.classList.toggle('hidden', players[p].kind !== 'montecarlo'); });   // (v74: all the rows, not the first)
      panel.querySelectorAll('.row.parity').forEach(function (r) { r.classList.toggle('hidden', players[p].kind !== 'parity'); });
    };
    sel.addEventListener('change', function () {
      players[p].kind = sel.value; rows();
      log('Player ' + p + ' (' + playerName(p) + '): ' + kindName(sel.value) + '.');
      if (sel.value === 'human' && ai && (ai.timer || ai.thinking)) aiCancel();
      if (game.phase === 'play' && game.moves === 0 && !net) { aiHeld = true; if (ai && ai.timer) aiCancel(); }   // (v95: a computer's first move waits for N)
      sayTurn(); maybeAI();
    });
    /* games or seconds, depth or seconds: filling in one empties the other (Peter, 9/27) */
    var pair = function (countId, countKey, secId, secKey, least) {
      var cEl = document.getElementById(countId + p), sEl = document.getElementById(secId + p);
      cEl.addEventListener('input', function () { if (cEl.value === '') return; players[p][countKey] = Math.max(least, Math.floor(Number(cEl.value)) || least); players[p][secKey] = null; sEl.value = ''; });
      sEl.addEventListener('input', function () { if (sEl.value === '') { players[p][secKey] = null; cEl.value = players[p][countKey]; return; } players[p][secKey] = Math.max(0.1, Number(sEl.value) || 0.1); cEl.value = ''; });
    };
    pair('opt-trials', 'trials', 'opt-mcsec', 'mcSeconds', 1);
    pair('opt-depth', 'depth', 'opt-parsec', 'parSeconds', 1);
    /* Same as Player q (v128, Peter): this player's kind and parameters set to the other's */
    document.getElementById('cmd-same' + p).addEventListener('click', function () {
      if (sel.disabled) return;                    // (humans only over the net)
      var q = 3 - p, o = players[q];
      ['trials', 'depth', 'mcSeconds', 'parSeconds'].forEach(function (k) { players[p][k] = o[k]; });
      [['opt-trials', 'trials'], ['opt-mcsec', 'mcSeconds'], ['opt-depth', 'depth'], ['opt-parsec', 'parSeconds']].forEach(function (f) {
        document.getElementById(f[0] + p).value = document.getElementById(f[0] + q).value;
      });
      log('Player ' + p + ' set the same as Player ' + q + '.');
      sel.value = o.kind; sel.dispatchEvent(new Event('change'));   // (logs the kind, shows its rows, and lets a computer move)
    });
    sel.value = players[p].kind;                   // the defaults into the menu
    if (players[p].parSeconds) { document.getElementById('opt-parsec' + p).value = players[p].parSeconds; document.getElementById('opt-depth' + p).value = ''; }
    if (players[p].mcSeconds) { document.getElementById('opt-mcsec' + p).value = players[p].mcSeconds; document.getElementById('opt-trials' + p).value = ''; }
    rows();
  });

  /* ---------------- two computers (menu Net, v79) ----------------
     Peter, 9/27. Host and guest meet in a Firebase room named by a three-
     digit code (net.js: the transport, the protocol, the safeguards; the
     Firebase project is Backgammon's, the rooms `rooms/sprouts<code>` — see net.js). Only the
     moves travel: the other computer's move arrives as its two spots and
     the position it made (ai.js gameKey, and its mirror image's), the moves
     between those spots that make that position are found here (`netCandidates`)
     and handed to the computer players' machinery (`aiNext` → `aiTry` →
     the router; `aiCommitted` checks the drawn position and takes back a
     move the router drew as another one); R once when nothing can be
     drawn, then the move is REFUSED and taken back on the other computer.
     The host is Player 1 and the only one to start games; the guest lays
     the same number of spots out in its own way (all isolated spots are
     alike). Either side undoes; U undoes the last move whoever made it.
     My page is gray (netGray) whenever I cannot move: after my move or undo
     until the other computer has drawn / undone it (the ack), and all through
     the other computer's turn; I take no input meanwhile, nor while the
     other computer's move is being drawn here (netBlock). Two actions at once: the host's wins, the guest's is
     reverted (netRedo keeps what an undo removed). Each computer keeps its
     own picture, settings, colors, A and R. */
  var net = null;        // { session, role (1 host, 2 guest), code, started, kinds (the Player menus before) } while connected
  var netAllow = false;  // the guest's newGame at the host's word (its own N is refused)
  var netRedo = null;    // what my undo took off, kept until it is acknowledged (the host's action may win and put it back)
  var netRetry = null;   // the other computer's move waiting for R to finish: { msg, done }
  /* Backgammon's Firebase project (its web config is meant to be public; the database rules decide what may be written). */
  var FIREBASE_CONFIG = {
    apiKey: 'AIzaSyDhjX4ULNwwHs4etViXMEqmsoDImVR8UBw', authDomain: 'pabg-1b336.firebaseapp.com',
    databaseURL: 'https://pabg-1b336-default-rtdb.firebaseio.com', projectId: 'pabg-1b336', appId: '1:1016658098456:web:41b4fd6992668c2d77c66d'
  };
  var fbDb = null;
  function firebaseDb() {
    if (fbDb) return fbDb;
    if (typeof firebase === 'undefined') { say('The Firebase library did not load (no internet?): no play over the net.', true); return null; }
    try { if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG); fbDb = firebase.database(); }
    catch (e) { say('Firebase could not be started: ' + e.message, true); return null; }
    return fbDb;
  }
  /* Gray while I cannot move (Peter, 9/27): my action on its way, no game yet, or the other computer's turn. */
  function netGray() { return !!(net && (net.session.waiting || (net.role === 2 && !net.started) || (game.phase === 'play' && game.player !== net.role))); }
  /* Why I may not act now, or null. anyTurn: the action is not a move (undo, moving a spot), so the turn does not matter. */
  function netBlock(anyTurn) {
    if (!net) return null;
    if (net.session.waiting) return 'Waiting for the other computer…';
    if (net.session.busy || netRetry) return 'The other computer\'s move is being drawn here — a moment.';
    if (net.role === 2 && !net.started) return 'Waiting for the host to start a game.';
    if (!anyTurn && game.phase === 'play' && game.player !== net.role) return playerName(game.player) + ' on the other computer is to move.';
    return null;
  }
  function mirrorPos(pos) { return { n: pos.n, deg: pos.deg, regions: pos.regions.map(function (r) { return { boundaries: r.boundaries.map(function (b) { return b.slice().reverse(); }) }; }) }; }
  function netKeys() { var pos = AI.fromAnalysis(E.analyse(game.spots, game.edges), game.spots); return { key: AI.gameKey(pos), mkey: AI.gameKey(mirrorPos(pos)) }; }
  function netState() { var k = netKeys(); return { k: game.moves, key: k.key, mkey: k.mkey, fresh: !net.started }; }
  /* My move a → b just made, for the other computer: the two spots, the
     spots of one of the two regions it made (a one-boundary move; null for
     two boundaries) without the move's own, and the position's keys. */
  function netDescribe(a, b) {
    var z = game.spots.length - 1, an = E.analyse(game.spots, game.edges), k = netKeys();
    var regs = an.regions.filter(function (r) { return r.spots.indexOf(z) >= 0; });
    var inside = regs.length > 1 ? regs[0].spots.filter(function (s) { return s !== a && s !== b && s !== z; }) : null;
    return { x: a, y: b, inside: inside, key: k.key, mkey: k.mkey };
  }
  /* The moves here between the two spots that make the position sent, in
     either direction (the router draws from x; from y it may arrive at x by
     the other corner). One-boundary moves: the other boundaries whose spots
     all lie in `inside` go with the arc — or all the others do (inside may
     name either side). */
  function netCandidates(pos, msg) {
    var out = [], seen = {}, inside = {};
    (msg.inside || []).forEach(function (s) { inside[s] = true; });
    function consider(mv) {
      var id = [mv.x, mv.j, mv.i, mv.j2, mv.i2, mv.S.join('.')].join('/');
      if (seen[id]) return;
      seen[id] = true;
      var k = AI.gameKey(AI.apply(pos, mv));
      if (k === msg.key || k === msg.mkey) out.push(mv);
    }
    AI.families(pos).forEach(function (fam) {
      if (!((fam.x === msg.x && fam.y === msg.y) || (fam.x === msg.y && fam.y === msg.x))) return;
      var Ss = [[]];
      if (fam.j === fam.j2 && msg.inside) {
        var reg = pos.regions[fam.r];
        var S1 = fam.others.filter(function (k) { return reg.boundaries[k].every(function (s) { return inside[s]; }); });
        var S2 = fam.others.filter(function (k) { return S1.indexOf(k) < 0; });
        Ss = [S1, S2];
      } else if (fam.j === fam.j2) return;
      Ss.forEach(function (S) {
        var mv = AI.expand(fam, S);
        consider(mv);
        consider({ r: mv.r, j: mv.j2, i: mv.i2, j2: mv.j, i2: mv.i, x: mv.y, y: mv.x, S: mv.S, two: mv.two });   // from the other end
        if (!mv.two) consider({ r: mv.r, j: mv.j2, i: mv.i2, j2: mv.j, i2: mv.i, x: mv.y, y: mv.x, S: fam.others.filter(function (k) { return S.indexOf(k) < 0; }), two: false });
      });
    });
    out.sort(function (u, v) { return (u.x === msg.x ? 0 : 1) - (v.x === msg.x ? 0 : 1); });   // as sent first
    return out;
  }
  /* Draw the other computer's move here: done(ok, why) when it is drawn (the
     ack) or given up (the refusal). Runs when the page is idle. */
  function netDraw(msg, done) {
    if (game.phase !== 'play' || game.moves !== msg.k) { log('Net: move ' + (msg.k + 1) + ' of the other computer does not fit here (' + game.moves + ' moves, ' + game.phase + ').'); done(false, 'the positions differ'); return; }
    var an = E.analyse(game.spots, game.edges), pos = AI.fromAnalysis(an, game.spots), cands = netCandidates(pos, msg);
    var who = playerName(game.player) + ' (the other computer)', sent = (msg.x + 1) + ' → ' + (msg.y + 1);
    if (!cands.length) { log('Net: no move ' + sent + ' here makes the position the other computer sent — the positions differ (a bug: please save the game on both computers).'); say('The other computer\'s move ' + sent + ' does not exist here (a bug: please save the game).', true); done(false, 'no such move here'); return; }
    marksUsed = null; pendingRoom = null; roomSnapshot = false; armed = null;
    ai = { remote: msg, done: done, player: game.player, who: who, sent: sent, an: an, pos: pos, queue: cands, failed: [], plain: [] };
    aiNext();
  }
  function whenIdle(fn) {
    if (band || relaying || roomBusy || routeBusy || roomCheck || stroke || slideDrag || ai || netRetry) { setTimeout(function () { whenIdle(fn); }, AI_WATCH_MS); return; }
    fn();
  }
  function takeBackMove() { var was = game.moves; do undoStep(); while (history.length && game.moves === was); }
  var netHooks = {
    log: log,
    open: function () { if (!net) return; netTitle(); netStatus('Connected as ' + (net.role === 1 ? 'host' : 'guest') + ', room ' + net.code + '.'); log('Net: the other computer is here (room ' + net.code + ').'); sayTurn(); draw(); },
    close: function () { if (!net) return; netTitle(); netStatus('The other computer has left room ' + net.code + '.'); log('Net: the other computer has left.'); say('The other computer has left.   You can play on alone; Net → Leave closes the room.', true); },
    hello: function (msg) {
      var mine = document.getElementById('app-version').textContent;
      if (msg.ver !== mine) statusEl.textContent = 'The other computer runs ' + msg.ver + ', this one ' + mine + ' — reload the older page (Ctrl+F5).   ' + statusEl.textContent, statusEl.classList.add('warn');   // (happened on the first evening: a tab from before a deploy — Peter, 9/27)
      if (net.role === 1 && msg.fresh) netStartGame();   // a guest without a game (just arrived, or reloaded): give it one
    },
    game: function (msg) { netNewGame(msg); },
    move: function (msg, done) { whenIdle(function () { netDraw(msg, done); }); },
    undo: function (msg, done) { whenIdle(function () { log('Net: the other computer undoes move ' + msg.k + '.'); undo(true); done(true); }); },
    revert: function (w) {
      if (w.type === 'move') { takeBackMove(); log('Net: my move taken back (the host moved at the same time).'); }
      else if (w.type === 'undo' && netRedo) { history.push(netRedo.entry); if (netRedo.why) historyWhy[history.length - 1] = netRedo.why; game = JSON.parse(netRedo.game); log('Net: my undo taken back (the host acted at the same time).'); }
      netRedo = null; stroke = null; band = null; armed = null; pendingRoom = null; roomSnapshot = false;
      sayTurn(); draw();
    },
    acked: function () { netRedo = null; sayTurn(); draw(); },
    refused: function (msg) {
      takeBackMove();
      log('Net: the other computer could not draw my move (' + msg.why + '); it is taken back.');
      sayTurn(); draw();
      statusEl.textContent = 'The other computer could not draw your move — it is taken back; play another.   ' + statusEl.textContent; statusEl.classList.add('warn');
    },
    diverged: function (mine, peer) {
      log('Net: the two positions differ after ' + mine.k + ' moves (a bug: please save the game on both computers).\n    here:  ' + mine.key + '\n    there: ' + peer.key);
      say('The two computers disagree about the position (a bug: please save the game on both).', true);
    }
  };
  /* The host has a guest without a game: a game with no moves yet is sent as it is, spots still being placed wait for Enter, anything else starts anew. */
  function netStartGame() {
    if (relaying) finishRelaying(false);
    if (game.phase === 'play' && game.moves === 0 && !band) netGameStarted();
    else if (game.phase === 'place') say('Place the spots and press Enter: the game then starts on both computers.');
    else newGame();
  }
  /* A game began here (newGame, startPlay): the host sends it. */
  function netGameStarted() {
    if (!net || net.role !== 1 || game.phase !== 'play') return;
    net.started = true;
    net.session.sendGame(game.spots.length, game.rules);
    log('Net: the game (' + game.spots.length + ' spots, ' + rulesName(game.rules) + ') goes to the guest.');
  }
  /* The guest: the host's game, laid out my way (Place by hand becomes an ellipse). */
  function netNewGame(msg) {
    if (relaying) finishRelaying(false);
    band = null; stroke = null; armed = null; aiCancel();
    document.getElementById('opt-spots').value = msg.n;
    document.getElementById('opt-rules').value = msg.rules === 'misere' ? 'misere' : 'normal';
    var layout = document.getElementById('opt-layout').value;
    if (layout === 'manual') layout = 'ellipse';
    netAllow = true;
    try { newGame(layout); if (game.spots.length !== msg.n || game.phase !== 'play') newGame('random'); } finally { netAllow = false; }
    net.started = true;
    if (game.spots.length !== msg.n || game.phase !== 'play') { log('Net: could not lay out the host\'s ' + msg.n + ' spots here.'); say('Could not lay out the host\'s ' + msg.n + ' spots in a window this size.', true, null, true); return; }
    log('Net: the host started a game: ' + msg.n + ' spots, ' + rulesName(game.rules) + '.');
    sayTurn(); draw();
  }
  function netTitle() { document.getElementById('net-title').textContent = net ? 'Net: ' + (net.role === 1 ? 'host' : 'guest') + (net.session.connected ? '' : ' (alone)') : 'Net'; }   // (the code is in the menu's field, not here — Peter, 9/27)
  function netStatus(text) { document.getElementById('net-status').textContent = text; }
  function netOpen(db, code, role) {
    var first = true, kinds = { 1: players[1].kind, 2: players[2].kind };
    aiCancel();
    [1, 2].forEach(function (p) { var sel = document.getElementById('opt-player' + p); sel.value = 'human'; sel.dispatchEvent(new Event('change')); sel.disabled = true; });   // (humans only over the net)
    net = { role: role, code: code, started: false, kinds: kinds, session: null };
    net.session = Nt.createSession({
      role: role, version: document.getElementById('app-version').textContent, state: netState,
      connect: function () { if (!first) { try { db.goOffline(); db.goOnline(); } catch (e) {} } first = false; return Nt.firebaseTransport(db, code, role, log); }   // (a rebuild wants a fresh socket)
    }, netHooks);
    netTitle();
    netStatus(role === 1 ? 'Hosting room ' + code + '. Waiting for the guest…' : 'Joining room ' + code + '…');
    log('Net: ' + (role === 1 ? 'hosting' : 'joining') + ' room ' + code + '.');
    say(role === 1 ? 'The room is open: tell the other player the code in the Net menu.   Waiting for the guest…' : 'Joining the room…');
    net.session.start();                           // (may find the other side there at once: its `open` overwrites the lines above)
    draw();
  }
  function netHost() {
    if (net) { say('Already connected (Net → Leave first).', true); return; }
    var db = firebaseDb(); if (!db) return;
    var code = Nt.randomCode();
    document.getElementById('opt-code').value = code;
    netStatus('Opening room ' + code + '…');
    Nt.createRoom(db, code).then(function () { if (!net) netOpen(db, code, 1); })
      .catch(function (e) { netStatus('Could not open a room: ' + e.message); log('Net: could not open room ' + code + ': ' + e.message); say('Could not open a room: ' + e.message, true); });
  }
  function netGuest() {
    if (net) { say('Already connected (Net → Leave first).', true); return; }
    var code = document.getElementById('opt-code').value.trim();
    if (!/^\d{3}$/.test(code)) { say('Type the host\'s three-digit code first.', true); return; }
    var db = firebaseDb(); if (!db) return;
    netStatus('Looking for room ' + code + '…');
    Nt.hostPresent(db, code).then(function (yes) {
      if (!yes) { netStatus('No host is waiting in room ' + code + '.'); say('No host is waiting in room ' + code + '.', true); return; }
      if (!net) netOpen(db, code, 2);
    }).catch(function (e) { netStatus('Could not reach the room: ' + e.message); say('Could not reach the room: ' + e.message, true); });
  }
  function netLeave() {
    if (!net) { say('Not connected.', true); return; }
    var kinds = net.kinds;
    net.session.leave();
    net = null; netRedo = null; netRetry = null;
    [1, 2].forEach(function (p) { var sel = document.getElementById('opt-player' + p); sel.disabled = false; sel.value = kinds[p]; sel.dispatchEvent(new Event('change')); });
    netTitle(); netStatus('Not connected.');
    log('Net: left the room.');
    sayTurn(); draw();
  }
  document.getElementById('cmd-host').addEventListener('click', function () { netHost(); });   // (the menu stays open: the code appears in its field)
  document.getElementById('cmd-guest').addEventListener('click', function () { closeMenus(); netGuest(); });
  document.getElementById('cmd-leave').addEventListener('click', function () { closeMenus(); netLeave(); });
  document.getElementById('opt-code').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); closeMenus(); netGuest(); } });

  /* ---------------- start ---------------- */
  new ResizeObserver(resizeCanvas).observe(stage);
  newGame();
})();
