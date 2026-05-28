<?php

declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/core/init.php';
require_once dirname(__DIR__, 2) . '/core/classes/AdminDashboardService.php';

use App\Core\Database;
use App\Core\RequestHandler;
use App\Core\ResponseHandler;
use App\Core\Validator;
use App\Core\Logger;
use App\Core\AuthService;
use App\Core\AdminDashboardService;

RequestHandler::requireMethod('POST');
$input = RequestHandler::getJsonInput();

$email = Validator::sanitizeEmail($input['email'] ?? '');
$password = (string)($input['password'] ?? '');

if ($email === '' || $password === '') {
    ResponseHandler::error('Email et mot de passe requis.', [], 422);
}

try {
    $pdo = Database::getInstance();
    $stmt = $pdo->prepare(
        'SELECT id_utilisateur, nom, prenom, surnom, email, mot_de_passe_hash, role
         FROM utilisateurs
         WHERE email = :email
         LIMIT 1'
    );
    $stmt->execute([':email' => $email]);
    $foundUser = $stmt->fetch();

    if (!is_array($foundUser) || !AuthService::verifyPassword($password, (string)($foundUser['mot_de_passe_hash'] ?? ''))) {
        ResponseHandler::error('Identifiants invalides.', [], 401);
    }

    if (AdminDashboardService::isUserBlocked($pdo, (string)($foundUser['id_utilisateur'] ?? ''))) {
        ResponseHandler::error('Compte bloque. Veuillez contacter un administrateur.', [], 403);
    }

    $user = [
        'id' => $foundUser['id_utilisateur'],
        'nom' => $foundUser['nom'],
        'prenom' => $foundUser['prenom'],
        'surnom' => $foundUser['surnom'],
        'email' => $foundUser['email'],
        'role' => $foundUser['role'] ?? 'citoyen',
    ];

    $user['auth_token'] = AuthService::createAccessToken($user);

    AuthService::setAuthUser($user);
    ResponseHandler::success('Connexion reussie.', $user);
} catch (\Throwable $e) {
    Logger::error('Login MySQL error: ' . $e->getMessage());
    ResponseHandler::error('Erreur serveur pendant la connexion.', [], 500);
}
