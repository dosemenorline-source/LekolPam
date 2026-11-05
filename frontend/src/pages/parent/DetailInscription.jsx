import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { inscriptionsApi, urlDocumentSoumis } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import Carte from '../../components/Carte.jsx';
import Champ from '../../components/Champ.jsx';
import Bouton from '../../components/Bouton.jsx';
import Badge from '../../components/Badge.jsx';
import Alerte from '../../components/Alerte.jsx';
import Chargement from '../../components/Chargement.jsx';

const TYPES_DOC = [
  { valeur: 'acte_naissance', libelle: 'Acte de naissance' },
  { valeur: 'bulletin', libelle: 'Dernier bulletin' },
  { valeur: 'photo', libelle: "Photo d'identité" },
  { valeur: 'autre', libelle: 'Autre' },
];
const libelleType = (t) => TYPES_DOC.find((x) => x.valeur === t)?.libelle || t;
const libelleStatutHist = (s) => ({
  en_attente: 'En attente', accepte: 'Accepté', refuse: 'Refusé',
  complement_demande: 'Complément demandé', confirmee: 'Confirmée',
  attente_paiement: 'En attente de paiement', annulee: 'Annulée',
}[s] || s);

// Temps restant avant l'annulation automatique d'un dossier impayé
function useSecondesRestantes(echeance) {
  const [maintenant, setMaintenant] = useState(Date.now());
  useEffect(() => {
    if (!echeance) return undefined;
    const t = setInterval(() => setMaintenant(Date.now()), 1000);
    return () => clearInterval(t);
  }, [echeance]);
  if (!echeance) return null;
  return Math.max(0, Math.round((new Date(echeance).getTime() - maintenant) / 1000));
}
const dateFr = (s) => (s ? new Date(s).toLocaleString('fr-FR') : '');

export default function DetailInscription() {
  const { id } = useParams();
  const { utilisateur } = useAuth();
  const estCompteEleve = !!utilisateur?.compteEleve;
  const motResponsable = estCompteEleve ? 'responsable' : 'parent';
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [erreur, setErreur] = useState('');
  const [annulation, setAnnulation] = useState(false);
  const secondesRestantes = useSecondesRestantes(data?.echeancePaiement);

  // Formulaire de téléversement
  const [type, setType] = useState('acte_naissance');
  const [fichier, setFichier] = useState(null);
  const [envoi, setEnvoi] = useState(false);
  const [msgDoc, setMsgDoc] = useState('');
  const [erreurDoc, setErreurDoc] = useState('');

  const charger = () => {
    inscriptionsApi.detail(id)
      .then(setData)
      .catch((e) => setErreur(e.message));
  };
  useEffect(() => { charger(); /* eslint-disable-next-line */ }, [id]);

  const televerser = async (e) => {
    e.preventDefault();
    setErreurDoc(''); setMsgDoc('');
    if (!fichier) { setErreurDoc('Veuillez choisir un fichier.'); return; }
    setEnvoi(true);
    try {
      await inscriptionsApi.televerserDocument(id, type, fichier);
      setMsgDoc('Document téléversé.');
      setFichier(null);
      e.target.reset();
      charger();
    } catch (err) {
      setErreurDoc(err.message);
    } finally {
      setEnvoi(false);
    }
  };

  const annuler = async () => {
    if (!window.confirm('Annuler ce dossier ? Il ne sera pas transmis au secrétariat.')) return;
    setAnnulation(true);
    try {
      await inscriptionsApi.annuler(id);
      charger();
    } catch (err) {
      setErreur(err.message);
    } finally {
      setAnnulation(false);
    }
  };

  if (erreur) return <Alerte type="erreur">{erreur}</Alerte>;
  if (!data) return <Chargement />;

  const { inscription, documents, historique, paiement } = data;
  const minSec = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div>
      <div className="page-entete">
        <Link to="/inscriptions" className="navbar-lien" style={{ paddingLeft: 0 }}>← Mes inscriptions</Link>
        <div className="rangee entre" style={{ marginTop: '.5rem' }}>
          <h1>Dossier de {inscription.eleve_nom}</h1>
          <Badge statut={inscription.statut} />
        </div>
      </div>

      {inscription.statut === 'attente_paiement' && (
        <div style={{ marginBottom: '1rem' }}>
          <Carte titre="Paiement des frais d'inscription">
            <p className="texte-gris" style={{ marginBottom: '.75rem' }}>
              Votre dossier ne sera transmis au secrétariat qu'après le paiement des frais
              {paiement ? ` (${Number(paiement.montant).toLocaleString('fr-FR')} ${paiement.devise})` : ''}.
              {secondesRestantes > 0
                ? ` Temps restant avant l'annulation : ${minSec(secondesRestantes)}.`
                : ' Le délai est dépassé : le dossier va être annulé.'}
            </p>
            <div className="rangee" style={{ flexWrap: 'wrap' }}>
              {paiement && (
                <Bouton type="button" onClick={() => navigate(`/paiements/${paiement.id}`)}>Payer maintenant</Bouton>
              )}
              <Bouton type="button" variante="fantome" onClick={annuler} enCours={annulation}>Annuler le dossier</Bouton>
            </div>
          </Carte>
        </div>
      )}

      {inscription.statut === 'annulee' && (
        <Alerte type="erreur">
          Ce dossier a été annulé : les frais d'inscription n'ont pas été payés à temps.
          Si vous avez payé, il sera réactivé automatiquement dès la confirmation du paiement.
          Sinon, <Link to="/inscriptions/nouvelle">soumettez un nouveau dossier</Link>.
        </Alerte>
      )}

      <div className="grille grille-2" style={{ alignItems: 'start' }}>
        <Carte titre="Informations">
          <ul className="pile pile-sm" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            <li><span className="texte-gris">Niveau : </span>{inscription.niveau || '—'}</li>
            <li><span className="texte-gris">Année scolaire : </span>{inscription.annee_scolaire}</li>
            <li><span className="texte-gris">Date de naissance : </span>{inscription.date_naissance ? new Date(inscription.date_naissance).toLocaleDateString('fr-FR') : '—'}</li>
            <li><span className="texte-gris">Soumis le : </span>{dateFr(inscription.date_soumission)}</li>
          </ul>
        </Carte>

        <Carte titre="Historique du statut">
          {historique.length === 0 ? (
            <p className="texte-gris">Aucun changement.</p>
          ) : (
            <ul className="pile pile-sm" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {historique.map((h, idx) => (
                <li key={idx} className="pile" style={{ borderLeft: '2px solid var(--gris-bordure)', paddingLeft: '.75rem' }}>
                  <span style={{ fontWeight: 600 }}>{libelleStatutHist(h.nouveau_statut)}</span>
                  <span className="texte-gris" style={{ fontSize: '.82rem' }}>{dateFr(h.cree_le)}</span>
                  {h.commentaire && <span style={{ fontSize: '.88rem' }}>« {h.commentaire} »</span>}
                </li>
              ))}
            </ul>
          )}
        </Carte>
      </div>

      <div style={{ marginTop: '1rem' }}>
        <Carte titre="Informations complémentaires">
          <ul className="pile pile-sm" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            <li><span className="texte-gris">Nom du {motResponsable} : </span>{inscription.nom_parent || '—'}</li>
            <li><span className="texte-gris">Profession du {motResponsable} : </span>{inscription.profession_parent || '—'}</li>
            <li><span className="texte-gris">Téléphone du {motResponsable} : </span>{inscription.telephone_parent || '—'}</li>
            <li><span className="texte-gris">Ancienne école : </span>{inscription.ancienne_ecole || '—'}</li>
            <li><span className="texte-gris">Dernière classe suivie : </span>{inscription.ancienne_classe || '—'}</li>
            <li><span className="texte-gris">Raison du choix : </span>{inscription.raison_choix || '—'}</li>
          </ul>
        </Carte>
      </div>

      <div style={{ marginTop: '1rem' }}>
        <Carte titre="Documents">
          {documents.length === 0 ? (
            <p className="texte-gris">Aucun document téléversé.</p>
          ) : (
            <div className="tableau-enveloppe" style={{ marginBottom: '1.25rem' }}>
              <table className="tableau">
                <thead><tr><th>Type</th><th>Statut</th><th>Téléversé le</th><th></th></tr></thead>
                <tbody>
                  {documents.map((d) => (
                    <tr key={d.id}>
                      <td>{libelleType(d.type)}</td>
                      <td><Badge statut={d.statut_verification} /></td>
                      <td>{dateFr(d.televerse_le)}</td>
                      <td><a href={urlDocumentSoumis(d.id)} target="_blank" rel="noreferrer">Ouvrir</a></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <form onSubmit={televerser}>
            <h4 style={{ marginBottom: '.75rem' }}>Téléverser un document</h4>
            <Alerte type="erreur">{erreurDoc}</Alerte>
            <Alerte type="info">{msgDoc}</Alerte>
            <div className="rangee" style={{ alignItems: 'flex-end', gap: '1rem', flexWrap: 'wrap' }}>
              <Champ label="Type" enfant={
                <select value={type} onChange={(e) => setType(e.target.value)}>
                  {TYPES_DOC.map((t) => <option key={t.valeur} value={t.valeur}>{t.libelle}</option>)}
                </select>
              } />
              <Champ label="Fichier (PDF, JPG, PNG — 5 Mo)" type="file"
                accept="application/pdf,image/jpeg,image/png"
                onChange={(e) => setFichier(e.target.files[0])} />
              <div style={{ marginBottom: '1rem' }}>
                <Bouton type="submit" enCours={envoi}>Téléverser</Bouton>
              </div>
            </div>
          </form>
        </Carte>
      </div>
    </div>
  );
}
