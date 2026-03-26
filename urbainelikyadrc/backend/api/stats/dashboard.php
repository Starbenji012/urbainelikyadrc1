<?php

declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/core/bootstrap.php';
require_once BACKEND_ROOT . '/core/response.php';
require_once BACKEND_ROOT . '/core/request.php';
require_once BACKEND_ROOT . '/core/db.php';

require_method('GET');

$pdo = db_get_pdo();

// Compter les enregistrements globaux depuis la base MySQL.
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

json_ok('Statistiques globales.', $data);
