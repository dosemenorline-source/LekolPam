// Modèle Paiement (id_reference polymorphe : inscription ou élève selon type_frais)
import { pool } from '../config/db.js';

export async function creer({ typeFrais, idReference, montant, devise }) {
  const [res] = await pool.query(
    'INSERT INTO paiements (type_frais, id_reference, montant, devise) VALUES (?, ?, ?, ?)',
    [typeFrais, idReference, montant, devise]
  );
  return res.insertId;
}

export async function trouverParId(id) {
  const [rows] = await pool.query('SELECT * FROM paiements WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
}

export async function definirPreuve(id, preuveUrl) {
  await pool.query('UPDATE paiements SET preuve_url = ? WHERE id = ?', [preuveUrl, id]);
}

// Marque un paiement comme réglé via un moyen mobile (moncash/natcash/kashpaw,
// via plopplop) et enregistre la référence de la tentative (une nouvelle
// tentative écrase la précédente, sans conséquence : seul le dernier échange
// compte).
export async function definirMethodeMobile(id, methode, referenceExterne) {
  await pool.query(
    'UPDATE paiements SET methode_paiement = ?, reference_externe = ? WHERE id = ?',
    [methode, referenceExterne, id]
  );
}

// Verrou anti double-clic : réserve le démarrage d'un paiement en ligne pour
// 30 s. Retourne false si un autre démarrage est déjà en cours pour ce
// paiement (deux clics rapprochés, deux onglets).
export async function reserverDemarrage(id) {
  const [res] = await pool.query(
    `UPDATE paiements SET reference_demarree_le = NOW()
      WHERE id = ? AND statut = 'en_attente'
        AND (reference_demarree_le IS NULL OR reference_demarree_le < NOW() - INTERVAL 30 SECOND)`,
    [id]
  );
  return res.affectedRows > 0;
}

// Libère le verrou si la création de la transaction a échoué (réessai immédiat possible).
export async function libererDemarrage(id) {
  await pool.query('UPDATE paiements SET reference_demarree_le = NULL WHERE id = ?', [id]);
}

export async function definirTransactionExterne(id, transactionId) {
  await pool.query('UPDATE paiements SET transaction_externe_id = ? WHERE id = ?', [transactionId, id]);
}

// Retrouve le paiement (s'il existe) déjà crédité pour une transaction externe
// donnée — garde-fou anti-rejeu en complément de la contrainte UNIQUE en base.
export async function trouverParTransactionExterne(transactionId) {
  const [rows] = await pool.query(
    'SELECT id FROM paiements WHERE transaction_externe_id = ? LIMIT 1', [transactionId]
  );
  return rows[0] || null;
}

// Retrouve le paiement par sa référence générée côté serveur (reference_externe,
// voir demarrerPaiementMobile) — utilisé par le webhook plopplop pour savoir
// QUEL paiement revérifier, jamais pour décider seul de son statut.
export async function trouverParReferenceExterne(referenceExterne) {
  const [rows] = await pool.query(
    'SELECT * FROM paiements WHERE reference_externe = ? LIMIT 1', [referenceExterne]
  );
  return rows[0] || null;
}

// Prise atomique : la clause « AND statut = 'en_attente' » garantit qu'un
// seul appelant peut faire passer ce paiement hors de en_attente, même si
// deux vérifications tournent en même temps (retour du parent + relance
// manuelle, ou la reconciliation périodique qui tombe au même moment) —
// sans ça, les deux passeraient le contrôle « statut !== 'en_attente' » fait
// en mémoire AVANT cet appel, et le document/la notification partiraient en
// double. Retourne true si CET appel a bien fait la transition (donc doit
// continuer vers les effets de bord), false si quelqu'un d'autre l'a déjà fait.
export async function mettreAJourValidation(id, { statut, validePar }) {
  const [res] = await pool.query(
    "UPDATE paiements SET statut = ?, valide_par = ?, valide_le = NOW() WHERE id = ? AND statut = 'en_attente'",
    [statut, validePar || null, id]
  );
  return res.affectedRows > 0;
}

// Paiements d'un parent (résolution polymorphe de la propriété)
export async function listerParParent(idParent) {
  const [rows] = await pool.query(
    `SELECT p.* FROM paiements p
      WHERE (p.type_frais = 'inscription' AND p.id_reference IN (
               SELECT i.id FROM inscriptions i JOIN eleves e ON e.id = i.id_eleve WHERE e.id_parent = ?))
         OR (p.type_frais IN ('releve','duplicata') AND p.id_reference IN (
               SELECT id FROM eleves WHERE id_parent = ?))
      ORDER BY p.id DESC`,
    [idParent, idParent]
  );
  return rows;
}

// File de validation (admin), filtrable par statut. Les frais d'un dossier
// d'inscription encore impayé (ou annulé faute de paiement) n'y figurent pas :
// il n'y a rien à vérifier tant qu'aucune transaction n'a abouti.
const HORS_DOSSIERS_NON_PAYES = `NOT (type_frais = 'inscription' AND transaction_externe_id IS NULL
  AND id_reference IN (SELECT id FROM inscriptions WHERE statut IN ('attente_paiement','annulee')))`;

export async function listerAdmin(statut) {
  if (statut) {
    const [rows] = await pool.query(
      `SELECT * FROM paiements WHERE statut = ? AND ${HORS_DOSSIERS_NON_PAYES} ORDER BY id DESC`, [statut]
    );
    return rows;
  }
  const [rows] = await pool.query(`SELECT * FROM paiements WHERE ${HORS_DOSSIERS_NON_PAYES} ORDER BY id DESC`);
  return rows;
}

// Frais d'une inscription : le paiement validé s'il existe, sinon le plus récent.
export async function trouverPourInscription(idInscription) {
  const [rows] = await pool.query(
    `SELECT * FROM paiements WHERE type_frais = 'inscription' AND id_reference = ?
      ORDER BY (statut = 'valide') DESC, id DESC LIMIT 1`,
    [idInscription]
  );
  return rows[0] || null;
}

// Paiements mobiles (moncash/natcash/kashpaw) encore en attente, démarrés
// depuis moins de 48h — plopplop n'a pas de webhook, ce sont les seuls
// candidats utiles pour une reconciliation périodique côté serveur (voir
// reconcilierPaiementsMobilesEnAttente). Au-delà de 48h, une tentative
// abandonnée n'a plus de raison d'être re-vérifiée en boucle.
export async function listerMobilesEnAttente() {
  const [rows] = await pool.query(
    `SELECT * FROM paiements
      WHERE statut = 'en_attente' AND methode_paiement != 'manuel'
        AND reference_externe IS NOT NULL
        AND cree_le >= (NOW() - INTERVAL 48 HOUR)
      ORDER BY id`
  );
  return rows;
}
