// Contrôleur de synchronisation (côté nuage / hub).
//   POST /api/sync/pull  : le poste réclame les modifs depuis son curseur.
//   POST /api/sync/push  : le poste envoie ses modifs locales.
//   + gestion des postes (propriétaire) : créer / lister / révoquer.
import fs from 'fs';
import path from 'path';
import { pool } from '../config/db.js';
import { UPLOAD_ROOT } from '../config/upload.js';
import { collecterDepuis, appliquer, compterEnAttente } from '../sync/engine.js';
import {
  creerNoeud as creerNoeudModel, listerNoeuds as listerNoeudsModel,
  revoquerNoeud as revoquerNoeudModel, marquerPull, marquerPush,
} from '../sync/noeud.model.js';
import { resumeEtat } from '../sync/etat.model.js';
import { syncPosteConfigure, cycleSync } from '../sync/worker.js';
import { creerCompletionLocale, MODELE_IA } from '../config/ia.js';
import { tracer, alerter } from '../services/securite.service.js';

const LIMITE_PULL = 1000;                 // enregistrements max renvoyés par pull
const MAX_ENREGISTREMENTS_PUSH = 2000;    // enregistrements max acceptés par push

// --- POST /api/sync/pull ------------------------------------------------
export async function pull(req, res, next) {
  try {
    const curseur = typeof req.body?.curseur === 'string' ? req.body.curseur : null;
    const lot = await collecterDepuis(pool, curseur, { limite: LIMITE_PULL });
    marquerPull(req.noeudSync.id).catch(() => {});
    res.json(lot);
  } catch (err) {
    next(err);
  }
}

// --- POST /api/sync/push ------------------------------------------------
export async function push(req, res, next) {
  const enregistrements = Array.isArray(req.body?.enregistrements) ? req.body.enregistrements : [];
  const tombstones = Array.isArray(req.body?.tombstones) ? req.body.tombstones : [];

  if (enregistrements.length + tombstones.length > MAX_ENREGISTREMENTS_PUSH) {
    return res.status(413).json({ erreur: 'Lot de synchronisation trop volumineux.' });
  }

  // Transaction sur une connexion dédiée : l'application d'un push doit être
  // atomique (tout ou rien) et sur une seule connexion.
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();
    const resultat = await appliquer(conn, { enregistrements, tombstones }, { estHub: true });
    await conn.commit();

    marquerPush(req.noeudSync.id).catch(() => {});
    if (resultat.reporte > 0) {
      // Des cibles de clés étrangères manquaient : le poste rejouera au prochain push.
      tracer('sync_push_reporte', { req,
        details: `Poste « ${req.noeudSync.nom} » : ${resultat.reporte} enregistrement(s) reporté(s).` });
    }
    res.json({ resultat });
  } catch (err) {
    if (conn) { try { await conn.rollback(); } catch { /* ignore */ } }
    next(err);
  } finally {
    if (conn) conn.release();
  }
}

// --- GET /api/sync/fichier?chemin=... -----------------------------------
// Sert un fichier d'upload (logo, photo d'élève, document…) au poste, pour
// qu'il fonctionne hors ligne. Authentifié par jeton de poste. Chemin RELATIF
// sous UPLOAD_ROOT ; toute tentative de sortie (traversal) est refusée.
export function fichierSync(req, res) {
  const chemin = (req.query.chemin || '').toString();
  if (!chemin) return res.status(400).json({ erreur: 'Chemin requis.' });
  const racine = path.resolve(UPLOAD_ROOT);
  const cible = path.resolve(racine, chemin);
  if (cible !== racine && !cible.startsWith(racine + path.sep)) {
    return res.status(400).json({ erreur: 'Chemin invalide.' });
  }
  if (!fs.existsSync(cible) || !fs.statSync(cible).isFile()) {
    return res.status(404).json({ erreur: 'Fichier introuvable.' });
  }
  res.sendFile(cible);
}

// --- POST /api/sync/ia --------------------------------------------------
// Relais IA pour les postes : le poste n'a pas la clé Groq (elle reste sur le
// nuage). Il envoie ici les paramètres de complétion ; le nuage l'exécute avec
// ses propres garde-fous (retrait des outils, consignes, vérification) et
// renvoie la complétion. Authentifié par jeton de poste.
export async function iaSync(req, res, next) {
  try {
    if (!process.env.GROQ_API_KEY) {
      return res.status(503).json({ erreur: 'IA non configurée côté nuage.' });
    }
    // Modèle imposé (un poste compromis ne choisit pas un autre modèle) ; les
    // autres garde-fous (retrait des outils, consignes, vérification, plafond
    // de tokens) sont appliqués par creerCompletionLocale.
    const completion = await creerCompletionLocale({ ...(req.body || {}), model: MODELE_IA });
    res.json(completion);
  } catch (err) {
    next(err);
  }
}

// --- Gestion des postes (propriétaire) ----------------------------------
export async function creerNoeud(req, res, next) {
  try {
    const nom = (req.body?.nom || '').toString().trim().slice(0, 120);
    if (!nom) return res.status(400).json({ erreur: 'Le nom du poste est requis.' });
    const noeud = await creerNoeudModel(nom);
    alerter('sync_noeud_cree', `Nouveau poste de synchronisation enregistré : « ${nom} ».`, { req });
    // Le jeton n'est renvoyé QU'ICI (non récupérable ensuite).
    res.status(201).json(noeud);
  } catch (err) {
    next(err);
  }
}

export async function listerNoeuds(req, res, next) {
  try {
    res.json(await listerNoeudsModel());
  } catch (err) {
    next(err);
  }
}

export async function revoquerNoeud(req, res, next) {
  try {
    const ok = await revoquerNoeudModel(Number(req.params.id));
    if (!ok) return res.status(404).json({ erreur: 'Poste introuvable.' });
    alerter('sync_noeud_revoque', `Poste de synchronisation #${req.params.id} révoqué.`, { req });
    res.json({ revoque: true });
  } catch (err) {
    next(err);
  }
}

// --- État de synchronisation LOCAL (interface du poste de bureau) --------
// Disponible seulement quand le backend tourne en mode « poste ».
export async function etatPoste(req, res, next) {
  try {
    if (!syncPosteConfigure()) {
      return res.json({ mode: 'nuage', actif: false });
    }
    const resume = await resumeEtat();
    resume.enAttente = await compterEnAttente(pool);
    res.json({ mode: 'poste', actif: true, ...resume });
  } catch (err) {
    next(err);
  }
}

// Déclenche une synchronisation immédiate (bouton « Synchroniser maintenant »).
export async function declencherSync(req, res, next) {
  try {
    if (!syncPosteConfigure()) {
      return res.status(400).json({ erreur: 'Synchronisation non configurée (mode nuage).' });
    }
    cycleSync().catch(() => {}); // asynchrone : ne bloque pas la réponse
    res.json({ lance: true });
  } catch (err) {
    next(err);
  }
}
