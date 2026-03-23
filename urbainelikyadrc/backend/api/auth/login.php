<?php

declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/core/bootstrap.php';
require_once BACKEND_ROOT . '/core/response.php';
require_once BACKEND_ROOT . '/core/request.php';
require_once BACKEND_ROOT . '/core/storage.php';

require_method('POST');
$input = get_json_input();

$email = strtolower(as_clean_string($input['email'] ?? ''));
$password = (string)($input['password'] ?? '');

if ($email === '' || $password === '') {
    json_error('Email et mot de passe requis.', [], 422);
}

$users = read_json_array('users');
$foundUser = null;

foreach ($users as $user) {
    if (strtolower((string)($user['email'] ?? '')) === $email) {
        $foundUser = $user;
        break;
    }
}

if (!is_array($foundUser) || !password_verify($password, (string)$foundUser['password_hash'])) {
    json_error('Identifiants invalides.', [], 401);
}

$_SESSION['auth_user'] = [
    'id' => $foundUser['id'],
    'nom' => $foundUser['nom'],
    'prenom' => $foundUser['prenom'],
    'surnom' => $foundUser['surnom'],
    'email' => $foundUser['email'],
    'role' => $foundUser['role'] ?? 'citoyen',
];

json_ok('Connexion reussie.', $_SESSION['auth_user']);
