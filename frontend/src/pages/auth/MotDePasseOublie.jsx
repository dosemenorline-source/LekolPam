import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { authApi } from '../../services/api.js';
import PanneauMarque from './PanneauMarque.jsx';
import Champ from '../../components/Champ.jsx';
import Bouton from '../../components/Bouton.jsx';
import Alerte from '../../components/Alerte.jsx';

export default function MotDePasseOublie() {
  const navigate = useNavigate();
  // Lien reçu par courriel (ex. invitation professeur) : courriel + code déjà
  // fournis dans l'URL — on saute directement à l'étape « nouveau mot de passe ».
  const [params] = useSearchParams();
  const lienDirect = Boolean(params.get('courriel') && params.get('code'));
  const [etape, setEtape] = useState(lienDirect ? 2 : 1);
  const [courriel, setCourriel] = useState(params.get('courriel') || '');
  const [code, setCode] = useState(params.get('code') || '');
  const [nouveauMotDePasse, setNouveauMotDePasse] = useState('');
  const [erreur, setErreur] = useState('');
  const [msg, setMsg] = useState('');
  const [enCours, setEnCours] = useState(false);

  const demanderCode = async (e) => {
    e.preventDefault();
    setErreur(''); setMsg('');
    setEnCours(true);
    try {
      await authApi.motDePasseOublie(courriel);
      setMsg('Si un compte existe, un code vient d\'être envoyé par courriel.');
      setEtape(2);
    } catch (err) {
      setErreur(err.message);
    } finally {
      setEnCours(false);
    }
  };

  const reinitialiser = async (e) => {
    e.preventDefault();
    setErreur(''); setMsg('');
    setEnCours(true);
    try {
      await authApi.reinitialiserMotDePasse({ courriel, code: code.trim(), nouveauMotDePasse });
      navigate('/login', { state: { info: 'Mot de passe réinitialisé. Connectez-vous.' } });
    } catch (err) {
      setErreur(err.message);
    } finally {
      setEnCours(false);
    }
  };

  return (
    <div className="auth-ecran">
      <PanneauMarque />
      <div className="auth-panneau">
        {etape === 1 ? (
          <form className="auth-form" onSubmit={demanderCode}>
            <h2>Mot de passe oublié</h2>
            <p className="sous-titre">Saisissez votre courriel pour recevoir un code de réinitialisation.</p>

            <Alerte type="erreur">{erreur}</Alerte>

            <Champ label="Courriel" type="email" value={courriel}
              onChange={(e) => setCourriel(e.target.value)} required autoComplete="email" />

            <Bouton type="submit" bloc enCours={enCours}>Envoyer le code</Bouton>

            <p className="auth-lien"><Link to="/login">Retour à la connexion</Link></p>
          </form>
        ) : (
          <form className="auth-form" onSubmit={reinitialiser}>
            <h2>{lienDirect ? 'Créez votre mot de passe' : 'Nouveau mot de passe'}</h2>
            <p className="sous-titre">
              {lienDirect
                ? 'Choisissez le mot de passe de votre compte.'
                : 'Saisissez le code reçu par courriel et votre nouveau mot de passe.'}
            </p>

            <Alerte type="erreur">{erreur}</Alerte>
            {msg && <Alerte type="info">{msg}</Alerte>}

            <Champ label="Code reçu" value={code}
              onChange={(e) => setCode(e.target.value)} required autoComplete="one-time-code" />
            <Champ label="Nouveau mot de passe" type="password" value={nouveauMotDePasse}
              onChange={(e) => setNouveauMotDePasse(e.target.value)} required
              autoComplete="new-password" placeholder="Au moins 8 caractères" />

            <Bouton type="submit" bloc enCours={enCours}>{lienDirect ? 'Créer mon mot de passe' : 'Réinitialiser'}</Bouton>

            <p className="auth-lien">
              <button type="button" className="btn btn-fantome btn-sm" onClick={() => setEtape(1)}>
                Renvoyer un code
              </button>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
