// Installation (ou mise à jour) du schéma de synchronisation sur une base.
//
// À lancer avec un compte MySQL PRIVILÉGIÉ (droits ALTER / CREATE / TRIGGER) :
// le compte applicatif « lekol_app » a des droits réduits (CRUD seul) et ne
// peut pas modifier la structure. Idempotent : relançable sans risque.
//
// Usage :
//   node scripts/migrerSync.js "mysql://root:MDP@HOTE.proxy.rlwy.net:PORT/railway"
//   (ou définir MYSQL_PUBLIC_URL / DATABASE_PUBLIC_URL dans l'environnement)
//
// Pour une base LOCALE (app de bureau), on peut aussi appeler directement
// installerSchemaSync() au démarrage avec le compte root local.

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { installerSchemaSync } from '../src/sync/schema.js';
import { SYNC_TABLES } from '../src/sync/tables.js';

dotenv.config();

const urlArg = process.argv[2] || process.env.MYSQL_PUBLIC_URL || process.env.DATABASE_PUBLIC_URL;

function configDepuisUrl(urlArg) {
  const u = new URL(urlArg);
  // nom de base : SYNC_DB_NAME prioritaire (sur Railway, l'URL publique MySQL
  // pointe sur « railway », alors que l'app utilise « lekol_pam »), sinon
  // le chemin de l'URL, sinon DB_NAME.
  const base = process.env.SYNC_DB_NAME
    || decodeURIComponent(u.pathname.replace(/^\//, ''))
    || process.env.DB_NAME || 'lekol_pam';
  return {
    host: u.hostname,
    port: Number(u.port) || 3306,
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: base,
  };
}

async function main() {
  let config;
  if (urlArg) {
    try { config = configDepuisUrl(urlArg); }
    catch { console.error('✖ URL invalide. Attendu : mysql://user:MDP@HOTE:PORT/base'); process.exit(1); }
  } else {
    // Repli : variables DB_* (utile en local)
    config = {
      host: process.env.DB_HOST || '127.0.0.1',
      port: Number(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'lekol_pam',
    };
  }

  console.log(`→ Connexion à ${config.host}:${config.port}/${config.database} …`);
  const conn = await mysql.createConnection(config);
  try {
    console.log(`→ Installation du schéma de synchronisation (${SYNC_TABLES.length} tables)…`);
    await installerSchemaSync(conn);
    const [[{ n }]] = await conn.query(
      "SELECT COUNT(*) AS n FROM information_schema.triggers WHERE trigger_schema = DATABASE()"
    );
    console.log(`✔ Terminé. ${n} déclencheur(s) de synchronisation en place.`);
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error('✖ Échec :', err.message);
  process.exit(1);
});
