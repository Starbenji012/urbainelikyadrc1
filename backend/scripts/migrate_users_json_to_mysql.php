<?php

declare(strict_types=1);

// Migration CLI: users.json -> table MySQL utilisateurs

$root = dirname(__DIR__);
require_once $root . '/core/db.php';

$usersFile = $root . '/data/users.json';

if (!is_file($usersFile)) {
    fwrite(STDERR, "Fichier introuvable: {$usersFile}\n");
    exit(1);
}

$json = file_get_contents($usersFile);
if ($json === false) {
    fwrite(STDERR, "Impossible de lire users.json\n");
    exit(1);
}

$rows = json_decode($json, true);
if (!is_array($rows)) {
    fwrite(STDERR, "users.json invalide (JSON non tableau).\n");
    exit(1);
}

try {
    $pdo = db_get_pdo();

    $pdo->beginTransaction();

    $findByEmail = $pdo->prepare(
        'SELECT id_utilisateur FROM utilisateurs WHERE email = :email LIMIT 1'
    );

    $findById = $pdo->prepare(
        'SELECT id_utilisateur FROM utilisateurs WHERE id_utilisateur = :id LIMIT 1'
    );

    $insert = $pdo->prepare(
        'INSERT INTO utilisateurs (
            id_utilisateur,
            nom,
            prenom,
            surnom,
            email,
            mot_de_passe_hash,
            role,
            created_at
        ) VALUES (
            :id,
            :nom,
            :prenom,
            :surnom,
            :email,
            :password_hash,
            :role,
            :created_at
        )'
    );

    $inserted = 0;
    $skipped = 0;

    foreach ($rows as $row) {
        if (!is_array($row)) {
            $skipped++;
            continue;
        }

        $id = trim((string)($row['id'] ?? ''));
        $nom = trim((string)($row['nom'] ?? ''));
        $prenom = trim((string)($row['prenom'] ?? ''));
        $surnom = trim((string)($row['surnom'] ?? ''));
        $email = strtolower(trim((string)($row['email'] ?? '')));
        $passwordHash = (string)($row['password_hash'] ?? '');
        $role = trim((string)($row['role'] ?? 'citoyen'));
        $createdAtRaw = trim((string)($row['created_at'] ?? ''));

        if ($id === '' || $nom === '' || $prenom === '' || $email === '' || $passwordHash === '') {
            $skipped++;
            continue;
        }

        $createdAtTs = strtotime($createdAtRaw);
        $createdAt = $createdAtTs !== false
            ? date('Y-m-d H:i:s', $createdAtTs)
            : gmdate('Y-m-d H:i:s');

        if ($role !== 'citoyen' && $role !== 'admin') {
            $role = 'citoyen';
        }

        $findByEmail->execute([':email' => $email]);
        if ($findByEmail->fetch()) {
            $skipped++;
            continue;
        }

        $findById->execute([':id' => $id]);
        if ($findById->fetch()) {
            $skipped++;
            continue;
        }

        $insert->execute([
            ':id' => $id,
            ':nom' => $nom,
            ':prenom' => $prenom,
            ':surnom' => $surnom !== '' ? $surnom : null,
            ':email' => $email,
            ':password_hash' => $passwordHash,
            ':role' => $role,
            ':created_at' => $createdAt,
        ]);

        $inserted++;
    }

    $pdo->commit();

    echo "Migration terminee.\n";
    echo "- Inseres : {$inserted}\n";
    echo "- Ignores : {$skipped}\n";
    exit(0);
} catch (Throwable $e) {
    if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }

    fwrite(STDERR, 'Erreur migration: ' . $e->getMessage() . "\n");
    exit(1);
}
