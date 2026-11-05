-- Migration 012 — Section « Académie » : admin indépendant + sections publiables par niveau
-- (aucun lien avec la table utilisateurs, comme le vlog, le corps enseignant et À propos)

-- Identifiants dédiés à la gestion de la section Académie
CREATE TABLE IF NOT EXISTS academie_admins (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  identifiant       VARCHAR(80) NOT NULL UNIQUE,
  mot_de_passe_hash VARCHAR(255) NOT NULL,
  cree_le           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Sections libres affichées sur les pages publiques « Académie » (par niveau)
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
