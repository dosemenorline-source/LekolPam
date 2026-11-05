-- ============================================================
-- 010 — Corps enseignant (système indépendant : propre authentification)
-- À exécuter UNE FOIS sur la base MySQL (local et production Railway).
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
  matiere            VARCHAR(160) NULL,
  fonction           VARCHAR(160) NULL,
  diplomes           VARCHAR(500) NULL,
  experience_annees  INT NULL,
  parcours           TEXT NULL,
  photo_url          VARCHAR(500) NULL,
  id_profs_admin     INT NULL,
  cree_le            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_profs_admin) REFERENCES profs_admins(id) ON DELETE SET NULL
) ENGINE=InnoDB;
