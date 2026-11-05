// État du processus en cours : heure de démarrage + dernières erreurs non gérées.
// En mémoire uniquement (remis à zéro à chaque redémarrage/redéploiement) —
// pour un historique durable des erreurs, voir les logs Railway.
const demarreLe = new Date();
const MAX_ERREURS = 20;
const dernieresErreurs = [];

export function enregistrerErreur(err) {
  dernieresErreurs.unshift({
    message: String(err?.message || err),
    date: new Date().toISOString(),
  });
  dernieresErreurs.length = Math.min(dernieresErreurs.length, MAX_ERREURS);
}

export function etatServeur() {
  return {
    demarreLe: demarreLe.toISOString(),
    dernieresErreurs,
  };
}
