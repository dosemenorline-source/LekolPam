import { useEffect, useState } from 'react';
import { permissionsApi, authApi } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { biometrieDisponible, activerBiometrie } from '../services/biometrie.js';
import Carte from '../components/Carte.jsx';
import Champ from '../components/Champ.jsx';
import Bouton from '../components/Bouton.jsx';
import Alerte from '../components/Alerte.jsx';

export default function MonCompte() {
  const { utilisateur, rafraichir } = useAuth();
  const [motDePasseActuel, setMotDePasseActuel] = useState('');
  const [nouveauCourriel, setNouveauCourriel] = useState(utilisateur?.courriel || '');
  const [nouveauMotDePasse, setNouveauMotDePasse] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [erreur, setErreur] = useState('');
  const [msg, setMsg] = useState('');
  const [enCours, setEnCours] = useState(false);

  const aMotDePasse = !!utilisateur?.aMotDePasse;

  const soumettre = async (e) => {
    e.preventDefault();
    setErreur(''); setMsg('');

    const courrielChange = nouveauCourriel.trim().toLowerCase() !== utilisateur.courriel;
    if (!courrielChange && !nouveauMotDePasse) {
      setErreur("Modifiez le courriel et/ou le mot de passe avant d'enregistrer.");
      return;
    }
    if (nouveauMotDePasse && nouveauMotDePasse !== confirmation) {
      setErreur('La confirmation ne correspond pas au nouveau mot de passe.');
      return;
    }

    setEnCours(true);
    try {
      await permissionsApi.modifierCompte({
        motDePasseActuel,
        nouveauCourriel: courrielChange ? nouveauCourriel.trim().toLowerCase() : undefined,
        nouveauMotDePasse: nouveauMotDePasse || undefined,
      });
      await rafraichir();
      setMsg('Compte mis à jour.');
      setMotDePasseActuel(''); setNouveauMotDePasse(''); setConfirmation('');
    } catch (err) {
      setErreur(err.message);
    } finally {
      setEnCours(false);
    }
  };

  return (
    <div style={{ maxWidth: 720 }}>
      <div className="page-entete">
        <h1>Mon compte</h1>
        <p>Modifiez le courriel ou le mot de passe de votre compte.</p>
      </div>

      <Carte>
        <form onSubmit={soumettre} className="notes-form-grille" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
          {erreur && <Alerte type="erreur">{erreur}</Alerte>}
          {msg && <Alerte type="info">{msg}</Alerte>}

          <Champ label="Courriel" type="email" value={nouveauCourriel}
            onChange={(e) => setNouveauCourriel(e.target.value)} required />
          <Champ label="Nouveau mot de passe (laisser vide pour ne pas changer)" type="password"
            value={nouveauMotDePasse} onChange={(e) => setNouveauMotDePasse(e.target.value)}
            autoComplete="new-password" placeholder="min. 8 caractères" />
          {nouveauMotDePasse && (
            <Champ label="Confirmer le nouveau mot de passe" type="password" value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)} autoComplete="new-password" required />
          )}
          {aMotDePasse ? (
            <Champ label="Mot de passe actuel (obligatoire pour confirmer)" type="password"
              value={motDePasseActuel} onChange={(e) => setMotDePasseActuel(e.target.value)}
              autoComplete="current-password" required />
          ) : (
            <Alerte type="info">
              Votre compte utilise la connexion Google — aucun mot de passe actuel n'est requis pour en définir un.
            </Alerte>
          )}

          <div>
            <Bouton type="submit" enCours={enCours}>Enregistrer</Bouton>
          </div>
        </form>
      </Carte>

      <SecuriteBiometrie />

      <footer className="insc-pied">© {new Date().getFullYear()} Lekòl Pam. Tous droits réservés.</footer>
    </div>
  );
}

// Connexion biométrique (Face ID / Touch ID / Windows Hello / empreinte) :
// activation sur l'appareil courant + liste des appareils enregistrés.
function SecuriteBiometrie() {
  const [appareils, setAppareils] = useState(null);
  const [erreur, setErreur] = useState('');
  const [msg, setMsg] = useState('');
  const [enCours, setEnCours] = useState(false);
  const supporte = biometrieDisponible();

  const charger = () => authApi.webauthnAppareils()
    .then((d) => setAppareils(d.appareils))
    .catch((e) => setErreur(e.message));
  useEffect(() => { charger(); }, []);

  const activer = async () => {
    setErreur(''); setMsg(''); setEnCours(true);
    try {
      await activerBiometrie();
      setMsg('Connexion biométrique activée sur cet appareil.');
      charger();
    } catch (err) {
      setErreur(err.message);
    } finally {
      setEnCours(false);
    }
  };

  const retirer = async (id) => {
    if (!window.confirm('Retirer cet appareil ? Vous ne pourrez plus vous y connecter par biométrie.')) return;
    setErreur(''); setMsg('');
    try {
      await authApi.webauthnSupprimerAppareil(id);
      setMsg('Appareil retiré.');
      charger();
    } catch (err) {
      setErreur(err.message);
    }
  };

  const dateFr = (s) => (s ? new Date(s).toLocaleDateString('fr-FR') : '—');

  return (
    <Carte titre="Connexion biométrique (Face ID / empreinte)" style={{ marginTop: '1rem' }}>
      <p className="texte-gris" style={{ marginTop: 0 }}>
        Activez la connexion par Face ID, Touch ID, Windows Hello ou empreinte sur les appareils
        que vous utilisez. Vous pourrez ensuite vous connecter sans mot de passe ni code.
      </p>
      {erreur && <Alerte type="erreur">{erreur}</Alerte>}
      {msg && <Alerte type="info">{msg}</Alerte>}

      {!supporte && (
        <Alerte type="info">Cet appareil ou ce navigateur ne prend pas en charge la connexion biométrique.</Alerte>
      )}

      {appareils && appareils.length > 0 && (
        <div className="tableau-enveloppe" style={{ margin: '.5rem 0 1rem' }}>
          <table className="tableau">
            <thead><tr><th>Appareil</th><th>Activé le</th><th>Dernière utilisation</th><th></th></tr></thead>
            <tbody>
              {appareils.map((a) => (
                <tr key={a.id}>
                  <td>{a.appareil || 'Appareil'}</td>
                  <td>{dateFr(a.cree_le)}</td>
                  <td>{a.dernier_usage ? dateFr(a.dernier_usage) : '—'}</td>
                  <td><button type="button" className="paie-btn paie-rejeter" onClick={() => retirer(a.id)}>Retirer</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {appareils && appareils.length === 0 && (
        <p className="texte-gris">Aucun appareil enregistré pour l'instant.</p>
      )}

      {supporte && (
        <Bouton type="button" onClick={activer} enCours={enCours}>
          + Activer sur cet appareil
        </Bouton>
      )}
    </Carte>
  );
}
