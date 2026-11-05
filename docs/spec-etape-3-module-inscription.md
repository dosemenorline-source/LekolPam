# Spec — Étape 3 : Module Inscription

**Projet :** Lekòl Pam
**Date :** 2026-07-08
**Statut :** en revue (pas encore démarré)
**Portée :** backend uniquement

---

## 1. Objectif

Permettre à un parent (connecté et vérifié) de soumettre une inscription pour son enfant,
de téléverser les documents requis, et de suivre le statut du dossier ; permettre au
secrétariat (admin/direction) de consulter la file des dossiers, de les traiter
(accepter / refuser / demander un complément) avec **traçabilité** et **notification
courriel** au parent.

## 2. Décisions confirmées (2026-07-08)

- **Stockage documents : disque local + `multer`**, dossier `backend/uploads/inscriptions/`.
  Nom de fichier unique (aléatoire), chemin stocké en base. **Max 5 Mo**, formats **PDF/JPG/PNG**.
- **Notifications courriel intégrées maintenant** : chaque changement de statut envoie un
  courriel au parent (via Nodemailer, déjà en place).
- **Comptes admin/direction via script `npm run seed`** (comptes de test déjà vérifiés).

## 3. Règles de gestion (spec technique § 4.1)

- Le dossier est créé au statut **`en_attente`**.
- Le secrétariat peut passer à **`accepte`**, **`refuse`**, ou **`complement_demande`**.
- Un dossier **ne peut PAS passer à `confirmee`** via ce module : `confirmee` sera fixé par
  le module Paiement (après validation du paiement des frais). Toute tentative → refus (409).
- **Historique** de tous les changements de statut conservé (horodatage + auteur + commentaire).
- Un **parent ne voit que ses propres dossiers** ; admin/direction voient tout. Contrôle
  d'accès appliqué côté serveur.
- Seul un parent **au courriel vérifié** peut soumettre une inscription.

## 4. Flux

1. `POST /api/inscriptions` (parent) → crée l'élève (rattaché au parent) + l'inscription
   `en_attente`, journalise `historique_statut` (création).
2. `POST /api/inscriptions/:id/documents` (parent propriétaire, multipart) → téléverse un
   document (`acte_naissance` | `bulletin` | `photo`), enregistré `en_attente`.
3. `GET /api/inscriptions` (parent) → ses dossiers ; `GET /api/inscriptions/:id` → détail
   (parent propriétaire ou admin/direction).
4. `GET /api/admin/inscriptions?statut=&niveau=` (admin/direction) → file filtrable.
5. `PATCH /api/inscriptions/:id/statut` (admin/direction) `{ statut, commentaire? }` →
   change le statut (transitions autorisées), journalise `historique_statut`, **envoie un
   courriel** au parent.
6. `GET /api/documents-soumis/:id/fichier` (propriétaire ou admin) → télécharge le fichier.

## 5. Endpoints

| Méthode | Endpoint                               | Accès                    |
|---------|----------------------------------------|--------------------------|
| POST    | `/api/inscriptions`                    | parent (vérifié)         |
| GET     | `/api/inscriptions`                    | parent (les siens)       |
| GET     | `/api/inscriptions/:id`                | parent propriétaire / admin / direction |
| POST    | `/api/inscriptions/:id/documents`      | parent propriétaire      |
| GET     | `/api/inscriptions/:id/documents`      | parent propriétaire / admin / direction |
| GET     | `/api/documents-soumis/:id/fichier`    | parent propriétaire / admin / direction |
| GET     | `/api/admin/inscriptions`              | admin / direction        |
| PATCH   | `/api/inscriptions/:id/statut`         | admin / direction        |

### Corps de requête (indicatif)

```jsonc
// POST /api/inscriptions
{ "eleveNom": "Marie Joseph", "dateNaissance": "2015-04-12",
  "niveau": "6e année", "anneeScolaire": "2026-2027" }

// PATCH /api/inscriptions/:id/statut
{ "statut": "accepte", "commentaire": "Dossier complet." }
```

## 6. Modèle de données

Les tables existent déjà (Étape 2). Un seul ajout, par **migration 003** :

```sql
-- Commentaire du secrétariat lié à un changement de statut (motif de refus, complément…)
ALTER TABLE historique_statut
  ADD COLUMN commentaire VARCHAR(500) AFTER nouveau_statut;
```

Chaîne de propriété vérifiée côté serveur :
`utilisateurs.id → parents.id → eleves.id_parent → inscriptions.id_eleve`.

## 7. Structure de code ajoutée

```
src/
  config/upload.js                 config multer (disque, filtre type, limite 5 Mo)
  models/inscription.model.js      créer, lister, détail, changer statut, ownership
  models/document.model.js         enregistrer / lister / lire un document soumis
  models/historique.model.js       journaliser un changement de statut
  services/inscription.service.js  logique métier + notification courriel
  controllers/inscription.controller.js
  routes/inscription.routes.js
uploads/inscriptions/              fichiers téléversés (git-ignoré)
db/migrations/003_inscription.sql
scripts/seed.js                    crée comptes admin + direction (vérifiés)
```

Variables `.env` : aucune nouvelle (réutilise DB, session, SMTP). Le dossier `uploads/`
est ajouté à `.gitignore`.

## 8. Sécurité

- Validation stricte du **type MIME** et de la **taille** des fichiers (multer + vérif).
- Nom de fichier **généré** (aléatoire) — jamais le nom fourni par l'utilisateur (anti-traversal).
- Fichiers servis uniquement via endpoint **protégé** (contrôle de propriété), pas en statique public.
- Transitions de statut validées côté serveur ; `confirmee` interdit ici.
- Rate limiting sur le téléversement (endpoint sensible).

## 9. Critères de fin d'étape

- [ ] `npm run seed` crée un admin et une direction (courriel vérifié).
- [ ] Un parent vérifié crée une inscription (`en_attente`) ; un non-vérifié est refusé.
- [ ] Le parent téléverse un PDF/JPG/PNG ≤ 5 Mo ; un fichier trop gros ou d'un mauvais type est refusé.
- [ ] Un parent ne voit pas le dossier d'un autre parent (403/404).
- [ ] Admin liste la file, filtre par statut, change le statut → `historique_statut` mis à jour.
- [ ] Passage à `confirmee` refusé (409).
- [ ] Un courriel de notification part à chaque changement de statut (aperçu Ethereal en dev).
- [ ] Le fichier n'est téléchargeable que par le propriétaire ou un admin.
```
