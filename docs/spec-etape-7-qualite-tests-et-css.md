# Spec — Étape 7 : Qualité technique (tests + découpage CSS)

**Projet :** Lekòl Pam
**Date :** 2026-07-23
**Statut :** en revue (pas encore démarré)
**Portée :** partie A = backend uniquement · partie B = frontend uniquement (aucun changement visuel)

---

## 0. Objectif général

Deux chantiers indépendants, sans nouvelle fonctionnalité :

- **Partie A — filet de tests** sur les calculs à risque (moyennes, paiements).
  Aujourd'hui : 0 test sur 14 374 lignes. Une erreur de calcul de moyenne ne
  produit aucun message — elle produit une mauvaise note sur un bulletin qu'un
  parent reçoit.
- **Partie B — découpage de `global.css`** (1 534 lignes / 81 Ko, 4× plus gros que
  tout autre fichier du dépôt) en fichiers par domaine, **à rendu strictement identique**.

L'ordre proposé : **A puis B**. Aucune dépendance entre les deux.

Hors périmètre (décidé le 2026-07-23) : l'unification des 7 systèmes d'authentification admin.

---

# PARTIE A — Filet de tests backend

## A.1 Décisions techniques

| Sujet | Décision | Raison |
|---|---|---|
| Runner | **`node:test` intégré** (Node v24.18) + `node:assert/strict` | Zéro nouvelle dépendance. Le projet est déjà en ESM (`"type": "module"`). |
| Emplacement | `backend/test/*.test.js` | Hors de `src/`, ne part pas en production. |
| Commande | `npm test` → `node --test test/` (dans `backend/`) | |
| Base de données | **Aucune.** Tests purs + `mock.module()` pour les modèles. | Les tests doivent tourner sans MySQL démarré, sinon ils ne seront pas lancés. |
| CI | Hors périmètre pour cette étape | À voir après. |

`mock.module()` de `node:test` émet un `ExperimentalWarning` sur Node 24 mais est
stable d'usage. **Repli si blocage :** extraire les règles de décision de
`paiement.service.js` en fonctions pures et tester celles-ci — à ne faire que si
le mock pose problème, car cela modifie du code de production.

## A.2 Périmètre — ce qui est testé

### Niveau 1 — fonctions pures (aucun mock)

| Fichier testé | Fonction | Pourquoi c'est critique |
|---|---|---|
| [moyenne.service.js](../backend/src/services/moyenne.service.js) | `calculerMoyenne` | Calcule la note du bulletin. |
| [dates.js](../backend/src/utils/dates.js) | `anneeScolaireCourante` | Détermine quelle année scolaire est visée partout dans l'app. |
| [releve.service.js](../backend/src/services/releve.service.js) | `grouperTranscript` | Structure le relevé de notes officiel. |

### Niveau 2 — service avec dépendances mockées

| Fichier testé | Fonctions |
|---|---|
| [paiement.service.js](../backend/src/services/paiement.service.js) | `creerDemande`, `traiterValidation`, `proprietaireDe` |

Modules stubés : `paiement.model`, `tarif.model`, `ecole.model`, `inscription.model`,
`eleve.model`, `note.model`, `documentOfficiel.model`, `historique.model`,
`releve.service`, `config/mailer`.

## A.3 Cas de test — `calculerMoyenne`

| # | Cas | Attendu |
|---|---|---|
| 1 | 3 matières, coefficients 1/2/3 | Moyenne pondérée `Σ(valeur×coef)/Σ(coef)` |
| 2 | Coefficient absent (`undefined`) | Traité comme 1 |
| 3 | Liste vide | `{ lignes: [], sommeCoef: 0, moyenneGenerale: 0 }` — pas de division par zéro |
| 4 | Coefficients décimaux renvoyés en chaîne par mysql2 (`"1.50"`) | Convertis correctement |
| 5 | Arrondi à 2 décimales | `66.666…` → `66.67` |
| 6 | Coefficient explicitement `0` | Matière exclue du calcul (poids `0`) — voir A.5 (a) |
| 7 | `valeur` non numérique | Ligne exclue de `sommeCoef` et `sommeProduits`, conservée dans `lignes` avec `valeur: null` — voir A.5 (b) |
| 8 | Aucune note valide dans la liste | `moyenneGenerale: 0`, `sommeCoef: 0` — pas de `NaN` |

## A.4 Cas de test — `paiement.service.js`

**`creerDemande`** — un test par refus, plus le cas nominal :

| Situation | Attendu |
|---|---|
| `typeFrais` hors `['inscription','releve','duplicata']` | `400` |
| `idReference` manquant | `400` |
| Référence introuvable | `404` |
| Le demandeur n'est pas le propriétaire | **`403`** — garde-fou d'accès |
| Inscription déjà `confirmee` | `409` |
| Inscription pas encore `accepte` | `409` |
| Aucun tarif configuré | `409` |
| Cas nominal | `ok: true`, montant et devise **repris du tarif courant**, statut `en_attente` |

**`traiterValidation`** :

| Situation | Attendu |
|---|---|
| `statut` ni `valide` ni `rejete` | `400` |
| Paiement introuvable | `404` |
| Paiement déjà traité | `409` — **empêche la double validation** |
| Aucune preuve téléversée | `400` |
| Rejet | Aucun document généré, courriel de rejet avec le motif |
| Validation d'une inscription | Inscription passée à `confirmee` **et** journalisée |
| Validation d'un relevé / duplicata | Document généré et archivé |
| **L'envoi de courriel échoue** | La validation **réussit quand même** (`ok: true`) — protège le `try/catch` des lignes 141-147 |

**`proprietaireDe`** : renvoie l'`idUtilisateur` attendu ; `null` si la référence
n'existe plus.

Total estimé : **~30 tests**.

## A.5 Deux corrections à apporter à `calculerMoyenne` — **décidées le 2026-07-23**

Deux comportements repérés en lisant le code. Les deux sont **corrigés** dans cette
étape, dans un commit séparé des tests pour être revisibles seuls.

**(a) Coefficient `0` devient `1`** — [moyenne.service.js:10](../backend/src/services/moyenne.service.js#L10)

```js
const coefficient = Number(n.coefficient) || 1;   // 0 || 1 === 1
```

Une matière configurée avec un coefficient `0` (pour l'exclure du calcul) est comptée
avec le poids `1`. Le schéma autorise `DECIMAL(4,2)`, donc `0` est saisissable depuis
l'écran Direction.

> **Décision : corriger.** `Number.isFinite(c) ? c : 1` — un `0` explicite reste `0`
> et la matière ne pèse plus rien dans la moyenne. Le repli sur `1` ne s'applique
> qu'à une valeur absente ou non numérique.

**(b) Une note invalide contamine toute la moyenne** — même fichier, ligne 9

`Number(undefined)` vaut `NaN`, et un seul `NaN` rend **la moyenne générale entière**
`NaN` — sans erreur ni journal. Le bulletin s'imprime avec une valeur vide ou `NaN`.

> **Décision : ignorer la ligne.** Une note non numérique est traitée comme
> **matière non notée** : elle est exclue de `sommeProduits` **et** de `sommeCoef`,
> donc la moyenne des autres matières reste juste.
>
> La ligne **reste présente** dans `lignes` (avec `valeur: null`, `produit: null`)
> pour que le bulletin puisse afficher la matière sans note plutôt que de la faire
> disparaître. Son `coefficient` reste affiché.
>
> Cas limite : si **aucune** note n'est valide, `sommeCoef` vaut `0` et
> `moyenneGenerale` vaut `0` — même comportement que la liste vide (cas 3).

## A.6 Critères d'acceptation — partie A

- `npm test` dans `backend/` passe, **sans MySQL démarré**.
- Les ~30 cas ci-dessus sont couverts.
- Aucune modification de `src/`, **sauf** les corrections que tu auras validées en A.5.
- Le `README` (ou `CLAUDE.md`) mentionne `npm test`.

---

# PARTIE B — Découpage de `global.css`

## B.1 Principe directeur

**Ce chantier ne change pas une seule règle CSS.** C'est un déplacement de blocs.
L'ordre du fichier est l'ordre de la cascade : si l'ordre bouge, le rendu bouge.
Le découpage doit donc respecter les frontières de sections **exactement** telles
qu'elles existent, et la preuve d'absence de régression est mécanique (§ B.4).

`global.css` reste le point d'entrée unique importé par
[main.jsx:6](../frontend/src/main.jsx#L6) ; il ne contient plus que la liste
ordonnée des `@import`. Vite résout les `@import` CSS et les concatène dans l'ordre.

## B.2 Découpage proposé — `frontend/src/styles/`

Les lignes correspondent au fichier actuel.

| Nouveau fichier | Lignes | Contenu |
|---|---|---|
| `variables.css` | — | Inchangé (déjà séparé) |
| `base.css` | 1-20 | Reset, `body`, titres |
| `utilitaires.css` | 21-30 | `.pile`, `.rangee`, `.texte-gris`… |
| `layout.css` | 31-40 | `.app-shell`, `.contenu` |
| `auth.css` | 41-153 | Écran d'authentification (palette marine + or) |
| `composants.css` | 154-275 | Carte, Champ, Bouton, Badge, Alerte, BarreNav, Tableau, Chargement, Titre, Grille |
| `responsive-global.css` | 276-339 | Media queries tablette/téléphone + règles d'impression |
| `site-public.css` | 340-623 | Navigation publique, menus, squelette de page, vlog (liste), corps enseignant |
| `accueil.css` | 624-762 | Page d'accueil |
| `pied-de-page.css` | 763-774 | Pied de page partagé |
| `admin-secretariat.css` | 775-1163 | Tableau de bord secrétariat + page Inscriptions |
| `admin-vlog.css` | 1164-1250 | Espace administrateur vlog |
| `espace-eleve.css` | 1251-1335 | Mes résultats |
| `public-sections.css` | 1336-1563 | Vlog public, À propos, Examens passés (galerie + assistant IA) |
| `sidebar.css` | 1564-fin | Barre de navigation latérale |

**15 fichiers, aucun au-dessus de ~400 lignes.**

Point de vigilance : `responsive-global.css` (276-339) contient des media queries qui
surchargent les composants définis juste avant. Il **doit** rester importé à cette
position exacte, pas regroupé avec les autres responsives en fin de fichier.

## B.3 Résultat — `global.css`

```css
@import './variables.css';
@import './base.css';
@import './utilitaires.css';
@import './layout.css';
@import './auth.css';
@import './composants.css';
@import './responsive-global.css';
@import './site-public.css';
@import './accueil.css';
@import './pied-de-page.css';
@import './admin-secretariat.css';
@import './admin-vlog.css';
@import './espace-eleve.css';
@import './public-sections.css';
@import './sidebar.css';
```

## B.4 Preuve d'absence de régression

1. **Avant** le découpage : `npm run build` dans `frontend/`, mettre de côté le CSS
   généré (`dist/assets/*.css`).
2. **Après** : rebuild, puis comparer les deux CSS générés.
3. **Critère : les deux fichiers doivent être identiques** (au nom haché près). Une
   seule différence = un bloc a changé de place, et je la corrige avant de livrer.

C'est une preuve mécanique, pas une inspection à l'œil — c'est pour ça que ce chantier
est sûr malgré sa taille.

## B.5 Critères d'acceptation — partie B

- CSS généré **identique** avant/après (§ B.4).
- Un seul `@import './styles/global.css'` dans `main.jsx` (inchangé).
- Aucun `.jsx` modifié.
- Aucun nom de classe modifié.

---

## 3. Livraison

**Décidé le 2026-07-23 : partie A d'abord, revue, puis partie B.**

Trois commits séparés :

1. `Tests : filet sur les calculs de moyennes et de paiements`
2. `Moyennes : coefficient 0 respecté, note invalide ignorée au lieu de propager NaN`
   — les corrections A.5, isolées pour être revisibles seules
3. `CSS : découpage de global.css par domaine (rendu identique)` — **après ta revue de A**

## 4. Questions ouvertes

Aucune — les trois points ouverts ont été tranchés le 2026-07-23 (voir A.5 et § 3).
