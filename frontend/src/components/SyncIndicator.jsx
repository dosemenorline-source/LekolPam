import { useState, useEffect, useRef } from 'react';
import { syncApi } from '../services/api.js';

// Indicateur de synchronisation — visible UNIQUEMENT sur un poste de bureau
// (mode « poste »). Sur le nuage, l'endpoint renvoie actif:false et rien ne
// s'affiche. Pastille discrète en bas à droite : état + modifs en attente.
const COULEURS = {
  en_ligne: { fond: '#effaf1', bord: '#b7e4c7', texte: '#1a7f3c', point: '#22c55e', libelle: 'Synchronisé' },
  hors_ligne: { fond: '#fffaf0', bord: '#fbd38d', texte: '#9c4221', point: '#ed8936', libelle: 'Hors ligne' },
  erreur: { fond: '#fff5f5', bord: '#fecaca', texte: '#9b2c2c', point: '#e53e3e', libelle: 'Erreur de synchro' },
  jamais: { fond: '#edf2f7', bord: '#cbd5e0', texte: '#4a5568', point: '#a0aec0', libelle: 'En attente' },
};

export default function SyncIndicator() {
  const [etat, setEtat] = useState(null);     // null = inconnu/masqué
  const [occupe, setOccupe] = useState(false);
  const minuteur = useRef(null);

  const rafraichir = () => syncApi.etatPoste()
    .then((d) => setEtat(d && d.actif ? d : null))
    .catch(() => { /* non connecté / nuage : on masque */ });

  useEffect(() => {
    rafraichir();
    minuteur.current = setInterval(rafraichir, 10000);
    return () => clearInterval(minuteur.current);
  }, []);

  if (!etat) return null;

  const c = COULEURS[etat.statut] || COULEURS.jamais;
  const syncMaintenant = async () => {
    setOccupe(true);
    try { await syncApi.synchroniserMaintenant(); setTimeout(rafraichir, 1500); } catch { /* ignore */ }
    finally { setTimeout(() => setOccupe(false), 1500); }
  };

  const dateCourte = etat.dernierSync
    ? new Date(etat.dernierSync).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div style={{
      position: 'fixed', right: 16, bottom: 16, zIndex: 900,
      display: 'flex', alignItems: 'center', gap: 10,
      background: c.fond, border: `1px solid ${c.bord}`, color: c.texte,
      borderRadius: 999, padding: '7px 12px', fontSize: '.8rem', fontWeight: 600,
      boxShadow: '0 2px 10px rgba(0,0,0,.12)',
    }}>
      <span style={{
        width: 9, height: 9, borderRadius: '50%', background: c.point,
        boxShadow: etat.statut === 'en_ligne' ? `0 0 0 3px ${c.point}33` : 'none',
      }} />
      <span>{c.libelle}</span>
      {etat.enAttente > 0 && (
        <span style={{
          background: c.texte, color: c.fond, borderRadius: 999, padding: '1px 7px', fontSize: '.72rem',
        }} title="Modifications locales en attente d'envoi">{etat.enAttente}</span>
      )}
      {dateCourte && etat.statut === 'en_ligne' && (
        <span style={{ fontWeight: 400, opacity: .85 }}>{dateCourte}</span>
      )}
      <button
        type="button" onClick={syncMaintenant} disabled={occupe}
        title="Synchroniser maintenant"
        style={{
          border: 0, background: 'transparent', color: c.texte, cursor: 'pointer',
          fontSize: '.95rem', lineHeight: 1, padding: 0, opacity: occupe ? .5 : 1,
        }}
      >⟳</button>
    </div>
  );
}
