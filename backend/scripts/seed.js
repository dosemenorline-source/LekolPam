// Script de seed — crée des comptes admin et direction (déjà vérifiés) pour dev/test.
// Usage : npm run seed
import bcrypt from 'bcryptjs';
import { pool } from '../src/config/db.js';

const COMPTES = [
  { nom: 'Secrétariat',  courriel: 'admin@lekol.ht',     motDePasse: 'admin1234',     role: 'admin' },
  { nom: 'Direction',    courriel: 'direction@lekol.ht', motDePasse: 'direction1234', role: 'direction' },
];

async function seed() {
  for (const c of COMPTES) {
    const [existant] = await pool.query('SELECT id FROM utilisateurs WHERE courriel = ?', [c.courriel]);
    if (existant.length) {
      console.log(`= ${c.courriel} existe déjà (ignoré)`);
      continue;
    }
    const hash = await bcrypt.hash(c.motDePasse, 12);
    await pool.query(
      'INSERT INTO utilisateurs (nom, courriel, mot_de_passe_hash, role, courriel_verifie) VALUES (?, ?, ?, ?, 1)',
      [c.nom, c.courriel, hash, c.role]
    );
    console.log(`+ ${c.role} créé : ${c.courriel} / ${c.motDePasse}`);
  }
  await pool.end();
  console.log('Seed terminé.');
}

seed().catch((err) => {
  console.error('Échec du seed :', err.message);
  process.exit(1);
});
