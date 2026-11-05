import { useEffect, useState } from 'react';
import { reinscriptionApi } from '../../services/api.js';
import { dateHeureFr } from '../../utils/libelles.js';
import Carte from '../../components/Carte.jsx';
import Bouton from '../../components/Bouton.jsx';
import Alerte from '../../components/Alerte.jsx';
import Chargement from '../../components/Chargement.jsx';

export default function ReinscriptionProprio() {
  const [etat, setEtat] = useState(null); // { active, campagne, prochaineAnneeCible }
  const [erreur, setErreur] = useState('');
  const [msg, setMsg] = useState('');
  const [occupe, setOccupe] = useState(false);
  const [confirmer, setConfirmer] = useState(false);

  const charger = () => reinscriptionApi.statutProprio()
    .then(setEtat)
    .catch((e) => setErreur(e.message));

  useEffect(() => { charger(); }, []);

  const lancer = async () => {
    setErreur(''); setMsg(''); setOccupe(true); setConfirmer(false);
    try {
      const d = await reinscriptionApi.lancer();
      setMsg(`Campagne lancée pour ${d.anneeCible} — ${d.nbDestinataires} famille(s) notifiée(s) par courriel.`);
      await charger();
    } catch (e) {
      setErreur(e.message);
    } finally {
      setOccupe(false);
    }
  };

  const cloturer = async () => {
    setErreur(''); setMsg(''); setOccupe(true);
    try {
      await reinscriptionApi.cloturer();
      setMsg('Campagne clôturée.');
      await charger();
    } catch (e) {
      setErreur(e.message);
    } finally {
      setOccupe(false);
    }
  };

  if (!etat) return <Chargement />;

  const c = etat.campagne;

  return (
    <div style={{ maxWidth: 720 }}>
      <div className="page-entete">
        <h1>Ré-inscription</h1>
        <p>
          En fin d'année, lancez la ré-inscription : chaque famille reçoit un courriel avec un lien.
          Les élèves qui ont réussi passent au niveau supérieur, les autres restent au même niveau.
          Le secrétariat valide ensuite chaque dossier.
        </p>
      </div>

      {erreur && <Alerte type="erreur">{erreur}</Alerte>}
      {msg && <Alerte type="info">{msg}</Alerte>}

      <Carte>
        {etat.active ? (
          <>
            <p style={{ margin: 0, fontWeight: 700 }}>
              <span className="insc-badge insc-badge-vert">Campagne active</span>
              &nbsp; Année visée : {c?.annee_cible}
            </p>
            <p className="texte-gris" style={{ margin: '.5rem 0 0', fontSize: '.9rem' }}>
              Lancée le {dateHeureFr(c?.lancee_le)}{c?.nb_courriels != null && <> · {c.nb_courriels} famille(s) notifiée(s)</>}.
              Les parents peuvent ré-inscrire leurs enfants dès maintenant.
            </p>
            <div style={{ marginTop: '1rem' }}>
              <Bouton type="button" variante="secondaire" enCours={occupe} onClick={cloturer}>
                Clôturer la campagne
              </Bouton>
            </div>
          </>
        ) : (
          <>
            <p style={{ margin: 0 }}>
              Aucune campagne active.{' '}
              {c && <span className="texte-gris">Dernière : {c.annee_cible}, clôturée le {dateHeureFr(c.cloturee_le)}.</span>}
            </p>
            <p style={{ margin: '.75rem 0 0' }}>
              Prochaine année visée : <strong>{etat.prochaineAnneeCible}</strong>.
            </p>
            {!confirmer ? (
              <div style={{ marginTop: '1rem' }}>
                <Bouton type="button" onClick={() => setConfirmer(true)}>
                  Lancer la ré-inscription {etat.prochaineAnneeCible}
                </Bouton>
              </div>
            ) : (
              <div style={{ marginTop: '1rem' }}>
                <p style={{ margin: '0 0 .6rem', fontSize: '.9rem' }}>
                  Confirmer ? Un courriel sera envoyé à <strong>toutes les familles</strong> avec un lien de ré-inscription.
                </p>
                <div className="rangee" style={{ gap: '.6rem' }}>
                  <Bouton type="button" enCours={occupe} onClick={lancer}>Oui, lancer</Bouton>
                  <Bouton type="button" variante="secondaire" onClick={() => setConfirmer(false)} disabled={occupe}>Annuler</Bouton>
                </div>
              </div>
            )}
          </>
        )}
      </Carte>

      <footer className="insc-pied">© {new Date().getFullYear()} Lekòl Pam. Tous droits réservés.</footer>
    </div>
  );
}
