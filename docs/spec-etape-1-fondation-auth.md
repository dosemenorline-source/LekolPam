# Spec — Étape 1 : Fondation du projet + Authentification

**Projet :** Lekòl Pam
**Date :** 2026-07-08
**Statut :** en revue (pas encore démarré)

---

## 1. Objectif

Mettre en place le squelette du projet (backend Express + frontend React + base MySQL) et le module d'authentification qui sert de base à tous les autres modules. À la fin de cette étape, un utilisateur peut créer un compte, se connecter, se déconnecter, et l'accès aux routes est contrôlé par rôle côté serveur.

## 2. Périmètre

**Inclus :**
- Structure des dossiers `/backend` et `/frontend`.
- Connexion à MySQL + schéma des tables de base : `utilisateurs`, `parents`, `eleves`.
- Endpoints d'authentification : register, login, logout, profil courant.
- Hachage des mots de passe (bcrypt), jamais en clair.
- Middleware de contrôle d'accès par rôle (`requireAuth`, `requireRole`).
- Écrans React : inscription, connexion, page d'accueil protégée simple.

**Hors périmètre (étapes suivantes) :**
- Modules Inscription, Notes, Paiements, Tableau de bord.
- Notifications (courriel/SMS).
- Génération PDF.

## 3. Structure des dossiers (proposée)

```
Lekol Pam/
├── backend/
│   ├── src/
│   │   ├── config/        # connexion MySQL, variables d'env
│   │   ├── controllers/   # logique des routes (auth.controller.js)
│   │   ├── middleware/    # requireAuth, requireRole, rate limiting
│   │   ├── models/        # requêtes SQL (user.model.js)
│   │   ├── routes/        # auth.routes.js
│   │   └── app.js         # config Express
│   ├── db/
│   │   └── schema.sql     # création des tables
│   ├── .env.example
│   └── package.json
└── frontend/
    ├── src/
    │   ├── pages/         # Login, Register, Accueil
    │   ├── components/
    │   ├── services/      # api.js (appels vers le backend)
    │   └── App.jsx
    └── package.json
```

## 4. Schéma MySQL (tables de cette étape)

```sql
-- utilisateurs : compte + rôle unique
CREATE TABLE utilisateurs (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  nom           VARCHAR(120) NOT NULL,
  courriel      VARCHAR(180) NOT NULL UNIQUE,
  mot_de_passe_hash VARCHAR(255) NOT NULL,
  role          ENUM('parent','eleve','admin','direction') NOT NULL,
  statut        ENUM('actif','inactif') NOT NULL DEFAULT 'actif',
  cree_le       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- parents : infos complémentaires liées à un utilisateur de rôle 'parent'
CREATE TABLE parents (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  id_utilisateur INT NOT NULL,
  telephone      VARCHAR(40),
  adresse        VARCHAR(255),
  FOREIGN KEY (id_utilisateur) REFERENCES utilisateurs(id) ON DELETE CASCADE
);

-- eleves : rattaché à un parent (au moins un)
CREATE TABLE eleves (
  id                 INT AUTO_INCREMENT PRIMARY KEY,
  id_parent          INT NOT NULL,
  nom                VARCHAR(120) NOT NULL,
  date_naissance     DATE,
  niveau             VARCHAR(60),
  statut_inscription ENUM('en_attente','accepte','refuse','confirmee') NOT NULL DEFAULT 'en_attente',
  FOREIGN KEY (id_parent) REFERENCES parents(id) ON DELETE CASCADE
);
```

## 5. Endpoints d'authentification

| Méthode | Endpoint            | Rôle    | Description |
|---------|---------------------|---------|-------------|
| POST    | `/api/auth/register`| Tous    | Créer un compte (par défaut rôle `parent`) |
| POST    | `/api/auth/login`   | Tous    | Se connecter, ouvre une session |
| POST    | `/api/auth/logout`  | Connecté| Fermer la session |
| GET     | `/api/auth/me`      | Connecté| Retourne l'utilisateur courant |

**Règles :**
- Mot de passe haché avec bcrypt avant stockage.
- Courriel unique ; erreur claire si déjà utilisé.
- Contrôle d'accès par rôle **côté serveur** (middleware), pas seulement à l'écran.
- Rate limiting sur `/login` et `/register` pour limiter les abus.

## 6. Décisions techniques (confirmées le 2026-07-08)

1. **Authentification : session par cookie httpOnly** (confirmé).
2. **Register public : crée uniquement des comptes `parent`** (confirmé). Les comptes admin/direction/élève sont créés par l'école (étape ultérieure).
3. Gestionnaire de paquets : **npm**.

## 7. Critères de fin d'étape

- [ ] `schema.sql` s'exécute sans erreur sur MySQL.
- [ ] Un parent peut s'inscrire et se connecter depuis l'écran React.
- [ ] Une route protégée renvoie 401 sans session valide.
- [ ] Un rôle non autorisé reçoit 403 sur une route réservée.
- [ ] Les mots de passe sont stockés hachés (vérifié en base).
