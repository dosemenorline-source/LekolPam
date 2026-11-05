-- Migration 021 : boîte de réception du formulaire de contact public
-- Le formulaire « Restons en contact » de la page d'accueil enregistre
-- désormais les messages en base au lieu d'ouvrir un mailto:. Le
-- propriétaire les consulte et y répond (avec brouillon IA) depuis
-- « Contrôle d'accès ».
CREATE TABLE IF NOT EXISTS messages_contact (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  nom          VARCHAR(150) NOT NULL,
  courriel     VARCHAR(190) NOT NULL,
  message      TEXT NOT NULL,
  statut       ENUM('non_lu','lu','repondu') NOT NULL DEFAULT 'non_lu',
  reponse      TEXT,
  repondu_par  INT,
  repondu_le   DATETIME,
  cree_le      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (repondu_par) REFERENCES utilisateurs(id) ON DELETE SET NULL
) ENGINE=InnoDB;
