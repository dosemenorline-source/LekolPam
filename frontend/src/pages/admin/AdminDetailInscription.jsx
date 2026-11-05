import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { inscriptionsApi, adminApi, urlDocumentSoumis } from '../../services/api.js';
import { dateHeureFr, dateFr, calculerAge, libelleSexe } from '../../utils/libelles.js';
import Alerte from '../../components/Alerte.jsx';
import Chargement from '../../components/Chargement.jsx';
import Icone from '../../components/Icone.jsx';

const TYPES_DOC = { acte_naissance: 'Acte de naissance', bulletin: 'Bulletin', photo: "Photo d'identité", autre: 'Autre' };

const ACTIONS = [
  { valeur: 'accepte', libelle: 'Accepter', ton: 'vert' },
  { valeur: 'complement_demande', libelle: 'Demander un complément', ton: 'or' },
  { valeur: 'refuse', libelle: 'Refuser', ton: 'rouge' },
];

const LIBELLE_STATUT = {
  en_attente: 'En attente', complement_demande: 'Complément demandé',
  accepte: 'Accepté', refuse: 'Refusé', confirmee: 'Confirmée',
  valide: 'Validé', rejete: 'Rejeté',
};
const tonStatut = (s) => (s === 'accepte' || s === 'confirmee' || s === 'valide' ? 'vert'
  : s === 'refuse' || s === 'rejete' ? 'rouge' : 'or');

const BadgeStatut = ({ statut }) => (
  <span className={`insc-badge insc-badge-${tonStatut(statut)}`}>{LIBELLE_STATUT[statut] || statut}</span>
);

// Ligne d'information (valeur ou tiret grisé si vide)
const Info = ({ libelle, valeur }) => (
  <div className="traiter-info">
    <span className="traiter-info-libelle">{libelle}</span>
    <span className={valeur ? 'traiter-info-valeur' : 'traiter-info-vide'}>{valeur || '—'}</span>
  </div>
);

export default function AdminDetailInscription() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [erreur, setErreur] = useState('');
  const [statut, setStatut] = useState('accepte');
  const [commentaire, setCommentaire] = useState('');
  const [msg, setMsg] = useState('');
  const [confirme, setConfirme] = useState(false);   // modale de confirmation
  const [enCours, setEnCours] = useState(false);
  const [iaEnCours, setIaEnCours] = useState(false); // génération IA du message
  const [erreurIA, setErreurIA] = useState('');

  const charger = () => {
    inscriptionsApi.detail(id).then(setData).catch((e) => setErreur(e.message));
  };
  useEffect(() => { charger(); /* eslint-disable-next-line */ }, [id]);

  const appliquer = async () => {
    setErreur(''); setMsg(''); setEnCours(true);
    try {
      await adminApi.changerStatutInscription(id, { statut, commentaire: commentaire || undefined });
      setMsg('Statut mis à jour, le parent a été notifié.');
      setCommentaire(''); setConfirme(false);
      charger();
    } catch (err) {
      setErreur(err.message); setConfirme(false);
    } finally {
      setEnCours(false);
    }
  };

  // Rédige le message au parent avec l'IA, selon la décision choisie.
  const genererMessage = async () => {
    setErreurIA('');
    setIaEnCours(true);
    try {
      const d = await adminApi.messageParentIA(id, { decision: statut, precision: commentaire || undefined });
      setCommentaire(d.message || '');
    } catch (err) {
      setErreurIA(err.message);
    } finally {
      setIaEnCours(false);
    }
  };

  // Dossier introuvable
  if (erreur && !data) {
    return (
      <div className="insc-page traiter-page">
        <div className="insc-vide">
          <div className="insc-vide-ico" aria-hidden="true">❓</div>
          <p>Dossier introuvable.</p>
          <Link to="/admin/inscriptions" className="insc-btn-reinit">Retour aux inscriptions</Link>
        </div>
      </div>
    );
  }
  if (!data) return <div className="insc-page"><Chargement texte="Chargement du dossier…" /></div>;

  const { inscription, documents, historique } = data;
  const actionChoisie = ACTIONS.find((a) => a.valeur === statut);

  return (
    <div className="insc-page traiter-page">
      <Link to="/admin/inscriptions" className="traiter-retour">‹ File des inscriptions</Link>
      <div className="traiter-entete">
        <div>
          <h1>Traiter le dossier</h1>
          <p className="texte-gris">Consultez les informations et prenez une décision.</p>
        </div>
        <BadgeStatut statut={inscription.statut} />
      </div>

      {erreur && <Alerte type="erreur">{erreur}</Alerte>}
      {msg && <Alerte type="info">{msg}</Alerte>}

      <div className="traiter-grille">
        {/* Colonne gauche : informations */}
        <div className="traiter-col">
          <section className="traiter-carte">
            <div className="traiter-titre"><Icone nom="clipboard" /> Informations</div>
            <div className="traiter-infos traiter-infos-2">
              <Info libelle="Élève" valeur={inscription.eleve_nom} />
              <Info libelle="Sexe" valeur={libelleSexe(inscription.sexe)} />
              <Info libelle="Date de naissance" valeur={inscription.date_naissance ? dateFr(inscription.date_naissance) : ''} />
              <Info libelle="Âge" valeur={inscription.date_naissance ? `${calculerAge(inscription.date_naissance)} ans` : ''} />
              <Info libelle="Niveau" valeur={inscription.niveau} />
              <Info libelle="Année" valeur={inscription.annee_scolaire} />
              <Info libelle="Parent" valeur={inscription.parent_nom} />
              <Info libelle="Courriel du parent" valeur={inscription.parent_courriel} />
            </div>
          </section>

          <section className="traiter-carte">
            <div className="traiter-titre"><Icone nom="attach" /> Documents</div>
            {documents.length === 0 ? (
              <p className="texte-gris rangee" style={{ gap: '.4rem' }}><Icone nom="file" /> Aucun document.</p>
            ) : (
              <div className="traiter-doc-liste">
                {documents.map((d) => (
                  <div key={d.id} className="traiter-doc">
                    <span className="traiter-doc-nom">
                      {TYPES_DOC[d.type] || d.type} <BadgeStatut statut={d.statut_verification} />
                    </span>
                    <a href={urlDocumentSoumis(d.id)} target="_blank" rel="noreferrer" className="traiter-doc-dl">Télécharger</a>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="traiter-carte">
            <div className="traiter-titre"><Icone nom="edit" /> Informations complémentaires</div>
            <div className="traiter-infos traiter-infos-2">
              <Info libelle="Nom du parent" valeur={inscription.nom_parent} />
              <Info libelle="Profession du parent" valeur={inscription.profession_parent} />
              <Info libelle="Téléphone du parent" valeur={inscription.telephone_parent} />
              <Info libelle="Courriel du parent (notifications)" valeur={inscription.courriel_parent} />
              <Info libelle="Ancienne école" valeur={inscription.ancienne_ecole} />
              <Info libelle="Dernière classe suivie" valeur={inscription.ancienne_classe} />
              <Info libelle="Raison du choix" valeur={inscription.raison_choix} />
            </div>
          </section>
        </div>

        {/* Colonne droite : décision + historique */}
        <div className="traiter-col">
          <section className="traiter-carte">
            <div className="traiter-titre"><Icone nom="target" /> Décision</div>
            <div className="traiter-options">
              {ACTIONS.map((a) => (
                <label key={a.valeur} className={`traiter-option ${statut === a.valeur ? `actif ${a.ton}` : ''}`}>
                  <input type="radio" name="decision" value={a.valeur}
                    checked={statut === a.valeur} onChange={() => setStatut(a.valeur)} />
                  {a.libelle}
                </label>
              ))}
            </div>
            <div className="traiter-msg-tete">
              <span className="traiter-msg-libelle">Message au parent (optionnel)</span>
              <button type="button" className="traiter-ia-btn" onClick={genererMessage} disabled={iaEnCours || enCours}>
                <Icone nom="comment" /> {iaEnCours ? 'Rédaction…' : 'Rédiger avec l\'IA'}
              </button>
            </div>
            {erreurIA && <Alerte type="erreur">{erreurIA}</Alerte>}
            <textarea className="traiter-commentaire" rows={4} value={commentaire}
              onChange={(e) => setCommentaire(e.target.value)}
              placeholder="Message au parent (optionnel) — envoyé avec la décision. Vous pouvez le rédiger avec l'IA puis l'ajuster…" />
            <button type="button" className="traiter-appliquer" onClick={() => setConfirme(true)} disabled={enCours}>
              Appliquer
            </button>
            <p className="texte-gris" style={{ marginTop: '.75rem', fontSize: '.8rem' }}>
              La confirmation finale (« confirmée ») se fait à la validation du paiement.
            </p>
          </section>

          <section className="traiter-carte">
            <div className="traiter-titre"><Icone nom="history" /> Historique</div>
            {historique.length === 0 ? (
              <p className="texte-gris">Aucun changement.</p>
            ) : (
              <ul className="traiter-timeline">
                {historique.map((h, i) => (
                  <li key={i} className="traiter-tl-item">
                    <span className={`traiter-tl-puce ${tonStatut(h.nouveau_statut)}`} />
                    <span className="traiter-tl-statut">{LIBELLE_STATUT[h.nouveau_statut] || h.nouveau_statut}</span>
                    <span className="traiter-tl-date">{dateHeureFr(h.cree_le)}</span>
                    {h.commentaire && <span className="traiter-tl-com">« {h.commentaire} »</span>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      <footer className="insc-pied">© {new Date().getFullYear()} Lekòl Pam. Tous droits réservés.</footer>

      {/* Modale de confirmation */}
      {confirme && (
        <div className="prof-modal-fond" onClick={() => !enCours && setConfirme(false)}>
          <div className="prof-modal carte" role="dialog" aria-modal="true" onClick={(ev) => ev.stopPropagation()}>
            <button type="button" className="prof-modal-fermer" onClick={() => setConfirme(false)} aria-label="Fermer">×</button>
            <h2 style={{ marginBottom: '.75rem' }}>Confirmer la décision</h2>
            <p style={{ color: '#4A5568', marginBottom: '1.25rem' }}>
              Voulez-vous vraiment appliquer « <strong>{actionChoisie?.libelle}</strong> » au dossier de <strong>{inscription.eleve_nom}</strong> ? Le parent sera notifié.
            </p>
            <div className="badges-actions" style={{ justifyContent: 'flex-end' }}>
              <button type="button" className="insc-btn-reinit" onClick={() => setConfirme(false)} disabled={enCours}>Annuler</button>
              <button type="button"
                className={`paie-btn ${actionChoisie?.ton === 'vert' ? 'paie-valider' : actionChoisie?.ton === 'rouge' ? 'paie-rejeter' : 'paie-details'}`}
                onClick={appliquer} disabled={enCours}>
                {enCours ? 'Traitement…' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
