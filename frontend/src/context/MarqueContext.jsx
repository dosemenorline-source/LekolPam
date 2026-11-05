// Contexte de « marque » de l'école — nom + logo affichés dans l'en-tête public
// et la barre latérale de l'espace connecté. Chargé une fois, rafraîchi quand la
// direction modifie le nom ou le logo (page École).
import { createContext, useContext, useCallback, useEffect, useState } from 'react';
import { marqueApi } from '../services/api.js';

const MarqueContext = createContext(null);

export function MarqueProvider({ children }) {
  const [nom, setNom] = useState('Lekòl Pam');
  const [aLogo, setALogo] = useState(false);
  const [inscriptionEleve, setInscriptionEleve] = useState(false);
  const [inscriptionParent, setInscriptionParent] = useState(false);
  const [pret, setPret] = useState(false); // la marque a-t-elle fini de charger ?
  const [version, setVersion] = useState(0); // pour forcer le rechargement de l'image

  const recharger = useCallback(async () => {
    try {
      const m = await marqueApi.obtenir();
      setNom(m.nom || 'Lekòl Pam');
      setALogo(!!m.aLogo);
      setInscriptionEleve(!!m.inscriptionEleve);
      setInscriptionParent(!!m.inscriptionParent);
      setVersion((v) => v + 1);
    } catch {
      // En cas d'échec, on garde les valeurs par défaut (Lekòl Pam, sans logo).
    } finally {
      setPret(true);
    }
  }, []);

  useEffect(() => { recharger(); }, [recharger]);

  return (
    <MarqueContext.Provider value={{ nom, aLogo, inscriptionEleve, inscriptionParent, pret, version, recharger }}>
      {children}
    </MarqueContext.Provider>
  );
}

// Initiales de repli quand aucun logo n'est défini (ex. « Lekòl Pam » → « LK »).
export function initialesMarque(nom) {
  const mots = (nom || '').trim().split(/\s+/).filter(Boolean);
  if (!mots.length) return 'LK';
  if (mots.length === 1) return mots[0].slice(0, 2).toUpperCase();
  return (mots[0][0] + mots[1][0]).toUpperCase();
}

export function useMarque() {
  const ctx = useContext(MarqueContext);
  if (!ctx) throw new Error('useMarque doit être utilisé dans MarqueProvider.');
  return ctx;
}
