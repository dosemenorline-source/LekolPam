-- Connexion biométrique (Face ID / Touch ID / Windows Hello / empreinte) via
-- WebAuthn / passkeys, pour les comptes de la table utilisateurs (parent,
-- admin, direction, propriétaire). Une ligne = un appareil enregistré.
CREATE TABLE IF NOT EXISTS webauthn_credentials (
  id             BIGINT AUTO_INCREMENT PRIMARY KEY,
  id_utilisateur INT NOT NULL,
  credential_id  VARCHAR(255) NOT NULL UNIQUE,   -- identifiant du passkey (base64url)
  cle_publique   TEXT NOT NULL,                  -- clé publique COSE (base64url)
  compteur       BIGINT UNSIGNED NOT NULL DEFAULT 0,
  transports     VARCHAR(160) NULL,              -- ex. ["internal","hybrid"] (JSON)
  appareil       VARCHAR(120) NULL,              -- libellé lisible choisi par l'utilisateur
  cree_le        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  dernier_usage  DATETIME NULL,
  FOREIGN KEY (id_utilisateur) REFERENCES utilisateurs(id) ON DELETE CASCADE,
  INDEX idx_wac_user (id_utilisateur)
) ENGINE=InnoDB;
