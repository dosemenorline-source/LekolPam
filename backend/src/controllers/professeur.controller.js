// Contrôleur Corps enseignant — fiches publiques + gestion par l'admin dédié (système indépendant)
import bcrypt from 'bcryptjs';
import { comparerMotDePasse } from '../utils/motDePasse.js';
import { adminBloque, adminEchec, adminSucces } from '../services/securite.service.js';
import path from 'path';
import fs from 'fs';
import * as profModel from '../models/professeur.model.js';
import * as adminModel from '../models/profsAdmin.model.js';
import { UPLOAD_ROOT } from '../config/upload.js';
import { clientIA, iaConfiguree, MODELE_IA } from '../config/ia.js';
import { regenererSession } from '../middleware/auth.js';

// ---------- Authentification admin enseignants ----------

// POST /api/professeurs/admin/login
export async function adminLogin(req, res, next) {
  try {
    const identifiant = (req.body.identifiant || '').trim();
    const motDePasse = req.body.motDePasse || '';
    if (!identifiant || !motDePasse) {
      return res.status(400).json({ erreur: 'Identifiant et mot de passe requis.' });
    }

    if (adminBloque('enseignants', identifiant, req)) {
      return res.status(429).json({ erreur: 'Trop de tentatives pour ce compte. Réessayez plus tard.' });
    }
    const admin = await adminModel.trouverParIdentifiant(identifiant);

    const ok = await comparerMotDePasse(motDePasse, admin?.mot_de_passe_hash);
    if (!admin || !ok) {
      adminEchec('enseignants', identifiant, req);
      return res.status(401).json({ erreur: 'Identifiants invalides.' });
    }
    adminSucces('enseignants', identifiant, req);

    await regenererSession(req);
    req.session.profsAdminId = admin.id;
    return res.json({ admin: { id: admin.id, identifiant: admin.identifiant } });
  } catch (err) {
    next(err);
  }
}

// POST /api/professeurs/admin/logout
export function adminLogout(req, res) {
  delete req.session.profsAdminId;
  return res.json({ message: 'Déconnecté de l\'espace enseignants.' });
}

// GET /api/professeurs/admin/me
export async function adminMe(req, res, next) {
  try {
    if (!req.session.profsAdminId) return res.status(401).json({ erreur: 'Non authentifié.' });
    const admin = await adminModel.trouverParId(req.session.profsAdminId);
    if (!admin) return res.status(401).json({ erreur: 'Non authentifié.' });
    return res.json({ admin: { id: admin.id, identifiant: admin.identifiant } });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/professeurs/admin/compte — changer son propre identifiant et/ou
// mot de passe. Le mot de passe actuel est toujours exigé.
export async function modifierCompte(req, res, next) {
  try {
    const motDePasseActuel = req.body.motDePasseActuel || '';
    const nouvelIdentifiant = req.body.nouvelIdentifiant ? String(req.body.nouvelIdentifiant).trim() : null;
    const nouveauMotDePasse = req.body.nouveauMotDePasse || '';

    if (!motDePasseActuel) return res.status(400).json({ erreur: 'Mot de passe actuel requis.' });
    if (!nouvelIdentifiant && !nouveauMotDePasse) return res.status(400).json({ erreur: 'Rien à modifier.' });
    if (nouveauMotDePasse && nouveauMotDePasse.length < 8) {
      return res.status(400).json({ erreur: 'Le nouveau mot de passe doit contenir au moins 8 caractères.' });
    }

    const admin = await adminModel.trouverParIdAvecHash(req.session.profsAdminId);
    if (!admin) return res.status(404).json({ erreur: 'Compte introuvable.' });

    const motDePasseValide = await bcrypt.compare(motDePasseActuel, admin.mot_de_passe_hash);
    if (!motDePasseValide) return res.status(401).json({ erreur: 'Mot de passe actuel incorrect.' });

    if (nouvelIdentifiant && nouvelIdentifiant !== admin.identifiant) {
      const existant = await adminModel.trouverParIdentifiant(nouvelIdentifiant);
      if (existant) return res.status(409).json({ erreur: 'Cet identifiant est déjà utilisé par un autre compte.' });
      await adminModel.mettreAJourIdentifiant(admin.id, nouvelIdentifiant);
    }
    if (nouveauMotDePasse) {
      const hash = await bcrypt.hash(nouveauMotDePasse, 12);
      await adminModel.mettreAJourMotDePasse(admin.id, hash);
    }

    return res.json({ message: 'Compte mis à jour.' });
  } catch (err) {
    next(err);
  }
}

// POST /api/professeurs/redaction-ia (admin enseignants) — rédige le
// parcours (biographie) d'un professeur à partir des infos déjà saisies.
export async function redactionIA(req, res, next) {
  try {
    if (!iaConfiguree()) {
      return res.status(503).json({ erreur: "L'assistant IA n'est pas configuré (clé GROQ_API_KEY manquante côté serveur)." });
    }
    const nom = (req.body.nom || '').trim();
    if (!nom) return res.status(400).json({ erreur: 'Le nom du professeur est requis.' });
    const elements = (req.body.elements || '').trim();
    if (elements.length > 800) return res.status(400).json({ erreur: 'Les éléments fournis sont trop longs (max 800 caractères).' });

    const contexte = [
      `Nom : ${[req.body.prenom, nom].filter(Boolean).join(' ')}`,
      req.body.matiere ? `Matière enseignée : ${req.body.matiere}` : null,
      req.body.fonction ? `Fonction : ${req.body.fonction}` : null,
      req.body.diplomes ? `Diplômes / formation : ${req.body.diplomes}` : null,
      req.body.experienceAnnees ? `Années d'expérience : ${req.body.experienceAnnees}` : null,
      elements ? `Éléments supplémentaires fournis par le secrétariat : ${elements}` : null,
    ].filter(Boolean).join('\n');

    const client = clientIA();
    const completion = await client.chat.completions.create({
      model: MODELE_IA,
      temperature: 0.7,
      max_tokens: 400,
      messages: [
        {
          role: 'system',
          content: "Tu es le chargé de communication de l'école « Lekòl Pam ». Tu rédiges une courte biographie professionnelle (le « parcours ») d'un membre du corps enseignant, pour la page publique du site. Style clair, chaleureux et professionnel, en français, à la troisième personne. N'utilise pas d'emojis. N'invente aucun diplôme, aucune année d'expérience ni aucun établissement qui n'est pas mentionné dans le contexte fourni. Réponds UNIQUEMENT avec le texte de la biographie (3 à 5 phrases), sans titre, sans guillemets et sans préambule.",
        },
        {
          role: 'user',
          content: `Rédige le parcours à partir de ce contexte :\n${contexte}`,
        },
      ],
    });

    const parcours = (completion.choices?.[0]?.message?.content || '').trim();
    if (!parcours) return res.status(502).json({ erreur: "L'assistant IA n'a pas pu générer de texte." });
    return res.json({ parcours });
  } catch (err) {
    if (err && (err.status === 401 || err.status === 403)) {
      return res.status(503).json({ erreur: 'Clé Groq invalide ou sans accès. Vérifiez GROQ_API_KEY.' });
    }
    next(err);
  }
}

// ---------- Fiches professeurs ----------

// Extrait et valide les champs d'une fiche depuis req (multipart). partiel = mise à jour.
function lireChamps(req, partiel = false) {
  const champs = {};
  const b = req.body;

  if (b.nom !== undefined || !partiel) champs.nom = (b.nom || '').trim();
  if (b.prenom !== undefined) champs.prenom = (b.prenom || '').trim() || null;
  if (b.matiere !== undefined) champs.matiere = (b.matiere || '').trim() || null;
  if (b.fonction !== undefined) champs.fonction = (b.fonction || '').trim() || null;
  if (b.diplomes !== undefined) champs.diplomes = (b.diplomes || '').trim() || null;
  if (b.parcours !== undefined) champs.parcours = (b.parcours || '').trim() || null;
  if (b.experienceAnnees !== undefined) {
    const val = String(b.experienceAnnees).trim();
    champs.experienceAnnees = val === '' ? null : Number(val);
  }
  return champs;
}

// GET /api/professeurs (public)
export async function lister(req, res, next) {
  try {
    return res.json({ professeurs: await profModel.lister() });
  } catch (err) {
    next(err);
  }
}

// POST /api/professeurs (admin, multipart : photo optionnelle)
export async function creer(req, res, next) {
  try {
    const champs = lireChamps(req, false);
    if (!champs.nom) return res.status(400).json({ erreur: 'Le nom est requis.' });
    if (champs.experienceAnnees !== undefined && champs.experienceAnnees !== null
        && (Number.isNaN(champs.experienceAnnees) || champs.experienceAnnees < 0)) {
      return res.status(400).json({ erreur: 'Les années d\'expérience doivent être un nombre positif.' });
    }

    const photoUrl = req.file ? `professeurs/${req.file.filename}` : null;
    const id = await profModel.creer({ ...champs, photoUrl, idProfsAdmin: req.session.profsAdminId });
    return res.status(201).json({ professeur: { id, ...champs, photo_url: photoUrl } });
  } catch (err) {
    next(err);
  }
}

// PUT /api/professeurs/:id (admin, multipart : photo optionnelle)
export async function modifier(req, res, next) {
  try {
    const prof = await profModel.trouverParId(Number(req.params.id));
    if (!prof) return res.status(404).json({ erreur: 'Professeur introuvable.' });

    const champs = lireChamps(req, true);
    if (champs.nom !== undefined && !champs.nom) {
      return res.status(400).json({ erreur: 'Le nom est requis.' });
    }
    if (champs.experienceAnnees !== undefined && champs.experienceAnnees !== null
        && (Number.isNaN(champs.experienceAnnees) || champs.experienceAnnees < 0)) {
      return res.status(400).json({ erreur: 'Les années d\'expérience doivent être un nombre positif.' });
    }

    // Nouvelle photo : on remplace et on supprime l'ancienne du disque
    if (req.file) {
      champs.photoUrl = `professeurs/${req.file.filename}`;
      if (prof.photo_url) supprimerFichier(prof.photo_url);
    }

    await profModel.majChamps(prof.id, champs);
    return res.json({ professeur: await profModel.trouverParId(prof.id) });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/professeurs/:id (admin)
export async function supprimer(req, res, next) {
  try {
    const prof = await profModel.trouverParId(Number(req.params.id));
    if (!prof) return res.status(404).json({ erreur: 'Professeur introuvable.' });
    if (prof.photo_url) supprimerFichier(prof.photo_url);
    await profModel.supprimer(prof.id);
    return res.json({ message: 'Fiche supprimée.' });
  } catch (err) {
    next(err);
  }
}

// GET /api/professeurs/:id/photo (public) — sert la photo d'une fiche
export async function servirPhoto(req, res, next) {
  try {
    const prof = await profModel.trouverParId(Number(req.params.id));
    if (!prof || !prof.photo_url) return res.status(404).json({ erreur: 'Aucune photo.' });
    const chemin = path.resolve(UPLOAD_ROOT, prof.photo_url);
    if (!chemin.startsWith(path.resolve(UPLOAD_ROOT))) {
      return res.status(400).json({ erreur: 'Chemin invalide.' });
    }
    return res.sendFile(chemin);
  } catch (err) {
    next(err);
  }
}

// Supprime un fichier téléversé (best effort, sans planter la requête)
function supprimerFichier(cheminRelatif) {
  try {
    const abs = path.resolve(UPLOAD_ROOT, cheminRelatif);
    if (abs.startsWith(path.resolve(UPLOAD_ROOT)) && fs.existsSync(abs)) fs.unlinkSync(abs);
  } catch { /* ignoré */ }
}
