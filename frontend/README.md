# Frontend — Lekòl Pam

Interface React (Vite), responsive, en français. Consomme l'API backend.

## Palette (imposée)

Blanc `#ffffff`, bleu `#1d4ed8` / `#1e3a8a`, noir `#111827`, gris `#6b7280` / `#f3f4f6`.
Aucune autre teinte décorative (rouge réservé aux erreurs). Variables dans
`src/styles/variables.css`.

## Démarrer

```bash
cp .env.example .env     # VITE_API_URL=http://localhost:4000/api
npm install
npm run dev              # http://localhost:5173
```

Le backend doit tourner sur `http://localhost:4000` (CORS + cookies de session configurés
pour l'origine `http://localhost:5173`). Toutes les requêtes utilisent `credentials: 'include'`.

## Structure

```
src/
  components/   Bouton, Champ, Carte, Badge, Alerte, Chargement, BarreNav, Layout,
                RoutePrivee, RoutePublique
  context/      AuthContext (session courante, login, register, verifierCourriel, logout)
  services/     api.js (client fetch)
  pages/
    auth/       Login, Register, VerifierCourriel, PanneauMarque
    parent/     TableauParent
    admin/      TableauAdmin
    direction/  TableauDirection
    TableauDeBord.jsx  (aiguillage par rôle)
  styles/       variables.css, global.css
```

## État (lots)

- **Lot 1 — Fondation + Auth** ✅ : design system, flux complet Connexion → Inscription →
  Vérification OTP → tableau de bord par rôle. Gardes de route par rôle.
- **Lot 2 — Parent : Inscriptions** ✅ : liste, création de dossier, détail (infos,
  historique de statut, documents), téléversement de documents.
- **Lot 3 — Parent : Notes & bulletins** ✅ : sélecteur d'enfant, notes par trimestre avec
  moyenne pondérée, téléchargement des bulletins PDF.
- **Lot 4 — Parent : Paiements** ✅ : création (type + référence + montant), coordonnées
  bancaires/MonCash, téléversement de preuve, suivi de statut, téléchargement des
  relevés/duplicatas générés.
- **Lot 5 — Admin (secrétariat)** ✅ : file des inscriptions + traitement (statut,
  documents, historique), saisie/validation des notes, file des paiements (voir preuve,
  valider/rejeter).
- **Lot 6 — Direction** ✅ : matières & coefficients, publication des notes (niveau +
  trimestre), tarifs, coordonnées de l'école.

**Frontend complet** : tous les rôles (parent, admin, direction) couvrent l'ensemble des
modules backend.
