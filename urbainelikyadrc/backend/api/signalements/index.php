<?php

declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/core/bootstrap.php';
require_once BACKEND_ROOT . '/core/response.php';
require_once BACKEND_ROOT . '/core/request.php';
require_once BACKEND_ROOT . '/core/validator.php';
require_once BACKEND_ROOT . '/core/id.php';
require_once BACKEND_ROOT . '/core/auth.php';
require_once BACKEND_ROOT . '/core/db.php';
require_once BACKEND_ROOT . '/core/uploads.php';
require_once BACKEND_ROOT . '/core/logger.php';

$method = strtoupper($_SERVER['REQUEST_METHOD']);

if ($method === 'GET') {
    try {
        $pdo = db_get_pdo();
        $stmt = $pdo->query(
            'SELECT s.id_signalement AS id,
                    s.id_utilisateur AS user_id,
                    u.nom AS user_nom_nom,
                    u.prenom AS user_nom_prenom,
                    u.email AS user_email,
                    s.titre,
                    s.type,
                    s.description,
                    s.lieu,
                    CAST(s.latitude AS DOUBLE) AS lat,
                    CAST(s.longitude AS DOUBLE) AS lng,
                    s.photo_path AS photo,
                    s.status,
                    DATE_FORMAT(s.created_at, \'%Y-%m-%dT%H:%i:%sZ\') AS timestamp
             FROM signalements s
             LEFT JOIN utilisateurs u ON u.id_utilisateur = s.id_utilisateur
             ORDER BY s.created_at DESC'
        );
        $rows = $stmt->fetchAll();
        foreach ($rows as &$row) {
            $row['user_nom'] = trim(
                (string)($row['user_nom_prenom'] ?? '') . ' ' . (string)($row['user_nom_nom'] ?? '')
            );
            if ($row['user_nom'] === '') {
                $row['user_nom'] = 'Utilisateur local';
            }
            unset($row['user_nom_nom'], $row['user_nom_prenom']);
        }
        unset($row);
        json_response($rows, 200);
    } catch (Throwable $e) {
        app_log('error', 'Signalements GET MySQL error: ' . $e->getMessage());
        json_error('Erreur serveur pendant la lecture des signalements.', [], 500);
    }
}

if ($method !== 'POST') {
    json_error('Methode HTTP non autorisee.', [], 405);
}

$authUser = require_auth_user();

$input = get_json_input();

$titre = as_clean_string($input['titre'] ?? '');
$type = strtolower(as_clean_string($input['type'] ?? ($input['type-probleme'] ?? '')));
$description = as_clean_string($input['description'] ?? '');
$lieu = as_clean_string($input['lieu'] ?? '');
$photo = as_clean_string($input['photo'] ?? '');
$userNom = as_clean_string($input['user_nom'] ?? trim((string)(($authUser['nom'] ?? '') . ' ' . ($authUser['prenom'] ?? ''))));
$userEmail = strtolower(as_clean_string($input['user_email'] ?? (string)($authUser['email'] ?? '')));
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

$signalementId = generate_id('sig');
$photoPath = persist_data_url_image($photo, 'signalements', $signalementId);
if ($photoPath === null) {
    json_error('Photo invalide. Format accepte: png, jpg, webp, gif (max 5MB).', ['photo' => 'Image invalide.'], 422);
}

$newSignalement = [
    'id' => $signalementId,
    'user_id' => (string)($authUser['id'] ?? ''),
    'user_nom' => $userNom,
    'user_email' => $userEmail !== '' ? $userEmail : null,
    'titre' => $titre,
    'type' => $type,
    'description' => $description,
    'lieu' => $lieu,
    'lat' => $lat,
    'lng' => $lng,
    'photo' => $photoPath,
    'status' => 'nouveau',
    'timestamp' => gmdate('c'),
];

try {
    $pdo = db_get_pdo();
    $stmt = $pdo->prepare(
        'INSERT INTO signalements (id_signalement, id_utilisateur, titre, type, description, lieu, latitude, longitude, photo_path, status, created_at)
         VALUES (:id, :user_id, :titre, :type, :description, :lieu, :lat, :lng, :photo, :status, NOW())'
    );
    $stmt->execute([
        ':id' => $newSignalement['id'],
        ':user_id' => $newSignalement['user_id'],
        ':titre' => $newSignalement['titre'],
        ':type' => $newSignalement['type'],
        ':description' => $newSignalement['description'],
        ':lieu' => $newSignalement['lieu'],
        ':lat' => $newSignalement['lat'],
        ':lng' => $newSignalement['lng'],
        ':photo' => $newSignalement['photo'] !== '' ? $newSignalement['photo'] : null,
        ':status' => $newSignalement['status'],
    ]);

    json_ok('Signalement enregistre.', $newSignalement, 201);
} catch (Throwable $e) {
    app_log('error', 'Signalements POST MySQL error: ' . $e->getMessage());
    json_error('Erreur serveur pendant la creation du signalement.', [], 500);
}
