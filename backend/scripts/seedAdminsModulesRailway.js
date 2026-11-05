// Crée les comptes admin des modules indépendants (vlog, enseignants, à propos,
// académie, examens) sur la base de production (Railway). À lancer UNE FOIS.
//
// Usage :
//   node scripts/seedAdminsModulesRailway.js "mysql://root:MOTDEPASSE@HOTE.proxy.rlwy.net:PORT/railway"
//
// L'URL publique se trouve dans Railway → service MySQL → Variables → MYSQL_PUBLIC_URL.

import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';

// Chaque module a sa propre table d'admins (systèmes indépendants).
const ADMINS = [
  { table: 'vlog_admins',     identifiant: 'vlogadmin',     motDePasse: 'vlog1234',     libelle: 'Vlog' },
  { table: 'profs_admins',    identifiant: 'profsadmin',    motDePasse: 'profs1234',    libelle: 'Enseignants' },
  { table: 'apropos_admins',  identifiant: 'aproposadmin',  motDePasse: 'apropos1234',  libelle: 'À propos' },
  { table: 'academie_admins', identifiant: 'academieadmin', motDePasse: 'academie1234', libelle: 'Académie' },
  { table: 'examens_admins',  identifiant: 'examensadmin',  motDePasse: 'examens1234',  libelle: 'Examens' },
];

const urlArg = process.argv[2] || process.env.MYSQL_PUBLIC_URL || process.env.DATABASE_PUBLIC_URL;

if (!urlArg) {
  console.error('✖ Il manque l\'URL de connexion.');
  console.error('  Exemple : node scripts/seedAdminsModulesRailway.js "mysql://root:MDP@HOTE.proxy.rlwy.net:PORT/railway"');
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
    for (const a of ADMINS) {
      const [existant] = await conn.query(
        `SELECT id FROM ${a.table} WHERE identifiant = ?`, [a.identifiant]
      );
      if (existant.length) {
        console.log(`= ${a.identifiant} existe déjà (ignoré)`);
        continue;
      }
      const hash = await bcrypt.hash(a.motDePasse, 12);
      await conn.query(
        `INSERT INTO ${a.table} (identifiant, mot_de_passe_hash) VALUES (?, ?)`,
        [a.identifiant, hash]
      );
      console.log(`+ admin ${a.libelle} créé : ${a.identifiant} / ${a.motDePasse}`);
    }
    console.log('');
    console.log('✔ Terminé. Connectez-vous à chaque module, puis changez les mots de passe.');
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error('✖ Échec :', err.message);
  process.exit(1);
});
