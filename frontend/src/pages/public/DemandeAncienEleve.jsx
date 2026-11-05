import { useState } from 'react';
import PagePublique from './PagePublique.jsx';
import { demandeAncienApi } from '../../services/api.js';
import Carte from '../../components/Carte.jsx';
import Champ from '../../components/Champ.jsx';
import Bouton from '../../components/Bouton.jsx';
import Alerte from '../../components/Alerte.jsx';

const VIDE = {
  nom: '', prenom: '', dateNaissance: '', dernierNiveau: '',
  anneesFrequentees: '', courriel: '', telephone: '', message: '',
};

export default function DemandeAncienEleve() {
  const [form, setForm] = useState(VIDE);
  const [erreur, setErreur] = useState('');
  const [envoye, setEnvoye] = useState(false);
  const [enCours, setEnCours] = useState(false);

  const maj = (champ) => (e) => setForm({ ...form, [champ]: e.target.value });

  const soumettre = async (e) => {
    e.preventDefault();
    setErreur('');
    setEnCours(true);
    try {
      await demandeAncienApi.envoyer(form);
      setEnvoye(true);
    } catch (err) {
      setErreur(err.message);
    } finally {
      setEnCours(false);
    }
  };

  return (
    <PagePublique
      titre="Anciens élèves — accéder à mes résultats"
      intro="Vous avez fréquenté Lekòl Pam et souhaitez retrouver vos résultats et bulletins ? Faites votre demande ci-dessous — pas besoin de créer de compte. Le secrétariat vous enverra un code d'accès personnel par courriel."
    >
      <Carte style={{ maxWidth: 640 }}>
        {envoye ? (
          <Alerte type="info">
            Demande envoyée. Le secrétariat va vérifier votre dossier et vous enverra un code d'accès par courriel.
          </Alerte>
        ) : (
          <form onSubmit={soumettre}>
            {erreur && <Alerte type="erreur">{erreur}</Alerte>}
            <div className="notes-form-grille">
              <Champ label="Nom" value={form.nom} onChange={maj('nom')} required />
              <Champ label="Prénom" value={form.prenom} onChange={maj('prenom')} />
            </div>
            <div className="notes-form-grille">
              <Champ label="Date de naissance" type="date" value={form.dateNaissance} onChange={maj('dateNaissance')} max={new Date().toISOString().slice(0, 10)} />
              <Champ label="Dernière classe fréquentée" value={form.dernierNiveau}
                onChange={maj('dernierNiveau')} placeholder="Ex. : 9e année fondamentale" />
            </div>
            <Champ label="Années de fréquentation" value={form.anneesFrequentees}
              onChange={maj('anneesFrequentees')} placeholder="Ex. : 2015 à 2020" />
            <div className="notes-form-grille">
              <Champ label="Courriel" type="email" value={form.courriel} onChange={maj('courriel')} required
                placeholder="Pour recevoir votre code d'accès" />
              <Champ label="Téléphone" value={form.telephone} onChange={maj('telephone')} />
            </div>
            <Champ label="Message (optionnel)" enfant={
              <textarea rows={3} value={form.message} onChange={maj('message')}
                placeholder="Toute précision utile pour vous identifier…" />
            } />
            <Bouton type="submit" enCours={enCours}>Envoyer la demande</Bouton>
          </form>
        )}
      </Carte>
    </PagePublique>
  );
}
