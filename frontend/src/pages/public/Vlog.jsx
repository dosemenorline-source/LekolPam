import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { vlogApi, urlPhotoVlog } from '../../services/api.js';
import { dateFr } from '../../utils/libelles.js';
import Icone from '../../components/Icone.jsx';
import useTitrePage from '../../hooks/useTitrePage.js';

export const CATEGORIES_VLOG = {
  actualite: 'Actualité',
  photo: 'Photo',
  annonce: 'Annonce',
};

// Logos officiels des réseaux (SVG en ligne) : icône blanche sur le fond coloré de la marque.
const IcoWhatsApp = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
    <rect width="24" height="24" rx="6" fill="#25D366" />
    <path fill="#fff" transform="translate(3.6 3.6) scale(0.7)" d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.71.306 1.263.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884" />
  </svg>
);
const IcoFacebook = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
    <rect width="24" height="24" rx="6" fill="#1877F2" />
    <path fill="#fff" d="M15.5 8.6h-1.4c-.55 0-.85.35-.85 1v1.6h2.25l-.35 2.65H13.3V21h-2.6v-7.15H8.5V11.2h2.2V9.4c0-2.05 1.15-3.4 3.15-3.4h1.65z" />
  </svg>
);
const IcoTwitter = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
    <rect width="24" height="24" rx="6" fill="#000000" />
    <path fill="#fff" transform="translate(4 4) scale(0.665)" d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);
const IcoLien = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="#6b7280" aria-hidden="true">
    <path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z" />
  </svg>
);

// Réseaux de partage : chaque entrée construit l'URL de partage à partir du lien et du titre.
const RESEAUX = [
  { cle: 'whatsapp', libelle: 'WhatsApp', Icone: IcoWhatsApp,
    url: (lien, titre) => `https://wa.me/?text=${encodeURIComponent(`${titre} ${lien}`)}` },
  { cle: 'facebook', libelle: 'Facebook', Icone: IcoFacebook,
    url: (lien) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(lien)}` },
  { cle: 'twitter', libelle: 'X / Twitter', Icone: IcoTwitter,
    url: (lien, titre) => `https://twitter.com/intent/tweet?text=${encodeURIComponent(titre)}&url=${encodeURIComponent(lien)}` },
];

export default function Vlog() {
  useTitrePage('Vlog', 'Actualités, annonces et vie scolaire de Lekòl Pam.');

  const [publications, setPublications] = useState([]);
  const [erreur, setErreur] = useState('');
  const [chargement, setChargement] = useState(true);
  const [partage, setPartage] = useState(null); // publication en cours de partage (modal)
  const [copie, setCopie] = useState(false);

  useEffect(() => {
    vlogApi.publications()
      .then((d) => setPublications(d.publications))
      .catch((e) => setErreur(e.message))
      .finally(() => setChargement(false));
  }, []);

  // Défile jusqu'à la publication ciblée par le lien partagé (#pub-<id>) une fois chargée.
  useEffect(() => {
    if (chargement || !window.location.hash) return;
    const cible = document.getElementById(window.location.hash.slice(1));
    if (cible) cible.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [chargement]);

  const lienDe = (p) => `${window.location.origin}/vlog#pub-${p.id}`;

  const partagerVers = (reseau) => {
    window.open(reseau.url(lienDe(partage), partage.titre), '_blank', 'noopener,noreferrer,width=600,height=500');
  };

  const copierLien = async () => {
    try { await navigator.clipboard.writeText(lienDe(partage)); } catch { /* ignoré */ }
    setCopie(true);
    setTimeout(() => setCopie(false), 2000);
  };

  const ouvrirPartage = (p) => { setPartage(p); setCopie(false); };

  return (
    <div className="vpub">
      <section className="vpub-hero">
        <h1>Vlog</h1>
        <p>Actualités, photos et annonces sur la vie de l'école.</p>
      </section>

      {erreur && <p className="texte-gris">{erreur}</p>}

      {chargement ? (
        <div className="vpub-liste">
          {[0, 1].map((i) => <div key={i} className="vpub-skeleton" />)}
        </div>
      ) : publications.length === 0 ? (
        <div className="vpub-vide">
          <div className="vpub-vide-ico" aria-hidden="true"><Icone nom="inbox" size={48} /></div>
          <p>Aucune actualité pour le moment.</p>
          <p className="texte-gris">Revenez bientôt !</p>
        </div>
      ) : (
        <div className="vpub-liste">
          {publications.map((p) => (
            <article key={p.id} id={`pub-${p.id}`} className="vpub-carte">
              <div className="vpub-carte-haut">
                <span className={`vadm-cat vadm-cat-${p.categorie}`}>{CATEGORIES_VLOG[p.categorie] || p.categorie}</span>
                <span className="vpub-date">{dateFr(p.cree_le)}</span>
              </div>
              <h3 className="vpub-titre">{p.titre}</h3>
              <p className="vpub-texte">{p.contenu}</p>
              {p.photo_url && <img className="vpub-photo" src={urlPhotoVlog(p.id)} alt={p.titre} loading="lazy" />}
              <button type="button" className="vpub-partager" onClick={() => ouvrirPartage(p)}>
<Icone nom="share" /> Partager
              </button>
            </article>
          ))}
        </div>
      )}

      <p className="vpub-admin-lien">
        <Link to="/vlog/admin" className="texte-gris"><Icone nom="lock" /> Espace administrateur</Link>
      </p>

      {/* Modale de partage */}
      {partage && (
        <div className="prof-modal-fond" onClick={() => setPartage(null)}>
          <div className="prof-modal carte" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="prof-modal-fermer" onClick={() => setPartage(null)} aria-label="Fermer">×</button>
            <h2 style={{ marginBottom: '.35rem' }}>Partager cette publication</h2>
            <p className="texte-gris" style={{ marginBottom: '1rem' }}>{partage.titre}</p>
            <div className="vpub-share-btns">
              {RESEAUX.map((r) => (
                <button key={r.cle} type="button" className="vpub-share-btn" onClick={() => partagerVers(r)}>
                  <r.Icone /> {r.libelle}
                </button>
              ))}
              <button type="button" className="vpub-share-btn" onClick={copierLien}>
                <IcoLien /> {copie ? 'Lien copié ✓' : 'Copier le lien'}
              </button>
            </div>
            <button type="button" className="insc-btn-reinit" style={{ width: '100%' }} onClick={() => setPartage(null)}>Fermer</button>
          </div>
        </div>
      )}
    </div>
  );
}
