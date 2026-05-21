<?php

declare(strict_types=1);

namespace App\Core;

class ResponseHandler
{
    public static function json(array $payload, int $statusCode = 200): void
    {
        http_response_code($statusCode);
        echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }

    public static function success(string $message, ?array $data = null, int $statusCode = 200): void
    {
        self::json([
            'ok' => true,
            'message' => $message,
            'data' => $data,
        ], $statusCode);
    }

    public static function ok(string $message, ?array $data = null, int $statusCode = 200): void
    {
        self::success($message, $data, $statusCode);
    }

    public static function error(string $message, array $errors = [], int $statusCode = 400): void
    {
        self::json([
            'ok' => false,
            'message' => $message,
            'errors' => $errors,
        ], $statusCode);
    }
}
