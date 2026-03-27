<?php

declare(strict_types=1);

require_once BACKEND_ROOT . '/core/logger.php';

function ensure_password_resets_table(PDO $pdo): void
{
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS password_resets (
            id_reset BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            id_utilisateur VARCHAR(50) NOT NULL,
            token_hash CHAR(64) NOT NULL,
            expires_at DATETIME NOT NULL,
            used_at DATETIME NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT fk_password_resets_utilisateur
              FOREIGN KEY (id_utilisateur) REFERENCES utilisateurs(id_utilisateur)
              ON UPDATE CASCADE ON DELETE CASCADE,
            UNIQUE KEY uq_password_resets_token_hash (token_hash),
            KEY idx_password_resets_user (id_utilisateur),
            KEY idx_password_resets_expiry (expires_at, used_at)
        ) ENGINE=InnoDB'
    );
}

function build_password_reset_link(string $token): string
{
    $base = trim((string)(getenv('PASSWORD_RESET_URL_BASE') ?: 'http://127.0.0.1:8000/backend/api/auth/reset-password.php'));

    if ($base === '') {
        $base = 'http://127.0.0.1:8000/backend/api/auth/reset-password.php';
    }

    $separator = strpos($base, '?') !== false ? '&' : '?';
    return $base . $separator . 'token=' . urlencode($token);
}

function create_password_reset_token(PDO $pdo, string $userId, int $ttlMinutes = 30): array
{
    $token = bin2hex(random_bytes(32));
    $tokenHash = hash('sha256', $token);

    $deleteStmt = $pdo->prepare('DELETE FROM password_resets WHERE id_utilisateur = :user_id OR expires_at < NOW()');
    $deleteStmt->execute([':user_id' => $userId]);

    $insertStmt = $pdo->prepare(
        'INSERT INTO password_resets (id_utilisateur, token_hash, expires_at, created_at)
         VALUES (:user_id, :token_hash, DATE_ADD(NOW(), INTERVAL :ttl MINUTE), NOW())'
    );
    $insertStmt->bindValue(':user_id', $userId);
    $insertStmt->bindValue(':token_hash', $tokenHash);
    $insertStmt->bindValue(':ttl', $ttlMinutes, PDO::PARAM_INT);
    $insertStmt->execute();

    return [
        'token' => $token,
        'expires_minutes' => $ttlMinutes,
        'link' => build_password_reset_link($token),
    ];
}

function consume_password_reset_token(PDO $pdo, string $token): ?string
{
    $tokenHash = hash('sha256', $token);

    $pdo->beginTransaction();
    try {
        $selectStmt = $pdo->prepare(
            'SELECT id_reset, id_utilisateur
             FROM password_resets
             WHERE token_hash = :token_hash
               AND used_at IS NULL
               AND expires_at >= NOW()
             ORDER BY created_at DESC
             LIMIT 1
             FOR UPDATE'
        );
        $selectStmt->execute([':token_hash' => $tokenHash]);
        $row = $selectStmt->fetch();

        if (!is_array($row) || empty($row['id_reset']) || empty($row['id_utilisateur'])) {
            $pdo->rollBack();
            return null;
        }

        $updateStmt = $pdo->prepare('UPDATE password_resets SET used_at = NOW() WHERE id_reset = :id_reset AND used_at IS NULL');
        $updateStmt->execute([':id_reset' => $row['id_reset']]);

        if ($updateStmt->rowCount() !== 1) {
            $pdo->rollBack();
            return null;
        }

        $pdo->commit();
        return (string)$row['id_utilisateur'];
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        app_log('error', 'Password reset token consume error: ' . $e->getMessage());
        return null;
    }
}
