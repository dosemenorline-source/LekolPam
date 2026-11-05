import { useAuth } from '../context/AuthContext.jsx';
import ArchiveDocuments from '../components/ArchiveDocuments.jsx';

// Secrétariat → documents 'secretariat' ; Direction → 'direction' ;
// Propriétaire → tous les services (avec filtre).
export default function ArchivePage() {
  const { utilisateur } = useAuth();
  const role = utilisateur?.role;
  const service = role === 'admin' ? 'secretariat' : role === 'direction' ? 'direction' : null;
  return <ArchiveDocuments service={service} titre="Documents archivés" />;
}
