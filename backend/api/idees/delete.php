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

    $ownerStmt = $pdo->prepare('SELECT id_utilisateur FROM idees WHERE id_idee = :id LIMIT 1');
    $ownerStmt->execute([':id' => $id]);
    $ownerRow = $ownerStmt->fetch();
    if (!is_array($ownerRow)) {
        json_error('Idee introuvable.', [], 404);
    }
    if ((string)($ownerRow['id_utilisateur'] ?? '') !== (string)($authUser['id'] ?? '')) {
        json_error('Suppression non autorisee.', [], 403);
    }

    $deleteStmt = $pdo->prepare('DELETE FROM idees WHERE id_idee = :id');
    $deleteStmt->execute([':id' => $id]);

    json_ok('Idee supprimee.');
} catch (Throwable $e) {
    app_log('error', 'Idees delete MySQL error: ' . $e->getMessage());
    json_error('Erreur serveur pendant la suppression.', [], 500);
}
