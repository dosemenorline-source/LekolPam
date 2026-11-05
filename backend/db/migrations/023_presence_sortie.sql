-- Migration 023 : sortie de l'école (en plus de l'entrée déjà en place)
ALTER TABLE presences
  ADD COLUMN heure_depart DATETIME NULL AFTER heure_arrivee;
