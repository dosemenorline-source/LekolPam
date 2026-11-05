// Modèle Frais divers — catalogue de frais géré par la direction
import { pool } from '../config/db.js';

export async function creer({ nom, niveau, anneeScolaire, montant, devise, unite }) {
  const [res] = await pool.query(
    'INSERT INTO frais_divers (nom, niveau, annee_scolaire, montant, devise, unite) VALUES (?, ?, ?, ?, ?, ?)',
    [nom, niveau || null, anneeScolaire || null, montant, devise, unite || null]
  );
  return res.insertId;
}

export async function lister() {
  const [rows] = await pool.query(
    'SELECT * FROM frais_divers WHERE actif = 1 ORDER BY nom, niveau, annee_scolaire'
  );
  return rows;
}

export async function trouverParId(id) {
  const [rows] = await pool.query('SELECT * FROM frais_divers WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
}

export async function mettreAJour(id, { nom, niveau, anneeScolaire, montant, devise, unite }) {
  const champs = [];
  const params = [];
  if (nom !== undefined) { champs.push('nom = ?'); params.push(nom); }
  if (niveau !== undefined) { champs.push('niveau = ?'); params.push(niveau || null); }
  if (anneeScolaire !== undefined) { champs.push('annee_scolaire = ?'); params.push(anneeScolaire || null); }
  if (montant !== undefined) { champs.push('montant = ?'); params.push(montant); }
  if (devise !== undefined) { champs.push('devise = ?'); params.push(devise); }
  if (unite !== undefined) { champs.push('unite = ?'); params.push(unite || null); }
  if (!champs.length) return;
  params.push(id);
  await pool.query(`UPDATE frais_divers SET ${champs.join(', ')} WHERE id = ?`, params);
}

// Suppression logique : on garde la ligne mais on la masque.
export async function supprimer(id) {
  await pool.query('UPDATE frais_divers SET actif = 0 WHERE id = ?', [id]);
}
