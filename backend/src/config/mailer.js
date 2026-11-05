// Configuration de l'envoi de courriels (API Resend, via fetch)
// Les courriels partent réellement vers la boîte du destinataire. Aucun mode
// « bac à sable » : si l'API n'est pas configurée, l'envoi échoue explicitement
// plutôt que de faire croire que le courriel est parti.
//
// L'API HTTPS est utilisée plutôt que le relais SMTP : certains hébergeurs
// (dont Railway, observé en pratique) bloquent ou ralentissent fortement les
// connexions sortantes sur le port SMTP, ce qui faisait échouer le démarrage
// du serveur. Le port 443 (HTTPS) est lui toujours ouvert.
import dotenv from 'dotenv';

dotenv.config();

const API_URL = 'https://api.resend.com';
const DELAI_MS = 10_000;

function cleAPI() {
  return (process.env.RESEND_API_KEY || '').trim();
}

// Indique si une clé API est présente. Ne dépend d'aucun compte : le résultat
// peut donc être renvoyé au client sans révéler si un courriel existe en base.
export function courrielConfigure() {
  return Boolean(cleAPI());
}

function expediteur() {
  return process.env.MAIL_FROM || 'Lekòl Pam <onboarding@resend.dev>';
}

async function appelAPI(chemin, options) {
  const cle = cleAPI();
  if (!cle) {
    throw new Error(
      'Resend non configuré : renseignez RESEND_API_KEY dans backend/.env. '
      + 'Clé disponible sur https://resend.com → API Keys.',
    );
  }

  const controleur = new AbortController();
  const minuteur = setTimeout(() => controleur.abort(), DELAI_MS);
  try {
    const reponse = await fetch(`${API_URL}${chemin}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${cle}`,
        'Content-Type': 'application/json',
        ...(options?.headers || {}),
      },
      signal: controleur.signal,
    });
    const corps = await reponse.json().catch(() => ({}));
    if (!reponse.ok) {
      throw new Error(corps.message || `Resend a répondu ${reponse.status}`);
    }
    return corps;
  } finally {
    clearTimeout(minuteur);
  }
}

// Vérifie qu'une clé API est présente au démarrage. Ne fait pas d'appel réseau :
// les clés Resend « envoi seul » n'ont pas accès aux routes de lecture (ex.
// /domains), donc les y appeler donnerait un faux « inactif » alors que
// l'envoi fonctionne. La validité réelle de la clé se confirme au premier
// envoi (voir envoyerCourriel). Ne fait jamais tomber le serveur : le reste
// du site doit fonctionner même si le courriel est mal configuré.
export async function verifierMailer() {
  if (courrielConfigure()) {
    console.log(`✔ Courriel configuré — envoi via l'API Resend (${expediteur()}).`);
    return true;
  }
  console.warn('⚠ Courriel INACTIF : RESEND_API_KEY manquante dans backend/.env.');
  console.warn('  Les codes de vérification ne partiront pas tant que ce point n\'est pas réglé.');
  return false;
}

// Envoie un courriel. `previewUrl` est toujours null (plus d'aperçu bac à
// sable) : les appelants qui l'exposent encore ne montreront simplement rien.
// `attachments` (optionnel) : [{ filename, content }] — content en base64.
export async function envoyerCourriel({ to, subject, text, html, attachments }) {
  const corps = await appelAPI('/emails', {
    method: 'POST',
    body: JSON.stringify({
      from: expediteur(), to, subject, text, html,
      ...(attachments?.length ? { attachments } : {}),
    }),
  });

  console.log(`✉ Courriel envoyé à ${to} — ${subject}`);
  return { messageId: corps.id, previewUrl: null };
}
