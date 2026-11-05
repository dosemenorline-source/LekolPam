import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { economatApi } from '../../services/api.js';
import Alerte from '../../components/Alerte.jsx';
import PaiementsTab from './economat/PaiementsTab.jsx';
import TarifsTab from './economat/TarifsTab.jsx';
import AcquittementsTab from './economat/AcquittementsTab.jsx';
import ArchiveDocuments from '../../components/ArchiveDocuments.jsx';

const ONGLETS = [
  { cle: 'paiements', libelle: 'Paiements' },
  { cle: 'tarifs', libelle: 'Tarifs' },
  { cle: 'acquittements', libelle: 'Acquittements élèves' },
  { cle: 'archives', libelle: 'Archives' },
];

// Minuterie partagée pour la déconnexion automatique en quittant la page.
let minuterieDeconnexionEconomat = null;

export default function EconomatAdmin() {
  const [admin, setAdmin] = useState(null);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    economatApi.adminMe()
      .then((d) => setAdmin(d.admin))
      .catch(() => setAdmin(null))
      .finally(() => setChargement(false));
  }, []);

  if (chargement) return <div className="site-page"><p className="texte-gris">Chargement…</p></div>;

  return admin
    ? <PanneauEconomat admin={admin} onAdminMaj={setAdmin} onLogout={() => setAdmin(null)} />
    : <FormLogin onConnecte={setAdmin} />;
}

// ---------- Connexion admin Économat ----------
function FormLogin({ onConnecte }) {
  const [form, setForm] = useState({ email: '', motDePasse: '' });
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);

  const maj = (champ) => (e) => setForm({ ...form, [champ]: e.target.value });

  const soumettre = async (e) => {
    e.preventDefault();
    setErreur(''); setEnCours(true);
    try {
      const d = await economatApi.adminLogin(form);
      onConnecte(d.admin);
    } catch (err) { setErreur(err.message); }
    finally { setEnCours(false); }
  };

  return (
    <div className="vadm-page vadm-login">
      <header className="vadm-entete-simple">
        <h1>Espace administrateur — Économat</h1>
        <p className="texte-gris">Connectez-vous pour gérer les paiements, tarifs et acquittements.</p>
      </header>
      <div className="carte vadm-login-carte">
        <form onSubmit={soumettre}>
          {erreur && <Alerte type="erreur">{erreur}</Alerte>}
          <div className="vadm-champ">
            <label htmlFor="ecoa-courriel">Courriel</label>
            <input id="ecoa-courriel" type="email" value={form.email} onChange={maj('email')} required autoComplete="username" />
          </div>
          <div className="vadm-champ">
            <label htmlFor="ecoa-mdp">Mot de passe</label>
            <input id="ecoa-mdp" type="password" value={form.motDePasse} onChange={maj('motDePasse')} required autoComplete="current-password" />
          </div>
          <button type="submit" className="vadm-login-btn" disabled={enCours}>{enCours ? 'Connexion…' : 'Se connecter'}</button>
        </form>
      </div>
      <p className="vadm-retour"><Link to="/" className="texte-gris">← Retour à l'accueil</Link></p>
    </div>
  );
}

// ---------- Panneau Économat (3 onglets) ----------
function PanneauEconomat({ admin, onAdminMaj, onLogout }) {
  const [onglet, setOnglet] = useState('paiements');
  const [compteOuvert, setCompteOuvert] = useState(false);

  // Déconnexion automatique dès qu'on quitte la page d'administration.
  useEffect(() => {
    if (minuterieDeconnexionEconomat) { clearTimeout(minuterieDeconnexionEconomat); minuterieDeconnexionEconomat = null; }
    return () => {
      minuterieDeconnexionEconomat = setTimeout(() => {
        economatApi.adminLogout().catch(() => {});
        minuterieDeconnexionEconomat = null;
      }, 100);
    };
  }, []);

  const seDeconnecter = async () => {
    try { await economatApi.adminLogout(); } finally { onLogout(); }
  };

  const initiale = (admin.email || '?').charAt(0).toUpperCase();

  return (
    <div className="vadm-page insc-page">
      <header className="vadm-entete">
        <div>
          <h1>Espace administrateur — Économat</h1>
          <p className="texte-gris">Paiements, tarifs et acquittements des élèves.</p>
        </div>
        <div className="vadm-user">
          <div className="vadm-avatar" aria-hidden="true">{initiale}</div>
          <div className="vadm-user-info">
            <span className="vadm-user-nom">{admin.email}</span>
            <span className="vadm-user-sous">Connecté</span>
          </div>
          <button type="button" className="insc-btn-reinit" onClick={() => setCompteOuvert(true)}>Mon compte</button>
          <button type="button" className="vadm-deco" onClick={seDeconnecter}>Se déconnecter</button>
        </div>
      </header>

      <div className="eco-onglets" role="tablist">
        {ONGLETS.map((o) => (
          <button key={o.cle} type="button" role="tab" aria-selected={onglet === o.cle}
            className={`eco-onglet ${onglet === o.cle ? 'actif' : ''}`}
            onClick={() => setOnglet(o.cle)}>
            {o.libelle}
          </button>
        ))}
      </div>

      {onglet === 'paiements' && <PaiementsTab />}
      {onglet === 'tarifs' && <TarifsTab />}
      {onglet === 'acquittements' && <AcquittementsTab />}
      {onglet === 'archives' && <ArchiveDocuments service="economat" titre="Documents archivés — Économat" />}

      <footer className="vadm-pied">© {new Date().getFullYear()} Lekòl Pam. Tous droits réservés.</footer>

      {compteOuvert && (
        <ModaleCompte admin={admin} onFermer={() => setCompteOuvert(false)}
          onMaj={(a) => { onAdminMaj(a); setCompteOuvert(false); }} />
      )}
    </div>
  );
}

// ---------- Modale : changer courriel / mot de passe ----------
function ModaleCompte({ admin, onFermer, onMaj }) {
  const [motDePasseActuel, setMotDePasseActuel] = useState('');
  const [nouveauEmail, setNouveauEmail] = useState(admin.email);
  const [nouveauMotDePasse, setNouveauMotDePasse] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);

  const soumettre = async (e) => {
    e.preventDefault();
    setErreur('');

    const emailChange = nouveauEmail.trim().toLowerCase() !== admin.email;
    if (!emailChange && !nouveauMotDePasse) {
      setErreur("Modifiez le courriel et/ou le mot de passe avant d'enregistrer.");
      return;
    }
    if (nouveauMotDePasse && nouveauMotDePasse !== confirmation) {
      setErreur('La confirmation ne correspond pas au nouveau mot de passe.');
      return;
    }

    setEnCours(true);
    try {
      await economatApi.modifierCompte({
        motDePasseActuel,
        nouveauEmail: emailChange ? nouveauEmail.trim().toLowerCase() : undefined,
        nouveauMotDePasse: nouveauMotDePasse || undefined,
      });
      onMaj({ ...admin, email: emailChange ? nouveauEmail.trim().toLowerCase() : admin.email });
    } catch (err) {
      setErreur(err.message);
    } finally {
      setEnCours(false);
    }
  };

  return (
    <div className="prof-modal-fond" onClick={() => !enCours && onFermer()}>
      <div className="prof-modal carte" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="prof-modal-fermer" onClick={onFermer} aria-label="Fermer">×</button>
        <h2 style={{ marginBottom: '1rem' }}>Mon compte</h2>
        <form onSubmit={soumettre}>
          {erreur && <Alerte type="erreur">{erreur}</Alerte>}
          <div className="vadm-champ">
            <label htmlFor="ecoa-cpt-courriel">Courriel</label>
            <input id="ecoa-cpt-courriel" type="email" value={nouveauEmail} onChange={(e) => setNouveauEmail(e.target.value)} required />
          </div>
          <div className="vadm-champ">
            <label htmlFor="ecoa-cpt-nouveau-mdp">Nouveau mot de passe (laisser vide pour ne pas changer)</label>
            <input id="ecoa-cpt-nouveau-mdp" type="password" value={nouveauMotDePasse} onChange={(e) => setNouveauMotDePasse(e.target.value)}
              autoComplete="new-password" placeholder="min. 8 caractères" />
          </div>
          {nouveauMotDePasse && (
            <div className="vadm-champ">
              <label htmlFor="ecoa-cpt-confirmation">Confirmer le nouveau mot de passe</label>
              <input id="ecoa-cpt-confirmation" type="password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)}
                autoComplete="new-password" required />
            </div>
          )}
          <div className="vadm-champ">
            <label htmlFor="ecoa-cpt-mdp-actuel">Mot de passe actuel (obligatoire pour confirmer)</label>
            <input id="ecoa-cpt-mdp-actuel" type="password" value={motDePasseActuel} onChange={(e) => setMotDePasseActuel(e.target.value)}
              autoComplete="current-password" required />
          </div>
          <div className="badges-actions" style={{ justifyContent: 'flex-end', marginTop: '.5rem' }}>
            <button type="button" className="insc-btn-reinit" onClick={onFermer} disabled={enCours}>Annuler</button>
            <button type="submit" className="mat-modifier" disabled={enCours}>{enCours ? 'Enregistrement…' : 'Enregistrer'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
