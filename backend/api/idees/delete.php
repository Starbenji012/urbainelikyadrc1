<?php

declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/core/init.php';

use App\Core\Database;
use App\Core\RequestHandler;
use App\Core\ResponseHandler;
use App\Core\AuthService;
use App\Core\Logger;

RequestHandler::requireMethod('POST');
$authUser = AuthService::requireAuthUser();
$input = RequestHandler::getJsonInput();
$id = RequestHandler::cleanString($input['id'] ?? '');

if ($id === '') {
    ResponseHandler::error('ID idee requis.', [], 422);
}

try {
    $pdo = Database::getInstance();

    $ownerStmt = $pdo->prepare('SELECT id_utilisateur FROM idees WHERE id_idee = :id LIMIT 1');
    $ownerStmt->execute([':id' => $id]);
    $ownerRow = $ownerStmt->fetch();
    if (!is_array($ownerRow)) {
        ResponseHandler::error('Idee introuvable.', [], 404);
    }
    if ((string)($ownerRow['id_utilisateur'] ?? '') !== (string)($authUser['id'] ?? '')) {
        ResponseHandler::error('Suppression non autorisee.', [], 403);
    }

    $deleteStmt = $pdo->prepare('DELETE FROM idees WHERE id_idee = :id');
    $deleteStmt->execute([':id' => $id]);

    ResponseHandler::success('Idee supprimee.');
} catch (Throwable $e) {
    Logger::error('Idees delete MySQL error: ' . $e->getMessage());
    ResponseHandler::error('Erreur serveur pendant la suppression.', [], 500);
}
