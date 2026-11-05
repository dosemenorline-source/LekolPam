-- Migration 013 — Carte d'identité étudiant enrichie (recto/verso façon carte ID)
-- Nouveaux champs élève : groupe sanguin + date d'émission du badge.
-- Nouveaux champs école : adresse, téléphone, courriel (affichés au verso).
-- NB : appliquée via un script gardé (vérifie l'existence des colonnes) car
-- MySQL 8.x ne supporte pas « ADD COLUMN IF NOT EXISTS ».

ALTER TABLE eleves
  ADD COLUMN groupe_sanguin VARCHAR(5) NULL,
  ADD COLUMN badge_emis_le  DATE       NULL;

ALTER TABLE ecole
  ADD COLUMN adresse   VARCHAR(255) NULL,
  ADD COLUMN telephone VARCHAR(50)  NULL,
  ADD COLUMN courriel  VARCHAR(150) NULL;
