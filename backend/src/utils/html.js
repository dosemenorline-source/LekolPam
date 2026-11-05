// Échappe une chaîne pour une insertion sûre dans du HTML (courriels
// notamment) — toute valeur d'origine utilisateur (nom saisi à
// l'inscription, message d'un formulaire public…) doit y passer avant
// d'être interpolée dans un gabarit HTML.
export const echapperHtml = (s) => String(s ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');
