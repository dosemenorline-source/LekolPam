// Utilitaires de dates — source unique pour l'année scolaire courante.

// Année scolaire courante, calculée automatiquement à partir de la date du jour.
// La nouvelle année devient courante à la rentrée (septembre) : à partir de
// septembre AAAA, l'année scolaire est « AAAA-(AAAA+1) », sinon « (AAAA-1)-AAAA ».
export function anneeScolaireCourante(date = new Date()) {
  const annee = date.getFullYear();
  const mois = date.getMonth() + 1; // 1 = janvier … 12 = décembre
  return mois >= 9 ? `${annee}-${annee + 1}` : `${annee - 1}-${annee}`;
}

// Année scolaire suivante : « 2025-2026 » → « 2026-2027 ». Sert à la
// ré-inscription (l'année visée est celle qui suit l'année en cours).
export function anneeSuivante(annee = anneeScolaireCourante()) {
  const m = /^(\d{4})-(\d{4})$/.exec(annee);
  if (!m) return annee;
  return `${Number(m[1]) + 1}-${Number(m[2]) + 1}`;
}
