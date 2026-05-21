<?php

declare(strict_types=1);

namespace App\Core;

use App\Core\IdGenerator;
use App\Core\Logger;
use App\Core\RequestHandler;
use App\Core\ResponseHandler;

class AuthService
{
    public static function requireAuthUser(): array
    {
        $user = $_SESSION['auth_user'] ?? null;
        if (!is_array($user)) {
            ResponseHandler::error('Authentification requise.', [], 401);
        }

        $user = self::refreshAuthUserFromDatabase($user);

        return $user;
    }

    public static function requireAdminUser(): array
    {
        $user = self::requireAuthUser();
        $role = strtolower((string)($user['role'] ?? 'citoyen'));
        if (!in_array($role, ['admin', 'super_admin'], true)) {
            ResponseHandler::error('Acces admin requis.', [], 403);
        }

        return $user;
    }

    public static function requireSuperAdminUser(): array
    {
        $user = self::requireAuthUser();
        if (strtolower((string)($user['role'] ?? 'citoyen')) !== 'super_admin') {
            ResponseHandler::error('Acces super admin requis.', [], 403);
        }

        return $user;
    }

    public static function getAuthUser(): ?array
    {
        return $_SESSION['auth_user'] ?? null;
    }

    public static function setAuthUser(array $user): void
    {
        $_SESSION['auth_user'] = $user;
    }

    public static function logout(): void
    {
        unset($_SESSION['auth_user']);
    }

    public static function clearAuthUser(): void
    {
        self::logout();
    }

    public static function clearAuthUserIfMatches(string $userId): void
    {
        if (!empty($_SESSION['auth_user']) && (string)($_SESSION['auth_user']['id'] ?? '') === $userId) {
            unset($_SESSION['auth_user']);
        }
    }

    public static function hashPassword(string $password): string
    {
        return password_hash($password, PASSWORD_BCRYPT);
    }

    public static function verifyPassword(string $password, string $hash): bool
    {
        if ($hash === '') {
            return false;
        }

        return password_verify($password, $hash);
    }

    private static function refreshAuthUserFromDatabase(array $user): array
    {
        $userId = (string)($user['id'] ?? '');
        if ($userId === '') {
            return $user;
        }

        try {
            $pdo = Database::getInstance();
            $stmt = $pdo->prepare(
                'SELECT id_utilisateur, nom, prenom, surnom, email, role
                 FROM utilisateurs
                 WHERE id_utilisateur = :id
                 LIMIT 1'
            );
            $stmt->execute([':id' => $userId]);
            $freshUser = $stmt->fetch();

            if (!is_array($freshUser)) {
                self::logout();
                ResponseHandler::error('Session invalide. Veuillez vous reconnecter.', [], 401);
            }

            $normalized = [
                'id' => (string)($freshUser['id_utilisateur'] ?? $userId),
                'nom' => (string)($freshUser['nom'] ?? ''),
                'prenom' => (string)($freshUser['prenom'] ?? ''),
                'surnom' => (string)($freshUser['surnom'] ?? ''),
                'email' => (string)($freshUser['email'] ?? ''),
                'role' => (string)($freshUser['role'] ?? 'citoyen'),
            ];

            if (AdminDashboardService::isUserBlocked($pdo, $normalized['id'])) {
                self::logout();
                ResponseHandler::error('Compte bloque. Contactez un administrateur.', [], 403);
            }

            $_SESSION['auth_user'] = $normalized;
            return $normalized;
        } catch (\Throwable $e) {
            // If DB is temporarily unavailable, keep current session payload.
            return $user;
        }
    }
}
