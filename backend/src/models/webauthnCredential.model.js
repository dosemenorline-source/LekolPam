// Modèle des passkeys (appareils WebAuthn) enregistrés par un utilisateur.
import { pool } from '../config/db.js';

// Enregistre un nouveau passkey. transports = tableau (stocké en JSON).
export async function creer({ idUtilisateur, credentialId, clePublique, compteur, transports, appareil }) {
  await pool.query(
    `INSERT INTO webauthn_credentials
       (id_utilisateur, credential_id, cle_publique, compteur, transports, appareil)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [idUtilisateur, credentialId, clePublique, compteur || 0,
      transports ? JSON.stringify(transports) : null, appareil || null]
  );
}

// Passkeys d'un utilisateur (pour exclusion à l'enregistrement et affichage).
export async function listerParUtilisateur(idUtilisateur) {
  const [rows] = await pool.query(
    `SELECT id, credential_id, transports, appareil, cree_le, dernier_usage
       FROM webauthn_credentials WHERE id_utilisateur = ? ORDER BY id DESC`,
    [idUtilisateur]
  );
  return rows;
}

// Retrouve un passkey par son credential_id (à la connexion) — inclut l'utilisateur.
export async function trouverParCredentialId(credentialId) {
  const [rows] = await pool.query(
    `SELECT w.*, u.id AS uid, u.nom, u.courriel, u.role, u.statut
       FROM webauthn_credentials w
       JOIN utilisateurs u ON u.id = w.id_utilisateur
      WHERE w.credential_id = ? LIMIT 1`,
    [credentialId]
  );
  return rows[0] || null;
}

// Met à jour le compteur anti-rejeu après une authentification réussie.
export async function majCompteur(id, compteur) {
  await pool.query(
    'UPDATE webauthn_credentials SET compteur = ?, dernier_usage = NOW() WHERE id = ?',
    [compteur, id]
  );
}

// Supprime un passkey de l'utilisateur (retrait d'un appareil).
export async function supprimer(id, idUtilisateur) {
  const [res] = await pool.query(
    'DELETE FROM webauthn_credentials WHERE id = ? AND id_utilisateur = ?',
    [id, idUtilisateur]
  );
  return res.affectedRows > 0;
}

// Nombre de passkeys d'un utilisateur (pour savoir si la connexion biométrique est active).
export async function compter(idUtilisateur) {
  const [[{ n }]] = await pool.query(
    'SELECT COUNT(*) n FROM webauthn_credentials WHERE id_utilisateur = ?', [idUtilisateur]
  );
  return n;
}
