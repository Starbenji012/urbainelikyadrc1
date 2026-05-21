<?php

declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/core/init.php';

use App\Core\Database;
use App\Core\RequestHandler;
use App\Core\ResponseHandler;
use App\Core\Validator;
use App\Core\Logger;
use App\Core\IdGenerator;
use App\Core\AuthService;
use App\Core\MailerService;

RequestHandler::requireMethod('POST');
$input = RequestHandler::getJsonInput();

$nom = RequestHandler::cleanString($input['nom'] ?? '');
$prenom = RequestHandler::cleanString($input['prenom'] ?? '');
$surnom = RequestHandler::cleanString($input['surnom'] ?? '');
$email = Validator::sanitizeEmail($input['email'] ?? '');
$password = (string)($input['password'] ?? '');

$errors = [];
if (!Validator::isLengthBetween($nom, 2, 80)) {
    $errors['nom'] = 'Le nom doit contenir entre 2 et 80 caracteres.';
}
if (!Validator::isLengthBetween($prenom, 2, 80)) {
    $errors['prenom'] = 'Le prenom doit contenir entre 2 et 80 caracteres.';
}
if ($surnom && !Validator::isLengthBetween($surnom, 2, 80)) {
    $errors['surnom'] = 'Le surnom doit contenir entre 2 et 80 caracteres (ou vide).';
}
if (!Validator::isValidEmail($email)) {
    $errors['email'] = 'Email invalide.';
}
if ($passwordError = Validator::validatePassword($password)) {
    $errors['password'] = $passwordError;
}

if (!empty($errors)) {
    ResponseHandler::error('Validation echouee.', $errors, 422);
}

try {
    $pdo = Database::getInstance();

    // Vérifier email existant
    $checkStmt = $pdo->prepare('SELECT id_utilisateur FROM utilisateurs WHERE email = :email LIMIT 1');
    $checkStmt->execute([':email' => $email]);
    if ($checkStmt->fetch()) {
        ResponseHandler::error('Cet email est deja utilise.', ['email' => 'Email deja pris.'], 409);
    }

    $userId = IdGenerator::generate('usr');
    $passwordHash = AuthService::hashPassword($password);

    $insertStmt = $pdo->prepare(
        'INSERT INTO utilisateurs (id_utilisateur, nom, prenom, surnom, email, mot_de_passe_hash, role, created_at)
         VALUES (:id, :nom, :prenom, :surnom, :email, :password_hash, :role, NOW())'
    );
    $insertStmt->execute([
        ':id' => $userId,
        ':nom' => $nom,
        ':prenom' => $prenom,
        ':surnom' => $surnom !== '' ? $surnom : null,
        ':email' => $email,
        ':password_hash' => $passwordHash,
        ':role' => 'citoyen',
    ]);

    // Email de bienvenue
    $mailer = new MailerService();
    $mailSubject = 'Bienvenue sur UrbainElikyaDRC';
    $mailBody = "Bonjour {$prenom} {$nom},\n\n"
        . "Votre compte UrbainElikyaDRC a été créé avec succès.\n"
        . "Pour des raisons de sécurité, votre mot de passe ne vous sera pas envoyé par email.\n"
        . "Si vous oubliez votre mot de passe, utilisez la fonction 'Mot de passe oublie' depuis la page de connexion.\n\n"
        . "Equipe UrbainElikyaDRC";

    $mailSent = $mailer->send($email, $mailSubject, $mailBody);
    if (!$mailSent) {
        Logger::warning('Account created but welcome email not sent for: ' . $email);
    }

    $responseUser = [
        'id' => $userId,
        'nom' => $nom,
        'prenom' => $prenom,
        'surnom' => $surnom,
        'email' => $email,
        'role' => 'citoyen',
        'welcome_email_sent' => $mailSent,
    ];

    ResponseHandler::success('Inscription reussie.', $responseUser, 201);
} catch (Throwable $e) {
    Logger::error('Register MySQL error: ' . $e->getMessage());
    ResponseHandler::error('Erreur serveur pendant l inscription.', [], 500);
}
