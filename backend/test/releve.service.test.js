// Tests — regroupement du relevé de notes officiel (transcript).
// grouperTranscript est pur ; la génération PDF n'est pas testée ici.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { grouperTranscript } from '../src/services/releve.service.js';

const note = (annee, periode, matiere, valeur, coefficient = 1) =>
  ({ annee_scolaire: annee, periode, matiere, valeur, coefficient });

describe('grouperTranscript', () => {
  test('regroupe les notes par année scolaire et par trimestre', () => {
    const groupes = grouperTranscript([
      note('2025-2026', '1er_trimestre', 'Maths', 80),
      note('2025-2026', '1er_trimestre', 'Français', 60),
      note('2025-2026', '2e_trimestre', 'Maths', 90),
      note('2026-2027', '1er_trimestre', 'Maths', 70),
    ]);
    assert.equal(groupes.length, 3);
    assert.deepEqual(
      groupes.map((g) => [g.annee, g.periode]),
      [
        ['2025-2026', '1er_trimestre'],
        ['2025-2026', '2e_trimestre'],
        ['2026-2027', '1er_trimestre'],
      ]
    );
  });

  test('calcule la moyenne pondérée de chaque groupe', () => {
    const [groupe] = grouperTranscript([
      note('2025-2026', '1er_trimestre', 'Maths', 90, 3),
      note('2025-2026', '1er_trimestre', 'Sport', 50, 1),
    ]);
    // (90×3 + 50×1) / 4 = 320/4 = 80
    assert.equal(groupe.moyenne, 80);
    assert.equal(groupe.lignes.length, 2);
  });

  test('conserve l’ordre d’arrivée des notes de la base', () => {
    const groupes = grouperTranscript([
      note('2026-2027', '3e_trimestre', 'Maths', 70),
      note('2025-2026', '1er_trimestre', 'Maths', 80),
    ]);
    assert.equal(groupes[0].annee, '2026-2027');
    assert.equal(groupes[1].annee, '2025-2026');
  });

  test('une même matière notée deux fois dans un trimestre garde ses deux lignes', () => {
    const [groupe] = grouperTranscript([
      note('2025-2026', '1er_trimestre', 'Maths', 100),
      note('2025-2026', '1er_trimestre', 'Maths', 50),
    ]);
    assert.equal(groupe.lignes.length, 2);
    assert.equal(groupe.moyenne, 75);
  });

  test('aucune note donne aucun groupe', () => {
    assert.deepEqual(grouperTranscript([]), []);
  });
});
