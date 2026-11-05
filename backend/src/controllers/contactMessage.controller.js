// Contrôleur — formulaire de contact public + boîte de réception (propriétaire)
import * as modele from '../models/contactMessage.model.js';
import { envoyerCourriel } from '../config/mailer.js';
import { clientIA, iaConfiguree, MODELE_IA } from '../config/ia.js';
import { echapperHtml } from '../utils/html.js';

const COURRIEL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST /api/contact (public)
export async function creerCtrl(req, res, next) {
  try {
    const nom = (req.body.nom || '').trim();
    const courriel = (req.body.courriel || req.body.email || '').trim().toLowerCase();
    const message = (req.body.message || '').trim();

    if (!nom || nom.length > 150) {
      return res.status(400).json({ erreur: 'Nom requis (150 caractères maximum).' });
    }
    if (!courriel || courriel.length > 190 || !COURRIEL_RE.test(courriel)) {
      return res.status(400).json({ erreur: 'Courriel invalide.' });
    }
    if (!message || message.length > 5000) {
      return res.status(400).json({ erreur: 'Message requis (5000 caractères maximum).' });
    }

    await modele.creer({ nom, courriel, message });
    return res.status(201).json({ message: 'Message envoyé. Nous vous répondrons par courriel.' });
  } catch (err) {
    next(err);
  }
}

// GET /api/proprietaire/messages?statut= (proprietaire)
export async function listerCtrl(req, res, next) {
  try {
    const statut = ['non_lu', 'lu', 'repondu'].includes(req.query.statut) ? req.query.statut : undefined;
    const messages = await modele.lister({ statut });
    return res.json({ messages });
  } catch (err) {
    next(err);
  }
}

// GET /api/proprietaire/messages/:id (proprietaire) — marque lu au passage
export async function detailCtrl(req, res, next) {
  try {
    const id = Number(req.params.id);
    const msg = await modele.trouverParId(id);
    if (!msg) return res.status(404).json({ erreur: 'Message introuvable.' });
    if (msg.statut === 'non_lu') {
      await modele.marquerLu(id);
      msg.statut = 'lu';
    }
    return res.json({ message: msg });
  } catch (err) {
    next(err);
  }
}

// POST /api/proprietaire/messages/:id/reponse-ia (proprietaire) — brouillon IA, non envoyé
export async function genererReponseIaCtrl(req, res, next) {
  try {
    if (!iaConfiguree()) {
      return res.status(503).json({ erreur: "L'assistant IA n'est pas configuré (clé GROQ_API_KEY manquante côté serveur)." });
    }
    const msg = await modele.trouverParId(Number(req.params.id));
    if (!msg) return res.status(404).json({ erreur: 'Message introuvable.' });

    const client = clientIA();
    const completion = await client.chat.completions.create({
      model: MODELE_IA,
      temperature: 0.6,
      max_tokens: 500,
      messages: [
        {
          role: 'system',
          content: "Tu réponds, au nom du secrétariat de l'école « Lekòl Pam », à un message reçu via le formulaire de contact du site. Rédige une réponse en français, polie, chaleureuse et concrète, qui répond vraiment à la demande de l'expéditeur. N'invente aucune information (frais, dates, procédures) que tu ne connais pas : si le message demande un détail précis que tu n'as pas, invite la personne à préciser sa demande ou à contacter l'école. Termine par une formule de politesse et la signature « L'équipe de Lekòl Pam ». Pas d'emojis, pas de titre.",
        },
        {
          role: 'user',
          content: `Message reçu de ${msg.nom} (${msg.courriel}) :\n\n${msg.message}`,
        },
      ],
    });

    const brouillon = (completion.choices?.[0]?.message?.content || '').trim();
    if (!brouillon) {
      return res.status(502).json({ erreur: "L'assistant IA n'a pas pu générer de réponse." });
    }
    return res.json({ brouillon });
  } catch (err) {
    if (err && (err.status === 401 || err.status === 403)) {
      return res.status(503).json({ erreur: 'Clé Groq invalide ou sans accès. Vérifiez GROQ_API_KEY.' });
    }
    next(err);
  }
}

// POST /api/proprietaire/messages/:id/repondre (proprietaire) — envoie la réponse par courriel
export async function repondreCtrl(req, res, next) {
  try {
    const id = Number(req.params.id);
    const reponse = (req.body.reponse || '').trim();
    if (!reponse) return res.status(400).json({ erreur: 'La réponse ne peut pas être vide.' });

    const msg = await modele.trouverParId(id);
    if (!msg) return res.status(404).json({ erreur: 'Message introuvable.' });
    if (msg.statut === 'repondu') {
      return res.status(409).json({ erreur: 'Ce message a déjà reçu une réponse.' });
    }

    await envoyerCourriel({
      to: msg.courriel,
      subject: 'Lekòl Pam — réponse à votre message',
      text: reponse,
      html: reponse.split('\n').filter((l) => l.trim()).map((l) => `<p>${echapperHtml(l)}</p>`).join(''),
    });

    await modele.enregistrerReponse(id, { reponse, renduPar: req.session.userId });
    return res.json({ message: 'Réponse envoyée.' });
  } catch (err) {
    next(err);
  }
}
