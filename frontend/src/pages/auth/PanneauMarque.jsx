// Icône cadenas (confiance / sécurité)
const IcoCadenas = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 1a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2h-1V6a5 5 0 0 0-5-5zm3 8H9V6a3 3 0 0 1 6 0v3zm-3 4a2 2 0 0 1 1 3.73V19a1 1 0 0 1-2 0v-2.27A2 2 0 0 1 12 13z" />
  </svg>
);

// Panneau de marque (colonne visuelle des écrans d'authentification)
export default function PanneauMarque() {
  return (
    <div className="auth-marque">
      <img className="logo logo-img" src="/logo-icon.svg" alt="" aria-hidden="true" />
      <h1>Lekòl Pam</h1>
      <p>
        La plateforme de gestion scolaire : inscriptions en ligne, notes et bulletins,
        paiements — simple, sécurisé, accessible.
      </p>
      <div className="auth-securite">
        <IcoCadenas />
        <span>Connexion sécurisée — vos données sont chiffrées.</span>
      </div>
    </div>
  );
}
