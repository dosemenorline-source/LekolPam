// Modèle Devoir — devoirs soumis par un professeur pour une de ses matières (classes).
import { pool } from '../config/db.js';

export async function creer({ idMatiere, idEnseignant, titre, description, dateLimite }) {
  const [res] = await pool.query(
    'INSERT INTO devoirs (id_matiere, id_enseignant, titre, description, date_limite) VALUES (?, ?, ?, ?, ?)',
    [idMatiere, idEnseignant, titre, description || null, dateLimite || null]
  );
  return res.insertId;
}

export async function trouverParId(id) {
  const [rows] = await pool.query('SELECT * FROM devoirs WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
}

// Devoirs d'un professeur, éventuellement filtrés sur une matière précise.
export async function listerPourEnseignant(idEnseignant, idMatiere) {
  const params = [idEnseignant];
  let where = 'd.id_enseignant = ?';
  if (idMatiere) { where += ' AND d.id_matiere = ?'; params.push(idMatiere); }
  const [rows] = await pool.query(
    `SELECT d.*, m.nom AS matiere_nom, m.niveau
       FROM devoirs d JOIN matieres m ON m.id = d.id_matiere
      WHERE ${where}
      ORDER BY d.date_limite IS NULL, d.date_limite, d.cree_le DESC`,
    params
  );
  return rows;
}

// Devoirs visibles par un élève : toutes les matières de son niveau.
export async function listerPourNiveau(niveau) {
  const [rows] = await pool.query(
    `SELECT d.id, d.titre, d.description, d.date_limite, d.cree_le,
            m.nom AS matiere_nom, u.nom AS enseignant_nom
       FROM devoirs d
       JOIN matieres m ON m.id = d.id_matiere
       JOIN utilisateurs u ON u.id = d.id_enseignant
      WHERE m.niveau = ?
      ORDER BY d.date_limite IS NULL, d.date_limite, d.cree_le DESC`,
    [niveau]
  );
  return rows;
}

export async function supprimer(id, idEnseignant) {
  const [res] = await pool.query(
    'DELETE FROM devoirs WHERE id = ? AND id_enseignant = ?', [id, idEnseignant]
  );
  return res.affectedRows > 0;
}
