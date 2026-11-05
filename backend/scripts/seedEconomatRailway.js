// Crée le compte admin de l'Économat (système indépendant) sur la base de
// production (Railway). À lancer UNE FOIS.
//
// Usage :
//   node scripts/seedEconomatRailway.js "mysql://root:MOTDEPASSE@HOTE.proxy.rlwy.net:PORT/railway" email motDePasse
//
// L'URL publique se trouve dans Railway → service MySQL → Variables → MYSQL_PUBLIC_URL.

import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';

const urlArg = process.argv[2] || process.env.MYSQL_PUBLIC_URL || process.env.DATABASE_PUBLIC_URL;
const email = (process.argv[3] || '').trim().toLowerCase();
const motDePasse = process.argv[4] || '';

if (!urlArg || !email || !motDePasse) {
  console.error('✖ Usage : node scripts/seedEconomatRailway.js "mysql://root:MDP@HOTE:PORT/railway" email motDePasse');
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

  const conn = await mysql.createConnection({
    host: u.hostname,
    port: Number(u.port) || 3306,
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: 'lekol_pam',
  });

  try {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS economat_admins (
        id                INT AUTO_INCREMENT PRIMARY KEY,
        email             VARCHAR(190) NOT NULL UNIQUE,
        mot_de_passe_hash VARCHAR(255) NOT NULL,
        cree_le           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB
    `);

    const [existant] = await conn.query('SELECT id FROM economat_admins WHERE email = ?', [email]);
    if (existant.length) {
      console.log(`= ${email} existe déjà (ignoré)`);
    } else {
      const hash = await bcrypt.hash(motDePasse, 12);
      await conn.query('INSERT INTO economat_admins (email, mot_de_passe_hash) VALUES (?, ?)', [email, hash]);
      console.log(`+ admin Économat créé : ${email}`);
    }
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error('✖ Échec :', err.message);
  process.exit(1);
});
