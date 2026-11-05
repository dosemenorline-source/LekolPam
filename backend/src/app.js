// Configuration de l'application Express
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import MySQLStoreFactory from 'express-mysql-session';
import dotenv from 'dotenv';
import { configSsl } from './config/db.js';
import path from 'path';
import { fileURLToPath } from 'url';

import authRoutes from './routes/auth.routes.js';
import inscriptionRoutes from './routes/inscription.routes.js';
import notesRoutes from './routes/notes.routes.js';
import paiementRoutes from './routes/paiement.routes.js';
import vlogRoutes from './routes/vlog.routes.js';
import professeurRoutes from './routes/professeur.routes.js';
import aproposRoutes from './routes/apropos.routes.js';
import academieRoutes from './routes/academie.routes.js';
import examensRoutes from './routes/examens.routes.js';
import direstatsRoutes from './routes/direction.routes.js';
import permissionsRoutes from './routes/permissions.routes.js';
import invitationEleveRoutes from './routes/invitationEleve.routes.js';
import reinscriptionRoutes from './routes/reinscription.routes.js';
import archiveRoutes from './routes/archive.routes.js';
import importRoutes from './routes/import.routes.js';
import contactMessageRoutes from './routes/contactMessage.routes.js';
import presenceRoutes from './routes/presence.routes.js';
import ancienEleveRoutes from './routes/ancienEleve.routes.js';
import annonceRoutes from './routes/annonce.routes.js';
import enseignantRoutes from './routes/enseignant.routes.js';
import syncRoutes from './routes/sync.routes.js';
import syncAdminRoutes from './routes/syncAdmin.routes.js';
import { requireAuth } from './middleware/auth.js';
import { enregistrerErreur } from './config/etatServeur.js';
import { compter } from './services/securite.service.js';
import { PAGES_SEO } from './config/seoPages.js';
import { lister as listerVlog } from './models/vlog.model.js';
import fs from 'fs';

dotenv.config();

// Identifiants d'URL (:id, :idMatiere) : entier positif uniquement — une
// valeur comme « abc », « 1.5 » ou « 1 OR 1=1 » est refusée avant d'atteindre
// un contrôleur (qui ferait sinon Number('abc') → NaN → requête incohérente).
function validerIdentifiant(req, res, next, valeur) {
  if (/^[1-9]\d{0,9}$/.test(valeur) && Number(valeur) <= 2147483647) return next();
  return res.status(400).json({ erreur: 'Identifiant invalide.' });
}
for (const routeur of [
  authRoutes, inscriptionRoutes, notesRoutes, paiementRoutes, vlogRoutes, professeurRoutes,
  aproposRoutes, academieRoutes, examensRoutes, direstatsRoutes, permissionsRoutes,
  contactMessageRoutes, presenceRoutes, ancienEleveRoutes, annonceRoutes, enseignantRoutes,
  syncAdminRoutes,
]) {
  routeur.param('id', validerIdentifiant);
  routeur.param('idMatiere', validerIdentifiant);
}

const app = express();
const isProd = process.env.NODE_ENV === 'production';
// Frontend et backend sur des domaines différents (ex. frontend Vercel +
// backend Render) : le cookie de session passe en SameSite=None; Secure.
const crossSite = process.env.CROSS_SITE === 'true';

// Échoue au démarrage plutôt que de signer les sessions avec le secret de dev
// connu (visible dans le dépôt) — une session forgée avec ce secret serait
// acceptée par le serveur comme légitime.
if (isProd && !process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET manquant en production — configurez cette variable avant de démarrer.');
}

// Confiance au proxy (utile derrière un reverse proxy en production)
if (isProd) app.set('trust proxy', 1);

// En-têtes de sécurité (HSTS, X-Content-Type-Options, X-Frame-Options, retrait
// de X-Powered-By, etc.), avec CSP active. Surface externe du frontend
// auditée : aucun CDN/police externe, un seul script tiers (Google Identity
// Services). Le frontend utilise des styles inline React (style={{...}}) sur
// de nombreux composants — d'où 'unsafe-inline' sur styleSrc, seule
// concession nécessaire (aucun script inline dans le build, scriptSrc reste
// strict).
// crossOriginOpenerPolicy : le défaut d'helmet ('same-origin') coupe la
// référence window.opener sur toute fenêtre pop-up cross-origin — ce qui casse
// précisément la communication postMessage utilisée par Google Identity
// Services (bouton « Se connecter avec Google »). 'same-origin-allow-popups'
// garde l'isolation pour le reste, sans casser ce flux.
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", 'https://accounts.google.com'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://accounts.google.com'],
      imgSrc: ["'self'", 'data:'],
      fontSrc: ["'self'"],
      connectSrc: ["'self'", 'https://accounts.google.com'],
      frameSrc: ['https://accounts.google.com'],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  },
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
}));

// Fonctions du navigateur : caméra réservée au site lui-même (scan des badges
// QR), tout le reste coupé — un script injecté ne pourrait pas y accéder.
app.use((req, res, next) => {
  res.setHeader('Permissions-Policy',
    'camera=(self), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()');
  next();
});

// Corps JSON limité (aucun formulaire n'envoie plus de quelques Ko ; les
// fichiers passent par multer, avec sa propre limite de 5 Mo).
app.use(express.json({ limit: '100kb', strict: true }));
app.use(cookieParser());
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
    credentials: true, // autorise l'envoi des cookies de session
  })
);

// Mode maintenance — un seul interrupteur (MAINTENANCE_MODE=true), activable/
// désactivable sans redéploiement. Bloque TOUT LE MONDE sans exception, y
// compris le personnel déjà connecté : placé avant la session, il ne dépend
// d'aucun état d'authentification. /api/health reste exclu — c'est la sonde
// de santé de l'hébergeur, pas un visiteur ; la bloquer ferait croire au
// service qu'il est en panne et déclencherait un redémarrage inutile.
const maintenanceActif = () => (process.env.MAINTENANCE_MODE || '').trim() === 'true';
const PAGE_MAINTENANCE = `<!doctype html>
<html lang="fr">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Lekòl Pam — An antretyen</title>
<style>
  body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
    background:linear-gradient(160deg,#1A365D 0%,#2B4C7E 100%);
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
    color:#fff; padding:1.5rem; box-sizing:border-box; text-align:center; }
  .carte { max-width:440px; }
  .icone { font-size:3rem; margin-bottom:1rem; }
  h1 { font-size:1.4rem; margin:0 0 .75rem; }
  p { color:#CBD5E0; line-height:1.6; margin:0; }
</style>
</head>
<body>
  <div class="carte">
    <div class="icone">🛠️</div>
    <h1>Sit la an antretyen pou kounye a</h1>
    <p>Nou ap fè kèk amelyorasyon. Tanpri repase talè oswa demen. Mèsi pou pasyans ou.</p>
  </div>
</body>
</html>`;

app.use((req, res, next) => {
  if (!maintenanceActif() || req.path === '/api/health') return next();
  if (req.path.startsWith('/api/')) {
    return res.status(503).json({ erreur: 'Sit la an antretyen pou kounye a. Tanpri repase pita.' });
  }
  res.status(503).set('Content-Type', 'text/html').send(PAGE_MAINTENANCE);
});

// Synchronisation MACHINE (postes de bureau hors ligne ↔ nuage) : monté ICI,
// avant le parseur JSON global (limité à 100 Ko), car un lot de synchronisation
// peut être plus gros ; ce routeur a son propre parseur (5 Mo) et sa propre
// authentification par jeton (pas de session ni de cookie). Placé après le
// gardien de maintenance : la synchro est elle aussi suspendue en maintenance.
app.use('/api/sync', syncRoutes);

// Store de session dans MySQL
const MySQLStore = MySQLStoreFactory(session);
const sessionStore = new MySQLStore({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'lekol_pam',
  ssl: configSsl(), // TLS pour un MySQL managé (TiDB/Aiven), comme le pool principal
  // Table créée par schema.sql / migration 037 : le compte MySQL de
  // l'application n'a pas le droit CREATE (droits réduits au strict CRUD).
  createDatabaseTable: false,
});

app.use(
  session({
    name: 'lk.sid',
    secret: process.env.SESSION_SECRET || 'dev-secret-a-changer',
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true, // inaccessible au JavaScript côté client
      // Quand le frontend (ex. Vercel) et le backend (ex. Render) sont sur des
      // domaines DIFFÉRENTS, le cookie de session doit être SameSite=None +
      // Secure pour être envoyé avec les requêtes cross-site (CROSS_SITE=true).
      // Sinon (même origine), on garde Lax, plus strict.
      secure: isProd || crossSite,
      sameSite: crossSite ? 'none' : 'lax',
      maxAge: 1000 * 60 * 60 * 8, // 8 heures
    },
  })
);

// Santé
app.get('/api/health', (req, res) => res.json({ statut: 'ok' }));

// Auth
app.use('/api/auth', authRoutes);

// Module Inscription
app.use('/api', inscriptionRoutes);

// Module Notes & Bulletins
app.use('/api', notesRoutes);

// Module Paiements
app.use('/api', paiementRoutes);

// Module Vlog (système indépendant)
app.use('/api', vlogRoutes);

// Module Corps enseignant (système indépendant)
app.use('/api', professeurRoutes);

// Module « À propos » (système indépendant)
app.use('/api', aproposRoutes);

// Module « Académie » (système indépendant)
app.use('/api', academieRoutes);

// Module « Examens passés » (système indépendant)
app.use('/api', examensRoutes);

// Statistiques direction (santé serveur + évolution)
app.use('/api', direstatsRoutes);

// Permissions gérées par le propriétaire
app.use('/api', permissionsRoutes);

// Invitations élève (codes d'accès à l'auto-inscription) — personnel de l'école
app.use('/api', invitationEleveRoutes);

// Ré-inscription de fin d'année (parent + propriétaire)
app.use('/api', reinscriptionRoutes);

// Archive de documents anciens (Économat / Secrétariat / Direction)
app.use('/api', archiveRoutes);

// Import de données depuis un tableur (Excel/CSV) avec correspondance de colonnes
app.use('/api', importRoutes);

// Formulaire de contact public + boîte de réception (propriétaire)
app.use('/api', contactMessageRoutes);

// Présence quotidienne (scan du QR du badge)
app.use('/api', presenceRoutes);

// Anciens élèves : saisie historique + demandes d'accès
app.use('/api', ancienEleveRoutes);

// Annonces SMS groupées (admin/direction/propriétaire)
app.use('/api', annonceRoutes);

// Professeurs : comptes (direction), devoirs/documents/horaires (professeur + élève)
app.use('/api', enseignantRoutes);

// Gestion des postes de synchronisation (propriétaire) — enregistrer/révoquer
// les postes de bureau autorisés à se synchroniser.
app.use('/api', syncAdminRoutes);

// Exemple de route protégée par rôle (utilisée pour vérifier le contrôle d'accès)
import { requireRole } from './middleware/auth.js';
app.get('/api/admin/ping', requireRole('admin', 'direction'), (req, res) =>
  res.json({ message: 'Accès admin autorisé.' })
);

// Route protégée simple (tout utilisateur connecté)
app.get('/api/prive/ping', requireAuth, (req, res) =>
  res.json({ message: 'Accès autorisé.', role: req.session.role })
);

// ---------- Frontend (SPA) servi par le même serveur ----------
// En production, on sert le build React (frontend/dist) depuis Express :
// une seule origine → les cookies de session fonctionnent sans réglage cross-site.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, '../../frontend/dist');
const indexPath = path.join(distDir, 'index.html');
const indexTemplate = fs.existsSync(indexPath) ? fs.readFileSync(indexPath, 'utf-8') : null;

app.use(express.static(distDir));

// Toute route non-API renvoie index.html (routage côté client React Router).
// Pour les pages publiques connues (voir seoPages.js), on injecte un
// <title>/<meta> propre à la page dans le HTML brut — indispensable pour les
// aperçus WhatsApp/Facebook, qui n'exécutent pas le JavaScript React.
app.get(/^\/(?!api\/).*/, async (req, res, next) => {
  const meta = PAGES_SEO[req.path];
  if (!meta || !indexTemplate) {
    return res.sendFile(indexPath, (err) => { if (err) next(); });
  }

  try {
    let html = indexTemplate
      .replace(/<title>[^<]*<\/title>/, `<title>${meta.titre}</title>`)
      .replace(/<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${meta.description}" />`)
      .replace(/<meta property="og:title" content="[^"]*" \/>/, `<meta property="og:title" content="${meta.titre}" />`)
      .replace(/<meta property="og:description" content="[^"]*" \/>/, `<meta property="og:description" content="${meta.description}" />`)
      .replace(/<meta property="og:url" content="[^"]*" \/>/, `<meta property="og:url" content="https://lekolpam.online${req.path}" />`);

    // Image de partage : par défaut le logo (voir index.html), remplacé par la
    // dernière publication du vlog qui en a une sur cette page précise.
    if (req.path === '/vlog') {
      const publications = await listerVlog();
      const avecPhoto = publications.find((p) => p.photo_url);
      if (avecPhoto) {
        html = html.replace(/<meta property="og:image" content="[^"]*" \/>/, `<meta property="og:image" content="https://lekolpam.online/api/vlog/${avecPhoto.id}/photo" />`);
      }
    }

    res.set('Content-Type', 'text/html');
    return res.send(html);
  } catch (err) {
    next(err);
  }
});

// Gestion des erreurs
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  // Erreurs de requête (JSON malformé, corps trop volumineux…) : faute du
  // client, pas du serveur — réponse 4xx sans détail interne ni alerte.
  if (err && err.status >= 400 && err.status < 500) {
    return res.status(err.status).json({
      erreur: err.status === 413 ? 'Requête trop volumineuse.' : 'Requête invalide.',
    });
  }
  console.error(err);
  enregistrerErreur(err);
  compter('erreurs_serveur', {
    seuil: 15, fenetreMs: 5 * 60 * 1000, type: 'rafale_erreurs_serveur',
    message: `Nombre anormal d'erreurs serveur (dernière : ${req.method} ${req.path} — ${err.message})`, req,
  });
  res.status(500).json({ erreur: 'Erreur interne du serveur.' });
});

export default app;
