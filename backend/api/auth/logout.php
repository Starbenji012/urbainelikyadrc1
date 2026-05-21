<?php

declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/core/init.php';

use App\Core\RequestHandler;
use App\Core\ResponseHandler;
use App\Core\AuthService;

RequestHandler::requireMethod('POST');

AuthService::logout();
ResponseHandler::success('Deconnexion reussie.');
