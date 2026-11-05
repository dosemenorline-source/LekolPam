import { useState, useEffect } from 'react';
import { syncApi } from '../../services/api.js';
import { dateHeureFr } from '../../utils/libelles.js';
import Carte from '../../components/Carte.jsx';
import Bouton from '../../components/Bouton.jsx';
import Alerte from '../../components/Alerte.jsx';
import Chargement from '../../components/Chargement.jsx';

export default function Postes() {
  const [noeuds, setNoeuds] = useState(null);
  const [erreur, setErreur] = useState('');
  const [nom, setNom] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [nouveau, setNouveau] = useState(null); // { nom, jeton } — affiché UNE fois
  const [copie, setCopie] = useState(false);

  const charger = () => syncApi.noeuds().then(setNoeuds).catch((e) => setErreur(e.message));
  useEffect(() => { charger(); }, []);

  const creer = async (e) => {
    e.preventDefault();
    setErreur(''); setNouveau(null); setCopie(false);
    const n = nom.trim();
    if (!n) { setErreur('Donnez un nom au poste (ex. « Secrétariat 1 »).'); return; }
    setEnCours(true);
    try {
      const r = await syncApi.creerNoeud(n);
      setNouveau(r);           // { id, nom, jeton }
      setNom('');
      await charger();
    } catch (err) {
      setErreur(err.message);
    } finally {
      setEnCours(false);
    }
  };

  const revoquer = async (poste) => {
    if (!window.confirm(`Révoquer le poste « ${poste.nom} » ? Il ne pourra plus se synchroniser.`)) return;
    setErreur('');
    try {
      await syncApi.revoquerNoeud(poste.id);
      await charger();
    } catch (err) {
      setErreur(err.message);
    }
  };

  const copier = async () => {
    try { await navigator.clipboard.writeText(nouveau.jeton); setCopie(true); } catch { /* copier à la main */ }
  };

  if (erreur && !noeuds) {
    return (
      <div style={{ maxWidth: 760 }}>
        <div className="page-entete"><h1>Postes de synchronisation</h1></div>
        <Alerte type="erreur">{erreur}</Alerte>
        <Bouton type="button" onClick={charger}>Réessayer</Bouton>
      </div>
    );
  }
  if (!noeuds) return <Chargement />;

  return (
    <div style={{ maxWidth: 760 }}>
      <div className="page-entete">
        <h1>Postes de synchronisation</h1>
        <p>Autorisez les ordinateurs du bureau à travailler hors ligne et à se synchroniser avec le
          nuage. Créez un jeton par poste, puis saisissez-le dans l'application de bureau installée
          sur cet ordinateur.</p>
      </div>

      <Alerte type="erreur">{erreur}</Alerte>

      {nouveau && (
        <Alerte type="succes">
          <strong>Poste « {nouveau.nom} » créé.</strong> Copiez ce jeton maintenant — il ne sera
          <strong> plus jamais affiché</strong> :
          <div style={{
            display: 'flex', gap: 8, alignItems: 'center', marginTop: 10, flexWrap: 'wrap',
          }}>
            <code style={{
              flex: '1 1 320px', padding: '8px 10px', background: 'rgba(0,0,0,.06)',
              borderRadius: 6, wordBreak: 'break-all', fontSize: '.85rem',
            }}>{nouveau.jeton}</code>
            <Bouton type="button" sm onClick={copier}>{copie ? 'Copié ✓' : 'Copier'}</Bouton>
          </div>
        </Alerte>
      )}

      <Carte>
        <form onSubmit={creer} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 260px' }}>
            <label htmlFor="nom-poste" style={{ display: 'block', fontSize: '.85rem', marginBottom: 4 }}>
              Nom du nouveau poste
            </label>
            <input
              id="nom-poste" type="text" value={nom} onChange={(e) => setNom(e.target.value)}
              placeholder="Secrétariat 1" maxLength={120}
              style={{ width: '100%', padding: '.6rem .7rem', borderRadius: 6, border: '1px solid #cbd5e0' }}
            />
          </div>
          <Bouton type="submit" enCours={enCours}>Créer un jeton</Bouton>
        </form>
      </Carte>

      <Carte>
        <h2 style={{ fontSize: '1rem', marginTop: 0 }}>Postes enregistrés</h2>
        {noeuds.length === 0 && <p style={{ color: '#718096' }}>Aucun poste pour l'instant.</p>}
        {noeuds.map((p) => (
          <div key={p.id} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
            padding: '12px 0', borderTop: '1px solid #edf2f7', flexWrap: 'wrap',
          }}>
            <div>
              <div style={{ fontWeight: 600 }}>
                {p.nom} {!p.actif && <span style={{ color: '#c53030', fontWeight: 400 }}>(révoqué)</span>}
              </div>
              <div style={{ fontSize: '.8rem', color: '#718096' }}>
                Créé le {dateHeureFr(p.cree_le)}
                {p.dernier_pull ? ` · dernière synchro ${dateHeureFr(p.dernier_pull)}` : ' · jamais synchronisé'}
              </div>
            </div>
            {p.actif && (
              <Bouton type="button" variante="danger" sm onClick={() => revoquer(p)}>Révoquer</Bouton>
            )}
          </div>
        ))}
      </Carte>
    </div>
  );
}
