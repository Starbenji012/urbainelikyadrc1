<?php

declare(strict_types=1);

// Migration CLI: messages/signalements/idees JSON -> MySQL

$root = dirname(__DIR__);
require_once $root . '/core/db.php';

function read_json_rows(string $path): array
{
    if (!is_file($path)) {
        return [];
    }
    $raw = file_get_contents($path);
    if ($raw === false) {
        return [];
    }
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function to_datetime(string $value): string
{
    $ts = strtotime($value);
    return $ts !== false ? date('Y-m-d H:i:s', $ts) : gmdate('Y-m-d H:i:s');
}

function normalize_signalement_type(string $type): string
{
    $t = strtolower(trim($type));
    $allowed = ['voirie', 'eau', 'electricite', 'insecurite', 'dechet'];
    return in_array($t, $allowed, true) ? $t : 'voirie';
}

function normalize_idee_categorie(string $categorie): string
{
    $c = strtolower(trim($categorie));
    $allowed = ['infrastructure', 'environnement', 'services-publics', 'transport', 'autre'];
    return in_array($c, $allowed, true) ? $c : 'autre';
}

function ensure_legacy_user(PDO $pdo): string
{
    $id = 'usr_legacy_local';
    $email = 'legacy.local@local.invalid';

    $check = $pdo->prepare('SELECT id_utilisateur FROM utilisateurs WHERE id_utilisateur = :id OR email = :email LIMIT 1');
    $check->execute([':id' => $id, ':email' => $email]);
    $row = $check->fetch(PDO::FETCH_ASSOC);
    if (is_array($row) && !empty($row['id_utilisateur'])) {
        return (string)$row['id_utilisateur'];
    }

    $insert = $pdo->prepare(
        'INSERT INTO utilisateurs (id_utilisateur, nom, prenom, surnom, email, mot_de_passe_hash, role, created_at)
         VALUES (:id, :nom, :prenom, :surnom, :email, :hash, :role, NOW())'
    );
    $insert->execute([
        ':id' => $id,
        ':nom' => 'Utilisateur',
        ':prenom' => 'Local',
        ':surnom' => null,
        ':email' => $email,
        ':hash' => password_hash(bin2hex(random_bytes(16)), PASSWORD_DEFAULT),
        ':role' => 'citoyen',
    ]);

    return $id;
}

function resolve_user_id(PDO $pdo, array $row, string $legacyUserId): string
{
    $userId = trim((string)($row['user_id'] ?? ''));
    if ($userId !== '') {
        $byId = $pdo->prepare('SELECT id_utilisateur FROM utilisateurs WHERE id_utilisateur = :id LIMIT 1');
        $byId->execute([':id' => $userId]);
        $u = $byId->fetch(PDO::FETCH_ASSOC);
        if (is_array($u)) {
            return $userId;
        }
    }

    $email = strtolower(trim((string)($row['user_email'] ?? '')));
    if ($email !== '') {
        $byEmail = $pdo->prepare('SELECT id_utilisateur FROM utilisateurs WHERE email = :email LIMIT 1');
        $byEmail->execute([':email' => $email]);
        $u = $byEmail->fetch(PDO::FETCH_ASSOC);
        if (is_array($u) && !empty($u['id_utilisateur'])) {
            return (string)$u['id_utilisateur'];
        }
    }

    return $legacyUserId;
}

function ensure_like_users(PDO $pdo, int $count): array
{
    $ids = [];
    if ($count <= 0) {
        return $ids;
    }

    for ($i = 1; $i <= $count; $i++) {
        $id = 'usr_legacy_like_' . $i;
        $email = 'legacy.like.' . $i . '@local.invalid';

        $check = $pdo->prepare('SELECT id_utilisateur FROM utilisateurs WHERE id_utilisateur = :id OR email = :email LIMIT 1');
        $check->execute([':id' => $id, ':email' => $email]);
        $row = $check->fetch(PDO::FETCH_ASSOC);

        if (!is_array($row)) {
            $insert = $pdo->prepare(
                'INSERT INTO utilisateurs (id_utilisateur, nom, prenom, surnom, email, mot_de_passe_hash, role, created_at)
                 VALUES (:id, :nom, :prenom, :surnom, :email, :hash, :role, NOW())'
            );
            $insert->execute([
                ':id' => $id,
                ':nom' => 'Legacy',
                ':prenom' => 'Like ' . $i,
                ':surnom' => null,
                ':email' => $email,
                ':hash' => password_hash(bin2hex(random_bytes(16)), PASSWORD_DEFAULT),
                ':role' => 'citoyen',
            ]);
        }

        $ids[] = $id;
    }

    return $ids;
}

$messagesPath = $root . '/data/messages.json';
$signalementsPath = $root . '/data/signalements.json';
$ideesPath = $root . '/data/idees.json';

$messages = read_json_rows($messagesPath);
$signalements = read_json_rows($signalementsPath);
$idees = read_json_rows($ideesPath);

try {
    $pdo = db_get_pdo();
    $pdo->beginTransaction();

    $legacyUserId = ensure_legacy_user($pdo);

    $stats = [
        'messages_inserted' => 0,
        'messages_skipped' => 0,
        'signalements_inserted' => 0,
        'signalements_skipped' => 0,
        'idees_inserted' => 0,
        'idees_skipped' => 0,
        'likes_inserted' => 0,
        'likes_skipped' => 0,
    ];

    $msgExists = $pdo->prepare('SELECT id_message FROM messages_contact WHERE id_message = :id LIMIT 1');
    $msgInsert = $pdo->prepare(
        'INSERT INTO messages_contact (id_message, nom, email, sujet, message, created_at)
         VALUES (:id, :nom, :email, :sujet, :message, :created_at)'
    );

    foreach ($messages as $row) {
        if (!is_array($row)) {
            $stats['messages_skipped']++;
            continue;
        }

        $id = trim((string)($row['id'] ?? ''));
        $nom = trim((string)($row['nom'] ?? ''));
        $email = strtolower(trim((string)($row['email'] ?? '')));
        $sujet = trim((string)($row['sujet'] ?? ''));
        $message = trim((string)($row['message'] ?? ''));
        $createdAt = to_datetime((string)($row['timestamp'] ?? ''));

        if ($id === '' || $nom === '' || $email === '' || $sujet === '' || $message === '') {
            $stats['messages_skipped']++;
            continue;
        }

        $msgExists->execute([':id' => $id]);
        if ($msgExists->fetch()) {
            $stats['messages_skipped']++;
            continue;
        }

        $msgInsert->execute([
            ':id' => $id,
            ':nom' => $nom,
            ':email' => $email,
            ':sujet' => $sujet,
            ':message' => $message,
            ':created_at' => $createdAt,
        ]);
        $stats['messages_inserted']++;
    }

    $sigExists = $pdo->prepare('SELECT id_signalement FROM signalements WHERE id_signalement = :id LIMIT 1');
    $sigInsert = $pdo->prepare(
        'INSERT INTO signalements (
            id_signalement, id_utilisateur, titre, type, description, lieu,
            latitude, longitude, photo_path, status, created_at
        ) VALUES (
            :id, :user_id, :titre, :type, :description, :lieu,
            :lat, :lng, :photo, :status, :created_at
        )'
    );

    foreach ($signalements as $row) {
        if (!is_array($row)) {
            $stats['signalements_skipped']++;
            continue;
        }

        $id = trim((string)($row['id'] ?? ''));
        $titre = trim((string)($row['titre'] ?? ''));
        $description = trim((string)($row['description'] ?? ''));
        $lieu = trim((string)($row['lieu'] ?? ''));
        $type = normalize_signalement_type((string)($row['type'] ?? ''));
        $status = trim((string)($row['status'] ?? 'nouveau'));
        if ($status === '') {
            $status = 'nouveau';
        }

        $latRaw = $row['lat'] ?? null;
        $lngRaw = $row['lng'] ?? null;
        $lat = is_numeric($latRaw) ? (float)$latRaw : null;
        $lng = is_numeric($lngRaw) ? (float)$lngRaw : null;
        $photo = trim((string)($row['photo'] ?? ''));
        $createdAt = to_datetime((string)($row['timestamp'] ?? ''));

        if ($id === '' || $titre === '' || $description === '' || $lieu === '' || $lat === null || $lng === null) {
            $stats['signalements_skipped']++;
            continue;
        }

        $sigExists->execute([':id' => $id]);
        if ($sigExists->fetch()) {
            $stats['signalements_skipped']++;
            continue;
        }

        $resolvedUserId = resolve_user_id($pdo, $row, $legacyUserId);

        $sigInsert->execute([
            ':id' => $id,
            ':user_id' => $resolvedUserId,
            ':titre' => $titre,
            ':type' => $type,
            ':description' => $description,
            ':lieu' => $lieu,
            ':lat' => $lat,
            ':lng' => $lng,
            ':photo' => $photo !== '' ? $photo : null,
            ':status' => $status,
            ':created_at' => $createdAt,
        ]);
        $stats['signalements_inserted']++;
    }

    $ideaExists = $pdo->prepare('SELECT id_idee FROM idees WHERE id_idee = :id LIMIT 1');
    $ideaInsert = $pdo->prepare(
        'INSERT INTO idees (id_idee, id_utilisateur, titre, categorie, description, photo_path, created_at)
         VALUES (:id, :user_id, :titre, :categorie, :description, :photo, :created_at)'
    );

    $maxLikes = 0;
    foreach ($idees as $row) {
        if (is_array($row)) {
            $maxLikes = max($maxLikes, (int)($row['likes'] ?? 0));
        }
    }
    $likeUsers = ensure_like_users($pdo, $maxLikes);

    $likeExists = $pdo->prepare('SELECT id_like FROM likes_idee WHERE id_idee = :id_idee AND id_utilisateur = :id_utilisateur LIMIT 1');
    $likeInsert = $pdo->prepare('INSERT INTO likes_idee (id_idee, id_utilisateur, created_at) VALUES (:id_idee, :id_utilisateur, :created_at)');

    foreach ($idees as $row) {
        if (!is_array($row)) {
            $stats['idees_skipped']++;
            continue;
        }

        $id = trim((string)($row['id'] ?? ''));
        $titre = trim((string)($row['titre'] ?? ''));
        $description = trim((string)($row['description'] ?? ''));
        $categorie = normalize_idee_categorie((string)($row['categorie'] ?? 'autre'));
        $photo = trim((string)($row['photo'] ?? ''));
        $likes = max(0, (int)($row['likes'] ?? 0));
        $createdAt = to_datetime((string)($row['timestamp'] ?? ''));

        if ($id === '' || $titre === '' || $description === '') {
            $stats['idees_skipped']++;
            continue;
        }

        $ideaExists->execute([':id' => $id]);
        $alreadyExists = (bool)$ideaExists->fetch();

        if (!$alreadyExists) {
            $resolvedUserId = resolve_user_id($pdo, $row, $legacyUserId);
            $ideaInsert->execute([
                ':id' => $id,
                ':user_id' => $resolvedUserId,
                ':titre' => $titre,
                ':categorie' => $categorie,
                ':description' => $description,
                ':photo' => $photo !== '' ? $photo : null,
                ':created_at' => $createdAt,
            ]);
            $stats['idees_inserted']++;
        } else {
            $stats['idees_skipped']++;
        }

        if ($likes > 0 && !empty($likeUsers)) {
            $limit = min($likes, count($likeUsers));
            for ($i = 0; $i < $limit; $i++) {
                $likeUserId = $likeUsers[$i];
                $likeExists->execute([
                    ':id_idee' => $id,
                    ':id_utilisateur' => $likeUserId,
                ]);
                if ($likeExists->fetch()) {
                    $stats['likes_skipped']++;
                    continue;
                }

                $likeInsert->execute([
                    ':id_idee' => $id,
                    ':id_utilisateur' => $likeUserId,
                    ':created_at' => $createdAt,
                ]);
                $stats['likes_inserted']++;
            }
        }
    }

    $pdo->commit();

    echo "Migration contenu terminee.\n";
    foreach ($stats as $k => $v) {
        echo '- ' . $k . ' : ' . $v . "\n";
    }
    exit(0);
} catch (Throwable $e) {
    if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    fwrite(STDERR, 'Erreur migration contenu: ' . $e->getMessage() . "\n");
    exit(1);
}
