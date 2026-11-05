-- Migration 020 : seuil de réussite (note de passage) configurable
-- Le secrétariat définit la note à partir de laquelle une note est
-- considérée « réussie » (affichage coloré dans Saisie des notes).
ALTER TABLE ecole
  ADD COLUMN seuil_reussite DECIMAL(5,2) NOT NULL DEFAULT 60 AFTER courriel;
