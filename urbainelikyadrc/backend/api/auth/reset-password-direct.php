<?php

declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/core/bootstrap.php';
require_once BACKEND_ROOT . '/core/response.php';
require_once BACKEND_ROOT . '/core/request.php';
require_once BACKEND_ROOT . '/core/validator.php';
require_once BACKEND_ROOT . '/core/logger.php';
require_once BACKEND_ROOT . '/core/db.php';

require_method('POST');
$input = get_json_input();

$email = strtolower(as_clean_string($input['email'] ?? ''));
$newPassword = (string)($input['new_password'] ?? '');

$errors = [];
if (!is_valid_email($email)) {
    $errors['email'] = 'Email invalide.';
}
if (strlen($newPassword) < 8) {
    $errors['new_password'] = 'Le nouveau mot de passe doit contenir au moins 8 caracteres.';
}

if (!empty($errors)) {
    json_error('Validation echouee.', $errors, 422);
}

try {
    $pdo = db_get_pdo();

    $findStmt = $pdo->prepare('SELECT id_utilisateur FROM utilisateurs WHERE email = :email LIMIT 1');
    $findStmt->execute([':email' => $email]);
    $user = $findStmt->fetch();

    if (!is_array($user) || empty($user['id_utilisateur'])) {
        json_error('Aucun compte trouve avec cet email.', ['email' => 'Email introuvable.'], 404);
    }

    $updateStmt = $pdo->prepare(
        'UPDATE utilisateurs
         SET mot_de_passe_hash = :password_hash
         WHERE id_utilisateur = :user_id
         LIMIT 1'
    );
    $updateStmt->execute([
        ':password_hash' => password_hash($newPassword, PASSWORD_DEFAULT),
        ':user_id' => (string)$user['id_utilisateur'],
    ]);

    if ($updateStmt->rowCount() !== 1) {
        json_error('Impossible de reinitialiser le mot de passe.', [], 500);
    }

    // Deconnecte la session courante si c'etait le meme utilisateur.
    if (!empty($_SESSION['auth_user']) && (string)($_SESSION['auth_user']['id'] ?? '') === (string)$user['id_utilisateur']) {
        unset($_SESSION['auth_user']);
    }

    json_ok('Mot de passe reinitialise avec succes.');
} catch (Throwable $e) {
    app_log('error', 'Reset direct password error: ' . $e->getMessage());
    json_error('Erreur serveur pendant la reinitialisation du mot de passe.', [], 500);
}
