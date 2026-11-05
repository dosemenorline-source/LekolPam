// Tests — année scolaire courante (source unique utilisée partout dans l'app)
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { anneeScolaireCourante } from '../src/utils/dates.js';

// Dates construites en heure locale (new Date(annee, moisIndex, jour)) car
// anneeScolaireCourante lit getFullYear()/getMonth(), qui sont locaux.
describe('anneeScolaireCourante', () => {
  test('la rentrée de septembre fait basculer sur la nouvelle année scolaire', () => {
    assert.equal(anneeScolaireCourante(new Date(2026, 8, 1)), '2026-2027');
  });

  test('le 31 août appartient encore à l’année scolaire précédente', () => {
    assert.equal(anneeScolaireCourante(new Date(2026, 7, 31)), '2025-2026');
  });

  test('janvier appartient à l’année scolaire commencée en septembre dernier', () => {
    assert.equal(anneeScolaireCourante(new Date(2026, 0, 15)), '2025-2026');
  });

  test('décembre appartient à l’année scolaire commencée en septembre', () => {
    assert.equal(anneeScolaireCourante(new Date(2026, 11, 31)), '2026-2027');
  });

  test('sans argument, se base sur la date du jour', () => {
    assert.match(anneeScolaireCourante(), /^\d{4}-\d{4}$/);
  });

  test('les deux années sont toujours consécutives', () => {
    for (const mois of [0, 5, 8, 11]) {
      const [debut, fin] = anneeScolaireCourante(new Date(2026, mois, 10)).split('-').map(Number);
      assert.equal(fin, debut + 1);
    }
  });
});
