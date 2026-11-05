// Configuration de l'envoi de SMS (API Textbelt, via fetch)
// Miroir de mailer.js : appel HTTPS direct plutôt qu'un SDK, échec explicite
// si mal configuré plutôt qu'un faux succès silencieux.
import dotenv from 'dotenv';

dotenv.config();

const API_URL = 'https://textbelt.com/text';
const DELAI_MS = 10_000;

function cleApi() {
  return (process.env.TEXTBELT_API_KEY || '').trim();
}

// Indique si la clé est présente.
export function smsConfigure() {
  return Boolean(cleApi());
}

// Nettoie un numéro saisi librement par un parent (espaces, tirets) et
// préfixe l'indicatif Haïti (509) si absent sur un numéro local à 8 chiffres.
export function normaliserNumero(brut) {
  const chiffres = String(brut || '').replace(/[^\d]/g, '');
  if (!chiffres) return null;
  if (chiffres.length === 8) return `509${chiffres}`;
  return chiffres;
}

// Vérifie qu'une clé API est présente au démarrage. Ne fait pas d'appel réseau.
export function verifierSms() {
  if (smsConfigure()) {
    console.log('✔ SMS configuré — envoi via l\'API Textbelt.');
    return true;
  }
  console.warn('⚠ SMS INACTIF : TEXTBELT_API_KEY manquant dans backend/.env.');
  return false;
}

// Envoie un SMS. Lève une erreur explicite si la clé est absente ou si
// Textbelt refuse l'envoi (numéro invalide, quota épuisé, restriction
// régionale de la clé, etc.).
export async function envoyerSms({ to, texte }) {
  const cle = cleApi();
  if (!cle) {
    throw new Error('Textbelt non configuré : renseignez TEXTBELT_API_KEY dans backend/.env.');
  }

  const numero = normaliserNumero(to);
  if (!numero) throw new Error('Numéro de téléphone manquant ou invalide.');

  const controleur = new AbortController();
  const minuteur = setTimeout(() => controleur.abort(), DELAI_MS);
  try {
    const params = new URLSearchParams({ phone: `+${numero}`, message: texte, key: cle });
    const reponse = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
      signal: controleur.signal,
    });
    const corps = await reponse.json().catch(() => ({}));
    if (!reponse.ok || !corps.success) {
      throw new Error(corps.error || `Textbelt a répondu ${reponse.status}`);
    }

    console.log(`✉ SMS envoyé à +${numero}`);
    return { messageId: corps.textId };
  } finally {
    clearTimeout(minuteur);
  }
}
