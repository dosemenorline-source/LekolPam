-- acquitte_par est une clé étrangère vers utilisateurs(id) : un compte
-- Économat (système d'authentification indépendant, economat_admins) ne peut
-- jamais y être stocké — d'où acquitte_par toujours NULL quand l'action vient
-- d'Économat (bug : perte de traçabilité, voir paiement.controller.js pour le
-- même problème déjà corrigé côté paiements). acquitte_par_note trace son
-- identité (e-mail) sans toucher à la contrainte.
ALTER TABLE acquittements_scolarite
  ADD COLUMN acquitte_par_note VARCHAR(255) NULL AFTER acquitte_par;
