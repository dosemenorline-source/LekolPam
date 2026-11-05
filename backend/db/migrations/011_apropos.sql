-- Migration 011 — Page « À propos » : admin indépendant + sections publiables
-- (aucun lien avec la table utilisateurs, comme le vlog et le corps enseignant)

-- Identifiants dédiés à la gestion de la page À propos
CREATE TABLE IF NOT EXISTS apropos_admins (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  identifiant       VARCHAR(80) NOT NULL UNIQUE,
  mot_de_passe_hash VARCHAR(255) NOT NULL,
  cree_le           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Sections libres affichées sur la page publique « À propos »
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
