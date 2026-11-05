// Interrupteurs contrôlés par le propriétaire — désactivent des actions
// normalement réservées à direction/admin (Matières, Saisie des notes,
// Publication des notes). Absence de ligne = autorisé par défaut.
import { pool } from '../config/db.js';

export const CLES = {
  MATIERES: 'matieres_gestion',
  NOTES_SAISIE: 'notes_saisie',
  NOTES_PUBLICATION: 'notes_publication',
  // Paiement des frais exigé à l'inscription. Autorisé (défaut) = paiement
  // obligatoire ; désactivé = inscription sans paiement (dossier transmis
  // directement au secrétariat).
  PAIEMENT_INSCRIPTION: 'paiement_inscription',
  // Auto-inscription des élèves. Contrairement aux autres clés, celle-ci est
  // « opt-in » : désactivée par défaut (voir OPT_IN). Activée = un élève peut
  // créer son propre compte et s'inscrire lui-même.
  INSCRIPTION_ELEVE: 'inscription_eleve',
  // Inscription des parents (création de compte parent). Également « opt-in » :
  // désactivée par défaut (voir OPT_IN). Tant que le propriétaire ne l'a pas
  // activée, la page « Créer un compte parent » est fermée et le point
  // d'entrée /api/auth/register refuse les créations de compte parent.
  INSCRIPTION_PARENT: 'inscription_parent',
};

// Clés « opt-in » : désactivées tant que le propriétaire ne les a pas activées
// (absence de ligne = désactivé). Les autres clés sont « opt-out » (absence =
// autorisé).
const OPT_IN = new Set([CLES.INSCRIPTION_ELEVE, CLES.INSCRIPTION_PARENT]);

const LIBELLES = {
  [CLES.MATIERES]: 'Matières & coefficients',
  [CLES.NOTES_SAISIE]: 'Saisie des notes',
  [CLES.NOTES_PUBLICATION]: 'Publication des notes',
  [CLES.PAIEMENT_INSCRIPTION]: "Paiement à l'inscription",
  [CLES.INSCRIPTION_ELEVE]: "Auto-inscription des élèves",
  [CLES.INSCRIPTION_PARENT]: "Inscription des parents",
};

export async function estAutorise(cle) {
  const [[ligne]] = await pool.query('SELECT autorise FROM permissions WHERE cle = ?', [cle]);
  // Absence de ligne : les clés « opt-in » sont désactivées, les autres autorisées.
  return ligne ? Boolean(ligne.autorise) : !OPT_IN.has(cle);
}

export async function listerPermissions() {
  const [lignes] = await pool.query('SELECT cle, autorise, modifie_le FROM permissions');
  const carte = new Map(lignes.map((l) => [l.cle, l]));
  return Object.values(CLES).map((cle) => ({
    cle,
    libelle: LIBELLES[cle],
    autorise: carte.has(cle) ? Boolean(carte.get(cle).autorise) : !OPT_IN.has(cle),
    modifieLe: carte.get(cle)?.modifie_le || null,
  }));
}

export async function definirPermission(cle, autorise, idAuteur) {
  if (!Object.values(CLES).includes(cle)) {
    return { ok: false, code: 400, erreur: 'Clé de permission invalide.' };
  }
  await pool.query(
    `INSERT INTO permissions (cle, autorise, modifie_par)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE autorise = VALUES(autorise), modifie_par = VALUES(modifie_par)`,
    [cle, autorise ? 1 : 0, idAuteur]
  );
  return { ok: true };
}
