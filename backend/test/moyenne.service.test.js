// Tests — calcul de la moyenne pondérée par coefficient.
// C'est cette valeur qui est imprimée sur le bulletin remis à la famille.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { calculerMoyenne } from '../src/services/moyenne.service.js';

describe('calculerMoyenne', () => {
  test('pondère chaque note par son coefficient', () => {
    // (80×1 + 60×2 + 90×3) / (1+2+3) = 470/6 = 78.33
    const r = calculerMoyenne([
      { matiere: 'Histoire', valeur: 80, coefficient: 1 },
      { matiere: 'Français', valeur: 60, coefficient: 2 },
      { matiere: 'Maths', valeur: 90, coefficient: 3 },
    ]);
    assert.equal(r.sommeCoef, 6);
    assert.equal(r.moyenneGenerale, 78.33);
  });

  test('détaille chaque ligne avec son produit valeur × coefficient', () => {
    const { lignes } = calculerMoyenne([
      { matiere: 'Maths', valeur: 90, coefficient: 3 },
    ]);
    assert.deepEqual(lignes, [
      { matiere: 'Maths', valeur: 90, bareme: 100, coefficient: 3, produit: 270 },
    ]);
  });

  test('un coefficient absent vaut 1', () => {
    // (80×1 + 60×1) / 2 = 70
    const r = calculerMoyenne([
      { matiere: 'Histoire', valeur: 80 },
      { matiere: 'Français', valeur: 60, coefficient: 1 },
    ]);
    assert.equal(r.sommeCoef, 2);
    assert.equal(r.moyenneGenerale, 70);
  });

  test('une liste vide ne provoque pas de division par zéro', () => {
    assert.deepEqual(calculerMoyenne([]), {
      lignes: [],
      sommeCoef: 0,
      moyenneGenerale: 0,
    });
  });

  test('accepte les décimales renvoyées en chaîne par mysql2 (DECIMAL)', () => {
    // mysql2 renvoie les colonnes DECIMAL sous forme de chaîne.
    // (80×1.5 + 60×0.5) / 2 = 150/2 = 75
    const r = calculerMoyenne([
      { matiere: 'Maths', valeur: '80.00', coefficient: '1.50' },
      { matiere: 'Sport', valeur: '60.00', coefficient: '0.50' },
    ]);
    assert.equal(r.sommeCoef, 2);
    assert.equal(r.moyenneGenerale, 75);
  });

  test('arrondit la moyenne générale à 2 décimales', () => {
    // 200/3 = 66.666… → 66.67
    const r = calculerMoyenne([
      { matiere: 'A', valeur: 100, coefficient: 1 },
      { matiere: 'B', valeur: 100, coefficient: 1 },
      { matiere: 'C', valeur: 0, coefficient: 1 },
    ]);
    assert.equal(r.moyenneGenerale, 66.67);
  });

  test('une note de 0 compte bien comme un zéro, pas comme une absence', () => {
    // (0×1 + 100×1) / 2 = 50
    const r = calculerMoyenne([
      { matiere: 'A', valeur: 0, coefficient: 1 },
      { matiere: 'B', valeur: 100, coefficient: 1 },
    ]);
    assert.equal(r.sommeCoef, 2);
    assert.equal(r.moyenneGenerale, 50);
  });
});

describe('calculerMoyenne — barèmes différents (note « sur X »)', () => {
  test('des notes à barèmes différents sont converties en pourcentage pour la moyenne', () => {
    // Maths 72/100 → 72% (coef 3) ; Conduite 15/20 → 75% (coef 1)
    // (72×3 + 75×1) / 4 = 291/4 = 72.75
    const r = calculerMoyenne([
      { matiere: 'Maths', valeur: 72, bareme: 100, coefficient: 3 },
      { matiere: 'Conduite', valeur: 15, bareme: 20, coefficient: 1 },
    ]);
    assert.equal(r.moyenneGenerale, 72.75);
  });

  test('un barème absent retombe sur 100 (compatibilité des notes existantes)', () => {
    const r = calculerMoyenne([{ matiere: 'Maths', valeur: 80, coefficient: 1 }]);
    assert.equal(r.lignes[0].bareme, 100);
    assert.equal(r.moyenneGenerale, 80);
  });

  test('la valeur et le barème d’origine restent inchangés dans les lignes (jamais convertis)', () => {
    const { lignes } = calculerMoyenne([
      { matiere: 'Conduite', valeur: 15, bareme: 20, coefficient: 1 },
    ]);
    assert.equal(lignes[0].valeur, 15);
    assert.equal(lignes[0].bareme, 20);
  });
});

describe('calculerMoyenne — coefficient 0 (matière hors calcul)', () => {
  test('un coefficient 0 explicite exclut la matière de la moyenne', () => {
    // Sport est configuré à 0 par la Direction : seul Maths compte.
    const r = calculerMoyenne([
      { matiere: 'Maths', valeur: 90, coefficient: 2 },
      { matiere: 'Sport', valeur: 10, coefficient: 0 },
    ]);
    assert.equal(r.sommeCoef, 2);
    assert.equal(r.moyenneGenerale, 90);
  });

  test('un coefficient 0 en chaîne (DECIMAL mysql2) est respecté aussi', () => {
    const r = calculerMoyenne([
      { matiere: 'Maths', valeur: 90, coefficient: '2.00' },
      { matiere: 'Sport', valeur: 10, coefficient: '0.00' },
    ]);
    assert.equal(r.moyenneGenerale, 90);
  });

  test('la matière à coefficient 0 reste affichée sur le bulletin', () => {
    const { lignes } = calculerMoyenne([
      { matiere: 'Sport', valeur: 10, coefficient: 0 },
    ]);
    assert.deepEqual(lignes, [
      { matiere: 'Sport', valeur: 10, bareme: 100, coefficient: 0, produit: 0 },
    ]);
  });

  test('un coefficient null retombe sur 1, il n’est pas confondu avec 0', () => {
    // NULL en base = coefficient non configuré, pas « matière hors calcul »
    const r = calculerMoyenne([
      { matiere: 'A', valeur: 80, coefficient: null },
      { matiere: 'B', valeur: 60, coefficient: undefined },
    ]);
    assert.equal(r.sommeCoef, 2);
    assert.equal(r.moyenneGenerale, 70);
  });

  test('un coefficient illisible retombe sur 1', () => {
    const r = calculerMoyenne([{ matiere: 'A', valeur: 80, coefficient: 'abc' }]);
    assert.equal(r.sommeCoef, 1);
    assert.equal(r.moyenneGenerale, 80);
  });

  test('si toutes les matières sont à 0, la moyenne vaut 0 sans division par zéro', () => {
    const r = calculerMoyenne([
      { matiere: 'A', valeur: 80, coefficient: 0 },
      { matiere: 'B', valeur: 60, coefficient: 0 },
    ]);
    assert.equal(r.sommeCoef, 0);
    assert.equal(r.moyenneGenerale, 0);
  });
});

describe('calculerMoyenne — matière non notée', () => {
  test('une note absente n’est pas comptée comme un zéro', () => {
    // Sans exclusion, (100 + 0)/2 donnerait 50 : un bulletin faussé.
    const r = calculerMoyenne([
      { matiere: 'Maths', valeur: 100, coefficient: 1 },
      { matiere: 'Sport', valeur: null, coefficient: 1 },
    ]);
    assert.equal(r.sommeCoef, 1);
    assert.equal(r.moyenneGenerale, 100);
  });

  test('une note non numérique ne rend pas toute la moyenne NaN', () => {
    for (const invalide of [undefined, '', 'absent', NaN]) {
      const r = calculerMoyenne([
        { matiere: 'Maths', valeur: 80, coefficient: 1 },
        { matiere: 'Sport', valeur: invalide, coefficient: 1 },
      ]);
      assert.equal(r.moyenneGenerale, 80, `valeur invalide : ${String(invalide)}`);
      assert.ok(!Number.isNaN(r.moyenneGenerale));
    }
  });

  test('la matière non notée reste dans les lignes, avec valeur et produit à null', () => {
    const { lignes } = calculerMoyenne([
      { matiere: 'Sport', valeur: null, coefficient: 2 },
    ]);
    // Conservée pour que le bulletin puisse l’afficher sans note,
    // plutôt que de faire disparaître la matière.
    assert.deepEqual(lignes, [
      { matiere: 'Sport', valeur: null, bareme: 100, coefficient: 2, produit: null },
    ]);
  });

  test('aucune note valide donne une moyenne de 0, comme une liste vide', () => {
    const r = calculerMoyenne([
      { matiere: 'A', valeur: null, coefficient: 1 },
      { matiere: 'B', valeur: undefined, coefficient: 1 },
    ]);
    assert.equal(r.sommeCoef, 0);
    assert.equal(r.moyenneGenerale, 0);
    assert.equal(r.lignes.length, 2);
  });

  test('une note à 0 reste bien distincte d’une note absente', () => {
    const zero = calculerMoyenne([
      { matiere: 'A', valeur: 0, coefficient: 1 },
      { matiere: 'B', valeur: 100, coefficient: 1 },
    ]);
    const absente = calculerMoyenne([
      { matiere: 'A', valeur: null, coefficient: 1 },
      { matiere: 'B', valeur: 100, coefficient: 1 },
    ]);
    assert.equal(zero.moyenneGenerale, 50);
    assert.equal(absente.moyenneGenerale, 100);
  });
});
