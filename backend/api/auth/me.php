<?php

declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/core/init.php';

use App\Core\RequestHandler;
use App\Core\ResponseHandler;
use App\Core\AuthService;

RequestHandler::requireMethod('GET');

if (!is_array(AuthService::getAuthUser()) && !is_array(AuthService::getAuthUserFromToken())) {
	ResponseHandler::success('Utilisateur non connecté.', null);
}

$user = AuthService::requireAuthUser();

ResponseHandler::success('Utilisateur courant.', $user);
