<?php

declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/core/init.php';

use App\Core\AuthService;
use App\Core\Database;
use App\Core\IdGenerator;
use App\Core\Logger;
use App\Core\RequestHandler;
use App\Core\ResponseHandler;
use App\Core\UploadService;
use App\Core\Validator;

$method = RequestHandler::getMethod();

if ($method === 'GET') {
    try {
        $pdo = Database::getInstance();
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
            $row['user_nom'] = trim((string)($row['user_nom_prenom'] ?? '') . ' ' . (string)($row['user_nom_nom'] ?? ''));
            if ($row['user_nom'] === '') {
                $row['user_nom'] = 'Utilisateur local';
            }
            unset($row['user_nom_nom'], $row['user_nom_prenom']);
        }
        unset($row);

        ResponseHandler::success('Signalements recupérés.', $rows);
    } catch (\Throwable $e) {
        Logger::error('Signalements GET MySQL error: ' . $e->getMessage());
        ResponseHandler::error('Erreur serveur pendant la lecture des signalements.', [], 500);
    }
}

if ($method !== 'POST') {
    ResponseHandler::error('Methode HTTP non autorisee.', [], 405);
}

$authUser = AuthService::requireAuthUser();
$input = RequestHandler::getJsonInput();

$titre = RequestHandler::cleanString((string)($input['titre'] ?? ''));
$type = strtolower(RequestHandler::cleanString((string)($input['type'] ?? ($input['type-probleme'] ?? ''))));
$description = RequestHandler::cleanString((string)($input['description'] ?? ''));
$lieu = RequestHandler::cleanString((string)($input['lieu'] ?? ''));
$photo = RequestHandler::cleanString((string)($input['photo'] ?? ''));
$userNom = RequestHandler::cleanString((string)($input['user_nom'] ?? trim((string)(($authUser['nom'] ?? '') . ' ' . ($authUser['prenom'] ?? '')))));
$userEmail = Validator::sanitizeEmail((string)($input['user_email'] ?? (string)($authUser['email'] ?? '')));
$latRaw = $input['lat'] ?? null;
$lngRaw = $input['lng'] ?? null;
$lat = is_numeric($latRaw) ? (float)$latRaw : null;
$lng = is_numeric($lngRaw) ? (float)$lngRaw : null;

$allowedTypes = ['voirie', 'eau', 'electricite', 'insecurite', 'dechet'];
$errors = [];

if (!Validator::isLengthBetween($titre, 3, 150)) {
    $errors['titre'] = 'Le titre doit contenir entre 3 et 150 caracteres.';
}
if (!Validator::isInWhitelist($type, $allowedTypes)) {
    $errors['type'] = 'Type de probleme invalide.';
}
if (!Validator::isLengthBetween($description, 5, 2000)) {
    $errors['description'] = 'La description doit contenir entre 5 et 2000 caracteres.';
}
if (!Validator::isLengthBetween($lieu, 3, 255)) {
    $errors['lieu'] = 'Le lieu doit contenir entre 3 et 255 caracteres.';
}
if (!is_numeric($latRaw) || !is_numeric($lngRaw)) {
    $errors['coords'] = 'Latitude et longitude obligatoires.';
} elseif ($lat < -90 || $lat > 90 || $lng < -180 || $lng > 180) {
    $errors['coords'] = 'Coordonnees GPS invalides.';
}

if (!empty($errors)) {
    ResponseHandler::error('Validation echouee.', $errors, 422);
}

$signalementId = IdGenerator::generate('sig');
$photoPath = UploadService::persistDataUrlImage($photo, 'signalements', $signalementId);
if ($photoPath === null) {
    ResponseHandler::error('Photo invalide. Format accepte: png, jpg, webp, gif (max 5MB).', ['photo' => 'Image invalide.'], 422);
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
    $pdo = Database::getInstance();
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

    ResponseHandler::success('Signalement enregistre.', $newSignalement, 201);
} catch (\Throwable $e) {
    Logger::error('Signalements POST MySQL error: ' . $e->getMessage());
    ResponseHandler::error('Erreur serveur pendant la creation du signalement.', [], 500);
}
