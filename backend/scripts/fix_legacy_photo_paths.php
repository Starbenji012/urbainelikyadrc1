<?php

declare(strict_types=1);

// Controle et correction des anciens chemins photo en base MySQL.
// Corrige notamment:
// - /backend/uploads/... -> /uploads/...
// - backend/uploads/...  -> /uploads/...

$root = dirname(__DIR__);
require_once $root . '/core/db.php';

/**
 * Retourne un echantillon de chemins legacy pour verification visuelle.
 */
function fetch_legacy_samples(PDO $pdo, string $table): array
{
    $sql = "SELECT photo_path FROM {$table} WHERE photo_path LIKE '%backend/uploads/%' LIMIT 10";
    $stmt = $pdo->query($sql);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $samples = [];
    foreach ($rows as $row) {
        $samples[] = (string)($row['photo_path'] ?? '');
    }
    return $samples;
}

/**
 * Compte les chemins legacy dans une table.
 */
function count_legacy(PDO $pdo, string $table): int
{
    $sql = "SELECT COUNT(*) AS c FROM {$table} WHERE photo_path LIKE '%backend/uploads/%'";
    $stmt = $pdo->query($sql);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    return (int)($row['c'] ?? 0);
}

/**
 * Applique les remplacements dans une table.
 */
function fix_table(PDO $pdo, string $table): int
{
    $sql = "
        UPDATE {$table}
        SET photo_path = REPLACE(
            REPLACE(photo_path, '/backend/uploads/', '/uploads/'),
            'backend/uploads/',
            '/uploads/'
        )
        WHERE photo_path LIKE '%backend/uploads/%'
    ";

    $stmt = $pdo->prepare($sql);
    $stmt->execute();
    return $stmt->rowCount();
}

try {
    $pdo = db_get_pdo();

    $beforeSignalements = count_legacy($pdo, 'signalements');
    $beforeIdees = count_legacy($pdo, 'idees');

    echo "=== Controle avant correction ===\n";
    echo "signalements legacy: {$beforeSignalements}\n";
    echo "idees legacy: {$beforeIdees}\n\n";

    $sigSamples = fetch_legacy_samples($pdo, 'signalements');
    $ideeSamples = fetch_legacy_samples($pdo, 'idees');

    if (!empty($sigSamples) || !empty($ideeSamples)) {
        echo "Exemples detectes:\n";
        foreach ($sigSamples as $s) {
            echo "- signalements: {$s}\n";
        }
        foreach ($ideeSamples as $s) {
            echo "- idees: {$s}\n";
        }
        echo "\n";
    }

    $pdo->beginTransaction();
    $updatedSignalements = fix_table($pdo, 'signalements');
    $updatedIdees = fix_table($pdo, 'idees');
    $pdo->commit();

    $afterSignalements = count_legacy($pdo, 'signalements');
    $afterIdees = count_legacy($pdo, 'idees');

    echo "=== Correction appliquee ===\n";
    echo "signalements modifies: {$updatedSignalements}\n";
    echo "idees modifies: {$updatedIdees}\n\n";

    echo "=== Controle apres correction ===\n";
    echo "signalements legacy restants: {$afterSignalements}\n";
    echo "idees legacy restants: {$afterIdees}\n";

    if ($afterSignalements === 0 && $afterIdees === 0) {
        echo "\nOK: plus aucune ancienne valeur backend/uploads en base.\n";
    } else {
        echo "\nAttention: il reste des valeurs legacy a verifier manuellement.\n";
    }
} catch (Throwable $e) {
    if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    fwrite(STDERR, "Erreur: " . $e->getMessage() . "\n");
    exit(1);
}
