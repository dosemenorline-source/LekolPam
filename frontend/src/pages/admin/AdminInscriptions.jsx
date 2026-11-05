import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '../../services/api.js';
import { dateFr } from '../../utils/libelles.js';
import Alerte from '../../components/Alerte.jsx';
import Chargement from '../../components/Chargement.jsx';
import Icone from '../../components/Icone.jsx';

const PAR_PAGE = 10;

const LIBELLE_STATUT = {
  en_attente: 'En attente',
  complement_demande: 'Complément demandé',
  accepte: 'Accepté',
  refuse: 'Refusé',
  confirmee: 'Confirmée',
};

// Ton de couleur du badge de statut
function tonStatut(s) {
  if (s === 'accepte' || s === 'confirmee') return 'vert';
  if (s === 'refuse' || s === 'rejete') return 'rouge';
  return 'or'; // en_attente, complement_demande…
}

function BadgeStatut({ statut }) {
  return <span className={`insc-badge insc-badge-${tonStatut(statut)}`}>{LIBELLE_STATUT[statut] || statut}</span>;
}

export default function AdminInscriptions() {
  const [tous, setTous] = useState(null);   // null = chargement
  const [erreur, setErreur] = useState('');

  // Filtres (appliqués en direct, côté client)
  const [recherche, setRecherche] = useState('');
  const [statut, setStatut] = useState('');
  const [niveau, setNiveau] = useState('');
  const [page, setPage] = useState(1);

  // Chargement de tous les dossiers une seule fois (stats + filtres calculés au client)
  useEffect(() => {
    adminApi.inscriptions({})
      .then((d) => setTous(d.inscriptions))
      .catch((e) => setErreur(e.message));
  }, []);

  // Revenir à la page 1 quand un filtre change
  useEffect(() => { setPage(1); }, [recherche, statut, niveau]);

  // Niveaux présents dans les données (liste déroulante dynamique)
  const niveaux = useMemo(() => {
    if (!tous) return [];
    return [...new Set(tous.map((i) => i.niveau).filter(Boolean))].sort();
  }, [tous]);

  // Statistiques (sur l'ensemble, indépendamment des filtres)
  const stats = useMemo(() => {
    const base = tous || [];
    const compte = (pred) => base.filter(pred).length;
    return {
      total: base.length,
      accepte: compte((i) => i.statut === 'accepte' || i.statut === 'confirmee'),
      attente: compte((i) => i.statut === 'en_attente' || i.statut === 'complement_demande'),
      refuse: compte((i) => i.statut === 'refuse'),
    };
  }, [tous]);

  // Filtrage + recherche
  const filtres = useMemo(() => {
    if (!tous) return [];
    const q = recherche.trim().toLowerCase();
    return tous.filter((i) => {
      if (statut && i.statut !== statut) return false;
      if (niveau && i.niveau !== niveau) return false;
      if (q) {
        const cible = `${i.eleve_nom || ''} ${i.parent_courriel || ''}`.toLowerCase();
        if (!cible.includes(q)) return false;
      }
      return true;
    });
  }, [tous, recherche, statut, niveau]);

  // Pagination
  const nbPages = Math.max(1, Math.ceil(filtres.length / PAR_PAGE));
  const pageCourante = Math.min(page, nbPages);
  const visibles = filtres.slice((pageCourante - 1) * PAR_PAGE, pageCourante * PAR_PAGE);

  const reinitialiser = () => { setRecherche(''); setStatut(''); setNiveau(''); };
  const filtresActifs = recherche || statut || niveau;

  return (
    <div className="insc-page">
      <div className="page-entete">
        <h1>File des inscriptions</h1>
        <p>Consultez et traitez les dossiers d'inscription.</p>
      </div>

      {/* Badges de résumé */}
      <div className="insc-resume">
        <span className="insc-stat"><strong>{stats.total}</strong> Total</span>
        <span className="insc-stat insc-stat-vert"><strong>{stats.accepte}</strong> Accepté{stats.accepte > 1 ? 's' : ''}</span>
        <span className="insc-stat insc-stat-or"><strong>{stats.attente}</strong> En attente</span>
        <span className="insc-stat insc-stat-rouge"><strong>{stats.refuse}</strong> Refusé{stats.refuse > 1 ? 's' : ''}</span>
      </div>

      {/* Barre de recherche + filtres */}
      <div className="insc-barre">
        <div className="insc-recherche">
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M15.5 14h-.79l-.28-.27a6.5 6.5 0 1 0-.7.7l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0A4.5 4.5 0 1 1 14 9.5 4.5 4.5 0 0 1 9.5 14z" />
          </svg>
          <input value={recherche} onChange={(e) => setRecherche(e.target.value)}
            placeholder="Rechercher un élève ou un parent…" aria-label="Rechercher" />
        </div>
        <select value={statut} onChange={(e) => setStatut(e.target.value)} aria-label="Filtrer par statut">
          <option value="">Tous les statuts</option>
          {Object.entries(LIBELLE_STATUT).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select value={niveau} onChange={(e) => setNiveau(e.target.value)} aria-label="Filtrer par niveau">
          <option value="">Tous les niveaux</option>
          {niveaux.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <button type="button" className="insc-btn-reinit" onClick={reinitialiser} disabled={!filtresActifs}>
          Réinitialiser
        </button>
      </div>

      {erreur && <Alerte type="erreur">{erreur}</Alerte>}

      {/* États : chargement / vide / tableau */}
      {!tous ? (
        <Chargement texte="Chargement des inscriptions…" />
      ) : filtres.length === 0 ? (
        <div className="insc-vide">
          <div className="insc-vide-ico" aria-hidden="true"><Icone nom="inbox" size={44} /></div>
          <p>Aucune inscription trouvée.</p>
          {filtresActifs && (
            <button type="button" className="insc-btn-reinit" onClick={reinitialiser}>Réinitialiser les filtres</button>
          )}
        </div>
      ) : (
        <>
          <div className="tableau-enveloppe">
            <table className="tableau insc-tableau">
              <thead>
                <tr>
                  <th>Élève</th><th>Niveau</th><th>Année</th><th>Parent</th>
                  <th>Statut</th><th>Soumis</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((i) => (
                  <tr key={i.id}>
                    <td className="insc-nom">{i.eleve_nom}</td>
                    <td>{i.niveau || '—'}</td>
                    <td>{i.annee_scolaire}</td>
                    <td className="insc-parent">{i.parent_courriel}</td>
                    <td><BadgeStatut statut={i.statut} /></td>
                    <td>{dateFr(i.date_soumission)}</td>
                    <td><Link to={`/admin/inscriptions/${i.id}`} className="insc-traiter">Traiter</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {nbPages > 1 && (
            <nav className="insc-pagination" aria-label="Pagination">
              <button type="button" onClick={() => setPage(pageCourante - 1)} disabled={pageCourante === 1}>‹ Précédent</button>
              {Array.from({ length: nbPages }, (_, k) => k + 1).map((n) => (
                <button key={n} type="button"
                  className={n === pageCourante ? 'actif' : ''}
                  aria-current={n === pageCourante ? 'page' : undefined}
                  onClick={() => setPage(n)}>{n}</button>
              ))}
              <button type="button" onClick={() => setPage(pageCourante + 1)} disabled={pageCourante === nbPages}>Suivant ›</button>
            </nav>
          )}

          <p className="insc-compte">
            {filtres.length} dossier{filtres.length > 1 ? 's' : ''}{filtresActifs ? ' (filtré)' : ''} · page {pageCourante}/{nbPages}
          </p>
        </>
      )}

      <footer className="insc-pied">© {new Date().getFullYear()} Lekòl Pam. Tous droits réservés.</footer>
    </div>
  );
}
