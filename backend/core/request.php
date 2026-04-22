<?php

declare(strict_types=1);

// Force la methode HTTP attendue (GET, POST...).
function require_method(string $expectedMethod): void
{
    if (strtoupper($_SERVER['REQUEST_METHOD']) !== strtoupper($expectedMethod)) {
        json_error('Methode HTTP non autorisee.', [], 405);
    }
}

// Lit le corps JSON envoye par fetch().
function get_json_input(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || trim($raw) === '') {
        return [];
    }

    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        json_error('JSON invalide.', [], 400);
    }

    return $decoded;
}

// Nettoie une chaine de caracteres (trim + conversion en string).
function as_clean_string($value): string
{
    return trim((string)($value ?? ''));
}
