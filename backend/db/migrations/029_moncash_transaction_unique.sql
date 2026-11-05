-- Empêche qu'une même transaction MonCash serve à créditer deux paiements
-- différents (garde-fou en base, en complément de la vérification applicative
-- dans confirmerPaiementMoncash). NULL reste autorisé plusieurs fois (MySQL
-- n'applique l'unicité qu'aux valeurs non nulles) : les paiements manuels ou
-- MonCash non encore confirmés ne sont pas concernés.
ALTER TABLE paiements
  ADD UNIQUE KEY uq_paiements_moncash_transaction (moncash_transaction_id);
