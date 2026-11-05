-- Schéma MySQL — Lekol Pam
-- Étape 1 : Fondation + Auth
-- Étape 2 : Vérification courriel (OTP) + modèle de données complet
-- Exécuter : mysql -u root -p < db/schema.sql

CREATE DATABASE IF NOT EXISTS lekol_pam
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE lekol_pam;

-- ============================================================
-- Comptes & authentification
-- ============================================================

-- utilisateurs : compte + rôle unique
CREATE TABLE IF NOT EXISTS utilisateurs (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  nom               VARCHAR(120) NOT NULL,
  courriel          VARCHAR(180) NOT NULL UNIQUE,
  mot_de_passe_hash VARCHAR(255) NULL,
  google_id         VARCHAR(255) NULL UNIQUE,
  role              ENUM('parent','eleve','admin','direction','proprietaire','professeur') NOT NULL DEFAULT 'parent',
  compte_eleve      TINYINT(1) NOT NULL DEFAULT 0,  -- compte créé par un élève (auto-inscription)
  statut            ENUM('actif','inactif') NOT NULL DEFAULT 'actif',
  courriel_verifie  TINYINT(1) NOT NULL DEFAULT 0,
  cree_le           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- codes_verification : OTP pour vérifier le courriel (et, plus tard, réinit. mot de passe)
CREATE TABLE IF NOT EXISTS codes_verification (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  id_utilisateur INT NOT NULL,
  code_hash      VARCHAR(255) NOT NULL,
  type           ENUM('verification_courriel','reinitialisation_mdp','connexion_2fa') NOT NULL DEFAULT 'verification_courriel',
  tentatives     INT NOT NULL DEFAULT 0,
  utilise        TINYINT(1) NOT NULL DEFAULT 0,
  expire_le      DATETIME NOT NULL,
  cree_le        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_utilisateur) REFERENCES utilisateurs(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- webauthn_credentials : appareils enregistrés pour la connexion biométrique
-- (Face ID / Touch ID / Windows Hello / empreinte) via WebAuthn / passkeys.
CREATE TABLE IF NOT EXISTS webauthn_credentials (
  id             BIGINT AUTO_INCREMENT PRIMARY KEY,
  id_utilisateur INT NOT NULL,
  credential_id  VARCHAR(255) NOT NULL UNIQUE,   -- identifiant du passkey (base64url)
  cle_publique   TEXT NOT NULL,                  -- clé publique COSE (base64url)
  compteur       BIGINT UNSIGNED NOT NULL DEFAULT 0,
  transports     VARCHAR(160) NULL,              -- ex. ["internal","hybrid"] (JSON)
  appareil       VARCHAR(120) NULL,              -- libellé lisible choisi par l'utilisateur
  cree_le        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  dernier_usage  DATETIME NULL,
  FOREIGN KEY (id_utilisateur) REFERENCES utilisateurs(id) ON DELETE CASCADE,
  INDEX idx_wac_user (id_utilisateur)
) ENGINE=InnoDB;

-- parents : infos complémentaires liées à un utilisateur de rôle 'parent'
CREATE TABLE IF NOT EXISTS parents (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  id_utilisateur INT NOT NULL,
  telephone      VARCHAR(40),
  adresse        VARCHAR(255),
  FOREIGN KEY (id_utilisateur) REFERENCES utilisateurs(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- eleves : rattaché à un parent (au moins un)
CREATE TABLE IF NOT EXISTS eleves (
  id                 INT AUTO_INCREMENT PRIMARY KEY,
  id_parent          INT NULL,  -- NULL pour un ancien élève sans compte parent actif
  nom                VARCHAR(120) NOT NULL,
  prenom             VARCHAR(120),
  sexe               ENUM('M','F'),
  date_naissance     DATE,
  niveau             VARCHAR(60),
  code_acces         VARCHAR(20) UNIQUE,
  photo_url          VARCHAR(500),
  groupe_sanguin     VARCHAR(5),
  badge_emis_le      DATE,
  badge_nom          VARCHAR(120),
  badge_prenom       VARCHAR(120),
  badge_classe       VARCHAR(60),
  badge_annee        VARCHAR(9),
  statut_inscription ENUM('en_attente','accepte','refuse','confirmee') NOT NULL DEFAULT 'en_attente',
  ancien_eleve       TINYINT(1) NOT NULL DEFAULT 0,
  courriel_contact   VARCHAR(190),  -- ancien élève : où envoyer le code d'accès (pas de compte parent)
  FOREIGN KEY (id_parent) REFERENCES parents(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- demandes_anciens_eleves : demandes d'accès aux résultats soumises
-- publiquement par d'anciens élèves (sans création de compte), traitées
-- par le secrétariat qui les rattache à un dossier eleves (ancien_eleve=1).
CREATE TABLE IF NOT EXISTS demandes_anciens_eleves (
  id                 INT AUTO_INCREMENT PRIMARY KEY,
  nom                VARCHAR(120) NOT NULL,
  prenom             VARCHAR(120),
  date_naissance     DATE,
  dernier_niveau     VARCHAR(60),
  annees_frequentees VARCHAR(100),
  courriel           VARCHAR(190) NOT NULL,
  telephone          VARCHAR(40),
  message            VARCHAR(500),
  statut             ENUM('en_attente','approuve','refuse') NOT NULL DEFAULT 'en_attente',
  id_eleve           INT,
  traite_par         INT,
  traite_le          DATETIME,
  cree_le            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_eleve) REFERENCES eleves(id) ON DELETE SET NULL,
  FOREIGN KEY (traite_par) REFERENCES utilisateurs(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ============================================================
-- Modèle métier (tables créées ; logique aux étapes suivantes)
-- ============================================================

CREATE TABLE IF NOT EXISTS ecole (
  id                    INT AUTO_INCREMENT PRIMARY KEY,
  nom                   VARCHAR(150) NOT NULL,
  coordonnees_bancaires VARCHAR(255),
  coordonnees_moncash   VARCHAR(255),
  logo_url              VARCHAR(500),
  adresse               VARCHAR(255),
  telephone             VARCHAR(50),
  courriel              VARCHAR(150),
  seuil_reussite        DECIMAL(5,2) NOT NULL DEFAULT 60  -- note de passage (/100), configurable par le secrétariat
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS inscriptions (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  id_eleve          INT NOT NULL,
  annee_scolaire    VARCHAR(9) NOT NULL,
  nom_parent        VARCHAR(120),
  profession_parent VARCHAR(120),
  telephone_parent  VARCHAR(40),
  courriel_parent   VARCHAR(150),
  ancienne_ecole    VARCHAR(160),
  ancienne_classe   VARCHAR(60),
  raison_choix      VARCHAR(500),
  -- Ré-inscription : niveau demandé pour l'année visée (promotion). NULL pour une
  -- première inscription (le niveau est alors déjà posé sur l'élève). Appliqué à
  -- l'élève quand le dossier est accepté/confirmé.
  niveau_demande    VARCHAR(60) NULL,
  statut            ENUM('attente_paiement','annulee','en_attente','complement_demande','accepte','refuse','confirmee')
                    NOT NULL DEFAULT 'en_attente',
  date_soumission   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_eleve) REFERENCES eleves(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- reinscription_campagne : campagne de ré-inscription lancée par le propriétaire
-- en fin d'année scolaire. Une seule campagne active à la fois.
CREATE TABLE IF NOT EXISTS reinscription_campagne (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  annee_cible  VARCHAR(9) NOT NULL,                 -- année scolaire visée (ex. 2026-2027)
  active       TINYINT(1) NOT NULL DEFAULT 1,
  actif_unique CHAR(1) NULL,                        -- 'O' si active, NULL sinon : index UNIQUE = une seule active
  lancee_par   INT NULL,
  lancee_le    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  cloturee_le  DATETIME NULL,
  nb_courriels INT NOT NULL DEFAULT 0,              -- nombre de familles réellement notifiées
  UNIQUE KEY uq_reinscription_actif (actif_unique),
  FOREIGN KEY (lancee_par) REFERENCES utilisateurs(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS documents_soumis (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  id_inscription      INT NOT NULL,
  type                ENUM('acte_naissance','bulletin','photo','autre') NOT NULL,
  url_fichier         VARCHAR(500) NOT NULL,
  statut_verification ENUM('en_attente','valide','rejete') NOT NULL DEFAULT 'en_attente',
  televerse_le        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_inscription) REFERENCES inscriptions(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS tarifs (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  type_frais     ENUM('inscription','releve','duplicata') NOT NULL,
  montant        DECIMAL(10,2) NOT NULL,
  devise         ENUM('HTG','USD') NOT NULL DEFAULT 'HTG',
  date_effective DATE NOT NULL
) ENGINE=InnoDB;

-- permissions : interrupteurs contrôlés par le propriétaire, pour des actions
-- normalement réservées à direction/admin. Absence de ligne = autorisé par
-- défaut (ne casse pas le fonctionnement existant tant que le propriétaire
-- n'a rien désactivé). Clés : matieres_gestion, notes_saisie, notes_publication.
CREATE TABLE IF NOT EXISTS permissions (
  cle          VARCHAR(60) PRIMARY KEY,
  autorise     TINYINT(1) NOT NULL DEFAULT 1,
  modifie_par  INT,
  modifie_le   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (modifie_par) REFERENCES utilisateurs(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- documents_archive : anciens documents (Excel, Word, PowerPoint, PDF…) qui
-- existaient avant le système et qu'on y intègre comme archive, classés par
-- service (Économat / Secrétariat / Direction). Les fichiers sont stockés tels
-- quels (pas de lecture automatique) et téléchargés en pièce jointe.
CREATE TABLE IF NOT EXISTS documents_archive (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  service           ENUM('economat','secretariat','direction','autre') NOT NULL DEFAULT 'autre',
  titre             VARCHAR(200) NOT NULL,
  description       VARCHAR(500) NULL,
  nom_fichier       VARCHAR(255) NOT NULL,   -- nom d'origine (affiché / téléchargement)
  chemin            VARCHAR(500) NOT NULL,   -- chemin relatif sous UPLOAD_ROOT (nom aléatoire)
  type_mime         VARCHAR(150) NULL,
  taille            INT NULL,
  televerse_par     INT NULL,                -- utilisateur (role) ; NULL si admin Économat
  televerse_par_nom VARCHAR(160) NULL,       -- nom lisible (gère aussi l'admin Économat)
  televerse_le      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (televerse_par) REFERENCES utilisateurs(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- invitations_eleve : codes à usage unique remis aux VRAIS élèves pour qu'ils
-- puissent créer leur compte eux-mêmes (auto-inscription élève). Empêche une
-- personne non admise de s'inscrire comme élève. Consommé à la création du compte.
CREATE TABLE IF NOT EXISTS invitations_eleve (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  code         VARCHAR(20) NOT NULL UNIQUE,
  note         VARCHAR(160) NULL,                 -- repère libre (nom/niveau de l'élève attendu)
  cree_par     INT NULL,
  cree_le      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expire_le    DATETIME NULL,                     -- NULL = pas d'expiration
  utilise_par  INT NULL,                          -- compte qui a consommé le code
  utilise_le   DATETIME NULL,
  revoque      TINYINT(1) NOT NULL DEFAULT 0,
  FOREIGN KEY (cree_par)    REFERENCES utilisateurs(id) ON DELETE SET NULL,
  FOREIGN KEY (utilise_par) REFERENCES utilisateurs(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- messages_contact : messages soumis via le formulaire « Restons en contact »
-- de la page d'accueil. Le propriétaire les consulte et y répond (avec
-- brouillon IA) depuis « Contrôle d'accès ».
CREATE TABLE IF NOT EXISTS messages_contact (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  nom          VARCHAR(150) NOT NULL,
  courriel     VARCHAR(190) NOT NULL,
  message      TEXT NOT NULL,
  statut       ENUM('non_lu','lu','repondu') NOT NULL DEFAULT 'non_lu',
  reponse      TEXT,
  repondu_par  INT,
  repondu_le   DATETIME,
  cree_le      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (repondu_par) REFERENCES utilisateurs(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- presences : présence quotidienne (scan du QR du badge). Une ligne = un
-- élève confirmé présent un jour donné. Pas de ligne pour une date = non pointé.
CREATE TABLE IF NOT EXISTS presences (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  id_eleve      INT NOT NULL,
  date          DATE NOT NULL,
  heure_arrivee DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  heure_depart  DATETIME NULL,
  marque_par    INT,
  UNIQUE KEY uniq_eleve_date (id_eleve, date),
  FOREIGN KEY (id_eleve) REFERENCES eleves(id) ON DELETE CASCADE,
  FOREIGN KEY (marque_par) REFERENCES utilisateurs(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- frais_divers : catalogue de frais géré par la direction (écolage, cantine, livres…)
-- Liste de prix informative — indépendante du module Paiements.
-- niveau NULL => s'applique à toutes les classes.
CREATE TABLE IF NOT EXISTS frais_divers (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  nom            VARCHAR(120) NOT NULL,
  niveau         VARCHAR(60)  NULL,
  annee_scolaire VARCHAR(9)   NULL,
  montant        DECIMAL(10,2) NOT NULL,
  devise         ENUM('HTG','USD') NOT NULL DEFAULT 'HTG',
  unite          VARCHAR(40)  NULL,
  actif          TINYINT(1) NOT NULL DEFAULT 1,
  cree_le        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS paiements (
  id                     INT AUTO_INCREMENT PRIMARY KEY,
  type_frais             ENUM('inscription','releve','duplicata') NOT NULL,
  methode_paiement       ENUM('manuel','moncash','natcash','kashpaw','carte') NOT NULL DEFAULT 'manuel',
  id_reference           INT NOT NULL,
  montant                DECIMAL(10,2) NOT NULL,
  devise                 ENUM('HTG','USD') NOT NULL DEFAULT 'HTG',
  preuve_url             VARCHAR(500),
  reference_externe      VARCHAR(64),
  reference_demarree_le  DATETIME NULL,
  transaction_externe_id VARCHAR(64) UNIQUE,
  statut                 ENUM('en_attente','valide','rejete') NOT NULL DEFAULT 'en_attente',
  cree_le                DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  valide_par             INT,
  valide_le              DATETIME,
  FOREIGN KEY (valide_par) REFERENCES utilisateurs(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ============================================================
-- Vlog (système indépendant : propre authentification, hors comptes école)
-- ============================================================

-- vlog_admins : identifiants dédiés à la gestion du vlog (aucun lien avec utilisateurs)
CREATE TABLE IF NOT EXISTS vlog_admins (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  identifiant       VARCHAR(80) NOT NULL UNIQUE,
  mot_de_passe_hash VARCHAR(255) NOT NULL,
  cree_le           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- economat_admins : identifiants dédiés à l'Économat (paiements, tarifs,
-- acquittements) — module autonome, détaché des rôles admin/direction.
CREATE TABLE IF NOT EXISTS economat_admins (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  email             VARCHAR(190) NOT NULL UNIQUE,
  mot_de_passe_hash VARCHAR(255) NOT NULL,
  cree_le           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- publications_vlog : billets publiés sur le vlog public
CREATE TABLE IF NOT EXISTS publications_vlog (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  titre         VARCHAR(160) NOT NULL,
  contenu       TEXT NOT NULL,
  categorie     ENUM('actualite','photo','annonce') NOT NULL DEFAULT 'actualite',
  photo_url     VARCHAR(500) NULL,
  id_vlog_admin INT NULL,
  cree_le       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_vlog_admin) REFERENCES vlog_admins(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS matieres (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  nom         VARCHAR(100) NOT NULL,
  niveau      VARCHAR(60) NOT NULL,
  coefficient DECIMAL(4,2) NOT NULL DEFAULT 1.00,
  actif       TINYINT(1) NOT NULL DEFAULT 1,
  UNIQUE KEY uniq_matiere_niveau (nom, niveau)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS notes (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  id_eleve          INT NOT NULL,
  id_matiere        INT,
  matiere           VARCHAR(100) NOT NULL,
  niveau            VARCHAR(60),  -- snapshot du niveau de l'élève au moment de la saisie
  periode           ENUM('1er_trimestre','2e_trimestre','3e_trimestre') NOT NULL,
  annee_scolaire    VARCHAR(9) NOT NULL,
  valeur            DECIMAL(5,2) NOT NULL,
  bareme            DECIMAL(6,2) NOT NULL DEFAULT 100, -- note « sur X » (10, 20, 100...)
  statut_validation ENUM('saisie','validee') NOT NULL DEFAULT 'saisie',
  saisie_par        INT,
  cree_le           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_eleve) REFERENCES eleves(id) ON DELETE CASCADE,
  FOREIGN KEY (id_matiere) REFERENCES matieres(id) ON DELETE SET NULL,
  FOREIGN KEY (saisie_par) REFERENCES utilisateurs(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- Quelles matières (= classes) un professeur enseigne.
CREATE TABLE IF NOT EXISTS enseignant_matieres (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  id_utilisateur INT NOT NULL,
  id_matiere     INT NOT NULL,
  cree_le        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_enseignant_matiere (id_utilisateur, id_matiere),
  FOREIGN KEY (id_utilisateur) REFERENCES utilisateurs(id) ON DELETE CASCADE,
  FOREIGN KEY (id_matiere) REFERENCES matieres(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS devoirs (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  id_matiere    INT NOT NULL,
  id_enseignant INT NOT NULL,
  titre         VARCHAR(200) NOT NULL,
  description   TEXT,
  date_limite   DATE,
  cree_le       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_matiere) REFERENCES matieres(id) ON DELETE CASCADE,
  FOREIGN KEY (id_enseignant) REFERENCES utilisateurs(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS documents_cours (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  id_matiere    INT NOT NULL,
  id_enseignant INT NOT NULL,
  titre         VARCHAR(200) NOT NULL,
  url_fichier   VARCHAR(500) NOT NULL,
  cree_le       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_matiere) REFERENCES matieres(id) ON DELETE CASCADE,
  FOREIGN KEY (id_enseignant) REFERENCES utilisateurs(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS horaires_cours (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  id_matiere    INT NOT NULL,
  id_enseignant INT NOT NULL,
  jour_semaine  ENUM('lundi','mardi','mercredi','jeudi','vendredi','samedi') NOT NULL,
  heure_debut   TIME NOT NULL,
  heure_fin     TIME NOT NULL,
  salle         VARCHAR(60),
  cree_le       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_matiere) REFERENCES matieres(id) ON DELETE CASCADE,
  FOREIGN KEY (id_enseignant) REFERENCES utilisateurs(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS publications_notes (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  niveau         VARCHAR(60) NOT NULL,
  annee_scolaire VARCHAR(9) NOT NULL,
  trimestre      ENUM('1er_trimestre','2e_trimestre','3e_trimestre') NOT NULL,
  publie_par     INT,
  publie_le      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_publication (niveau, annee_scolaire, trimestre),
  FOREIGN KEY (publie_par) REFERENCES utilisateurs(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- acquittements_scolarite : indique qu'un élève est « à jour » (économat) pour un trimestre.
-- Présence d'une ligne = à jour ; absence = non payé (résultats bloqués).
CREATE TABLE IF NOT EXISTS acquittements_scolarite (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  id_eleve       INT NOT NULL,
  annee_scolaire VARCHAR(9) NOT NULL,
  trimestre      ENUM('1er_trimestre','2e_trimestre','3e_trimestre') NOT NULL,
  acquitte_par   INT NULL,
  acquitte_par_note VARCHAR(255) NULL,
  cree_le        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_acquittement (id_eleve, annee_scolaire, trimestre),
  FOREIGN KEY (id_eleve) REFERENCES eleves(id) ON DELETE CASCADE,
  FOREIGN KEY (acquitte_par) REFERENCES utilisateurs(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS documents_officiels (
  id                 INT AUTO_INCREMENT PRIMARY KEY,
  id_eleve           INT NOT NULL,
  type               ENUM('bulletin','releve','duplicata') NOT NULL,
  periode            ENUM('1er_trimestre','2e_trimestre','3e_trimestre') NULL,
  annee_scolaire     VARCHAR(9) NULL,
  url_pdf            VARCHAR(500) NOT NULL,
  identifiant_unique VARCHAR(64) NOT NULL UNIQUE,
  date_generation    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_eleve) REFERENCES eleves(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Journal de sécurité : connexions (réussies/échouées), verrouillages,
-- actions sensibles, anomalies. Purgé automatiquement après 180 jours.
CREATE TABLE IF NOT EXISTS journal_securite (
  id           BIGINT AUTO_INCREMENT PRIMARY KEY,
  evenement    VARCHAR(60)  NOT NULL,
  niveau       ENUM('info','alerte') NOT NULL DEFAULT 'info',
  sujet        VARCHAR(190) NULL,
  ip           VARCHAR(64)  NULL,
  details      VARCHAR(1000) NULL,
  cree_le      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_journal_date (cree_le),
  INDEX idx_journal_evenement (evenement, cree_le)
) ENGINE=InnoDB;

-- Table des sessions (express-mysql-session) : déclarée ici pour que le
-- serveur n'ait plus besoin du droit CREATE au démarrage (compte MySQL à
-- droits réduits).
CREATE TABLE IF NOT EXISTS `sessions` (
  `session_id` varchar(128) COLLATE utf8mb4_bin NOT NULL,
  `expires` int(11) unsigned NOT NULL,
  `data` mediumtext COLLATE utf8mb4_bin,
  PRIMARY KEY (`session_id`)
) ENGINE=InnoDB;

-- Traçabilité : tout changement de statut (dossier, paiement, document)
CREATE TABLE IF NOT EXISTS historique_statut (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  entite         ENUM('inscription','paiement','document_soumis') NOT NULL,
  id_entite      INT NOT NULL,
  ancien_statut  VARCHAR(40),
  nouveau_statut VARCHAR(40) NOT NULL,
  commentaire    TEXT,
  id_auteur      INT,
  cree_le        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_auteur) REFERENCES utilisateurs(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ============================================================
-- Corps enseignant (système indépendant : propre authentification, hors comptes école)
-- ============================================================

-- profs_admins : identifiants dédiés à la gestion des profils de professeurs
CREATE TABLE IF NOT EXISTS profs_admins (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  identifiant       VARCHAR(80) NOT NULL UNIQUE,
  mot_de_passe_hash VARCHAR(255) NOT NULL,
  cree_le           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- professeurs : fiches publiques du corps enseignant
CREATE TABLE IF NOT EXISTS professeurs (
  id                 INT AUTO_INCREMENT PRIMARY KEY,
  nom                VARCHAR(120) NOT NULL,
  prenom             VARCHAR(120) NULL,
  matiere            VARCHAR(160) NULL,       -- discipline principale enseignée
  fonction           VARCHAR(160) NULL,       -- titre / fonction (ex. Titulaire, Professeur de Maths)
  diplomes           VARCHAR(500) NULL,       -- formation / diplômes
  experience_annees  INT NULL,                -- années d'expérience
  parcours           TEXT NULL,               -- biographie / parcours détaillé
  photo_url          VARCHAR(500) NULL,
  id_profs_admin     INT NULL,
  cree_le            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_profs_admin) REFERENCES profs_admins(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- apropos_admins : identifiants dédiés à la gestion de la page « À propos »
CREATE TABLE IF NOT EXISTS apropos_admins (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  identifiant       VARCHAR(80) NOT NULL UNIQUE,
  mot_de_passe_hash VARCHAR(255) NOT NULL,
  cree_le           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- apropos_sections : sections libres affichées sur la page publique « À propos »
CREATE TABLE IF NOT EXISTS apropos_sections (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  titre            VARCHAR(160) NOT NULL,
  contenu          TEXT NOT NULL,
  ordre            INT NOT NULL DEFAULT 0,
  id_apropos_admin INT NULL,
  cree_le          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  maj_le           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (id_apropos_admin) REFERENCES apropos_admins(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- academie_admins : identifiants dédiés à la gestion de la section « Académie »
CREATE TABLE IF NOT EXISTS academie_admins (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  identifiant       VARCHAR(80) NOT NULL UNIQUE,
  mot_de_passe_hash VARCHAR(255) NOT NULL,
  cree_le           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- academie_sections : sections libres affichées sur les pages « Académie » (par niveau)
CREATE TABLE IF NOT EXISTS academie_sections (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  niveau            ENUM('prescolaire','primaire','secondaire') NOT NULL,
  titre             VARCHAR(160) NOT NULL,
  contenu           TEXT NOT NULL,
  ordre             INT NOT NULL DEFAULT 0,
  id_academie_admin INT NULL,
  cree_le           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  maj_le            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (id_academie_admin) REFERENCES academie_admins(id) ON DELETE SET NULL,
  INDEX idx_academie_niveau (niveau, ordre)
) ENGINE=InnoDB;

-- examens_admins : identifiants dédiés à la gestion des « Examens passés »
CREATE TABLE IF NOT EXISTS examens_admins (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  identifiant       VARCHAR(80) NOT NULL UNIQUE,
  mot_de_passe_hash VARCHAR(255) NOT NULL,
  cree_le           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- examens : photos de feuilles d'examen, classées par niveau (texte libre)
CREATE TABLE IF NOT EXISTS examens (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  niveau           VARCHAR(60) NOT NULL,
  titre            VARCHAR(160) NULL,
  photo_url        VARCHAR(500) NOT NULL,
  id_examens_admin INT NULL,
  cree_le          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_examens_admin) REFERENCES examens_admins(id) ON DELETE SET NULL,
  INDEX idx_examens_niveau (niveau)
) ENGINE=InnoDB;
