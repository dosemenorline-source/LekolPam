-- Migration 041 : ré-inscription de fin d'année
-- 1) Niveau demandé (promotion) porté par l'inscription, appliqué à l'élève à
--    l'acceptation du dossier. NULL pour une première inscription.
-- 2) Campagne de ré-inscription lancée par le propriétaire (une seule active).
ALTER TABLE inscriptions
  ADD COLUMN niveau_demande VARCHAR(60) NULL AFTER raison_choix;

CREATE TABLE IF NOT EXISTS reinscription_campagne (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  annee_cible  VARCHAR(9) NOT NULL,
  active       TINYINT(1) NOT NULL DEFAULT 1,
  lancee_par   INT NULL,
  lancee_le    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  cloturee_le  DATETIME NULL,
  nb_courriels INT NOT NULL DEFAULT 0,
  FOREIGN KEY (lancee_par) REFERENCES utilisateurs(id) ON DELETE SET NULL
) ENGINE=InnoDB;
