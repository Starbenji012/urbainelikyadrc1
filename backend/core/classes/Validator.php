<?php

declare(strict_types=1);

namespace App\Core;

class Validator
{
    public static function isValidEmail(string $email): bool
    {
        return filter_var($email, FILTER_VALIDATE_EMAIL) !== false;
    }

    public static function sanitizeEmail(string $email): string
    {
        return strtolower(trim($email));
    }

    public static function isLengthBetween(string $value, int $min, int $max): bool
    {
        $len = function_exists('mb_strlen') ? mb_strlen($value) : strlen($value);
        return $len >= $min && $len <= $max;
    }

    public static function isInWhitelist(string $value, array $allowed): bool
    {
        return in_array($value, $allowed, true);
    }

    public static function validateEmail(string $email): ?string
    {
        $email = trim(strtolower($email));
        if (!self::isValidEmail($email)) {
            return 'Email invalide.';
        }
        return null;
    }

    public static function validatePassword(string $password): ?string
    {
        if ($password === '') {
            return 'Mot de passe requis.';
        }
        if (!self::isLengthBetween($password, 6, 255)) {
            return 'Mot de passe doit être entre 6 et 255 caractères.';
        }
        return null;
    }
}
