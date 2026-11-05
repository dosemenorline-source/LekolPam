import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { academieApi } from '../../services/api.js';
import Icone from '../../components/Icone.jsx';
import useTitrePage from '../../hooks/useTitrePage.js';

// Pages de l'académie par niveau. Le niveau est passé en prop depuis les routes.
const NIVEAUX = {
  prescolaire: {
    titre: 'Préscolaire',
    intro: "L'éveil et les premiers apprentissages, dans un cadre bienveillant.",
  },
  primaire: {
    titre: 'Primaire',
    intro: 'Les fondations solides en lecture, écriture et calcul.',
  },
  secondaire: {
    titre: 'Secondaire',
    intro: "Préparer les élèves à la réussite et à la suite de leur parcours.",
  },
};

export default function Academie({ niveau }) {
  const info = NIVEAUX[niveau] || { titre: 'Académie', intro: '' };
  useTitrePage(info.titre, info.intro);

  const [sections, setSections] = useState(null); // null = chargement
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    setSections(null);
    academieApi.sections(niveau)
      .then((d) => setSections(d.sections))
      .catch((e) => setErreur(e.message));
  }, [niveau]);

  return (
    <div className="site-page apropos-page">
      <header className="site-page-entete">
        <h1>Académie — {info.titre}</h1>
        {info.intro && <p>{info.intro}</p>}
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
        <Link to="/academie/admin" className="texte-gris"><Icone nom="lock" /> Espace administrateur</Link>
      </p>
    </div>
  );
}
