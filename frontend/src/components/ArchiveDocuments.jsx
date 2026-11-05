import { useEffect, useMemo, useState } from 'react';
import { archivesApi, urlArchiveFichier } from '../services/api.js';
import Alerte from './Alerte.jsx';
import Chargement from './Chargement.jsx';

const LIBELLE_SERVICE = {
  economat: 'Économat', secretariat: 'Secrétariat', direction: 'Direction', autre: 'Autre',
};
const SERVICES = ['economat', 'secretariat', 'direction', 'autre'];

const dateFr = (s) => (s ? new Date(s).toLocaleString('fr-FR') : '');
function tailleLisible(o) {
  if (!o) return '';
  if (o < 1024) return `${o} o`;
  if (o < 1024 * 1024) return `${Math.round(o / 1024)} Ko`;
  return `${(o / (1024 * 1024)).toFixed(1)} Mo`;
}

// `service` fixe (Économat/Secrétariat/Direction) ou null (propriétaire : tous,
// avec filtre + choix du service à l'upload).
export default function ArchiveDocuments({ service = null, titre = 'Documents archivés' }) {
  const [documents, setDocuments] = useState(null);
  const [erreur, setErreur] = useState('');
  const [msg, setMsg] = useState('');
  const [filtre, setFiltre] = useState(service || '');

  const [fichier, setFichier] = useState(null);
  const [titreDoc, setTitreDoc] = useState('');
  const [description, setDescription] = useState('');
  const [serviceUp, setServiceUp] = useState(service || 'autre');
  const [enCours, setEnCours] = useState(false);
  const [suppId, setSuppId] = useState(null);

  const charger = () => archivesApi.lister(service || filtre)
    .then((d) => setDocuments(d.documents))
    .catch((e) => setErreur(e.message));

  useEffect(() => { charger(); /* eslint-disable-next-line */ }, [service, filtre]);

  const televerser = async (e) => {
    e.preventDefault();
    setErreur(''); setMsg('');
    if (!fichier) { setErreur('Choisissez un fichier.'); return; }
    setEnCours(true);
    try {
      const fd = new FormData();
      fd.append('fichier', fichier);
      fd.append('service', service || serviceUp);
      if (titreDoc.trim()) fd.append('titre', titreDoc.trim());
      if (description.trim()) fd.append('description', description.trim());
      await archivesApi.televerser(fd);
      setMsg('Document ajouté.');
      setFichier(null); setTitreDoc(''); setDescription('');
      e.target.reset?.();
      await charger();
    } catch (err) {
      setErreur(err.message);
    } finally {
      setEnCours(false);
    }
  };

  const telecharger = async (doc) => {
    setErreur('');
    try {
      const rep = await fetch(urlArchiveFichier(doc.id), { credentials: 'include' });
      if (!rep.ok) throw new Error('Téléchargement impossible.');
      const blob = await rep.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = doc.nom_fichier || 'document';
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setErreur(e.message);
    }
  };

  const supprimer = async (doc) => {
    setErreur(''); setMsg(''); setSuppId(doc.id);
    try {
      await archivesApi.supprimer(doc.id);
      await charger();
    } catch (e) {
      setErreur(e.message);
    } finally {
      setSuppId(null);
    }
  };

  const liste = useMemo(() => documents || [], [documents]);

  return (
    <div style={{ maxWidth: 900 }}>
      <div className="page-entete">
        <h1>{titre}</h1>
        <p>
          Intégrez ici les anciens documents de l'école (Excel, Word, PowerPoint, PDF…)
          qui n'étaient pas dans le système. Ils sont conservés tels quels et
          téléchargeables en pièce jointe.
        </p>
      </div>

      {erreur && <Alerte type="erreur">{erreur}</Alerte>}
      {msg && <Alerte type="info">{msg}</Alerte>}

      {/* Formulaire d'ajout */}
      <form onSubmit={televerser} className="insc-barre" style={{ flexWrap: 'wrap', alignItems: 'flex-end', gap: '.75rem' }}>
        <div className="insc-recherche" style={{ flex: '1 1 220px' }}>
          <input value={titreDoc} onChange={(e) => setTitreDoc(e.target.value)}
            placeholder="Titre (facultatif)" maxLength={200} aria-label="Titre du document" />
        </div>
        <div className="insc-recherche" style={{ flex: '1 1 220px' }}>
          <input value={description} onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (facultatif)" maxLength={500} aria-label="Description" />
        </div>
        {!service && (
          <select value={serviceUp} onChange={(e) => setServiceUp(e.target.value)} aria-label="Service">
            {SERVICES.map((s) => <option key={s} value={s}>{LIBELLE_SERVICE[s]}</option>)}
          </select>
        )}
        <input type="file" onChange={(e) => setFichier(e.target.files?.[0] || null)}
          accept=".pdf,.xls,.xlsx,.doc,.docx,.ppt,.pptx,.csv,.jpg,.jpeg,.png" aria-label="Fichier" />
        <button type="submit" className="code-generer" disabled={enCours}>
          {enCours ? 'Ajout…' : 'Ajouter'}
        </button>
      </form>

      {/* Filtre par service (propriétaire uniquement) */}
      {!service && (
        <div className="insc-barre" style={{ marginTop: '.25rem' }}>
          <select value={filtre} onChange={(e) => setFiltre(e.target.value)} aria-label="Filtrer par service">
            <option value="">Tous les services</option>
            {SERVICES.map((s) => <option key={s} value={s}>{LIBELLE_SERVICE[s]}</option>)}
          </select>
        </div>
      )}

      {!documents ? (
        <Chargement texte="Chargement des documents…" />
      ) : liste.length === 0 ? (
        <p className="texte-gris">Aucun document archivé pour le moment.</p>
      ) : (
        <div className="tableau-enveloppe">
          <table className="tableau insc-tableau">
            <thead>
              <tr>
                <th>Document</th>{!service && <th>Service</th>}<th>Taille</th>
                <th>Ajouté par</th><th>Date</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {liste.map((d) => (
                <tr key={d.id}>
                  <td className="insc-nom">
                    {d.titre}
                    <div className="texte-gris" style={{ fontSize: '.8rem' }}>{d.nom_fichier}</div>
                    {d.description && <div className="texte-gris" style={{ fontSize: '.8rem' }}>{d.description}</div>}
                  </td>
                  {!service && <td><span className="insc-badge insc-badge-gris">{LIBELLE_SERVICE[d.service] || d.service}</span></td>}
                  <td>{tailleLisible(d.taille)}</td>
                  <td>{d.televerse_par_nom || '—'}</td>
                  <td>{dateFr(d.televerse_le)}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button type="button" className="mat-modifier" onClick={() => telecharger(d)}>Télécharger</button>
                    {' '}
                    <button type="button" className="insc-btn-reinit" onClick={() => supprimer(d)} disabled={suppId === d.id}>
                      {suppId === d.id ? '…' : 'Supprimer'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
