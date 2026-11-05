// Contrôleur Inscription
import path from 'path';
import { findParentIdByUserId } from '../models/user.model.js';
import {
  creerInscription,
  listerParParent,
  trouverAvecProprietaire,
  listerTout,
  annulerSiNonPayee,
  trouverDoublonNonPaye,
  transmettreApresPaiement,
  STATUTS_NON_PAYES,
  DELAI_PAIEMENT_MINUTES,
} from '../models/inscription.model.js';
import * as paiementModel from '../models/paiement.model.js';
import { tarifCourant } from '../models/tarif.model.js';
import { plopplopConfigure } from '../config/plopplop.js';
import { genererCodeAcces } from '../models/eleve.model.js';
import { estAutorise, CLES } from '../services/permissions.service.js';
import {
  creerDocument,
  listerParInscription,
  trouverAvecProprietaire as trouverDocument,
} from '../models/document.model.js';
import { listerPourEntite, journaliser } from '../models/historique.model.js';
import { changerStatut } from '../services/inscription.service.js';
import { UPLOAD_ROOT } from '../config/upload.js';
import {
  clientIA, iaConfiguree, MODELE_IA, MARQUEUR_ELEVE, MARQUEUR_PARENT, CONSIGNE_MARQUEURS, restaurerMarqueurs,
} from '../config/ia.js';
import { anneeScolaireCourante } from '../utils/dates.js';

const TYPES_DOCUMENT = ['acte_naissance', 'bulletin', 'photo', 'autre'];

// Niveaux scolaires proposés à l'inscription — liste ordonnée partagée
// (voir config/niveaux.js, réutilisée par la ré-inscription pour la promotion).
export { NIVEAUX } from '../config/niveaux.js';
import { NIVEAUX } from '../config/niveaux.js';

// Décisions possibles + libellé humain pour l'assistant IA
const DECISIONS_IA = {
  accepte: 'accepter le dossier',
  complement_demande: 'demander des documents ou informations complémentaires',
  refuse: 'refuser le dossier',
};
// Documents attendus (pour repérer les manquants lors d'un complément)
const DOCS_ATTENDUS = { acte_naissance: 'acte de naissance', bulletin: 'bulletin', photo: "photo d'identité" };

function estAdmin(req) {
  return req.session.role === 'admin' || req.session.role === 'direction';
}

// POST /api/inscriptions (parent)
export async function creer(req, res, next) {
  try {
    const idParent = await findParentIdByUserId(req.session.userId);
    if (!idParent) return res.status(403).json({ erreur: 'Compte parent requis.' });

    const eleveNom = (req.body.eleveNom || '').trim();
    const elevePrenom = (req.body.elevePrenom || '').trim();
    // Année scolaire : toujours l'année courante, jamais choisie par le parent
    // (évite qu'une inscription atterrisse sur la mauvaise année scolaire).
    const anneeScolaire = anneeScolaireCourante();
    const niveau = (req.body.niveau || '').trim();
    if (!NIVEAUX.includes(niveau)) {
      return res.status(400).json({ erreur: 'Niveau scolaire invalide.' });
    }
    const sexe = (req.body.sexe || '').trim().toUpperCase();
    if (sexe !== 'M' && sexe !== 'F') {
      return res.status(400).json({ erreur: 'Sexe invalide.' });
    }
    const dateNaissance = req.body.dateNaissance || null;
    if (!dateNaissance) {
      return res.status(400).json({ erreur: 'Date de naissance requise.' });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateNaissance)) {
      return res.status(400).json({ erreur: 'Date de naissance invalide.' });
    }

    const t = (v) => (v ? String(v).trim() : null);
    // Longueurs maximales = tailles des colonnes (schema.sql) : un texte trop
    // long est refusé proprement au lieu de provoquer une erreur 500 en base.
    const LIMITES = {
      eleveNom: 120, elevePrenom: 120, nomParent: 120, professionParent: 120, telephoneParent: 40,
      courrielParent: 150, ancienneEcole: 160, ancienneClasse: 60, raisonChoix: 500,
    };
    for (const [champ, max] of Object.entries(LIMITES)) {
      if (req.body[champ] != null && typeof req.body[champ] !== 'string') {
        return res.status(400).json({ erreur: 'Données du formulaire invalides.' });
      }
      if ((req.body[champ] || '').trim().length > max) {
        return res.status(400).json({ erreur: `Champ trop long (${champ}, ${max} caractères max).` });
      }
    }
    // Date de naissance réelle (pas de 2026-02-31) et dans le passé
    const naissance = new Date(`${dateNaissance}T00:00:00Z`);
    if (Number.isNaN(naissance.getTime()) || naissance.toISOString().slice(0, 10) !== dateNaissance) {
      return res.status(400).json({ erreur: 'Date de naissance invalide.' });
    }
    const age = (Date.now() - naissance.getTime()) / (365.25 * 24 * 3600 * 1000);
    // Âge minimum : 2 ans. En dessous, l'inscription est refusée.
    if (age < 2) {
      return res.status(400).json({ erreur: "L'élève doit avoir au moins 2 ans pour être inscrit(e)." });
    }
    if (age > 40) {
      return res.status(400).json({ erreur: 'Date de naissance invalide (âge non plausible).' });
    }
    const telephone = (req.body.telephoneParent || '').trim();
    if (telephone && !/^\+?[0-9 ()-]{8,20}$/.test(telephone)) {
      return res.status(400).json({ erreur: 'Numéro de téléphone invalide.' });
    }
    const nomParent = t(req.body.nomParent);
    const professionParent = t(req.body.professionParent);
    const telephoneParent = t(req.body.telephoneParent);
    const courrielParent = t(req.body.courrielParent);
    if (courrielParent && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(courrielParent)) {
      return res.status(400).json({ erreur: 'Courriel du parent invalide.' });
    }
    const ancienneEcole = t(req.body.ancienneEcole);
    const ancienneClasse = t(req.body.ancienneClasse);
    const raisonChoix = t(req.body.raisonChoix);

    if (!eleveNom) {
      return res.status(400).json({ erreur: "Le nom de l'élève est requis." });
    }

    const donnees = {
      idParent, eleveNom, elevePrenom, sexe, dateNaissance, niveau, anneeScolaire,
      nomParent, professionParent, telephoneParent, courrielParent, ancienneEcole, ancienneClasse, raisonChoix,
    };

    // Le paiement des frais à l'inscription peut être désactivé par le
    // propriétaire (contrôle d'accès). Autorisé (défaut) = paiement obligatoire.
    const paiementRequis = await estAutorise(CLES.PAIEMENT_INSCRIPTION);

    if (paiementRequis) {
      // Les frais se paient en ligne dès la soumission : sans tarif en HTG ou
      // sans paiement en ligne configuré, le dossier ne pourrait jamais être
      // payé — on refuse avant de créer quoi que ce soit.
      const tarif = await tarifCourant('inscription');
      if (!tarif || tarif.devise !== 'HTG' || !plopplopConfigure()) {
        return res.status(503).json({
          erreur: "Les inscriptions en ligne sont momentanément indisponibles (paiement des frais non configuré). Contactez l'école.",
        });
      }

      // Double-clic / renvoi du formulaire : réutilise le dossier impayé identique
      const doublon = await trouverDoublonNonPaye({ idParent, eleveNom, elevePrenom, dateNaissance });
      if (doublon) {
        const p = await paiementModel.trouverPourInscription(doublon.id);
        if (p && p.statut === 'en_attente') {
          return res.status(200).json({
            message: 'Dossier déjà soumis — en attente du paiement des frais.',
            inscription: { id: doublon.id, idEleve: doublon.id_eleve, statut: 'attente_paiement', eleveNom, anneeScolaire, niveau },
            paiement: { id: p.id, montant: p.montant, devise: p.devise },
            delaiPaiementMinutes: DELAI_PAIEMENT_MINUTES,
          });
        }
      }

      const { idInscription, idEleve } = await creerInscription(donnees);
      // Le code d'accès élève est généré au paiement des frais (voir
      // traiterValidation), pas ici : un dossier impayé ne donne accès à rien.
      const idPaiement = await paiementModel.creer({
        typeFrais: 'inscription', idReference: idInscription, montant: tarif.montant, devise: tarif.devise,
      });

      return res.status(201).json({
        message: 'Inscription créée — en attente du paiement des frais.',
        inscription: { id: idInscription, idEleve, statut: 'attente_paiement', eleveNom, anneeScolaire, niveau },
        paiement: { id: idPaiement, montant: tarif.montant, devise: tarif.devise },
        delaiPaiementMinutes: DELAI_PAIEMENT_MINUTES,
      });
    }

    // Paiement désactivé par le propriétaire : inscription SANS paiement. Le
    // dossier (créé « attente_paiement ») est transmis directement au
    // secrétariat et le code d'accès élève est généré.
    const { idInscription, idEleve } = await creerInscription(donnees);
    await transmettreApresPaiement(idInscription); // attente_paiement -> en_attente
    try {
      await genererCodeAcces(idEleve);
    } catch (err) {
      console.error('Génération du code élève échouée :', err.message);
    }
    await journaliser({
      entite: 'inscription', idEntite: idInscription, ancienStatut: 'attente_paiement',
      nouveauStatut: 'en_attente', commentaire: 'Inscription sans paiement (désactivé par le propriétaire)', idAuteur: null,
    });

    return res.status(201).json({
      message: 'Inscription créée.',
      inscription: { id: idInscription, idEleve, statut: 'en_attente', eleveNom, anneeScolaire, niveau },
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/inscriptions/config (parent) — indique au formulaire si le paiement
// des frais est exigé (contrôlé par le propriétaire) et, le cas échéant, le tarif.
export async function configInscription(req, res, next) {
  try {
    const paiementRequis = await estAutorise(CLES.PAIEMENT_INSCRIPTION);
    let tarif = null;
    if (paiementRequis) {
      const t = await tarifCourant('inscription');
      if (t) tarif = { montant: t.montant, devise: t.devise };
    }
    return res.json({ paiementRequis, tarif, delaiPaiementMinutes: DELAI_PAIEMENT_MINUTES });
  } catch (err) {
    next(err);
  }
}

// GET /api/inscriptions (parent — les siens)
export async function listerMiennes(req, res, next) {
  try {
    const idParent = await findParentIdByUserId(req.session.userId);
    if (!idParent) return res.status(403).json({ erreur: 'Compte parent requis.' });
    const dossiers = await listerParParent(idParent);
    return res.json({ inscriptions: dossiers });
  } catch (err) {
    next(err);
  }
}

// Charge une inscription et vérifie l'accès (propriétaire ou admin). Renvoie l'objet ou répond une erreur.
async function chargerAutorisee(req, res) {
  const inscription = await trouverAvecProprietaire(Number(req.params.id));
  if (!inscription) {
    res.status(404).json({ erreur: 'Inscription introuvable.' });
    return null;
  }
  if (!estAdmin(req) && inscription.id_utilisateur !== req.session.userId) {
    res.status(403).json({ erreur: 'Accès refusé.' });
    return null;
  }
  // Un dossier impayé n'existe pas encore pour l'école
  if (inscription.id_utilisateur !== req.session.userId && STATUTS_NON_PAYES.includes(inscription.statut)) {
    res.status(404).json({ erreur: 'Inscription introuvable.' });
    return null;
  }
  return inscription;
}

// GET /api/inscriptions/:id (propriétaire ou admin)
export async function detail(req, res, next) {
  try {
    const inscription = await chargerAutorisee(req, res);
    if (!inscription) return;
    const documents = await listerParInscription(inscription.id);
    const historique = await listerPourEntite('inscription', inscription.id);
    // Côté parent : paiement des frais (pour « Payer maintenant ») et échéance
    let paiement = null;
    let echeancePaiement = null;
    if (inscription.statut === 'attente_paiement') {
      const p = await paiementModel.trouverPourInscription(inscription.id);
      if (p) paiement = { id: p.id, montant: p.montant, devise: p.devise, statut: p.statut };
      echeancePaiement = new Date(new Date(inscription.date_soumission).getTime() + DELAI_PAIEMENT_MINUTES * 60_000);
    }
    return res.json({ inscription, documents, historique, paiement, echeancePaiement });
  } catch (err) {
    next(err);
  }
}

// POST /api/inscriptions/:id/documents (parent propriétaire, multipart)
export async function televerserDocument(req, res, next) {
  try {
    const inscription = await trouverAvecProprietaire(Number(req.params.id));
    if (!inscription) return res.status(404).json({ erreur: 'Inscription introuvable.' });
    if (inscription.id_utilisateur !== req.session.userId) {
      return res.status(403).json({ erreur: 'Accès refusé.' });
    }

    const type = (req.body.type || '').trim();
    if (!TYPES_DOCUMENT.includes(type)) {
      return res.status(400).json({ erreur: `Type de document invalide (${TYPES_DOCUMENT.join(', ')}).` });
    }
    if (!req.file) {
      return res.status(400).json({ erreur: 'Fichier requis (PDF, JPG ou PNG, max 5 Mo).' });
    }

    const urlFichier = `inscriptions/${req.file.filename}`;
    const id = await creerDocument({ idInscription: inscription.id, type, urlFichier });
    return res.status(201).json({ message: 'Document téléversé.', document: { id, type } });
  } catch (err) {
    next(err);
  }
}

// GET /api/inscriptions/:id/documents (propriétaire ou admin)
export async function listerDocuments(req, res, next) {
  try {
    const inscription = await chargerAutorisee(req, res);
    if (!inscription) return;
    const documents = await listerParInscription(inscription.id);
    return res.json({ documents });
  } catch (err) {
    next(err);
  }
}

// GET /api/documents-soumis/:id/fichier (propriétaire ou admin)
export async function servirFichier(req, res, next) {
  try {
    const doc = await trouverDocument(Number(req.params.id));
    if (!doc) return res.status(404).json({ erreur: 'Document introuvable.' });
    if (!estAdmin(req) && doc.id_utilisateur !== req.session.userId) {
      return res.status(403).json({ erreur: 'Accès refusé.' });
    }
    if (doc.id_utilisateur !== req.session.userId && STATUTS_NON_PAYES.includes(doc.inscription_statut)) {
      return res.status(404).json({ erreur: 'Document introuvable.' });
    }
    // Défense en profondeur : le chemin résolu doit rester dans UPLOAD_ROOT
    const chemin = path.resolve(UPLOAD_ROOT, doc.url_fichier);
    if (!chemin.startsWith(path.resolve(UPLOAD_ROOT))) {
      return res.status(400).json({ erreur: 'Chemin invalide.' });
    }
    return res.sendFile(chemin);
  } catch (err) {
    next(err);
  }
}

// GET /api/admin/inscriptions (admin/direction)
export async function listerAdmin(req, res, next) {
  try {
    const dossiers = await listerTout({ statut: req.query.statut, niveau: req.query.niveau });
    return res.json({ inscriptions: dossiers });
  } catch (err) {
    next(err);
  }
}

// POST /api/inscriptions/:id/message-ia (admin/direction) — rédige le message au parent avec l'IA (Groq)
export async function messageParentIA(req, res, next) {
  try {
    if (!iaConfiguree()) {
      return res.status(503).json({ erreur: "L'assistant IA n'est pas configuré (clé GROQ_API_KEY manquante côté serveur)." });
    }
    const decision = DECISIONS_IA[req.body.decision] ? req.body.decision : null;
    if (!decision) return res.status(400).json({ erreur: 'Décision invalide.' });
    const precision = (req.body.precision || '').trim().slice(0, 500);

    const inscription = await trouverAvecProprietaire(Number(req.params.id));
    if (!inscription || STATUTS_NON_PAYES.includes(inscription.statut)) {
      return res.status(404).json({ erreur: 'Inscription introuvable.' });
    }
    const fraisPayes = (await paiementModel.trouverPourInscription(inscription.id))?.statut === 'valide';

    // Contexte : documents déjà soumis → repérer les manquants pour un complément
    const documents = await listerParInscription(inscription.id);
    const typesSoumis = new Set(documents.map((d) => d.type));
    const manquants = Object.entries(DOCS_ATTENDUS)
      .filter(([type]) => !typesSoumis.has(type))
      .map(([, libelle]) => libelle);

    const contexte = [
      `Élève : ${MARQUEUR_ELEVE}`,
      inscription.niveau ? `Niveau demandé : ${inscription.niveau}` : null,
      inscription.annee_scolaire ? `Année scolaire : ${inscription.annee_scolaire}` : null,
      `Parent : ${MARQUEUR_PARENT}`,
      decision === 'complement_demande' && manquants.length ? `Documents manquants : ${manquants.join(', ')}` : null,
      precision ? `Précisions du secrétariat : ${precision}` : null,
    ].filter(Boolean).join('\n');

    const client = clientIA();
    const completion = await client.chat.completions.create({
      model: MODELE_IA,
      temperature: 0.6,
      max_tokens: 500,
      messages: [
        {
          role: 'system',
          content: "Tu es la secrétaire de l'école « Lekòl Pam ». Tu rédiges un message court, poli et professionnel adressé au parent d'un élève, en français, au sujet du dossier d'inscription. Style courtois et bienveillant. Commence par « Bonjour, » et termine par « L'administration de Lekòl Pam ». N'utilise pas d'emojis. N'invente aucune date, montant ni information absente du contexte fourni. Réponds uniquement avec le texte du message, sans objet ni en-tête. " + CONSIGNE_MARQUEURS,
        },
        {
          role: 'user',
          content: `Rédige un message pour ${DECISIONS_IA[decision]}.\n\nContexte :\n${contexte}\n\n`
            + (decision === 'accepte'
              ? (fraisPayes
                ? "Annonce l'acceptation : les frais d'inscription sont déjà payés, l'inscription est donc confirmée. Ne demande aucun paiement."
                : "Annonce l'acceptation et invite le parent à finaliser l'inscription (paiement).")
              : decision === 'complement_demande' ? 'Demande poliment de fournir les documents ou informations manquants.'
              : 'Annonce le refus avec tact et respect, en restant bref.'),
        },
      ],
    });

    const message = restaurerMarqueurs((completion.choices?.[0]?.message?.content || '').trim(), {
      eleve: inscription.eleve_nom, parent: inscription.parent_nom,
    });
    if (!message) return res.status(502).json({ erreur: "L'assistant IA n'a pas pu générer de message." });
    return res.json({ message });
  } catch (err) {
    if (err && (err.status === 401 || err.status === 403)) {
      return res.status(503).json({ erreur: 'Clé Groq invalide ou sans accès. Vérifiez GROQ_API_KEY.' });
    }
    next(err);
  }
}

// POST /api/inscriptions/:id/annuler (parent propriétaire — dossier impayé seulement)
export async function annuler(req, res, next) {
  try {
    const inscription = await trouverAvecProprietaire(Number(req.params.id));
    if (!inscription) return res.status(404).json({ erreur: 'Inscription introuvable.' });
    if (inscription.id_utilisateur !== req.session.userId) {
      return res.status(403).json({ erreur: 'Accès refusé.' });
    }
    if (!(await annulerSiNonPayee(inscription.id))) {
      return res.status(409).json({ erreur: 'Seul un dossier en attente de paiement peut être annulé.' });
    }
    await journaliser({
      entite: 'inscription', idEntite: inscription.id, ancienStatut: 'attente_paiement',
      nouveauStatut: 'annulee', commentaire: 'Annulé par le parent', idAuteur: req.session.userId,
    });
    return res.json({ message: 'Dossier annulé.', statut: 'annulee' });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/inscriptions/:id/statut (admin/direction)
export async function changerStatutCtrl(req, res, next) {
  try {
    const statut = (req.body.statut || '').trim();
    const commentaire = req.body.commentaire ? String(req.body.commentaire).trim() : null;

    const resultat = await changerStatut({
      idInscription: Number(req.params.id),
      nouveauStatut: statut,
      commentaire,
      idAuteur: req.session.userId,
    });

    if (!resultat.ok) {
      return res.status(resultat.code).json({ erreur: resultat.erreur });
    }
    return res.json({
      message: 'Statut mis à jour.',
      statut: resultat.nouveauStatut,
      ...(resultat.previewUrl ? { apercuCourriel: resultat.previewUrl } : {}),
    });
  } catch (err) {
    next(err);
  }
}
