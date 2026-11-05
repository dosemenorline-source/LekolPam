// Seed — crée un compte admin des « Examens passés » (système indépendant).
// Usage : npm run seed:examens
import bcrypt from 'bcryptjs';
import { pool } from '../src/config/db.js';

const IDENTIFIANT = 'examensadmin';
const MOT_DE_PASSE = 'examens1234';

async function seed() {
  const [existant] = await pool.query('SELECT id FROM examens_admins WHERE identifiant = ?', [IDENTIFIANT]);
  if (existant.length) {
    console.log(`= ${IDENTIFIANT} existe déjà (ignoré)`);
  } else {
    const hash = await bcrypt.hash(MOT_DE_PASSE, 12);
    await pool.query('INSERT INTO examens_admins (identifiant, mot_de_passe_hash) VALUES (?, ?)', [IDENTIFIANT, hash]);
    console.log(`+ admin Examens créé : ${IDENTIFIANT} / ${MOT_DE_PASSE}`);
  }
  await pool.end();
  console.log('Seed Examens terminé.');
}

seed().catch((err) => {
  console.error('Échec du seed Examens :', err.message);
  process.exit(1);
});
