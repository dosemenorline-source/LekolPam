import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  paiementsApi, notesApi, urlPreuvePaiement, urlDocumentOfficiel,
} from '../../services/api.js';
import { libelleTypeFrais, montantFr, dateHeureFr } from '../../utils/libelles.js';
import Carte from '../../components/Carte.jsx';
import Champ from '../../components/Champ.jsx';
import Bouton from '../../components/Bouton.jsx';
import Badge from '../../components/Badge.jsx';
import Alerte from '../../components/Alerte.jsx';
import Chargement from '../../components/Chargement.jsx';

const LIBELLE_METHODE = { moncash: 'MonCash', natcash: 'NatCash', kashpaw: 'KashPay', carte: 'Carte Visa/Mastercard' };
const LOGO_METHODE = { moncash: '/paiement/moncash.jpg', natcash: '/paiement/natcash.png', kashpaw: '/paiement/kashpaw.png', carte: '/paiement/carte.png' };

export default function DetailPaiement() {
  const { id } = useParams();
  const [paiement, setPaiement] = useState(null);
  const [coord, setCoord] = useState(null);
  const [docs, setDocs] = useState([]);
  const [erreur, setErreur] = useState('');
  const [fichier, setFichier] = useState(null);
  const [envoi, setEnvoi] = useState(false);
  const [msg, setMsg] = useState('');
  const [methodeEnCours, setMethodeEnCours] = useState(null);
  const [verifEnCours, setVerifEnCours] = useState(false);

  const charger = () => {
    Promise.all([paiementsApi.detail(id), paiementsApi.coordonnees()])
      .then(async ([p, c]) => {
        setPaiement(p.paiement);
        setCoord(c);
        // Document généré (relevé / duplicata) si validé
        if (p.paiement.statut === 'valide' && p.paiement.type_frais !== 'inscription') {
          try {
            const d = await notesApi.documentsOfficielsEleve(p.paiement.id_reference);
            setDocs(d.documents.filter((x) => x.type === p.paiement.type_frais));
          } catch { /* ignore */ }
        }
      })
      .catch((e) => setErreur(e.message));
  };
  useEffect(() => { charger(); /* eslint-disable-next-line */ }, [id]);

  const televerser = async (e) => {
    e.preventDefault();
    setErreur(''); setMsg('');
    if (!fichier) { setErreur('Veuillez choisir un fichier.'); return; }
    setEnvoi(true);
    try {
      await paiementsApi.televerserPreuve(id, fichier);
      setMsg('Preuve téléversée. Le secrétariat va la vérifier.');
      setFichier(null);
      e.target.reset();
      charger();
    } catch (err) {
      setErreur(err.message);
    } finally {
      setEnvoi(false);
    }
  };

  const payerMobile = async (methode) => {
    if (methodeEnCours) return; // double-clic : un seul démarrage à la fois
    setErreur(''); setMethodeEnCours(methode);
    try {
      const d = await paiementsApi.demarrerPaiementMobile(id, methode);
      // Défense en profondeur (le serveur filtre déjà les domaines) : jamais
      // de redirection hors HTTPS.
      if (!/^https:\/\//i.test(d.urlRedirection || '')) throw new Error('URL de paiement invalide.');
      localStorage.setItem('paiement_mobile_id', id);
      window.location.href = d.urlRedirection;
    } catch (err) {
      setErreur(err.message);
      setMethodeEnCours(null);
    }
  };

  const verifierMobile = async () => {
    setErreur(''); setMsg(''); setVerifEnCours(true);
    try {
      await paiementsApi.confirmerPaiementMobile(id);
      setMsg('Paiement vérifié.');
      charger();
    } catch (err) {
      setErreur(err.message);
    } finally {
      setVerifEnCours(false);
    }
  };

  if (erreur && !paiement) return <Alerte type="erreur">{erreur}</Alerte>;
  if (!paiement) return <Chargement />;

  const enAttente = paiement.statut === 'en_attente';
  // Frais d'un dossier d'inscription pas encore transmis : en ligne uniquement
  const fraisDossier = ['attente_paiement', 'annulee'].includes(paiement.inscription_statut);
  const dossierAnnule = paiement.inscription_statut === 'annulee';

  return (
    <div style={{ maxWidth: 640 }}>
      <div className="page-entete">
        <Link to="/paiements" className="navbar-lien" style={{ paddingLeft: 0 }}>← Mes paiements</Link>
        <div className="rangee entre" style={{ marginTop: '.5rem' }}>
          <h1>{libelleTypeFrais(paiement.type_frais)}</h1>
          <Badge statut={paiement.statut} />
        </div>
      </div>

      <Alerte type="erreur">{erreur}</Alerte>
      <Alerte type="info">{msg}</Alerte>

      <div className="pile pile-md">
        <Carte titre="Détails">
          <ul className="pile pile-sm" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            <li><span className="texte-gris">Montant : </span><strong>{montantFr(paiement.montant, paiement.devise)}</strong></li>
            <li><span className="texte-gris">Créé le : </span>{dateHeureFr(paiement.cree_le)}</li>
            {paiement.preuve_url && (
              <li><a href={urlPreuvePaiement(paiement.id)} target="_blank" rel="noreferrer">Voir la preuve téléversée</a></li>
            )}
          </ul>
        </Carte>

        {enAttente && dossierAnnule && (
          <Alerte type="erreur">
            Le dossier d'inscription a été annulé : les frais n'ont pas été payés à temps.
            Si vous avez déjà payé, vérifiez le paiement ci-dessous — le dossier sera réactivé.
            Sinon, <Link to="/inscriptions/nouvelle">soumettez un nouveau dossier</Link>.
          </Alerte>
        )}

        {enAttente && coord && !fraisDossier && (
          <Carte titre="Coordonnées de paiement">
            <p className="texte-gris" style={{ marginBottom: '.5rem' }}>
              Effectuez le dépôt puis téléversez la preuve ci-dessous.
            </p>
            <ul className="pile pile-sm" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              <li><span className="texte-gris">École : </span>{coord.nom}</li>
              <li><span className="texte-gris">Banque : </span>{coord.coordonneesBancaires || '—'}</li>
              <li><span className="texte-gris">MonCash : </span>{coord.coordonneesMoncash || '—'}</li>
            </ul>
          </Carte>
        )}

        {enAttente && !dossierAnnule && paiement.devise === 'HTG' && paiement.methode_paiement === 'manuel' && !paiement.preuve_url && (
          <Carte titre="Payer en ligne">
            <p className="texte-gris" style={{ marginBottom: '.75rem' }}>
              {fraisDossier
                ? "Payez les frais d'inscription pour transmettre votre dossier au secrétariat. Sans paiement dans les 2 minutes, le dossier est annulé."
                : 'Payez directement par mobile ou par carte Visa/Mastercard — le paiement est confirmé automatiquement, sans preuve à téléverser.'}
            </p>
            <div className="rangee" style={{ flexWrap: 'wrap' }}>
              {Object.entries(LIBELLE_METHODE).map(([m, libelle]) => (
                <Bouton key={m} type="button" onClick={() => payerMobile(m)} enCours={methodeEnCours === m}
                  disabled={!!methodeEnCours}
                  style={{ padding: 0, background: 'transparent', border: 'none', overflow: 'hidden', borderRadius: 'var(--rayon-sm)' }}>
                  <img src={LOGO_METHODE[m]} alt={`Payer avec ${libelle}`} style={{ height: 46, display: 'block' }} />
                </Bouton>
              ))}
            </div>
          </Carte>
        )}

        {enAttente && paiement.methode_paiement !== 'manuel' && (
          <Carte titre={`Paiement ${LIBELLE_METHODE[paiement.methode_paiement] || paiement.methode_paiement}`}>
            <p className="texte-gris" style={{ marginBottom: '.75rem' }}>
              Un paiement {LIBELLE_METHODE[paiement.methode_paiement] || paiement.methode_paiement} a été démarré
              pour cette demande. S'il n'a pas été confirmé automatiquement après votre retour, vérifiez-le
              manuellement ci-dessous.
            </p>
            <div className="rangee">
              <Bouton type="button" variante="secondaire" onClick={verifierMobile} enCours={verifEnCours}>
                Vérifier le paiement
              </Bouton>
              {!dossierAnnule && (
                <Bouton type="button" variante="fantome" onClick={() => payerMobile(paiement.methode_paiement)} enCours={methodeEnCours === paiement.methode_paiement}>
                  Réessayer avec {LIBELLE_METHODE[paiement.methode_paiement] || paiement.methode_paiement}
                </Bouton>
              )}
            </div>
          </Carte>
        )}

        {enAttente && paiement.methode_paiement === 'manuel' && !paiement.preuve_url && !fraisDossier && (
          <Carte titre="Téléverser la preuve de paiement">
            <form onSubmit={televerser}>
              <Champ label="Fichier (PDF, JPG, PNG — 5 Mo)" type="file"
                accept="application/pdf,image/jpeg,image/png"
                onChange={(e) => setFichier(e.target.files[0])} />
              <Bouton type="submit" enCours={envoi}>Téléverser la preuve</Bouton>
            </form>
          </Carte>
        )}

        {enAttente && paiement.preuve_url && (
          <Alerte type="info">Preuve reçue. En attente de validation par le secrétariat.</Alerte>
        )}

        {paiement.statut === 'valide' && paiement.type_frais === 'inscription' && (
          <Alerte type="info">
            {paiement.inscription_statut === 'confirmee'
              ? "Paiement validé — l'inscription est confirmée."
              : 'Paiement validé — votre dossier est transmis au secrétariat, qui vous informera de sa décision.'}
          </Alerte>
        )}

        {paiement.statut === 'valide' && paiement.type_frais !== 'inscription' && (
          <Carte titre="Document délivré">
            {docs.length === 0 ? (
              <p className="texte-gris">Document en cours de préparation.</p>
            ) : (
              <ul className="pile pile-sm" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {docs.map((d) => (
                  <li key={d.id}>
                    <a href={urlDocumentOfficiel(d.id)} target="_blank" rel="noreferrer">
                      Télécharger le {libelleTypeFrais(paiement.type_frais).toLowerCase()} (PDF)
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </Carte>
        )}

        {paiement.statut === 'rejete' && (
          <Alerte type="erreur">
            Paiement rejeté. Veuillez créer un nouveau paiement avec une preuve valide.
          </Alerte>
        )}
      </div>
    </div>
  );
}
