import { useState } from 'react';
import { annonceApi } from '../../services/api.js';
import Carte from '../../components/Carte.jsx';
import Champ from '../../components/Champ.jsx';
import Bouton from '../../components/Bouton.jsx';
import Alerte from '../../components/Alerte.jsx';

const LONGUEUR_MAX_SECTION = 3000;

const CHAMPS_VIDES = { objet: '', introduction: '', developpement: '', conclusion: '' };

export default function AnnonceCourriel() {
  const [idee, setIdee] = useState('');
  const [champs, setChamps] = useState(CHAMPS_VIDES);
  const [confirmation, setConfirmation] = useState(false);
  const [iaEnCours, setIaEnCours] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState('');
  const [resultat, setResultat] = useState(null);

  const majChamp = (cle) => (e) => setChamps((c) => ({ ...c, [cle]: e.target.value }));

  const genererIA = async () => {
    if (!idee.trim()) return;
    setErreur(''); setIaEnCours(true);
    try {
      const d = await annonceApi.redactionIa(idee.trim());
      setChamps({
        objet: d.objet || '',
        introduction: d.introduction || '',
        developpement: d.developpement || '',
        conclusion: d.conclusion || '',
      });
    } catch (err) {
      setErreur(err.message);
    } finally {
      setIaEnCours(false);
    }
  };

  const pretAEnvoyer = champs.objet.trim() && champs.introduction.trim()
    && champs.developpement.trim() && champs.conclusion.trim();

  const envoyer = async () => {
    setErreur(''); setEnCours(true);
    try {
      const r = await annonceApi.envoyerCourriel({
        objet: champs.objet.trim(),
        introduction: champs.introduction.trim(),
        developpement: champs.developpement.trim(),
        conclusion: champs.conclusion.trim(),
      });
      setResultat(r);
      setIdee(''); setChamps(CHAMPS_VIDES);
      setConfirmation(false);
    } catch (err) {
      setErreur(err.message);
    } finally {
      setEnCours(false);
    }
  };

  return (
    <div style={{ maxWidth: 720 }}>
      <div className="page-entete">
        <h1>Annonce par courriel</h1>
        <p>
          Envoyez un courriel officiel (logo, coordonnées de l'école, PDF joint) à tous les parents
          ayant une adresse enregistrée.
        </p>
      </div>

      <Carte>
        {erreur && <Alerte type="erreur">{erreur}</Alerte>}
        {resultat && (
          <Alerte type="info">
            Envoyé à {resultat.envoyes} sur {resultat.total} parent{resultat.total > 1 ? 's' : ''}
            {resultat.echecs > 0 ? ` (${resultat.echecs} échec${resultat.echecs > 1 ? 's' : ''}).` : '.'}
          </Alerte>
        )}

        <Champ label="Idée de l'annonce (facultatif)" enfant={
          <textarea rows={2} value={idee} onChange={(e) => setIdee(e.target.value)}
            placeholder="Ex. : l'école sera fermée demain pour cause de..." />
        } />
        <div className="rangee" style={{ marginBottom: '1.25rem' }}>
          <Bouton type="button" variante="secondaire" disabled={!idee.trim()} onClick={genererIA} enCours={iaEnCours}>
            Rédiger avec l'IA
          </Bouton>
        </div>

        <Champ label="Objet" value={champs.objet} onChange={majChamp('objet')}
          maxLength={200} placeholder="Objet du courriel" />

        <div className="champ">
          <label htmlFor="annonce-intro">Introduction</label>
          <textarea id="annonce-intro" rows={3} maxLength={LONGUEUR_MAX_SECTION} value={champs.introduction}
            onChange={majChamp('introduction')}
            placeholder="Met le message en contexte…" />
        </div>

        <div className="champ">
          <label htmlFor="annonce-dev">Développement</label>
          <textarea id="annonce-dev" rows={6} maxLength={LONGUEUR_MAX_SECTION} value={champs.developpement}
            onChange={majChamp('developpement')}
            placeholder="Détaille l'information à communiquer…" />
        </div>

        <div className="champ">
          <label htmlFor="annonce-conclusion">Conclusion</label>
          <textarea id="annonce-conclusion" rows={3} maxLength={LONGUEUR_MAX_SECTION} value={champs.conclusion}
            onChange={majChamp('conclusion')}
            placeholder="Clôt le message (rappel, invitation à contacter l'école, etc.)…" />
        </div>

        <p className="texte-gris" style={{ fontSize: '.82rem', margin: '-.25rem 0 1rem' }}>
          La formule de politesse et votre signature (propriétaire de l'école) sont ajoutées automatiquement,
          ainsi qu'un PDF reprenant le même message, joint à chaque courriel.
        </p>

        <div className="rangee">
          <Bouton type="button" disabled={!pretAEnvoyer} onClick={() => setConfirmation(true)}>
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
              Ce courriel (avec PDF joint) sera envoyé à <strong>tous les parents</strong> ayant une adresse enregistrée.
              Cette action est irréversible.
            </p>
            <p style={{ fontWeight: 700, marginBottom: '.35rem' }}>{champs.objet}</p>
            <div style={{ background: 'var(--gris-champ)', padding: '.75rem', borderRadius: 'var(--rayon-sm)', marginBottom: '1rem' }}>
              <p style={{ whiteSpace: 'pre-wrap', marginBottom: '.6rem' }}>{champs.introduction}</p>
              <p style={{ whiteSpace: 'pre-wrap', marginBottom: '.6rem' }}>{champs.developpement}</p>
              <p style={{ whiteSpace: 'pre-wrap' }}>{champs.conclusion}</p>
            </div>
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
