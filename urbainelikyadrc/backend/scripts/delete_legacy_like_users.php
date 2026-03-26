<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/core/db.php';

$pdo = db_get_pdo();
$pdo->beginTransaction();

try {
    $countBefore = (int)$pdo->query("SELECT COUNT(*) FROM utilisateurs WHERE id_utilisateur LIKE 'usr_legacy_like_%'")->fetchColumn();
    $likesBefore = (int)$pdo->query("SELECT COUNT(*) FROM likes_idee WHERE id_utilisateur LIKE 'usr_legacy_like_%'")->fetchColumn();

    $deleted = (int)$pdo->exec("DELETE FROM utilisateurs WHERE id_utilisateur LIKE 'usr_legacy_like_%'");

    $countAfter = (int)$pdo->query("SELECT COUNT(*) FROM utilisateurs WHERE id_utilisateur LIKE 'usr_legacy_like_%'")->fetchColumn();
    $likesAfter = (int)$pdo->query("SELECT COUNT(*) FROM likes_idee WHERE id_utilisateur LIKE 'usr_legacy_like_%'")->fetchColumn();

    $pdo->commit();

    echo "legacy_like_before={$countBefore}\n";
    echo "legacy_like_deleted={$deleted}\n";
    echo "legacy_like_after={$countAfter}\n";
    echo "legacy_likes_before={$likesBefore}\n";
    echo "legacy_likes_after={$likesAfter}\n";
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    fwrite(STDERR, 'ERR: ' . $e->getMessage() . "\n");
    exit(1);
}
