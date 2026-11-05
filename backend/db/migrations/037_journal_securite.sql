-- Journal de sécurité : connexions (réussies/échouées), verrouillages,
-- actions sensibles, anomalies. Purgé automatiquement après 180 jours.
CREATE TABLE IF NOT EXISTS journal_securite (
  id           BIGINT AUTO_INCREMENT PRIMARY KEY,
  evenement    VARCHAR(60)  NOT NULL,
  niveau       ENUM('info','alerte') NOT NULL DEFAULT 'info',
  sujet        VARCHAR(190) NULL,
  ip           VARCHAR(64)  NULL,
  details      VARCHAR(1000) NULL,
  cree_le      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_journal_date (cree_le),
  INDEX idx_journal_evenement (evenement, cree_le)
) ENGINE=InnoDB;

-- Table des sessions (express-mysql-session) : déclarée ici pour que le
-- serveur n'ait plus besoin du droit CREATE au démarrage (compte MySQL à
-- droits réduits).
CREATE TABLE IF NOT EXISTS `sessions` (
  `session_id` varchar(128) COLLATE utf8mb4_bin NOT NULL,
  `expires` int(11) unsigned NOT NULL,
  `data` mediumtext COLLATE utf8mb4_bin,
  PRIMARY KEY (`session_id`)
) ENGINE=InnoDB;
