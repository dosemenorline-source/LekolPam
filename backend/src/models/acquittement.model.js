// Modèle Acquittement scolarité — un élève « à jour » (économat) pour un trimestre.
// Présence d'une ligne = à jour ; absence = non payé.
import { pool } from '../config/db.js';
import { eleveVisible } from './eleve.model.js';

// acquittePar : id utilisateurs (compte école) — jamais un id economat_admins
// (clé étrangère incompatible, voir migration 031). acquitteParNote : identité
// libre (ex. e-mail Économat) à tracer quand acquittePar ne peut pas l'être.
export async function marquer({ idEleve, anneeScolaire, trimestre, acquittePar, acquitteParNote }) {
  await pool.query(
    `INSERT INTO acquittements_scolarite (id_eleve, annee_scolaire, trimestre, acquitte_par, acquitte_par_note)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE acquitte_par = VALUES(acquitte_par),
       acquitte_par_note = VALUES(acquitte_par_note), cree_le = CURRENT_TIMESTAMP`,
    [idEleve, anneeScolaire, trimestre, acquittePar || null, acquitteParNote || null]
  );
}

export async function retirer({ idEleve, anneeScolaire, trimestre }) {
  await pool.query(
    'DELETE FROM acquittements_scolarite WHERE id_eleve = ? AND annee_scolaire = ? AND trimestre = ?',
    [idEleve, anneeScolaire, trimestre]
  );
}

export async function estAcquitte(idEleve, anneeScolaire, trimestre) {
  const [rows] = await pool.query(
    'SELECT 1 FROM acquittements_scolarite WHERE id_eleve = ? AND annee_scolaire = ? AND trimestre = ? LIMIT 1',
    [idEleve, anneeScolaire, trimestre]
  );
  return rows.length > 0;
}

// Trimestres publiés (pour le niveau de l'élève) mais NON acquittés → résultats bloqués.
export async function trimestresBloques(idEleve) {
  const [rows] = await pool.query(
    `SELECT p.annee_scolaire, p.trimestre
       FROM publications_notes p
       JOIN eleves e ON e.niveau = p.niveau
      WHERE e.id = ?
        AND NOT EXISTS (
          SELECT 1 FROM acquittements_scolarite a
           WHERE a.id_eleve = e.id AND a.annee_scolaire = p.annee_scolaire AND a.trimestre = p.trimestre
        )
      ORDER BY p.annee_scolaire, p.trimestre`,
    [idEleve]
  );
  return rows;
}

// Vue admin : élèves d'un niveau avec leur statut d'acquittement pour (année, trimestre).
export async function listerParNiveau({ niveau, anneeScolaire, trimestre }) {
  const [rows] = await pool.query(
    `SELECT e.id, TRIM(CONCAT(COALESCE(e.prenom,''),' ',e.nom)) AS eleve_nom, e.niveau,
            EXISTS (
              SELECT 1 FROM acquittements_scolarite a
               WHERE a.id_eleve = e.id AND a.annee_scolaire = ? AND a.trimestre = ?
            ) AS acquitte
       FROM eleves e
      WHERE e.niveau = ? AND ${eleveVisible('e')}
      ORDER BY e.nom, e.prenom`,
    [anneeScolaire, trimestre, niveau]
  );
  return rows.map((r) => ({ ...r, acquitte: !!r.acquitte }));
}
