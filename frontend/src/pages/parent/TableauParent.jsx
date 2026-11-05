import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import Carte from '../../components/Carte.jsx';

const SECTIONS = [
  { titre: 'Inscriptions', desc: 'Soumettez un dossier et suivez son statut.', to: '/inscriptions' },
  { titre: 'Notes & bulletins', desc: 'Consultez les notes publiées et téléchargez les bulletins.', to: '/notes' },
  { titre: 'Paiements', desc: "Frais d'inscription, relevés et duplicatas.", to: '/paiements' },
];

export default function TableauParent() {
  const { utilisateur } = useAuth();
  return (
    <div>
      <div className="page-entete">
        <h1>Bonjour, {utilisateur.nom} 👋</h1>
        <p>Bienvenue dans votre espace parent.</p>
      </div>
      <div className="grille">
        {SECTIONS.map((s) => {
          const contenu = (
            <Carte titre={s.titre}>
              <p className="texte-gris">{s.desc}</p>
              <p className="texte-gris" style={{ marginTop: '.75rem', fontSize: '.82rem' }}>
                {s.to ? 'Ouvrir →' : 'Bientôt disponible.'}
              </p>
            </Carte>
          );
          return s.to
            ? <Link key={s.titre} to={s.to} style={{ textDecoration: 'none', color: 'inherit' }}>{contenu}</Link>
            : <div key={s.titre}>{contenu}</div>;
        })}
      </div>
    </div>
  );
}
