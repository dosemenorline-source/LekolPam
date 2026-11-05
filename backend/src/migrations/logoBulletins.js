// Migration ponctuelle : installe le logo transparent de l'école, puis
// régénère tous les bulletins publiés (nouveau format avec logo) et renvoie
// le courriel aux parents avec le PDF en pièce jointe.
//
// Déclenchée UNIQUEMENT quand la variable d'environnement
// MIGRATION_LOGO_BULLETINS vaut « run », et exécutée AU PLUS UNE FOIS : un
// marqueur en base (table migrations_ponctuelles) empêche tout renvoi de
// courriel à un redémarrage, même si la variable reste positionnée.
//
// Elle s'exécute sur le serveur (accès au volume uploads) — pas en local.
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from '../config/db.js';
import { UPLOAD_ROOT } from '../config/upload.js';
import { mettreLogo } from '../models/ecole.model.js';
import { lister as listerPublications } from '../models/publication.model.js';
import { publier } from '../services/publication.service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLE = 'logo_bulletins_v1';
const LOGO_SOURCE = path.join(__dirname, '..', '..', 'assets', 'lekol-pam-logo.png');

async function dejaFaite() {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS migrations_ponctuelles (
       cle VARCHAR(80) PRIMARY KEY,
       faite_le DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
     ) ENGINE=InnoDB`
  );
  const [rows] = await pool.query('SELECT 1 FROM migrations_ponctuelles WHERE cle = ? LIMIT 1', [CLE]);
  return rows.length > 0;
}

async function installerLogo() {
  const octets = await fs.readFile(LOGO_SOURCE);
  const dossier = path.join(UPLOAD_ROOT, 'logos');
  await fs.mkdir(dossier, { recursive: true });
  const nom = `logo-ecole-${Date.now()}.png`;
  await fs.writeFile(path.join(dossier, nom), octets);
  await mettreLogo(`logos/${nom}`);
  return `logos/${nom}`;
}

export async function migrerLogoEtBulletins() {
  if ((process.env.MIGRATION_LOGO_BULLETINS || '').trim() !== 'run') return;
  try {
    if (await dejaFaite()) {
      console.log('↷ Migration logo/bulletins déjà effectuée — ignorée.');
      return;
    }
    console.log('▶ Migration logo/bulletins : démarrage…');

    const logoUrl = await installerLogo();
    console.log(`✔ Logo installé (${logoUrl}).`);

    const publications = await listerPublications();
    let total = 0;
    for (const p of publications) {
      const r = await publier({
        niveau: p.niveau,
        anneeScolaire: p.annee_scolaire,
        trimestre: p.trimestre,
        idDirection: p.publie_par || null,
        regenerer: true,
        forcerNotification: true,
      });
      const n = (r?.nbBulletins || 0);
      total += n;
      console.log(`✔ ${p.niveau} / ${p.trimestre} / ${p.annee_scolaire} : ${n} bulletin(s) régénéré(s) et notifié(s).`);
    }

    // Marqueur : la migration ne se rejouera plus (pas de re-envoi de courriel).
    await pool.query('INSERT INTO migrations_ponctuelles (cle) VALUES (?)', [CLE]);
    console.log(`✅ Migration logo/bulletins terminée : ${total} bulletin(s) au total. `
      + 'Retirez la variable MIGRATION_LOGO_BULLETINS.');
  } catch (err) {
    // On ne bloque jamais le démarrage du serveur : l'erreur est tracée, la
    // migration pourra être relancée (le marqueur n'est écrit qu'en cas de succès).
    console.error('✖ Migration logo/bulletins échouée :', err.message);
  }
}
