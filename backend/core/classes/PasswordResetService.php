<?php

declare(strict_types=1);

namespace App\Core;

use App\Core\IdGenerator;
use App\Core\Logger;
use PDO;

class PasswordResetService
{
    private PDO $pdo;

    public function __construct(PDO $pdo)
    {
        $this->pdo = $pdo;
        $this->ensureTable();
    }

    public function ensureTable(): void
    {
        $this->pdo->exec(
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

    public function createToken(string $userId, int $ttlMinutes = 30): array
    {
        $token = IdGenerator::generateToken();
        $tokenHash = IdGenerator::hashToken($token);

        $deleteStmt = $this->pdo->prepare('DELETE FROM password_resets WHERE id_utilisateur = :user_id OR expires_at < NOW()');
        $deleteStmt->execute([':user_id' => $userId]);

        $insertStmt = $this->pdo->prepare(
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
            'link' => $this->buildLink($token),
        ];
    }

    public function consumeToken(string $token): ?string
    {
        $tokenHash = IdGenerator::hashToken($token);

        $this->pdo->beginTransaction();
        try {
            $selectStmt = $this->pdo->prepare(
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
                $this->pdo->rollBack();
                return null;
            }

            $updateStmt = $this->pdo->prepare('UPDATE password_resets SET used_at = NOW() WHERE id_reset = :id_reset AND used_at IS NULL');
            $updateStmt->execute([':id_reset' => $row['id_reset']]);

            if ($updateStmt->rowCount() !== 1) {
                $this->pdo->rollBack();
                return null;
            }

            $this->pdo->commit();
            return (string)$row['id_utilisateur'];
        } catch (\Throwable $e) {
            if ($this->pdo->inTransaction()) {
                $this->pdo->rollBack();
            }
            Logger::error('Password reset token consumption failed: ' . $e->getMessage());
            return null;
        }
    }

    private function buildLink(string $token): string
    {
        $base = trim((string)(getenv('PASSWORD_RESET_URL_BASE') ?: 'http://127.0.0.1:8000/backend/api/auth/reset-password.php'));

        if ($base === '') {
            $base = 'http://127.0.0.1:8000/backend/api/auth/reset-password.php';
        }

        $separator = strpos($base, '?') !== false ? '&' : '?';
        return $base . $separator . 'token=' . urlencode($token);
    }
}
