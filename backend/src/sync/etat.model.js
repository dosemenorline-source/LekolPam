// État local de synchronisation (table sync_etat, côté poste).
// Clé/valeur simple : curseur de pull, dernier résultat, horodatage…
import { pool } from '../config/db.js';

export async function lireEtat(cle) {
  const [r] = await pool.query('SELECT valeur FROM sync_etat WHERE cle = ? LIMIT 1', [cle]);
  return r.length ? r[0].valeur : null;
}

export async function ecrireEtat(cle, valeur) {
  await pool.query(
    `INSERT INTO sync_etat (cle, valeur) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE valeur = VALUES(valeur)`,
    [cle, valeur == null ? null : String(valeur)]
  );
}

// Vue d'ensemble pour l'interface du poste (non sensible).
export async function resumeEtat() {
  const [lignes] = await pool.query('SELECT cle, valeur, maj_le FROM sync_etat');
  const map = Object.fromEntries(lignes.map((l) => [l.cle, l.valeur]));
  return {
    curseur: map.pull_cursor || null,
    dernierSync: map.dernier_sync || null,
    statut: map.statut || 'jamais',          // en_ligne | hors_ligne | erreur | jamais
    derniereErreur: map.derniere_erreur || null,
    enAttente: Number(map.en_attente || 0),  // nb de modifs locales pas encore poussées
  };
}
