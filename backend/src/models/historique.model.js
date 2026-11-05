// Modèle Historique de statut — traçabilité (horodatage + auteur + commentaire)
import { pool } from '../config/db.js';

export async function journaliser({ entite, idEntite, ancienStatut, nouveauStatut, commentaire, idAuteur }) {
  await pool.query(
    `INSERT INTO historique_statut (entite, id_entite, ancien_statut, nouveau_statut, commentaire, id_auteur)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [entite, idEntite, ancienStatut || null, nouveauStatut, commentaire || null, idAuteur || null]
  );
}

export async function listerPourEntite(entite, idEntite) {
  const [rows] = await pool.query(
    `SELECT ancien_statut, nouveau_statut, commentaire, id_auteur, cree_le
       FROM historique_statut
      WHERE entite = ? AND id_entite = ?
      ORDER BY id`,
    [entite, idEntite]
  );
  return rows;
}
