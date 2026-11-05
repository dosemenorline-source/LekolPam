// Contrôleur Import — analyse d'un tableur puis import avec correspondance.
import fs from 'fs';
import path from 'path';
import { DOSSIER_IMPORTS } from '../config/upload.js';
import { CHAMPS, apercu, parserFichier, importer } from '../services/import.service.js';
import { tracer } from '../services/securite.service.js';

// GET /api/import/champs?type=eleves — champs cibles pour l'écran de correspondance.
export function champs(req, res) {
  const type = req.query.type;
  if (!CHAMPS[type]) return res.status(400).json({ erreur: 'Type d\'import inconnu.' });
  res.json({ type, champs: CHAMPS[type] });
}

// Jeton = nom de fichier temporaire généré par multer (aléatoire). On le valide
// strictement et on vérifie qu'il reste dans le dossier des imports.
function cheminDepuisJeton(jeton) {
  if (!/^[a-f0-9]{16,64}\.(xlsx|csv|xls)$/i.test(jeton || '')) return null;
  const racine = path.resolve(DOSSIER_IMPORTS);
  const cible = path.resolve(racine, jeton);
  if (cible !== racine && !cible.startsWith(racine + path.sep)) return null;
  return cible;
}

// POST /api/import/analyser (multipart: fichier) — renvoie en-têtes + aperçu + jeton.
export async function analyser(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ erreur: 'Fichier requis.' });
    const { entetes, apercu: lignes, nbLignes } = await apercu(req.file.path);
    if (!entetes.length) {
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({ erreur: 'Le fichier est vide ou illisible.' });
    }
    res.json({ jeton: req.file.filename, entetes, apercu: lignes, nbLignes });
  } catch (err) {
    if (req.file) fs.unlink(req.file.path, () => {});
    if (/zip|corrupt|format|xml/i.test(err.message || '')) {
      return res.status(400).json({ erreur: 'Fichier illisible. Enregistrez-le au format Excel (.xlsx) ou CSV.' });
    }
    next(err);
  }
}

// POST /api/import/:type (body: jeton, mapping) — importe puis supprime le fichier.
export async function lancer(req, res, next) {
  const type = req.params.type;
  if (!CHAMPS[type]) return res.status(400).json({ erreur: 'Type d\'import inconnu.' });

  const cible = cheminDepuisJeton(req.body?.jeton);
  if (!cible || !fs.existsSync(cible)) {
    return res.status(400).json({ erreur: 'Fichier d\'import expiré ou introuvable. Recommencez.' });
  }

  // mapping : { <cléChamp>: <indexColonne> }. On ne garde que des entiers ≥ 0.
  const mappingBrut = req.body?.mapping || {};
  const mapping = {};
  for (const champDef of CHAMPS[type]) {
    const v = Number(mappingBrut[champDef.cle]);
    if (Number.isInteger(v) && v >= 0) mapping[champDef.cle] = v;
    else if (champDef.requis) {
      return res.status(400).json({ erreur: `Veuillez indiquer la colonne pour « ${champDef.libelle} ».` });
    }
  }

  try {
    const { lignes } = await parserFichier(cible);
    const resultat = await importer(type, lignes, mapping);
    tracer('import_donnees', { req, details: `${type} : ${resultat.importes} importé(s), ${resultat.ignores} ignoré(s)` });
    res.json(resultat);
  } catch (err) {
    next(err);
  } finally {
    fs.unlink(cible, () => {}); // fichier temporaire supprimé après usage
  }
}
