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

// Supprime la session si elle correspond a l'utilisateur cible.
function clear_auth_user_if_matches(string $userId): void
{
    if (!empty($_SESSION['auth_user']) && (string)($_SESSION['auth_user']['id'] ?? '') === $userId) {
        unset($_SESSION['auth_user']);
    }
}
