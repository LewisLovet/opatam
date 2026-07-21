/**
 * App i18n (client side) — i18next, 100% JS.
 *
 * IMPORTANT : PAS d'expo-localization ici. C'est un module NATIF : l'ajouter
 * changerait le runtime et casserait les `eas update` vers les apps déjà
 * installées (runtimeVersion policy: appVersion). La langue système est lue
 * via Intl (Hermes), disponible sans code natif.
 *
 * Résolution : choix explicite AsyncStorage (@opatam/app_locale, posé par le
 * sélecteur du profil) → langue système en* → 'en' → défaut 'fr'.
 * Le contenu des pros (prestations, descriptions…) reste dans leur langue
 * d'auteur — seul le chrome UI se traduit (même règle que le web).
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import { getStoredLocale, setStoredLocale } from '../utils/storage';
import fr from '../locales/app/fr.json';
import en from '../locales/app/en.json';
import it from '../locales/app/it.json';

export type AppLocale = 'fr' | 'en' | 'it';
export const APP_LOCALES: AppLocale[] = ['fr', 'en', 'it'];

function deviceLocale(): AppLocale {
  try {
    const resolved = (Intl.DateTimeFormat().resolvedOptions().locale || '').toLowerCase();
    if (resolved.startsWith('en')) return 'en';
    if (resolved.startsWith('it')) return 'it';
    return 'fr';
  } catch {
    return 'fr';
  }
}

// Init synchrone avec la langue système : l'UI a une langue dès le premier
// rendu. Le choix explicite éventuel est appliqué juste après (voir plus bas).
i18n.use(initReactI18next).init({
  resources: {
    fr: { translation: fr },
    en: { translation: en },
    it: { translation: it },
  },
  lng: deviceLocale(),
  fallbackLng: 'fr',
  interpolation: { escapeValue: false }, // React Native échappe déjà
  returnNull: false,
});

// Applique le choix explicite stocké (si différent de la langue système).
// Fire-and-forget au chargement du module : le splash couvre le délai.
getStoredLocale().then((stored) => {
  if (stored && APP_LOCALES.includes(stored as AppLocale) && stored !== i18n.language) {
    void i18n.changeLanguage(stored);
  }
});

/** Langue courante de l'app — à snapshotter en `clientLocale` sur les résas. */
export function getAppLocale(): AppLocale {
  return i18n.language === 'en' ? 'en' : 'fr';
}

/** Choix explicite depuis le sélecteur du profil : bascule + persiste. */
export async function setAppLocale(locale: AppLocale): Promise<void> {
  await i18n.changeLanguage(locale);
  await setStoredLocale(locale);
}

export default i18n;
