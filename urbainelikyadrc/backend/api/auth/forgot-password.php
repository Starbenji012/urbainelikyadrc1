<?php

declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/core/bootstrap.php';
require_once BACKEND_ROOT . '/core/response.php';
require_once BACKEND_ROOT . '/core/request.php';
require_once BACKEND_ROOT . '/core/validator.php';
require_once BACKEND_ROOT . '/core/logger.php';
require_once BACKEND_ROOT . '/core/db.php';
require_once BACKEND_ROOT . '/core/mailer.php';
require_once BACKEND_ROOT . '/core/password_reset.php';

require_method('POST');
$input = get_json_input();

$email = strtolower(as_clean_string($input['email'] ?? ''));
if (!is_valid_email($email)) {
    json_error('Email invalide.', ['email' => 'Email invalide.'], 422);
}

try {
    $pdo = db_get_pdo();
    ensure_password_resets_table($pdo);

    $stmt = $pdo->prepare('SELECT id_utilisateur, nom, prenom, email FROM utilisateurs WHERE email = :email LIMIT 1');
    $stmt->execute([':email' => $email]);
    $user = $stmt->fetch();

    if (is_array($user)) {
        $tokenData = create_password_reset_token($pdo, (string)$user['id_utilisateur'], 30);

        $fullName = trim(((string)$user['prenom']) . ' ' . ((string)$user['nom']));
        $mailSubject = 'Reinitialisation du mot de passe - UrbainElikyaDRC';
        $mailBody = "Bonjour {$fullName},\n\n"
            . "Vous avez demande une reinitialisation de mot de passe.\n"
            . "Cliquez sur ce lien pour choisir un nouveau mot de passe:\n"
            . $tokenData['link'] . "\n\n"
            . "Ce lien expire dans {$tokenData['expires_minutes']} minutes et ne peut etre utilise qu'une seule fois.\n"
            . "Si vous n'etes pas a l'origine de cette demande, ignorez simplement cet email.\n\n"
            . "Equipe UrbainElikyaDRC";

        $mailSent = send_plain_email((string)$user['email'], $mailSubject, $mailBody);
        if (!$mailSent) {
            app_log('warning', 'Lien reset genere mais email non envoye pour: ' . $user['email']);
        }
    }

    // Message volontairement neutre pour eviter l'enumeration d'emails.
    json_ok('Si cet email existe, un lien de reinitialisation a ete envoye.', [
        'email_sent' => true,
    ]);
} catch (Throwable $e) {
    app_log('error', 'Forgot password error: ' . $e->getMessage());
    json_error('Erreur serveur pendant la demande de reinitialisation.', [], 500);
}
