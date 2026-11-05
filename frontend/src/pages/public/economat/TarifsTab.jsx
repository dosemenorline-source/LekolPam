import { useEffect, useRef, useState } from 'react';
import { directionApi, economatApi } from '../../../services/api.js';
import { TYPES_FRAIS, libelleTypeFrais, montantFr, dateFr, tarifCourant } from '../../../utils/libelles.js';
import Alerte from '../../../components/Alerte.jsx';
import Chargement from '../../../components/Chargement.jsx';
import Icone from '../../../components/Icone.jsx';

const PAR_PAGE = 15;
const aujourdHui = () => new Date().toISOString().slice(0, 10);
const UNITES = ['', 'par an', 'par mois', 'par trimestre'];

function anneesScolaires() {
  const a = new Date().getFullYear();
  return [a - 1, a, a + 1].map((y) => `${y}-${y + 1}`);
}

export default function TarifsTab() {
  const [tarifs, setTarifs] = useState(null);
  const [erreur, setErreur] = useState('');
  const [msg, setMsg] = useState('');

  const [edition, setEdition] = useState(null); // type de frais en modification (modal)
  const [form, setForm] = useState({ montant: '', devise: 'HTG', dateEffective: '' });
  const [enCours, setEnCours] = useState(false);
  const [erreurModal, setErreurModal] = useState('');
  const [suppression, setSuppression] = useState(null); // tarif à supprimer (historique)

  const charger = () => directionApi.tarifs().then((d) => setTarifs(d.tarifs)).catch((e) => setErreur(e.message));
  useEffect(() => { charger(); }, []);

  const ouvrirEdition = (typeFrais) => {
    const courant = tarifCourant(tarifs || [], typeFrais);
    setEdition(typeFrais);
    setForm({ montant: courant ? String(courant.montant) : '', devise: courant?.devise || 'HTG', dateEffective: aujourdHui() });
    setErreurModal('');
  };

  const enregistrer = async () => {
    setErreurModal('');
    const montant = Number(form.montant);
    if (Number.isNaN(montant) || montant <= 0) { setErreurModal('Le montant doit être un nombre positif.'); return; }
    if (!form.dateEffective) { setErreurModal("La date d'effet est requise."); return; }
    setEnCours(true);
    try {
      await directionApi.creerTarif({ typeFrais: edition, montant, devise: form.devise, dateEffective: form.dateEffective });
      setMsg(`Tarif « ${libelleTypeFrais(edition)} » mis à jour.`); setEdition(null); charger();
    } catch (err) { setErreurModal(err.message); }
    finally { setEnCours(false); }
  };

  const confirmerSuppression = async () => {
    setEnCours(true); setErreurModal('');
    try {
      await directionApi.supprimerTarif(suppression.id);
      setMsg('Tarif supprimé.'); setSuppression(null); charger();
    } catch (err) { setErreurModal(err.message); }
    finally { setEnCours(false); }
  };
  const estActuel = (t) => tarifCourant(tarifs || [], t.type_frais)?.id === t.id;

  return (
    <div className="eco-onglet-corps tarifs-page">
      {erreur && <Alerte type="erreur">{erreur}</Alerte>}
      {msg && <Alerte type="info">{msg}</Alerte>}

      {/* Tarifs actuels */}
      <div className="notes-section-titre"><Icone nom="clipboard" /> Tarifs actuels</div>
      {!tarifs ? <Chargement texte="Chargement des tarifs…" /> : (
        <div className="tableau-enveloppe">
          <table className="tableau insc-tableau">
            <thead>
              <tr><th>Type de frais</th><th>Montant actuel</th><th>En vigueur depuis</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {TYPES_FRAIS.map((t) => {
                const courant = tarifCourant(tarifs, t.valeur);
                return (
                  <tr key={t.valeur}>
                    <td className="insc-nom">{t.libelle}</td>
                    <td>
                      {courant
                        ? <><span className="paie-montant">{montantFr(courant.montant, courant.devise)}</span> <span className="insc-badge insc-badge-vert">Actuel</span></>
                        : <span className="texte-gris">Non défini</span>}
                    </td>
                    <td>{courant ? dateFr(courant.date_effective) : '—'}</td>
                    <td><button type="button" className="mat-modifier" onClick={() => ouvrirEdition(t.valeur)}>Modifier</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Autres frais */}
      <AutresFrais />

      {/* Historique */}
      <div className="notes-section-titre"><Icone nom="history" /> Historique des tarifs</div>
      {!tarifs ? null : tarifs.length === 0 ? (
        <div className="insc-vide"><div className="insc-vide-ico" aria-hidden="true"><Icone nom="inbox" size={44} /></div><p>Aucun tarif enregistré.</p></div>
      ) : (
        <div className="tableau-enveloppe">
          <table className="tableau insc-tableau">
            <thead><tr><th>Type</th><th>Montant</th><th>Date d'effet</th><th>Actions</th></tr></thead>
            <tbody>
              {tarifs.map((t) => (
                <tr key={t.id}>
                  <td className="insc-nom">{libelleTypeFrais(t.type_frais)}</td>
                  <td className="paie-montant">{montantFr(t.montant, t.devise)}</td>
                  <td>{dateFr(t.date_effective)}</td>
                  <td>
                    <button type="button" className="paie-btn paie-rejeter" onClick={() => { setSuppression(t); setErreurModal(''); }}>Supprimer</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modale : supprimer un tarif de l'historique */}
      {suppression && (
        <div className="prof-modal-fond" onClick={() => !enCours && setSuppression(null)}>
          <div className="prof-modal carte" role="dialog" aria-modal="true" onClick={(ev) => ev.stopPropagation()}>
            <button type="button" className="prof-modal-fermer" onClick={() => setSuppression(null)} aria-label="Fermer">×</button>
            <h2 style={{ marginBottom: '.75rem' }}>Supprimer le tarif</h2>
            <p style={{ color: '#4A5568', marginBottom: '1.25rem' }}>
              Voulez-vous vraiment supprimer le tarif « <strong>{libelleTypeFrais(suppression.type_frais)}</strong> —{' '}
              {montantFr(suppression.montant, suppression.devise)} » du {dateFr(suppression.date_effective)} ?
              {estActuel(suppression) && (
                <> <strong>C'est le tarif actuel</strong> : ce type de frais n'aura plus de tarif
                  {suppression.type_frais === 'inscription' ? " et les inscriptions en ligne seront bloquées jusqu'à la saisie d'un nouveau tarif" : ''}.</>
              )}
            </p>
            {erreurModal && <Alerte type="erreur">{erreurModal}</Alerte>}
            <div className="badges-actions" style={{ justifyContent: 'flex-end' }}>
              <button type="button" className="insc-btn-reinit" onClick={() => setSuppression(null)} disabled={enCours}>Annuler</button>
              <button type="button" className="paie-btn paie-rejeter" onClick={confirmerSuppression} disabled={enCours}>{enCours ? 'Suppression…' : 'Confirmer'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modale : modifier tarif principal */}
      {edition && (
        <div className="prof-modal-fond" onClick={() => !enCours && setEdition(null)}>
          <div className="prof-modal carte" role="dialog" aria-modal="true" onClick={(ev) => ev.stopPropagation()}>
            <button type="button" className="prof-modal-fermer" onClick={() => setEdition(null)} aria-label="Fermer">×</button>
            <h2 style={{ marginBottom: '1rem' }}>Nouveau montant — {libelleTypeFrais(edition)}</h2>
            {erreurModal && <Alerte type="erreur">{erreurModal}</Alerte>}
            <div className="notes-modal-champ">
              <label htmlFor="tarif-montant">Montant</label>
              <input id="tarif-montant" type="number" min="1" step="0.01" value={form.montant} onChange={(e) => setForm({ ...form, montant: e.target.value })} autoFocus />
            </div>
            <div className="notes-modal-champ">
              <label htmlFor="tarif-devise">Devise</label>
              <select id="tarif-devise" value={form.devise} onChange={(e) => setForm({ ...form, devise: e.target.value })}>
                <option value="HTG">HTG</option><option value="USD">USD</option>
              </select>
            </div>
            <div className="notes-modal-champ">
              <label htmlFor="tarif-date-effet">Date d'effet</label>
              <input id="tarif-date-effet" type="date" value={form.dateEffective} onChange={(e) => setForm({ ...form, dateEffective: e.target.value })} />
            </div>
            <div className="badges-actions" style={{ justifyContent: 'flex-end' }}>
              <button type="button" className="insc-btn-reinit" onClick={() => setEdition(null)} disabled={enCours}>Annuler</button>
              <button type="button" className="mat-modifier" onClick={enregistrer} disabled={enCours}>{enCours ? 'Enregistrement…' : 'Enregistrer'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const FRAIS_VIDE = { nom: '', niveau: '', anneeScolaire: '', montant: '', devise: 'HTG', unite: '' };

// Catalogue de frais libres (écolage par classe, cantine, livres…)
function AutresFrais() {
  const [frais, setFrais] = useState(null);
  const [niveaux, setNiveaux] = useState([]);
  const [form, setForm] = useState(FRAIS_VIDE);
  const [erreur, setErreur] = useState('');
  const [msg, setMsg] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [page, setPage] = useState(1);

  const [edition, setEdition] = useState(null);        // frais en modification (modal)
  const [editForm, setEditForm] = useState(FRAIS_VIDE);
  const [suppression, setSuppression] = useState(null); // frais à supprimer
  const [modalEnCours, setModalEnCours] = useState(false);
  const [erreurModal, setErreurModal] = useState('');

  const formRef = useRef(null);

  const charger = () => directionApi.fraisDivers().then((d) => setFrais(d.frais)).catch((e) => setErreur(e.message));
  useEffect(() => { charger(); }, []);
  useEffect(() => {
    economatApi.niveaux().then((d) => setNiveaux(d.niveaux)).catch(() => {});
  }, []);

  const liste = frais || [];
  const nbPages = Math.max(1, Math.ceil(liste.length / PAR_PAGE));
  const pageCourante = Math.min(page, nbPages);
  const visibles = liste.slice((pageCourante - 1) * PAR_PAGE, pageCourante * PAR_PAGE);

  const corpsDe = (f) => ({
    nom: f.nom.trim(), niveau: f.niveau.trim(), anneeScolaire: f.anneeScolaire.trim(),
    montant: Number(f.montant), devise: f.devise, unite: f.unite.trim(),
  });

  const ajouter = async (e) => {
    e.preventDefault();
    setErreur(''); setMsg('');
    if (!form.nom.trim()) { setErreur('Le nom du frais est requis.'); return; }
    if (Number.isNaN(Number(form.montant)) || Number(form.montant) <= 0) { setErreur('Le montant doit être un nombre positif.'); return; }
    setEnCours(true);
    try {
      await directionApi.creerFrais(corpsDe(form));
      setMsg('Frais ajouté.'); setForm(FRAIS_VIDE); charger();
    } catch (err) { setErreur(err.message); }
    finally { setEnCours(false); }
  };

  const ouvrirEdition = (f) => {
    setEdition(f);
    setEditForm({ nom: f.nom, niveau: f.niveau || '', anneeScolaire: f.annee_scolaire || '', montant: String(f.montant), devise: f.devise, unite: f.unite || '' });
    setErreurModal('');
  };

  const enregistrerEdition = async () => {
    setErreurModal('');
    if (!editForm.nom.trim()) { setErreurModal('Le nom est requis.'); return; }
    if (Number.isNaN(Number(editForm.montant)) || Number(editForm.montant) <= 0) { setErreurModal('Le montant doit être un nombre positif.'); return; }
    setModalEnCours(true);
    try {
      await directionApi.majFrais(edition.id, corpsDe(editForm));
      setEdition(null); setMsg('Frais mis à jour.'); charger();
    } catch (err) { setErreurModal(err.message); }
    finally { setModalEnCours(false); }
  };

  const confirmerSuppression = async () => {
    setModalEnCours(true); setErreurModal('');
    try {
      await directionApi.supprimerFrais(suppression.id);
      setSuppression(null); setMsg('Frais supprimé.'); charger();
    } catch (err) { setErreurModal(err.message); }
    finally { setModalEnCours(false); }
  };

  const champsFrais = (valeurs, setV, prefixe) => (
    <>
      <div className="notes-champ" style={{ flex: '1 1 180px' }}>
        <label htmlFor={`${prefixe}-nom`}>Nom du frais</label>
        <input id={`${prefixe}-nom`} value={valeurs.nom} onChange={(e) => setV({ ...valeurs, nom: e.target.value })} placeholder="Écolage, Cantine…" />
      </div>
      <div className="notes-champ">
        <label htmlFor={`${prefixe}-classe`}>Classe (optionnel)</label>
        <select id={`${prefixe}-classe`} value={valeurs.niveau} onChange={(e) => setV({ ...valeurs, niveau: e.target.value })}>
          <option value="">Toutes les classes</option>
          {niveaux.map((n) => <option key={`${prefixe}-${n}`} value={n}>{n}</option>)}
        </select>
      </div>
      <div className="notes-champ">
        <label htmlFor={`${prefixe}-annee`}>Année (opt.)</label>
        <select id={`${prefixe}-annee`} value={valeurs.anneeScolaire} onChange={(e) => setV({ ...valeurs, anneeScolaire: e.target.value })}>
          <option value="">—</option>
          {anneesScolaires().map((a) => <option key={`${prefixe}-${a}`} value={a}>{a}</option>)}
        </select>
      </div>
      <div className="notes-champ">
        <label htmlFor={`${prefixe}-montant`}>Montant</label>
        <input id={`${prefixe}-montant`} type="number" min="1" step="0.01" value={valeurs.montant} onChange={(e) => setV({ ...valeurs, montant: e.target.value })} style={{ width: 120 }} />
      </div>
      <div className="notes-champ">
        <label htmlFor={`${prefixe}-devise`}>Devise</label>
        <select id={`${prefixe}-devise`} value={valeurs.devise} onChange={(e) => setV({ ...valeurs, devise: e.target.value })}>
          <option value="HTG">HTG</option><option value="USD">USD</option>
        </select>
      </div>
      <div className="notes-champ">
        <label htmlFor={`${prefixe}-unite`}>Unité (opt.)</label>
        <select id={`${prefixe}-unite`} value={valeurs.unite} onChange={(e) => setV({ ...valeurs, unite: e.target.value })}>
          {UNITES.map((u) => <option key={`${prefixe}-${u || 'x'}`} value={u}>{u || '(aucune)'}</option>)}
          {valeurs.unite && !UNITES.includes(valeurs.unite) && <option value={valeurs.unite}>{valeurs.unite}</option>}
        </select>
      </div>
    </>
  );

  return (
    <>
      <div className="notes-section-titre" ref={formRef}><Icone nom="plus" /> Autres frais</div>
      <div className="carte">
        <p className="texte-gris" style={{ marginTop: 0 }}>
          Écolage par classe, cantine, livres… Laissez la classe vide pour un frais valable pour toutes les classes.
        </p>
        {erreur && <Alerte type="erreur">{erreur}</Alerte>}
        {msg && <Alerte type="info">{msg}</Alerte>}
        <form onSubmit={ajouter} className="notes-form-grille">
          {champsFrais(form, setForm, 'add')}
          <button type="submit" className="eco-batch-btn eco-batch-ok" disabled={enCours}>{enCours ? 'Ajout…' : 'Ajouter'}</button>
        </form>
      </div>

      {!frais ? <Chargement texte="Chargement des frais…" /> : liste.length === 0 ? (
        <div className="insc-vide">
          <div className="insc-vide-ico" aria-hidden="true"><Icone nom="inbox" size={44} /></div>
          <p>Aucun frais enregistré.</p>
          <button type="button" className="eco-batch-btn eco-batch-ok" onClick={() => formRef.current?.scrollIntoView({ behavior: 'smooth' })}>Ajouter un tarif</button>
        </div>
      ) : (
        <>
          <div className="tableau-enveloppe">
            <table className="tableau insc-tableau">
              <thead><tr><th>Nom</th><th>Classe</th><th>Année</th><th>Montant</th><th>Unité</th><th>Actions</th></tr></thead>
              <tbody>
                {visibles.map((f) => (
                  <tr key={f.id}>
                    <td className="insc-nom">{f.nom}</td>
                    <td>{f.niveau ? f.niveau : <span className="insc-badge insc-badge-ble">Toutes</span>}</td>
                    <td>{f.annee_scolaire || <span className="texte-gris">—</span>}</td>
                    <td className="paie-montant">{montantFr(f.montant, f.devise)}</td>
                    <td>{f.unite || '—'}</td>
                    <td>
                      <button type="button" className="mat-modifier" onClick={() => ouvrirEdition(f)}>Modifier</button>
                      <button type="button" className="paie-btn paie-rejeter" onClick={() => { setSuppression(f); setErreurModal(''); }}>Supprimer</button>
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
        </>
      )}

      {/* Modale : modifier un frais */}
      {edition && (
        <div className="prof-modal-fond" onClick={() => !modalEnCours && setEdition(null)}>
          <div className="prof-modal carte" role="dialog" aria-modal="true" onClick={(ev) => ev.stopPropagation()} style={{ maxWidth: 640 }}>
            <button type="button" className="prof-modal-fermer" onClick={() => setEdition(null)} aria-label="Fermer">×</button>
            <h2 style={{ marginBottom: '1rem' }}>Modifier le frais</h2>
            {erreurModal && <Alerte type="erreur">{erreurModal}</Alerte>}
            <div className="notes-form-grille">{champsFrais(editForm, setEditForm, 'edit')}</div>
            <div className="badges-actions" style={{ justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button type="button" className="insc-btn-reinit" onClick={() => setEdition(null)} disabled={modalEnCours}>Annuler</button>
              <button type="button" className="mat-modifier" onClick={enregistrerEdition} disabled={modalEnCours}>{modalEnCours ? 'Enregistrement…' : 'Enregistrer'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modale : supprimer un frais */}
      {suppression && (
        <div className="prof-modal-fond" onClick={() => !modalEnCours && setSuppression(null)}>
          <div className="prof-modal carte" role="dialog" aria-modal="true" onClick={(ev) => ev.stopPropagation()}>
            <button type="button" className="prof-modal-fermer" onClick={() => setSuppression(null)} aria-label="Fermer">×</button>
            <h2 style={{ marginBottom: '.75rem' }}>Supprimer le frais</h2>
            <p style={{ color: '#4A5568', marginBottom: '1.25rem' }}>
              Voulez-vous vraiment supprimer le frais « <strong>{suppression.nom}</strong>{suppression.niveau ? ` — ${suppression.niveau}` : ''} » ?
            </p>
            {erreurModal && <Alerte type="erreur">{erreurModal}</Alerte>}
            <div className="badges-actions" style={{ justifyContent: 'flex-end' }}>
              <button type="button" className="insc-btn-reinit" onClick={() => setSuppression(null)} disabled={modalEnCours}>Annuler</button>
              <button type="button" className="paie-btn paie-rejeter" onClick={confirmerSuppression} disabled={modalEnCours}>{modalEnCours ? 'Suppression…' : 'Confirmer'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
