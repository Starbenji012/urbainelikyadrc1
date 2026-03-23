<?php

declare(strict_types=1);

// Renvoie le chemin d'un fichier JSON (ex: users -> data/users.json).
function json_file_path(string $name): string
{
    return DATA_DIR . DIRECTORY_SEPARATOR . $name . '.json';
}

// Lit un tableau depuis un fichier JSON.
function read_json_array(string $name): array
{
    $path = json_file_path($name);

    if (!file_exists($path)) {
        return [];
    }

    $content = file_get_contents($path);
    if ($content === false || trim($content) === '') {
        return [];
    }

    $decoded = json_decode($content, true);
    return is_array($decoded) ? $decoded : [];
}

// Ecrit un tableau dans un fichier JSON avec verrouillage.
function write_json_array(string $name, array $rows): bool
{
    $path = json_file_path($name);

    // JSON_PRETTY_PRINT facilite la lecture a la main pour un debutant.
    $json = json_encode($rows, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
    if ($json === false) {
        return false;
    }

    // LOCK_EX evite des ecritures simultanees corrompues.
    return file_put_contents($path, $json . PHP_EOL, LOCK_EX) !== false;
}
