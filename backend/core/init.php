<?php

declare(strict_types=1);

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// Réponse par défaut en JSON
header('Content-Type: application/json; charset=utf-8');

// CORS
$origin = (string)($_SERVER['HTTP_ORIGIN'] ?? '');
$allowedOriginsEnv = trim((string)(getenv('ALLOWED_ORIGINS') ?: ''));

if ($allowedOriginsEnv !== '') {
    $allowedOrigins = array_values(array_filter(array_map('trim', explode(',', $allowedOriginsEnv))));
    if ($origin !== '' && in_array($origin, $allowedOrigins, true)) {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Vary: Origin');
        header('Access-Control-Allow-Credentials: true');
    }
} else {
    if ($origin !== '') {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Vary: Origin');
        header('Access-Control-Allow-Credentials: true');
    } else {
        header('Access-Control-Allow-Origin: *');
    }
}

header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Accept, Authorization, X-Auth-Token');

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// Chemins constants
define('BACKEND_ROOT', dirname(__DIR__));
define('LOG_FILE', BACKEND_ROOT . DIRECTORY_SEPARATOR . 'logs' . DIRECTORY_SEPARATOR . 'app.log');

require_once BACKEND_ROOT . '/core/Autoloader.php';

// Initialiser les loggers globaux
\App\Core\Logger::setLogFile(LOG_FILE);

// Alias pour compatibilité
class_alias('\App\Core\MailerService', 'MailerService');
