-- Migration 043 : archive de documents anciens (Excel/Word/PPT/PDF) classés par
-- service (Économat / Secrétariat / Direction). Fichiers stockés tels quels.
CREATE TABLE IF NOT EXISTS documents_archive (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  service           ENUM('economat','secretariat','direction','autre') NOT NULL DEFAULT 'autre',
  titre             VARCHAR(200) NOT NULL,
  description       VARCHAR(500) NULL,
  nom_fichier       VARCHAR(255) NOT NULL,
  chemin            VARCHAR(500) NOT NULL,
  type_mime         VARCHAR(150) NULL,
  taille            INT NULL,
  televerse_par     INT NULL,
  televerse_par_nom VARCHAR(160) NULL,
  televerse_le      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (televerse_par) REFERENCES utilisateurs(id) ON DELETE SET NULL
) ENGINE=InnoDB;
