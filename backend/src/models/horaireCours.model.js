// Modèle Horaire de cours — créneaux (jour + heure) soumis par un professeur
// pour une de ses matières. L'horaire complet d'une classe (niveau) est la
// réunion des créneaux soumis par chacun de ses professeurs.
import { pool } from '../config/db.js';

export async function creer({ idMatiere, idEnseignant, jourSemaine, heureDebut, heureFin, salle }) {
  const [res] = await pool.query(
    `INSERT INTO horaires_cours (id_matiere, id_enseignant, jour_semaine, heure_debut, heure_fin, salle)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [idMatiere, idEnseignant, jourSemaine, heureDebut, heureFin, salle || null]
  );
  return res.insertId;
}

export async function trouverParId(id) {
  const [rows] = await pool.query('SELECT * FROM horaires_cours WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
}

export async function listerPourEnseignant(idEnseignant, idMatiere) {
  const params = [idEnseignant];
  let where = 'h.id_enseignant = ?';
  if (idMatiere) { where += ' AND h.id_matiere = ?'; params.push(idMatiere); }
  const [rows] = await pool.query(
    `SELECT h.*, m.nom AS matiere_nom, m.niveau
       FROM horaires_cours h JOIN matieres m ON m.id = h.id_matiere
      WHERE ${where}
      ORDER BY FIELD(h.jour_semaine, 'lundi','mardi','mercredi','jeudi','vendredi','samedi'), h.heure_debut`,
    params
  );
  return rows;
}

// Horaire complet visible par un élève : tous les créneaux des matières de son niveau.
export async function listerPourNiveau(niveau) {
  const [rows] = await pool.query(
    `SELECT h.id, h.jour_semaine, h.heure_debut, h.heure_fin, h.salle,
            m.nom AS matiere_nom, u.nom AS enseignant_nom
       FROM horaires_cours h
       JOIN matieres m ON m.id = h.id_matiere
       JOIN utilisateurs u ON u.id = h.id_enseignant
      WHERE m.niveau = ?
      ORDER BY FIELD(h.jour_semaine, 'lundi','mardi','mercredi','jeudi','vendredi','samedi'), h.heure_debut`,
    [niveau]
  );
  return rows;
}

export async function mettreAJour(id, idEnseignant, { jourSemaine, heureDebut, heureFin, salle }) {
  const [res] = await pool.query(
    `UPDATE horaires_cours SET jour_semaine = ?, heure_debut = ?, heure_fin = ?, salle = ?
      WHERE id = ? AND id_enseignant = ?`,
    [jourSemaine, heureDebut, heureFin, salle || null, id, idEnseignant]
  );
  return res.affectedRows > 0;
}

export async function supprimer(id, idEnseignant) {
  const [res] = await pool.query(
    'DELETE FROM horaires_cours WHERE id = ? AND id_enseignant = ?', [id, idEnseignant]
  );
  return res.affectedRows > 0;
}
