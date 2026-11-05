-- Paiement en ligne via MonCash (API REST Digicel), en plus du dépôt manuel
-- avec preuve téléversée. moncash_order_id/transaction_id tracent l'échange
-- avec l'API pour permettre une vérification/reprise manuelle si besoin.
ALTER TABLE paiements
  ADD COLUMN methode_paiement ENUM('manuel','moncash') NOT NULL DEFAULT 'manuel' AFTER type_frais,
  ADD COLUMN moncash_order_id VARCHAR(64) NULL AFTER preuve_url,
  ADD COLUMN moncash_transaction_id VARCHAR(64) NULL AFTER moncash_order_id;
