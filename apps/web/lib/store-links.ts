/**
 * Liens vers les fiches de l'application — une seule source de vérité.
 *
 * Ils étaient recopiés dans une dizaine de fichiers, et le lien Play Store
 * n'existait nulle part puisque l'app Android n'était pas publiée (elle l'est
 * depuis le 29 juillet 2026). Un identifiant qui change ne doit se corriger
 * qu'ici.
 *
 * Ces constantes ne servent QUE pour les liens rendus par le site. Les emails
 * gardent leurs URL en dur : ils sont composés côté serveur, souvent hors du
 * contexte Next, et un lien d'email déjà envoyé ne se rattrape pas.
 */

export const APP_STORE_URL =
  'https://apps.apple.com/app/opatam-agenda-rendez-vous/id6759246218';

export const PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.kamerleontech.opatam';
