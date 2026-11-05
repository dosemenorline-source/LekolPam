// Service de publication — publie un niveau/trimestre, génère les bulletins, notifie
import { pool } from '../config/db.js';
import { existe, creer as creerPublication } from '../models/publication.model.js';
import { listerParNiveau } from '../models/eleve.model.js';
import { notesValideesPourBulletin } from '../models/note.model.js';
import { lister as listerMatieres } from '../models/matiere.model.js';
import { creer as creerDocumentOfficiel, bulletinExiste,
  trouverBulletin, supprimer as supprimerDocument } from '../models/documentOfficiel.model.js';
import { calculerMoyenne } from './moyenne.service.js';
import { genererBulletinPDF } from './bulletin.service.js';
import { envoyerCourriel } from '../config/mailer.js';
import { envoyerSms } from '../config/sms.js';
import { UPLOAD_ROOT } from '../config/upload.js';
import {
  clientIA, iaConfiguree, MODELE_IA, MARQUEUR_ELEVE, MARQUEUR_PARENT, CONSIGNE_MARQUEURS, restaurerMarqueurs,
} from '../config/ia.js';
import { echapperHtml } from '../utils/html.js';
import fs from 'fs/promises';
import path from 'path';

const LIBELLE_TRIMESTRE = {
  '1er_trimestre': '1er trimestre',
  '2e_trimestre': '2e trimestre',
  '3e_trimestre': '3e trimestre',
};
const ORDRE_TRIM = ['1er_trimestre', '2e_trimestre', '3e_trimestre'];
const SITE_URL = 'https://lekolpam.online';

// Appréciation du bulletin envoyée aux parents par courriel : un paragraphe
// d'une dizaine de phrases, positif si la moyenne dépasse le seuil de
// réussite, honnête mais constructif sinon. Utilise l'IA (Groq) quand elle
// est configurée ; sinon un message plus court mais toujours pertinent, pour
// que l'envoi ne dépende jamais de la disponibilité de l'IA.
async function genererAppreciation({
  eleveNom, niveau, trimestre, anneeScolaire, moyenneCourante, seuilReussite, notesMap, moyenneAnnuelle,
}) {
  const admis = moyenneCourante >= seuilReussite;
  const fallback = admis
    ? `${eleveNom} a obtenu une moyenne de ${moyenneCourante.toFixed(2)}/100 ce trimestre, au-dessus du seuil de réussite (${seuilReussite}/100). C'est un résultat encourageant : continuez à soutenir cette régularité à la maison.`
    : `${eleveNom} a obtenu une moyenne de ${moyenneCourante.toFixed(2)}/100 ce trimestre, en-dessous du seuil de réussite (${seuilReussite}/100). Un accompagnement supplémentaire, notamment dans les matières les plus faibles, aiderait à redresser la situation avant le prochain trimestre.`;

  if (!iaConfiguree()) return fallback;
  try {
    const lignes = Object.entries(notesMap || {}).map(([mat, n]) => `- ${mat} : ${Number(n.valeur).toFixed(2)}/${Number(n.bareme).toFixed(0)}`);
    const client = clientIA();
    const completion = await client.chat.completions.create({
      model: MODELE_IA,
      temperature: 0.6,
      max_tokens: 700,
      messages: [
        {
          role: 'system',
          content: "Tu es un conseiller pédagogique bienveillant de l'école « Lekòl Pam ». Tu rédiges, à l'intention des parents, une appréciation du bulletin de leur enfant, en français, dans un paragraphe fluide d'environ 10 phrases, sans titre ni liste. Si la moyenne est au-dessus du seuil de réussite, la tonalité est largement positive et félicite l'élève tout en donnant des pistes pour progresser encore. Si elle est en-dessous, reste honnête sur la situation mais constructif et encourageant, avec des conseils concrets d'amélioration. Base-toi UNIQUEMENT sur les données fournies, n'invente aucun chiffre ni matière. N'utilise pas d'emojis. " + CONSIGNE_MARQUEURS,
        },
        {
          role: 'user',
          content: `Élève : ${MARQUEUR_ELEVE} (${niveau}).\n`
            + `${LIBELLE_TRIMESTRE[trimestre] || trimestre}, année ${anneeScolaire}.\n`
            + `Moyenne pondérée du trimestre : ${moyenneCourante.toFixed(2)}/100.\n`
            + `Seuil de réussite de l'école : ${seuilReussite}/100.\n`
            + (moyenneAnnuelle != null ? `Moyenne générale annuelle : ${moyenneAnnuelle.toFixed(2)}/100.\n` : '')
            + `Notes par matière :\n${lignes.join('\n')}\n\n`
            + 'Rédige une appréciation globale du bulletin pour les parents.',
        },
      ],
    });
    const texte = restaurerMarqueurs((completion.choices?.[0]?.message?.content || '').trim(), { eleve: eleveNom });
    return texte || fallback;
  } catch (err) {
    console.error('Appréciation IA échouée :', err.message);
    return fallback;
  }
}

async function infosEcole() {
  const [rows] = await pool.query('SELECT nom, seuil_reussite, logo_url FROM ecole ORDER BY id LIMIT 1');
  return rows[0]
    ? { nom: rows[0].nom, seuilReussite: Number(rows[0].seuil_reussite), logoUrl: rows[0].logo_url || null }
    : { nom: 'Lekòl Pam', seuilReussite: 60, logoUrl: null };
}

// Publie (niveau, année, trimestre) : marque publié et génère un bulletin par élève
// ayant des notes validées, puis notifie les parents.
// Bulletin traditionnel : la grille montre les trimestres jusqu'au trimestre courant
// (le 3e trimestre rassemble les 3), avec Total/Moyenne/Place + Moyenne générale annuelle.
// Idempotent : un bulletin par (élève, trimestre, année).
// regenerer=true : remplace les bulletins déjà existants (applique le nouveau format).
// forcerNotification=true : renvoie le courriel même pour un bulletin régénéré (par défaut,
// une régénération ne re-notifie pas les parents — utile pour appliquer un nouveau format
// à des bulletins déjà publiés puis, une fois, renvoyer le courriel avec la pièce jointe).
// Résultat : { ok:true, nbBulletins, nbSansNotes, nbDejaFaits, nbRegeneres }
export async function publier({
  niveau, anneeScolaire, trimestre, idDirection, regenerer = false, forcerNotification = false,
}) {
  if (!(await existe(niveau, anneeScolaire, trimestre))) {
    await creerPublication({ niveau, anneeScolaire, trimestre, publiePar: idDirection });
  }

  const { nom: ecoleNom, seuilReussite, logoUrl } = await infosEcole();
  const logoPath = logoUrl ? path.resolve(UPLOAD_ROOT, logoUrl) : null;
  const eleves = await listerParNiveau(niveau);
  const matieres = (await listerMatieres(niveau)).filter((m) => m.actif !== 0);

  const idx = ORDRE_TRIM.indexOf(trimestre);
  const trimestresAffiches = idx >= 0 ? ORDRE_TRIM.slice(0, idx + 1) : [trimestre];

  // Précalcul : notes (map matière->note) + moyenne par (élève, trimestre affiché)
  const donnees = new Map(); // eleveId -> { tr: { notesMap, moyenne } }
  for (const el of eleves) {
    const parTrim = {};
    for (const tr of trimestresAffiches) {
      const notes = await notesValideesPourBulletin(el.id, tr, anneeScolaire);
      const notesMap = {};
      notes.forEach((n) => { notesMap[n.matiere] = { valeur: Number(n.valeur), bareme: Number(n.bareme) || 100 }; });
      parTrim[tr] = { notesMap, moyenne: notes.length ? calculerMoyenne(notes).moyenneGenerale : null };
    }
    donnees.set(el.id, parTrim);
  }

  // Classement (place) par trimestre = rang décroissant de la moyenne dans le niveau
  const places = {};
  for (const tr of trimestresAffiches) {
    const classement = eleves
      .map((el) => ({ id: el.id, moy: donnees.get(el.id)[tr].moyenne }))
      .filter((x) => x.moy != null)
      .sort((a, b) => b.moy - a.moy);
    const m = new Map();
    classement.forEach((x, i) => m.set(x.id, i + 1));
    places[tr] = m;
  }

  let nbBulletins = 0;
  let nbSansNotes = 0;
  let nbDejaFaits = 0;
  let nbRegeneres = 0;

  for (const eleve of eleves) {
    const existant = await trouverBulletin(eleve.id, trimestre, anneeScolaire);
    if (existant && !regenerer) { nbDejaFaits += 1; continue; }

    const dn = donnees.get(eleve.id);
    const moyenneCourante = dn[trimestre] ? dn[trimestre].moyenne : null;
    // Pas de notes validées ce trimestre → on ne touche pas au bulletin existant.
    if (moyenneCourante == null) { nbSansNotes += 1; continue; }

    // Régénération : on remplace l'ancien bulletin (fichier + enregistrement)
    if (existant) {
      if (existant.url_pdf) {
        const chemin = path.resolve(UPLOAD_ROOT, existant.url_pdf);
        if (chemin.startsWith(path.resolve(UPLOAD_ROOT))) await fs.unlink(chemin).catch(() => {});
      }
      await supprimerDocument(existant.id);
      nbRegeneres += 1;
    }

    const notesParTrim = {};
    const moyennesParTrim = {};
    const placesParTrim = {};
    for (const tr of trimestresAffiches) {
      notesParTrim[tr] = dn[tr].notesMap;
      moyennesParTrim[tr] = dn[tr].moyenne;
      placesParTrim[tr] = places[tr].get(eleve.id) || null;
    }

    // Moyenne générale annuelle au 3e trimestre (moyenne des trimestres disponibles)
    let moyenneAnnuelle = null;
    if (trimestre === '3e_trimestre') {
      const dispo = ORDRE_TRIM.map((tr) => (dn[tr] ? dn[tr].moyenne : null)).filter((v) => v != null);
      moyenneAnnuelle = dispo.length
        ? Math.round((dispo.reduce((a, b) => a + b, 0) / dispo.length) * 100) / 100
        : null;
    }

    const { urlPdf, identifiantUnique } = await genererBulletinPDF({
      eleve, niveau, trimestre, anneeScolaire, ecoleNom, logoPath,
      matieres, notesParTrim, moyennesParTrim, placesParTrim, trimestresAffiches, moyenneAnnuelle,
      seuilReussite,
    });

    await creerDocumentOfficiel({
      idEleve: eleve.id, type: 'bulletin', urlPdf, identifiantUnique, periode: trimestre, anneeScolaire,
    });
    nbBulletins += 1;

    // Notification au parent — uniquement pour un nouveau bulletin (pas lors d'une régénération).
    const libelle = LIBELLE_TRIMESTRE[trimestre] || trimestre;
    if (existant && !forcerNotification) continue; // régénération : bulletin remplacé, on ne re-notifie pas
    const bilanTexte = moyenneAnnuelle != null
      ? `\nMoyenne générale annuelle : ${moyenneAnnuelle.toFixed(2)}/100.` : '';
    const bilanHtml = moyenneAnnuelle != null
      ? `<p>Moyenne générale annuelle : <strong>${moyenneAnnuelle.toFixed(2)}/100</strong>.</p>` : '';

    const appreciation = await genererAppreciation({
      eleveNom: eleve.nom, niveau, trimestre, anneeScolaire, moyenneCourante, seuilReussite,
      notesMap: notesParTrim[trimestre], moyenneAnnuelle,
    });
    const pdfBuffer = await fs.readFile(path.resolve(UPLOAD_ROOT, urlPdf)).catch(() => null);
    const attachments = pdfBuffer
      ? [{ filename: `bulletin-${libelle.replace(/\s+/g, '-')}-${anneeScolaire}.pdf`, content: pdfBuffer.toString('base64') }]
      : undefined;

    const texteNotif = `Bonjour ${eleve.parent_nom},\n\nLe bulletin du ${libelle} (année ${anneeScolaire}) ` +
          `de ${eleve.nom} est disponible en pièce jointe et dans votre compte.\n` +
          `Moyenne du trimestre : ${moyenneCourante.toFixed(2)}/100.` + bilanTexte +
          `\n\n${appreciation}` +
          `\n\nConsultez tous les résultats et bulletins sur ${SITE_URL}`;

    try {
      await envoyerCourriel({
        to: eleve.parent_courriel,
        subject: `Lekòl Pam — bulletin ${libelle} disponible`,
        text: texteNotif,
        html: `<p>Bonjour ${echapperHtml(eleve.parent_nom)},</p>` +
              `<p>Le bulletin du <strong>${echapperHtml(libelle)}</strong> (année ${echapperHtml(anneeScolaire)}) de ` +
              `<strong>${echapperHtml(eleve.nom)}</strong> est disponible en pièce jointe et dans votre compte.</p>` +
              `<p>Moyenne du trimestre : <strong>${moyenneCourante.toFixed(2)}/100</strong>.</p>` +
              bilanHtml +
              `<p>${echapperHtml(appreciation)}</p>` +
              `<p>Consultez tous les résultats et bulletins sur <a href="${SITE_URL}">${SITE_URL}</a>.</p>`,
        attachments,
      });
    } catch (err) {
      console.error('Notification bulletin échouée :', err.message);
    }

    if (eleve.parent_telephone) {
      try {
        await envoyerSms({ to: eleve.parent_telephone, texte: texteNotif });
      } catch (err) {
        console.error('Notification SMS bulletin échouée :', err.message);
      }
    }
  }

  return { ok: true, nbBulletins, nbSansNotes, nbDejaFaits, nbRegeneres };
}
