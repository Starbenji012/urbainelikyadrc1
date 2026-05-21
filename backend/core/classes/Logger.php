<?php

declare(strict_types=1);

namespace App\Core;

class Logger
{
    private static string $logFile = '';

    public static function setLogFile(string $logFile): void
    {
        self::$logFile = $logFile;
    }

    public static function log(string $level, string $message): void
    {
        $line = sprintf('[%s] [%s] %s%s', date('c'), strtoupper($level), $message, PHP_EOL);

        if (self::$logFile !== '') {
            @file_put_contents(self::$logFile, $line, FILE_APPEND | LOCK_EX);
        }
    }

    public static function info(string $message): void
    {
        self::log('info', $message);
    }

    public static function warning(string $message): void
    {
        self::log('warning', $message);
    }

    public static function error(string $message): void
    {
        self::log('error', $message);
    }

    public static function debug(string $message): void
    {
        self::log('debug', $message);
    }
}
