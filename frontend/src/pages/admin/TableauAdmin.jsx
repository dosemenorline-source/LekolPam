import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { adminApi } from '../../services/api.js';
import Icone from '../../components/Icone.jsx';

// Icônes des fonctions (SVG en ligne, couleur héritée via currentColor)
const IcoInscriptions = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
  </svg>
);
const IcoNotes = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a.996.996 0 0 0 0-1.41l-2.34-2.34a.996.996 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
  </svg>
);
const IcoPaiements = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z" />
  </svg>
);

const SECTIONS = [
  {
    cle: 'inscriptions', Icone: IcoInscriptions, ton: 'navy',
    titre: 'File des inscriptions',
    desc: 'Consultez et traitez les dossiers : accepter, refuser ou demander un complément.',
    to: '/admin/inscriptions',
  },
  {
    cle: 'notes', Icone: IcoNotes, ton: 'or',
    titre: 'Saisie des notes',
    desc: 'Saisissez et validez les notes par élève et par trimestre.',
    to: '/admin/notes',
  },
  {
    cle: 'paiements', Icone: IcoPaiements, ton: 'vert',
    titre: 'File des paiements',
    desc: 'Vérifiez les preuves et validez ou rejetez les paiements.',
    to: '/admin/paiements',
  },
];

// Badge de compteur : rouge si des éléments sont en attente, vert si tout est traité.
function Badge({ compte }) {
  if (compte === null || compte === undefined) return null; // inconnu (chargement / non applicable)
  if (compte > 0) return <span className="tdb-badge tdb-badge-rouge">{compte}</span>;
  return <span className="tdb-badge tdb-badge-vert" aria-label="À jour"><Icone nom="check" size={14} /></span>;
}

export default function TableauAdmin() {
  const { utilisateur } = useAuth();
  // null = en cours de chargement ; nombre = compteur réel
  const [compteurs, setCompteurs] = useState({ inscriptions: null, paiements: null });

  useEffect(() => {
    Promise.all([
      adminApi.inscriptions({ statut: 'en_attente' }).then((d) => d.inscriptions.length).catch(() => null),
      adminApi.paiements('en_attente').then((d) => d.paiements.length).catch(() => null),
    ]).then(([inscriptions, paiements]) => setCompteurs({ inscriptions, paiements }));
  }, []);

  // Compteur associé à chaque carte (les notes n'ont pas de total global simple)
  const compteDe = (cle) => (cle === 'notes' ? null : compteurs[cle]);
  const nombre = (v) => (v === null ? '—' : v);

  return (
    <div className="tdb-secretariat">
      {/* Bannière */}
      <section className="tdb-hero">
        <h1>Espace secrétariat</h1>
        <p>Bonjour {utilisateur.nom}. Gérez les dossiers, les notes et les paiements en un seul endroit.</p>
        <div className="tdb-stats">
          <span className="tdb-stat">
            <strong>{nombre(compteurs.inscriptions)}</strong> dossier{compteurs.inscriptions > 1 ? 's' : ''} en attente
          </span>
          <span className="tdb-stat">
            <strong>{nombre(compteurs.paiements)}</strong> paiement{compteurs.paiements > 1 ? 's' : ''} à vérifier
          </span>
        </div>
      </section>

      {/* Cartes de fonction */}
      <section className="tdb-grille">
        {SECTIONS.map(({ cle, Icone, ton, titre, desc, to }) => (
          <Link key={cle} to={to} className="tdb-carte">
            <div className="tdb-carte-haut">
              <span className={`tdb-ico tdb-ico-${ton}`}><Icone /></span>
              <Badge compte={compteDe(cle)} />
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
