import { useEffect, useMemo, useState } from 'react';
import { adminApi, economatApi } from '../../../services/api.js';
import { anneeScolaireCourante } from '../../../utils/libelles.js';
import Alerte from '../../../components/Alerte.jsx';
import Chargement from '../../../components/Chargement.jsx';
import Icone from '../../../components/Icone.jsx';

const PAR_PAGE = 15;

const TRIMESTRES = [
  { valeur: '1er_trimestre', libelle: '1er trimestre' },
  { valeur: '2e_trimestre', libelle: '2e trimestre' },
  { valeur: '3e_trimestre', libelle: '3e trimestre' },
];

// Années scolaires proposées (autour de l'année en cours)
function anneesScolaires() {
  const a = new Date().getFullYear();
  return [a - 1, a, a + 1].map((y) => `${y}-${y + 1}`);
}

export default function AcquittementsTab() {
  const [niveaux, setNiveaux] = useState([]);       // liste déroulante dynamique
  const [niveau, setNiveau] = useState('');
  const [annee, setAnnee] = useState(anneeScolaireCourante());
  const [trimestre, setTrimestre] = useState('1er_trimestre');

  const [eleves, setEleves] = useState([]);
  const [charge, setCharge] = useState(false);
  const [erreur, setErreur] = useState('');
  const [page, setPage] = useState(1);
  const [enCoursId, setEnCoursId] = useState(null);

  const [batch, setBatch] = useState(null);         // 'marquer' | 'reinit' | null
  const [batchEnCours, setBatchEnCours] = useState(false);

  // Niveaux disponibles (dérivés de la liste réelle des élèves)
  useEffect(() => {
    economatApi.niveaux()
      .then((d) => setNiveaux(d.niveaux))
      .catch(() => { /* silencieux : dropdown vide */ });
  }, []);

  // Chargement des acquittements quand les filtres changent
  useEffect(() => {
    if (!niveau) { setEleves([]); return; }
    setCharge(true); setErreur(''); setPage(1);
    adminApi.acquittements({ niveau, anneeScolaire: annee, trimestre })
      .then((d) => setEleves(d.eleves))
      .catch((e) => setErreur(e.message))
      .finally(() => setCharge(false));
  }, [niveau, annee, trimestre]);

  const stats = useMemo(() => {
    const ajour = eleves.filter((e) => e.acquitte).length;
    return { total: eleves.length, ajour, non: eleves.length - ajour };
  }, [eleves]);

  const nbPages = Math.max(1, Math.ceil(eleves.length / PAR_PAGE));
  const pageCourante = Math.min(page, nbPages);
  const visibles = eleves.slice((pageCourante - 1) * PAR_PAGE, pageCourante * PAR_PAGE);

  const basculer = async (eleve) => {
    setErreur(''); setEnCoursId(eleve.id);
    const cle = { idEleve: eleve.id, anneeScolaire: annee, trimestre };
    try {
      if (eleve.acquitte) await adminApi.retirerAcquittement(cle);
      else await adminApi.marquerAcquittement(cle);
      setEleves((prev) => prev.map((e) => (e.id === eleve.id ? { ...e, acquitte: !e.acquitte } : e)));
    } catch (err) { setErreur(err.message); }
    finally { setEnCoursId(null); }
  };

  // Action en masse (côté client : n'appelle l'API que pour les élèves à changer)
  const confirmerBatch = async () => {
    const cible = batch === 'marquer';
    const aChanger = eleves.filter((e) => !!e.acquitte !== cible);
    setBatchEnCours(true); setErreur('');
    try {
      await Promise.all(aChanger.map((e) => {
        const cle = { idEleve: e.id, anneeScolaire: annee, trimestre };
        return cible ? adminApi.marquerAcquittement(cle) : adminApi.retirerAcquittement(cle);
      }));
      setEleves((prev) => prev.map((e) => ({ ...e, acquitte: cible })));
      setBatch(null);
    } catch (err) { setErreur(err.message); setBatch(null); }
    finally { setBatchEnCours(false); }
  };

  const reinitialiser = () => { setNiveau(''); setAnnee(anneeScolaireCourante()); setTrimestre('1er_trimestre'); };

  return (
    <div className="eco-onglet-corps eco-page">
      {/* Résumé (après sélection d'un niveau) */}
      {niveau && !charge && eleves.length > 0 && (
        <div className="insc-resume">
          <span className="insc-stat"><strong>{stats.total}</strong> Total</span>
          <span className="insc-stat insc-stat-vert"><strong>{stats.ajour}</strong> À jour</span>
          <span className="insc-stat insc-stat-rouge"><strong>{stats.non}</strong> Non à jour</span>
        </div>
      )}

      {/* Filtres */}
      <div className="insc-barre">
        <select value={niveau} onChange={(e) => setNiveau(e.target.value)} aria-label="Niveau">
          <option value="">Choisir un niveau…</option>
          {niveaux.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <select value={annee} onChange={(e) => setAnnee(e.target.value)} aria-label="Année scolaire">
          {anneesScolaires().map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <select value={trimestre} onChange={(e) => setTrimestre(e.target.value)} aria-label="Trimestre">
          {TRIMESTRES.map((t) => <option key={t.valeur} value={t.valeur}>{t.libelle}</option>)}
        </select>
        <button type="button" className="insc-btn-reinit" onClick={reinitialiser} disabled={!niveau}>Réinitialiser</button>
      </div>

      {erreur && <Alerte type="erreur">{erreur}</Alerte>}

      {/* États */}
      {!niveau ? (
        <div className="insc-vide">
          <div className="insc-vide-ico" aria-hidden="true"><Icone nom="school" size={44} /></div>
          <p>Sélectionnez un niveau pour afficher les élèves.</p>
        </div>
      ) : charge ? (
        <Chargement texte="Chargement des élèves…" />
      ) : eleves.length === 0 ? (
        <div className="insc-vide">
          <div className="insc-vide-ico" aria-hidden="true"><Icone nom="inbox" size={44} /></div>
          <p>Aucun élève trouvé pour ce niveau.</p>
          <button type="button" className="insc-btn-reinit" onClick={() => setNiveau('')}>Changer de niveau</button>
        </div>
      ) : (
        <>
          <div className="tableau-enveloppe">
            <table className="tableau insc-tableau">
              <thead>
                <tr><th>#</th><th>Élève</th><th>Classe</th><th>Statut ({TRIMESTRES.find((t) => t.valeur === trimestre)?.libelle})</th><th>À jour</th></tr>
              </thead>
              <tbody>
                {visibles.map((e, idx) => (
                  <tr key={e.id}>
                    <td className="texte-gris">{(pageCourante - 1) * PAR_PAGE + idx + 1}</td>
                    <td className="insc-nom">{e.eleve_nom}</td>
                    <td>{niveau}</td>
                    <td>
                      <span className={`insc-badge ${e.acquitte ? 'insc-badge-vert' : 'insc-badge-rouge'}`}>
                        {e.acquitte ? 'À jour' : 'Non à jour'}
                      </span>
                    </td>
                    <td>
                      <label className="eco-switch" title={e.acquitte ? 'Marquer non à jour' : 'Marquer à jour'}>
                        <input type="checkbox" checked={!!e.acquitte}
                          disabled={enCoursId === e.id} onChange={() => basculer(e)} />
                        <span className="eco-slider" />
                      </label>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Actions en masse */}
          <div className="eco-batch">
            <button type="button" className="eco-batch-btn eco-batch-ok" onClick={() => setBatch('marquer')}>
              <Icone nom="check" /> Marquer tous à jour
            </button>
            <button type="button" className="eco-batch-btn eco-batch-non" onClick={() => setBatch('reinit')}>
              <Icone nom="close" /> Réinitialiser tous
            </button>
          </div>

          {nbPages > 1 && (
            <nav className="insc-pagination" aria-label="Pagination">
              <button type="button" onClick={() => setPage(pageCourante - 1)} disabled={pageCourante === 1}>‹ Précédent</button>
              {Array.from({ length: nbPages }, (_, k) => k + 1).map((n) => (
                <button key={n} type="button" className={n === pageCourante ? 'actif' : ''}
                  aria-current={n === pageCourante ? 'page' : undefined} onClick={() => setPage(n)}>{n}</button>
              ))}
              <button type="button" onClick={() => setPage(pageCourante + 1)} disabled={pageCourante === nbPages}>Suivant ›</button>
            </nav>
          )}

          <p className="insc-compte">{eleves.length} élève{eleves.length > 1 ? 's' : ''} · page {pageCourante}/{nbPages}</p>
        </>
      )}

      {/* Modale de confirmation (action en masse) */}
      {batch && (
        <div className="prof-modal-fond" onClick={() => !batchEnCours && setBatch(null)}>
          <div className="prof-modal carte" role="dialog" aria-modal="true" onClick={(ev) => ev.stopPropagation()}>
            <button type="button" className="prof-modal-fermer" onClick={() => setBatch(null)} aria-label="Fermer">×</button>
            <h2 style={{ marginBottom: '.75rem' }}>{batch === 'marquer' ? 'Marquer tous à jour' : 'Réinitialiser tous'}</h2>
            <p style={{ color: '#4A5568', marginBottom: '1.25rem' }}>
              Voulez-vous vraiment marquer <strong>tous les élèves de {niveau}</strong>
              {batch === 'marquer' ? ' comme « à jour »' : ' comme « non à jour »'} pour le {TRIMESTRES.find((t) => t.valeur === trimestre)?.libelle} ?
            </p>
            <div className="badges-actions" style={{ justifyContent: 'flex-end' }}>
              <button type="button" className="insc-btn-reinit" onClick={() => setBatch(null)} disabled={batchEnCours}>Annuler</button>
              <button type="button" className={`eco-batch-btn ${batch === 'marquer' ? 'eco-batch-ok' : 'eco-batch-non'}`}
                onClick={confirmerBatch} disabled={batchEnCours}>
                {batchEnCours ? 'Traitement…' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
