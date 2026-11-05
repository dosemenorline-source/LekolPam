-- Migration 018 : agrandir historique_statut.commentaire (VARCHAR(500) -> TEXT)
-- Les messages rédigés par l'assistant IA (Traiter le dossier) dépassent souvent
-- 500 caractères, ce qui faisait échouer l'enregistrement avec une erreur
-- ER_DATA_TOO_LONG (et une erreur 500 côté client) malgré un changement de
-- statut déjà appliqué.
ALTER TABLE historique_statut MODIFY commentaire TEXT;
