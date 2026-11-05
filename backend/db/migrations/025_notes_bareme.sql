-- Barème (« sur X ») par note — permet de saisir une note sur 10, 20, 100...
-- au lieu d'imposer /100. Les notes existantes sont considérées /100.
ALTER TABLE notes
  ADD COLUMN bareme DECIMAL(6,2) NOT NULL DEFAULT 100 AFTER valeur;
