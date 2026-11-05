import { useEffect, useMemo, useState } from 'react';
import { directionApi } from '../../services/api.js';
import Carte from '../../components/Carte.jsx';
import Alerte from '../../components/Alerte.jsx';
import Chargement from '../../components/Chargement.jsx';
import Icone from '../../components/Icone.jsx';

// Palette validée (voir skill dataviz, mode dark — cette page ne s'affiche
// que dans le thème sombre de « Contrôle d'accès »). Catégorielle pour
// l'identité (rôles), statut fixe et réservée pour les états (jamais
// utilisée pour une série « normale »). Le texte reste toujours en encre de
// texte, jamais dans la couleur de la marque — voir BarreHorizontale.
const CATEGORIEL = { bleu: '#3987e5', orange: '#d95926', aqua: '#199e70', jaune: '#c98500' };
const STATUT = { bon: '#0ca30c', attention: '#fab219', serieux: '#ec835a', critique: '#d03b3b' };
const GRIS_TRAME = '#2c2c2a';
const GRIS_AXE = '#898781';

const LIBELLE_ROLE = { parent: 'Parents', eleve: 'Élèves', admin: 'Secrétariat', direction: 'Direction' };
const COULEUR_ROLE = { parent: CATEGORIEL.bleu, eleve: CATEGORIEL.orange, admin: CATEGORIEL.aqua, direction: CATEGORIEL.jaune };

const LIBELLE_INSCRIPTION = {
  en_attente: 'En attente', complement_demande: 'Complément demandé',
  accepte: 'Accepté', refuse: 'Refusé', confirmee: 'Confirmé',
};
const COULEUR_INSCRIPTION = {
  en_attente: STATUT.attention, complement_demande: STATUT.serieux,
  accepte: STATUT.bon, refuse: STATUT.critique, confirmee: STATUT.bon,
};

const LIBELLE_PAIEMENT = { en_attente: 'En attente', valide: 'Validé', rejete: 'Rejeté' };
const COULEUR_PAIEMENT = { en_attente: STATUT.attention, valide: STATUT.bon, rejete: STATUT.critique };

// « 202631 » (AAAA*100+semaine ISO) -> « 3 août »  (lundi de cette semaine-là)
function libelleSemaine(yearweek) {
  const s = String(yearweek);
  const annee = Number(s.slice(0, 4));
  const semaine = Number(s.slice(4));
  const d = new Date(Date.UTC(annee, 0, 1 + (semaine - 1) * 7));
  const jour = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 1 - jour);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

function StatTuile({ libelle, valeur, ton, icone }) {
  return (
    <div className="stx-tuile">
      <span className={`stx-icone stx-icone-${ton}`} aria-hidden="true"><Icone nom={icone} /></span>
      <p className="stx-tuile-valeur">{valeur}</p>
      <p className="stx-tuile-libelle">{libelle}</p>
    </div>
  );
}

// Barres horizontales : 24px max, bout arrondi 4px, valeur en clair au bout
// (jamais dans la couleur de la barre), légende textuelle toujours visible —
// donc rien ici ne dépend du survol pour être lisible.
function BarreHorizontale({ donnees }) {
  const max = Math.max(1, ...donnees.map((d) => d.valeur));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {donnees.map((d) => (
        <div key={d.cle} style={{ display: 'flex', alignItems: 'center', gap: '.75rem' }}
          title={`${d.libelle} : ${d.valeur}`}>
          <span style={{ width: 150, fontSize: '.82rem', color: 'var(--s-txt2)', flexShrink: 0 }}>{d.libelle}</span>
          <div style={{ flex: 1, background: GRIS_TRAME, borderRadius: 4, height: 18 }}>
            <div style={{
              width: `${Math.max((d.valeur / max) * 100, d.valeur ? 3 : 0)}%`,
              background: d.couleur, height: 18, borderRadius: 4,
              transition: 'width .3s ease',
            }} />
          </div>
          <strong style={{ width: 28, textAlign: 'right', fontSize: '.85rem', color: 'var(--s-txt)' }}>{d.valeur}</strong>
        </div>
      ))}
      {donnees.every((d) => d.valeur === 0) && (
        <p className="texte-gris" style={{ fontSize: '.85rem', margin: 0 }}>Aucune donnée pour le moment.</p>
      )}
    </div>
  );
}

// Ligne d'évolution à deux séries (comptes vs inscriptions), avec crosshair +
// info-bulle au survol/focus. Chaque série se termine par une étiquette
// directe (nom + dernière valeur) — le survol enrichit, il ne conditionne
// jamais l'accès à la valeur.
function LigneEvolution({ semaines, serieA, serieB, nomA, nomB }) {
  const L = 640;
  const H = 200;
  const M = { haut: 16, bas: 28, gauche: 8, droite: 8 };
  const [survol, setSurvol] = useState(null);

  const maxY = Math.max(1, ...serieA, ...serieB);
  const largeurUtile = L - M.gauche - M.droite;
  const hauteurUtile = H - M.haut - M.bas;
  const n = semaines.length;

  const x = (i) => M.gauche + (n <= 1 ? largeurUtile / 2 : (i / (n - 1)) * largeurUtile);
  const y = (v) => M.haut + hauteurUtile - (v / maxY) * hauteurUtile;

  const chemin = (serie) => serie.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(v)}`).join(' ');

  const surMouvement = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const posX = ((e.clientX - rect.left) / rect.width) * L;
    let plusProche = 0;
    let ecartMin = Infinity;
    for (let i = 0; i < n; i += 1) {
      const ecart = Math.abs(x(i) - posX);
      if (ecart < ecartMin) { ecartMin = ecart; plusProche = i; }
    }
    setSurvol(plusProche);
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '.6rem', fontSize: '.8rem' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '.4rem', color: 'var(--s-txt2)' }}>
          <span style={{ width: 14, height: 2, background: CATEGORIEL.bleu, display: 'inline-block' }} /> {nomA}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '.4rem', color: 'var(--s-txt2)' }}>
          <span style={{ width: 14, height: 2, background: CATEGORIEL.orange, display: 'inline-block' }} /> {nomB}
        </span>
      </div>

      <svg viewBox={`0 0 ${L} ${H}`} width="100%" height={H} role="img" aria-label={`Évolution de ${nomA} et ${nomB} par semaine`}
        onMouseMove={surMouvement} onMouseLeave={() => setSurvol(null)}
        onFocus={() => setSurvol(n - 1)} onBlur={() => setSurvol(null)} tabIndex={0}
        style={{ overflow: 'visible', cursor: 'crosshair' }}>
        {/* Grille horizontale, hairline, recessive */}
        {[0, 0.5, 1].map((f) => (
          <line key={f} x1={M.gauche} x2={L - M.droite} y1={M.haut + hauteurUtile * f} y2={M.haut + hauteurUtile * f}
            stroke={GRIS_TRAME} strokeWidth="1" />
        ))}

        <path d={chemin(serieA)} fill="none" stroke={CATEGORIEL.bleu} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        <path d={chemin(serieB)} fill="none" stroke={CATEGORIEL.orange} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

        {/* Étiquette directe : valeur de fin de chaque série */}
        <circle cx={x(n - 1)} cy={y(serieA[n - 1])} r="4" fill={CATEGORIEL.bleu} stroke="#16161f" strokeWidth="2" />
        <circle cx={x(n - 1)} cy={y(serieB[n - 1])} r="4" fill={CATEGORIEL.orange} stroke="#16161f" strokeWidth="2" />
        <text x={x(n - 1) + 8} y={y(serieA[n - 1])} dominantBaseline="middle" fontSize="12" fill="var(--s-txt)" fontWeight="700">
          {serieA[n - 1]}
        </text>
        <text x={x(n - 1) + 8} y={y(serieB[n - 1])} dominantBaseline="middle" fontSize="12" fill="var(--s-txt)" fontWeight="700">
          {serieB[n - 1]}
        </text>

        {/* Axe X : première et dernière semaine seulement (sobriété) */}
        <text x={x(0)} y={H - 6} fontSize="11" fill={GRIS_AXE} textAnchor="start">{libelleSemaine(semaines[0])}</text>
        <text x={x(n - 1)} y={H - 6} fontSize="11" fill={GRIS_AXE} textAnchor="end">{libelleSemaine(semaines[n - 1])}</text>

        {survol !== null && (
          <>
            <line x1={x(survol)} x2={x(survol)} y1={M.haut} y2={M.haut + hauteurUtile}
              stroke={GRIS_AXE} strokeWidth="1" />
            <circle cx={x(survol)} cy={y(serieA[survol])} r="5" fill={CATEGORIEL.bleu} stroke="#16161f" strokeWidth="2" />
            <circle cx={x(survol)} cy={y(serieB[survol])} r="5" fill={CATEGORIEL.orange} stroke="#16161f" strokeWidth="2" />
          </>
        )}
      </svg>

      {survol !== null && (
        <div className="stx-infobulle" role="status">
          <strong>{libelleSemaine(semaines[survol])}</strong>
          <span><span style={{ color: CATEGORIEL.bleu }}>●</span> {nomA} : <strong>{serieA[survol]}</strong></span>
          <span><span style={{ color: CATEGORIEL.orange }}>●</span> {nomB} : <strong>{serieB[survol]}</strong></span>
        </div>
      )}
    </div>
  );
}

export default function Statistiques() {
  const [d, setD] = useState(null);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    directionApi.statistiques().then(setD).catch((e) => setErreur(e.message));
  }, []);

  const donneesRole = useMemo(() => {
    if (!d) return [];
    const carte = Object.fromEntries(d.compteurs.parRole.map((r) => [r.role, r.n]));
    return Object.entries(LIBELLE_ROLE).map(([cle, libelle]) => ({
      cle, libelle, valeur: carte[cle] || 0, couleur: COULEUR_ROLE[cle],
    }));
  }, [d]);

  const donneesInscription = useMemo(() => {
    if (!d) return [];
    const carte = Object.fromEntries(d.compteurs.parInscriptionStatut.map((r) => [r.statut, r.n]));
    return Object.entries(LIBELLE_INSCRIPTION).map(([cle, libelle]) => ({
      cle, libelle, valeur: carte[cle] || 0, couleur: COULEUR_INSCRIPTION[cle],
    }));
  }, [d]);

  const donneesPaiement = useMemo(() => {
    if (!d) return [];
    const carte = Object.fromEntries(d.compteurs.parPaiementStatut.map((r) => [r.statut, r.n]));
    return Object.entries(LIBELLE_PAIEMENT).map(([cle, libelle]) => ({
      cle, libelle, valeur: carte[cle] || 0, couleur: COULEUR_PAIEMENT[cle],
    }));
  }, [d]);

  if (erreur) return <Alerte type="erreur">{erreur}</Alerte>;
  if (!d) return <Chargement />;

  const { compteurs, croissance } = d;
  const dossiersATraiter = (compteurs.parInscriptionStatut.find((r) => r.statut === 'en_attente')?.n || 0)
    + (compteurs.parInscriptionStatut.find((r) => r.statut === 'complement_demande')?.n || 0);
  const paiementsEnAttente = compteurs.parPaiementStatut.find((r) => r.statut === 'en_attente')?.n || 0;

  return (
    <div style={{ maxWidth: 960 }}>
      <div className="page-entete">
        <h1>Statistiques & santé du site</h1>
        <p>Vue d'ensemble technique et évolution de l'utilisation de la plateforme.</p>
      </div>

      <div className="stx-tuiles">
        <StatTuile libelle="Comptes" valeur={compteurs.totalUtilisateurs} ton="navy" icone="users" />
        <StatTuile libelle="Élèves" valeur={compteurs.totalEleves} ton="info" icone="school" />
        <StatTuile libelle="Dossiers à traiter" valeur={dossiersATraiter} ton="or" icone="clipboard" />
        <StatTuile libelle="Paiements en attente" valeur={paiementsEnAttente} ton="or" icone="bank" />
      </div>

      <Carte titre="Évolution hebdomadaire (8 dernières semaines)" style={{ marginTop: '1rem' }}>
        <LigneEvolution
          semaines={croissance.comptes.map((c) => c.semaine)}
          serieA={croissance.comptes.map((c) => c.n)}
          serieB={croissance.inscriptions.map((c) => c.n)}
          nomA="Nouveaux comptes" nomB="Nouvelles inscriptions"
        />
      </Carte>

      <div className="rangee" style={{ gap: '1rem', alignItems: 'stretch', flexWrap: 'wrap', marginTop: '1rem' }}>
        <Carte titre="Comptes par rôle" style={{ flex: '1 1 280px' }}>
          <BarreHorizontale donnees={donneesRole} />
        </Carte>
        <Carte titre="Dossiers d'inscription" style={{ flex: '1 1 280px' }}>
          <BarreHorizontale donnees={donneesInscription} />
        </Carte>
        <Carte titre="Paiements" style={{ flex: '1 1 280px' }}>
          <BarreHorizontale donnees={donneesPaiement} />
        </Carte>
      </div>

      <footer className="insc-pied">© {new Date().getFullYear()} Lekòl Pam. Tous droits réservés.</footer>
    </div>
  );
}
