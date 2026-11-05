-- Migration 019 : rôle « propriétaire » + interrupteurs de permissions
-- Le propriétaire de l'école peut désactiver, pour direction/admin, les
-- actions Matières & coefficients, Saisie des notes et Publication des
-- notes. Absence de ligne = autorisé (comportement actuel préservé).
ALTER TABLE utilisateurs
  MODIFY role ENUM('parent','eleve','admin','direction','proprietaire') NOT NULL DEFAULT 'parent';

CREATE TABLE IF NOT EXISTS permissions (
  cle          VARCHAR(60) PRIMARY KEY,
  autorise     TINYINT(1) NOT NULL DEFAULT 1,
  modifie_par  INT,
  modifie_le   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (modifie_par) REFERENCES utilisateurs(id) ON DELETE SET NULL
) ENGINE=InnoDB;
