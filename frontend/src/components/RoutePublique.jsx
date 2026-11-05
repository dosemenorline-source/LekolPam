// Route publique (auth) : si déjà connecté, redirige vers le tableau de bord
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import Chargement from './Chargement.jsx';

export default function RoutePublique({ children }) {
  const { utilisateur, chargement } = useAuth();
  if (chargement) return <Chargement />;
  if (utilisateur) return <Navigate to="/tableau-de-bord" replace />;
  return children;
}
