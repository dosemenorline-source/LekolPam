-- Marque un compte « utilisateur » créé par un élève lui-même (auto-inscription,
-- activée par le propriétaire). Même modèle qu'un compte parent ; ce drapeau
-- sert uniquement à adapter l'interface (libellés « élève » au lieu de « parent »).
ALTER TABLE utilisateurs
  ADD COLUMN compte_eleve TINYINT(1) NOT NULL DEFAULT 0 AFTER role;
