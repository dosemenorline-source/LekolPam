-- Migration 042 : une seule campagne de ré-inscription active à la fois.
-- Colonne actif_unique = 'O' pour la campagne active, NULL sinon. MySQL autorise
-- plusieurs NULL dans un index UNIQUE : la contrainte n'empêche donc que deux
-- campagnes ACTIVES simultanées (protège contre les doubles clics / concurrence).
ALTER TABLE reinscription_campagne
  ADD COLUMN actif_unique CHAR(1) NULL AFTER active;

-- Marque la campagne active existante (le cas échéant) avant de poser l'index.
UPDATE reinscription_campagne SET actif_unique = 'O' WHERE active = 1;

ALTER TABLE reinscription_campagne
  ADD UNIQUE KEY uq_reinscription_actif (actif_unique);
