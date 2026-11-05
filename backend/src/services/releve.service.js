// Service de génération du relevé de notes / duplicata (transcript PDF, pdf-lib)
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { calculerMoyenne } from './moyenne.service.js';
import { UPLOAD_ROOT } from '../config/upload.js';

const OFFICIELS_DIR = path.join(UPLOAD_ROOT, 'officiels');

const LIBELLE_TRIMESTRE = {
  '1er_trimestre': '1er trimestre',
  '2e_trimestre': '2e trimestre',
  '3e_trimestre': '3e trimestre',
};

// Regroupe les notes par (année, trimestre) et calcule la moyenne pondérée de chaque groupe
export function grouperTranscript(notes) {
  const map = new Map();
  for (const n of notes) {
    const cle = `${n.annee_scolaire}||${n.periode}`;
    if (!map.has(cle)) map.set(cle, { annee: n.annee_scolaire, periode: n.periode, notes: [] });
    map.get(cle).notes.push(n);
  }
  return [...map.values()].map((g) => {
    const { lignes, moyenneGenerale } = calculerMoyenne(g.notes);
    return { annee: g.annee, periode: g.periode, lignes, moyenne: moyenneGenerale };
  });
}

// Génère le PDF transcript. duplicata=true ajoute l'étiquette « DUPLICATA ».
export async function genererReleve({ eleve, groupes, ecoleNom, duplicata = false }) {
  const pdf = await PDFDocument.create();
  let page = pdf.addPage([595, 842]);
  const police = await pdf.embedFont(StandardFonts.Helvetica);
  const policeGras = await pdf.embedFont(StandardFonts.HelveticaBold);
  const noir = rgb(0.1, 0.1, 0.1);
  const gris = rgb(0.45, 0.45, 0.45);
  const rouge = rgb(0.8, 0.15, 0.15);
  const marge = 50;
  let y = 800;

  const texte = (t, x, yy, taille = 11, gras = false, couleur = noir) =>
    page.drawText(String(t), { x, y: yy, size: taille, font: gras ? policeGras : police, color: couleur });
  const sautPage = () => { page = pdf.addPage([595, 842]); y = 800; };
  const verifierEspace = (min = 90) => { if (y < min) sautPage(); };

  texte(ecoleNom || 'Lekòl Pam', marge, y, 18, true); y -= 22;
  texte(duplicata ? 'Relevé de notes — DUPLICATA' : 'Relevé de notes', marge, y, 13, true,
    duplicata ? rouge : gris);
  y -= 28;
  texte(`Élève : ${eleve.nom}`, marge, y, 11, true); y -= 16;
  texte(`Niveau : ${eleve.niveau || '—'}`, marge, y); y -= 24;

  if (!groupes.length) {
    texte('Aucune note validée à ce jour.', marge, y);
  }

  for (const g of groupes) {
    verifierEspace(120);
    texte(`${LIBELLE_TRIMESTRE[g.periode] || g.periode} — Année ${g.annee}`, marge, y, 12, true);
    y -= 18;
    texte('Matière', marge, y, 10, true);
    texte('Note', 300, y, 10, true);
    texte('Coef.', 410, y, 10, true);
    texte('Contribution', 470, y, 10, true);
    y -= 4;
    page.drawLine({ start: { x: marge, y }, end: { x: 545, y }, thickness: 0.8, color: gris });
    y -= 14;
    for (const l of g.lignes) {
      verifierEspace(70);
      texte(l.matiere, marge, y, 10);
      // valeur/produit sont null pour une matière non notée : colonne laissée vide
      texte(l.valeur === null ? '—' : `${l.valeur.toFixed(2)} / ${l.bareme.toFixed(0)}`, 300, y, 9);
      texte(l.coefficient.toFixed(2), 410, y, 10);
      texte(l.produit === null ? '—' : l.produit.toFixed(2), 470, y, 10);
      y -= 14;
    }
    texte(`Moyenne pondérée : ${g.moyenne.toFixed(2)} / 100`, marge, y, 11, true);
    y -= 24;
  }

  const identifiantUnique = crypto.randomBytes(16).toString('hex');
  texte(`Identifiant du document : ${identifiantUnique}`, marge, 50, 8, false, gris);
  texte(`Généré le ${new Date().toLocaleDateString('fr-FR')}`, marge, 38, 8, false, gris);

  const octets = await pdf.save();
  await fs.mkdir(OFFICIELS_DIR, { recursive: true });
  const nomFichier = `${crypto.randomBytes(16).toString('hex')}.pdf`;
  await fs.writeFile(path.join(OFFICIELS_DIR, nomFichier), octets);

  return { urlPdf: `officiels/${nomFichier}`, identifiantUnique };
}
