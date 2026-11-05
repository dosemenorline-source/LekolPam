// Contrôleur Annonce — message groupé envoyé à tous les parents
// SMS : admin/direction/propriétaire. Courriel + rédaction IA : propriétaire uniquement.
import { listerParentsAvecTelephone, listerParentsAvecCourriel, findById } from '../models/user.model.js';
import { obtenir as obtenirEcole } from '../models/ecole.model.js';
import { envoyerSms } from '../config/sms.js';
import { envoyerCourriel } from '../config/mailer.js';
import { clientIA, iaConfiguree, MODELE_IA } from '../config/ia.js';
import {
  chargerLogoEcole, construireHtmlAnnonce, construireTexteAnnonce, genererPdfAnnonce,
} from '../services/annonce.service.js';

const LONGUEUR_MAX = 400; // large marge au-delà d'un SMS standard (concaténation automatique)
const LONGUEUR_MAX_OBJET = 200;
const LONGUEUR_MAX_SECTION = 3000; // par section (introduction/développement/conclusion)

// POST /api/annonces/sms
export async function envoyerAnnonce(req, res, next) {
  try {
    const message = (req.body.message || '').trim();
    if (!message) return res.status(400).json({ erreur: 'Message requis.' });
    if (message.length > LONGUEUR_MAX) {
      return res.status(400).json({ erreur: `Message trop long (max ${LONGUEUR_MAX} caractères).` });
    }

    const parents = await listerParentsAvecTelephone();
    if (!parents.length) {
      return res.status(409).json({ erreur: 'Aucun numéro de téléphone parent enregistré.' });
    }

    let envoyes = 0;
    let echecs = 0;
    for (const parent of parents) {
      try {
        await envoyerSms({ to: parent.telephone, texte: message });
        envoyes += 1;
      } catch (err) {
        echecs += 1;
        console.error(`Annonce SMS échouée pour ${parent.nom} :`, err.message);
      }
    }

    return res.json({ message: 'Annonce envoyée.', total: parents.length, envoyes, echecs });
  } catch (err) {
    next(err);
  }
}

// POST /api/annonces/courriel (propriétaire uniquement)
// Courriel habillé (logo, coordonnées de l'école) + PDF joint reprenant le même
// texte, structuré en introduction / développement / conclusion, signé par le
// propriétaire connecté.
export async function envoyerAnnonceCourriel(req, res, next) {
  try {
    const objet = (req.body.objet || '').trim();
    const introduction = (req.body.introduction || '').trim();
    const developpement = (req.body.developpement || '').trim();
    const conclusion = (req.body.conclusion || '').trim();

    if (!objet) return res.status(400).json({ erreur: 'Objet requis.' });
    if (!introduction || !developpement || !conclusion) {
      return res.status(400).json({ erreur: "L'introduction, le développement et la conclusion sont requis." });
    }
    if (objet.length > LONGUEUR_MAX_OBJET) {
      return res.status(400).json({ erreur: `Objet trop long (max ${LONGUEUR_MAX_OBJET} caractères).` });
    }
    for (const [nom, valeur] of [['introduction', introduction], ['développement', developpement], ['conclusion', conclusion]]) {
      if (valeur.length > LONGUEUR_MAX_SECTION) {
        return res.status(400).json({ erreur: `La section « ${nom} » est trop longue (max ${LONGUEUR_MAX_SECTION} caractères).` });
      }
    }

    const parents = await listerParentsAvecCourriel();
    if (!parents.length) {
      return res.status(409).json({ erreur: 'Aucun parent avec une adresse courriel enregistrée.' });
    }

    const [ecole, signataire] = await Promise.all([
      obtenirEcole(),
      findById(req.session.userId),
    ]);
    const signataireNom = signataire?.nom || 'La direction';
    const logo = await chargerLogoEcole(ecole);

    const contenu = { ecole, objet, introduction, developpement, conclusion, signataireNom };
    const html = construireHtmlAnnonce({ ...contenu, logo });
    const texte = construireTexteAnnonce(contenu);
    const pdfBuffer = await genererPdfAnnonce({ ...contenu, logo });
    const attachments = [{ filename: 'annonce.pdf', content: pdfBuffer.toString('base64') }];

    let envoyes = 0;
    let echecs = 0;
    for (const parent of parents) {
      try {
        await envoyerCourriel({
          to: parent.courriel, subject: objet, text: texte, html, attachments,
        });
        envoyes += 1;
      } catch (err) {
        echecs += 1;
        console.error(`Annonce courriel échouée pour ${parent.nom} :`, err.message);
      }
    }

    return res.json({ message: 'Annonce envoyée.', total: parents.length, envoyes, echecs });
  } catch (err) {
    next(err);
  }
}

// POST /api/annonces/redaction-ia (propriétaire uniquement)
// L'IA propose un brouillon structuré (objet + introduction + développement +
// conclusion) à partir d'une courte idée ; le propriétaire relit et modifie le
// texte avant de l'envoyer lui-même. La signature est ajoutée par l'application,
// jamais par l'IA.
export async function redactionAnnonceIA(req, res, next) {
  try {
    if (!iaConfiguree()) {
      return res.status(503).json({ erreur: "L'assistant IA n'est pas configuré (clé GROQ_API_KEY manquante côté serveur)." });
    }
    const sujet = (req.body.sujet || '').trim();
    if (!sujet) return res.status(400).json({ erreur: "Décrivez le sujet de l'annonce." });
    if (sujet.length > 800) return res.status(400).json({ erreur: 'Le sujet est trop long (max 800 caractères).' });

    const client = clientIA();
    const completion = await client.chat.completions.create({
      model: MODELE_IA,
      temperature: 0.6,
      max_tokens: 900,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: "Tu es l'assistant de communication de l'école « Lekòl Pam ». Tu rédiges des annonces officielles envoyées par courriel à tous les parents, sous la forme d'une lettre structurée. Style clair, chaleureux et professionnel, en français. N'utilise pas d'emojis. N'invente pas de dates, de lieux ni de chiffres précis qui ne sont pas dans la demande. Ne rédige AUCUNE formule de politesse ni signature finale : l'application les ajoute automatiquement. Réponds UNIQUEMENT avec un objet JSON de la forme {\"objet\": \"...\", \"introduction\": \"...\", \"developpement\": \"...\", \"conclusion\": \"...\"}.",
        },
        {
          role: 'user',
          content: `Rédige une annonce à partir de cette idée : "${sujet}".\n`
            + 'L\'"objet" doit être court (environ 60 caractères maximum). '
            + 'L\'"introduction" contextualise le sujet en 1 à 2 phrases. '
            + 'Le "developpement" détaille l\'information en 2 à 4 phrases. '
            + 'La "conclusion" clôt le message en 1 à 2 phrases (rappel ou invitation à contacter l\'école au besoin), sans formule de politesse.',
        },
      ],
    });

    const texte = completion.choices?.[0]?.message?.content || '';
    let data = null;
    try { data = JSON.parse(texte); } catch { /* repli ci-dessous */ }

    if (!data || !data.developpement) {
      return res.json({
        objet: '', introduction: '', developpement: texte.trim(), conclusion: '',
      });
    }
    return res.json({
      objet: (data.objet || '').trim(),
      introduction: (data.introduction || '').trim(),
      developpement: (data.developpement || '').trim(),
      conclusion: (data.conclusion || '').trim(),
    });
  } catch (err) {
    if (err && (err.status === 401 || err.status === 403)) {
      return res.status(503).json({ erreur: 'Clé Groq invalide ou sans accès. Vérifiez GROQ_API_KEY.' });
    }
    next(err);
  }
}
