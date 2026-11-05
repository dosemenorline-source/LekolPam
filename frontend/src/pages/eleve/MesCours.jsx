import { useEffect, useState } from 'react';
import { eleveApi, urlDocumentCours } from '../../services/api.js';
import { dateFr } from '../../utils/libelles.js';
import Alerte from '../../components/Alerte.jsx';
import Chargement from '../../components/Chargement.jsx';

const LIBELLE_JOUR = {
  lundi: 'Lundi', mardi: 'Mardi', mercredi: 'Mercredi', jeudi: 'Jeudi', vendredi: 'Vendredi', samedi: 'Samedi',
};

const ONGLETS = [
  { cle: 'devoirs', libelle: 'Devoirs' },
  { cle: 'documents', libelle: 'Documents' },
  { cle: 'horaire', libelle: 'Horaire' },
];

export default function MesCours() {
  const [onglet, setOnglet] = useState('devoirs');

  return (
    <div className="insc-page">
      <div className="page-entete">
        <h1>Mes cours</h1>
        <p>Devoirs, documents et horaire publiés par vos professeurs.</p>
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

      {onglet === 'devoirs' && <DevoirsEleve />}
      {onglet === 'documents' && <DocumentsEleve />}
      {onglet === 'horaire' && <HoraireEleve />}

      <footer className="insc-pied">© {new Date().getFullYear()} Lekòl Pam. Tous droits réservés.</footer>
    </div>
  );
}

function DevoirsEleve() {
  const [devoirs, setDevoirs] = useState(null);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    eleveApi.mesDevoirs().then((d) => setDevoirs(d.devoirs)).catch((e) => setErreur(e.message));
  }, []);

  if (erreur) return <Alerte type="erreur">{erreur}</Alerte>;
  if (devoirs === null) return <Chargement texte="Chargement des devoirs…" />;
  if (devoirs.length === 0) return <p className="texte-gris" style={{ marginTop: '1rem' }}>Aucun devoir pour le moment.</p>;

  return (
    <div className="pile-md" style={{ marginTop: '1rem' }}>
      {devoirs.map((d) => (
        <div key={d.id} className="carte">
          <div className="rangee entre" style={{ flexWrap: 'wrap', gap: '.5rem' }}>
            <strong>{d.matiere_nom}</strong>
            {d.date_limite && <span className="insc-badge insc-badge-or">Échéance : {dateFr(d.date_limite)}</span>}
          </div>
          <p style={{ margin: '.5rem 0 0', fontWeight: 600 }}>{d.titre}</p>
          {d.description && <p className="texte-gris" style={{ margin: '.3rem 0 0' }}>{d.description}</p>}
          <p className="texte-gris" style={{ fontSize: '.8rem', margin: '.5rem 0 0' }}>Par {d.enseignant_nom}</p>
        </div>
      ))}
    </div>
  );
}

function DocumentsEleve() {
  const [documents, setDocuments] = useState(null);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    eleveApi.mesDocuments().then((d) => setDocuments(d.documents)).catch((e) => setErreur(e.message));
  }, []);

  if (erreur) return <Alerte type="erreur">{erreur}</Alerte>;
  if (documents === null) return <Chargement texte="Chargement des documents…" />;
  if (documents.length === 0) return <p className="texte-gris" style={{ marginTop: '1rem' }}>Aucun document pour le moment.</p>;

  return (
    <div className="pile-md" style={{ marginTop: '1rem' }}>
      {documents.map((d) => (
        <div key={d.id} className="carte">
          <div className="rangee entre" style={{ flexWrap: 'wrap', gap: '.5rem' }}>
            <div>
              <strong>{d.matiere_nom}</strong>
              <p style={{ margin: '.3rem 0 0' }}>{d.titre}</p>
              <p className="texte-gris" style={{ fontSize: '.8rem', margin: '.3rem 0 0' }}>Par {d.enseignant_nom} · {dateFr(d.cree_le)}</p>
            </div>
            <a href={urlDocumentCours(d.id)} target="_blank" rel="noreferrer" className="insc-btn-reinit">Télécharger</a>
          </div>
        </div>
      ))}
    </div>
  );
}

function HoraireEleve() {
  const [horaires, setHoraires] = useState(null);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    eleveApi.monHoraire().then((d) => setHoraires(d.horaires)).catch((e) => setErreur(e.message));
  }, []);

  if (erreur) return <Alerte type="erreur">{erreur}</Alerte>;
  if (horaires === null) return <Chargement texte="Chargement de l'horaire…" />;
  if (horaires.length === 0) return <p className="texte-gris" style={{ marginTop: '1rem' }}>Aucun horaire renseigné pour le moment.</p>;

  return (
    <div className="tableau-enveloppe" style={{ marginTop: '1rem' }}>
      <table className="tableau insc-tableau">
        <thead><tr><th>Jour</th><th>De</th><th>À</th><th>Matière</th><th>Professeur</th><th>Salle</th></tr></thead>
        <tbody>
          {horaires.map((h) => (
            <tr key={h.id}>
              <td>{LIBELLE_JOUR[h.jour_semaine]}</td>
              <td>{h.heure_debut?.slice(0, 5)}</td>
              <td>{h.heure_fin?.slice(0, 5)}</td>
              <td>{h.matiere_nom}</td>
              <td>{h.enseignant_nom}</td>
              <td>{h.salle || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
