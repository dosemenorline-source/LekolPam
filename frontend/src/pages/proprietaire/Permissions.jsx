import { useState, useEffect } from 'react';
import { permissionsApi } from '../../services/api.js';
import { dateHeureFr } from '../../utils/libelles.js';
import Carte from '../../components/Carte.jsx';
import Bouton from '../../components/Bouton.jsx';
import Alerte from '../../components/Alerte.jsx';
import Chargement from '../../components/Chargement.jsx';

const DESCRIPTION = {
  matieres_gestion: "Direction ne peut plus créer, modifier ni supprimer de matière ou coefficient tant que c'est désactivé (la consultation reste possible).",
  notes_saisie: "Le secrétariat ne peut plus saisir, modifier, supprimer ni valider de notes tant que c'est désactivé.",
  notes_publication: "Direction ne peut plus publier ni retirer de bulletins tant que c'est désactivé.",
  paiement_inscription: "Autorisé : les frais d'inscription doivent être payés en ligne (MonCash, NatCash, carte…) avant que le dossier n'arrive au secrétariat. Désactivé : les familles peuvent s'inscrire sans payer, le dossier est transmis directement au secrétariat.",
  inscription_eleve: "Désactivé par défaut. Autorisé : un élève peut créer lui-même son compte et s'inscrire (même parcours que les parents : il gère ensuite son inscription, ses notes et ses paiements). Désactivé : seuls les parents peuvent créer un compte et inscrire.",
  inscription_parent: "Désactivé par défaut. Autorisé : les parents peuvent créer eux-mêmes un compte (page « Créer un compte parent »). Désactivé : la page d'inscription est fermée et personne ne peut créer de compte parent — c'est à l'établissement de donner l'accès.",
};

export default function Permissions() {
  const [permissions, setPermissions] = useState(null);
  const [erreur, setErreur] = useState('');
  const [enCours, setEnCours] = useState(null);

  const charger = () => permissionsApi.lister().then((d) => setPermissions(d.permissions)).catch((e) => setErreur(e.message));
  useEffect(() => { charger(); }, []);

  const basculer = async (p) => {
    setErreur('');
    setEnCours(p.cle);
    try {
      await permissionsApi.basculer(p.cle, !p.autorise);
      await charger();
    } catch (e) {
      setErreur(e.message);
    } finally {
      setEnCours(null);
    }
  };

  if (erreur && !permissions) {
    return (
      <div style={{ maxWidth: 720 }}>
        <div className="page-entete"><h1>Contrôle d'accès</h1></div>
        <Alerte type="erreur">{erreur}</Alerte>
        <Bouton type="button" onClick={charger}>Réessayer</Bouton>
      </div>
    );
  }
  if (!permissions) return <Chargement />;

  return (
    <div style={{ maxWidth: 720 }}>
      <div className="page-entete">
        <h1>Contrôle d'accès</h1>
        <p>Autorisez ou révoquez, pour direction et le secrétariat, les fonctions les plus sensibles du site.</p>
      </div>

      <Alerte type="erreur">{erreur}</Alerte>

      <Carte>
        {permissions.map((p, i) => (
          <div key={p.cle} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1.5rem',
            padding: '1rem 0', borderTop: i === 0 ? 'none' : '1px solid var(--s-bord)',
          }}>
            <div>
              <p style={{ margin: 0, fontWeight: 700, color: 'var(--s-txt)' }}>{p.libelle}</p>
              <p className="texte-gris" style={{ margin: '.25rem 0 0', fontSize: '.85rem', maxWidth: 460 }}>
                {DESCRIPTION[p.cle]}
              </p>
              {p.modifieLe && (
                <p className="texte-gris" style={{ margin: '.25rem 0 0', fontSize: '.78rem' }}>
                  Dernière modification : {dateHeureFr(p.modifieLe)}
                </p>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem', flexShrink: 0 }}>
              <span className={`tdb-badge ${p.autorise ? 'tdb-badge-vert' : 'tdb-badge-rouge'}`}>
                {p.autorise ? 'Autorisé' : 'Désactivé'}
              </span>
              <label className="eco-switch" title={p.autorise ? 'Désactiver' : 'Autoriser'}>
                <input type="checkbox" checked={p.autorise}
                  disabled={enCours === p.cle} onChange={() => basculer(p)} />
                <span className="eco-slider" />
              </label>
            </div>
          </div>
        ))}
      </Carte>

      <footer className="insc-pied">© {new Date().getFullYear()} Lekòl Pam. Tous droits réservés.</footer>
    </div>
  );
}
