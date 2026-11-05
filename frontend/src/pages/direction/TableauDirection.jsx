import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { directionApi, adminApi } from '../../services/api.js';

// Icônes des fonctions (SVG en ligne, couleur héritée via currentColor)
const IcoMatieres = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 4h5v8l-2.5-1.5L6 12V4z" />
  </svg>
);
const IcoPublications = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-5h2v5zm4 0h-2V7h2v10zm4 0h-2v-8h2v8z" />
  </svg>
);
const IcoEcole = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z" />
  </svg>
);

const SECTIONS = [
  { Icone: IcoMatieres, ton: 'navy', titre: 'Matières & coefficients',
    desc: 'Configurez les matières et leurs coefficients par niveau.', to: '/direction/matieres' },
  { Icone: IcoPublications, ton: 'or', titre: 'Publication des notes',
    desc: 'Publiez les notes par niveau et par trimestre.', to: '/direction/publications' },
  { Icone: IcoEcole, ton: 'info', titre: "Coordonnées de l'école",
    desc: 'Renseignez les coordonnées bancaires / MonCash.', to: '/direction/ecole' },
];

export default function TableauDirection() {
  const { utilisateur } = useAuth();
  const [stats, setStats] = useState({ matieres: null, classes: null, eleves: null });

  useEffect(() => {
    Promise.all([
      directionApi.matieres('').then((d) => d.matieres.length).catch(() => null),
      adminApi.elevesCodes('').then((d) => d.eleves).catch(() => null),
    ]).then(([matieres, eleves]) => setStats({
      matieres,
      eleves: eleves ? eleves.length : null,
      classes: eleves ? new Set(eleves.map((e) => e.niveau).filter(Boolean)).size : null,
    }));
  }, []);

  const nombre = (v) => (v === null || v === undefined ? '—' : v);

  return (
    <div className="tdb-secretariat">
      {/* Bannière */}
      <section className="tdb-hero">
        <h1>Espace direction</h1>
        <p>Bonjour {utilisateur.nom}. Paramétrez l'établissement et publiez les résultats.</p>
        <div className="tdb-stats">
          <span className="tdb-stat"><strong>{nombre(stats.matieres)}</strong> matière{stats.matieres > 1 ? 's' : ''}</span>
          <span className="tdb-stat"><strong>{nombre(stats.classes)}</strong> classe{stats.classes > 1 ? 's' : ''}</span>
          <span className="tdb-stat"><strong>{nombre(stats.eleves)}</strong> élève{stats.eleves > 1 ? 's' : ''}</span>
          <span className="tdb-stat"><strong>3</strong> trimestres</span>
        </div>
      </section>

      {/* Cartes de fonction */}
      <section className="tdb-grille-4">
        {SECTIONS.map(({ Icone, ton, titre, desc, to }) => (
          <Link key={titre} to={to} className="tdb-carte">
            <div className="tdb-carte-haut">
              <span className={`tdb-ico tdb-ico-${ton}`}><Icone /></span>
            </div>
            <h2>{titre}</h2>
            <p>{desc}</p>
            <span className="tdb-ouvrir">Ouvrir <span aria-hidden="true">→</span></span>
          </Link>
        ))}
      </section>

      <footer className="tdb-pied">© {new Date().getFullYear()} Lekòl Pam. Tous droits réservés.</footer>
    </div>
  );
}
