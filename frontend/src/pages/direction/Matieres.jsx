import { useEffect, useMemo, useRef, useState } from 'react';
import { directionApi, ancienEleveApi, permissionsApi } from '../../services/api.js';
import Alerte from '../../components/Alerte.jsx';
import Chargement from '../../components/Chargement.jsx';
import Icone from '../../components/Icone.jsx';

const PAR_PAGE = 15;

export default function Matieres() {
  const [niveaux, setNiveaux] = useState([]);
  const [niveau, setNiveau] = useState('');
  const [matieres, setMatieres] = useState([]);
  const [chargement, setChargement] = useState(false);
  const [page, setPage] = useState(1);
  // Le propriétaire peut désactiver cette gestion — voir /proprietaire.
  const [gestionAutorisee, setGestionAutorisee] = useState(true);
  useEffect(() => {
    permissionsApi.lister()
      .then((d) => setGestionAutorisee(d.permissions.find((p) => p.cle === 'matieres_gestion')?.autorise ?? true))
      .catch(() => {});
  }, []);

  const [form, setForm] = useState({ nom: '', coefficient: '1' });
  const [erreur, setErreur] = useState('');
  const [msg, setMsg] = useState('');
  const [enCours, setEnCours] = useState(false);

  const [edition, setEdition] = useState(null);        // matière en modification
  const [editForm, setEditForm] = useState({ nom: '', coefficient: '' });
  const [suppression, setSuppression] = useState(null); // matière à supprimer
  const [modalEnCours, setModalEnCours] = useState(false);
  const [erreurModal, setErreurModal] = useState('');

  const formRef = useRef(null);

  // Niveaux connus (matières existantes + élèves actifs + anciens élèves)
  useEffect(() => {
    ancienEleveApi.niveaux()
      .then((d) => setNiveaux(d.niveaux || []))
      .catch(() => {});
  }, []);

  const charger = () => {
    if (!niveau) { setMatieres([]); return; }
    setChargement(true);
    directionApi.matieres(niveau)
      .then((d) => setMatieres(d.matieres))
      .catch((e) => setErreur(e.message))
      .finally(() => setChargement(false));
  };
  useEffect(charger, [niveau]);
  useEffect(() => { setPage(1); }, [niveau]);

  const nbPages = Math.max(1, Math.ceil(matieres.length / PAR_PAGE));
  const pageCourante = Math.min(page, nbPages);
  const visibles = matieres.slice((pageCourante - 1) * PAR_PAGE, pageCourante * PAR_PAGE);

  const ajouter = async (e) => {
    e.preventDefault();
    setErreur(''); setMsg('');
    if (!form.nom.trim()) { setErreur('Le nom de la matière est requis.'); return; }
    const coef = Number(form.coefficient);
    if (Number.isNaN(coef) || coef <= 0) { setErreur('Le coefficient doit être un nombre positif.'); return; }
    setEnCours(true);
    try {
      await directionApi.creerMatiere({ nom: form.nom.trim(), niveau, coefficient: coef });
      setMsg('Matière ajoutée.'); setForm({ nom: '', coefficient: '1' }); charger();
    } catch (err) { setErreur(err.message); }
    finally { setEnCours(false); }
  };

  const ouvrirEdition = (m) => {
    setEdition(m); setEditForm({ nom: m.nom, coefficient: String(m.coefficient) }); setErreurModal('');
  };

  const enregistrerEdition = async () => {
    setErreurModal('');
    if (!editForm.nom.trim()) { setErreurModal('Le nom est requis.'); return; }
    const coef = Number(editForm.coefficient);
    if (Number.isNaN(coef) || coef <= 0) { setErreurModal('Le coefficient doit être un nombre positif.'); return; }
    setModalEnCours(true);
    try {
      await directionApi.majMatiere(edition.id, { nom: editForm.nom.trim(), niveau: edition.niveau, coefficient: coef });
      setEdition(null); setMsg('Matière mise à jour.'); charger();
    } catch (err) { setErreurModal(err.message); }
    finally { setModalEnCours(false); }
  };

  const confirmerSuppression = async () => {
    setModalEnCours(true); setErreurModal('');
    try {
      await directionApi.supprimerMatiere(suppression.id);
      setSuppression(null); setMsg('Matière supprimée.'); charger();
    } catch (err) { setErreurModal(err.message); }
    finally { setModalEnCours(false); }
  };

  const allerAuFormulaire = () => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });

  return (
    <div className="insc-page matieres-page">
      <div className="page-entete">
        <h1>Matières &amp; coefficients</h1>
        <p>Configurez les matières et leurs coefficients, par niveau.</p>
      </div>

      {/* Filtre niveau */}
      <div className="insc-barre">
        <input list="matieres-niveaux" value={niveau} onChange={(e) => setNiveau(e.target.value)}
          placeholder="Choisir ou saisir un niveau…" aria-label="Niveau" style={{ minWidth: 220 }} />
        <datalist id="matieres-niveaux">
          {niveaux.map((n) => <option key={n} value={n} />)}
        </datalist>
        <button type="button" className="insc-btn-reinit" onClick={() => setNiveau('')} disabled={!niveau}>Réinitialiser</button>
      </div>

      {erreur && <Alerte type="erreur">{erreur}</Alerte>}
      {msg && <Alerte type="info">{msg}</Alerte>}
      {!gestionAutorisee && (
        <Alerte type="info">
          La gestion des matières a été désactivée par le propriétaire de l'école. Vous pouvez consulter la liste, mais pas la modifier.
        </Alerte>
      )}

      {!niveau ? (
        <div className="insc-vide">
          <div className="insc-vide-ico" aria-hidden="true">📚</div>
          <p>Sélectionnez un niveau pour configurer ses matières.</p>
        </div>
      ) : (
        <>
          {/* Ajouter une matière */}
          {gestionAutorisee && (
            <>
              <div className="notes-section-titre" ref={formRef}>Ajouter une matière</div>
              <div className="carte">
                <form onSubmit={ajouter} className="notes-form-grille">
                  <div className="notes-champ" style={{ flex: '1 1 220px' }}>
                    <label htmlFor="mat-add-nom">Nom</label>
                    <input id="mat-add-nom" value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} placeholder="ex. Mathématiques" />
                  </div>
                  <div className="notes-champ">
                    <label htmlFor="mat-add-coef">Coefficient</label>
                    <input id="mat-add-coef" type="number" min="0.1" max="99.99" step="0.1" value={form.coefficient}
                      onChange={(e) => setForm({ ...form, coefficient: e.target.value })} style={{ width: 120 }} />
                  </div>
                  <button type="submit" className="eco-batch-btn eco-batch-ok" disabled={enCours}>{enCours ? 'Ajout…' : 'Ajouter'}</button>
                </form>
              </div>
            </>
          )}

          {/* Tableau */}
          <div className="notes-section-titre">Matières — {niveau}</div>
          {chargement ? (
            <Chargement texte="Chargement des matières…" />
          ) : matieres.length === 0 ? (
            <div className="insc-vide">
              <div className="insc-vide-ico" aria-hidden="true"><Icone nom="inbox" size={44} /></div>
              <p>Aucune matière configurée pour ce niveau.</p>
              {gestionAutorisee && (
                <button type="button" className="eco-batch-btn eco-batch-ok" onClick={allerAuFormulaire}>Ajouter une matière</button>
              )}
            </div>
          ) : (
            <>
              <div className="tableau-enveloppe">
                <table className="tableau insc-tableau">
                  <thead>
                    <tr><th>Matière</th><th>Niveau</th><th>Coefficient</th><th>Actif</th><th>Actions</th></tr>
                  </thead>
                  <tbody>
                    {visibles.map((m) => (
                      <tr key={m.id}>
                        <td className="insc-nom">{m.nom}</td>
                        <td>{m.niveau}</td>
                        <td>{Number(m.coefficient).toFixed(2)}</td>
                        <td>
                          <span className={`insc-badge ${m.actif ? 'insc-badge-vert' : 'insc-badge-rouge'}`}>
                            {m.actif ? 'Oui' : 'Non'}
                          </span>
                        </td>
                        <td>
                          {gestionAutorisee ? (
                            <>
                              <button type="button" className="mat-modifier" onClick={() => ouvrirEdition(m)}>Modifier</button>
                              <button type="button" className="paie-btn paie-rejeter" onClick={() => { setSuppression(m); setErreurModal(''); }}>Supprimer</button>
                            </>
                          ) : <span className="texte-gris">—</span>}
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

              <p className="insc-compte">{matieres.length} matière{matieres.length > 1 ? 's' : ''} · page {pageCourante}/{nbPages}</p>
            </>
          )}
        </>
      )}

      <footer className="insc-pied">© {new Date().getFullYear()} Lekòl Pam. Tous droits réservés.</footer>

      {/* Modale : modifier */}
      {edition && (
        <div className="prof-modal-fond" onClick={() => !modalEnCours && setEdition(null)}>
          <div className="prof-modal carte" role="dialog" aria-modal="true" onClick={(ev) => ev.stopPropagation()}>
            <button type="button" className="prof-modal-fermer" onClick={() => setEdition(null)} aria-label="Fermer">×</button>
            <h2 style={{ marginBottom: '1rem' }}>Modifier la matière</h2>
            {erreurModal && <Alerte type="erreur">{erreurModal}</Alerte>}
            <div className="notes-modal-champ">
              <label htmlFor="mat-edit-nom">Nom</label>
              <input id="mat-edit-nom" value={editForm.nom} onChange={(e) => setEditForm({ ...editForm, nom: e.target.value })} autoFocus />
            </div>
            <div className="notes-modal-champ">
              <label htmlFor="mat-edit-coef">Coefficient</label>
              <input id="mat-edit-coef" type="number" min="0.1" max="99.99" step="0.1" value={editForm.coefficient}
                onChange={(e) => setEditForm({ ...editForm, coefficient: e.target.value })} />
            </div>
            <div className="badges-actions" style={{ justifyContent: 'flex-end' }}>
              <button type="button" className="insc-btn-reinit" onClick={() => setEdition(null)} disabled={modalEnCours}>Annuler</button>
              <button type="button" className="mat-modifier" onClick={enregistrerEdition} disabled={modalEnCours}>
                {modalEnCours ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modale : supprimer */}
      {suppression && (
        <div className="prof-modal-fond" onClick={() => !modalEnCours && setSuppression(null)}>
          <div className="prof-modal carte" role="dialog" aria-modal="true" onClick={(ev) => ev.stopPropagation()}>
            <button type="button" className="prof-modal-fermer" onClick={() => setSuppression(null)} aria-label="Fermer">×</button>
            <h2 style={{ marginBottom: '.75rem' }}>Supprimer la matière</h2>
            <p style={{ color: '#4A5568', marginBottom: '1.25rem' }}>
              Voulez-vous vraiment supprimer la matière « <strong>{suppression.nom}</strong> » ? Cette action est définitive.
            </p>
            {erreurModal && <Alerte type="erreur">{erreurModal}</Alerte>}
            <div className="badges-actions" style={{ justifyContent: 'flex-end' }}>
              <button type="button" className="insc-btn-reinit" onClick={() => setSuppression(null)} disabled={modalEnCours}>Annuler</button>
              <button type="button" className="paie-btn paie-rejeter" onClick={confirmerSuppression} disabled={modalEnCours}>
                {modalEnCours ? 'Suppression…' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
