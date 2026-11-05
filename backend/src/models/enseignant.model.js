// Modèle Enseignant — comptes professeur (utilisateurs.role = 'professeur')
// et attribution des matières (= classes) que chacun enseigne.
import { pool } from '../config/db.js';

// Crée un compte professeur. Le mot de passe est déjà haché par l'appelant.
export async function creer({ nom, courriel, motDePasseHash }) {
  const [res] = await pool.query(
    'INSERT INTO utilisateurs (nom, courriel, mot_de_passe_hash, role, courriel_verifie) VALUES (?, ?, ?, ?, 1)',
    [nom, courriel, motDePasseHash, 'professeur']
  );
  return { id: res.insertId, nom, courriel, role: 'professeur', statut: 'actif' };
}

// Liste tous les comptes professeur, avec leurs matières (classes) assignées.
export async function lister() {
  const [profs] = await pool.query(
    `SELECT id, nom, courriel, statut, cree_le FROM utilisateurs WHERE role = 'professeur' ORDER BY nom`
  );
  if (profs.length === 0) return [];

  const [assignations] = await pool.query(
    `SELECT em.id_utilisateur, m.id, m.nom, m.niveau
       FROM enseignant_matieres em
       JOIN matieres m ON m.id = em.id_matiere
      WHERE em.id_utilisateur IN (?)
      ORDER BY m.niveau, m.nom`,
    [profs.map((p) => p.id)]
  );
  const parEnseignant = new Map();
  for (const a of assignations) {
    const liste = parEnseignant.get(a.id_utilisateur) || [];
    liste.push({ id: a.id, nom: a.nom, niveau: a.niveau });
    parEnseignant.set(a.id_utilisateur, liste);
  }
  return profs.map((p) => ({ ...p, matieres: parEnseignant.get(p.id) || [] }));
}

export async function trouverParId(id) {
  const [rows] = await pool.query(
    `SELECT id, nom, courriel, statut, cree_le FROM utilisateurs WHERE id = ? AND role = 'professeur' LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

export async function definirStatut(id, statut) {
  await pool.query(`UPDATE utilisateurs SET statut = ? WHERE id = ? AND role = 'professeur'`, [statut, id]);
}

// Matières (classes) assignées à un professeur.
export async function mesMatieres(idUtilisateur) {
  const [rows] = await pool.query(
    `SELECT m.id, m.nom, m.niveau
       FROM enseignant_matieres em
       JOIN matieres m ON m.id = em.id_matiere
      WHERE em.id_utilisateur = ?
      ORDER BY m.niveau, m.nom`,
    [idUtilisateur]
  );
  return rows;
}

// Vrai si idMatiere fait partie des matières assignées à ce professeur —
// contrôle d'accès pour toute écriture (devoir/document/horaire) : un
// professeur ne peut jamais agir sur une classe qui n'est pas la sienne.
export async function enseigneMatiere(idUtilisateur, idMatiere) {
  const [rows] = await pool.query(
    'SELECT 1 FROM enseignant_matieres WHERE id_utilisateur = ? AND id_matiere = ? LIMIT 1',
    [idUtilisateur, idMatiere]
  );
  return rows.length > 0;
}

export async function assignerMatiere(idUtilisateur, idMatiere) {
  await pool.query(
    'INSERT IGNORE INTO enseignant_matieres (id_utilisateur, id_matiere) VALUES (?, ?)',
    [idUtilisateur, idMatiere]
  );
}

export async function retirerMatiere(idUtilisateur, idMatiere) {
  await pool.query(
    'DELETE FROM enseignant_matieres WHERE id_utilisateur = ? AND id_matiere = ?',
    [idUtilisateur, idMatiere]
  );
}
