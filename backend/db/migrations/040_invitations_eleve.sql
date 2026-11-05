-- Migration 040 : invitations élève (codes d'auto-inscription)
-- Codes à usage unique que l'école remet aux VRAIS élèves pour qu'ils puissent
-- créer leur compte eux-mêmes. Empêche une personne non admise de s'inscrire
-- comme élève. Le code est consommé (lié au compte) à la création du compte.
CREATE TABLE IF NOT EXISTS invitations_eleve (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  code         VARCHAR(20) NOT NULL UNIQUE,
  note         VARCHAR(160) NULL,
  cree_par     INT NULL,
  cree_le      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expire_le    DATETIME NULL,
  utilise_par  INT NULL,
  utilise_le   DATETIME NULL,
  revoque      TINYINT(1) NOT NULL DEFAULT 0,
  FOREIGN KEY (cree_par)    REFERENCES utilisateurs(id) ON DELETE SET NULL,
  FOREIGN KEY (utilise_par) REFERENCES utilisateurs(id) ON DELETE SET NULL
) ENGINE=InnoDB;
