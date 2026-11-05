-- Migration 004 — Module Notes & Bulletins
-- Matières + coefficients, publication par niveau/trimestre, liaison notes↔matières.
-- Exécuter : mysql -u root -p lekol_pam < db/migrations/004_notes_bulletins.sql
USE lekol_pam;

-- Matières + coefficient, configurées par niveau
CREATE TABLE IF NOT EXISTS matieres (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  nom         VARCHAR(100) NOT NULL,
  niveau      VARCHAR(60) NOT NULL,
  coefficient DECIMAL(4,2) NOT NULL DEFAULT 1.00,
  actif       TINYINT(1) NOT NULL DEFAULT 1,
  UNIQUE KEY uniq_matiere_niveau (nom, niveau)
) ENGINE=InnoDB;

-- Publication des notes par niveau + trimestre + année
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

-- Relier notes ↔ matières + normaliser la période en trimestre
ALTER TABLE notes
  ADD COLUMN id_matiere INT NULL AFTER id_eleve,
  MODIFY COLUMN periode ENUM('1er_trimestre','2e_trimestre','3e_trimestre') NOT NULL,
  ADD FOREIGN KEY (id_matiere) REFERENCES matieres(id) ON DELETE SET NULL;
