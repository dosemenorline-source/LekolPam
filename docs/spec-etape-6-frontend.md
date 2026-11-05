# Spec — Étape 6 : Frontend React

**Projet :** Lekòl Pam
**Date :** 2026-07-08
**Statut :** en revue
**Portée :** frontend React (consomme l'API backend des Étapes 1–5)

---

## 1. Objectif

Construire l'interface web (React + Vite) qui consomme l'API, en **responsive** (usage mobile
via navigateur), en **français**, avec une **palette imposée : blanc, bleu, noir, gris**.

## 2. Palette & design system

- Blanc `#ffffff` (fonds), Bleu `#1d4ed8` (primaire) / `#1e3a8a` (survol),
  Noir `#111827` (texte), Gris `#6b7280` (texte secondaire) / `#f3f4f6` (fond clair) /
  `#e5e7eb` (bordures). Pas d'autres teintes décoratives.
- Composants réutilisables : `Bouton`, `Champ` (input + label + erreur), `Carte`,
  `Badge` (statuts, en nuances de bleu/gris), `Tableau`, `Alerte`, `Chargement`, `BarreNav`.
- Variables CSS centralisées (`:root`), typographie système, coins arrondis, ombres légères.

## 3. Architecture

```
frontend/src/
  main.jsx, App.jsx           routeur + AuthProvider
  context/AuthContext.jsx     session courante (/auth/me), login, logout, register, verify
  services/api.js             client fetch (credentials: 'include') pour tous les modules
  components/                 Bouton, Champ, Carte, Badge, Tableau, Alerte, BarreNav, RoutePrivee
  pages/
    auth/       Login, Register, VerifierCourriel
    parent/     TableauParent, MesInscriptions, NouvelleInscription, DetailInscription,
                Notes, Bulletins, Paiements, NouveauPaiement
    admin/      FileInscriptions, SaisieNotes, FilePaiements
    direction/  Matieres, Publications, Tarifs, Ecole
  styles/       variables.css, global.css
```

- **Routage par rôle** : après connexion, redirection vers le tableau de bord du rôle.
  `RoutePrivee` protège les routes ; un garde par rôle masque/refuse l'accès aux pages
  non autorisées (le backend reste la source de vérité).

## 4. Écrans par rôle (couvre les modules backend)

- **Public / Auth :** Connexion, Inscription (compte), **Vérification du courriel (OTP)**,
  renvoi de code.
- **Parent :** tableau de bord ; liste + création d'inscription ; téléversement de documents ;
  suivi de statut ; consultation des notes (publiées) ; téléchargement des bulletins ;
  paiements (création, affichage coordonnées, téléversement de preuve, suivi) ; demande de
  relevé / duplicata + téléchargement.
- **Admin (secrétariat) :** file des inscriptions (filtres, changement de statut) ; saisie et
  validation des notes ; file des paiements (voir preuve, valider / rejeter).
- **Direction :** matières & coefficients ; publication des notes (niveau + trimestre) ;
  tarifs ; coordonnées de l'école.

## 5. Intégration API

- Toujours `credentials: 'include'` (cookie de session httpOnly).
- Gestion centralisée des erreurs (messages backend) et des états 401 (redirection login) /
  403 (message d'accès refusé).
- Téléversements en `multipart/form-data` (documents, preuves).
- En dev : le backend renvoie `apercuCourriel` (Ethereal) — affiché comme aide au test après
  register / renvoi de code, sur écran de vérification.

## 6. Ordre de construction proposé (incrémental, vérifié dans le navigateur)

1. **Fondation + design system** (variables, composants de base, BarreNav, routeur, AuthContext).
2. **Flux Auth complet** : Login → Register → **Vérification OTP** → tableau de bord vide par rôle.
3. **Parent — Inscriptions** (liste, création, documents, statut).
4. **Parent — Notes & Bulletins** (consultation, téléchargement).
5. **Parent — Paiements** (création, coordonnées, preuve, relevé/duplicata).
6. **Admin** (file inscriptions, saisie notes, file paiements).
7. **Direction** (matières, publications, tarifs, école).

Chaque lot est lancé contre le backend en marche (`http://localhost:4000`) et vérifié dans le
navigateur avant de passer au suivant.

## 7. Critères de fin (par lot)

- [ ] Le lot s'affiche correctement en desktop et en mobile (responsive), palette respectée.
- [ ] Les appels API fonctionnent avec la session (cookie) ; erreurs affichées proprement.
- [ ] Le flux Auth mène de l'inscription à un tableau de bord selon le rôle.
- [ ] Les gardes de route empêchent l'accès aux pages d'un autre rôle.
```
