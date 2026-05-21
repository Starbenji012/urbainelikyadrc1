<?php

declare(strict_types=1);

namespace App\Core;

class IdGenerator
{
    public static function generate(string $prefix): string
    {
        $date = date('Ymd');
        $random = bin2hex(random_bytes(4));

        return $prefix . '_' . $date . '_' . $random;
    }

    public static function generateToken(): string
    {
        return bin2hex(random_bytes(32));
    }

    public static function hashToken(string $token): string
    {
        return hash('sha256', $token);
    }

    public static function uuid(): string
    {
        $bytes = random_bytes(16);
        $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
        $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);

        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($bytes), 4));
    }
}
