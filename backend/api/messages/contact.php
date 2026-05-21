<?php

declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/core/init.php';

use App\Core\Database;
use App\Core\RequestHandler;
use App\Core\ResponseHandler;
use App\Core\Validator;
use App\Core\IdGenerator;
use App\Core\Logger;

RequestHandler::requireMethod('POST');
$input = RequestHandler::getJsonInput();

$nom = RequestHandler::cleanString($input['nom'] ?? '');
$email = Validator::sanitizeEmail($input['email'] ?? '');
$sujet = RequestHandler::cleanString($input['sujet'] ?? '');
$message = RequestHandler::cleanString($input['message'] ?? '');

$errors = [];
if (!Validator::isLengthBetween($nom, 2, 120)) {
    $errors['nom'] = 'Le nom doit contenir entre 2 et 120 caracteres.';
}
if (!Validator::isValidEmail($email)) {
    $errors['email'] = 'Email invalide.';
}
if (!Validator::isLengthBetween($sujet, 3, 160)) {
    $errors['sujet'] = 'Le sujet doit contenir entre 3 et 160 caracteres.';
}
if (!Validator::isLengthBetween($message, 5, 5000)) {
    $errors['message'] = 'Le message doit contenir entre 5 et 5000 caracteres.';
}

if (!empty($errors)) {
    ResponseHandler::error('Validation echouee.', $errors, 422);
}

$newMessage = [
    'id' => IdGenerator::generate('msg'),
    'nom' => $nom,
    'email' => $email,
    'sujet' => $sujet,
    'message' => $message,
    'timestamp' => gmdate('c'),
];

try {
    $pdo = Database::getInstance();
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
    ResponseHandler::success('Message de contact enregistre.', $responseData, 201);
} catch (Throwable $e) {
    Logger::error('Contact MySQL error: ' . $e->getMessage());
    ResponseHandler::error('Erreur serveur pendant l envoi du message.', [], 500);
}
