import { useState } from 'react';
import Alerte from './Alerte.jsx';

// Modale générique « Mon compte » (identifiant + mot de passe) — réutilisée
// par tous les modules admin indépendants (Vlog, Professeurs, À propos,
// Académie, Examens). onSoumettre reçoit { motDePasseActuel,
// nouvelIdentifiant?, nouveauMotDePasse? } et doit renvoyer une promesse.
export default function ModaleCompteAdmin({ identifiantActuel, onSoumettre, onFermer, onMaj }) {
  const [motDePasseActuel, setMotDePasseActuel] = useState('');
  const [nouvelIdentifiant, setNouvelIdentifiant] = useState(identifiantActuel);
  const [nouveauMotDePasse, setNouveauMotDePasse] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);

  const soumettre = async (e) => {
    e.preventDefault();
    setErreur('');

    const identifiantChange = nouvelIdentifiant.trim() !== identifiantActuel;
    if (!identifiantChange && !nouveauMotDePasse) {
      setErreur("Modifiez l'identifiant et/ou le mot de passe avant d'enregistrer.");
      return;
    }
    if (nouveauMotDePasse && nouveauMotDePasse !== confirmation) {
      setErreur('La confirmation ne correspond pas au nouveau mot de passe.');
      return;
    }

    setEnCours(true);
    try {
      await onSoumettre({
        motDePasseActuel,
        nouvelIdentifiant: identifiantChange ? nouvelIdentifiant.trim() : undefined,
        nouveauMotDePasse: nouveauMotDePasse || undefined,
      });
      onMaj(identifiantChange ? nouvelIdentifiant.trim() : identifiantActuel);
    } catch (err) {
      setErreur(err.message);
    } finally {
      setEnCours(false);
    }
  };

  return (
    <div className="prof-modal-fond" onClick={() => !enCours && onFermer()}>
      <div className="prof-modal carte" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="prof-modal-fermer" onClick={onFermer} aria-label="Fermer">×</button>
        <h2 style={{ marginBottom: '1rem' }}>Mon compte</h2>
        <form onSubmit={soumettre}>
          {erreur && <Alerte type="erreur">{erreur}</Alerte>}
          <div className="vadm-champ">
            <label htmlFor="cpt-identifiant">Identifiant</label>
            <input id="cpt-identifiant" value={nouvelIdentifiant} onChange={(e) => setNouvelIdentifiant(e.target.value)} required />
          </div>
          <div className="vadm-champ">
            <label htmlFor="cpt-nouveau-mdp">Nouveau mot de passe (laisser vide pour ne pas changer)</label>
            <input id="cpt-nouveau-mdp" type="password" value={nouveauMotDePasse} onChange={(e) => setNouveauMotDePasse(e.target.value)}
              autoComplete="new-password" placeholder="min. 8 caractères" />
          </div>
          {nouveauMotDePasse && (
            <div className="vadm-champ">
              <label htmlFor="cpt-confirmation">Confirmer le nouveau mot de passe</label>
              <input id="cpt-confirmation" type="password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)}
                autoComplete="new-password" required />
            </div>
          )}
          <div className="vadm-champ">
            <label htmlFor="cpt-mdp-actuel">Mot de passe actuel (obligatoire pour confirmer)</label>
            <input id="cpt-mdp-actuel" type="password" value={motDePasseActuel} onChange={(e) => setMotDePasseActuel(e.target.value)}
              autoComplete="current-password" required />
          </div>
          <div className="badges-actions" style={{ justifyContent: 'flex-end', marginTop: '.5rem' }}>
            <button type="button" className="insc-btn-reinit" onClick={onFermer} disabled={enCours}>Annuler</button>
            <button type="submit" className="mat-modifier" disabled={enCours}>{enCours ? 'Enregistrement…' : 'Enregistrer'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
