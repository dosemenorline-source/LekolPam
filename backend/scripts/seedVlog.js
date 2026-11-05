// Seed — crée un compte admin du vlog (système indépendant).
// Usage : npm run seed:vlog
import bcrypt from 'bcryptjs';
import { pool } from '../src/config/db.js';

const IDENTIFIANT = 'vlogadmin';
const MOT_DE_PASSE = 'vlog1234';

async function seed() {
  const [existant] = await pool.query('SELECT id FROM vlog_admins WHERE identifiant = ?', [IDENTIFIANT]);
  if (existant.length) {
    console.log(`= ${IDENTIFIANT} existe déjà (ignoré)`);
  } else {
    const hash = await bcrypt.hash(MOT_DE_PASSE, 12);
    await pool.query('INSERT INTO vlog_admins (identifiant, mot_de_passe_hash) VALUES (?, ?)', [IDENTIFIANT, hash]);
    console.log(`+ admin vlog créé : ${IDENTIFIANT} / ${MOT_DE_PASSE}`);
  }
  await pool.end();
  console.log('Seed vlog terminé.');
}

seed().catch((err) => {
  console.error('Échec du seed vlog :', err.message);
  process.exit(1);
});
