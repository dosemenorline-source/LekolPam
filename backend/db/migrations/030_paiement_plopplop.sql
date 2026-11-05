-- Remplace l'intégration MonCash directe (API Digicel) par l'agrégateur
-- plopplop (MonCash + NatCash + KashPay via une seule API). Aucun paiement
-- existant n'utilisait moncash_order_id/moncash_transaction_id au moment de
-- cette migration (vérifié) : renommage direct, pas de migration de données.
ALTER TABLE paiements
  MODIFY COLUMN methode_paiement ENUM('manuel','moncash','natcash','kashpaw') NOT NULL DEFAULT 'manuel',
  CHANGE COLUMN moncash_order_id reference_externe VARCHAR(64) NULL,
  CHANGE COLUMN moncash_transaction_id transaction_externe_id VARCHAR(64) NULL;

ALTER TABLE paiements
  DROP INDEX uq_paiements_moncash_transaction,
  ADD UNIQUE KEY uq_paiements_transaction_externe (transaction_externe_id);
