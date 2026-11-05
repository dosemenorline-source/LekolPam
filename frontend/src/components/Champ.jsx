import { useState } from 'react';
import Icone from './Icone.jsx';

// Champ de formulaire (label + input + erreur). Pour type="password", un
// bouton œil permet d'afficher le mot de passe en clair (évite les fautes de
// frappe à la saisie).
export default function Champ({ label, erreur, type = 'text', enfant, ...props }) {
  const [visible, setVisible] = useState(false);
  const estMotDePasse = type === 'password';

  return (
    <div className="champ">
      {label && <label htmlFor={props.id || props.name}>{label}</label>}
      {enfant || (estMotDePasse ? (
        <div className="champ-mdp-conteneur">
          <input type={visible ? 'text' : 'password'} {...props} />
          <button type="button" className="champ-mdp-oeil"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
            tabIndex={-1}>
            <Icone nom={visible ? 'eyeSlash' : 'eye'} />
          </button>
        </div>
      ) : (
        <input type={type} {...props} />
      ))}
      {erreur && <span className="erreur-champ">{erreur}</span>}
    </div>
  );
}
