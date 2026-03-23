<?php

declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/core/bootstrap.php';
require_once BACKEND_ROOT . '/core/response.php';
require_once BACKEND_ROOT . '/core/request.php';
require_once BACKEND_ROOT . '/core/validator.php';
require_once BACKEND_ROOT . '/core/storage.php';
require_once BACKEND_ROOT . '/core/id.php';

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

$messages = read_json_array('messages');
$newMessage = [
    'id' => generate_id('msg'),
    'nom' => $nom,
    'email' => $email,
    'sujet' => $sujet,
    'message' => $message,
    'timestamp' => gmdate('c'),
];

array_unshift($messages, $newMessage);
if (!write_json_array('messages', $messages)) {
    json_error('Erreur serveur pendant l envoi du message.', [], 500);
}

json_ok('Message de contact enregistre.', $newMessage, 201);
