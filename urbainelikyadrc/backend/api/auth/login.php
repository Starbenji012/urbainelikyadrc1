<?php

declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/core/bootstrap.php';
require_once BACKEND_ROOT . '/core/response.php';
require_once BACKEND_ROOT . '/core/request.php';
require_once BACKEND_ROOT . '/core/db.php';
require_once BACKEND_ROOT . '/core/logger.php';

require_method('POST');
$input = get_json_input();

$email = strtolower(as_clean_string($input['email'] ?? ''));
$password = (string)($input['password'] ?? '');

if ($email === '' || $password === '') {
    json_error('Email et mot de passe requis.', [], 422);
}

try {
    $pdo = db_get_pdo();
    $stmt = $pdo->prepare(
        'SELECT id_utilisateur, nom, prenom, surnom, email, mot_de_passe_hash, role
         FROM utilisateurs
         WHERE email = :email
         LIMIT 1'
    );
    $stmt->execute([':email' => $email]);
    $foundUser = $stmt->fetch();

    if (!is_array($foundUser) || !password_verify($password, (string)($foundUser['mot_de_passe_hash'] ?? ''))) {
        json_error('Identifiants invalides.', [], 401);
    }

    $_SESSION['auth_user'] = [
        'id' => $foundUser['id_utilisateur'],
        'nom' => $foundUser['nom'],
        'prenom' => $foundUser['prenom'],
        'surnom' => $foundUser['surnom'],
        'email' => $foundUser['email'],
        'role' => $foundUser['role'] ?? 'citoyen',
    ];

    json_ok('Connexion reussie.', $_SESSION['auth_user']);
} catch (Throwable $e) {
    app_log('error', 'Login MySQL error: ' . $e->getMessage());
    json_error('Erreur serveur pendant la connexion.', [], 500);
}
