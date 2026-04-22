<?php

declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/core/bootstrap.php';
require_once BACKEND_ROOT . '/core/response.php';
require_once BACKEND_ROOT . '/core/request.php';
require_once BACKEND_ROOT . '/core/validator.php';
require_once BACKEND_ROOT . '/core/id.php';
require_once BACKEND_ROOT . '/core/db.php';
require_once BACKEND_ROOT . '/core/logger.php';

require_method('POST');
$input = get_json_input();

$nom = as_clean_string($input['nom'] ?? '');
$email = strtolower(as_clean_string($input['email'] ?? ''));
$sujet = as_clean_string($input['sujet'] ?? '');
$message = as_clean_string($input['message'] ?? '');

$errors = [];
if (!is_length_between($nom, 2, 120)) {
    $errors['nom'] = 'Le nom doit contenir entre 2 et 120 caracteres.';
}
if (!is_valid_email($email)) {
    $errors['email'] = 'Email invalide.';
}
if (!is_length_between($sujet, 3, 160)) {
    $errors['sujet'] = 'Le sujet doit contenir entre 3 et 160 caracteres.';
}
if (!is_length_between($message, 5, 5000)) {
    $errors['message'] = 'Le message doit contenir entre 5 et 5000 caracteres.';
}

if (!empty($errors)) {
    json_error('Validation echouee.', $errors, 422);
}

$newMessage = [
    'id' => generate_id('msg'),
    'nom' => $nom,
    'email' => $email,
    'sujet' => $sujet,
    'message' => $message,
    'timestamp' => gmdate('c'),
];

try {
    $pdo = db_get_pdo();
    $stmt = $pdo->prepare(
        'INSERT INTO messages_contact (id_message, nom, email, sujet, message, created_at)
         VALUES (:id_message, :nom, :email, :sujet, :message, NOW())'
    );
    $stmt->execute([
        ':id_message' => $newMessage['id'],
        ':nom' => $newMessage['nom'],
        ':email' => $newMessage['email'],
        ':sujet' => $newMessage['sujet'],
        ':message' => $newMessage['message'],
    ]);

    $responseData = $newMessage;
    $responseData['timestamp'] = gmdate('c');
    json_ok('Message de contact enregistre.', $responseData, 201);
} catch (Throwable $e) {
    app_log('error', 'Contact MySQL error: ' . $e->getMessage());
    json_error('Erreur serveur pendant l envoi du message.', [], 500);
}
