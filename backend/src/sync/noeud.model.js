// Modèle des nœuds de synchronisation (postes de bureau enregistrés).
// Chaque poste s'authentifie auprès du nuage avec un jeton de la forme
// « <id>.<secret> » ; seul le bcrypt du secret est stocké (jeton_hash).
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { pool } from '../config/db.js';

const COUT_BCRYPT = 12;

// Enregistre un nouveau poste. Renvoie { id, jeton } — le jeton n'est
// montré QU'UNE FOIS (non récupérable ensuite).
export async function creerNoeud(nom) {
  const secret = crypto.randomBytes(32).toString('base64url');
  const hash = await bcrypt.hash(secret, COUT_BCRYPT);
  const [r] = await pool.query(
    'INSERT INTO sync_noeuds (nom, jeton_hash) VALUES (?, ?)', [nom, hash]
  );
  return { id: r.insertId, nom, jeton: `${r.insertId}.${secret}` };
}

export async function listerNoeuds() {
  const [r] = await pool.query(
    'SELECT id, nom, actif, dernier_pull, dernier_push, cree_le FROM sync_noeuds ORDER BY cree_le DESC'
  );
  return r;
}

export async function revoquerNoeud(id) {
  const [r] = await pool.query('UPDATE sync_noeuds SET actif = 0 WHERE id = ?', [id]);
  return r.affectedRows > 0;
}

// Vérifie un jeton « <id>.<secret> ». Renvoie le nœud (actif) ou null.
export async function verifierJeton(jeton) {
  if (typeof jeton !== 'string' || !jeton.includes('.')) return null;
  const sep = jeton.indexOf('.');
  const id = Number(jeton.slice(0, sep));
  const secret = jeton.slice(sep + 1);
  if (!Number.isInteger(id) || id <= 0 || !secret) return null;

  const [r] = await pool.query(
    'SELECT id, nom, jeton_hash, actif FROM sync_noeuds WHERE id = ? LIMIT 1', [id]
  );
  if (!r.length || !r[0].actif) return null;
  const ok = await bcrypt.compare(secret, r[0].jeton_hash);
  return ok ? { id: r[0].id, nom: r[0].nom } : null;
}

export async function marquerPull(id) {
  await pool.query('UPDATE sync_noeuds SET dernier_pull = NOW(3) WHERE id = ?', [id]);
}

export async function marquerPush(id) {
  await pool.query('UPDATE sync_noeuds SET dernier_push = NOW(3) WHERE id = ?', [id]);
}
