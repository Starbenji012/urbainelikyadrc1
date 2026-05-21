<?php

declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/core/init.php';

use App\Core\Database;
use App\Core\RequestHandler;
use App\Core\ResponseHandler;
use App\Core\AuthService;
use App\Core\Logger;
use PDOException;

RequestHandler::requireMethod('POST');
$authUser = AuthService::requireAuthUser();
$input = RequestHandler::getJsonInput();
$id = RequestHandler::cleanString($input['id'] ?? '');

if ($id === '') {
    ResponseHandler::error('ID idee requis.', [], 422);
}

try {
    $pdo = Database::getInstance();

    $existsStmt = $pdo->prepare('SELECT id_idee FROM idees WHERE id_idee = :id LIMIT 1');
    $existsStmt->execute([':id' => $id]);
    if (!$existsStmt->fetch()) {
        ResponseHandler::error('Idee introuvable.', [], 404);
    }

    $likeStmt = $pdo->prepare('INSERT INTO likes_idee (id_idee, id_utilisateur, created_at) VALUES (:id_idee, :id_utilisateur, NOW())');
    $likeStmt->execute([
        ':id_idee' => $id,
        ':id_utilisateur' => (string)($authUser['id'] ?? ''),
    ]);

    ResponseHandler::success('Like enregistre.');
} catch (PDOException $e) {
    if ((int)$e->getCode() === 23000) {
        ResponseHandler::error('Vous avez deja aime cette idee.', [], 409);
    }
    Logger::error('Idees like MySQL error: ' . $e->getMessage());
    ResponseHandler::error('Erreur serveur pendant le like.', [], 500);
} catch (Throwable $e) {
    Logger::error('Idees like MySQL error: ' . $e->getMessage());
    ResponseHandler::error('Erreur serveur pendant le like.', [], 500);
}
