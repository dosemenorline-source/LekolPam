// Métadonnées SEO/Open Graph par route publique — utilisées pour injecter un
// <title>/<meta> propre à chaque page dans le HTML servi par Express. Les
// robots des réseaux sociaux (WhatsApp, Facebook…) n'exécutent pas le
// JavaScript React : ces valeurs doivent donc déjà être dans le HTML brut.
// Garder ces textes cohérents avec les hooks useTitrePage() côté frontend.
export const PAGES_SEO = {
  '/': {
    titre: 'Lekòl Pam',
    description: "Lekòl Pam — plateforme de gestion scolaire : inscriptions en ligne, notes, bulletins et documents officiels pour les familles, élèves et l'administration.",
  },
  '/a-propos': {
    titre: 'À propos — Lekòl Pam',
    description: "Découvrez la mission, l'histoire et les valeurs de l'école Lekòl Pam.",
  },
  '/vlog': {
    titre: 'Vlog — Lekòl Pam',
    description: 'Actualités, annonces et vie scolaire de Lekòl Pam.',
  },
  '/professeurs': {
    titre: 'Notre équipe pédagogique — Lekòl Pam',
    description: 'Découvrez les professeurs et le corps enseignant de Lekòl Pam.',
  },
  '/academie/prescolaire': {
    titre: 'Préscolaire — Lekòl Pam',
    description: "L'éveil et les premiers apprentissages, dans un cadre bienveillant.",
  },
  '/academie/primaire': {
    titre: 'Primaire — Lekòl Pam',
    description: 'Les fondations solides en lecture, écriture et calcul.',
  },
  '/academie/secondaire': {
    titre: 'Secondaire — Lekòl Pam',
    description: "Préparer les élèves à la réussite et à la suite de leur parcours.",
  },
  '/examens': {
    titre: 'Examens passés — Lekòl Pam',
    description: "Consultez les feuilles d'examens passés par niveau à Lekòl Pam.",
  },
  '/contact': {
    titre: 'Contact — Lekòl Pam',
    description: 'Besoin de nous joindre ? Retrouvez ici nos coordonnées et notre formulaire.',
  },
  '/calendrier': {
    titre: 'Calendrier — Lekòl Pam',
    description: 'Dates importantes, périodes scolaires et évènements à venir.',
  },
  '/support': {
    titre: 'Support — Lekòl Pam',
    description: 'Aide, questions fréquentes et assistance pour utiliser la plateforme.',
  },
  '/anciens-eleves': {
    titre: 'Anciens élèves — Lekòl Pam',
    description: "Anciens élèves de Lekòl Pam : faites une demande en ligne pour retrouver vos résultats et bulletins.",
  },
};
