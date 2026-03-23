<?php

declare(strict_types=1);

// Genere un identifiant lisible: sig_20260323_xxxxxxxx
function generate_id(string $prefix): string
{
    $date = date('Ymd');
    $random = bin2hex(random_bytes(4));
    return $prefix . '_' . $date . '_' . $random;
}
