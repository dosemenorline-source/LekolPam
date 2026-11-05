-- Badge élève : photo de l'élève + logo de l'école.

ALTER TABLE eleves ADD COLUMN photo_url VARCHAR(500) NULL AFTER code_acces;
ALTER TABLE ecole  ADD COLUMN logo_url  VARCHAR(500) NULL;
