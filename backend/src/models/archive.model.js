// Modèle « documents_archive » — anciens documents (Excel/Word/PPT/PDF) intégrés
// à l'école comme archive, classés par service.
import { pool } from '../config/db.js';

export const SERVICES = ['economat', 'secretariat', 'direction', 'autre'];

export async function creer({ service, titre, description, nomFichier, chemin, typeMime, taille, televersePar, televerseParNom }) {
  const [res] = await pool.query(
    `INSERT INTO documents_archive
       (service, titre, description, nom_fichier, chemin, type_mime, taille, televerse_par, televerse_par_nom)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [service, titre, description || null, nomFichier, chemin, typeMime || null,
      taille || null, televersePar || null, televerseParNom || null]
  );
  return res.insertId;
}

// Liste les documents (tous, ou d'un service donné), les plus récents d'abord.
export async function lister(service) {
  const conditions = [];
  const params = [];
  if (service) { conditions.push('service = ?'); params.push(service); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const [rows] = await pool.query(
    `SELECT id, service, titre, description, nom_fichier, type_mime, taille,
            televerse_par_nom, televerse_le
       FROM documents_archive ${where}
      ORDER BY televerse_le DESC, id DESC`,
    params
  );
  return rows;
}

export async function trouverParId(id) {
  const [[ligne]] = await pool.query(
    `SELECT id, service, titre, nom_fichier, chemin, type_mime FROM documents_archive WHERE id = ? LIMIT 1`,
    [id]
  );
  return ligne || null;
}

export async function supprimer(id) {
  const [res] = await pool.query('DELETE FROM documents_archive WHERE id = ?', [id]);
  return res.affectedRows > 0;
}
