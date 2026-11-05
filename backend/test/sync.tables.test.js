// Tests — invariants de la configuration de synchronisation (sans base).
// Garde-fou : une table ne peut se synchroniser que si TOUTES ses cibles de
// clés étrangères sont elles-mêmes synchronisées ET déclarées AVANT elle
// (ordre de dépendance), sinon le remapping sync_id → id local échouerait.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { SYNC_TABLES, SYNC_NOMS, COLONNES_TECHNIQUES, COLONNE_SYNC_ID } from '../src/sync/tables.js';

const rang = new Map(SYNC_NOMS.map((n, i) => [n, i]));

describe('configuration de synchronisation', () => {
  test('aucun doublon de table', () => {
    assert.equal(new Set(SYNC_NOMS).size, SYNC_NOMS.length);
  });

  test('chaque clé étrangère simple cible une table synchronisée, déclarée avant', () => {
    SYNC_TABLES.forEach((t, i) => {
      for (const fk of t.fks || []) {
        assert.ok(rang.has(fk.cible), `${t.nom}.${fk.colonne} → ${fk.cible} : cible non synchronisée`);
        assert.ok(rang.get(fk.cible) < i, `${t.nom}.${fk.colonne} → ${fk.cible} : cible déclarée APRÈS (ordre de dépendance violé)`);
      }
    });
  });

  test('chaque clé étrangère polymorphe cible des tables synchronisées, déclarées avant', () => {
    SYNC_TABLES.forEach((t, i) => {
      for (const poly of t.polymorphes || []) {
        for (const cible of Object.values(poly.carte)) {
          assert.ok(rang.has(cible), `${t.nom}.${poly.colonne} → ${cible} : cible non synchronisée`);
          assert.ok(rang.get(cible) < i, `${t.nom}.${poly.colonne} → ${cible} : cible déclarée APRÈS`);
        }
      }
    });
  });

  test('les colonnes techniques internes ne sont pas transportées comme données', () => {
    // id et horodatages/drapeaux internes sont recalculés localement.
    assert.ok(COLONNES_TECHNIQUES.has('id'));
    assert.ok(!COLONNES_TECHNIQUES.has(COLONNE_SYNC_ID)); // l'identité, elle, est transportée
  });
});
