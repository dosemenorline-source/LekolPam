-- Migration 014 — Champs « surcharge badge » : le secrétariat peut saisir
-- ses propres valeurs pour le badge SANS modifier la fiche officielle de l'élève.
-- Si une surcharge est NULL/vide, le badge retombe sur la valeur automatique.
-- (badge_emis_le et groupe_sanguin existent déjà via la migration 013.)
-- NB : appliquée via script gardé (MySQL 8.x ne supporte pas ADD COLUMN IF NOT EXISTS).

ALTER TABLE eleves
  ADD COLUMN badge_nom     VARCHAR(120) NULL,
  ADD COLUMN badge_prenom  VARCHAR(120) NULL,
  ADD COLUMN badge_classe  VARCHAR(60)  NULL,
  ADD COLUMN badge_annee   VARCHAR(9)   NULL;
