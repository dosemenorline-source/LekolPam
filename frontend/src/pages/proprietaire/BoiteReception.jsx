import { useState, useEffect } from 'react';
import { messagesApi } from '../../services/api.js';
import { dateHeureFr } from '../../utils/libelles.js';
import Carte from '../../components/Carte.jsx';
import Champ from '../../components/Champ.jsx';
import Bouton from '../../components/Bouton.jsx';
import Alerte from '../../components/Alerte.jsx';
import Chargement from '../../components/Chargement.jsx';

const STATUT_LIBELLE = { non_lu: 'Non lu', lu: 'Lu', repondu: 'Répondu' };
const STATUT_BADGE = { non_lu: 'tdb-badge-rouge', lu: 'tdb-badge-gris', repondu: 'tdb-badge-vert' };

export default function BoiteReception() {
  const [messages, setMessages] = useState(null);
  const [filtre, setFiltre] = useState('');
  const [erreur, setErreur] = useState('');

  const [ouvert, setOuvert] = useState(null); // message en cours de consultation
  const [chargeDetail, setChargeDetail] = useState(false);
  const [reponse, setReponse] = useState('');
  const [iaEnCours, setIaEnCours] = useState(false);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [erreurModal, setErreurModal] = useState('');
  const [msgModal, setMsgModal] = useState('');

  const chargerListe = () => messagesApi.lister(filtre || undefined).then((d) => setMessages(d.messages)).catch((e) => setErreur(e.message));
  useEffect(() => { setMessages(null); chargerListe(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [filtre]);

  const ouvrir = async (id) => {
    setErreurModal(''); setMsgModal(''); setReponse(''); setOuvert({ id });
    setChargeDetail(true);
    try {
      const d = await messagesApi.detail(id);
      setOuvert(d.message);
      chargerListe(); // reflète le passage à « lu » dans la liste
    } catch (e) {
      setErreurModal(e.message);
    } finally {
      setChargeDetail(false);
    }
  };

  const genererIA = async () => {
    setErreurModal(''); setIaEnCours(true);
    try {
      const d = await messagesApi.reponseIa(ouvert.id);
      setReponse(d.brouillon);
    } catch (e) {
      setErreurModal(e.message);
    } finally {
      setIaEnCours(false);
    }
  };

  const envoyerReponse = async () => {
    if (!reponse.trim()) { setErreurModal('La réponse ne peut pas être vide.'); return; }
    setErreurModal(''); setEnvoiEnCours(true);
    try {
      await messagesApi.repondre(ouvert.id, reponse);
      setMsgModal('Réponse envoyée par courriel.');
      setOuvert((o) => ({ ...o, statut: 'repondu', reponse }));
      chargerListe();
    } catch (e) {
      setErreurModal(e.message);
    } finally {
      setEnvoiEnCours(false);
    }
  };

  return (
    <div style={{ maxWidth: 960 }}>
      <div className="page-entete">
        <h1>Boîte de réception</h1>
        <p>Messages soumis via le formulaire « Restons en contact » du site.</p>
      </div>

      <div className="insc-barre" style={{ marginBottom: '.75rem' }}>
        <select value={filtre} onChange={(e) => setFiltre(e.target.value)} aria-label="Filtrer par statut">
          <option value="">Tous les messages</option>
          <option value="non_lu">Non lus</option>
          <option value="lu">Lus</option>
          <option value="repondu">Répondus</option>
        </select>
      </div>

      {erreur && <Alerte type="erreur">{erreur}</Alerte>}

      {!messages ? (
        <Chargement />
      ) : messages.length === 0 ? (
        <Carte><p className="texte-gris">Aucun message pour ce filtre.</p></Carte>
      ) : (
        <div className="tableau-enveloppe">
          <table className="tableau insc-tableau">
            <thead><tr><th>Nom</th><th>Courriel</th><th>Reçu le</th><th>Statut</th><th>Actions</th></tr></thead>
            <tbody>
              {messages.map((m) => (
                <tr key={m.id}>
                  <td className="insc-nom">{m.nom}</td>
                  <td>{m.courriel}</td>
                  <td>{dateHeureFr(m.cree_le)}</td>
                  <td><span className={`tdb-badge ${STATUT_BADGE[m.statut]}`}>{STATUT_LIBELLE[m.statut]}</span></td>
                  <td>
                    <button type="button" className="paie-btn paie-details" onClick={() => ouvrir(m.id)}>Voir</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {ouvert && (
        <div className="prof-modal-fond" onClick={() => !envoiEnCours && setOuvert(null)}>
          <div className="prof-modal carte" role="dialog" aria-modal="true" onClick={(ev) => ev.stopPropagation()}>
            <button type="button" className="prof-modal-fermer" onClick={() => setOuvert(null)} aria-label="Fermer">×</button>
            {chargeDetail || !ouvert.nom ? <Chargement /> : (
              <>
                <h2 style={{ marginBottom: '.25rem' }}>{ouvert.nom}</h2>
                <p className="texte-gris" style={{ marginBottom: '.75rem' }}>
                  {ouvert.courriel} — {dateHeureFr(ouvert.cree_le)}
                </p>
                <p style={{ whiteSpace: 'pre-wrap', marginBottom: '1rem' }}>{ouvert.message}</p>

                {ouvert.statut === 'repondu' && ouvert.reponse && (
                  <div style={{ marginBottom: '1rem' }}>
                    <p style={{ fontWeight: 700, marginBottom: '.35rem' }}>Réponse envoyée :</p>
                    <p className="texte-gris" style={{ whiteSpace: 'pre-wrap' }}>{ouvert.reponse}</p>
                  </div>
                )}

                {ouvert.statut !== 'repondu' && (
                  <>
                    {erreurModal && <Alerte type="erreur">{erreurModal}</Alerte>}
                    {msgModal && <Alerte type="info">{msgModal}</Alerte>}
                    <div className="rangee" style={{ marginBottom: '.5rem' }}>
                      <Bouton type="button" variante="secondaire" onClick={genererIA} enCours={iaEnCours}>
                        Générer une réponse (IA)
                      </Bouton>
                    </div>
                    <Champ label="Réponse (envoyée par courriel)" enfant={
                      <textarea rows={6} value={reponse} onChange={(e) => setReponse(e.target.value)}
                        placeholder="Rédigez votre réponse, ou générez un brouillon avec l'IA…" />
                    } />
                    <div className="badges-actions" style={{ justifyContent: 'flex-end', marginTop: '.75rem' }}>
                      <Bouton type="button" onClick={envoyerReponse} enCours={envoiEnCours}>Envoyer la réponse</Bouton>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}

      <footer className="insc-pied">© {new Date().getFullYear()} Lekòl Pam. Tous droits réservés.</footer>
    </div>
  );
}
