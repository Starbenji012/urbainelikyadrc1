<?php

declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/core/init.php';

use App\Core\Database;
use App\Core\RequestHandler;
use App\Core\ResponseHandler;
use App\Core\Validator;
use App\Core\Logger;
use App\Core\AuthService;
use App\Core\MailerService;

RequestHandler::requireMethod('POST');
$input = RequestHandler::getJsonInput();

$email = Validator::sanitizeEmail($input['email'] ?? '');
$newPassword = (string)($input['new_password'] ?? '');

$errors = [];
if (!Validator::isValidEmail($email)) {
    $errors['email'] = 'Email invalide.';
}
if ($passwordError = Validator::validatePassword($newPassword)) {
    $errors['new_password'] = $passwordError;
}

if (!empty($errors)) {
    ResponseHandler::error('Validation echouee.', $errors, 422);
}

try {
    $pdo = Database::getInstance();

    $findStmt = $pdo->prepare('SELECT id_utilisateur FROM utilisateurs WHERE email = :email LIMIT 1');
    $findStmt->execute([':email' => $email]);
    $user = $findStmt->fetch();

    if (!is_array($user) || empty($user['id_utilisateur'])) {
        ResponseHandler::error('Aucun compte trouve avec cet email.', ['email' => 'Email introuvable.'], 404);
    }

    $updateStmt = $pdo->prepare(
        'UPDATE utilisateurs
         SET mot_de_passe_hash = :password_hash
         WHERE id_utilisateur = :user_id
         LIMIT 1'
    );
    $updateStmt->execute([
        ':password_hash' => AuthService::hashPassword($newPassword),
        ':user_id' => (string)$user['id_utilisateur'],
    ]);

    if ($updateStmt->rowCount() !== 1) {
        ResponseHandler::error('Impossible de reinitialiser le mot de passe.', [], 500);
    }

    $mailer = new MailerService();
    if (!$mailer->sendPasswordResetConfirmation($email)) {
        Logger::warning('Password reset but confirmation email not sent for: ' . $email);
    }

    AuthService::clearAuthUserIfMatches((string)$user['id_utilisateur']);

    ResponseHandler::success('Mot de passe reinitialise avec succes.');
} catch (Throwable $e) {
    Logger::error('Reset direct password error: ' . $e->getMessage());
    ResponseHandler::error('Erreur serveur pendant la reinitialisation du mot de passe.', [], 500);
}
