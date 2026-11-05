// Configuration multer — téléversement de documents sur le disque local
import multer from 'multer';
import crypto from 'crypto';
import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { fileTypeFromFile } from 'file-type';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Dossier des fichiers téléversés/générés. Par défaut backend/uploads ; mais
// quand l'app est installée en lecture seule (AppImage du poste de bureau),
// le backend doit écrire ailleurs : UPLOAD_DIR pointe alors vers un dossier
// inscriptible (ex. le dossier de données utilisateur).
export const UPLOAD_ROOT = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.join(__dirname, '..', '..', 'uploads');
const DEST = path.join(UPLOAD_ROOT, 'inscriptions');

const TYPES_AUTORISES = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
};

const DEST_PREUVES = path.join(UPLOAD_ROOT, 'preuves');
const DEST_PHOTOS = path.join(UPLOAD_ROOT, 'photos');   // photos élèves (badge)
const DEST_LOGOS = path.join(UPLOAD_ROOT, 'logos');     // logo de l'école
const DEST_VLOG = path.join(UPLOAD_ROOT, 'vlog');       // photos des publications du vlog
const DEST_PROFS = path.join(UPLOAD_ROOT, 'professeurs'); // photos des fiches du corps enseignant
const DEST_EXAMENS = path.join(UPLOAD_ROOT, 'examens'); // photos des feuilles d'examen
const DEST_COURS = path.join(UPLOAD_ROOT, 'cours');     // documents de cours (professeurs)
const DEST_ARCHIVES = path.join(UPLOAD_ROOT, 'archives'); // archives (anciens Excel/Word/PPT/PDF)

// Crée les sous-dossiers si absents (conteneur / volume vierge en production)
for (const dossier of [DEST, DEST_PREUVES, DEST_PHOTOS, DEST_LOGOS, DEST_VLOG, DEST_PROFS, DEST_EXAMENS, DEST_COURS, DEST_ARCHIVES]) {
  fs.mkdirSync(dossier, { recursive: true });
}

const TYPES_IMAGE = { 'image/jpeg': '.jpg', 'image/png': '.png' };

// Types bureautiques acceptés pour l'archive (anciens documents de l'école).
// Stockés tels quels sous un nom aléatoire et servis EN PIÈCE JOINTE (jamais
// exécutés / affichés en ligne), ce qui neutralise le risque d'un contenu actif.
const TYPES_ARCHIVE = {
  'application/pdf': '.pdf',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.ms-powerpoint': '.ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
  'text/csv': '.csv',
  'application/csv': '.csv',
  'image/jpeg': '.jpg',
  'image/png': '.png',
};

function fileFilter(req, file, cb) {
  if (TYPES_AUTORISES[file.mimetype]) return cb(null, true);
  cb(new Error('TYPE_NON_AUTORISE'));
}

function imageFilter(req, file, cb) {
  if (TYPES_IMAGE[file.mimetype]) return cb(null, true);
  cb(new Error('TYPE_NON_AUTORISE'));
}

// Fabrique un middleware multer stockant dans un sous-dossier donné
function creerUpload(dossier, filtre = fileFilter, typesExt = TYPES_AUTORISES, maxOctets = 5 * 1024 * 1024) {
  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, dossier),
    filename: (req, file, cb) => {
      // Nom généré aléatoirement — jamais le nom fourni par l'utilisateur (anti-traversal)
      const ext = typesExt[file.mimetype] || '';
      cb(null, `${crypto.randomBytes(16).toString('hex')}${ext}`);
    },
  });
  return multer({ storage, fileFilter: filtre, limits: { fileSize: maxOctets } });
}

function archiveFilter(req, file, cb) {
  if (TYPES_ARCHIVE[file.mimetype]) return cb(null, true);
  cb(new Error('TYPE_NON_AUTORISE'));
}

export const uploadDocument = creerUpload(DEST);         // documents d'inscription
export const uploadPreuve = creerUpload(DEST_PREUVES);   // preuves de paiement
export const uploadPhoto = creerUpload(DEST_PHOTOS, imageFilter, TYPES_IMAGE);  // photo élève
export const uploadLogo = creerUpload(DEST_LOGOS, imageFilter, TYPES_IMAGE);    // logo école
export const uploadVlog = creerUpload(DEST_VLOG, imageFilter, TYPES_IMAGE);     // photo publication vlog
export const uploadProf = creerUpload(DEST_PROFS, imageFilter, TYPES_IMAGE);    // photo fiche professeur
export const uploadExamen = creerUpload(DEST_EXAMENS, imageFilter, TYPES_IMAGE); // photo feuille d'examen
export const uploadCours = creerUpload(DEST_COURS);      // document de cours (professeur)
// Archive de documents anciens (Excel/Word/PPT/PDF…). Limite plus large (25 Mo).
export const uploadArchive = creerUpload(DEST_ARCHIVES, archiveFilter, TYPES_ARCHIVE, 25 * 1024 * 1024);
// Extension d'origine conservée pour l'affichage (à partir du type MIME déclaré).
export const EXT_ARCHIVE = TYPES_ARCHIVE;

// Import de données depuis un tableur (Excel .xlsx ou CSV). Fichier temporaire
// (analysé puis importé puis supprimé), stocké à part.
const DEST_IMPORTS = path.join(UPLOAD_ROOT, 'imports');
fs.mkdirSync(DEST_IMPORTS, { recursive: true });
const TYPES_IMPORT = {
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'text/csv': '.csv',
  'application/csv': '.csv',
  'application/vnd.ms-excel': '.xls', // parfois le type déclaré pour un .csv/.xls
};
function importFilter(req, file, cb) {
  if (TYPES_IMPORT[file.mimetype]) return cb(null, true);
  cb(new Error('TYPE_NON_AUTORISE'));
}
export const DOSSIER_IMPORTS = DEST_IMPORTS;
export const uploadImport = creerUpload(DEST_IMPORTS, importFilter, TYPES_IMPORT, 25 * 1024 * 1024);

// Vérifie le CONTENU réel d'un fichier déjà téléversé (signature/magic bytes),
// indépendamment du Content-Type déclaré par le client — un champ multipart
// falsifié (ex. un exécutable renommé en .jpg) passerait sinon le fileFilter
// ci-dessus sans problème, puisque celui-ci ne fait confiance qu'à l'en-tête
// annoncé. Middleware à greffer APRÈS le middleware multer (req.file rempli).
function verifierContenu(typesAutorises) {
  return async (req, res, next) => {
    if (!req.file) return next(); // champ facultatif absent : rien à vérifier
    try {
      const detecte = await fileTypeFromFile(req.file.path);
      if (!detecte || !typesAutorises[detecte.mime]) {
        await fsPromises.unlink(req.file.path).catch(() => {});
        return res.status(400).json({ erreur: 'Le contenu du fichier ne correspond à aucun type autorisé.' });
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

export const verifierContenuDocument = verifierContenu(TYPES_AUTORISES); // PDF/JPG/PNG
export const verifierContenuImage = verifierContenu(TYPES_IMAGE);        // JPG/PNG
