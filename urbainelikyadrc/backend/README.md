# Backend PHP (sans framework) - MySQL pur

> Mise a jour (mars 2026): le backend runtime n'utilise plus `core/storage.php` ni les lectures/ecritures JSON.
> Les fichiers `backend/data/*.json` sont conserves uniquement comme archives de migration.

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
- `POST /backend/api/auth/forgot-password.php`
- `POST /backend/api/auth/reset-password.php`

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

### 5.3b Protection Double Couche d'Authentification

**Qu'est-ce que c'est ?**

La "protection double couche" signifie qu'une meme protection est appliquee a deux niveaux:

- **Niveau 1 (Frontend)**: Verification JavaScript avant envoyer la donnee
- **Niveau 2 (Backend)**: Verification PHP en recevant la donnee

**Pourquoi ?**

- **Frontend**: Empeche les clics inutiles, redirige vite l'utilisateur
- **Backend**: Refuse les requetes "piratees" ou envoyees directement sans passer par le frontend

**Exemple concret: Proposer une Idee**

#### Avant la protection (non securise)

```
Non authentifie -> Clique "Soumettre" -> Formulaire s'envoie
-> Backend accepte (pas de verification) -> Idee creee par un faux utilisateur
```

#### Avec protection double couche (securise)

```
Non authentifie -> Clique "Soumettre"
-> NIVEAU 1: Frontend verifie `localStorage.auth_connected`
  Si non: alert "Connectez-vous d'abord" + redirection vers connexion.html
  Si oui: Continue -> Envoie la requete
-> NIVEAU 2: Backend appelle `require_auth_user()`
  Si pas connecte: Retourne erreur 401 "Authentification requise"
  Si connecte: Continue -> Cree l'idee
```

**Fichiers concernes:**

- Frontend: `js/idees.js` (fonction `addIdee`) et `js/signalement.js` (fonction `addSignalement`)
  - Verificat: `const profile = readCurrentProfile(); if (!profile.connected) { alert(...) }`
- Backend: `backend/api/idees/index.php` et `backend/api/signalements/index.php`
  - Verificat: `require_auth_user()` qui lit `$_SESSION['auth_user']`

**Benefices:**

1. **Meilleure UX**: L'utilisateur sait tout de suite qu'il doit se connecter
2. **Securite**: Les requetes pirateees sont bloquees au backend aussi
3. **Fiabilite**: Si le JavaScript est desactive chez l'utilisateur, le PHP bloque quand meme

### 5.4 Concurrence sur JSON

Comme JSON n'est pas une vraie base transactionnelle:

- lire -> modifier -> ecrire sous verrou (`LOCK_EX`)
- faire des sauvegardes dans `data/_archive/`
- journaliser les erreurs dans `logs/app.log`

## 6) Authentification et Sessions

### 6.1 Comment fonctionnent les sessions PHP

Quand un utilisateur se connecte (login):

```php
$_SESSION['auth_user'] = ['id' => 'usr_...', 'email' => 'test@example.com', ...];
```

Cette donnee reste en memoire du serveur tant que:

- L'utilisateur n'a pas fait logout
- La session n'a pas expire (par defaut 24 min en PHP)

Pour verifier si quelqu'un est connecte:

```php
$user = $_SESSION['auth_user'] ?? null;
if (!is_array($user)) {
  // Pas connecte
}
```

### 6.2 La fonction `require_auth_user()`

Elle est dans `backend/core/auth.php` et fait:

```php
function require_auth_user(): array
{
    $user = $_SESSION['auth_user'] ?? null;
    if (!is_array($user)) {
        json_error('Authentification requise.', [], 401);
    }
    return $user;
}
```

Explique: Si `$_SESSION['auth_user']` n'existe pas ou n'est pas un array, on envoie une erreur 401 au client et on arrete tout.

C'est utilise dans les endpoints sensibles:

- `api/idees/index.php` (POST) - on appelle `require_auth_user()` avant de creer une idee
- `api/signalements/index.php` (POST) - on appelle `require_auth_user()` avant de creer un signalement

## 7) Mapping avec tes pages actuelles

- `html/inscription.html` + `js/inscription.js` -> `auth/register.php`
- `html/connexion.html` + `js/connexion.js` -> `auth/login.php`
- `html/signaler.html` + `js/signalement.js` -> `signalements/index.php`
- `html/idees.html` + `js/idees.js` -> `idees/index.php`, `idees/like.php`
- `html/contact.html` + `js/contact.js` -> `messages/contact.php`
- `html/suivi.html` + `js/suivi.js` -> `signalements/index.php` (GET)

## 8) Convention de migration future vers vraie DB

Quand tu passeras de JSON vers MySQL/PostgreSQL:

- garder les memes endpoints et payloads
- remplacer uniquement `core/storage.php`
- conserver les IDs (`usr_*`, `sig_*`, `ide_*`, `msg_*`)
- ajouter des indexes sur `email`, `timestamp`, `status`

Ainsi, le frontend change tres peu.

## 9) Plan de mise en place (sans execution pour l'instant)

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

## 10) Limites connues de JSON (important)

JSON est tres bien pour test/prototype, mais limite si:

- plusieurs utilisateurs ecrivent en meme temps
- gros volume de donnees
- besoin de recherche complexe

Conclusion: JSON est parfait pour ta phase actuelle de test, mais prevois une migration SQL des que l'usage reel augmente.

## 11) Guide debutant (ordre simple pour apprendre)

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

## 16) Migration MySQL avec methode Merise (MCD, MLD, MPD)

Objectif: passer de la base JSON vers une base relationnelle MySQL en gardant la logique actuelle de ton projet.

### 16.1 MCD (Modele Conceptuel de Donnees)

Entites principales:

- UTILISATEUR
  - id_utilisateur
  - nom
  - prenom
  - surnom
  - email
  - mot_de_passe_hash
  - role
  - created_at

- SIGNALEMENT
  - id_signalement
  - titre
  - type
  - description
  - lieu
  - latitude
  - longitude
  - photo_path
  - status
  - created_at

- IDEE
  - id_idee
  - titre
  - categorie
  - description
  - photo_path
  - created_at

- LIKE_IDEE
  - id_like
  - created_at

- MESSAGE_CONTACT
  - id_message
  - nom
  - email
  - sujet
  - message
  - created_at

Associations + cardinalites:

- UTILISATEUR (0,N) -- "cree" -- (1,1) SIGNALEMENT
- UTILISATEUR (0,N) -- "propose" -- (1,1) IDEE
- UTILISATEUR (0,N) -- "like" -- (1,1) LIKE_IDEE -- (1,1) IDEE (0,N)
- MESSAGE_CONTACT est independante (pas d'authentification obligatoire)

Remarque: le champ numerique `likes` dans le JSON est remplace par la table `LIKE_IDEE` pour eviter les doublons et tracer qui a aime quoi.

### 16.2 MLD (Modele Logique de Donnees)

Relations:

- UTILISATEUR(
  id_utilisateur PK,
  nom,
  prenom,
  surnom,
  email UQ,
  mot_de_passe_hash,
  role,
  created_at
  )

- SIGNALEMENT(
  id_signalement PK,
  id_utilisateur FK -> UTILISATEUR.id_utilisateur,
  titre,
  type,
  description,
  lieu,
  latitude,
  longitude,
  photo_path,
  status,
  created_at
  )

- IDEE(
  id_idee PK,
  id_utilisateur FK -> UTILISATEUR.id_utilisateur,
  titre,
  categorie,
  description,
  photo_path,
  created_at
  )

- LIKE_IDEE(
  id_like PK,
  id_idee FK -> IDEE.id_idee,
  id_utilisateur FK -> UTILISATEUR.id_utilisateur,
  created_at,
  UQ(id_idee, id_utilisateur)
  )

- MESSAGE_CONTACT(
  id_message PK,
  nom,
  email,
  sujet,
  message,
  created_at
  )

### 16.3 MPD MySQL (script SQL complet)

```sql
CREATE DATABASE IF NOT EXISTS urbainelikya_drc
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE urbainelikya_drc;

CREATE TABLE IF NOT EXISTS utilisateurs (
  id_utilisateur VARCHAR(50) PRIMARY KEY,
  nom VARCHAR(100) NOT NULL,
  prenom VARCHAR(100) NOT NULL,
  surnom VARCHAR(100) NULL,
  email VARCHAR(190) NOT NULL,
  mot_de_passe_hash VARCHAR(255) NOT NULL,
  role ENUM('citoyen', 'admin') NOT NULL DEFAULT 'citoyen',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_utilisateurs_email (email)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS signalements (
  id_signalement VARCHAR(50) PRIMARY KEY,
  id_utilisateur VARCHAR(50) NOT NULL,
  titre VARCHAR(150) NOT NULL,
  type ENUM('voirie', 'eau', 'electricite', 'insecurite', 'dechet') NOT NULL,
  description TEXT NOT NULL,
  lieu VARCHAR(255) NOT NULL,
  latitude DECIMAL(10,7) NOT NULL,
  longitude DECIMAL(10,7) NOT NULL,
  photo_path VARCHAR(255) NULL,
  status ENUM('nouveau', 'en_cours', 'resolu') NOT NULL DEFAULT 'nouveau',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_signalements_utilisateur
    FOREIGN KEY (id_utilisateur) REFERENCES utilisateurs(id_utilisateur)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  KEY idx_signalements_status_created (status, created_at),
  KEY idx_signalements_type (type)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS idees (
  id_idee VARCHAR(50) PRIMARY KEY,
  id_utilisateur VARCHAR(50) NOT NULL,
  titre VARCHAR(150) NOT NULL,
  categorie ENUM('infrastructure', 'environnement', 'services-publics', 'transport', 'autre') NOT NULL,
  description TEXT NOT NULL,
  photo_path VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_idees_utilisateur
    FOREIGN KEY (id_utilisateur) REFERENCES utilisateurs(id_utilisateur)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  KEY idx_idees_categorie_created (categorie, created_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS likes_idee (
  id_like BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  id_idee VARCHAR(50) NOT NULL,
  id_utilisateur VARCHAR(50) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_likes_idee_idee
    FOREIGN KEY (id_idee) REFERENCES idees(id_idee)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_likes_idee_utilisateur
    FOREIGN KEY (id_utilisateur) REFERENCES utilisateurs(id_utilisateur)
    ON UPDATE CASCADE ON DELETE CASCADE,
  UNIQUE KEY uq_like_unique (id_idee, id_utilisateur),
  KEY idx_likes_idee_created (created_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS messages_contact (
  id_message VARCHAR(50) PRIMARY KEY,
  nom VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL,
  sujet VARCHAR(180) NOT NULL,
  message TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_messages_contact_created (created_at)
) ENGINE=InnoDB;
```

### 16.4 Mapping JSON -> SQL

- `data/users.json` -> `utilisateurs`
- `data/signalements.json` -> `signalements`
- `data/idees.json` -> `idees`
- `data/messages.json` -> `messages_contact`

Notes de mapping:

- `timestamp` JSON devient `created_at` (DATETIME)
- `photo` JSON devient `photo_path`
- `password_hash` JSON devient `mot_de_passe_hash`
- `likes` (compteur) devient `COUNT(*)` sur `likes_idee`

### 16.5 Requetes utiles (equivalent endpoints)

Compter les likes d'une idee:

```sql
SELECT i.id_idee, i.titre, COUNT(li.id_like) AS likes
FROM idees i
LEFT JOIN likes_idee li ON li.id_idee = i.id_idee
GROUP BY i.id_idee, i.titre;
```

Recuperer les signalements d'un utilisateur:

```sql
SELECT s.*
FROM signalements s
WHERE s.id_utilisateur = ?
ORDER BY s.created_at DESC;
```

Dashboard rapide:

```sql
SELECT
  (SELECT COUNT(*) FROM utilisateurs) AS total_utilisateurs,
  (SELECT COUNT(*) FROM signalements) AS total_signalements,
  (SELECT COUNT(*) FROM idees) AS total_idees,
  (SELECT COUNT(*) FROM messages_contact) AS total_messages;
```

### 16.6 Etapes de migration conseillees

1. Creer la base MySQL avec le script MPD ci-dessus.
2. Ecrire un script PHP de migration JSON -> MySQL (import initial).
3. Adapter `core/storage.php` pour utiliser PDO MySQL.
4. Garder les memes endpoints API pour ne pas casser le frontend.
5. Tester endpoint par endpoint (auth, signalements, idees, contact).

### 16.7 Complements utiles

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

## 18) Schema visuel simple (ASCII)

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

## 17) Statut actuel (MySQL pur)

Mise a jour: le backend est passe en mode **MySQL pur** pour les endpoints principaux.

Endpoints en MySQL pur (sans fallback JSON):

- `api/auth/register.php`
- `api/auth/login.php`
- `api/messages/contact.php`
- `api/signalements/index.php` (GET + POST)
- `api/signalements/show.php`
- `api/signalements/delete.php`
- `api/idees/index.php` (GET + POST)
- `api/idees/like.php`
- `api/idees/delete.php`
- `api/stats/dashboard.php`

Nettoyage backend applique:

- `core/storage.php` supprime (obsolete en runtime).
- `core/uploads.php` ajoute pour gerer `persist_data_url_image()`.
- `require_once .../core/storage.php` retire des endpoints encore references.
- Dossier vide `data/_archive/` supprime.

Comportement actuel:

- Si MySQL est disponible: reponse normale.
- Si MySQL est indisponible: le backend renvoie une erreur serveur (plus de fallback local JSON cote backend).

Important:

- Les sections suivantes sur le fallback servent d'historique de migration.
- Le mode recommande en production est maintenant MySQL uniquement.

## 18) Transition frontend JS -> backend PHP (historique)

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

## 19) Pourquoi garder le fallback pendant la transition

- Tu peux continuer de tester le frontend meme si le backend n'est pas encore deploye partout.
- Tu evites une coupure brutale de fonctionnalites.
- Tu avances page par page en securite.

Quand tout sera stable, tu pourras supprimer progressivement les fallback localStorage.

## 20) Depannage rapide (problemes frequents)

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

## 21) Bouton Connexion dynamique (Connecte / Deconnexion)

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

## 22) Comment relier ton travail a SQL (MySQL Workbench)

But: connecter ton backend PHP actuel (JSON) a une base MySQL sans casser ton frontend.

### 21.1 Etape 1 - Creer la connexion dans MySQL Workbench

1. Ouvrir MySQL Workbench.
2. Cliquer sur `+` dans `MySQL Connections`.
3. Renseigner:
   - Connection Name: `urbainelikya-local`
   - Hostname: `127.0.0.1`
   - Port: `3306`
   - Username: `root` (ou ton utilisateur MySQL)
4. Cliquer `Test Connection` puis `OK`.

### 21.2 Etape 2 - Creer la base et les tables

1. Ouvrir une nouvelle requete SQL dans Workbench.
2. Copier le script de la section `16.3 MPD MySQL`.
3. Executer tout le script (icône eclair).
4. Verifier ensuite avec:

```sql
USE urbainelikya_drc;
SHOW TABLES;
```

Si tu vois `utilisateurs`, `signalements`, `idees`, `likes_idee`, `messages_contact`, le schema est en place.

### 21.3 Etape 3 - Configurer PHP pour parler a MySQL (PDO)

Ton projet doit remplacer progressivement la lecture JSON par des requetes SQL.

Exemple minimal de connexion PDO:

```php
<?php
$dsn = 'mysql:host=127.0.0.1;port=3306;dbname=urbainelikya_drc;charset=utf8mb4';
$user = 'root';
$pass = '';

$pdo = new PDO($dsn, $user, $pass, [
  PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
  PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
]);
```

Conseil pratique:

- cree un fichier dedie (exemple: `core/db.php`) qui retourne `$pdo`
- reutilise cette connexion dans les endpoints

### 21.4 Etape 4 - Migrer sans tout casser

Ordre recommande:

1. Garder les endpoints actuels (`api/...`) et changer seulement la couche stockage.
2. Commencer par `messages/contact.php` (plus simple).
3. Migrer `auth/register.php` et `auth/login.php`.
4. Migrer `signalements/index.php` (GET puis POST).
5. Migrer `idees/index.php` puis `idees/like.php`.

### 21.5 Etape 5 - Verifications a faire

- Inscription: l'utilisateur apparait dans `utilisateurs`.
- Connexion: la session PHP fonctionne toujours.
- Signalement: insertion dans `signalements` avec `id_utilisateur` valide.
- Idee: insertion dans `idees` avec FK utilisateur.
- Like: insertion dans `likes_idee` et respect de l'unicite `(id_idee, id_utilisateur)`.

### 21.6 Erreurs frequentes et solutions rapides

- `Access denied for user`: mauvais username/password MySQL.
- `Connection refused`: MySQL serveur non demarre.
- `Base unknown`: `urbainelikya_drc` non creee ou faute de nom.
- Erreur accents/caracteres: verifier `charset=utf8mb4` dans DSN.

Resultat attendu: ton frontend ne change presque pas, mais les donnees ne dependent plus de fichiers JSON.

---

Prochaine etape recommandee: finaliser la suppression des fallback localStorage cote frontend pour aligner toute l'application sur MySQL pur.

## 23) Inscription securisee + reinitialisation mot de passe

Comportement ajoute:

- Apres creation du compte, `api/auth/register.php` envoie un email de bienvenue (sans mot de passe en clair).
- Cet email peut contenir un lien de reinitialisation a usage unique, valable 30 minutes.
- Si un utilisateur oublie son mot de passe:
  - il envoie son email sur `POST /backend/api/auth/forgot-password.php`
  - il recoit un lien avec `token=...`
  - il envoie ensuite `POST /backend/api/auth/reset-password.php` avec `token` + `new_password`
- La reponse JSON d'inscription inclut `welcome_email_sent` (`true` ou `false`).

Configuration simple:

- Le backend utilise `core/mailer.php` avec priorite SMTP (Gmail compatible).
- Variables d'environnement recommandees:
  - `APP_NAME` (nom de l'application dans l'expediteur)
  - `MAIL_FROM` (email expediteur, exemple: `no-reply@tondomaine.com`)
  - `MAIL_SMTP_ENABLED=true`
  - `MAIL_SMTP_HOST=smtp.gmail.com`
  - `MAIL_SMTP_PORT=465`
  - `MAIL_SMTP_USER=toncompte@gmail.com`
  - `MAIL_SMTP_PASS=mot_de_passe_application_gmail`
  - `PASSWORD_RESET_URL_BASE=http://127.0.0.1:8000/backend/api/auth/reset-password.php`

Exemple PowerShell avant de lancer le serveur:

```powershell
$env:MAIL_SMTP_ENABLED="true"
$env:MAIL_SMTP_HOST="smtp.gmail.com"
$env:MAIL_SMTP_PORT="465"
$env:MAIL_SMTP_USER="toncompte@gmail.com"
$env:MAIL_SMTP_PASS="xxxx xxxx xxxx xxxx"
$env:MAIL_FROM="toncompte@gmail.com"
php -S 127.0.0.1:8000 -t .
```

Important:

- Pour Gmail, il faut activer la validation en 2 etapes puis creer un mot de passe d'application.
- Si SMTP echoue, le backend tente un fallback `mail()`.
- Si l'envoi echoue, le compte est quand meme cree et un warning est ecrit dans `logs/app.log`.
- Pour la securite, le mot de passe ne doit jamais etre envoye par email en clair.
- Si le destinataire ouvre l'email depuis un autre appareil/reseau, `127.0.0.1` ne marchera pas: il faut une URL publique (domaine, IP locale accessible, ou tunnel type ngrok) dans `PASSWORD_RESET_URL_BASE`.

php -S 127.0.0.1:8000 -t .
