// Contrôleur « Examens passés » — galerie publique + gestion par l'admin dédié (système indépendant)
import bcrypt from 'bcryptjs';
import { comparerMotDePasse } from '../utils/motDePasse.js';
import { adminBloque, adminEchec, adminSucces } from '../services/securite.service.js';
import path from 'path';
import * as examenModel from '../models/examens.model.js';
import * as adminModel from '../models/examensAdmin.model.js';
import { UPLOAD_ROOT } from '../config/upload.js';
import { clientIA, iaConfiguree, MODELE_IA } from '../config/ia.js';
import { regenererSession } from '../middleware/auth.js';

// ---------- Authentification admin Examens ----------

// POST /api/examens/admin/login
export async function adminLogin(req, res, next) {
  try {
    const identifiant = (req.body.identifiant || '').trim();
    const motDePasse = req.body.motDePasse || '';
    if (!identifiant || !motDePasse) {
      return res.status(400).json({ erreur: 'Identifiant et mot de passe requis.' });
    }
    if (adminBloque('examens', identifiant, req)) {
      return res.status(429).json({ erreur: 'Trop de tentatives pour ce compte. Réessayez plus tard.' });
    }
    const admin = await adminModel.trouverParIdentifiant(identifiant);
    const ok = await comparerMotDePasse(motDePasse, admin?.mot_de_passe_hash);
    if (!admin || !ok) {
      adminEchec('examens', identifiant, req);
      return res.status(401).json({ erreur: 'Identifiants invalides.' });
    }
    adminSucces('examens', identifiant, req);
    await regenererSession(req);
    req.session.examensAdminId = admin.id;
    return res.json({ admin: { id: admin.id, identifiant: admin.identifiant } });
  } catch (err) {
    next(err);
  }
}

// POST /api/examens/admin/logout
export function adminLogout(req, res) {
  delete req.session.examensAdminId;
  return res.json({ message: 'Déconnecté de l\'espace Examens.' });
}

// GET /api/examens/admin/me
export async function adminMe(req, res, next) {
  try {
    if (!req.session.examensAdminId) return res.status(401).json({ erreur: 'Non authentifié.' });
    const admin = await adminModel.trouverParId(req.session.examensAdminId);
    if (!admin) return res.status(401).json({ erreur: 'Non authentifié.' });
    return res.json({ admin: { id: admin.id, identifiant: admin.identifiant } });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/examens/admin/compte — changer son propre identifiant et/ou mot
// de passe. Le mot de passe actuel est toujours exigé.
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

    const admin = await adminModel.trouverParIdAvecHash(req.session.examensAdminId);
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

// ---------- Examens ----------

// GET /api/examens?niveau=... (public)
export async function lister(req, res, next) {
  try {
    const niveau = (req.query.niveau || '').trim() || undefined;
    return res.json({ examens: await examenModel.lister(niveau) });
  } catch (err) {
    next(err);
  }
}

// POST /api/examens (admin, multipart : photo requise)
export async function creer(req, res, next) {
  try {
    const niveau = (req.body.niveau || '').trim();
    const titre = (req.body.titre || '').trim();
    if (!niveau) return res.status(400).json({ erreur: 'Le niveau / la classe est requis.' });
    if (niveau.length > 60) return res.status(400).json({ erreur: 'Le niveau est trop long (max 60 caractères).' });
    if (!req.file) return res.status(400).json({ erreur: 'La photo de la feuille d\'examen est requise (JPG ou PNG, max 5 Mo).' });

    const photoUrl = `examens/${req.file.filename}`;
    const id = await examenModel.creer({
      niveau, titre, photoUrl, idExamensAdmin: req.session.examensAdminId,
    });
    return res.status(201).json({ examen: { id, niveau, titre: titre || null, photo_url: photoUrl } });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/examens/:id (admin)
export async function supprimer(req, res, next) {
  try {
    const examen = await examenModel.trouverParId(Number(req.params.id));
    if (!examen) return res.status(404).json({ erreur: 'Examen introuvable.' });
    await examenModel.supprimer(examen.id);
    return res.json({ message: 'Examen supprimé.' });
  } catch (err) {
    next(err);
  }
}

// POST /api/examens/aide-ia (public) — tuteur IA : aide un élève bloqué sur un exercice
export async function aideIA(req, res, next) {
  try {
    if (!iaConfiguree()) {
      return res.status(503).json({ erreur: "L'assistant IA n'est pas configuré (clé GROQ_API_KEY manquante côté serveur)." });
    }
    const question = (req.body.question || '').trim();
    const niveau = (req.body.niveau || '').trim().slice(0, 60);
    if (!question) return res.status(400).json({ erreur: "Décris l'exercice ou la question où tu es bloqué(e)." });
    if (question.length > 2000) return res.status(400).json({ erreur: 'Ta question est trop longue (max 2000 caractères).' });

    const client = clientIA();
    const completion = await client.chat.completions.create({
      model: MODELE_IA,
      temperature: 0.4,
      max_tokens: 900,
      messages: [
        {
          role: 'system',
          content: "Tu es un tuteur scolaire bienveillant et patient de l'école « Lekòl Pam », pour des élèves haïtiens. "
            + "Un élève est bloqué sur un exercice d'examen. Aide-le à comprendre et à résoudre l'exercice ÉTAPE PAR ÉTAPE, "
            + "avec des explications claires et simples, en français"
            + (niveau ? ` (niveau de l'élève : ${niveau})` : '') + ". "
            + "Explique le raisonnement et la méthode, pas seulement la réponse finale, pour qu'il apprenne. "
            + "Encourage-le. Si l'énoncé est ambigu ou incomplet, demande une précision. Reste uniquement sur des sujets scolaires. "
            + "N'utilise pas d'emojis.",
        },
        { role: 'user', content: question },
      ],
    });

    const reponse = (completion.choices?.[0]?.message?.content || '').trim();
    if (!reponse) return res.status(502).json({ erreur: "L'assistant IA n'a pas pu répondre." });
    return res.json({ reponse });
  } catch (err) {
    if (err && (err.status === 401 || err.status === 403)) {
      return res.status(503).json({ erreur: 'Clé Groq invalide ou sans accès. Vérifiez GROQ_API_KEY.' });
    }
    next(err);
  }
}

// GET /api/examens/:id/photo (public) — sert la photo d'une feuille d'examen
export async function servirPhoto(req, res, next) {
  try {
    const examen = await examenModel.trouverParId(Number(req.params.id));
    if (!examen || !examen.photo_url) return res.status(404).json({ erreur: 'Aucune photo.' });
    const chemin = path.resolve(UPLOAD_ROOT, examen.photo_url);
    if (!chemin.startsWith(path.resolve(UPLOAD_ROOT))) {
      return res.status(400).json({ erreur: 'Chemin invalide.' });
    }
    return res.sendFile(chemin);
  } catch (err) {
    next(err);
  }
}
