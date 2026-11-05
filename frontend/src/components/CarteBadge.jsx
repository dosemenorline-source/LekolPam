// Carte d'identité étudiant — recto/verso, façon carte ID plastifiée.
// props: badge { nom, prenom, niveau, anneeScolaire, nisu, aPhoto, dateNaissance,
//                groupeSanguin, nomParent, contactParent, dateEmission, dateExpiration,
//                ecoleNom, ecoleAdresse, ecoleTelephone, ecoleCourriel, ecoleALogo }
//        photoSrc (URL de la photo, ou null), logoSrc (URL du logo)
import { QRCodeSVG } from 'qrcode.react';

const MARINE = '#1A365D';
const MARINE2 = '#2B4C7E';
const OR = '#D69E2E';

// Hauteur fixe des deux faces — le contenu ne doit jamais faire varier la
// mise en page (sinon l'impression recto/verso ne tient plus sur une page).
const HAUTEUR_CARTE = 500;
// Empêche un texte trop long (nom, nom d'école) d'agrandir la carte : il est
// coupé avec « … » plutôt que de passer à la ligne.
const TRONQUE = { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };

// Formate 'YYYY-MM-DD' -> 'JJ-MM-AAAA'
const dateCourte = (iso) => {
  if (!iso) return '—';
  const p = String(iso).slice(0, 10).split('-');
  return p.length === 3 ? `${p[2]}-${p[1]}-${p[0]}` : iso;
};

// Vague décorative (bas d'en-tête / haut de pied)
function Vague({ couleur = MARINE, retourne = false }) {
  return (
    <svg viewBox="0 0 320 26" preserveAspectRatio="none"
      style={{ display: 'block', width: '100%', height: 26, transform: retourne ? 'rotate(180deg)' : 'none' }}
      aria-hidden="true">
      <path d="M0,0 C90,30 230,30 320,0 L320,26 L0,26 Z" fill={couleur} />
    </svg>
  );
}

function Logo({ logoSrc, aLogo, taille = 46 }) {
  return aLogo ? (
    <img src={logoSrc} alt="Logo"
      style={{ width: taille, height: taille, borderRadius: '50%', objectFit: 'cover', background: '#fff', border: '2px solid #fff' }} />
  ) : (
    <div style={{ width: taille, height: taille, borderRadius: '50%', background: 'rgba(255,255,255,.18)',
      display: 'grid', placeItems: 'center', fontWeight: 800, color: '#fff', border: '2px solid #fff' }}>LK</div>
  );
}

function EnteteEcole({ badge, logoSrc }) {
  return (
    <div style={{ background: `linear-gradient(160deg, ${MARINE} 0%, ${MARINE2} 100%)`, color: '#fff', padding: '.9rem 1rem .2rem', textAlign: 'center' }}>
      <div style={{ display: 'grid', placeItems: 'center', marginBottom: '.4rem' }}>
        <Logo logoSrc={logoSrc} aLogo={badge.ecoleALogo} />
      </div>
      <div style={{ fontWeight: 800, fontSize: '.92rem', lineHeight: 1.2, ...TRONQUE }}>{badge.ecoleNom}</div>
      {badge.ecoleAdresse && <div style={{ fontSize: '.68rem', opacity: .85, marginTop: 2, ...TRONQUE }}>{badge.ecoleAdresse}</div>}
    </div>
  );
}

function Ligne({ libelle, valeur, mono }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '.5rem', fontSize: '.78rem', padding: '.2rem 0' }}>
      <span style={{ color: '#718096' }}>{libelle}</span>
      <span style={{ fontWeight: 700, color: '#2D3748', textAlign: 'right',
        fontFamily: mono ? 'monospace' : 'inherit', letterSpacing: mono ? '.5px' : 0 }}>{valeur || '—'}</span>
    </div>
  );
}

// ---------- Recto ----------
function Recto({ badge, photoSrc, logoSrc }) {
  const nomComplet = [badge.prenom, badge.nom].filter(Boolean).join(' ') || '—';
  return (
    <div className="badge-face" style={{
      width: 320, height: HAUTEUR_CARTE, background: '#fff', border: '1px solid #E2E8F0', borderRadius: 14,
      overflow: 'hidden', boxShadow: '0 6px 20px rgba(26,54,93,.12)',
    }}>
      <EnteteEcole badge={badge} logoSrc={logoSrc} />
      <Vague />

      <div style={{ textAlign: 'center', marginTop: -12 }}>
        <span style={{ display: 'inline-block', background: OR, color: '#fff', fontWeight: 800,
          fontSize: '.62rem', letterSpacing: '.08em', padding: '.25rem .8rem', borderRadius: 999 }}>
          CARTE D'IDENTITÉ ÉTUDIANT
        </span>
      </div>

      {/* Photo */}
      <div style={{ display: 'grid', placeItems: 'center', padding: '.75rem 1rem .35rem' }}>
        <div style={{ width: 104, height: 124, borderRadius: 8, overflow: 'hidden',
          border: `3px solid ${MARINE}`, background: '#EDF2F7', display: 'grid', placeItems: 'center' }}>
          {badge.aPhoto && photoSrc
            ? <img src={photoSrc} alt="Photo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <span style={{ fontSize: '.72rem', color: '#6b7280', textAlign: 'center' }}>Aucune<br />photo</span>}
        </div>
      </div>

      <div style={{ textAlign: 'center', fontWeight: 800, fontSize: '1.02rem', color: MARINE, margin: '.1rem 0 .5rem', padding: '0 .75rem', ...TRONQUE }}>
        {nomComplet}
      </div>

      <div style={{ padding: '0 1.15rem .5rem' }}>
        <Ligne libelle="Classe" valeur={badge.niveau} />
        <Ligne libelle="Année académique" valeur={badge.anneeScolaire} />
        <Ligne libelle="N° étudiant" valeur={badge.nisu} mono />
        <Ligne libelle="Groupe sanguin" valeur={badge.groupeSanguin} />
      </div>

      <Vague retourne />
      <div style={{ background: MARINE, color: '#fff', textAlign: 'center', padding: '.35rem', fontSize: '.72rem', fontWeight: 700, marginTop: -1 }}>
        Direction
      </div>
    </div>
  );
}

// ---------- Verso ----------
function Verso({ badge, logoSrc }) {
  // Lien unique vers les résultats de l'élève : le scan ouvre l'espace élève,
  // connecté automatiquement grâce à son code d'accès.
  const origine = typeof window !== 'undefined' ? window.location.origin : '';
  const lienResultats = badge.nisu
    ? `${origine}/eleve?code=${encodeURIComponent(badge.nisu)}`
    : origine || 'Lekòl Pam';
  return (
    <div className="badge-face" style={{
      width: 320, height: HAUTEUR_CARTE, background: '#fff', border: '1px solid #E2E8F0', borderRadius: 14,
      overflow: 'hidden', boxShadow: '0 6px 20px rgba(26,54,93,.12)',
    }}>
      <div style={{ background: `linear-gradient(160deg, ${MARINE} 0%, ${MARINE2} 100%)`, color: '#fff', padding: '.7rem 1rem .2rem', textAlign: 'center' }}>
        <div style={{ fontSize: '.72rem', opacity: .9, ...TRONQUE }}>En cas de perte, veuillez retourner cette carte à :</div>
        <div style={{ display: 'grid', placeItems: 'center', margin: '.45rem 0 .3rem' }}>
          <Logo logoSrc={logoSrc} aLogo={badge.ecoleALogo} taille={38} />
        </div>
        <div style={{ fontWeight: 800, fontSize: '.85rem', ...TRONQUE }}>{badge.ecoleNom}</div>
        {badge.ecoleAdresse && <div style={{ fontSize: '.66rem', opacity: .85, ...TRONQUE }}>{badge.ecoleAdresse}</div>}
        {badge.ecoleTelephone && <div style={{ fontSize: '.66rem', opacity: .85, ...TRONQUE }}>Tél : {badge.ecoleTelephone}</div>}
        {badge.ecoleCourriel && <div style={{ fontSize: '.66rem', opacity: .85, ...TRONQUE }}>{badge.ecoleCourriel}</div>}
      </div>
      <Vague />

      <div style={{ padding: '.55rem 1.15rem .5rem' }}>
        <div style={{ display: 'flex', gap: '.5rem', margin: '.15rem 0 .55rem' }}>
          <div style={{ flex: 1, background: '#EBF8FF', border: `1px solid ${MARINE}`, borderRadius: 8, padding: '.4rem .5rem', textAlign: 'center' }}>
            <div style={{ fontSize: '.6rem', color: '#718096', fontWeight: 700 }}>ÉMISSION</div>
            <div style={{ fontSize: '.78rem', fontWeight: 800, color: MARINE }}>{dateCourte(badge.dateEmission)}</div>
          </div>
          <div style={{ flex: 1, background: '#FFFBEB', border: `1px solid ${OR}`, borderRadius: 8, padding: '.4rem .5rem', textAlign: 'center' }}>
            <div style={{ fontSize: '.6rem', color: '#B7791F', fontWeight: 700 }}>EXPIRATION</div>
            <div style={{ fontSize: '.78rem', fontWeight: 800, color: '#B7791F' }}>{dateCourte(badge.dateExpiration)}</div>
          </div>
        </div>

        <div style={{ display: 'grid', placeItems: 'center', padding: '.2rem 0' }}>
          <div style={{ padding: 6, background: '#fff', border: '1px solid #E2E8F0', borderRadius: 8 }}>
            <QRCodeSVG value={lienResultats} size={104} level="M" fgColor={MARINE} />
          </div>
          <div style={{ fontSize: '.66rem', color: MARINE, marginTop: 5, fontWeight: 700 }}>
            Scannez pour accéder aux résultats
          </div>
          <div style={{ fontSize: '.62rem', color: '#6b7280', marginTop: 1, fontFamily: 'monospace', letterSpacing: '.5px' }}>
            {badge.nisu || '—'}
          </div>
        </div>
      </div>

      <Vague retourne />
      <div style={{ background: MARINE, color: '#fff', textAlign: 'center', padding: '.35rem .75rem', fontSize: '.66rem', marginTop: -1, ...TRONQUE }}>
        {badge.ecoleNom}
      </div>
    </div>
  );
}

export default function CarteBadge({ badge, photoSrc, logoSrc }) {
  return (
    <div className="badge-cartes" style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', justifyContent: 'center' }}>
      <Recto badge={badge} photoSrc={photoSrc} logoSrc={logoSrc} />
      <Verso badge={badge} logoSrc={logoSrc} />
    </div>
  );
}
