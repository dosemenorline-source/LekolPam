-- Migration 017 — Double authentification (2FA) à la connexion des parents.
-- Ajoute le type de code « connexion_2fa » à la table des codes OTP.
-- À exécuter UNE FOIS sur la base (locale et Railway) après le déploiement.

ALTER TABLE codes_verification
  MODIFY COLUMN type
    ENUM('verification_courriel','reinitialisation_mdp','connexion_2fa')
    NOT NULL DEFAULT 'verification_courriel';
