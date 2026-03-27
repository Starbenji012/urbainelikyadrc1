<?php

declare(strict_types=1);

require_once BACKEND_ROOT . '/core/logger.php';

function env_bool(string $name, bool $default = false): bool
{
    $raw = getenv($name);
    if ($raw === false) {
        return $default;
    }

    $value = strtolower(trim((string)$raw));
    return in_array($value, ['1', 'true', 'yes', 'on'], true);
}

function smtp_expect($socket, array $codes): bool
{
    $response = '';
    while (!feof($socket)) {
        $line = fgets($socket, 515);
        if ($line === false) {
            break;
        }
        $response .= $line;

        // Fin de reponse SMTP quand le 4e caractere est un espace.
        if (strlen($line) >= 4 && $line[3] === ' ') {
            break;
        }
    }

    $code = (int)substr($response, 0, 3);
    if (!in_array($code, $codes, true)) {
        app_log('warning', 'SMTP reponse inattendue: ' . trim($response));
        return false;
    }

    return true;
}

function smtp_write($socket, string $command): bool
{
    $written = fwrite($socket, $command . "\r\n");
    return $written !== false;
}

// Envoi SMTP direct (compatible Gmail via SSL 465 + mot de passe d'application).
function send_plain_email_smtp(string $to, string $subject, string $body): bool
{
    $appName = getenv('APP_NAME') ?: 'UrbainElikyaDRC';
    $fromEmail = getenv('MAIL_FROM') ?: 'no-reply@urbainelikyadrc.local';
    $smtpHost = getenv('MAIL_SMTP_HOST') ?: 'smtp.gmail.com';
    $smtpPort = (int)(getenv('MAIL_SMTP_PORT') ?: '465');
    $smtpUser = getenv('MAIL_SMTP_USER') ?: '';
    $smtpPass = getenv('MAIL_SMTP_PASS') ?: '';

    $safeTo = filter_var($to, FILTER_VALIDATE_EMAIL);
    if ($safeTo === false) {
        app_log('warning', 'Email destinataire invalide: ' . $to);
        return false;
    }

    if ($smtpUser === '' || $smtpPass === '') {
        app_log('warning', 'SMTP non configure: MAIL_SMTP_USER ou MAIL_SMTP_PASS manquant.');
        return false;
    }

    $subject = trim($subject) !== '' ? $subject : ($appName . ' - Notification');
    $hostname = gethostname() ?: 'localhost';
    $messageId = sprintf('<%s@%s>', bin2hex(random_bytes(8)), preg_replace('/[^a-zA-Z0-9.-]/', '', $hostname));

    $headers = [
        'Date: ' . date(DATE_RFC2822),
        'From: ' . $appName . ' <' . $fromEmail . '>',
        'To: <' . $safeTo . '>',
        'Subject: ' . $subject,
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=UTF-8',
        'Content-Transfer-Encoding: 8bit',
        'Message-ID: ' . $messageId,
    ];

    $data = implode("\r\n", $headers) . "\r\n\r\n" . $body;

    // Dot-stuffing SMTP pour les lignes qui commencent par un point.
    $data = preg_replace('/^\./m', '..', $data);

    $transport = sprintf('ssl://%s:%d', $smtpHost, $smtpPort);
    $socket = @stream_socket_client($transport, $errno, $errstr, 20);
    if (!$socket) {
        app_log('warning', sprintf('Connexion SMTP echouee (%d): %s', $errno, $errstr));
        return false;
    }

    stream_set_timeout($socket, 20);

    $ok = smtp_expect($socket, [220])
        && smtp_write($socket, 'EHLO ' . $hostname)
        && smtp_expect($socket, [250])
        && smtp_write($socket, 'AUTH LOGIN')
        && smtp_expect($socket, [334])
        && smtp_write($socket, base64_encode($smtpUser))
        && smtp_expect($socket, [334])
        && smtp_write($socket, base64_encode($smtpPass))
        && smtp_expect($socket, [235])
        && smtp_write($socket, 'MAIL FROM:<' . $fromEmail . '>')
        && smtp_expect($socket, [250])
        && smtp_write($socket, 'RCPT TO:<' . $safeTo . '>')
        && smtp_expect($socket, [250, 251])
        && smtp_write($socket, 'DATA')
        && smtp_expect($socket, [354])
        && smtp_write($socket, $data . "\r\n.")
        && smtp_expect($socket, [250]);

    smtp_write($socket, 'QUIT');
    fclose($socket);

    if (!$ok) {
        app_log('warning', 'Echec envoi SMTP vers: ' . $safeTo);
    }

    return $ok;
}

// Envoie un email texte simple. Priorite SMTP, sinon fallback mail().
function send_plain_email(string $to, string $subject, string $body): bool
{
    $useSmtp = env_bool('MAIL_SMTP_ENABLED', true);
    if ($useSmtp) {
        $smtpOk = send_plain_email_smtp($to, $subject, $body);
        if ($smtpOk) {
            return true;
        }
    }

    $appName = getenv('APP_NAME') ?: 'UrbainElikyaDRC';
    $fromEmail = getenv('MAIL_FROM') ?: 'no-reply@urbainelikyadrc.local';

    $safeTo = filter_var($to, FILTER_VALIDATE_EMAIL);
    if ($safeTo === false) {
        app_log('warning', 'Email destinataire invalide: ' . $to);
        return false;
    }

    $subject = trim($subject) !== '' ? $subject : ($appName . ' - Notification');

    $headers = [
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=UTF-8',
        'From: ' . $appName . ' <' . $fromEmail . '>',
        'Reply-To: ' . $fromEmail,
        'X-Mailer: PHP/' . PHP_VERSION,
    ];

    $ok = @mail($safeTo, $subject, $body, implode("\r\n", $headers));
    if (!$ok) {
        app_log('warning', 'Echec envoi email vers: ' . $safeTo);
    }

    return $ok;
}