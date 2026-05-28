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
        if (is_array($user)) {
            return self::refreshAuthUserFromDatabase($user);
        }

        $tokenUser = self::getAuthUserFromToken();
        if (is_array($tokenUser)) {
            return $tokenUser;
        }

        ResponseHandler::error('Authentification requise.', [], 401);
        return [];
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

    public static function getAuthUserFromToken(): ?array
    {
        $payload = self::extractTokenPayload();
        if (!is_array($payload)) {
            return null;
        }

        $user = [
            'id' => (string)($payload['sub'] ?? ''),
            'nom' => (string)($payload['nom'] ?? ''),
            'prenom' => (string)($payload['prenom'] ?? ''),
            'surnom' => (string)($payload['surnom'] ?? ''),
            'email' => (string)($payload['email'] ?? ''),
            'role' => (string)($payload['role'] ?? 'citoyen'),
        ];

        if ($user['id'] === '') {
            return null;
        }

        try {
            return self::refreshAuthUserFromDatabase($user);
        } catch (\Throwable $e) {
            return $user;
        }
    }

    public static function createAccessToken(array $user, int $ttlSeconds = 604800): string
    {
        $payload = [
            'sub' => (string)($user['id'] ?? ''),
            'nom' => (string)($user['nom'] ?? ''),
            'prenom' => (string)($user['prenom'] ?? ''),
            'surnom' => (string)($user['surnom'] ?? ''),
            'email' => (string)($user['email'] ?? ''),
            'role' => (string)($user['role'] ?? 'citoyen'),
            'iat' => time(),
            'exp' => time() + max(300, $ttlSeconds),
        ];

        $encodedPayload = self::base64UrlEncode((string)json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
        $signature = hash_hmac('sha256', $encodedPayload, self::accessTokenSecret());

        return $encodedPayload . '.' . $signature;
    }

    public static function extractAuthToken(): string
    {
        $header = (string)($_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '');
        if ($header !== '' && preg_match('/Bearer\s+(.+)$/i', $header, $matches)) {
            return trim((string)$matches[1]);
        }

        $header = (string)($_SERVER['HTTP_X_AUTH_TOKEN'] ?? '');
        if ($header !== '') {
            return trim($header);
        }

        if (function_exists('getallheaders')) {
            $headers = getallheaders();
            if (is_array($headers)) {
                foreach ($headers as $name => $value) {
                    $normalizedName = strtolower((string)$name);
                    if ($normalizedName === 'authorization' && preg_match('/Bearer\s+(.+)$/i', (string)$value, $matches)) {
                        return trim((string)$matches[1]);
                    }

                    if ($normalizedName === 'x-auth-token') {
                        return trim((string)$value);
                    }
                }
            }
        }

        return '';
    }

    private static function extractTokenPayload(): ?array
    {
        $token = self::extractAuthToken();
        if ($token === '') {
            return null;
        }

        $parts = explode('.', $token, 2);
        if (count($parts) !== 2) {
            return null;
        }

        [$encodedPayload, $signature] = $parts;
        if ($encodedPayload === '' || $signature === '') {
            return null;
        }

        $expectedSignature = hash_hmac('sha256', $encodedPayload, self::accessTokenSecret());
        if (!hash_equals($expectedSignature, $signature)) {
            return null;
        }

        $decodedPayload = self::base64UrlDecode($encodedPayload);
        if ($decodedPayload === '') {
            return null;
        }

        $payload = json_decode($decodedPayload, true);
        if (!is_array($payload)) {
            return null;
        }

        $expiresAt = (int)($payload['exp'] ?? 0);
        if ($expiresAt > 0 && $expiresAt < time()) {
            return null;
        }

        return $payload;
    }

    private static function accessTokenSecret(): string
    {
        $secret = trim((string)(getenv('AUTH_TOKEN_SECRET') ?: ''));
        if ($secret !== '') {
            return $secret;
        }

        $fallbackParts = [
            trim((string)(getenv('APP_KEY') ?: '')),
            trim((string)(getenv('APP_NAME') ?: 'UrbainElikyaDRC')),
            trim((string)(getenv('DB_NAME') ?: '')),
            trim((string)(getenv('DB_HOST') ?: '')),
        ];

        $fallback = implode('|', array_filter($fallbackParts, static fn (string $value): bool => $value !== ''));
        if ($fallback === '') {
            $fallback = 'UrbainElikyaDRC-local-auth';
        }

        return $fallback;
    }

    private static function base64UrlEncode(string $value): string
    {
        return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
    }

    private static function base64UrlDecode(string $value): string
    {
        $remainder = strlen($value) % 4;
        if ($remainder > 0) {
            $value .= str_repeat('=', 4 - $remainder);
        }

        $decoded = base64_decode(strtr($value, '-_', '+/'), true);
        return $decoded === false ? '' : $decoded;
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
