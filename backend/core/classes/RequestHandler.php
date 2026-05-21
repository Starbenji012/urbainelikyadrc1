<?php

declare(strict_types=1);

namespace App\Core;

class RequestHandler
{
    public static function requireMethod(string $expectedMethod): void
    {
        if (strtoupper($_SERVER['REQUEST_METHOD']) !== strtoupper($expectedMethod)) {
            ResponseHandler::error('Methode HTTP non autorisee.', [], 405);
        }
    }

    public static function getJsonInput(): array
    {
        $raw = file_get_contents('php://input');
        if ($raw === false || trim($raw) === '') {
            return [];
        }

        $decoded = json_decode($raw, true);
        if (!is_array($decoded)) {
            ResponseHandler::error('JSON invalide.', [], 400);
        }

        return $decoded;
    }

    public static function cleanString(string $value = ''): string
    {
        return trim($value);
    }

    public static function getMethod(): string
    {
        return strtoupper($_SERVER['REQUEST_METHOD']);
    }

    public static function getOrigin(): string
    {
        return (string)($_SERVER['HTTP_ORIGIN'] ?? '');
    }
}
