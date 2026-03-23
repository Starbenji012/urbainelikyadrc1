<?php

declare(strict_types=1);

// Verifie qu'un utilisateur est connecte en session.
function require_auth_user(): array
{
    $user = $_SESSION['auth_user'] ?? null;
    if (!is_array($user)) {
        json_error('Authentification requise.', [], 401);
    }
    return $user;
}
