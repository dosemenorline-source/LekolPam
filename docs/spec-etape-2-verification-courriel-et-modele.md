# Spec — Étape 2 : Vérification du courriel (OTP) + complétion du modèle de données

**Projet :** Lekòl Pam
**Date :** 2026-07-08
**Statut :** en revue (pas encore démarré)
**Portée :** backend uniquement (le frontend suivra plus tard)

---

## 1. Objectif

Deux livrables complémentaires :

1. **Vérification du courriel par code OTP** à l'inscription : un compte n'est utilisable
   qu'après avoir confirmé son adresse via un code à usage unique reçu par courriel.
2. **Compléter le modèle de données** : créer les tables restantes de la spec technique
   (inscriptions, documents, paiements, notes, documents officiels, tarifs, école) +
   une table d'historique des statuts pour la traçabilité.

## 2. Décisions confirmées (2026-07-08)

- **Envoi de courriel : Nodemailer + SMTP.** Dev : compte de test **Ethereal** (capture les
  courriels sans les envoyer réellement, fournit une URL de prévisualisation). Prod : SMTP de
  l'école / fournisseur local (à fixer en phase d'analyse). Config par variables d'environnement.
- **Login bloqué tant que le courriel n'est pas vérifié** (403 avec message clair + possibilité
  de renvoyer un code).
- **Portée des tables : table OTP + le reste du modèle de données** en même temps.

## 3. Vérification par OTP

### 3.1 Règles

- Code **numérique à 6 chiffres**, généré aléatoirement.
- **Stocké haché** (bcrypt) — jamais en clair en base.
- **Expiration : 10 minutes.**
- **Maximum 5 tentatives** par code ; au-delà, le code est invalidé (il faut en redemander un).
- Un seul code actif par utilisateur à la fois pour un type donné (les anciens sont invalidés
  quand on en génère un nouveau).
- Renvoi de code **limité** (rate limiting) pour éviter les abus / le spam courriel.
- Type de code extensible (`verification_courriel` maintenant, `reinitialisation_mdp` plus tard).

### 3.2 Flux d'inscription modifié

1. `POST /api/auth/register` → crée l'utilisateur avec `courriel_verifie = 0`,
   **n'ouvre PAS de session**, génère un OTP, l'envoie par courriel, renvoie `201`
   (« Vérifiez votre courriel »).
2. `POST /api/auth/verifier-courriel` `{ courriel, code }` → si le code est valide et non expiré :
   `courriel_verifie = 1`, code marqué utilisé, **la session est ouverte**, renvoie `200`.
3. `POST /api/auth/renvoyer-code` `{ courriel }` → régénère et renvoie un OTP (rate limité).
4. `POST /api/auth/login` → si `courriel_verifie = 0` : `403` « Courriel non vérifié ».

### 3.3 Nouveaux / modifiés — endpoints

| Méthode | Endpoint                        | Accès  | Description |
|---------|---------------------------------|--------|-------------|
| POST    | `/api/auth/register`            | public | (modifié) crée le compte + envoie l'OTP, sans session |
| POST    | `/api/auth/verifier-courriel`   | public | valide l'OTP, marque vérifié, ouvre la session |
| POST    | `/api/auth/renvoyer-code`       | public | renvoie un nouvel OTP (rate limité) |
| POST    | `/api/auth/login`               | public | (modifié) refuse si courriel non vérifié |

## 4. Tables complémentaires (DDL proposé)

### 4.1 Modification de `utilisateurs`

```sql
ALTER TABLE utilisateurs
  ADD COLUMN courriel_verifie TINYINT(1) NOT NULL DEFAULT 0 AFTER statut;
```

### 4.2 Codes de vérification (OTP)

```sql
CREATE TABLE codes_verification (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  id_utilisateur INT NOT NULL,
  code_hash      VARCHAR(255) NOT NULL,
  type           ENUM('verification_courriel','reinitialisation_mdp') NOT NULL DEFAULT 'verification_courriel',
  tentatives     INT NOT NULL DEFAULT 0,
  utilise        TINYINT(1) NOT NULL DEFAULT 0,
  expire_le      DATETIME NOT NULL,
  cree_le        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_utilisateur) REFERENCES utilisateurs(id) ON DELETE CASCADE
) ENGINE=InnoDB;
```

### 4.3 Reste du modèle de données (spec technique, section 5)

```sql
CREATE TABLE ecole (
  id                    INT AUTO_INCREMENT PRIMARY KEY,
  nom                   VARCHAR(150) NOT NULL,
  coordonnees_bancaires VARCHAR(255),
  coordonnees_moncash   VARCHAR(255)
) ENGINE=InnoDB;

CREATE TABLE inscriptions (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  id_eleve       INT NOT NULL,
  annee_scolaire VARCHAR(9) NOT NULL,          -- ex. '2026-2027'
  statut         ENUM('en_attente','complement_demande','accepte','refuse','confirmee')
                   NOT NULL DEFAULT 'en_attente',
  date_soumission DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_eleve) REFERENCES eleves(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE documents_soumis (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  id_inscription      INT NOT NULL,
  type                ENUM('acte_naissance','bulletin','photo','autre') NOT NULL,
  url_fichier         VARCHAR(500) NOT NULL,
  statut_verification ENUM('en_attente','valide','rejete') NOT NULL DEFAULT 'en_attente',
  televerse_le        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_inscription) REFERENCES inscriptions(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE tarifs (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  type_frais     ENUM('inscription','releve','duplicata') NOT NULL,
  montant        DECIMAL(10,2) NOT NULL,
  devise         ENUM('HTG','USD') NOT NULL DEFAULT 'HTG',
  date_effective DATE NOT NULL
) ENGINE=InnoDB;

CREATE TABLE paiements (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  type_frais       ENUM('inscription','releve','duplicata') NOT NULL,
  id_reference     INT NOT NULL,                -- id inscription ou demande de document
  montant          DECIMAL(10,2) NOT NULL,
  devise           ENUM('HTG','USD') NOT NULL DEFAULT 'HTG',
  preuve_url       VARCHAR(500),
  statut           ENUM('en_attente','valide','rejete') NOT NULL DEFAULT 'en_attente',
  cree_le          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  valide_par       INT,                         -- utilisateur admin ayant validé
  valide_le        DATETIME,
  FOREIGN KEY (valide_par) REFERENCES utilisateurs(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE notes (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  id_eleve          INT NOT NULL,
  matiere           VARCHAR(100) NOT NULL,
  periode           VARCHAR(50) NOT NULL,       -- ex. '1er trimestre'
  annee_scolaire    VARCHAR(9) NOT NULL,
  valeur            DECIMAL(5,2) NOT NULL,
  statut_validation ENUM('saisie','validee') NOT NULL DEFAULT 'saisie',
  saisie_par        INT,
  cree_le           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_eleve) REFERENCES eleves(id) ON DELETE CASCADE,
  FOREIGN KEY (saisie_par) REFERENCES utilisateurs(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE documents_officiels (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  id_eleve        INT NOT NULL,
  type            ENUM('bulletin','releve','duplicata') NOT NULL,
  url_pdf         VARCHAR(500) NOT NULL,
  identifiant_unique VARCHAR(64) NOT NULL UNIQUE,  -- pour vérification ultérieure
  date_generation DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_eleve) REFERENCES eleves(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Traçabilité : tout changement de statut (dossier, paiement) horodaté + auteur
CREATE TABLE historique_statut (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  entite        ENUM('inscription','paiement','document_soumis') NOT NULL,
  id_entite     INT NOT NULL,
  ancien_statut VARCHAR(40),
  nouveau_statut VARCHAR(40) NOT NULL,
  id_auteur     INT,                            -- utilisateur ayant fait l'action
  cree_le       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_auteur) REFERENCES utilisateurs(id) ON DELETE SET NULL
) ENGINE=InnoDB;
```

> Ces tables sont **créées** à cette étape mais leur logique métier (endpoints inscription,
> notes, paiements…) sera implémentée aux étapes suivantes. Ici on pose seulement le schéma.

## 5. Structure de code ajoutée

```
src/
  config/mailer.js              transport Nodemailer (SMTP / Ethereal en dev)
  services/otp.service.js       générer / vérifier les OTP
  models/verificationCode.model.js
  controllers/auth.controller.js  (+ verifierCourriel, renvoyerCode ; register/login modifiés)
db/
  schema.sql                    (mis à jour avec toutes les tables)
  migrations/002_otp_et_modele.sql  (ALTER + CREATE, pour une base déjà en place)
```

Variables d'environnement ajoutées (`.env`) :

```
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
MAIL_FROM="Lekol Pam <no-reply@lekolpam.ht>"
OTP_EXPIRATION_MIN=10
# En dev, si SMTP_HOST est vide : bascule automatique sur un compte Ethereal.
```

## 6. Sécurité

- OTP haché en base (bcrypt) ; jamais renvoyé dans les réponses API.
- Rate limiting sur `verifier-courriel` (anti brute-force) et `renvoyer-code` (anti spam).
- Message de login volontairement générique pour ne pas divulguer l'existence d'un compte,
  **sauf** le cas « courriel non vérifié » qui doit guider l'utilisateur.
- Expiration + limite de tentatives strictement appliquées côté serveur.

## 7. Critères de fin d'étape

- [ ] Toutes les tables du modèle existent en base (schema.sql rejoue sans erreur).
- [ ] `register` crée un compte non vérifié, sans session, et déclenche l'envoi d'un courriel.
- [ ] En dev, l'URL de prévisualisation Ethereal montre le courriel avec le code.
- [ ] `verifier-courriel` avec le bon code → compte vérifié + session ouverte.
- [ ] Code expiré / faux / au-delà de 5 tentatives → refusé.
- [ ] `login` sur un compte non vérifié → 403 ; après vérification → 200.
- [ ] `renvoyer-code` régénère un OTP et invalide l'ancien.
- [ ] OTP stocké haché (vérifié en base).
```
