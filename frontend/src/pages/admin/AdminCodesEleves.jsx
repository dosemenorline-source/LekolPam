import { useEffect, useMemo, useState } from 'react';
import { adminApi } from '../../services/api.js';
import Alerte from '../../components/Alerte.jsx';
import Chargement from '../../components/Chargement.jsx';
import Icone from '../../components/Icone.jsx';

const PAR_PAGE = 10;

export default function AdminCodesEleves() {
  const [tous, setTous] = useState(null);   // null = chargement
  const [erreur, setErreur] = useState('');
  const [msg, setMsg] = useState('');

  const [recherche, setRecherche] = useState('');
  const [statut, setStatut] = useState('');   // '', 'avec', 'sans'
  const [page, setPage] = useState(1);

  const [genereId, setGenereId] = useState(null);
  const [copieId, setCopieId] = useState(null);

  // Chargement de tous les élèves une fois (stats + filtres au client)
  useEffect(() => {
    adminApi.elevesCodes('')
      .then((d) => setTous(d.eleves))
      .catch((e) => setErreur(e.message));
  }, []);

  useEffect(() => { setPage(1); }, [recherche, statut]);

  // Statistiques (codes statiques : « actif » = un code existe, sinon « sans code »)
  const stats = useMemo(() => {
    const base = tous || [];
    const avec = base.filter((e) => e.code_acces).length;
    return { total: base.length, avec, sans: base.length - avec };
  }, [tous]);

  const filtres = useMemo(() => {
    if (!tous) return [];
    const q = recherche.trim().toLowerCase();
    return tous.filter((e) => {
      if (statut === 'avec' && !e.code_acces) return false;
      if (statut === 'sans' && e.code_acces) return false;
      if (q) {
        const cible = `${e.nom || ''} ${e.niveau || ''} ${e.parent_nom || ''} ${e.code_acces || ''}`.toLowerCase();
        if (!cible.includes(q)) return false;
      }
      return true;
    });
  }, [tous, recherche, statut]);

  const nbPages = Math.max(1, Math.ceil(filtres.length / PAR_PAGE));
  const pageCourante = Math.min(page, nbPages);
  const visibles = filtres.slice((pageCourante - 1) * PAR_PAGE, pageCourante * PAR_PAGE);

  const reinitialiser = () => { setRecherche(''); setStatut(''); };
  const filtresActifs = recherche || statut;

  const genererCode = async (id) => {
    setErreur(''); setMsg(''); setGenereId(id);
    try {
      const { code } = await adminApi.genererCodeEleve(id);
      setTous((prev) => prev.map((el) => (el.id === id ? { ...el, code_acces: code } : el)));
      setMsg('Code généré.');
    } catch (e) {
      setErreur(e.message);
    } finally {
      setGenereId(null);
    }
  };

  const copier = async (el) => {
    try { await navigator.clipboard.writeText(el.code_acces); } catch { /* ignoré */ }
    setCopieId(el.id);
    setTimeout(() => setCopieId((id) => (id === el.id ? null : id)), 1800);
  };

  return (
    <div className="insc-page">
      <div className="page-entete">
        <h1>Codes d'accès élèves</h1>
        <p>Registre des codes de l'espace élève. Si un parent a perdu le code, retrouvez-le ici (le code est unique et permanent).</p>
      </div>

      {/* Badges de résumé */}
      <div className="insc-resume">
        <span className="insc-stat"><strong>{stats.total}</strong> Total</span>
        <span className="insc-stat insc-stat-vert"><strong>{stats.avec}</strong> Actif{stats.avec > 1 ? 's' : ''}</span>
        <span className="insc-stat insc-stat-or"><strong>{stats.sans}</strong> Sans code</span>
      </div>

      {/* Recherche + filtre */}
      <div className="insc-barre">
        <div className="insc-recherche">
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M15.5 14h-.79l-.28-.27a6.5 6.5 0 1 0-.7.7l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0A4.5 4.5 0 1 1 14 9.5 4.5 4.5 0 0 1 9.5 14z" />
          </svg>
          <input value={recherche} onChange={(e) => setRecherche(e.target.value)}
            placeholder="Rechercher (élève, niveau, parent, code)…" aria-label="Rechercher" />
        </div>
        <select value={statut} onChange={(e) => setStatut(e.target.value)} aria-label="Filtrer par statut">
          <option value="">Tous les statuts</option>
          <option value="avec">Actif (avec code)</option>
          <option value="sans">Sans code</option>
        </select>
        <button type="button" className="insc-btn-reinit" onClick={reinitialiser} disabled={!filtresActifs}>
          Réinitialiser
        </button>
      </div>

      {erreur && <Alerte type="erreur">{erreur}</Alerte>}
      {msg && <Alerte type="info">{msg}</Alerte>}

      {/* États */}
      {!tous ? (
        <Chargement texte="Chargement des codes…" />
      ) : filtres.length === 0 ? (
        <div className="insc-vide">
          <div className="insc-vide-ico" aria-hidden="true"><Icone nom="inbox" size={44} /></div>
          <p>Aucun code trouvé.</p>
          {filtresActifs && (
            <button type="button" className="insc-btn-reinit" onClick={reinitialiser}>Réinitialiser la recherche</button>
          )}
        </div>
      ) : (
        <>
          <div className="tableau-enveloppe">
            <table className="tableau insc-tableau">
              <thead>
                <tr><th>Élève</th><th>Niveau</th><th>Parent</th><th>Code d'accès</th><th>Statut</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {visibles.map((el) => (
                  <tr key={el.id}>
                    <td className="insc-nom">{el.nom}</td>
                    <td>{el.niveau || '—'}</td>
                    <td className="insc-parent">{el.parent_nom || '—'}</td>
                    <td>
                      {el.code_acces ? (
                        <span className="code-cellule">
                          <span className="code-chip">{el.code_acces}</span>
                          <button type="button" className="code-copier" onClick={() => copier(el)}
                            aria-label="Copier le code" title="Copier">
                            {copieId === el.id ? <Icone nom="check" /> : <Icone nom="clipboard" />}
                          </button>
                        </span>
                      ) : <span className="texte-gris">— aucun —</span>}
                    </td>
                    <td>
                      {el.code_acces
                        ? <span className="insc-badge insc-badge-vert">Actif</span>
                        : <span className="insc-badge insc-badge-or">Sans code</span>}
                    </td>
                    <td>
                      {!el.code_acces && (
                        <button type="button" className="code-generer" onClick={() => genererCode(el.id)}
                          disabled={genereId === el.id}>
                          {genereId === el.id ? 'Génération…' : 'Générer'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

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
            {filtres.length} élève{filtres.length > 1 ? 's' : ''}{filtresActifs ? ' (filtré)' : ''} · page {pageCourante}/{nbPages}
          </p>
        </>
      )}

      <footer className="insc-pied">© {new Date().getFullYear()} Lekòl Pam. Tous droits réservés.</footer>
    </div>
  );
}
