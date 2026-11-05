// Modèle Inscription — dossiers scolaires
import { pool } from '../config/db.js';

// Dossiers dont les frais d'inscription ne sont pas encore payés (ou annulés
// faute de paiement à temps) : ils n'existent que côté parent, jamais pour le
// secrétariat ni pour les listes d'élèves.
export const STATUTS_NON_PAYES = ['attente_paiement', 'annulee'];

// Délai laissé au parent pour payer après la soumission du dossier.
export const DELAI_PAIEMENT_MINUTES = 2;

// Crée l'élève (rattaché au parent) + l'inscription (attente_paiement), en transaction.
export async function creerInscription({
  idParent, eleveNom, elevePrenom, sexe, dateNaissance, niveau, anneeScolaire,
  nomParent, professionParent, telephoneParent, courrielParent, ancienneEcole, ancienneClasse, raisonChoix,
}) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [eleveRes] = await conn.query(
      'INSERT INTO eleves (id_parent, nom, prenom, sexe, date_naissance, niveau) VALUES (?, ?, ?, ?, ?, ?)',
      [idParent, eleveNom, elevePrenom || null, sexe || null, dateNaissance || null, niveau || null]
    );
    const idEleve = eleveRes.insertId;

    const [insRes] = await conn.query(
      `INSERT INTO inscriptions
        (id_eleve, annee_scolaire, nom_parent, profession_parent, telephone_parent, courriel_parent,
         ancienne_ecole, ancienne_classe, raison_choix, statut)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'attente_paiement')`,
      [idEleve, anneeScolaire, nomParent || null, professionParent || null, telephoneParent || null,
        courrielParent || null, ancienneEcole || null, ancienneClasse || null, raisonChoix || null]
    );
    const idInscription = insRes.insertId;

    await conn.commit();
    return { idInscription, idEleve };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// Ré-inscription : crée une inscription pour un élève DÉJÀ existant (sans créer
// de nouvel élève), pour l'année visée, avec le niveau demandé (promotion).
// Statut initial « attente_paiement » comme une inscription normale.
export async function creerReinscription({
  idEleve, anneeScolaire, niveauDemande,
  nomParent, professionParent, telephoneParent, courrielParent,
}) {
  const [res] = await pool.query(
    `INSERT INTO inscriptions
      (id_eleve, annee_scolaire, nom_parent, profession_parent, telephone_parent, courriel_parent,
       niveau_demande, statut)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'attente_paiement')`,
    [idEleve, anneeScolaire, nomParent || null, professionParent || null,
      telephoneParent || null, courrielParent || null, niveauDemande || null]
  );
  return { idInscription: res.insertId };
}

// Inscription SOUMISE déjà présente pour cet élève et cette année (dossier payé/
// transmis au secrétariat) — bloque une nouvelle ré-inscription. Un dossier
// encore impayé (attente_paiement) ou annulé ne compte PAS : le parent doit
// pouvoir re-cliquer « Ré-inscrire » tant que les frais ne sont pas payés.
export async function inscriptionActivePourAnnee(idEleve, anneeScolaire) {
  const [[ligne]] = await pool.query(
    `SELECT id, statut FROM inscriptions
      WHERE id_eleve = ? AND annee_scolaire = ?
        AND statut NOT IN ('attente_paiement','annulee')
      ORDER BY id DESC LIMIT 1`,
    [idEleve, anneeScolaire]
  );
  return ligne || null;
}

// Ré-inscription impayée (attente_paiement) déjà créée pour cet élève et cette
// année — réutilisée pour ne pas créer de doublon et permettre de (re)payer.
export async function reinscriptionNonPayeePourAnnee(idEleve, anneeScolaire) {
  const [[ligne]] = await pool.query(
    `SELECT id, niveau_demande FROM inscriptions
      WHERE id_eleve = ? AND annee_scolaire = ? AND statut = 'attente_paiement'
      ORDER BY id DESC LIMIT 1`,
    [idEleve, anneeScolaire]
  );
  return ligne || null;
}

// Dernière inscription connue d'un élève (pour réutiliser les coordonnées du parent).
export async function derniereInscriptionDeEleve(idEleve) {
  const [[ligne]] = await pool.query(
    `SELECT nom_parent, profession_parent, telephone_parent, courriel_parent
       FROM inscriptions WHERE id_eleve = ? ORDER BY id DESC LIMIT 1`,
    [idEleve]
  );
  return ligne || null;
}

// Applique la promotion : met le niveau de l'élève à jour (appelé à l'acceptation
// d'une ré-inscription qui portait un niveau_demande).
export async function appliquerNiveauEleve(idEleve, niveau) {
  await pool.query('UPDATE eleves SET niveau = ? WHERE id = ?', [niveau, idEleve]);
}

// Liste les dossiers d'un parent
export async function listerParParent(idParent) {
  const [rows] = await pool.query(
    `SELECT i.id, i.annee_scolaire, i.statut, i.date_soumission,
            TRIM(CONCAT(COALESCE(e.prenom,''),' ',e.nom)) AS eleve_nom, e.niveau
       FROM inscriptions i
       JOIN eleves e ON e.id = i.id_eleve
      WHERE e.id_parent = ?
      ORDER BY i.id DESC`,
    [idParent]
  );
  return rows;
}

// Détail d'une inscription + chaîne de propriété (parent / utilisateur)
export async function trouverAvecProprietaire(idInscription) {
  const [rows] = await pool.query(
    `SELECT i.id, i.annee_scolaire, i.statut, i.date_soumission,
            i.nom_parent, i.profession_parent, i.telephone_parent, i.courriel_parent,
            i.ancienne_ecole, i.ancienne_classe, i.raison_choix, i.niveau_demande,
            e.id AS id_eleve, TRIM(CONCAT(COALESCE(e.prenom,''),' ',e.nom)) AS eleve_nom, e.niveau, e.sexe, e.date_naissance,
            p.id AS id_parent, u.id AS id_utilisateur,
            u.courriel AS parent_courriel, u.nom AS parent_nom
       FROM inscriptions i
       JOIN eleves e ON e.id = i.id_eleve
       JOIN parents p ON p.id = e.id_parent
       JOIN utilisateurs u ON u.id = p.id_utilisateur
      WHERE i.id = ? LIMIT 1`,
    [idInscription]
  );
  return rows[0] || null;
}

// Liste admin, filtrable par statut / niveau (dossiers non payés exclus)
export async function listerTout({ statut, niveau }) {
  const conditions = ['i.statut NOT IN (?)'];
  const params = [STATUTS_NON_PAYES];
  if (statut) { conditions.push('i.statut = ?'); params.push(statut); }
  if (niveau) { conditions.push('e.niveau = ?'); params.push(niveau); }
  const where = `WHERE ${conditions.join(' AND ')}`;
  const [rows] = await pool.query(
    `SELECT i.id, i.annee_scolaire, i.statut, i.date_soumission,
            TRIM(CONCAT(COALESCE(e.prenom,''),' ',e.nom)) AS eleve_nom, e.niveau, u.courriel AS parent_courriel
       FROM inscriptions i
       JOIN eleves e ON e.id = i.id_eleve
       JOIN parents p ON p.id = e.id_parent
       JOIN utilisateurs u ON u.id = p.id_utilisateur
       ${where}
      ORDER BY i.id DESC`,
    params
  );
  return rows;
}

export async function mettreAJourStatut(idInscription, statut) {
  await pool.query('UPDATE inscriptions SET statut = ? WHERE id = ?', [statut, idInscription]);
}

// Paiement des frais confirmé : le dossier non payé (ou annulé entre-temps —
// un paiement MonCash peut aboutir après le délai) passe au secrétariat.
// Retourne true si CET appel a fait la transition.
export async function transmettreApresPaiement(idInscription) {
  const [res] = await pool.query(
    "UPDATE inscriptions SET statut = 'en_attente' WHERE id = ? AND statut IN (?)",
    [idInscription, STATUTS_NON_PAYES]
  );
  return res.affectedRows > 0;
}

// Annule un dossier resté impayé. Retourne true si CET appel l'a annulé.
export async function annulerSiNonPayee(idInscription) {
  const [res] = await pool.query(
    "UPDATE inscriptions SET statut = 'annulee' WHERE id = ? AND statut = 'attente_paiement'",
    [idInscription]
  );
  return res.affectedRows > 0;
}

// Dossiers impayés dont le délai de paiement est dépassé
export async function listerNonPayeesExpirees() {
  const [rows] = await pool.query(
    `SELECT id FROM inscriptions
      WHERE statut = 'attente_paiement'
        AND date_soumission < (NOW() - INTERVAL ? MINUTE)`,
    [DELAI_PAIEMENT_MINUTES]
  );
  return rows.map((r) => r.id);
}

// Dossier impayé identique déjà soumis par ce parent dans le délai de
// paiement (double-clic, formulaire renvoyé) : on le réutilise au lieu d'en
// créer un second.
export async function trouverDoublonNonPaye({ idParent, eleveNom, elevePrenom, dateNaissance }) {
  const [rows] = await pool.query(
    `SELECT i.id, i.id_eleve FROM inscriptions i
       JOIN eleves e ON e.id = i.id_eleve
      WHERE e.id_parent = ? AND i.statut = 'attente_paiement'
        AND e.nom = ? AND COALESCE(e.prenom, '') = ? AND e.date_naissance = ?
        AND i.date_soumission >= (NOW() - INTERVAL ? MINUTE)
      ORDER BY i.id DESC LIMIT 1`,
    [idParent, eleveNom, elevePrenom || '', dateNaissance, DELAI_PAIEMENT_MINUTES]
  );
  return rows[0] || null;
}
