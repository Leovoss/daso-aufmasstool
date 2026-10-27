<?php
declare(strict_types=1);
define('DASO_RELAY_TEST_ONLY', true);
require __DIR__ . '/../mail-relay/relay.php';
function check(bool $ok, string $message): void { if (!$ok) throw new RuntimeException($message); }
function expect_line($stream, string $expected): void { $actual = rtrim((string)fgets($stream), "\r\n"); check($actual === $expected, 'Protocol command differs from expected command.'); }
function scenario(callable $client, callable $server): void {
    $pair = stream_socket_pair(STREAM_PF_UNIX, STREAM_SOCK_STREAM, 0); check($pair !== false, 'Socket pair unavailable.');
    foreach ($pair as $stream) stream_set_timeout($stream, 3);
    $pid = pcntl_fork(); check($pid >= 0, 'Fork unavailable.');
    if ($pid === 0) { fclose($pair[0]); try { $server($pair[1]); fclose($pair[1]); exit(0); } catch (Throwable $e) { fwrite(STDERR, $e->getMessage() . "\n"); exit(1); } }
    fclose($pair[1]); $connection = new DaSoConnection($pair[0]); $failure = null;
    try { $client($connection); } catch (Throwable $e) { $failure = $e; } finally { $connection->close(); pcntl_waitpid($pid, $status); }
    check(pcntl_wifexited($status) && pcntl_wexitstatus($status) === 0, 'Fixture server failed.'); if ($failure) throw $failure;
}
$smtp = ['username' => DASO_MAIL_ADDRESS, 'password' => 'Fixture-Secret', 'security' => 'tls'];
$message = "From: DaSo <" . DASO_MAIL_ADDRESS . ">\r\nSubject: Test\r\n\r\n.Dot\r\n";
scenario(function ($c) use ($smtp, $message) { daso_smtp_login($c, $smtp); daso_smtp_send($c, ['kunde@example.invalid'], $message); }, function ($s) use ($smtp) {
    fwrite($s, "220 Ready\r\n"); expect_line($s, 'EHLO aufmass.dasoluft.com'); fwrite($s, "250-test\r\n250 AUTH PLAIN LOGIN\r\n");
    expect_line($s, 'AUTH PLAIN ' . base64_encode("\0" . $smtp['username'] . "\0" . $smtp['password'])); fwrite($s, "235 Authenticated\r\n");
    expect_line($s, 'MAIL FROM:<' . DASO_MAIL_ADDRESS . '>'); fwrite($s, "250 Sender\r\n"); expect_line($s, 'RCPT TO:<kunde@example.invalid>'); fwrite($s, "250 Recipient\r\n"); expect_line($s, 'DATA'); fwrite($s, "354 Continue\r\n");
    $data = ''; while (($line = fgets($s)) !== false && $line !== ".\r\n") $data .= $line;
    check(str_contains($data, "\r\n..Dot\r\n"), 'SMTP body must escape dots.'); fwrite($s, "250 Queued\r\n");
});
scenario(function ($c) use ($smtp) { daso_smtp_login($c, $smtp); }, function ($s) use ($smtp) {
    fwrite($s, "220 Ready\r\n"); expect_line($s, 'EHLO aufmass.dasoluft.com'); fwrite($s, "250 AUTH LOGIN\r\n"); expect_line($s, 'AUTH LOGIN'); fwrite($s, "334 User\r\n"); expect_line($s, base64_encode($smtp['username'])); fwrite($s, "334 Password\r\n"); expect_line($s, base64_encode($smtp['password'])); fwrite($s, "235 Authenticated\r\n");
});
foreach (['recipient', 'uncertain', 'data'] as $mode) scenario(function ($c) use ($message, $mode) {
    try { daso_smtp_send($c, ['kunde@example.invalid'], $message); throw new RuntimeException('Failure must be reported.'); } catch (DaSoMailError $e) { check($e->uncertain === ($mode === 'uncertain'), 'Uncertainty classification is wrong.'); }
}, function ($s) use ($mode) {
    expect_line($s, 'MAIL FROM:<' . DASO_MAIL_ADDRESS . '>'); fwrite($s, "250 Sender\r\n"); expect_line($s, 'RCPT TO:<kunde@example.invalid>'); fwrite($s, $mode === 'recipient' ? "550 Rejected\r\n" : "250 Recipient\r\n");
    if ($mode === 'recipient') { check(fgets($s) === false, 'Rejected recipient must stop DATA.'); return; }
    expect_line($s, 'DATA'); fwrite($s, "354 Continue\r\n"); while (($line = fgets($s)) !== false && $line !== ".\r\n") {}
    if ($mode === 'data') fwrite($s, "550 Message rejected\r\n");
});
$imap = ['username' => DASO_MAIL_ADDRESS, 'password' => 'Fixture-Secret', 'security' => 'tls'];
scenario(function ($c) use ($imap) { daso_imap_login($c, $imap); daso_imap_append($c, 'Sent', "Prüfung\r\n"); }, function ($s) use ($imap) {
    fwrite($s, "* OK Ready\r\n"); expect_line($s, 'T2 LOGIN ' . daso_quote($imap['username']) . ' ' . daso_quote($imap['password'])); fwrite($s, "T2 OK Logged in\r\n"); expect_line($s, 'T3 APPEND "Sent" (\\Seen) {10}'); fwrite($s, "+ Continue\r\n");
    $data = ''; while (strlen($data) < 12) $data .= fread($s, 12 - strlen($data)); check($data === "Prüfung\r\n\r\n", 'IMAP byte literal differs.'); fwrite($s, "* OK Stored\r\nT3 OK APPEND completed\r\n");
});
scenario(function ($c) use ($imap) { try { daso_imap_login($c, $imap); throw new RuntimeException('Login failure must be reported.'); } catch (DaSoMailError $e) { check(!$e->uncertain, 'Login failure is definitive.'); } }, function ($s) use ($imap) { fwrite($s, "* OK Ready\r\n"); expect_line($s, 'T2 LOGIN ' . daso_quote($imap['username']) . ' ' . daso_quote($imap['password'])); fwrite($s, "T2 NO Rejected\r\n"); });
// Invalid settings are rejected before any real connection is opened.
foreach ([['host' => 'localhost', 'port' => 465], ['host' => DASO_MAIL_HOST, 'port' => 25]] as $invalid) { try { daso_connection($invalid + $smtp, 'smtp'); throw new RuntimeException('Invalid server accepted.'); } catch (DaSoMailError $e) { check(str_contains($e->getMessage(), 'Server, Port'), 'Settings guard failed.'); } }
$journal = tmpfile(); daso_journal($journal, ['ok' => true, 'accepted' => true]); rewind($journal); check(json_decode(stream_get_contents($journal), true)['accepted'] === true, 'Journal must preserve acceptance.'); fclose($journal);
echo "PASS: shipped PHP relay – actual stream SMTP/IMAP commands, auth, UTF-8 literal, dot escaping, rejection, unknown acknowledgment, server guards and journal. No live mail sent.\n";
