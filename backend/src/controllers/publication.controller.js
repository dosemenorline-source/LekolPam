// Contrôleur Publication + Bulletins
import path from 'path';
import fs from 'fs/promises';
import { publier } from '../services/publication.service.js';
import { lister as listerPublications, trouverParId as trouverPublication,
  supprimer as supprimerPublicationModel } from '../models/publication.model.js';
import { listerPourEleve as listerBulletinsEleve, listerParNiveau as listerBulletinsNiveauModel,
  trouverAvecProprietaire as trouverDocument, bulletinsPourPublication,
  supprimer as supprimerDocument }
  from '../models/documentOfficiel.model.js';
import { trouverAvecProprietaire as trouverEleve, trouverParId as trouverEleveParId } from '../models/eleve.model.js';
import { estAcquitte } from '../models/acquittement.model.js';
import { UPLOAD_ROOT } from '../config/upload.js';

const TRIMESTRES = ['1er_trimestre', '2e_trimestre', '3e_trimestre'];

function estAdmin(req) {
  return req.session.role === 'admin' || req.session.role === 'direction';
}

// Économat : masque aux familles les bulletins des trimestres non acquittés.
// Les autres documents (relevés, duplicatas) ne sont pas concernés.
async function filtrerBulletinsAcquittes(documents, idEleve) {
  const resultat = [];
  for (const doc of documents) {
    if (doc.type === 'bulletin' && doc.periode && doc.annee_scolaire) {
      if (!(await estAcquitte(idEleve, doc.annee_scolaire, doc.periode))) continue;
    }
    resultat.push(doc);
  }
  return resultat;
}

// POST /api/publications (direction)
export async function publierCtrl(req, res, next) {
  try {
    const niveau = (req.body.niveau || '').trim();
    const anneeScolaire = (req.body.anneeScolaire || '').trim();
    const trimestre = (req.body.trimestre || '').trim();

    if (!niveau || !anneeScolaire) {
      return res.status(400).json({ erreur: 'niveau et anneeScolaire requis.' });
    }
    if (!TRIMESTRES.includes(trimestre)) {
      return res.status(400).json({ erreur: `Trimestre invalide (${TRIMESTRES.join(', ')}).` });
    }

    const regenerer = req.body.regenerer === true || req.body.regenerer === 'true';
    const forcerNotification = req.body.forcerNotification === true || req.body.forcerNotification === 'true';
    const r = await publier({
      niveau, anneeScolaire, trimestre, idDirection: req.session.userId, regenerer, forcerNotification,
    });
    if (!r.ok) return res.status(r.code).json({ erreur: r.erreur });

    return res.status(201).json({
      message: regenerer ? 'Notes publiées et bulletins régénérés.' : 'Notes publiées.',
      bulletinsGeneres: r.nbBulletins,
      elevesSansNotes: r.nbSansNotes,
      bulletinsDejaFaits: r.nbDejaFaits,
      bulletinsRegeneres: r.nbRegeneres,
    });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/publications/:id (direction) — dé-publie un niveau/trimestre + supprime ses bulletins
export async function supprimerCtrl(req, res, next) {
  try {
    const publication = await trouverPublication(Number(req.params.id));
    if (!publication) return res.status(404).json({ erreur: 'Publication introuvable.' });

    // Supprime les bulletins générés (fichiers PDF + enregistrements)
    const bulletins = await bulletinsPourPublication(
      publication.niveau, publication.trimestre, publication.annee_scolaire
    );
    for (const b of bulletins) {
      if (b.url_pdf) {
        const chemin = path.resolve(UPLOAD_ROOT, b.url_pdf);
        if (chemin.startsWith(path.resolve(UPLOAD_ROOT))) await fs.unlink(chemin).catch(() => {});
      }
      await supprimerDocument(b.id);
    }
    await supprimerPublicationModel(publication.id);

    return res.json({ message: 'Publication supprimée.', bulletinsSupprimes: bulletins.length });
  } catch (err) {
    next(err);
  }
}

// GET /api/publications (admin/direction)
export async function lister(req, res, next) {
  try {
    const publications = await listerPublications();
    return res.json({ publications });
  } catch (err) {
    next(err);
  }
}

// GET /api/admin/bulletins?niveau= (admin/direction)
// niveau optionnel : sans niveau → tous les bulletins.
export async function listerBulletinsNiveau(req, res, next) {
  try {
    const niveau = (req.query.niveau || '').trim();
    const bulletins = await listerBulletinsNiveauModel(niveau || undefined);
    return res.json({ bulletins });
  } catch (err) {
    next(err);
  }
}

// GET /api/eleve/mes-bulletins (session élève) — ses bulletins, lecture seule
export async function listerMesBulletinsEleve(req, res, next) {
  try {
    const tous = await listerBulletinsEleve(req.session.eleveId, 'bulletin');
    // Un ancien élève n'a pas d'économat à jour à vérifier (dossier historique).
    const eleve = await trouverEleveParId(req.session.eleveId);
    const bulletins = eleve?.ancien_eleve ? tous : await filtrerBulletinsAcquittes(tous, req.session.eleveId);
    return res.json({ bulletins });
  } catch (err) {
    next(err);
  }
}

// GET /api/eleves/:id/bulletins (propriétaire ou admin)
export async function listerBulletins(req, res, next) {
  try {
    const eleve = await trouverEleve(Number(req.params.id));
    if (!eleve) return res.status(404).json({ erreur: 'Élève introuvable.' });
    if (!estAdmin(req) && eleve.id_utilisateur !== req.session.userId) {
      return res.status(403).json({ erreur: 'Accès refusé.' });
    }
    let bulletins = await listerBulletinsEleve(eleve.id, 'bulletin');
    // Familles : masquer les bulletins des trimestres non acquittés (admin voit tout).
    if (!estAdmin(req)) bulletins = await filtrerBulletinsAcquittes(bulletins, eleve.id);
    return res.json({ bulletins });
  } catch (err) {
    next(err);
  }
}

// GET /api/eleves/:id/documents-officiels (propriétaire ou admin) — tous types
export async function listerDocumentsOfficiels(req, res, next) {
  try {
    const eleve = await trouverEleve(Number(req.params.id));
    if (!eleve) return res.status(404).json({ erreur: 'Élève introuvable.' });
    if (!estAdmin(req) && eleve.id_utilisateur !== req.session.userId) {
      return res.status(403).json({ erreur: 'Accès refusé.' });
    }
    let documents = await listerBulletinsEleve(eleve.id); // sans type → tous
    if (!estAdmin(req)) documents = await filtrerBulletinsAcquittes(documents, eleve.id);
    return res.json({ documents });
  } catch (err) {
    next(err);
  }
}

// GET /api/documents-officiels/:id/fichier (propriétaire ou admin)
export async function servirFichier(req, res, next) {
  try {
    const doc = await trouverDocument(Number(req.params.id));
    if (!doc) return res.status(404).json({ erreur: 'Document introuvable.' });

    // Accès : admin/direction, OU parent propriétaire, OU l'élève lui-même (session par code).
    const estProprietaireParent = doc.id_utilisateur === req.session.userId;
    const estEleveConcerne = req.session.role === 'eleve' && doc.id_eleve === req.session.eleveId;
    if (!estAdmin(req) && !estProprietaireParent && !estEleveConcerne) {
      return res.status(403).json({ erreur: 'Accès refusé.' });
    }

    // Économat : familles (parent/élève) — bulletin bloqué si le trimestre n'est pas acquitté.
    // Un ancien élève (dossier historique) n'a pas d'économat à jour à vérifier.
    if (!estAdmin(req) && doc.type === 'bulletin' && doc.periode && doc.annee_scolaire) {
      const eleveDoc = await trouverEleveParId(doc.id_eleve);
      if (!eleveDoc?.ancien_eleve && !(await estAcquitte(doc.id_eleve, doc.annee_scolaire, doc.periode))) {
        return res.status(403).json({ erreur: "Résultats indisponibles. Régularisez votre situation auprès de l'économat." });
      }
    }

    const chemin = path.resolve(UPLOAD_ROOT, doc.url_pdf);
    if (!chemin.startsWith(path.resolve(UPLOAD_ROOT))) {
      return res.status(400).json({ erreur: 'Chemin invalide.' });
    }
    return res.sendFile(chemin);
  } catch (err) {
    next(err);
  }
}
