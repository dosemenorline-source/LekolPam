import { useEffect, useState } from 'react';
import { eleveApi, marqueApi, urlDocumentOfficiel, urlPhotoEleve } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import Alerte from '../../components/Alerte.jsx';
import Icone from '../../components/Icone.jsx';

const LIBELLE_TRIM = {
  '1er_trimestre': '1er trimestre',
  '2e_trimestre': '2e trimestre',
  '3e_trimestre': '3e trimestre',
};
const dateFr = (s) => (s ? new Date(s).toLocaleDateString('fr-FR') : '');

// Regroupe les notes par (année, trimestre) + moyenne pondérée
function grouperNotes(notes) {
  const map = new Map();
  for (const n of notes) {
    const cle = `${n.annee_scolaire}||${n.periode}`;
    if (!map.has(cle)) map.set(cle, { annee: n.annee_scolaire, periode: n.periode, notes: [] });
    map.get(cle).notes.push(n);
  }
  return [...map.values()].map((g) => {
    let sp = 0, sc = 0;
    // Chaque note garde son barème d'origine (affiché tel quel) ; seule la
    // moyenne pondérée convertit en pourcentage pour combiner des matières
    // à barèmes différents en un seul chiffre comparable au seuil.
    g.notes.forEach((n) => {
      const c = Number(n.coefficient) || 1;
      const bareme = Number(n.bareme) || 100;
      sp += (Number(n.valeur) / bareme) * 100 * c;
      sc += c;
    });
    return { ...g, moyenne: sc ? Math.round((sp / sc) * 100) / 100 : 0 };
  });
}

// Bilan de fin d'année : moyenne générale annuelle (moyenne des trimestres),
// affichée uniquement quand le 3e trimestre est publié pour l'année.
function bilansAnnuels(groupes) {
  const parAnnee = new Map();
  for (const g of groupes) {
    if (!parAnnee.has(g.annee)) parAnnee.set(g.annee, []);
    parAnnee.get(g.annee).push(g);
  }
  const res = [];
  for (const [annee, gs] of parAnnee) {
    if (!gs.some((g) => g.periode === '3e_trimestre')) continue;
    const moyenne = Math.round((gs.reduce((s, g) => s + g.moyenne, 0) / gs.length) * 100) / 100;
    const trimestres = gs.slice().sort((a, b) => a.periode.localeCompare(b.periode));
    res.push({ annee, moyenne, trimestres });
  }
  return res;
}

export default function EspaceEleve() {
  const { utilisateur } = useAuth();
  const [notes, setNotes] = useState(null);
  const [bulletins, setBulletins] = useState([]);
  const [bloques, setBloques] = useState([]);
  const [telechargeId, setTelechargeId] = useState(null);
  const [aPhoto, setAPhoto] = useState(false);
  const [erreur, setErreur] = useState('');
  const [apprecs, setApprecs] = useState({});   // { cle: texte } — appréciations IA générées
  const [apprecEnCours, setApprecEnCours] = useState(null); // clé en cours
  const [apprecErreur, setApprecErreur] = useState({});     // { cle: message }
  const [seuil, setSeuil] = useState(50); // note de passage /100, définie par le secrétariat

  useEffect(() => {
    Promise.all([eleveApi.mesNotes(), eleveApi.mesBulletins(), eleveApi.badge()])
      .then(([n, b, bd]) => {
        setNotes(n.notes); setBloques(n.trimestresBloques || []); setBulletins(b.bulletins);
        setAPhoto(!!bd.badge?.aPhoto);
      })
      .catch((e) => setErreur(e.message));
    marqueApi.obtenir().then((m) => setSeuil(m.seuilReussite)).catch(() => {});
  }, []);

  const telecharger = async (id) => {
    setErreur(''); setTelechargeId(id);
    try {
      const res = await fetch(urlDocumentOfficiel(id), { credentials: 'include' });
      if (!res.ok) throw new Error('Téléchargement impossible.');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `bulletin-${id}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch (e) { setErreur(e.message); }
    finally { setTelechargeId(null); }
  };

  // Demande à l'IA une appréciation du trimestre (points forts, matières à améliorer, conseils).
  const genererAppreciation = async (g) => {
    const cle = `${g.annee}||${g.periode}`;
    setApprecEnCours(cle);
    setApprecErreur((e) => ({ ...e, [cle]: '' }));
    try {
      const d = await eleveApi.appreciationIA({ periode: g.periode, anneeScolaire: g.annee });
      setApprecs((a) => ({ ...a, [cle]: d.appreciation }));
    } catch (err) {
      setApprecErreur((e) => ({ ...e, [cle]: err.message }));
    } finally {
      setApprecEnCours(null);
    }
  };

  const groupes = notes ? grouperNotes(notes) : [];
  const bilans = bilansAnnuels(groupes);

  return (
    <div className="insc-page res-page">
      <section className="res-hero">
        <div className="res-hero-profil">
          {aPhoto ? (
            <img className="res-avatar" src={urlPhotoEleve()} alt="Photo de profil" />
          ) : (
            <div className="res-avatar res-avatar-vide" aria-hidden="true">
              {(utilisateur?.nom || '?').charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <h1><Icone nom="chart" /> Mes résultats</h1>
            <p>Bonjour {utilisateur?.nom}{utilisateur?.niveau ? ` — ${utilisateur.niveau}` : ''}. Consultez vos notes et bulletins.</p>
          </div>
        </div>
      </section>

      {erreur && <Alerte type="erreur">{erreur}</Alerte>}

      {/* Alerte économat (trimestres bloqués) */}
      {bloques.length > 0 && (
        <div className="res-alerte">
          <span className="res-alerte-ico" aria-hidden="true"><Icone nom="warning" /></span>
          <span>
            Résultats indisponibles pour : {bloques.map((b) => `${LIBELLE_TRIM[b.trimestre] || b.trimestre} (${b.annee_scolaire})`).join(', ')}.
            Veuillez régulariser votre situation auprès de l'économat.
          </span>
        </div>
      )}

      {!notes ? (
        <div className="pile pile-md">
          <div className="ens-skeleton" />
          <div className="ens-skeleton" style={{ height: 140 }} />
        </div>
      ) : (
        <>
          {/* Notes par trimestre */}
          {groupes.length === 0 ? (
            <div className="insc-vide">
              <div className="insc-vide-ico" aria-hidden="true"><Icone nom="inbox" size={44} /></div>
              <p>Aucune note publiée pour l'instant.</p>
            </div>
          ) : groupes.map((g) => (
            <div key={`${g.annee}-${g.periode}`} className="res-bloc">
              <div className="notes-section-titre">{LIBELLE_TRIM[g.periode] || g.periode} — {g.annee}</div>
              <div className="tableau-enveloppe">
                <table className="tableau insc-tableau">
                  <thead><tr><th>Matière</th><th>Note</th><th>Coefficient</th></tr></thead>
                  <tbody>
                    {g.notes.map((n) => (
                      <tr key={n.id}>
                        <td className="insc-nom">{n.matiere}</td>
                        <td className="res-note" style={{ color: (Number(n.valeur) / (Number(n.bareme) || 100)) * 100 >= seuil ? '#38A169' : '#E53E3E' }}>
                          {Number(n.valeur).toFixed(2)}/{Number(n.bareme ?? 100).toFixed(0)}
                        </td>
                        <td>{Number(n.coefficient || 1).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="res-moyenne">
                <Icone nom="chart" /> Moyenne pondérée :{' '}
                <strong style={{ color: g.moyenne >= seuil ? '#38A169' : '#E53E3E' }}>{g.moyenne.toFixed(2)} / 100</strong>
              </div>

              {/* Appréciation IA du trimestre */}
              {(() => {
                const cle = `${g.annee}||${g.periode}`;
                const texte = apprecs[cle];
                const err = apprecErreur[cle];
                const enCours = apprecEnCours === cle;
                return (
                  <div className="res-ia">
                    {texte ? (
                      <div className="res-ia-carte">
                        <div className="res-ia-titre"><Icone nom="comment" /> Appréciation (IA)</div>
                        <p className="res-ia-texte">{texte}</p>
                        <button type="button" className="res-ia-relance" onClick={() => genererAppreciation(g)} disabled={enCours}>
                          <Icone nom="refresh" /> {enCours ? 'Régénération…' : 'Régénérer'}
                        </button>
                      </div>
                    ) : (
                      <button type="button" className="res-ia-btn" onClick={() => genererAppreciation(g)} disabled={enCours}>
                        <Icone nom="comment" /> {enCours ? 'Analyse en cours…' : 'Obtenir une appréciation (IA)'}
                      </button>
                    )}
                    {err && <p className="res-ia-erreur">{err}</p>}
                  </div>
                );
              })()}
            </div>
          ))}

          {/* Bilan de fin d'année — moyenne générale annuelle (3e trimestre publié) */}
          {bilans.map((b) => (
            <div key={`bilan-${b.annee}`} className="res-bilan">
              <div className="res-bilan-titre"><Icone nom="chart" /> Bilan de fin d'année — {b.annee}</div>
              <div className="res-bilan-trims">
                {b.trimestres.map((t) => (
                  <div key={t.periode} className="res-bilan-trim">
                    <span>{LIBELLE_TRIM[t.periode] || t.periode}</span>
                    <strong>{t.moyenne.toFixed(2)}</strong>
                  </div>
                ))}
              </div>
              <div className="res-bilan-general">
                Moyenne générale annuelle <strong>{b.moyenne.toFixed(2)} / 100</strong>
                <span className={`res-bilan-decision ${b.moyenne >= seuil ? 'ok' : 'ko'}`}>
                  {b.moyenne >= seuil ? 'Admis(e)' : 'Ajourné(e)'}
                </span>
              </div>
            </div>
          ))}

          {/* Bulletins */}
          <div className="notes-section-titre"><Icone nom="file" /> Mes bulletins</div>
          {bulletins.length === 0 ? (
            <div className="insc-vide">
              <div className="insc-vide-ico" aria-hidden="true"><Icone nom="inbox" size={44} /></div>
              <p>Aucun bulletin disponible.</p>
            </div>
          ) : (
            <div className="tableau-enveloppe">
              <table className="tableau insc-tableau">
                <thead><tr><th>Document</th><th>Généré le</th><th>Actions</th></tr></thead>
                <tbody>
                  {bulletins.map((b) => (
                    <tr key={b.id}>
                      <td className="insc-nom">Bulletin</td>
                      <td>{dateFr(b.date_generation)}</td>
                      <td>
                        <button type="button" className="mat-modifier" onClick={() => telecharger(b.id)} disabled={telechargeId === b.id}>
                          {telechargeId === b.id ? 'Téléchargement…' : <><Icone nom="download" /> Télécharger</>}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <footer className="insc-pied">© {new Date().getFullYear()} Lekòl Pam. Plateforme de gestion scolaire.</footer>
    </div>
  );
}
