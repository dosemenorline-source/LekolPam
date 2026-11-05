import { Routes, Route, Navigate } from 'react-router-dom';
import RoutePrivee from './components/RoutePrivee.jsx';
import RoutePublique from './components/RoutePublique.jsx';
import Layout from './components/Layout.jsx';
import PublicLayout from './components/PublicLayout.jsx';
import Accueil from './pages/public/Accueil.jsx';
import APropos from './pages/public/APropos.jsx';
import AProposAdmin from './pages/public/AProposAdmin.jsx';
import Vlog from './pages/public/Vlog.jsx';
import VlogAdmin from './pages/public/VlogAdmin.jsx';
import Professeurs from './pages/public/Professeurs.jsx';
import ProfesseursAdmin from './pages/public/ProfesseursAdmin.jsx';
import Academie from './pages/public/Academie.jsx';
import AcademieAdmin from './pages/public/AcademieAdmin.jsx';
import Examens from './pages/public/Examens.jsx';
import ExamensAdmin from './pages/public/ExamensAdmin.jsx';
import Contact from './pages/public/Contact.jsx';
import DemandeAncienEleve from './pages/public/DemandeAncienEleve.jsx';
import Calendrier from './pages/public/Calendrier.jsx';
import Support from './pages/public/Support.jsx';
import Login from './pages/auth/Login.jsx';
import ConnexionEleve from './pages/auth/ConnexionEleve.jsx';
import MotDePasseOublie from './pages/auth/MotDePasseOublie.jsx';
import Register from './pages/auth/Register.jsx';
import EspaceEleve from './pages/eleve/EspaceEleve.jsx';
import BadgeEleve from './pages/eleve/BadgeEleve.jsx';
import MesCours from './pages/eleve/MesCours.jsx';
import TableauDeBord from './pages/TableauDeBord.jsx';
import MesInscriptions from './pages/parent/MesInscriptions.jsx';
import NouvelleInscription from './pages/parent/NouvelleInscription.jsx';
import DetailInscription from './pages/parent/DetailInscription.jsx';
import NotesBulletins from './pages/parent/NotesBulletins.jsx';
import Paiements from './pages/parent/Paiements.jsx';
import NouveauPaiement from './pages/parent/NouveauPaiement.jsx';
import DetailPaiement from './pages/parent/DetailPaiement.jsx';
import PaiementRetour from './pages/parent/PaiementRetour.jsx';
import AdminInscriptions from './pages/admin/AdminInscriptions.jsx';
import AdminDetailInscription from './pages/admin/AdminDetailInscription.jsx';
import AdminNotes from './pages/admin/AdminNotes.jsx';
import AdminCodesEleves from './pages/admin/AdminCodesEleves.jsx';
import AdminInvitations from './pages/admin/AdminInvitations.jsx';
import AdminBadges from './pages/admin/AdminBadges.jsx';
import EconomatAdmin from './pages/public/EconomatAdmin.jsx';
import AdminPresences from './pages/admin/AdminPresences.jsx';
import AdminAnciensEleves from './pages/admin/AdminAnciensEleves.jsx';
import Matieres from './pages/direction/Matieres.jsx';
import Publications from './pages/direction/Publications.jsx';
import Ecole from './pages/direction/Ecole.jsx';
import Enseignants from './pages/direction/Enseignants.jsx';
import TableauProfesseur from './pages/professeur/TableauProfesseur.jsx';
import Statistiques from './pages/proprietaire/Statistiques.jsx';
import SanteServeur from './pages/proprietaire/SanteServeur.jsx';
import Rapport from './pages/proprietaire/Rapport.jsx';
import Postes from './pages/proprietaire/Postes.jsx';
import ReinscriptionProprio from './pages/proprietaire/Reinscription.jsx';
import Reinscription from './pages/parent/Reinscription.jsx';
import ArchivePage from './pages/ArchivePage.jsx';
import ImportDonnees from './pages/ImportDonnees.jsx';
import BoiteReception from './pages/proprietaire/BoiteReception.jsx';
import AnnonceCourriel from './pages/proprietaire/AnnonceCourriel.jsx';
import MonCompte from './pages/MonCompte.jsx';
import AnnonceSms from './pages/AnnonceSms.jsx';

export default function App() {
  return (
    <Routes>
      {/* Site public (visiteurs) — accessible à tous */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Accueil />} />
        <Route path="/a-propos" element={<APropos />} />
        <Route path="/a-propos/admin" element={<AProposAdmin />} />
        <Route path="/vlog" element={<Vlog />} />
        <Route path="/vlog/admin" element={<VlogAdmin />} />
        <Route path="/professeurs" element={<Professeurs />} />
        <Route path="/professeurs/admin" element={<ProfesseursAdmin />} />
        <Route path="/academie/admin" element={<AcademieAdmin />} />
        <Route path="/examens" element={<Examens />} />
        <Route path="/examens/admin" element={<ExamensAdmin />} />
        <Route path="/economat/admin" element={<EconomatAdmin />} />
        <Route path="/academie/prescolaire" element={<Academie niveau="prescolaire" />} />
        <Route path="/academie/primaire" element={<Academie niveau="primaire" />} />
        <Route path="/academie/secondaire" element={<Academie niveau="secondaire" />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/anciens-eleves" element={<DemandeAncienEleve />} />
        <Route path="/calendrier" element={<Calendrier />} />
        <Route path="/support" element={<Support />} />
      </Route>

      {/* Auth (public) */}
      <Route path="/login" element={<RoutePublique><Login /></RoutePublique>} />
      <Route path="/eleve" element={<RoutePublique><ConnexionEleve /></RoutePublique>} />
      <Route path="/mot-de-passe-oublie" element={<RoutePublique><MotDePasseOublie /></RoutePublique>} />
      <Route path="/register" element={<RoutePublique><Register /></RoutePublique>} />

      {/* Zone authentifiée */}
      <Route
        element={
          <RoutePrivee>
            <Layout />
          </RoutePrivee>
        }
      >
        <Route path="/tableau-de-bord" element={<TableauDeBord />} />
        <Route path="/mon-compte" element={<RoutePrivee roles={['parent', 'admin', 'direction', 'proprietaire', 'professeur']}><MonCompte /></RoutePrivee>} />
        <Route path="/annonce-sms" element={<RoutePrivee roles={['admin', 'direction', 'proprietaire']}><AnnonceSms /></RoutePrivee>} />
        <Route path="/proprietaire/annonce-courriel" element={<RoutePrivee roles={['proprietaire']}><AnnonceCourriel /></RoutePrivee>} />

        {/* Parent — Inscriptions */}
        <Route path="/inscriptions" element={<RoutePrivee roles={['parent']}><MesInscriptions /></RoutePrivee>} />
        <Route path="/inscriptions/nouvelle" element={<RoutePrivee roles={['parent']}><NouvelleInscription /></RoutePrivee>} />
        <Route path="/inscriptions/:id" element={<RoutePrivee roles={['parent']}><DetailInscription /></RoutePrivee>} />

        {/* Parent — Notes & bulletins */}
        <Route path="/notes" element={<RoutePrivee roles={['parent']}><NotesBulletins /></RoutePrivee>} />

        {/* Parent — Ré-inscription de fin d'année */}
        <Route path="/reinscription" element={<RoutePrivee roles={['parent']}><Reinscription /></RoutePrivee>} />

        {/* Espace élève (connexion par code) */}
        <Route path="/eleve/notes" element={<RoutePrivee roles={['eleve']}><EspaceEleve /></RoutePrivee>} />
        <Route path="/eleve/badge" element={<RoutePrivee roles={['eleve']}><BadgeEleve /></RoutePrivee>} />
        <Route path="/eleve/cours" element={<RoutePrivee roles={['eleve']}><MesCours /></RoutePrivee>} />

        {/* Parent — Paiements */}
        <Route path="/paiements" element={<RoutePrivee roles={['parent']}><Paiements /></RoutePrivee>} />
        <Route path="/paiements/nouveau" element={<RoutePrivee roles={['parent']}><NouveauPaiement /></RoutePrivee>} />
        <Route path="/paiements/:id" element={<RoutePrivee roles={['parent']}><DetailPaiement /></RoutePrivee>} />
        <Route path="/paiements/retour" element={<RoutePrivee roles={['parent']}><PaiementRetour /></RoutePrivee>} />

        {/* Admin (secrétariat) */}
        <Route path="/admin/inscriptions" element={<RoutePrivee roles={['admin']}><AdminInscriptions /></RoutePrivee>} />
        <Route path="/admin/inscriptions/:id" element={<RoutePrivee roles={['admin']}><AdminDetailInscription /></RoutePrivee>} />
        <Route path="/admin/notes" element={<RoutePrivee roles={['admin']}><AdminNotes /></RoutePrivee>} />
        <Route path="/admin/codes-eleves" element={<RoutePrivee roles={['admin']}><AdminCodesEleves /></RoutePrivee>} />
        <Route path="/admin/invitations" element={<RoutePrivee roles={['admin', 'direction', 'proprietaire']}><AdminInvitations /></RoutePrivee>} />
        <Route path="/archives" element={<RoutePrivee roles={['admin', 'direction', 'proprietaire']}><ArchivePage /></RoutePrivee>} />
        <Route path="/import" element={<RoutePrivee roles={['admin', 'direction', 'proprietaire']}><ImportDonnees /></RoutePrivee>} />
        <Route path="/admin/badges" element={<RoutePrivee roles={['admin']}><AdminBadges /></RoutePrivee>} />
        <Route path="/admin/presences" element={<RoutePrivee roles={['admin', 'direction']}><AdminPresences /></RoutePrivee>} />
        <Route path="/admin/anciens-eleves" element={<RoutePrivee roles={['admin', 'direction']}><AdminAnciensEleves /></RoutePrivee>} />

        {/* Direction */}
        <Route path="/direction/matieres" element={<RoutePrivee roles={['direction']}><Matieres /></RoutePrivee>} />
        <Route path="/direction/publications" element={<RoutePrivee roles={['direction']}><Publications /></RoutePrivee>} />
        <Route path="/direction/ecole" element={<RoutePrivee roles={['direction']}><Ecole /></RoutePrivee>} />
        <Route path="/direction/enseignants" element={<RoutePrivee roles={['direction']}><Enseignants /></RoutePrivee>} />

        {/* Professeur (compte individuel, assigné à des classes par la direction) */}
        <Route path="/professeur/tableau" element={<RoutePrivee roles={['professeur']}><TableauProfesseur /></RoutePrivee>} />

        {/* Propriétaire — Contrôle d'accès */}
        <Route path="/proprietaire/statistiques" element={<RoutePrivee roles={['proprietaire']}><Statistiques /></RoutePrivee>} />
        <Route path="/proprietaire/rapport" element={<RoutePrivee roles={['proprietaire']}><Rapport /></RoutePrivee>} />
        <Route path="/proprietaire/postes" element={<RoutePrivee roles={['proprietaire']}><Postes /></RoutePrivee>} />
        <Route path="/proprietaire/reinscription" element={<RoutePrivee roles={['proprietaire']}><ReinscriptionProprio /></RoutePrivee>} />
        <Route path="/proprietaire/sante" element={<RoutePrivee roles={['proprietaire']}><SanteServeur /></RoutePrivee>} />
        <Route path="/proprietaire/messages" element={<RoutePrivee roles={['proprietaire']}><BoiteReception /></RoutePrivee>} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
