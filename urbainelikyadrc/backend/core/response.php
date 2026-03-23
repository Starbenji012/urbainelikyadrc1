<?php

declare(strict_types=1);

// Helper pour renvoyer une reponse JSON uniforme.
function json_response(array $payload, int $statusCode = 200): void
{
    http_response_code($statusCode);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

// Reponse de succes standard.
function json_ok(string $message, $data = null, int $statusCode = 200): void
{
    json_response([
        'ok' => true,
        'message' => $message,
        'data' => $data,
    ], $statusCode);
}

// Reponse d'erreur standard.
function json_error(string $message, array $errors = [], int $statusCode = 400): void
{
    json_response([
        'ok' => false,
        'message' => $message,
        'errors' => $errors,
    ], $statusCode);
}
