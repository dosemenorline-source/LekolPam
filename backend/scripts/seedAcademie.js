// Seed — crée un compte admin de la section « Académie » (système indépendant).
// Usage : npm run seed:academie
import bcrypt from 'bcryptjs';
import { pool } from '../src/config/db.js';

const IDENTIFIANT = 'academieadmin';
const MOT_DE_PASSE = 'academie1234';

async function seed() {
  const [existant] = await pool.query('SELECT id FROM academie_admins WHERE identifiant = ?', [IDENTIFIANT]);
  if (existant.length) {
    console.log(`= ${IDENTIFIANT} existe déjà (ignoré)`);
  } else {
    const hash = await bcrypt.hash(MOT_DE_PASSE, 12);
    await pool.query('INSERT INTO academie_admins (identifiant, mot_de_passe_hash) VALUES (?, ?)', [IDENTIFIANT, hash]);
    console.log(`+ admin Académie créé : ${IDENTIFIANT} / ${MOT_DE_PASSE}`);
  }
  await pool.end();
  console.log('Seed Académie terminé.');
}

seed().catch((err) => {
  console.error('Échec du seed Académie :', err.message);
  process.exit(1);
});
