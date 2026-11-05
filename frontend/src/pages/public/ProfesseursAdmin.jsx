import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { profsApi } from '../../services/api.js';
import { nomComplet, experienceLibelle, AvatarProf } from './Professeurs.jsx';
import Alerte from '../../components/Alerte.jsx';
import Chargement from '../../components/Chargement.jsx';
import Icone from '../../components/Icone.jsx';
import ModaleCompteAdmin from '../../components/ModaleCompteAdmin.jsx';

// Assistant IA : rédige le parcours (biographie) à partir des infos déjà
// saisies dans le formulaire + quelques éléments libres.
function AssistantIA({ valeurs, setV }) {
  const [elements, setElements] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState('');

  const generer = async () => {
    setErreur('');
    if (!valeurs.nom.trim()) { setErreur('Renseignez au moins le nom avant de générer.'); return; }
    setEnCours(true);
    try {
      const { parcours } = await profsApi.redactionIA({
        nom: valeurs.nom.trim(), prenom: valeurs.prenom.trim(),
        matiere: valeurs.matiere.trim(), fonction: valeurs.fonction.trim(),
        diplomes: valeurs.diplomes.trim(), experienceAnnees: valeurs.experienceAnnees,
        elements: elements.trim(),
      });
      setV((f) => ({ ...f, parcours }));
    } catch (err) { setErreur(err.message); }
    finally { setEnCours(false); }
  };

  return (
    <div className="vadm-ia">
      <div className="vadm-ia-titre"><Icone nom="comment" /> Assistant IA</div>
      {erreur && <Alerte type="erreur">{erreur}</Alerte>}
      <textarea rows={2} value={elements} onChange={(e) => setElements(e.target.value)}
        placeholder="Éléments à mentionner (optionnel) : établissements précédents, spécialités, réalisations…" />
      <button type="button" className="vadm-ia-btn" onClick={generer} disabled={enCours}>
        {enCours ? 'Génération…' : 'Générer le parcours avec l\'IA'}
      </button>
      <p className="vadm-info">
        Utilise le nom, la matière, la fonction, les diplômes et l'expérience déjà saisis ci-dessus.
        L'IA remplit le champ « Parcours » plus bas. Relisez toujours avant d'enregistrer.
      </p>
    </div>
  );
}

const FICHE_VIDE = {
  nom: '', prenom: '', matiere: '', fonction: '',
  diplomes: '', experienceAnnees: '', parcours: '', photo: null,
};

// Minuterie partagée pour la déconnexion automatique en quittant la page.
let minuterieDeconnexionProfs = null;

export default function ProfesseursAdmin() {
  const [admin, setAdmin] = useState(null);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    profsApi.adminMe()
      .then((d) => setAdmin(d.admin))
      .catch(() => setAdmin(null))
      .finally(() => setChargement(false));
  }, []);

  if (chargement) return <div className="site-page"><p className="texte-gris">Chargement…</p></div>;

  return admin
    ? <PanneauAdmin admin={admin} onAdminMaj={setAdmin} onLogout={() => setAdmin(null)} />
    : <FormLogin onConnecte={setAdmin} />;
}

// ---------- Connexion admin enseignants ----------
function FormLogin({ onConnecte }) {
  const [form, setForm] = useState({ identifiant: '', motDePasse: '' });
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);

  const maj = (champ) => (e) => setForm({ ...form, [champ]: e.target.value });

  const soumettre = async (e) => {
    e.preventDefault();
    setErreur(''); setEnCours(true);
    try {
      const d = await profsApi.adminLogin(form);
      onConnecte(d.admin);
    } catch (err) { setErreur(err.message); }
    finally { setEnCours(false); }
  };

  return (
    <div className="vadm-page vadm-login">
      <header className="vadm-entete-simple">
        <h1>Espace administrateur — Enseignants</h1>
        <p className="texte-gris">Connectez-vous pour gérer les fiches du corps enseignant.</p>
      </header>
      <div className="carte vadm-login-carte">
        <form onSubmit={soumettre}>
          {erreur && <Alerte type="erreur">{erreur}</Alerte>}
          <div className="vadm-champ">
            <label htmlFor="profa-identifiant">Identifiant</label>
            <input id="profa-identifiant" value={form.identifiant} onChange={maj('identifiant')} required autoComplete="username" />
          </div>
          <div className="vadm-champ">
            <label htmlFor="profa-mdp">Mot de passe</label>
            <input id="profa-mdp" type="password" value={form.motDePasse} onChange={maj('motDePasse')} required autoComplete="current-password" />
          </div>
          <button type="submit" className="vadm-login-btn" disabled={enCours}>{enCours ? 'Connexion…' : 'Se connecter'}</button>
        </form>
      </div>
      <p className="vadm-retour"><Link to="/professeurs" className="texte-gris">← Retour au corps enseignant</Link></p>
    </div>
  );
}

// Champs partagés (création + modification)
function ChampsFiche({ valeurs, setV, modeEdition }) {
  const maj = (champ) => (e) => setV({ ...valeurs, [champ]: e.target.value });
  const majPhoto = (e) => setV({ ...valeurs, photo: e.target.files[0] || null });
  return (
    <>
      <div className="ens-form-grille">
        <div className="vadm-champ"><label htmlFor="profa-nom">Nom</label>
          <input id="profa-nom" value={valeurs.nom} onChange={maj('nom')} placeholder="Ex. Pierre" /></div>
        <div className="vadm-champ"><label htmlFor="profa-prenom">Prénom</label>
          <input id="profa-prenom" value={valeurs.prenom} onChange={maj('prenom')} placeholder="Ex. Marie" /></div>
        <div className="vadm-champ"><label htmlFor="profa-matiere">Matière / discipline</label>
          <input id="profa-matiere" value={valeurs.matiere} onChange={maj('matiere')} placeholder="Ex. Mathématiques" /></div>
        <div className="vadm-champ"><label htmlFor="profa-fonction">Fonction / titre</label>
          <input id="profa-fonction" value={valeurs.fonction} onChange={maj('fonction')} placeholder="Ex. Professeur titulaire" /></div>
        <div className="vadm-champ"><label htmlFor="profa-experience">Années d'expérience</label>
          <input id="profa-experience" type="number" min="0" value={valeurs.experienceAnnees} onChange={maj('experienceAnnees')} placeholder="Ex. 8" /></div>
        <div className="vadm-champ"><label>{modeEdition ? 'Nouvelle photo (opt.)' : 'Photo (optionnel)'}</label>
          <div className="vadm-fichier">
            <label className="vadm-fichier-btn">Choisir un fichier
              <input type="file" accept="image/png,image/jpeg" onChange={majPhoto} hidden /></label>
            <span className="vadm-fichier-nom">{valeurs.photo ? valeurs.photo.name : 'Aucun fichier'}</span>
          </div>
        </div>
      </div>
      <div className="vadm-champ"><label htmlFor="profa-diplomes">Formation &amp; diplômes</label>
        <textarea id="profa-diplomes" rows={2} value={valeurs.diplomes} onChange={maj('diplomes')}
          placeholder="Ex. Licence en sciences de l'éducation, Université d'État d'Haïti" /></div>

      <AssistantIA valeurs={valeurs} setV={setV} />

      <div className="vadm-champ"><label htmlFor="profa-parcours">Parcours (biographie)</label>
        <textarea id="profa-parcours" rows={3} value={valeurs.parcours} onChange={maj('parcours')}
          placeholder="Décrivez le parcours professionnel, les établissements, les réalisations…" /></div>
    </>
  );
}

function donneesDe(f) {
  return {
    nom: f.nom.trim(), prenom: f.prenom.trim(), matiere: f.matiere.trim(), fonction: f.fonction.trim(),
    diplomes: f.diplomes.trim(),
    experienceAnnees: f.experienceAnnees === '' ? '' : String(f.experienceAnnees).trim(),
    parcours: f.parcours.trim(), photo: f.photo,
  };
}

// ---------- Panneau de gestion ----------
function PanneauAdmin({ admin, onAdminMaj, onLogout }) {
  const [professeurs, setProfesseurs] = useState(null); // null = chargement
  const [form, setForm] = useState(FICHE_VIDE);
  const [erreur, setErreur] = useState('');
  const [msg, setMsg] = useState('');
  const [enCours, setEnCours] = useState(false);

  const [edition, setEdition] = useState(null);        // prof en modification (modal)
  const [editForm, setEditForm] = useState(FICHE_VIDE);
  const [suppression, setSuppression] = useState(null); // prof à supprimer
  const [modalEnCours, setModalEnCours] = useState(false);
  const [erreurModal, setErreurModal] = useState('');
  const [compteOuvert, setCompteOuvert] = useState(false);

  const charger = () => profsApi.liste().then((d) => setProfesseurs(d.professeurs)).catch((e) => setErreur(e.message));
  useEffect(() => { charger(); }, []);

  // Déconnexion automatique dès qu'on quitte la page d'administration.
  useEffect(() => {
    if (minuterieDeconnexionProfs) { clearTimeout(minuterieDeconnexionProfs); minuterieDeconnexionProfs = null; }
    return () => {
      minuterieDeconnexionProfs = setTimeout(() => {
        profsApi.adminLogout().catch(() => {});
        minuterieDeconnexionProfs = null;
      }, 100);
    };
  }, []);

  const ajouter = async (e) => {
    e.preventDefault();
    setErreur(''); setMsg('');
    if (!form.nom.trim()) { setErreur('Le nom est requis.'); return; }
    setEnCours(true);
    try {
      await profsApi.creer(donneesDe(form));
      setMsg('Professeur ajouté.'); setForm(FICHE_VIDE);
      charger();
    } catch (err) { setErreur(err.message); }
    finally { setEnCours(false); }
  };

  const ouvrirEdition = (p) => {
    setEdition(p);
    setEditForm({
      nom: p.nom || '', prenom: p.prenom || '', matiere: p.matiere || '', fonction: p.fonction || '',
      diplomes: p.diplomes || '', experienceAnnees: p.experience_annees ?? '', parcours: p.parcours || '', photo: null,
    });
    setErreurModal('');
  };

  const enregistrerEdition = async () => {
    setErreurModal('');
    if (!editForm.nom.trim()) { setErreurModal('Le nom est requis.'); return; }
    setModalEnCours(true);
    try {
      await profsApi.modifier(edition.id, donneesDe(editForm));
      setEdition(null); setMsg('Fiche mise à jour.'); charger();
    } catch (err) { setErreurModal(err.message); }
    finally { setModalEnCours(false); }
  };

  const confirmerSuppression = async () => {
    setModalEnCours(true); setErreurModal('');
    try {
      await profsApi.supprimer(suppression.id);
      setSuppression(null); setMsg('Fiche supprimée.'); charger();
    } catch (err) { setErreurModal(err.message); }
    finally { setModalEnCours(false); }
  };

  const seDeconnecter = async () => {
    try { await profsApi.adminLogout(); } finally { onLogout(); }
  };

  const initiale = (admin.identifiant || '?').charAt(0).toUpperCase();
  const liste = professeurs || [];

  return (
    <div className="vadm-page">
      <header className="vadm-entete">
        <div>
          <h1>Espace administrateur — Enseignants</h1>
          <p className="texte-gris">Créez et gérez les fiches du corps enseignant.</p>
        </div>
        <div className="vadm-user">
          <div className="vadm-avatar" aria-hidden="true">{initiale}</div>
          <div className="vadm-user-info">
            <span className="vadm-user-nom">{admin.identifiant}</span>
            <span className="vadm-user-sous">Connecté</span>
          </div>
          <button type="button" className="insc-btn-reinit" onClick={() => setCompteOuvert(true)}>Mon compte</button>
          <button type="button" className="vadm-deco" onClick={seDeconnecter}>Se déconnecter</button>
        </div>
      </header>

      <div className="ens-admin-grille">
        {/* Formulaire */}
        <section className="carte">
          <div className="ens-carte-titre"><Icone nom="edit" /> Nouvelle fiche professeur</div>
          {erreur && <Alerte type="erreur">{erreur}</Alerte>}
          {msg && <Alerte type="info">{msg}</Alerte>}
          <form onSubmit={ajouter}>
            <ChampsFiche valeurs={form} setV={setForm} modeEdition={false} />
            <button type="submit" className="eco-batch-btn eco-batch-ok" style={{ width: '100%' }} disabled={enCours}>
              {enCours ? 'Ajout…' : 'Ajouter'}
            </button>
          </form>
        </section>

        {/* Liste */}
        <section className="carte">
          <div className="ens-carte-titre"><Icone nom="users" /> Professeurs ({liste.length})</div>
          {!professeurs ? (
            <Chargement texte="Chargement des professeurs…" />
          ) : liste.length === 0 ? (
            <div className="insc-vide" style={{ boxShadow: 'none' }}>
              <div className="insc-vide-ico" aria-hidden="true"><Icone nom="inbox" size={44} /></div>
              <p>Aucune fiche pour le moment.</p>
            </div>
          ) : (
            <div className="prof-admin-liste">
              {liste.map((p) => (
                <article key={p.id} className="prof-admin-item">
                  <AvatarProf prof={p} classe="prof-photo-sm" />
                  <div className="prof-admin-infos">
                    <h3 className="prof-nom">{nomComplet(p)}</h3>
                    <p>{[p.matiere, p.fonction, experienceLibelle(p.experience_annees)].filter(Boolean).join(' · ') || '—'}</p>
                  </div>
                  <div className="prof-admin-actions">
                    <button type="button" className="mat-modifier" onClick={() => ouvrirEdition(p)}>Modifier</button>
                    <button type="button" className="paie-btn paie-rejeter" onClick={() => { setSuppression(p); setErreurModal(''); }}>Supprimer</button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      <footer className="vadm-pied">© {new Date().getFullYear()} Lekòl Pam. Tous droits réservés.</footer>

      {/* Modale : modifier */}
      {edition && (
        <div className="prof-modal-fond" onClick={() => !modalEnCours && setEdition(null)}>
          <div className="prof-modal carte" role="dialog" aria-modal="true" onClick={(ev) => ev.stopPropagation()} style={{ maxWidth: 640 }}>
            <button type="button" className="prof-modal-fermer" onClick={() => setEdition(null)} aria-label="Fermer">×</button>
            <h2 style={{ marginBottom: '1rem' }}>Modifier la fiche — {nomComplet(edition)}</h2>
            {erreurModal && <Alerte type="erreur">{erreurModal}</Alerte>}
            <ChampsFiche valeurs={editForm} setV={setEditForm} modeEdition />
            <div className="badges-actions" style={{ justifyContent: 'flex-end' }}>
              <button type="button" className="insc-btn-reinit" onClick={() => setEdition(null)} disabled={modalEnCours}>Annuler</button>
              <button type="button" className="mat-modifier" onClick={enregistrerEdition} disabled={modalEnCours}>
                {modalEnCours ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modale : supprimer */}
      {suppression && (
        <div className="prof-modal-fond" onClick={() => !modalEnCours && setSuppression(null)}>
          <div className="prof-modal carte" role="dialog" aria-modal="true" onClick={(ev) => ev.stopPropagation()}>
            <button type="button" className="prof-modal-fermer" onClick={() => setSuppression(null)} aria-label="Fermer">×</button>
            <h2 style={{ marginBottom: '.75rem' }}>Supprimer la fiche</h2>
            <p style={{ color: '#4A5568', marginBottom: '1.25rem' }}>
              Voulez-vous vraiment supprimer <strong>{nomComplet(suppression)}</strong> ?
            </p>
            {erreurModal && <Alerte type="erreur">{erreurModal}</Alerte>}
            <div className="badges-actions" style={{ justifyContent: 'flex-end' }}>
              <button type="button" className="insc-btn-reinit" onClick={() => setSuppression(null)} disabled={modalEnCours}>Annuler</button>
              <button type="button" className="paie-btn paie-rejeter" onClick={confirmerSuppression} disabled={modalEnCours}>
                {modalEnCours ? 'Suppression…' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {compteOuvert && (
        <ModaleCompteAdmin identifiantActuel={admin.identifiant} onSoumettre={profsApi.modifierCompte}
          onFermer={() => setCompteOuvert(false)}
          onMaj={(identifiant) => { onAdminMaj({ ...admin, identifiant }); setCompteOuvert(false); }} />
      )}
    </div>
  );
}
