<?php
/* =========================================================================
   relay.php — tiny LAN move-relay for Backgammon online play.

   Mirrors the Firebase model exactly: each "room" holds two ordered message
   queues (host2guest / guest2host) plus heartbeat presence. No database —
   one flock-guarded JSON file per room under relay-data/. Messages are stored
   as JSON strings so arrays (like the 25-cell board) round-trip byte-for-byte.

   Serve this from the same origin as the game (XAMPP), so the client can hit
   it with the relative URL "relay.php" (no CORS, no config).

   Actions (action= in query string or JSON body):
     create  host  — wipe/reset the room, announce host presence.
     check   guest — is a host currently present in this room? {present:bool}
     send          — append a message to the caller's out-queue. body: {msg}
     poll          — heartbeat + return this side's new in-queue messages since
                     an index. {messages:[...], next:int, otherPresent:bool}
     leave         — clear the caller's presence.

   role: 1 = host (White), 2 = guest (Red).
   ========================================================================= */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { exit; }

const PRESENCE_TIMEOUT = 12;               // seconds since last poll before a side counts as "gone"
$DATA_DIR = __DIR__ . '/relay-data';

function fail($msg, $code = 400) {
  http_response_code($code);
  echo json_encode(['ok' => false, 'error' => $msg]);
  exit;
}

/* ---- read params from query string and/or JSON body ---- */
$body = [];
$raw  = file_get_contents('php://input');
if ($raw !== '') { $j = json_decode($raw, true); if (is_array($j)) $body = $j; }
function param($k, $d, $body) {
  if (isset($_GET[$k]))  return $_GET[$k];
  if (isset($body[$k]))  return $body[$k];
  return $d;
}

$action = param('action', '', $body);
$code   = preg_replace('/[^A-Za-z0-9_-]/', '', (string)param('room', '', $body));  // sanitise → no path traversal
$role   = (int)param('role', 0, $body);
if ($code === '') fail('missing room');

if (!is_dir($DATA_DIR)) @mkdir($DATA_DIR, 0777, true);
$file = $DATA_DIR . '/' . $code . '.json';

/* ---- locked read-modify-write. $fn($room) returns [newRoomOrNull, response] ---- */
function withRoom($file, $fn) {
  $fh = fopen($file, 'c+');
  if (!$fh) fail('cannot open room store', 500);
  flock($fh, LOCK_EX);
  $txt  = stream_get_contents($fh);
  $room = ($txt !== '') ? json_decode($txt, true) : null;
  if (!is_array($room)) $room = null;

  list($room, $response) = $fn($room);

  if ($room !== null) {                    // null => read-only, don't rewrite
    ftruncate($fh, 0);
    rewind($fh);
    fwrite($fh, json_encode($room));
    fflush($fh);
  }
  flock($fh, LOCK_UN);
  fclose($fh);
  return $response;
}

$now       = time();
$keyOut    = ($role === 1) ? 'host2guest' : 'guest2host';
$keyIn     = ($role === 1) ? 'guest2host' : 'host2guest';
$mySeen    = ($role === 1) ? 'hostSeen'   : 'guestSeen';
$otherSeen = ($role === 1) ? 'guestSeen'  : 'hostSeen';

function freshRoom($now) {
  return ['createdAt'=>$now, 'host2guest'=>[], 'guest2host'=>[], 'hostSeen'=>0, 'guestSeen'=>0];
}

if ($action === 'create') {
  // Host opens a fresh room (wipes any stale data at this code) and announces presence.
  $resp = withRoom($file, function($room) use ($now, $mySeen) {
    $room = freshRoom($now);
    $room[$mySeen] = $now;
    return [$room, ['ok'=>true]];
  });
  echo json_encode($resp); exit;
}

if ($action === 'check') {
  // Guest asks whether a host is present before joining. Read-only.
  $resp = withRoom($file, function($room) use ($now, $otherSeen) {
    if ($room === null) return [null, ['ok'=>true, 'present'=>false]];
    $present = ($now - (int)($room[$otherSeen] ?? 0)) < PRESENCE_TIMEOUT;
    return [null, ['ok'=>true, 'present'=>$present]];
  });
  echo json_encode($resp); exit;
}

if ($action === 'send') {
  $msg = param('msg', null, $body);        // already a JSON string from the client
  if ($msg === null) fail('missing msg');
  $resp = withRoom($file, function($room) use ($now, $keyOut, $mySeen, $msg) {
    if ($room === null) $room = freshRoom($now);
    $room[$keyOut][] = (string)$msg;
    $room[$mySeen]   = $now;
    return [$room, ['ok'=>true]];
  });
  echo json_encode($resp); exit;
}

if ($action === 'poll') {
  $since = (int)param('since', 0, $body);
  $resp = withRoom($file, function($room) use ($now, $keyIn, $mySeen, $otherSeen, $since) {
    if ($room === null) $room = freshRoom($now);
    $room[$mySeen] = $now;                  // heartbeat
    $inq     = $room[$keyIn];
    $msgs    = array_slice($inq, $since);
    $next    = count($inq);
    $present = ($now - (int)($room[$otherSeen] ?? 0)) < PRESENCE_TIMEOUT;
    return [$room, ['ok'=>true, 'messages'=>$msgs, 'next'=>$next, 'otherPresent'=>$present]];
  });
  echo json_encode($resp); exit;
}

if ($action === 'leave') {
  $resp = withRoom($file, function($room) use ($mySeen) {
    if ($room === null) return [null, ['ok'=>true]];
    $room[$mySeen] = 0;
    return [$room, ['ok'=>true]];
  });
  echo json_encode($resp); exit;
}

fail('unknown action');
