// Contrôleur WebAuthn / passkeys — connexion biométrique (Face ID, Touch ID,
// Windows Hello, empreinte).
//
// Deux phases, chacune en deux temps (options -> vérification) :
//  - Enregistrement (utilisateur DÉJÀ connecté) : ajoute un passkey à son compte.
//  - Authentification (visiteur non connecté) : ouvre la session via un passkey.
//
// Le « challenge » émis à chaque « options » est mémorisé dans la session et
// revérifié à l'étape suivante — jamais fourni ni rejouable par le client.
import {
  generateRegistrationOptions, verifyRegistrationResponse,
  generateAuthenticationOptions, verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import { RP_ID, RP_NAME, ORIGINS, versB64url, depuisB64url } from '../config/webauthn.js';
import * as credModel from '../models/webauthnCredential.model.js';
import { findById } from '../models/user.model.js';
import { regenererSession } from '../middleware/auth.js';
import { tracer, echecConnexion } from '../services/securite.service.js';

// ---------- Enregistrement d'un passkey (utilisateur connecté) ----------

// POST /api/auth/webauthn/enregistrement/options (requireAuth)
export async function optionsEnregistrement(req, res, next) {
  try {
    const utilisateur = await findById(req.session.userId);
    if (!utilisateur) return res.status(401).json({ erreur: 'Authentification requise.' });

    const existants = await credModel.listerParUtilisateur(utilisateur.id);
    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: RP_ID,
      userID: new Uint8Array(Buffer.from(String(utilisateur.id))),
      userName: utilisateur.courriel,
      userDisplayName: utilisateur.nom || utilisateur.courriel,
      attestationType: 'none',
      // Empêche d'enregistrer deux fois le même appareil.
      excludeCredentials: existants.map((c) => ({
        id: c.credential_id,
        transports: c.transports ? JSON.parse(c.transports) : undefined,
      })),
      authenticatorSelection: {
        residentKey: 'preferred',       // passkey « découvrable » -> connexion sans saisir le courriel
        userVerification: 'required',   // biométrie / code de l'appareil OBLIGATOIRE
      },
    });

    req.session.webauthnChallenge = options.challenge;
    return res.json(options);
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/webauthn/enregistrement/verifier (requireAuth)
export async function verifierEnregistrement(req, res, next) {
  try {
    const utilisateur = await findById(req.session.userId);
    if (!utilisateur) return res.status(401).json({ erreur: 'Authentification requise.' });

    const attendu = req.session.webauthnChallenge;
    if (!attendu) return res.status(400).json({ erreur: 'Aucune demande en cours. Recommencez.' });

    let verif;
    try {
      verif = await verifyRegistrationResponse({
        response: req.body.reponse,
        expectedChallenge: attendu,
        expectedOrigin: ORIGINS,
        expectedRPID: RP_ID,
        requireUserVerification: true,
      });
    } catch (err) {
      return res.status(400).json({ erreur: `Enregistrement refusé : ${err.message}` });
    } finally {
      delete req.session.webauthnChallenge;
    }

    if (!verif.verified || !verif.registrationInfo) {
      return res.status(400).json({ erreur: "L'enregistrement du passkey a échoué." });
    }

    const { credential } = verif.registrationInfo;
    const appareil = (req.body.appareil || '').toString().trim().slice(0, 120) || null;
    await credModel.creer({
      idUtilisateur: utilisateur.id,
      credentialId: credential.id, // déjà en base64url (v14)
      clePublique: versB64url(credential.publicKey),
      compteur: credential.counter || 0,
      transports: credential.transports,
      appareil,
    });
    tracer('passkey_ajoute', { req, sujet: utilisateur.courriel, details: appareil || 'appareil' });
    return res.status(201).json({ message: 'Connexion biométrique activée sur cet appareil.' });
  } catch (err) {
    next(err);
  }
}

// ---------- Authentification par passkey (visiteur non connecté) ----------

// POST /api/auth/webauthn/connexion/options
// Passkeys découvrables : on ne demande AUCUN courriel et on ne renvoie aucune
// liste de credentials — l'appareil propose de lui-même les passkeys qu'il a
// enregistrés pour ce site. Aucune énumération de comptes possible, et pas de
// QR tant qu'un passkey local existe.
export async function optionsConnexion(req, res, next) {
  try {
    const options = await generateAuthenticationOptions({
      rpID: RP_ID,
      allowCredentials: [],
      userVerification: 'required', // biométrie OBLIGATOIRE
    });
    req.session.webauthnChallenge = options.challenge;
    return res.json(options);
  } catch (err) {
    next(err);
  }
}

// POST /api/auth/webauthn/connexion/verifier
export async function verifierConnexionPasskey(req, res, next) {
  try {
    const attendu = req.session.webauthnChallenge;
    if (!attendu) return res.status(400).json({ erreur: 'Aucune demande en cours. Recommencez.' });

    const reponse = req.body.reponse;
    if (!reponse || !reponse.id) return res.status(400).json({ erreur: 'Réponse biométrique invalide.' });

    const cred = await credModel.trouverParCredentialId(reponse.id);
    // Message neutre : ne révèle pas si le passkey / le compte existe.
    if (!cred) return res.status(401).json({ erreur: 'Connexion biométrique impossible.' });

    let verif;
    try {
      verif = await verifyAuthenticationResponse({
        response: reponse,
        expectedChallenge: attendu,
        expectedOrigin: ORIGINS,
        expectedRPID: RP_ID,
        requireUserVerification: true,
        credential: {
          id: cred.credential_id,
          publicKey: depuisB64url(cred.cle_publique),
          counter: Number(cred.compteur) || 0,
          transports: cred.transports ? JSON.parse(cred.transports) : undefined,
        },
      });
    } catch (err) {
      echecConnexion('passkey', { req, sujet: cred.courriel });
      return res.status(401).json({ erreur: 'Connexion biométrique impossible.' });
    } finally {
      delete req.session.webauthnChallenge;
    }

    if (!verif.verified) {
      echecConnexion('passkey', { req, sujet: cred.courriel });
      return res.status(401).json({ erreur: 'Connexion biométrique impossible.' });
    }
    if (cred.statut !== 'actif') return res.status(403).json({ erreur: 'Compte inactif.' });

    await credModel.majCompteur(cred.id, verif.authenticationInfo.newCounter);

    // Session complète (nouvel ID : un passkey ne réutilise jamais une session pré-existante).
    await regenererSession(req);
    req.session.userId = cred.uid;
    req.session.role = cred.role;
    tracer('connexion_reussie', { req, sujet: cred.courriel, details: `${cred.role} (passkey)` });

    return res.json({
      utilisateur: { id: cred.uid, nom: cred.nom, courriel: cred.courriel, role: cred.role },
    });
  } catch (err) {
    next(err);
  }
}

// ---------- Gestion des appareils enregistrés ----------

// GET /api/auth/webauthn/appareils (requireAuth)
export async function listerAppareils(req, res, next) {
  try {
    const appareils = await credModel.listerParUtilisateur(req.session.userId);
    return res.json({
      appareils: appareils.map((a) => ({
        id: a.id, appareil: a.appareil, cree_le: a.cree_le, dernier_usage: a.dernier_usage,
      })),
    });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/auth/webauthn/appareils/:id (requireAuth)
export async function supprimerAppareil(req, res, next) {
  try {
    const ok = await credModel.supprimer(Number(req.params.id), req.session.userId);
    if (!ok) return res.status(404).json({ erreur: 'Appareil introuvable.' });
    tracer('passkey_retire', { req, sujet: `utilisateur #${req.session.userId}`, details: `appareil #${req.params.id}` });
    return res.json({ message: 'Appareil retiré.' });
  } catch (err) {
    next(err);
  }
}
