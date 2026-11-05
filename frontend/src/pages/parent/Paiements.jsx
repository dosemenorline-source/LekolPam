import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { paiementsApi } from '../../services/api.js';
import { libelleTypeFrais, montantFr, dateFr } from '../../utils/libelles.js';
import Bouton from '../../components/Bouton.jsx';
import Badge from '../../components/Badge.jsx';
import Alerte from '../../components/Alerte.jsx';
import Chargement from '../../components/Chargement.jsx';
import Carte from '../../components/Carte.jsx';

export default function Paiements() {
  const [paiements, setPaiements] = useState(null);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    paiementsApi.lister()
      .then((d) => setPaiements(d.paiements))
      .catch((e) => setErreur(e.message));
  }, []);

  if (erreur) return <Alerte type="erreur">{erreur}</Alerte>;
  if (!paiements) return <Chargement />;

  return (
    <div>
      <div className="page-entete rangee entre">
        <div>
          <h1>Mes paiements</h1>
          <p>Frais d'inscription, relevés et duplicatas.</p>
        </div>
        <Link to="/paiements/nouveau"><Bouton>+ Nouveau paiement</Bouton></Link>
      </div>

      {paiements.length === 0 ? (
        <Carte>
          <p className="texte-gris">Aucun paiement pour l'instant.</p>
          <Link to="/paiements/nouveau" style={{ display: 'inline-block', marginTop: '.75rem' }}>
            <Bouton variante="secondaire">Créer un paiement</Bouton>
          </Link>
        </Carte>
      ) : (
        <div className="tableau-enveloppe">
          <table className="tableau">
            <thead>
              <tr><th>Type</th><th>Montant</th><th>Statut</th><th>Date</th><th></th></tr>
            </thead>
            <tbody>
              {paiements.map((p) => (
                <tr key={p.id}>
                  <td>{libelleTypeFrais(p.type_frais)}</td>
                  <td>{montantFr(p.montant, p.devise)}</td>
                  <td><Badge statut={p.statut} /></td>
                  <td>{dateFr(p.cree_le)}</td>
                  <td><Link to={`/paiements/${p.id}`}>Voir</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
