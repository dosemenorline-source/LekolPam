-- Migration 002 — OTP + complétion du modèle de données
-- À appliquer sur une base créée à l'Étape 1.
-- Exécuter : mysql -u root -p lekol_pam < db/migrations/002_otp_et_modele.sql
USE lekol_pam;

-- 1. Colonne de vérification du courriel
ALTER TABLE utilisateurs
  ADD COLUMN courriel_verifie TINYINT(1) NOT NULL DEFAULT 0 AFTER statut;

-- 2. Codes OTP
CREATE TABLE IF NOT EXISTS codes_verification (
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

-- 3. Reste du modèle métier
CREATE TABLE IF NOT EXISTS ecole (
  id                    INT AUTO_INCREMENT PRIMARY KEY,
  nom                   VARCHAR(150) NOT NULL,
  coordonnees_bancaires VARCHAR(255),
  coordonnees_moncash   VARCHAR(255)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS inscriptions (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  id_eleve        INT NOT NULL,
  annee_scolaire  VARCHAR(9) NOT NULL,
  statut          ENUM('en_attente','complement_demande','accepte','refuse','confirmee')
                    NOT NULL DEFAULT 'en_attente',
  date_soumission DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_eleve) REFERENCES eleves(id) ON DELETE CASCADE
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

CREATE TABLE IF NOT EXISTS paiements (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  type_frais   ENUM('inscription','releve','duplicata') NOT NULL,
  id_reference INT NOT NULL,
  montant      DECIMAL(10,2) NOT NULL,
  devise       ENUM('HTG','USD') NOT NULL DEFAULT 'HTG',
  preuve_url   VARCHAR(500),
  statut       ENUM('en_attente','valide','rejete') NOT NULL DEFAULT 'en_attente',
  cree_le      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  valide_par   INT,
  valide_le    DATETIME,
  FOREIGN KEY (valide_par) REFERENCES utilisateurs(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS notes (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  id_eleve          INT NOT NULL,
  matiere           VARCHAR(100) NOT NULL,
  periode           VARCHAR(50) NOT NULL,
  annee_scolaire    VARCHAR(9) NOT NULL,
  valeur            DECIMAL(5,2) NOT NULL,
  statut_validation ENUM('saisie','validee') NOT NULL DEFAULT 'saisie',
  saisie_par        INT,
  cree_le           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_eleve) REFERENCES eleves(id) ON DELETE CASCADE,
  FOREIGN KEY (saisie_par) REFERENCES utilisateurs(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS documents_officiels (
  id                 INT AUTO_INCREMENT PRIMARY KEY,
  id_eleve           INT NOT NULL,
  type               ENUM('bulletin','releve','duplicata') NOT NULL,
  url_pdf            VARCHAR(500) NOT NULL,
  identifiant_unique VARCHAR(64) NOT NULL UNIQUE,
  date_generation    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_eleve) REFERENCES eleves(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS historique_statut (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  entite         ENUM('inscription','paiement','document_soumis') NOT NULL,
  id_entite      INT NOT NULL,
  ancien_statut  VARCHAR(40),
  nouveau_statut VARCHAR(40) NOT NULL,
  id_auteur      INT,
  cree_le        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_auteur) REFERENCES utilisateurs(id) ON DELETE SET NULL
) ENGINE=InnoDB;
