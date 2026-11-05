-- Sépare le prénom du nom pour l'élève (utilisé notamment sur le badge).
-- Les enregistrements existants gardent le nom complet dans `nom` (prenom NULL).

ALTER TABLE eleves ADD COLUMN prenom VARCHAR(120) NULL AFTER nom;
