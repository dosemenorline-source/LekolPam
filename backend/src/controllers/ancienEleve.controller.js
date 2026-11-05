// Contrôleur — dossiers d'anciens élèves (saisie historique de notes,
// sans compte parent) et sélecteur de niveaux connus.
import * as eleveModel from '../models/eleve.model.js';
import * as noteModel from '../models/note.model.js';
import * as matiereModel from '../models/matiere.model.js';
import * as documentModel from '../models/documentOfficiel.model.js';
import { obtenir as obtenirEcole } from '../models/ecole.model.js';
import { calculerMoyenne } from '../services/moyenne.service.js';
import { genererBulletinPDF } from '../services/bulletin.service.js';
import { envoyerCourriel } from '../config/mailer.js';
import { echapperHtml } from '../utils/html.js';
import { UPLOAD_ROOT } from '../config/upload.js';
import fs from 'fs/promises';
import path from 'path';

const TRIMESTRES = ['1er_trimestre', '2e_trimestre', '3e_trimestre'];
const LIBELLE_TRIMESTRE = {
  '1er_trimestre': '1er trimestre',
  '2e_trimestre': '2e trimestre',
  '3e_trimestre': '3e trimestre',
};
const SITE_URL = 'https://lekolpam.online';

// GET /api/admin/niveaux (admin/direction)
export async function listerNiveauxCtrl(req, res, next) {
  try {
    const niveaux = await eleveModel.listerNiveauxConnus();
    return res.json({ niveaux });
  } catch (err) {
    next(err);
  }
}

// GET /api/admin/anciens-eleves?recherche= (admin/direction)
export async function listerCtrl(req, res, next) {
  try {
    const anciens = await eleveModel.listerAnciens({ recherche: req.query.recherche });
    return res.json({ anciens });
  } catch (err) {
    next(err);
  }
}

// POST /api/admin/anciens-eleves (admin/direction)
export async function creerCtrl(req, res, next) {
  try {
    const nom = (req.body.nom || '').trim();
    if (!nom) return res.status(400).json({ erreur: 'Nom requis.' });
    const dateNaissance = req.body.dateNaissance || null;
    if (dateNaissance && !/^\d{4}-\d{2}-\d{2}$/.test(dateNaissance)) {
      return res.status(400).json({ erreur: 'Date de naissance invalide.' });
    }
    const ancien = await eleveModel.creerAncien({
      nom,
      prenom: (req.body.prenom || '').trim() || null,
      dateNaissance,
      niveau: (req.body.niveau || '').trim() || null,
      courrielContact: (req.body.courrielContact || '').trim() || null,
    });
    return res.status(201).json({ ancien });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/admin/anciens-eleves/:id (admin/direction)
export async function mettreAJourCtrl(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (req.body.dateNaissance && !/^\d{4}-\d{2}-\d{2}$/.test(req.body.dateNaissance)) {
      return res.status(400).json({ erreur: 'Date de naissance invalide.' });
    }
    await eleveModel.mettreAJourAncien(id, {
      nom: req.body.nom !== undefined ? (req.body.nom || '').trim() : undefined,
      prenom: req.body.prenom !== undefined ? (req.body.prenom || '').trim() : undefined,
      dateNaissance: req.body.dateNaissance,
      niveau: req.body.niveau !== undefined ? (req.body.niveau || '').trim() : undefined,
      courrielContact: req.body.courrielContact !== undefined ? (req.body.courrielContact || '').trim() : undefined,
    });
    return res.json({ message: 'Dossier mis à jour.' });
  } catch (err) {
    next(err);
  }
}

// GET /api/admin/anciens-eleves/:id/notes (admin/direction) — tout l'historique saisi
export async function listerNotesCtrl(req, res, next) {
  try {
    const idEleve = Number(req.params.id);
    const eleve = await eleveModel.trouverParId(idEleve);
    if (!eleve || !eleve.ancien_eleve) return res.status(404).json({ erreur: 'Dossier ancien élève introuvable.' });

    const notes = await noteModel.listerPourEleve(idEleve, {});
    return res.json({ notes });
  } catch (err) {
    next(err);
  }
}

// POST /api/admin/anciens-eleves/:id/notes (admin/direction)
// body { anneeScolaire, periode, notes: [{ idMatiere, valeur, bareme }] }
// Saisie groupée, directement validée (dossier historique déjà arrêté —
// pas de cycle brouillon/validation ni de publication à rejouer).
export async function creerNotesCtrl(req, res, next) {
  try {
    const idEleve = Number(req.params.id);
    const eleve = await eleveModel.trouverParId(idEleve);
    if (!eleve || !eleve.ancien_eleve) return res.status(404).json({ erreur: 'Dossier ancien élève introuvable.' });

    const anneeScolaire = (req.body.anneeScolaire || '').trim();
    const periode = (req.body.periode || '').trim();
    const lignes = Array.isArray(req.body.notes) ? req.body.notes : [];

    if (!/^\d{4}-\d{4}$/.test(anneeScolaire)) {
      return res.status(400).json({ erreur: "Année scolaire invalide (format AAAA-AAAA)." });
    }
    if (!TRIMESTRES.includes(periode)) {
      return res.status(400).json({ erreur: `Trimestre invalide (${TRIMESTRES.join(', ')}).` });
    }
    if (!lignes.length) return res.status(400).json({ erreur: 'Au moins une note requise.' });

    const cree = [];
    for (const ligne of lignes) {
      const idMatiere = Number(ligne.idMatiere);
      const valeur = Number(ligne.valeur);
      const bareme = ligne.bareme === undefined || ligne.bareme === '' ? 100 : Number(ligne.bareme);
      if (!idMatiere || !Number.isFinite(bareme) || bareme <= 0) continue;
      if (!Number.isFinite(valeur) || valeur < 0 || valeur > bareme) continue;

      const matiere = await matiereModel.trouverParId(idMatiere);
      if (!matiere) continue;

      const id = await noteModel.creer({
        idEleve, idMatiere, matiere: matiere.nom, niveau: matiere.niveau,
        periode, anneeScolaire, valeur, bareme, saisiePar: req.session.userId,
        statutValidation: 'validee',
      });
      cree.push(id);
    }

    if (!cree.length) return res.status(400).json({ erreur: "Aucune note valide n'a pu être enregistrée." });
    return res.status(201).json({ message: `${cree.length} note(s) enregistrée(s).`, ids: cree });
  } catch (err) {
    next(err);
  }
}

// POST /api/admin/anciens-eleves/:id/bulletins (admin/direction)
// body { niveau, anneeScolaire, trimestre } — génère le bulletin PDF pour CE
// seul dossier (contrairement à /api/publications, qui publie tout un niveau :
// ici aucun risque de republier/renotifier des élèves actifs par erreur,
// puisque rien d'autre que ce dossier n'est touché).
export async function genererBulletinCtrl(req, res, next) {
  try {
    const idEleve = Number(req.params.id);
    const eleve = await eleveModel.trouverParId(idEleve);
    if (!eleve || !eleve.ancien_eleve) return res.status(404).json({ erreur: 'Dossier ancien élève introuvable.' });

    const niveau = (req.body.niveau || '').trim();
    const anneeScolaire = (req.body.anneeScolaire || '').trim();
    const trimestre = (req.body.trimestre || '').trim();
    if (!niveau) return res.status(400).json({ erreur: 'Niveau requis.' });
    if (!/^\d{4}-\d{4}$/.test(anneeScolaire)) {
      return res.status(400).json({ erreur: 'Année scolaire invalide (format AAAA-AAAA).' });
    }
    if (!TRIMESTRES.includes(trimestre)) {
      return res.status(400).json({ erreur: `Trimestre invalide (${TRIMESTRES.join(', ')}).` });
    }

    const matieres = (await matiereModel.lister(niveau)).filter((m) => m.actif !== 0);
    const idx = TRIMESTRES.indexOf(trimestre);
    const trimestresAffiches = TRIMESTRES.slice(0, idx + 1);

    const notesParTrim = {};
    const moyennesParTrim = {};
    for (const tr of trimestresAffiches) {
      const notes = await noteModel.notesValideesPourBulletin(idEleve, tr, anneeScolaire);
      const notesMap = {};
      notes.forEach((n) => { notesMap[n.matiere] = { valeur: Number(n.valeur), bareme: Number(n.bareme) || 100 }; });
      notesParTrim[tr] = notesMap;
      moyennesParTrim[tr] = notes.length ? calculerMoyenne(notes).moyenneGenerale : null;
    }

    if (!Object.values(moyennesParTrim).some((m) => m != null)) {
      return res.status(400).json({ erreur: 'Aucune note saisie pour ce niveau/année/trimestre.' });
    }

    // Pas de classement : régénérer un bulletin isolé, des années après coup,
    // ne reconstitue pas le classement réel de la cohorte de l'époque.
    const placesParTrim = {};

    let moyenneAnnuelle = null;
    if (trimestre === '3e_trimestre') {
      const dispo = TRIMESTRES.map((tr) => moyennesParTrim[tr]).filter((v) => v != null);
      moyenneAnnuelle = dispo.length
        ? Math.round((dispo.reduce((a, b) => a + b, 0) / dispo.length) * 100) / 100
        : null;
    }

    // Remplace un éventuel bulletin déjà généré pour ce (dossier, trimestre, année).
    const existant = await documentModel.trouverBulletin(idEleve, trimestre, anneeScolaire);
    if (existant?.url_pdf) {
      const chemin = path.resolve(UPLOAD_ROOT, existant.url_pdf);
      if (chemin.startsWith(path.resolve(UPLOAD_ROOT))) await fs.unlink(chemin).catch(() => {});
      await documentModel.supprimer(existant.id);
    }

    const ecole = await obtenirEcole();
    const { urlPdf, identifiantUnique } = await genererBulletinPDF({
      eleve: { nom_famille: eleve.nom, nom: eleve.nom, prenom: eleve.prenom },
      niveau, trimestre, anneeScolaire, ecoleNom: ecole?.nom || 'Lekòl Pam',
      logoPath: ecole?.logo_url ? path.resolve(UPLOAD_ROOT, ecole.logo_url) : null,
      matieres, notesParTrim, moyennesParTrim, placesParTrim, trimestresAffiches, moyenneAnnuelle,
      seuilReussite: ecole ? Number(ecole.seuil_reussite) : 60,
    });

    const idDoc = await documentModel.creer({
      idEleve, type: 'bulletin', urlPdf, identifiantUnique, periode: trimestre, anneeScolaire,
    });

    // Transmet directement le PDF à l'ancien élève (pas de compte parent à
    // notifier ici) — best-effort : un échec d'envoi ne fait pas échouer la
    // génération, le bulletin reste de toute façon téléchargeable par l'admin.
    if (eleve.courriel_contact) {
      const libelle = LIBELLE_TRIMESTRE[trimestre] || trimestre;
      const nomComplet = [eleve.prenom, eleve.nom].filter(Boolean).join(' ') || eleve.nom;
      const pdfBuffer = await fs.readFile(path.resolve(UPLOAD_ROOT, urlPdf)).catch(() => null);
      try {
        await envoyerCourriel({
          to: eleve.courriel_contact,
          subject: `Lekòl Pam — votre bulletin (${libelle}, ${anneeScolaire})`,
          text: `Bonjour ${nomComplet},\n\nVotre bulletin du ${libelle} (année ${anneeScolaire}) ` +
                `est disponible en pièce jointe.\n\nVous pouvez aussi le retrouver à tout moment en vous ` +
                `connectant avec votre code d'accès sur ${SITE_URL}.`,
          html: `<p>Bonjour ${echapperHtml(nomComplet)},</p>` +
                `<p>Votre bulletin du <strong>${echapperHtml(libelle)}</strong> (année ${echapperHtml(anneeScolaire)}) ` +
                `est disponible en pièce jointe.</p>` +
                `<p>Vous pouvez aussi le retrouver à tout moment en vous connectant avec votre code d'accès ` +
                `sur <a href="${SITE_URL}">${SITE_URL}</a>.</p>`,
          attachments: pdfBuffer
            ? [{ filename: `bulletin-${libelle.replace(/\s+/g, '-')}-${anneeScolaire}.pdf`, content: pdfBuffer.toString('base64') }]
            : undefined,
        });
      } catch (err) {
        console.error('Envoi du bulletin (ancien élève) échoué :', err.message);
      }
    }

    return res.status(201).json({ message: 'Bulletin généré.', id: idDoc, urlPdf, identifiantUnique });
  } catch (err) {
    next(err);
  }
}
