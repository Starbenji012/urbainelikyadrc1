<?php

declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/core/init.php';

use App\Core\Database;
use App\Core\RequestHandler;
use App\Core\ResponseHandler;

RequestHandler::requireMethod('GET');

$pdo = Database::getInstance();

$usersTotal = (int)$pdo->query('SELECT COUNT(*) FROM utilisateurs')->fetchColumn();
$signalementsTotal = (int)$pdo->query('SELECT COUNT(*) FROM signalements')->fetchColumn();
$ideesTotal = (int)$pdo->query('SELECT COUNT(*) FROM idees')->fetchColumn();
$messagesTotal = (int)$pdo->query('SELECT COUNT(*) FROM messages_contact')->fetchColumn();

$data = [
    'users_total' => $usersTotal,
    'signalements_total' => $signalementsTotal,
    'idees_total' => $ideesTotal,
    'messages_total' => $messagesTotal,
];

ResponseHandler::success('Statistiques globales.', $data);
