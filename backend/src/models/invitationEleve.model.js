// Modèle « invitation élève » — codes que l'école remet aux VRAIS élèves pour
// qu'ils puissent créer leur compte eux-mêmes. Objectif : empêcher une personne
// qui n'est pas élève de l'école de s'inscrire comme élève.
//
// Un code est à usage unique. Il est VALIDE tant qu'il est : non révoqué, non
// utilisé et non expiré. Il est consommé (lié au compte créé) à la création du
// compte élève, dans la même transaction, pour qu'il ne serve jamais deux fois.
import crypto from 'crypto';
import { pool } from '../config/db.js';

// Alphabet sans caractères ambigus (ni 0/O, ni 1/I/L) — facile à dicter et à
// recopier sans erreur. 8 caractères ⇒ ~30^8 combinaisons (non devinable).
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const LONGUEUR = 8;

function genererCode() {
  let s = '';
  for (let i = 0; i < LONGUEUR; i += 1) s += ALPHABET[crypto.randomInt(ALPHABET.length)];
  return s;
}

// Crée une invitation avec un code unique. `note` = repère libre pour l'école
// (ex. nom/niveau de l'élève attendu). `expireLe` = Date|null (null = jamais).
export async function creer({ note = null, expireLe = null, creePar = null }) {
  // Quelques tentatives en cas de collision improbable sur le code unique.
  for (let essai = 0; essai < 6; essai += 1) {
    const code = genererCode();
    try {
      const [res] = await pool.query(
        `INSERT INTO invitations_eleve (code, note, expire_le, cree_par)
         VALUES (?, ?, ?, ?)`,
        [code, note ? String(note).slice(0, 160) : null, expireLe, creePar]
      );
      return { id: res.insertId, code };
    } catch (err) {
      if (err && err.code === 'ER_DUP_ENTRY' && essai < 5) continue; // code déjà pris : on réessaie
      throw err;
    }
  }
  throw new Error("Impossible de générer un code d'invitation unique.");
}

// Statut lisible dérivé de l'état de la ligne.
function statutDe(ligne) {
  if (ligne.revoque) return 'revoque';
  if (ligne.utilise_par) return 'utilise';
  if (ligne.expire_le && new Date(ligne.expire_le).getTime() <= Date.now()) return 'expire';
  return 'actif';
}

// Liste toutes les invitations (les plus récentes d'abord), avec le nom de
// celui qui l'a créée et, le cas échéant, du compte qui l'a consommée.
export async function lister() {
  const [lignes] = await pool.query(
    `SELECT i.id, i.code, i.note, i.cree_le, i.expire_le, i.utilise_le, i.revoque,
            c.nom AS cree_par_nom, u.nom AS utilise_par_nom
       FROM invitations_eleve i
       LEFT JOIN utilisateurs c ON c.id = i.cree_par
       LEFT JOIN utilisateurs u ON u.id = i.utilise_par
      ORDER BY i.id DESC`
  );
  return lignes.map((l) => ({
    id: l.id,
    code: l.code,
    note: l.note,
    creeLe: l.cree_le,
    expireLe: l.expire_le,
    utiliseLe: l.utilise_le,
    creeParNom: l.cree_par_nom,
    utiliseParNom: l.utilise_par_nom,
    statut: statutDe(l),
  }));
}

// Verrouille et renvoie l'invitation si elle est VALIDE (non utilisée, non
// révoquée, non expirée), sinon null. À appeler DANS une transaction (conn) :
// le verrou (FOR UPDATE) empêche deux inscriptions simultanées de consommer le
// même code.
export async function trouverValidePourMaj(conn, code) {
  const [[ligne]] = await conn.query(
    `SELECT id FROM invitations_eleve
      WHERE code = ?
        AND utilise_par IS NULL
        AND revoque = 0
        AND (expire_le IS NULL OR expire_le > NOW())
      LIMIT 1 FOR UPDATE`,
    [code]
  );
  return ligne || null;
}

// Marque l'invitation comme consommée par le compte créé (même transaction).
export async function marquerUtilisee(conn, id, idUtilisateur) {
  await conn.query(
    `UPDATE invitations_eleve
        SET utilise_par = ?, utilise_le = NOW()
      WHERE id = ?`,
    [idUtilisateur, id]
  );
}

// Révoque une invitation non encore utilisée. Renvoie true si une ligne a été
// révoquée (une invitation déjà utilisée ne peut plus l'être : elle a servi).
export async function revoquer(id) {
  const [res] = await pool.query(
    `UPDATE invitations_eleve SET revoque = 1
      WHERE id = ? AND revoque = 0 AND utilise_par IS NULL`,
    [id]
  );
  return res.affectedRows > 0;
}
