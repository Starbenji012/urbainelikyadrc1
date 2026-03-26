<?php

declare(strict_types=1);

// Ce fichier est charge au debut de chaque endpoint.
// Il prepare la session, les headers et les chemins utiles.

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// Reponse par defaut en JSON.
header('Content-Type: application/json; charset=utf-8');

// Autoriser les requetes du frontend pendant le developpement local.
// A securiser davantage en production.
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Accept');

// Repondre proprement a la preflight request du navigateur.
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// Racine du backend pour inclure facilement d'autres fichiers.
define('BACKEND_ROOT', dirname(__DIR__));
define('LOG_FILE', BACKEND_ROOT . DIRECTORY_SEPARATOR . 'logs' . DIRECTORY_SEPARATOR . 'app.log');
