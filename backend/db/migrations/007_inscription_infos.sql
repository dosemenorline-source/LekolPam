-- Informations complémentaires saisies au moment de l'inscription :
-- coordonnées du parent, ancienne école de l'enfant, et motivation du choix.
-- Toutes nullables (snapshot par dossier).

ALTER TABLE inscriptions
  ADD COLUMN nom_parent        VARCHAR(120) NULL AFTER annee_scolaire,
  ADD COLUMN profession_parent VARCHAR(120) NULL AFTER nom_parent,
  ADD COLUMN telephone_parent  VARCHAR(40)  NULL AFTER profession_parent,
  ADD COLUMN ancienne_ecole    VARCHAR(160) NULL AFTER telephone_parent,
  ADD COLUMN ancienne_classe   VARCHAR(60)  NULL AFTER ancienne_ecole,
  ADD COLUMN raison_choix      VARCHAR(500) NULL AFTER ancienne_classe;
