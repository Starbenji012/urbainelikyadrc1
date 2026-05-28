<?php

declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/core/init.php';

use App\Core\Database;
use App\Core\RequestHandler;
use App\Core\ResponseHandler;

RequestHandler::requireMethod('GET');

$pdo = Database::getInstance();

$statusExpr = "LOWER(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(status, ''), 'é', 'e'), 'è', 'e'), 'ê', 'e'), 'à', 'a'))";

$usersTotal = (int)$pdo->query('SELECT COUNT(*) FROM utilisateurs')->fetchColumn();
$signalementsTotal = (int)$pdo->query('SELECT COUNT(*) FROM signalements')->fetchColumn();
$signalementsEnCours = (int)$pdo->query("SELECT COUNT(*) FROM signalements WHERE {$statusExpr} = 'en_cours'")->fetchColumn();
$signalementsResolus = (int)$pdo->query("SELECT COUNT(*) FROM signalements WHERE {$statusExpr} = 'resolu'")->fetchColumn();
$signalementsAnnules = (int)$pdo->query("SELECT COUNT(*) FROM signalements WHERE {$statusExpr} = 'annule'")->fetchColumn();
$signalementsSupprimes = (int)$pdo->query("SELECT COUNT(*) FROM admin_content_deletions WHERE resource_type = 'signalement'")->fetchColumn();
$ideesTotal = (int)$pdo->query('SELECT COUNT(*) FROM idees')->fetchColumn();
$ideesEnCours = (int)$pdo->query("SELECT COUNT(*) FROM idees WHERE {$statusExpr} = 'en_cours'")->fetchColumn();
$ideesRealisees = (int)$pdo->query("SELECT COUNT(*) FROM idees WHERE {$statusExpr} = 'realisee'")->fetchColumn();
$ideesAnnulees = (int)$pdo->query("SELECT COUNT(*) FROM idees WHERE {$statusExpr} = 'annule'")->fetchColumn();
$ideesSupprimees = (int)$pdo->query("SELECT COUNT(*) FROM admin_content_deletions WHERE resource_type = 'idee'")->fetchColumn();
$messagesTotal = (int)$pdo->query('SELECT COUNT(*) FROM messages_contact')->fetchColumn();

$data = [
    'users_total' => $usersTotal,
    'signalements_total' => $signalementsTotal,
    'signalements_en_cours' => $signalementsEnCours,
    'signalements_resolus' => $signalementsResolus,
    'signalements_annules' => $signalementsAnnules,
    'signalements_supprimes' => $signalementsSupprimes,
    'idees_total' => $ideesTotal,
    'idees_en_cours' => $ideesEnCours,
    'idees_realisees' => $ideesRealisees,
    'idees_annulees' => $ideesAnnulees,
    'idees_supprimees' => $ideesSupprimees,
    'messages_total' => $messagesTotal,
];

ResponseHandler::success('Statistiques globales.', $data);
