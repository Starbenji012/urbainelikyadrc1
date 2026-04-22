<?php

declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/core/bootstrap.php';
require_once BACKEND_ROOT . '/core/response.php';
require_once BACKEND_ROOT . '/core/request.php';
require_once BACKEND_ROOT . '/core/auth.php';
require_once BACKEND_ROOT . '/core/db.php';
require_once BACKEND_ROOT . '/core/logger.php';

require_method('POST');
$authUser = require_auth_user();
$input = get_json_input();
$id = as_clean_string($input['id'] ?? '');

if ($id === '') {
    json_error('ID idee requis.', [], 422);
}

try {
    $pdo = db_get_pdo();

    $existsStmt = $pdo->prepare('SELECT id_idee FROM idees WHERE id_idee = :id LIMIT 1');
    $existsStmt->execute([':id' => $id]);
    if (!$existsStmt->fetch()) {
        json_error('Idee introuvable.', [], 404);
    }

    $likeStmt = $pdo->prepare('INSERT INTO likes_idee (id_idee, id_utilisateur, created_at) VALUES (:id_idee, :id_utilisateur, NOW())');
    $likeStmt->execute([
        ':id_idee' => $id,
        ':id_utilisateur' => (string)($authUser['id'] ?? ''),
    ]);

    json_ok('Like enregistre.');
} catch (PDOException $e) {
    if ((int)$e->getCode() === 23000) {
        json_error('Vous avez deja aime cette idee.', [], 409);
    }
    app_log('error', 'Idees like MySQL error: ' . $e->getMessage());
    json_error('Erreur serveur pendant le like.', [], 500);
} catch (Throwable $e) {
    app_log('error', 'Idees like MySQL error: ' . $e->getMessage());
    json_error('Erreur serveur pendant le like.', [], 500);
}
