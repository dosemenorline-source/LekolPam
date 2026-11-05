import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { aproposApi } from '../../services/api.js';
import { dateFr } from '../../utils/libelles.js';
import Alerte from '../../components/Alerte.jsx';
import Chargement from '../../components/Chargement.jsx';
import Icone from '../../components/Icone.jsx';
import ModaleCompteAdmin from '../../components/ModaleCompteAdmin.jsx';

const SECTION_VIDE = { titre: '', contenu: '', ordre: '' };

// Minuterie partagée pour la déconnexion automatique en quittant la page.
let minuterieDeconnexionApropos = null;

export default function AProposAdmin() {
  const [admin, setAdmin] = useState(null);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    aproposApi.adminMe()
      .then((d) => setAdmin(d.admin))
      .catch(() => setAdmin(null))
      .finally(() => setChargement(false));
  }, []);

  if (chargement) return <div className="site-page"><p className="texte-gris">Chargement…</p></div>;

  return admin
    ? <PanneauAdmin admin={admin} onAdminMaj={setAdmin} onLogout={() => setAdmin(null)} />
    : <FormLogin onConnecte={setAdmin} />;
}

// ---------- Connexion admin À propos ----------
function FormLogin({ onConnecte }) {
  const [form, setForm] = useState({ identifiant: '', motDePasse: '' });
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);

  const maj = (champ) => (e) => setForm({ ...form, [champ]: e.target.value });

  const soumettre = async (e) => {
    e.preventDefault();
    setErreur(''); setEnCours(true);
    try {
      const d = await aproposApi.adminLogin(form);
      onConnecte(d.admin);
    } catch (err) { setErreur(err.message); }
    finally { setEnCours(false); }
  };

  return (
    <div className="vadm-page vadm-login">
      <header className="vadm-entete-simple">
        <h1>Espace administrateur — À propos</h1>
        <p className="texte-gris">Connectez-vous pour gérer le contenu de la page À propos.</p>
      </header>
      <div className="carte vadm-login-carte">
        <form onSubmit={soumettre}>
          {erreur && <Alerte type="erreur">{erreur}</Alerte>}
          <div className="vadm-champ">
            <label htmlFor="apropa-identifiant">Identifiant</label>
            <input id="apropa-identifiant" value={form.identifiant} onChange={maj('identifiant')} required autoComplete="username" />
          </div>
          <div className="vadm-champ">
            <label htmlFor="apropa-mdp">Mot de passe</label>
            <input id="apropa-mdp" type="password" value={form.motDePasse} onChange={maj('motDePasse')} required autoComplete="current-password" />
          </div>
          <button type="submit" className="vadm-login-btn" disabled={enCours}>{enCours ? 'Connexion…' : 'Se connecter'}</button>
        </form>
      </div>
      <p className="vadm-retour"><Link to="/a-propos" className="texte-gris">← Retour à la page À propos</Link></p>
    </div>
  );
}

// ---------- Panneau de gestion ----------
function PanneauAdmin({ admin, onAdminMaj, onLogout }) {
  const [sections, setSections] = useState(null); // null = chargement
  const [form, setForm] = useState(SECTION_VIDE);
  const [editionId, setEditionId] = useState(null); // id en cours de modification (null = création)
  const [erreur, setErreur] = useState('');
  const [msg, setMsg] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [suppression, setSuppression] = useState(null);
  const [suppEnCours, setSuppEnCours] = useState(false);
  const [compteOuvert, setCompteOuvert] = useState(false);
  const [sujetIA, setSujetIA] = useState('');
  const [iaEnCours, setIaEnCours] = useState(false);
  const [erreurIA, setErreurIA] = useState('');

  const charger = () => aproposApi.sections().then((d) => setSections(d.sections)).catch((e) => setErreur(e.message));
  useEffect(() => { charger(); }, []);

  // Déconnexion automatique dès qu'on quitte la page d'administration.
  useEffect(() => {
    if (minuterieDeconnexionApropos) { clearTimeout(minuterieDeconnexionApropos); minuterieDeconnexionApropos = null; }
    return () => {
      minuterieDeconnexionApropos = setTimeout(() => {
        aproposApi.adminLogout().catch(() => {});
        minuterieDeconnexionApropos = null;
      }, 100);
    };
  }, []);

  const maj = (champ) => (e) => setForm({ ...form, [champ]: e.target.value });

  const reinitialiser = () => { setForm(SECTION_VIDE); setEditionId(null); };

  const commencerEdition = (s) => {
    setEditionId(s.id);
    setForm({ titre: s.titre, contenu: s.contenu, ordre: String(s.ordre ?? '') });
    setMsg(''); setErreur('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const soumettre = async (e) => {
    e.preventDefault();
    setErreur(''); setMsg('');
    if (!form.titre.trim()) { setErreur('Le titre est requis.'); return; }
    if (!form.contenu.trim()) { setErreur('Le contenu est requis.'); return; }
    setEnCours(true);
    try {
      const corps = {
        titre: form.titre.trim(),
        contenu: form.contenu.trim(),
        ...(form.ordre !== '' ? { ordre: Number(form.ordre) } : {}),
      };
      if (editionId) {
        await aproposApi.modifier(editionId, corps);
        setMsg('Section mise à jour.');
      } else {
        await aproposApi.creer(corps);
        setMsg('Section publiée.');
      }
      reinitialiser();
      charger();
    } catch (err) { setErreur(err.message); }
    finally { setEnCours(false); }
  };

  const confirmerSuppression = async () => {
    setSuppEnCours(true); setErreur(''); setMsg('');
    try {
      await aproposApi.supprimer(suppression.id);
      setMsg('Section supprimée.');
      if (editionId === suppression.id) reinitialiser();
      setSuppression(null);
      charger();
    } catch (err) { setErreur(err.message); }
    finally { setSuppEnCours(false); }
  };

  // Assistant IA : rédige un brouillon (titre + contenu) à partir d'une idée.
  const genererIA = async () => {
    setErreurIA(''); setMsg('');
    if (!sujetIA.trim()) { setErreurIA('Décrivez le sujet à rédiger.'); return; }
    setIaEnCours(true);
    try {
      const d = await aproposApi.redactionIA({ sujet: sujetIA.trim() });
      setForm((f) => ({ ...f, titre: d.titre || f.titre, contenu: d.contenu || f.contenu }));
      setMsg('Brouillon généré par l\'IA. Relisez et ajustez avant de publier.');
    } catch (err) { setErreurIA(err.message); }
    finally { setIaEnCours(false); }
  };

  const seDeconnecter = async () => {
    try { await aproposApi.adminLogout(); } finally { onLogout(); }
  };

  const initiale = (admin.identifiant || '?').charAt(0).toUpperCase();

  return (
    <div className="vadm-page">
      <header className="vadm-entete">
        <div>
          <h1>Espace administrateur — À propos</h1>
          <p className="texte-gris">Publiez et organisez les sections de la page À propos.</p>
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
          <div className="vadm-carte-titre">
            <Icone nom={editionId ? 'edit' : 'plus'} /> {editionId ? 'Modifier la section' : 'Nouvelle section'}
          </div>
          {erreur && <Alerte type="erreur">{erreur}</Alerte>}
          {msg && <Alerte type="info">{msg}</Alerte>}

          {/* Assistant IA — rédige un brouillon à partir d'une idée */}
          <div className="vadm-ia">
            <div className="vadm-ia-titre"><Icone nom="comment" /> Assistant IA</div>
            {erreurIA && <Alerte type="erreur">{erreurIA}</Alerte>}
            <textarea rows={2} value={sujetIA} onChange={(e) => setSujetIA(e.target.value)}
              placeholder="Décrivez l'idée en quelques mots (ex. notre histoire depuis 2010, notre approche pédagogique)…" />
            <button type="button" className="vadm-ia-btn" onClick={genererIA} disabled={iaEnCours}>
              {iaEnCours ? 'Génération…' : 'Générer avec l\'IA'}
            </button>
            <p className="vadm-info">L'IA remplit le titre et le contenu ci-dessous. Relisez toujours avant de publier.</p>
          </div>

          <form onSubmit={soumettre}>
            <div className="vadm-champ">
              <label htmlFor="apropa-titre">Titre</label>
              <input id="apropa-titre" value={form.titre} onChange={maj('titre')} placeholder="Ex. Notre mission" />
            </div>
            <div className="vadm-champ">
              <label htmlFor="apropa-contenu">Contenu</label>
              <textarea id="apropa-contenu" rows={6} value={form.contenu} onChange={maj('contenu')}
                placeholder="Rédigez le texte de cette section…" />
            </div>
            <div className="vadm-champ">
              <label htmlFor="apropa-ordre">Ordre d'affichage (optionnel)</label>
              <input id="apropa-ordre" type="number" min="0" value={form.ordre} onChange={maj('ordre')}
                placeholder="Laisser vide = à la fin" />
              <p className="vadm-info">Plus le nombre est petit, plus la section apparaît haut.</p>
            </div>
            <div className="badges-actions">
              <button type="submit" className="eco-batch-btn eco-batch-ok vadm-publier" disabled={enCours}>
                {enCours ? 'Enregistrement…' : editionId ? 'Enregistrer' : 'Publier'}
              </button>
              {editionId && (
                <button type="button" className="insc-btn-reinit" onClick={reinitialiser} disabled={enCours}>Annuler</button>
              )}
            </div>
          </form>
        </section>

        {/* Liste */}
        <section className="carte vadm-liste-carte">
          <div className="vadm-carte-titre"><Icone nom="clipboard" /> Sections publiées</div>
          {!sections ? (
            <Chargement texte="Chargement des sections…" />
          ) : sections.length === 0 ? (
            <div className="insc-vide" style={{ boxShadow: 'none' }}>
              <div className="insc-vide-ico" aria-hidden="true"><Icone nom="inbox" size={44} /></div>
              <p>Aucune section pour le moment.</p>
              <p className="texte-gris">Créez la première section !</p>
            </div>
          ) : (
            <div className="vadm-liste">
              {sections.map((s) => (
                <article key={s.id} className={`vadm-item ${editionId === s.id ? 'vadm-item-actif' : ''}`}>
                  <div className="vadm-item-haut">
                    <span className="vadm-cat vadm-cat-annonce">Ordre {s.ordre}</span>
                    <span className="vadm-item-date">{dateFr(s.cree_le)}</span>
                  </div>
                  <h3>{s.titre}</h3>
                  <p className="vadm-item-texte">{s.contenu}</p>
                  <div className="badges-actions">
                    <button type="button" className="mat-modifier" onClick={() => commencerEdition(s)}>
                      <Icone nom="edit" /> Modifier
                    </button>
                    <button type="button" className="paie-btn paie-rejeter" onClick={() => setSuppression(s)}>
                      <Icone nom="trash" /> Supprimer
                    </button>
                  </div>
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
            <h2 style={{ marginBottom: '.75rem' }}>Supprimer la section</h2>
            <p style={{ color: '#4A5568', marginBottom: '1.25rem' }}>
              Voulez-vous vraiment supprimer la section « <strong>{suppression.titre}</strong> » ?
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
        <ModaleCompteAdmin identifiantActuel={admin.identifiant} onSoumettre={aproposApi.modifierCompte}
          onFermer={() => setCompteOuvert(false)}
          onMaj={(identifiant) => { onAdminMaj({ ...admin, identifiant }); setCompteOuvert(false); }} />
      )}
    </div>
  );
}
