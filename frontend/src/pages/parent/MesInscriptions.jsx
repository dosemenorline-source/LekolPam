import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { inscriptionsApi } from '../../services/api.js';
import Bouton from '../../components/Bouton.jsx';
import Badge from '../../components/Badge.jsx';
import Alerte from '../../components/Alerte.jsx';
import Chargement from '../../components/Chargement.jsx';
import Carte from '../../components/Carte.jsx';

export default function MesInscriptions() {
  const [inscriptions, setInscriptions] = useState(null);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    inscriptionsApi.lister()
      .then((d) => setInscriptions(d.inscriptions))
      .catch((e) => setErreur(e.message));
  }, []);

  if (erreur) return <Alerte type="erreur">{erreur}</Alerte>;
  if (!inscriptions) return <Chargement />;

  return (
    <div>
      <div className="page-entete rangee entre">
        <div>
          <h1>Mes inscriptions</h1>
          <p>Suivez les dossiers d'inscription de vos enfants.</p>
        </div>
        <Link to="/inscriptions/nouvelle"><Bouton>+ Nouvelle inscription</Bouton></Link>
      </div>

      {inscriptions.length === 0 ? (
        <Carte>
          <p className="texte-gris">Aucune inscription pour l'instant.</p>
          <Link to="/inscriptions/nouvelle" style={{ display: 'inline-block', marginTop: '.75rem' }}>
            <Bouton variante="secondaire">Créer ma première inscription</Bouton>
          </Link>
        </Carte>
      ) : (
        <div className="tableau-enveloppe">
          <table className="tableau">
            <thead>
              <tr><th>Élève</th><th>Niveau</th><th>Année</th><th>Statut</th><th></th></tr>
            </thead>
            <tbody>
              {inscriptions.map((i) => (
                <tr key={i.id}>
                  <td style={{ fontWeight: 600 }}>{i.eleve_nom}</td>
                  <td>{i.niveau || '—'}</td>
                  <td>{i.annee_scolaire}</td>
                  <td><Badge statut={i.statut} /></td>
                  <td><Link to={`/inscriptions/${i.id}`}>Voir le dossier</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
