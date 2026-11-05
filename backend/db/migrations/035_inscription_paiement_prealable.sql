-- Le paiement des frais d'inscription se fait à la soumission du dossier :
-- tant qu'il n'est pas confirmé, le dossier est « attente_paiement » (invisible
-- pour le secrétariat), puis « annulee » s'il n'est pas payé à temps.
ALTER TABLE inscriptions
  MODIFY COLUMN statut ENUM('attente_paiement','annulee','en_attente','complement_demande','accepte','refuse','confirmee')
    NOT NULL DEFAULT 'en_attente';
