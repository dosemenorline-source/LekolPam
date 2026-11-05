import { useState } from 'react';
import { Link } from 'react-router-dom';
import { contactApi } from '../../services/api.js';
import useTitrePage from '../../hooks/useTitrePage.js';

// Icônes des avantages (SVG en ligne, couleur héritée via currentColor)
const IcoInscription = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M19 3h-4.18C14.4 1.84 13.3 1 12 1s-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm2 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" />
  </svg>
);
const IcoNotes = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 3 1 9l11 6 9-4.91V17h2V9L12 3zm-6 8.18v3.82l6 3.27 6-3.27v-3.82l-6 3.27-6-3.27z" />
  </svg>
);
const IcoPaiement = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M21 7.28V5c0-1.1-.9-2-2-2H5c-1.11 0-2 .89-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-2.28c.59-.35 1-.98 1-1.72V9c0-.74-.41-1.37-1-1.72zM20 9v6h-7V9h7zM5 19V5h14v2h-6c-1.1 0-2 .9-2 2v6c0 1.1.9 2 2 2h6v2H5z" />
    <circle cx="16" cy="12" r="1.5" />
  </svg>
);

const AVANTAGES = [
  {
    Icone: IcoInscription,
    titre: 'Inscriptions en ligne',
    texte: 'Inscrivez vos enfants et suivez l\'avancement du dossier en quelques clics, sans vous déplacer.',
    to: '/register', lien: 'Découvrir',
  },
  {
    Icone: IcoNotes,
    titre: 'Notes & bulletins',
    texte: 'Consultez les résultats et les bulletins par trimestre, en toute sécurité, depuis votre espace.',
    to: '/academie/primaire', lien: 'Découvrir',
  },
  {
    Icone: IcoPaiement,
    titre: 'Paiements simplifiés',
    texte: 'Réglez la scolarité et gardez une trace claire de chaque versement et de chaque reçu.',
    to: '/support', lien: 'Découvrir',
  },
];

export default function Accueil() {
  useTitrePage('Lekòl Pam', "Lekòl Pam — plateforme de gestion scolaire : inscriptions en ligne, notes, bulletins et documents officiels pour les familles, élèves et l'administration.");

  const [form, setForm] = useState({ nom: '', email: '', message: '' });
  const maj = (champ) => (e) => setForm({ ...form, [champ]: e.target.value });
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [envoye, setEnvoye] = useState(false);
  const [erreur, setErreur] = useState('');

  const envoyer = async (e) => {
    e.preventDefault();
    setErreur('');
    setEnvoiEnCours(true);
    try {
      await contactApi.envoyer({ nom: form.nom, courriel: form.email, message: form.message });
      setEnvoye(true);
      setForm({ nom: '', email: '', message: '' });
    } catch (err) {
      setErreur(err.message);
    } finally {
      setEnvoiEnCours(false);
    }
  };

  return (
    <div className="accueil">
      {/* 1. Bannière (hero) */}
      <section className="acc-hero">
        <div className="acc-hero-inner">
          <h1 className="acc-hero-titre">Bienvenue à <span>Lekòl Pam</span></h1>
          <p className="acc-hero-sous">
            La plateforme qui rapproche l'école et les familles : inscriptions en ligne,
            notes et bulletins, paiements — simple, sécurisé et accessible partout.
          </p>
          <div className="acc-hero-actions">
            <Link to="/login" className="acc-btn acc-btn-or">Se connecter</Link>
            <Link to="/register" className="acc-btn acc-btn-ghost">Créer un compte</Link>
          </div>
        </div>
      </section>

      {/* 2. Trois avantages */}
      <section className="acc-avantages">
        {AVANTAGES.map(({ Icone, titre, texte, to, lien }) => (
          <article key={titre} className="acc-carte">
            <span className="acc-carte-ico"><Icone /></span>
            <h3>{titre}</h3>
            <p>{texte}</p>
            <Link to={to} className="acc-lien-or">{lien} <span aria-hidden="true">→</span></Link>
          </article>
        ))}
      </section>

      {/* 3. Académie (fond alterné) */}
      <section className="acc-bande acc-bande-alt">
        <div className="acc-split">
          <div>
            <h2 className="acc-titre-souligne">Notre académie</h2>
            <p>
              Du préscolaire au secondaire, nous accompagnons chaque élève à toutes les étapes
              de son parcours, avec des enseignants engagés et un suivi personnalisé.
            </p>
            <Link to="/academie/primaire" className="acc-btn acc-btn-nav">Découvrir l'académie</Link>
          </div>
          <ul className="acc-chips">
            <li>Préscolaire</li>
            <li>Primaire</li>
            <li>Secondaire</li>
          </ul>
        </div>
      </section>

      {/* 3b. Suivi en ligne (fond blanc) */}
      <section className="acc-bande acc-bande-blanc">
        <div className="acc-split acc-split-inverse">
          <ul className="acc-check">
            <li>Notes &amp; bulletins par trimestre</li>
            <li>Paiements et reçus en ligne</li>
            <li>Badge élève &amp; documents officiels</li>
          </ul>
          <div>
            <h2 className="acc-titre-souligne">Un suivi en ligne complet</h2>
            <p>
              Tout ce qui concerne la scolarité de votre enfant, réuni dans un espace unique,
              sécurisé et accessible depuis votre téléphone comme votre ordinateur.
            </p>
            <Link to="/a-propos" className="acc-btn acc-btn-nav">En savoir plus</Link>
          </div>
        </div>
      </section>

      {/* 4. Contact */}
      <section className="acc-bande acc-contact">
        <h2 className="acc-titre-souligne acc-souligne-centre">Restons en contact</h2>
        {envoye ? (
          <p className="acc-note" style={{ textAlign: 'center', fontWeight: 700 }}>
            Message envoyé — merci ! Nous vous répondrons par courriel.
          </p>
        ) : (
        <form className="acc-form" onSubmit={envoyer}>
          {erreur && <p className="acc-note" style={{ color: 'var(--erreur)' }}>{erreur}</p>}
          <div className="acc-form-rangee">
            <div>
              <label htmlFor="acc-nom">Nom</label>
              <input id="acc-nom" value={form.nom} onChange={maj('nom')} required placeholder="Votre nom" />
            </div>
            <div>
              <label htmlFor="acc-email">Courriel</label>
              <input id="acc-email" type="email" value={form.email} onChange={maj('email')} required placeholder="vous@exemple.com" />
            </div>
          </div>
          <div>
            <label htmlFor="acc-message">Message</label>
            <textarea id="acc-message" rows={4} value={form.message} onChange={maj('message')} required placeholder="Comment pouvons-nous vous aider ?" />
          </div>
          <div className="acc-form-actions">
            <button type="submit" className="acc-btn acc-btn-or" disabled={envoiEnCours}>
              {envoiEnCours ? 'Envoi…' : 'Envoyer'}
            </button>
            <span className="acc-note">Nous répondons en moins de 24 h.</span>
          </div>
        </form>
        )}
      </section>
    </div>
  );
}
