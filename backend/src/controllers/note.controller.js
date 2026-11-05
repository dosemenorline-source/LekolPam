// Contrôleur Notes
import path from 'path';
import * as noteModel from '../models/note.model.js';
import * as matiereModel from '../models/matiere.model.js';
import { trouverAvecProprietaire as trouverEleve, listerParParent as listerElevesParent,
  listerTous as listerTousEleves, listerAvecCode, genererCodeAcces, appartientAuParent,
  trouverParId as trouverEleveParId, mettrePhoto, derniereAnneeScolaire,
  assurerEmissionBadge, mettreInfosBadge }
  from '../models/eleve.model.js';
import { obtenir as obtenirEcole } from '../models/ecole.model.js';
import { findParentIdByUserId } from '../models/user.model.js';
import { existe as publicationExiste } from '../models/publication.model.js';
import { trimestresBloques as trimestresBloquesModel } from '../models/acquittement.model.js';
import { UPLOAD_ROOT } from '../config/upload.js';
import { clientIA, iaConfiguree, MODELE_IA } from '../config/ia.js';
import { calculerMoyenne } from '../services/moyenne.service.js';

const TRIMESTRES = ['1er_trimestre', '2e_trimestre', '3e_trimestre'];
const LIBELLE_TRIMESTRE = {
  '1er_trimestre': '1er trimestre',
  '2e_trimestre': '2e trimestre',
  '3e_trimestre': '3e trimestre',
};

function estAdmin(req) {
  return req.session.role === 'admin' || req.session.role === 'direction';
}

// POST /api/notes (admin)
export async function creer(req, res, next) {
  try {
    const idEleve = Number(req.body.idEleve);
    const idMatiere = Number(req.body.idMatiere);
    const periode = (req.body.periode || '').trim();
    const anneeScolaire = (req.body.anneeScolaire || '').trim();
    const valeur = Number(req.body.valeur);
    const bareme = req.body.bareme === undefined || req.body.bareme === '' ? 100 : Number(req.body.bareme);

    if (!idEleve || !idMatiere || !anneeScolaire) {
      return res.status(400).json({ erreur: 'idEleve, idMatiere et anneeScolaire requis.' });
    }
    if (!TRIMESTRES.includes(periode)) {
      return res.status(400).json({ erreur: `Trimestre invalide (${TRIMESTRES.join(', ')}).` });
    }
    if (!Number.isFinite(bareme) || bareme <= 0) {
      return res.status(400).json({ erreur: 'Barème invalide (doit être un nombre positif).' });
    }
    if (!Number.isFinite(valeur) || valeur < 0 || valeur > bareme) {
      return res.status(400).json({ erreur: `Valeur invalide (0 à ${bareme}).` });
    }

    const eleve = await trouverEleveParId(idEleve);
    if (!eleve) return res.status(404).json({ erreur: 'Élève introuvable.' });

    const matiere = await matiereModel.trouverParId(idMatiere);
    if (!matiere) return res.status(404).json({ erreur: 'Matière introuvable.' });

    const id = await noteModel.creer({
      idEleve, idMatiere, matiere: matiere.nom, niveau: matiere.niveau, periode, anneeScolaire, valeur, bareme,
      saisiePar: req.session.userId,
    });
    return res.status(201).json({ note: { id, idEleve, matiere: matiere.nom, periode, valeur, bareme, statut: 'saisie' } });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/notes/:id (admin) — corriger la valeur, sauf si le trimestre est publié
export async function mettreAJour(req, res, next) {
  try {
    const note = await noteModel.trouverParId(Number(req.params.id));
    if (!note) return res.status(404).json({ erreur: 'Note introuvable.' });

    const valeur = Number(req.body.valeur);
    const bareme = req.body.bareme === undefined || req.body.bareme === '' ? Number(note.bareme) || 100 : Number(req.body.bareme);
    if (!Number.isFinite(bareme) || bareme <= 0) {
      return res.status(400).json({ erreur: 'Barème invalide (doit être un nombre positif).' });
    }
    if (!Number.isFinite(valeur) || valeur < 0 || valeur > bareme) {
      return res.status(400).json({ erreur: `Valeur invalide (0 à ${bareme}).` });
    }

    if (await publicationExiste(note.niveau, note.annee_scolaire, note.periode)) {
      return res.status(409).json({ erreur: 'Trimestre déjà publié : la note ne peut plus être modifiée.' });
    }

    await noteModel.mettreAJourValeur(note.id, valeur, bareme);
    return res.json({ message: 'Note mise à jour.' });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/notes/:id (admin) — sauf si le trimestre est publié
export async function supprimer(req, res, next) {
  try {
    const note = await noteModel.trouverParId(Number(req.params.id));
    if (!note) return res.status(404).json({ erreur: 'Note introuvable.' });

    if (await publicationExiste(note.niveau, note.annee_scolaire, note.periode)) {
      return res.status(409).json({ erreur: 'Trimestre déjà publié : la note ne peut plus être supprimée.' });
    }

    await noteModel.supprimer(note.id);
    return res.json({ message: 'Note supprimée.' });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/notes/:id/valider (admin)
export async function valider(req, res, next) {
  try {
    const note = await noteModel.trouverParId(Number(req.params.id));
    if (!note) return res.status(404).json({ erreur: 'Note introuvable.' });
    await noteModel.valider(note.id);
    return res.json({ message: 'Note validée.' });
  } catch (err) {
    next(err);
  }
}

// GET /api/admin/notes (admin/direction)
export async function listerAdmin(req, res, next) {
  try {
    const notes = await noteModel.listerAdmin({
      niveau: req.query.niveau, periode: req.query.periode, anneeScolaire: req.query.anneeScolaire,
    });
    return res.json({ notes });
  } catch (err) {
    next(err);
  }
}

// GET /api/admin/eleves?niveau= (admin/direction) — liste des élèves pour la saisie
export async function listerElevesAdmin(req, res, next) {
  try {
    return res.json({ eleves: await listerTousEleves({ niveau: req.query.niveau }) });
  } catch (err) {
    next(err);
  }
}

// GET /api/mes-eleves (parent) — la liste de ses enfants
export async function listerMesEleves(req, res, next) {
  try {
    const idParent = await findParentIdByUserId(req.session.userId);
    if (!idParent) return res.status(403).json({ erreur: 'Compte parent requis.' });
    return res.json({ eleves: await listerElevesParent(idParent) });
  } catch (err) {
    next(err);
  }
}

// POST /api/eleves/:id/code-acces (parent propriétaire) — génère le code s'il n'existe pas.
// Le code est unique et permanent : on ne le régénère jamais.
export async function genererCodeAccesEleve(req, res, next) {
  try {
    const idEleve = Number(req.params.id);
    const idParent = await findParentIdByUserId(req.session.userId);
    if (!idParent) return res.status(403).json({ erreur: 'Compte parent requis.' });
    if (!(await appartientAuParent(idEleve, idParent))) {
      return res.status(403).json({ erreur: 'Cet élève ne vous appartient pas.' });
    }
    const eleve = await trouverEleveParId(idEleve);
    if (!eleve) return res.status(404).json({ erreur: 'Élève introuvable.' });
    if (eleve.code_acces) return res.json({ code: eleve.code_acces }); // déjà attribué → inchangé

    const code = await genererCodeAcces(idEleve);
    return res.status(201).json({ code });
  } catch (err) {
    next(err);
  }
}

// GET /api/admin/eleves-codes (admin/direction) — tous les codes d'accès élèves
export async function listerElevesCodes(req, res, next) {
  try {
    const eleves = await listerAvecCode({ recherche: req.query.recherche });
    return res.json({ eleves });
  } catch (err) {
    next(err);
  }
}

// POST /api/admin/eleves/:id/code-acces (admin/direction) — génère le code s'il n'existe pas.
// Code unique et permanent : jamais régénéré.
export async function genererCodeAccesAdmin(req, res, next) {
  try {
    const idEleve = Number(req.params.id);
    const eleve = await trouverEleveParId(idEleve);
    if (!eleve) return res.status(404).json({ erreur: 'Élève introuvable.' });
    if (eleve.code_acces) return res.json({ code: eleve.code_acces }); // déjà attribué → inchangé

    const code = await genererCodeAcces(idEleve);
    return res.status(201).json({ code });
  } catch (err) {
    next(err);
  }
}

// Normalise une valeur date en 'YYYY-MM-DD' (gère Date ou chaîne, sans dérive de fuseau)
function isoDate(v) {
  if (!v) return null;
  if (typeof v === 'string') {
    const s = v.slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
  }
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const j = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${j}`;
}
// Ajoute n années à une date 'YYYY-MM-DD' par calcul de composants (aucun fuseau en jeu)
function ajouterAns(v, n) {
  const s = isoDate(v);
  if (!s) return null;
  const [y, m, j] = s.split('-');
  return `${Number(y) + n}-${m}-${j}`;
}

// Construit le contenu complet du badge (carte ID recto/verso) pour un élève.
// Les champs « badge_* » sont des surcharges saisies par le secrétariat : si
// présentes elles priment, sinon le badge retombe sur la valeur automatique.
async function construireBadge(eleve) {
  const anneeAuto = await derniereAnneeScolaire(eleve.id);
  const ecole = await obtenirEcole();
  const dateEmission = isoDate(await assurerEmissionBadge(eleve.id));
  const dateExpiration = ajouterAns(dateEmission, 1); // expire 1 an après l'émission

  const nom = eleve.badge_nom || eleve.nom;
  const prenom = eleve.badge_prenom || eleve.prenom || '';
  const niveau = eleve.badge_classe || eleve.niveau;
  const anneeScolaire = eleve.badge_annee || anneeAuto;

  return {
    id: eleve.id,
    nom,
    prenom,
    niveau,
    anneeScolaire,
    nisu: eleve.code_acces,
    aPhoto: !!eleve.photo_url,
    groupeSanguin: eleve.groupe_sanguin || null,
    dateEmission,
    dateExpiration,
    ecoleNom: ecole?.nom || 'Lekòl Pam',
    ecoleAdresse: ecole?.adresse || null,
    ecoleTelephone: ecole?.telephone || null,
    ecoleCourriel: ecole?.courriel || null,
    ecoleALogo: !!(ecole && ecole.logo_url),
    // Valeurs brutes de surcharge (pour préremplir le formulaire de modification)
    modif: {
      groupeSanguin: eleve.groupe_sanguin || '',
      badgeNom: eleve.badge_nom || '',
      badgePrenom: eleve.badge_prenom || '',
      badgeClasse: eleve.badge_classe || '',
      badgeAnnee: eleve.badge_annee || '',
      badgeEmisLe: isoDate(eleve.badge_emis_le) || '',
    },
    // Valeurs automatiques (affichées en indication/placeholder dans le formulaire)
    auto: {
      nom: eleve.nom || '',
      prenom: eleve.prenom || '',
      niveau: eleve.niveau || '',
      anneeScolaire: anneeAuto || '',
    },
  };
}

// GET /api/eleve/badge (session élève) — données du badge
export async function badgeEleve(req, res, next) {
  try {
    const eleve = await trouverEleveParId(req.session.eleveId);
    if (!eleve) return res.status(404).json({ erreur: 'Élève introuvable.' });
    return res.json({ badge: await construireBadge(eleve) });
  } catch (err) {
    next(err);
  }
}

// GET /api/admin/eleves/:id/badge (admin/direction) — badge d'un élève donné
export async function badgeEleveAdmin(req, res, next) {
  try {
    const eleve = await trouverEleveParId(Number(req.params.id));
    if (!eleve) return res.status(404).json({ erreur: 'Élève introuvable.' });
    return res.json({ badge: await construireBadge(eleve) });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/admin/eleves/:id/badge-infos (admin/direction) — surcharges du badge
export async function majInfosBadgeEleve(req, res, next) {
  try {
    const eleve = await trouverEleveParId(Number(req.params.id));
    if (!eleve) return res.status(404).json({ erreur: 'Élève introuvable.' });

    const t = (v) => (v == null ? '' : String(v)).trim();
    const groupeSanguin = t(req.body.groupeSanguin).toUpperCase();
    if (groupeSanguin && !/^(A|B|AB|O)[+-]$/.test(groupeSanguin)) {
      return res.status(400).json({ erreur: 'Groupe sanguin invalide (ex. A+, O-, AB+).' });
    }
    const badgeAnnee = t(req.body.badgeAnnee);
    if (badgeAnnee && !/^\d{4}-\d{4}$/.test(badgeAnnee)) {
      return res.status(400).json({ erreur: 'Année académique invalide (ex. 2025-2026).' });
    }
    const badgeEmisLe = t(req.body.badgeEmisLe);
    if (badgeEmisLe && !/^\d{4}-\d{2}-\d{2}$/.test(badgeEmisLe)) {
      return res.status(400).json({ erreur: "Date d'émission invalide." });
    }

    await mettreInfosBadge(eleve.id, {
      groupeSanguin,
      badgeNom: t(req.body.badgeNom),
      badgePrenom: t(req.body.badgePrenom),
      badgeClasse: t(req.body.badgeClasse),
      badgeAnnee,
      badgeEmisLe,
    });

    const maj = await trouverEleveParId(eleve.id);
    return res.json({ badge: await construireBadge(maj) });
  } catch (err) {
    next(err);
  }
}

// GET /api/admin/eleves/:id/photo (admin/direction) — sert la photo d'un élève
export async function servirPhotoEleveAdmin(req, res, next) {
  try {
    const eleve = await trouverEleveParId(Number(req.params.id));
    if (!eleve || !eleve.photo_url) return res.status(404).json({ erreur: 'Aucune photo.' });
    const chemin = path.resolve(UPLOAD_ROOT, eleve.photo_url);
    if (!chemin.startsWith(path.resolve(UPLOAD_ROOT))) {
      return res.status(400).json({ erreur: 'Chemin invalide.' });
    }
    return res.sendFile(chemin);
  } catch (err) {
    next(err);
  }
}

// POST /api/admin/eleves/:id/photo (admin/direction, multipart) — secrétariat ajoute la photo
export async function televerserPhotoEleveAdmin(req, res, next) {
  try {
    const eleve = await trouverEleveParId(Number(req.params.id));
    if (!eleve) return res.status(404).json({ erreur: 'Élève introuvable.' });
    if (!req.file) return res.status(400).json({ erreur: 'Photo requise (JPG ou PNG, max 5 Mo).' });
    await mettrePhoto(eleve.id, `photos/${req.file.filename}`);
    return res.status(201).json({ message: 'Photo enregistrée.' });
  } catch (err) {
    next(err);
  }
}

// POST /api/eleve/photo (session élève, multipart) — l'élève téléverse sa photo
export async function televerserPhotoEleve(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ erreur: 'Photo requise (JPG ou PNG, max 5 Mo).' });
    const url = `photos/${req.file.filename}`;
    await mettrePhoto(req.session.eleveId, url);
    return res.status(201).json({ message: 'Photo enregistrée.' });
  } catch (err) {
    next(err);
  }
}

// GET /api/eleve/photo (session élève) — sert la photo de l'élève connecté
export async function servirPhotoEleve(req, res, next) {
  try {
    const eleve = await trouverEleveParId(req.session.eleveId);
    if (!eleve || !eleve.photo_url) return res.status(404).json({ erreur: 'Aucune photo.' });
    const chemin = path.resolve(UPLOAD_ROOT, eleve.photo_url);
    if (!chemin.startsWith(path.resolve(UPLOAD_ROOT))) {
      return res.status(400).json({ erreur: 'Chemin invalide.' });
    }
    return res.sendFile(chemin);
  } catch (err) {
    next(err);
  }
}

// GET /api/eleve/mes-notes (session élève) — notes validées + publiées, lecture seule
export async function listerMesNotesEleve(req, res, next) {
  try {
    const notes = await noteModel.listerPourEleve(req.session.eleveId, {
      periode: req.query.periode,
      anneeScolaire: req.query.anneeScolaire,
      seulementVisibles: true,
    });
    const trimestresBloques = await trimestresBloquesModel(req.session.eleveId);
    return res.json({ notes, trimestresBloques });
  } catch (err) {
    next(err);
  }
}

// POST /api/eleve/appreciation-ia (session élève) — appréciation/critique IA d'un trimestre
export async function appreciationIaEleve(req, res, next) {
  try {
    if (!iaConfiguree()) {
      return res.status(503).json({ erreur: "L'assistant IA n'est pas configuré (clé GROQ_API_KEY manquante côté serveur)." });
    }
    const periode = TRIMESTRES.includes(req.body.periode) ? req.body.periode : null;
    const anneeScolaire = (req.body.anneeScolaire || '').trim();
    if (!periode || !anneeScolaire) {
      return res.status(400).json({ erreur: 'Trimestre ou année scolaire invalide.' });
    }

    // On récupère les notes côté serveur (uniquement validées, publiées et non bloquées).
    const notes = await noteModel.listerPourEleve(req.session.eleveId, {
      periode, anneeScolaire, seulementVisibles: true,
    });
    if (!notes.length) {
      return res.status(400).json({ erreur: 'Aucune note disponible pour ce trimestre.' });
    }

    // Moyenne pondérée (chaque note conserve son propre barème) + lignes de
    // contexte pour l'IA.
    const { lignes: lignesMoyenne, moyenneGenerale } = calculerMoyenne(notes);
    const moyenne = moyenneGenerale;
    const lignes = lignesMoyenne
      .filter((l) => l.valeur != null)
      .map((l) => `- ${l.matiere} : ${Number(l.valeur).toFixed(2)}/${Number(l.bareme).toFixed(0)} (coefficient ${l.coefficient})`);

    const client = clientIA();
    const completion = await client.chat.completions.create({
      model: MODELE_IA,
      temperature: 0.6,
      max_tokens: 600,
      messages: [
        {
          role: 'system',
          content: "Tu es un conseiller pédagogique bienveillant de l'école « Lekòl Pam ». Tu rédiges une appréciation de bulletin en français, adressée à l'élève et à ses parents. Sois encourageant, honnête et constructif : souligne les points forts, identifie les matières à améliorer, et donne 1 ou 2 conseils concrets. N'utilise pas d'emojis. Base-toi UNIQUEMENT sur les notes fournies, n'invente aucun chiffre. Réponds en 3 à 5 phrases, sans titre ni liste.",
        },
        {
          role: 'user',
          content: `Voici les résultats de l'élève pour le ${LIBELLE_TRIMESTRE[periode]} (année ${anneeScolaire}).\n`
            + `Moyenne pondérée : ${moyenne.toFixed(2)}/100.\n`
            + `Notes par matière :\n${lignes.join('\n')}\n\n`
            + 'Rédige une appréciation globale du bulletin.',
        },
      ],
    });

    const appreciation = (completion.choices?.[0]?.message?.content || '').trim();
    if (!appreciation) {
      return res.status(502).json({ erreur: "L'assistant IA n'a pas pu générer d'appréciation." });
    }
    return res.json({ appreciation, moyenne: Math.round(moyenne * 100) / 100 });
  } catch (err) {
    if (err && (err.status === 401 || err.status === 403)) {
      return res.status(503).json({ erreur: 'Clé Groq invalide ou sans accès. Vérifiez GROQ_API_KEY.' });
    }
    next(err);
  }
}

// GET /api/eleves/:id/notes (propriétaire ou admin/direction)
export async function listerPourEleve(req, res, next) {
  try {
    const eleve = await trouverEleve(Number(req.params.id));
    if (!eleve) return res.status(404).json({ erreur: 'Élève introuvable.' });

    const admin = estAdmin(req);
    if (!admin && eleve.id_utilisateur !== req.session.userId) {
      return res.status(403).json({ erreur: 'Accès refusé.' });
    }

    const notes = await noteModel.listerPourEleve(eleve.id, {
      periode: req.query.periode,
      anneeScolaire: req.query.anneeScolaire,
      seulementVisibles: !admin, // familles : uniquement validées + publiées
    });
    // Familles : signaler les trimestres publiés mais bloqués (non acquittés).
    const trimestresBloques = admin ? [] : await trimestresBloquesModel(eleve.id);
    return res.json({ notes, trimestresBloques });
  } catch (err) {
    next(err);
  }
}
