<?php

declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/core/bootstrap.php';
require_once BACKEND_ROOT . '/core/response.php';
require_once BACKEND_ROOT . '/core/request.php';
require_once BACKEND_ROOT . '/core/validator.php';
require_once BACKEND_ROOT . '/core/id.php';
require_once BACKEND_ROOT . '/core/logger.php';
require_once BACKEND_ROOT . '/core/db.php';

require_method('POST');
$input = get_json_input();

$nom = as_clean_string($input['nom'] ?? '');
$prenom = as_clean_string($input['prenom'] ?? '');
$surnom = as_clean_string($input['surnom'] ?? '');
$email = strtolower(as_clean_string($input['email'] ?? ''));
$password = (string)($input['password'] ?? '');

$errors = [];
if (!is_length_between($nom, 2, 80)) {
    $errors['nom'] = 'Le nom doit contenir entre 2 et 80 caracteres.';
}
if (!is_length_between($prenom, 2, 80)) {
    $errors['prenom'] = 'Le prenom doit contenir entre 2 et 80 caracteres.';
}
if ($surnom && !is_length_between($surnom, 2, 80)) {
    $errors['surnom'] = 'Le surnom doit contenir entre 2 et 80 caracteres (ou vide).';
}
if (!is_valid_email($email)) {
    $errors['email'] = 'Email invalide.';
}
if (strlen($password) < 8) {
    $errors['password'] = 'Le mot de passe doit contenir au moins 8 caracteres.';
}

if (!empty($errors)) {
    json_error('Validation echouee.', $errors, 422);
}

$newUser = [
    'id' => generate_id('usr'),
    'nom' => $nom,
    'prenom' => $prenom,
    'surnom' => $surnom,
    'email' => $email,
    'password_hash' => password_hash($password, PASSWORD_DEFAULT),
    'role' => 'citoyen',
    'created_at' => gmdate('c'),
];

try {
    $pdo = db_get_pdo();

    $checkStmt = $pdo->prepare('SELECT id_utilisateur FROM utilisateurs WHERE email = :email LIMIT 1');
    $checkStmt->execute([':email' => $email]);
    if ($checkStmt->fetch()) {
        json_error('Cet email est deja utilise.', ['email' => 'Email deja pris.'], 409);
    }

    $insertStmt = $pdo->prepare(
        'INSERT INTO utilisateurs (id_utilisateur, nom, prenom, surnom, email, mot_de_passe_hash, role, created_at)
         VALUES (:id, :nom, :prenom, :surnom, :email, :password_hash, :role, NOW())'
    );
    $insertStmt->execute([
        ':id' => $newUser['id'],
        ':nom' => $newUser['nom'],
        ':prenom' => $newUser['prenom'],
        ':surnom' => $newUser['surnom'] !== '' ? $newUser['surnom'] : null,
        ':email' => $newUser['email'],
        ':password_hash' => $newUser['password_hash'],
        ':role' => $newUser['role'],
    ]);

    $responseUser = $newUser;
    unset($responseUser['password_hash']);
    json_ok('Inscription reussie.', $responseUser, 201);
} catch (Throwable $e) {
    app_log('error', 'Register MySQL error: ' . $e->getMessage());
    json_error('Erreur serveur pendant l inscription.', [], 500);
}
