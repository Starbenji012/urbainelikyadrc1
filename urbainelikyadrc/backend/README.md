# Backend PHP (sans framework) + JSON (base de test)

Ce document propose une structure backend claire pour ton projet UrbainElikyaDRC, en respectant tes contraintes:

- PHP natif uniquement
- Aucun framework
- Aucun service externe obligatoire
- JSON utilisé comme base de donnees de test (phase 1)

## 1) Objectif

Ton frontend actuel est majoritairement base sur localStorage et quelques appels `fetch` vers des endpoints backend. L'objectif est de centraliser les donnees cote serveur pour:

- garder les donnees partagees entre utilisateurs
- preparer une future migration vers MySQL/PostgreSQL
- conserver un backend simple a deployer sur un hebergement PHP classique

## 2) Structure de dossiers recommandee

```text
backend/
  README.md
  public/
    index.php
  api/
    auth/
      register.php
      login.php
      logout.php
      me.php
    signalements/
      index.php        # GET liste, POST creation
      show.php         # GET detail par id
      delete.php       # DELETE logique/simple
    idees/
      index.php        # GET liste, POST creation
      like.php         # POST like
      delete.php       # DELETE logique/simple
    messages/
      contact.php      # POST message contact
    stats/
      dashboard.php    # GET compteurs utiles
  core/
    bootstrap.php      # headers, session_start, config globale
    response.php       # helpers JSON (ok, error)
    request.php        # lecture JSON/body + validation basique
    router.php         # optionnel si route unique
    auth.php           # session utilisateur, garde d'acces
    validator.php      # validateurs (email, string, tailles)
    storage.php        # lecture/ecriture JSON + lock fichiers
    id.php             # generation d'identifiants uniques
    logger.php         # logs simples
  data/
    users.json
    signalements.json
    idees.json
    messages.json
    stats.json
  data/_archive/
  logs/
    app.log
  uploads/
    signalements/
    idees/
```

Notes:

- `api/` contient les points d'entree HTTP.
- `core/` contient la logique reutilisable.
- `data/` simule la base de donnees.
- `uploads/` stocke les images (si tu choisis de ne plus stocker en base64).

## 3) Format JSON (base de test)

### 3.1 users.json

```json
[
  {
    "id": "usr_20260323_0001",
    "nom": "Kanku",
    "prenom": "Mado",
    "surnom": "mado243",
    "email": "mado@example.com",
    "password_hash": "$2y$10$...",
    "role": "citoyen",
    "created_at": "2026-03-23T10:30:00Z"
  }
]
```

### 3.2 signalements.json

```json
[
  {
    "id": "sig_20260323_0001",
    "user_id": "usr_20260323_0001",
    "user_nom": "Mado Kanku",
    "titre": "Route abimee",
    "type": "voirie",
    "description": "Nids-de-poule importants.",
    "lieu": "Commune de Gombe, Kinshasa",
    "lat": -4.32,
    "lng": 15.31,
    "photo": "uploads/signalements/sig_20260323_0001.jpg",
    "status": "nouveau",
    "timestamp": "2026-03-23T10:45:00Z"
  }
]
```

### 3.3 idees.json

```json
[
  {
    "id": "ide_20260323_0001",
    "user_id": "usr_20260323_0001",
    "titre": "Ajout de poubelles publiques",
    "categorie": "environnement",
    "description": "Installer des points de collecte par quartier.",
    "photo": "uploads/idees/ide_20260323_0001.jpg",
    "likes": 3,
    "timestamp": "2026-03-23T11:00:00Z"
  }
]
```

### 3.4 messages.json

```json
[
  {
    "id": "msg_20260323_0001",
    "nom": "Jean",
    "email": "jean@example.com",
    "sujet": "Assistance",
    "message": "Je n'arrive pas a envoyer un signalement.",
    "timestamp": "2026-03-23T12:00:00Z"
  }
]
```

## 4) Endpoints alignes a ton frontend

Ton frontend utilise deja des formulaires pour:

- inscription/connexion
- signalement
- idees
- contact
- suivi des signalements

Proposition d'endpoints:

### Auth

- `POST /backend/api/auth/register.php`
- `POST /backend/api/auth/login.php`
- `POST /backend/api/auth/logout.php`
- `GET  /backend/api/auth/me.php`

### Signalements

- `GET  /backend/api/signalements/index.php`
- `POST /backend/api/signalements/index.php`
- `GET  /backend/api/signalements/show.php?id=...`
- `POST /backend/api/signalements/delete.php` (ou suppression logique)

### Idees

- `GET  /backend/api/idees/index.php`
- `POST /backend/api/idees/index.php`
- `POST /backend/api/idees/like.php`
- `POST /backend/api/idees/delete.php`

### Contact

- `POST /backend/api/messages/contact.php`

### Stats (optionnel)

- `GET /backend/api/stats/dashboard.php`

## 5) Regles backend importantes

### 5.1 Reponse JSON uniforme

Toujours retourner un format unique:

```json
{
  "ok": true,
  "message": "Operation reussie",
  "data": {}
}
```

ou en erreur:

```json
{
  "ok": false,
  "message": "Validation echouee",
  "errors": {
    "email": "Email invalide"
  }
}
```

### 5.2 Validation minimale

- `nom`, `prenom`, `titre`, `description`: longueur min/max
- `email`: `filter_var(..., FILTER_VALIDATE_EMAIL)`
- `password`: min 8 caracteres
- `type/categorie`: valeur dans liste blanche
- `lat/lng`: numeriques et bornes valides

### 5.3 Securite de base

- `password_hash()` et `password_verify()`
- `session_start()` pour login
- verifier methode HTTP (`$_SERVER['REQUEST_METHOD']`)
- limiter taille upload/image
- interdire execution dans `uploads/` (config serveur)
- ecriture JSON avec `flock()` pour eviter corruption concurrente

### 5.4 Concurrence sur JSON

Comme JSON n'est pas une vraie base transactionnelle:

- lire -> modifier -> ecrire sous verrou (`LOCK_EX`)
- faire des sauvegardes dans `data/_archive/`
- journaliser les erreurs dans `logs/app.log`

## 6) Mapping avec tes pages actuelles

- `html/inscription.html` + `js/inscription.js` -> `auth/register.php`
- `html/connexion.html` + `js/connexion.js` -> `auth/login.php`
- `html/signaler.html` + `js/signalement.js` -> `signalements/index.php`
- `html/idees.html` + `js/idees.js` -> `idees/index.php`, `idees/like.php`
- `html/contact.html` + `js/contact.js` -> `messages/contact.php`
- `html/suivi.html` + `js/suivi.js` -> `signalements/index.php` (GET)

## 7) Convention de migration future vers vraie DB

Quand tu passeras de JSON vers MySQL/PostgreSQL:

- garder les memes endpoints et payloads
- remplacer uniquement `core/storage.php`
- conserver les IDs (`usr_*`, `sig_*`, `ide_*`, `msg_*`)
- ajouter des indexes sur `email`, `timestamp`, `status`

Ainsi, le frontend change tres peu.

## 8) Plan de mise en place (sans execution pour l'instant)

1. Creer les dossiers `api`, `core`, `data`, `uploads`, `logs`.
2. Initialiser les fichiers JSON avec `[]`.
3. Creer les helpers (`response.php`, `storage.php`, `validator.php`).
4. Implementer `register.php` et `login.php`.
5. Implementer `signalements/index.php` (GET + POST).
6. Implementer `idees/index.php` puis `like.php`.
7. Implementer `messages/contact.php`.
8. Adapter progressivement les fichiers JS pour pointer vers ces endpoints.

Statut actuel du projet:

- La structure de dossiers est deja creee.
- Les endpoints PHP de base sont deja generes.
- Les helpers dans `core/` sont deja en place.
- Les fichiers JSON de test sont initialises.

## 9) Limites connues de JSON (important)

JSON est tres bien pour test/prototype, mais limite si:

- plusieurs utilisateurs ecrivent en meme temps
- gros volume de donnees
- besoin de recherche complexe

Conclusion: JSON est parfait pour ta phase actuelle de test, mais prevois une migration SQL des que l'usage reel augmente.

## 10) Guide debutant (ordre simple pour apprendre)

Si tu debutes en PHP, lis les fichiers dans cet ordre:

1. `core/bootstrap.php` (demarrage global: session, headers, constantes)
2. `core/response.php` (comment le backend repond en JSON)
3. `core/request.php` (lecture du body JSON + methode HTTP)
4. `core/storage.php` (lecture/ecriture des fichiers JSON)
5. `api/messages/contact.php` (endpoint simple)
6. `api/auth/register.php` puis `api/auth/login.php`
7. `api/signalements/index.php` et `api/idees/index.php`

Conseils debutant:

- Lis les commentaires avant chaque bloc de code.
- Commence par comprendre le chemin complet d'une requete:
  frontend JS -> endpoint API -> helper core -> fichier JSON.
- Modifie un seul fichier a la fois pour bien voir l'effet.
- Garde le format de reponse JSON identique partout (`ok`, `message`, `data/errors`).

## 11) Fichiers principaux deja crees

- Auth: `api/auth/register.php`, `api/auth/login.php`, `api/auth/logout.php`, `api/auth/me.php`
- Signalements: `api/signalements/index.php`, `api/signalements/show.php`, `api/signalements/delete.php`
- Idees: `api/idees/index.php`, `api/idees/like.php`, `api/idees/delete.php`
- Contact: `api/messages/contact.php`
- Stats: `api/stats/dashboard.php`
- Coeur: `core/bootstrap.php`, `core/response.php`, `core/request.php`, `core/validator.php`, `core/storage.php`, `core/id.php`, `core/auth.php`, `core/logger.php`
- Donnees de test: `data/users.json`, `data/signalements.json`, `data/idees.json`, `data/messages.json`

## 12) Explication tres simple du backend

Le backend est comme un bureau de reception:

1. Le frontend (tes pages HTML/JS) envoie un formulaire.
2. Un fichier dans `api/` recoit la requete.
3. Ce fichier verifie les donnees (validation).
4. Si les donnees sont bonnes, il ecrit dans un fichier JSON dans `data/`.
5. Il renvoie une reponse JSON au frontend.

Formule a retenir:

Frontend -> API PHP -> Core (outils) -> JSON -> Reponse JSON

Role simple de chaque dossier:

- `api/`: les portes d'entree HTTP.
- `core/`: les outils communs reutilises partout.
- `data/`: la base de donnees de test en JSON.
- `logs/`: les erreurs techniques.
- `uploads/`: les fichiers image si necessaire.

## 13) Pas-a-pas de 3 endpoints importants

### 13.1 Contact (messages/contact.php)

Fichier: `api/messages/contact.php`

Ce qui se passe:

1. Le frontend envoie `nom`, `email`, `sujet`, `message` en POST JSON.
2. Le fichier impose la methode POST (`require_method('POST')`).
3. Le fichier lit le JSON (`get_json_input()`).
4. Le fichier nettoie les champs (`as_clean_string`).
5. Le fichier valide les champs (taille + email valide).
6. S'il y a des erreurs, il repond avec `json_error(..., 422)`.
7. Sinon il lit `data/messages.json`.
8. Il cree un nouvel objet message avec un ID et un timestamp.
9. Il sauvegarde avec `write_json_array('messages', ...)`.
10. Il repond succes avec `json_ok(..., 201)`.

Resultat: le message du formulaire contact est conserve dans le JSON.

### 13.2 Inscription (auth/register.php)

Fichier: `api/auth/register.php`

Ce qui se passe:

1. Le frontend envoie `nom`, `prenom`, `surnom`, `email`, `password`.
2. Le fichier valide les longueurs et l'email.
3. Il verifie que l'email n'existe pas deja dans `users.json`.
4. Il chiffre le mot de passe avec `password_hash()`.
5. Il cree l'utilisateur avec un ID unique.
6. Il enregistre dans `data/users.json`.
7. Il renvoie une reponse de succes sans exposer `password_hash`.

Resultat: un nouvel utilisateur est cree proprement et securise.

### 13.3 Connexion (auth/login.php)

Fichier: `api/auth/login.php`

Ce qui se passe:

1. Le frontend envoie `email` et `password`.
2. Le fichier cherche l'utilisateur dans `users.json`.
3. Il compare le mot de passe saisi avec le hash via `password_verify()`.
4. Si c'est valide, il cree une session PHP `$_SESSION['auth_user']`.
5. Il renvoie les infos utiles de l'utilisateur connecte.

Resultat: l'utilisateur est authentifie, la session est active.

## 14) Lecture conseillee (super debutant)

Pour bien apprendre, suis cet ordre:

1. Lire `core/response.php` pour comprendre la forme des reponses.
2. Lire `core/request.php` pour comprendre l'entree des donnees.
3. Lire `core/storage.php` pour comprendre la sauvegarde JSON.
4. Lire `api/messages/contact.php` (le plus simple).
5. Lire `api/auth/register.php`.
6. Lire `api/auth/login.php`.

Astuce pratique:

- Si tu bloques, cherche juste 3 questions:
  - Qu'est-ce qu'on recoit ?
  - Qu'est-ce qu'on valide ?
  - Ou est-ce qu'on sauvegarde ?

## 15) Mini lexique debutant (termes importants)

- Endpoint: une URL backend qui fait une action precise (ex: creer un compte).
- API: ensemble d'endpoints que le frontend appelle.
- Requete HTTP: message envoye du frontend vers le backend (GET, POST, etc.).
- Methode GET: lire des donnees.
- Methode POST: envoyer/creer des donnees.
- JSON: format texte pour stocker ou echanger des donnees (objets/tableaux).
- Validation: verification des champs (email valide, longueur correcte, etc.).
- Session PHP: memoire temporaire cote serveur pour garder l'utilisateur connecte.
- Authentification: verifier l'identite d'un utilisateur (login).
- Autorisation: verifier ce que l'utilisateur a le droit de faire.
- Hash de mot de passe: version chiffree du mot de passe (on ne stocke jamais le mot de passe brut).
- `password_hash()`: fonction PHP pour chiffrer le mot de passe.
- `password_verify()`: fonction PHP pour verifier un mot de passe contre son hash.
- Statut HTTP 200: succes (lecture/mise a jour classique).
- Statut HTTP 201: ressource creee (creation reussie).
- Statut HTTP 401: non authentifie (pas connecte).
- Statut HTTP 404: ressource introuvable.
- Statut HTTP 422: donnees invalides (erreur de validation).
- Statut HTTP 500: erreur interne serveur.
- `require_once`: importer un fichier PHP une seule fois.
- `array_unshift`: ajouter un element au debut d'un tableau.
- `file_put_contents(..., LOCK_EX)`: ecrire un fichier avec verrou pour eviter les collisions d'ecriture.

Regle simple pour apprendre vite:

- Quand tu lis un endpoint, pense toujours a ce schema:
  - Entree (requete)
  - Verification (validation)
  - Sauvegarde (JSON)
  - Sortie (reponse JSON)

## 16) Schema visuel simple (ASCII)

```text
[Utilisateur]
  |
  | Remplit un formulaire (Contact / Inscription / Signalement / Idee)
  v
[Frontend HTML + JS]
  |
  | fetch(...)
  v
[Endpoint PHP dans api/]
  |
  | include core/bootstrap.php, request.php, validator.php, storage.php
  v
[Validation des champs]
  |
  | si erreur -> json_error(...)
  | si ok -> continuer
  v
[Lecture/Ecriture JSON dans data/*.json]
  |
  | read_json_array / write_json_array
  v
[Reponse JSON]
  |
  | json_ok(...)
  v
[Frontend recoit la reponse]
  |
  | affiche message succes/erreur
  v
[Utilisateur voit le resultat]
```

Version courte a memoriser:

```text
Formulaire -> fetch -> API PHP -> Validation -> JSON -> Reponse -> Ecran
```

## 17) Transition frontend JS -> backend PHP (deja faite)

Objectif de cette transition:

- Eviter de casser l'interface existante.
- Envoyer d'abord vers le backend PHP.
- Si le backend ne repond pas, garder un fallback localStorage.

Regle implementee dans les pages:

1. Tenter le backend (`fetch` vers endpoint PHP).
2. Si succes: utiliser les donnees backend.
3. Sinon: sauvegarder/lire en localStorage.

### 17.1 Contact

Fichier: `js/contact.js`

- Endpoint cible: `api/messages/contact.php`
- Fallback local: `localStorage["contact_messages_local"]`
- Comportement:
  - envoi backend si disponible
  - sinon sauvegarde locale du message avec timestamp

### 17.2 Inscription

Fichier: `js/inscription.js`

- Endpoint cible: `api/auth/register.php`
- Fallback local: `localStorage["users_local"]`
- Comportement:
  - inscription backend prioritaire
  - sinon creation locale d'un utilisateur de secours

### 17.3 Connexion

Fichier: `js/connexion.js`

- Endpoint cible: `api/auth/login.php`
- Fallback local: verification dans `users_local`
- Comportement:
  - connexion backend prioritaire
  - sinon connexion locale si l'utilisateur existe en local
  - memorisation de `user_nom` pour les autres pages

### 17.4 Idees (soumission/liste)

Fichier: `js/idees.js`

- Endpoints cibles:
  - `api/idees/index.php` (GET/POST)
  - `api/idees/like.php`
  - `api/idees/delete.php`
- Fallback local: `localStorage["idees_page"]`
- Comportement:
  - chargement backend + fusion avec local sans doublons
  - creation backend si possible
  - sinon creation locale
  - likes/suppressions: backend si possible, sinon local

### 17.5 Communaute

Fichier: `js/communaute.js`

- Endpoints cibles:
  - `api/idees/index.php` (GET)
  - `api/idees/like.php` (POST)
- Fallback local:
  - `localStorage["idees_page"]`
  - `localStorage["idees_communaute_likes"]`

### 17.6 Signalements (formulaire principal)

Fichier: `js/signalement.js`

- Endpoints cibles:
  - `api/signalements/index.php` (GET/POST)
  - `api/signalements/delete.php` (POST)
- Fallback local: `localStorage["signalements"]`
- Comportement:
  - chargement backend au demarrage + fusion locale
  - creation backend prioritaire
  - sinon creation locale
  - suppression backend si ID serveur disponible, sinon locale

Note:

- le bouton "vider tous" reste local pour l'instant (pas d'endpoint bulk).

### 17.7 Suivi

Fichier: `js/suivi.js`

- Endpoint mis a jour vers `api/signalements/index.php`
- Fallback local conserve si backend indisponible

### 17.8 Accueil (compteurs)

Fichier: `js/index.js`

- Endpoints mis a jour:
  - `api/signalements/index.php`
  - `api/idees/index.php`
- Fusion backend + local pour afficher des compteurs robustes

## 18) Pourquoi garder le fallback pendant la transition

- Tu peux continuer de tester le frontend meme si le backend n'est pas encore deploye partout.
- Tu evites une coupure brutale de fonctionnalites.
- Tu avances page par page en securite.

Quand tout sera stable, tu pourras supprimer progressivement les fallback localStorage.

## 19) Depannage rapide (problemes frequents)

### 19.1 Message "enregistre en local (backend indisponible)"

Ce message apparait dans 2 cas:

1. Le backend est vraiment injoignable (cas reseau/server).
2. Le backend refuse la requete (erreur de validation), mais le frontend confondait cela avec une indisponibilite.

Correction appliquee:

- Le frontend distingue maintenant:
  - backend joignable mais erreur de validation -> affiche le message backend
  - backend injoignable -> fallback localStorage

Important pour que le backend reponde vraiment:

- Les fichiers `.php` doivent etre servis par un serveur PHP (pas seulement ouverts en `file://`).
- Si tu ouvres juste les fichiers HTML directement, `fetch` vers PHP ne pourra pas fonctionner correctement.

### 19.2 Photo d'une idee qui n'apparait pas

Cause:

- La photo n'etait pas lue depuis l'input fichier dans `js/idees.js`, donc rien n'etait envoye ni affiche.

Correction appliquee:

- Lecture de la photo en base64 (`FileReader`) avant l'envoi.
- Envoi de `photo` au backend idees.
- Affichage de la photo dans les cartes des pages Idees et Communaute.

Note:

- La page Idees affiche des cartes (cards), pas une carte geographique Leaflet.
- La carte geographique est utilisee pour les Signalements.

## 20) Bouton Connexion dynamique (Connecte / Deconnexion)

Comportement ajoute:

1. Si utilisateur non connecte:

- le bouton de navigation affiche `Connexion`
- clic -> ouvre la page `connexion.html`

2. Si utilisateur connecte:

- le texte devient `Connecte`
- clic -> ouvre un petit panneau avec:
  - identite (nom)
  - email (si disponible)
  - bouton `Deconnexion`

3. Quand on clique sur `Deconnexion`:

- tentative de logout backend (`api/auth/logout.php`)
- nettoyage de la session locale (`auth_connected`, `user_nom`, `user_email`)
- le bouton redevient `Connexion`

Fichiers concernes:

- `js/utils.js`: logique globale du bouton nav et panneau utilisateur
- `js/connexion.js`: memorisation des infos de session locale apres login

---

Prochaine etape recommandee: connecter progressivement tes fichiers JS frontend a ces endpoints PHP (en gardant un fallback local si tu veux).
