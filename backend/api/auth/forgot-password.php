<?php

declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/core/init.php';

use App\Core\Database;
use App\Core\RequestHandler;
use App\Core\ResponseHandler;
use App\Core\Validator;
use App\Core\Logger;
use App\Core\PasswordResetService;
use App\Core\MailerService;

RequestHandler::requireMethod('POST');
$input = RequestHandler::getJsonInput();

$email = Validator::sanitizeEmail($input['email'] ?? '');
if (!Validator::isValidEmail($email)) {
    ResponseHandler::error('Email invalide.', ['email' => 'Email invalide.'], 422);
}

try {
    $pdo = Database::getInstance();
    $resetService = new PasswordResetService($pdo);

    $stmt = $pdo->prepare('SELECT id_utilisateur, nom, prenom, email FROM utilisateurs WHERE email = :email LIMIT 1');
    $stmt->execute([':email' => $email]);
    $user = $stmt->fetch();

    if (is_array($user)) {
        $tokenData = $resetService->createToken((string)$user['id_utilisateur'], 30);

        $fullName = trim(((string)$user['prenom']) . ' ' . ((string)$user['nom']));
        $mailSubject = 'Reinitialisation du mot de passe - UrbainElikyaDRC';
        $mailBody = "Bonjour {$fullName},\n\n"
            . "Vous avez demande une reinitialisation de mot de passe.\n"
            . "Cliquez sur ce lien pour choisir un nouveau mot de passe:\n"
            . $tokenData['link'] . "\n\n"
            . "Ce lien expire dans {$tokenData['expires_minutes']} minutes et ne peut etre utilise qu'une seule fois.\n"
            . "Si vous n'etes pas a l'origine de cette demande, ignorez simplement cet email.\n\n"
            . "Equipe UrbainElikyaDRC";

        $mailer = new MailerService();
        $mailSent = $mailer->send((string)$user['email'], $mailSubject, $mailBody);
        if (!$mailSent) {
            Logger::warning('Reset link generated but email not sent for: ' . $user['email']);
        }
    }

    // Message volontairement neutre pour eviter l'enumeration d'emails.
    ResponseHandler::success('Si cet email existe, un lien de reinitialisation a ete envoye.', [
        'email_sent' => true,
    ]);
} catch (Throwable $e) {
    Logger::error('Forgot password error: ' . $e->getMessage());
    ResponseHandler::error('Erreur serveur pendant la demande de reinitialisation.', [], 500);
}
