// Service Ré-inscription — logique de fin d'année :
//  - promotion (passé = niveau suivant, échoué/incomplet = même niveau) ;
//  - lancement d'une campagne par le propriétaire + courriels aux familles ;
//  - liste des enfants ré-inscriptibles d'un parent + création de la ré-inscription.
import { anneeScolaireCourante, anneeSuivante } from '../utils/dates.js';
import { niveauSuivant, estDernierNiveau } from '../config/niveaux.js';
import { obtenir as obtenirEcole } from '../models/ecole.model.js';
import { notesValideesToutes } from '../models/note.model.js';
import { calculerMoyenne } from './moyenne.service.js';
import { listerParentsAvecCourriel } from '../models/user.model.js';
import { listerParParent, listerElevesAvecCourriel } from '../models/eleve.model.js';
import {
  creerReinscription, inscriptionActivePourAnnee, reinscriptionNonPayeePourAnnee,
  derniereInscriptionDeEleve,
} from '../models/inscription.model.js';
import * as campagneModel from '../models/reinscription.model.js';
import { envoyerCourriel } from '../config/mailer.js';
import { echapperHtml } from '../utils/html.js';

const SEUIL_DEFAUT = 60; // repli si l'école n'a pas défini de seuil (cohérent avec /ecole/marque)
const ORIGINE = () => (process.env.CLIENT_ORIGIN || 'http://localhost:5173').replace(/\/+$/, '');

// Moyenne annuelle d'un élève pour une année : moyenne des moyennes pondérées de
// chaque trimestre, calculées via calculerMoyenne (le MÊME calcul que le bulletin
// officiel — coefficient 0 = matière hors calcul, barème absent = 100). Renvoie
// null si l'année est incomplète (3e trimestre absent) ou sans note exploitable.
function moyenneAnnuelle(notesAnnee) {
  const parTrim = new Map();
  for (const n of notesAnnee) {
    if (!parTrim.has(n.periode)) parTrim.set(n.periode, []);
    parTrim.get(n.periode).push(n);
  }
  if (!parTrim.has('3e_trimestre')) return null; // année non terminée
  const moyennes = [];
  for (const notes of parTrim.values()) {
    const { moyenneGenerale, sommeCoef } = calculerMoyenne(notes);
    if (sommeCoef > 0) moyennes.push(moyenneGenerale);
  }
  if (!moyennes.length) return null;
  return Math.round((moyennes.reduce((a, b) => a + b, 0) / moyennes.length) * 100) / 100;
}

// Détermine le résultat d'un élève (sur sa DERNIÈRE année complète) + le niveau
// proposé. La base n'est pas l'année « courante » (qui, après la rentrée, n'a pas
// encore de notes) mais la dernière année où l'élève a un 3e trimestre.
//  - 'promu'        : a réussi (moyenne ≥ seuil) → niveau suivant ;
//  - 'maintenu'     : a échoué (moyenne < seuil) → même niveau ;
//  - 'promu_defaut' : aucun résultat complet → promotion par défaut (cas normal
//                     de la ré-inscription ; le secrétariat valide et peut ajuster) ;
//  - 'indetermine'  : aucun résultat complet et déjà au dernier niveau → même niveau ;
//  - 'diplome'      : a réussi au dernier niveau (NS4) → fin de cycle.
export async function evaluerEleve(eleve, seuil) {
  const toutes = await notesValideesToutes(eleve.id);
  const parAnnee = new Map();
  for (const n of toutes) {
    if (!parAnnee.has(n.annee_scolaire)) parAnnee.set(n.annee_scolaire, []);
    parAnnee.get(n.annee_scolaire).push(n);
  }
  // Années complètes (avec 3e trimestre), la plus récente d'abord.
  const anneesCompletes = [...parAnnee.keys()]
    .filter((a) => parAnnee.get(a).some((n) => n.periode === '3e_trimestre'))
    .sort()
    .reverse();

  const dernier = estDernierNiveau(eleve.niveau);
  const suivant = niveauSuivant(eleve.niveau);
  // « peut monter » = niveau reconnu dans la liste ET pas le dernier. Un niveau
  // hérité incohérent (hors liste) donne suivant === niveau : on ne peut pas
  // promouvoir automatiquement, le secrétariat fixera le niveau (évite un faux
  // « Promu » qui n'augmente rien).
  const peutMonter = suivant !== eleve.niveau;

  if (anneesCompletes.length) {
    const annee = anneesCompletes[0];
    const moyenne = moyenneAnnuelle(parAnnee.get(annee));
    if (moyenne != null && moyenne >= seuil) {
      if (dernier) return { moyenne, anneeEvaluee: annee, resultat: 'diplome', niveauPropose: eleve.niveau };
      if (!peutMonter) return { moyenne, anneeEvaluee: annee, resultat: 'indetermine', niveauPropose: eleve.niveau };
      return { moyenne, anneeEvaluee: annee, resultat: 'promu', niveauPropose: suivant };
    }
    return { moyenne, anneeEvaluee: annee, resultat: 'maintenu', niveauPropose: eleve.niveau };
  }

  // Aucun résultat complet : par défaut, on propose la promotion — sauf au dernier
  // niveau ou si le niveau n'est pas reconnu (on ne peut pas déterminer le suivant).
  if (!peutMonter) return { moyenne: null, anneeEvaluee: null, resultat: 'indetermine', niveauPropose: eleve.niveau };
  return { moyenne: null, anneeEvaluee: null, resultat: 'promu_defaut', niveauPropose: suivant };
}

// Campagne active (ou null) — exposée au front (bannière, page parent).
export function campagneActive() {
  return campagneModel.campagneActive();
}

export function derniereCampagne() {
  return campagneModel.derniereCampagne();
}

// Enfants d'un parent ré-inscriptibles pour la campagne active : résultat de
// l'année écoulée, niveau proposé, et si une ré-inscription existe déjà.
export async function enfantsAReinscrire(idParent) {
  const campagne = await campagneModel.campagneActive();
  if (!campagne) return { active: false, enfants: [] };

  const ecole = await obtenirEcole();
  const seuil = ecole && ecole.seuil_reussite != null ? Number(ecole.seuil_reussite) : SEUIL_DEFAUT;

  const enfants = await listerParParent(idParent);
  const resultat = [];
  for (const e of enfants) {
    const evalEleve = await evaluerEleve(e, seuil);
    const soumise = await inscriptionActivePourAnnee(e.id, campagne.annee_cible);
    const nonPayee = soumise ? null : await reinscriptionNonPayeePourAnnee(e.id, campagne.annee_cible);
    resultat.push({
      id: e.id,
      nom: e.nom,
      niveauActuel: e.niveau,
      moyenne: evalEleve.moyenne,
      anneeEvaluee: evalEleve.anneeEvaluee,  // année dont provient la moyenne (ou null)
      resultat: evalEleve.resultat,          // promu | promu_defaut | maintenu | indetermine | diplome
      niveauPropose: evalEleve.niveauPropose,
      dejaReinscrit: !!soumise,              // dossier payé/transmis (bloque)
      statutReinscription: soumise ? soumise.statut : null,
      paiementEnAttente: !!nonPayee,         // dossier créé mais frais non encore payés
    });
  }
  return { active: true, anneeCible: campagne.annee_cible, enfants: resultat };
}

// Crée la ré-inscription d'un enfant (élève existant) pour l'année visée.
// Renvoie { ok, idInscription, niveauDemande, ... } ou { ok:false, code, erreur }.
export async function reinscrireEnfant(idParent, idEleve) {
  const campagne = await campagneModel.campagneActive();
  if (!campagne) return { ok: false, code: 409, erreur: 'Aucune campagne de ré-inscription active.' };

  const enfants = await listerParParent(idParent);
  const eleve = enfants.find((e) => e.id === Number(idEleve));
  if (!eleve) return { ok: false, code: 403, erreur: 'Cet élève ne fait pas partie de vos enfants.' };

  // Dossier déjà soumis (payé/transmis) → on bloque.
  const soumise = await inscriptionActivePourAnnee(eleve.id, campagne.annee_cible);
  if (soumise) return { ok: false, code: 409, erreur: `Déjà ré-inscrit(e) pour ${campagne.annee_cible}.` };

  // Ré-inscription impayée déjà créée → on la réutilise (le contrôleur renvoie
  // son paiement en cours) au lieu d'en créer une seconde.
  const nonPayee = await reinscriptionNonPayeePourAnnee(eleve.id, campagne.annee_cible);
  if (nonPayee) {
    return {
      ok: true, reutilise: true, idInscription: nonPayee.id,
      anneeCible: campagne.annee_cible, niveauDemande: nonPayee.niveau_demande,
    };
  }

  const ecole = await obtenirEcole();
  const seuil = ecole && ecole.seuil_reussite != null ? Number(ecole.seuil_reussite) : SEUIL_DEFAUT;
  const evalEleve = await evaluerEleve(eleve, seuil);
  if (evalEleve.resultat === 'diplome') {
    return { ok: false, code: 409, erreur: "L'élève a terminé le dernier niveau (fin de cycle)." };
  }

  const contact = (await derniereInscriptionDeEleve(eleve.id)) || {};
  const { idInscription } = await creerReinscription({
    idEleve: eleve.id,
    anneeScolaire: campagne.annee_cible,
    niveauDemande: evalEleve.niveauPropose,
    nomParent: contact.nom_parent,
    professionParent: contact.profession_parent,
    telephoneParent: contact.telephone_parent,
    courrielParent: contact.courriel_parent,
  });

  return {
    ok: true,
    reutilise: false,
    idInscription,
    anneeCible: campagne.annee_cible,
    niveauDemande: evalEleve.niveauPropose,
    resultat: evalEleve.resultat,
  };
}

// --- Lancement / clôture (propriétaire) ---------------------------------

function construireCourriel(nomEcole, anneeCible, lien) {
  const ecole = echapperHtml(nomEcole || 'Lekòl Pam');
  const annee = echapperHtml(anneeCible);
  const sujet = `${nomEcole || 'Lekòl Pam'} — Ré-inscription ${anneeCible}`;
  const texte =
    `Bonjour,\n\n`
    + `La ré-inscription pour l'année scolaire ${anneeCible} est maintenant ouverte à ${nomEcole || "l'école"}.\n\n`
    + `Connectez-vous à votre compte pour ré-inscrire votre/vos enfant(s). Les élèves qui ont réussi `
    + `passent automatiquement au niveau supérieur ; ceux qui n'ont pas réussi restent au même niveau.\n\n`
    + `Lien de ré-inscription : ${lien}\n\n`
    + `Merci,\nL'administration`;
  const html =
    `<p>Bonjour,</p>`
    + `<p>La <strong>ré-inscription pour l'année scolaire ${annee}</strong> est maintenant ouverte à ${ecole}.</p>`
    + `<p>Connectez-vous à votre compte pour ré-inscrire votre/vos enfant(s). Les élèves qui ont réussi `
    + `passent automatiquement au niveau supérieur ; ceux qui n'ont pas réussi restent au même niveau.</p>`
    + `<p><a href="${lien}" style="display:inline-block;background:#1F3A5F;color:#fff;padding:10px 18px;`
    + `border-radius:8px;text-decoration:none;font-weight:bold">Ré-inscrire mon enfant</a></p>`
    + `<p>Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br>`
    + `<a href="${lien}">${echapperHtml(lien)}</a></p>`
    + `<p>Merci,<br>L'administration</p>`;
  return { sujet, texte, html };
}

// Envoi des courriels en arrière-plan (ne bloque pas la réponse HTTP). À la fin,
// nb_courriels est mis à jour avec le nombre RÉELLEMENT envoyé (pas le nombre
// ciblé), pour que le tableau de bord ne dise pas « notifiées » si tout a échoué.
async function envoyerCourrielsReinscription(campagneId, destinataires, sujet, texte, html) {
  let envoyes = 0;
  for (const d of destinataires) {
    try {
      await envoyerCourriel({ to: d.courriel, subject: sujet, text: texte, html });
      envoyes += 1;
    } catch (err) {
      console.error(`Ré-inscription : courriel à ${d.courriel} échoué :`, err.message);
    }
  }
  await campagneModel.majNbCourriels(campagneId, envoyes).catch(() => {});
  console.log(`↔ Ré-inscription : ${envoyes}/${destinataires.length} courriel(s) envoyé(s).`);
}

// Lance une campagne (propriétaire) : crée la campagne pour l'année suivante et
// notifie toutes les familles par courriel (en arrière-plan). Refusé si une
// campagne est déjà active (garde applicative + contrainte d'unicité en base
// contre les doubles clics / requêtes concurrentes).
export async function lancerCampagne(idAuteur) {
  const existante = await campagneModel.campagneActive();
  if (existante) {
    return { ok: false, code: 409, erreur: `Une campagne est déjà active (année ${existante.annee_cible}).` };
  }
  const anneeCible = anneeSuivante(anneeScolaireCourante());

  let campagne;
  try {
    campagne = await campagneModel.creerCampagne({ anneeCible, lanceePar: idAuteur });
  } catch (err) {
    // Deux lancements concurrents : la contrainte d'unicité (actif_unique) rejette
    // le second. On renvoie un conflit plutôt que de créer une 2e campagne active.
    if (err && err.code === 'ER_DUP_ENTRY') {
      return { ok: false, code: 409, erreur: 'Une campagne de ré-inscription est déjà active.' };
    }
    throw err;
  }

  const ecole = await obtenirEcole();
  // Destinataires : parents + courriels renseignés sur les fiches élèves, dédoublonnés.
  const parents = await listerParentsAvecCourriel();
  const eleves = await listerElevesAvecCourriel();
  const vus = new Set();
  const destinataires = [];
  for (const r of [...parents, ...eleves]) {
    const mail = (r.courriel || '').trim();
    const cle = mail.toLowerCase();
    if (!mail || vus.has(cle)) continue;
    vus.add(cle);
    destinataires.push({ courriel: mail });
  }
  const lien = `${ORIGINE()}/reinscription`;
  const { sujet, texte, html } = construireCourriel(ecole?.nom, anneeCible, lien);

  // Envoi non bloquant : la réponse part tout de suite ; nb_courriels sera mis à
  // jour avec le nombre réellement envoyé à la fin du traitement.
  envoyerCourrielsReinscription(campagne.id, destinataires, sujet, texte, html).catch(() => {});

  return { ok: true, anneeCible, nbDestinataires: destinataires.length };
}

export async function cloturerCampagne() {
  const active = await campagneModel.campagneActive();
  if (!active) return { ok: false, code: 409, erreur: 'Aucune campagne active à clôturer.' };
  await campagneModel.cloturerCampagne(active.id);
  return { ok: true };
}
