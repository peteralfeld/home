/* =========================================================================
   ui.js — Sprouts page controller: menus, canvas, pointer input, rendering.
   Geometry lives in geom.js (SproutsGeom), routing in relax.js (SproutsRelax).

   All game geometry is in WORLD coordinates. The world rectangle W0 x H0 is
   the size of the drawing area (in CSS pixels) when the game was started;
   when the window is resized the picture is scaled uniformly and centred.
   ========================================================================= */
(function () {
  'use strict';
  var G = SproutsGeom, R = SproutsRelax, Rt = SproutsRoute, E = SproutsEngine, D = SproutsDescribe, Rm = SproutsRoom, Rd = SproutsRedraw, AI = SproutsAI, Nt = SproutsNet;

  var SPOT_R0 = 6, LINE_W0 = 2.5;   // spot radius and curve width at scale 1 (Settings → Spot size, Curve thickness: × 0.5 … 3, v44; defaults × 1.7, × 1.3 from Peter's game of 9/26, v56)
  var NUMBER_PX0 = 13, NUMBER_PX = NUMBER_PX0;   // spot numbers' font size at scale 1 (Settings → Number size: × 0.5 … 3, v56; default × 1.6 from Peter's game of 9/26, v58)
  var SPOT_R = 6;        // drawn radius of a spot — also what curves keep clear of (the disc), so a bigger spot needs more room
  var SNAP = 16;         // a stroke starts/ends at a spot if within this distance
  var STEP = 4;          // arc-length spacing of the resampled stroke
  var TOL = 1.5;         // largest allowed distance between the relaxed band and the fitted spline
  var STEPS_PER_FRAME = 4;
  var RELAY_FRAME_MS = 30;   // A / R: descent steps per animation frame for about this long (v51: they run to convergence)
  var route = { d0: 10, D: 40, lambda: 1, animate: true, click: true, shiftSpots: true, shiftCurves: true, adjustAfter: false, redrawAfter: false, heroic: false, spotScale: 1.7, lineScale: 1.3, numberScale: 1.6 };   // the Settings and Room menus
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
    ['background', 'Background'], ['player1', 'Player 1 curves'], ['player2', 'Player 2 curves'],
    ['deg0', 'Spots with 0 curves'], ['deg1', 'Spots with 1 curve'], ['deg2', 'Spots with 2 curves'], ['deg3', 'Spots with 3 curves']
  ];
  /* defaults from Peter's game sprouts-2026-09-26T18-00-49.json (v56); spots with 2 curves Fuchsia (v66) */
  var colours = { background: '#e0f9ff', player1: '#0000ff', player2: '#ff0000',
                  deg0: '#ac6488', deg1: '#008000', deg2: '#fc2dfc', deg3: '#666666' };
  /* While the program is computing (A, R; making room — sliding spots, moving
     curves, v65; later: working out a move) the background turns light gray
     (Peter, 9/26, v59). */
  var BUSY_BACKGROUND = '#d3d3d3';
  var roomBusy = false;  // M or the automatic room-making is at work (makeRoom → makeRoomNow)
  function computing() { return !!relaying || roomBusy || !!(ai && ai.thinking) || netGray(); }
  function background() { return computing() ? BUSY_BACKGROUND : colours.background; }
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
  function say(text, warn, detail) {
    if (hush) return;
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
  var aiRedrew = -1;     // the move count at which the computer last ran R itself because no move could be drawn (once per position)
  var AI_DELAY = 300;    // ms between one move's end and the computer's next, so that a move can be seen (the one knob of the AI's pace)
  /* Workers (v71): the pool of Web Workers the searching players use — as many as the machine has by default (menu Workers). */
  var workersMax = Math.max(1, navigator.hardwareConcurrency || 1), workersWanted = workersMax, pool = [], jobs = {}, jobId = 0;
  var AI_CAP = 64;       // the most ways of enclosing boundaries one family contributes to a search node (ai.js children; a stopgap, see the notes)
  function log(text) {
    var t = new Date().toTimeString().slice(0, 8);
    text.split('\n').forEach(function (line, i) { logLines.push((i ? '         ' : t + ' ') + line); });
    console.log(text);
  }
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
      say('Click to place the spots (' + game.spots.length + ' so far), then press Enter to start.');
    } else if (game.phase === 'over') {
      sayGameOver();
    } else {
      say(playerName(game.player) + (net ? (game.player === net.role ? ' (you)' : ' (the other computer)') : '') + ' to move   (move ' + (game.moves + 1) + ')   ' + countsText());
    }
  }
  /* "m=2  M=7  K=1" (Peter, 9/27, v75): m and M the least and most moves the
     game can still last (ai.js bounds: M exact, m the pharisee count of v76),
     K the spots with one life and nowhere to go (the rings). */
  function countsText() {
    if (game.phase !== 'play' && game.phase !== 'over') return '';
    var b = AI.bounds(AI.fromAnalysis(E.analyse(game.spots, game.edges), game.spots));
    return 'm=' + b.m + '  M=' + b.M + '  K=' + Object.keys(stuckSpots()).length;
  }
  /* The player to move has no move. Normal play: they lose; misère: they win. */
  function gameOverText() {
    var stuck = playerName(game.player), other = playerName(3 - game.player);
    var misere = game.rules === 'misere';
    return stuck + " can't move — " + (misere ? stuck + ' wins (misère).' : other + ' wins.') + '   Game over after ' + game.moves + ' moves.';
  }
  function sayGameOver() { say(gameOverText()); }

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
  function draw() {
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
    var stuck = stuckSpots();
    for (i = 0; i < game.spots.length; i++) {
      var sp = game.spots[i], sr = spotRadius(i);
      ctx.fillStyle = shownColour(i);
      if (isMarked(i)) {                         // marked to be enclosed: drawn as a square
        ctx.fillRect(sp.x - 1.1 * sr, sp.y - 1.1 * sr, 2.2 * sr, 2.2 * sr);
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
        var r = spotRadius(i), label = String(i + 1), lx = game.spots[i].x + r + 2, ly = game.spots[i].y - r + 2;
        ctx.lineWidth = 3 * NUMBER_PX / NUMBER_PX0; ctx.strokeStyle = background(); ctx.strokeText(label, lx, ly);
        ctx.fillStyle = shownColour(i); ctx.fillText(label, lx, ly);
      }
    }
  }

  /* Possible destinations are drawn at twice their radius while a start spot is armed. */
  function spotRadius(i) { var t = armed ? armed.targets : stroke ? stroke.targets : null; return t && t[i] ? 2 * SPOT_R : SPOT_R; }
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

  /* layout: the Game menu's unless given (key 0 asks for 'manual' without changing the menu) */
  function newGame(layout) {
    if (net && net.role === 2 && !netAllow) { say('Only the host starts games while connected (Net → Leave to play alone).', true); return; }   // (v79)
    var nb = net && !netAllow ? netBlock(true) : null;
    if (nb) { say(nb, true); return; }
    if (typeof layout !== 'string') layout = document.getElementById('opt-layout').value;
    var n = Math.floor(Number(document.getElementById('opt-spots').value));
    var W = stage.clientWidth, H = stage.clientHeight, pts = [];
    if (layout !== 'manual') {
      if (!(n >= 1)) { say('The number of spots must be at least 1.', true); return; }
      pts = layout === 'circle' ? layoutCircle(n, W, H) : layout === 'line' ? layoutLine(n, W, H) : layoutRandom(n, W, H);
      if (!pts) { say('Unable to fit ' + n + ' spots in a window this size.', true); return; }
    }
    game = {
      W0: W, H0: H, edges: [], player: 1, moves: 0, added: 0,
      phase: layout === 'manual' ? 'place' : 'play', rules: document.getElementById('opt-rules').value,
      spots: pts.map(function (p) { return { x: p[0], y: p[1], deg: 0 }; })
    };
    history = []; historyWhy = {}; stroke = null; armed = null; pendingRoom = null; roomSnapshot = false; aiCancel();
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
    game.phase = 'play';
    log('Play starts with ' + game.spots.length + ' spots placed by hand.');
    netGameStarted();
    sayTurn(); draw();
    maybeAI();
  }

  /* U. Connected (v79): either side may undo, and an undone MOVE is undone
     on the other computer too (a step that only changed the picture — room
     made, A, R, a spot moved by hand — is local, like the picture itself).
     `remote`: the other computer undid its last move — take steps off until
     a move is gone (my own picture steps on top of it go with it). */
  function undo(remote) {
    if (!history.length) { say('Nothing to undo.', true); return; }
    if (net && !remote) { var nb = netBlock(true); if (nb) { say(nb, true); return; } }
    var was = game.moves, redo = net ? { game: JSON.stringify(game), entry: history[history.length - 1], why: historyWhy[history.length - 1] } : null;
    do undoStep(); while (remote && history.length && game.moves === was);
    stroke = null; band = null; armed = null; if (!remote) aiCancel();
    if (net && !remote && game.moves < was) { netRedo = redo; net.session.undone(was); }
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
    if (band || relaying) return;
    var nb = net && (e.button === 0 || e.button === 2) ? netBlock(e.ctrlKey && e.button === 0) : null;   // (v79: not my turn, or the other computer is at work; Ctrl+drag moves spots any time)
    if (nb) { say(nb, true); return; }
    if (ai || (game.phase === 'play' && isAI(game.player))) { say(playerName(game.player) + ' is played by the computer (' + kindName(players[game.player].kind) + '); set it to Human in its menu to play yourself.', true); return; }
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
      if (t >= 0) connectTo(t); else disarm('Cancelled.');
      return;
    }
    marksUsed = null; pendingRoom = null; roomSnapshot = false;
    var i = nearestSpot(p, canStart);
    if (i < 0) { say('No spot has a free connection.', true); return; }
    stroke = { from: i, pts: [p], side: null, targets: {}, planners: {}, dest: -1, loop: false };
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
      var pb = [game.spots[b].x, game.spots[b].y], path = st.planner.pathTo(pb);
      if (!path) { say('No route found.', true); draw(); return; }
      startRoute(a, b, G.resample([[A.x, A.y]].concat(path, [pb]), STEP), st.obs, { st: st });
    }
  });
  canvas.addEventListener('pointercancel', function () { stroke = null; draw(); });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && relaying) { finishRelaying(false); return; }
    if (e.key === 'Escape' && armed) disarm('Cancelled.');
    if (e.key === 'Escape' && ai && (ai.timer || ai.thinking)) { aiCancel(); say('Computer move cancelled — U, a move of yours, or N lets it move again; or set it to Human.', true); }
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
      start = null;
      var bestOff = Infinity;
      for (var k = 0; k < tans.length; k++) {   // the sectors between consecutive tangents whose region is the one pointed into
        var a0 = tans[k], a1 = tans[(k + 1) % tans.length] + (k + 1 < tans.length ? 0 : 2 * Math.PI);
        var mid = (a0 + a1) / 2, probe = [pa[0] + 12 * Math.cos(mid), pa[1] + 12 * Math.sin(mid)];
        if (st.an.regionAt(probe) !== want) continue;
        /* both sides of a spot on a bare path are the same region, so among the
           sectors that match, the one the pointer's direction lies in — or the
           nearest to it — is meant */
        var t = ang - a0; t -= 2 * Math.PI * Math.floor(t / (2 * Math.PI));
        var off = t <= a1 - a0 ? 0 : Math.min(t - (a1 - a0), 2 * Math.PI - t);
        if (off < bestOff) { bestOff = off; start = probe; key = String(k); }
      }
      if (!start) { st.side = null; st.planner = null; st.targets = {}; st.blocked = {}; return; }
    }
    if (st.key === key) return;
    st.key = key; st.side = A.deg === 2 ? start : null;
    if (!st.planners[key]) {
      var ctx = { aIdx: a, bIdx: -1, A: pa, B: pa, rho: route.D * Math.SQRT2, spotR: SPOT_R };
      st.planners[key] = Rt.planner(st.obs, ctx, route.d0, game.W0, game.H0, start, SPOT_R);
    }
    st.planner = st.planners[key];
    st.targets = {};
    game.spots.forEach(function (sp, i) {
      if (i === a ? sp.deg <= 1 : sp.deg < 3 && st.planner.reachable([sp.x, sp.y])) st.targets[i] = true;   // a spot with two free connections can loop to itself
    });
    /* BLOCKED: the spots the rules allow from this side (alive, on the region
       the move is made in) that cannot be reached for lack of room */
    st.blocked = {};
    var reg = A.deg === 2 ? st.an.regionAt(start) : st.an.regions.filter(function (r) { return r.spots.indexOf(a) >= 0; })[0];
    if (reg) reg.spots.forEach(function (i) { if (i !== a && game.spots[i].deg < 3 && !st.targets[i]) st.blocked[i] = true; });
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
  function explainMarkedNoRoom(b) {
    var ar = armed, a = ar.a;
    var low = Rm.lowerClearance(function (d) { return trialMove(game, a, b, ar.start, { marks: ar, d0: d, phase1: true }); }, route.d0 / 2);
    if (!low) {
      pendingRoom = null;
      say('No route encloses the marked spots from this side, even without room: they cannot be separated from the others that way.', true);
      draw(); return;
    }
    pendingRoom = { a: a, b: b, room: { clearance: low.t.rmin }, marked: true,
                    ghost: { path: low.t.pts, w: low.t.rmin, stubs: false, fits: false } };   // (the first ghost for moving curves: no need to search again)
    say('No room to go round the marked spots: the best way round them is too narrow.' + roomOffer() + '   —   or Esc', true,
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
     drawn as they go, until converged (a second press changes nothing); Esc
     stops early and keeps what is there. Then every curve
     becomes a smooth spline (no corners) and is certified, and the position
     must be unchanged; otherwise nothing changes. Its own undo step — or,
     adjusting after a move (Room → Adjust the drawing after each move), part
     of the move's. Logged. */
  function relayDrawing(kind, after) {
    if (relaying || band || game.phase === 'place' || !game.spots.length || (kind === 'adjust' && !game.edges.length)) return;
    /* R while a move waits for room (v50, Peter 9/24: offer R when the move cannot be made otherwise):
       redraw, then try that move again — from the same region, the marks kept */
    var retry = kind === 'redraw' && !after && pendingRoom && armed ?
                { a: armed.a, b: pendingRoom.b, ar: armed, region: D.region(armed.an, armed.region) } : null;
    armed = null; pendingRoom = null; roomSnapshot = false; stroke = null;
    var o = { d0: route.d0, D: route.D, lambda: route.lambda, spotR: SPOT_R, rho: route.D * Math.SQRT2 };
    relaying = { kind: kind, after: !!after, st: Rd.createRedraw(game, o, kind === 'adjust'), start: JSON.stringify(game), t0: Date.now(),
                 before: Rd.leastClearance(game, o), retry: retry };
    say(relayWord() + '…   Esc stops');
    draw();                                       // the gray background at once, also when not animated
    if (route.animate) requestAnimationFrame(relayFrame); else setTimeout(function () { finishRelaying(true); }, 30);
  }
  function relayWord() { return relaying.kind === 'adjust' ? 'Adjusting the drawing' : 'Rearranging the drawing'; }
  function relayFrame() {
    if (!relaying) return;
    var st = relaying.st;
    var t = performance.now();                    // it runs to convergence (v51): as many steps as fit in a frame
    do Rd.stepRedraw(st, 1); while (!st.done && performance.now() - t < RELAY_FRAME_MS);
    game = Rd.redrawCurrent(st);
    if (st.done) { finishRelaying(false); return; }
    say(relayWord() + ': step ' + st.it + ', ' + ((Date.now() - relaying.t0) / 1000).toFixed(0) + ' s…   Esc stops');
    draw();
    requestAnimationFrame(relayFrame);
  }
  function finishRelaying(runToEnd) {
    var rl = relaying, st = rl.st, adjust = rl.kind === 'adjust';
    if (runToEnd) while (!Rd.stepRedraw(st, 50)) { /* on */ }
    relaying = null;
    var r = Rd.finishRedraw(st);
    game = JSON.parse(rl.start);
    if (r.error) { say((adjust ? 'Not adjusted: ' : 'Not rearranged: ') + r.error, true, (adjust ? 'Not adjusted: ' : 'Not rearranged: ') + r.error + ' (least clearance ' + r.clearance.toFixed(1) + ' px)'); draw(); afterRelay(); return; }
    if (!rl.after) snapshot(adjust ? 'drawing adjusted' : 'drawing rearranged');
    game = r.game;
    var fmt = function (c) { return isFinite(c) ? Math.round(c) + ' px' : 'no curves'; };
    log((adjust ? 'Adjusted the drawing' : 'Rearranged the drawing') + (rl.after ? ' after move ' + game.moves : '') +
        (st.done ? '' : ' (stopped with Esc)') + ': ' + (adjust ? '' : 'spots moved up to ' + Math.round(r.moved) + ' px; ') +
        'least clearance ' + fmt(rl.before) + ' before, ' + fmt(r.clearance) + ' now; ' + ((Date.now() - rl.t0) / 1000).toFixed(1) + ' s.');
    sayTurn(); draw();
    statusEl.textContent += '   —   ' + (adjust ? 'adjusted' : 'rearranged') + (rl.after ? '' : '   (U undoes it)');
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
      if (!p) { say('Rearranged, but the region of the move ' + (a + 1) + ' → ' + (rt.b + 1) + ' was not found again (a bug: please save the game).', true); return; }
    }
    var st = { from: a, pts: [p], side: null, targets: {}, planners: {}, dest: -1, loop: false };
    st.obs = R.buildObstacles(game, SPOT_R); st.an = an;
    updateSide(st, p);
    if (!arm(st)) return;
    var re = armFor(game, a, armed.start, rt.ar, armed.obs);
    if (re && re.region.key === armed.region.key) { armed.marks = re.marks; armed.arcMarks = re.arcMarks; armed.markedSpots = rt.ar.markedSpots; }
    if (!armed.targets[rt.b]) {
      say('Rearranged, but there is still no room for ' + (a + 1) + ' → ' + (rt.b + 1) + '.   U undoes the rearranging', true); armed = null; draw(); return;
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
  function roomOffer() { return route.heroic ? '   R: rearrange the drawing and try again' : '   M: make room'; }
  function makeRoom(auto) {
    if (route.heroic) { say('Heroic mode: curves and spots are not moved locally.   R: rearrange the drawing' + (pendingRoom && armed ? ' and try again' : ''), true); return; }
    if (!pendingRoom || !armed) { say('Nothing is waiting for room just now.', true); return; }
    say('Making room for ' + (armed.a + 1) + ' → ' + (pendingRoom.b + 1) + '…');
    var ar = armed, pr = pendingRoom;
    roomBusy = true; draw();
    requestAnimationFrame(function () {
      setTimeout(function () {
        try { if (armed === ar && pendingRoom === pr) makeRoomNow(auto); }
        finally { roomBusy = false; draw(); if (!relaying) maybeAI(); }   // (a move made at once, not animated, found roomBusy still set)
      }, 0);
    });
  }
  function makeRoomNow(auto) {
    var spots = !auto || route.shiftSpots, curves = !auto || route.shiftCurves;
    var ar = armed, a = ar.a, b = pendingRoom.b, regKey = ar.region.key, an = ar.an;
    var o = { d0: route.d0, D: route.D, lambda: route.lambda, spotR: SPOT_R, rho: route.D * Math.SQRT2, ghost0: pendingRoom.ghost };
    var inRegion = function (q) { var r = an.regionAt(q); return !!r && r.key === regKey; };
    var pos = function (gm, i) { return [gm.spots[i].x, gm.spots[i].y]; };
    var reach = function (gm, start) { return trialMove(gm, a, b, start, { marks: ar }); };   // the real test: route (round the marks, if any) and band
    var probeOf = function (gm, cand) {           // the start of a slid A: 12 px off its curve on the region's side
      var pn = Rm.pointAt(Rm.spline(gm, a), cand.u);
      return [pn.p[0] + 12 * cand.side * pn.n[0], pn.p[1] + 12 * cand.side * pn.n[1]];
    };
    var tries = [], res = null, start = ar.start, g2 = null, what = [], why = [], fitted = null;
    if (spots && Rm.slidable(game, b)) {           // 1. the destination
      res = Rm.slideFor(game, b, ar.start, a, inRegion, function (gm) { return reach(gm, ar.start); }, o);
      tries.push(res);
      if (!res.fail) { g2 = JSON.parse(JSON.stringify(game)); Rm.place(g2, b, res.u, 2 * SPOT_R); what.push('slid spot ' + (b + 1) + ' along its curve ' + Math.round(G.dist(res.from, res.to)) + ' px'); }
    }
    if (spots && !g2 && Rm.slidable(game, a)) {    // 2. the start spot, then 3. both
      var bases = [game];
      if (res && res.fail && res.bestU !== null) { var gb = JSON.parse(JSON.stringify(game)); Rm.place(gb, b, res.bestU, 2 * SPOT_R); bases.push(gb); }
      for (var k = 0; k < bases.length && !g2; k++) {
        var base = bases[k], ra = Rm.slideFor(base, a, pos(base, b), b, inRegion, function (gm, cand) { return reach(gm, probeOf(gm, cand)); }, o);
        tries.push(ra);
        if (!ra.fail) {
          g2 = JSON.parse(JSON.stringify(base)); Rm.place(g2, a, ra.u, 2 * SPOT_R);
          start = probeOf(g2, ra);
          if (k === 1) what.push('slid spot ' + (b + 1) + ' along its curve ' + Math.round(G.dist(pos(game, b), pos(base, b))) + ' px');
          what.push('slid spot ' + (a + 1) + ' along its curve ' + Math.round(G.dist(ra.from, ra.to)) + ' px');
        }
      }
    }
    var brief = [];                                // the same reasons without the pixels, for the status line
    if (spots && !g2) {
      var best = Math.max.apply(null, tries.map(function (t) { return t.best; }).concat([pendingRoom.room ? pendingRoom.room.clearance : -Infinity]));
      var who = [b, a].filter(function (i) { return Rm.slidable(game, i); }).map(function (i) { return i + 1; });
      var slideWhy = who.length ? 'sliding spot' + (who.length > 1 ? 's ' : ' ') + who.join(' and ') + ' does not give enough room' :
                                  'neither spot can slide (only a spot made by a move, with just its two curves, can)';
      brief.push(slideWhy);
      why.push(slideWhy + (best > -Infinity ? ' (the best way keeps ' + Math.max(0, Math.round(best)) + ' px clear)' : ''));
    }
    if (curves && !g2) {                           // 4. moving curves
      var mc = Rm.moveCurvesFor(game, a, ar.start, b, function (gm, st, opt) { return trialMove(gm, a, b, st, Object.assign({ marks: ar }, opt)); }, o);
      if (mc.fail) {
        brief.push('moving curves does not either: ' + (mc.brief || mc.reason));
        why.push('moving curves does not either: ' + mc.reason + (mc.best > -Infinity ? ' (the best way keeps ' + Math.max(0, Math.round(mc.best)) + ' px clear)' : ''));
      }
      else {
        g2 = mc.game; start = mc.start; fitted = mc.band;
        var mv = mc.moved.filter(function (m) { return m.px >= 0.5; }).sort(function (x, y) { return y.px - x.px; });
        what.push('moved curve' + (mv.length > 1 ? 's ' : ' ') + mv.map(function (m) { return m.name + ' (up to ' + Math.round(m.px) + ' px)'; }).join(', ') +
                  (mc.rounds > 1 ? ', in ' + mc.rounds + ' rounds' : ''));
      }
    }
    if (!g2) {
      var off = [spots ? null : 'sliding spots', curves ? null : 'moving curves'].filter(Boolean);
      say('No room made for ' + (a + 1) + ' → ' + (b + 1) + (brief.length ? ': ' + brief.join('; ') : '') + '.' +
          (off.length ? '   M also tries ' + off.join(' and ') + '.' : '') + '   R: rearrange the drawing and try again', true,
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
    say(text + '   —   right-click marks spots to enclose   —   Esc cancels');
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

  /* The route from the armed start to spot b that puts the marked spots on
     one side of the curve and all the others on the other. Returns {path}
     (a polyline from A to B), {plain: true} when the marks cannot apply (the
     plain route is drawn), or null after a message (still armed).

     How: candidate curves come from the parity search in route.js (a cut ray
     per boundary that has to change sides; the walk it returns is made a
     simple curve by inflate/enclosingCurves), and every candidate is judged
     by the engine — analysing the position it would make and reading off
     which side of the new curve each spot is on. Cuts are added only for
     boundaries the last candidate left on the wrong side, so k stays small. */
  function markedRoute(ar, b) {
    var a = ar.a, A = game.spots[a], B = game.spots[b], pa = [A.x, A.y], pb = [B.x, B.y], loop = a === b;
    var reg = ar.region, obs = ar.obs, pl = ar.planner, i, j;
    var bK = -1;
    reg.boundaries.forEach(function (bd, k) { if (bd.spots.indexOf(b) >= 0) bK = k; });
    if (!loop && bK !== ar.boundary) {            // joins two boundaries: nothing is enclosed
      note = 'spots ' + (a + 1) + ' and ' + (b + 1) + ' are on different boundaries, so the curve encloses nothing: marks ignored';
      return { plain: true };
    }

    /* the things that have a side: one spot for each other boundary of the
       region; for a loop, the rest of A's own boundary; for a curve A→B, each
       marked spot of A's boundary (whose side the arcs fix — it says which
       side the marked side is) */
    var items = [];
    reg.boundaries.forEach(function (bd, k) {
      if (k !== ar.boundary) items.push({ spot: bd.spots[0], marked: !!ar.marks[k] });
      else if (loop) {
        var rest = bd.spots.filter(function (s) { return s !== a; });
        if (rest.length) items.push({ spot: rest[0], marked: Object.keys(ar.arcMarks).length > 0 });
      } else {
        Object.keys(ar.arcMarks).map(Number).forEach(function (s) { if (s !== a && s !== b) items.push({ spot: s, marked: true, arc: true }); });
      }
    });
    if (!items.some(function (it) { return it.marked; })) return { plain: true };
    /* In the outside region the unbounded part is itself an unmarked side:
       "enclose these" means the bounded pocket holds them, not that the curve
       merely passes them (Peter's game, 9/22: 5 → 2 round the path 1-3-4, the
       only other boundary, so nothing was left to be on the other side and the
       shortest route passed). A region with an outer boundary has that
       boundary among the items already. */
    if (reg.key === -1) items.push({ outside: true, marked: false });
    var pt = function (it) { return [game.spots[it.spot].x, game.spots[it.spot].y]; };

    /* A cut ray for each item, chosen so that the parity of a curve's
       crossings of it says which side of the curve the item is on, relative
       to a fixed REFERENCE: the point where the ray leaves the region for
       good. For that the ray must leave the region once and not come back:
       through the region's outer cycle (if it has one) exactly once, and,
       for a curve A→B, not through A's own boundary at all — unless that IS
       the outer cycle, when the arc it leaves by is noted (the two arcs are
       on opposite sides of any curve A→B, so the reference is "arc 1" and a
       ray leaving by arc 2 has its parity flipped). */
    var an = ar.an, cycles = an.cycles, ciA = reg.boundaries[ar.boundary].cycle, outCi = reg.key >= 0 ? reg.key : -1;
    var arcOf = null;                             // for cycle ciA: halves index -> 1 or 2
    if (!loop && ciA !== undefined) arcOf = arcsOf(cycles[ciA], a, b, ar.start, ar);
    function hits(r, cyc) {                       // crossings of ray r with a cycle, nearest first
      var out = [];
      cyc.halves.forEach(function (h, k) {
        for (var t = 1; t < h.pts.length; t++) {
          if (G.segCross(r[0], r[1], h.pts[t - 1], h.pts[t])) out.push({ k: k, d: G.dist(r[0], segIntersection(r[0], r[1], h.pts[t - 1], h.pts[t])) });
        }
      });
      return out.sort(function (x, y) { return x.d - y.d; });
    }
    items.forEach(function (it) {
      if (it.outside) return;                     // the reference the rays run to; no cut of its own
      var p = pt(it);
      it.ray = null; it.flip = 0;
      for (var d = 0; d < 36 && !it.ray; d++) {
        var r = Rt.ray(p, 2 * Math.PI * (d + 0.37) / 36), flip = 0, ok = true;
        if (outCi >= 0 && hits(r, cycles[outCi]).length !== 1) ok = false;
        if (ok && !loop && ciA !== undefined) {
          var hA = hits(r, cycles[ciA]);
          if (ciA === outCi) { if (!arcOf) ok = false; else flip = arcOf[hA[0].k] === 2 ? 1 : 0; }
          else if (hA.length) ok = false;
        }
        if (ok) { it.ray = r; it.flip = flip; }
      }
    });

    /* The engine's verdict on a candidate curve: which items are on the wrong
       side. The marked side is the side of the first marked item that has one
       (an arc item first: its side cannot be changed). */
    function verdict(cand) {
      var af = E.afterMove(game.spots, game.edges, a, b, cand);
      if (!af.split || !af.left || !af.right) return null;
      items.forEach(function (it) {
        var l = it.outside ? af.left.key === -1 : af.left.spots.indexOf(it.spot) >= 0;
        var r = it.outside ? af.right.key === -1 : af.right.spots.indexOf(it.spot) >= 0;
        it.side = l && !r ? 1 : r && !l ? 0 : -1;
      });
      var lead = items.filter(function (it) { return it.marked && it.side >= 0 && it.arc; })[0] ||
                 items.filter(function (it) { return it.marked && it.side >= 0; })[0];
      if (!lead) return null;
      var mside = lead.side;
      var wrong = items.filter(function (it) { return it.side >= 0 && (it.marked ? it.side !== mside : it.side === mside); });
      return { ok: !wrong.length, wrong: wrong, conflict: wrong.some(function (it) { return it.arc; }) };
    }

    var cuts = items.filter(function (it) { return it.marked; });   // the marked ones always have cuts
    var cand = null;
    if (!loop) {
      var p0 = pl.pathTo(pb);
      if (!p0) { ar.why = 'room'; say('No route found.', true); return null; }
      cand = [pa].concat(p0, [pb]);
    }
    for (var round = 0; round <= Rt.MAX_CUTS; round++) {
      if (cand) {
        var v = verdict(cand);
        if (v && v.conflict) { say('The marked spots on the boundary of spot ' + (a + 1) + ' cannot all be enclosed together.', true); return null; }
        if (v && v.ok) return { path: cand };
        if (v) v.wrong.forEach(function (it) { if (!it.outside && cuts.indexOf(it) < 0) cuts.push(it); });
        else if (round > 0) break;               // the engine could not read the candidate
      }
      if (cuts.some(function (it) { return !it.ray; })) { note = 'cannot tell the sides apart here — drawn the shortest way'; return { plain: true }; }
      if (cuts.length > Rt.MAX_CUTS) { note = 'too many boundaries in that region to route around the marks — drawn the shortest way'; return { plain: true }; }
      /* the parities to look for: the marked ones away from the reference and
         the others with it — failing that, the other way round */
      var w1 = 0, w2 = 0;
      cuts.forEach(function (it, k) {
        if (it.marked ^ it.flip) w1 |= 1 << k;
        if (!it.marked ^ it.flip) w2 |= 1 << k;
      });
      var rays = cuts.map(function (it) { return it.ray; });
      var path = Rt.pathWithParity(pl.grid, obs, pl.start, pb, pl.ring, rays, [w1]) || Rt.pathWithParity(pl.grid, obs, pl.start, pb, pl.ring, rays, [w2]);
      if (!path) { ar.why = 'room'; say('No route found that encloses the marked spots.', true); return null; }
      var cands = enclosingCurves(Rt.inflate(pl.grid, obs, [pl.start].concat(path, [pb])), pa, pb, loop, obs);
      /* the candidates that cross nothing, each judged: the first the engine
         accepts is the route; otherwise the first one tells the next round
         which items are on the wrong side (for a loop the two arcs are a
         tiny one and the long one, v31, so taking the first blindly fails) */
      var valid = cands.filter(function (cd) { return !R.polylineCrossesObstacle(obs, cd) && !R.polylineCrossesItself(cd); });
      for (i = 0; i < valid.length; i++) {
        var vi = verdict(valid[i]);
        if (vi && vi.ok) return { path: valid[i] };
      }
      cand = valid[0] || null;
      if (!cand) break;
    }
    note = 'could not route around the marks — drawn the shortest way';
    return { plain: true };
  }

  /* Which arc of the boundary cycle `cyc` (from the engine) each of its
     half-edges is on, for a curve from spot a to spot b: 1 from a's corner
     round to b's, 2 the rest. a's corner is the one facing `start`; b must
     have only one corner on the cycle. Null if the arcs cannot be told. */
  function arcsOf(cyc, a, b, start, ar) {
    var hv = cyc.halves, n = hv.length, atA = [], atB = [], k;
    hv.forEach(function (h, k) { if (h.tail === a) atA.push(k); if (h.tail === b) atB.push(k); });
    if (atB.length !== 1 || !atA.length) return null;
    var kA = atA[0];
    if (atA.length > 1) {                          // the corner whose sector holds the start direction
      var A = game.spots[a], ang = Math.atan2(start[1] - A.y, start[0] - A.x);
      kA = -1;
      atA.forEach(function (k) {
        var prev = hv[(k + n - 1) % n], back = Math.atan2(prev.pts[prev.pts.length - 2][1] - A.y, prev.pts[prev.pts.length - 2][0] - A.x);
        var lo = hv[k].angle, span = back - lo; span -= 2 * Math.PI * Math.floor(span / (2 * Math.PI));   // sector from the outgoing curve round to the incoming one
        var t = ang - lo; t -= 2 * Math.PI * Math.floor(t / (2 * Math.PI));
        var mid = lo + span / 2, probe = [A.x + 12 * Math.cos(mid), A.y + 12 * Math.sin(mid)];
        if (t < span && ar && ar.an.regionAt(probe) === ar.region) kA = k;
      });
      if (kA < 0) return null;
    }
    var kB = atB[0], out = [], len = (kB - kA + n) % n;
    for (k = 0; k < n; k++) out[k] = (k - kA + n) % n < len ? 1 : 2;
    return out;
  }

  /* Which spots are connected to spot s by curves (true at their indices). */
  function componentOf(s) {
    var parent = game.spots.map(function (sp, i) { return i; });
    function find(x) { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; }
    game.edges.forEach(function (e) { parent[find(e.a)] = find(e.b); });
    var root = find(s), out = {};
    game.spots.forEach(function (sp, i) { if (find(i) === root) out[i] = true; });
    return out;
  }

  /* The curves from A to B along the boundary of an inflated walk (see
     route.js inflate): the loop nearest the walk's first clean cell is cut at
     the edge nearest that cell and at the edge nearest its last clean cell,
     and each of the two arcs between the cuts, joined to A and to B (A again
     for a loop), is a candidate. A cut edge must be visible from the spot it
     joins. */
  function enclosingCurves(loops, pa, pb, loop, obs) {
    var head = [pa], L = null, best = Infinity, w1 = loops.first, w2 = loops.last;
    if (!w1) return [];
    loops.forEach(function (l) { l.forEach(function (v) { var d = G.dist(v, w1); if (d < best) { best = d; L = l; } }); });
    if (!L) return [];
    var n = L.length, end = loop ? pa : pb;
    function nearestEdge(p, from) {               // the edge nearest p whose ends `from` can see
      var order = L.map(function (v, i) { return i; }).sort(function (x, y) {
        return G.distPointSeg(p, L[x], L[(x + 1) % n]) - G.distPointSeg(p, L[y], L[(y + 1) % n]);
      });
      for (var t = 0; t < order.length && t < 12; t++) {
        var e = order[t];
        if (!R.polylineCrossesObstacle(obs, [L[e], from, L[(e + 1) % n]])) return e;
      }
      return order[0];
    }
    var e1 = nearestEdge(w1, pa), e2 = nearestEdge(w2, end), out = [], arc, t;
    arc = [];                                     // forward: from the far end of edge e1 round to the near end of e2
    for (t = (e1 + 1) % n; ; t = (t + 1) % n) { arc.push(L[t]); if (t === e2) break; }
    out.push(head.concat(arc, [end]));
    arc = [];                                     // backward: from the near end of e1 round to the far end of e2
    for (t = e1; ; t = (t + n - 1) % n) { arc.push(L[t]); if (t === (e2 + 1) % n) break; }
    out.push(head.concat(arc, [end]));
    if (e1 === e2) { out.push(head.concat([L[e1], L[(e1 + 1) % n]], [end])); out.push(head.concat([L[(e1 + 1) % n], L[e1]], [end])); }
    return out;
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
  /* The starting circle for a loop round nothing at spot a of gm (null: none crosses nothing). */
  function loopStart(gm, a, obs) {
    var A = gm.spots[a], pa = [A.x, A.y];
    var ctx = { aIdx: a, bIdx: a, A: pa, B: pa, rho: route.D * Math.SQRT2, spotR: SPOT_R };
    var best = null, bestClear = -Infinity;
    [1.5 * route.D, route.D, 0.6 * route.D].forEach(function (r) {
      for (var k = 0; k < 24; k++) {
        var ang = 2 * Math.PI * k / 24, cx = pa[0] + r * Math.cos(ang), cy = pa[1] + r * Math.sin(ang), pts = [];
        for (var m = 0; m <= 36; m++) { var t = ang + Math.PI + 2 * Math.PI * m / 36; pts.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]); }
        pts[0] = pa; pts[36] = pa;
        if (R.polylineCrossesObstacle(obs, pts)) continue;
        var clear = Infinity;
        for (m = 3; m < 34; m++) clear = Math.min(clear, R.rObs(obs, ctx, pts[m]));
        clear = Math.min(clear, r);              // a bigger loop is no better once it is roomy
        if (clear > bestClear) { bestClear = clear; best = pts; }
      }
    });
    return best && bestClear >= 1 ? best : null;
  }

  /* Second click: route from the armed start to spot b and hand over to the band. */
  function connectTo(b) {
    var ar = armed;
    marksUsed = Object.keys(ar.markedSpots).map(Number).sort(function (x, y) { return x - y; });
    if (Object.keys(ar.marks).length || Object.keys(ar.arcMarks).length) {
      ar.why = null;
      var mr = markedRoute(ar, b);
      if (!mr) {                                  // still armed, marks kept
        if (ar.why !== 'room') { draw(); return; }
        say('No way round the marked spots at the minimum clearance — looking for one with less room…');
        draw();
        roomCheck = true;
        setTimeout(function () { roomCheck = false; if (armed === ar) explainMarkedNoRoom(b); }, 30);
        return;
      }
      armed = null;
      if (mr.path) { startRoute(ar.a, b, G.resample(mr.path, STEP), ar.obs, { ar: ar }); return; }
    }
    armed = null;
    if (b === ar.a) { loopAround(ar.a, ar.obs, { ar: ar }); return; }
    var B = game.spots[b], pb = [B.x, B.y];
    var path = ar.planner.pathTo(pb);
    if (!path) { say('No route found.', true); draw(); return; }
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
  function segIntersection(a, b, c, d) {
    var r = [b[0] - a[0], b[1] - a[1]], s = [d[0] - c[0], d[1] - c[1]], den = r[0] * s[1] - r[1] * s[0];
    var t = den ? ((c[0] - a[0]) * s[1] - (c[1] - a[1]) * s[0]) / den : 0;
    return [a[0] + t * r[0], a[1] + t * r[1]];
  }

  /* ---------------- the shared pipeline: polyline -> band -> spline -> move ---------------- */

  /* P runs from spot a's centre to spot b's centre. It must cross nothing.
     R.createRoute relaxes it in two phases (see relax.js); between them the
     curve's departure direction at each spot is fixed by choosePort — Peter's
     rule: the bisector of the sector used at a spot with two curves; otherwise
     the route's own direction, kept at least MIN_ANGLE from any curve already
     there. */
  /* The elastic band for a move from a to b along the polyline P (in the
     current `game`), or a message string saying why not. */
  function makeBand(a, b, P, obs) {
    var A = game.spots[a], B = game.spots[b], pa = [A.x, A.y], pb = [B.x, B.y], loop = a === b;
    var ctx = { aIdx: a, bIdx: b, A: pa, B: pb, rho: route.D * Math.SQRT2, spotR: SPOT_R };
    if (R.polylineCrossesObstacle(obs, P)) return 'The curve crosses something.';
    if (R.polylineCrossesItself(P)) return 'The curve crosses itself.';
    /* the sectors the curve leaves the spots through are those of P's first and
       last segments (the side the user chose); the band cannot cross a curve, so
       it stays in them, though its direction 3·d0 out may point elsewhere */
    var n = P.length - 1, sideA = [P[1][0] - pa[0], P[1][1] - pa[1]], sideB = [P[n - 1][0] - pb[0], P[n - 1][1] - pb[1]];
    var rt = R.createRoute(obs, ctx, P, { d0: route.d0, D: route.D, lambda: route.lambda }, function (rawA, rawB) {
      var portA = choosePort(a, rawA, sideA, loop ? [rawB] : []);
      if (!portA) return 'No room to leave spot ' + (a + 1) + ' on that side.';
      var portB = choosePort(b, rawB, sideB, loop ? [portA.dir] : []);
      if (!portB) return 'No room to arrive at spot ' + (b + 1) + ' from that side.';
      return { portA: portA, portB: portB };
    });
    if (!rt) return 'The curve passes through or touches something.';
    rt.move = { a: a, b: b, obs: obs, ctx: ctx };
    return rt;
  }

  /* The move a → b, planned from `start` and relaxed to the end, in the
     position gm — { E, rmin, pts } of the relaxed band, or null if it fails —
     without drawing anything (making room judges its candidates with this).
     opt.marks: an armed object whose marks the route must honour (its spots
     are what count: the marks are re-read in gm, see armFor); opt.d0: plan at
     that minimum clearance instead of the Settings' one; opt.phase1: only the
     band's first phase (free ends, no ports — for a ghost at a small
     clearance, where the ports fail near crowded spots). */
  function trialMove(gm, a, b, start, opt) {
    opt = opt || {};
    var saved = game, savedD0 = route.d0, savedNote = note;
    game = gm;                                    // choosePort, tangentsAt and markedRoute read `game`
    if (opt.d0) route.d0 = opt.d0;
    hush++;
    try {
      var obs = R.buildObstacles(gm, SPOT_R), A = gm.spots[a], B = gm.spots[b], pa = [A.x, A.y], pb = [B.x, B.y], P;
      if (opt.marks && (Object.keys(opt.marks.marks).length || Object.keys(opt.marks.arcMarks).length)) {
        var ar = armFor(gm, a, start, opt.marks, obs);
        if (!ar) return null;
        var mr = markedRoute(ar, b);
        if (!mr || !mr.path) return null;         // (a plain fallback is not what was asked for)
        P = G.resample(mr.path, STEP);
      } else if (a === b) {                          // a loop round nothing (v52): as loopAround starts it
        var lp = loopStart(gm, a, obs);
        if (!lp) return null;
        P = G.resample(lp, STEP);
      } else {
        var ctx = { aIdx: a, bIdx: -1, A: pa, B: pa, rho: route.D * Math.SQRT2, spotR: SPOT_R };
        var path = Rt.planner(obs, ctx, route.d0, gm.W0, gm.H0, start, SPOT_R).pathTo(pb);
        if (!path) return null;
        P = G.resample([pa].concat(path, [pb]), STEP);
      }
      if (opt.phase1) {
        var rt1 = R.createRoute(obs, { aIdx: a, bIdx: b, A: pa, B: pb, rho: route.D * Math.SQRT2, spotR: SPOT_R }, P,
                                { d0: route.d0, D: route.D, lambda: route.lambda }, function () { return 'phase 1 only'; });
        if (!rt1) return null;
        R.advance(rt1, 2000);
        return { E: rt1.state.E, rmin: rt1.state.rmin, pts: rt1.pts };
      }
      var rt = makeBand(a, b, P, obs);
      if (typeof rt === 'string') return null;
      R.advance(rt, 2000);
      return rt.error ? null : { E: rt.state.E, rmin: rt.state.rmin, pts: rt.pts };
    } finally { game = saved; route.d0 = savedD0; note = savedNote; hush--; }
  }

  /* The armed state for a move from spot a (leaving from `start`) in position
     gm — `game` must be gm — with the marks of ar0 carried over: a marked
     boundary is found again by its spots (after spots slid or curves moved
     the boundaries are the same, but the analysis is new). Null if a's region
     cannot be found. */
  function armFor(gm, a, start, ar0, obs) {
    var an = E.analyse(gm.spots, gm.edges), A = gm.spots[a], pa = [A.x, A.y];
    var reg = A.deg === 2 ? an.regionAt(start) : an.regions.filter(function (r) { return r.spots.indexOf(a) >= 0; })[0];
    if (!reg) return null;
    var ctx = { aIdx: a, bIdx: -1, A: pa, B: pa, rho: route.D * Math.SQRT2, spotR: SPOT_R };
    var ar = { a: a, spot: pa, start: start, obs: obs, an: an, region: reg, boundary: -1, marks: {}, arcMarks: {}, markedSpots: ar0.markedSpots,
               planner: Rt.planner(obs, ctx, route.d0, gm.W0, gm.H0, start, SPOT_R) };
    reg.boundaries.forEach(function (bd, k) { if (bd.spots.indexOf(a) >= 0) ar.boundary = k; });
    Object.keys(ar0.marks).forEach(function (k0) {
      var sp = ar0.region.boundaries[k0].spots;
      reg.boundaries.forEach(function (bd, k) { if (bd.spots.some(function (x) { return sp.indexOf(x) >= 0; })) ar.marks[k] = true; });
    });
    Object.keys(ar0.arcMarks).forEach(function (s) { ar.arcMarks[s] = true; });
    return ar;
  }

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
          return reject(msg + '   R: rearrange the drawing and try again');
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
    roomSnapshot = false;
    var z = game.spots.length;
    game.spots.push({ x: cut.point[0], y: cut.point[1], deg: 2 });
    game.edges.push({ a: mv.a, b: z, pieces: cut.left.pieces, h: cut.left.h, player: game.player });
    game.edges.push({ a: z, b: mv.b, pieces: cut.right.pieces, h: cut.right.h, player: game.player });
    A.deg += 1; B.deg += 1;
    game.moves += 1;
    game.player = 3 - game.player;
    if (!E.analyse(game.spots, game.edges).canMove) game.phase = 'over';
    pendingRoom = null;
    var line = D.move(JSON.parse(history[history.length - 1]), game, playerName(3 - game.player));
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
    if (!relaying) maybeAI();
  }

  /* Unit tangents, pointing away from spot i, of the curves already at it. */
  function tangentsAt(i) {
    var out = [], sp = game.spots[i];
    game.edges.forEach(function (e) {
      var b = e.a === i ? e.pieces[0] : e.b === i ? e.pieces[e.pieces.length - 1] : null;
      if (!b) return;
      var q = e.a === i ? b[1] : b[2], v = [q[0] - sp.x, q[1] - sp.y], len = Math.hypot(v[0], v[1]) || 1;
      out.push([v[0] / len, v[1] / len]);
    });
    return out;
  }

  var MIN_ANGLE = Math.PI / 6;   // a new curve leaves a spot at least 30° from any curve already there
  var MIN_HALF_SECTOR = 5 * Math.PI / 180;

  /* Where the new curve leaves spot i: { dir, q }. `raw` is the route's own
     direction there (measured 3·d0 out along the band); `side` is a direction
     in the sector between the curves at the spot that the route leaves
     through (the first segment of the initial polyline — the band cannot
     cross a curve, so it stays in that sector, but `raw` can point outside it
     when the band bends round a curve within 3·d0, as on a small loop);
     `extra` holds directions to keep away from besides the curves at the spot
     (the other leg of a loop). Two curves at the spot: `raw`, kept at least
     MIN_ANGLE from both curves bounding that sector — the bisector when the
     sector is too narrow for that (under 2·MIN_ANGLE). The bisector of a WIDE
     sector could point nearly opposite to the route (a 330° sector at a spot
     whose two curves leave side by side), which made the stub cross the
     route. One curve: `raw`, turned away to at least MIN_ANGLE from it. None:
     `raw`. The port distance q is 3·d0, or more when the nearest curve is
     close, so that the port itself is at least 1.5·d0 from it; null if the
     sector is too narrow to use. */
  function choosePort(i, raw, side, extra) {
    var tans = tangentsAt(i).concat(extra), ang = Math.atan2(raw[1], raw[0]), sideAng = Math.atan2(side[1], side[0]);
    var angs = tans.map(function (t) { return Math.atan2(t[1], t[0]); });
    function wrap(x) { return x - 2 * Math.PI * Math.round(x / (2 * Math.PI)); }
    function ccw(x) { x = wrap(x); return x <= 0 ? x + 2 * Math.PI : x; }   // an angle as a counter-clockwise turn in (0, 2π]
    var half = Math.PI, q = 3 * route.d0;
    if (angs.length >= 2) {
      var k = 0, best = Infinity;                 // the tangent just clockwise of `side`
      for (var j = 0; j < angs.length; j++) {
        var d = ccw(sideAng - angs[j]);
        if (d < best) { best = d; k = j; }
      }
      var next = 2 * Math.PI;                     // the next tangent counter-clockwise from it
      for (j = 0; j < angs.length; j++) {
        var e = ccw(angs[j] - angs[k]);
        if (j !== k && e < next) next = e;
      }
      var into = ccw(ang - angs[k]);              // raw, measured from that curve; outside the sector → its nearer edge
      if (into > next) into = into - next < 2 * Math.PI - into ? next : 0;
      if (next >= 2 * MIN_ANGLE) into = Math.min(Math.max(into, MIN_ANGLE), next - MIN_ANGLE);
      else into = next / 2;
      ang = angs[k] + into;
      half = Math.min(into, next - into);
    } else if (angs.length === 1) {
      var off = wrap(ang - angs[0]);
      if (Math.abs(off) < MIN_ANGLE) ang = angs[0] + (off >= 0 ? MIN_ANGLE : -MIN_ANGLE);
      half = Math.abs(wrap(ang - angs[0]));
    }
    if (half < MIN_HALF_SECTOR) return null;
    if (half < Math.PI / 2) q = Math.max(q, 1.5 * route.d0 / Math.sin(half));
    return { dir: [Math.cos(ang), Math.sin(ang)], q: q };
  }

  /* ---------------- commands ---------------- */
  function toggleFullScreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen();
  }
  function togglePolygons() { showPolygons = !showPolygons; draw(); }
  function toggleNumbers() { showNumbers = !showNumbers; draw(); }
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
    if (net) { say('No loading while connected: the other computer could not follow (Net → Leave first).', true); return; }   // (v79)
    var input = document.createElement('input');
    input.type = 'file'; input.accept = '.json,application/json';
    input.addEventListener('change', function () {
      var file = input.files[0];
      if (!file) return;
      file.text().then(function (text) {
        var data;
        try { data = JSON.parse(text); } catch (e) { say('Not a JSON file.', true); return; }
        if (!data || data.format !== 'sprouts-game' || !data.game || !data.game.spots) { say('Not a Sprouts game file.', true); return; }
        game = data.game; stroke = null; band = null; armed = null; pendingRoom = null; roomSnapshot = false; aiCancel();
        history = data.history ? data.history.map(function (h) { return JSON.stringify(h); }) : rebuildHistory(game); historyWhy = {};
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
    if (typeof r.shiftSpots === 'boolean') { document.getElementById('opt-shift-spots').checked = r.shiftSpots; route.shiftSpots = r.shiftSpots; }
    if (typeof r.shiftCurves === 'boolean') { document.getElementById('opt-shift-curves').checked = r.shiftCurves; route.shiftCurves = r.shiftCurves; }
    if (typeof r.adjustAfter === 'boolean') { document.getElementById('opt-adjust-after').checked = r.adjustAfter; route.adjustAfter = r.adjustAfter; }
    route.redrawAfter = r.redrawAfter === true && !route.adjustAfter;   // (files from before v47 have none)
    heroicSaved = null; route.heroic = false; setHeroic(r.heroic === true, true);   // the file's Shift values are what Heroic off restores   // (v67; v68: switches the local room-making off)
    document.getElementById('opt-redraw-after').checked = route.redrawAfter;
  }
  function stamp() { return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19); }

  var commands = { 'cmd-new': newGame, 'cmd-undo': undo, 'cmd-full': toggleFullScreen, 'cmd-poly': togglePolygons, 'cmd-numbers': toggleNumbers,
                   'cmd-png': savePNG, 'cmd-save': saveGame, 'cmd-load': loadGame,
                   'cmd-log': saveLog, 'cmd-position': savePosition, 'cmd-adjust': function () { relayDrawing('adjust'); }, 'cmd-redraw': function () { relayDrawing('redraw'); } };
  Object.keys(commands).forEach(function (id) {
    document.getElementById(id).addEventListener('click', function () { closeMenus(); if (!relaying) commands[id](); });
  });

  /* Digit keys (Peter, 9/24, v49): 1 … 9 start a new game with that many spots in the Game menu's
     layout (v62, Peter 9/26; before: always a circle), and set its Spots, so N repeats it; 0 (v61; was
     10) a blank window — spots placed by clicking, Enter starts — with the menu left as it is. */
  function quickGame(n) {
    if (!n) { newGame('manual'); return; }
    document.getElementById('opt-spots').value = n;
    newGame();
  }
  var keys = { n: newGame, u: undo, f: toggleFullScreen, c: togglePolygons, s: toggleNumbers, p: savePNG, enter: startPlay, m: function () { makeRoom(false); }, a: function () { relayDrawing('adjust'); }, r: function () { relayDrawing('redraw'); } };
  for (var dk = 0; dk <= 9; dk++) keys[String(dk)] = quickGame.bind(null, dk);
  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    var tag = e.target.tagName;
    if (tag === 'INPUT' || tag === 'SELECT') return;
    if (relaying) return;                         // (Esc is handled above)
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
      if (!wasOpen) menu.classList.add('open');
      e.stopPropagation();
    });
  });
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
    var list = role[0] === 'background' ? BACKGROUNDS : COLOURS, ink = {};
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
    if (ai && ai.thinking) { pool.forEach(function (w) { w.terminate(); }); pool = []; jobs = {}; ai = null; draw(); }   // (the workers' answers would only be thrown away)
    ai = null;
  }
  /* The computer's move, if it is its turn and nothing else is going on. */
  function maybeAI() {
    if (ai || band || relaying || roomBusy || stroke || armed || game.phase !== 'play' || !isAI(game.player)) return;
    ai = { player: game.player, timer: setTimeout(aiMove, AI_DELAY) };
    say(playerName(game.player) + ' (' + kindName(players[game.player].kind) + ') to move   (move ' + (game.moves + 1) + ')');
  }
  function aiMove() {
    var a = ai, p = game.player;
    a.timer = null;
    a.who = playerName(p) + ' (' + kindName(players[p].kind) + ')';
    a.an = E.analyse(game.spots, game.edges); a.pos = AI.fromAnalysis(a.an, game.spots);
    var fams = AI.families(a.pos);
    if (!fams.length) { ai = null; log(a.who + ' has no move.'); sayTurn(); return; }   // (cannot happen: the game would be over)
    for (var i = fams.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = fams[i]; fams[i] = fams[j]; fams[j] = t; }
    a.queue = fams.map(function (f) { return AI.randomOf(f); }); a.failed = []; a.plain = [];
    var kind = players[p].kind;
    if (kind === 'random') { aiNext(); return; }
    /* Monte Carlo / parity search: the candidates (one move per family, those
       leading to the same position dropped) go to the workers; the best comes
       first in the queue, the others follow as fallbacks, in order */
    var seen = {}, cands = [];
    a.queue.forEach(function (mv) { var k = AI.canonical(AI.apply(a.pos, mv)); if (!seen[k]) { seen[k] = 1; cands.push(mv); } });
    a.thinking = true; a.t0 = Date.now(); draw();
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
      a.queue = order.map(function (i) { return cands[i]; });
      /* an exact search knows the outcome (v78, Peter): said after the move, on the status line and in the log */
      if (exact) a.verdict = best > 0 ? 'has a winning position' : 'is lost against best play' + (ties.length === cands.length ? ' (every move loses)' : '');
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
    var mc = opt.kind === 'montecarlo', t0 = Date.now(), deadline = opt.seconds ? t0 + 1000 * opt.seconds : null;
    var ratio = function (r) { return r.wins.map(function (w, i) { return r.games[i] ? w / r.games[i] : 0; }); };
    var mcInfo = function (r) { return r.games[0] + ' games each'; };
    if (!pool.length) {                            // no workers: on the page's thread, after the gray background has been painted
      setTimeout(function () {
        if (mc) { var r = deadline ? AI.monteCarloTimed(pos, cands, deadline, opt.misere) : AI.monteCarlo(pos, cands, opt.trials, opt.misere); done(ratio(r), mcInfo(r)); return; }
        if (!deadline) { done(AI.paritySearch(pos, cands, opt.depth, opt.misere, opt.cap), null); return; }
        var last = null, d = 1, ctx = AI.newContext(deadline), took = 0;
        for (;;) {
          var td = Date.now(), sc = AI.paritySearch(pos, cands, d, opt.misere, opt.cap, null, null, ctx);
          if (!sc) break;
          last = sc; took = Date.now() - td;
          if (d >= opt.M || deadline - Date.now() <= took) break;
          d++;
        }
        done(last || cands.map(function () { return 0; }), 'depth ' + (last ? d : 0), !!last && d >= opt.M);
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
      var sc = new Array(cands.length), nodes = 0, hits = 0;
      for (var w = 0; w < n2; w++) { if (!res[w].scores) return null; res[w].scores.forEach(function (v, k) { sc[parts[w][k]] = v; }); nodes += res[w].nodes; hits += res[w].hits; }
      sc.nodes = nodes; sc.hits = hits;
      return sc;
    };
    var jobFor = function (depth) { return function (w) { return { kind: 'parity', cands: parts[w].map(function (i) { return cands[i]; }), misere: opt.misere, depth: depth, cap: opt.cap, deadline: deadline }; }; };
    var prog = parts.map(function () { return 0; }), onProg = function (w, k) { prog[w] = k; progress((deadline ? 'depth ' + depthNow + ', ' : '') + prog.reduce(function (t, x) { return t + x; }, 0) + ' of ' + cands.length); };
    var depthNow = opt.depth;
    if (!deadline) { round(n2, jobFor(opt.depth), onProg, function (res) { var sc = gather(res); done(sc || cands.map(function () { return 0; }), sc ? sc.nodes + ' nodes, ' + sc.hits + ' table hits' + (opt.depth >= opt.M ? ' — exact' : '') : null, !!sc && opt.depth >= opt.M); }); return; }
    var last = null, lastInfo = '', took = 0;
    depthNow = 1;
    var next = function () {
      var td = Date.now();
      round(n2, jobFor(depthNow), onProg, function (res) {
        var sc = gather(res);
        if (!sc) { done(last || cands.map(function () { return 0; }), lastInfo + ' (depth ' + depthNow + ' cut short)', false); return; }
        last = sc; took = Date.now() - td; lastInfo = 'depth ' + depthNow + ', ' + sc.nodes + ' nodes, ' + sc.hits + ' table hits';
        if (depthNow >= opt.M || deadline - Date.now() <= took) { done(last, lastInfo + (depthNow >= opt.M ? ' — exact' : ''), depthNow >= opt.M); return; }
        depthNow++; prog = parts.map(function () { return 0; });
        next();
      });
    };
    next();
  }
  (function () {
    var sel = document.getElementById('opt-workers'), title = document.getElementById('workers-title');
    for (var k = 1; k <= workersMax; k++) { var o = document.createElement('option'); o.value = k; o.textContent = k; sel.appendChild(o); }
    sel.value = workersWanted; title.textContent = 'Workers: ' + workersWanted;
    sel.addEventListener('change', function () { workersWanted = Number(sel.value); title.textContent = 'Workers: ' + workersWanted; log('Workers: ' + workersWanted + ' of ' + workersMax + '.'); if (!ai) ensurePool(); });
  })();
  /* The next move to try: the first that the router starts drawing. Moves
     whose marks the router cannot apply (it would draw the shortest way
     instead, with a note) are kept for a second round, when no move can be
     drawn as intended: then the shortest way is accepted and aiCommitted says
     what was drawn. When nothing can be drawn at all, the computer runs R
     itself, once for this position, and tries again after it. */
  function aiNext() {
    var a = ai;
    while (a.queue.length) {
      var mv = a.queue.shift();
      a.move = mv; a.text = AI.describe(a.pos, mv); a.expect = AI.gameKey(AI.apply(a.pos, mv));
      a.making = false;
      var why = aiTry(mv, a.second);
      if (!why) { say(a.who + ' plays ' + a.text + (a.making ? ' — making room for it…' : '…')); return; }
      if (why === 'plain' && !a.second) a.plain.push(mv); else a.failed.push(a.text + ' (' + why + ')');
    }
    if (!a.second && a.plain.length) { a.second = true; a.queue = a.plain; aiNext(); return; }
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
    if (aiRedrew !== game.moves) {
      aiRedrew = game.moves;
      log(a.who + ' found no move it could draw: ' + a.failed.join('; ') + '. Rearranging the drawing (R) to try again.');
      relayDrawing('redraw');
      return;
    }
    log(a.who + ' found no move it could draw, even after rearranging: ' + a.failed.join('; ') + '.');
    say(a.who + ' found no move it could draw, even after rearranging.   R: rearrange again and let it try once more', true);
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
    if (band || relaying || roomBusy || roomCheck) { setTimeout(aiWatch, AI_WATCH_MS); return; }
    aiRefused((a.lastWarn || 'refused').replace(/\s{2,}.*$/, ''));
  }
  /* A point 12 px from spot x into corner i of its boundary bd (engine
     names): the sector from the half-edge leaving x there round to the twin
     of the one arriving — the face lies between them (engine.js next: the
     half-edge just below the twin in the rotation). What a drag into that
     sector would give updateSide. */
  function cornerProbe(an, bd, i) {
    var hv = an.cycles[bd.cycle].halves, n = hv.length, hOut = hv[i], hIn = hv[(i - 1 + n) % n];
    var pts = hIn.pts, L = pts.length, thetaT = Math.atan2(pts[L - 2][1] - pts[L - 1][1], pts[L - 2][0] - pts[L - 1][0]);
    var span = thetaT - hOut.angle;
    span -= 2 * Math.PI * Math.floor(span / (2 * Math.PI));
    if (span < 1e-9) span = 2 * Math.PI;           // one curve: the whole way round
    var th = hOut.angle + span / 2, sp = game.spots[hOut.tail];
    return [sp.x + 12 * Math.cos(th), sp.y + 12 * Math.sin(th)];
  }
  /* Hand the move to the router. Null when the band has started; else why
     not ('plain': the marks cannot be applied — with `plain` the shortest
     way is drawn instead). */
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
    if (!ar.targets[y] && !ar.blocked[y]) return 'spot ' + (y + 1) + ' cannot be reached from that side';
    a.moves0 = game.moves; a.lastWarn = null;
    if (!ar.targets[y]) {                          // the rules allow it, the room does not: as for a click — M's machinery, if Room → Shift … is on
      if (!(route.shiftSpots || route.shiftCurves) || route.heroic) return 'no room to reach spot ' + (y + 1);
      armed = ar; hush++;
      try { explainBlocked(y); } finally { hush--; }
      if (!roomBusy) { armed = null; pendingRoom = null; return 'no room to reach spot ' + (y + 1); }
      a.making = true;                             // (explainBlocked's and makeRoom's messages were hushed: aiNext says what the gray means)
      setTimeout(aiWatch, AI_WATCH_MS);
      return null;
    }
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
      }
      S.forEach(function (k) { ar.marks[k] = true; });
      if (arc !== null) ar.arcMarks[arc] = true;
      Object.keys(ar.arcMarks).forEach(function (i) { ar.markedSpots[i] = true; });
      Object.keys(ar.marks).forEach(function (k) { reg.boundaries[k].spots.forEach(function (j) { ar.markedSpots[j] = true; }); });
    }
    marksUsed = Object.keys(ar.markedSpots).map(Number).sort(function (u, v) { return u - v; });
    var P, Y = game.spots[y], pb = [Y.x, Y.y];
    if (Object.keys(ar.marks).length || Object.keys(ar.arcMarks).length) {
      hush++;
      try { var mr = markedRoute(ar, y); } finally { hush--; }
      if (!mr) return ar.why === 'room' ? 'no room round the marks' : 'no route round the marks';
      if (mr.plain && !plain) { note = null; return 'plain'; }
      if (mr.plain) log(a.who + ': the marks of ' + a.text + ' could not be applied (' + note + '): drawn the shortest way.');
      if (!mr.plain) P = G.resample(mr.path, STEP);
    }
    if (!P && y === x) {
      var lp = loopStart(game, x, ar.obs);
      if (!lp) return 'no room for a loop';
      P = G.resample(lp, STEP);
    } else if (!P) {
      var path = ar.planner.pathTo(pb);
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
    var got = AI.gameKey(AI.fromAnalysis(E.analyse(game.spots, game.edges), game.spots));
    if (a.remote) {                                // the other computer's move (v79): the drawn position must be the one sent (or its mirror image)
      if (got === a.remote.key || got === a.remote.mkey) { log('    ' + a.who + ': ' + a.sent + ' drawn as on the other computer.'); a.done(true); return; }
      log('    ' + a.who + ': the router drew ' + a.text + ' as another move than the one sent (' + a.sent + '); taken back, trying another way.');
      undoStep();                                  // (the move's own snapshot; the log line of the move stays, followed by this one)
      a.failed.push(a.text + ' (drawn as another move)');
      ai = a; aiNext();
      return;
    }
    if (a.verdict) { log('    ' + a.who + ' ' + a.verdict + ' (the search saw the whole game).'); statusEl.textContent += '   —   ' + a.who + ' ' + a.verdict; }
    if (got === a.expect) { log('    ' + a.who + ' intended ' + a.text + ': drawn as intended.'); return; }
    var other = null, big = false;
    AI.families(a.pos).forEach(function (fam) {
      if (other || !((fam.x === a.move.x && fam.y === a.move.y) || (fam.x === a.move.y && fam.y === a.move.x))) return;
      if (fam.count > AI_CHECK) { big = true; return; }
      for (var m = 0; m < fam.count && !other; m++) {
        var mv = AI.expand(fam, fam.others.filter(function (k, u) { return (m >> u) & 1; }));
        if (AI.gameKey(AI.apply(a.pos, mv)) === got) other = AI.describe(a.pos, mv) + ' (corners ' + mv.i + ' → ' + mv.i2 + ')';
      }
    });
    if (other) log('    ' + a.who + ' intended ' + a.text + ' (corners ' + a.move.i + ' → ' + a.move.i2 + '); the router drew ' + other + ' (a legal move, not the one intended).');
    else if (big) log('    ' + a.who + ' intended ' + a.text + ': not checked (too many ways to enclose things here).');
    else { log('    BUG: ' + a.who + ' intended ' + a.text + ', and the drawn position is no legal move from ' + (a.move.x + 1) + ' to ' + (a.move.y + 1) + '. Please save the game.'); say('The computer\'s move was not drawn as a legal move (a bug: please save the game).', true); }
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
    sel.value = players[p].kind;                   // the defaults into the menu
    if (players[p].parSeconds) { document.getElementById('opt-parsec' + p).value = players[p].parSeconds; document.getElementById('opt-depth' + p).value = ''; }
    if (players[p].mcSeconds) { document.getElementById('opt-mcsec' + p).value = players[p].mcSeconds; document.getElementById('opt-trials' + p).value = ''; }
    rows();
  });

  /* ---------------- two computers (menu Net, v79) ----------------
     Peter, 9/27. Host and guest meet in a Firebase room named by a three-
     digit code (net.js: the transport, the protocol, the safeguards; the
     Firebase project is Backgammon's, the rooms under `sprouts/`). Only the
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
     After my move or undo my page is gray (netGray) until the other computer
     has drawn / undone it (the ack), and I take no input meanwhile; nor
     while the other computer's move is being drawn here, nor out of turn
     (netBlock). Two actions at once: the host's wins, the guest's is
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
  function netGray() { return !!(net && (net.session.waiting || (net.role === 2 && !net.started))); }
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
    if (band || relaying || roomBusy || roomCheck || stroke || slideDrag || ai || netRetry) { setTimeout(function () { whenIdle(fn); }, AI_WATCH_MS); return; }
    fn();
  }
  function takeBackMove() { var was = game.moves; do undoStep(); while (history.length && game.moves === was); }
  var netHooks = {
    log: log,
    open: function () { if (!net) return; netTitle(); netStatus('Connected as ' + (net.role === 1 ? 'host' : 'guest') + ', room ' + net.code + '.'); log('Net: the other computer is here (room ' + net.code + ').'); sayTurn(); draw(); },
    close: function () { if (!net) return; netTitle(); netStatus('The other computer has left room ' + net.code + '.'); log('Net: the other computer has left.'); say('The other computer has left.   You can play on alone; Net → Leave closes the room.', true); },
    hello: function (msg) { if (net.role === 1 && msg.fresh) netStartGame(); },   // a guest without a game (just arrived, or reloaded): give it one
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
  /* The guest: the host's game, laid out my way (Place by hand becomes a circle). */
  function netNewGame(msg) {
    if (relaying) finishRelaying(false);
    band = null; stroke = null; armed = null; aiCancel();
    document.getElementById('opt-spots').value = msg.n;
    document.getElementById('opt-rules').value = msg.rules === 'misere' ? 'misere' : 'normal';
    var layout = document.getElementById('opt-layout').value;
    if (layout === 'manual') layout = 'circle';
    netAllow = true;
    try { newGame(layout); if (game.spots.length !== msg.n || game.phase !== 'play') newGame('random'); } finally { netAllow = false; }
    net.started = true;
    if (game.spots.length !== msg.n || game.phase !== 'play') { log('Net: could not lay out the host\'s ' + msg.n + ' spots here.'); say('Could not lay out the host\'s ' + msg.n + ' spots in a window this size.', true); return; }
    log('Net: the host started a game: ' + msg.n + ' spots, ' + rulesName(game.rules) + '.');
    sayTurn(); draw();
  }
  function netTitle() { document.getElementById('net-title').textContent = net ? 'Net: ' + (net.role === 1 ? 'host ' : 'guest ') + net.code + (net.session.connected ? '' : ' (alone)') : 'Net'; }
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
    say(role === 1 ? 'Room ' + code + ' is open: tell the other player the code.   Waiting for the guest…' : 'Joining room ' + code + '…');
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
  document.getElementById('cmd-host').addEventListener('click', function () { closeMenus(); netHost(); });
  document.getElementById('cmd-guest').addEventListener('click', function () { closeMenus(); netGuest(); });
  document.getElementById('cmd-leave').addEventListener('click', function () { closeMenus(); netLeave(); });
  document.getElementById('opt-code').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); closeMenus(); netGuest(); } });

  /* ---------------- start ---------------- */
  new ResizeObserver(resizeCanvas).observe(stage);
  newGame();
})();
