// Modèle Code de vérification (OTP)
import { pool } from '../config/db.js';

// Invalide tous les codes actifs d'un utilisateur pour un type donné
export async function invaliderCodesActifs(idUtilisateur, type) {
  await pool.query(
    'UPDATE codes_verification SET utilise = 1 WHERE id_utilisateur = ? AND type = ? AND utilise = 0',
    [idUtilisateur, type]
  );
}

// Crée un nouveau code (hash) avec expiration
export async function creerCode({ idUtilisateur, codeHash, type, expireLe }) {
  const [res] = await pool.query(
    'INSERT INTO codes_verification (id_utilisateur, code_hash, type, expire_le) VALUES (?, ?, ?, ?)',
    [idUtilisateur, codeHash, type, expireLe]
  );
  return res.insertId;
}

// Retourne le dernier code actif (non utilisé) d'un utilisateur pour un type
export async function trouverCodeActif(idUtilisateur, type) {
  const [rows] = await pool.query(
    `SELECT id, id_utilisateur, code_hash, type, tentatives, utilise, expire_le
       FROM codes_verification
      WHERE id_utilisateur = ? AND type = ? AND utilise = 0
      ORDER BY id DESC LIMIT 1`,
    [idUtilisateur, type]
  );
  return rows[0] || null;
}

export async function incrementerTentatives(idCode) {
  await pool.query(
    'UPDATE codes_verification SET tentatives = tentatives + 1 WHERE id = ?',
    [idCode]
  );
}

export async function marquerUtilise(idCode) {
  await pool.query('UPDATE codes_verification SET utilise = 1 WHERE id = ?', [idCode]);
}

// Nettoyage : supprime les codes expirés ou déjà utilisés de plus de 7 jours.
// Les codes sont hachés et à usage unique — ce nettoyage est de l'hygiène de
// base de données, pas une mesure de sécurité.
export async function purgerCodesAnciens() {
  await pool.query(
    "DELETE FROM codes_verification WHERE (utilise = 1 OR expire_le < NOW()) AND cree_le < (NOW() - INTERVAL 7 DAY)"
  );
}
