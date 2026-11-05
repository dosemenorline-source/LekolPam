-- Migration 024 : dossiers d'anciens élèves + correctif visibilité multi-année
--
-- 1) notes.niveau : snapshot du niveau au moment de la saisie (jusqu'ici, la
--    visibilité d'une note comparait au niveau ACTUEL de l'élève — une fois
--    promu dans une classe supérieure, ses notes des années précédentes
--    devenaient invisibles côté élève/parent, car la publication existante
--    ne correspondait plus au niveau courant). Rétro-remplie avec le niveau
--    actuel : c'est la meilleure approximation possible pour l'historique.
ALTER TABLE notes ADD COLUMN niveau VARCHAR(60) NULL AFTER matiere;
UPDATE notes n JOIN eleves e ON e.id = n.id_eleve SET n.niveau = e.niveau WHERE n.niveau IS NULL;

-- 2) Un ancien élève n'a pas de compte parent actif : id_parent devient optionnel.
ALTER TABLE eleves MODIFY id_parent INT NULL;
ALTER TABLE eleves
  ADD COLUMN ancien_eleve TINYINT(1) NOT NULL DEFAULT 0 AFTER statut_inscription,
  ADD COLUMN courriel_contact VARCHAR(190) NULL AFTER ancien_eleve;

-- 3) Demandes d'accès aux résultats, soumises publiquement par d'anciens
-- élèves (sans création de compte) ; traitées par le secrétariat.
CREATE TABLE IF NOT EXISTS demandes_anciens_eleves (
  id                 INT AUTO_INCREMENT PRIMARY KEY,
  nom                VARCHAR(120) NOT NULL,
  prenom             VARCHAR(120),
  date_naissance     DATE,
  dernier_niveau     VARCHAR(60),
  annees_frequentees VARCHAR(100),
  courriel           VARCHAR(190) NOT NULL,
  telephone          VARCHAR(40),
  message            VARCHAR(500),
  statut             ENUM('en_attente','approuve','refuse') NOT NULL DEFAULT 'en_attente',
  id_eleve           INT,
  traite_par         INT,
  traite_le          DATETIME,
  cree_le            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (id_eleve) REFERENCES eleves(id) ON DELETE SET NULL,
  FOREIGN KEY (traite_par) REFERENCES utilisateurs(id) ON DELETE SET NULL
) ENGINE=InnoDB;
