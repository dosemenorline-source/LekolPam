// Modèle Matière (nom + coefficient, par niveau)
import { pool } from '../config/db.js';

export async function creer({ nom, niveau, coefficient }) {
  const [res] = await pool.query(
    'INSERT INTO matieres (nom, niveau, coefficient) VALUES (?, ?, ?)',
    [nom, niveau, coefficient]
  );
  return res.insertId;
}

export async function trouverParId(id) {
  const [rows] = await pool.query('SELECT * FROM matieres WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
}

export async function lister(niveau) {
  if (niveau) {
    const [rows] = await pool.query(
      'SELECT * FROM matieres WHERE niveau = ? ORDER BY nom', [niveau]
    );
    return rows;
  }
  const [rows] = await pool.query('SELECT * FROM matieres ORDER BY niveau, nom');
  return rows;
}

export async function mettreAJour(id, { nom, niveau, coefficient, actif }) {
  const champs = [];
  const params = [];
  if (nom !== undefined) { champs.push('nom = ?'); params.push(nom); }
  if (niveau !== undefined) { champs.push('niveau = ?'); params.push(niveau); }
  if (coefficient !== undefined) { champs.push('coefficient = ?'); params.push(coefficient); }
  if (actif !== undefined) { champs.push('actif = ?'); params.push(actif ? 1 : 0); }
  if (!champs.length) return;
  params.push(id);
  await pool.query(`UPDATE matieres SET ${champs.join(', ')} WHERE id = ?`, params);
}

export async function supprimer(id) {
  const [res] = await pool.query('DELETE FROM matieres WHERE id = ?', [id]);
  return res.affectedRows > 0;
}
