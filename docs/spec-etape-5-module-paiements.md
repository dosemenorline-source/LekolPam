# Spec — Étape 5 : Module Paiements (+ relevés / duplicatas)

**Projet :** Lekòl Pam
**Date :** 2026-07-08
**Statut :** en revue (pas encore démarré)
**Portée :** backend uniquement

---

## 1. Objectif

Gérer le **paiement hors ligne** (dépôt bancaire / MonCash) avec téléversement d'une preuve
et **validation manuelle** par le secrétariat, selon un flux **identique** pour les trois types
de frais : **inscription**, **relevé de notes**, **duplicata**. À la validation :
- frais d'inscription → l'inscription passe à **`confirmee`** ;
- relevé / duplicata → le **document officiel PDF** est généré et mis à disposition.

## 2. Décisions confirmées (2026-07-08)

- **Relevé = transcript** de toutes les notes **validées** de l'élève (toutes périodes/années),
  avec moyenne pondérée par trimestre.
- **Duplicata = copie du transcript étiquetée « DUPLICATA »** (+ identifiant unique propre).
- **Preuve de paiement : PDF / JPG / PNG, max 5 Mo** (mêmes règles que les documents d'inscription).
- Aucune donnée bancaire n'est stockée : **seule l'image de la preuve** est conservée (spec § 6.2).

## 3. Flux (identique pour les 3 types de frais — spec § 6.2)

1. Le demandeur crée un paiement : `POST /api/paiements { typeFrais, idReference }`.
   Le système lit le **tarif courant** du type de frais, crée le paiement `en_attente`,
   et renvoie le **montant** + les **coordonnées** bancaires / MonCash de l'école.
2. Le demandeur téléverse la preuve : `POST /api/paiements/:id/preuve` (image/PDF).
3. Le secrétariat consulte la **file de validation** et **valide** ou **rejette**.
4. Selon le type, à la validation → confirmation d'inscription **ou** génération du document.
5. **Notification courriel** au demandeur à chaque changement de statut.

### Référence (`idReference`) selon le type
| typeFrais    | idReference        | Contrôle |
|--------------|--------------------|----------|
| `inscription`| id de l'inscription| doit appartenir au parent **et** être au statut `accepte` |
| `releve`     | id de l'élève      | l'élève doit appartenir au parent |
| `duplicata`  | id de l'élève      | l'élève doit appartenir au parent |

## 4. Règles de gestion

- **Tarif requis** : si aucun tarif n'est configuré pour le type de frais → 409.
- Paiement d'inscription : refusé si l'inscription n'est pas `accepte` (409) ou déjà `confirmee` (409).
- **Validation impossible sans preuve** téléversée (400).
- À la validation d'un paiement d'inscription → inscription `confirmee` (respecte la règle
  « pas de `confirmee` sans validation du paiement ») + `historique_statut`.
- Chaque changement de statut de paiement est journalisé (`historique_statut`, entité `paiement`).
- Le demandeur ne voit que **ses** paiements ; admin/direction voient tout.
- Documents générés archivés avec **identifiant unique** (vérification ultérieure, spec § 4.3).

## 5. Modèle de données

**Aucune migration** : les tables `paiements`, `tarifs`, `ecole`, `documents_officiels`,
`historique_statut` existent déjà (Étapes 2–4). `paiements.id_reference` est polymorphe
(inscription **ou** élève selon `type_frais`).

## 6. Endpoints

### Tarifs & coordonnées (Direction configure ; lecture pour tous connectés)
| Méthode | Endpoint                  | Accès |
|---------|---------------------------|-------|
| POST    | `/api/tarifs`             | direction — `{ typeFrais, montant, devise, dateEffective }` |
| GET     | `/api/tarifs`             | connecté |
| PUT     | `/api/tarifs/:id`         | direction |
| PUT     | `/api/ecole`              | direction — `{ nom, coordonneesBancaires, coordonneesMoncash }` |
| GET     | `/api/ecole/coordonnees`  | connecté — nom + coordonnées (pour l'écran de paiement) |

### Paiements
| Méthode | Endpoint                          | Accès |
|---------|-----------------------------------|-------|
| POST    | `/api/paiements`                  | parent — crée la demande, renvoie montant + coordonnées |
| POST    | `/api/paiements/:id/preuve`       | parent propriétaire — multipart `preuve` (PDF/JPG/PNG, 5 Mo) |
| GET     | `/api/paiements`                  | parent — les siens |
| GET     | `/api/paiements/:id`              | propriétaire / admin / direction |
| GET     | `/api/paiements/:id/preuve`       | propriétaire / admin / direction — télécharge la preuve |
| GET     | `/api/admin/paiements?statut=`    | admin / direction — file de validation |
| PATCH   | `/api/paiements/:id/validation`   | admin / direction — `{ statut: 'valide'|'rejete', commentaire? }` |

## 7. Génération des documents (relevé / duplicata)

- Service `releve.service.js` (pdf-lib) : transcript de toutes les notes **validées** de
  l'élève, groupé par (année, trimestre), moyenne pondérée par groupe, en-tête école.
- `duplicata` : même rendu, filigrane / étiquette **« DUPLICATA »**.
- Fichiers dans `backend/uploads/officiels/`, archivés dans `documents_officiels`
  (`type` = `releve` | `duplicata`, `identifiant_unique`), servis via endpoint protégé
  (`GET /api/documents-officiels/:id/fichier`, déjà en place).

## 8. Structure de code ajoutée

```
src/
  models/tarif.model.js            tarif courant par type de frais
  models/ecole.model.js            lire / mettre à jour l'école
  models/paiement.model.js         créer, lister, détail, statut, propriété (polymorphe)
  services/releve.service.js       PDF transcript (relevé / duplicata)
  services/paiement.service.js     validation → confirmation inscription OU génération doc + courriel
  controllers/tarif.controller.js
  controllers/paiement.controller.js
  routes/paiement.routes.js
uploads/officiels/                 PDF générés (git-ignoré)
```

## 9. Sécurité

- Validation stricte : `typeFrais` (enum), `statut` (`valide`/`rejete`), `montant` (> 0).
- Contrôle de propriété polymorphe côté serveur (inscription ou élève selon le type).
- Aucune donnée bancaire saisie/stockée : seule l'image de la preuve.
- Fichiers preuve et documents servis via endpoints protégés ; noms générés (anti-traversal).
- Rate limiting sur le téléversement de preuve.

## 10. Critères de fin d'étape

- [ ] La Direction configure un tarif + les coordonnées de l'école.
- [ ] Un parent crée un paiement d'inscription (inscription `accepte`) → reçoit montant + coordonnées.
- [ ] Paiement sans tarif configuré → 409 ; validation sans preuve → 400.
- [ ] Après téléversement de la preuve + validation admin → inscription `confirmee` + courriel.
- [ ] Un paiement `relevé` validé génère un transcript PDF téléchargeable ; `duplicata` idem étiqueté.
- [ ] Un parent ne voit ni les paiements ni les documents d'un autre (403).
- [ ] Historique de statut du paiement enregistré ; rejet notifié par courriel.
- [ ] Le transcript contient les bonnes moyennes pondérées (vérifié par calcul).
```
