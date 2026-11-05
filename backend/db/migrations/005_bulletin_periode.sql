-- Ajoute la période et l'année scolaire aux documents officiels (bulletins)
-- pour permettre une (re)génération idempotente : un bulletin par élève et par
-- (trimestre, année). Colonnes nullables : les documents existants restent valides.

ALTER TABLE documents_officiels
  ADD COLUMN periode ENUM('1er_trimestre','2e_trimestre','3e_trimestre') NULL AFTER type,
  ADD COLUMN annee_scolaire VARCHAR(9) NULL AFTER periode;
