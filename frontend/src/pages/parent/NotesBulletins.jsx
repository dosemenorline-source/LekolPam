import { useEffect, useState } from 'react';
import { notesApi, marqueApi, urlDocumentOfficiel } from '../../services/api.js';
import Carte from '../../components/Carte.jsx';
import Champ from '../../components/Champ.jsx';
import Bouton from '../../components/Bouton.jsx';
import Alerte from '../../components/Alerte.jsx';
import Chargement from '../../components/Chargement.jsx';

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

export default function NotesBulletins() {
  const [eleves, setEleves] = useState(null);
  const [idEleve, setIdEleve] = useState('');
  const [notes, setNotes] = useState([]);
  const [bulletins, setBulletins] = useState([]);
  const [bloques, setBloques] = useState([]);
  const [apercuId, setApercuId] = useState(null);
  const [telechargeId, setTelechargeId] = useState(null);
  const [genereEnCours, setGenereEnCours] = useState(false);
  const [erreur, setErreur] = useState('');
  const [chargeDetail, setChargeDetail] = useState(false);
  const [seuil, setSeuil] = useState(50); // note de passage /100, définie par le secrétariat

  useEffect(() => { marqueApi.obtenir().then((m) => setSeuil(m.seuilReussite)).catch(() => {}); }, []);

  // Génère (ou régénère) le code d'accès de l'espace élève pour l'enfant sélectionné.
  const genererCode = async () => {
    setErreur('');
    setGenereEnCours(true);
    try {
      const { code } = await notesApi.genererCodeEleve(idEleve);
      setEleves((prev) => prev.map((el) => (String(el.id) === idEleve ? { ...el, code_acces: code } : el)));
    } catch (e) {
      setErreur(e.message);
    } finally {
      setGenereEnCours(false);
    }
  };

  // Télécharge le PDF en tant que blob (avec le cookie de session) et force l'enregistrement.
  const telecharger = async (id) => {
    setErreur('');
    setTelechargeId(id);
    try {
      const res = await fetch(urlDocumentOfficiel(id), { credentials: 'include' });
      if (!res.ok) throw new Error('Téléchargement impossible.');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bulletin-${id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setErreur(e.message);
    } finally {
      setTelechargeId(null);
    }
  };

  useEffect(() => {
    notesApi.mesEleves()
      .then((d) => {
        setEleves(d.eleves);
        if (d.eleves.length) setIdEleve(String(d.eleves[0].id));
      })
      .catch((e) => setErreur(e.message));
  }, []);

  useEffect(() => {
    if (!idEleve) return;
    setApercuId(null);
    setChargeDetail(true);
    Promise.all([notesApi.notesEleve(idEleve), notesApi.bulletinsEleve(idEleve)])
      .then(([n, b]) => { setNotes(n.notes); setBloques(n.trimestresBloques || []); setBulletins(b.bulletins); })
      .catch((e) => setErreur(e.message))
      .finally(() => setChargeDetail(false));
  }, [idEleve]);

  if (erreur) return <Alerte type="erreur">{erreur}</Alerte>;
  if (!eleves) return <Chargement />;

  const groupes = grouperNotes(notes);
  const bilans = bilansAnnuels(groupes);

  return (
    <div>
      <div className="page-entete">
        <h1>Notes & bulletins</h1>
        <p>Consultez les notes publiées et téléchargez les bulletins de vos enfants.</p>
      </div>

      {eleves.length === 0 ? (
        <Carte><p className="texte-gris">Aucun élève. Créez d'abord une inscription.</p></Carte>
      ) : (
        <>
          <Carte>
            <Champ label="Élève" enfant={
              <select value={idEleve} onChange={(e) => setIdEleve(e.target.value)}>
                {eleves.map((el) => (
                  <option key={el.id} value={el.id}>{el.nom}{el.niveau ? ` — ${el.niveau}` : ''}</option>
                ))}
              </select>
            } />
          </Carte>

          {/* Code d'accès de l'espace élève */}
          {(() => {
            const enfant = eleves.find((el) => String(el.id) === idEleve);
            if (!enfant) return null;
            return (
              <Carte titre="Accès élève (code)" style={{ marginTop: '1rem' }}>
                <p className="texte-gris" style={{ marginBottom: '.75rem' }}>
                  Donnez ce code à {enfant.nom} pour qu'il/elle consulte ses résultats sur la page « Espace élève ».
                </p>
                <div className="rangee" style={{ gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{
                    fontFamily: 'monospace', fontSize: '1.4rem', fontWeight: 700, letterSpacing: '3px',
                    padding: '.4rem .9rem', border: '1px solid var(--gris-bordure)', borderRadius: 8,
                    background: 'var(--gris-clair)',
                  }}>
                    {enfant.code_acces || '— aucun —'}
                  </span>
                  {!enfant.code_acces && (
                    <Bouton variante="secondaire" onClick={genererCode} enCours={genereEnCours}>
                      Générer le code
                    </Bouton>
                  )}
                </div>
                <p className="texte-gris" style={{ marginTop: '.6rem', fontSize: '.85rem' }}>
                  Ce code ne change pas.
                </p>
              </Carte>
            );
          })()}

          {chargeDetail ? <Chargement /> : (
            <div className="pile pile-md" style={{ marginTop: '1rem' }}>
              {/* Trimestres bloqués (économat non réglé) */}
              {bloques.length > 0 && (
                <Alerte type="erreur">
                  Résultats indisponibles pour&nbsp;: {bloques.map((b) => `${LIBELLE_TRIM[b.trimestre] || b.trimestre} (${b.annee_scolaire})`).join(', ')}.
                  Régularisez votre situation auprès de l'économat pour y accéder.
                </Alerte>
              )}

              {/* Notes */}
              {groupes.length === 0 ? (
                <Carte titre="Notes">
                  <p className="texte-gris">Aucune note publiée pour l'instant.</p>
                </Carte>
              ) : groupes.map((g) => (
                <Carte key={`${g.annee}-${g.periode}`} titre={`${LIBELLE_TRIM[g.periode] || g.periode} — ${g.annee}`}>
                  <div className="tableau-enveloppe">
                    <table className="tableau">
                      <thead><tr><th>Matière</th><th>Note</th><th>Coefficient</th></tr></thead>
                      <tbody>
                        {g.notes.map((n) => (
                          <tr key={n.id}>
                            <td>{n.matiere}</td>
                            <td style={{ color: (Number(n.valeur) / (Number(n.bareme) || 100)) * 100 >= seuil ? '#2F855A' : '#C53030', fontWeight: 700 }}>
                              {Number(n.valeur).toFixed(2)}/{Number(n.bareme ?? 100).toFixed(0)}
                            </td>
                            <td>{Number(n.coefficient || 1).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p style={{ marginTop: '.75rem', fontWeight: 700 }}>
                    Moyenne pondérée :{' '}
                    <span style={{ color: g.moyenne >= seuil ? '#2F855A' : '#C53030' }}>{g.moyenne.toFixed(2)} / 100</span>
                  </p>
                </Carte>
              ))}

              {/* Bilan de fin d'année — moyenne générale annuelle (3e trimestre publié) */}
              {bilans.map((b) => (
                <Carte key={`bilan-${b.annee}`} titre={`Bilan de fin d'année — ${b.annee}`}>
                  <div className="tableau-enveloppe">
                    <table className="tableau">
                      <thead><tr><th>Trimestre</th><th>Moyenne /100</th></tr></thead>
                      <tbody>
                        {b.trimestres.map((t) => (
                          <tr key={t.periode}>
                            <td>{LIBELLE_TRIM[t.periode] || t.periode}</td>
                            <td>{t.moyenne.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p style={{ marginTop: '.75rem', fontWeight: 800, fontSize: '1.05rem', color: 'var(--bleu, #1A365D)' }}>
                    Moyenne générale annuelle : {b.moyenne.toFixed(2)} / 100
                    {' — '}
                    <span style={{ color: b.moyenne >= seuil ? '#2F855A' : '#C53030' }}>
                      {b.moyenne >= seuil ? 'Admis(e)' : 'Ajourné(e)'}
                    </span>
                  </p>
                </Carte>
              ))}

              {/* Bulletins */}
              <Carte titre="Bulletins">
                {bulletins.length === 0 ? (
                  <p className="texte-gris">Aucun bulletin disponible.</p>
                ) : (
                  <>
                    <div className="tableau-enveloppe">
                      <table className="tableau">
                        <thead><tr><th>Document</th><th>Généré le</th><th></th></tr></thead>
                        <tbody>
                          {bulletins.map((b) => (
                            <tr key={b.id}>
                              <td>Bulletin</td>
                              <td>{dateFr(b.date_generation)}</td>
                              <td>
                                <div className="rangee" style={{ gap: '.5rem', flexWrap: 'wrap' }}>
                                  <Bouton sm variante="secondaire"
                                    onClick={() => setApercuId(apercuId === b.id ? null : b.id)}>
                                    {apercuId === b.id ? 'Masquer' : 'Afficher'}
                                  </Bouton>
                                  <Bouton sm onClick={() => telecharger(b.id)} enCours={telechargeId === b.id}>
                                    Télécharger
                                  </Bouton>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {apercuId && (
                      <div style={{ marginTop: '1rem' }}>
                        <iframe
                          title="Aperçu du bulletin"
                          src={urlDocumentOfficiel(apercuId)}
                          style={{
                            width: '100%', height: 640,
                            border: '1px solid var(--gris-bordure)', borderRadius: 8,
                          }}
                        />
                      </div>
                    )}
                  </>
                )}
              </Carte>
            </div>
          )}
        </>
      )}
    </div>
  );
}
