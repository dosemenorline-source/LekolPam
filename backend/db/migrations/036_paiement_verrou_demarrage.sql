-- Verrou anti double-clic sur le démarrage d'un paiement en ligne : deux
-- clics rapprochés créaient deux transactions plopplop, et seule la dernière
-- référence était gardée — le parent pouvait payer la première sans que le
-- paiement soit jamais confirmé.
ALTER TABLE paiements
  ADD COLUMN reference_demarree_le DATETIME NULL AFTER reference_externe;
