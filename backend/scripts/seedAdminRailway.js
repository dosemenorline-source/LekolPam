// Crée les comptes de départ (admin + direction) sur la base de production (Railway).
// À lancer UNE FOIS, après initDbRailway.js.
//
// Usage :
//   node scripts/seedAdminRailway.js "mysql://root:MOTDEPASSE@HOTE.proxy.rlwy.net:PORT/railway"
//
// L'URL publique se trouve dans Railway → service MySQL → Variables → MYSQL_PUBLIC_URL.

import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';

const COMPTES = [
  { nom: 'Secrétariat', courriel: 'admin@lekol.ht',     motDePasse: 'admin1234',     role: 'admin' },
  { nom: 'Direction',   courriel: 'direction@lekol.ht', motDePasse: 'direction1234', role: 'direction' },
];

const urlArg = process.argv[2] || process.env.MYSQL_PUBLIC_URL || process.env.DATABASE_PUBLIC_URL;

if (!urlArg) {
  console.error('✖ Il manque l\'URL de connexion.');
  console.error('  Exemple : node scripts/seedAdminRailway.js "mysql://root:MDP@HOTE.proxy.rlwy.net:PORT/railway"');
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
    database: 'lekol_pam', // les tables sont dans cette base (pas « railway »)
  });

  try {
    for (const c of COMPTES) {
      const [existant] = await conn.query('SELECT id FROM utilisateurs WHERE courriel = ?', [c.courriel]);
      if (existant.length) {
        console.log(`= ${c.courriel} existe déjà (ignoré)`);
        continue;
      }
      const hash = await bcrypt.hash(c.motDePasse, 12);
      await conn.query(
        'INSERT INTO utilisateurs (nom, courriel, mot_de_passe_hash, role, courriel_verifie) VALUES (?, ?, ?, ?, 1)',
        [c.nom, c.courriel, hash, c.role]
      );
      console.log(`+ ${c.role} créé : ${c.courriel} / ${c.motDePasse}`);
    }
    console.log('');
    console.log('✔ Terminé. Connectez-vous avec un de ces comptes, puis changez le mot de passe.');
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error('✖ Échec :', err.message);
  process.exit(1);
});
