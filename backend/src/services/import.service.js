// Service Import — lit un tableur (Excel .xlsx ou CSV) et intègre les données
// dans le système, avec une correspondance (mapping) choisie par l'utilisateur
// pour s'adapter à N'IMPORTE QUELLE structure de colonnes.
import fs from 'fs';
import ExcelJS from 'exceljs';
import { creerEleveImporte, eleveExisteImport } from '../models/eleve.model.js';

// Champs cibles par type d'import (sert à construire l'écran de correspondance).
export const CHAMPS = {
  eleves: [
    { cle: 'nom', libelle: 'Nom', requis: true },
    { cle: 'prenom', libelle: 'Prénom', requis: false },
    { cle: 'sexe', libelle: 'Sexe (M/F)', requis: false },
    { cle: 'dateNaissance', libelle: 'Date de naissance', requis: false },
    { cle: 'niveau', libelle: 'Niveau / classe', requis: false },
  ],
};

// --- Lecture du fichier --------------------------------------------------

function valeurCellule(v) {
  if (v == null) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);     // AAAA-MM-JJ
  if (typeof v === 'object') {
    if (v.text) return String(v.text);                            // texte enrichi
    if (v.result != null) return String(v.result);               // formule
    if (v.hyperlink) return String(v.text || v.hyperlink);
    return '';
  }
  return String(v).trim();
}

// Découpe une ligne CSV en tenant compte des guillemets. Délimiteur , ou ;.
function parserLigneCsv(ligne, delim) {
  const champs = [];
  let cur = '';
  let entreGuillemets = false;
  for (let i = 0; i < ligne.length; i += 1) {
    const c = ligne[i];
    if (c === '"') {
      if (entreGuillemets && ligne[i + 1] === '"') { cur += '"'; i += 1; }
      else entreGuillemets = !entreGuillemets;
    } else if (c === delim && !entreGuillemets) {
      champs.push(cur); cur = '';
    } else {
      cur += c;
    }
  }
  champs.push(cur);
  return champs.map((s) => s.trim());
}

function parserCsv(contenu) {
  const texte = contenu.replace(/^﻿/, '');                   // enlève le BOM
  const lignes = texte.split(/\r?\n/).filter((l) => l.trim() !== '');
  if (!lignes.length) return { entetes: [], lignes: [] };
  // Délimiteur : ; (Excel FR) ou , selon le plus fréquent sur la 1re ligne.
  const delim = (lignes[0].split(';').length > lignes[0].split(',').length) ? ';' : ',';
  const toutes = lignes.map((l) => parserLigneCsv(l, delim));
  return { entetes: toutes[0], lignes: toutes.slice(1) };
}

// Renvoie { entetes: [...], lignes: [[...]] } pour un .xlsx ou un .csv.
export async function parserFichier(chemin) {
  const estCsv = /\.csv$/i.test(chemin);
  if (estCsv) return parserCsv(fs.readFileSync(chemin, 'utf8'));

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(chemin);
  const ws = wb.worksheets[0];
  if (!ws) return { entetes: [], lignes: [] };
  const toutes = [];
  ws.eachRow((row) => {
    const vals = Array.isArray(row.values) ? row.values.slice(1) : [];
    toutes.push(vals.map(valeurCellule));
  });
  const nonVides = toutes.filter((r) => r.some((c) => c !== ''));
  if (!nonVides.length) return { entetes: [], lignes: [] };
  return { entetes: nonVides[0], lignes: nonVides.slice(1) };
}

// Aperçu : en-têtes + premières lignes (pour l'écran de correspondance).
export async function apercu(chemin, maxLignes = 6) {
  const { entetes, lignes } = await parserFichier(chemin);
  return { entetes, apercu: lignes.slice(0, maxLignes), nbLignes: lignes.length };
}

// --- Import des élèves ---------------------------------------------------

function normaliserSexe(v) {
  const s = (v || '').toString().trim().toUpperCase();
  if (s.startsWith('M') || s.startsWith('G')) return 'M';   // Masculin / Garçon
  if (s.startsWith('F')) return 'F';                        // Féminin / Fille
  return null;
}

// Normalise une date en AAAA-MM-JJ (accepte AAAA-MM-JJ, JJ/MM/AAAA, JJ-MM-AAAA).
function normaliserDate(v) {
  const s = (v || '').toString().trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/.exec(s);
  if (m) {
    const [, j, mo, a] = m;
    return `${a}-${mo.padStart(2, '0')}-${j.padStart(2, '0')}`;
  }
  return null; // format non reconnu → on n'enregistre pas de date (plutôt qu'une mauvaise)
}

// mapping : { nom: <index de colonne>, prenom: <index|null>, ... }
export async function importerEleves(lignes, mapping) {
  const idx = (cle) => (Number.isInteger(mapping[cle]) ? mapping[cle] : null);
  const champ = (ligne, cle) => {
    const i = idx(cle);
    return i == null ? '' : (ligne[i] == null ? '' : String(ligne[i]).trim());
  };

  let importes = 0;
  let ignores = 0;
  const erreurs = [];

  for (let n = 0; n < lignes.length; n += 1) {
    const ligne = lignes[n];
    const noLigne = n + 2; // +1 en-tête, +1 base 1 (comme dans le tableur)
    const nom = champ(ligne, 'nom');
    if (!nom) { erreurs.push({ ligne: noLigne, raison: 'Nom manquant' }); continue; }

    const prenom = champ(ligne, 'prenom') || null;
    const sexe = normaliserSexe(champ(ligne, 'sexe'));
    const dateNaissance = normaliserDate(champ(ligne, 'dateNaissance'));
    const niveau = champ(ligne, 'niveau') || null;

    try {
      if (await eleveExisteImport({ nom, prenom, dateNaissance })) {
        ignores += 1;
        continue;
      }
      await creerEleveImporte({
        nom: nom.slice(0, 120), prenom: prenom ? prenom.slice(0, 120) : null,
        sexe, dateNaissance, niveau: niveau ? niveau.slice(0, 60) : null,
      });
      importes += 1;
    } catch (err) {
      erreurs.push({ ligne: noLigne, raison: err.message });
    }
  }
  return { importes, ignores, erreurs };
}

// Dispatch par type (pour l'instant : élèves).
export async function importer(type, lignes, mapping) {
  if (type === 'eleves') return importerEleves(lignes, mapping);
  const e = new Error('Type d\'import non pris en charge.');
  e.code = 'TYPE_IMPORT_INCONNU';
  throw e;
}
