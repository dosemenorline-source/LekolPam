// Service de calcul des moyennes pondérées par coefficient

// Convertit une valeur venue de MySQL en nombre.
// Renvoie null si elle est absente (NULL, undefined, chaîne vide) ou non numérique.
// mysql2 renvoie les colonnes DECIMAL sous forme de chaîne : « 12.50 » est valide.
function nombre(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// notes : [{ matiere, valeur, bareme, coefficient }]
// Retourne { lignes: [{ matiere, valeur, bareme, coefficient, produit }], sommeCoef, moyenneGenerale }
//
// Chaque note garde son barème d'origine (10, 20, 100...) tel qu'il a été
// saisi — affiché sans conversion. Seule la moyenne pondérée (qui doit
// combiner des matières à barèmes différents en un seul chiffre comparable
// au seuil de réussite) convertit chaque note en pourcentage juste pour ce
// calcul ; le barème et la valeur d'origine ne sont jamais altérés.
//
// Une matière sans note exploitable est conservée dans `lignes` avec
// valeur/produit à null — elle reste visible sur le bulletin comme « non notée »
// mais n'entre ni dans sommeProduits ni dans sommeCoef, pour que la moyenne des
// autres matières reste juste (sinon un seul NaN rendait toute la moyenne NaN).
export function calculerMoyenne(notes) {
  let sommeProduits = 0;
  let sommeCoef = 0;
  const lignes = notes.map((n) => {
    // Un coefficient 0 est un choix de la Direction (matière hors calcul) :
    // seul un coefficient absent ou illisible retombe sur 1.
    const coefLu = nombre(n.coefficient);
    const coefficient = coefLu === null ? 1 : coefLu;

    const valeur = nombre(n.valeur);
    const baremeLu = nombre(n.bareme);
    const bareme = baremeLu === null || baremeLu <= 0 ? 100 : baremeLu;
    if (valeur === null) {
      return { matiere: n.matiere, valeur: null, bareme, coefficient, produit: null };
    }

    const pourcentage = (valeur / bareme) * 100;
    const produit = pourcentage * coefficient;
    sommeProduits += produit;
    sommeCoef += coefficient;
    return { matiere: n.matiere, valeur, bareme, coefficient, produit };
  });
  const moyenneGenerale = sommeCoef > 0 ? sommeProduits / sommeCoef : 0;
  // Arrondi à 2 décimales
  return {
    lignes,
    sommeCoef,
    moyenneGenerale: Math.round(moyenneGenerale * 100) / 100,
  };
}
