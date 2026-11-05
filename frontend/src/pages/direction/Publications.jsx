import { useEffect, useMemo, useRef, useState } from 'react';
import { directionApi, adminApi, permissionsApi, urlDocumentOfficiel } from '../../services/api.js';
import { dateHeureFr, anneeScolaireCourante } from '../../utils/libelles.js';
import Alerte from '../../components/Alerte.jsx';
import Chargement from '../../components/Chargement.jsx';
import Icone from '../../components/Icone.jsx';

const PAR_PAGE = 15;
const dateCourte = (s) => (s ? new Date(s).toLocaleDateString('fr-FR') : '');

const TRIMESTRES = [
  { valeur: '1er_trimestre', libelle: '1er trimestre' },
  { valeur: '2e_trimestre', libelle: '2e trimestre' },
  { valeur: '3e_trimestre', libelle: '3e trimestre' },
];
const libTrim = (v) => TRIMESTRES.find((t) => t.valeur === v)?.libelle || v;

function anneesScolaires() {
  const a = new Date().getFullYear();
  return [a - 1, a, a + 1].map((y) => `${y}-${y + 1}`);
}

export default function Publications() {
  const [niveaux, setNiveaux] = useState([]);
  const [form, setForm] = useState({ niveau: '', anneeScolaire: anneeScolaireCourante(), trimestre: '1er_trimestre' });
  const [regenerer, setRegenerer] = useState(false);
  const [forcerNotification, setForcerNotification] = useState(false);
  const [suppression, setSuppression] = useState(null); // publication à supprimer
  const [suppEnCours, setSuppEnCours] = useState(false);

  const [publications, setPublications] = useState(null); // null = chargement
  const [bulletins, setBulletins] = useState([]);
  const [niveauBulletins, setNiveauBulletins] = useState('');
  const [telechargeId, setTelechargeId] = useState(null);
  const [page, setPage] = useState(1);

  const [erreur, setErreur] = useState('');
  const [msg, setMsg] = useState('');
  const [enCours, setEnCours] = useState(false);

  const [confirme, setConfirme] = useState(false);
  const [statsModal, setStatsModal] = useState(null); // { eleves, matieres }

  const formRef = useRef(null);
  const bulletinsRef = useRef(null);

  // Le propriétaire peut désactiver la publication — voir /proprietaire.
  const [publicationAutorisee, setPublicationAutorisee] = useState(true);
  useEffect(() => {
    permissionsApi.lister()
      .then((d) => setPublicationAutorisee(d.permissions.find((p) => p.cle === 'notes_publication')?.autorise ?? true))
      .catch(() => {});
  }, []);

  useEffect(() => {
    adminApi.elevesCodes('')
      .then((d) => setNiveaux([...new Set(d.eleves.map((e) => e.niveau).filter(Boolean))].sort()))
      .catch(() => {});
  }, []);

  const charger = () => {
    directionApi.publications().then((d) => setPublications(d.publications)).catch((e) => setErreur(e.message));
  };
  useEffect(charger, []);

  const chargerBulletins = async (niveau) => {
    const n = (niveau ?? niveauBulletins).trim();
    setErreur('');
    try {
      const d = await directionApi.bulletinsNiveau(n);
      setBulletins(d.bulletins);
    } catch (err) { setErreur(err.message); }
  };
  useEffect(() => { chargerBulletins(''); }, []);

  const liste = publications || [];
  const nbPages = Math.max(1, Math.ceil(liste.length / PAR_PAGE));
  const pageCourante = Math.min(page, nbPages);
  const visibles = liste.slice((pageCourante - 1) * PAR_PAGE, pageCourante * PAR_PAGE);
  const derniere = liste[0];

  // Ouvre la confirmation en chargeant un aperçu (élèves + matières du niveau)
  const ouvrirConfirmation = async (e) => {
    e.preventDefault();
    setErreur(''); setMsg('');
    if (!form.niveau) { setErreur('Choisissez un niveau.'); return; }
    setStatsModal(null); setConfirme(true);
    try {
      const [nbEleves, nbMatieres] = await Promise.all([
        adminApi.eleves(form.niveau).then((d) => d.eleves.length).catch(() => null),
        directionApi.matieres(form.niveau).then((d) => d.matieres.length).catch(() => null),
      ]);
      setStatsModal({ eleves: nbEleves, matieres: nbMatieres });
    } catch { setStatsModal({ eleves: null, matieres: null }); }
  };

  const publier = async () => {
    setErreur(''); setMsg(''); setEnCours(true);
    try {
      const d = await directionApi.publier({ ...form, regenerer, forcerNotification: regenerer && forcerNotification });
      setMsg(`Publié. ${d.bulletinsGeneres} bulletin(s) généré(s)`
        + `${d.bulletinsRegeneres ? `, ${d.bulletinsRegeneres} régénéré(s)` : ''}`
        + `, ${d.elevesSansNotes} élève(s) sans notes validées`
        + `${d.bulletinsDejaFaits ? `, ${d.bulletinsDejaFaits} déjà existant(s)` : ''}.`);
      setConfirme(false);
      charger();
      chargerBulletins(form.niveau);
    } catch (err) { setErreur(err.message); setConfirme(false); }
    finally { setEnCours(false); }
  };

  const supprimerPublication = async () => {
    setErreur(''); setMsg(''); setSuppEnCours(true);
    try {
      const d = await directionApi.supprimerPublication(suppression.id);
      setMsg(`Publication supprimée${d.bulletinsSupprimes ? ` (${d.bulletinsSupprimes} bulletin(s) retiré(s))` : ''}.`);
      setSuppression(null);
      charger();
      chargerBulletins(niveauBulletins);
    } catch (err) { setErreur(err.message); setSuppression(null); }
    finally { setSuppEnCours(false); }
  };

  const voirBulletins = (niveau) => {
    setNiveauBulletins(niveau);
    chargerBulletins(niveau);
    bulletinsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const telecharger = async (id) => {
    setErreur(''); setTelechargeId(id);
    try {
      const res = await fetch(urlDocumentOfficiel(id), { credentials: 'include' });
      if (!res.ok) throw new Error('Téléchargement impossible.');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `bulletin-${id}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch (e) { setErreur(e.message); }
    finally { setTelechargeId(null); }
  };

  return (
    <div className="insc-page pub-page">
      <div className="page-entete">
        <h1>Publication des notes</h1>
        <p>Publiez les notes par niveau et par trimestre. Les bulletins sont générés et les parents notifiés.</p>
      </div>

      {erreur && <Alerte type="erreur">{erreur}</Alerte>}
      {msg && <Alerte type="info">{msg}</Alerte>}
      {!publicationAutorisee && (
        <Alerte type="info">
          La publication des notes a été désactivée par le propriétaire de l'école. Vous pouvez consulter les publications existantes, mais pas en créer ni en retirer.
        </Alerte>
      )}

      {/* Formulaire de publication */}
      {publicationAutorisee && (
        <>
          <div className="notes-section-titre" ref={formRef}><Icone nom="upload" /> Publier un niveau / trimestre</div>
          <div className="carte">
            <form onSubmit={ouvrirConfirmation} className="notes-form-grille">
              <div className="notes-champ">
                <label htmlFor="pub-niveau">Niveau (classe)</label>
                <select id="pub-niveau" value={form.niveau} onChange={(e) => setForm({ ...form, niveau: e.target.value })}>
                  <option value="">Choisir un niveau…</option>
                  {niveaux.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div className="notes-champ">
                <label htmlFor="pub-annee">Année scolaire</label>
                <select id="pub-annee" value={form.anneeScolaire} onChange={(e) => setForm({ ...form, anneeScolaire: e.target.value })}>
                  {anneesScolaires().map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div className="notes-champ">
                <label htmlFor="pub-trimestre">Trimestre</label>
                <select id="pub-trimestre" value={form.trimestre} onChange={(e) => setForm({ ...form, trimestre: e.target.value })}>
                  {TRIMESTRES.map((t) => <option key={t.valeur} value={t.valeur}>{t.libelle}</option>)}
                </select>
              </div>
              <label className="pub-regenerer">
                <input type="checkbox" checked={regenerer} onChange={(e) => setRegenerer(e.target.checked)} />
                <span>Régénérer les bulletins existants (applique le nouveau format)</span>
              </label>
              {regenerer && (
                <label className="pub-regenerer">
                  <input type="checkbox" checked={forcerNotification} onChange={(e) => setForcerNotification(e.target.checked)} />
                  <span>Renvoyer le courriel aux parents (bulletin en pièce jointe)</span>
                </label>
              )}
              <button type="submit" className="eco-batch-btn eco-batch-ok" disabled={enCours}>
                {enCours ? 'Publication…' : (regenerer ? 'Publier & régénérer' : 'Publier')}
              </button>
            </form>
          </div>
        </>
      )}

      {/* Publications effectuées */}
      <div className="notes-section-titre"><Icone nom="clipboard" /> Publications effectuées</div>
      {derniere && (
        <p className="pub-derniere">✓ Dernière publication : {libTrim(derniere.trimestre)} — {derniere.niveau} ({dateHeureFr(derniere.publie_le)})</p>
      )}
      {!publications ? (
        <Chargement texte="Chargement des publications…" />
      ) : liste.length === 0 ? (
        <div className="insc-vide">
          <div className="insc-vide-ico" aria-hidden="true"><Icone nom="inbox" size={44} /></div>
          <p>Aucune publication effectuée.</p>
          {publicationAutorisee && (
            <button type="button" className="eco-batch-btn eco-batch-ok" onClick={() => formRef.current?.scrollIntoView({ behavior: 'smooth' })}>Effectuer une publication</button>
          )}
        </div>
      ) : (
        <>
          <div className="tableau-enveloppe">
            <table className="tableau insc-tableau">
              <thead>
                <tr><th>Niveau</th><th>Année</th><th>Trimestre</th><th>Publié le</th><th>Par</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {visibles.map((p) => (
                  <tr key={p.id}>
                    <td className="insc-nom">{p.niveau}</td>
                    <td>{p.annee_scolaire}</td>
                    <td>{libTrim(p.trimestre)}</td>
                    <td>{dateHeureFr(p.publie_le)}</td>
                    <td>{p.publie_par_nom || '—'}</td>
                    <td>
                      <div className="rangee" style={{ gap: '.4rem', flexWrap: 'wrap' }}>
                        <button type="button" className="paie-btn paie-details" onClick={() => voirBulletins(p.niveau)}>Voir bulletins</button>
                        {publicationAutorisee && (
                          <button type="button" className="paie-btn paie-rejeter" onClick={() => setSuppression(p)}><Icone nom="trash" /> Supprimer</button>
                        )}
                      </div>
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

      {/* Bulletins générés */}
      <div className="notes-section-titre" ref={bulletinsRef}><Icone nom="download" /> Bulletins générés</div>
      <div className="insc-barre">
        <select value={niveauBulletins} onChange={(e) => { setNiveauBulletins(e.target.value); chargerBulletins(e.target.value); }} aria-label="Filtrer par niveau">
          <option value="">Tous les niveaux</option>
          {niveaux.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <button type="button" className="insc-btn-reinit" onClick={() => { setNiveauBulletins(''); chargerBulletins(''); }} disabled={!niveauBulletins}>Réinitialiser</button>
      </div>
      {bulletins.length === 0 ? (
        <div className="insc-vide">
          <div className="insc-vide-ico" aria-hidden="true"><Icone nom="file" size={44} /></div>
          <p>Aucun bulletin généré pour ce filtre. Publiez un niveau/trimestre ci-dessus (les notes doivent être validées).</p>
        </div>
      ) : (
        <div className="tableau-enveloppe">
          <table className="tableau insc-tableau">
            <thead><tr><th>Élève</th><th>Niveau</th><th>Généré le</th><th>Actions</th></tr></thead>
            <tbody>
              {bulletins.map((b) => (
                <tr key={b.id}>
                  <td className="insc-nom">{b.eleve_nom}</td>
                  <td>{b.niveau}</td>
                  <td>{dateCourte(b.date_generation)}</td>
                  <td>
                    <button type="button" className="paie-btn paie-voir" onClick={() => telecharger(b.id)} disabled={telechargeId === b.id}>
                      {telechargeId === b.id ? 'Téléchargement…' : 'Télécharger'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <footer className="insc-pied">© {new Date().getFullYear()} Lekòl Pam. Tous droits réservés.</footer>

      {/* Modale de confirmation */}
      {confirme && (
        <div className="prof-modal-fond" onClick={() => !enCours && setConfirme(false)}>
          <div className="prof-modal carte" role="dialog" aria-modal="true" onClick={(ev) => ev.stopPropagation()}>
            <button type="button" className="prof-modal-fermer" onClick={() => setConfirme(false)} aria-label="Fermer">×</button>
            <h2 style={{ marginBottom: '.75rem' }}>Confirmer la publication</h2>
            <p style={{ color: '#4A5568', marginBottom: '1rem' }}>
              Voulez-vous vraiment publier les notes de <strong>{form.niveau}</strong> — <strong>{libTrim(form.trimestre)}</strong> ({form.anneeScolaire}) ? Les bulletins seront générés et les parents notifiés.
              {regenerer && <><br /><strong>Les bulletins déjà existants seront régénérés</strong> au nouveau format.</>}
              {regenerer && forcerNotification && <><br /><strong>Un courriel réel sera renvoyé à chaque parent</strong>, même si le bulletin avait déjà été publié.</>}
            </p>
            <div className="pub-stats">
              <span className="pub-stat"><Icone nom="users" /> <strong>{statsModal ? (statsModal.eleves ?? '—') : '…'}</strong> élèves</span>
              <span className="pub-stat"><Icone nom="chart" /> <strong>{statsModal ? (statsModal.matieres ?? '—') : '…'}</strong> matières</span>
            </div>
            <div className="badges-actions" style={{ justifyContent: 'flex-end' }}>
              <button type="button" className="insc-btn-reinit" onClick={() => setConfirme(false)} disabled={enCours}>Annuler</button>
              <button type="button" className="eco-batch-btn eco-batch-ok" onClick={publier} disabled={enCours}>
                {enCours ? 'Publication…' : 'Publier'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modale de confirmation — suppression d'une publication */}
      {suppression && (
        <div className="prof-modal-fond" onClick={() => !suppEnCours && setSuppression(null)}>
          <div className="prof-modal carte" role="dialog" aria-modal="true" onClick={(ev) => ev.stopPropagation()}>
            <button type="button" className="prof-modal-fermer" onClick={() => setSuppression(null)} aria-label="Fermer">×</button>
            <h2 style={{ marginBottom: '.75rem' }}>Supprimer la publication</h2>
            <p style={{ color: '#4A5568', marginBottom: '1.25rem' }}>
              Voulez-vous vraiment supprimer la publication <strong>{suppression.niveau}</strong> — <strong>{libTrim(suppression.trimestre)}</strong> ({suppression.annee_scolaire}) ?
              <br />Les <strong>bulletins générés</strong> pour ce trimestre seront supprimés et les résultats ne seront plus visibles pour les familles. Les notes saisies ne sont pas effacées.
            </p>
            <div className="badges-actions" style={{ justifyContent: 'flex-end' }}>
              <button type="button" className="insc-btn-reinit" onClick={() => setSuppression(null)} disabled={suppEnCours}>Annuler</button>
              <button type="button" className="paie-btn paie-rejeter" onClick={supprimerPublication} disabled={suppEnCours}>
                {suppEnCours ? 'Suppression…' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
