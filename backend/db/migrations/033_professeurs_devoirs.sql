-- Comptes professeur individuels (utilisateurs.role) + attribution de matières
-- (classe = matière+niveau, voir matieres) + devoirs, documents de cours et
-- créneaux d'horaire soumis par le professeur pour chacune de ses matières.

ALTER TABLE utilisateurs
  MODIFY COLUMN role ENUM('parent','eleve','admin','direction','proprietaire','professeur')
    NOT NULL DEFAULT 'parent';

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
