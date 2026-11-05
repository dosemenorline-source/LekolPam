import { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import PanneauMarque from './PanneauMarque.jsx';
import Champ from '../../components/Champ.jsx';
import Bouton from '../../components/Bouton.jsx';
import Alerte from '../../components/Alerte.jsx';
import { biometrieDisponible, autofillDisponible, connexionBiometrie, connexionBiometrieAutofill } from '../../services/biometrie.js';

export default function Login() {
  const { login, verifierConnexion, renvoyerCodeConnexion, connexionBiometrieOuvre } = useAuth();
  const [biometrieEnCours, setBiometrieEnCours] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [courriel, setCourriel] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);
  // Animation de vérification du code : null | 'verification' | 'succes'
  const [etatVerif, setEtatVerif] = useState(null);
  // Animation « envoi du code par courriel » (avion) avant l'écran du code
  const [envoiCode, setEnvoiCode] = useState(false);

  // Précharge les visuels des animations : sans ça, la coche de validation
  // (affichée ~1,6 s) peut ne pas avoir le temps de se télécharger avant la
  // redirection, et l'utilisateur ne la verrait jamais.
  useEffect(() => {
    ['/auth/validation.png', '/auth/send.png'].forEach((src) => { new Image().src = src; });
  }, []);
  // ?session=expiree : renvoi automatique depuis api.js (401 « Authentification
  // requise » en cours d'usage) — une navigation plein-page, sans location.state.
  const info = location.state?.info
    || (searchParams.get('session') === 'expiree' ? 'Votre session a expiré. Reconnectez-vous.' : '')
    || (searchParams.get('next') ? 'Connectez-vous pour continuer.' : '');

  // Destination après connexion : ?next=/chemin (ex. lien de ré-inscription),
  // uniquement si c'est un chemin interne sûr ; sinon le tableau de bord.
  const nextParam = searchParams.get('next') || location.state?.next || '';
  const destination = nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/tableau-de-bord';

  // Étape de double authentification (comptes parent) : 'identifiants' | 'code'
  const [etape, setEtape] = useState('identifiants');
  const [code, setCode] = useState('');
  const [infoCode, setInfoCode] = useState('');

  const soumettre = async (e) => {
    e.preventDefault();
    setErreur('');
    setEnCours(true);
    try {
      const resultat = await login({ courriel, motDePasse });
      if (resultat?.etape === '2fa_requis') {
        // Compte parent : animation « envoi du courriel » (avion) puis saisie du code.
        setInfoCode(`Un code de connexion a été envoyé à ${resultat.courriel}.`);
        setEnvoiCode(true);
        await new Promise((r) => setTimeout(r, 5000));
        setEnvoiCode(false);
        setEtape('code');
        setEnCours(false);
      } else {
        navigate(destination);
      }
    } catch (err) {
      setErreur(err.message);
      setEnCours(false);
    }
  };

  const soumettreCode = async (e) => {
    e.preventDefault();
    setErreur('');
    setEnCours(true);
    setEtatVerif('verification');
    try {
      await verifierConnexion(code.trim());
      // Le code est validé : on montre le succès (coche verte) un court instant
      // avant de basculer sur le tableau de bord.
      setEtatVerif('succes');
      setTimeout(() => navigate(destination), 5000);
    } catch (err) {
      setErreur(err.message);
      setEtatVerif(null);
      setEnCours(false);
    }
  };

  const renvoyer = async () => {
    setErreur('');
    setInfoCode('');
    try {
      await renvoyerCodeConnexion();
      setInfoCode('Un nouveau code a été envoyé.');
    } catch (err) {
      setErreur(err.message);
    }
  };

  const connecterAvecBiometrie = async () => {
    if (biometrieEnCours) return;
    setErreur('');
    setBiometrieEnCours(true);
    try {
      const data = await connexionBiometrie();
      connexionBiometrieOuvre(data);
      navigate(destination);
    } catch (err) {
      setErreur(err.message);
    } finally {
      setBiometrieEnCours(false);
    }
  };

  // Connexion automatique par autofill : si l'appareil a un passkey, le
  // navigateur le propose dès qu'on touche le champ courriel — sans saisie.
  useEffect(() => {
    if (etape !== 'identifiants' || !autofillDisponible()) return undefined;
    let monte = true;
    connexionBiometrieAutofill()
      .then((data) => {
        if (!monte) return;
        connexionBiometrieOuvre(data);
        navigate(destination);
      })
      .catch(() => { /* autofill ignoré/annulé : connexion classique disponible */ });
    return () => { monte = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etape]);

  const retourIdentifiants = () => {
    setEtape('identifiants');
    setCode('');
    setErreur('');
    setInfoCode('');
    setMotDePasse('');
  };

  return (
    <div className="auth-ecran">
      <PanneauMarque />
      <div className="auth-panneau">
        {etape === 'identifiants' ? (
          <form className="auth-form" onSubmit={soumettre} style={{ position: 'relative' }}>
            {envoiCode && (
              <div className="otp-overlay" role="status" aria-live="polite">
                <div className="send-scene" aria-hidden="true">
                  <img className="send-avion" src="/auth/send.png" alt="" />
                  <span className="send-trainee" />
                </div>
                <p className="otp-texte">Envoi du code par courriel…</p>
              </div>
            )}
            <Link to="/" className="auth-retour">← Retour à l'accueil</Link>
            <h2>Connexion</h2>
            <p className="sous-titre">Accédez à votre espace Lekòl Pam.</p>

            {info && <Alerte type="info">{info}</Alerte>}
            <Alerte type="erreur">{erreur}</Alerte>

            <Champ label="Courriel" type="email" value={courriel}
              onChange={(e) => setCourriel(e.target.value)} required autoComplete="email webauthn" />
            <Champ label="Mot de passe" type="password" value={motDePasse}
              onChange={(e) => setMotDePasse(e.target.value)} required autoComplete="current-password" />

            <p style={{ textAlign: 'right', marginTop: '-.5rem', marginBottom: '1rem', fontSize: '.88rem' }}>
              <Link to="/mot-de-passe-oublie">Mot de passe oublié ?</Link>
            </p>

            <Bouton type="submit" bloc enCours={enCours}>Se connecter</Bouton>

            {biometrieDisponible() && (
              <>
                <p className="texte-gris" style={{ textAlign: 'center', margin: '1rem 0 0', fontSize: '.85rem' }}>— ou —</p>
                <Bouton type="button" variante="secondaire" bloc disabled={biometrieEnCours}
                  onClick={connecterAvecBiometrie} style={{ marginBottom: '.35rem' }}>
                  <span className={`faceid${biometrieEnCours ? ' faceid-scan' : ''}`} aria-hidden="true">
                    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="3"
                      strokeLinecap="round" strokeLinejoin="round">
                      <path d="M16 6 H10 a4 4 0 0 0-4 4 V16" />
                      <path d="M32 6 H38 a4 4 0 0 1 4 4 V16" />
                      <path d="M6 32 V38 a4 4 0 0 0 4 4 H16" />
                      <path d="M42 32 V38 a4 4 0 0 1-4 4 H32" />
                      <path d="M18 19 V23" /><path d="M30 19 V23" />
                      <path d="M24 18 V27 h-3" />
                      <path d="M17 32 q7 5 14 0" />
                    </svg>
                    <span className="faceid-ligne" />
                  </span>
                  {biometrieEnCours ? 'Vérification du visage…' : 'Se connecter avec Face ID / empreinte'}
                </Bouton>
                <p className="texte-gris" style={{ textAlign: 'center', margin: '0 0 .6rem', fontSize: '.78rem' }}>
                  À activer d'abord une fois depuis « Mon compte » sur cet appareil.
                </p>
              </>
            )}

            <p className="auth-lien">
              Pas encore de compte ? <Link to="/register">Créer un compte</Link>
            </p>
            <p className="auth-lien">
              Élève ? <Link to="/eleve">Accéder avec un code</Link>
            </p>
            <p className="auth-lien">
              Ancien élève ? <Link to="/anciens-eleves">Demander l'accès à mes résultats</Link>
            </p>
            <p className="auth-lien">
              Administrateur du vlog ? <Link to="/vlog/admin">Accéder au vlog</Link>
            </p>

            <div className="auth-note">
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 1a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2h-1V6a5 5 0 0 0-5-5zm3 8H9V6a3 3 0 0 1 6 0v3z" />
              </svg>
              <span>Connexion sécurisée — vos données sont chiffrées.</span>
            </div>

            <div className="auth-pied">
              © {new Date().getFullYear()} Lekòl Pam. Tous droits réservés.
              <div className="auth-pied-liens">
                <Link to="/a-propos">Politique de confidentialité</Link>
                <Link to="/support">Conditions d'utilisation</Link>
              </div>
            </div>
          </form>
        ) : (
          <form className="auth-form" onSubmit={soumettreCode} style={{ position: 'relative' }}>
            {etatVerif && (
              <div className="otp-overlay" role="status" aria-live="polite">
                {etatVerif === 'verification' ? (
                  <>
                    <div className="otp-anneau" aria-hidden="true" />
                    <p className="otp-texte">Vérification du code…</p>
                  </>
                ) : (
                  <>
                    <div className="otp-valide" aria-hidden="true">
                      <img src="/auth/validation.png" alt="" />
                    </div>
                    <p className="otp-texte">Code validé ! Connexion…</p>
                  </>
                )}
              </div>
            )}
            <button type="button" className="auth-retour" onClick={retourIdentifiants}
              style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer' }}>
              ← Retour
            </button>
            <h2>Vérification</h2>
            <p className="sous-titre">Saisissez le code de connexion reçu par courriel.</p>

            {infoCode && <Alerte type="info">{infoCode}</Alerte>}
            <Alerte type="erreur">{erreur}</Alerte>

            <Champ label="Code de connexion" type="text" value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              required inputMode="numeric" autoComplete="one-time-code"
              maxLength={6} placeholder="123456" autoFocus />

            <Bouton type="submit" bloc enCours={enCours}>Vérifier et se connecter</Bouton>

            <p className="auth-lien">
              Vous n'avez rien reçu ?{' '}
              <button type="button" onClick={renvoyer}
                style={{ background: 'none', border: 0, padding: 0, color: 'inherit',
                  font: 'inherit', textDecoration: 'underline', cursor: 'pointer' }}>
                Renvoyer le code
              </button>
            </p>

            <div className="auth-note">
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 1a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2h-1V6a5 5 0 0 0-5-5zm3 8H9V6a3 3 0 0 1 6 0v3z" />
              </svg>
              <span>Ce code protège votre compte contre les accès non autorisés.</span>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
