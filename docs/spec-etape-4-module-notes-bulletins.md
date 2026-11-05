# Spec — Étape 4 : Module Notes & Bulletins

**Projet :** Lekòl Pam
**Date :** 2026-07-08
**Statut :** en revue (pas encore démarré)
**Portée :** backend uniquement

---

## 1. Objectif

Saisir les notes des élèves par matière et par trimestre, calculer les moyennes
**pondérées par coefficient**, **publier les notes par niveau (classe) et par trimestre**
(ce qui les rend visibles aux familles), et **générer le bulletin PDF** de chaque élève.

## 2. Décisions confirmées (2026-07-08)

- **Publication par niveau (classe) + par trimestre** — pas élève par élève. Publier un
  triplet (niveau, année scolaire, trimestre) rend visibles les notes validées de ce niveau.
- **Moyennes pondérées par coefficient.** Chaque matière a un coefficient (configuré par
  la Direction, par niveau).
- **Bulletin PDF généré dans cette étape** avec **`pdf-lib`** (pur JS, pas de dépendance
  native — cohérent avec l'hébergement local).
- **Rôles :** l'**Admin** saisit et valide les notes ; la **Direction** publie par
  niveau/trimestre (et configure les matières/coefficients).

## 3. Concepts & règles de gestion (spec technique § 4.2)

- **Trimestres :** `1er_trimestre`, `2e_trimestre`, `3e_trimestre`.
- **Statut d'une note :** `saisie` → `validee`. Seules les notes **validées** peuvent
  devenir visibles.
- **Visibilité famille :** une note est visible par le parent/élève **uniquement si**
  (a) elle est `validee` **et** (b) il existe une **publication** pour
  (niveau de l'élève, année scolaire, trimestre). Sinon elle reste masquée (saisie en cours).
- **Moyenne matière/générale :** moyenne pondérée
  `Σ(valeur × coefficient) / Σ(coefficient)` sur les notes validées du trimestre.
- **Barème :** note sur **100** (`DECIMAL(5,2)`, valeur 0–100).
- **Bulletin :** à la publication d'un (niveau, trimestre), un bulletin PDF est généré pour
  chaque élève du niveau, archivé (`documents_officiels`, type `bulletin`, identifiant unique)
  et téléchargeable par la famille.
- Un parent ne voit que les bulletins/notes de **ses** enfants ; admin/direction voient tout.

## 4. Modèle de données — migration 004

```sql
USE lekol_pam;

-- Matières + coefficient, configurées par niveau
CREATE TABLE matieres (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  nom            VARCHAR(100) NOT NULL,
  niveau         VARCHAR(60) NOT NULL,
  coefficient    DECIMAL(4,2) NOT NULL DEFAULT 1.00,
  actif          TINYINT(1) NOT NULL DEFAULT 1,
  UNIQUE KEY uniq_matiere_niveau (nom, niveau)
) ENGINE=InnoDB;

-- Publication des notes par niveau + trimestre + année
CREATE TABLE publications_notes (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  niveau         VARCHAR(60) NOT NULL,
  annee_scolaire VARCHAR(9) NOT NULL,
  trimestre      ENUM('1er_trimestre','2e_trimestre','3e_trimestre') NOT NULL,
  publie_par     INT,
  publie_le      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_publication (niveau, annee_scolaire, trimestre),
  FOREIGN KEY (publie_par) REFERENCES utilisateurs(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- La table notes existe déjà ; on la relie à matieres et on normalise la période
ALTER TABLE notes
  ADD COLUMN id_matiere INT NULL AFTER id_eleve,
  MODIFY COLUMN periode ENUM('1er_trimestre','2e_trimestre','3e_trimestre') NOT NULL,
  ADD FOREIGN KEY (id_matiere) REFERENCES matieres(id) ON DELETE SET NULL;
```

> `notes.matiere` (VARCHAR) est conservé comme **libellé figé** (copie du nom au moment de
> la saisie) pour l'affichage/bulletin, en plus de `id_matiere` (pour le coefficient).

## 5. Endpoints

### Matières (Direction configure)
| Méthode | Endpoint                    | Accès |
|---------|-----------------------------|-------|
| POST    | `/api/matieres`             | direction — `{ nom, niveau, coefficient }` |
| GET     | `/api/matieres?niveau=`     | admin / direction |
| PATCH   | `/api/matieres/:id`         | direction — modifier coefficient / actif |

### Notes (Admin saisit / valide)
| Méthode | Endpoint                       | Accès |
|---------|--------------------------------|-------|
| POST    | `/api/notes`                   | admin — `{ idEleve, idMatiere, periode, anneeScolaire, valeur }` (statut `saisie`) |
| PATCH   | `/api/notes/:id`               | admin — corriger la valeur (tant que non publié) |
| PATCH   | `/api/notes/:id/valider`       | admin — passe à `validee` |
| GET     | `/api/admin/notes?niveau=&periode=&anneeScolaire=` | admin / direction — vue de saisie |
| GET     | `/api/eleves/:id/notes?periode=&anneeScolaire=` | parent propriétaire / élève / admin / direction |

Pour un parent/élève, `GET /eleves/:id/notes` ne renvoie que les notes **validées ET
publiées** ; pour admin/direction, toutes les notes (avec statut).

### Publication (Direction)
| Méthode | Endpoint                | Accès |
|---------|-------------------------|-------|
| POST    | `/api/publications`     | direction — `{ niveau, anneeScolaire, trimestre }` → publie + génère bulletins + notifie |
| GET     | `/api/publications`     | admin / direction |

### Bulletins (documents officiels)
| Méthode | Endpoint                              | Accès |
|---------|---------------------------------------|-------|
| GET     | `/api/eleves/:id/bulletins`           | parent propriétaire / élève / admin / direction |
| GET     | `/api/documents-officiels/:id/fichier`| propriétaire / admin / direction |

## 6. Génération du bulletin (PDF)

- Bibliothèque **`pdf-lib`**. Fichiers dans `backend/uploads/bulletins/`, nom aléatoire.
- Contenu : en-tête école, identité élève + niveau, trimestre + année, tableau
  (matière, note /100, coefficient, note×coef), **moyenne générale pondérée**, date.
- À la publication : un bulletin par élève du niveau ; enregistrement dans
  `documents_officiels` (type `bulletin`, `identifiant_unique` = hash aléatoire pour
  vérification ultérieure), fichier servi via endpoint protégé.
- Notification courriel au parent : « le bulletin du T… est disponible » (aperçu Ethereal en dev).

## 7. Structure de code ajoutée

```
src/
  models/matiere.model.js
  models/note.model.js           saisie, validation, moyennes, visibilité
  models/publication.model.js
  models/documentOfficiel.model.js
  services/moyenne.service.js     calcul des moyennes pondérées
  services/bulletin.service.js    génération PDF (pdf-lib) + archivage
  services/publication.service.js publier + générer bulletins + notifier
  controllers/note.controller.js
  controllers/matiere.controller.js
  controllers/publication.controller.js
  routes/notes.routes.js
uploads/bulletins/                PDF générés (git-ignoré)
db/migrations/004_notes_bulletins.sql
```

## 8. Sécurité & règles

- Validation stricte de `valeur` (0–100), `periode`, `trimestre` (enum), `coefficient` (> 0).
- Visibilité famille strictement contrôlée côté serveur (validée + publiée).
- Impossible de modifier une note d'un trimestre déjà publié (409).
- PDF servis uniquement via endpoint protégé (contrôle de propriété), jamais en statique.

## 9. Critères de fin d'étape

- [ ] La Direction crée des matières avec coefficients ; l'Admin saisit des notes.
- [ ] Une note `saisie` n'est PAS visible par le parent ; une note `validee` non publiée non plus.
- [ ] Après publication du niveau+trimestre, le parent voit les notes validées de son enfant.
- [ ] La moyenne générale est correcte (pondérée par coefficient) — vérifiée par calcul.
- [ ] Un bulletin PDF est généré, archivé, et téléchargeable par le parent (pas par un autre).
- [ ] Modifier une note d'un trimestre publié est refusé (409).
- [ ] Un parent ne voit ni les notes ni les bulletins d'un autre élève (403).
- [ ] Un courriel de disponibilité du bulletin est envoyé (aperçu Ethereal en dev).
```
