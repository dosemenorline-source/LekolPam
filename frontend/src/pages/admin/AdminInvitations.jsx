import { useEffect, useMemo, useState } from 'react';
import { invitationsApi } from '../../services/api.js';
import { dateHeureFr } from '../../utils/libelles.js';
import Alerte from '../../components/Alerte.jsx';
import Chargement from '../../components/Chargement.jsx';
import Icone from '../../components/Icone.jsx';

const STATUT_BADGE = {
  actif: { libelle: 'Actif', classe: 'insc-badge-vert' },
  utilise: { libelle: 'Utilisé', classe: 'insc-badge-gris' },
  expire: { libelle: 'Expiré', classe: 'insc-badge-or' },
  revoque: { libelle: 'Révoqué', classe: 'insc-badge-rouge' },
};

export default function AdminInvitations() {
  const [invitations, setInvitations] = useState(null); // null = chargement
  const [erreur, setErreur] = useState('');
  const [msg, setMsg] = useState('');

  const [note, setNote] = useState('');
  const [expireJours, setExpireJours] = useState(''); // '' = jamais
  const [enCreation, setEnCreation] = useState(false);
  const [revoqueId, setRevoqueId] = useState(null);
  const [copieId, setCopieId] = useState(null);

  const charger = () => invitationsApi.lister()
    .then((d) => setInvitations(d.invitations))
    .catch((e) => setErreur(e.message));

  useEffect(() => { charger(); }, []);

  const stats = useMemo(() => {
    const base = invitations || [];
    return {
      total: base.length,
      actifs: base.filter((i) => i.statut === 'actif').length,
      utilises: base.filter((i) => i.statut === 'utilise').length,
    };
  }, [invitations]);

  const generer = async (e) => {
    e.preventDefault();
    setErreur(''); setMsg(''); setEnCreation(true);
    try {
      const payload = {};
      if (note.trim()) payload.note = note.trim();
      if (expireJours) payload.expireJours = Number(expireJours);
      const { invitation } = await invitationsApi.creer(payload);
      setNote(''); setExpireJours('');
      setMsg(`Code généré : ${invitation.code}`);
      await charger();
    } catch (err) {
      setErreur(err.message);
    } finally {
      setEnCreation(false);
    }
  };

  const revoquer = async (id) => {
    setErreur(''); setMsg(''); setRevoqueId(id);
    try {
      await invitationsApi.revoquer(id);
      await charger();
    } catch (err) {
      setErreur(err.message);
    } finally {
      setRevoqueId(null);
    }
  };

  const copier = async (inv) => {
    try { await navigator.clipboard.writeText(inv.code); } catch { /* ignoré */ }
    setCopieId(inv.id);
    setTimeout(() => setCopieId((id) => (id === inv.id ? null : id)), 1800);
  };

  return (
    <div className="insc-page">
      <div className="page-entete">
        <h1>Codes d'invitation élève</h1>
        <p>
          Générez un code et remettez-le à un élève réellement admis. Lui seul,
          avec ce code, pourra créer son compte élève. Sans code valide,
          l'auto-inscription élève est impossible.
        </p>
      </div>

      {/* Formulaire de génération */}
      <form className="insc-barre" onSubmit={generer} style={{ flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="insc-recherche" style={{ flex: '1 1 260px' }}>
          <input value={note} onChange={(e) => setNote(e.target.value)}
            placeholder="Repère (facultatif) : nom / niveau de l'élève attendu…"
            aria-label="Repère de l'invitation" maxLength={160} />
        </div>
        <select value={expireJours} onChange={(e) => setExpireJours(e.target.value)}
          aria-label="Expiration du code">
          <option value="">Sans expiration</option>
          <option value="7">Expire dans 7 jours</option>
          <option value="30">Expire dans 30 jours</option>
          <option value="90">Expire dans 90 jours</option>
        </select>
        <button type="submit" className="code-generer" disabled={enCreation}>
          {enCreation ? 'Génération…' : 'Générer un code'}
        </button>
      </form>

      {erreur && <Alerte type="erreur">{erreur}</Alerte>}
      {msg && <Alerte type="info">{msg}</Alerte>}

      {/* Résumé */}
      <div className="insc-resume">
        <span className="insc-stat"><strong>{stats.total}</strong> Total</span>
        <span className="insc-stat insc-stat-vert"><strong>{stats.actifs}</strong> Actif{stats.actifs > 1 ? 's' : ''}</span>
        <span className="insc-stat insc-stat-or"><strong>{stats.utilises}</strong> Utilisé{stats.utilises > 1 ? 's' : ''}</span>
      </div>

      {!invitations ? (
        <Chargement texte="Chargement des invitations…" />
      ) : invitations.length === 0 ? (
        <div className="insc-vide">
          <div className="insc-vide-ico" aria-hidden="true"><Icone nom="inbox" size={44} /></div>
          <p>Aucune invitation pour le moment. Générez un premier code ci-dessus.</p>
        </div>
      ) : (
        <div className="tableau-enveloppe">
          <table className="tableau insc-tableau">
            <thead>
              <tr>
                <th>Code</th><th>Repère</th><th>Statut</th>
                <th>Créé le</th><th>Expire</th><th>Utilisé par</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {invitations.map((inv) => {
                const badge = STATUT_BADGE[inv.statut] || STATUT_BADGE.actif;
                return (
                  <tr key={inv.id}>
                    <td>
                      <span className="code-cellule">
                        <span className="code-chip">{inv.code}</span>
                        <button type="button" className="code-copier" onClick={() => copier(inv)}
                          aria-label="Copier le code" title="Copier">
                          {copieId === inv.id ? <Icone nom="check" /> : <Icone nom="clipboard" />}
                        </button>
                      </span>
                    </td>
                    <td>{inv.note || <span className="texte-gris">—</span>}</td>
                    <td><span className={`insc-badge ${badge.classe}`}>{badge.libelle}</span></td>
                    <td>{dateHeureFr(inv.creeLe)}</td>
                    <td>{inv.expireLe ? dateHeureFr(inv.expireLe) : <span className="texte-gris">Jamais</span>}</td>
                    <td>{inv.utiliseParNom || <span className="texte-gris">—</span>}</td>
                    <td>
                      {inv.statut === 'actif' && (
                        <button type="button" className="insc-btn-reinit" onClick={() => revoquer(inv.id)}
                          disabled={revoqueId === inv.id}>
                          {revoqueId === inv.id ? 'Révocation…' : 'Révoquer'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <footer className="insc-pied">© {new Date().getFullYear()} Lekòl Pam. Tous droits réservés.</footer>
    </div>
  );
}
