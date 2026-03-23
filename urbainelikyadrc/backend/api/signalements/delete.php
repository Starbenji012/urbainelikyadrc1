<?php

declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/core/bootstrap.php';
require_once BACKEND_ROOT . '/core/response.php';
require_once BACKEND_ROOT . '/core/request.php';
require_once BACKEND_ROOT . '/core/storage.php';

require_method('POST');
$input = get_json_input();
$id = as_clean_string($input['id'] ?? '');

if ($id === '') {
    json_error('ID requis.', [], 422);
}

$signalements = read_json_array('signalements');
$before = count($signalements);
$signalements = array_values(array_filter($signalements, function (array $sig) use ($id): bool {
    return (string)($sig['id'] ?? '') !== $id;
}));

if ($before === count($signalements)) {
    json_error('Signalement introuvable.', [], 404);
}

if (!write_json_array('signalements', $signalements)) {
    json_error('Erreur serveur pendant la suppression.', [], 500);
}

json_ok('Signalement supprime.');
