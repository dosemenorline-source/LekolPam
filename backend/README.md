# Backend — Lekòl Pam

API Node.js + Express + MySQL.
- Étape 1 : fondation + authentification (session cookie httpOnly).
- Étape 2 : vérification du courriel par OTP + modèle de données complet.
- Étape 3 : module Inscription (dossiers, téléversement de documents, traitement admin).
- Étape 4 : module Notes & Bulletins (matières/coefficients, notes, publication par niveau/trimestre, bulletin PDF).
- Étape 5 : module Paiements (dépôt/MonCash, preuve, validation manuelle, relevé/duplicata PDF).

## Prérequis

- Node.js 18+ (testé sur v24)
- MySQL 8.4 (serveur)

## Configuration

```bash
cp .env.example .env   # puis remplir les valeurs (DB, SESSION_SECRET)
npm install
```

## Base de données

Créer la base et les tables :

```bash
mysql -u root -p < db/schema.sql
```

> En développement local, un serveur MySQL a été initialisé sans mot de passe root
> dans `C:/Users/Hz/mysql-lekol/data`. Pour le démarrer :
>
> ```bash
> "/c/Program Files/MySQL/MySQL Server 8.4/bin/mysqld.exe" \
>   --datadir="C:/Users/Hz/mysql-lekol/data" --port=3306 --console
> ```

## Démarrer le serveur

```bash
npm run dev     # avec rechargement automatique
npm start       # simple
```

Le serveur écoute sur `http://localhost:4000`.

## Endpoints

| Méthode | Endpoint                       | Accès    | Détail |
|---------|--------------------------------|----------|--------|
| GET     | `/api/health`                  | public   | —      |
| POST    | `/api/auth/register`           | public   | crée un `parent` non vérifié + envoie un OTP (pas de session) |
| POST    | `/api/auth/verifier-courriel`  | public   | valide l'OTP → courriel vérifié + session ouverte |
| POST    | `/api/auth/renvoyer-code`      | public   | renvoie un nouvel OTP (rate limité) |
| POST    | `/api/auth/login`              | public   | refuse (403) si courriel non vérifié |
| POST    | `/api/auth/logout`             | connecté | —      |
| GET     | `/api/auth/me`                 | connecté | —      |
| GET     | `/api/prive/ping`              | connecté | tous   |
| GET     | `/api/admin/ping`              | connecté | admin / direction |

Authentification par **session (cookie httpOnly)**. Le frontend doit envoyer les
requêtes avec `credentials: 'include'`.

### Module Inscription

| Méthode | Endpoint                            | Accès |
|---------|-------------------------------------|-------|
| POST    | `/api/inscriptions`                 | parent — crée élève + dossier (`en_attente`) |
| GET     | `/api/inscriptions`                 | parent — ses dossiers |
| GET     | `/api/inscriptions/:id`             | propriétaire / admin / direction |
| POST    | `/api/inscriptions/:id/documents`   | parent propriétaire — multipart `fichier` + `type` (PDF/JPG/PNG, 5 Mo) |
| GET     | `/api/inscriptions/:id/documents`   | propriétaire / admin / direction |
| GET     | `/api/documents-soumis/:id/fichier` | propriétaire / admin / direction |
| GET     | `/api/admin/inscriptions?statut=&niveau=` | admin / direction |
| PATCH   | `/api/inscriptions/:id/statut`      | admin / direction — `accepte` / `refuse` / `complement_demande` (jamais `confirmee`) |

Chaque changement de statut est journalisé (`historique_statut`) et notifié au parent
par courriel. Comptes de test : `npm run seed` (`admin@lekol.ht`/`admin1234`,
`direction@lekol.ht`/`direction1234`). Fichiers téléversés dans `backend/uploads/` (git-ignoré).

### Module Notes & Bulletins

| Méthode | Endpoint                              | Accès |
|---------|---------------------------------------|-------|
| POST    | `/api/matieres`                       | direction — `{ nom, niveau, coefficient }` |
| GET     | `/api/matieres?niveau=`               | admin / direction |
| PATCH   | `/api/matieres/:id`                   | direction — coefficient / actif |
| POST    | `/api/notes`                          | admin — `{ idEleve, idMatiere, periode, anneeScolaire, valeur }` |
| PATCH   | `/api/notes/:id`                      | admin — corriger la valeur (refusé si publié) |
| PATCH   | `/api/notes/:id/valider`              | admin |
| GET     | `/api/admin/notes?niveau=&periode=&anneeScolaire=` | admin / direction |
| GET     | `/api/eleves/:id/notes`               | propriétaire (validées+publiées) / admin / direction (toutes) |
| POST    | `/api/publications`                   | direction — `{ niveau, anneeScolaire, trimestre }` → publie + bulletins + courriels |
| GET     | `/api/publications`                   | admin / direction |
| GET     | `/api/eleves/:id/bulletins`           | propriétaire / admin / direction |
| GET     | `/api/documents-officiels/:id/fichier`| propriétaire / admin / direction |

Trimestres : `1er_trimestre`, `2e_trimestre`, `3e_trimestre`. Notes /100, moyenne
**pondérée par coefficient**. Les notes ne sont visibles par les familles que si elles sont
**validées ET** le couple (niveau, trimestre) est **publié**. À la publication, un **bulletin
PDF** (`pdf-lib`) est généré par élève dans `backend/uploads/bulletins/` et notifié par courriel.

### Module Paiements

| Méthode | Endpoint                          | Accès |
|---------|-----------------------------------|-------|
| POST    | `/api/tarifs`                     | direction — `{ typeFrais, montant, devise, dateEffective }` |
| GET     | `/api/tarifs`                     | connecté |
| PUT     | `/api/tarifs/:id`                 | direction |
| PUT     | `/api/ecole`                      | direction — `{ nom, coordonneesBancaires, coordonneesMoncash }` |
| GET     | `/api/ecole/coordonnees`          | connecté |
| POST    | `/api/paiements`                  | parent — `{ typeFrais, idReference }` → montant + coordonnées |
| POST    | `/api/paiements/:id/preuve`       | parent propriétaire — multipart `preuve` (PDF/JPG/PNG, 5 Mo) |
| GET     | `/api/paiements`                  | parent — les siens |
| GET     | `/api/paiements/:id`              | propriétaire / admin / direction |
| GET     | `/api/paiements/:id/preuve`       | propriétaire / admin / direction |
| GET     | `/api/admin/paiements?statut=`    | admin / direction |
| PATCH   | `/api/paiements/:id/validation`   | admin / direction — `{ statut: 'valide'|'rejete', commentaire? }` |

Flux identique pour `inscription` / `releve` / `duplicata`. `idReference` = id d'inscription
(frais d'inscription, doit être `accepte`) ou id d'élève (relevé/duplicata). À la validation :
inscription → `confirmee` ; relevé → transcript PDF (toutes notes validées) ; duplicata →
copie étiquetée « DUPLICATA ». Aucune donnée bancaire stockée, seulement l'image de la preuve.

### Création de compte

`POST /api/auth/register` crée le compte parent et **ouvre directement la session** :
il n'y a pas de vérification du courriel par code. L'adresse saisie n'est donc pas
prouvée — c'est un choix assumé pour ne pas dépendre d'un service d'envoi de courriel.

La colonne `courriel_verifie` est conservée dans le schéma (mise à `1` à la création)
afin de pouvoir réactiver cette étape plus tard sans migration.

### Courriel (SMTP)

Le courriel reste utilisé pour la réinitialisation de mot de passe et les notifications
(inscriptions, paiements, bulletins). Les envois sont réels dans tous les environnements :
il n'y a pas de mode « bac à sable ». Renseigner `SMTP_HOST/PORT/USER/PASS` dans `.env`
(fournisseur retenu : **Brevo**, voir `.env.example`). Le serveur teste les identifiants
au démarrage et affiche `✔ Courriel actif` ou `⚠ Courriel INACTIF` sans jamais s'arrêter.

Codes de réinitialisation : 6 chiffres, hachés en base, expiration 10 min, max 5 tentatives.

## Structure

```
src/
  config/db.js              connexion MySQL (pool)
  models/user.model.js      requêtes SQL comptes
  controllers/auth.controller.js
  middleware/auth.js        requireAuth, requireRole
  middleware/rateLimit.js   limite les tentatives auth
  routes/auth.routes.js
  app.js                    config Express + session
  server.js                 point d'entrée
db/schema.sql               création des tables
```
