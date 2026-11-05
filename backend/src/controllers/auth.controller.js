// Contrôleur d'authentification
import bcrypt from 'bcryptjs';
import { pool } from '../config/db.js';
import {
  findByCourriel,
  findById,
  createParent,
  mettreAJourMotDePasse,
  findByGoogleId,
  lierGoogleId,
  createParentGoogle,
} from '../models/user.model.js';
import {
  trouverValidePourMaj as trouverInvitationPourMaj,
  marquerUtilisee as marquerInvitationUtilisee,
} from '../models/invitationEleve.model.js';
import { verifierIdTokenGoogle, clientIdPublic } from '../config/googleAuth.js';
import { trouverParCode as trouverEleveParCode, trouverParId as trouverEleveParId }
  from '../models/eleve.model.js';
import {
  envoyerCodeReinitialisation,
  envoyerCodeConnexion,
  verifierCode,
} from '../services/otp.service.js';
import { courrielConfigure } from '../config/mailer.js';
import { creerProtection } from '../middleware/protectionBruteForce.js';

// Verrouille un préfixe de code d'accès élève après trop d'échecs, quelle que
// soit l'IP d'origine — le code (3 lettres + 5 chiffres) ne change jamais
// (voir eleve.model.js:genererCodeAcces), donc un rate-limit par IP seul ne
// suffit pas à empêcher une recherche exhaustive distribuée sur les 100 000
// combinaisons possibles.
const protectionCodeEleve = creerProtection({ seuil: 20 });

// Verrouille une adresse courriel après trop d'échecs de mot de passe, quelle
// que soit l'IP d'origine — complète authLimiter (par IP), qui seul ne coûte
// rien à contourner par rotation de proxy.
const protectionLogin = creerProtection({ seuil: 10 });
import { regenererSession } from '../middleware/auth.js';
import { comparerMotDePasse } from '../utils/motDePasse.js';
import { tracer, alerter, echecConnexion } from '../services/securite.service.js';
import { estAutorise, CLES } from '../services/permissions.service.js';

// Même réponse pour tout échec d'identification (compte inexistant, sans mot
// de passe, mot de passe faux) : elle ne doit pas révéler qui a un compte.
const ECHEC_CONNEXION = 'Identifiants invalides. Si vous vous êtes inscrit avec Google, '
  + 'utilisez « Se connecter avec Google » (ou « Mot de passe oublié » pour créer un mot de passe).';

const TYPE_RESET = 'reinitialisation_mdp';
const TYPE_2FA = 'connexion_2fa';

const COURRIEL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SALT_ROUNDS = 12;

// POST /api/auth/register — crée un compte 'parent' immédiatement actif et ouvre
// la session. Il n'y a plus de vérification du courriel par code : l'adresse saisie
// n'est donc pas prouvée (choix assumé, voir README).
export async function register(req, res, next) {
  try {
    const nom = (req.body.nom || '').trim();
    const courriel = (req.body.courriel || '').trim().toLowerCase();
    const motDePasse = req.body.motDePasse || '';

    if (!nom || !courriel || !motDePasse) {
      return res.status(400).json({ erreur: 'Nom, courriel et mot de passe sont requis.' });
    }
    if (!COURRIEL_REGEX.test(courriel)) {
      return res.status(400).json({ erreur: 'Courriel invalide.' });
    }
    if (motDePasse.length < 8) {
      return res.status(400).json({ erreur: 'Le mot de passe doit contenir au moins 8 caractères.' });
    }

    const existant = await findByCourriel(courriel);
    if (existant) {
      // Formulation neutre : n'affirme pas qu'un compte existe pour ce courriel.
      return res.status(409).json({
        erreur: 'Impossible de créer un compte avec ce courriel. Si vous avez déjà un compte, '
          + 'connectez-vous ou utilisez « Mot de passe oublié ».',
      });
    }

    // Contrôle d'accès à la création de compte (interrupteurs du propriétaire) :
    //  - compte élève : autorisé seulement si l'auto-inscription des élèves est
    //    activée ET si un CODE D'INVITATION valide est fourni (ainsi, seules les
    //    personnes réellement admises par l'école peuvent créer un compte élève) ;
    //  - compte parent : autorisé seulement si l'inscription des parents est activée.
    // Une demande « élève » quand l'auto-inscription élève est désactivée retombe
    // sur un compte parent, donc soumise à l'autorisation « parent ».
    const veutEleve = req.body.profilEleve === true
      && await estAutorise(CLES.INSCRIPTION_ELEVE);

    const motDePasseHash = await bcrypt.hash(motDePasse, SALT_ROUNDS);

    let utilisateur;
    let compteEleve = false;

    if (veutEleve) {
      // Compte élève : un code d'invitation valide est OBLIGATOIRE. On vérifie et
      // on consomme le code dans la MÊME transaction que la création du compte,
      // pour qu'un code ne puisse jamais servir deux fois (même en cas de double
      // soumission simultanée).
      const code = (req.body.codeInvitation || '').toString().trim().toUpperCase();
      if (!code) {
        return res.status(400).json({ erreur: "Un code d'invitation est requis pour créer un compte élève." });
      }
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        const invitation = await trouverInvitationPourMaj(conn, code);
        if (!invitation) {
          await conn.rollback();
          return res.status(403).json({ erreur: "Code d'invitation invalide, déjà utilisé ou expiré." });
        }
        utilisateur = await createParent({ nom, courriel, motDePasseHash, compteEleve: true }, { conn });
        await marquerInvitationUtilisee(conn, invitation.id, utilisateur.id);
        await conn.commit();
        compteEleve = true;
        tracer('inscription_eleve_invitation', { req, sujet: courriel, details: `Invitation #${invitation.id}` });
      } catch (err) {
        try { await conn.rollback(); } catch { /* ignore */ }
        // Courriel devenu doublon entre-temps : même message neutre que plus haut.
        if (err && err.code === 'ER_DUP_ENTRY') {
          return res.status(409).json({
            erreur: 'Impossible de créer un compte avec ce courriel. Si vous avez déjà un compte, '
              + 'connectez-vous ou utilisez « Mot de passe oublié ».',
          });
        }
        throw err;
      } finally {
        conn.release();
      }
    } else {
      // Compte parent : soumis à l'autorisation « inscription des parents ».
      if (!await estAutorise(CLES.INSCRIPTION_PARENT)) {
        return res.status(403).json({
          erreur: "La création de compte n'est pas ouverte pour le moment. "
            + "Contactez l'établissement pour obtenir un accès.",
        });
      }
      utilisateur = await createParent({ nom, courriel, motDePasseHash, compteEleve: false });
    }

    await regenererSession(req);
    req.session.userId = utilisateur.id;
    req.session.role = utilisateur.role;

    return res.status(201).json({
      message: 'Compte créé.',
      utilisateur: {
        id: utilisateur.id,
        nom: utilisateur.nom,
        courriel: utilisateur.courriel,
        role: utilisateur.role,
        compteEleve,
      },
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/auth/google/client-id — configuration publique du bouton Google
// (le client_id n'est pas un secret ; le bouton ne s'affiche pas si absent).
export function googleClientId(req, res) {
  return res.json({ clientId: clientIdPublic() });
}

// POST /api/auth/google — connexion ou inscription via Google (ID token émis
// par Google Identity Services côté client). L'adresse Google étant déjà
// vérifiée par Google, la 2FA par courriel (voir login ci-dessous) est
// inutile ici. Toute création de compte se fait avec le rôle 'parent',
// comme l'inscription manuelle ; un compte existant (autre rôle inclus) est
// simplement lié par courriel s'il n'était pas déjà relié à Google.
export async function googleAuth(req, res, next) {
  try {
    const credential = req.body.credential || '';
    if (!credential) return res.status(400).json({ erreur: 'Jeton Google requis.' });

    let infosGoogle;
    try {
      infosGoogle = await verifierIdTokenGoogle(credential);
    } catch (err) {
      echecConnexion('google', { req, sujet: 'jeton invalide' });
      return res.status(401).json({ erreur: 'Connexion Google invalide ou expirée.' });
    }
    if (!infosGoogle.courrielVerifie) {
      return res.status(403).json({ erreur: 'Adresse Google non vérifiée.' });
    }

    let utilisateur = await findByGoogleId(infosGoogle.googleId);
    if (!utilisateur) {
      const existant = await findByCourriel(infosGoogle.courriel);
      if (existant) {
        await lierGoogleId(existant.id, infosGoogle.googleId);
        utilisateur = existant;
        tracer('compte_lie_google', { req, sujet: existant.courriel, details: existant.role });
      } else {
        // Création d'un NOUVEAU compte parent via Google : soumise au même
        // contrôle d'accès que l'inscription manuelle. La connexion d'un compte
        // déjà existant (branche ci-dessus) reste toujours possible.
        if (!await estAutorise(CLES.INSCRIPTION_PARENT)) {
          return res.status(403).json({
            erreur: "La création de compte n'est pas ouverte pour le moment. "
              + "Contactez l'établissement pour obtenir un accès.",
          });
        }
        utilisateur = await createParentGoogle({
          nom: infosGoogle.nom, courriel: infosGoogle.courriel, googleId: infosGoogle.googleId,
        });
      }
    }

    if (utilisateur.statut !== 'actif') {
      return res.status(403).json({ erreur: 'Compte inactif.' });
    }

    await regenererSession(req);
    req.session.userId = utilisateur.id;
    req.session.role = utilisateur.role;
    tracer('connexion_google', { req, sujet: utilisateur.courriel, details: utilisateur.role });

    return res.json({
      utilisateur: {
        id: utilisateur.id, nom: utilisateur.nom, courriel: utilisateur.courriel, role: utilisateur.role,
      },
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/mot-de-passe-oublie — envoie un code de réinitialisation.
// Réponse générique : ne révèle pas si le courriel existe.
export async function motDePasseOublie(req, res, next) {
  try {
    const courriel = (req.body.courriel || '').trim().toLowerCase();
    if (!COURRIEL_REGEX.test(courriel)) {
      return res.status(400).json({ erreur: 'Courriel invalide.' });
    }

    // Contrôle avant toute recherche en base : l'absence de configuration SMTP ne
    // dépend d'aucun compte, la signaler ne révèle donc pas si le courriel existe.
    if (!courrielConfigure()) {
      return res.status(503).json({
        erreur: 'L\'envoi de courriel n\'est pas configuré sur le serveur. '
          + 'Contactez le secrétariat pour réinitialiser votre mot de passe.',
      });
    }

    const utilisateur = await findByCourriel(courriel);
    const reponse = { message: 'Si un compte existe pour ce courriel, un code de réinitialisation a été envoyé.' };

    if (utilisateur && utilisateur.statut === 'actif') {
      try {
        await envoyerCodeReinitialisation({
          idUtilisateur: utilisateur.id,
          courriel: utilisateur.courriel,
          nom: utilisateur.nom,
        });
      } catch (err) {
        // Panne ponctuelle du relais : on garde la réponse générique pour ne pas
        // révéler l'existence du compte, mais on trace l'échec côté serveur.
        console.error(`✖ Envoi du code de réinitialisation à ${courriel} échoué :`, err.message);
      }
    }

    return res.json(reponse);
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/reinitialiser-mot-de-passe — vérifie le code et change le mot de passe.
export async function reinitialiserMotDePasse(req, res, next) {
  try {
    const courriel = (req.body.courriel || '').trim().toLowerCase();
    const code = (req.body.code || '').trim();
    const nouveauMotDePasse = req.body.nouveauMotDePasse || '';

    if (!courriel || !code) {
      return res.status(400).json({ erreur: 'Courriel et code requis.' });
    }
    if (nouveauMotDePasse.length < 8) {
      return res.status(400).json({ erreur: 'Le mot de passe doit contenir au moins 8 caractères.' });
    }

    const utilisateur = await findByCourriel(courriel);
    // Message générique pour ne pas révéler l'existence du compte
    if (!utilisateur) {
      return res.status(400).json({ erreur: 'Code invalide.' });
    }

    const resultat = await verifierCode({ idUtilisateur: utilisateur.id, code, type: TYPE_RESET });
    if (resultat !== 'ok') {
      const messages = {
        aucun_code: 'Aucun code actif. Demandez un nouveau code.',
        expire: 'Code expiré. Demandez un nouveau code.',
        trop_tentatives: 'Trop de tentatives. Demandez un nouveau code.',
        invalide: 'Code invalide.',
      };
      const status = resultat === 'invalide' ? 400 : 410;
      return res.status(status).json({ erreur: messages[resultat] || 'Code invalide.' });
    }

    const motDePasseHash = await bcrypt.hash(nouveauMotDePasse, SALT_ROUNDS);
    await mettreAJourMotDePasse(utilisateur.id, motDePasseHash);
    tracer('mot_de_passe_reinitialise', { req, sujet: utilisateur.courriel });

    return res.json({ message: 'Mot de passe réinitialisé. Vous pouvez vous connecter.' });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/login
export async function login(req, res, next) {
  try {
    const courriel = (req.body.courriel || '').trim().toLowerCase();
    const motDePasse = req.body.motDePasse || '';

    if (!courriel || !motDePasse) {
      return res.status(400).json({ erreur: 'Courriel et mot de passe requis.' });
    }

    if (protectionLogin.bloque(courriel)) {
      alerter('compte_verrouille', 'Compte verrouillé après trop d\'échecs de connexion', { req, sujet: courriel });
      return res.status(429).json({ erreur: 'Trop de tentatives pour ce compte. Réessayez plus tard.' });
    }

    const utilisateur = await findByCourriel(courriel);
    // Compte inexistant, sans mot de passe (compte Google, ou professeur qui
    // n'a pas encore créé le sien) ou mot de passe faux : même réponse et même
    // durée (comparaison bcrypt dans tous les cas) — ne révèle pas qui a un compte.
    const ok = await comparerMotDePasse(motDePasse, utilisateur?.mot_de_passe_hash);
    if (!utilisateur || !ok) {
      protectionLogin.enregistrerEchec(courriel);
      echecConnexion('ecole', { req, sujet: courriel });
      return res.status(401).json({ erreur: ECHEC_CONNEXION });
    }
    protectionLogin.reinitialiser(courriel);
    // Statut vérifié seulement APRÈS le mot de passe : un inconnu ne peut pas
    // apprendre qu'un compte existe (même désactivé).
    if (utilisateur.statut !== 'actif') {
      return res.status(403).json({ erreur: 'Compte inactif.' });
    }

    // Double authentification (2FA) : les comptes 'parent' reçoivent un code par
    // courriel avant l'ouverture de la session. Les rôles admin/direction gardent
    // la connexion par mot de passe seul.
    if (utilisateur.role === 'parent') {
      if (!courrielConfigure()) {
        return res.status(503).json({
          erreur: 'L\'envoi de courriel n\'est pas configuré sur le serveur. '
            + 'Contactez le secrétariat pour accéder à votre compte.',
        });
      }

      // On note l'utilisateur en attente de 2FA sans ouvrir la session complète.
      req.session.pending2fa = utilisateur.id;
      delete req.session.userId;
      delete req.session.role;

      try {
        await envoyerCodeConnexion({
          idUtilisateur: utilisateur.id,
          courriel: utilisateur.courriel,
          nom: utilisateur.nom,
        });
      } catch (err) {
        console.error(`✖ Envoi du code de connexion à ${courriel} échoué :`, err.message);
        return res.status(502).json({
          erreur: 'Impossible d\'envoyer le code de connexion. Réessayez plus tard.',
        });
      }

      return res.json({ etape: '2fa_requis', courriel: utilisateur.courriel });
    }

    await regenererSession(req);
    req.session.userId = utilisateur.id;
    req.session.role = utilisateur.role;
    tracer('connexion_reussie', { req, sujet: utilisateur.courriel, details: utilisateur.role });

    return res.json({
      utilisateur: {
        id: utilisateur.id,
        nom: utilisateur.nom,
        courriel: utilisateur.courriel,
        role: utilisateur.role,
      },
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/verifier-connexion — 2ᵉ étape de connexion parent : vérifie le
// code reçu par courriel puis ouvre la session complète.
export async function verifierConnexion(req, res, next) {
  try {
    const code = (req.body.code || '').trim();
    const idUtilisateur = req.session.pending2fa;

    if (!idUtilisateur) {
      return res.status(401).json({ erreur: 'Aucune connexion en attente. Recommencez.' });
    }
    if (!code) {
      return res.status(400).json({ erreur: 'Code requis.' });
    }

    const resultat = await verifierCode({ idUtilisateur, code, type: TYPE_2FA });
    if (resultat !== 'ok') {
      const messages = {
        aucun_code: 'Aucun code actif. Recommencez la connexion.',
        expire: 'Code expiré. Recommencez la connexion.',
        trop_tentatives: 'Trop de tentatives. Recommencez la connexion.',
        invalide: 'Code invalide.',
      };
      const status = resultat === 'invalide' ? 400 : 410;
      // Un code épuisé/expiré interrompt la tentative : on efface l'attente.
      if (resultat !== 'invalide') delete req.session.pending2fa;
      echecConnexion('code_2fa', { req, sujet: `utilisateur #${idUtilisateur}` });
      return res.status(status).json({ erreur: messages[resultat] || 'Code invalide.' });
    }

    const utilisateur = await findById(idUtilisateur);
    if (!utilisateur) {
      delete req.session.pending2fa;
      return res.status(401).json({ erreur: 'Compte introuvable.' });
    }

    // Promotion en session complète (nouvel ID de session : la valeur en
    // attente de 2FA ne doit jamais pouvoir devenir une session authentifiée).
    await regenererSession(req);
    req.session.userId = utilisateur.id;
    req.session.role = utilisateur.role;
    tracer('connexion_reussie', { req, sujet: utilisateur.courriel, details: `${utilisateur.role} (2FA)` });

    return res.json({
      utilisateur: {
        id: utilisateur.id,
        nom: utilisateur.nom,
        courriel: utilisateur.courriel,
        role: utilisateur.role,
      },
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/renvoyer-code-connexion — renvoie un code 2FA si une connexion
// parent est en attente.
export async function renvoyerCodeConnexion(req, res, next) {
  try {
    const idUtilisateur = req.session.pending2fa;
    if (!idUtilisateur) {
      return res.status(401).json({ erreur: 'Aucune connexion en attente. Recommencez.' });
    }
    if (!courrielConfigure()) {
      return res.status(503).json({
        erreur: 'L\'envoi de courriel n\'est pas configuré sur le serveur.',
      });
    }

    const utilisateur = await findById(idUtilisateur);
    if (!utilisateur) {
      delete req.session.pending2fa;
      return res.status(401).json({ erreur: 'Compte introuvable.' });
    }

    try {
      await envoyerCodeConnexion({
        idUtilisateur: utilisateur.id,
        courriel: utilisateur.courriel,
        nom: utilisateur.nom,
      });
    } catch (err) {
      console.error(`✖ Renvoi du code de connexion échoué :`, err.message);
      return res.status(502).json({ erreur: 'Impossible d\'envoyer le code. Réessayez plus tard.' });
    }

    return res.json({ message: 'Un nouveau code a été envoyé.' });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/eleve-connexion — connexion à l'espace élève par code d'accès.
// N'utilise ni courriel ni mot de passe ; ouvre une session « élève ».
export async function eleveConnexion(req, res, next) {
  try {
    const code = (req.body.code || '').trim().toUpperCase();
    if (!code) {
      return res.status(400).json({ erreur: 'Code d\'accès requis.' });
    }

    const prefixe = code.slice(0, 3);
    if (protectionCodeEleve.bloque(prefixe)) {
      alerter('code_eleve_verrouille', 'Codes élève verrouillés après trop d\'échecs', { req, sujet: `${prefixe}…` });
      return res.status(429).json({ erreur: 'Trop de tentatives pour ce code. Réessayez plus tard.' });
    }

    const eleve = await trouverEleveParCode(code);
    if (!eleve) {
      protectionCodeEleve.enregistrerEchec(prefixe);
      echecConnexion('eleve', { req, sujet: `${prefixe}…` });
      return res.status(401).json({ erreur: 'Code d\'accès invalide.' });
    }
    protectionCodeEleve.reinitialiser(prefixe);

    // Session élève : pas de userId, on marque l'identité par eleveId + role.
    await regenererSession(req);
    req.session.eleveId = eleve.id;
    req.session.role = 'eleve';

    return res.json({
      utilisateur: { role: 'eleve', id: eleve.id, nom: eleve.nom, niveau: eleve.niveau },
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/logout
export function logout(req, res) {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ erreur: 'Impossible de fermer la session.' });
    }
    res.clearCookie('lk.sid');
    return res.json({ message: 'Déconnecté.' });
  });
}

// GET /api/auth/me — utilisateur courant (compte classique OU session élève)
export async function me(req, res, next) {
  try {
    // Session « espace élève » (par code) : pas de compte utilisateur.
    if (req.session.eleveId && req.session.role === 'eleve') {
      const e = await trouverEleveParId(req.session.eleveId);
      if (!e) return res.status(401).json({ erreur: 'Non authentifié.' });
      const nomComplet = [e.prenom, e.nom].filter(Boolean).join(' ');
      return res.json({ utilisateur: { role: 'eleve', id: e.id, nom: nomComplet, niveau: e.niveau } });
    }

    const utilisateur = await findById(req.session.userId);
    if (!utilisateur) {
      return res.status(401).json({ erreur: 'Non authentifié.' });
    }
    return res.json({ utilisateur });
  } catch (err) {
    next(err);
  }
}
