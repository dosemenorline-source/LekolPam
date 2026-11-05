-- Sexe de l'élève, saisi obligatoirement à l'inscription (formulaire public).
ALTER TABLE eleves
  ADD COLUMN sexe ENUM('M','F') NULL AFTER prenom;
