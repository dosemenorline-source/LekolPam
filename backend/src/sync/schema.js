// ============================================================
// Installation (idempotente) du schéma de synchronisation
// ------------------------------------------------------------
// Ajoute, sans rien casser de l'existant :
//   - sur chaque table synchronisée : la colonne `sync_id` (UUID,
//     identité globale), un index unique dessus, et `sync_maj_le`
//     (horodatage de dernière modif, à la milliseconde, mis à jour
//     automatiquement) ;
//   - un déclencheur BEFORE INSERT qui attribue un `sync_id` si absent ;
//   - un déclencheur AFTER DELETE qui inscrit une « pierre tombale »
//     (tombstone) pour que les suppressions se propagent ;
//   - les tables `sync_tombstones` (suppressions à propager) et
//     `sync_noeuds` (postes enregistrés, côté nuage).
//
// Tout est vérifié avant application : la fonction peut être relancée
// sans effet de bord (démarrage du serveur, migration, tests).
// ============================================================

import { SYNC_TABLES, COLONNE_SYNC_ID, COLONNE_SYNC_MAJ, COLONNE_SYNC_DIRTY } from './tables.js';

async function colonneExiste(conn, table, colonne) {
  const [r] = await conn.query(
    `SELECT 1 FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ? LIMIT 1`,
    [table, colonne]
  );
  return r.length > 0;
}

async function indexExiste(conn, table, index) {
  const [r] = await conn.query(
    `SELECT 1 FROM information_schema.statistics
      WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ? LIMIT 1`,
    [table, index]
  );
  return r.length > 0;
}

async function tableExiste(conn, table) {
  const [r] = await conn.query(
    `SELECT 1 FROM information_schema.tables
      WHERE table_schema = DATABASE() AND table_name = ? LIMIT 1`,
    [table]
  );
  return r.length > 0;
}

// Tables de support du moteur de synchronisation.
async function installerTablesSupport(conn) {
  await conn.query(`
    CREATE TABLE IF NOT EXISTS sync_tombstones (
      id          BIGINT AUTO_INCREMENT PRIMARY KEY,
      nom_table   VARCHAR(64)  NOT NULL,
      sync_id     CHAR(36)     NOT NULL,
      supprime_le DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      UNIQUE KEY uniq_tombstone (nom_table, sync_id),
      INDEX idx_tombstone_date (supprime_le)
    ) ENGINE=InnoDB
  `);

  // Postes enregistrés (côté nuage) : chaque app de bureau s'authentifie
  // auprès du nuage avec un jeton propre (haché). Sert aussi à mémoriser
  // l'avancement de chaque poste (pour la purge des tombstones).
  await conn.query(`
    CREATE TABLE IF NOT EXISTS sync_noeuds (
      id           INT AUTO_INCREMENT PRIMARY KEY,
      nom          VARCHAR(120) NOT NULL,
      jeton_hash   VARCHAR(255) NOT NULL UNIQUE,
      actif        TINYINT(1)   NOT NULL DEFAULT 1,
      dernier_pull DATETIME(3)  NULL,
      dernier_push DATETIME(3)  NULL,
      cree_le      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB
  `);

  // État local de synchronisation (côté poste) : curseurs d'avancement.
  // Clé/valeur simple ; utilisé par le travailleur de synchro sur chaque poste.
  await conn.query(`
    CREATE TABLE IF NOT EXISTS sync_etat (
      cle    VARCHAR(60) PRIMARY KEY,
      valeur VARCHAR(255) NULL,
      maj_le DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
    ) ENGINE=InnoDB
  `);
}

async function installerColonnesTable(conn, table) {
  if (!(await tableExiste(conn, table))) return; // base pas encore initialisée

  // 1) sync_id (identité globale)
  if (!(await colonneExiste(conn, table, COLONNE_SYNC_ID))) {
    await conn.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${COLONNE_SYNC_ID}\` CHAR(36) NULL`);
    // Backfill des lignes existantes : UUID() est évalué par ligne.
    await conn.query(`UPDATE \`${table}\` SET \`${COLONNE_SYNC_ID}\` = UUID() WHERE \`${COLONNE_SYNC_ID}\` IS NULL`);
  }
  const idxSync = `uniq_${table}_sync_id`;
  if (!(await indexExiste(conn, table, idxSync))) {
    await conn.query(`ALTER TABLE \`${table}\` ADD UNIQUE INDEX \`${idxSync}\` (\`${COLONNE_SYNC_ID}\`)`);
  }

  // 2) sync_maj_le (horodatage de dernière modification, auto)
  if (!(await colonneExiste(conn, table, COLONNE_SYNC_MAJ))) {
    await conn.query(
      `ALTER TABLE \`${table}\` ADD COLUMN \`${COLONNE_SYNC_MAJ}\` DATETIME(3) NOT NULL ` +
      `DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)`
    );
  }
  const idxMaj = `idx_${table}_sync_maj`;
  if (!(await indexExiste(conn, table, idxMaj))) {
    await conn.query(`ALTER TABLE \`${table}\` ADD INDEX \`${idxMaj}\` (\`${COLONNE_SYNC_MAJ}\`)`);
  }

  // 3) sync_dirty (modif locale en attente de poussée vers le nuage)
  if (!(await colonneExiste(conn, table, COLONNE_SYNC_DIRTY))) {
    await conn.query(
      `ALTER TABLE \`${table}\` ADD COLUMN \`${COLONNE_SYNC_DIRTY}\` TINYINT NOT NULL DEFAULT 0`
    );
  }
  const idxDirty = `idx_${table}_sync_dirty`;
  if (!(await indexExiste(conn, table, idxDirty))) {
    await conn.query(`ALTER TABLE \`${table}\` ADD INDEX \`${idxDirty}\` (\`${COLONNE_SYNC_DIRTY}\`)`);
  }
}

async function installerDeclencheursTable(conn, table) {
  if (!(await tableExiste(conn, table))) return;

  // Garde : quand le moteur APPLIQUE une modif reçue (pull sur un poste,
  // ou effacement répercuté), il pose @sync_applying = 1 pour que les
  // déclencheurs NE re-marquent PAS la ligne comme « sale » et NE créent
  // PAS d'écho (sinon la modif repartirait en boucle vers le nuage).
  //
  // Les instructions multiples imposent BEGIN…END ; envoyé en une seule
  // requête, pas besoin de DELIMITER (directive propre au client CLI).

  // -- anciens noms (versions précédentes) : nettoyage pour l'idempotence --
  await conn.query(`DROP TRIGGER IF EXISTS \`trg_${table}_sync_id_ins\``);

  // BEFORE INSERT : attribue un sync_id si absent ; marque sale si local.
  const trgIns = `trg_${table}_sync_ins`;
  await conn.query(`DROP TRIGGER IF EXISTS \`${trgIns}\``);
  await conn.query(
    `CREATE TRIGGER \`${trgIns}\` BEFORE INSERT ON \`${table}\` FOR EACH ROW BEGIN ` +
    `IF NEW.\`${COLONNE_SYNC_ID}\` IS NULL THEN SET NEW.\`${COLONNE_SYNC_ID}\` = UUID(); END IF; ` +
    `IF @sync_applying IS NULL THEN SET NEW.\`${COLONNE_SYNC_DIRTY}\` = 1; END IF; ` +
    `END`
  );

  // BEFORE UPDATE : marque sale si la modif est locale.
  const trgUpd = `trg_${table}_sync_upd`;
  await conn.query(`DROP TRIGGER IF EXISTS \`${trgUpd}\``);
  await conn.query(
    `CREATE TRIGGER \`${trgUpd}\` BEFORE UPDATE ON \`${table}\` FOR EACH ROW BEGIN ` +
    `IF @sync_applying IS NULL THEN SET NEW.\`${COLONNE_SYNC_DIRTY}\` = 1; END IF; ` +
    `END`
  );

  // AFTER DELETE : pierre tombale (sauf effacement appliqué depuis le nuage).
  const trgDel = `trg_${table}_tombstone_del`;
  await conn.query(`DROP TRIGGER IF EXISTS \`${trgDel}\``);
  await conn.query(
    `CREATE TRIGGER \`${trgDel}\` AFTER DELETE ON \`${table}\` FOR EACH ROW BEGIN ` +
    `IF @sync_applying IS NULL THEN ` +
    `INSERT INTO sync_tombstones (nom_table, sync_id, supprime_le) ` +
    `VALUES ('${table}', OLD.\`${COLONNE_SYNC_ID}\`, NOW(3)) ` +
    `ON DUPLICATE KEY UPDATE supprime_le = NOW(3); ` +
    `END IF; ` +
    `END`
  );
}

// Point d'entrée : installe tout le schéma de synchronisation.
// `conn` peut être un pool ou une connexion mysql2/promise.
export async function installerSchemaSync(conn) {
  await installerTablesSupport(conn);
  for (const { nom } of SYNC_TABLES) {
    await installerColonnesTable(conn, nom);
  }
  // Les déclencheurs après les colonnes (ils en dépendent).
  for (const { nom } of SYNC_TABLES) {
    await installerDeclencheursTable(conn, nom);
  }
}

export default installerSchemaSync;
