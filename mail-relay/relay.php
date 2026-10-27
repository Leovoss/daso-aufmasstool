<?php
declare(strict_types=1);
// PHP 8.2+ / OpenSSL. The downloaded copy receives its private key on the server.
const DASO_RELAY_TOKEN = 'DASO_RELAY_TOKEN_PLACEHOLDER';
const DASO_MAIL_HOST = 'w01e61fb.kasserver.com';
const DASO_MAIL_ADDRESS = 'aufmass@dasoluft.com';

final class DaSoMailError extends RuntimeException {
    public function __construct(string $message, public bool $uncertain = false) { parent::__construct($message); }
}
final class DaSoConnection {
    public function __construct(private $stream) {}
    public function line(): string {
        $line = fgets($this->stream, 65536);
        if ($line === false || !str_ends_with($line, "\n")) throw new DaSoMailError('Mailserver antwortet nicht oder hat die Verbindung geschlossen.');
        return rtrim($line, "\r\n");
    }
    public function write(string $value): void {
        for ($offset = 0, $size = strlen($value); $offset < $size;) {
            $written = fwrite($this->stream, substr($value, $offset, 65536));
            if ($written === false || $written === 0) throw new DaSoMailError('Verbindung zum Mailserver wurde unterbrochen.');
            $offset += $written;
        }
    }
    public function bytes(int $length): string {
        $value = ''; while (strlen($value) < $length) { $chunk = fread($this->stream, min(65536, $length - strlen($value))); if ($chunk === false || $chunk === '') throw new DaSoMailError('IMAP-Nachricht konnte nicht vollständig gelesen werden.'); $value .= $chunk; } return $value;
    }
    public function upgrade(): void {
        if (stream_socket_enable_crypto($this->stream, true, STREAM_CRYPTO_METHOD_TLSv1_2_CLIENT | STREAM_CRYPTO_METHOD_TLSv1_3_CLIENT) !== true) throw new DaSoMailError('TLS-Verbindung konnte nicht aufgebaut werden.');
    }
    public function close(): void { if (is_resource($this->stream)) fclose($this->stream); }
}
function daso_connection(array $settings, string $kind): DaSoConnection {
    $port = (int)($settings['port'] ?? 0); $security = $settings['security'] ?? '';
    $expected = $kind === 'smtp' ? ['tls' => 465, 'starttls' => 587] : ['tls' => 993, 'starttls' => 143];
    if (($settings['host'] ?? '') !== DASO_MAIL_HOST || !isset($expected[$security]) || $port !== $expected[$security]) throw new DaSoMailError('Server, Port oder Verschlüsselung passen nicht zum DaSo-Postfach.');
    if (($settings['username'] ?? '') !== DASO_MAIL_ADDRESS || empty($settings['password']) || strlen($settings['password']) > 1000 || preg_match('/[\r\n\x00]/', $settings['password'])) throw new DaSoMailError('Benutzername oder Passwort fehlen oder sind ungültig.');
    $context = stream_context_create(['ssl' => ['verify_peer' => true, 'verify_peer_name' => true, 'allow_self_signed' => false, 'peer_name' => DASO_MAIL_HOST, 'SNI_enabled' => true, 'crypto_method' => STREAM_CRYPTO_METHOD_TLSv1_2_CLIENT | STREAM_CRYPTO_METHOD_TLSv1_3_CLIENT]]);
    $stream = @stream_socket_client(($security === 'tls' ? 'tls' : 'tcp') . '://' . DASO_MAIL_HOST . ':' . $port, $errno, $error, 15, STREAM_CLIENT_CONNECT, $context);
    if ($stream === false) throw new DaSoMailError(strtoupper($kind) . '-Verbindung zum Mailserver fehlgeschlagen. TLS, Erreichbarkeit und Hosting prüfen.');
    stream_set_timeout($stream, 20); return new DaSoConnection($stream);
}
function daso_smtp_reply(DaSoConnection $connection): array {
    $lines = [];
    for ($i = 0; $i < 100; $i++) {
        $line = $connection->line(); if (!preg_match('/^(\d{3})([ -])/', $line, $m)) throw new DaSoMailError('Ungültige SMTP-Antwort.');
        $lines[] = $line; if ($m[2] === ' ') return [(int)$m[1], implode("\n", $lines)];
    }
    throw new DaSoMailError('SMTP-Antwort ist zu lang.');
}
function daso_smtp_command(DaSoConnection $connection, string $command, array $codes, string $error): array {
    $connection->write($command . "\r\n"); $reply = daso_smtp_reply($connection);
    if (!in_array($reply[0], $codes, true)) throw new DaSoMailError($error . ' (SMTP ' . $reply[0] . ').'); return $reply;
}
function daso_smtp_login(DaSoConnection $connection, array $settings): void {
    if (daso_smtp_reply($connection)[0] !== 220) throw new DaSoMailError('SMTP-Server ist nicht bereit.');
    $hello = daso_smtp_command($connection, 'EHLO aufmass.dasoluft.com', [250], 'SMTP-Verbindung fehlgeschlagen');
    if ($settings['security'] === 'starttls') {
        if (!preg_match('/\bSTARTTLS\b/i', $hello[1])) throw new DaSoMailError('SMTP-Server bietet kein STARTTLS an.');
        daso_smtp_command($connection, 'STARTTLS', [220], 'STARTTLS abgelehnt'); $connection->upgrade();
        $hello = daso_smtp_command($connection, 'EHLO aufmass.dasoluft.com', [250], 'SMTP-Verbindung fehlgeschlagen');
    }
    $auth = base64_encode("\0" . $settings['username'] . "\0" . $settings['password']);
    if (preg_match('/AUTH[^\n]*\bPLAIN\b/i', $hello[1])) {
        $response = daso_smtp_command($connection, 'AUTH PLAIN ' . $auth, [235, 334], 'SMTP-Anmeldung abgelehnt');
        if ($response[0] === 334) daso_smtp_command($connection, $auth, [235], 'SMTP-Anmeldung abgelehnt');
    } elseif (preg_match('/AUTH[^\n]*\bLOGIN\b/i', $hello[1])) {
        daso_smtp_command($connection, 'AUTH LOGIN', [334], 'SMTP-Anmeldung abgelehnt');
        daso_smtp_command($connection, base64_encode($settings['username']), [334], 'SMTP-Anmeldung abgelehnt');
        daso_smtp_command($connection, base64_encode($settings['password']), [235], 'SMTP-Anmeldung abgelehnt');
    } else throw new DaSoMailError('SMTP-Server bietet keine unterstützte Passwort-Anmeldung an.');
}
function daso_smtp_send(DaSoConnection $connection, array $recipients, string $message): void {
    daso_smtp_command($connection, 'MAIL FROM:<' . DASO_MAIL_ADDRESS . '>', [250], 'Absender abgelehnt');
    foreach ($recipients as $recipient) daso_smtp_command($connection, 'RCPT TO:<' . $recipient . '>', [250, 251], 'Empfänger abgelehnt');
    daso_smtp_command($connection, 'DATA', [354], 'Nachricht abgelehnt');
    try {
        $data = preg_replace('/(^|\r\n)\./', '$1..', $message);
        $connection->write(rtrim($data, "\r\n") . "\r\n.\r\n"); $reply = daso_smtp_reply($connection);
    } catch (Throwable $e) { throw new DaSoMailError('Keine eindeutige SMTP-Versandbestätigung erhalten. Bitte im Postfach prüfen.', true); }
    if ($reply[0] !== 250) throw new DaSoMailError('Mailserver hat die Nachricht abgelehnt (SMTP ' . $reply[0] . ').');
}
function daso_quote(string $value): string { return '"' . str_replace(['\\', '"'], ['\\\\', '\\"'], $value) . '"'; }
function daso_imap_command(DaSoConnection $connection, string $tag, string $command): void {
    $connection->write($tag . ' ' . $command . "\r\n");
    for ($i = 0; $i < 300; $i++) {
        $line = $connection->line();
        if (str_starts_with($line, $tag . ' ')) { if (!str_starts_with(strtoupper($line), $tag . ' OK')) throw new DaSoMailError('IMAP-Anmeldung oder Ordnerzugriff abgelehnt.'); return; }
        if (str_starts_with($line, '* BYE')) throw new DaSoMailError('IMAP-Verbindung beendet.');
    }
    throw new DaSoMailError('IMAP-Antwort ist zu lang.');
}
function daso_imap_login(DaSoConnection $connection, array $settings): void {
    $greeting = $connection->line(); if (!preg_match('/^\* (OK|PREAUTH)\b/i', $greeting)) throw new DaSoMailError('IMAP-Server ist nicht bereit.');
    if ($settings['security'] === 'starttls') { daso_imap_command($connection, 'T1', 'STARTTLS'); $connection->upgrade(); }
    if (!preg_match('/^\* PREAUTH/i', $greeting)) daso_imap_command($connection, 'T2', 'LOGIN ' . daso_quote($settings['username']) . ' ' . daso_quote($settings['password']));
}
function daso_imap_append(DaSoConnection $connection, string $folder, string $message): void {
    $connection->write('T3 APPEND ' . daso_quote($folder) . ' (\\Seen) {' . strlen($message) . "}\r\n"); $ready = false;
    for ($i = 0; $i < 30; $i++) { $line = $connection->line(); if (str_starts_with($line, '+')) { $ready = true; break; } if (preg_match('/^T3 (NO|BAD)/i', $line)) throw new DaSoMailError('Gesendet-Ordner abgelehnt.'); }
    if (!$ready) throw new DaSoMailError('IMAP-Ablage nicht freigegeben.');
    $connection->write($message . "\r\n");
    for ($i = 0; $i < 100; $i++) { $line = $connection->line(); if (preg_match('/^T3 OK/i', $line)) return; if (preg_match('/^T3 (NO|BAD)/i', $line)) throw new DaSoMailError('Versandkopie konnte nicht abgelegt werden.'); }
    throw new DaSoMailError('Versandkopie wurde nicht bestätigt.');
}
function daso_json(array $value, int $status = 200): never { http_response_code($status); echo json_encode($value, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR); exit; }
function daso_journal($file, array $value): void { rewind($file); if (!ftruncate($file, 0) || fwrite($file, json_encode($value, JSON_THROW_ON_ERROR)) === false || !fflush($file)) throw new DaSoMailError('Versandstatus konnte nicht gespeichert werden.', true); }

// Unit tests load the functions with this constant. HTTP requests cannot set PHP constants.
if (defined('DASO_RELAY_TEST_ONLY')) return;
// Read-only inbox access: EXAMINE and BODY.PEEK never set the Seen flag.
function daso_imap_lines(DaSoConnection $connection, string $tag, string $command): array {
    $connection->write($tag . ' ' . $command . "\r\n"); $lines = [];
    for ($i = 0; $i < 500; $i++) { $line = $connection->line(); $lines[] = $line; if (str_starts_with($line, $tag . ' ')) { if (!str_starts_with(strtoupper($line), $tag . ' OK')) throw new DaSoMailError('IMAP-Posteingang wurde abgelehnt.'); return $lines; } if (str_starts_with($line, '* BYE')) throw new DaSoMailError('IMAP-Verbindung beendet.'); }
    throw new DaSoMailError('IMAP-Antwort überschreitet das Leselimit.');
}
function daso_inbox(array $account, array $input): array {
    $folder = (string)($input['folder'] ?? 'INBOX'); if (!$folder || strlen($folder) > 200 || preg_match('/[\r\n\x00]/', $folder)) throw new DaSoMailError('Ungültiger Posteingangsordner.');
    $limit = max(0, min(5, (int)($input['limit'] ?? 5))); $imap = daso_connection($account['imap'], 'imap');
    try {
        daso_imap_login($imap, $account['imap']); $examine = daso_imap_lines($imap, 'I1', 'EXAMINE ' . daso_quote($folder)); $validity = '';
        foreach ($examine as $line) if (preg_match('/\[UIDVALIDITY (\d+)\]/i', $line, $m)) $validity = $m[1];
        if (!$validity) throw new DaSoMailError('IMAP-UIDVALIDITY fehlt. Der Posteingang kann nicht zuverlässig abgeglichen werden.');
        $last = (string)($input['uidValidity'] ?? '') === $validity ? max(0, (int)($input['lastUid'] ?? 0)) : 0;
        if (!$limit) return ['ok' => true, 'inboxVersion' => 1, 'uidValidity' => $validity, 'lastUid' => $last, 'messages' => [], 'more' => false];
        $criteria = $last ? 'UID ' . ($last + 1) . ':*' : 'SINCE ' . gmdate('d-M-Y', time() - 30 * 86400);
        $search = daso_imap_lines($imap, 'I2', 'UID SEARCH ' . $criteria); $uids = [];
        foreach ($search as $line) if (preg_match('/^\* SEARCH(?: (.*))?$/', $line, $m)) foreach (preg_split('/ +/', trim($m[1] ?? '')) as $uid) if (ctype_digit($uid) && (int)$uid > $last) $uids[] = (int)$uid;
        $uids = array_values(array_unique($uids)); sort($uids, SORT_NUMERIC); $messages = []; $bytes = 0;
        foreach (array_slice($uids, 0, $limit) as $uid) {
            $sizeLines = daso_imap_lines($imap, 'I3', 'UID FETCH ' . $uid . ' (RFC822.SIZE)'); $size = 0;
            foreach ($sizeLines as $line) if (preg_match('/RFC822.SIZE (\d+)/i', $line, $m)) $size = (int)$m[1];
            if (!$size || $size > 8 * 1024 * 1024) { $messages[] = ['uid' => $uid, 'skipped' => true, 'reason' => 'Nachricht ist größer als das automatische Leselimit oder nicht mehr vorhanden. Bitte im Postfach manuell prüfen.']; $last = $uid; continue; }
            if ($bytes + $size > 10 * 1024 * 1024) break;
            $imap->write('I4 UID FETCH ' . $uid . ' (BODY.PEEK[])' . "\r\n"); $raw = null; $done = false;
            for ($i = 0; $i < 100; $i++) { $line = $imap->line(); if (preg_match('/\{(\d+)\+?\}$/', $line, $m)) { if ((int)$m[1] > 8 * 1024 * 1024) throw new DaSoMailError('Nachricht überschreitet das automatische Leselimit.'); $raw = $imap->bytes((int)$m[1]); } if (str_starts_with($line, 'I4 ')) { if (!str_starts_with(strtoupper($line), 'I4 OK')) throw new DaSoMailError('IMAP-Nachricht konnte nicht gelesen werden.'); $done = true; break; } }
            if (!$done || $raw === null) throw new DaSoMailError('IMAP-Nachricht ist unvollständig.');
            $messages[] = ['uid' => $uid, 'raw' => base64_encode($raw)]; $bytes += strlen($raw); $last = $uid;
        }
        return ['ok' => true, 'inboxVersion' => 1, 'uidValidity' => $validity, 'lastUid' => $last, 'messages' => $messages, 'more' => count(array_filter($uids, fn($uid) => $uid > $last)) > 0];
    } finally { $imap->close(); }
}

ini_set('display_errors', '0'); ignore_user_abort(true); set_time_limit(120);
header('Content-Type: application/json; charset=UTF-8'); header('Cache-Control: no-store'); header('X-Content-Type-Options: nosniff');
$journal = null; $accepted = false; $started = false;
try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') daso_json(['ok' => false, 'error' => 'Nur geschützte Anfragen aus dem Aufmaßtool möglich.'], 405);
    if (empty($_SERVER['HTTPS']) || $_SERVER['HTTPS'] === 'off') daso_json(['ok' => false, 'error' => 'HTTPS ist erforderlich.'], 400);
    $authorization = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
    if (!$authorization && function_exists('getallheaders')) { foreach (getallheaders() as $name => $value) if (strtolower($name) === 'authorization') $authorization = $value; }
    if (strlen(DASO_RELAY_TOKEN) < 32 || !hash_equals('Bearer ' . DASO_RELAY_TOKEN, $authorization)) daso_json(['ok' => false, 'error' => 'Verbindungsschlüssel fehlt oder ist ungültig.'], 401);
    if ((int)($_SERVER['CONTENT_LENGTH'] ?? 0) > 48 * 1024 * 1024) daso_json(['ok' => false, 'error' => 'Anfrage ist zu groß.'], 413);
    $input = json_decode(file_get_contents('php://input'), true, 32, JSON_THROW_ON_ERROR);
    $action = $input['action'] ?? ''; $account = $input['account'] ?? [];
    if (!in_array($action, ['test', 'send', 'inbox'], true) || ($account['senderEmail'] ?? '') !== DASO_MAIL_ADDRESS) throw new DaSoMailError('Ungültiger Auftrag oder Absender.');
    $folder = (string)($account['sentFolder'] ?? 'Sent'); if (strlen($folder) > 200 || preg_match('/[\r\n\x00]/', $folder)) throw new DaSoMailError('Ungültiger Gesendet-Ordner.');
    if ($action === 'inbox') daso_json(daso_inbox($account, $input));
    $hasImap = !empty($account['imap']['password']);
    if ($action === 'test') {
        $smtp = daso_connection($account['smtp'], 'smtp'); try { daso_smtp_login($smtp, $account['smtp']); } finally { $smtp->close(); }
        if ($hasImap) { $imap = daso_connection($account['imap'], 'imap'); try { daso_imap_login($imap, $account['imap']); if (!empty($account['archive'])) daso_imap_command($imap, 'T3', 'STATUS ' . daso_quote($folder) . ' (MESSAGES)'); } finally { $imap->close(); } }
        daso_json(['ok' => true, 'smtp' => true, 'imap' => $hasImap]);
    }
    $recipients = $input['recipients'] ?? []; $message = $input['message'] ?? ''; $id = $input['requestId'] ?? '';
    if (!is_array($recipients) || count($recipients) < 1 || count($recipients) > 100 || !is_string($message) || strlen($message) > 40 * 1024 * 1024 || !preg_match('/^[A-Za-z0-9_-]{1,100}$/', $id)) throw new DaSoMailError('Ungültiges Versandpaket.');
    foreach ($recipients as $recipient) if (!is_string($recipient) || preg_match('/[\r\n<>]/', $recipient) || !filter_var($recipient, FILTER_VALIDATE_EMAIL)) throw new DaSoMailError('Ungültiger Empfänger.');
    $headers = explode("\r\n\r\n", $message, 2)[0]; $headers = preg_replace('/\r\n[ \t]+/', ' ', $headers);
    if (!preg_match('/^From:[^\r\n]*<([^>]+)>\r?$/mi', $headers, $match) || strtolower($match[1]) !== DASO_MAIL_ADDRESS) throw new DaSoMailError('Absender der E-Mail stimmt nicht mit dem Postfach überein.');
    $directory = sys_get_temp_dir() . '/daso-mail-' . substr(hash('sha256', DASO_RELAY_TOKEN), 0, 20);
    if (!is_dir($directory) && !mkdir($directory, 0700, true) && !is_dir($directory)) throw new DaSoMailError('Versandprotokoll kann nicht angelegt werden.');
    $journal = fopen($directory . '/' . $id . '.json', 'c+'); if (!$journal || !flock($journal, LOCK_EX | LOCK_NB)) throw new DaSoMailError('Dieses Paket wird bereits versandt. Bitte im Postfach prüfen.', true);
    $previous = json_decode(stream_get_contents($journal) ?: '{}', true);
    if (!empty($previous['accepted'])) daso_json($previous);
    if (!empty($previous['uncertain']) || ($previous['state'] ?? '') === 'sending') throw new DaSoMailError('Dieses Paket muss im Postfach geprüft werden. Kein erneuter Versand.', true);
    daso_journal($journal, ['state' => 'sending']); $started = true;
    $smtp = daso_connection($account['smtp'], 'smtp'); try { daso_smtp_login($smtp, $account['smtp']); daso_smtp_send($smtp, $recipients, $message); $accepted = true; } finally { $smtp->close(); }
    $result = ['ok' => true, 'accepted' => true, 'sentCopy' => false, 'warning' => '']; daso_journal($journal, $result);
    if (!empty($account['archive'])) {
        try { $imap = daso_connection($account['imap'], 'imap'); try { daso_imap_login($imap, $account['imap']); daso_imap_append($imap, $folder, $message); $result['sentCopy'] = true; } finally { $imap->close(); } }
        catch (Throwable $e) { $result['warning'] = 'Versand bestätigt. Die Kopie konnte nicht im IMAP-Gesendet-Ordner abgelegt werden; sie ist im Tool abrufbar.'; }
    }
    daso_journal($journal, $result); daso_json($result);
} catch (Throwable $error) {
    $uncertain = $accepted || ($error instanceof DaSoMailError && $error->uncertain);
    $result = ['ok' => false, 'accepted' => $accepted, 'uncertain' => $uncertain, 'error' => $error instanceof DaSoMailError ? $error->getMessage() : 'Versand-Anbindung konnte die Anfrage nicht verarbeiten. PHP und Webserver-Konfiguration prüfen.'];
    if ($journal && $started) { try { daso_journal($journal, $result); } catch (Throwable $ignored) {} }
    daso_json($result, $uncertain ? 502 : 400);
}
