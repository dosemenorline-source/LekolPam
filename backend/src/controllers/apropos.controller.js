// Contrôleur « À propos » — sections publiques + gestion par l'admin dédié (système indépendant)
import bcrypt from 'bcryptjs';
import { comparerMotDePasse } from '../utils/motDePasse.js';
import { adminBloque, adminEchec, adminSucces } from '../services/securite.service.js';
import * as sectionModel from '../models/apropos.model.js';
import * as adminModel from '../models/aproposAdmin.model.js';
import { clientIA, iaConfiguree, MODELE_IA } from '../config/ia.js';
import { regenererSession } from '../middleware/auth.js';

// ---------- Authentification admin À propos ----------

// POST /api/apropos/admin/login
export async function adminLogin(req, res, next) {
  try {
    const identifiant = (req.body.identifiant || '').trim();
    const motDePasse = req.body.motDePasse || '';
    if (!identifiant || !motDePasse) {
      return res.status(400).json({ erreur: 'Identifiant et mot de passe requis.' });
    }

    if (adminBloque('apropos', identifiant, req)) {
      return res.status(429).json({ erreur: 'Trop de tentatives pour ce compte. Réessayez plus tard.' });
    }
    const admin = await adminModel.trouverParIdentifiant(identifiant);

    const ok = await comparerMotDePasse(motDePasse, admin?.mot_de_passe_hash);
    if (!admin || !ok) {
      adminEchec('apropos', identifiant, req);
      return res.status(401).json({ erreur: 'Identifiants invalides.' });
    }
    adminSucces('apropos', identifiant, req);

    await regenererSession(req);
    req.session.aproposAdminId = admin.id;
    return res.json({ admin: { id: admin.id, identifiant: admin.identifiant } });
  } catch (err) {
    next(err);
  }
}

// POST /api/apropos/admin/logout
export function adminLogout(req, res) {
  delete req.session.aproposAdminId;
  return res.json({ message: 'Déconnecté de l\'espace À propos.' });
}

// GET /api/apropos/admin/me
export async function adminMe(req, res, next) {
  try {
    if (!req.session.aproposAdminId) return res.status(401).json({ erreur: 'Non authentifié.' });
    const admin = await adminModel.trouverParId(req.session.aproposAdminId);
    if (!admin) return res.status(401).json({ erreur: 'Non authentifié.' });
    return res.json({ admin: { id: admin.id, identifiant: admin.identifiant } });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/apropos/admin/compte — changer son propre identifiant et/ou mot
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

    const admin = await adminModel.trouverParIdAvecHash(req.session.aproposAdminId);
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

// ---------- Sections ----------

// GET /api/apropos (public)
export async function lister(req, res, next) {
  try {
    return res.json({ sections: await sectionModel.lister() });
  } catch (err) {
    next(err);
  }
}

// Validation commune des champs d'une section
function validerCorps(req) {
  const titre = (req.body.titre || '').trim();
  const contenu = (req.body.contenu || '').trim();
  if (!titre) return { erreur: 'Le titre est requis.' };
  if (titre.length > 160) return { erreur: 'Le titre est trop long (max 160 caractères).' };
  if (!contenu) return { erreur: 'Le contenu est requis.' };
  const ordreBrut = req.body.ordre;
  const ordre = ordreBrut === undefined || ordreBrut === null || ordreBrut === ''
    ? null : Number(ordreBrut);
  if (ordre !== null && (!Number.isInteger(ordre) || ordre < 0)) {
    return { erreur: 'L\'ordre doit être un entier positif.' };
  }
  return { titre, contenu, ordre };
}

// POST /api/apropos (admin À propos)
export async function creer(req, res, next) {
  try {
    const v = validerCorps(req);
    if (v.erreur) return res.status(400).json({ erreur: v.erreur });
    const ordre = v.ordre === null ? await sectionModel.prochainOrdre() : v.ordre;
    const id = await sectionModel.creer({
      titre: v.titre, contenu: v.contenu, ordre, idAproposAdmin: req.session.aproposAdminId,
    });
    return res.status(201).json({ section: { id, titre: v.titre, contenu: v.contenu, ordre } });
  } catch (err) {
    next(err);
  }
}

// PUT /api/apropos/:id (admin À propos)
export async function mettreAJour(req, res, next) {
  try {
    const section = await sectionModel.trouverParId(Number(req.params.id));
    if (!section) return res.status(404).json({ erreur: 'Section introuvable.' });
    const v = validerCorps(req);
    if (v.erreur) return res.status(400).json({ erreur: v.erreur });
    const ordre = v.ordre === null ? section.ordre : v.ordre;
    await sectionModel.mettreAJour(section.id, { titre: v.titre, contenu: v.contenu, ordre });
    return res.json({ section: { id: section.id, titre: v.titre, contenu: v.contenu, ordre } });
  } catch (err) {
    next(err);
  }
}

// POST /api/apropos/redaction-ia (admin À propos) — rédige un brouillon de section avec l'IA (Groq)
export async function redactionIA(req, res, next) {
  try {
    if (!iaConfiguree()) {
      return res.status(503).json({ erreur: "L'assistant IA n'est pas configuré (clé GROQ_API_KEY manquante côté serveur)." });
    }
    const sujet = (req.body.sujet || '').trim();
    if (!sujet) return res.status(400).json({ erreur: 'Décrivez le sujet de la section.' });
    if (sujet.length > 800) return res.status(400).json({ erreur: 'Le sujet est trop long (max 800 caractères).' });

    const client = clientIA();
    const completion = await client.chat.completions.create({
      model: MODELE_IA,
      temperature: 0.7,
      max_tokens: 700,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: "Tu es le chargé de communication de l'école « Lekòl Pam ». Tu rédiges une section de la page « À propos » du site de l'école (mission, valeurs, histoire, pédagogie…), destinée au grand public. Style clair, chaleureux et professionnel, en français. N'utilise pas d'emojis. N'invente pas de dates, de lieux ni de chiffres précis qui ne sont pas dans la demande. Réponds UNIQUEMENT avec un objet JSON de la forme {\"titre\": \"...\", \"contenu\": \"...\"}.",
        },
        {
          role: 'user',
          content: `Rédige une section « À propos » à partir de cette idée : "${sujet}".\n`
            + 'Le "titre" doit être court (environ 50 caractères maximum). '
            + 'Le "contenu" doit faire un paragraphe de 3 à 6 phrases.',
        },
      ],
    });

    const texte = completion.choices?.[0]?.message?.content || '';
    let data = null;
    try { data = JSON.parse(texte); } catch { /* repli ci-dessous */ }

    if (!data || !data.contenu) {
      return res.json({ titre: '', contenu: texte.trim() });
    }
    return res.json({ titre: (data.titre || '').trim(), contenu: (data.contenu || '').trim() });
  } catch (err) {
    if (err && (err.status === 401 || err.status === 403)) {
      return res.status(503).json({ erreur: 'Clé Groq invalide ou sans accès. Vérifiez GROQ_API_KEY.' });
    }
    next(err);
  }
}

// DELETE /api/apropos/:id (admin À propos)
export async function supprimer(req, res, next) {
  try {
    const section = await sectionModel.trouverParId(Number(req.params.id));
    if (!section) return res.status(404).json({ erreur: 'Section introuvable.' });
    await sectionModel.supprimer(section.id);
    return res.json({ message: 'Section supprimée.' });
  } catch (err) {
    next(err);
  }
}
