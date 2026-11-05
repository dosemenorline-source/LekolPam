import { useEffect, useMemo, useState } from 'react';
import { adminApi, urlPreuvePaiement } from '../../../services/api.js';
import { libelleTypeFrais, montantFr, dateFr } from '../../../utils/libelles.js';
import Alerte from '../../../components/Alerte.jsx';
import Chargement from '../../../components/Chargement.jsx';
import Icone from '../../../components/Icone.jsx';

const PAR_PAGE = 10;

const LIBELLE_STATUT = { en_attente: 'En attente', valide: 'Validé', rejete: 'Rejeté' };
const tonStatut = (s) => (s === 'valide' ? 'vert' : s === 'rejete' ? 'rouge' : 'or');

// Un paiement mobile (MonCash/NatCash/KashPay, via plopplop) n'a jamais de
// preuve téléversée : sa transaction est vérifiée directement auprès du
// fournisseur, ce qui en tient lieu — seul un dépôt manuel exige une preuve.
const LIBELLE_METHODE = { moncash: 'MonCash', natcash: 'NatCash', kashpaw: 'KashPay', carte: 'Carte Visa/Mastercard' };
const estMobile = (p) => Object.prototype.hasOwnProperty.call(LIBELLE_METHODE, p.methode_paiement);

function BadgeStatut({ statut }) {
  return <span className={`insc-badge insc-badge-${tonStatut(statut)}`}>{LIBELLE_STATUT[statut] || statut}</span>;
}

export default function PaiementsTab() {
  const [tous, setTous] = useState(null);
  const [erreur, setErreur] = useState('');

  // Filtres
  const [statut, setStatut] = useState('');
  const [type, setType] = useState('');
  const [du, setDu] = useState('');
  const [au, setAu] = useState('');
  const [page, setPage] = useState(1);

  // Modales
  const [details, setDetails] = useState(null);          // paiement affiché (preuve / détails)
  const [confirmation, setConfirmation] = useState(null); // { paiement, decision }
  const [commentaire, setCommentaire] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [erreurModal, setErreurModal] = useState('');

  useEffect(() => {
    adminApi.paiements('')
      .then((d) => setTous(d.paiements))
      .catch((e) => setErreur(e.message));
  }, []);

  useEffect(() => { setPage(1); }, [statut, type, du, au]);

  const types = useMemo(() => {
    if (!tous) return [];
    return [...new Set(tous.map((p) => p.type_frais).filter(Boolean))];
  }, [tous]);

  const stats = useMemo(() => {
    const base = tous || [];
    const c = (s) => base.filter((p) => p.statut === s).length;
    return { total: base.length, attente: c('en_attente'), valide: c('valide'), rejete: c('rejete') };
  }, [tous]);

  const filtres = useMemo(() => {
    if (!tous) return [];
    return tous.filter((p) => {
      if (statut && p.statut !== statut) return false;
      if (type && p.type_frais !== type) return false;
      const jour = (p.cree_le || '').slice(0, 10);
      if (du && jour < du) return false;
      if (au && jour > au) return false;
      return true;
    });
  }, [tous, statut, type, du, au]);

  const nbPages = Math.max(1, Math.ceil(filtres.length / PAR_PAGE));
  const pageCourante = Math.min(page, nbPages);
  const visibles = filtres.slice((pageCourante - 1) * PAR_PAGE, pageCourante * PAR_PAGE);

  const reinitialiser = () => { setStatut(''); setType(''); setDu(''); setAu(''); };
  const filtresActifs = statut || type || du || au;

  const ouvrirConfirmation = (paiement, decision) => {
    setConfirmation({ paiement, decision }); setCommentaire(''); setErreurModal('');
  };

  const confirmer = async () => {
    const { paiement, decision } = confirmation;
    setErreurModal('');
    if (decision === 'rejete' && !commentaire.trim()) { setErreurModal('Indiquez un motif de rejet.'); return; }
    setEnCours(true);
    try {
      await adminApi.validationPaiement(paiement.id, { statut: decision, commentaire: commentaire || undefined });
      setTous((prev) => prev.map((p) => (p.id === paiement.id ? { ...p, statut: decision } : p)));
      setConfirmation(null); setCommentaire('');
    } catch (err) {
      setErreurModal(err.message);
    } finally {
      setEnCours(false);
    }
  };

  return (
    <div className="eco-onglet-corps">
      {/* Résumé */}
      <div className="insc-resume">
        <span className="insc-stat"><strong>{stats.total}</strong> Total</span>
        <span className="insc-stat insc-stat-or"><strong>{stats.attente}</strong> En attente</span>
        <span className="insc-stat insc-stat-vert"><strong>{stats.valide}</strong> Validé{stats.valide > 1 ? 's' : ''}</span>
        <span className="insc-stat insc-stat-rouge"><strong>{stats.rejete}</strong> Rejeté{stats.rejete > 1 ? 's' : ''}</span>
      </div>

      {/* Filtres */}
      <div className="insc-barre">
        <select value={statut} onChange={(e) => setStatut(e.target.value)} aria-label="Filtrer par statut">
          <option value="">Tous les statuts</option>
          {Object.entries(LIBELLE_STATUT).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select value={type} onChange={(e) => setType(e.target.value)} aria-label="Filtrer par type">
          <option value="">Tous les types</option>
          {types.map((t) => <option key={t} value={t}>{libelleTypeFrais(t)}</option>)}
        </select>
        <label className="paie-date-champ">Du <input type="date" value={du} onChange={(e) => setDu(e.target.value)} /></label>
        <label className="paie-date-champ">Au <input type="date" value={au} onChange={(e) => setAu(e.target.value)} /></label>
        <button type="button" className="insc-btn-reinit" onClick={reinitialiser} disabled={!filtresActifs}>Réinitialiser</button>
      </div>

      {erreur && <Alerte type="erreur">{erreur}</Alerte>}

      {/* États */}
      {!tous ? (
        <Chargement texte="Chargement des paiements…" />
      ) : filtres.length === 0 ? (
        <div className="insc-vide">
          <div className="insc-vide-ico" aria-hidden="true"><Icone nom="inbox" size={44} /></div>
          <p>Aucun paiement trouvé.</p>
          {filtresActifs && <button type="button" className="insc-btn-reinit" onClick={reinitialiser}>Réinitialiser les filtres</button>}
        </div>
      ) : (
        <>
          <div className="tableau-enveloppe">
            <table className="tableau insc-tableau">
              <thead>
                <tr><th>Type</th><th>Montant</th><th>Statut</th><th>Preuve</th><th>Date</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {visibles.map((p) => (
                  <tr key={p.id}>
                    <td>{libelleTypeFrais(p.type_frais)}</td>
                    <td className="paie-montant">
                      {montantFr(p.montant, p.devise)}
                      {p.montant_suspect && (
                        <span className="insc-badge insc-badge-rouge" style={{ marginLeft: '.4rem' }}
                          title={`Tarif actuel : ${montantFr(p.tarif_actuel, p.devise)} — ce montant ne correspond pas au tarif en vigueur.`}>
                          <Icone nom="warning" size={12} /> Écart
                        </span>
                      )}
                    </td>
                    <td><BadgeStatut statut={p.statut} /></td>
                    <td>
                      {p.preuve_url
                        ? <button type="button" className="paie-btn paie-voir" onClick={() => setDetails(p)}>Voir</button>
                        : estMobile(p)
                          ? <span className="texte-gris">{LIBELLE_METHODE[p.methode_paiement]}</span>
                          : <span className="texte-gris">—</span>}
                    </td>
                    <td>{dateFr(p.cree_le)}</td>
                    <td>
                      {p.statut === 'en_attente' ? (
                        <>
                          <button type="button" className="paie-btn paie-valider" onClick={() => ouvrirConfirmation(p, 'valide')}>Valider</button>
                          <button type="button" className="paie-btn paie-rejeter" onClick={() => ouvrirConfirmation(p, 'rejete')}>Rejeter</button>
                        </>
                      ) : (
                        <button type="button" className="paie-btn paie-details" onClick={() => setDetails(p)}>Détails</button>
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
                <button key={n} type="button" className={n === pageCourante ? 'actif' : ''}
                  aria-current={n === pageCourante ? 'page' : undefined} onClick={() => setPage(n)}>{n}</button>
              ))}
              <button type="button" onClick={() => setPage(pageCourante + 1)} disabled={pageCourante === nbPages}>Suivant ›</button>
            </nav>
          )}

          <p className="insc-compte">
            {filtres.length} paiement{filtres.length > 1 ? 's' : ''}{filtresActifs ? ' (filtré)' : ''} · page {pageCourante}/{nbPages}
          </p>
        </>
      )}

      {/* Modale preuve / détails */}
      {details && (
        <div className="prof-modal-fond" onClick={() => setDetails(null)}>
          <div className="prof-modal carte" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="prof-modal-fermer" onClick={() => setDetails(null)} aria-label="Fermer">×</button>
            <h2 style={{ marginBottom: '.5rem' }}>{libelleTypeFrais(details.type_frais)}</h2>
            <dl className="paie-infos">
              <div><dt>Montant</dt><dd className="paie-montant">{montantFr(details.montant, details.devise)}</dd></div>
              <div><dt>Statut</dt><dd><BadgeStatut statut={details.statut} /></dd></div>
              <div><dt>Date</dt><dd>{dateFr(details.cree_le)}</dd></div>
            </dl>
            {details.montant_suspect && (
              <Alerte type="erreur">
                Ce montant ne correspond pas au tarif actuel ({montantFr(details.tarif_actuel, details.devise)}).
              </Alerte>
            )}
            {details.preuve_url ? (
              <>
                <iframe className="paie-preuve-cadre" src={urlPreuvePaiement(details.id)} title="Preuve de paiement" />
                <div className="badges-actions" style={{ justifyContent: 'flex-start', marginTop: '.75rem' }}>
                  <a className="paie-btn paie-voir" href={urlPreuvePaiement(details.id)} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>Télécharger</a>
                </div>
              </>
            ) : <Alerte type="info">Aucune preuve disponible.</Alerte>}
          </div>
        </div>
      )}

      {/* Modale de confirmation */}
      {confirmation && (
        <div className="prof-modal-fond" onClick={() => !enCours && setConfirmation(null)}>
          <div className="prof-modal carte" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="prof-modal-fermer" onClick={() => setConfirmation(null)} aria-label="Fermer">×</button>
            <h2 style={{ marginBottom: '.75rem' }}>
              {confirmation.decision === 'valide' ? 'Valider le paiement' : 'Rejeter le paiement'}
            </h2>
            <p style={{ marginBottom: '1rem', color: '#4A5568' }}>
              {libelleTypeFrais(confirmation.paiement.type_frais)} — <strong className="paie-montant">{montantFr(confirmation.paiement.montant, confirmation.paiement.devise)}</strong>
            </p>

            {erreurModal && <Alerte type="erreur">{erreurModal}</Alerte>}

            {confirmation.decision === 'valide' && confirmation.paiement.montant_suspect && (
              <Alerte type="erreur">
                Attention : ce montant ne correspond pas au tarif actuel
                ({montantFr(confirmation.paiement.tarif_actuel, confirmation.paiement.devise)}).
                Vérifiez la preuve avant de valider.
              </Alerte>
            )}

            {confirmation.decision === 'valide' && !estMobile(confirmation.paiement) && !confirmation.paiement.preuve_url && (
              <Alerte type="info">Aucune preuve téléversée : la validation est impossible.</Alerte>
            )}
            {confirmation.paiement.preuve_url && (
              <p style={{ marginBottom: '.75rem' }}>
                <a href={urlPreuvePaiement(confirmation.paiement.id)} target="_blank" rel="noreferrer">Voir la preuve téléversée</a>
              </p>
            )}
            {estMobile(confirmation.paiement) && !confirmation.paiement.preuve_url && (
              <Alerte type="info">
                Payé via {LIBELLE_METHODE[confirmation.paiement.methode_paiement]} — la transaction a été vérifiée
                directement auprès du fournisseur, aucune preuve n'est nécessaire.
              </Alerte>
            )}

            {confirmation.decision === 'rejete' && (
              <div className="champ">
                <label htmlFor="paie-motif-rejet">Motif du rejet (obligatoire)</label>
                <textarea id="paie-motif-rejet" rows={3} value={commentaire} onChange={(e) => setCommentaire(e.target.value)}
                  placeholder="Expliquez pourquoi ce paiement est rejeté…" />
              </div>
            )}

            <div className="badges-actions" style={{ justifyContent: 'flex-end', marginTop: '.5rem' }}>
              <button type="button" className="insc-btn-reinit" onClick={() => setConfirmation(null)} disabled={enCours}>Annuler</button>
              <button type="button"
                className={`paie-btn ${confirmation.decision === 'valide' ? 'paie-valider' : 'paie-rejeter'}`}
                onClick={confirmer}
                disabled={enCours || (confirmation.decision === 'valide' && !estMobile(confirmation.paiement) && !confirmation.paiement.preuve_url)}>
                {enCours ? 'Traitement…' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
