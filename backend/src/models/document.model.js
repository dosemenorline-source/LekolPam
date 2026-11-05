// Modèle Document soumis
import { pool } from '../config/db.js';

export async function creerDocument({ idInscription, type, urlFichier }) {
  const [res] = await pool.query(
    'INSERT INTO documents_soumis (id_inscription, type, url_fichier) VALUES (?, ?, ?)',
    [idInscription, type, urlFichier]
  );
  return res.insertId;
}

export async function listerParInscription(idInscription) {
  const [rows] = await pool.query(
    `SELECT id, id_inscription, type, statut_verification, televerse_le
       FROM documents_soumis WHERE id_inscription = ? ORDER BY id`,
    [idInscription]
  );
  return rows;
}

// Document + chaîne de propriété pour contrôle d'accès au fichier
export async function trouverAvecProprietaire(idDocument) {
  const [rows] = await pool.query(
    `SELECT d.id, d.type, d.url_fichier, d.id_inscription,
            i.statut AS inscription_statut, u.id AS id_utilisateur
       FROM documents_soumis d
       JOIN inscriptions i ON i.id = d.id_inscription
       JOIN eleves e ON e.id = i.id_eleve
       JOIN parents p ON p.id = e.id_parent
       JOIN utilisateurs u ON u.id = p.id_utilisateur
      WHERE d.id = ? LIMIT 1`,
    [idDocument]
  );
  return rows[0] || null;
}
