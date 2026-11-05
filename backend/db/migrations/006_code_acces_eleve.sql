-- Code d'accès unique pour l'espace élève (connexion sans courriel ni mot de passe).
-- Le parent génère le code et le transmet à l'enfant ; l'élève l'utilise pour
-- consulter (lecture seule) ses notes et bulletins.

ALTER TABLE eleves
  ADD COLUMN code_acces VARCHAR(20) NULL UNIQUE AFTER niveau;
