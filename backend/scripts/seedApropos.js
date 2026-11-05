// Seed — crée un compte admin de la page « À propos » (système indépendant).
// Usage : npm run seed:apropos
import bcrypt from 'bcryptjs';
import { pool } from '../src/config/db.js';

const IDENTIFIANT = 'aproposadmin';
const MOT_DE_PASSE = 'apropos1234';

async function seed() {
  const [existant] = await pool.query('SELECT id FROM apropos_admins WHERE identifiant = ?', [IDENTIFIANT]);
  if (existant.length) {
    console.log(`= ${IDENTIFIANT} existe déjà (ignoré)`);
  } else {
    const hash = await bcrypt.hash(MOT_DE_PASSE, 12);
    await pool.query('INSERT INTO apropos_admins (identifiant, mot_de_passe_hash) VALUES (?, ?)', [IDENTIFIANT, hash]);
    console.log(`+ admin À propos créé : ${IDENTIFIANT} / ${MOT_DE_PASSE}`);
  }
  await pool.end();
  console.log('Seed À propos terminé.');
}

seed().catch((err) => {
  console.error('Échec du seed À propos :', err.message);
  process.exit(1);
});
