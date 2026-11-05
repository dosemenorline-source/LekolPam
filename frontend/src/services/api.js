// Client API — envoie toujours le cookie de session (credentials: 'include')
// En dev : backend séparé (localhost:4000). En prod : même origine → chemin relatif '/api'.
const API_URL = import.meta.env.VITE_API_URL
  || (import.meta.env.DEV ? 'http://localhost:4000/api' : '/api');

async function request(chemin, options = {}) {
  const estFormData = options.body instanceof FormData;
  const res = await fetch(`${API_URL}${chemin}`, {
    credentials: 'include',
    ...options,
    headers: {
      ...(estFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(options.headers || {}),
    },
  });

  let data = null;
  try { data = await res.json(); } catch { /* pas de corps JSON */ }

  if (!res.ok) {
    const message = (data && data.erreur) || 'Une erreur est survenue.';
    // Session expirée en cours d'usage (ex. onglet resté ouvert plus de 8h,
    // voir cookie.maxAge côté serveur) : le message exact ci-dessous ne vient
    // QUE de requireAuth/requireRole/requireEleve (jamais d'un login qui a
    // simplement échoué, qui répond « Identifiants invalides » ou équivalent)
    // — sans ce renvoi, la page reste plantée sur une erreur technique brute
    // au lieu de ramener la personne se reconnecter.
    if (res.status === 401 && message === 'Authentification requise.'
      && !chemin.endsWith('/me') && window.location.pathname !== '/login') {
      window.location.href = '/login?session=expiree';
    }
    const err = new Error(message);
    err.status = res.status;
    err.payload = data || {};
    throw err;
  }
  return data;
}

const json = (body) => JSON.stringify(body);

export const authApi = {
  register: (payload) => request('/auth/register', { method: 'POST', body: json(payload) }),
  login: (payload) => request('/auth/login', { method: 'POST', body: json(payload) }),
  // 2FA parent : 2ᵉ étape (vérification du code) et renvoi de code.
  verifierConnexion: (code) => request('/auth/verifier-connexion', { method: 'POST', body: json({ code }) }),
  renvoyerCodeConnexion: () => request('/auth/renvoyer-code-connexion', { method: 'POST' }),
  eleveConnexion: (code) => request('/auth/eleve-connexion', { method: 'POST', body: json({ code }) }),
  motDePasseOublie: (courriel) => request('/auth/mot-de-passe-oublie', { method: 'POST', body: json({ courriel }) }),
  reinitialiserMotDePasse: (payload) => request('/auth/reinitialiser-mot-de-passe', { method: 'POST', body: json(payload) }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  me: () => request('/auth/me'),
  googleClientId: () => request('/auth/google/client-id'),
  google: (credential) => request('/auth/google', { method: 'POST', body: json({ credential }) }),
  // Connexion biométrique (WebAuthn / passkeys : Face ID, Touch ID, etc.)
  webauthnOptionsEnregistrement: () => request('/auth/webauthn/enregistrement/options', { method: 'POST' }),
  webauthnVerifierEnregistrement: (payload) => request('/auth/webauthn/enregistrement/verifier', { method: 'POST', body: json(payload) }),
  webauthnOptionsConnexion: (courriel) => request('/auth/webauthn/connexion/options', { method: 'POST', body: json({ courriel }) }),
  webauthnVerifierConnexion: (reponse) => request('/auth/webauthn/connexion/verifier', { method: 'POST', body: json({ reponse }) }),
  webauthnAppareils: () => request('/auth/webauthn/appareils'),
  webauthnSupprimerAppareil: (id) => request(`/auth/webauthn/appareils/${id}`, { method: 'DELETE' }),
};

export const inscriptionsApi = {
  lister: () => request('/inscriptions'),
  config: () => request('/inscriptions/config'),
  creer: (payload) => request('/inscriptions', { method: 'POST', body: json(payload) }),
  detail: (id) => request(`/inscriptions/${id}`),
  listerDocuments: (id) => request(`/inscriptions/${id}/documents`),
  televerserDocument: (id, type, fichier) => {
    const fd = new FormData();
    fd.append('type', type);
    fd.append('fichier', fichier);
    return request(`/inscriptions/${id}/documents`, { method: 'POST', body: fd });
  },
  annuler: (id) => request(`/inscriptions/${id}/annuler`, { method: 'POST' }),
};

export const notesApi = {
  mesEleves: () => request('/mes-eleves'),
  notesEleve: (idEleve) => request(`/eleves/${idEleve}/notes`),
  bulletinsEleve: (idEleve) => request(`/eleves/${idEleve}/bulletins`),
  documentsOfficielsEleve: (idEleve) => request(`/eleves/${idEleve}/documents-officiels`),
  genererCodeEleve: (idEleve) => request(`/eleves/${idEleve}/code-acces`, { method: 'POST' }),
};

// Espace élève (connexion par code) — lecture seule
export const eleveApi = {
  mesNotes: () => request('/eleve/mes-notes'),
  mesBulletins: () => request('/eleve/mes-bulletins'),
  appreciationIA: (body) => request('/eleve/appreciation-ia', { method: 'POST', body: json(body) }),
  badge: () => request('/eleve/badge'),
  televerserPhoto: (fichier) => {
    const fd = new FormData();
    fd.append('photo', fichier);
    return request('/eleve/photo', { method: 'POST', body: fd });
  },
  mesDevoirs: () => request('/eleve/devoirs'),
  mesDocuments: () => request('/eleve/documents'),
  monHoraire: () => request('/eleve/horaire'),
};

// Comptes professeur — créés et assignés à des classes (matières) par la direction
export const enseignantsApi = {
  lister: () => request('/direction/enseignants'),
  creer: (body) => request('/direction/enseignants', { method: 'POST', body: json(body) }),
  definirStatut: (id, statut) => request(`/direction/enseignants/${id}`, { method: 'PATCH', body: json({ statut }) }),
  assignerMatiere: (id, idMatiere) =>
    request(`/direction/enseignants/${id}/matieres`, { method: 'POST', body: json({ idMatiere }) }),
  retirerMatiere: (id, idMatiere) =>
    request(`/direction/enseignants/${id}/matieres/${idMatiere}`, { method: 'DELETE' }),
};

// Espace professeur : ses classes, devoirs, documents, horaires
export const professeurApi = {
  mesMatieres: () => request('/professeur/mes-matieres'),

  devoirs: (idMatiere) => request(`/professeur/devoirs${qs({ idMatiere })}`),
  creerDevoir: (body) => request('/professeur/devoirs', { method: 'POST', body: json(body) }),
  supprimerDevoir: (id) => request(`/professeur/devoirs/${id}`, { method: 'DELETE' }),

  documents: (idMatiere) => request(`/professeur/documents${qs({ idMatiere })}`),
  creerDocument: ({ idMatiere, titre, fichier }) => {
    const fd = new FormData();
    fd.append('idMatiere', idMatiere);
    fd.append('titre', titre);
    fd.append('fichier', fichier);
    return request('/professeur/documents', { method: 'POST', body: fd });
  },
  supprimerDocument: (id) => request(`/professeur/documents/${id}`, { method: 'DELETE' }),

  horaires: (idMatiere) => request(`/professeur/horaires${qs({ idMatiere })}`),
  creerHoraire: (body) => request('/professeur/horaires', { method: 'POST', body: json(body) }),
  modifierHoraire: (id, body) => request(`/professeur/horaires/${id}`, { method: 'PUT', body: json(body) }),
  supprimerHoraire: (id) => request(`/professeur/horaires/${id}`, { method: 'DELETE' }),
};

export const paiementsApi = {
  tarifs: () => request('/tarifs'),
  coordonnees: () => request('/ecole/coordonnees'),
  lister: () => request('/paiements'),
  detail: (id) => request(`/paiements/${id}`),
  creer: (payload) => request('/paiements', { method: 'POST', body: json(payload) }),
  televerserPreuve: (id, fichier) => {
    const fd = new FormData();
    fd.append('preuve', fichier);
    return request(`/paiements/${id}/preuve`, { method: 'POST', body: fd });
  },
  demarrerPaiementMobile: (id, methode) => request(`/paiements/${id}/paiement-mobile/demarrer`, { method: 'POST', body: json({ methode }) }),
  confirmerPaiementMobile: (id) => request(`/paiements/${id}/paiement-mobile/confirmer`, { method: 'POST' }),
};

const qs = (params = {}) => {
  const p = Object.entries(params).filter(([, v]) => v !== undefined && v !== '' && v !== null);
  return p.length ? '?' + p.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&') : '';
};

export const adminApi = {
  // Inscriptions
  inscriptions: (params) => request(`/admin/inscriptions${qs(params)}`),
  changerStatutInscription: (id, body) => request(`/inscriptions/${id}/statut`, { method: 'PATCH', body: json(body) }),
  messageParentIA: (id, body) => request(`/inscriptions/${id}/message-ia`, { method: 'POST', body: json(body) }),
  // Notes
  eleves: (niveau) => request(`/admin/eleves${qs({ niveau })}`),
  matieres: (niveau) => request(`/matieres${qs({ niveau })}`),
  notes: (params) => request(`/admin/notes${qs(params)}`),
  creerNote: (body) => request('/notes', { method: 'POST', body: json(body) }),
  majNote: (id, body) => request(`/notes/${id}`, { method: 'PATCH', body: json(body) }),
  supprimerNote: (id) => request(`/notes/${id}`, { method: 'DELETE' }),
  validerNote: (id) => request(`/notes/${id}/valider`, { method: 'PATCH' }),
  // Paiements
  paiements: (statut) => request(`/admin/paiements${qs({ statut })}`),
  validationPaiement: (id, body) => request(`/paiements/${id}/validation`, { method: 'PATCH', body: json(body) }),
  // Économat — acquittement de scolarité par trimestre
  acquittements: (params) => request(`/admin/acquittements${qs(params)}`),
  marquerAcquittement: (body) => request('/admin/acquittements', { method: 'POST', body: json(body) }),
  retirerAcquittement: (body) => request('/admin/acquittements', { method: 'DELETE', body: json(body) }),
  // Codes d'accès élèves (secrétariat)
  elevesCodes: (recherche) => request(`/admin/eleves-codes${qs({ recherche })}`),
  genererCodeEleve: (id) => request(`/admin/eleves/${id}/code-acces`, { method: 'POST' }),
  // Badges élèves (secrétariat)
  badgeEleve: (id) => request(`/admin/eleves/${id}/badge`),
  majInfosBadge: (id, body) => request(`/admin/eleves/${id}/badge-infos`, { method: 'PATCH', body: json(body) }),
  majEnteteEcole: (body) => request('/ecole-entete', { method: 'PUT', body: json(body) }),
  majSeuilReussite: (seuil) => request('/ecole-seuil-reussite', { method: 'PUT', body: json({ seuil }) }),
  televerserPhotoEleve: (id, fichier) => {
    const fd = new FormData();
    fd.append('photo', fichier);
    return request(`/admin/eleves/${id}/photo`, { method: 'POST', body: fd });
  },
  // Présence quotidienne (scan du QR du badge) — type: 'entree' | 'sortie'
  scannerPresence: (code, type) => request('/admin/presences/scan', { method: 'POST', body: json({ code, type }) }),
  presencesDuJour: (niveau) => request(`/admin/presences${qs({ niveau })}`),
  reinitialiserPresencesJour: () => request('/admin/presences/aujourdhui', { method: 'DELETE' }),
};

export const directionApi = {
  statistiques: () => request('/direction/statistiques'),
  rapport: (mois) => request(`/direction/rapport${qs({ mois })}`),
  matieres: (niveau) => request(`/matieres${qs({ niveau })}`),
  creerMatiere: (body) => request('/matieres', { method: 'POST', body: json(body) }),
  majMatiere: (id, body) => request(`/matieres/${id}`, { method: 'PATCH', body: json(body) }),
  supprimerMatiere: (id) => request(`/matieres/${id}`, { method: 'DELETE' }),
  publications: () => request('/publications'),
  publier: (body) => request('/publications', { method: 'POST', body: json(body) }),
  supprimerPublication: (id) => request(`/publications/${id}`, { method: 'DELETE' }),
  bulletinsNiveau: (niveau) => request(`/admin/bulletins${qs({ niveau })}`),
  tarifs: () => request('/tarifs'),
  creerTarif: (body) => request('/tarifs', { method: 'POST', body: json(body) }),
  supprimerTarif: (id) => request(`/tarifs/${id}`, { method: 'DELETE' }),
  fraisDivers: () => request('/frais-divers'),
  creerFrais: (body) => request('/frais-divers', { method: 'POST', body: json(body) }),
  majFrais: (id, body) => request(`/frais-divers/${id}`, { method: 'PUT', body: json(body) }),
  supprimerFrais: (id) => request(`/frais-divers/${id}`, { method: 'DELETE' }),
  ecole: () => request('/ecole/coordonnees'),
  majEcole: (body) => request('/ecole', { method: 'PUT', body: json(body) }),
  televerserLogo: (fichier) => {
    const fd = new FormData();
    fd.append('logo', fichier);
    return request('/ecole/logo', { method: 'POST', body: fd });
  },
  supprimerLogo: () => request('/ecole/logo', { method: 'DELETE' }),
};

// Synchronisation — postes de bureau hors ligne (propriétaire) + état local.
export const syncApi = {
  noeuds: () => request('/poste/noeuds'),
  creerNoeud: (nom) => request('/poste/noeuds', { method: 'POST', body: json({ nom }) }),
  revoquerNoeud: (id) => request(`/poste/noeuds/${id}`, { method: 'DELETE' }),
  // État local (seulement quand on tourne sur un poste de bureau)
  etatPoste: () => request('/poste/sync'),
  synchroniserMaintenant: () => request('/poste/sync', { method: 'POST' }),
};

// Économat — système indépendant (propre authentification par courriel)
export const economatApi = {
  adminMe: () => request('/economat/admin/me'),
  adminLogin: (body) => request('/economat/admin/login', { method: 'POST', body: json(body) }),
  adminLogout: () => request('/economat/admin/logout', { method: 'POST' }),
  modifierCompte: (body) => request('/economat/admin/compte', { method: 'PATCH', body: json(body) }),
  niveaux: () => request('/economat/niveaux'),
};

// Vlog — système indépendant (propre authentification)
export const vlogApi = {
  publications: () => request('/vlog'),
  adminMe: () => request('/vlog/admin/me'),
  adminLogin: (body) => request('/vlog/admin/login', { method: 'POST', body: json(body) }),
  adminLogout: () => request('/vlog/admin/logout', { method: 'POST' }),
  modifierCompte: (body) => request('/vlog/admin/compte', { method: 'PATCH', body: json(body) }),
  creer: ({ titre, contenu, categorie, photo }) => {
    const fd = new FormData();
    fd.append('titre', titre);
    fd.append('contenu', contenu);
    fd.append('categorie', categorie);
    if (photo) fd.append('photo', photo);
    return request('/vlog', { method: 'POST', body: fd });
  },
  supprimer: (id) => request(`/vlog/${id}`, { method: 'DELETE' }),
  redactionIA: (body) => request('/vlog/redaction-ia', { method: 'POST', body: json(body) }),
};

// Corps enseignant — système indépendant (propre authentification)
function formDataProf({ nom, prenom, matiere, fonction, diplomes, experienceAnnees, parcours, photo }) {
  const fd = new FormData();
  const ajouter = (cle, val) => { if (val !== undefined && val !== null) fd.append(cle, val); };
  ajouter('nom', nom);
  ajouter('prenom', prenom);
  ajouter('matiere', matiere);
  ajouter('fonction', fonction);
  ajouter('diplomes', diplomes);
  ajouter('experienceAnnees', experienceAnnees);
  ajouter('parcours', parcours);
  if (photo) fd.append('photo', photo);
  return fd;
}

export const profsApi = {
  liste: () => request('/professeurs'),
  adminMe: () => request('/professeurs/admin/me'),
  adminLogin: (body) => request('/professeurs/admin/login', { method: 'POST', body: json(body) }),
  adminLogout: () => request('/professeurs/admin/logout', { method: 'POST' }),
  modifierCompte: (body) => request('/professeurs/admin/compte', { method: 'PATCH', body: json(body) }),
  creer: (data) => request('/professeurs', { method: 'POST', body: formDataProf(data) }),
  modifier: (id, data) => request(`/professeurs/${id}`, { method: 'PUT', body: formDataProf(data) }),
  supprimer: (id) => request(`/professeurs/${id}`, { method: 'DELETE' }),
  redactionIA: (body) => request('/professeurs/redaction-ia', { method: 'POST', body: json(body) }),
};

// Page « À propos » — système indépendant (propre authentification)
export const aproposApi = {
  sections: () => request('/apropos'),
  adminMe: () => request('/apropos/admin/me'),
  adminLogin: (body) => request('/apropos/admin/login', { method: 'POST', body: json(body) }),
  adminLogout: () => request('/apropos/admin/logout', { method: 'POST' }),
  modifierCompte: (body) => request('/apropos/admin/compte', { method: 'PATCH', body: json(body) }),
  redactionIA: (body) => request('/apropos/redaction-ia', { method: 'POST', body: json(body) }),
  creer: (body) => request('/apropos', { method: 'POST', body: json(body) }),
  modifier: (id, body) => request(`/apropos/${id}`, { method: 'PUT', body: json(body) }),
  supprimer: (id) => request(`/apropos/${id}`, { method: 'DELETE' }),
};

// Section « Académie » — système indépendant (propre authentification)
export const academieApi = {
  sections: (niveau) => request(`/academie${qs({ niveau })}`),
  adminMe: () => request('/academie/admin/me'),
  adminLogin: (body) => request('/academie/admin/login', { method: 'POST', body: json(body) }),
  adminLogout: () => request('/academie/admin/logout', { method: 'POST' }),
  modifierCompte: (body) => request('/academie/admin/compte', { method: 'PATCH', body: json(body) }),
  redactionIA: (body) => request('/academie/redaction-ia', { method: 'POST', body: json(body) }),
  creer: (body) => request('/academie', { method: 'POST', body: json(body) }),
  modifier: (id, body) => request(`/academie/${id}`, { method: 'PUT', body: json(body) }),
  supprimer: (id) => request(`/academie/${id}`, { method: 'DELETE' }),
};

// Examens passés — système indépendant (propre authentification)
export const examensApi = {
  lister: (niveau) => request(`/examens${qs({ niveau })}`),
  adminMe: () => request('/examens/admin/me'),
  adminLogin: (body) => request('/examens/admin/login', { method: 'POST', body: json(body) }),
  adminLogout: () => request('/examens/admin/logout', { method: 'POST' }),
  modifierCompte: (body) => request('/examens/admin/compte', { method: 'PATCH', body: json(body) }),
  creer: ({ niveau, titre, photo }) => {
    const fd = new FormData();
    fd.append('niveau', niveau);
    if (titre) fd.append('titre', titre);
    fd.append('photo', photo);
    return request('/examens', { method: 'POST', body: fd });
  },
  supprimer: (id) => request(`/examens/${id}`, { method: 'DELETE' }),
  aideIA: (body) => request('/examens/aide-ia', { method: 'POST', body: json(body) }),
};

export const permissionsApi = {
  lister: () => request('/permissions'),
  basculer: (cle, autorise) => request(`/permissions/${cle}`, { method: 'PATCH', body: json({ autorise }) }),
  modifierCompte: (body) => request('/mon-compte', { method: 'PATCH', body: json(body) }),
};

// Archive de documents anciens (Économat / Secrétariat / Direction)
export const archivesApi = {
  lister: (service) => request(`/archives${service ? `?service=${service}` : ''}`),
  televerser: (formData) => request('/archives', { method: 'POST', body: formData }),
  supprimer: (id) => request(`/archives/${id}`, { method: 'DELETE' }),
};
export const urlArchiveFichier = (id) => `${API_URL}/archives/${id}/fichier`;

// Import de données depuis un tableur (Excel/CSV) avec correspondance de colonnes
export const importApi = {
  champs: (type) => request(`/import/champs?type=${type}`),
  analyser: (formData) => request('/import/analyser', { method: 'POST', body: formData }),
  lancer: (type, payload) => request(`/import/${type}`, { method: 'POST', body: json(payload) }),
};

// Ré-inscription de fin d'année
export const reinscriptionApi = {
  etat: () => request('/reinscription/etat'),
  mesEnfants: () => request('/reinscription/mes-enfants'),
  reinscrire: (idEleve) => request('/reinscription', { method: 'POST', body: json({ idEleve }) }),
  // Propriétaire
  statutProprio: () => request('/proprietaire/reinscription'),
  lancer: () => request('/proprietaire/reinscription/lancer', { method: 'POST' }),
  cloturer: () => request('/proprietaire/reinscription/cloturer', { method: 'POST' }),
};

// Invitations élève — codes d'auto-inscription gérés par le personnel de l'école
export const invitationsApi = {
  lister: () => request('/invitations-eleve'),
  creer: (payload) => request('/invitations-eleve', { method: 'POST', body: json(payload) }),
  revoquer: (id) => request(`/invitations-eleve/${id}/revoquer`, { method: 'POST' }),
};

export const contactApi = {
  envoyer: (payload) => request('/contact', { method: 'POST', body: json(payload) }),
};

export const messagesApi = {
  lister: (statut) => request(`/proprietaire/messages${statut ? `?statut=${statut}` : ''}`),
  detail: (id) => request(`/proprietaire/messages/${id}`),
  reponseIa: (id) => request(`/proprietaire/messages/${id}/reponse-ia`, { method: 'POST' }),
  repondre: (id, reponse) => request(`/proprietaire/messages/${id}/repondre`, { method: 'POST', body: json({ reponse }) }),
};

export const annonceApi = {
  envoyerSms: (message) => request('/annonces/sms', { method: 'POST', body: json({ message }) }),
  envoyerCourriel: (payload) => request('/annonces/courriel', { method: 'POST', body: json(payload) }),
  redactionIa: (sujet) => request('/annonces/redaction-ia', { method: 'POST', body: json({ sujet }) }),
};

// Demande publique d'accès aux résultats (ancien élève, sans compte)
export const demandeAncienApi = {
  envoyer: (payload) => request('/anciens-eleves/demandes', { method: 'POST', body: json(payload) }),
};

// Gestion secrétariat/direction des dossiers d'anciens élèves
export const ancienEleveApi = {
  niveaux: () => request('/admin/niveaux'),
  lister: (recherche) => request(`/admin/anciens-eleves${qs({ recherche })}`),
  creer: (body) => request('/admin/anciens-eleves', { method: 'POST', body: json(body) }),
  majInfos: (id, body) => request(`/admin/anciens-eleves/${id}`, { method: 'PATCH', body: json(body) }),
  notes: (id) => request(`/admin/anciens-eleves/${id}/notes`),
  ajouterNotes: (id, body) => request(`/admin/anciens-eleves/${id}/notes`, { method: 'POST', body: json(body) }),
  genererBulletin: (id, body) => request(`/admin/anciens-eleves/${id}/bulletins`, { method: 'POST', body: json(body) }),
  demandes: (statut) => request(`/admin/anciens-eleves/demandes${qs({ statut })}`),
  approuverDemande: (id, idEleve) => request(`/admin/anciens-eleves/demandes/${id}/approuver`, { method: 'POST', body: json({ idEleve }) }),
  refuserDemande: (id, motif) => request(`/admin/anciens-eleves/demandes/${id}/refuser`, { method: 'POST', body: json({ motif }) }),
};

// URLs directes de fichiers (téléchargement via navigation — le cookie de session est envoyé)
export const urlDocumentSoumis = (id) => `${API_URL}/documents-soumis/${id}/fichier`;
export const urlDocumentOfficiel = (id) => `${API_URL}/documents-officiels/${id}/fichier`;
export const urlPreuvePaiement = (id) => `${API_URL}/paiements/${id}/preuve`;
export const urlPhotoEleve = () => `${API_URL}/eleve/photo`;
export const urlPhotoEleveAdmin = (id) => `${API_URL}/admin/eleves/${id}/photo`;
export const urlLogoEcole = () => `${API_URL}/ecole/logo`;
export const urlRapportExport = (mois) => `${API_URL}/direction/rapport/export${qs({ mois })}`;
export const urlPhotoVlog = (id) => `${API_URL}/vlog/${id}/photo`;
export const urlPhotoProf = (id) => `${API_URL}/professeurs/${id}/photo`;
export const urlPhotoExamen = (id) => `${API_URL}/examens/${id}/photo`;
export const urlDocumentCours = (id) => `${API_URL}/documents-cours/${id}/fichier`;

// Marque de l'école (nom + présence d'un logo) — endpoint public utilisé par
// l'en-tête du site public et la barre latérale de l'espace connecté.
export const marqueApi = {
  obtenir: () => request('/ecole/marque'),
};

export { request, API_URL };
