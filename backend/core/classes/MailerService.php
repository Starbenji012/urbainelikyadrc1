<?php

declare(strict_types=1);

namespace App\Core;

use App\Core\Logger;
use App\Core\Validator;

class MailerService
{
    private string $appName;
    private string $fromEmail;
    private string $smtpHost;
    private int $smtpPort;
    private string $smtpUser;
    private string $smtpPass;

    public function __construct()
    {
        $this->appName = getenv('APP_NAME') ?: 'UrbainElikyaDRC';
        $this->fromEmail = getenv('MAIL_FROM') ?: 'no-reply@urbainelikyadrc.local';
        $this->smtpHost = getenv('MAIL_SMTP_HOST') ?: 'smtp.gmail.com';
        $this->smtpPort = (int)(getenv('MAIL_SMTP_PORT') ?: '465');
        $this->smtpUser = getenv('MAIL_SMTP_USER') ?: '';
        $this->smtpPass = getenv('MAIL_SMTP_PASS') ?: '';
    }

    public function send(string $to, string $subject, string $body): bool
    {
        if (!Validator::isValidEmail($to)) {
            Logger::warning('Email destinataire invalide: ' . $to);
            return false;
        }

        if ($this->smtpUser === '' || $this->smtpPass === '') {
            Logger::warning('SMTP non configuré: MAIL_SMTP_USER ou MAIL_SMTP_PASS manquant.');
            return false;
        }

        $subject = trim($subject) !== '' ? $subject : ($this->appName . ' - Notification');

        try {
            $socket = @fsockopen('ssl://' . $this->smtpHost, $this->smtpPort, $errno, $errstr, 30);
            if ($socket === false) {
                Logger::error('SMTP connexion échouée: ' . $errstr);
                return false;
            }

            if (!$this->smtpExpect($socket, [220], 'CONNECT')) {
                fclose($socket);
                return false;
            }

            if (!$this->smtpCommand($socket, 'EHLO ' . (gethostname() ?: 'localhost'), [250], 'EHLO')) {
                fclose($socket);
                return false;
            }

            if (!$this->smtpCommand($socket, 'AUTH LOGIN', [334], 'AUTH LOGIN')) {
                fclose($socket);
                return false;
            }

            if (!$this->smtpCommand($socket, base64_encode($this->smtpUser), [334], 'AUTH USER')) {
                fclose($socket);
                return false;
            }

            if (!$this->smtpCommand($socket, base64_encode($this->smtpPass), [235], 'AUTH PASS')) {
                fclose($socket);
                return false;
            }

            if (!$this->smtpCommand($socket, 'MAIL FROM:<' . $this->fromEmail . '>', [250], 'MAIL FROM')) {
                fclose($socket);
                return false;
            }

            if (!$this->smtpCommand($socket, 'RCPT TO:<' . $to . '>', [250], 'RCPT TO')) {
                fclose($socket);
                return false;
            }

            if (!$this->smtpCommand($socket, 'DATA', [354], 'DATA')) {
                fclose($socket);
                return false;
            }

            $hostname = gethostname() ?: 'localhost';
            $messageId = sprintf('<%s@%s>', bin2hex(random_bytes(8)), preg_replace('/[^a-zA-Z0-9.-]/', '', $hostname));

            $headers = "Date: " . date(DATE_RFC2822) . "\r\n";
            $headers .= "Message-ID: " . $messageId . "\r\n";
            $headers .= "From: " . $this->appName . " <" . $this->fromEmail . ">\r\n";
            $headers .= "To: " . $to . "\r\n";
            $headers .= "Subject: " . $subject . "\r\n";
            $headers .= "MIME-Version: 1.0\r\n";
            $headers .= "Content-Type: text/html; charset=utf-8\r\n";

            $message = $headers . "\r\n" . nl2br(htmlspecialchars($body)) . "\r\n";

            if (!$this->smtpWrite($socket, $message . '.')) {
                fclose($socket);
                return false;
            }

            if (!$this->smtpExpect($socket, [250], 'MESSAGE')) {
                fclose($socket);
                return false;
            }

            $this->smtpCommand($socket, 'QUIT', [221], 'QUIT');
            fclose($socket);

            return true;
        } catch (\Throwable $e) {
            Logger::error('Email envoi erreur: ' . $e->getMessage());
            return false;
        }
    }

    public function sendPasswordResetConfirmation(string $to): bool
    {
        $subject = 'Confirmation de réinitialisation de mot de passe';
        $body = "Bonjour,\n\n"
            . "Votre mot de passe UrbainElikyaDRC a été réinitialisé avec succès.\n"
            . "Si vous n'êtes pas à l'origine de cette action, contactez l'équipe de support immédiatement.\n\n"
            . "Equipe UrbainElikyaDRC";

        return $this->send($to, $subject, $body);
    }

    private function smtpWrite($socket, string $command): bool
    {
        return fwrite($socket, $command . "\r\n") !== false;
    }

    private function smtpExpect($socket, array $codes, string $step = ''): bool
    {
        $response = '';
        while (!feof($socket)) {
            $line = fgets($socket, 515);
            if ($line === false) {
                break;
            }

            $response .= $line;
            if (strlen($line) >= 4 && $line[3] === ' ') {
                break;
            }
        }

        $stepLabel = $step !== '' ? ' [' . $step . ']' : '';
        if ($response === '') {
            Logger::warning('SMTP réponse vide' . $stepLabel);
            return false;
        }

        $code = (int)substr($response, 0, 3);
        if (!in_array($code, $codes, true)) {
            Logger::warning('SMTP réponse inattendue' . $stepLabel . ': ' . trim($response));
            return false;
        }

        return true;
    }

    private function smtpCommand($socket, string $command, array $expectedCodes, string $step): bool
    {
        if (!$this->smtpWrite($socket, $command)) {
            Logger::warning('SMTP échec envoi commande [' . $step . ']: ' . $command);
            return false;
        }

        return $this->smtpExpect($socket, $expectedCodes, $step);
    }
}
