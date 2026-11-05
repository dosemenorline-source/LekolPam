import { useEffect, useMemo, useRef, useState } from 'react';
import { adminApi, directionApi, ancienEleveApi, permissionsApi } from '../../services/api.js';
import { anneeScolaireCourante } from '../../utils/libelles.js';
import Alerte from '../../components/Alerte.jsx';
import Chargement from '../../components/Chargement.jsx';
import Icone from '../../components/Icone.jsx';

const PAR_PAGE = 15;

const TRIMESTRES = [
  { valeur: '1er_trimestre', libelle: '1er trimestre' },
  { valeur: '2e_trimestre', libelle: '2e trimestre' },
  { valeur: '3e_trimestre', libelle: '3e trimestre' },
];

// Suggestions (45 dernières années scolaires) — n'importe quelle année au
// format AAAA-AAAA reste saisissable, y compris pour des dossiers anciens
// (anciens élèves) de plus de 30 ans.
function anneesScolaires() {
  const a = new Date().getFullYear();
  const annees = [];
  for (let y = a + 1; y >= a - 45; y -= 1) annees.push(`${y}-${y + 1}`);
  return annees;
}

export default function AdminNotes() {
  const [niveaux, setNiveaux] = useState([]);
  const [niveau, setNiveau] = useState('');
  const [periode, setPeriode] = useState('1er_trimestre');
  const [annee, setAnnee] = useState(anneeScolaireCourante());

  const [eleves, setEleves] = useState([]);
  const [matieres, setMatieres] = useState([]);
  const [notes, setNotes] = useState([]);
  const [chargement, setChargement] = useState(false);
  const [page, setPage] = useState(1);

  const [form, setForm] = useState({ idEleve: '', idMatiere: '', valeur: '', bareme: '100' });
  const [erreur, setErreur] = useState('');
  const [msg, setMsg] = useState('');
  const [enCours, setEnCours] = useState(false);

  // Le propriétaire peut désactiver la saisie — voir /proprietaire.
  const [saisieAutorisee, setSaisieAutorisee] = useState(true);
  useEffect(() => {
    permissionsApi.lister()
      .then((d) => setSaisieAutorisee(d.permissions.find((p) => p.cle === 'notes_saisie')?.autorise ?? true))
      .catch(() => {});
  }, []);

  // Seuil de réussite (note de passage /100) — colore les notes, modifiable par le secrétariat.
  const [seuil, setSeuil] = useState(60);
  const [seuilForm, setSeuilForm] = useState('60');
  const [seuilEnCours, setSeuilEnCours] = useState(false);
  const [seuilMsg, setSeuilMsg] = useState('');
  useEffect(() => {
    directionApi.ecole()
      .then((d) => { setSeuil(d.seuilReussite); setSeuilForm(String(d.seuilReussite)); })
      .catch(() => {});
  }, []);

  const enregistrerSeuil = async () => {
    setSeuilMsg('');
    const val = Number(seuilForm);
    if (!Number.isFinite(val) || val < 0 || val > 100) { setSeuilMsg('Le seuil doit être un nombre entre 0 et 100.'); return; }
    setSeuilEnCours(true);
    try {
      await adminApi.majSeuilReussite(val);
      setSeuil(val);
      setSeuilMsg('Seuil de réussite enregistré.');
    } catch (err) { setSeuilMsg(err.message); }
    finally { setSeuilEnCours(false); }
  };

  // Modales
  const [edition, setEdition] = useState(null);       // note en cours de modification
  const [editVal, setEditVal] = useState('');
  const [editBareme, setEditBareme] = useState('100');
  const [suppression, setSuppression] = useState(null); // note à supprimer
  const [batch, setBatch] = useState(null);            // 'valider' | 'supprimer'
  const [modalEnCours, setModalEnCours] = useState(false);
  const [erreurModal, setErreurModal] = useState('');

  const formRef = useRef(null);

  // Niveaux connus (matières existantes + élèves actifs + anciens élèves)
  useEffect(() => {
    ancienEleveApi.niveaux()
      .then((d) => setNiveaux(d.niveaux || []))
      .catch(() => {});
  }, []);

  // Référentiels (élèves + matières) quand le niveau change
  useEffect(() => {
    if (!niveau) { setEleves([]); setMatieres([]); return; }
    adminApi.eleves(niveau).then((d) => setEleves(d.eleves)).catch((e) => setErreur(e.message));
    adminApi.matieres(niveau).then((d) => setMatieres(d.matieres)).catch((e) => setErreur(e.message));
  }, [niveau]);

  const chargerNotes = () => {
    if (!niveau) { setNotes([]); return; }
    setChargement(true);
    adminApi.notes({ niveau, periode, anneeScolaire: annee })
      .then((d) => setNotes(d.notes))
      .catch((e) => setErreur(e.message))
      .finally(() => setChargement(false));
  };
  useEffect(chargerNotes, [niveau, periode, annee]);
  useEffect(() => { setPage(1); }, [niveau, periode, annee]);

  const majForm = (champ) => (e) => setForm({ ...form, [champ]: e.target.value });

  const nbPages = Math.max(1, Math.ceil(notes.length / PAR_PAGE));
  const pageCourante = Math.min(page, nbPages);
  const visibles = notes.slice((pageCourante - 1) * PAR_PAGE, pageCourante * PAR_PAGE);

  const saisir = async (e) => {
    e.preventDefault();
    setErreur(''); setMsg('');
    if (!form.idEleve || !form.idMatiere) { setErreur('Choisissez un élève et une matière.'); return; }
    const bareme = Number(form.bareme);
    if (form.bareme === '' || Number.isNaN(bareme) || bareme <= 0) { setErreur('Le barème (« sur X ») doit être un nombre positif.'); return; }
    const val = Number(form.valeur);
    if (form.valeur === '' || Number.isNaN(val) || val < 0 || val > bareme) { setErreur(`La note doit être comprise entre 0 et ${bareme}.`); return; }
    setEnCours(true);
    try {
      await adminApi.creerNote({
        idEleve: Number(form.idEleve), idMatiere: Number(form.idMatiere),
        periode, anneeScolaire: annee, valeur: val, bareme,
      });
      setMsg('Note saisie.');
      setForm({ ...form, valeur: '' });
      chargerNotes();
    } catch (err) { setErreur(err.message); }
    finally { setEnCours(false); }
  };

  const valider = async (id) => {
    setErreur('');
    try { await adminApi.validerNote(id); chargerNotes(); }
    catch (err) { setErreur(err.message); }
  };

  const enregistrerEdition = async () => {
    const bareme = Number(editBareme);
    setErreurModal('');
    if (editBareme === '' || Number.isNaN(bareme) || bareme <= 0) { setErreurModal('Le barème (« sur X ») doit être un nombre positif.'); return; }
    const val = Number(editVal);
    if (editVal === '' || Number.isNaN(val) || val < 0 || val > bareme) { setErreurModal(`La note doit être comprise entre 0 et ${bareme}.`); return; }
    setModalEnCours(true);
    try {
      await adminApi.majNote(edition.id, { valeur: val, bareme });
      setEdition(null); setMsg('Note mise à jour.'); chargerNotes();
    } catch (err) { setErreurModal(err.message); }
    finally { setModalEnCours(false); }
  };

  const confirmerSuppression = async () => {
    setModalEnCours(true); setErreurModal('');
    try {
      await adminApi.supprimerNote(suppression.id);
      setSuppression(null); setMsg('Note supprimée.'); chargerNotes();
    } catch (err) { setErreurModal(err.message); }
    finally { setModalEnCours(false); }
  };

  const confirmerBatch = async () => {
    setModalEnCours(true); setErreurModal('');
    try {
      if (batch === 'valider') {
        await Promise.all(notes.filter((n) => n.statut_validation === 'saisie').map((n) => adminApi.validerNote(n.id)));
      } else {
        await Promise.all(notes.map((n) => adminApi.supprimerNote(n.id)));
      }
      setBatch(null); chargerNotes();
    } catch (err) { setErreurModal(err.message); setBatch(null); }
    finally { setModalEnCours(false); }
  };

  const reinitialiser = () => { setNiveau(''); setPeriode('1er_trimestre'); setAnnee(anneeScolaireCourante()); };
  const allerAuFormulaire = () => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });

  return (
    <div className="insc-page notes-page">
      <div className="page-entete">
        <h1>Saisie des notes</h1>
        <p>Saisissez et validez les notes par niveau, matière et trimestre.</p>
      </div>

      {/* Seuil de réussite : colore les notes ci-dessous (vert = réussi, rouge = échec) */}
      <div className="carte" style={{ marginBottom: '1rem' }}>
        <div className="notes-section-titre" style={{ marginTop: 0 }}>Note de passage</div>
        <div className="rangee" style={{ gap: '.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="texte-gris" style={{ fontSize: '.88rem' }}>
            Une note supérieure ou égale au seuil est marquée <span style={{ color: 'var(--s-vert, #38A169)', fontWeight: 700 }}>réussie</span>,
            en dessous <span style={{ color: 'var(--s-rouge, #E53E3E)', fontWeight: 700 }}>échec</span>.
          </span>
          <input type="number" min="0" max="100" step="0.5" value={seuilForm}
            onChange={(e) => setSeuilForm(e.target.value)} style={{ width: 90 }} />
          <button type="button" className="notes-saisir" onClick={enregistrerSeuil} disabled={seuilEnCours}>
            {seuilEnCours ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
        {seuilMsg && <p style={{ fontSize: '.85rem', margin: '.5rem 0 0' }}>{seuilMsg}</p>}
      </div>

      {/* Filtres */}
      <div className="insc-barre">
        <select value={niveau} onChange={(e) => setNiveau(e.target.value)} aria-label="Niveau">
          <option value="">Choisir un niveau…</option>
          {niveaux.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <select value={periode} onChange={(e) => setPeriode(e.target.value)} aria-label="Trimestre">
          {TRIMESTRES.map((t) => <option key={t.valeur} value={t.valeur}>{t.libelle}</option>)}
        </select>
        <input list="notes-annees" value={annee} onChange={(e) => setAnnee(e.target.value)}
          placeholder="2015-2016" aria-label="Année scolaire" style={{ width: 130 }} />
        <datalist id="notes-annees">
          {anneesScolaires().map((a) => <option key={a} value={a} />)}
        </datalist>
        <button type="button" className="insc-btn-reinit" onClick={reinitialiser} disabled={!niveau}>Réinitialiser</button>
      </div>

      {erreur && <Alerte type="erreur">{erreur}</Alerte>}
      {!saisieAutorisee && (
        <Alerte type="info">
          La saisie des notes a été désactivée par le propriétaire de l'école. Vous pouvez consulter les notes, mais pas les modifier.
        </Alerte>
      )}

      {!niveau ? (
        <div className="insc-vide">
          <div className="insc-vide-ico" aria-hidden="true"><Icone nom="edit" size={44} /></div>
          <p>Sélectionnez un niveau pour commencer la saisie.</p>
        </div>
      ) : (
        <>
          {/* Nouvelle note */}
          {saisieAutorisee && (
            <>
              <div className="notes-section-titre" ref={formRef}>Nouvelle note</div>
              <div className="carte">
                {msg && <Alerte type="info">{msg}</Alerte>}
                <form onSubmit={saisir} className="notes-form-grille">
                  <div className="notes-champ">
                    <label htmlFor="note-add-eleve">Élève</label>
                    <select id="note-add-eleve" value={form.idEleve} onChange={majForm('idEleve')}>
                      <option value="">— Choisir —</option>
                      {eleves.map((el) => <option key={el.id} value={el.id}>{el.nom}</option>)}
                    </select>
                  </div>
                  <div className="notes-champ">
                    <label htmlFor="note-add-matiere">Matière</label>
                    <select id="note-add-matiere" value={form.idMatiere} onChange={majForm('idMatiere')}>
                      <option value="">— Choisir —</option>
                      {matieres.map((m) => <option key={m.id} value={m.id}>{m.nom} (coef {Number(m.coefficient).toFixed(2)})</option>)}
                    </select>
                  </div>
                  <div className="notes-champ">
                    <label htmlFor="note-add-valeur">Note</label>
                    <input id="note-add-valeur" type="number" min="0" step="0.01" value={form.valeur} onChange={majForm('valeur')} style={{ width: 90 }} />
                  </div>
                  <div className="notes-champ">
                    <label htmlFor="note-add-bareme">Sur</label>
                    <input id="note-add-bareme" list="notes-baremes" type="number" min="0.01" step="0.01"
                      value={form.bareme} onChange={majForm('bareme')} style={{ width: 90 }} />
                    <datalist id="notes-baremes">
                      <option value="10" /><option value="20" /><option value="100" />
                    </datalist>
                  </div>
                  <button type="submit" className="notes-saisir" disabled={enCours}>{enCours ? 'Saisie…' : 'Saisir'}</button>
                </form>
                {eleves.length === 0 && <p className="texte-gris" style={{ marginTop: '.6rem' }}>Aucun élève pour ce niveau.</p>}
                {matieres.length === 0 && <p className="texte-gris" style={{ marginTop: '.6rem' }}>Aucune matière configurée pour ce niveau (voir Direction).</p>}
              </div>
            </>
          )}
          {!saisieAutorisee && msg && <Alerte type="info">{msg}</Alerte>}

          {/* Notes saisies */}
          <div className="notes-section-titre">Notes saisies</div>
          {chargement ? (
            <Chargement texte="Chargement des notes…" />
          ) : notes.length === 0 ? (
            <div className="insc-vide">
              <div className="insc-vide-ico" aria-hidden="true"><Icone nom="inbox" size={44} /></div>
              <p>Aucune note saisie pour ce trimestre.</p>
              {saisieAutorisee && (
                <button type="button" className="notes-saisir" onClick={allerAuFormulaire}>Saisir une note</button>
              )}
            </div>
          ) : (
            <>
              <div className="tableau-enveloppe">
                <table className="tableau insc-tableau">
                  <thead>
                    <tr><th>Élève</th><th>Matière</th><th>Coef.</th><th>Note</th><th>Statut</th><th>Actions</th></tr>
                  </thead>
                  <tbody>
                    {visibles.map((n) => (
                      <tr key={n.id}>
                        <td className="insc-nom">{n.eleve_nom}</td>
                        <td>{n.matiere}</td>
                        <td>{n.coefficient != null ? Number(n.coefficient).toFixed(2) : '—'}</td>
                        <td className="notes-note-val">
                          <span style={{ color: (Number(n.valeur) / (Number(n.bareme) || 100)) * 100 >= seuil ? 'var(--s-vert, #38A169)' : 'var(--s-rouge, #E53E3E)', fontWeight: 700 }}>
                            {Number(n.valeur).toFixed(2)}/{Number(n.bareme ?? 100).toFixed(0)}
                          </span>
                        </td>
                        <td>
                          <span className={`insc-badge ${n.statut_validation === 'validee' ? 'insc-badge-vert' : 'insc-badge-or'}`}>
                            {n.statut_validation === 'validee' ? 'Validée' : 'En attente'}
                          </span>
                        </td>
                        <td>
                          {saisieAutorisee ? (
                            <>
                              {n.statut_validation === 'saisie' && (
                                <button type="button" className="paie-btn paie-valider" onClick={() => valider(n.id)}>Valider</button>
                              )}
                              <button type="button" className="paie-btn paie-details" onClick={() => { setEdition(n); setEditVal(String(n.valeur)); setEditBareme(String(n.bareme ?? 100)); setErreurModal(''); }}>Modifier</button>
                              <button type="button" className="paie-btn paie-rejeter" onClick={() => { setSuppression(n); setErreurModal(''); }}>Supprimer</button>
                            </>
                          ) : <span className="texte-gris">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {saisieAutorisee && (
                <div className="eco-batch">
                  <button type="button" className="eco-batch-btn eco-batch-ok" onClick={() => { setBatch('valider'); setErreurModal(''); }}><Icone nom="check" /> Valider toutes les notes</button>
                  <button type="button" className="eco-batch-btn eco-batch-non" onClick={() => { setBatch('supprimer'); setErreurModal(''); }}><Icone nom="close" /> Supprimer toutes les notes</button>
                </div>
              )}

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

              <p className="insc-compte">{notes.length} note{notes.length > 1 ? 's' : ''} · page {pageCourante}/{nbPages}</p>
            </>
          )}
        </>
      )}

      <footer className="insc-pied">© {new Date().getFullYear()} Lekòl Pam. Tous droits réservés.</footer>

      {/* Modale : modifier une note */}
      {edition && (
        <div className="prof-modal-fond" onClick={() => !modalEnCours && setEdition(null)}>
          <div className="prof-modal carte" role="dialog" aria-modal="true" onClick={(ev) => ev.stopPropagation()}>
            <button type="button" className="prof-modal-fermer" onClick={() => setEdition(null)} aria-label="Fermer">×</button>
            <h2 style={{ marginBottom: '.5rem' }}>Modifier la note</h2>
            <p style={{ color: '#4A5568', marginBottom: '1rem' }}>{edition.eleve_nom} — {edition.matiere}</p>
            {erreurModal && <Alerte type="erreur">{erreurModal}</Alerte>}
            <div className="notes-modal-champ">
              <label htmlFor="note-edit-valeur">Note</label>
              <input id="note-edit-valeur" type="number" min="0" step="0.01" value={editVal} onChange={(e) => setEditVal(e.target.value)} autoFocus style={{ width: 90 }} />
            </div>
            <div className="notes-modal-champ">
              <label htmlFor="note-edit-bareme">Sur</label>
              <input id="note-edit-bareme" type="number" min="0.01" step="0.01" value={editBareme} onChange={(e) => setEditBareme(e.target.value)} style={{ width: 90 }} />
            </div>
            <div className="badges-actions" style={{ justifyContent: 'flex-end' }}>
              <button type="button" className="insc-btn-reinit" onClick={() => setEdition(null)} disabled={modalEnCours}>Annuler</button>
              <button type="button" className="paie-btn paie-valider" onClick={enregistrerEdition} disabled={modalEnCours}>
                {modalEnCours ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modale : supprimer une note */}
      {suppression && (
        <div className="prof-modal-fond" onClick={() => !modalEnCours && setSuppression(null)}>
          <div className="prof-modal carte" role="dialog" aria-modal="true" onClick={(ev) => ev.stopPropagation()}>
            <button type="button" className="prof-modal-fermer" onClick={() => setSuppression(null)} aria-label="Fermer">×</button>
            <h2 style={{ marginBottom: '.75rem' }}>Supprimer la note</h2>
            <p style={{ color: '#4A5568', marginBottom: '1.25rem' }}>
              Voulez-vous vraiment supprimer la note de <strong>{suppression.eleve_nom}</strong> en <strong>{suppression.matiere}</strong> ? Cette action est définitive.
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

      {/* Modale : action en masse */}
      {batch && (
        <div className="prof-modal-fond" onClick={() => !modalEnCours && setBatch(null)}>
          <div className="prof-modal carte" role="dialog" aria-modal="true" onClick={(ev) => ev.stopPropagation()}>
            <button type="button" className="prof-modal-fermer" onClick={() => setBatch(null)} aria-label="Fermer">×</button>
            <h2 style={{ marginBottom: '.75rem' }}>{batch === 'valider' ? 'Valider toutes les notes' : 'Supprimer toutes les notes'}</h2>
            <p style={{ color: '#4A5568', marginBottom: '1.25rem' }}>
              {batch === 'valider'
                ? 'Toutes les notes « en attente » de ce filtre seront validées.'
                : 'Toutes les notes affichées pour ce filtre seront supprimées définitivement.'}
            </p>
            {erreurModal && <Alerte type="erreur">{erreurModal}</Alerte>}
            <div className="badges-actions" style={{ justifyContent: 'flex-end' }}>
              <button type="button" className="insc-btn-reinit" onClick={() => setBatch(null)} disabled={modalEnCours}>Annuler</button>
              <button type="button" className={`eco-batch-btn ${batch === 'valider' ? 'eco-batch-ok' : 'eco-batch-non'}`} onClick={confirmerBatch} disabled={modalEnCours}>
                {modalEnCours ? 'Traitement…' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
