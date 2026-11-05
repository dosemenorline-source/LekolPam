// Mise en page des pages authentifiées : barre de nav + contenu
import { Outlet } from 'react-router-dom';
import BarreNav from './BarreNav.jsx';
import SyncIndicator from './SyncIndicator.jsx';
import { useAuth } from '../context/AuthContext.jsx';

// L'indicateur de synchro ne concerne que le personnel qui exploite un poste
// de bureau (secrétariat, direction, propriétaire). Il interroge /poste/sync,
// protégé par requireAuth (session avec userId). Un élève (session par code,
// sans userId) recevrait un 401 « Authentification requise. » qui déclenche la
// redirection globale vers /login → boucle de rechargement. On ne le monte donc
// que pour ces rôles.
const ROLES_SYNC = ['admin', 'direction', 'proprietaire'];

export default function Layout() {
  const { utilisateur } = useAuth();
  // Thème sombre dédié au rôle propriétaire (« Contrôle d'accès ») — voir global.css .tema-proprio.
  const theme = utilisateur?.role === 'proprietaire' ? 'tema-proprio' : '';

  return (
    <div className={`app-shell ${theme}`}>
      <BarreNav />
      <main className="contenu">
        <Outlet />
      </main>
      {ROLES_SYNC.includes(utilisateur?.role) && <SyncIndicator />}
    </div>
  );
}
