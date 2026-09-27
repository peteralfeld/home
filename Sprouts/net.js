/* =========================================================================
   net.js — two-computer play (v79): the transport and the protocol.
   DOM-free (global SproutsNet, or require()). Needs nothing; the Firebase
   transport needs the `firebase` global (compat SDK, loaded by index.html).

   WHAT TRAVELS. Only combinatorial moves (Peter, 9/19): each computer draws
   its own picture with the router, so the two pictures differ (settings, A
   and R on one side only). A move is named by its two spots and by the
   position it produces (ai.js gameKey, and the key of its mirror image —
   the router may draw either): the receiver finds the move among its own
   legal moves and draws it. Spot numbers agree on both computers: both
   start from the same count and every move adds one spot.

   ROLES. Host = Player 1, Guest = Player 2. Only the host starts games.
   Either side may undo (Peter, 9/27); U undoes the last move whoever made
   it.

   THE PROTOCOL (messages are JSON objects with `type`; k = the number of
   moves made so far, the position's index):
     hello     { ver, fresh }                on open, both sides (fresh: this
               page has no game of this session yet — a guest that arrives or
               reloads; the host answers with `game`)
     game      { n, rules }                  host → guest: a new game, k = 0
     move      { k, x, y, inside, key, mkey }  move k → k+1 (inside: the spots
               of one of the two regions a one-boundary move makes, without
               the move's own spots; null for a two-boundary move)
     undo      { k }                         k → k−1
     ack       { k, key, mkey }              the action bringing me to k is done
     refuse    { k, why }                    move k → k+1 could not be drawn
     resend    { k }                         send me the moves from k on
     heartbeat { k, key, mkey, busy, waiting } every HEARTBEAT_MS while open
     bye       {}                            leaving

   AFTER AN ACTION the actor is WAITING (its page is gray, it takes no
   input) until the ack for the k it reached, or a heartbeat showing the
   peer at that k with the same position. The peer is BUSY while its router
   draws (its page takes no input either). An action arriving with the
   wrong k: k below mine while I wait — the two acted at once: the HOST's
   action wins, the guest reverts its own (hooks.revert) and then applies
   the host's; the host ignores the guest's. k above mine — I missed
   something: `resend`. k below mine while idle — a duplicate (a resend
   that overshot): acknowledged, not applied.

   LOST MESSAGES. Both transports write to a durable queue (Firebase push),
   so a message handed over while the channel is momentarily closed still
   arrives (Backgammon's lesson: never gate a game message on `open`; the
   heartbeat is the one exception — a stale beat is worse than none). A
   one-directional stall (the inbound listener asleep, the outbound fine)
   is caught by the inbound watchdog: no message for INBOUND_SILENCE_MS
   while the channel says open → the channel is rebuilt (hooks.connect);
   the peer's next heartbeat then repairs whatever was missed. The numbers
   are Backgammon's (3 s beats, 10 s silence), proven there.
   ========================================================================= */
(function (root) {
  'use strict';

  var HEARTBEAT_MS = 3000, INBOUND_SILENCE_MS = 10000, WATCH_MS = 4000;

  /* ---------------- the Firebase transport ----------------
     A DataConnection-shaped shim (send, on('open'|'data'|'close'), open,
     close), Backgammon's, over a room `sprouts/rooms/<code>`: two queues
     host2guest / guest2host of JSON strings, presence flags with
     onDisconnect, "open" while the other side is present. A (re)attach
     delivers only messages above the HIGH-WATER MARK — the highest push key
     consumed on this room and role, kept across reconnects in `marks` (a
     snapshot of "what is here now" at attach time swallowed a message that
     landed during the rebuild: Backgammon 8/25). A fresh room has nothing
     to skip. */
  var marks = {};
  function firebaseTransport(db, code, role, log) {
    var roomRef = db.ref('sprouts/rooms/' + code);
    var outRef = roomRef.child(role === 1 ? 'host2guest' : 'guest2host');
    var inRef = roomRef.child(role === 1 ? 'guest2host' : 'host2guest');
    var meRef = roomRef.child(role === 1 ? 'hostPresent' : 'guestPresent');
    var otherRef = roomRef.child(role === 1 ? 'guestPresent' : 'hostPresent');
    var handlers = { open: [], data: [], close: [] };
    function fire(evt, arg) { handlers[evt].forEach(function (cb) { try { cb(arg); } catch (e) { log('Net: handler error: ' + e.message); } }); }
    var conn = {
      open: false,
      on: function (evt, cb) { if (handlers[evt]) handlers[evt].push(cb); },
      send: function (obj) { try { outRef.push(JSON.stringify(obj)); } catch (e) { log('Net: send failed: ' + e.message); } },
      close: function () {
        try { meRef.set(null); } catch (e) {}
        try { otherRef.off(); } catch (e) {}
        try { inRef.off(); } catch (e) {}
        conn.open = false;
      }
    };
    meRef.set(true);
    meRef.onDisconnect().remove();
    var opened = false;
    otherRef.on('value', function (snap) {
      var present = snap.val() === true;
      if (present && !opened) { opened = true; conn.open = true; fire('open'); }
      else if (!present && opened) { opened = false; conn.open = false; fire('close'); }
    });
    var markKey = code + '/' + role;
    inRef.once('value', function (initSnap) {
      if (!(markKey in marks)) {                   // first attach to this room: what is there predates us
        var hw = '';
        initSnap.forEach(function (c) { if (c.key > hw) hw = c.key; });
        marks[markKey] = hw;
      }
      inRef.on('child_added', function (snap) {
        if (snap.key <= marks[markKey]) return;
        marks[markKey] = snap.key;
        var msg = snap.val();
        if (typeof msg === 'string') { try { msg = JSON.parse(msg); } catch (e) { return; } }
        if (msg) fire('data', msg);
      });
    });
    return conn;
  }
  /* The host's fresh room (wipes whatever a stale room at that code holds); resolves when written. */
  function createRoom(db, code) {
    return db.ref('sprouts/rooms/' + code).set({ createdAt: Date.now() });
  }
  /* Is a host waiting at this code? */
  function hostPresent(db, code) {
    return db.ref('sprouts/rooms/' + code + '/hostPresent').once('value').then(function (snap) { return snap.val() === true; });
  }
  function randomCode() { return String(100 + Math.floor(Math.random() * 900)); }   // three digits, no leading zero to lose

  /* ---------------- the session (the protocol) ----------------
     opts: role (1 host, 2 guest), version (string), connect() → a transport
     (called at the start and on every reconnect), state() → { k, key, mkey,
     fresh } from the page, timers (optional, for tests: { setInterval,
     clearInterval, now }), and the hooks:
       log(text)                 the page's log
       open() / close()          the peer arrived / left
       hello(msg)                the peer's greeting (host: a fresh guest needs a game)
       game(msg)                 (guest) the host started a game
       move(msg, done)           draw the peer's move; done(ok, why)
       undo(msg, done)           undo the last move; done(ok)
       revert(w)                 (guest) take back my own pending action w ({ type, k })
       acked(k)                  my action reached the peer: k moves now
       refused(msg)              my move k → k+1 could not be drawn there: take it back
       diverged(mine, peer)      same k, different positions
     Methods: start(), leave(), sendGame(n, rules), moved(desc), undone(),
     waiting (the action I wait for: { type, k } or null), busy (the peer's
     action being applied, or null), connected. */
  function createSession(opts, hooks) {
    var T = opts.timers || { setInterval: function (f, ms) { return setInterval(f, ms); }, clearInterval: function (t) { clearInterval(t); }, now: function () { return Date.now(); } };   // (wrapped: a browser's setInterval called on another `this` is an "Illegal invocation")
    var role = opts.role, conn = null, connected = false, left = false;
    var queue = [], busy = null, waiting = null, moves = [], lastInbound = 0, reconnecting = false;
    var beat = null, watch = null, peer = null;
    var S = { role: role, connected: false, waiting: null, busy: null, peer: null };

    function log(t) { hooks.log(t); }
    function send(obj) {
      if (!conn || left) return;
      try { conn.send(obj); } catch (e) { log('Net: send failed: ' + e.message); }
    }
    function mine() { return opts.state(); }
    function sameKey(a, b) { return a.key === b.key || a.key === b.mkey; }
    function setWaiting(w) { waiting = w; S.waiting = w; }
    function setBusy(b) { busy = b; S.busy = b; }

    /* ---- the channel ---- */
    function attach() {
      conn = opts.connect();
      conn.on('open', function () {
        connected = true; S.connected = true; lastInbound = T.now(); reconnecting = false;
        send({ type: 'hello', ver: opts.version, fresh: !!mine().fresh });
        startBeat(); startWatch();
        hooks.open();
      });
      conn.on('close', function () {
        connected = false; S.connected = false;
        stopBeat();
        hooks.close();
      });
      conn.on('data', incoming);
      if (conn.open) { connected = true; S.connected = true; lastInbound = T.now(); send({ type: 'hello', ver: opts.version, fresh: !!mine().fresh }); startBeat(); startWatch(); hooks.open(); }
    }
    function reconnect(why) {
      if (left || reconnecting) return;
      reconnecting = true;
      log('Net: rebuilding the channel (' + why + ').');
      try { if (conn) conn.close(); } catch (e) {}
      attach();
      lastInbound = T.now();
    }
    function startBeat() {
      stopBeat();
      beat = T.setInterval(function () {
        if (!connected || left) return;
        var m = mine();
        send({ type: 'heartbeat', k: m.k, key: m.key, mkey: m.mkey, busy: !!busy, waiting: waiting ? waiting.type : null });
      }, HEARTBEAT_MS);
    }
    function stopBeat() { if (beat) { T.clearInterval(beat); beat = null; } }
    function startWatch() {
      if (watch) return;
      watch = T.setInterval(function () {
        if (!connected || left || reconnecting) return;
        if (T.now() - lastInbound > INBOUND_SILENCE_MS) reconnect('nothing received for ' + Math.round((T.now() - lastInbound) / 1000) + ' s');
      }, WATCH_MS);
    }
    function stopWatch() { if (watch) { T.clearInterval(watch); watch = null; } }

    /* ---- incoming ---- */
    function incoming(msg) {
      if (left || !msg || !msg.type) return;
      lastInbound = T.now();
      var m = mine();
      switch (msg.type) {
        case 'hello':
          if (msg.ver !== opts.version) log('Net: the other computer runs ' + msg.ver + ', this one ' + opts.version + ' — the two should be the same page.');
          else log('Net: the other computer runs ' + msg.ver + ' too.');
          hooks.hello(msg);
          break;
        case 'game':
          if (role === 1) break;                   // only the host starts games
          queue = []; setBusy(null); setWaiting(null); moves = [];
          hooks.game(msg);
          send({ type: 'ack', k: 0, key: mine().key, mkey: mine().mkey });
          break;
        case 'move': case 'undo':
          queue.push(msg); pump();
          break;
        case 'ack':
          if (waiting && msg.k === waiting.k) {
            var w = waiting; setWaiting(null);
            if (!sameKey(m, msg)) hooks.diverged(m, msg);
            hooks.acked(w.k);
          }
          break;
        case 'refuse':
          if (waiting && waiting.type === 'move' && msg.k + 1 === waiting.k) {
            setWaiting(null);
            hooks.refused(msg);
          }
          break;
        case 'resend':
          for (var k = msg.k; k < m.k; k++) if (moves[k]) send(moves[k]);
          break;
        case 'heartbeat':
          peer = msg; S.peer = msg;
          if (busy || queue.length) break;
          if (waiting && msg.k === waiting.k && sameKey(m, msg)) { var w2 = waiting; setWaiting(null); hooks.acked(w2.k); break; }
          if (waiting) break;                      // the peer is still to apply my action (or to answer)
          if (msg.k > m.k) send({ type: 'resend', k: m.k });   // I missed something (a peer waiting for its own action's ack is ahead by it: a harmless duplicate)
          else if (msg.k === m.k && !sameKey(m, msg)) hooks.diverged(m, msg);
          break;
        case 'bye':
          hooks.close();
          break;
      }
    }
    /* The peer's actions, one at a time (the router is asynchronous). */
    function pump() {
      if (busy || left || !queue.length) return;
      var msg = queue.shift(), m = mine(), k = m.k, what = msg.type === 'move' ? 'moved' : 'undid';
      var need = msg.k;                            // the k the peer's action starts from
      if (waiting && need !== k) {                 // the two of us acted at the same time
        if (role === 1) { log('Net: the guest ' + what + ' at the same time; the host\'s action stands.'); pump(); return; }
        log('Net: the host ' + what + ' at the same time; taking back my own action.');
        var w = waiting; setWaiting(null);
        hooks.revert(w);
        m = mine(); k = m.k;
      } else if (waiting) setWaiting(null);        // the peer acted from my position: it has my action
      if (need > k) { queue = []; send({ type: 'resend', k: k }); return; }
      if (need < k) {                              // a duplicate of what I have (a resend that overshot): say so
        if (msg.type === 'move' && need + 1 === k) send({ type: 'ack', k: k, key: m.key, mkey: m.mkey });
        pump(); return;
      }
      setBusy(msg);
      if (msg.type === 'move') {
        hooks.move(msg, function (ok, why) {
          var s = mine();
          setBusy(null);
          if (ok) { moves[msg.k] = { type: 'move', k: msg.k, x: msg.x, y: msg.y, inside: msg.inside, key: msg.key, mkey: msg.mkey }; send({ type: 'ack', k: s.k, key: s.key, mkey: s.mkey }); }
          else send({ type: 'refuse', k: msg.k, why: why || 'could not be drawn' });
          pump();
        });
      } else {
        hooks.undo(msg, function () {
          var s = mine();
          setBusy(null);
          send({ type: 'ack', k: s.k, key: s.key, mkey: s.mkey });
          pump();
        });
      }
    }

    /* ---- outgoing (the page did something) ---- */
    S.start = function () { attach(); };
    S.leave = function () {
      if (left) return;
      left = true;
      send({ type: 'bye' });
      stopBeat(); stopWatch();
      try { if (conn) conn.close(); } catch (e) {}
      conn = null; connected = false; S.connected = false; setWaiting(null); setBusy(null); queue = [];
    };
    /* host: a new game with n spots; k = 0 */
    S.sendGame = function (n, rules) {
      moves = []; queue = []; setBusy(null);
      setWaiting({ type: 'game', k: 0 });
      send({ type: 'game', n: n, rules: rules });
    };
    /* I made move k → k+1: desc = { x, y, inside, key, mkey }. (`moves` keeps
       every move's message by its k for resends — entries above the current k
       are stale but harmless: resend stops at the current k.) */
    S.moved = function (k, desc) {
      var msg = { type: 'move', k: k, x: desc.x, y: desc.y, inside: desc.inside, key: desc.key, mkey: desc.mkey };
      moves[k] = msg;
      setWaiting({ type: 'move', k: k + 1 });
      send(msg);
    };
    /* I undid move k (k → k−1) */
    S.undone = function (k) {
      setWaiting({ type: 'undo', k: k - 1 });
      send({ type: 'undo', k: k });
    };
    return S;
  }

  var api = { firebaseTransport: firebaseTransport, createRoom: createRoom, hostPresent: hostPresent, randomCode: randomCode,
              createSession: createSession, HEARTBEAT_MS: HEARTBEAT_MS, INBOUND_SILENCE_MS: INBOUND_SILENCE_MS };
  root.SproutsNet = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : this);
