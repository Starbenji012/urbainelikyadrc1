<?php

declare(strict_types=1);

// Enregistre une image envoyee en data URL dans /uploads/<folder>/.
// Retourne le chemin absolu accessible depuis la racine web en cas de succes, ou null si image invalide.
function persist_data_url_image(string $dataUrl, string $folder, string $baseName): ?string
{
    $dataUrl = trim($dataUrl);
    if ($dataUrl === '') {
        return '';
    }

    if (!preg_match('#^data:(image/(png|jpeg|jpg|webp|gif));base64,(.+)$#i', $dataUrl, $m)) {
        return null;
    }

    $mime = strtolower((string)$m[1]);
    $raw = (string)$m[3];

    $binary = base64_decode($raw, true);
    if ($binary === false) {
        return null;
    }

    // Limite a 5MB pour eviter les payloads trop lourds.
    if (strlen($binary) > 5 * 1024 * 1024) {
        return null;
    }

    $extByMime = [
        'image/png' => 'png',
        'image/jpeg' => 'jpg',
        'image/jpg' => 'jpg',
        'image/webp' => 'webp',
        'image/gif' => 'gif',
    ];

    $ext = $extByMime[$mime] ?? null;
    if ($ext === null) {
        return null;
    }

    $safeFolder = preg_replace('/[^a-z0-9_-]/i', '', $folder) ?: 'misc';
    $safeName = preg_replace('/[^a-z0-9_-]/i', '', $baseName) ?: uniqid('img_', true);

    // Sauvegarder dans le dossier /uploads (racine web).
    $uploadsDir = dirname(BACKEND_ROOT) . DIRECTORY_SEPARATOR . 'uploads' . DIRECTORY_SEPARATOR . $safeFolder;
    if (!is_dir($uploadsDir) && !mkdir($uploadsDir, 0775, true) && !is_dir($uploadsDir)) {
        return null;
    }

    $fileName = $safeName . '.' . $ext;
    $fullPath = $uploadsDir . DIRECTORY_SEPARATOR . $fileName;

    if (file_put_contents($fullPath, $binary, LOCK_EX) === false) {
        return null;
    }

    // Retourner le chemin absolu accessible depuis la racine web.
    return '/' . 'uploads' . '/' . $safeFolder . '/' . $fileName;
}
