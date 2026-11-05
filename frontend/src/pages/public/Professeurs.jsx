import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { profsApi, urlPhotoProf } from '../../services/api.js';
import Icone from '../../components/Icone.jsx';
import useTitrePage from '../../hooks/useTitrePage.js';

// Nom complet lisible (prénom + nom)
export function nomComplet(p) {
  return [p.prenom, p.nom].filter(Boolean).join(' ') || p.nom;
}

// Initiales pour l'avatar de repli (aucune photo)
export function initiales(p) {
  const parts = [p.prenom, p.nom].filter(Boolean);
  const lettres = parts.map((m) => m.trim()[0]).filter(Boolean).slice(0, 2);
  return (lettres.join('') || p.nom[0] || '?').toUpperCase();
}

// Expérience formatée (« 5 ans d'expérience »)
export function experienceLibelle(n) {
  if (n === null || n === undefined || n === '') return null;
  const val = Number(n);
  if (Number.isNaN(val) || val <= 0) return null;
  return `${val} an${val > 1 ? 's' : ''} d'expérience`;
}

// Avatar : photo si présente, sinon initiales sur fond bleuté
export function AvatarProf({ prof, classe = '' }) {
  return prof.photo_url ? (
    <img className={`prof-photo ${classe}`} src={urlPhotoProf(prof.id)} alt={nomComplet(prof)} loading="lazy" />
  ) : (
    <div className={`prof-photo prof-avatar ${classe}`} aria-hidden="true">{initiales(prof)}</div>
  );
}

export default function Professeurs() {
  useTitrePage('Notre équipe pédagogique', 'Découvrez les professeurs et le corps enseignant de Lekòl Pam.');

  const [professeurs, setProfesseurs] = useState([]);
  const [erreur, setErreur] = useState('');
  const [chargement, setChargement] = useState(true);
  const [selection, setSelection] = useState(null); // fiche ouverte dans la fenêtre de détail

  useEffect(() => {
    profsApi.liste()
      .then((d) => setProfesseurs(d.professeurs))
      .catch((e) => setErreur(e.message))
      .finally(() => setChargement(false));
  }, []);

  // Ferme la fenêtre de détail avec la touche Échap
  useEffect(() => {
    if (!selection) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setSelection(null); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [selection]);

  return (
    <div className="vpub">
      <section className="ens-hero">
        <h1>Corps enseignant</h1>
        <p>Rencontrez nos enseignants : leur discipline, leur formation et leur parcours au service de la réussite des élèves.</p>
      </section>

      {erreur && <p className="texte-gris">{erreur}</p>}

      {chargement ? (
        <div className="prof-grille">
          {[0, 1, 2].map((i) => <div key={i} className="ens-skeleton" />)}
        </div>
      ) : professeurs.length === 0 ? (
        <div className="vpub-vide">
          <div className="vpub-vide-ico" aria-hidden="true"><Icone nom="inbox" size={48} /></div>
          <p>Aucun professeur publié pour le moment.</p>
          <p className="texte-gris">Revenez bientôt !</p>
        </div>
      ) : (
        <div className="prof-grille">
          {professeurs.map((p) => (
            <button key={p.id} type="button" className="carte prof-carte" onClick={() => setSelection(p)}>
              <AvatarProf prof={p} />
              <div className="prof-corps">
                <h3 className="prof-nom">{nomComplet(p)}</h3>
                {p.matiere && <p className="prof-matiere">{p.matiere}</p>}
                {p.fonction && <span className="prof-badge">{p.fonction}</span>}
                <span className="prof-voir">Voir le profil →</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {selection && <FenetreProf prof={selection} onFermer={() => setSelection(null)} />}

      <p className="vpub-admin-lien">
        <Link to="/professeurs/admin" className="texte-gris"><Icone nom="lock" /> Espace administrateur</Link>
      </p>
    </div>
  );
}

// ---------- Fenêtre de détail d'un professeur ----------
function FenetreProf({ prof, onFermer }) {
  const exp = experienceLibelle(prof.experience_annees);

  return (
    <div className="prof-modal-fond" onClick={onFermer}>
      <div className="prof-modal carte" role="dialog" aria-modal="true"
        aria-label={`Profil de ${nomComplet(prof)}`} onClick={(e) => e.stopPropagation()}>
        <button type="button" className="prof-modal-fermer" onClick={onFermer} aria-label="Fermer">×</button>

        <div className="prof-modal-entete">
          <AvatarProf prof={prof} classe="prof-photo-lg" />
          <div>
            <h2 className="prof-nom">{nomComplet(prof)}</h2>
            {prof.matiere && <p className="prof-matiere">{prof.matiere}</p>}
            {prof.fonction && <span className="prof-badge">{prof.fonction}</span>}
          </div>
        </div>

        <dl className="prof-details">
          {prof.diplomes && (
            <div className="prof-detail">
              <dt>Formation & diplômes</dt>
              <dd>{prof.diplomes}</dd>
            </div>
          )}
          {exp && (
            <div className="prof-detail">
              <dt>Expérience</dt>
              <dd>{exp}</dd>
            </div>
          )}
          {prof.parcours && (
            <div className="prof-detail">
              <dt>Parcours</dt>
              <dd className="prof-parcours">{prof.parcours}</dd>
            </div>
          )}
        </dl>

        {!prof.diplomes && !exp && !prof.parcours && (
          <p className="texte-gris">Aucune information complémentaire pour ce professeur.</p>
        )}
      </div>
    </div>
  );
}
