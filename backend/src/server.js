// Point d'entrée du serveur
import app from './app.js';
import { pool, testConnection } from './config/db.js';
import { installerSchemaSync } from './sync/schema.js';
import { demarrerWorkerSync, syncPosteConfigure } from './sync/worker.js';
import { verifierMailer } from './config/mailer.js';
import { verifierSms } from './config/sms.js';
import { verifierPlopplop, plopplopConfigure } from './config/plopplop.js';
import { verifierGoogleConfigure } from './config/googleAuth.js';
import { purgerAnciennesPresences } from './services/presence.service.js';
import { purgerJournal } from './services/securite.service.js';
import { purgerCodesAnciens } from './models/verificationCode.model.js';
import { reconcilierPaiementsMobilesEnAttente, annulerInscriptionsNonPayees } from './services/paiement.service.js';
import { migrerLogoEtBulletins } from './migrations/logoBulletins.js';
import dotenv from 'dotenv';

dotenv.config();

const PORT = process.env.PORT || 4000;
const UN_JOUR_MS = 24 * 60 * 60 * 1000;
const DEUX_MIN_MS = 2 * 60 * 1000;
const TRENTE_S_MS = 30 * 1000;

async function demarrer() {
  try {
    await testConnection();
    console.log('✔ Connexion MySQL établie.');

    // Mode POSTE (app de bureau hors ligne) : la base est locale et le compte
    // a tous les droits — on s'assure que le schéma de synchronisation est en
    // place (colonnes sync_id/sync_maj_le, déclencheurs, tables de support).
    // En mode nuage, ce schéma est posé par `npm run migrate:sync` (le compte
    // applicatif n'a pas le droit ALTER).
    if (syncPosteConfigure()) {
      await installerSchemaSync(pool);
      console.log('✔ Schéma de synchronisation local vérifié.');
    }

    await verifierMailer();
    verifierSms();
    verifierPlopplop();
    verifierGoogleConfigure();
    // Adresse d'écoute. En mode poste (app de bureau), on écoute UNIQUEMENT sur
    // 127.0.0.1 : le backend local ne doit JAMAIS être exposé au réseau de
    // l'école (sinon l'app et l'API seraient accessibles depuis tout appareil
    // du même Wi-Fi). Sur le nuage, HOST n'est pas défini → écoute sur toutes
    // les interfaces (requis par l'hébergeur).
    const HOST = process.env.HOST || (syncPosteConfigure() ? '127.0.0.1' : undefined);
    const serveur = app.listen(PORT, HOST, () => {
      console.log(`✔ Serveur Lekol Pam démarré sur http://${HOST || 'localhost'}:${PORT}`);
    });
    // Requêtes lentes coupées : 60 s max par requête (téléversements de 5 Mo
    // compris), en-têtes en 20 s — une connexion qui traîne (volontairement
    // ou non) ne doit pas occuper le serveur indéfiniment.
    serveur.requestTimeout = 60_000;
    serveur.headersTimeout = 20_000;

    // Migration ponctuelle (logo + régénération des bulletins) : ne fait rien
    // sauf si MIGRATION_LOGO_BULLETINS=run, et au plus une fois (marqueur en base).
    migrerLogoEtBulletins().catch((err) => console.error('Migration logo/bulletins échouée :', err.message));

    // Purge des vieux pointages de présence : au démarrage, puis une fois par jour.
    purgerAnciennesPresences().catch((err) => console.error('Purge présences échouée :', err.message));
    setInterval(() => {
      purgerAnciennesPresences().catch((err) => console.error('Purge présences échouée :', err.message));
      purgerJournal().catch((err) => console.error('Purge journal de sécurité échouée :', err.message));
      purgerCodesAnciens().catch((err) => console.error('Purge codes de vérification échouée :', err.message));
    }, UN_JOUR_MS);

    // Reconciliation des paiements mobiles en attente : plopplop n'a pas de
    // webhook (voir services/paiement.service.js), donc rien d'autre ne
    // détecte un paiement resté « en_attente » alors qu'il a fini par
    // aboutir côté MonCash/NatCash/KashPay sans que le parent ne revienne
    // sur le site. Toutes les ~2 minutes, comme recommandé pour ce fournisseur.
    // Dossiers d'inscription dont les frais n'ont pas été payés dans le délai
    // (DELAI_PAIEMENT_MINUTES) : annulés, ils n'atteignent jamais le secrétariat.
    setInterval(() => {
      annulerInscriptionsNonPayees().catch((err) => console.error('Annulation inscriptions impayées échouée :', err.message));
    }, TRENTE_S_MS);

    if (plopplopConfigure()) {
      setInterval(() => {
        reconcilierPaiementsMobilesEnAttente().catch((err) => console.error('Reconciliation paiements mobiles échouée :', err.message));
      }, DEUX_MIN_MS);
    }

    // Travailleur de synchronisation (app de bureau en mode « poste ») :
    // tire/pousse les modifs vers le nuage dès qu'une connexion est disponible.
    demarrerWorkerSync();
  } catch (err) {
    console.error('✖ Échec du démarrage — MySQL inaccessible :', err.message);
    process.exit(1);
  }
}

demarrer();
