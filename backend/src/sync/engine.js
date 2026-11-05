// ============================================================
// Moteur de synchronisation : (dé)sérialisation + application
// ------------------------------------------------------------
// Logique partagée par les deux côtés :
//   - un POSTE (app de bureau) collecte ses modifs locales (dirty) et
//     les POUSSE vers le nuage ; il TIRE les modifs du nuage et les
//     applique localement.
//   - le NUAGE (hub) répond au pull (modifs depuis un curseur) et
//     applique les push reçus (dernier reçu gagne + journal de conflit).
//
// Clé du modèle : les `id` entiers sont LOCAUX. Dans les échanges, toute
// clé étrangère est exprimée par le `sync_id` (UUID) de la ligne cible.
// À l'application, on retraduit sync_id → id entier local (les cibles
// existent déjà grâce à l'ordre de dépendance de SYNC_TABLES).
//
// Horloges : l'ordre du pull suit l'horloge du NUAGE uniquement (le hub
// pose sync_maj_le = maintenant sur tout ce qu'il accepte). La sélection
// du push suit le drapeau sync_dirty (indépendant de l'horloge). Aucune
// comparaison d'horodatage entre machines n'est donc nécessaire.
// ============================================================

import {
  SYNC_TABLES, SYNC_NOMS, SYNC_TABLE_PAR_NOM,
  COLONNE_SYNC_ID, COLONNE_SYNC_MAJ, COLONNE_SYNC_DIRTY, COLONNES_TECHNIQUES,
  COLONNES_NON_POUSSABLES, fksDe,
} from './tables.js';

// ---- Résolution des clés étrangères ↔ sync_id --------------------------

async function syncIdDepuisId(conn, cible, idEntier) {
  if (idEntier == null) return null;
  const [r] = await conn.query(
    `SELECT \`${COLONNE_SYNC_ID}\` AS s FROM \`${cible}\` WHERE id = ? LIMIT 1`, [idEntier]
  );
  return r.length ? r[0].s : null;
}

async function idDepuisSyncId(conn, cible, syncId) {
  if (syncId == null) return null;
  const [r] = await conn.query(
    `SELECT id FROM \`${cible}\` WHERE \`${COLONNE_SYNC_ID}\` = ? LIMIT 1`, [syncId]
  );
  return r.length ? r[0].id : null;
}

// Table cible d'une clé étrangère polymorphe pour une ligne donnée.
function ciblePolymorphe(poly, row) {
  const typeVal = row[poly.colonneType];
  return poly.carte[typeVal] || null;
}

// ---- Sérialisation d'une ligne brute en enregistrement transportable ---

// mysql2 renvoie les colonnes DATE/DATETIME/TIMESTAMP en objets Date. En JSON,
// un Date devient une chaîne ISO « 2026-10-05T00:00:00.000Z » que MySQL refuse
// à l'insertion (mode strict). On reformate en « YYYY-MM-DD HH:MM:SS.fff » avec
// les composantes LOCALES (mysql2 parse par défaut en heure locale → round-trip
// correct). Pour une colonne DATE, la partie heure est simplement tronquée.
function versDateMySQL(d) {
  const p = (n, l = 2) => String(n).padStart(l, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} `
    + `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(d.getMilliseconds(), 3)}`;
}

function normaliserValeur(val) {
  return val instanceof Date ? versDateMySQL(val) : val;
}

async function serialiserLigne(conn, table, row) {
  const { simples, polymorphes } = fksDe(table);
  const colonnesFk = new Set([...simples, ...polymorphes].map((f) => f.colonne));

  const data = {};
  for (const [col, val] of Object.entries(row)) {
    if (col === COLONNE_SYNC_ID) continue;        // identité : champ à part
    if (COLONNES_TECHNIQUES.has(col)) continue;    // id, sync_maj_le, sync_dirty
    if (colonnesFk.has(col)) continue;             // clés étrangères → refs
    data[col] = normaliserValeur(val);
  }

  const refs = {};
  for (const fk of simples) {
    refs[fk.colonne] = await syncIdDepuisId(conn, fk.cible, row[fk.colonne]);
  }
  for (const poly of polymorphes) {
    const cible = ciblePolymorphe(poly, row);
    refs[poly.colonne] = cible ? await syncIdDepuisId(conn, cible, row[poly.colonne]) : null;
  }

  return {
    table,
    sync_id: row[COLONNE_SYNC_ID],
    sync_maj_le: row[COLONNE_SYNC_MAJ],
    data,
    refs,
  };
}

// Nombre de modifs locales en attente de poussée (lignes « sales » +
// pierres tombales). Lecture rapide (colonne dirty indexée).
export async function compterEnAttente(conn) {
  let total = 0;
  for (const { nom } of SYNC_TABLES) {
    const [[{ n }]] = await conn.query(
      `SELECT COUNT(*) AS n FROM \`${nom}\` WHERE \`${COLONNE_SYNC_DIRTY}\` = 1`
    );
    total += n;
  }
  const [[{ n }]] = await conn.query('SELECT COUNT(*) AS n FROM sync_tombstones');
  return total + n;
}

// ---- Collecte : modifs locales à pousser (POSTE → NUAGE) ---------------

// Rassemble les lignes « sales » (sync_dirty=1), en ORDRE DE DÉPENDANCE,
// jusqu'à `limite` enregistrements, plus les pierres tombales locales.
export async function collecterSales(conn, { limite = 500 } = {}) {
  const enregistrements = [];
  let restant = limite;

  for (const { nom } of SYNC_TABLES) {
    if (restant <= 0) break;
    const [lignes] = await conn.query(
      `SELECT * FROM \`${nom}\` WHERE \`${COLONNE_SYNC_DIRTY}\` = 1
        ORDER BY \`${COLONNE_SYNC_MAJ}\` ASC LIMIT ?`, [restant]
    );
    for (const row of lignes) {
      enregistrements.push(await serialiserLigne(conn, nom, row));
    }
    restant -= lignes.length;
  }

  const [tombstones] = await conn.query(
    `SELECT nom_table, sync_id, supprime_le FROM sync_tombstones ORDER BY supprime_le ASC LIMIT ?`,
    [limite]
  );

  const total = enregistrements.length + tombstones.length;
  return { enregistrements, tombstones, aFini: total < limite };
}

// ---- Collecte : modifs du nuage depuis un curseur (NUAGE → POSTE) ------

// Renvoie les lignes dont sync_maj_le ∈ (depuis, instantané] et les
// tombstones dont supprime_le ∈ (depuis, instantané]. `instantané` est
// figé en début de requête (NOW(3) du nuage) et devient le prochain curseur,
// ce qui évite de sauter ou de rejouer les modifs de la même milliseconde.
export async function collecterDepuis(conn, depuis, { limite = 500 } = {}) {
  // Instantané en CHAÎNE au format MySQL ('YYYY-MM-DD HH:MM:SS.ffffff') : il
  // sert de curseur, transporté en JSON puis renvoyé tel quel au prochain pull.
  // (NOW(3) renvoyé en Date deviendrait une chaîne ISO « …T…Z » que MySQL
  // comparerait mal à une colonne DATETIME.)
  const [[{ instant }]] = await conn.query(
    `SELECT DATE_FORMAT(NOW(3), '%Y-%m-%d %H:%i:%s.%f') AS instant`
  );
  const borneBasse = depuis || '1970-01-01 00:00:00.000';

  const enregistrements = [];
  let restant = limite;
  for (const { nom } of SYNC_TABLES) {
    if (restant <= 0) break;
    const [lignes] = await conn.query(
      `SELECT * FROM \`${nom}\`
        WHERE \`${COLONNE_SYNC_MAJ}\` > ? AND \`${COLONNE_SYNC_MAJ}\` <= ?
        ORDER BY \`${COLONNE_SYNC_MAJ}\` ASC LIMIT ?`,
      [borneBasse, instant, restant]
    );
    for (const row of lignes) {
      enregistrements.push(await serialiserLigne(conn, nom, row));
    }
    restant -= lignes.length;
  }

  const [tombstones] = await conn.query(
    `SELECT nom_table, sync_id, supprime_le FROM sync_tombstones
      WHERE supprime_le > ? AND supprime_le <= ? ORDER BY supprime_le ASC`,
    [borneBasse, instant]
  );

  return { enregistrements, tombstones, curseur: instant };
}

// ---- Application d'un lot reçu -----------------------------------------

// Colonnes réelles d'une table (cache par process). Sert de LISTE BLANCHE :
// un poste (même authentifié) ne peut écrire que dans de vraies colonnes, ce
// qui bloque toute injection SQL par nom de colonne (une clé forgée contenant
// un backtick n'existe pas dans le schéma → ignorée) et tout écrit dans les
// colonnes techniques gérées par le moteur.
const _cacheColonnes = new Map();
async function colonnesReelles(conn, table) {
  if (_cacheColonnes.has(table)) return _cacheColonnes.get(table);
  const [r] = await conn.query(
    `SELECT column_name AS c FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = ?`, [table]
  );
  const set = new Set(r.map((x) => x.c || x.column_name));
  _cacheColonnes.set(table, set);
  return set;
}

const COLONNES_GEREES = new Set(['id', COLONNE_SYNC_ID, COLONNE_SYNC_MAJ, COLONNE_SYNC_DIRTY]);

// Reconstruit les colonnes d'un enregistrement : données métier (restreintes
// aux vraies colonnes de la table) + clés étrangères retraduites (sync_id →
// id local). Renvoie null si une clé étrangère NON nullable reste introuvable
// (cible absente → à rejouer).
async function reconstituerColonnes(conn, rec) {
  const colsReelles = await colonnesReelles(conn, rec.table);
  const data = (rec.data && typeof rec.data === 'object') ? rec.data : {};

  // Liste blanche : seules les vraies colonnes métier sont reprises.
  const colonnes = { [COLONNE_SYNC_ID]: rec.sync_id };
  for (const [cle, valeur] of Object.entries(data)) {
    if (!colsReelles.has(cle) || COLONNES_GEREES.has(cle)) continue;
    colonnes[cle] = valeur;
  }

  const { simples, polymorphes } = fksDe(rec.table);

  // Une clé étrangère NON nullable qui ne se résout pas → on IGNORE la ligne
  // (return null) au lieu de planter :
  //  - cible pas encore synchronisée (sid connu mais absent localement) : sera
  //    retentée via l'ordre de dépendance ;
  //  - référence orpheline (sid null : l'entité pointée a été supprimée côté
  //    nuage, ex. une ligne d'historique sur un paiement effacé) : ignorée
  //    définitivement plutôt que de violer la contrainte NOT NULL.
  for (const fk of simples) {
    const sid = rec.refs ? rec.refs[fk.colonne] : null;
    const idLocal = await idDepuisSyncId(conn, fk.cible, sid);
    if (idLocal == null && !fk.nullable) return null;
    colonnes[fk.colonne] = idLocal;
  }
  for (const poly of polymorphes) {
    const sid = rec.refs ? rec.refs[poly.colonne] : null;
    const cible = poly.carte[rec.data[poly.colonneType]] || null;
    const idLocal = cible ? await idDepuisSyncId(conn, cible, sid) : null;
    if (idLocal == null && !poly.nullable) return null;
    colonnes[poly.colonne] = idLocal;
  }
  return colonnes;
}

async function upsertLigne(conn, table, colonnes, { estHub }) {
  // On teste seulement l'EXISTENCE par sync_id (la valeur de la PK n'est pas
  // utilisée ici) : « SELECT 1 » plutôt que « SELECT id », car certaines tables
  // synchronisées n'ont pas de colonne `id` (ex. permissions, dont la PK est `cle`).
  const [exist] = await conn.query(
    `SELECT 1 FROM \`${table}\` WHERE \`${COLONNE_SYNC_ID}\` = ? LIMIT 1`, [colonnes[COLONNE_SYNC_ID]]
  );

  // Sur un POSTE, la ligne appliquée ne doit pas repartir (dirty=0). On NE
  // fixe PAS sync_maj_le : le curseur de pull vient de l'instantané du hub
  // (collecterDepuis), pas du sync_maj_le des lignes — laisser l'horloge
  // locale le remplir évite d'insérer une date ISO « …T…Z » venue du JSON.
  // Sur le HUB, l'horloge locale (NOW du hub) fait autorité pour l'ordre des pull.
  const cols = { ...colonnes };
  if (!estHub) {
    cols[COLONNE_SYNC_DIRTY] = 0;
  } else {
    // Push (nœud → nuage) : on refuse d'écrire les colonnes sensibles
    // (privilèges, authentification) même venant d'un poste authentifié.
    const protegees = COLONNES_NON_POUSSABLES[table];
    if (protegees) {
      for (const c of protegees) delete cols[c];
    }
  }

  const noms = Object.keys(cols);
  const valeurs = noms.map((n) => cols[n]);

  if (exist.length === 0) {
    const place = noms.map(() => '?').join(', ');
    const colList = noms.map((n) => `\`${n}\``).join(', ');
    await conn.query(`INSERT INTO \`${table}\` (${colList}) VALUES (${place})`, valeurs);
    return 'insere';
  }
  // UPDATE (dernier reçu gagne)
  const set = noms.filter((n) => n !== COLONNE_SYNC_ID).map((n) => `\`${n}\` = ?`).join(', ');
  const setVals = noms.filter((n) => n !== COLONNE_SYNC_ID).map((n) => cols[n]);
  await conn.query(
    `UPDATE \`${table}\` SET ${set} WHERE \`${COLONNE_SYNC_ID}\` = ?`,
    [...setVals, colonnes[COLONNE_SYNC_ID]]
  );
  return 'maj';
}

// Applique un lot { enregistrements, tombstones }.
//   estHub=true  : côté nuage (propage : horloge hub, tombstones réels).
//   estHub=false : côté poste (pose @sync_applying : pas d'écho).
export async function appliquer(conn, lot, { estHub = false } = {}) {
  const res = { insere: 0, maj: 0, supprime: 0, reporte: 0, conflits: [] };
  const enregistrements = lot.enregistrements || [];
  const tombstones = lot.tombstones || [];

  if (!estHub) await conn.query('SET @sync_applying = 1');
  try {
    for (const rec of enregistrements) {
      if (!SYNC_TABLE_PAR_NOM[rec.table]) continue; // table inconnue : ignorée
      const colonnes = await reconstituerColonnes(conn, rec);
      if (colonnes == null) { res.reporte++; continue; }
      const issue = await upsertLigne(conn, rec.table, colonnes, { estHub });
      res[issue === 'insere' ? 'insere' : 'maj']++;
    }

    // Suppressions : enfants d'abord (ordre de dépendance inverse).
    const ordre = new Map(SYNC_NOMS.map((n, i) => [n, i]));
    const tbTriees = [...tombstones].sort(
      (a, b) => (ordre.get(b.nom_table) ?? -1) - (ordre.get(a.nom_table) ?? -1)
    );
    for (const tb of tbTriees) {
      if (!SYNC_TABLE_PAR_NOM[tb.nom_table]) continue;
      const [r] = await conn.query(
        `DELETE FROM \`${tb.nom_table}\` WHERE \`${COLONNE_SYNC_ID}\` = ?`, [tb.sync_id]
      );
      if (r.affectedRows > 0) res.supprime++;
    }
  } finally {
    if (!estHub) await conn.query('SET @sync_applying = NULL');
  }
  return res;
}

// ---- Après un push accepté (POSTE) : nettoyer dirty + tombstones -------

export async function marquerPousse(conn, { enregistrements = [], tombstones = [] }) {
  await conn.query('SET @sync_applying = 1');
  try {
    // Regrouper les sync_id poussés par table pour remettre dirty=0.
    const parTable = new Map();
    for (const rec of enregistrements) {
      if (!parTable.has(rec.table)) parTable.set(rec.table, []);
      parTable.get(rec.table).push(rec.sync_id);
    }
    for (const [table, ids] of parTable) {
      if (!ids.length) continue;
      const place = ids.map(() => '?').join(', ');
      await conn.query(
        `UPDATE \`${table}\` SET \`${COLONNE_SYNC_DIRTY}\` = 0
          WHERE \`${COLONNE_SYNC_ID}\` IN (${place})`, ids
      );
    }
    // Les tombstones poussées sont supprimées de la file locale.
    for (const tb of tombstones) {
      await conn.query(
        `DELETE FROM sync_tombstones WHERE nom_table = ? AND sync_id = ?`,
        [tb.nom_table, tb.sync_id]
      );
    }
  } finally {
    await conn.query('SET @sync_applying = NULL');
  }
}
