// Modèle Élève — accès + chaîne de propriété
import crypto from 'crypto';
import { pool } from '../config/db.js';

// Condition SQL : l'élève n'a pas de dossier d'inscription impayé/annulé.
// Un élève est créé à la soumission du dossier, avant le paiement des frais :
// tant qu'il n'est pas payé, il ne doit apparaître dans aucune liste de
// l'école (codes, badges, notes, bulletins…). alias = alias SQL de « eleves ».
export function eleveVisible(alias = 'eleves') {
  return `NOT EXISTS (SELECT 1 FROM inscriptions ix WHERE ix.id_eleve = ${alias}.id
                        AND ix.statut IN ('attente_paiement','annulee'))`;
}

// Génère un code d'accès et l'enregistre : 3 lettres consécutives issues du nom
// de l'élève (majuscules, sans accents) suivies de 5 chiffres. Ex. « JEA48213 ».
export async function genererCodeAcces(idEleve) {
  const eleve = await trouverParId(idEleve);
  if (!eleve) return null;
  // Le code d'accès est unique et PERMANENT : s'il en existe déjà un, on le
  // conserve. Sans ce garde-fou, une ré-inscription payée régénérerait le code
  // d'un élève existant et casserait son badge / son accès.
  if (eleve.code_acces) return eleve.code_acces;

  // Lettres du nom complet (prénom + nom), sans accents ni espaces
  const lettres = `${eleve.prenom || ''}${eleve.nom || ''}`
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase().replace(/[^A-Z]/g, '');
  let prefixe = lettres.slice(0, 3);
  while (prefixe.length < 3) prefixe += 'X'; // complète si le nom est trop court

  for (let tentative = 0; tentative < 10; tentative += 1) {
    const chiffres = String(crypto.randomInt(0, 100000)).padStart(5, '0');
    const code = `${prefixe}${chiffres}`;
    try {
      await pool.query('UPDATE eleves SET code_acces = ? WHERE id = ?', [code, idEleve]);
      return code;
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') continue; // collision → réessaye avec d'autres chiffres
      throw err;
    }
  }
  throw new Error('Impossible de générer un code unique.');
}

// Élève par identifiant (données de base)
export async function trouverParId(id) {
  const [rows] = await pool.query(
    `SELECT id, nom, prenom, niveau, id_parent, code_acces, photo_url,
            date_naissance, groupe_sanguin, badge_emis_le,
            badge_nom, badge_prenom, badge_classe, badge_annee, ancien_eleve, courriel_contact
       FROM eleves WHERE id = ? LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

// Enregistre le chemin de la photo de l'élève (badge)
export async function mettrePhoto(idEleve, photoUrl) {
  await pool.query('UPDATE eleves SET photo_url = ? WHERE id = ?', [photoUrl, idEleve]);
}

// Met à jour les surcharges badge (secrétariat) — n'affecte PAS la fiche officielle.
// Une valeur vide (null) => le badge retombe sur la valeur automatique.
export async function mettreInfosBadge(idEleve, infos) {
  const { groupeSanguin, badgeNom, badgePrenom, badgeClasse, badgeAnnee, badgeEmisLe } = infos;
  await pool.query(
    `UPDATE eleves SET groupe_sanguin = ?, badge_nom = ?, badge_prenom = ?,
            badge_classe = ?, badge_annee = ?, badge_emis_le = ? WHERE id = ?`,
    [groupeSanguin || null, badgeNom || null, badgePrenom || null,
      badgeClasse || null, badgeAnnee || null, badgeEmisLe || null, idEleve]
  );
}

// Garantit une date d'émission du badge : la fixe au jour même si absente, puis la renvoie.
export async function assurerEmissionBadge(idEleve) {
  const [rows] = await pool.query('SELECT badge_emis_le FROM eleves WHERE id = ? LIMIT 1', [idEleve]);
  if (rows[0] && rows[0].badge_emis_le) return rows[0].badge_emis_le;
  await pool.query('UPDATE eleves SET badge_emis_le = CURDATE() WHERE id = ?', [idEleve]);
  const [maj] = await pool.query('SELECT badge_emis_le FROM eleves WHERE id = ? LIMIT 1', [idEleve]);
  return maj[0] ? maj[0].badge_emis_le : null;
}

// Nom et téléphone du parent, depuis la dernière inscription (pour le badge)
export async function infosParent(idEleve) {
  const [rows] = await pool.query(
    `SELECT nom_parent, telephone_parent FROM inscriptions
      WHERE id_eleve = ? ORDER BY id DESC LIMIT 1`,
    [idEleve]
  );
  return rows[0] || { nom_parent: null, telephone_parent: null };
}

// Dernière année scolaire d'inscription de l'élève (pour le badge)
export async function derniereAnneeScolaire(idEleve) {
  const [rows] = await pool.query(
    'SELECT annee_scolaire FROM inscriptions WHERE id_eleve = ? ORDER BY id DESC LIMIT 1',
    [idEleve]
  );
  return rows[0] ? rows[0].annee_scolaire : null;
}

// Élève identifié par son code d'accès (connexion espace élève)
export async function trouverParCode(code) {
  const [rows] = await pool.query(
    `SELECT id, TRIM(CONCAT(COALESCE(prenom,''),' ',nom)) AS nom, niveau, id_parent
       FROM eleves WHERE code_acces = ? LIMIT 1`,
    [code]
  );
  return rows[0] || null;
}

// Élève + parent + utilisateur (pour contrôle d'accès et notifications)
export async function trouverAvecProprietaire(idEleve) {
  const [rows] = await pool.query(
    `SELECT e.id, TRIM(CONCAT(COALESCE(e.prenom,''),' ',e.nom)) AS nom, e.niveau, e.id_parent,
            u.id AS id_utilisateur, u.courriel AS parent_courriel, u.nom AS parent_nom,
            insc.telephone_parent
       FROM eleves e
       JOIN parents p ON p.id = e.id_parent
       JOIN utilisateurs u ON u.id = p.id_utilisateur
       LEFT JOIN inscriptions insc
              ON insc.id = (SELECT id FROM inscriptions WHERE id_eleve = e.id ORDER BY id DESC LIMIT 1)
      WHERE e.id = ? LIMIT 1`,
    [idEleve]
  );
  return rows[0] || null;
}

// Élèves rattachés à un parent (id de la fiche parents)
export async function listerParParent(idParent) {
  const [rows] = await pool.query(
    `SELECT id, TRIM(CONCAT(COALESCE(prenom,''),' ',nom)) AS nom, niveau, date_naissance, code_acces
       FROM eleves WHERE id_parent = ? ORDER BY nom`,
    [idParent]
  );
  return rows;
}

// Crée un élève importé (liste ancienne, sans compte parent). Pas de code d'accès
// généré automatiquement : le secrétariat le fera au besoin (page Codes élèves).
export async function creerEleveImporte({ nom, prenom, sexe, dateNaissance, niveau }) {
  const [res] = await pool.query(
    `INSERT INTO eleves (id_parent, nom, prenom, sexe, date_naissance, niveau, statut_inscription)
     VALUES (NULL, ?, ?, ?, ?, ?, 'confirmee')`,
    [nom, prenom || null, sexe || null, dateNaissance || null, niveau || null]
  );
  return res.insertId;
}

// Doublon probable pour un import : même nom + prénom (et date de naissance si
// fournie). Évite d'importer deux fois le même élève.
export async function eleveExisteImport({ nom, prenom, dateNaissance }) {
  const conditions = ['LOWER(TRIM(nom)) = LOWER(TRIM(?))', 'LOWER(TRIM(COALESCE(prenom,\'\'))) = LOWER(TRIM(?))'];
  const params = [nom, prenom || ''];
  if (dateNaissance) { conditions.push('date_naissance = ?'); params.push(dateNaissance); }
  const [[ligne]] = await pool.query(
    `SELECT id FROM eleves WHERE ${conditions.join(' AND ')} LIMIT 1`, params
  );
  return !!ligne;
}

// Courriels de contact renseignés sur les fiches élèves — TOUS les élèves, sans
// exception (élèves actuels ET anciens élèves) — pour les notifier (ex.
// ré-inscription) en plus des parents.
export async function listerElevesAvecCourriel() {
  const [rows] = await pool.query(
    `SELECT DISTINCT TRIM(courriel_contact) AS courriel
       FROM eleves
      WHERE courriel_contact IS NOT NULL AND TRIM(courriel_contact) <> ''`
  );
  return rows;
}

// Vérifie qu'un élève appartient bien à un parent (id de la fiche parents)
export async function appartientAuParent(idEleve, idParent) {
  const [rows] = await pool.query(
    'SELECT id FROM eleves WHERE id = ? AND id_parent = ? LIMIT 1',
    [idEleve, idParent]
  );
  return rows.length > 0;
}

// Liste des élèves (admin), filtrable par niveau
export async function listerTous({ niveau } = {}) {
  const nomComplet = "TRIM(CONCAT(COALESCE(prenom,''),' ',nom)) AS nom";
  if (niveau) {
    const [rows] = await pool.query(
      `SELECT id, ${nomComplet}, niveau FROM eleves WHERE niveau = ? AND ${eleveVisible()} ORDER BY nom`, [niveau]
    );
    return rows;
  }
  const [rows] = await pool.query(
    `SELECT id, ${nomComplet}, niveau FROM eleves WHERE ${eleveVisible()} ORDER BY niveau, nom`
  );
  return rows;
}

// Tous les élèves avec leur code d'accès + parent (vue secrétariat, filtrable)
export async function listerAvecCode({ recherche } = {}) {
  const conditions = [eleveVisible('e')];
  const params = [];
  if (recherche) {
    conditions.push('(e.nom LIKE ? OR e.niveau LIKE ? OR u.nom LIKE ? OR e.code_acces LIKE ?)');
    const motif = `%${recherche}%`;
    params.push(motif, motif, motif, motif);
  }
  const where = `WHERE ${conditions.join(' AND ')}`;
  const [rows] = await pool.query(
    `SELECT e.id, TRIM(CONCAT(COALESCE(e.prenom,''),' ',e.nom)) AS nom, e.niveau, e.code_acces,
            (e.photo_url IS NOT NULL) AS a_photo,
            u.nom AS parent_nom, u.courriel AS parent_courriel
       FROM eleves e
       JOIN parents p ON p.id = e.id_parent
       JOIN utilisateurs u ON u.id = p.id_utilisateur
       ${where}
      ORDER BY e.nom`,
    params
  );
  return rows;
}

// ---------- Anciens élèves (dossiers historiques, sans compte parent) ----------

// Crée un dossier d'ancien élève : pas de parent, code d'accès généré aussitôt.
export async function creerAncien({ nom, prenom, dateNaissance, niveau, courrielContact }) {
  const [res] = await pool.query(
    `INSERT INTO eleves (nom, prenom, date_naissance, niveau, ancien_eleve, courriel_contact, statut_inscription)
     VALUES (?, ?, ?, ?, 1, ?, 'confirmee')`,
    [nom, prenom || null, dateNaissance || null, niveau || null, courrielContact || null]
  );
  await genererCodeAcces(res.insertId);
  return trouverParId(res.insertId);
}

export async function mettreAJourAncien(id, { nom, prenom, dateNaissance, niveau, courrielContact }) {
  const champs = [];
  const params = [];
  if (nom !== undefined) { champs.push('nom = ?'); params.push(nom); }
  if (prenom !== undefined) { champs.push('prenom = ?'); params.push(prenom || null); }
  if (dateNaissance !== undefined) { champs.push('date_naissance = ?'); params.push(dateNaissance || null); }
  if (niveau !== undefined) { champs.push('niveau = ?'); params.push(niveau || null); }
  if (courrielContact !== undefined) { champs.push('courriel_contact = ?'); params.push(courrielContact || null); }
  if (!champs.length) return;
  params.push(id);
  await pool.query(`UPDATE eleves SET ${champs.join(', ')} WHERE id = ? AND ancien_eleve = 1`, params);
}

// Liste des dossiers d'anciens élèves (recherche par nom/niveau/code)
export async function listerAnciens({ recherche } = {}) {
  const conditions = ['ancien_eleve = 1'];
  const params = [];
  if (recherche) {
    conditions.push('(nom LIKE ? OR prenom LIKE ? OR niveau LIKE ? OR code_acces LIKE ?)');
    const motif = `%${recherche}%`;
    params.push(motif, motif, motif, motif);
  }
  const [rows] = await pool.query(
    `SELECT id, TRIM(CONCAT(COALESCE(prenom,''),' ',nom)) AS nom, niveau, code_acces,
            courriel_contact, date_naissance
       FROM eleves WHERE ${conditions.join(' AND ')} ORDER BY nom`,
    params
  );
  return rows;
}

// Tous les niveaux connus (matières définies ∪ élèves actuels/anciens) — pour
// le sélecteur libre de la saisie historique (pas limité aux niveaux actifs).
export async function listerNiveauxConnus() {
  const [rows] = await pool.query(
    `SELECT niveau FROM matieres WHERE niveau IS NOT NULL
     UNION SELECT niveau FROM eleves WHERE niveau IS NOT NULL AND ${eleveVisible()}
     ORDER BY niveau`
  );
  return rows.map((r) => r.niveau);
}

// Tous les élèves d'un niveau (pour la génération des bulletins)
export async function listerParNiveau(niveau) {
  // Le courriel de notification = celui saisi sur la dernière inscription si présent,
  // sinon le courriel du compte parent. Idem pour le nom du parent.
  const [rows] = await pool.query(
    `SELECT e.id, TRIM(CONCAT(COALESCE(e.prenom,''),' ',e.nom)) AS nom,
            e.nom AS nom_famille, e.prenom AS prenom, e.niveau,
            COALESCE(insc.courriel_parent, u.courriel) AS parent_courriel,
            COALESCE(insc.nom_parent, u.nom) AS parent_nom,
            insc.telephone_parent AS parent_telephone
       FROM eleves e
       JOIN parents p ON p.id = e.id_parent
       JOIN utilisateurs u ON u.id = p.id_utilisateur
       LEFT JOIN inscriptions insc ON insc.id = (
         SELECT id FROM inscriptions WHERE id_eleve = e.id ORDER BY id DESC LIMIT 1
       )
      WHERE e.niveau = ? AND ${eleveVisible('e')}
      ORDER BY e.nom`,
    [niveau]
  );
  return rows;
}
