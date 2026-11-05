// Journal de sécurité + alertes d'anomalie.
//
// tracer()  : enregistre un événement (connexion, échec, action sensible…)
//             dans journal_securite ET sur la sortie standard (logs Railway).
// alerter() : même chose au niveau « alerte », plus un courriel au(x)
//             destinataire(s) ALERTE_COURRIEL — au plus un courriel par type
//             d'alerte toutes les 15 minutes, pour ne pas inonder la boîte.
// compter() : détecte les rafales (ex. trop d'échecs de connexion ou
//             d'erreurs serveur en peu de temps) et déclenche une alerte.
//
// Rien ici ne doit jamais faire échouer la requête d'origine : toute erreur
// de journalisation est avalée (et affichée dans les logs).
import { pool } from '../config/db.js';
import { envoyerCourriel, courrielConfigure } from '../config/mailer.js';
import { creerProtection } from '../middleware/protectionBruteForce.js';

const DELAI_ALERTE_MS = 15 * 60 * 1000;
const derniereAlerte = new Map(); // type -> horodatage du dernier courriel
const rafales = new Map();        // cle -> [horodatages]

const tronquer = (v, n) => (v == null ? null : String(v).slice(0, n));

function ipDe(req) {
  return req?.ip || req?.socket?.remoteAddress || null;
}

async function enregistrer({ evenement, niveau, sujet, ip, details }) {
  const ligne = {
    securite: evenement, niveau, sujet: sujet || undefined, ip: ip || undefined,
    details: details || undefined, le: new Date().toISOString(),
  };
  (niveau === 'alerte' ? console.warn : console.log)(JSON.stringify(ligne));
  try {
    await pool.query(
      'INSERT INTO journal_securite (evenement, niveau, sujet, ip, details) VALUES (?, ?, ?, ?, ?)',
      [tronquer(evenement, 60), niveau, tronquer(sujet, 190), tronquer(ip, 64), tronquer(details, 1000)]
    );
  } catch (err) {
    console.error('Journal de sécurité indisponible :', err.message);
  }
}

// sujet : qui/quoi est concerné (courriel, identifiant, id de paiement…) —
// jamais un mot de passe, un code ni un secret.
export function tracer(evenement, { req, sujet, details } = {}) {
  enregistrer({ evenement, niveau: 'info', sujet, ip: ipDe(req), details }).catch(() => {});
}

function destinataires() {
  return (process.env.ALERTE_COURRIEL || '').split(',').map((s) => s.trim()).filter(Boolean);
}

export function alerter(type, message, { req, sujet } = {}) {
  enregistrer({ evenement: type, niveau: 'alerte', sujet, ip: ipDe(req), details: message }).catch(() => {});

  const a = destinataires();
  if (!a.length || !courrielConfigure()) return;
  const maintenant = Date.now();
  if (maintenant - (derniereAlerte.get(type) || 0) < DELAI_ALERTE_MS) return;
  derniereAlerte.set(type, maintenant);

  envoyerCourriel({
    to: a,
    subject: `[Lekòl Pam] Alerte sécurité : ${type}`,
    text: `${message}\n\n`
      + (sujet ? `Concerné : ${sujet}\n` : '')
      + (ipDe(req) ? `Adresse IP : ${ipDe(req)}\n` : '')
      + `Date : ${new Date().toISOString()}\n\n`
      + 'Détails dans la table journal_securite et les logs Railway. '
      + "Les alertes du même type sont regroupées (au plus une toutes les 15 minutes).",
  }).catch((err) => console.error('Courriel d\'alerte non envoyé :', err.message));
}

// Compte les occurrences de « cle » sur une fenêtre glissante ; au-delà du
// seuil, déclenche alerter(type, message).
export function compter(cle, { seuil, fenetreMs, type, message, req, sujet }) {
  const maintenant = Date.now();
  const liste = (rafales.get(cle) || []).filter((t) => maintenant - t < fenetreMs);
  liste.push(maintenant);
  rafales.set(cle, liste);
  if (liste.length >= seuil) {
    alerter(type, `${message} (${liste.length} en ${Math.round(fenetreMs / 60000)} min)`, { req, sujet });
    rafales.set(cle, []);
  }
}

// Échec d'identification : tracé + détection de rafale globale (attaque
// par dictionnaire répartie sur plusieurs comptes).
export function echecConnexion(espace, { req, sujet }) {
  tracer('connexion_echec', { req, sujet, details: espace });
  compter('echecs_connexion', {
    seuil: 30, fenetreMs: 10 * 60 * 1000, type: 'rafale_echecs_connexion',
    message: 'Nombre anormal d\'échecs de connexion', req,
  });
}

export function purgerJournal() {
  return pool.query('DELETE FROM journal_securite WHERE cree_le < (NOW() - INTERVAL 180 DAY)');
}

// ---------- Connexion des espaces admin (Économat, Vlog, Enseignants…) ----------
// Verrouillage par identifiant (en plus de la limite par IP) : 8 échecs en
// 15 minutes bloquent l'identifiant, quelle que soit l'adresse IP d'origine.

const protectionAdmin = creerProtection({ seuil: 8 });

export function adminBloque(espace, identifiant, req) {
  const cle = `admin:${espace}:${String(identifiant).toLowerCase()}`;
  if (!protectionAdmin.bloque(cle)) return false;
  alerter('admin_verrouille', `Accès admin « ${espace} » verrouillé après trop d'échecs`, { req, sujet: identifiant });
  return true;
}

export function adminEchec(espace, identifiant, req) {
  protectionAdmin.enregistrerEchec(`admin:${espace}:${String(identifiant).toLowerCase()}`);
  echecConnexion(`admin ${espace}`, { req, sujet: identifiant });
}

export function adminSucces(espace, identifiant, req) {
  protectionAdmin.reinitialiser(`admin:${espace}:${String(identifiant).toLowerCase()}`);
  tracer('connexion_admin', { req, sujet: identifiant, details: espace });
}
