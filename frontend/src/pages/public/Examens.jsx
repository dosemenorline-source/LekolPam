import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { examensApi, urlPhotoExamen } from '../../services/api.js';
import { dateFr } from '../../utils/libelles.js';
import Alerte from '../../components/Alerte.jsx';
import Icone from '../../components/Icone.jsx';
import useTitrePage from '../../hooks/useTitrePage.js';

export default function Examens() {
  useTitrePage('Examens passés', "Consultez les feuilles d'examens passés par niveau à Lekòl Pam.");

  const [examens, setExamens] = useState(null); // null = chargement
  const [erreur, setErreur] = useState('');
  const [filtre, setFiltre] = useState('tous');
  const [apercu, setApercu] = useState(null); // examen affiché en grand

  // Assistant IA — aide un élève bloqué sur un exercice
  const [aideQ, setAideQ] = useState('');
  const [aideNiveau, setAideNiveau] = useState('');
  const [aideRep, setAideRep] = useState('');
  const [aideEnCours, setAideEnCours] = useState(false);
  const [aideErr, setAideErr] = useState('');

  const demanderAide = async () => {
    setAideErr(''); setAideRep('');
    if (!aideQ.trim()) { setAideErr("Écris l'exercice ou explique où tu es bloqué(e)."); return; }
    setAideEnCours(true);
    try {
      const d = await examensApi.aideIA({ question: aideQ.trim(), niveau: aideNiveau.trim() });
      setAideRep(d.reponse);
    } catch (err) { setAideErr(err.message); }
    finally { setAideEnCours(false); }
  };

  useEffect(() => {
    examensApi.lister()
      .then((d) => setExamens(d.examens))
      .catch((e) => setErreur(e.message));
  }, []);

  // Niveaux disponibles (pour le filtre)
  const niveaux = useMemo(() => {
    if (!examens) return [];
    return [...new Set(examens.map((e) => e.niveau))].sort((a, b) => a.localeCompare(b));
  }, [examens]);

  // Regroupe par niveau (après filtrage)
  const groupes = useMemo(() => {
    if (!examens) return [];
    const list = filtre === 'tous' ? examens : examens.filter((e) => e.niveau === filtre);
    const map = new Map();
    for (const e of list) {
      if (!map.has(e.niveau)) map.set(e.niveau, []);
      map.get(e.niveau).push(e);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [examens, filtre]);

  return (
    <div className="site-page examens-page">
      <header className="site-page-entete">
        <h1>Examens passés</h1>
        <p>Consultez les feuilles d'examen des années précédentes, classées par niveau.</p>
      </header>

      {erreur && <p className="texte-gris">{erreur}</p>}

      {/* Assistant IA — aide aux exercices */}
      <section className="examens-aide">
        <div className="examens-aide-titre"><Icone nom="comment" /> Bloqué sur un exercice ? Demande de l'aide</div>
        <p className="examens-aide-note">Écris l'exercice (ou explique où tu bloques). L'assistant t'explique la méthode étape par étape.</p>
        {aideErr && <Alerte type="erreur">{aideErr}</Alerte>}
        <textarea className="examens-aide-texte" rows={4} value={aideQ} onChange={(e) => setAideQ(e.target.value)}
          placeholder="Ex. Je ne comprends pas comment résoudre : 3x + 5 = 20…" />
        <div className="examens-aide-ligne">
          <input className="examens-aide-niveau" value={aideNiveau} onChange={(e) => setAideNiveau(e.target.value)}
            placeholder="Ta classe (optionnel) — ex. 9e AF" />
          <button type="button" className="examens-aide-btn" onClick={demanderAide} disabled={aideEnCours}>
            {aideEnCours ? 'Réflexion…' : 'Demander de l\'aide'}
          </button>
        </div>
        {aideRep && (
          <div className="examens-aide-reponse">
            <div className="examens-aide-reponse-titre"><Icone nom="comment" /> Explication</div>
            <p>{aideRep}</p>
          </div>
        )}
      </section>

      {examens && examens.length > 0 && (
        <div className="acad-filtre" style={{ marginBottom: '1.25rem' }}>
          <button type="button" className={`acad-filtre-btn ${filtre === 'tous' ? 'actif' : ''}`} onClick={() => setFiltre('tous')}>Tous</button>
          {niveaux.map((n) => (
            <button key={n} type="button" className={`acad-filtre-btn ${filtre === n ? 'actif' : ''}`} onClick={() => setFiltre(n)}>{n}</button>
          ))}
        </div>
      )}

      {examens === null ? (
        <div className="pile pile-md">
          <div className="ens-skeleton" style={{ height: 180 }} />
        </div>
      ) : examens.length === 0 ? (
        <div className="carte site-placeholder">
          <p className="texte-gris">Aucune feuille d'examen pour le moment. Revenez bientôt !</p>
        </div>
      ) : (
        groupes.map(([niveau, items]) => (
          <section key={niveau} className="examens-groupe">
            <div className="notes-section-titre"><Icone nom="file" /> {niveau}</div>
            <div className="examens-grille">
              {items.map((ex) => (
                <button key={ex.id} type="button" className="examens-carte" onClick={() => setApercu(ex)}>
                  <img src={urlPhotoExamen(ex.id)} alt={ex.titre || `Examen ${niveau}`} loading="lazy" />
                  <div className="examens-carte-info">
                    <span className="examens-carte-titre">{ex.titre || 'Feuille d\'examen'}</span>
                    <span className="examens-carte-date">{dateFr(ex.cree_le)}</span>
                  </div>
                </button>
              ))}
            </div>
          </section>
        ))
      )}

      <p className="apropos-admin-lien">
        <Link to="/examens/admin" className="texte-gris"><Icone nom="lock" /> Espace administrateur</Link>
      </p>

      {/* Aperçu en grand */}
      {apercu && (
        <div className="examens-lightbox" onClick={() => setApercu(null)}>
          <button type="button" className="examens-lightbox-fermer" aria-label="Fermer" onClick={() => setApercu(null)}>×</button>
          <figure onClick={(e) => e.stopPropagation()}>
            <img src={urlPhotoExamen(apercu.id)} alt={apercu.titre || 'Examen'} />
            <figcaption>{apercu.niveau}{apercu.titre ? ` — ${apercu.titre}` : ''}</figcaption>
          </figure>
        </div>
      )}
    </div>
  );
}
