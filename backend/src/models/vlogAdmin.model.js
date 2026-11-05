// Modèle Admin du vlog — authentification indépendante des comptes école
import { pool } from '../config/db.js';

export async function trouverParIdentifiant(identifiant) {
  const [rows] = await pool.query('SELECT * FROM vlog_admins WHERE identifiant = ? LIMIT 1', [identifiant]);
  return rows[0] || null;
}

export async function trouverParId(id) {
  const [rows] = await pool.query(
    'SELECT id, identifiant, cree_le FROM vlog_admins WHERE id = ? LIMIT 1', [id]
  );
  return rows[0] || null;
}

// Inclut le hash — réservé au changement de mot de passe (vérification de
// l'ancien mot de passe), jamais renvoyé tel quel au client.
export async function trouverParIdAvecHash(id) {
  const [rows] = await pool.query('SELECT * FROM vlog_admins WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
}

export async function mettreAJourIdentifiant(id, identifiant) {
  await pool.query('UPDATE vlog_admins SET identifiant = ? WHERE id = ?', [identifiant, id]);
}

export async function mettreAJourMotDePasse(id, hash) {
  await pool.query('UPDATE vlog_admins SET mot_de_passe_hash = ? WHERE id = ?', [hash, id]);
}
