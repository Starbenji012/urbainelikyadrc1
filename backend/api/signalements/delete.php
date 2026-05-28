<?php

declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/core/init.php';
require_once dirname(__DIR__, 2) . '/core/classes/AdminDashboardService.php';

use App\Core\AuthService;
use App\Core\Database;
use App\Core\AdminDashboardService;
use App\Core\Logger;
use App\Core\RequestHandler;
use App\Core\ResponseHandler;

RequestHandler::requireMethod('POST');
$authUser = AuthService::requireAuthUser();
$input = RequestHandler::getJsonInput();
$id = RequestHandler::cleanString((string)($input['id'] ?? ''));

if ($id === '') {
    ResponseHandler::error('ID requis.', [], 422);
}

try {
    $pdo = Database::getInstance();

    $ownerStmt = $pdo->prepare('SELECT id_utilisateur FROM signalements WHERE id_signalement = :id LIMIT 1');
    $ownerStmt->execute([':id' => $id]);
    $ownerRow = $ownerStmt->fetch();
    if (!is_array($ownerRow)) {
        ResponseHandler::error('Signalement introuvable.', [], 404);
    }
    if ((string)($ownerRow['id_utilisateur'] ?? '') !== (string)($authUser['id'] ?? '')) {
        ResponseHandler::error('Suppression non autorisee.', [], 403);
    }

    AdminDashboardService::deleteSignalement($pdo, $id, (string)($authUser['id'] ?? ''));

    ResponseHandler::success('Signalement supprime.');
} catch (\Throwable $e) {
    Logger::error('Signalements delete MySQL error: ' . $e->getMessage());
    ResponseHandler::error('Erreur serveur pendant la suppression.', [], 500);
}
