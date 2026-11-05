import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { aproposApi } from '../../services/api.js';
import Icone from '../../components/Icone.jsx';
import useTitrePage from '../../hooks/useTitrePage.js';

export default function APropos() {
  useTitrePage('À propos', "Découvrez la mission, l'histoire et les valeurs de l'école Lekòl Pam.");

  const [sections, setSections] = useState(null); // null = chargement
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    aproposApi.sections()
      .then((d) => setSections(d.sections))
      .catch((e) => setErreur(e.message));
  }, []);

  return (
    <div className="site-page apropos-page">
      <header className="site-page-entete">
        <h1>À propos</h1>
        <p>Découvrez la mission, les valeurs et l'histoire de Lekòl Pam.</p>
      </header>

      {erreur && <p className="texte-gris">{erreur}</p>}

      {sections === null ? (
        <div className="pile pile-md">
          <div className="ens-skeleton" style={{ height: 120 }} />
          <div className="ens-skeleton" style={{ height: 120 }} />
        </div>
      ) : sections.length === 0 ? (
        <div className="carte site-placeholder">
          <p className="texte-gris">Contenu à venir. Cette section sera bientôt complétée.</p>
        </div>
      ) : (
        <div className="apropos-liste">
          {sections.map((s) => (
            <section key={s.id} className="carte apropos-section">
              <h2 className="apropos-section-titre">{s.titre}</h2>
              <p className="apropos-section-texte">{s.contenu}</p>
            </section>
          ))}
        </div>
      )}

      <p className="apropos-admin-lien">
        <Link to="/a-propos/admin" className="texte-gris"><Icone nom="lock" /> Espace administrateur</Link>
      </p>
    </div>
  );
}
