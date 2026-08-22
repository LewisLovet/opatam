'use client';

import { useEffect, useRef } from 'react';
import { useLocale } from 'next-intl';
import { providerService } from '@booking-app/firebase';
import type { Provider } from '@booking-app/shared';

const SUPPORTED = ['fr', 'en', 'it', 'pt', 'de'] as const;
type Locale = (typeof SUPPORTED)[number];

/**
 * Remonte la langue de l'interface sur la fiche du prestataire.
 *
 * POURQUOI. La langue choisie ne vivait que sur l'appareil — cookie
 * `NEXT_LOCALE` sur le web, AsyncStorage sur mobile — et n'atteignait le
 * serveur que sur les RÉSERVATIONS, en `clientLocale`. Les notifications
 * adressées au prestataire n'avaient donc rien pour choisir leur langue et la
 * DÉDUISAIENT de son pays : un salon portugais tenu par un francophone
 * recevait du portugais.
 *
 * Écriture uniquement quand la valeur change : un professionnel qui ne touche
 * pas au sélecteur ne produit aucune écriture. La déduction par pays reste le
 * repli tant que ce champ est absent.
 */
export function useSyncProviderLocale(provider: (Provider & { id: string }) | null) {
  const locale = useLocale();
  const enCours = useRef<string | null>(null);

  useEffect(() => {
    if (!provider?.id) return;
    if (!SUPPORTED.includes(locale as Locale)) return;
    if (provider.locale === locale) return;
    // Évite une seconde écriture pendant que la première est en vol (le doc
    // n'a pas encore été rafraîchi par l'écoute temps réel).
    if (enCours.current === locale) return;

    enCours.current = locale;
    providerService
      .updateProvider(provider.id, { locale: locale as Locale })
      .catch((e) => console.warn('[locale] synchronisation échouée', e));
  }, [provider?.id, provider?.locale, locale]);
}
