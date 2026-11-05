// Applique un fichier de migration .sql sur la base MySQL, avec un compte
// PRIVILÉGIÉ (droits CREATE/ALTER). Le compte applicatif « lekol_app » a des
// droits réduits et ne peut pas modifier la structure.
//
// L'URL de connexion est lue dans l'environnement (jamais affichée). Sur
// Railway : `railway run --service MySQL` l'injecte. Le nom de base est forcé
// par SYNC_DB_NAME si fourni (l'URL publique Railway pointe sur « railway »,
// alors que l'application utilise « lekol_pam »).
//
// Usage :
//   SYNC_DB_NAME=lekol_pam railway run --service MySQL \
//     node scripts/appliquerMigration.js db/migrations/040_invitations_eleve.sql
//   (ou, en local :  node scripts/appliquerMigration.js <fichier.sql> "mysql://root:MDP@HOTE:PORT/base")
import fs from 'fs';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const fichier = process.argv[2];
const url = process.argv[3]
  || process.env.MYSQL_PUBLIC_URL
  || process.env.DATABASE_PUBLIC_URL
  || process.env.MYSQL_URL;

if (!fichier) {
  console.error('Usage : node scripts/appliquerMigration.js <fichier.sql> [mysql://user:MDP@HOTE:PORT/base]');
  process.exit(1);
}
if (!url) {
  console.error('✖ Aucune URL MySQL (argument ou MYSQL_PUBLIC_URL / DATABASE_PUBLIC_URL / MYSQL_URL).');
  process.exit(1);
}

const u = new URL(url);
const database = process.env.SYNC_DB_NAME
  || decodeURIComponent(u.pathname.replace(/^\//, ''))
  || process.env.DB_NAME
  || 'lekol_pam';

const config = {
  host: u.hostname,
  port: Number(u.port) || 3306,
  user: decodeURIComponent(u.username),
  password: decodeURIComponent(u.password),
  database,
  multipleStatements: true,
};

const sql = fs.readFileSync(fichier, 'utf8');

console.log(`→ Connexion ${config.host}:${config.port}/${config.database}`);
console.log(`→ Application de ${fichier} …`);
const conn = await mysql.createConnection(config);
try {
  await conn.query(sql);
  console.log('✔ Migration appliquée avec succès.');
} finally {
  await conn.end();
}
