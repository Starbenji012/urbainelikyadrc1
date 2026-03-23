<?php

declare(strict_types=1);

// Retourne true si email valide.
function is_valid_email(string $email): bool
{
    return filter_var($email, FILTER_VALIDATE_EMAIL) !== false;
}

// Validation de longueur textuelle.
function is_length_between(string $value, int $min, int $max): bool
{
    // Fallback robuste: certains environnements PHP n'ont pas mbstring active.
    $len = function_exists('mb_strlen') ? mb_strlen($value) : strlen($value);
    return $len >= $min && $len <= $max;
}

// Verifie si une valeur est dans une liste blanche.
function is_in_whitelist(string $value, array $allowed): bool
{
    return in_array($value, $allowed, true);
}
