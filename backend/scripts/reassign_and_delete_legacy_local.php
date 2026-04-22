<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/core/db.php';

$pdo = db_get_pdo();

$target = $pdo->query(
    "SELECT id_utilisateur, email, created_at
     FROM utilisateurs
     WHERE id_utilisateur NOT LIKE 'usr_legacy%'
       AND email NOT LIKE 'legacy.%'
     ORDER BY created_at DESC
     LIMIT 1"
)->fetch(PDO::FETCH_ASSOC);

if (!is_array($target)) {
    fwrite(STDERR, "ERR: Aucun compte reel trouve.\n");
    exit(1);
}

$targetId = (string)$target['id_utilisateur'];
$targetEmail = (string)$target['email'];

$pdo->beginTransaction();

try {
    $sigMoved = $pdo->prepare(
        "UPDATE signalements SET id_utilisateur = :target WHERE id_utilisateur = 'usr_legacy_local'"
    );
    $sigMoved->execute([':target' => $targetId]);

    $ideMoved = $pdo->prepare(
        "UPDATE idees SET id_utilisateur = :target WHERE id_utilisateur = 'usr_legacy_local'"
    );
    $ideMoved->execute([':target' => $targetId]);

    $del = (int)$pdo->exec("DELETE FROM utilisateurs WHERE id_utilisateur = 'usr_legacy_local'");

    $left = (int)$pdo->query(
        "SELECT COUNT(*) FROM utilisateurs WHERE id_utilisateur LIKE 'usr_legacy%' OR email LIKE 'legacy.%'"
    )->fetchColumn();

    $pdo->commit();

    echo "target_id={$targetId}\n";
    echo "target_email={$targetEmail}\n";
    echo 'signalements_moved=' . $sigMoved->rowCount() . "\n";
    echo 'idees_moved=' . $ideMoved->rowCount() . "\n";
    echo "legacy_local_deleted={$del}\n";
    echo "legacy_remaining={$left}\n";
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    fwrite(STDERR, 'ERR: ' . $e->getMessage() . "\n");
    exit(1);
}
