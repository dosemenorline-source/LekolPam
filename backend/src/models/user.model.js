// Modèle Utilisateur — requêtes SQL liées aux comptes
import { pool } from '../config/db.js';

// Retourne l'utilisateur (avec le hash) par courriel, ou null
export async function findByCourriel(courriel) {
  const [rows] = await pool.query(
    'SELECT id, nom, courriel, mot_de_passe_hash, role, statut, courriel_verifie FROM utilisateurs WHERE courriel = ? LIMIT 1',
    [courriel]
  );
  return rows[0] || null;
}

// Retourne l'utilisateur (avec le hash, éventuellement null) par google_id
export async function findByGoogleId(googleId) {
  const [rows] = await pool.query(
    'SELECT id, nom, courriel, mot_de_passe_hash, role, statut, courriel_verifie FROM utilisateurs WHERE google_id = ? LIMIT 1',
    [googleId]
  );
  return rows[0] || null;
}

// Lie un compte existant (créé manuellement) à un identifiant Google — permet
// de se connecter avec Google ensuite, sans toucher au mot de passe existant.
export async function lierGoogleId(id, googleId) {
  await pool.query('UPDATE utilisateurs SET google_id = ? WHERE id = ?', [googleId, id]);
}

// Marque le courriel d'un utilisateur comme vérifié
export async function marquerCourrielVerifie(id) {
  await pool.query('UPDATE utilisateurs SET courriel_verifie = 1 WHERE id = ?', [id]);
}

// Met à jour le hash du mot de passe d'un utilisateur
export async function mettreAJourMotDePasse(id, motDePasseHash) {
  await pool.query('UPDATE utilisateurs SET mot_de_passe_hash = ? WHERE id = ?', [motDePasseHash, id]);
}

// Met à jour le courriel d'un utilisateur
export async function mettreAJourCourriel(id, courriel) {
  await pool.query('UPDATE utilisateurs SET courriel = ? WHERE id = ?', [courriel, id]);
}

// Retourne l'utilisateur AVEC le hash par id (pour vérifier le mot de passe actuel)
export async function findByIdAvecHash(id) {
  const [rows] = await pool.query(
    'SELECT id, nom, courriel, mot_de_passe_hash, role FROM utilisateurs WHERE id = ? LIMIT 1',
    [id]
  );
  return rows[0] || null;
}

// Retourne l'id de la fiche parent liée à un utilisateur (ou null)
export async function findParentIdByUserId(idUtilisateur) {
  const [rows] = await pool.query(
    'SELECT id FROM parents WHERE id_utilisateur = ? LIMIT 1',
    [idUtilisateur]
  );
  return rows[0] ? rows[0].id : null;
}

// Retourne l'utilisateur (sans le hash) par id, ou null
export async function findById(id) {
  const [rows] = await pool.query(
    `SELECT id, nom, courriel, role, statut, cree_le, compte_eleve AS compteEleve,
            (mot_de_passe_hash IS NOT NULL) AS aMotDePasse
       FROM utilisateurs WHERE id = ? LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

// Un numéro par parent actif (le plus récent parmi les inscriptions de ses
// enfants), pour les annonces SMS groupées. Le téléphone n'est saisi que sur
// le formulaire d'inscription, pas sur le compte lui-même.
export async function listerParentsAvecTelephone() {
  const [rows] = await pool.query(`
    SELECT u.id, u.nom,
           (SELECT i.telephone_parent
              FROM inscriptions i
              JOIN eleves e ON e.id = i.id_eleve
             WHERE e.id_parent = p.id
               AND i.telephone_parent IS NOT NULL AND i.telephone_parent != ''
             ORDER BY i.id DESC LIMIT 1) AS telephone
      FROM utilisateurs u
      JOIN parents p ON p.id_utilisateur = u.id
     WHERE u.role = 'parent' AND u.statut = 'actif'
    HAVING telephone IS NOT NULL
  `);
  return rows;
}

// Retourne tous les parents actifs ayant un courriel, pour les annonces
// groupées par courriel. Contrairement au téléphone, le courriel est déjà
// sur le compte lui-même : pas besoin de passer par les inscriptions.
export async function listerParentsAvecCourriel() {
  const [rows] = await pool.query(`
    SELECT id, nom, courriel
      FROM utilisateurs
     WHERE role = 'parent' AND statut = 'actif'
       AND courriel IS NOT NULL AND courriel != ''
  `);
  return rows;
}

// Crée un utilisateur (rôle 'parent' par défaut) + sa fiche parent, en transaction.
// Le compte est immédiatement utilisable : il n'y a plus d'étape de vérification du
// courriel. La colonne courriel_verifie est conservée (mise à 1) pour pouvoir
// réactiver cette étape plus tard sans migration.
// Retourne l'utilisateur créé (sans le hash).
//
// `options.conn` : connexion d'une transaction EXTERNE déjà ouverte (ex. création
// d'un compte élève qui doit consommer un code d'invitation dans la même
// transaction). Dans ce cas, on ne gère pas la transaction ni la connexion ici —
// l'appelant commit/rollback/release lui-même.
export async function createParent({ nom, courriel, motDePasseHash, compteEleve = false }, options = {}) {
  const connExterne = options.conn || null;
  const conn = connExterne || await pool.getConnection();
  const gereTx = !connExterne;
  try {
    if (gereTx) await conn.beginTransaction();

    const [res] = await conn.query(
      'INSERT INTO utilisateurs (nom, courriel, mot_de_passe_hash, role, compte_eleve, courriel_verifie) VALUES (?, ?, ?, ?, ?, 1)',
      [nom, courriel, motDePasseHash, 'parent', compteEleve ? 1 : 0]
    );
    const idUtilisateur = res.insertId;

    await conn.query(
      'INSERT INTO parents (id_utilisateur) VALUES (?)',
      [idUtilisateur]
    );

    if (gereTx) await conn.commit();
    return { id: idUtilisateur, nom, courriel, role: 'parent', statut: 'actif' };
  } catch (err) {
    if (gereTx) await conn.rollback();
    throw err;
  } finally {
    if (gereTx) conn.release();
  }
}

// Crée un compte 'parent' via Google (pas de mot de passe : mot_de_passe_hash
// reste NULL tant que le compte n'en définit pas un — voir mon-compte).
export async function createParentGoogle({ nom, courriel, googleId }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [res] = await conn.query(
      'INSERT INTO utilisateurs (nom, courriel, google_id, role, courriel_verifie) VALUES (?, ?, ?, ?, 1)',
      [nom, courriel, googleId, 'parent']
    );
    const idUtilisateur = res.insertId;

    await conn.query('INSERT INTO parents (id_utilisateur) VALUES (?)', [idUtilisateur]);

    await conn.commit();
    return { id: idUtilisateur, nom, courriel, role: 'parent', statut: 'actif' };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
