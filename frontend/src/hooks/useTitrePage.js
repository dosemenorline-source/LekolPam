import { useEffect } from 'react';

// Met à jour le titre de l'onglet + la meta description lors d'une navigation
// côté client — React Router ne recharge pas la page, donc le <title> injecté
// côté serveur au premier chargement (voir backend/src/config/seoPages.js) ne
// suit pas automatiquement quand on navigue avec <Link>.
export default function useTitrePage(titre, description) {
  useEffect(() => {
    if (!titre) return;
    document.title = titre === 'Lekòl Pam' ? titre : `${titre} — Lekòl Pam`;
    if (description) {
      const meta = document.querySelector('meta[name="description"]');
      if (meta) meta.setAttribute('content', description);
    }
  }, [titre, description]);
}
