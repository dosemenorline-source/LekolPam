# Spec — Double authentification (2FA) à la connexion des parents

## Objectif
Empêcher qu'une personne ayant seulement le mot de passe d'un parent accède au
compte. À chaque connexion d'un **compte parent**, en plus du mot de passe, un
**code à 6 chiffres** est envoyé par courriel et doit être saisi pour ouvrir la
session.

## Portée
- **Concernés** : uniquement les comptes de rôle `parent`.
- **Non concernés** : `admin`, `direction` (connexion inchangée, mot de passe seul)
  et les élèves (connexion par code d'accès inchangée).

## Prérequis — IMPORTANT
Le code part par courriel : **le SMTP (Brevo) doit être configuré** (`SMTP_USER`,
`SMTP_PASS`, etc. sur Railway). Tant que ce n'est pas fait :
- un parent qui se connecte recevra un message clair « envoi de courriel non
  configuré, contactez le secrétariat » et **ne pourra pas entrer**.
- Recommandation : configurer Brevo **avant** d'activer cette fonctionnalité en
  production.

## Ce qui existe déjà (réutilisé)
- `services/otp.service.js` — génération, envoi et vérification de codes à 6 chiffres.
- `models/verificationCode.model.js` + table `codes_verification` (code haché,
  expiration, compteur de tentatives, usage unique).
- `config/mailer.js` — envoi de courriel + `courrielConfigure()`.
- Rate limiting `otpLimiter` (déjà utilisé pour la réinitialisation de mot de passe).

## Flux de connexion (parent)
1. **Étape 1 — mot de passe** : `POST /api/auth/login` (courriel + mot de passe).
   - Identifiants OK **et** rôle = `parent` :
     - **ne pas** ouvrir la session tout de suite ;
     - stocker un état d'attente dans la session : `req.session.pending2fa = userId` ;
     - générer un code, l'envoyer par courriel ;
     - répondre `200 { etape: '2fa_requis', courriel }`.
   - Rôle `admin`/`direction` : comportement actuel (session ouverte immédiatement).
   - Si SMTP non configuré : `503` avec message « contactez le secrétariat ».
2. **Étape 2 — code** : `POST /api/auth/verifier-connexion` (code).
   - Lit `req.session.pending2fa` (lie le code au même navigateur ; pas besoin de
     renvoyer le mot de passe, pas de fuite d'existence de compte).
   - Vérifie le code (expiration / tentatives / validité) via `verifierCode`.
   - Si OK : promouvoir en session complète (`req.session.userId`, `role`), effacer
     `pending2fa`, répondre avec l'utilisateur (comme `login` aujourd'hui).
   - Si échec : messages existants (`expiré`, `trop de tentatives`, `invalide`).
3. **Renvoi de code** (optionnel mais recommandé) :
   `POST /api/auth/renvoyer-code-connexion` — régénère et renvoie un code si un
   `pending2fa` est en cours. Protégé par `otpLimiter`.

## Détails techniques

### Type de code
La colonne `codes_verification.type` est un `ENUM('verification_courriel',
'reinitialisation_mdp')`. Deux options :
- **(recommandé)** Migration `017` : ajouter la valeur `connexion_2fa` à l'ENUM.
  Propre sémantiquement. Nécessite **un ALTER TABLE** à rejouer sur Railway.
- **(alternative sans migration)** Réutiliser `verification_courriel`, devenu inutilisé
  depuis le retrait de la vérification à l'inscription. Aucune migration, mais moins clair.

### Backend — fichiers touchés
- `services/otp.service.js` : ajouter `envoyerCodeConnexion({ idUtilisateur, courriel, nom })`
  (texte du courriel adapté : « code de connexion »).
- `controllers/auth.controller.js` : modifier `login` (branche parent) + ajouter
  `verifierConnexion` et `renvoyerCodeConnexion`.
- `routes/auth.routes.js` : 2 nouvelles routes (verify + renvoi), sous `authLimiter`/`otpLimiter`.
- `db/migrations/017_2fa_connexion.sql` (si option ENUM) + note dans `DEPLOIEMENT.md`.

### Frontend — fichiers touchés
- `services/api.js` : `authApi.verifierConnexion(code)`, `authApi.renvoyerCodeConnexion()`.
- `pages/auth/Login.jsx` : si la réponse de login est `2fa_requis`, afficher une
  **2ᵉ étape** « Entrez le code reçu par courriel » (champ 6 chiffres + bouton
  « Renvoyer le code »), puis appeler `verifierConnexion`.
- `context/AuthContext.jsx` : rafraîchir l'utilisateur après vérification réussie.
- Palette respectée : blanc, bleu, noir, gris.

### Sécurité
- Le code est haché en base (déjà le cas), expire (10 min par défaut,
  `OTP_EXPIRATION_MIN`), 5 tentatives max, usage unique.
- L'état `pending2fa` vit dans la session serveur (store MySQL) : le lien
  mot-de-passe → code est propre au navigateur, non falsifiable côté client.
- Messages génériques : ne pas révéler si le courriel existe.
- Rate limiting sur login, vérification et renvoi.

## Hors périmètre (v1 de cette fonctionnalité)
- 2FA pour admin/direction.
- « Se souvenir de cet appareil » (ne redemander le code que sur un nouvel appareil).
- Application d'authentification (TOTP) / SMS.

## Tests
- Parent : login → `2fa_requis` (pas de session) ; code correct → session ouverte ;
  code faux/expiré → refus ; trop de tentatives → blocage.
- Admin/direction : login inchangé (session immédiate, pas de code).
- SMTP non configuré : login parent → 503 explicite.
