// Modèle Document de cours — fichiers déposés par un professeur pour une de ses matières.
import { pool } from '../config/db.js';

export async function creer({ idMatiere, idEnseignant, titre, urlFichier }) {
  const [res] = await pool.query(
    'INSERT INTO documents_cours (id_matiere, id_enseignant, titre, url_fichier) VALUES (?, ?, ?, ?)',
    [idMatiere, idEnseignant, titre, urlFichier]
  );
  return res.insertId;
}

export async function trouverParId(id) {
  const [rows] = await pool.query(
    `SELECT dc.*, m.niveau FROM documents_cours dc
       JOIN matieres m ON m.id = dc.id_matiere
      WHERE dc.id = ? LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

export async function listerPourEnseignant(idEnseignant, idMatiere) {
  const params = [idEnseignant];
  let where = 'dc.id_enseignant = ?';
  if (idMatiere) { where += ' AND dc.id_matiere = ?'; params.push(idMatiere); }
  const [rows] = await pool.query(
    `SELECT dc.*, m.nom AS matiere_nom, m.niveau
       FROM documents_cours dc JOIN matieres m ON m.id = dc.id_matiere
      WHERE ${where}
      ORDER BY dc.cree_le DESC`,
    params
  );
  return rows;
}

// Documents visibles par un élève : toutes les matières de son niveau.
export async function listerPourNiveau(niveau) {
  const [rows] = await pool.query(
    `SELECT dc.id, dc.titre, dc.url_fichier, dc.cree_le,
            m.nom AS matiere_nom, u.nom AS enseignant_nom
       FROM documents_cours dc
       JOIN matieres m ON m.id = dc.id_matiere
       JOIN utilisateurs u ON u.id = dc.id_enseignant
      WHERE m.niveau = ?
      ORDER BY dc.cree_le DESC`,
    [niveau]
  );
  return rows;
}

export async function supprimer(id, idEnseignant) {
  const [res] = await pool.query(
    'DELETE FROM documents_cours WHERE id = ? AND id_enseignant = ?', [id, idEnseignant]
  );
  return res.affectedRows > 0;
}
