<?php

declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/core/bootstrap.php';
require_once BACKEND_ROOT . '/core/response.php';
require_once BACKEND_ROOT . '/core/request.php';
require_once BACKEND_ROOT . '/core/auth.php';
require_once BACKEND_ROOT . '/core/logger.php';
require_once BACKEND_ROOT . '/core/db.php';
require_once BACKEND_ROOT . '/core/password_reset.php';
require_once BACKEND_ROOT . '/core/mailer.php';

if (strtoupper($_SERVER['REQUEST_METHOD']) === 'GET') {
    $token = as_clean_string($_GET['token'] ?? '');
    if ($token === '') {
        json_error('Token manquant.', ['token' => 'Token manquant.'], 422);
    }

    json_ok('Token recu. Envoyez un POST sur ce meme endpoint avec token et new_password pour finaliser.');
}

require_method('POST');
$input = get_json_input();

$token = as_clean_string($input['token'] ?? '');
$newPassword = (string)($input['new_password'] ?? '');

$errors = [];
if ($token === '') {
    $errors['token'] = 'Token manquant.';
}
if (strlen($newPassword) < 8) {
    $errors['new_password'] = 'Le nouveau mot de passe doit contenir au moins 8 caracteres.';
}

if (!empty($errors)) {
    json_error('Validation echouee.', $errors, 422);
}

try {
    $pdo = db_get_pdo();
    ensure_password_resets_table($pdo);

    $userId = consume_password_reset_token($pdo, $token);
    if ($userId === null) {
        json_error('Lien de reinitialisation invalide ou expire.', [], 400);
    }

    $updateStmt = $pdo->prepare('UPDATE utilisateurs SET mot_de_passe_hash = :password_hash WHERE id_utilisateur = :user_id LIMIT 1');
    $updateStmt->execute([
        ':password_hash' => password_hash($newPassword, PASSWORD_DEFAULT),
        ':user_id' => $userId,
    ]);

    if ($updateStmt->rowCount() !== 1) {
        app_log('warning', 'Reset password: utilisateur non trouve pour token valide: ' . $userId);
        json_error('Impossible de mettre a jour le mot de passe.', [], 500);
    }

    $emailStmt = $pdo->prepare('SELECT email FROM utilisateurs WHERE id_utilisateur = :user_id LIMIT 1');
    $emailStmt->execute([':user_id' => $userId]);
    $row = $emailStmt->fetch();
    $userEmail = is_array($row) ? (string)($row['email'] ?? '') : '';

    if ($userEmail !== '') {
        if (!send_password_reset_confirmation_email($userEmail)) {
            app_log('warning', 'Mot de passe reinitialise mais email de confirmation non envoye pour: ' . $userEmail);
        }
    }

    clear_auth_user_if_matches($userId);

    json_ok('Mot de passe reinitialise avec succes.');
} catch (Throwable $e) {
    app_log('error', 'Reset password error: ' . $e->getMessage());
    json_error('Erreur serveur pendant la reinitialisation du mot de passe.', [], 500);
}
