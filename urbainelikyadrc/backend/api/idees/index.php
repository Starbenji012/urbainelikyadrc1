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
        app_log('error', 'Idees GET MySQL error: ' . $e->getMessage());
        json_error('Erreur serveur pendant la lecture des idees.', [], 500);
    }
}

if ($method !== 'POST') {
    json_error('Methode HTTP non autorisee.', [], 405);
}

$authUser = require_auth_user();

$input = get_json_input();
$titre = as_clean_string($input['titre'] ?? '');
$categorie = strtolower(as_clean_string($input['categorie'] ?? 'autre'));
$description = as_clean_string($input['description'] ?? '');
$photo = as_clean_string($input['photo'] ?? '');
$userId = as_clean_string($input['user_id'] ?? (string)($authUser['id'] ?? ''));
$userNom = as_clean_string($input['user_nom'] ?? trim((string)(($authUser['nom'] ?? '') . ' ' . ($authUser['prenom'] ?? ''))));
$userEmail = strtolower(as_clean_string($input['user_email'] ?? (string)($authUser['email'] ?? '')));

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

$ideeId = generate_id('ide');
$photoPath = persist_data_url_image($photo, 'idees', $ideeId);
if ($photoPath === null) {
    json_error('Photo invalide. Format accepte: png, jpg, webp, gif (max 5MB).', ['photo' => 'Image invalide.'], 422);
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
    $pdo = db_get_pdo();
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

    json_ok('Idee enregistree.', $newIdee, 201);
} catch (Throwable $e) {
    app_log('error', 'Idees POST MySQL error: ' . $e->getMessage());
    json_error('Erreur serveur pendant la creation de l idee.', [], 500);
}
