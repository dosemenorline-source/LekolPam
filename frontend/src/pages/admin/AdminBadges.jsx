import { useEffect, useMemo, useRef, useState } from 'react';
import { adminApi, urlPhotoEleveAdmin, urlLogoEcole } from '../../services/api.js';
import CarteBadge from '../../components/CarteBadge.jsx';
import Alerte from '../../components/Alerte.jsx';
import Chargement from '../../components/Chargement.jsx';
import Icone from '../../components/Icone.jsx';

export default function AdminBadges() {
  const [tous, setTous] = useState(null);   // null = chargement
  const [recherche, setRecherche] = useState('');
  const [selectionId, setSelectionId] = useState(null);
  const [badge, setBadge] = useState(null);
  const [version, setVersion] = useState(0);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState('');
  const [modif, setModif] = useState(null);   // surcharges saisies pour le badge
  const [modEnCours, setModEnCours] = useState(false);
  const [ecoleForm, setEcoleForm] = useState(null); // en-tête école (commun à tous les badges)
  const [ecoleEnCours, setEcoleEnCours] = useState(false);
  const [msg, setMsg] = useState('');
  const fichierRef = useRef(null);

  useEffect(() => {
    adminApi.elevesCodes('')
      .then((d) => setTous(d.eleves))
      .catch((e) => setErreur(e.message));
  }, []);

  // Statistiques (photo)
  const stats = useMemo(() => {
    const base = tous || [];
    const avec = base.filter((e) => e.a_photo).length;
    return { total: base.length, avec, sans: base.length - avec };
  }, [tous]);

  // Filtrage en direct
  const filtres = useMemo(() => {
    if (!tous) return [];
    const q = recherche.trim().toLowerCase();
    if (!q) return tous;
    return tous.filter((e) =>
      `${e.nom || ''} ${e.niveau || ''} ${e.code_acces || ''}`.toLowerCase().includes(q));
  }, [tous, recherche]);

  const voirBadge = async (el) => {
    setErreur(''); setMsg(''); setSelectionId(el.id);
    try {
      const d = await adminApi.badgeEleve(el.id);
      setBadge(d.badge);
      setModif(d.badge.modif);
      setEcoleForm({
        nom: d.badge.ecoleNom || '',
        adresse: d.badge.ecoleAdresse || '',
        telephone: d.badge.ecoleTelephone || '',
        courriel: d.badge.ecoleCourriel || '',
      });
      setVersion((v) => v + 1);
    } catch (e) {
      setErreur(e.message);
    }
  };

  const majModif = (champ) => (e) => setModif((m) => ({ ...m, [champ]: e.target.value }));

  const enregistrerModif = async () => {
    if (!badge) return;
    setErreur(''); setMsg(''); setModEnCours(true);
    try {
      const d = await adminApi.majInfosBadge(badge.id, modif);
      setBadge(d.badge);
      setModif(d.badge.modif);
      setVersion((v) => v + 1);
      setMsg('Badge mis à jour.');
    } catch (err) { setErreur(err.message); }
    finally { setModEnCours(false); }
  };

  const majEcole = (champ) => (e) => setEcoleForm((f) => ({ ...f, [champ]: e.target.value }));

  const enregistrerEcole = async () => {
    if (!ecoleForm) return;
    setErreur(''); setMsg('');
    if (!ecoleForm.nom.trim()) { setErreur("Le nom de l'école est requis."); return; }
    setEcoleEnCours(true);
    try {
      const d = await adminApi.majEnteteEcole(ecoleForm);
      setEcoleForm({ nom: d.nom, adresse: d.adresse || '', telephone: d.telephone || '', courriel: d.courriel || '' });
      // Rafraîchit l'en-tête de la carte affichée
      setBadge((b) => (b ? { ...b, ecoleNom: d.nom, ecoleAdresse: d.adresse, ecoleTelephone: d.telephone, ecoleCourriel: d.courriel } : b));
      setMsg("Informations de l'école enregistrées (tous les badges).");
    } catch (err) { setErreur(err.message); }
    finally { setEcoleEnCours(false); }
  };

  const envoyerPhoto = async (e) => {
    const fichier = e.target.files?.[0];
    if (!fichier || !badge) return;
    setErreur(''); setEnCours(true);
    try {
      await adminApi.televerserPhotoEleve(badge.id, fichier);
      setVersion((v) => v + 1);
      setBadge((b) => ({ ...b, aPhoto: true }));
      setTous((prev) => prev.map((el) => (el.id === badge.id ? { ...el, a_photo: 1 } : el)));
    } catch (err) {
      setErreur(err.message);
    } finally {
      setEnCours(false);
      if (fichierRef.current) fichierRef.current.value = '';
    }
  };

  const reinitialiser = () => setRecherche('');

  return (
    <div className="insc-page badges-page">
      <div className="page-entete no-print">
        <h1>Badges élèves</h1>
        <p>Recherchez un élève, ajoutez sa photo si besoin, puis imprimez son badge.</p>
      </div>

      {/* Résumé */}
      <div className="insc-resume no-print">
        <span className="insc-stat"><strong>{stats.total}</strong> Total</span>
        <span className="insc-stat insc-stat-vert"><strong>{stats.avec}</strong> Avec photo</span>
        <span className="insc-stat insc-stat-rouge"><strong>{stats.sans}</strong> Sans photo</span>
      </div>

      {erreur && <Alerte type="erreur">{erreur}</Alerte>}

      <div className="badges-layout">
        {/* Colonne gauche : recherche + liste */}
        <div className="badges-col-liste no-print">
          <div className="insc-barre" style={{ marginBottom: 0 }}>
            <div className="insc-recherche">
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M15.5 14h-.79l-.28-.27a6.5 6.5 0 1 0-.7.7l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0A4.5 4.5 0 1 1 14 9.5 4.5 4.5 0 0 1 9.5 14z" />
              </svg>
              <input value={recherche} onChange={(e) => setRecherche(e.target.value)}
                placeholder="Rechercher (nom, niveau, code)…" aria-label="Rechercher" />
            </div>
            <button type="button" className="insc-btn-reinit" onClick={reinitialiser} disabled={!recherche}>
              Réinitialiser
            </button>
          </div>

          {!tous ? (
            <Chargement texte="Chargement des élèves…" />
          ) : filtres.length === 0 ? (
            <div className="insc-vide">
              <div className="insc-vide-ico" aria-hidden="true"><Icone nom="inbox" size={44} /></div>
              <p>Aucun élève trouvé.</p>
              {recherche && <button type="button" className="insc-btn-reinit" onClick={reinitialiser}>Réinitialiser la recherche</button>}
            </div>
          ) : (
            <div className="badges-liste">
              {filtres.map((el) => (
                <button key={el.id} type="button"
                  className={`badges-item ${selectionId === el.id ? 'actif' : ''}`}
                  onClick={() => voirBadge(el)}>
                  <span className="badges-item-info">
                    <span className="badges-item-nom">{el.nom}</span>
                    <span className="badges-item-niv">{el.niveau || '—'}</span>
                  </span>
                  <span className={`badges-dot ${el.a_photo ? 'ok' : 'non'}`}
                    title={el.a_photo ? 'Avec photo' : 'Sans photo'} aria-hidden="true" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Colonne droite : badge à imprimer */}
        <div>
          {badge ? (
            <div className="badges-apercu">
              <CarteBadge badge={badge}
                photoSrc={badge.aPhoto ? `${urlPhotoEleveAdmin(badge.id)}?v=${version}` : null}
                logoSrc={`${urlLogoEcole()}?v=${version}`} />
              <div className="badges-actions no-print">
                {msg && <Alerte type="info">{msg}</Alerte>}

                {/* En-tête du badge : informations de l'école (communes à tous les badges) */}
                {ecoleForm && (
                  <div className="badges-modif">
                    <div className="badges-modif-titre"><Icone nom="school" /> En-tête du badge — école</div>
                    <p className="badges-modif-note">Ces informations apparaissent en haut du badge et s'appliquent à <strong>tous les badges</strong>.</p>
                    <div className="badges-modif-grille">
                      <label className="badges-modif-champ">
                        <span>Nom de l'école</span>
                        <input value={ecoleForm.nom} onChange={majEcole('nom')} placeholder="ex. FDSE" />
                      </label>
                      <label className="badges-modif-champ">
                        <span>Adresse</span>
                        <input value={ecoleForm.adresse} onChange={majEcole('adresse')} placeholder="ex. Delmas 33, Port-au-Prince" />
                      </label>
                      <label className="badges-modif-champ">
                        <span>Téléphone</span>
                        <input value={ecoleForm.telephone} onChange={majEcole('telephone')} placeholder="ex. +509 0000 0000" />
                      </label>
                      <label className="badges-modif-champ">
                        <span>Courriel</span>
                        <input value={ecoleForm.courriel} onChange={majEcole('courriel')} placeholder="ex. contact@lekol.ht" />
                      </label>
                    </div>
                    <button type="button" className="mat-modifier badges-modif-btn" onClick={enregistrerEcole} disabled={ecoleEnCours}>
                      {ecoleEnCours ? 'Enregistrement…' : "Enregistrer l'en-tête"}
                    </button>
                    <p className="badges-modif-note" style={{ marginTop: '.5rem', marginBottom: 0 }}>
                      Le logo se gère dans « Coordonnées de l'école » (espace direction).
                    </p>
                  </div>
                )}

                {/* Modification du badge (surcharge — n'affecte pas la fiche élève) */}
                {modif && (
                  <div className="badges-modif">
                    <div className="badges-modif-titre"><Icone nom="edit" /> Modifier le badge</div>
                    <p className="badges-modif-note">Laissez un champ vide pour utiliser la valeur automatique. Ces valeurs ne concernent que le badge.</p>
                    <div className="badges-modif-grille">
                      <label className="badges-modif-champ">
                        <span>Nom</span>
                        <input value={modif.badgeNom} onChange={majModif('badgeNom')} placeholder={badge.auto?.nom || '—'} />
                      </label>
                      <label className="badges-modif-champ">
                        <span>Prénom</span>
                        <input value={modif.badgePrenom} onChange={majModif('badgePrenom')} placeholder={badge.auto?.prenom || '—'} />
                      </label>
                      <label className="badges-modif-champ">
                        <span>Classe</span>
                        <input value={modif.badgeClasse} onChange={majModif('badgeClasse')} placeholder={badge.auto?.niveau || '—'} />
                      </label>
                      <label className="badges-modif-champ">
                        <span>Année académique</span>
                        <input value={modif.badgeAnnee} onChange={majModif('badgeAnnee')} placeholder={badge.auto?.anneeScolaire || 'ex. 2025-2026'} />
                      </label>
                      <label className="badges-modif-champ">
                        <span>Date d'émission</span>
                        <input type="date" value={modif.badgeEmisLe} onChange={majModif('badgeEmisLe')} />
                      </label>
                      <label className="badges-modif-champ">
                        <span>Groupe sanguin</span>
                        <select value={modif.groupeSanguin} onChange={majModif('groupeSanguin')}>
                          <option value="">—</option>
                          {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((g) => <option key={g} value={g}>{g}</option>)}
                        </select>
                      </label>
                    </div>
                    <button type="button" className="mat-modifier badges-modif-btn" onClick={enregistrerModif} disabled={modEnCours}>
                      {modEnCours ? 'Enregistrement…' : 'Enregistrer les modifications'}
                    </button>
                  </div>
                )}

                <input ref={fichierRef} type="file" accept="image/png,image/jpeg" onChange={envoyerPhoto} hidden />
                <button type="button" className="badges-btn-photo" onClick={() => fichierRef.current?.click()} disabled={enCours}>
                  {enCours ? 'Envoi…' : (badge.aPhoto ? 'Changer la photo' : 'Ajouter la photo')}
                </button>
                <button type="button" className="badges-btn-imprimer" onClick={() => window.print()}>Imprimer</button>
                <p className="badges-hint">Photo JPG ou PNG, max 5 Mo.</p>
              </div>
            </div>
          ) : (
            <div className="insc-vide no-print">
              <div className="insc-vide-ico" aria-hidden="true"><Icone nom="badge" size={44} /></div>
              <p>Sélectionnez un élève pour afficher son badge.</p>
            </div>
          )}
        </div>
      </div>

      <footer className="insc-pied no-print">© {new Date().getFullYear()} Lekòl Pam. Tous droits réservés.</footer>
    </div>
  );
}
