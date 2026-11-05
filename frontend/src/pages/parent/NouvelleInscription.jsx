import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { inscriptionsApi } from '../../services/api.js';
import { anneeScolaireCourante, NIVEAUX_GROUPES, montantFr } from '../../utils/libelles.js';
import { useAuth } from '../../context/AuthContext.jsx';
import Carte from '../../components/Carte.jsx';
import Champ from '../../components/Champ.jsx';
import Bouton from '../../components/Bouton.jsx';
import Alerte from '../../components/Alerte.jsx';

// Liste de professions proposées (≈ 60) + option « Autre » pour saisie libre.
const PROFESSIONS = [
  'Agent de sécurité', 'Agriculteur / Agricultrice', 'Architecte', 'Artisan(e)',
  'Assistant(e) social(e)', 'Avocat(e)', 'Banquier / Banquière', 'Boulanger / Boulangère',
  'Chauffeur', "Chef d'entreprise", 'Coiffeur / Coiffeuse', 'Commerçant(e)', 'Comptable',
  'Cordonnier / Cordonnière', 'Couturier / Couturière', 'Cuisinier / Cuisinière', 'Dentiste',
  'Développeur / Informaticien(ne)', 'Directeur / Directrice', 'Douanier / Douanière',
  'Économiste', 'Électricien(ne)', 'Employé(e) de bureau', 'Enseignant(e) / Professeur(e)',
  'Entrepreneur(e)', 'Épicier / Épicière', 'Étudiant(e)', 'Fermier / Fermière', 'Fonctionnaire',
  'Gestionnaire', 'Infirmier / Infirmière', 'Ingénieur(e)', 'Journaliste', 'Juge', 'Juriste',
  'Maçon', 'Mécanicien(ne)', 'Médecin', 'Menuisier', 'Militaire', 'Musicien(ne)', 'Notaire',
  'Ouvrier / Ouvrière', 'Pasteur / Prêtre / Religieux(se)', 'Pâtissier / Pâtissière', 'Pêcheur',
  'Peintre', 'Pharmacien(ne)', 'Photographe', 'Plombier', 'Policier / Policière', 'Pompier',
  'Restaurateur / Restauratrice', 'Sage-femme', 'Secrétaire', 'Serveur / Serveuse', 'Soudeur',
  'Tailleur / Tailleuse', 'Technicien(ne)', 'Traducteur / Traductrice',
  'Travailleur / Travailleuse social(e)', 'Vendeur / Vendeuse', 'Vétérinaire',
  'Au foyer / Ménagère', 'Sans emploi', 'Retraité(e)',
];

// Âge minimum 2 ans : la date de naissance la plus récente autorisée est
// aujourd'hui moins 2 ans ; la plus ancienne, moins 40 ans (plausibilité).
const ilYaAnnees = (n) => { const d = new Date(); d.setFullYear(d.getFullYear() - n); return d.toISOString().slice(0, 10); };
const dateMaxNaissance = ilYaAnnees(2);
const dateMinNaissance = ilYaAnnees(40);

export default function NouvelleInscription() {
  const navigate = useNavigate();
  const { utilisateur } = useAuth();
  // Compte créé par un élève lui-même : on adapte les libellés « parent » et le
  // préremplissage. Pour un compte élève, le nom/prénom de l'élève reprend celui
  // du compte (« Prénom Nom ») ; les champs « responsable » restent vides (c'est
  // l'élève qui renseigne son parent/tuteur).
  const estCompteEleve = !!utilisateur?.compteEleve;
  const nomCompte = (utilisateur?.nom || '').trim();
  const espaceNom = nomCompte.indexOf(' ');
  const prenomInit = estCompteEleve ? (espaceNom === -1 ? nomCompte : nomCompte.slice(0, espaceNom)) : '';
  const nomInit = estCompteEleve ? (espaceNom === -1 ? '' : nomCompte.slice(espaceNom + 1)) : '';
  const [form, setForm] = useState({
    eleveNom: nomInit, elevePrenom: prenomInit, sexe: '', dateNaissance: '', niveau: '', anneeScolaire: anneeScolaireCourante(),
    nomParent: estCompteEleve ? '' : nomCompte,
    professionParent: '', telephoneParent: '',
    courrielParent: estCompteEleve ? '' : (utilisateur?.courriel || ''),
    ancienneEcole: '', ancienneClasse: '', raisonChoix: '',
  });
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [tarif, setTarif] = useState(null);
  // Le paiement à l'inscription peut être désactivé par le propriétaire.
  const [paiementRequis, setPaiementRequis] = useState(true);
  // Choix du menu profession ('' | une profession de la liste | 'Autre')
  const [professionChoix, setProfessionChoix] = useState('');
  const envoiEnCours = useRef(false); // double-clic : bloqué avant même le re-rendu

  useEffect(() => {
    inscriptionsApi.config()
      .then((c) => { setPaiementRequis(c.paiementRequis); setTarif(c.tarif); })
      .catch(() => {});
  }, []);

  // Élève qui vient de créer son compte : préremplit nom/prénom de l'élève
  // avec ce qu'il a saisi à l'inscription du compte (voir Register.jsx).
  useEffect(() => {
    try {
      const brut = sessionStorage.getItem('eleve_auto');
      if (brut) {
        const { nom, prenom } = JSON.parse(brut);
        setForm((f) => ({ ...f, eleveNom: nom || f.eleveNom, elevePrenom: prenom || f.elevePrenom }));
        sessionStorage.removeItem('eleve_auto');
      }
    } catch { /* stockage indisponible : pas de préremplissage */ }
  }, []);

  const maj = (champ) => (e) => setForm({ ...form, [champ]: e.target.value });

  // Profession : menu déroulant ; « Autre » ouvre un champ de saisie libre.
  const choisirProfession = (e) => {
    const v = e.target.value;
    setProfessionChoix(v);
    setForm({ ...form, professionParent: v === 'Autre' ? '' : v });
  };

  const soumettre = async (e) => {
    e.preventDefault();
    if (envoiEnCours.current) return;
    setErreur('');
    // Âge minimum 2 ans : une date de naissance postérieure à (aujourd'hui − 2 ans)
    // signifie un enfant de moins de 2 ans — refusé (le serveur revérifie aussi).
    if (form.dateNaissance && form.dateNaissance > dateMaxNaissance) {
      setErreur("L'élève doit avoir au moins 2 ans pour être inscrit(e).");
      return;
    }
    envoiEnCours.current = true;
    setEnCours(true);
    try {
      const d = await inscriptionsApi.creer(form);
      if (d.paiement) {
        // Paiement des frais immédiatement : sans lui, le dossier est annulé
        navigate(`/paiements/${d.paiement.id}`);
      } else {
        // Paiement désactivé : dossier transmis directement au secrétariat
        navigate(`/inscriptions/${d.inscription.id}`);
      }
    } catch (err) {
      setErreur(err.message);
    } finally {
      envoiEnCours.current = false;
      setEnCours(false);
    }
  };

  return (
    <div style={{ maxWidth: 560 }}>
      <div className="page-entete">
        <div className="rangee" style={{ gap: '.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <h1 style={{ margin: 0 }}>Nouvelle inscription</h1>
          {estCompteEleve && <span className="insc-badge insc-badge-ble">Espace élève</span>}
        </div>
        <p>Renseignez les informations de l'élève. Vous pourrez ensuite téléverser les documents.</p>
      </div>

      <Carte>
        <form onSubmit={soumettre}>
          <Alerte type="erreur">{erreur}</Alerte>

          <h3 style={{ fontSize: '1rem', marginBottom: '.75rem' }}>Informations sur l'élève</h3>
          {estCompteEleve && (
            <p className="texte-gris" style={{ fontSize: '.82rem', marginTop: '-.4rem' }}>
              Votre nom et prénom sont repris de votre compte et ne peuvent pas être modifiés ici,
              pour rester cohérents avec votre connexion.
            </p>
          )}
          <div className="rangee" style={{ gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <Champ label="Nom de famille" value={form.eleveNom} onChange={maj('eleveNom')}
              required readOnly={estCompteEleve} />
            <Champ label="Prénom" value={form.elevePrenom} onChange={maj('elevePrenom')}
              required readOnly={estCompteEleve} />
            <Champ label="Sexe" id="insc-sexe" enfant={
              <select id="insc-sexe" value={form.sexe} onChange={maj('sexe')} required>
                <option value="">— Choisir —</option>
                <option value="F">Féminin</option>
                <option value="M">Masculin</option>
              </select>
            } />
          </div>
          <Champ label="Date de naissance" type="date" value={form.dateNaissance}
            onChange={maj('dateNaissance')} max={dateMaxNaissance} min={dateMinNaissance} required />
          <Champ label="Niveau scolaire visé" id="insc-niveau" enfant={
            <select id="insc-niveau" value={form.niveau} onChange={maj('niveau')} required>
              <option value="">— Choisir —</option>
              {NIVEAUX_GROUPES.map((g) => (
                <optgroup key={g.groupe} label={g.groupe}>
                  {g.niveaux.map((n) => <option key={n} value={n}>{n}</option>)}
                </optgroup>
              ))}
            </select>
          } />
          <Champ label="Année scolaire" value={form.anneeScolaire} disabled readOnly />
          <p className="texte-gris" style={{ fontSize: '.82rem', marginTop: '-.4rem' }}>
            Toujours l'année scolaire en cours — déterminée automatiquement.
          </p>

          <h3 style={{ fontSize: '1rem', margin: '1.5rem 0 .75rem' }}>
            {estCompteEleve ? 'Informations du responsable (parent / tuteur)' : 'Informations sur le parent / tuteur'}
          </h3>
          <Champ label={estCompteEleve ? 'Nom complet du responsable' : 'Nom complet du parent'} value={form.nomParent}
            onChange={maj('nomParent')} />
          <Champ label={estCompteEleve ? 'Profession du responsable' : 'Profession du parent'} id="insc-profession" enfant={
            <select id="insc-profession" value={professionChoix} onChange={choisirProfession}>
              <option value="">— Choisir —</option>
              {PROFESSIONS.map((p) => <option key={p} value={p}>{p}</option>)}
              <option value="Autre">Autre (préciser)…</option>
            </select>
          } />
          {professionChoix === 'Autre' && (
            <Champ label="Précisez la profession" value={form.professionParent}
              onChange={maj('professionParent')} placeholder="Votre profession" autoFocus />
          )}
          <Champ label={estCompteEleve ? 'Téléphone du responsable' : 'Téléphone du parent'} type="tel" value={form.telephoneParent}
            onChange={maj('telephoneParent')} placeholder="ex. +509 ..." required />
          <Champ label={estCompteEleve ? 'Courriel du responsable' : 'Courriel du parent'} type="email" value={form.courrielParent}
            onChange={maj('courrielParent')} placeholder="ex. parent@exemple.com" required />
          <p className="texte-gris" style={{ fontSize: '.82rem', marginTop: '-.4rem' }}>
            Les notifications de résultats (à chaque trimestre) seront envoyées à cette adresse.
          </p>

          {paiementRequis ? (
            <Alerte type="info">
              Les frais d'inscription{tarif ? ` (${montantFr(tarif.montant, tarif.devise)})` : ''} se paient
              en ligne juste après (MonCash, NatCash, KashPay ou carte Visa/Mastercard). Le dossier n'est
              transmis au secrétariat qu'une fois le paiement confirmé ; s'il n'est pas payé dans les
              2 minutes, il est annulé.
            </Alerte>
          ) : (
            <Alerte type="info">
              L'inscription est gratuite : votre dossier sera transmis directement au secrétariat, qui
              vous informera de sa décision.
            </Alerte>
          )}

          <div className="rangee" style={{ marginTop: '.5rem' }}>
            <Bouton type="submit" enCours={enCours}>{paiementRequis ? 'Créer le dossier et payer' : 'Créer le dossier'}</Bouton>
            <Link to="/inscriptions"><Bouton variante="fantome" type="button">Annuler</Bouton></Link>
          </div>
        </form>
      </Carte>
    </div>
  );
}
