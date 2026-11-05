-- Paiement par carte (Visa/Mastercard) via l'agrégateur plopplop, en plus
-- de MonCash, NatCash et KashPay.
ALTER TABLE paiements
  MODIFY COLUMN methode_paiement ENUM('manuel','moncash','natcash','kashpaw','carte') NOT NULL DEFAULT 'manuel';
