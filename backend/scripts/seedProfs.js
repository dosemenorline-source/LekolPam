// Seed — crée un compte admin du corps enseignant (système indépendant).
// Usage : npm run seed:profs
import bcrypt from 'bcryptjs';
import { pool } from '../src/config/db.js';

const IDENTIFIANT = 'profsadmin';
const MOT_DE_PASSE = 'profs1234';

async function seed() {
  const [existant] = await pool.query('SELECT id FROM profs_admins WHERE identifiant = ?', [IDENTIFIANT]);
  if (existant.length) {
    console.log(`= ${IDENTIFIANT} existe déjà (ignoré)`);
  } else {
    const hash = await bcrypt.hash(MOT_DE_PASSE, 12);
    await pool.query('INSERT INTO profs_admins (identifiant, mot_de_passe_hash) VALUES (?, ?)', [IDENTIFIANT, hash]);
    console.log(`+ admin enseignants créé : ${IDENTIFIANT} / ${MOT_DE_PASSE}`);
  }
  await pool.end();
  console.log('Seed enseignants terminé.');
}

seed().catch((err) => {
  console.error('Échec du seed enseignants :', err.message);
  process.exit(1);
});
