// Configuration WebAuthn / passkeys (connexion biométrique : Face ID, Touch ID,
// Windows Hello, empreinte). Le navigateur choisit automatiquement le capteur
// disponible sur l'appareil — rien de spécifique à Apple côté serveur.
//
// - rpID  : le DOMAINE du site (sans protocole ni port). Doit correspondre à
//           l'hôte de la page, sinon le navigateur refuse. En prod :
//           lekolpam.online ; en dev : localhost.
// - origins : la ou les origines complètes autorisées (protocole + hôte + port).
//
// Surchargables par variables d'environnement pour ne rien coder en dur :
//   WEBAUTHN_RP_ID       (ex. lekolpam.online)
//   WEBAUTHN_ORIGINS     (liste séparée par des virgules)
//   WEBAUTHN_RP_NAME     (nom affiché dans la fenêtre système)
import dotenv from 'dotenv';

dotenv.config();

const isProd = process.env.NODE_ENV === 'production';

export const RP_NAME = (process.env.WEBAUTHN_RP_NAME || 'Lekòl Pam').trim();

export const RP_ID = (process.env.WEBAUTHN_RP_ID
  || (isProd ? 'lekolpam.online' : 'localhost')).trim();

// Origines acceptées à la vérification. En prod on autorise le domaine avec et
// sans « www » (le rpID « lekolpam.online » couvre les deux sous-domaines).
export const ORIGINS = (process.env.WEBAUTHN_ORIGINS
  || (isProd
    ? 'https://lekolpam.online,https://www.lekolpam.online'
    : 'http://localhost:5173'))
  .split(',').map((o) => o.trim()).filter(Boolean);

// Base64url <-> octets (les clés/identifiants WebAuthn voyagent en base64url).
export const versB64url = (octets) => Buffer.from(octets).toString('base64url');
export const depuisB64url = (chaine) => new Uint8Array(Buffer.from(chaine, 'base64url'));
