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
    $signalements = read_json_array('signalements');
    json_response($signalements, 200);
}

if ($method !== 'POST') {
    json_error('Methode HTTP non autorisee.', [], 405);
}

$input = get_json_input();

$titre = as_clean_string($input['titre'] ?? '');
$type = strtolower(as_clean_string($input['type'] ?? ($input['type-probleme'] ?? '')));
$description = as_clean_string($input['description'] ?? '');
$lieu = as_clean_string($input['lieu'] ?? '');
$photo = as_clean_string($input['photo'] ?? '');
$userNom = as_clean_string($input['user_nom'] ?? 'Utilisateur local');
$userEmail = strtolower(as_clean_string($input['user_email'] ?? ''));
$latRaw = $input['lat'] ?? null;
$lngRaw = $input['lng'] ?? null;
$lat = is_numeric($latRaw) ? (float)$latRaw : null;
$lng = is_numeric($lngRaw) ? (float)$lngRaw : null;

$allowedTypes = ['voirie', 'eau', 'electricite', 'insecurite', 'dechet'];
$errors = [];

if (!is_length_between($titre, 3, 150)) {
    $errors['titre'] = 'Le titre doit contenir entre 3 et 150 caracteres.';
}
if (!is_in_whitelist($type, $allowedTypes)) {
    $errors['type'] = 'Type de probleme invalide.';
}
if (!is_length_between($description, 5, 2000)) {
    $errors['description'] = 'La description doit contenir entre 5 et 2000 caracteres.';
}
if (!is_length_between($lieu, 3, 255)) {
    $errors['lieu'] = 'Le lieu doit contenir entre 3 et 255 caracteres.';
}
if (!is_numeric($latRaw) || !is_numeric($lngRaw)) {
    $errors['coords'] = 'Latitude et longitude obligatoires.';
} elseif ($lat < -90 || $lat > 90 || $lng < -180 || $lng > 180) {
    $errors['coords'] = 'Coordonnees GPS invalides.';
}

if (!empty($errors)) {
    json_error('Validation echouee.', $errors, 422);
}

$signalements = read_json_array('signalements');

$newSignalement = [
    'id' => generate_id('sig'),
    'user_id' => null,
    'user_nom' => $userNom,
    'user_email' => $userEmail !== '' ? $userEmail : null,
    'titre' => $titre,
    'type' => $type,
    'description' => $description,
    'lieu' => $lieu,
    'lat' => $lat,
    'lng' => $lng,
    'photo' => $photo,
    'status' => 'nouveau',
    'timestamp' => gmdate('c'),
];

array_unshift($signalements, $newSignalement);
if (!write_json_array('signalements', $signalements)) {
    json_error('Erreur serveur pendant la creation du signalement.', [], 500);
}

json_ok('Signalement enregistre.', $newSignalement, 201);
