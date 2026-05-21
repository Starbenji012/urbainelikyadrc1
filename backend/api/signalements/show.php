<?php

declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/core/init.php';

use App\Core\Database;
use App\Core\RequestHandler;
use App\Core\ResponseHandler;

RequestHandler::requireMethod('GET');

$id = trim((string)($_GET['id'] ?? ''));
if ($id === '') {
    ResponseHandler::error('Paramètre id requis.', [], 422);
}

$pdo = Database::getInstance();
$stmt = $pdo->prepare('SELECT * FROM signalements WHERE id_signalement = :id LIMIT 1');
$stmt->execute([':id' => $id]);
$sig = $stmt->fetch();

if (is_array($sig)) {
    ResponseHandler::success('Détail du signalement.', $sig);
}

ResponseHandler::error('Signalement introuvable.', [], 404);
