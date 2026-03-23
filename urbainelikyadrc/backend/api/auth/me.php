<?php

declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/core/bootstrap.php';
require_once BACKEND_ROOT . '/core/response.php';
require_once BACKEND_ROOT . '/core/request.php';

require_method('GET');

$user = $_SESSION['auth_user'] ?? null;
if (!is_array($user)) {
    json_error('Aucun utilisateur connecte.', [], 401);
}

json_ok('Utilisateur courant.', $user);
