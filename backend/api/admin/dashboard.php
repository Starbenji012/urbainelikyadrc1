<?php

declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/core/init.php';

use App\Core\AdminDashboardService;
use App\Core\AuthService;
use App\Core\Database;
use App\Core\Logger;
use App\Core\RequestHandler;
use App\Core\ResponseHandler;

RequestHandler::requireMethod('GET');
$currentUser = AuthService::requireAdminUser();

try {
    $pdo = Database::getInstance();
    ResponseHandler::success('Tableau de bord admin charge.', AdminDashboardService::fetchDashboardData($pdo, $currentUser));
} catch (\Throwable $e) {
    Logger::error('Admin dashboard error: ' . $e->getMessage());
    ResponseHandler::success(
        'Tableau de bord admin charge en mode secours.',
        AdminDashboardService::fetchDashboardDataFromFiles($currentUser)
    );
}