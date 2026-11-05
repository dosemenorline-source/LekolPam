// Service Annonce — construit le courriel HTML habillé (logo, coordonnées) et
// le PDF joint (pdf-lib) pour une annonce envoyée par le propriétaire à tous
// les parents. Reste séparé du contrôleur pour suivre la même organisation
// que bulletin.service.js / releve.service.js.
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import fs from 'fs/promises';
import path from 'path';
import { UPLOAD_ROOT } from '../config/upload.js';
import { echapperHtml } from '../utils/html.js';

const SITE_URL = 'https://lekolpam.online';
const MARINE = '#1A365D';
const MARINE2 = '#2B4C7E';
const MARINE_RGB = rgb(0.102, 0.212, 0.365);
const GRIS_RGB = rgb(0.45, 0.45, 0.45);
const NOIR_RGB = rgb(0.1, 0.1, 0.1);

// Lit le logo de l'école sur le disque (voir tarif.controller.js:servirLogo pour
// le même schéma de résolution de chemin). Retourne null si absent/illisible.
export async function chargerLogoEcole(ecole) {
  if (!ecole?.logo_url) return null;
  try {
    const chemin = path.resolve(UPLOAD_ROOT, ecole.logo_url);
    if (!chemin.startsWith(path.resolve(UPLOAD_ROOT))) return null;
    const buffer = await fs.readFile(chemin);
    const type = path.extname(ecole.logo_url).toLowerCase() === '.png' ? 'png' : 'jpg';
    return { buffer, type };
  } catch {
    return null;
  }
}

// ---------- Courriel HTML habillé ----------
export function construireHtmlAnnonce({ ecole, objet, introduction, developpement, conclusion, signataireNom, logo }) {
  const nomEcole = echapperHtml(ecole?.nom || 'Lekòl Pam');
  const paragraphe = (t) => `<p style="margin:0 0 14px;color:#2D3748;line-height:1.65;">${echapperHtml(t).replace(/\n/g, '<br>')}</p>`;

  const contacts = [];
  if (ecole?.telephone) contacts.push(`Tél : ${echapperHtml(ecole.telephone)}`);
  if (ecole?.courriel) contacts.push(echapperHtml(ecole.courriel));

  const logoImg = logo
    ? `<img src="data:image/${logo.type === 'png' ? 'png' : 'jpeg'};base64,${logo.buffer.toString('base64')}" alt="Logo" width="60" height="60" style="width:60px;height:60px;border-radius:50%;object-fit:cover;background:#fff;border:2px solid #fff;display:block;margin:0 auto .6rem;" />`
    : '';

  return `
<div style="max-width:600px;margin:0 auto;font-family:Arial,Helvetica,sans-serif;">
  <div style="background:linear-gradient(160deg, ${MARINE} 0%, ${MARINE2} 100%);padding:1.6rem 1.5rem 1.4rem;text-align:center;border-radius:12px 12px 0 0;">
    ${logoImg}
    <div style="color:#fff;font-weight:800;font-size:1.15rem;">${nomEcole}</div>
  </div>
  <div style="background:#fff;padding:1.9rem 1.7rem;border:1px solid #E2E8F0;border-top:none;">
    <h1 style="font-size:1.25rem;color:${MARINE};margin:0 0 1.2rem;">${echapperHtml(objet)}</h1>
    ${paragraphe(introduction)}
    ${paragraphe(developpement)}
    ${paragraphe(conclusion)}
    <p style="margin:1.6rem 0 0;color:#2D3748;">Cordialement,</p>
    <p style="margin:.25rem 0 0;font-weight:700;color:${MARINE};">${echapperHtml(signataireNom)}</p>
    <p style="margin:0;color:#718096;font-size:.85rem;">Propriétaire, ${nomEcole}</p>
  </div>
  <div style="background:#F7FAFC;padding:1.1rem 1.5rem;border:1px solid #E2E8F0;border-top:none;border-radius:0 0 12px 12px;text-align:center;color:#718096;font-size:.78rem;line-height:1.6;">
    ${contacts.join(' &nbsp;·&nbsp; ')}${contacts.length ? '<br>' : ''}
    <a href="${SITE_URL}" style="color:${MARINE2};text-decoration:none;">${SITE_URL.replace(/^https?:\/\//, '')}</a>
  </div>
</div>`.trim();
}

// ---------- Courriel texte brut (repli) ----------
export function construireTexteAnnonce({ ecole, objet, introduction, developpement, conclusion, signataireNom }) {
  const nomEcole = ecole?.nom || 'Lekòl Pam';
  const contact = [ecole?.telephone && `Tél : ${ecole.telephone}`, ecole?.courriel].filter(Boolean).join(' — ');
  return [
    objet, '',
    introduction, '',
    developpement, '',
    conclusion, '',
    'Cordialement,', signataireNom, `Propriétaire, ${nomEcole}`, '',
    [contact, SITE_URL].filter(Boolean).join(' — '),
  ].join('\n');
}

// Découpe un texte en lignes qui tiennent dans `largeurMax` à la taille donnée
// (respecte aussi les retours à la ligne déjà présents dans le texte).
function decouperEnLignes(texteBrut, police, taille, largeurMax) {
  const lignes = [];
  for (const paragraphe of String(texteBrut || '').split('\n')) {
    const mots = paragraphe.split(' ').filter(Boolean);
    if (!mots.length) { lignes.push(''); continue; }
    let ligneCourante = '';
    for (const mot of mots) {
      const essai = ligneCourante ? `${ligneCourante} ${mot}` : mot;
      if (ligneCourante && police.widthOfTextAtSize(essai, taille) > largeurMax) {
        lignes.push(ligneCourante);
        ligneCourante = mot;
      } else {
        ligneCourante = essai;
      }
    }
    lignes.push(ligneCourante);
  }
  return lignes;
}

// ---------- PDF joint (lettre officielle, portrait A4) ----------
// Retourne un Buffer (pas d'écriture disque : document à usage unique, joint puis jeté).
export async function genererPdfAnnonce({ ecole, objet, introduction, developpement, conclusion, signataireNom, logo }) {
  const pdf = await PDFDocument.create();
  let page = pdf.addPage([595, 842]);
  const police = await pdf.embedFont(StandardFonts.Helvetica);
  const gras = await pdf.embedFont(StandardFonts.HelveticaBold);
  const marge = 55;
  const largeurUtile = 595 - marge * 2;
  let y = 780;

  const texte = (t, x, yy, taille = 11, b = false, couleur = NOIR_RGB) =>
    page.drawText(String(t), { x, y: yy, size: taille, font: b ? gras : police, color: couleur });
  const sautPage = () => { page = pdf.addPage([595, 842]); y = 780; };
  const verifierEspace = (min = 90) => { if (y < min) sautPage(); };

  const paragrapheImprime = (t, taille = 10.5) => {
    for (const ligne of decouperEnLignes(t, police, taille, largeurUtile)) {
      verifierEspace(70);
      texte(ligne, marge, y, taille);
      y -= taille + 6;
    }
    y -= 8;
  };

  // En-tête : logo + nom/coordonnées de l'école
  let xEntete = marge;
  if (logo) {
    try {
      const image = logo.type === 'png' ? await pdf.embedPng(logo.buffer) : await pdf.embedJpg(logo.buffer);
      page.drawImage(image, { x: marge, y: y - 38, width: 42, height: 42 });
      xEntete = marge + 54;
    } catch { /* logo illisible : en-tête sans image */ }
  }
  texte(ecole?.nom || 'Lekòl Pam', xEntete, y - 10, 15, true, MARINE_RGB);
  const lignesContact = [
    ecole?.adresse || null,
    [ecole?.telephone && `Tél : ${ecole.telephone}`, ecole?.courriel].filter(Boolean).join('   —   ') || null,
    SITE_URL,
  ].filter(Boolean);
  let yContact = y - 26;
  for (const l of lignesContact) { texte(l, xEntete, yContact, 8.5, false, GRIS_RGB); yContact -= 11; }
  y -= 66;
  page.drawLine({ start: { x: marge, y }, end: { x: 595 - marge, y }, thickness: 0.8, color: GRIS_RGB });
  y -= 24;

  // Objet + date
  for (const ligne of decouperEnLignes(objet, gras, 14, largeurUtile)) {
    verifierEspace(80);
    texte(ligne, marge, y, 14, true, MARINE_RGB);
    y -= 18;
  }
  texte(`Le ${new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`, marge, y, 9, false, GRIS_RGB);
  y -= 26;

  paragrapheImprime(introduction);
  paragrapheImprime(developpement);
  paragrapheImprime(conclusion);

  verifierEspace(110);
  y -= 6;
  texte('Cordialement,', marge, y, 10.5); y -= 17;
  texte(signataireNom || 'La direction', marge, y, 11.5, true); y -= 14;
  texte(`Propriétaire, ${ecole?.nom || 'Lekòl Pam'}`, marge, y, 9.5, false, GRIS_RGB);

  const octets = await pdf.save();
  return Buffer.from(octets);
}
