-- Connexion/inscription via Google — un compte Google peut créer un compte
-- (toujours 'parent', comme l'inscription manuelle) ou se lier à un compte
-- existant de même courriel. mot_de_passe_hash devient nullable : un compte
-- créé uniquement via Google n'a pas de mot de passe tant qu'il n'en définit
-- pas un explicitement (voir permissions.controller.js:modifierCompte).
ALTER TABLE utilisateurs
  MODIFY COLUMN mot_de_passe_hash VARCHAR(255) NULL,
  ADD COLUMN google_id VARCHAR(255) NULL UNIQUE AFTER mot_de_passe_hash;
