import { useEffect, useState } from 'react';
import { professeurApi, urlDocumentCours } from '../../services/api.js';
import { dateFr } from '../../utils/libelles.js';
import Alerte from '../../components/Alerte.jsx';
import Chargement from '../../components/Chargement.jsx';
import Icone from '../../components/Icone.jsx';

const JOURS = [
  { valeur: 'lundi', libelle: 'Lundi' },
  { valeur: 'mardi', libelle: 'Mardi' },
  { valeur: 'mercredi', libelle: 'Mercredi' },
  { valeur: 'jeudi', libelle: 'Jeudi' },
  { valeur: 'vendredi', libelle: 'Vendredi' },
  { valeur: 'samedi', libelle: 'Samedi' },
];
const LIBELLE_JOUR = Object.fromEntries(JOURS.map((j) => [j.valeur, j.libelle]));

const ONGLETS = [
  { cle: 'devoirs', libelle: 'Devoirs' },
  { cle: 'documents', libelle: 'Documents' },
  { cle: 'horaire', libelle: 'Horaire' },
];

export default function TableauProfesseur() {
  const [matieres, setMatieres] = useState([]);
  const [idMatiere, setIdMatiere] = useState('');
  const [onglet, setOnglet] = useState('devoirs');
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    professeurApi.mesMatieres()
      .then((d) => {
        setMatieres(d.matieres);
        if (d.matieres[0]) setIdMatiere(String(d.matieres[0].id));
      })
      .catch((e) => setErreur(e.message))
      .finally(() => setChargement(false));
  }, []);

  if (chargement) return <div className="insc-page"><Chargement texte="Chargement…" /></div>;

  return (
    <div className="insc-page">
      <div className="page-entete">
        <h1>Espace professeur</h1>
        <p>Publiez des devoirs, déposez des documents et renseignez votre horaire, par classe.</p>
      </div>

      {erreur && <Alerte type="erreur">{erreur}</Alerte>}

      {matieres.length === 0 ? (
        <div className="insc-vide">
          <div className="insc-vide-ico" aria-hidden="true"><Icone nom="inbox" size={44} /></div>
          <p>Aucune classe ne vous a encore été assignée. Contactez la direction.</p>
        </div>
      ) : (
        <>
          <div className="notes-champ" style={{ maxWidth: 320, marginBottom: '1rem' }}>
            <label htmlFor="profa-classe">Classe</label>
            <select id="profa-classe" value={idMatiere} onChange={(e) => setIdMatiere(e.target.value)}>
              {matieres.map((m) => <option key={m.id} value={m.id}>{m.nom} — {m.niveau}</option>)}
            </select>
          </div>

          <div className="eco-onglets" role="tablist">
            {ONGLETS.map((o) => (
              <button key={o.cle} type="button" role="tab" aria-selected={onglet === o.cle}
                className={`eco-onglet ${onglet === o.cle ? 'actif' : ''}`}
                onClick={() => setOnglet(o.cle)}>
                {o.libelle}
              </button>
            ))}
          </div>

          {idMatiere && onglet === 'devoirs' && <DevoirsTab idMatiere={Number(idMatiere)} />}
          {idMatiere && onglet === 'documents' && <DocumentsTab idMatiere={Number(idMatiere)} />}
          {idMatiere && onglet === 'horaire' && <HoraireTab idMatiere={Number(idMatiere)} />}
        </>
      )}

      <footer className="insc-pied">© {new Date().getFullYear()} Lekòl Pam. Tous droits réservés.</footer>
    </div>
  );
}

// ---------- Devoirs ----------
function DevoirsTab({ idMatiere }) {
  const [devoirs, setDevoirs] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');
  const [form, setForm] = useState({ titre: '', description: '', dateLimite: '' });
  const [enCours, setEnCours] = useState(false);

  const charger = () => {
    setChargement(true);
    professeurApi.devoirs(idMatiere).then((d) => setDevoirs(d.devoirs)).catch((e) => setErreur(e.message)).finally(() => setChargement(false));
  };
  useEffect(charger, [idMatiere]);

  const publier = async (e) => {
    e.preventDefault();
    setErreur('');
    if (!form.titre.trim()) { setErreur('Titre requis.'); return; }
    setEnCours(true);
    try {
      await professeurApi.creerDevoir({
        idMatiere, titre: form.titre.trim(), description: form.description.trim(), dateLimite: form.dateLimite || undefined,
      });
      setForm({ titre: '', description: '', dateLimite: '' });
      charger();
    } catch (err) { setErreur(err.message); }
    finally { setEnCours(false); }
  };

  const supprimer = async (id) => {
    setErreur('');
    try { await professeurApi.supprimerDevoir(id); charger(); }
    catch (err) { setErreur(err.message); }
  };

  return (
    <div className="pile-md" style={{ marginTop: '1rem' }}>
      {erreur && <Alerte type="erreur">{erreur}</Alerte>}
      <div className="carte">
        <form onSubmit={publier} className="notes-form-grille">
          <div className="notes-champ" style={{ flex: '1 1 220px' }}>
            <label htmlFor="dev-titre">Titre</label>
            <input id="dev-titre" value={form.titre} onChange={(e) => setForm({ ...form, titre: e.target.value })}
              placeholder="ex. Exercices chapitre 3" />
          </div>
          <div className="notes-champ">
            <label htmlFor="dev-date">Date limite (optionnel)</label>
            <input id="dev-date" type="date" value={form.dateLimite} onChange={(e) => setForm({ ...form, dateLimite: e.target.value })} />
          </div>
          <div className="notes-champ" style={{ flexBasis: '100%' }}>
            <label htmlFor="dev-desc">Description (optionnel)</label>
            <textarea id="dev-desc" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Consignes du devoir…" />
          </div>
          <button type="submit" className="eco-batch-btn eco-batch-ok" disabled={enCours}>{enCours ? 'Publication…' : 'Publier le devoir'}</button>
        </form>
      </div>

      {chargement ? <Chargement texte="Chargement des devoirs…" /> : devoirs.length === 0 ? (
        <p className="texte-gris">Aucun devoir publié pour cette classe.</p>
      ) : devoirs.map((d) => (
        <div key={d.id} className="carte">
          <div className="rangee entre" style={{ flexWrap: 'wrap', gap: '.5rem' }}>
            <div>
              <strong>{d.titre}</strong>
              {d.description && <p className="texte-gris" style={{ margin: '.3rem 0 0' }}>{d.description}</p>}
              {d.date_limite && <p className="texte-gris" style={{ fontSize: '.82rem', margin: '.3rem 0 0' }}>Échéance : {dateFr(d.date_limite)}</p>}
            </div>
            <button type="button" className="paie-btn paie-rejeter" onClick={() => supprimer(d.id)}>Supprimer</button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------- Documents ----------
function DocumentsTab({ idMatiere }) {
  const [documents, setDocuments] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');
  const [titre, setTitre] = useState('');
  const [fichier, setFichier] = useState(null);
  const [enCours, setEnCours] = useState(false);

  const charger = () => {
    setChargement(true);
    professeurApi.documents(idMatiere).then((d) => setDocuments(d.documents)).catch((e) => setErreur(e.message)).finally(() => setChargement(false));
  };
  useEffect(charger, [idMatiere]);

  const deposer = async (e) => {
    e.preventDefault();
    setErreur('');
    if (!titre.trim() || !fichier) { setErreur('Titre et fichier requis.'); return; }
    setEnCours(true);
    try {
      await professeurApi.creerDocument({ idMatiere, titre: titre.trim(), fichier });
      setTitre(''); setFichier(null);
      charger();
    } catch (err) { setErreur(err.message); }
    finally { setEnCours(false); }
  };

  const supprimer = async (id) => {
    setErreur('');
    try { await professeurApi.supprimerDocument(id); charger(); }
    catch (err) { setErreur(err.message); }
  };

  return (
    <div className="pile-md" style={{ marginTop: '1rem' }}>
      {erreur && <Alerte type="erreur">{erreur}</Alerte>}
      <div className="carte">
        <form onSubmit={deposer} className="notes-form-grille">
          <div className="notes-champ" style={{ flex: '1 1 220px' }}>
            <label htmlFor="doc-titre">Titre</label>
            <input id="doc-titre" value={titre} onChange={(e) => setTitre(e.target.value)} placeholder="ex. Fiche de résumé" />
          </div>
          <div className="notes-champ">
            <label htmlFor="doc-fichier">Fichier (PDF, JPG, PNG)</label>
            <input id="doc-fichier" type="file" accept=".pdf,image/jpeg,image/png"
              onChange={(e) => setFichier(e.target.files?.[0] || null)} />
          </div>
          <button type="submit" className="eco-batch-btn eco-batch-ok" disabled={enCours}>{enCours ? 'Dépôt…' : 'Déposer le document'}</button>
        </form>
      </div>

      {chargement ? <Chargement texte="Chargement des documents…" /> : documents.length === 0 ? (
        <p className="texte-gris">Aucun document déposé pour cette classe.</p>
      ) : documents.map((d) => (
        <div key={d.id} className="carte">
          <div className="rangee entre" style={{ flexWrap: 'wrap', gap: '.5rem' }}>
            <div>
              <strong>{d.titre}</strong>
              <p className="texte-gris" style={{ fontSize: '.82rem', margin: '.3rem 0 0' }}>Déposé le {dateFr(d.cree_le)}</p>
            </div>
            <div className="rangee" style={{ gap: '.5rem' }}>
              <a href={urlDocumentCours(d.id)} target="_blank" rel="noreferrer" className="insc-btn-reinit">Télécharger</a>
              <button type="button" className="paie-btn paie-rejeter" onClick={() => supprimer(d.id)}>Supprimer</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------- Horaire ----------
function HoraireTab({ idMatiere }) {
  const [horaires, setHoraires] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');
  const [form, setForm] = useState({ jourSemaine: 'lundi', heureDebut: '', heureFin: '', salle: '' });
  const [enCours, setEnCours] = useState(false);

  const charger = () => {
    setChargement(true);
    professeurApi.horaires(idMatiere).then((d) => setHoraires(d.horaires)).catch((e) => setErreur(e.message)).finally(() => setChargement(false));
  };
  useEffect(charger, [idMatiere]);

  const ajouter = async (e) => {
    e.preventDefault();
    setErreur('');
    if (!form.heureDebut || !form.heureFin) { setErreur('Heures de début et de fin requises.'); return; }
    setEnCours(true);
    try {
      await professeurApi.creerHoraire({ idMatiere, ...form, salle: form.salle.trim() || undefined });
      setForm({ jourSemaine: 'lundi', heureDebut: '', heureFin: '', salle: '' });
      charger();
    } catch (err) { setErreur(err.message); }
    finally { setEnCours(false); }
  };

  const supprimer = async (id) => {
    setErreur('');
    try { await professeurApi.supprimerHoraire(id); charger(); }
    catch (err) { setErreur(err.message); }
  };

  return (
    <div className="pile-md" style={{ marginTop: '1rem' }}>
      {erreur && <Alerte type="erreur">{erreur}</Alerte>}
      <div className="carte">
        <form onSubmit={ajouter} className="notes-form-grille">
          <div className="notes-champ">
            <label htmlFor="hor-jour">Jour</label>
            <select id="hor-jour" value={form.jourSemaine} onChange={(e) => setForm({ ...form, jourSemaine: e.target.value })}>
              {JOURS.map((j) => <option key={j.valeur} value={j.valeur}>{j.libelle}</option>)}
            </select>
          </div>
          <div className="notes-champ">
            <label htmlFor="hor-debut">Heure de début</label>
            <input id="hor-debut" type="time" value={form.heureDebut} onChange={(e) => setForm({ ...form, heureDebut: e.target.value })} />
          </div>
          <div className="notes-champ">
            <label htmlFor="hor-fin">Heure de fin</label>
            <input id="hor-fin" type="time" value={form.heureFin} onChange={(e) => setForm({ ...form, heureFin: e.target.value })} />
          </div>
          <div className="notes-champ">
            <label htmlFor="hor-salle">Salle (optionnel)</label>
            <input id="hor-salle" value={form.salle} onChange={(e) => setForm({ ...form, salle: e.target.value })} placeholder="ex. Salle 4" />
          </div>
          <button type="submit" className="eco-batch-btn eco-batch-ok" disabled={enCours}>{enCours ? 'Ajout…' : 'Ajouter le créneau'}</button>
        </form>
      </div>

      {chargement ? <Chargement texte="Chargement de l'horaire…" /> : horaires.length === 0 ? (
        <p className="texte-gris">Aucun créneau renseigné pour cette classe.</p>
      ) : (
        <div className="tableau-enveloppe">
          <table className="tableau insc-tableau">
            <thead><tr><th>Jour</th><th>De</th><th>À</th><th>Salle</th><th>Actions</th></tr></thead>
            <tbody>
              {horaires.map((h) => (
                <tr key={h.id}>
                  <td>{LIBELLE_JOUR[h.jour_semaine]}</td>
                  <td>{h.heure_debut?.slice(0, 5)}</td>
                  <td>{h.heure_fin?.slice(0, 5)}</td>
                  <td>{h.salle || '—'}</td>
                  <td><button type="button" className="paie-btn paie-rejeter" onClick={() => supprimer(h.id)}>Supprimer</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
