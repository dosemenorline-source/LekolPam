import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { examensApi, urlPhotoExamen } from '../../services/api.js';
import { dateFr } from '../../utils/libelles.js';
import Alerte from '../../components/Alerte.jsx';
import Chargement from '../../components/Chargement.jsx';
import Icone from '../../components/Icone.jsx';
import ModaleCompteAdmin from '../../components/ModaleCompteAdmin.jsx';

const VIDE = { niveau: '', titre: '', photo: null };

let minuterieDeconnexionExamens = null;

export default function ExamensAdmin() {
  const [admin, setAdmin] = useState(null);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    examensApi.adminMe()
      .then((d) => setAdmin(d.admin))
      .catch(() => setAdmin(null))
      .finally(() => setChargement(false));
  }, []);

  if (chargement) return <div className="site-page"><p className="texte-gris">Chargement…</p></div>;

  return admin
    ? <PanneauAdmin admin={admin} onAdminMaj={setAdmin} onLogout={() => setAdmin(null)} />
    : <FormLogin onConnecte={setAdmin} />;
}

// ---------- Connexion ----------
function FormLogin({ onConnecte }) {
  const [form, setForm] = useState({ identifiant: '', motDePasse: '' });
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);

  const maj = (champ) => (e) => setForm({ ...form, [champ]: e.target.value });

  const soumettre = async (e) => {
    e.preventDefault();
    setErreur(''); setEnCours(true);
    try {
      const d = await examensApi.adminLogin(form);
      onConnecte(d.admin);
    } catch (err) { setErreur(err.message); }
    finally { setEnCours(false); }
  };

  return (
    <div className="vadm-page vadm-login">
      <header className="vadm-entete-simple">
        <h1>Espace administrateur — Examens passés</h1>
        <p className="texte-gris">Connectez-vous pour gérer les feuilles d'examen.</p>
      </header>
      <div className="carte vadm-login-carte">
        <form onSubmit={soumettre}>
          {erreur && <Alerte type="erreur">{erreur}</Alerte>}
          <div className="vadm-champ">
            <label htmlFor="exama-identifiant">Identifiant</label>
            <input id="exama-identifiant" value={form.identifiant} onChange={maj('identifiant')} required autoComplete="username" />
          </div>
          <div className="vadm-champ">
            <label htmlFor="exama-mdp">Mot de passe</label>
            <input id="exama-mdp" type="password" value={form.motDePasse} onChange={maj('motDePasse')} required autoComplete="current-password" />
          </div>
          <button type="submit" className="vadm-login-btn" disabled={enCours}>{enCours ? 'Connexion…' : 'Se connecter'}</button>
        </form>
      </div>
      <p className="vadm-retour"><Link to="/examens" className="texte-gris">← Retour aux examens</Link></p>
    </div>
  );
}

// ---------- Panneau de gestion ----------
function PanneauAdmin({ admin, onAdminMaj, onLogout }) {
  const [examens, setExamens] = useState(null);
  const [form, setForm] = useState(VIDE);
  const [erreur, setErreur] = useState('');
  const [msg, setMsg] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [suppression, setSuppression] = useState(null);
  const [suppEnCours, setSuppEnCours] = useState(false);
  const [compteOuvert, setCompteOuvert] = useState(false);

  const charger = () => examensApi.lister().then((d) => setExamens(d.examens)).catch((e) => setErreur(e.message));
  useEffect(() => { charger(); }, []);

  useEffect(() => {
    if (minuterieDeconnexionExamens) { clearTimeout(minuterieDeconnexionExamens); minuterieDeconnexionExamens = null; }
    return () => {
      minuterieDeconnexionExamens = setTimeout(() => {
        examensApi.adminLogout().catch(() => {});
        minuterieDeconnexionExamens = null;
      }, 100);
    };
  }, []);

  const maj = (champ) => (e) => setForm({ ...form, [champ]: e.target.value });
  const majPhoto = (e) => setForm({ ...form, photo: e.target.files[0] || null });

  const publier = async (e) => {
    e.preventDefault();
    setErreur(''); setMsg('');
    if (!form.niveau.trim()) { setErreur('Le niveau / la classe est requis.'); return; }
    if (!form.photo) { setErreur('Veuillez choisir une photo de la feuille d\'examen.'); return; }
    setEnCours(true);
    try {
      await examensApi.creer({ niveau: form.niveau.trim(), titre: form.titre.trim(), photo: form.photo });
      setMsg('Feuille d\'examen publiée.');
      setForm(VIDE);
      e.target.reset();
      charger();
    } catch (err) { setErreur(err.message); }
    finally { setEnCours(false); }
  };

  const confirmerSuppression = async () => {
    setSuppEnCours(true); setErreur(''); setMsg('');
    try {
      await examensApi.supprimer(suppression.id);
      setMsg('Feuille d\'examen supprimée.');
      setSuppression(null);
      charger();
    } catch (err) { setErreur(err.message); }
    finally { setSuppEnCours(false); }
  };

  const seDeconnecter = async () => {
    try { await examensApi.adminLogout(); } finally { onLogout(); }
  };

  const niveaux = useMemo(() => (examens ? [...new Set(examens.map((e) => e.niveau))].sort() : []), [examens]);
  const initiale = (admin.identifiant || '?').charAt(0).toUpperCase();

  return (
    <div className="vadm-page">
      <header className="vadm-entete">
        <div>
          <h1>Espace administrateur — Examens passés</h1>
          <p className="texte-gris">Téléversez les feuilles d'examen, classées par niveau.</p>
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

      <div className="vadm-grille">
        {/* Formulaire */}
        <section className="carte vadm-form-carte">
          <div className="vadm-carte-titre"><Icone nom="plus" /> Nouvelle feuille d'examen</div>
          {erreur && <Alerte type="erreur">{erreur}</Alerte>}
          {msg && <Alerte type="info">{msg}</Alerte>}

          <form onSubmit={publier}>
            <div className="vadm-champ">
              <label htmlFor="exama-niveau">Niveau / Classe</label>
              <input id="exama-niveau" value={form.niveau} onChange={maj('niveau')} placeholder="ex. 9e AF, NS4, Philo" list="exam-niveaux" />
              <datalist id="exam-niveaux">
                {niveaux.map((n) => <option key={n} value={n} />)}
              </datalist>
            </div>
            <div className="vadm-champ">
              <label htmlFor="exama-titre">Titre / Description (optionnel)</label>
              <input id="exama-titre" value={form.titre} onChange={maj('titre')} placeholder="ex. Mathématiques — 3e trimestre 2024" />
            </div>
            <div className="vadm-champ">
              <label><Icone nom="attach" /> Photo de la feuille d'examen</label>
              <div className="vadm-fichier">
                <label className="vadm-fichier-btn">
                  Choisir un fichier
                  <input type="file" accept="image/png,image/jpeg" onChange={majPhoto} hidden />
                </label>
                <span className="vadm-fichier-nom">{form.photo ? form.photo.name : 'Aucun fichier choisi'}</span>
              </div>
              <p className="vadm-info">JPG ou PNG, max 5 Mo.</p>
            </div>
            <button type="submit" className="eco-batch-btn eco-batch-ok vadm-publier" disabled={enCours}>
              {enCours ? 'Publication…' : 'Publier'}
            </button>
          </form>
        </section>

        {/* Liste */}
        <section className="carte vadm-liste-carte">
          <div className="vadm-carte-titre"><Icone nom="clipboard" /> Feuilles publiées</div>
          {!examens ? (
            <Chargement texte="Chargement…" />
          ) : examens.length === 0 ? (
            <div className="insc-vide" style={{ boxShadow: 'none' }}>
              <div className="insc-vide-ico" aria-hidden="true"><Icone nom="inbox" size={44} /></div>
              <p>Aucune feuille d'examen pour le moment.</p>
            </div>
          ) : (
            <div className="examens-admin-liste">
              {examens.map((ex) => (
                <article key={ex.id} className="examens-admin-item">
                  <img src={urlPhotoExamen(ex.id)} alt={ex.titre || ex.niveau} loading="lazy" />
                  <div className="examens-admin-item-info">
                    <span className="vadm-cat vadm-cat-actualite">{ex.niveau}</span>
                    {ex.titre && <p className="examens-admin-item-titre">{ex.titre}</p>}
                    <span className="vadm-item-date">{dateFr(ex.cree_le)}</span>
                  </div>
                  <button type="button" className="paie-btn paie-rejeter" onClick={() => setSuppression(ex)}>
                    <Icone nom="trash" /> Supprimer
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      <footer className="vadm-pied">© {new Date().getFullYear()} Lekòl Pam. Tous droits réservés.</footer>

      {/* Modale de confirmation */}
      {suppression && (
        <div className="prof-modal-fond" onClick={() => !suppEnCours && setSuppression(null)}>
          <div className="prof-modal carte" role="dialog" aria-modal="true" onClick={(ev) => ev.stopPropagation()}>
            <button type="button" className="prof-modal-fermer" onClick={() => setSuppression(null)} aria-label="Fermer">×</button>
            <h2 style={{ marginBottom: '.75rem' }}>Supprimer la feuille</h2>
            <p style={{ color: '#4A5568', marginBottom: '1.25rem' }}>
              Voulez-vous vraiment supprimer cette feuille d'examen ({suppression.niveau}) ?
            </p>
            <div className="badges-actions" style={{ justifyContent: 'flex-end' }}>
              <button type="button" className="insc-btn-reinit" onClick={() => setSuppression(null)} disabled={suppEnCours}>Annuler</button>
              <button type="button" className="paie-btn paie-rejeter" onClick={confirmerSuppression} disabled={suppEnCours}>
                {suppEnCours ? 'Suppression…' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {compteOuvert && (
        <ModaleCompteAdmin identifiantActuel={admin.identifiant} onSoumettre={examensApi.modifierCompte}
          onFermer={() => setCompteOuvert(false)}
          onMaj={(identifiant) => { onAdminMaj({ ...admin, identifiant }); setCompteOuvert(false); }} />
      )}
    </div>
  );
}
