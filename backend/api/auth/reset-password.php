<?php

declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/core/init.php';

use App\Core\Database;
use App\Core\RequestHandler;
use App\Core\ResponseHandler;
use App\Core\Validator;
use App\Core\Logger;
use App\Core\AuthService;
use App\Core\PasswordResetService;
use App\Core\MailerService;

if (strtoupper($_SERVER['REQUEST_METHOD']) === 'GET') {
    $token = RequestHandler::cleanString($_GET['token'] ?? '');
    if ($token === '') {
        ResponseHandler::error('Token manquant.', ['token' => 'Token manquant.'], 422);
    }

    ResponseHandler::success('Token recu. Envoyez un POST sur ce meme endpoint avec token et new_password pour finaliser.');
}

RequestHandler::requireMethod('POST');
$input = RequestHandler::getJsonInput();

$token = RequestHandler::cleanString($input['token'] ?? '');
$newPassword = (string)($input['new_password'] ?? '');

$errors = [];
if ($token === '') {
    $errors['token'] = 'Token manquant.';
}
if ($passwordError = Validator::validatePassword($newPassword)) {
    $errors['new_password'] = $passwordError;
}

if (!empty($errors)) {
    ResponseHandler::error('Validation echouee.', $errors, 422);
}

try {
    $pdo = Database::getInstance();
    $resetService = new PasswordResetService($pdo);

    $userId = $resetService->consumeToken($token);
    if ($userId === null) {
        ResponseHandler::error('Lien de reinitialisation invalide ou expire.', [], 400);
    }

    $updateStmt = $pdo->prepare('UPDATE utilisateurs SET mot_de_passe_hash = :password_hash WHERE id_utilisateur = :user_id LIMIT 1');
    $updateStmt->execute([
        ':password_hash' => AuthService::hashPassword($newPassword),
        ':user_id' => $userId,
    ]);

    if ($updateStmt->rowCount() !== 1) {
        Logger::warning('Reset password: user not found for valid token: ' . $userId);
        ResponseHandler::error('Impossible de mettre a jour le mot de passe.', [], 500);
    }

    $emailStmt = $pdo->prepare('SELECT email FROM utilisateurs WHERE id_utilisateur = :user_id LIMIT 1');
    $emailStmt->execute([':user_id' => $userId]);
    $row = $emailStmt->fetch();
    $userEmail = is_array($row) ? (string)($row['email'] ?? '') : '';

    if ($userEmail !== '') {
        $mailer = new MailerService();
        if (!$mailer->sendPasswordResetConfirmation($userEmail)) {
            Logger::warning('Password reset but confirmation email not sent for: ' . $userEmail);
        }
    }

    AuthService::clearAuthUserIfMatches($userId);

    ResponseHandler::success('Mot de passe reinitialise avec succes.');
} catch (Throwable $e) {
    Logger::error('Reset password error: ' . $e->getMessage());
    ResponseHandler::error('Erreur serveur pendant la reinitialisation du mot de passe.', [], 500);
}
