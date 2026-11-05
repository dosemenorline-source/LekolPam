# Rapport de sécurité — Lekòl Pam

**Date :** 2026-09-29
**Portée :** application web Lekòl Pam (React + Express + MySQL, déployée sur Railway).
**Type :** test d'intrusion non destructif (sondes sur l'API de production, à faible
volume, sans DoS ni ciblage de masse) + revue de code. Réalisé sur l'application
du propriétaire, avec son autorisation.

Ce document résume l'état de sécurité de l'application, les vérifications
effectuées, les vulnérabilités corrigées et les recommandations restantes.

---

## 1. Synthèse

Aucune vulnérabilité grave n'a été trouvée (pas de contournement
d'authentification, pas d'injection SQL, pas d'IDOR, pas d'exécution de code).
Les points de durcissement identifiés ont été corrigés et déployés. L'audit des
dépendances renvoie **0 vulnérabilité** (backend et frontend).

---

## 2. Vérifications effectuées — résultats

### Authentification & sessions
- Toutes les routes protégées renvoient **401** sans session (comptes école,
  espaces admin Économat/Vlog/À propos/Académie/Examens/Professeurs).
- Échec de connexion : même message et même durée quel que soit le cas
  (compte inexistant, sans mot de passe, mot de passe faux) — pas de fuite sur
  l'existence des comptes. Statut vérifié **après** le mot de passe.
- Cookie de session : `HttpOnly` + `Secure` + `SameSite=Lax`, secret exigé en
  production, ID de session régénéré à la connexion (anti-fixation). Un cookie
  forgé est rejeté.
- Protection anti-force brute par identifiant (en plus de la limite par IP) sur
  la connexion école, la 2FA, les codes élève et les 6 espaces admin.
- 2FA par courriel pour les comptes parent.

### Connexion biométrique (Face ID / WebAuthn / passkeys)
- Vérification utilisateur (biométrie) **obligatoire** à l'enregistrement et à
  la connexion (le serveur refuse une assertion sans biométrie réelle).
- Passkeys découvrables : aucun courriel demandé, donc pas d'énumération des
  comptes ayant activé la connexion biométrique.
- Compteur anti-rejeu stocké et mis à jour ; échecs journalisés.
- Suppression d'appareil filtrée par utilisateur (pas d'IDOR).

### Paiements
- Endpoints réservés au rôle `parent`, propriété vérifiée à chaque action
  (création, preuve, démarrage/confirmation mobile).
- Montant validé côté serveur ; confirmation mobile re-vérifiée **serveur à
  serveur** auprès de l'agrégateur — jamais sur la foi du navigateur.
- Anti-rejeu : `transaction_externe_id` unique + contrôles applicatifs ;
  verrou anti double-clic au démarrage d'un paiement.
- URL de redirection de paiement restreinte au domaine autorisé, en HTTPS.
- **Webhook public** : ne fait jamais confiance au contenu reçu ; il sert
  seulement à retrouver le paiement par sa référence et à relancer la
  vérification serveur à serveur. Référence inconnue → 200 sans effet.
  Limité en débit.

### Espaces d'administration
- Écritures et assistants IA : **401** sans la session admin correspondante.
- Verrouillage par identifiant après trop d'échecs ; connexions journalisées.

### Téléversements de fichiers
- Vérification du **vrai type par octets d'en-tête** (magic bytes) pour preuves,
  logos, photos, documents de cours et feuilles d'examen — pas seulement
  l'extension.
- Limite de taille (5 Mo) et types autorisés (PDF/JPG/PNG).
- Service des fichiers protégé contre le *path traversal* (`path.resolve` +
  vérification du préfixe du dossier `uploads`).

### Entrées & injections
- Identifiants d'URL restreints à un entier positif (tentative
  `1 OR 1=1` → 400).
- Requêtes SQL **paramétrées** partout ; les fragments de requête interpolés
  ne contiennent que des noms de colonnes/alias codés en dur (pas d'entrée
  utilisateur) → **pas d'injection SQL**.
- Corps JSON limité à 100 Ko (413 au-delà) ; JSON malformé → 400 ; les erreurs
  4xx ne déclenchent pas d'alerte.
- Pas de `eval`, `exec` ni `child_process`.

### En-têtes & transport
- HSTS, CSP (`object-src 'none'`, `frame-ancestors 'self'`, scripts limités à
  `self` + Google Identity), `X-Content-Type-Options: nosniff`,
  `X-Frame-Options`, `Referrer-Policy: no-referrer`, `Permissions-Policy`
  (caméra réservée au site), suppression de `X-Powered-By`.
- CORS à origine fixe (ne reflète pas une origine arbitraire).

### Journalisation & alertes
- Journal de sécurité (connexions, verrouillages, changements de mot de passe/
  courriel, permissions, suppression de tarif, anomalies de paiement), purgé
  après 180 jours.
- Alertes par courriel sur les événements sensibles (regroupées, au plus une par
  type toutes les 15 min).

### Assistant IA
- Clés API strictement côté serveur ; consignes de sécurité en tête de chaque
  conversation ; réponses vérifiées (rejet des clés, HTML, scripts) ; noms des
  élèves/parents non transmis au fournisseur ; appels bornés en temps et en
  débit.

---

## 3. Vulnérabilités corrigées lors de cet audit

| # | Sévérité | Point | Correction |
|---|----------|-------|------------|
| 1 | Élevée (infra) | L'application se connectait à MySQL en tant que **root** | Compte dédié `lekol_app` limité à SELECT/INSERT/UPDATE/DELETE ; CREATE/DROP/ALTER refusés (vérifié). Une éventuelle faille ne peut plus altérer la structure de la base. |
| 2 | Moyenne | Connexion biométrique acceptée **sans vérification utilisateur** | `userVerification` obligatoire à l'enregistrement et à la connexion. |
| 3 | Basse | Énumération des comptes ayant activé Face ID via le paramètre courriel | Chemin par courriel supprimé (passkeys découvrables). |
| 4 | Basse | Avis modérés `react-router-dom` (open redirect / injection SSR) | Mise à niveau en 7.18.4 → **0 vulnérabilité** (non exploitable dans l'app : pas de SSR, redirections internes uniquement). |
| 5 | Basse | Échecs de connexion par passkey non journalisés | Ajoutés au journal de sécurité. |

---

## 4. Recommandations restantes (faible priorité)

- **Rotation périodique** du mot de passe du compte `lekol_app` et des clés API
  (Resend, Groq, plopplop, Google) — bonne hygiène, pas une faille.
- **Sauvegardes** : exécuter régulièrement `backend/scripts/sauvegarde-db.sh` et
  conserver les copies dans un stockage chiffré hors du dépôt.
- **Chiffrement au repos** de champs sensibles (téléphone, codes élève) : non
  nécessaire à ce stade, à évaluer si la réglementation l'exige.
- **A2F pour le personnel** (admin/direction/économat) : actuellement seuls les
  parents ont la 2FA par courriel ; la connexion biométrique (passkeys) est
  disponible pour tous et constitue une alternative forte.
- **SMS** : le fournisseur actuel (Textbelt) refuse les numéros hors US/Canada et
  limite la longueur ; les notifications SMS échouent donc — sans impact sur les
  courriels. À remplacer par un fournisseur couvrant Haïti si le SMS est requis.

---

## 5. Méthode & limites

Les sondes ont été menées à faible volume sur l'API de production pour ne pas
gêner les utilisateurs réels, sans aucune action destructive. La revue de code a
couvert l'authentification, les paiements, les espaces admin, les téléversements
et la couche d'accès aux données. Un test d'intrusion n'apporte pas de garantie
absolue : il est recommandé de le refaire après tout changement majeur touchant
l'authentification, les paiements ou la gestion des fichiers.
