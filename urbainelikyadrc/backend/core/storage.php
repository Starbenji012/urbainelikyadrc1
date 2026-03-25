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

// Construit un chemin relatif web pour les uploads (ex: /uploads/idees/photo.jpg).
function uploads_web_path(string $folder, string $filename): string
{
    return '/uploads/' . trim($folder, '/\\') . '/' . ltrim($filename, '/\\');
}

// Convertit une image data URL (base64) en fichier et renvoie son chemin web.
// Retourne:
// - chemin web si success
// - chaine vide si photo vide
// - null si format invalide
function persist_data_url_image(string $photoValue, string $folder, string $baseName): ?string
{
    $raw = trim($photoValue);
    if ($raw === '') {
        return '';
    }

    // Si c'est deja un chemin/URL (pas du base64), on le conserve tel quel.
    if (stripos($raw, 'data:image/') !== 0) {
        return $raw;
    }

    if (!preg_match('/^data:image\/(png|jpeg|jpg|webp|gif);base64,(.+)$/i', $raw, $m)) {
        return null;
    }

    $ext = strtolower($m[1]);
    if ($ext === 'jpeg') {
        $ext = 'jpg';
    }

    $decoded = base64_decode($m[2], true);
    if ($decoded === false) {
        return null;
    }

    $maxBytes = 5 * 1024 * 1024;
    if (strlen($decoded) > $maxBytes) {
        return null;
    }

    $projectRoot = dirname(BACKEND_ROOT);
    $uploadDir = $projectRoot . DIRECTORY_SEPARATOR . 'uploads' . DIRECTORY_SEPARATOR . trim($folder, '/\\');
    if (!is_dir($uploadDir) && !mkdir($uploadDir, 0775, true) && !is_dir($uploadDir)) {
        return null;
    }

    $safeBaseName = preg_replace('/[^a-zA-Z0-9_-]/', '', $baseName);
    if (!is_string($safeBaseName) || $safeBaseName === '') {
        $safeBaseName = uniqid('img_', true);
    }

    $filename = $safeBaseName . '_' . gmdate('Ymd_His') . '.' . $ext;
    $absolutePath = $uploadDir . DIRECTORY_SEPARATOR . $filename;

    if (file_put_contents($absolutePath, $decoded, LOCK_EX) === false) {
        return null;
    }

    return uploads_web_path($folder, $filename);
}

// Migre les anciens champs photo en base64 vers des chemins de fichiers uploads.
// Retourne ['rows' => array, 'changed' => bool].
function migrate_rows_photo_to_upload_path(array $rows, string $folder, string $idPrefix): array
{
    $changed = false;

    foreach ($rows as $idx => $row) {
        if (!is_array($row)) {
            continue;
        }

        $photo = isset($row['photo']) ? trim((string)$row['photo']) : '';
        if ($photo === '' || stripos($photo, 'data:image/') !== 0) {
            continue;
        }

        $baseName = isset($row['id']) && trim((string)$row['id']) !== ''
            ? (string)$row['id']
            : ($idPrefix . '_migr_' . ($idx + 1));

        $photoPath = persist_data_url_image($photo, $folder, $baseName);
        if ($photoPath === null) {
            continue;
        }

        if ($photoPath !== $photo) {
            $rows[$idx]['photo'] = $photoPath;
            $changed = true;
        }
    }

    return ['rows' => $rows, 'changed' => $changed];
}
