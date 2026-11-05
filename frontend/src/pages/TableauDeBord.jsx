// Aiguillage du tableau de bord selon le rôle
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import TableauParent from './parent/TableauParent.jsx';
import TableauAdmin from './admin/TableauAdmin.jsx';
import TableauDirection from './direction/TableauDirection.jsx';
import Permissions from './proprietaire/Permissions.jsx';

export default function TableauDeBord() {
  const { utilisateur } = useAuth();
  if (utilisateur.role === 'proprietaire') return <Permissions />;
  if (utilisateur.role === 'admin') return <TableauAdmin />;
  if (utilisateur.role === 'direction') return <TableauDirection />;
  if (utilisateur.role === 'eleve') return <Navigate to="/eleve/notes" replace />;
  if (utilisateur.role === 'professeur') return <Navigate to="/professeur/tableau" replace />;
  return <TableauParent />; // parent
}
