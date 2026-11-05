// Layout du site public (visiteurs) — barre de navigation + menus déroulants + pied de page
import { useState, useRef, useEffect } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useMarque } from '../context/MarqueContext.jsx';
import { urlLogoEcole } from '../services/api.js';

// Menus déroulants
const MENUS = {
  academie: {
    label: 'Académie',
    items: [
      { to: '/academie/prescolaire', label: 'Préscolaire' },
      { to: '/academie/primaire', label: 'Primaire' },
      { to: '/academie/secondaire', label: 'Secondaire' },
    ],
  },
  plus: {
    label: 'Plus',
    items: [
      { to: '/economat/admin', label: 'Économat' },
      { to: '/contact', label: 'Contact' },
      { to: '/calendrier', label: 'Calendrier' },
      { to: '/support', label: 'Support' },
      { to: '/anciens-eleves', label: 'Anciens élèves' },
    ],
  },
};

export default function PublicLayout() {
  const { utilisateur } = useAuth();
  const { nom: nomMarque, aLogo, version } = useMarque();
  const location = useLocation();
  const [ouvert, setOuvert] = useState(null);       // 'academie' | 'plus' | null
  const [menuMobile, setMenuMobile] = useState(false);
  const navRef = useRef(null);

  // Ferme les menus à chaque changement de page
  useEffect(() => { setOuvert(null); setMenuMobile(false); }, [location.pathname]);

  // Ferme le menu déroulant si on clique en dehors
  useEffect(() => {
    const onClick = (e) => {
      if (navRef.current && !navRef.current.contains(e.target)) setOuvert(null);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const bascule = (cle) => setOuvert((o) => (o === cle ? null : cle));

  return (
    <div className="site-public">
      <header className="site-nav">
        <div className="site-nav-inner">
          <Link to="/" className="site-marque">
            {aLogo
              ? <img className="logo logo-img" src={`${urlLogoEcole()}?v=${version}`} alt="" aria-hidden="true" />
              : <img className="logo logo-img" src="/logo-icon.svg" alt="" aria-hidden="true" />}
            <span>{nomMarque}</span>
          </Link>

          <button
            type="button"
            className="site-burger"
            onClick={() => setMenuMobile((m) => !m)}
            aria-label="Ouvrir le menu"
            aria-expanded={menuMobile}
          >
            ☰
          </button>

          <nav ref={navRef} className={`site-liens ${menuMobile ? 'ouvert' : ''}`}>
            <NavLink to="/" end className="site-lien">Accueil</NavLink>
            <NavLink to="/a-propos" className="site-lien">À propos</NavLink>
            <NavLink to="/vlog" className="site-lien">Vlog</NavLink>
            <NavLink to="/professeurs" className="site-lien">Enseignants</NavLink>
            <NavLink to="/examens" className="site-lien">Examens passés</NavLink>

            {Object.entries(MENUS).map(([cle, m]) => (
              <div key={cle} className={`site-dropdown ${ouvert === cle ? 'ouvert' : ''}`}>
                <button
                  type="button"
                  className="site-lien site-dropdown-btn"
                  onClick={() => bascule(cle)}
                  aria-expanded={ouvert === cle}
                >
                  {m.label} <span className="fleche" aria-hidden="true">▾</span>
                </button>
                <div className="site-dropdown-menu">
                  {m.items.map((it) => (
                    <NavLink key={it.to} to={it.to} className="site-dropdown-item">{it.label}</NavLink>
                  ))}
                </div>
              </div>
            ))}

            <div className="site-cta">
              {utilisateur ? (
                <Link to="/tableau-de-bord" className="btn btn-primaire btn-sm">Mon espace</Link>
              ) : (
                <Link to="/login" className="btn btn-primaire btn-sm">Connexion</Link>
              )}
            </div>
          </nav>
        </div>
      </header>

      <main className="site-contenu">
        <Outlet />
      </main>

      <footer className="site-pied">
        <div className="site-pied-inner">
          <span>© {new Date().getFullYear()} Lekòl Pam</span>
          <nav className="site-pied-liens">
            <Link to="/login">Accès</Link>
            <Link to="/a-propos">À propos</Link>
            <Link to="/contact">Contact</Link>
          </nav>
          <span className="texte-gris">Plateforme de gestion scolaire</span>
        </div>
      </footer>
    </div>
  );
}
