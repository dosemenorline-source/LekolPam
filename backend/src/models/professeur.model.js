// Modèle Professeurs — fiches publiques du corps enseignant
import { pool } from '../config/db.js';

const CHAMPS = 'id, nom, prenom, matiere, fonction, diplomes, experience_annees, parcours, photo_url, cree_le';

export async function creer({ nom, prenom, matiere, fonction, diplomes, experienceAnnees, parcours, photoUrl, idProfsAdmin }) {
  const [res] = await pool.query(
    `INSERT INTO professeurs
       (nom, prenom, matiere, fonction, diplomes, experience_annees, parcours, photo_url, id_profs_admin)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [nom, prenom || null, matiere || null, fonction || null, diplomes || null,
     experienceAnnees ?? null, parcours || null, photoUrl || null, idProfsAdmin || null]
  );
  return res.insertId;
}

export async function lister() {
  const [rows] = await pool.query(
    `SELECT ${CHAMPS} FROM professeurs ORDER BY nom ASC, prenom ASC`
  );
  return rows;
}

export async function trouverParId(id) {
  const [rows] = await pool.query('SELECT * FROM professeurs WHERE id = ? LIMIT 1', [id]);
  return rows[0] || null;
}

export async function majChamps(id, champs) {
  const colonnes = {
    nom: 'nom', prenom: 'prenom', matiere: 'matiere', fonction: 'fonction',
    diplomes: 'diplomes', experienceAnnees: 'experience_annees', parcours: 'parcours',
    photoUrl: 'photo_url',
  };
  const set = [];
  const valeurs = [];
  for (const [cle, colonne] of Object.entries(colonnes)) {
    if (champs[cle] !== undefined) {
      set.push(`${colonne} = ?`);
      valeurs.push(champs[cle]);
    }
  }
  if (set.length === 0) return;
  valeurs.push(id);
  await pool.query(`UPDATE professeurs SET ${set.join(', ')} WHERE id = ?`, valeurs);
}

export async function supprimer(id) {
  await pool.query('DELETE FROM professeurs WHERE id = ?', [id]);
}
