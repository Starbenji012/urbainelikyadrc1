<?php

declare(strict_types=1);

namespace App\Core;

use App\Core\Logger;

class UploadService
{
    public static function persistDataUrlImage(string $dataUrl, string $folder, string $baseName): ?string
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

        // Limite à 5MB
        if (strlen($binary) > 5 * 1024 * 1024) {
            Logger::warning('Image trop volumineux: ' . strlen($binary) . ' bytes');
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

        $uploadsDir = defined('BACKEND_ROOT') ? BACKEND_ROOT . DIRECTORY_SEPARATOR . 'uploads' : dirname(__DIR__, 3) . DIRECTORY_SEPARATOR . 'uploads';
        $fullDir = $uploadsDir . DIRECTORY_SEPARATOR . $safeFolder;
        if (!is_dir($fullDir) && !mkdir($fullDir, 0775, true) && !is_dir($fullDir)) {
            Logger::error('Impossible de créer le dossier: ' . $fullDir);
            return null;
        }

        $fileName = $safeName . '.' . $ext;
        $fullPath = $fullDir . DIRECTORY_SEPARATOR . $fileName;

        if (file_put_contents($fullPath, $binary, LOCK_EX) === false) {
            Logger::error('Impossible d\'écrire l\'image: ' . $fullPath);
            return null;
        }

        return '/' . 'uploads' . '/' . $safeFolder . '/' . $fileName;
    }

    public static function deleteImage(string $relativePath): bool
    {
        $uploadsDir = defined('BACKEND_ROOT') ? BACKEND_ROOT . DIRECTORY_SEPARATOR . 'uploads' : dirname(__DIR__, 3) . DIRECTORY_SEPARATOR . 'uploads';
        $fullPath = $uploadsDir . $relativePath;
        if (!file_exists($fullPath)) {
            return false;
        }

        return unlink($fullPath);
    }
}
