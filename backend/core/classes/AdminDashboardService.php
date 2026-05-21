<?php

declare(strict_types=1);

namespace App\Core;

use PDO;

class AdminDashboardService
{
    private const ADMIN_PERMISSIONS = [
        'manage_signalements',
        'manage_idees',
        'manage_messages',
        'manage_users',
        'manage_stats',
        'manage_map',
        'manage_admins',
    ];

    public static function ensureSchema(PDO $pdo): void
    {
        $pdo->exec(
            'CREATE TABLE IF NOT EXISTS admin_idees_status (
                id_idee VARCHAR(80) NOT NULL PRIMARY KEY,
                status VARCHAR(40) NOT NULL DEFAULT "nouvelle",
                updated_by VARCHAR(80) DEFAULT NULL,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
        );

        $pdo->exec(
            'CREATE TABLE IF NOT EXISTS admin_user_warnings (
                id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
                id_utilisateur VARCHAR(80) NOT NULL,
                warning_note VARCHAR(255) DEFAULT NULL,
                issued_by VARCHAR(80) DEFAULT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_admin_user_warnings_user (id_utilisateur)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
        );

        $pdo->exec(
            'CREATE TABLE IF NOT EXISTS admin_user_blocks (
                id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
                id_utilisateur VARCHAR(80) NOT NULL,
                blocked_until DATETIME DEFAULT NULL,
                reason VARCHAR(255) DEFAULT NULL,
                issued_by VARCHAR(80) DEFAULT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uq_admin_user_blocks_user (id_utilisateur),
                INDEX idx_admin_user_blocks_until (blocked_until)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
        );

        $pdo->exec(
            'CREATE TABLE IF NOT EXISTS admin_permissions (
                id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
                id_utilisateur VARCHAR(80) NOT NULL,
                permission_key VARCHAR(80) NOT NULL,
                allowed TINYINT(1) NOT NULL DEFAULT 0,
                updated_by VARCHAR(80) DEFAULT NULL,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uq_admin_permissions_user_perm (id_utilisateur, permission_key),
                INDEX idx_admin_permissions_user (id_utilisateur),
                INDEX idx_admin_permissions_key (permission_key)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
        );
    }

    public static function fetchDashboardData(PDO $pdo, ?array $currentUser = null): array
    {
        self::ensureSchema($pdo);

        $signalements = self::fetchSignalements($pdo);
        $idees = self::fetchIdees($pdo);
        $messages = self::fetchMessages($pdo);
        $users = self::fetchUsers($pdo);
        $admins = self::fetchAdmins($pdo);

        return [
            'current_user' => self::normalizeAdminUser($currentUser, $pdo),
            'stats' => [
                'users_total' => count($users),
                'blocked_total' => self::countBlockedUsers($pdo),
                'signalements_total' => count($signalements),
                'signalements_en_cours' => self::countByValue($signalements, 'status', 'en_cours'),
                'signalements_resolus' => self::countByValue($signalements, 'status', 'resolu'),
                'idees_total' => count($idees),
                'idees_en_cours' => self::countByValue($idees, 'status', 'en_cours'),
                'idees_realisees' => self::countByValue($idees, 'status', 'realisee'),
                'messages_total' => count($messages),
                'likes_total' => (int)$pdo->query('SELECT COUNT(*) FROM likes_idee')->fetchColumn(),
                'warnings_total' => (int)$pdo->query('SELECT COUNT(*) FROM admin_user_warnings')->fetchColumn(),
            ],
            'signalements' => $signalements,
            'idees' => $idees,
            'messages' => $messages,
            'users' => $users,
            'admins' => $admins,
            'filters' => [
                'signalement_types' => self::uniqueValues($signalements, 'type'),
                'signalement_statuses' => self::uniqueValues($signalements, 'status'),
                'idee_categories' => self::uniqueValues($idees, 'categorie'),
                'idee_statuses' => self::uniqueValues($idees, 'status'),
            ],
            'map_points' => self::mapPoints($signalements),
        ];
    }

    public static function fetchDashboardDataFromFiles(?array $currentUser = null): array
    {
        $signalements = self::readJsonArray('signalements.json');
        $idees = array_map(static function (array $item): array {
            $item['status'] = self::normalizeIdeeStatus((string)($item['status'] ?? 'nouvelle'));
            return $item;
        }, self::readJsonArray('idees.json'));
        $messages = self::readJsonArray('messages.json');
        $users = self::readJsonArray('users.json');
        $admins = array_values(array_filter($users, static function (array $user): bool {
            return in_array(strtolower((string)($user['role'] ?? 'citoyen')), ['admin', 'super_admin'], true);
        }));

        $normalizedCurrentUser = [];
        if (is_array($currentUser) && !empty($currentUser['id'])) {
            $normalizedCurrentUser = [
                'id' => (string)($currentUser['id'] ?? ''),
                'nom' => (string)($currentUser['nom'] ?? ''),
                'prenom' => (string)($currentUser['prenom'] ?? ''),
                'surnom' => (string)($currentUser['surnom'] ?? ''),
                'email' => (string)($currentUser['email'] ?? ''),
                'role' => self::normalizeAdminRole((string)($currentUser['role'] ?? 'admin')),
                'permissions' => self::normalizePermissionsForFallback((string)($currentUser['role'] ?? 'admin')),
            ];
        }

        return [
            'current_user' => $normalizedCurrentUser,
            'stats' => [
                'users_total' => count($users),
                'blocked_total' => 0,
                'signalements_total' => count($signalements),
                'signalements_en_cours' => self::countByValue($signalements, 'status', 'en_cours'),
                'signalements_resolus' => self::countByValue($signalements, 'status', 'resolu'),
                'idees_total' => count($idees),
                'idees_en_cours' => self::countByValue($idees, 'status', 'en_cours'),
                'idees_realisees' => self::countByValue($idees, 'status', 'realisee'),
                'messages_total' => count($messages),
                'likes_total' => array_sum(array_map(static fn (array $item): int => (int)($item['likes'] ?? 0), $idees)),
                'warnings_total' => 0,
            ],
            'signalements' => $signalements,
            'idees' => $idees,
            'messages' => $messages,
            'users' => $users,
            'admins' => $admins,
            'filters' => [
                'signalement_types' => self::uniqueValues($signalements, 'type'),
                'signalement_statuses' => self::uniqueValues($signalements, 'status'),
                'idee_categories' => self::uniqueValues($idees, 'categorie'),
                'idee_statuses' => self::uniqueValues($idees, 'status'),
            ],
            'map_points' => self::mapPoints($signalements),
        ];
    }

    public static function fetchSignalements(PDO $pdo): array
    {
        $stmt = $pdo->query(
            'SELECT s.id_signalement AS id,
                    s.id_utilisateur AS user_id,
                    u.nom AS user_nom_nom,
                    u.prenom AS user_nom_prenom,
                    u.email AS user_email,
                    s.titre,
                    s.type,
                    s.description,
                    s.lieu,
                    CAST(s.latitude AS DOUBLE) AS lat,
                    CAST(s.longitude AS DOUBLE) AS lng,
                    s.photo_path AS photo,
                    COALESCE(s.status, "nouveau") AS status,
                    DATE_FORMAT(s.created_at, "%Y-%m-%dT%H:%i:%sZ") AS timestamp
             FROM signalements s
             LEFT JOIN utilisateurs u ON u.id_utilisateur = s.id_utilisateur
             ORDER BY s.created_at DESC'
        );

        $rows = $stmt->fetchAll();
        foreach ($rows as &$row) {
            $row['user_nom'] = trim((string)($row['user_nom_prenom'] ?? '') . ' ' . (string)($row['user_nom_nom'] ?? ''));
            if ($row['user_nom'] === '') {
                $row['user_nom'] = 'Utilisateur local';
            }
            unset($row['user_nom_nom'], $row['user_nom_prenom']);
        }
        unset($row);

        return $rows;
    }

    public static function fetchIdees(PDO $pdo): array
    {
        $stmt = $pdo->query(
            'SELECT i.id_idee AS id,
                    i.id_utilisateur AS user_id,
                    u.nom AS user_nom_nom,
                    u.prenom AS user_nom_prenom,
                    u.email AS user_email,
                    i.titre,
                    i.categorie,
                    i.description,
                    i.photo_path AS photo,
                      COUNT(li.id_like) AS likes,
                      COALESCE(s.status, "nouvelle") AS status,
                    DATE_FORMAT(i.created_at, "%Y-%m-%dT%H:%i:%sZ") AS timestamp
             FROM idees i
             LEFT JOIN utilisateurs u ON u.id_utilisateur = i.id_utilisateur
             LEFT JOIN likes_idee li ON li.id_idee = i.id_idee
             LEFT JOIN admin_idees_status s ON s.id_idee = i.id_idee
             GROUP BY i.id_idee, i.id_utilisateur, u.nom, u.prenom, u.email, i.titre, i.categorie, i.description, i.photo_path, i.created_at, s.status
             ORDER BY i.created_at DESC'
        );

        $rows = $stmt->fetchAll();
        foreach ($rows as &$row) {
            $row['likes'] = (int)($row['likes'] ?? 0);
            $row['user_nom'] = trim((string)($row['user_nom_prenom'] ?? '') . ' ' . (string)($row['user_nom_nom'] ?? ''));
            if ($row['user_nom'] === '') {
                $row['user_nom'] = 'Utilisateur local';
            }
            unset($row['user_nom_nom'], $row['user_nom_prenom']);
        }
        unset($row);

        return $rows;
    }

    public static function fetchMessages(PDO $pdo): array
    {
        $stmt = $pdo->query(
            'SELECT id_message AS id,
                    nom,
                    email,
                    sujet,
                    message,
                    DATE_FORMAT(created_at, "%Y-%m-%dT%H:%i:%sZ") AS timestamp
             FROM messages_contact
             ORDER BY created_at DESC'
        );

        return $stmt->fetchAll();
    }

    public static function fetchUsers(PDO $pdo): array
    {
        $stmt = $pdo->query(
            'SELECT u.id_utilisateur AS id,
                    u.nom,
                    u.prenom,
                    u.surnom,
                    u.email,
                    u.role,
                    DATE_FORMAT(u.created_at, "%Y-%m-%dT%H:%i:%sZ") AS timestamp,
                    COALESCE(w.warning_count, 0) AS warnings,
                    CASE
                        WHEN b.id_utilisateur IS NOT NULL
                         AND (b.blocked_until IS NULL OR b.blocked_until > NOW())
                        THEN 1 ELSE 0
                    END AS is_blocked,
                    DATE_FORMAT(b.blocked_until, "%Y-%m-%dT%H:%i:%sZ") AS blocked_until,
                    b.reason AS block_reason
             FROM utilisateurs u
             LEFT JOIN (
                 SELECT id_utilisateur, COUNT(*) AS warning_count
                 FROM admin_user_warnings
                 GROUP BY id_utilisateur
             ) w ON w.id_utilisateur = u.id_utilisateur
             LEFT JOIN admin_user_blocks b ON b.id_utilisateur = u.id_utilisateur
             ORDER BY warnings DESC, u.created_at DESC'
        );

        $rows = $stmt->fetchAll();
        foreach ($rows as &$row) {
            $row['warnings'] = (int)($row['warnings'] ?? 0);
        }
        unset($row);

        return $rows;
    }

    public static function setSignalementStatus(PDO $pdo, string $id, string $status): void
    {
        $stmt = $pdo->prepare('UPDATE signalements SET status = :status WHERE id_signalement = :id LIMIT 1');
        $stmt->execute([
            ':status' => self::normalizeSignalementStatus($status),
            ':id' => $id,
        ]);
    }

    public static function deleteSignalement(PDO $pdo, string $id): void
    {
        $stmt = $pdo->prepare('DELETE FROM signalements WHERE id_signalement = :id LIMIT 1');
        $stmt->execute([':id' => $id]);
    }

    public static function setIdeeStatus(PDO $pdo, string $id, string $status, string $adminId): void
    {
        self::ensureIdeeStatusColumn($pdo);

        $stmt = $pdo->prepare(
            'INSERT INTO admin_idees_status (id_idee, status, updated_by, updated_at)
             VALUES (:id, :status, :updated_by, NOW())
             ON DUPLICATE KEY UPDATE status = VALUES(status), updated_by = VALUES(updated_by), updated_at = NOW()'
        );
        $stmt->execute([
            ':id' => $id,
            ':status' => self::normalizeIdeeStatus($status),
            ':updated_by' => $adminId,
        ]);

        try {
            $legacyStmt = $pdo->prepare('UPDATE idees SET status = :status WHERE id_idee = :id LIMIT 1');
            $legacyStmt->execute([
                ':status' => self::normalizeIdeeStatus($status),
                ':id' => $id,
            ]);
        } catch (\Throwable $e) {
            // ignore when legacy column does not exist
        }

        self::updateIdeeStatusInJson($id, $status);
    }

    public static function deleteIdee(PDO $pdo, string $id): void
    {
        $deleteLikes = $pdo->prepare('DELETE FROM likes_idee WHERE id_idee = :id');
        $deleteLikes->execute([':id' => $id]);

        $deleteStatus = $pdo->prepare('DELETE FROM admin_idees_status WHERE id_idee = :id');
        $deleteStatus->execute([':id' => $id]);

        $deleteIdee = $pdo->prepare('DELETE FROM idees WHERE id_idee = :id LIMIT 1');
        $deleteIdee->execute([':id' => $id]);
    }

    public static function updateIdeeStatusInJson(string $id, string $status): bool
    {
        $path = BACKEND_ROOT . DIRECTORY_SEPARATOR . 'data' . DIRECTORY_SEPARATOR . 'idees.json';
        if (!is_file($path)) {
            return false;
        }

        $content = file_get_contents($path);
        if ($content === false || trim($content) === '') {
            return false;
        }

        $items = json_decode($content, true);
        if (!is_array($items)) {
            return false;
        }

        $updated = false;
        foreach ($items as &$item) {
            if (!is_array($item)) {
                continue;
            }
            if ((string)($item['id'] ?? '') !== $id) {
                continue;
            }

            $item['status'] = self::normalizeIdeeStatus($status);
            $updated = true;
            break;
        }
        unset($item);

        if (!$updated) {
            return false;
        }

        $encoded = json_encode($items, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($encoded === false) {
            return false;
        }

        return file_put_contents($path, $encoded . PHP_EOL, LOCK_EX) !== false;
    }

    public static function deleteMessage(PDO $pdo, string $id): void
    {
        $stmt = $pdo->prepare('DELETE FROM messages_contact WHERE id_message = :id LIMIT 1');
        $stmt->execute([':id' => $id]);
    }

    public static function addUserWarning(PDO $pdo, string $userId, string $note, string $adminId): int
    {
        $stmt = $pdo->prepare(
            'INSERT INTO admin_user_warnings (id_utilisateur, warning_note, issued_by, created_at)
             VALUES (:id_utilisateur, :warning_note, :issued_by, NOW())'
        );
        $stmt->execute([
            ':id_utilisateur' => $userId,
            ':warning_note' => $note !== '' ? $note : null,
            ':issued_by' => $adminId,
        ]);

        $warningsCount = self::getUserWarningCount($pdo, $userId);

        self::sendUserEmail($pdo, $userId, 'Avertissement UrbainElikyaDRC', self::buildWarningEmailBody($pdo, $userId, $note, $warningsCount));

        if ($warningsCount >= 3) {
            self::setUserBlock($pdo, $userId, null, 'Blocage automatique apres 3 avertissements.', $adminId);
        }

        return $warningsCount;
    }

    public static function getUserWarningCount(PDO $pdo, string $userId): int
    {
        $stmt = $pdo->prepare('SELECT COUNT(*) FROM admin_user_warnings WHERE id_utilisateur = :id');
        $stmt->execute([':id' => $userId]);

        return (int)$stmt->fetchColumn();
    }

    public static function deleteUser(PDO $pdo, string $userId): void
    {
        $deleteWarnings = $pdo->prepare('DELETE FROM admin_user_warnings WHERE id_utilisateur = :id');
        $deleteWarnings->execute([':id' => $userId]);

        $deleteBlocks = $pdo->prepare('DELETE FROM admin_user_blocks WHERE id_utilisateur = :id');
        $deleteBlocks->execute([':id' => $userId]);

        $deletePermissions = $pdo->prepare('DELETE FROM admin_permissions WHERE id_utilisateur = :id');
        $deletePermissions->execute([':id' => $userId]);

        $deleteLikes = $pdo->prepare('DELETE FROM likes_idee WHERE id_utilisateur = :id');
        $deleteLikes->execute([':id' => $userId]);

        $deleteUser = $pdo->prepare('DELETE FROM utilisateurs WHERE id_utilisateur = :id LIMIT 1');
        $deleteUser->execute([':id' => $userId]);
    }

    public static function setUserBlock(PDO $pdo, string $userId, ?string $blockedUntil, string $reason, string $adminId): array
    {
        $stmt = $pdo->prepare(
            'INSERT INTO admin_user_blocks (id_utilisateur, blocked_until, reason, issued_by, created_at, updated_at)
             VALUES (:id_utilisateur, :blocked_until, :reason, :issued_by, NOW(), NOW())
             ON DUPLICATE KEY UPDATE blocked_until = VALUES(blocked_until), reason = VALUES(reason), issued_by = VALUES(issued_by), updated_at = NOW()'
        );
        $stmt->execute([
            ':id_utilisateur' => $userId,
            ':blocked_until' => $blockedUntil,
            ':reason' => $reason !== '' ? $reason : null,
            ':issued_by' => $adminId,
        ]);

        $block = self::fetchUserBlock($pdo, $userId) ?? [
            'id_utilisateur' => $userId,
            'blocked_until' => $blockedUntil,
            'reason' => $reason,
        ];

        self::sendUserEmail(
            $pdo,
            $userId,
            'Compte bloque UrbainElikyaDRC',
            self::buildBlockEmailBody($pdo, $userId, $reason, $blockedUntil)
        );

        return $block;
    }

    public static function clearUserBlock(PDO $pdo, string $userId): void
    {
        $stmt = $pdo->prepare('DELETE FROM admin_user_blocks WHERE id_utilisateur = :id');
        $stmt->execute([':id' => $userId]);

        self::sendUserEmail(
            $pdo,
            $userId,
            'Compte debloque UrbainElikyaDRC',
            self::buildUnblockEmailBody($pdo, $userId)
        );
    }

    public static function fetchUserBlock(PDO $pdo, string $userId): ?array
    {
        $stmt = $pdo->prepare(
            'SELECT id_utilisateur, DATE_FORMAT(blocked_until, "%Y-%m-%dT%H:%i:%sZ") AS blocked_until, reason, issued_by, DATE_FORMAT(created_at, "%Y-%m-%dT%H:%i:%sZ") AS created_at, DATE_FORMAT(updated_at, "%Y-%m-%dT%H:%i:%sZ") AS updated_at
             FROM admin_user_blocks
             WHERE id_utilisateur = :id
             LIMIT 1'
        );
        $stmt->execute([':id' => $userId]);
        $row = $stmt->fetch();

        if (!is_array($row)) {
            return null;
        }

        return $row;
    }

    public static function isUserBlocked(PDO $pdo, string $userId): bool
    {
        $block = self::fetchUserBlock($pdo, $userId);
        if (!is_array($block)) {
            return false;
        }

        $blockedUntil = (string)($block['blocked_until'] ?? '');
        if ($blockedUntil === '') {
            return true;
        }

        return strtotime($blockedUntil) > time();
    }

    public static function fetchAdmins(PDO $pdo): array
    {
        $stmt = $pdo->query(
            'SELECT u.id_utilisateur AS id,
                    u.nom,
                    u.prenom,
                    u.surnom,
                    u.email,
                    u.role,
                    DATE_FORMAT(u.created_at, "%Y-%m-%dT%H:%i:%sZ") AS timestamp
             FROM utilisateurs u
             WHERE LOWER(u.role) IN ("admin", "super_admin")
             ORDER BY FIELD(LOWER(u.role), "super_admin", "admin"), u.created_at DESC'
        );

        $rows = $stmt->fetchAll();
        foreach ($rows as &$row) {
            $row['permissions'] = self::fetchAdminPermissions($pdo, (string)($row['id'] ?? ''));
        }
        unset($row);

        return $rows;
    }

    public static function createOrPromoteAdmin(PDO $pdo, array $payload, string $adminId): array
    {
        $email = strtolower(trim((string)($payload['email'] ?? '')));
        $nom = trim((string)($payload['nom'] ?? ''));
        $prenom = trim((string)($payload['prenom'] ?? ''));
        $surnom = trim((string)($payload['surnom'] ?? ''));
        $password = (string)($payload['password'] ?? '');
        $role = self::normalizeAdminRole((string)($payload['role'] ?? 'admin'));

        if ($email === '' || $nom === '' || $prenom === '') {
            throw new \InvalidArgumentException('Nom, prenom et email sont requis pour creer un admin.');
        }

        $existingStmt = $pdo->prepare('SELECT id_utilisateur, role FROM utilisateurs WHERE email = :email LIMIT 1');
        $existingStmt->execute([':email' => $email]);
        $existingUser = $existingStmt->fetch();

        if (is_array($existingUser) && !empty($existingUser['id_utilisateur'])) {
            $updates = ['nom = :nom', 'prenom = :prenom', 'surnom = :surnom', 'role = :role'];
            $params = [
                ':nom' => $nom,
                ':prenom' => $prenom,
                ':surnom' => $surnom !== '' ? $surnom : null,
                ':role' => $role,
                ':id' => (string)$existingUser['id_utilisateur'],
            ];

            if ($password !== '') {
                $updates[] = 'mot_de_passe_hash = :password_hash';
                $params[':password_hash'] = AuthService::hashPassword($password);
            }

            $stmt = $pdo->prepare(
                'UPDATE utilisateurs SET ' . implode(', ', $updates) . ' WHERE id_utilisateur = :id LIMIT 1'
            );
            $stmt->execute($params);

            self::replaceAdminPermissions($pdo, (string)$existingUser['id_utilisateur'], $payload['permissions'] ?? [], $adminId, $role);

            return self::fetchAdminById($pdo, (string)$existingUser['id_utilisateur']);
        }

        if ($password === '') {
            throw new \InvalidArgumentException('Le mot de passe est requis pour un nouvel administrateur.');
        }

        $userId = IdGenerator::generate('usr');
        $stmt = $pdo->prepare(
            'INSERT INTO utilisateurs (id_utilisateur, nom, prenom, surnom, email, mot_de_passe_hash, role, created_at)
             VALUES (:id, :nom, :prenom, :surnom, :email, :password_hash, :role, NOW())'
        );
        $stmt->execute([
            ':id' => $userId,
            ':nom' => $nom,
            ':prenom' => $prenom,
            ':surnom' => $surnom !== '' ? $surnom : null,
            ':email' => $email,
            ':password_hash' => AuthService::hashPassword($password),
            ':role' => $role,
        ]);

        self::replaceAdminPermissions($pdo, $userId, $payload['permissions'] ?? [], $adminId, $role);

        return self::fetchAdminById($pdo, $userId);
    }

    public static function setAdminPermission(PDO $pdo, string $userId, string $permissionKey, bool $allowed, string $updatedBy): void
    {
        $permissionKey = self::normalizePermissionKey($permissionKey);
        $stmt = $pdo->prepare(
            'INSERT INTO admin_permissions (id_utilisateur, permission_key, allowed, updated_by, updated_at)
             VALUES (:id_utilisateur, :permission_key, :allowed, :updated_by, NOW())
             ON DUPLICATE KEY UPDATE allowed = VALUES(allowed), updated_by = VALUES(updated_by), updated_at = NOW()'
        );
        $stmt->execute([
            ':id_utilisateur' => $userId,
            ':permission_key' => $permissionKey,
            ':allowed' => $allowed ? 1 : 0,
            ':updated_by' => $updatedBy,
        ]);
    }

    public static function fetchAdminPermissions(PDO $pdo, string $userId): array
    {
        $stmt = $pdo->prepare('SELECT permission_key, allowed FROM admin_permissions WHERE id_utilisateur = :id');
        $stmt->execute([':id' => $userId]);

        $permissions = array_fill_keys(self::ADMIN_PERMISSIONS, false);
        foreach ($stmt->fetchAll() as $row) {
            $permissionKey = (string)($row['permission_key'] ?? '');
            if (!array_key_exists($permissionKey, $permissions)) {
                continue;
            }

            $permissions[$permissionKey] = ((int)($row['allowed'] ?? 0)) === 1;
        }

        if ($permissions['manage_admins'] === false) {
            $roleStmt = $pdo->prepare('SELECT LOWER(role) AS role FROM utilisateurs WHERE id_utilisateur = :id LIMIT 1');
            $roleStmt->execute([':id' => $userId]);
            $role = strtolower((string)($roleStmt->fetchColumn() ?: ''));
            if ($role === 'super_admin') {
                $permissions['manage_admins'] = true;
            }
        }

        return $permissions;
    }

    public static function fetchAdminById(PDO $pdo, string $userId): array
    {
        $stmt = $pdo->prepare(
            'SELECT id_utilisateur AS id, nom, prenom, surnom, email, role, DATE_FORMAT(created_at, "%Y-%m-%dT%H:%i:%sZ") AS timestamp
             FROM utilisateurs
             WHERE id_utilisateur = :id
             LIMIT 1'
        );
        $stmt->execute([':id' => $userId]);
        $row = $stmt->fetch();

        if (!is_array($row)) {
            throw new \RuntimeException('Administrateur introuvable.');
        }

        $row['permissions'] = self::fetchAdminPermissions($pdo, $userId);
        return $row;
    }

    public static function normalizeAdminUser(?array $user, PDO $pdo): array
    {
        if (!is_array($user) || empty($user['id'])) {
            return [];
        }

        $normalized = $user;
        $normalized['role'] = self::normalizeAdminRole((string)($normalized['role'] ?? 'citoyen'));
        $normalized['permissions'] = self::fetchAdminPermissions($pdo, (string)$normalized['id']);

        return $normalized;
    }

    private static function replaceAdminPermissions(PDO $pdo, string $userId, array $permissions, string $adminId, string $role): void
    {
        $delete = $pdo->prepare('DELETE FROM admin_permissions WHERE id_utilisateur = :id');
        $delete->execute([':id' => $userId]);

        $normalizedPermissions = self::normalizePermissionMap($permissions, $role);
        foreach ($normalizedPermissions as $permissionKey => $allowed) {
            self::setAdminPermission($pdo, $userId, $permissionKey, (bool)$allowed, $adminId);
        }
    }

    private static function normalizePermissionMap(array $permissions, string $role): array
    {
        $defaults = array_fill_keys(self::ADMIN_PERMISSIONS, false);
        $role = self::normalizeAdminRole($role);

        if ($role === 'super_admin') {
            foreach ($defaults as $key => $value) {
                $defaults[$key] = true;
            }
            return $defaults;
        }

        $defaults['manage_signalements'] = true;
        $defaults['manage_idees'] = true;
        $defaults['manage_messages'] = true;
        $defaults['manage_users'] = true;
        $defaults['manage_stats'] = true;
        $defaults['manage_map'] = true;

        foreach ($permissions as $key => $value) {
            $normalizedKey = self::normalizePermissionKey((string)$key);
            if (array_key_exists($normalizedKey, $defaults)) {
                $defaults[$normalizedKey] = filter_var($value, FILTER_VALIDATE_BOOL);
            }
        }

        return $defaults;
    }

    private static function normalizePermissionKey(string $permissionKey): string
    {
        $permissionKey = strtolower(trim($permissionKey));
        if (!in_array($permissionKey, self::ADMIN_PERMISSIONS, true)) {
            throw new \InvalidArgumentException('Permission admin inconnue.');
        }

        return $permissionKey;
    }

    private static function countBlockedUsers(PDO $pdo): int
    {
        $stmt = $pdo->query(
            'SELECT COUNT(*)
             FROM admin_user_blocks b
             WHERE b.blocked_until IS NULL OR b.blocked_until > NOW()'
        );

        return (int)$stmt->fetchColumn();
    }

    private static function sendUserEmail(PDO $pdo, string $userId, string $subject, string $body): void
    {
        $user = self::fetchUserContact($pdo, $userId);
        if (!is_array($user)) {
            return;
        }

        $email = Validator::sanitizeEmail((string)($user['email'] ?? ''));
        if ($email === '') {
            return;
        }

        try {
            $mailer = new MailerService();
            $mailer->send($email, $subject, $body);
        } catch (\Throwable $e) {
            Logger::warning('Impossible d envoyer un email utilisateur: ' . $e->getMessage());
        }
    }

    private static function fetchUserContact(PDO $pdo, string $userId): ?array
    {
        $stmt = $pdo->prepare(
            'SELECT id_utilisateur AS id, nom, prenom, surnom, email, role
             FROM utilisateurs
             WHERE id_utilisateur = :id
             LIMIT 1'
        );
        $stmt->execute([':id' => $userId]);
        $row = $stmt->fetch();

        return is_array($row) ? $row : null;
    }

    private static function buildWarningEmailBody(PDO $pdo, string $userId, string $note, int $warningsCount): string
    {
        $user = self::fetchUserContact($pdo, $userId) ?: [];
        $displayName = trim((string)($user['prenom'] ?? '') . ' ' . (string)($user['nom'] ?? ''));
        $reason = $note !== '' ? $note : 'Aucun motif specifique.';

        $body = 'Bonjour ' . ($displayName !== '' ? $displayName : 'utilisateur') . ",\n\n";
        $body .= 'Un avertissement a ete ajoute a votre compte UrbainElikyaDRC.' . "\n";
        $body .= 'Motif: ' . $reason . "\n";
        $body .= 'Nombre total avertissements: ' . $warningsCount . "\n\n";

        if ($warningsCount >= 3) {
            $body .= 'Votre compte a ete bloque automatiquement apres 3 avertissements.' . "\n";
            $body .= 'Un administrateur pourra le debloquer ou definir un delai de debloquage.' . "\n\n";
        }

        $body .= 'Equipe UrbainElikyaDRC';
        return $body;
    }

    private static function buildBlockEmailBody(PDO $pdo, string $userId, string $reason, ?string $blockedUntil): string
    {
        $user = self::fetchUserContact($pdo, $userId) ?: [];
        $displayName = trim((string)($user['prenom'] ?? '') . ' ' . (string)($user['nom'] ?? ''));

        $body = 'Bonjour ' . ($displayName !== '' ? $displayName : 'utilisateur') . ",\n\n";
        $body .= 'Votre compte UrbainElikyaDRC a ete bloque.' . "\n";
        $body .= 'Motif: ' . ($reason !== '' ? $reason : 'Non precise') . "\n";
        if ($blockedUntil !== null && $blockedUntil !== '') {
            $body .= 'Deblocage prevu le: ' . $blockedUntil . "\n";
        } else {
            $body .= 'Le blocage est actif jusqu a nouvel ordre.' . "\n";
        }
        $body .= "\nEquipe UrbainElikyaDRC";

        return $body;
    }

    private static function buildUnblockEmailBody(PDO $pdo, string $userId): string
    {
        $user = self::fetchUserContact($pdo, $userId) ?: [];
        $displayName = trim((string)($user['prenom'] ?? '') . ' ' . (string)($user['nom'] ?? ''));

        $body = 'Bonjour ' . ($displayName !== '' ? $displayName : 'utilisateur') . ",\n\n";
        $body .= 'Votre compte UrbainElikyaDRC a ete debloque.' . "\n\n";
        $body .= 'Equipe UrbainElikyaDRC';

        return $body;
    }

    private static function normalizeAdminRole(string $role): string
    {
        $role = strtolower(trim($role));
        if ($role === 'super_admin') {
            return 'super_admin';
        }

        return 'admin';
    }

    private static function normalizeSignalementStatus(string $status): string
    {
        $status = strtolower(trim($status));
        $allowed = ['nouveau', 'en_cours', 'resolu'];

        if (!in_array($status, $allowed, true)) {
            return 'nouveau';
        }

        return $status;
    }

    private static function normalizeIdeeStatus(string $status): string
    {
        $status = strtolower(trim($status));
        $status = str_replace(['réalisée', 'realisée', 'realise', 'realiser', 'realisee', 'réalisee'], ['realisee', 'realisee', 'realisee', 'realisee', 'realisee', 'realisee'], $status);
        $allowed = ['nouvelle', 'en_cours', 'realisee'];

        if (!in_array($status, $allowed, true)) {
            return 'nouvelle';
        }

        return $status;
    }

    private static function normalizePermissionsForFallback(string $role): array
    {
        $permissions = array_fill_keys(self::ADMIN_PERMISSIONS, false);
        $role = self::normalizeAdminRole($role);

        if ($role === 'super_admin') {
            foreach ($permissions as $key => $value) {
                $permissions[$key] = true;
            }
        }

        return $permissions;
    }

    private static function readJsonArray(string $filename): array
    {
        $path = BACKEND_ROOT . DIRECTORY_SEPARATOR . 'data' . DIRECTORY_SEPARATOR . $filename;
        if (!is_file($path)) {
            return [];
        }

        $content = file_get_contents($path);
        if ($content === false || trim($content) === '') {
            return [];
        }

        $decoded = json_decode($content, true);
        return is_array($decoded) ? $decoded : [];
    }

    private static function ensureIdeeStatusColumn(PDO $pdo): void
    {
        try {
            $pdo->exec('ALTER TABLE idees ADD COLUMN status VARCHAR(40) NOT NULL DEFAULT "nouvelle"');
        } catch (\Throwable $e) {
            // Column already exists or table is managed differently; ignore.
        }
    }

    private static function uniqueValues(array $rows, string $field): array
    {
        $values = [];
        foreach ($rows as $row) {
            $value = strtolower(trim((string)($row[$field] ?? '')));
            if ($value !== '') {
                $values[$value] = $value;
            }
        }

        return array_values($values);
    }

    private static function countByValue(array $rows, string $field, string $expected): int
    {
        $count = 0;
        foreach ($rows as $row) {
            if (strtolower(trim((string)($row[$field] ?? ''))) === $expected) {
                $count++;
            }
        }

        return $count;
    }

    private static function mapPoints(array $signalements): array
    {
        $points = [];
        foreach ($signalements as $row) {
            $lat = isset($row['lat']) ? (float)$row['lat'] : null;
            $lng = isset($row['lng']) ? (float)$row['lng'] : null;

            if ($lat === null || $lng === null) {
                continue;
            }

            $points[] = [
                'id' => $row['id'],
                'titre' => $row['titre'] ?? '',
                'type' => $row['type'] ?? '',
                'status' => $row['status'] ?? 'nouveau',
                'lat' => $lat,
                'lng' => $lng,
                'lieu' => $row['lieu'] ?? '',
                'user_nom' => $row['user_nom'] ?? 'Utilisateur local',
                'timestamp' => $row['timestamp'] ?? '',
                'description' => $row['description'] ?? '',
                'photo' => $row['photo'] ?? '',
            ];
        }

        return $points;
    }
}