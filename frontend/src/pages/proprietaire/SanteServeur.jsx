import { useEffect, useState } from 'react';
import { directionApi } from '../../services/api.js';
import { dateHeureFr } from '../../utils/libelles.js';
import Carte from '../../components/Carte.jsx';
import Alerte from '../../components/Alerte.jsx';
import Chargement from '../../components/Chargement.jsx';

export default function SanteServeur() {
  const [sante, setSante] = useState(null);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    directionApi.statistiques().then((d) => setSante(d.sante)).catch((e) => setErreur(e.message));
  }, []);

  if (erreur) return <Alerte type="erreur">{erreur}</Alerte>;
  if (!sante) return <Chargement />;

  return (
    <div style={{ maxWidth: 720 }}>
      <div className="page-entete">
        <h1>Santé du serveur</h1>
        <p>État technique du site : services actifs et dernières erreurs.</p>
      </div>

      <Carte>
        <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap', marginBottom: '.75rem' }}>
          <span className={`tdb-badge ${sante.courrielConfigure ? 'tdb-badge-vert' : 'tdb-badge-rouge'}`}>
            {sante.courrielConfigure ? 'Courriel actif' : 'Courriel inactif'}
          </span>
          <span className={`tdb-badge ${sante.iaConfiguree ? 'tdb-badge-vert' : 'tdb-badge-rouge'}`}>
            {sante.iaConfiguree ? 'Assistant IA actif' : 'Assistant IA inactif'}
          </span>
        </div>
        <p className="texte-gris" style={{ fontSize: '.85rem' }}>
          Serveur démarré le {dateHeureFr(sante.demarreLe)} (redémarre à chaque mise à jour du site).
        </p>

        <h4 style={{ margin: '1rem 0 .5rem', fontSize: '.9rem' }}>Dernières erreurs</h4>
        {sante.dernieresErreurs.length === 0 ? (
          <p className="texte-gris" style={{ fontSize: '.85rem' }}>Aucune erreur depuis le dernier démarrage.</p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '.82rem' }}>
            {sante.dernieresErreurs.map((e, i) => (
              <li key={i}><span className="texte-gris">{dateHeureFr(e.date)}</span> — {e.message}</li>
            ))}
          </ul>
        )}
      </Carte>

      <footer className="insc-pied">© {new Date().getFullYear()} Lekòl Pam. Tous droits réservés.</footer>
    </div>
  );
}
