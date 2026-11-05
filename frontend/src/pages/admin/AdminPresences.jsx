import { useEffect, useRef, useState, useCallback } from 'react';
import jsQR from 'jsqr';
import { adminApi, urlPhotoEleveAdmin } from '../../services/api.js';
import Carte from '../../components/Carte.jsx';
import Alerte from '../../components/Alerte.jsx';

// Extrait le code d'accès depuis le contenu scanné : le QR du badge encode
// une URL complète (/eleve?code=XXXX) — on retombe sur le texte brut si ce
// n'est pas une URL valide (badge abîmé, code tapé à la main un jour).
function extraireCode(texte) {
  try {
    const u = new URL(texte);
    const code = u.searchParams.get('code');
    if (code) return code;
  } catch { /* pas une URL — on utilise le texte tel quel */ }
  return texte.trim();
}

const FUSEAU = { timeZone: 'America/Port-au-Prince', hour: '2-digit', minute: '2-digit' };
const heureFr = (iso) => (iso ? new Date(iso).toLocaleTimeString('fr-FR', FUSEAU) : '—');

const COOLDOWN_MS = 4000; // évite de re-soumettre le même badge pendant qu'il reste dans le cadre
// L'analyse d'image (getImageData + jsQR) est coûteuse. On ne la fait pas à
// chaque image de la caméra (~60/s, ce qui saturait le processeur et faisait
// « vibrer » l'aperçu), mais au plus toutes les INTERVALLE_SCAN_MS, sur une
// image réduite à MAX_SCAN_PX de côté — largement assez pour lire un QR.
const INTERVALLE_SCAN_MS = 120; // ~8 analyses par seconde
const MAX_SCAN_PX = 640;

export default function AdminPresences() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const flux = useRef(null);
  const dernierCode = useRef(null);
  const dernierScanLe = useRef(0);
  const dernierFrameLe = useRef(0); // horodatage de la dernière analyse d'image
  const enTraitement = useRef(false);
  const typeRef = useRef('entree'); // lu par la boucle de scan (évite de la relancer à chaque changement de mode)

  const [type, setType] = useState('entree'); // 'entree' | 'sortie'
  const [camActive, setCamActive] = useState(false);
  const [erreurCam, setErreurCam] = useState('');
  const [resultat, setResultat] = useState(null); // { eleve, dejaMarque, heure, type } ou { erreur }
  const [liste, setListe] = useState([]);
  const [confirmerReset, setConfirmerReset] = useState(false);
  const [resetEnCours, setResetEnCours] = useState(false);

  useEffect(() => { typeRef.current = type; }, [type]);

  const chargerListe = useCallback(() => {
    adminApi.presencesDuJour().then((d) => setListe(d.presences)).catch(() => {});
  }, []);
  useEffect(() => { chargerListe(); }, [chargerListe]);

  const traiterCode = useCallback(async (texteScanne) => {
    const code = extraireCode(texteScanne);
    const t = typeRef.current;
    const maintenant = Date.now();
    const cle = `${t}:${code}`;
    if (cle === dernierCode.current && maintenant - dernierScanLe.current < COOLDOWN_MS) return;
    if (enTraitement.current) return;
    dernierCode.current = cle;
    dernierScanLe.current = maintenant;
    enTraitement.current = true;
    try {
      const d = await adminApi.scannerPresence(code, t);
      setResultat({ ...d, erreur: null });
      chargerListe();
    } catch (e) {
      setResultat({ erreur: e.message });
    } finally {
      enTraitement.current = false;
    }
  }, [chargerListe]);

  const boucleScan = useCallback(() => {
    const video = videoRef.current;
    const maintenant = performance.now();
    // On laisse défiler l'aperçu à pleine fluidité, mais on n'analyse une image
    // qu'au plus toutes les INTERVALLE_SCAN_MS (le reste du temps, on se contente
    // de reprogrammer la boucle) — c'est ce qui supprime le « tremblement ».
    if (video && video.readyState === video.HAVE_ENOUGH_DATA
        && maintenant - dernierFrameLe.current >= INTERVALLE_SCAN_MS) {
      dernierFrameLe.current = maintenant;
      // Canvas + contexte créés une seule fois. willReadFrequently : indispensable
      // pour getImageData répété (sinon lecture GPU à chaque fois = très lent).
      if (!canvasRef.current) canvasRef.current = document.createElement('canvas');
      if (!ctxRef.current) ctxRef.current = canvasRef.current.getContext('2d', { willReadFrequently: true });
      const canvas = canvasRef.current;
      const ctx = ctxRef.current;
      // Image réduite (MAX_SCAN_PX max) : jsQR est bien plus rapide, lecture OK.
      const ratio = Math.min(1, MAX_SCAN_PX / Math.max(video.videoWidth, video.videoHeight) || 1);
      const w = Math.max(1, Math.round(video.videoWidth * ratio));
      const h = Math.max(1, Math.round(video.videoHeight * ratio));
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;
      ctx.drawImage(video, 0, 0, w, h);
      const image = ctx.getImageData(0, 0, w, h);
      // dontInvert : le QR du badge est foncé sur clair — on évite la 2ᵉ passe.
      const code = jsQR(image.data, image.width, image.height, { inversionAttempts: 'dontInvert' });
      if (code?.data) traiterCode(code.data);
    }
    if (flux.current) requestAnimationFrame(boucleScan);
  }, [traiterCode]);

  const demarrerCamera = async () => {
    setErreurCam('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      flux.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCamActive(true);
      requestAnimationFrame(boucleScan);
    } catch (e) {
      setErreurCam("Impossible d'accéder à la caméra : " + e.message);
    }
  };

  const arreterCamera = () => {
    flux.current?.getTracks().forEach((t) => t.stop());
    flux.current = null;
    setCamActive(false);
  };

  useEffect(() => () => arreterCamera(), []);

  const confirmerReinitialisation = async () => {
    setResetEnCours(true);
    try {
      await adminApi.reinitialiserPresencesJour();
      setListe([]);
      setResultat(null);
      setConfirmerReset(false);
    } catch (e) {
      setErreurCam(e.message);
      setConfirmerReset(false);
    } finally {
      setResetEnCours(false);
    }
  };

  return (
    <div style={{ maxWidth: 960 }}>
      <div className="page-entete">
        <h1>Présence quotidienne</h1>
        <p>Scannez le QR au dos du badge de chaque élève pour confirmer son entrée ou sa sortie — le parent est notifié par courriel automatiquement.</p>
      </div>

      <div className="rangee" style={{ gap: '1.5rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <Carte style={{ flex: '1 1 340px' }}>
          <div className="rangee" style={{ gap: '.5rem', marginBottom: '.9rem' }}>
            <button type="button" onClick={() => setType('entree')}
              className={`btn ${type === 'entree' ? 'btn-primaire' : 'btn-secondaire'}`} style={{ flex: 1 }}>
              Entrée
            </button>
            <button type="button" onClick={() => setType('sortie')}
              className={`btn ${type === 'sortie' ? 'btn-primaire' : 'btn-secondaire'}`} style={{ flex: 1 }}>
              Sortie
            </button>
          </div>

          {erreurCam && <Alerte type="erreur">{erreurCam}</Alerte>}
          <div style={{
            position: 'relative', width: '100%', aspectRatio: '4/3', background: '#111',
            borderRadius: 10, overflow: 'hidden',
          }}>
            <video ref={videoRef} muted playsInline
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: camActive ? 'block' : 'none' }} />
            {!camActive && (
              <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
                <button type="button" className="btn btn-primaire" onClick={demarrerCamera}>Activer la caméra</button>
              </div>
            )}
          </div>
          {camActive && (
            <div style={{ marginTop: '.75rem' }}>
              <button type="button" className="btn btn-secondaire" onClick={arreterCamera}>Arrêter la caméra</button>
            </div>
          )}

          {resultat && (
            <div style={{ marginTop: '1rem' }}>
              {resultat.erreur ? (
                <Alerte type="erreur">{resultat.erreur}</Alerte>
              ) : (
                <div className="rangee" style={{ gap: '.9rem', padding: '.75rem', border: '1px solid var(--gris-bordure)', borderRadius: 10 }}>
                  <img src={urlPhotoEleveAdmin(resultat.eleve.id)} alt=""
                    style={{ width: 56, height: 56, borderRadius: 8, objectFit: 'cover', background: 'var(--gris-clair)' }}
                    onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />
                  <div>
                    <p style={{ margin: 0, fontWeight: 700 }}>{resultat.eleve.nom}</p>
                    <p className="texte-gris" style={{ margin: '.15rem 0 0', fontSize: '.85rem' }}>
                      {resultat.eleve.niveau} — {resultat.type === 'sortie' ? 'reparti(e)' : 'arrivé(e)'} à {resultat.heure}
                    </p>
                    {resultat.dejaMarque && (
                      <p style={{ margin: '.3rem 0 0', fontSize: '.8rem', color: 'var(--gris)' }}>
                        Déjà pointé(e) aujourd'hui — parent non re-notifié.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </Carte>

        <Carte titre={`Présences aujourd'hui (${liste.length})`} style={{ flex: '1 1 300px' }}>
          {liste.length === 0 ? (
            <p className="texte-gris">Aucun élève pointé pour l'instant.</p>
          ) : (
            <>
              <div className="tableau-enveloppe">
                <table className="tableau">
                  <thead><tr><th>Élève</th><th>Classe</th><th>Entrée</th><th>Sortie</th></tr></thead>
                  <tbody>
                    {liste.map((p) => (
                      <tr key={p.id}>
                        <td>{[p.prenom, p.nom].filter(Boolean).join(' ')}</td>
                        <td>{p.niveau || '—'}</td>
                        <td>{heureFr(p.heure_arrivee)}</td>
                        <td>{heureFr(p.heure_depart)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ marginTop: '.75rem' }}>
                <button type="button" className="btn btn-secondaire" onClick={() => setConfirmerReset(true)}>
                  Réinitialiser la liste du jour
                </button>
              </div>
            </>
          )}
        </Carte>
      </div>

      {confirmerReset && (
        <div className="prof-modal-fond" onClick={() => !resetEnCours && setConfirmerReset(false)}>
          <div className="prof-modal carte" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="prof-modal-fermer" onClick={() => setConfirmerReset(false)} aria-label="Fermer">×</button>
            <h2 style={{ marginBottom: '.75rem' }}>Réinitialiser la liste du jour ?</h2>
            <p style={{ marginBottom: '1rem', color: '#4A5568' }}>
              {liste.length > 1
                ? `Les ${liste.length} pointages d'entrée/sortie enregistrés aujourd'hui seront effacés.`
                : "Le pointage d'entrée/sortie enregistré aujourd'hui sera effacé."}
              {' '}Cette action ne peut pas être annulée. Les élèves pourront être re-scannés ensuite.
            </p>
            <div className="badges-actions" style={{ justifyContent: 'flex-end' }}>
              <button type="button" className="insc-btn-reinit" onClick={() => setConfirmerReset(false)} disabled={resetEnCours}>Annuler</button>
              <button type="button" className="paie-btn paie-rejeter" onClick={confirmerReinitialisation} disabled={resetEnCours}>
                {resetEnCours ? 'Réinitialisation…' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
