// Modèle École (coordonnées de paiement) — une seule fiche
import { pool } from '../config/db.js';

export async function obtenir() {
  const [rows] = await pool.query('SELECT * FROM ecole ORDER BY id LIMIT 1');
  return rows[0] || null;
}

// Enregistre le chemin du logo de l'école (crée la fiche si absente)
export async function mettreLogo(logoUrl) {
  const existante = await obtenir();
  if (existante) {
    await pool.query('UPDATE ecole SET logo_url = ? WHERE id = ?', [logoUrl, existante.id]);
    return existante.id;
  }
  const [res] = await pool.query(
    'INSERT INTO ecole (nom, logo_url) VALUES (?, ?)', ['Lekòl Pam', logoUrl]
  );
  return res.insertId;
}

// Met à jour uniquement l'en-tête (nom, adresse, tél, courriel) — utilisé pour le badge.
// Préserve les coordonnées bancaires / MonCash et le logo.
export async function mettreEntete({ nom, adresse, telephone, courriel }) {
  const existante = await obtenir();
  if (existante) {
    await pool.query(
      'UPDATE ecole SET nom = ?, adresse = ?, telephone = ?, courriel = ? WHERE id = ?',
      [nom, adresse || null, telephone || null, courriel || null, existante.id]
    );
    return existante.id;
  }
  const [res] = await pool.query(
    'INSERT INTO ecole (nom, adresse, telephone, courriel) VALUES (?, ?, ?, ?)',
    [nom, adresse || null, telephone || null, courriel || null]
  );
  return res.insertId;
}

// Met à jour uniquement le seuil de réussite (note de passage /100)
export async function mettreSeuilReussite(seuil) {
  const existante = await obtenir();
  if (existante) {
    await pool.query('UPDATE ecole SET seuil_reussite = ? WHERE id = ?', [seuil, existante.id]);
    return existante.id;
  }
  const [res] = await pool.query(
    'INSERT INTO ecole (nom, seuil_reussite) VALUES (?, ?)', ['Lekòl Pam', seuil]
  );
  return res.insertId;
}

// Crée la fiche si absente, sinon la met à jour
export async function definir({ nom, coordonneesBancaires, coordonneesMoncash, adresse, telephone, courriel }) {
  const existante = await obtenir();
  if (existante) {
    await pool.query(
      `UPDATE ecole SET nom = ?, coordonnees_bancaires = ?, coordonnees_moncash = ?,
              adresse = ?, telephone = ?, courriel = ? WHERE id = ?`,
      [nom, coordonneesBancaires || null, coordonneesMoncash || null,
        adresse || null, telephone || null, courriel || null, existante.id]
    );
    return existante.id;
  }
  const [res] = await pool.query(
    `INSERT INTO ecole (nom, coordonnees_bancaires, coordonnees_moncash, adresse, telephone, courriel)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [nom, coordonneesBancaires || null, coordonneesMoncash || null,
      adresse || null, telephone || null, courriel || null]
  );
  return res.insertId;
}
