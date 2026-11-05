import { useEffect, useState } from 'react';
import { importApi } from '../services/api.js';
import Alerte from '../components/Alerte.jsx';
import Bouton from '../components/Bouton.jsx';

// Types d'import. Seul « eleves » est actif pour l'instant ; les autres
// arriveront (notes, paiements) une fois adaptés à un exemple de fichier réel.
const TYPES = [
  { cle: 'eleves', libelle: 'Élèves', actif: true },
  { cle: 'notes', libelle: 'Notes', actif: false },
  { cle: 'paiements', libelle: 'Paiements', actif: false },
];

export default function ImportDonnees() {
  const [type, setType] = useState('eleves');
  const [champs, setChamps] = useState([]);
  const [fichier, setFichier] = useState(null);

  const [analyse, setAnalyse] = useState(null); // { jeton, entetes, apercu, nbLignes }
  const [mapping, setMapping] = useState({});    // { cléChamp: indexColonne }
  const [resultat, setResultat] = useState(null);

  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);

  useEffect(() => {
    importApi.champs(type).then((d) => setChamps(d.champs)).catch(() => setChamps([]));
    setAnalyse(null); setMapping({}); setResultat(null); setFichier(null);
  }, [type]);

  // Devine la correspondance : un champ pointe vers la 1re colonne dont l'en-tête
  // contient le libellé/la clé (ex. « Prénom » → colonne « prenom »).
  const devinerMapping = (entetes, champsCibles) => {
    const m = {};
    const norm = (s) => (s || '').toString().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    for (const c of champsCibles) {
      const cibles = [norm(c.cle), norm(c.libelle.split(' ')[0])];
      const i = entetes.findIndex((e) => cibles.some((t) => t && norm(e).includes(t)));
      if (i >= 0) m[c.cle] = i;
    }
    return m;
  };

  const analyser = async (e) => {
    e.preventDefault();
    setErreur(''); setResultat(null);
    if (!fichier) { setErreur('Choisissez un fichier.'); return; }
    setEnCours(true);
    try {
      const fd = new FormData();
      fd.append('fichier', fichier);
      const d = await importApi.analyser(fd);
      setAnalyse(d);
      setMapping(devinerMapping(d.entetes, champs));
    } catch (err) {
      setErreur(err.message);
    } finally {
      setEnCours(false);
    }
  };

  const lancer = async () => {
    setErreur(''); setEnCours(true);
    try {
      const d = await importApi.lancer(type, { jeton: analyse.jeton, mapping });
      setResultat(d);
      setAnalyse(null); setFichier(null);
    } catch (err) {
      setErreur(err.message);
    } finally {
      setEnCours(false);
    }
  };

  const majMap = (cle, val) => setMapping((m) => {
    const copie = { ...m };
    if (val === '') delete copie[cle];
    else copie[cle] = Number(val);
    return copie;
  });

  return (
    <div style={{ maxWidth: 860 }}>
      <div className="page-entete">
        <h1>Importer des données</h1>
        <p>
          Intégrez d'anciennes listes depuis un fichier Excel (.xlsx) ou CSV. Vous faites
          correspondre vos colonnes aux champs du système — aucun format imposé.
        </p>
      </div>

      {/* Choix du type */}
      <div className="insc-barre">
        <select value={type} onChange={(e) => setType(e.target.value)} aria-label="Type de données">
          {TYPES.map((t) => (
            <option key={t.cle} value={t.cle} disabled={!t.actif}>
              {t.libelle}{t.actif ? '' : ' (bientôt)'}
            </option>
          ))}
        </select>
      </div>

      {erreur && <Alerte type="erreur">{erreur}</Alerte>}

      {resultat && (
        <Alerte type="info">
          Import terminé : <strong>{resultat.importes}</strong> ajouté(s),{' '}
          {resultat.ignores} ignoré(s) (doublons){resultat.erreurs?.length ? `, ${resultat.erreurs.length} en erreur` : ''}.
        </Alerte>
      )}
      {resultat?.erreurs?.length > 0 && (
        <div className="tableau-enveloppe" style={{ marginBottom: '1rem' }}>
          <table className="tableau insc-tableau">
            <thead><tr><th>Ligne</th><th>Problème</th></tr></thead>
            <tbody>
              {resultat.erreurs.slice(0, 50).map((e, i) => (
                <tr key={i}><td>{e.ligne}</td><td>{e.raison}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Étape 1 : choisir le fichier */}
      {!analyse && (
        <form onSubmit={analyser} className="insc-barre" style={{ alignItems: 'center', gap: '.75rem' }}>
          <input type="file" accept=".xlsx,.csv,.xls"
            onChange={(e) => setFichier(e.target.files?.[0] || null)} aria-label="Fichier" />
          <Bouton type="submit" enCours={enCours}>Analyser le fichier</Bouton>
        </form>
      )}

      {/* Étape 2 : correspondance + aperçu */}
      {analyse && (
        <>
          <p style={{ margin: '0 0 .5rem', fontWeight: 600 }}>
            {analyse.nbLignes} ligne(s) détectée(s). Faites correspondre les colonnes :
          </p>
          <div className="tableau-enveloppe" style={{ marginBottom: '1rem' }}>
            <table className="tableau insc-tableau">
              <thead><tr><th>Champ du système</th><th>Colonne de votre fichier</th></tr></thead>
              <tbody>
                {champs.map((c) => (
                  <tr key={c.cle}>
                    <td className="insc-nom">{c.libelle}{c.requis && <span style={{ color: '#E53E3E' }}> *</span>}</td>
                    <td>
                      <select value={mapping[c.cle] ?? ''} onChange={(e) => majMap(c.cle, e.target.value)}>
                        <option value="">— ignorer —</option>
                        {analyse.entetes.map((h, i) => (
                          <option key={i} value={i}>{h || `Colonne ${i + 1}`}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p style={{ margin: '0 0 .4rem', fontWeight: 600 }}>Aperçu (premières lignes) :</p>
          <div className="tableau-enveloppe" style={{ marginBottom: '1rem' }}>
            <table className="tableau insc-tableau">
              <thead><tr>{analyse.entetes.map((h, i) => <th key={i}>{h || `Col ${i + 1}`}</th>)}</tr></thead>
              <tbody>
                {analyse.apercu.map((r, i) => (
                  <tr key={i}>{analyse.entetes.map((_, j) => <td key={j}>{r[j] ?? ''}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rangee" style={{ gap: '.6rem' }}>
            <Bouton type="button" enCours={enCours} onClick={lancer}>Importer</Bouton>
            <Bouton type="button" variante="secondaire" onClick={() => { setAnalyse(null); setFichier(null); }} disabled={enCours}>
              Annuler
            </Bouton>
          </div>
        </>
      )}

      <footer className="insc-pied">© {new Date().getFullYear()} Lekòl Pam. Tous droits réservés.</footer>
    </div>
  );
}
