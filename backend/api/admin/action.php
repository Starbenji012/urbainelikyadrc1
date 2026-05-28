<?php

declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/core/init.php';
require_once dirname(__DIR__, 2) . '/core/classes/AdminDashboardService.php';

use App\Core\AdminDashboardService;
use App\Core\AuthService;
use App\Core\Database;
use App\Core\Logger;
use App\Core\MailerService;
use App\Core\RequestHandler;
use App\Core\ResponseHandler;
use App\Core\UploadService;
use App\Core\Validator;

RequestHandler::requireMethod('POST');
$adminUser = AuthService::requireAuthUser();
if (!in_array(strtolower((string)($adminUser['role'] ?? 'citoyen')), ['admin', 'super_admin'], true)) {
    ResponseHandler::error('Acces admin requis.', [], 403);
}
$input = RequestHandler::getJsonInput();

$resource = strtolower(RequestHandler::cleanString((string)($input['resource'] ?? '')));
$action = strtolower(RequestHandler::cleanString((string)($input['action'] ?? '')));
$id = RequestHandler::cleanString((string)($input['id'] ?? ''));

if ($resource === '' || $action === '' || $id === '') {
    ResponseHandler::error('Parametres admin manquants.', [], 422);
}

try {
    $pdo = Database::getInstance();
    AdminDashboardService::ensureSchema($pdo);

    if ($resource === 'admin') {
        AuthService::requireSuperAdminUser();

        if ($action === 'create') {
            $created = AdminDashboardService::createOrPromoteAdmin($pdo, $input, (string)($adminUser['id'] ?? ''));
            ResponseHandler::success('Administrateur enregistre.', $created, 201);
        }

        if ($action === 'permission') {
            $permission = RequestHandler::cleanString((string)($input['permission'] ?? ''));
            $allowed = filter_var($input['allowed'] ?? false, FILTER_VALIDATE_BOOL);
            AdminDashboardService::setAdminPermission($pdo, $id, $permission, $allowed, (string)($adminUser['id'] ?? ''));
            ResponseHandler::success('Droit administrateur mis a jour.', [
                'id' => $id,
                'permission' => $permission,
                'allowed' => $allowed,
            ]);
        }
    }

    if ($resource === 'signalement') {
        if ($action === 'status') {
            $status = RequestHandler::cleanString((string)($input['status'] ?? 'nouveau'));
            if ($status === 'resolu') {
                $evidence = (string)($input['evidence'] ?? '');
                if (trim($evidence) === '') {
                    ResponseHandler::error('Une image de preuve est requise pour valider la resolution.', [], 422);
                }

                $evidencePath = UploadService::persistDataUrlImage($evidence, 'dashboard', 'signalement_' . $id . '_' . time());
                if ($evidencePath === null || $evidencePath === '') {
                    ResponseHandler::error('Image de preuve invalide.', [], 422);
                }

                $result = AdminDashboardService::setSignalementStatus($pdo, $id, $status, (string)($adminUser['id'] ?? ''), null, $evidencePath);
                ResponseHandler::success('Signalement resolu.', $result);
            }

            if ($status === 'en_cours') {
                $result = AdminDashboardService::setSignalementStatus($pdo, $id, $status, (string)($adminUser['id'] ?? ''));
                ResponseHandler::success('Signalement mis en traitement.', $result);
            }

            ResponseHandler::error('Statut de signalement inconnu.', [], 422);
        }

        if ($action === 'cancel') {
            $reason = trim((string)($input['reason'] ?? ''));
            if ($reason === '') {
                ResponseHandler::error('Un motif est requis pour annuler.', [], 422);
            }

            $result = AdminDashboardService::setSignalementStatus($pdo, $id, 'annule', (string)($adminUser['id'] ?? ''), $reason);
            ResponseHandler::success('Signalement annule.', $result);
        }

        if ($action === 'delete') {
            AdminDashboardService::deleteSignalement($pdo, $id, (string)($adminUser['id'] ?? ''));
            ResponseHandler::success('Signalement supprime.');
        }
    }

    if ($resource === 'idee') {
        if ($action === 'status') {
            $status = RequestHandler::cleanString((string)($input['status'] ?? 'nouvelle'));
            if ($status === 'realisee') {
                $evidence = trim((string)($input['evidence'] ?? ''));
                $evidencePath = null;
                if ($evidence !== '') {
                    $evidencePath = UploadService::persistDataUrlImage($evidence, 'dashboard', 'idee_' . $id . '_' . time());
                    if ($evidencePath === null || $evidencePath === '') {
                        ResponseHandler::error('Image de preuve invalide.', [], 422);
                    }
                }

                $result = AdminDashboardService::setIdeeStatus($pdo, $id, $status, (string)($adminUser['id'] ?? ''), null, $evidencePath);
                ResponseHandler::success('Idee realisee.', $result);
            }

            if ($status === 'en_cours') {
                $result = AdminDashboardService::setIdeeStatus($pdo, $id, $status, (string)($adminUser['id'] ?? ''));
                ResponseHandler::success('Idee mise en traitement.', $result);
            }

            ResponseHandler::error('Statut d idee inconnu.', [], 422);
        }

        if ($action === 'cancel') {
            $reason = trim((string)($input['reason'] ?? ''));
            if ($reason === '') {
                ResponseHandler::error('Un motif est requis pour annuler.', [], 422);
            }

            $result = AdminDashboardService::setIdeeStatus($pdo, $id, 'annule', (string)($adminUser['id'] ?? ''), $reason);
            ResponseHandler::success('Idee annulee.', $result);
        }

        if ($action === 'delete') {
            AdminDashboardService::deleteIdee($pdo, $id, (string)($adminUser['id'] ?? ''));
            ResponseHandler::success('Idee supprimee.');
        }
    }

    if ($resource === 'message') {
        if ($action === 'reply') {
            $subject = RequestHandler::cleanString((string)($input['subject'] ?? ''));
            $body = RequestHandler::cleanString((string)($input['body'] ?? ''));
            $replyTo = Validator::sanitizeEmail((string)($input['email'] ?? ''));

            if ($replyTo === '') {
                $messageStmt = $pdo->prepare('SELECT email, nom, sujet, message FROM messages_contact WHERE id_message = :id LIMIT 1');
                $messageStmt->execute([':id' => $id]);
                $messageRow = $messageStmt->fetch();

                if (!is_array($messageRow)) {
                    ResponseHandler::error('Message introuvable.', [], 404);
                }

                $replyTo = Validator::sanitizeEmail((string)($messageRow['email'] ?? ''));
                if ($subject === '') {
                    $subject = 'Reponse UrbainElikyaDRC - ' . trim((string)($messageRow['sujet'] ?? ''));
                }

                if ($body === '') {
                    $body = "Bonjour " . trim((string)($messageRow['nom'] ?? '')) . ",\n\n";
                    $body .= "Merci pour votre message. Voici notre reponse :\n\n";
                }
            }

            if ($subject === '') {
                $subject = 'Reponse UrbainElikyaDRC';
            }

            if ($body === '') {
                ResponseHandler::error('Le contenu de la reponse est requis.', [], 422);
            }

            $mailer = new MailerService();
            $sent = $mailer->send($replyTo, $subject, $body . "\n\n--\nEquipe UrbainElikyaDRC");

            if (!$sent) {
                ResponseHandler::error('Impossible d envoyer la reponse email.', [], 500);
            }

            ResponseHandler::success('Reponse envoyee par email.');
        }

        if ($action === 'delete') {
            AdminDashboardService::deleteMessage($pdo, $id);
            ResponseHandler::success('Message supprime.');
        }
    }

    if ($resource === 'user') {
        if ($action === 'warn') {
            $note = RequestHandler::cleanString((string)($input['note'] ?? ''));
            $warningsCount = AdminDashboardService::addUserWarning($pdo, $id, $note, (string)($adminUser['id'] ?? ''));
            $blocked = AdminDashboardService::isUserBlocked($pdo, $id);
            ResponseHandler::success('Avertissement enregistre.', [
                'id' => $id,
                'warnings' => $warningsCount,
                'blocked' => $blocked,
            ]);
        }

        if ($action === 'block') {
            $days = (int)($input['days'] ?? 0);
            $hours = (int)($input['hours'] ?? 0);
            $reason = RequestHandler::cleanString((string)($input['reason'] ?? 'Compte bloque par un administrateur.'));
            $blockedUntil = null;
            if ($days > 0 || $hours > 0) {
                $blockedUntil = date('Y-m-d H:i:s', strtotime('+' . $days . ' days +' . $hours . ' hours'));
            }
            $block = AdminDashboardService::setUserBlock($pdo, $id, $blockedUntil, $reason, (string)($adminUser['id'] ?? ''));
            ResponseHandler::success('Compte bloque.', [
                'id' => $id,
                'blocked_until' => $block['blocked_until'] ?? $blockedUntil,
                'reason' => $reason,
            ]);
        }

        if ($action === 'unblock') {
            AdminDashboardService::clearUserBlock($pdo, $id);
            ResponseHandler::success('Compte debloque.', ['id' => $id]);
        }

        if ($action === 'delay') {
            $days = (int)($input['days'] ?? 0);
            $hours = (int)($input['hours'] ?? 0);
            if ($days <= 0) {
                ResponseHandler::error('Le delai doit etre superieur a 0 jour.', [], 422);
            }
            $reason = RequestHandler::cleanString((string)($input['reason'] ?? 'Delai de debloquage defini par un administrateur.'));
            $blockedUntil = date('Y-m-d H:i:s', strtotime('+' . $days . ' days +' . $hours . ' hours'));
            $block = AdminDashboardService::setUserBlock($pdo, $id, $blockedUntil, $reason, (string)($adminUser['id'] ?? ''));
            ResponseHandler::success('Delai de debloquage mis a jour.', [
                'id' => $id,
                'blocked_until' => $block['blocked_until'] ?? $blockedUntil,
                'reason' => $reason,
            ]);
        }

        if ($action === 'delete') {
            AdminDashboardService::deleteUser($pdo, $id);
            ResponseHandler::success('Compte supprime.');
        }
    }

    ResponseHandler::error('Action admin inconnue.', [], 422);
} catch (\Throwable $e) {
    Logger::error('Admin action error: ' . $e->getMessage());

    ResponseHandler::error('Erreur serveur pendant l action admin.', [], 500);
}