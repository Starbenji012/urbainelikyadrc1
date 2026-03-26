<?php

declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/core/bootstrap.php';
require_once BACKEND_ROOT . '/core/response.php';
require_once BACKEND_ROOT . '/core/request.php';
require_once BACKEND_ROOT . '/core/db.php';

require_method('GET');

$id = trim((string)($_GET['id'] ?? ''));
if ($id === '') {
    json_error('Paramètre id requis.', [], 422);
}

$pdo = db_get_pdo();
$stmt = $pdo->prepare('SELECT * FROM signalements WHERE id = :id LIMIT 1');
$stmt->execute([':id' => $id]);
$sig = $stmt->fetch(PDO::FETCH_ASSOC);

if (is_array($sig)) {
    json_ok('Détail du signalement.', $sig);
}

json_error('Signalement introuvable.', [], 404);
