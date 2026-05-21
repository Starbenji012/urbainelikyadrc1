<?php

declare(strict_types=1);

namespace App\Core;

class Autoloader
{
    public static function register(): void
    {
        spl_autoload_register([self::class, 'autoload']);
    }

    public static function autoload(string $class): void
    {
        if (strpos($class, 'App\\Core\\') !== 0) {
            return;
        }

        $shortClass = substr($class, strlen('App\\Core\\'));
        $filePath = __DIR__ . DIRECTORY_SEPARATOR . 'classes' . DIRECTORY_SEPARATOR . $shortClass . '.php';

        if (!file_exists($filePath)) {
            return;
        }

        require_once $filePath;

        if (!class_exists($class, false) && class_exists($shortClass, false)) {
            class_alias($shortClass, $class);
        }
    }
}

Autoloader::register();
