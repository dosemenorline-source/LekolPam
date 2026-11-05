// Garde de route : exige une session, et optionnellement un rôle
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import Chargement from './Chargement.jsx';

export default function RoutePrivee({ children, roles }) {
  const { utilisateur, chargement } = useAuth();
  const location = useLocation();

  if (chargement) return <Chargement />;
  if (!utilisateur) {
    // On mémorise la destination voulue (ex. lien de ré-inscription reçu par
    // courriel) pour y revenir après connexion.
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  if (roles && !roles.includes(utilisateur.role)) {
    // Rôle non autorisé → renvoi vers son propre tableau de bord
    return <Navigate to="/tableau-de-bord" replace />;
  }
  return children;
}
