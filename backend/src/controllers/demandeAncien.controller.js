// Contrôleur — demandes d'accès aux résultats (anciens élèves)
import * as demandeModel from '../models/demandeAncien.model.js';
import * as eleveModel from '../models/eleve.model.js';
import { envoyerCourriel } from '../config/mailer.js';
import { echapperHtml } from '../utils/html.js';

const COURRIEL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SITE_URL = 'https://lekolpam.online';

// POST /api/anciens-eleves/demandes (public)
export async function creerCtrl(req, res, next) {
  try {
    const nom = (req.body.nom || '').trim();
    const courriel = (req.body.courriel || '').trim().toLowerCase();
    if (!nom || nom.length > 120) return res.status(400).json({ erreur: 'Nom requis (120 caractères maximum).' });
    if (!courriel || courriel.length > 190 || !COURRIEL_RE.test(courriel)) {
      return res.status(400).json({ erreur: 'Courriel invalide.' });
    }
    const dateNaissance = req.body.dateNaissance || null;
    if (dateNaissance && !/^\d{4}-\d{2}-\d{2}$/.test(dateNaissance)) {
      return res.status(400).json({ erreur: 'Date de naissance invalide.' });
    }

    await demandeModel.creer({
      nom,
      prenom: (req.body.prenom || '').trim().slice(0, 120) || null,
      dateNaissance,
      dernierNiveau: (req.body.dernierNiveau || '').trim().slice(0, 60) || null,
      anneesFrequentees: (req.body.anneesFrequentees || '').trim().slice(0, 100) || null,
      courriel,
      telephone: (req.body.telephone || '').trim().slice(0, 40) || null,
      message: (req.body.message || '').trim().slice(0, 500) || null,
    });
    return res.status(201).json({ message: 'Demande envoyée. Le secrétariat vous contactera par courriel.' });
  } catch (err) {
    next(err);
  }
}

// GET /api/admin/anciens-eleves/demandes?statut= (admin/direction)
export async function listerCtrl(req, res, next) {
  try {
    const statut = ['en_attente', 'approuve', 'refuse'].includes(req.query.statut) ? req.query.statut : undefined;
    const demandes = await demandeModel.lister({ statut });
    return res.json({ demandes });
  } catch (err) {
    next(err);
  }
}

// POST /api/admin/anciens-eleves/demandes/:id/approuver (admin/direction) — body { idEleve }
// idEleve doit déjà exister (dossier ancien élève créé/rapproché par le secrétariat) :
// le rapprochement d'identité reste un jugement humain, pas automatisé.
export async function approuverCtrl(req, res, next) {
  try {
    const id = Number(req.params.id);
    const idEleve = Number(req.body.idEleve);
    const demande = await demandeModel.trouverParId(id);
    if (!demande) return res.status(404).json({ erreur: 'Demande introuvable.' });
    if (demande.statut !== 'en_attente') return res.status(409).json({ erreur: 'Cette demande a déjà été traitée.' });
    if (!idEleve) return res.status(400).json({ erreur: 'idEleve requis (dossier ancien élève à rattacher).' });

    const eleve = await eleveModel.trouverParId(idEleve);
    if (!eleve || !eleve.ancien_eleve) {
      return res.status(400).json({ erreur: "Ce dossier n'est pas un dossier ancien élève." });
    }

    const code = eleve.code_acces || await eleveModel.genererCodeAcces(idEleve);
    await demandeModel.approuver(id, { idEleve, traitePar: req.session.userId });

    try {
      await envoyerCourriel({
        to: demande.courriel,
        subject: 'Lekòl Pam — accès à vos résultats',
        text: `Bonjour ${demande.prenom || demande.nom},\n\n`
          + `Votre demande d'accès à vos résultats a été approuvée.\n`
          + `Code d'accès : ${code}\n\n`
          + `Rendez-vous sur ${SITE_URL}/eleve, saisissez ce code pour consulter et télécharger vos résultats pour toutes les années où vous avez fréquenté l'école.\n\n`
          + `Ce code est personnel et permanent : conservez-le.`,
        html: `<p>Bonjour ${echapperHtml(demande.prenom || demande.nom)},</p>`
          + `<p>Votre demande d'accès à vos résultats a été approuvée.</p>`
          + `<p>Code d'accès : <strong style="font-family:monospace;font-size:1.1em">${echapperHtml(code)}</strong></p>`
          + `<p>Rendez-vous sur <a href="${SITE_URL}/eleve">${SITE_URL}/eleve</a>, saisissez ce code pour consulter et télécharger vos résultats pour toutes les années où vous avez fréquenté l'école.</p>`
          + `<p style="color:#888;font-size:.85em">Ce code est personnel et permanent : conservez-le.</p>`,
      });
    } catch (err) {
      console.error('Notification demande ancien élève échouée :', err.message);
    }

    return res.json({ message: 'Demande approuvée, code envoyé.' });
  } catch (err) {
    next(err);
  }
}

// POST /api/admin/anciens-eleves/demandes/:id/refuser (admin/direction) — body { motif }
export async function refuserCtrl(req, res, next) {
  try {
    const id = Number(req.params.id);
    const demande = await demandeModel.trouverParId(id);
    if (!demande) return res.status(404).json({ erreur: 'Demande introuvable.' });
    if (demande.statut !== 'en_attente') return res.status(409).json({ erreur: 'Cette demande a déjà été traitée.' });

    const motif = (req.body.motif || '').trim();
    await demandeModel.refuser(id, { traitePar: req.session.userId });

    try {
      await envoyerCourriel({
        to: demande.courriel,
        subject: 'Lekòl Pam — demande d\'accès aux résultats',
        text: `Bonjour ${demande.prenom || demande.nom},\n\n`
          + `Nous n'avons pas pu valider votre demande d'accès aux résultats`
          + (motif ? ` : ${motif}` : '.')
          + `\n\nPour toute question, contactez le secrétariat de l'école.`,
        html: `<p>Bonjour ${echapperHtml(demande.prenom || demande.nom)},</p>`
          + `<p>Nous n'avons pas pu valider votre demande d'accès aux résultats`
          + (motif ? ` : ${echapperHtml(motif)}` : '.') + `</p>`
          + `<p>Pour toute question, contactez le secrétariat de l'école.</p>`,
      });
    } catch (err) {
      console.error('Notification refus ancien élève échouée :', err.message);
    }

    return res.json({ message: 'Demande refusée.' });
  } catch (err) {
    next(err);
  }
}
