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
            'SELECT i.id_idee AS id,
                    i.id_utilisateur AS user_id,
                    u.nom AS user_nom_nom,
                    u.prenom AS user_nom_prenom,
                    u.email AS user_email,
                    i.titre,
                    i.categorie,
                    i.description,
                    i.photo_path AS photo,
                    COUNT(li.id_like) AS likes,
                    DATE_FORMAT(i.created_at, \'%Y-%m-%dT%H:%i:%sZ\') AS timestamp
             FROM idees i
             LEFT JOIN utilisateurs u ON u.id_utilisateur = i.id_utilisateur
             LEFT JOIN likes_idee li ON li.id_idee = i.id_idee
             GROUP BY i.id_idee, i.id_utilisateur, u.nom, u.prenom, u.email, i.titre, i.categorie, i.description, i.photo_path, i.created_at
             ORDER BY i.created_at DESC'
        );
        $rows = $stmt->fetchAll();
        foreach ($rows as &$row) {
            $row['likes'] = (int)($row['likes'] ?? 0);
            $row['user_nom'] = trim((string)($row['user_nom_prenom'] ?? '') . ' ' . (string)($row['user_nom_nom'] ?? ''));
            if ($row['user_nom'] === '') {
                $row['user_nom'] = 'Utilisateur local';
            }
            unset($row['user_nom_nom'], $row['user_nom_prenom']);
        }
        unset($row);

        ResponseHandler::success('Idees recuperees.', $rows);
    } catch (\Throwable $e) {
        Logger::error('Idees GET MySQL error: ' . $e->getMessage());
        ResponseHandler::error('Erreur serveur pendant la lecture des idees.', [], 500);
    }
}

if ($method !== 'POST') {
    ResponseHandler::error('Methode HTTP non autorisee.', [], 405);
}

$authUser = AuthService::requireAuthUser();
$input = RequestHandler::getJsonInput();

$titre = RequestHandler::cleanString((string)($input['titre'] ?? ''));
$categorie = strtolower(RequestHandler::cleanString((string)($input['categorie'] ?? 'autre')));
$description = RequestHandler::cleanString((string)($input['description'] ?? ''));
$photo = RequestHandler::cleanString((string)($input['photo'] ?? ''));
$userId = RequestHandler::cleanString((string)($input['user_id'] ?? (string)($authUser['id'] ?? '')));
$userNom = RequestHandler::cleanString((string)($input['user_nom'] ?? trim((string)(($authUser['nom'] ?? '') . ' ' . ($authUser['prenom'] ?? '')))));
$userEmail = Validator::sanitizeEmail((string)($input['user_email'] ?? (string)($authUser['email'] ?? '')));

$allowedCategories = ['infrastructure', 'environnement', 'services-publics', 'transport', 'autre'];
$errors = [];

if (!Validator::isLengthBetween($titre, 3, 150)) {
    $errors['titre'] = 'Le titre doit contenir entre 3 et 150 caracteres.';
}
if (!Validator::isInWhitelist($categorie, $allowedCategories)) {
    $errors['categorie'] = 'Categorie invalide.';
}
if (!Validator::isLengthBetween($description, 5, 2000)) {
    $errors['description'] = 'La description doit contenir entre 5 et 2000 caracteres.';
}

if (!empty($errors)) {
    ResponseHandler::error('Validation echouee.', $errors, 422);
}

$ideeId = IdGenerator::generate('ide');
$photoPath = UploadService::persistDataUrlImage($photo, 'idees', $ideeId);
if ($photoPath === null) {
    ResponseHandler::error('Photo invalide. Format accepte: png, jpg, webp, gif (max 5MB).', ['photo' => 'Image invalide.'], 422);
}

$newIdee = [
    'id' => $ideeId,
    'user_id' => $userId !== '' ? $userId : null,
    'user_nom' => $userNom,
    'user_email' => $userEmail !== '' ? $userEmail : null,
    'titre' => $titre,
    'categorie' => $categorie,
    'description' => $description,
    'photo' => $photoPath,
    'likes' => 0,
    'timestamp' => gmdate('c'),
];

try {
    $pdo = Database::getInstance();
    $stmt = $pdo->prepare(
        'INSERT INTO idees (id_idee, id_utilisateur, titre, categorie, description, photo_path, created_at)
         VALUES (:id, :user_id, :titre, :categorie, :description, :photo, NOW())'
    );
    $stmt->execute([
        ':id' => $newIdee['id'],
        ':user_id' => $newIdee['user_id'],
        ':titre' => $newIdee['titre'],
        ':categorie' => $newIdee['categorie'],
        ':description' => $newIdee['description'],
        ':photo' => $newIdee['photo'] !== '' ? $newIdee['photo'] : null,
    ]);

    ResponseHandler::success('Idee enregistree.', $newIdee, 201);
} catch (\Throwable $e) {
    Logger::error('Idees POST MySQL error: ' . $e->getMessage());
    ResponseHandler::error('Erreur serveur pendant la creation de l idee.', [], 500);
}
