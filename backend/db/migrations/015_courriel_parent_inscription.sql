-- Migration 015 — Courriel du parent sur l'inscription.
-- Sert de destinataire pour les notifications (publication des résultats par trimestre).
-- NB : appliquée via script gardé (MySQL 8.x ne supporte pas ADD COLUMN IF NOT EXISTS).

ALTER TABLE inscriptions
  ADD COLUMN courriel_parent VARCHAR(150) NULL AFTER telephone_parent;
