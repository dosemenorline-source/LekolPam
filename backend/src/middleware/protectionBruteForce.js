// Protection anti brute-force en mémoire, indexée par une CLÉ MÉTIER (ex. le
// préfixe d'un code d'accès élève) plutôt que par IP. Complète authLimiter :
// un rate-limit par IP seul ne coûte presque rien à contourner (rotation de
// proxys), alors qu'ici c'est la clé elle-même qui se verrouille après trop
// d'échecs, quelle que soit la source des requêtes.
// Un seul processus Node (pas de scaling horizontal ici) : une Map en mémoire
// suffit, pas besoin d'un store partagé.
const tentatives = new Map(); // cle -> { compte, depuis }
const FENETRE_MS = 15 * 60 * 1000;

export function creerProtection({ seuil }) {
  return {
    bloque(cle) {
      const entree = tentatives.get(cle);
      if (!entree) return false;
      if (Date.now() - entree.depuis > FENETRE_MS) { tentatives.delete(cle); return false; }
      return entree.compte >= seuil;
    },
    enregistrerEchec(cle) {
      const entree = tentatives.get(cle);
      if (!entree || Date.now() - entree.depuis > FENETRE_MS) {
        tentatives.set(cle, { compte: 1, depuis: Date.now() });
      } else {
        entree.compte += 1;
      }
    },
    reinitialiser(cle) {
      tentatives.delete(cle);
    },
  };
}
