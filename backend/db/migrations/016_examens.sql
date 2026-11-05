-- Migration 016 — Examens passés : admin indépendant + photos de feuilles d'examen par niveau.
-- (aucun lien avec la table utilisateurs, comme vlog / à propos / académie)

CREATE TABLE IF NOT EXISTS examens_admins (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  identifiant       VARCHAR(80) NOT NULL UNIQUE,
  mot_de_passe_hash VARCHAR(255) NOT NULL,
  cree_le           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS examens (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  niveau           VARCHAR(60) NOT NULL,           -- classe / niveau (texte libre)
  titre            VARCHAR(160) NULL,              -- description (ex. « Maths — 3e trimestre »)
  photo_url        VARCHAR(500) NOT NULL,          -- photo de la feuille d'examen
  id_examens_admin INT NULL,
  cree_le          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_examens_admin) REFERENCES examens_admins(id) ON DELETE SET NULL,
  INDEX idx_examens_niveau (niveau)
) ENGINE=InnoDB;
