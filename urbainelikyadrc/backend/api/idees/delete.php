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
    json_error('ID idee requis.', [], 422);
}

$idees = read_json_array('idees');
$before = count($idees);
$idees = array_values(array_filter($idees, function (array $idee) use ($id): bool {
    return (string)($idee['id'] ?? '') !== $id;
}));

if ($before === count($idees)) {
    json_error('Idee introuvable.', [], 404);
}

if (!write_json_array('idees', $idees)) {
    json_error('Erreur serveur pendant la suppression.', [], 500);
}

json_ok('Idee supprimee.');
