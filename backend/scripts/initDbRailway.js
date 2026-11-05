// Initialisation de la base de production (Railway) — à lancer UNE FOIS après le déploiement.
//
// Crée la base « lekol_pam » et toutes les tables à partir de db/schema.sql.
// (schema.sql est le schéma complet et à jour : aucune migration à exécuter pour une base neuve.)
//
// Usage :
//   node scripts/initDbRailway.js "mysql://root:MOTDEPASSE@HOTE.proxy.rlwy.net:PORT/railway"
//
// L'URL publique se trouve dans Railway → service MySQL → Variables → MYSQL_PUBLIC_URL.
// (Utiliser l'URL PUBLIQUE — pas mysql.railway.internal, qui n'est joignable que depuis Railway.)

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.resolve(__dirname, '../db/schema.sql');

const urlArg = process.argv[2] || process.env.MYSQL_PUBLIC_URL || process.env.DATABASE_PUBLIC_URL;

if (!urlArg) {
  console.error('✖ Il manque l\'URL de connexion.');
  console.error('  Exemple : node scripts/initDbRailway.js "mysql://root:MDP@HOTE.proxy.rlwy.net:PORT/railway"');
  console.error('  (copiez MYSQL_PUBLIC_URL depuis Railway → service MySQL → Variables)');
  process.exit(1);
}

async function main() {
  let u;
  try {
    u = new URL(urlArg);
  } catch {
    console.error('✖ URL invalide. Attendu : mysql://root:MDP@HOTE:PORT/railway');
    process.exit(1);
  }

  // TLS pour un MySQL managé (TiDB/Aiven) : DB_SSL=true (vérifié) ou
  // DB_SSL=no-verify (sans vérifier le certificat), ou ?ssl=true dans l'URL.
  const sslVoulu = (process.env.DB_SSL || '').toLowerCase();
  let ssl;
  if (sslVoulu === 'true' || sslVoulu === '1' || u.searchParams.get('ssl') === 'true') {
    ssl = { minVersion: 'TLSv1.2', rejectUnauthorized: true };
  } else if (sslVoulu === 'no-verify' || sslVoulu === 'skip-verify') {
    ssl = { rejectUnauthorized: false };
  }

  const config = {
    host: u.hostname,
    port: Number(u.port) || 3306,
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    ssl,
    multipleStatements: true, // schema.sql contient plusieurs instructions (CREATE DATABASE, USE, CREATE TABLE…)
  };

  const sql = fs.readFileSync(schemaPath, 'utf8');

  console.log(`→ Connexion à ${config.host}:${config.port} …`);
  const conn = await mysql.createConnection(config);
  try {
    console.log('→ Exécution de db/schema.sql (création de « lekol_pam » + tables)…');
    await conn.query(sql);

    const [tables] = await conn.query(
      "SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = 'lekol_pam'"
    );
    console.log(`✔ Terminé. Base « lekol_pam » prête avec ${tables[0].n} tables.`);
    console.log('');
    console.log('  Rappel : dans le service Node (Railway → Variables), mettre');
    console.log('    DB_NAME=lekol_pam');
    console.log('  (et NON ${{MySQL.MYSQLDATABASE}} qui vaut « railway »), puis redéployer.');
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error('✖ Échec :', err.message);
  process.exit(1);
});
