import useTitrePage from '../../hooks/useTitrePage.js';

// Squelette réutilisable pour les pages du site public.
// Titre + intro + contenu (placeholder par défaut, à compléter plus tard).
export default function PagePublique({ titre, intro, children }) {
  useTitrePage(titre, intro);

  return (
    <div className="site-page">
      <header className="site-page-entete">
        <h1>{titre}</h1>
        {intro && <p>{intro}</p>}
      </header>

      {children || (
        <div className="carte site-placeholder">
          <p className="texte-gris">Contenu à venir. Cette section sera bientôt complétée.</p>
        </div>
      )}
    </div>
  );
}
