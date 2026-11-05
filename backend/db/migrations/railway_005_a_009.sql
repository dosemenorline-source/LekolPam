-- ============================================================
-- Migrations 005 → 009 regroupées — à exécuter UNE FOIS sur la
-- base MySQL de production (Railway) après le déploiement.
-- ============================================================

-- 005 — bulletins par trimestre/année
ALTER TABLE documents_officiels
  ADD COLUMN periode ENUM('1er_trimestre','2e_trimestre','3e_trimestre') NULL AFTER type,
  ADD COLUMN annee_scolaire VARCHAR(9) NULL AFTER periode;

-- 006 — code d'accès de l'espace élève
ALTER TABLE eleves
  ADD COLUMN code_acces VARCHAR(20) NULL UNIQUE AFTER niveau;

-- 007 — informations parent + ancienne école sur l'inscription
ALTER TABLE inscriptions
  ADD COLUMN nom_parent        VARCHAR(120) NULL AFTER annee_scolaire,
  ADD COLUMN profession_parent VARCHAR(120) NULL AFTER nom_parent,
  ADD COLUMN telephone_parent  VARCHAR(40)  NULL AFTER profession_parent,
  ADD COLUMN ancienne_ecole    VARCHAR(160) NULL AFTER telephone_parent,
  ADD COLUMN ancienne_classe   VARCHAR(60)  NULL AFTER ancienne_ecole,
  ADD COLUMN raison_choix      VARCHAR(500) NULL AFTER ancienne_classe;

-- 008 — badge : photo élève + logo école
ALTER TABLE eleves ADD COLUMN photo_url VARCHAR(500) NULL AFTER code_acces;
ALTER TABLE ecole  ADD COLUMN logo_url  VARCHAR(500) NULL;

-- 009 — prénom de l'élève
ALTER TABLE eleves ADD COLUMN prenom VARCHAR(120) NULL AFTER nom;
