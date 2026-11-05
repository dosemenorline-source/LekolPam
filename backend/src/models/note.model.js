// Modèle Note
import { pool } from '../config/db.js';

// `niveau` : snapshot du niveau au moment de la saisie (celui de la matière
// choisie, pas forcément celui — actuel — de l'élève : un élève promu ou
// diplômé garde ainsi des notes rattachées au bon niveau historique).
export async function creer({ idEleve, idMatiere, matiere, niveau, periode, anneeScolaire, valeur, bareme, saisiePar, statutValidation }) {
  const [res] = await pool.query(
    `INSERT INTO notes (id_eleve, id_matiere, matiere, niveau, periode, annee_scolaire, valeur, bareme, saisie_par, statut_validation)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [idEleve, idMatiere, matiere, niveau || null, periode, anneeScolaire, valeur, bareme || 100, saisiePar || null, statutValidation || 'saisie']
  );
  return res.insertId;
}

// Note + niveau (celui de la note si connu, sinon celui — actuel — de
// l'élève) pour vérifier publication + propriété
export async function trouverParId(id) {
  const [rows] = await pool.query(
    `SELECT n.*, COALESCE(n.niveau, e.niveau) AS niveau, e.id_parent
       FROM notes n JOIN eleves e ON e.id = n.id_eleve
      WHERE n.id = ? LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

export async function mettreAJourValeur(id, valeur, bareme) {
  await pool.query('UPDATE notes SET valeur = ?, bareme = ? WHERE id = ?', [valeur, bareme || 100, id]);
}

export async function valider(id) {
  await pool.query("UPDATE notes SET statut_validation = 'validee' WHERE id = ?", [id]);
}

export async function supprimer(id) {
  const [res] = await pool.query('DELETE FROM notes WHERE id = ?', [id]);
  return res.affectedRows > 0;
}

// Vue admin : toutes les notes filtrables
export async function listerAdmin({ niveau, periode, anneeScolaire }) {
  const conditions = [];
  const params = [];
  if (niveau) { conditions.push('COALESCE(n.niveau, e.niveau) = ?'); params.push(niveau); }
  if (periode) { conditions.push('n.periode = ?'); params.push(periode); }
  if (anneeScolaire) { conditions.push('n.annee_scolaire = ?'); params.push(anneeScolaire); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const [rows] = await pool.query(
    `SELECT n.id, n.id_eleve, TRIM(CONCAT(COALESCE(e.prenom,''),' ',e.nom)) AS eleve_nom, e.niveau, n.matiere, m.coefficient,
            n.periode, n.annee_scolaire, n.valeur, n.bareme, n.statut_validation
       FROM notes n
       JOIN eleves e ON e.id = n.id_eleve
       LEFT JOIN matieres m ON m.id = n.id_matiere
       ${where}
      ORDER BY e.nom, n.periode, n.matiere`,
    params
  );
  return rows;
}

// Notes d'un élève. Si seulementVisibles=true : uniquement validées ET publiées.
export async function listerPourEleve(idEleve, { periode, anneeScolaire, seulementVisibles }) {
  const conditions = ['n.id_eleve = ?'];
  const params = [idEleve];
  if (periode) { conditions.push('n.periode = ?'); params.push(periode); }
  if (anneeScolaire) { conditions.push('n.annee_scolaire = ?'); params.push(anneeScolaire); }
  if (seulementVisibles) {
    conditions.push("n.statut_validation = 'validee'");
    // Un ancien élève (dossier historique saisi directement par le
    // secrétariat) n'a pas de cycle de publication ni d'économat associé à
    // rejouer : ses notes validées sont visibles directement.
    conditions.push(`(e.ancien_eleve = 1 OR EXISTS (SELECT 1 FROM publications_notes p
                       WHERE p.niveau = COALESCE(n.niveau, e.niveau)
                         AND p.annee_scolaire = n.annee_scolaire
                         AND p.trimestre = n.periode))`);
    // Économat : l'élève doit être acquitté pour ce trimestre, sinon résultats masqués.
    conditions.push(`(e.ancien_eleve = 1 OR EXISTS (SELECT 1 FROM acquittements_scolarite a
                       WHERE a.id_eleve = n.id_eleve
                         AND a.annee_scolaire = n.annee_scolaire
                         AND a.trimestre = n.periode))`);
  }
  const [rows] = await pool.query(
    `SELECT n.id, n.matiere, COALESCE(n.niveau, e.niveau) AS niveau, m.coefficient, n.periode, n.annee_scolaire,
            n.valeur, n.bareme, n.statut_validation
       FROM notes n
       JOIN eleves e ON e.id = n.id_eleve
       LEFT JOIN matieres m ON m.id = n.id_matiere
      WHERE ${conditions.join(' AND ')}
      ORDER BY n.annee_scolaire, n.periode, n.matiere`,
    params
  );
  return rows;
}

// Toutes les notes validées d'un élève (transcript), avec coefficient
export async function notesValideesToutes(idEleve) {
  const [rows] = await pool.query(
    `SELECT n.annee_scolaire, n.periode, n.matiere, n.valeur, n.bareme,
            COALESCE(m.coefficient, 1) AS coefficient
       FROM notes n
       LEFT JOIN matieres m ON m.id = n.id_matiere
      WHERE n.id_eleve = ? AND n.statut_validation = 'validee'
      ORDER BY n.annee_scolaire, n.periode, n.matiere`,
    [idEleve]
  );
  return rows;
}

// Notes validées d'un élève pour un trimestre (avec coefficient) — pour la moyenne / le bulletin
export async function notesValideesPourBulletin(idEleve, periode, anneeScolaire) {
  const [rows] = await pool.query(
    `SELECT n.matiere, n.valeur, n.bareme, COALESCE(m.coefficient, 1) AS coefficient
       FROM notes n
       LEFT JOIN matieres m ON m.id = n.id_matiere
      WHERE n.id_eleve = ? AND n.periode = ? AND n.annee_scolaire = ?
        AND n.statut_validation = 'validee'
      ORDER BY n.matiere`,
    [idEleve, periode, anneeScolaire]
  );
  return rows;
}
