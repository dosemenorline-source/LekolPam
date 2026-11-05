import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { reinscriptionApi } from '../../services/api.js';
import Carte from '../../components/Carte.jsx';
import Bouton from '../../components/Bouton.jsx';
import Alerte from '../../components/Alerte.jsx';
import Chargement from '../../components/Chargement.jsx';

const BADGE = {
  promu: { libelle: 'Promu(e)', classe: 'insc-badge-vert' },
  promu_defaut: { libelle: 'Promotion (à confirmer)', classe: 'insc-badge-vert' },
  maintenu: { libelle: 'Maintenu(e)', classe: 'insc-badge-or' },
  indetermine: { libelle: 'À confirmer', classe: 'insc-badge-gris' },
  diplome: { libelle: 'Fin de cycle', classe: 'insc-badge-ble' },
};

export default function Reinscription() {
  const navigate = useNavigate();
  const [data, setData] = useState(null); // { active, anneeCible, anneeEcoulee, enfants }
  const [erreur, setErreur] = useState('');
  const [msg, setMsg] = useState('');
  const [enCours, setEnCours] = useState(null); // id de l'élève en cours

  const charger = () => reinscriptionApi.mesEnfants()
    .then(setData)
    .catch((e) => setErreur(e.message));

  useEffect(() => { charger(); }, []);

  const reinscrire = async (enfant) => {
    setErreur(''); setMsg(''); setEnCours(enfant.id);
    try {
      const d = await reinscriptionApi.reinscrire(enfant.id);
      if (d.paiement) {
        // Frais requis : on enchaîne sur le paiement.
        navigate(`/paiements/${d.paiement.id}`);
        return;
      }
      setMsg(`Ré-inscription de ${enfant.nom} enregistrée — en attente du secrétariat.`);
      await charger();
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnCours(null);
    }
  };

  if (!data) return <Chargement />;

  if (!data.active) {
    return (
      <div className="insc-page" style={{ maxWidth: 720 }}>
        <div className="page-entete"><h1>Ré-inscription</h1></div>
        <Carte>
          <p className="texte-gris" style={{ margin: 0 }}>
            La ré-inscription n'est pas ouverte pour le moment. Vous recevrez un courriel
            dès que l'école lancera la campagne de ré-inscription.
          </p>
        </Carte>
      </div>
    );
  }

  return (
    <div className="insc-page" style={{ maxWidth: 820 }}>
      <div className="page-entete">
        <h1>Ré-inscription {data.anneeCible}</h1>
        <p>
          Ré-inscrivez votre/vos enfant(s) pour l'année {data.anneeCible}. Les élèves qui ont
          réussi passent au niveau supérieur ; ceux qui n'ont pas réussi restent au même niveau.
          Le dossier est ensuite validé par le secrétariat.
        </p>
      </div>

      {erreur && <Alerte type="erreur">{erreur}</Alerte>}
      {msg && <Alerte type="info">{msg}</Alerte>}

      {data.enfants.length === 0 ? (
        <Carte><p className="texte-gris" style={{ margin: 0 }}>Aucun enfant rattaché à votre compte.</p></Carte>
      ) : (
        <div className="pile pile-md">
          {data.enfants.map((e) => {
            const b = BADGE[e.resultat] || BADGE.indetermine;
            return (
              <Carte key={e.id}>
                <div className="rangee" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
                  <div>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: '1.05rem' }}>{e.nom}</p>
                    <p className="texte-gris" style={{ margin: '.25rem 0 0', fontSize: '.9rem' }}>
                      Niveau actuel : <strong>{e.niveauActuel || '—'}</strong>
                      {e.moyenne != null
                        ? <> · Moyenne {e.anneeEvaluee} : <strong>{e.moyenne.toFixed(2)}/100</strong></>
                        : <> · Résultats non disponibles</>}
                    </p>
                    <p style={{ margin: '.5rem 0 0', fontSize: '.92rem' }}>
                      <span className={`insc-badge ${b.classe}`}>{b.libelle}</span>
                      {e.resultat !== 'diplome' && (
                        <> &nbsp;→ niveau proposé : <strong>{e.niveauPropose}</strong></>
                      )}
                    </p>
                  </div>
                  <div style={{ flexShrink: 0 }}>
                    {e.resultat === 'diplome' ? (
                      <span className="texte-gris" style={{ fontSize: '.88rem' }}>Fin du cycle scolaire 🎓</span>
                    ) : e.dejaReinscrit ? (
                      <span className="insc-badge insc-badge-vert">Déjà ré-inscrit(e)</span>
                    ) : (
                      <div style={{ textAlign: 'right' }}>
                        <Bouton type="button" enCours={enCours === e.id} onClick={() => reinscrire(e)}>
                          {e.paiementEnAttente ? 'Continuer le paiement' : 'Ré-inscrire'}
                        </Bouton>
                        {e.paiementEnAttente && (
                          <p className="texte-gris" style={{ margin: '.35rem 0 0', fontSize: '.78rem' }}>
                            Frais non encore payés
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </Carte>
            );
          })}
        </div>
      )}
    </div>
  );
}
