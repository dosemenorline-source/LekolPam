import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { academieApi } from '../../services/api.js';
import { dateFr } from '../../utils/libelles.js';
import Alerte from '../../components/Alerte.jsx';
import Chargement from '../../components/Chargement.jsx';
import Icone from '../../components/Icone.jsx';
import ModaleCompteAdmin from '../../components/ModaleCompteAdmin.jsx';

const NIVEAUX = [
  { cle: 'prescolaire', label: 'Préscolaire' },
  { cle: 'primaire', label: 'Primaire' },
  { cle: 'secondaire', label: 'Secondaire' },
];
const LIBELLE_NIVEAU = { prescolaire: 'Préscolaire', primaire: 'Primaire', secondaire: 'Secondaire' };
const SECTION_VIDE = { niveau: 'prescolaire', titre: '', contenu: '', ordre: '' };

// Minuterie partagée pour la déconnexion automatique en quittant la page.
let minuterieDeconnexionAcademie = null;

export default function AcademieAdmin() {
  const [admin, setAdmin] = useState(null);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    academieApi.adminMe()
      .then((d) => setAdmin(d.admin))
      .catch(() => setAdmin(null))
      .finally(() => setChargement(false));
  }, []);

  if (chargement) return <div className="site-page"><p className="texte-gris">Chargement…</p></div>;

  return admin
    ? <PanneauAdmin admin={admin} onAdminMaj={setAdmin} onLogout={() => setAdmin(null)} />
    : <FormLogin onConnecte={setAdmin} />;
}

// ---------- Connexion admin Académie ----------
function FormLogin({ onConnecte }) {
  const [form, setForm] = useState({ identifiant: '', motDePasse: '' });
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);

  const maj = (champ) => (e) => setForm({ ...form, [champ]: e.target.value });

  const soumettre = async (e) => {
    e.preventDefault();
    setErreur(''); setEnCours(true);
    try {
      const d = await academieApi.adminLogin(form);
      onConnecte(d.admin);
    } catch (err) { setErreur(err.message); }
    finally { setEnCours(false); }
  };

  return (
    <div className="vadm-page vadm-login">
      <header className="vadm-entete-simple">
        <h1>Espace administrateur — Académie</h1>
        <p className="texte-gris">Connectez-vous pour gérer le contenu des pages Académie.</p>
      </header>
      <div className="carte vadm-login-carte">
        <form onSubmit={soumettre}>
          {erreur && <Alerte type="erreur">{erreur}</Alerte>}
          <div className="vadm-champ">
            <label htmlFor="acada-identifiant">Identifiant</label>
            <input id="acada-identifiant" value={form.identifiant} onChange={maj('identifiant')} required autoComplete="username" />
          </div>
          <div className="vadm-champ">
            <label htmlFor="acada-mdp">Mot de passe</label>
            <input id="acada-mdp" type="password" value={form.motDePasse} onChange={maj('motDePasse')} required autoComplete="current-password" />
          </div>
          <button type="submit" className="vadm-login-btn" disabled={enCours}>{enCours ? 'Connexion…' : 'Se connecter'}</button>
        </form>
      </div>
      <p className="vadm-retour"><Link to="/academie/prescolaire" className="texte-gris">← Retour à l'académie</Link></p>
    </div>
  );
}

// ---------- Panneau de gestion ----------
function PanneauAdmin({ admin, onAdminMaj, onLogout }) {
  const [sections, setSections] = useState(null); // null = chargement
  const [form, setForm] = useState(SECTION_VIDE);
  const [editionId, setEditionId] = useState(null); // id en cours de modification (null = création)
  const [filtre, setFiltre] = useState('tous');     // filtre de la liste par niveau
  const [erreur, setErreur] = useState('');
  const [msg, setMsg] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [suppression, setSuppression] = useState(null);
  const [suppEnCours, setSuppEnCours] = useState(false);
  const [compteOuvert, setCompteOuvert] = useState(false);
  const [sujetIA, setSujetIA] = useState('');
  const [iaEnCours, setIaEnCours] = useState(false);
  const [erreurIA, setErreurIA] = useState('');

  const charger = () => academieApi.sections().then((d) => setSections(d.sections)).catch((e) => setErreur(e.message));
  useEffect(() => { charger(); }, []);

  // Déconnexion automatique dès qu'on quitte la page d'administration.
  useEffect(() => {
    if (minuterieDeconnexionAcademie) { clearTimeout(minuterieDeconnexionAcademie); minuterieDeconnexionAcademie = null; }
    return () => {
      minuterieDeconnexionAcademie = setTimeout(() => {
        academieApi.adminLogout().catch(() => {});
        minuterieDeconnexionAcademie = null;
      }, 100);
    };
  }, []);

  const maj = (champ) => (e) => setForm({ ...form, [champ]: e.target.value });

  const reinitialiser = () => { setForm(SECTION_VIDE); setEditionId(null); };

  const commencerEdition = (s) => {
    setEditionId(s.id);
    setForm({ niveau: s.niveau, titre: s.titre, contenu: s.contenu, ordre: String(s.ordre ?? '') });
    setMsg(''); setErreur('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Assistant IA : rédige un brouillon (titre + contenu) à partir d'une idée.
  const genererIA = async () => {
    setErreurIA(''); setMsg('');
    if (!sujetIA.trim()) { setErreurIA('Décrivez le sujet à rédiger.'); return; }
    setIaEnCours(true);
    try {
      const d = await academieApi.redactionIA({ sujet: sujetIA.trim(), niveau: form.niveau });
      setForm((f) => ({ ...f, titre: d.titre || f.titre, contenu: d.contenu || f.contenu }));
      setMsg('Brouillon généré par l\'IA. Relisez et ajustez avant de publier.');
    } catch (err) { setErreurIA(err.message); }
    finally { setIaEnCours(false); }
  };

  const soumettre = async (e) => {
    e.preventDefault();
    setErreur(''); setMsg('');
    if (!form.titre.trim()) { setErreur('Le titre est requis.'); return; }
    if (!form.contenu.trim()) { setErreur('Le contenu est requis.'); return; }
    setEnCours(true);
    try {
      const corps = {
        niveau: form.niveau,
        titre: form.titre.trim(),
        contenu: form.contenu.trim(),
        ...(form.ordre !== '' ? { ordre: Number(form.ordre) } : {}),
      };
      if (editionId) {
        await academieApi.modifier(editionId, corps);
        setMsg('Section mise à jour.');
      } else {
        await academieApi.creer(corps);
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
      await academieApi.supprimer(suppression.id);
      setMsg('Section supprimée.');
      if (editionId === suppression.id) reinitialiser();
      setSuppression(null);
      charger();
    } catch (err) { setErreur(err.message); }
    finally { setSuppEnCours(false); }
  };

  const seDeconnecter = async () => {
    try { await academieApi.adminLogout(); } finally { onLogout(); }
  };

  const initiale = (admin.identifiant || '?').charAt(0).toUpperCase();
  const sectionsFiltrees = sections
    ? (filtre === 'tous' ? sections : sections.filter((s) => s.niveau === filtre))
    : null;

  return (
    <div className="vadm-page">
      <header className="vadm-entete">
        <div>
          <h1>Espace administrateur — Académie</h1>
          <p className="texte-gris">Publiez et organisez le contenu des cycles (Préscolaire, Primaire, Secondaire).</p>
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
              placeholder="Décrivez l'idée (ex. programme de lecture au primaire, activités d'éveil)…" />
            <button type="button" className="vadm-ia-btn" onClick={genererIA} disabled={iaEnCours}>
              {iaEnCours ? 'Génération…' : 'Générer avec l\'IA'}
            </button>
            <p className="vadm-info">L'IA rédige pour le cycle sélectionné ci-dessous. Relisez toujours avant de publier.</p>
          </div>

          <form onSubmit={soumettre}>
            <div className="vadm-champ">
              <label htmlFor="acada-niveau">Cycle (niveau)</label>
              <select id="acada-niveau" value={form.niveau} onChange={maj('niveau')}>
                {NIVEAUX.map((n) => <option key={n.cle} value={n.cle}>{n.label}</option>)}
              </select>
            </div>
            <div className="vadm-champ">
              <label htmlFor="acada-titre">Titre</label>
              <input id="acada-titre" value={form.titre} onChange={maj('titre')} placeholder="Ex. Notre programme" />
            </div>
            <div className="vadm-champ">
              <label htmlFor="acada-contenu">Contenu</label>
              <textarea id="acada-contenu" rows={6} value={form.contenu} onChange={maj('contenu')}
                placeholder="Rédigez le texte de cette section…" />
            </div>
            <div className="vadm-champ">
              <label htmlFor="acada-ordre">Ordre d'affichage (optionnel)</label>
              <input id="acada-ordre" type="number" min="0" value={form.ordre} onChange={maj('ordre')}
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

          {/* Filtre par niveau */}
          <div className="acad-filtre">
            <button type="button" className={`acad-filtre-btn ${filtre === 'tous' ? 'actif' : ''}`} onClick={() => setFiltre('tous')}>Tous</button>
            {NIVEAUX.map((n) => (
              <button key={n.cle} type="button" className={`acad-filtre-btn ${filtre === n.cle ? 'actif' : ''}`} onClick={() => setFiltre(n.cle)}>{n.label}</button>
            ))}
          </div>

          {!sections ? (
            <Chargement texte="Chargement des sections…" />
          ) : sectionsFiltrees.length === 0 ? (
            <div className="insc-vide" style={{ boxShadow: 'none' }}>
              <div className="insc-vide-ico" aria-hidden="true"><Icone nom="inbox" size={44} /></div>
              <p>Aucune section pour ce filtre.</p>
              <p className="texte-gris">Créez la première section !</p>
            </div>
          ) : (
            <div className="vadm-liste">
              {sectionsFiltrees.map((s) => (
                <article key={s.id} className={`vadm-item ${editionId === s.id ? 'vadm-item-actif' : ''}`}>
                  <div className="vadm-item-haut">
                    <span className="vadm-cat vadm-cat-actualite">{LIBELLE_NIVEAU[s.niveau]}</span>
                    <span className="vadm-item-date">Ordre {s.ordre} · {dateFr(s.cree_le)}</span>
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
              Voulez-vous vraiment supprimer la section « <strong>{suppression.titre}</strong> » ({LIBELLE_NIVEAU[suppression.niveau]}) ?
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
        <ModaleCompteAdmin identifiantActuel={admin.identifiant} onSoumettre={academieApi.modifierCompte}
          onFermer={() => setCompteOuvert(false)}
          onMaj={(identifiant) => { onAdminMaj({ ...admin, identifiant }); setCompteOuvert(false); }} />
      )}
    </div>
  );
}
