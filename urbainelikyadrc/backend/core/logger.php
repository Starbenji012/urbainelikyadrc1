<?php

declare(strict_types=1);

// Ecrit une ligne de log simple dans logs/app.log.
function app_log(string $level, string $message): void
{
    $line = sprintf(
        "[%s] [%s] %s%s",
        date('c'),
        strtoupper($level),
        $message,
        PHP_EOL
    );

    @file_put_contents(LOG_FILE, $line, FILE_APPEND | LOCK_EX);
}
