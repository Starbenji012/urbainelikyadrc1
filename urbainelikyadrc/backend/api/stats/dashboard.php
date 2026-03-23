<?php

declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/core/bootstrap.php';
require_once BACKEND_ROOT . '/core/response.php';
require_once BACKEND_ROOT . '/core/request.php';
require_once BACKEND_ROOT . '/core/storage.php';

require_method('GET');

$users = read_json_array('users');
$signalements = read_json_array('signalements');
$idees = read_json_array('idees');
$messages = read_json_array('messages');

$data = [
    'users_total' => count($users),
    'signalements_total' => count($signalements),
    'idees_total' => count($idees),
    'messages_total' => count($messages),
];

json_ok('Statistiques globales.', $data);
