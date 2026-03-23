<?php

declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/core/bootstrap.php';
require_once BACKEND_ROOT . '/core/response.php';
require_once BACKEND_ROOT . '/core/request.php';
require_once BACKEND_ROOT . '/core/validator.php';
require_once BACKEND_ROOT . '/core/storage.php';
require_once BACKEND_ROOT . '/core/id.php';
require_once BACKEND_ROOT . '/core/logger.php';

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

$users = read_json_array('users');
foreach ($users as $user) {
    if (strtolower((string)($user['email'] ?? '')) === $email) {
        json_error('Cet email est deja utilise.', ['email' => 'Email deja pris.'], 409);
    }
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

$users[] = $newUser;
if (!write_json_array('users', $users)) {
    app_log('error', 'Impossible de sauvegarder users.json pendant register.');
    json_error('Erreur serveur pendant l inscription.', [], 500);
}

// On evite de renvoyer le hash du mot de passe au frontend.
unset($newUser['password_hash']);

json_ok('Inscription reussie.', $newUser, 201);
