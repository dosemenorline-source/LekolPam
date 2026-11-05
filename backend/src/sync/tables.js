// ============================================================
// Configuration du moteur de synchronisation (offline ↔ nuage)
// ------------------------------------------------------------
// Source unique de vérité : quelles tables se synchronisent entre
// l'application de bureau (hors ligne) et le nuage (Railway), et
// comment leurs clés étrangères sont réécrites d'un nœud à l'autre.
//
// Modèle « hub-and-spoke » : chaque poste de bureau a sa propre base
// locale (MariaDB embarquée dans l'app Electron) et se synchronise
// avec le nuage, qui fait autorité pour fusionner (dernier écrit
// gagne, par horodatage `sync_maj_le`). Les postes ne se parlent
// jamais directement.
//
// Identité globale : chaque ligne synchronisable porte un `sync_id`
// (UUID) partagé par tous les nœuds. Les `id` entiers auto-incrémentés
// restent LOCAUX à chaque base ; le moteur traduit les clés étrangères
// entières ↔ `sync_id` à l'émission et à la réception (voir engine.js).
// ============================================================

// Tables synchronisées, en ORDRE DE DÉPENDANCE (une table n'apparaît
// qu'après toutes celles vers lesquelles elle pointe) : indispensable
// pour que la réécriture des clés étrangères trouve la cible déjà en place.
//
// Chaque entrée :
//   nom          : nom de la table MySQL
//   fks          : clés étrangères simples [{ colonne, cible, nullable }]
//                  — `cible` est une autre table synchronisée.
//   polymorphes  : clés étrangères polymorphes (la table cible dépend
//                  d'une colonne « type ») :
//                  [{ colonne, colonneType, carte: { valeurType: 'table' }, nullable }]
//
// Les tables volontairement EXCLUES (ne se synchronisent pas) :
//   - sessions, codes_verification, webauthn_credentials : propres à
//     un appareil/une session, jamais partagées entre nœuds.
//   - journal_securite : journal de sécurité, local à chaque nœud.
//   - modules de contenu public (vlog_*, apropos_*, academie_*,
//     examens_*, professeurs, *_admins) : gérés en ligne (publication
//     publique), hors périmètre « bureau ».
export const SYNC_TABLES = [
  { nom: 'ecole', fks: [] },

  { nom: 'utilisateurs', fks: [] },

  { nom: 'permissions', fks: [
    { colonne: 'modifie_par', cible: 'utilisateurs', nullable: true },
  ] },

  { nom: 'parents', fks: [
    { colonne: 'id_utilisateur', cible: 'utilisateurs', nullable: false },
  ] },

  { nom: 'eleves', fks: [
    { colonne: 'id_parent', cible: 'parents', nullable: true },
  ] },

  { nom: 'matieres', fks: [] },

  { nom: 'tarifs', fks: [] },

  { nom: 'frais_divers', fks: [] },

  { nom: 'inscriptions', fks: [
    { colonne: 'id_eleve', cible: 'eleves', nullable: false },
  ] },

  { nom: 'documents_soumis', fks: [
    { colonne: 'id_inscription', cible: 'inscriptions', nullable: false },
  ] },

  { nom: 'notes', fks: [
    { colonne: 'id_eleve', cible: 'eleves', nullable: false },
    { colonne: 'id_matiere', cible: 'matieres', nullable: true },
    { colonne: 'saisie_par', cible: 'utilisateurs', nullable: true },
  ] },

  { nom: 'enseignant_matieres', fks: [
    { colonne: 'id_utilisateur', cible: 'utilisateurs', nullable: false },
    { colonne: 'id_matiere', cible: 'matieres', nullable: false },
  ] },

  { nom: 'publications_notes', fks: [
    { colonne: 'publie_par', cible: 'utilisateurs', nullable: true },
  ] },

  { nom: 'acquittements_scolarite', fks: [
    { colonne: 'id_eleve', cible: 'eleves', nullable: false },
    { colonne: 'acquitte_par', cible: 'utilisateurs', nullable: true },
  ] },

  { nom: 'documents_officiels', fks: [
    { colonne: 'id_eleve', cible: 'eleves', nullable: false },
  ] },

  { nom: 'presences', fks: [
    { colonne: 'id_eleve', cible: 'eleves', nullable: false },
    { colonne: 'marque_par', cible: 'utilisateurs', nullable: true },
  ] },

  { nom: 'paiements', fks: [
    { colonne: 'valide_par', cible: 'utilisateurs', nullable: true },
  ], polymorphes: [
    // id_reference pointe sur inscriptions (frais d'inscription) ou sur
    // eleves (relevé / duplicata), selon type_frais.
    { colonne: 'id_reference', colonneType: 'type_frais',
      carte: { inscription: 'inscriptions', releve: 'eleves', duplicata: 'eleves' },
      nullable: false },
  ] },

  { nom: 'demandes_anciens_eleves', fks: [
    { colonne: 'id_eleve', cible: 'eleves', nullable: true },
    { colonne: 'traite_par', cible: 'utilisateurs', nullable: true },
  ] },

  { nom: 'historique_statut', fks: [
    { colonne: 'id_auteur', cible: 'utilisateurs', nullable: true },
  ], polymorphes: [
    // id_entite pointe sur inscriptions / paiements / documents_soumis
    // selon la colonne `entite`.
    { colonne: 'id_entite', colonneType: 'entite',
      carte: { inscription: 'inscriptions', paiement: 'paiements', document_soumis: 'documents_soumis' },
      nullable: false },
  ] },
];

// Colonnes qu'un POSTE ne peut JAMAIS écrire via un push (défense en
// profondeur si un jeton de poste est compromis) : le nuage ignore ces
// colonnes à l'application d'un push (valeur par défaut à l'insertion, valeur
// du nuage conservée à la mise à jour). Elles touchent les privilèges et
// l'authentification — un poste n'a aucune raison légitime de les fixer (les
// comptes admin et les mots de passe sont gérés côté nuage).
// NB : ne concerne QUE les push (nœud → nuage) ; un poste qui tire du nuage
// (source de confiance) applique tout normalement.
export const COLONNES_NON_POUSSABLES = {
  utilisateurs: new Set([
    'role', 'mot_de_passe_hash', 'google_id', 'statut', 'courriel_verifie', 'compte_eleve',
  ]),
};

// Accès rapide par nom.
export const SYNC_TABLE_PAR_NOM = Object.fromEntries(
  SYNC_TABLES.map((t) => [t.nom, t])
);

// Noms seuls, en ordre de dépendance (émission/application : ascendant ;
// suppression des tombstones : descendant).
export const SYNC_NOMS = SYNC_TABLES.map((t) => t.nom);

// Colonnes techniques ajoutées par le moteur (à ne pas exposer comme
// données métier et à recalculer localement, pas à copier telles quelles).
export const COLONNE_SYNC_ID = 'sync_id';     // identité globale (UUID)
export const COLONNE_SYNC_MAJ = 'sync_maj_le'; // horodatage dernière modif (ms)
export const COLONNE_SYNC_DIRTY = 'sync_dirty'; // 1 = modif locale non encore poussée

// Colonnes techniques à ne jamais recopier telles quelles d'un nœud à l'autre
// (recalculées localement : id entier, timestamps et drapeau internes).
export const COLONNES_TECHNIQUES = new Set([
  'id', COLONNE_SYNC_MAJ, COLONNE_SYNC_DIRTY,
]);

// Toutes les clés étrangères (simples + polymorphes) d'une table.
export function fksDe(nomTable) {
  const t = SYNC_TABLE_PAR_NOM[nomTable];
  if (!t) return { simples: [], polymorphes: [] };
  return { simples: t.fks || [], polymorphes: t.polymorphes || [] };
}
