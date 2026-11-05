// Service de génération du bulletin PDF (pdf-lib) — format traditionnel haïtien,
// paysage : grille Matière × trimestres, Total/Moyenne/Place, bloc de droite
// (Signature, Moyenne Générale, Observation, Décision de fin d'année).
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { UPLOAD_ROOT } from '../config/upload.js';

const BULLETINS_DIR = path.join(UPLOAD_ROOT, 'bulletins');

const LIBELLE_TRIM = {
  '1er_trimestre': '1er Trimestre',
  '2e_trimestre': '2e Trimestre',
  '3e_trimestre': '3e Trimestre',
};
const COURT_TRIM = {
  '1er_trimestre': '1er Trim.',
  '2e_trimestre': '2e Trim.',
  '3e_trimestre': '3e Trim.',
};

const fmtNote = (v) => {
  if (v == null || Number.isNaN(v)) return '';
  return Number.isInteger(v) ? String(v) : Number(v).toFixed(1);
};

// n : { valeur, bareme } | null — affiche « valeur » seul si barème 100 (cas
// courant, aucun changement visuel), sinon « valeur/barème » (ex. 15/20).
const fmtCelluleNote = (n) => {
  if (n == null || n.valeur == null) return '';
  const bareme = Number(n.bareme) || 100;
  return bareme === 100 ? fmtNote(Number(n.valeur)) : `${fmtNote(Number(n.valeur))}/${fmtNote(bareme)}`;
};
// Pourcentage (0-100) d'une note — seule valeur comparable au seuil de réussite
// quand les barèmes diffèrent d'une matière à l'autre.
const pourcentage = (n) => {
  if (n == null || n.valeur == null) return null;
  const bareme = Number(n.bareme) || 100;
  return bareme > 0 ? (Number(n.valeur) / bareme) * 100 : null;
};

// Génère le PDF (paysage A4) et l'écrit sur le disque. Retourne { urlPdf, identifiantUnique }.
// Params :
//  eleve { nom_famille, prenom, nom }, niveau, trimestre, anneeScolaire, ecoleNom
//  matieres : [{ nom, coefficient }]                       (lignes du tableau)
//  notesParTrim : { '1er_trimestre': { [matiere]: valeur }, ... }
//  moyennesParTrim : { trim: moyenne|null }
//  placesParTrim : { trim: place|null }
//  trimestresAffiches : [trim, ...]                         (colonnes à afficher)
//  moyenneAnnuelle : number|null                            (renseigné au 3e trimestre)
//  seuilReussite : number                                   (note de passage /100, défaut 60)
export async function genererBulletinPDF({
  eleve, niveau, trimestre, anneeScolaire, ecoleNom, logoPath = null,
  matieres = [], notesParTrim = {}, moyennesParTrim = {}, placesParTrim = {},
  trimestresAffiches = [], moyenneAnnuelle = null, seuilReussite = 60,
}) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([842, 595]); // A4 paysage

  // Logo de l'école (facultatif) : lu sur le disque et intégré en haut à
  // gauche, à côté du nom. Un logo absent ou illisible n'empêche jamais la
  // génération du bulletin.
  let logoImg = null;
  let logoDims = null;
  if (logoPath) {
    try {
      const octetsLogo = await fs.readFile(logoPath);
      logoImg = (octetsLogo[0] === 0x89 && octetsLogo[1] === 0x50)
        ? await pdf.embedPng(octetsLogo)
        : await pdf.embedJpg(octetsLogo);
      let h = 28;
      let w = (logoImg.width / logoImg.height) * h;
      if (w > 46) { w = 46; h = (logoImg.height / logoImg.width) * w; }
      logoDims = { w, h };
    } catch {
      logoImg = null; // logo illisible : on continue sans
    }
  }
  const police = await pdf.embedFont(StandardFonts.Helvetica);
  const gras = await pdf.embedFont(StandardFonts.HelveticaBold);
  const noir = rgb(0.1, 0.1, 0.1);
  const gris = rgb(0.5, 0.5, 0.5);
  const trait = rgb(0.3, 0.3, 0.3);
  const vert = rgb(0.13, 0.5, 0.13);
  const rouge = rgb(0.72, 0.11, 0.11);
  const couleurSeuil = (v) => (v == null ? noir : (Number(v) >= seuilReussite ? vert : rouge));

  const T = (t, x, y, size = 9, b = false, color = noir) =>
    page.drawText(String(t ?? ''), { x, y, size, font: b ? gras : police, color });
  const ligneH = (x1, x2, y, w = 0.7, color = trait) =>
    page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness: w, color });
  const ligneV = (x, y1, y2, w = 0.7, color = trait) =>
    page.drawLine({ start: { x, y: y1 }, end: { x, y: y2 }, thickness: w, color });
  const tronque = (s, max) => (s && s.length > max ? `${s.slice(0, max - 1)}…` : (s || ''));

  const M = 28;

  // ---------- Logo (coin haut droit) ----------
  // Placé dans le coin supérieur droit (zone libre, au-dessus du champ
  // « Année ») : n'entre en collision avec rien et laisse le nom de l'école à
  // gauche, comme un en-tête à en-tête classique.
  if (logoImg) {
    page.drawImage(logoImg, { x: 814 - logoDims.w, y: 593 - logoDims.h, width: logoDims.w, height: logoDims.h });
  }

  // ---------- En-tête (Nom / Prénom / Classe / Année) ----------
  let y = 567;
  const champ = (label, valeur, x, largeur) => {
    T(label, x, y, 10, true);
    const lx = x + police.widthOfTextAtSize(label, 10) + 4;
    T(valeur || '', lx, y, 10);
    ligneH(lx, x + largeur, y - 2, 0.5, gris);
  };
  champ('Nom :', eleve.nom_famille || eleve.nom || '', M, 210);
  champ('Prénom :', eleve.prenom || '', M + 220, 200);
  champ('Classe :', niveau || '', M + 440, 170);
  champ('Année :', anneeScolaire || '', M + 620, 166);

  // ---------- Tableau de gauche ----------
  const cols = trimestresAffiches.length ? trimestresAffiches : [trimestre];
  const wMat = 156, wCoef = 34, wTrim = 52;
  const xMat = M;
  const xCoef = xMat + wMat;
  const xT0 = xCoef + wCoef;
  const xEnd = xT0 + cols.length * wTrim;
  const centre = (texte, xg, largeur, yy, size = 8.5, b = false, color = noir) => {
    const w = (b ? gras : police).widthOfTextAtSize(String(texte ?? ''), size);
    T(texte, xg + (largeur - w) / 2, yy, size, b, color);
  };

  const hautTable = 540;
  const basTable = 40;
  const hEntete = 24;
  const nLignes = matieres.length + 3; // + Total, Moyenne, Place
  let rowH = (hautTable - hEntete - basTable) / nLignes;
  if (rowH > 20) rowH = 20;
  if (rowH < 11) rowH = 11;
  const sizeCell = rowH < 14 ? 7.5 : 8.5;

  // Cadre + en-tête
  let yy = hautTable;
  page.drawRectangle({ x: xMat, y: hautTable - hEntete, width: xEnd - xMat, height: hEntete, color: rgb(0.93, 0.95, 0.98) });
  centre('Matière', xMat, wMat, hautTable - 16, 11, true);
  centre('Coef.', xCoef, wCoef, hautTable - 16, 8, true);
  cols.forEach((tr, i) => centre(COURT_TRIM[tr] || tr, xT0 + i * wTrim, wTrim, hautTable - 15, 7.5, true));
  yy = hautTable - hEntete;

  // Lignes matières
  for (const mat of matieres) {
    const yTexte = yy - rowH + (rowH - sizeCell) / 2 + 1;
    T(tronque(mat.nom, wMat > 150 ? 30 : 24), xMat + 4, yTexte, sizeCell);
    centre(fmtNote(Number(mat.coefficient)), xCoef, wCoef, yTexte, sizeCell);
    cols.forEach((tr, i) => {
      const n = notesParTrim[tr] ? notesParTrim[tr][mat.nom] : undefined;
      const sizeCellNote = n && Number(n.bareme) !== 100 ? sizeCell - 1 : sizeCell;
      centre(fmtCelluleNote(n), xT0 + i * wTrim, wTrim, yTexte, sizeCellNote, false, couleurSeuil(pourcentage(n)));
    });
    yy -= rowH;
  }

  // Total / Moyenne / Place
  const sommeCoef = matieres.reduce((s, m) => s + (Number(m.coefficient) || 0), 0);
  // Le total (comme la moyenne) combine les matières via leur pourcentage —
  // seule façon cohérente de sommer des notes à barèmes différents (15/20 et
  // 72/100 ne peuvent pas s'additionner directement).
  const totalTrim = (tr) => {
    let s = 0;
    for (const m of matieres) {
      const n = notesParTrim[tr] ? notesParTrim[tr][m.nom] : undefined;
      const pct = pourcentage(n);
      if (pct != null) s += pct * (Number(m.coefficient) || 1);
    }
    return Math.round(s);
  };
  const lignesBilan = [
    { libelle: 'Total', coef: fmtNote(sommeCoef), valeur: (tr) => (moyennesParTrim[tr] != null ? String(totalTrim(tr)) : ''), b: true },
    { libelle: 'Moyenne', coef: '', valeur: (tr) => (moyennesParTrim[tr] != null ? Number(moyennesParTrim[tr]).toFixed(2) : ''), b: true, couleur: (tr) => couleurSeuil(moyennesParTrim[tr]) },
    { libelle: 'Place', coef: '', valeur: (tr) => (placesParTrim[tr] ? `${placesParTrim[tr]}e` : ''), b: false },
  ];
  for (const lb of lignesBilan) {
    const yTexte = yy - rowH + (rowH - sizeCell) / 2 + 1;
    T(lb.libelle, xMat + 4, yTexte, sizeCell, true);
    centre(lb.coef, xCoef, wCoef, yTexte, sizeCell, true);
    cols.forEach((tr, i) => centre(lb.valeur(tr), xT0 + i * wTrim, wTrim, yTexte, sizeCell, lb.b, lb.couleur ? lb.couleur(tr) : noir));
    yy -= rowH;
  }

  // Grille : lignes horizontales + verticales
  const yTop = hautTable, yBot = yy;
  for (let ly = yTop; ly >= yBot - 0.1; ly -= rowH === 0 ? 1 : rowH) { /* placeholder */ }
  // horizontales
  ligneH(xMat, xEnd, yTop);
  ligneH(xMat, xEnd, yTop - hEntete);
  let yl = yTop - hEntete;
  for (let i = 0; i < nLignes; i += 1) { yl -= rowH; ligneH(xMat, xEnd, yl, 0.4, gris); }
  // verticales
  [xMat, xCoef, xT0].forEach((vx) => ligneV(vx, yTop, yBot));
  cols.forEach((_, i) => ligneV(xT0 + (i + 1) * wTrim, yTop, yBot));

  // ---------- Bloc de droite ----------
  const rx = xEnd + 26;
  const rEnd = 814;
  let ry = 545;

  // Signature
  centre('Signature', rx, rEnd - rx, ry, 11, true);
  ry -= 16;
  const sHead = ry;
  const cLabel = 150, cSig = (rEnd - rx - cLabel) / 2;
  const xSig1 = rx + cLabel, xSig2 = xSig1 + cSig;
  centre('Direction', xSig1, cSig, ry - 11, 8, true);
  centre('Responsable', xSig2, cSig, ry - 11, 8, true);
  ry -= 15;
  const rowsSig = ['1er_trimestre', '2e_trimestre', '3e_trimestre'];
  ligneH(rx, rEnd, sHead); ligneH(rx, rEnd, ry);
  let sy = ry;
  for (const tr of rowsSig) {
    T(LIBELLE_TRIM[tr], rx + 4, sy - 14, 8);
    sy -= 18;
    ligneH(rx, rEnd, sy, 0.4, gris);
  }
  [rx, xSig1, xSig2, rEnd].forEach((vx) => ligneV(vx, sHead, sy));

  // Moyenne Générale
  ry = sy - 22;
  T('Moyenne Générale :', rx, ry, 11, true);
  const mgx = rx + gras.widthOfTextAtSize('Moyenne Générale :', 11) + 6;
  T(moyenneAnnuelle != null ? `${Number(moyenneAnnuelle).toFixed(2)} / 100` : '', mgx, ry, 11, true, couleurSeuil(moyenneAnnuelle));
  ligneH(mgx, rEnd, ry - 2, 0.5, gris);

  // Observation
  ry -= 26;
  T('Observation', rx, ry, 11, true);
  ry -= 18;
  for (const tr of rowsSig) {
    T(`${LIBELLE_TRIM[tr]} :`, rx, ry, 9);
    ligneH(rx + police.widthOfTextAtSize(`${LIBELLE_TRIM[tr]} :`, 9) + 4, rEnd, ry - 2, 0.5, gris);
    ry -= 20;
  }

  // Décision de fin d'année
  ry -= 6;
  T("Décision de fin d'année", rx, ry, 11, true);
  ry -= 18;
  const admis = moyenneAnnuelle != null && Number(moyenneAnnuelle) >= seuilReussite;
  T("L'élève est admis(e) en :", rx, ry, 9);
  if (moyenneAnnuelle != null) {
    T(admis ? 'classe supérieure' : '', rx + police.widthOfTextAtSize("L'élève est admis(e) en :", 9) + 6, ry, 9, true, vert);
  }
  ligneH(rx + police.widthOfTextAtSize("L'élève est admis(e) en :", 9) + 4, rEnd, ry - 2, 0.5, gris);
  ry -= 20;
  T('Doit être réévalué(e) en :', rx, ry, 9);
  if (moyenneAnnuelle != null && !admis) {
    T('reprise', rx + police.widthOfTextAtSize('Doit être réévalué(e) en :', 9) + 6, ry, 9, true, rouge);
  }
  ligneH(rx + police.widthOfTextAtSize('Doit être réévalué(e) en :', 9) + 4, rEnd, ry - 2, 0.5, gris);

  // ---------- Titre & pied ----------
  T(ecoleNom || 'Lekòl Pam', M, 583, 12, true, gris);
  const identifiantUnique = crypto.randomBytes(16).toString('hex');
  T(`Bulletin — ${LIBELLE_TRIM[trimestre] || trimestre} · Année ${anneeScolaire}`, M, 26, 7.5, false, gris);
  T(`Document : ${identifiantUnique} — généré le ${new Date().toLocaleDateString('fr-FR')}`, M, 16, 7, false, gris);

  const octets = await pdf.save();
  await fs.mkdir(BULLETINS_DIR, { recursive: true });
  const nomFichier = `${crypto.randomBytes(16).toString('hex')}.pdf`;
  await fs.writeFile(path.join(BULLETINS_DIR, nomFichier), octets);

  return { urlPdf: `bulletins/${nomFichier}`, identifiantUnique };
}
