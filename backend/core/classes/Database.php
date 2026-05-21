<?php

declare(strict_types=1);

namespace App\Core;

use PDO;

class Database
{
    private static ?PDO $instance = null;

    public static function getInstance(): PDO
    {
        if (self::$instance instanceof PDO) {
            return self::$instance;
        }

        $host = getenv('DB_HOST') ?: '127.0.0.1';
        $port = getenv('DB_PORT') ?: '3306';
        $name = getenv('DB_NAME') ?: 'urbainelikya_drc';
        $user = getenv('DB_USER') ?: 'root';
        $pass = getenv('DB_PASS');

        if ($pass === false || $pass === '') {
            $pass = getenv('DB_PASSWORD');
        }
        if ($pass === false || $pass === '') {
            $pass = getenv('MYSQL_PASSWORD');
        }
        if ($pass === false || $pass === '') {
            $pass = 'azerty';
        }

        $dsn = 'mysql:host=' . $host . ';port=' . $port . ';dbname=' . $name . ';charset=utf8mb4';

        self::$instance = new PDO($dsn, $user, $pass, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);

        return self::$instance;
    }

    public static function getPdo(): PDO
    {
        return self::getInstance();
    }

    public static function reset(): void
    {
        self::$instance = null;
    }
}
