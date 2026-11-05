// Configuration Connexion Google — vérification du jeton d'identité (ID token)
// envoyé par le bouton « Se connecter avec Google » côté client (Google
// Identity Services). Contrairement à mailer.js/sms.js/plopplop.js, on utilise
// ici la bibliothèque officielle Google plutôt qu'un appel fetch brut : vérifier
// soi-même une signature JWT (récupération des clés publiques tournantes de
// Google, contrôle de l'émetteur/l'audience/l'expiration...) serait risqué à
// reproduire correctement à la main pour une porte d'authentification.
import { OAuth2Client } from 'google-auth-library';
import dotenv from 'dotenv';

dotenv.config();

function clientId() {
  return (process.env.GOOGLE_CLIENT_ID || '').trim();
}

// Indique si l'intégration est configurée. Peut être renvoyé publiquement au
// client : le client_id Google n'est pas un secret (il est visible dans le
// bouton lui-même une fois affiché).
export function googleAuthConfigure() {
  return Boolean(clientId());
}

// Le client_id lui-même n'est pas un secret (il apparaît dans le bouton une
// fois affiché) : peut être renvoyé tel quel au frontend.
export function clientIdPublic() {
  return googleAuthConfigure() ? clientId() : null;
}

let client = null;
function clientOAuth() {
  if (!client) client = new OAuth2Client(clientId());
  return client;
}

export function verifierGoogleConfigure() {
  if (googleAuthConfigure()) {
    console.log('✔ Connexion Google configurée.');
    return true;
  }
  console.warn('⚠ Connexion Google INACTIVE : GOOGLE_CLIENT_ID manquant dans backend/.env.');
  return false;
}

// Vérifie un ID token Google (JWT envoyé par la bibliothèque cliente après
// connexion). Retourne { googleId, courriel, courrielVerifie, nom } si valide,
// lève une erreur explicite sinon (signature invalide, audience différente,
// jeton expiré...).
const DELAI_MS = 10_000;

export async function verifierIdTokenGoogle(idToken) {
  const id = clientId();
  if (!id) {
    throw new Error('Connexion Google non configurée : renseignez GOOGLE_CLIENT_ID dans backend/.env.');
  }
  // Délai borné : la vérification télécharge les certificats Google — une
  // lenteur réseau ne doit pas bloquer la requête indéfiniment.
  let minuteur;
  const delai = new Promise((_, rejeter) => {
    minuteur = setTimeout(() => rejeter(new Error('Délai dépassé pour la vérification Google.')), DELAI_MS);
  });
  const ticket = await Promise.race([clientOAuth().verifyIdToken({ idToken, audience: id }), delai])
    .finally(() => clearTimeout(minuteur));
  const payload = ticket.getPayload();
  if (!payload || !payload.sub || !payload.email) {
    throw new Error('Jeton Google invalide.');
  }
  return {
    googleId: payload.sub,
    courriel: String(payload.email).trim().toLowerCase(),
    courrielVerifie: !!payload.email_verified,
    nom: payload.name || payload.email,
  };
}
