-- Migration 026 : Économat — système d'authentification indépendant
--
-- L'Économat (paiements, tarifs, acquittements) devient un module autonome,
-- détaché des rôles « admin » (secrétariat) et « direction » : sa propre
-- table de comptes, avec courriel + mot de passe, sur le même modèle que
-- vlog_admins / profs_admins / apropos_admins / academie_admins / examens_admins.
CREATE TABLE IF NOT EXISTS economat_admins (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  email             VARCHAR(190) NOT NULL UNIQUE,
  mot_de_passe_hash VARCHAR(255) NOT NULL,
  cree_le           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;
