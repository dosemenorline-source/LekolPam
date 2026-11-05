import { useState } from 'react';
import { annonceApi } from '../services/api.js';
import Carte from '../components/Carte.jsx';
import Bouton from '../components/Bouton.jsx';
import Alerte from '../components/Alerte.jsx';

const LONGUEUR_MAX = 400;

export default function AnnonceSms() {
  const [message, setMessage] = useState('');
  const [confirmation, setConfirmation] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState('');
  const [resultat, setResultat] = useState(null);

  const envoyer = async () => {
    setErreur(''); setEnCours(true);
    try {
      const r = await annonceApi.envoyerSms(message.trim());
      setResultat(r);
      setMessage('');
      setConfirmation(false);
    } catch (err) {
      setErreur(err.message);
    } finally {
      setEnCours(false);
    }
  };

  return (
    <div style={{ maxWidth: 640 }}>
      <div className="page-entete">
        <h1>Annonce SMS</h1>
        <p>Envoyez un message par SMS à tous les parents ayant un numéro de téléphone enregistré.</p>
      </div>

      <Carte>
        {erreur && <Alerte type="erreur">{erreur}</Alerte>}
        {resultat && (
          <Alerte type="info">
            Envoyé à {resultat.envoyes} sur {resultat.total} parent{resultat.total > 1 ? 's' : ''}
            {resultat.echecs > 0 ? ` (${resultat.echecs} échec${resultat.echecs > 1 ? 's' : ''}).` : '.'}
          </Alerte>
        )}

        <div className="champ">
          <label htmlFor="sms-message">Message</label>
          <textarea id="sms-message" rows={5} maxLength={LONGUEUR_MAX} value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Ex. : L'école sera fermée demain pour cause de..." />
          <p className="texte-gris" style={{ fontSize: '.82rem', marginTop: '.25rem' }}>
            {message.length}/{LONGUEUR_MAX} caractères
          </p>
        </div>

        <div className="rangee" style={{ marginTop: '.5rem' }}>
          <Bouton type="button" disabled={!message.trim()} onClick={() => setConfirmation(true)}>
            Envoyer l'annonce
          </Bouton>
        </div>
      </Carte>

      <footer className="insc-pied">© {new Date().getFullYear()} Lekòl Pam. Tous droits réservés.</footer>

      {confirmation && (
        <div className="prof-modal-fond" onClick={() => !enCours && setConfirmation(false)}>
          <div className="prof-modal carte" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="prof-modal-fermer" onClick={() => setConfirmation(false)} aria-label="Fermer">×</button>
            <h2 style={{ marginBottom: '.75rem' }}>Confirmer l'envoi</h2>
            <p style={{ color: '#4A5568', marginBottom: '1rem' }}>
              Ce message sera envoyé par SMS à <strong>tous les parents</strong> ayant un numéro enregistré.
              Cette action est irréversible.
            </p>
            <p style={{ background: 'var(--gris-champ)', padding: '.75rem', borderRadius: 'var(--rayon-sm)', marginBottom: '1rem', whiteSpace: 'pre-wrap' }}>
              {message}
            </p>
            <div className="badges-actions" style={{ justifyContent: 'flex-end' }}>
              <button type="button" className="insc-btn-reinit" onClick={() => setConfirmation(false)} disabled={enCours}>Annuler</button>
              <button type="button" className="mat-modifier" onClick={envoyer} disabled={enCours}>
                {enCours ? 'Envoi…' : 'Confirmer l\'envoi'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
