<?php

declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/core/bootstrap.php';
require_once BACKEND_ROOT . '/core/response.php';
require_once BACKEND_ROOT . '/core/request.php';
require_once BACKEND_ROOT . '/core/storage.php';

require_method('GET');

$id = trim((string)($_GET['id'] ?? ''));
if ($id === '') {
    json_error('Parametre id requis.', [], 422);
}

$signalements = read_json_array('signalements');
foreach ($signalements as $sig) {
    if ((string)($sig['id'] ?? '') === $id) {
        json_ok('Detail du signalement.', $sig);
    }
}

json_error('Signalement introuvable.', [], 404);
