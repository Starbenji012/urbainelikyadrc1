<?php

declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/core/bootstrap.php';
require_once BACKEND_ROOT . '/core/response.php';
require_once BACKEND_ROOT . '/core/request.php';
require_once BACKEND_ROOT . '/core/validator.php';
require_once BACKEND_ROOT . '/core/storage.php';
require_once BACKEND_ROOT . '/core/id.php';

$method = strtoupper($_SERVER['REQUEST_METHOD']);

if ($method === 'GET') {
    $idees = read_json_array('idees');
    json_response($idees, 200);
}

if ($method !== 'POST') {
    json_error('Methode HTTP non autorisee.', [], 405);
}

$input = get_json_input();
$titre = as_clean_string($input['titre'] ?? '');
$categorie = strtolower(as_clean_string($input['categorie'] ?? 'autre'));
$description = as_clean_string($input['description'] ?? '');
$photo = as_clean_string($input['photo'] ?? '');
$userId = as_clean_string($input['user_id'] ?? '');
$userNom = as_clean_string($input['user_nom'] ?? 'Utilisateur local');
$userEmail = strtolower(as_clean_string($input['user_email'] ?? ''));

$allowedCategories = ['infrastructure', 'environnement', 'services-publics', 'transport', 'autre'];
$errors = [];

if (!is_length_between($titre, 3, 150)) {
    $errors['titre'] = 'Le titre doit contenir entre 3 et 150 caracteres.';
}
if (!is_in_whitelist($categorie, $allowedCategories)) {
    $errors['categorie'] = 'Categorie invalide.';
}
if (!is_length_between($description, 5, 2000)) {
    $errors['description'] = 'La description doit contenir entre 5 et 2000 caracteres.';
}

if (!empty($errors)) {
    json_error('Validation echouee.', $errors, 422);
}

$idees = read_json_array('idees');
$newIdee = [
    'id' => generate_id('ide'),
    'user_id' => $userId !== '' ? $userId : null,
    'user_nom' => $userNom,
    'user_email' => $userEmail !== '' ? $userEmail : null,
    'titre' => $titre,
    'categorie' => $categorie,
    'description' => $description,
    'photo' => $photo,
    'likes' => 0,
    'timestamp' => gmdate('c'),
];

array_unshift($idees, $newIdee);
if (!write_json_array('idees', $idees)) {
    json_error('Erreur serveur pendant la creation de l idee.', [], 500);
}

json_ok('Idee enregistree.', $newIdee, 201);
