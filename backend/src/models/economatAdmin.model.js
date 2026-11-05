// Modèle Admin Économat — authentification indépendante des comptes école
import { pool } from '../config/db.js';

export async function trouverParEmail(email) {
  const [rows] = await pool.query('SELECT * FROM economat_admins WHERE email = ? LIMIT 1', [email]);
  return rows[0] || null;
}

export async function trouverParId(id) {
  const [rows] = await pool.query(
    'SELECT id, email, cree_le FROM economat_admins WHERE id = ? LIMIT 1', [id]
  );
  return rows[0] || null;
}

// Inclut le hash — réservé au changement de mot de passe (vérification de
// l'ancien mot de passe), jamais renvoyé tel quel au client.
export async function trouverParIdAvecHash(id) {
  const [rows] = await pool.query('SELECT * FROM economat_admins WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
}

export async function mettreAJourEmail(id, email) {
  await pool.query('UPDATE economat_admins SET email = ? WHERE id = ?', [email, id]);
}

export async function mettreAJourMotDePasse(id, hash) {
  await pool.query('UPDATE economat_admins SET mot_de_passe_hash = ? WHERE id = ?', [hash, id]);
}
