import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import PanneauMarque from './PanneauMarque.jsx';
import Champ from '../../components/Champ.jsx';
import Bouton from '../../components/Bouton.jsx';
import Alerte from '../../components/Alerte.jsx';

export default function ConnexionEleve() {
  const { eleveConnexion } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const codeUrl = params.get('code');
  const [code, setCode] = useState((codeUrl || '').toUpperCase());
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [autoEnCours, setAutoEnCours] = useState(!!codeUrl); // connexion automatique via QR
  const autoLance = useRef(false);

  // Connexion (partagée entre le formulaire et le scan du QR code du badge)
  const connecter = async (valeur) => {
    const c = (valeur || '').trim().toUpperCase();
    if (!c) { setErreur("Le code d'accès est requis."); return; }
    setErreur('');
    try {
      await eleveConnexion(c);
      navigate('/eleve/notes');
    } catch (err) {
      setErreur(err.message);
      throw err;
    }
  };

  // Scan du QR : ?code=XXXX -> connexion automatique puis résultats
  useEffect(() => {
    if (!codeUrl || autoLance.current) return;
    autoLance.current = true;
    connecter(codeUrl).catch(() => {}).finally(() => setAutoEnCours(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codeUrl]);

  const soumettre = async (e) => {
    e.preventDefault();
    setEnCours(true);
    try { await connecter(code); }
    catch { /* erreur déjà affichée */ }
    finally { setEnCours(false); }
  };

  return (
    <div className="auth-ecran">
      <PanneauMarque />
      <div className="auth-panneau">
        <form className="auth-form" onSubmit={soumettre}>
          <h2>Espace élève</h2>
          <p className="sous-titre">
            {autoEnCours ? 'Connexion depuis votre badge…' : "Saisissez le code d'accès remis par vos parents."}
          </p>

          <Alerte type="erreur">{erreur}</Alerte>

          <Champ label="Code d'accès" value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="ex. K7M2P9QX" required autoComplete="off"
            style={{ letterSpacing: '2px', fontWeight: 600 }} />

          <Bouton type="submit" bloc enCours={enCours || autoEnCours}>Accéder à mes résultats</Bouton>

          <p className="auth-lien">
            Vous êtes parent ou personnel ? <Link to="/login">Connexion par courriel</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
