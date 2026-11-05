import { useEffect, useState } from 'react';
import { directionApi, enseignantsApi } from '../../services/api.js';
import Alerte from '../../components/Alerte.jsx';
import Chargement from '../../components/Chargement.jsx';
import Icone from '../../components/Icone.jsx';

export default function Enseignants() {
  const [enseignants, setEnseignants] = useState([]);
  const [matieres, setMatieres] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');
  const [msg, setMsg] = useState('');

  const [form, setForm] = useState({ nom: '', prenom: '', courriel: '' });
  const [matieresChoisies, setMatieresChoisies] = useState([]);
  const [enCours, setEnCours] = useState(false);

  const [assignation, setAssignation] = useState({}); // { [idEnseignant]: idMatiere }

  const charger = () => {
    setChargement(true);
    Promise.all([enseignantsApi.lister(), directionApi.matieres()])
      .then(([e, m]) => { setEnseignants(e.enseignants); setMatieres(m.matieres); })
      .catch((err) => setErreur(err.message))
      .finally(() => setChargement(false));
  };
  useEffect(charger, []);

  const basculerMatiereChoisie = (idMatiere) => {
    setMatieresChoisies((liste) => (
      liste.includes(idMatiere) ? liste.filter((id) => id !== idMatiere) : [...liste, idMatiere]
    ));
  };

  const creerCompte = async (e) => {
    e.preventDefault();
    setErreur(''); setMsg('');
    if (!form.nom.trim() || !form.prenom.trim() || !form.courriel.trim()) {
      setErreur('Nom, prénom et courriel sont requis.');
      return;
    }
    setEnCours(true);
    try {
      const { message, enseignant } = await enseignantsApi.creer({
        nom: `${form.prenom.trim()} ${form.nom.trim()}`, courriel: form.courriel.trim(),
      });
      for (const idMatiere of matieresChoisies) {
        await enseignantsApi.assignerMatiere(enseignant.id, idMatiere);
      }
      setMsg(message);
      setForm({ nom: '', prenom: '', courriel: '' });
      setMatieresChoisies([]);
      charger();
    } catch (err) { setErreur(err.message); }
    finally { setEnCours(false); }
  };

  const basculerStatut = async (ens) => {
    setErreur('');
    try {
      await enseignantsApi.definirStatut(ens.id, ens.statut === 'actif' ? 'inactif' : 'actif');
      charger();
    } catch (err) { setErreur(err.message); }
  };

  const assigner = async (idEnseignant) => {
    const idMatiere = assignation[idEnseignant];
    if (!idMatiere) return;
    setErreur('');
    try {
      await enseignantsApi.assignerMatiere(idEnseignant, idMatiere);
      setAssignation({ ...assignation, [idEnseignant]: '' });
      charger();
    } catch (err) { setErreur(err.message); }
  };

  const retirer = async (idEnseignant, idMatiere) => {
    setErreur('');
    try {
      await enseignantsApi.retirerMatiere(idEnseignant, idMatiere);
      charger();
    } catch (err) { setErreur(err.message); }
  };

  if (chargement) return <div className="insc-page"><Chargement texte="Chargement des professeurs…" /></div>;

  return (
    <div className="insc-page matieres-page">
      <div className="page-entete">
        <h1>Professeurs</h1>
        <p>Créez un compte pour chaque professeur et assignez-lui les classes qu'il enseigne.
          Un lien lui sera envoyé par courriel pour qu'il choisisse lui-même son mot de passe.</p>
      </div>

      {erreur && <Alerte type="erreur">{erreur}</Alerte>}
      {msg && <Alerte type="info">{msg}</Alerte>}

      <div className="notes-section-titre">Nouveau compte professeur</div>
      <div className="carte">
        <form onSubmit={creerCompte} className="notes-form-grille">
          <div className="notes-champ">
            <label htmlFor="ens-prenom">Prénom</label>
            <input id="ens-prenom" value={form.prenom} onChange={(e) => setForm({ ...form, prenom: e.target.value })}
              placeholder="ex. Marie" />
          </div>
          <div className="notes-champ">
            <label htmlFor="ens-nom">Nom</label>
            <input id="ens-nom" value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })}
              placeholder="ex. Pierre" />
          </div>
          <div className="notes-champ" style={{ flex: '1 1 220px' }}>
            <label htmlFor="ens-courriel">Courriel</label>
            <input id="ens-courriel" type="email" value={form.courriel}
              onChange={(e) => setForm({ ...form, courriel: e.target.value })} placeholder="ex. prof@lekol.ht" />
          </div>

          <div className="notes-champ" style={{ flexBasis: '100%' }}>
            <label>Classes (matières) dont il/elle sera titulaire</label>
            {matieres.length === 0 ? (
              <p className="texte-gris" style={{ fontSize: '.85rem' }}>Aucune matière configurée pour le moment.</p>
            ) : (
              <div className="rangee" style={{ flexWrap: 'wrap', gap: '.5rem' }}>
                {matieres.map((m) => (
                  <label key={m.id} className="rangee" style={{
                    gap: '.35rem', border: '1px solid #E2E8F0', borderRadius: 8,
                    padding: '.35rem .6rem', fontSize: '.85rem', cursor: 'pointer',
                  }}>
                    <input type="checkbox" checked={matieresChoisies.includes(m.id)} onChange={() => basculerMatiereChoisie(m.id)} />
                    {m.nom} — {m.niveau}
                  </label>
                ))}
              </div>
            )}
            <p className="texte-gris" style={{ fontSize: '.8rem', marginTop: '.4rem' }}>
              Le compte n'aura accès qu'à ces classes — devoirs, documents et horaire.
            </p>
          </div>

          <button type="submit" className="eco-batch-btn eco-batch-ok" disabled={enCours}>
            {enCours ? 'Création…' : 'Créer le compte'}
          </button>
        </form>
      </div>

      <div className="notes-section-titre">Professeurs ({enseignants.length})</div>
      {enseignants.length === 0 ? (
        <div className="insc-vide">
          <div className="insc-vide-ico" aria-hidden="true"><Icone nom="inbox" size={44} /></div>
          <p>Aucun compte professeur pour le moment.</p>
        </div>
      ) : (
        <div className="pile-md">
          {enseignants.map((ens) => (
            <div key={ens.id} className="carte">
              <div className="rangee entre" style={{ flexWrap: 'wrap', gap: '.5rem' }}>
                <div>
                  <strong>{ens.nom}</strong>
                  <p className="texte-gris" style={{ fontSize: '.85rem', margin: 0 }}>{ens.courriel}</p>
                </div>
                <div className="rangee" style={{ gap: '.5rem' }}>
                  <span className={`insc-badge ${ens.statut === 'actif' ? 'insc-badge-vert' : 'insc-badge-rouge'}`}>
                    {ens.statut === 'actif' ? 'Actif' : 'Inactif'}
                  </span>
                  <button type="button" className="insc-btn-reinit" onClick={() => basculerStatut(ens)}>
                    {ens.statut === 'actif' ? 'Désactiver' : 'Réactiver'}
                  </button>
                </div>
              </div>

              <p style={{ fontWeight: 600, fontSize: '.85rem', margin: '.9rem 0 .4rem' }}>Classes assignées</p>
              {ens.matieres.length === 0 ? (
                <p className="texte-gris" style={{ fontSize: '.85rem' }}>Aucune classe assignée.</p>
              ) : (
                <div className="rangee" style={{ flexWrap: 'wrap', gap: '.5rem', marginBottom: '.75rem' }}>
                  {ens.matieres.map((m) => (
                    <span key={m.id} className="insc-badge insc-badge-gris" style={{ display: 'inline-flex', gap: '.4rem', alignItems: 'center' }}>
                      {m.nom} — {m.niveau}
                      <button type="button" onClick={() => retirer(ens.id, m.id)} aria-label={`Retirer ${m.nom} (${m.niveau})`}
                        style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'inherit', fontWeight: 700 }}>×</button>
                    </span>
                  ))}
                </div>
              )}

              <div className="rangee" style={{ gap: '.5rem' }}>
                <select value={assignation[ens.id] || ''} onChange={(e) => setAssignation({ ...assignation, [ens.id]: e.target.value })}
                  aria-label={`Assigner une classe à ${ens.nom}`} style={{ flex: '1 1 240px' }}>
                  <option value="">— Choisir une classe —</option>
                  {matieres.filter((m) => !ens.matieres.some((em) => em.id === m.id)).map((m) => (
                    <option key={m.id} value={m.id}>{m.nom} — {m.niveau}</option>
                  ))}
                </select>
                <button type="button" className="mat-modifier" onClick={() => assigner(ens.id)} disabled={!assignation[ens.id]}>
                  Assigner
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <footer className="insc-pied">© {new Date().getFullYear()} Lekòl Pam. Tous droits réservés.</footer>
    </div>
  );
}
