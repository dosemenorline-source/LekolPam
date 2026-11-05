import { useEffect, useState } from 'react';
import { directionApi, urlRapportExport, urlLogoEcole } from '../../services/api.js';
import { dateHeureFr } from '../../utils/libelles.js';
import Carte from '../../components/Carte.jsx';
import Bouton from '../../components/Bouton.jsx';
import Alerte from '../../components/Alerte.jsx';
import Chargement from '../../components/Chargement.jsx';
import Icone from '../../components/Icone.jsx';

const LIBELLE_ENTITE = { inscription: 'Inscription', paiement: 'Paiement', document_soumis: 'Document' };
const LIBELLE_ROLE = { admin: 'Secrétariat', direction: 'Direction', proprietaire: 'Propriétaire' };
const moisCourant = () => new Date().toISOString().slice(0, 7);

export default function Rapport() {
  const [mois, setMois] = useState(moisCourant());
  const [listeMois, setListeMois] = useState([]);
  const [data, setData] = useState(null);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    setData(null); setErreur('');
    directionApi.rapport(mois)
      .then((d) => { setData(d); if (d.moisDisponibles) setListeMois(d.moisDisponibles); })
      .catch((e) => setErreur(e.message));
  }, [mois]);

  const moisLisible = (m) => {
    const [y, mo] = m.split('-');
    return new Date(Number(y), Number(mo) - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  };

  return (
    <div style={{ maxWidth: 860 }}>
      <div className="page-entete rangee" style={{ gap: '1rem', alignItems: 'center' }}>
        <img src={urlLogoEcole()} alt="" style={{ height: 52, width: 52, objectFit: 'contain', flexShrink: 0 }}
          onError={(e) => { e.currentTarget.style.display = 'none'; }} />
        <div>
          <h1 style={{ margin: 0 }}>Rapport mensuel</h1>
          <p style={{ margin: '.25rem 0 0' }}>Activité de la direction et du secrétariat, mois par mois. Exportable en Excel/CSV.</p>
        </div>
      </div>

      <Carte>
        <div className="rangee entre" style={{ flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-end' }}>
          <div className="champ" style={{ margin: 0, minWidth: 220 }}>
            <label htmlFor="rapport-mois">Mois</label>
            <select id="rapport-mois" value={mois} onChange={(e) => setMois(e.target.value)}>
              {(listeMois.length ? listeMois : [mois]).map((m) => (
                <option key={m} value={m}>{moisLisible(m)}</option>
              ))}
            </select>
          </div>
          <a href={urlRapportExport(mois)} download>
            <Bouton type="button"><Icone nom="download" /> Exporter en Excel / CSV</Bouton>
          </a>
        </div>
      </Carte>

      {erreur && <Alerte type="erreur">{erreur}</Alerte>}
      {!data && !erreur ? <Chargement /> : data && (
        <div className="pile pile-md" style={{ marginTop: '1rem' }}>
          <Carte titre={`Résumé — ${moisLisible(data.mois)}`}>
            {data.resume.length === 0 ? (
              <p className="texte-gris">Aucune activité enregistrée ce mois-ci.</p>
            ) : (
              <div className="tableau-enveloppe">
                <table className="tableau">
                  <thead><tr><th>Type</th><th>Statut</th><th>Nombre</th></tr></thead>
                  <tbody>
                    {data.resume.map((r, i) => (
                      <tr key={i}>
                        <td>{LIBELLE_ENTITE[r.entite] || r.entite}</td>
                        <td>{r.nouveau_statut}</td>
                        <td>{r.n}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Carte>

          <Carte titre="Activité par agent (direction / secrétariat)">
            {data.parAgent.length === 0 ? (
              <p className="texte-gris">Aucune action du personnel ce mois-ci.</p>
            ) : (
              <div className="tableau-enveloppe">
                <table className="tableau">
                  <thead><tr>
                    <th>Nom</th><th>Rôle</th><th>Inscriptions</th><th>Paiements</th>
                    <th>Documents</th><th>Total</th><th>Dernière action</th>
                  </tr></thead>
                  <tbody>
                    {data.parAgent.map((a, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 600 }}>{a.nom}<br /><span className="texte-gris" style={{ fontSize: '.8rem' }}>{a.courriel}</span></td>
                        <td>{LIBELLE_ROLE[a.role] || a.role}</td>
                        <td>{a.inscriptions}</td>
                        <td>{a.paiements}</td>
                        <td>{a.documents}</td>
                        <td style={{ fontWeight: 700 }}>{a.total}</td>
                        <td>{a.derniereAction ? dateHeureFr(a.derniereAction) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Carte>

          <Carte titre="Connexions du personnel">
            {data.connexions.length === 0 ? (
              <p className="texte-gris">Aucune connexion enregistrée ce mois-ci.</p>
            ) : (
              <div className="tableau-enveloppe">
                <table className="tableau">
                  <thead><tr><th>Courriel</th><th>Connexions</th><th>Dernière connexion</th></tr></thead>
                  <tbody>
                    {data.connexions.map((c, i) => (
                      <tr key={i}>
                        <td>{c.courriel}</td>
                        <td>{c.n}</td>
                        <td>{c.derniere ? dateHeureFr(c.derniere) : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Carte>
        </div>
      )}

      <footer className="insc-pied">© {new Date().getFullYear()} Lekòl Pam. Tous droits réservés.</footer>
    </div>
  );
}
