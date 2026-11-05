import { useEffect, useRef, useState } from 'react';
import { eleveApi, urlPhotoEleve, urlLogoEcole } from '../../services/api.js';
import Carte from '../../components/Carte.jsx';
import CarteBadge from '../../components/CarteBadge.jsx';
import Bouton from '../../components/Bouton.jsx';
import Alerte from '../../components/Alerte.jsx';
import Chargement from '../../components/Chargement.jsx';

export default function BadgeEleve() {
  const [badge, setBadge] = useState(null);
  const [version, setVersion] = useState(0); // anti-cache après upload
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState('');
  const fichierRef = useRef(null);

  const charger = () => {
    eleveApi.badge().then((d) => setBadge(d.badge)).catch((e) => setErreur(e.message));
  };
  useEffect(charger, []);

  const choisirPhoto = () => fichierRef.current?.click();

  const envoyerPhoto = async (e) => {
    const fichier = e.target.files?.[0];
    if (!fichier) return;
    setErreur('');
    setEnCours(true);
    try {
      await eleveApi.televerserPhoto(fichier);
      setVersion((v) => v + 1);
      setBadge((b) => (b ? { ...b, aPhoto: true } : b));
    } catch (err) {
      setErreur(err.message);
    } finally {
      setEnCours(false);
      if (fichierRef.current) fichierRef.current.value = '';
    }
  };

  if (erreur && !badge) return <Alerte type="erreur">{erreur}</Alerte>;
  if (!badge) return <Chargement />;

  return (
    <div>
      <div className="page-entete no-print">
        <h1>Mon badge</h1>
        <p>Ajoutez votre photo puis imprimez votre badge scolaire.</p>
      </div>

      {erreur && <Alerte type="erreur">{erreur}</Alerte>}

      <div className="badge-zone" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.25rem' }}>
        <CarteBadge badge={badge}
          photoSrc={badge.aPhoto ? `${urlPhotoEleve()}?v=${version}` : null}
          logoSrc={`${urlLogoEcole()}?v=${version}`} />

        {/* Actions (masquées à l'impression) */}
        <Carte className="no-print" style={{ width: 340 }}>
          <input ref={fichierRef} type="file" accept="image/png,image/jpeg" onChange={envoyerPhoto} hidden />
          <div className="rangee" style={{ gap: '.75rem', flexWrap: 'wrap' }}>
            <Bouton variante="secondaire" onClick={choisirPhoto} enCours={enCours}>
              {badge.aPhoto ? 'Changer la photo' : 'Ajouter ma photo'}
            </Bouton>
            <Bouton onClick={() => window.print()}>Imprimer le badge</Bouton>
          </div>
          <p className="texte-gris" style={{ marginTop: '.6rem', fontSize: '.82rem' }}>
            Photo JPG ou PNG, max 5 Mo.
          </p>
        </Carte>
      </div>
    </div>
  );
}
