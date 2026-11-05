// Service — présence quotidienne (scan du QR du badge, déjà imprimé sur
// chaque carte : il encode /eleve?code=<code_acces>, réutilisé tel quel).
// Deux sens de scan : entrée (arrivée à l'école) et sortie (départ).
import {
  marquerEntree, marquerSortie, trouverDuJour,
  supprimerAujourdhui, supprimerAvant,
} from '../models/presence.model.js';
import { trouverParCode, trouverAvecProprietaire } from '../models/eleve.model.js';
import { envoyerCourriel } from '../config/mailer.js';
import {
  clientIA, iaConfiguree, MODELE_IA, MARQUEUR_ELEVE, MARQUEUR_PARENT, CONSIGNE_MARQUEURS, restaurerMarqueurs,
} from '../config/ia.js';
import { echapperHtml } from '../utils/html.js';

const FUSEAU = 'America/Port-au-Prince';
const RETENTION_JOURS = Number(process.env.PRESENCE_RETENTION_JOURS) || 90;
const heureActuelle = () => new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: FUSEAU });

// Message direct de 5 phrases envoyé au parent — rédigé par l'IA (Groq) quand
// elle est configurée, sinon un message factuel fixe (5 phrases aussi, pour
// rester cohérent). Ne bloque jamais l'envoi : un échec IA retombe
// silencieusement sur le repli.
async function genererMessagePresence({ type, eleveNom, heure }) {
  const fallback = type === 'entree'
    ? `${eleveNom} est arrivé(e) à l'école aujourd'hui à ${heure}. `
      + `Son entrée a été enregistrée par le système de présence. `
      + `Vous recevrez un second message lorsque ${eleveNom} quittera l'école. `
      + `Si cette heure vous semble incorrecte, contactez le secrétariat. `
      + `Merci de votre confiance envers Lekòl Pam.`
    : `${eleveNom} a quitté l'école aujourd'hui à ${heure}. `
      + `Son départ a été enregistré par le système de présence. `
      + `Assurez-vous qu'il/elle rentre en sécurité. `
      + `Si cette heure vous semble incorrecte, contactez le secrétariat. `
      + `Merci de votre confiance envers Lekòl Pam.`;

  if (!iaConfiguree()) return fallback;
  try {
    const client = clientIA();
    const completion = await client.chat.completions.create({
      model: MODELE_IA,
      temperature: 0.4,
      max_tokens: 220,
      messages: [
        {
          role: 'system',
          content: "Tu rédiges, au nom de l'école « Lekòl Pam », un message direct de CINQ PHRASES COURTES (ni plus, ni moins) pour informer un parent par courriel. Pas de salutation, pas de signature — juste l'information, phrase par phrase : l'élève est arrivé(e) à l'école OU en est reparti(e) à l'heure donnée, que l'événement a été enregistré par le système, une note pertinente au contexte (rappel du prochain message pour une arrivée, rappel de sécurité du trajet du retour pour un départ), une invitation à contacter le secrétariat en cas d'erreur, et une formule de clôture brève. Ton chaleureux mais direct, sans superflu. N'invente aucune information (pas de nom de personnel, pas de numéro de téléphone). Pas d'emojis, pas de liste à puces — cinq phrases en un seul paragraphe. " + CONSIGNE_MARQUEURS,
        },
        {
          role: 'user',
          content: `Élève : ${MARQUEUR_ELEVE}.\nÉvénement : ${type === 'entree' ? "arrivée à l'école" : "départ de l'école"}.\nHeure : ${heure}.\nRédige les cinq phrases.`,
        },
      ],
    });
    const texte = restaurerMarqueurs((completion.choices?.[0]?.message?.content || '').trim(), { eleve: eleveNom });
    return texte || fallback;
  } catch (err) {
    console.error('Message présence IA échoué :', err.message);
    return fallback;
  }
}

async function notifierParent(prop, texte, sujet) {
  if (!prop?.parent_courriel) return;
  try {
    await envoyerCourriel({
      to: prop.parent_courriel,
      subject: sujet,
      text: `Bonjour ${prop.parent_nom || ''},\n\n${texte}\n\nCeci est un message automatique.`,
      html: `<p>Bonjour ${echapperHtml(prop.parent_nom || '')},</p><p>${echapperHtml(texte)}</p>`
        + `<p style="color:#888;font-size:.85em">Ceci est un message automatique.</p>`,
    });
  } catch (err) {
    console.error('Notification présence échouée :', err.message);
  }
}

// Marque une entrée ou une sortie à partir du code scanné (le paramètre
// ?code= du QR du badge). Notifie le parent par courriel uniquement au
// premier scan de chaque sens (idempotent : un re-scan ne renvoie rien).
export async function marquerPresenceParCode({ code, type, idAdmin }) {
  if (type !== 'entree' && type !== 'sortie') {
    return { ok: false, code: 400, erreur: "type doit être 'entree' ou 'sortie'." };
  }

  const base = await trouverParCode((code || '').trim());
  if (!base) return { ok: false, code: 404, erreur: 'Code introuvable — ce badge ne correspond à aucun élève.' };

  if (type === 'sortie') {
    const duJour = await trouverDuJour(base.id);
    if (!duJour) {
      return { ok: false, code: 409, erreur: "Cet élève n'a pas encore été pointé présent aujourd'hui — impossible d'enregistrer une sortie." };
    }
  }

  const nouveau = type === 'entree' ? await marquerEntree(base.id, idAdmin) : await marquerSortie(base.id);
  const heure = heureActuelle();

  if (nouveau) {
    const prop = await trouverAvecProprietaire(base.id);
    const nom = prop?.nom || base.nom;
    const texte = await genererMessagePresence({ type, eleveNom: nom, heure });
    const sujet = type === 'entree'
      ? `Lekòl Pam — ${nom} est arrivé(e) à l'école`
      : `Lekòl Pam — ${nom} a quitté l'école`;
    await notifierParent(prop, texte, sujet);
  }

  return {
    ok: true, dejaMarque: !nouveau, heure, type,
    eleve: { id: base.id, nom: base.nom, niveau: base.niveau },
  };
}

// Réinitialisation manuelle (bouton secrétariat) : efface les pointages du jour.
export async function reinitialiserJour() {
  return supprimerAujourdhui();
}

// Purge automatique (appelée au démarrage puis une fois par jour — voir
// server.js) : évite que la table grossisse indéfiniment.
export async function purgerAnciennesPresences() {
  const n = await supprimerAvant(RETENTION_JOURS);
  if (n > 0) console.log(`✔ Présences : ${n} pointage(s) de plus de ${RETENTION_JOURS} jours purgé(s).`);
  return n;
}
