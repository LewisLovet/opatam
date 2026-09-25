'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { DEFAULT_CURRENCY, formatPrice } from '@booking-app/shared';

/**
 * La devise de la page, et le formateur qui va avec.
 *
 * Pourquoi un contexte plutôt qu'une propriété passée de composant en
 * composant : une page ne parle JAMAIS que d'un seul prestataire, et il y
 * avait trente-sept formateurs de prix recopiés un peu partout, tous avec
 * l'euro écrit en dur. Faire descendre une devise dans chacun aurait
 * demandé de modifier chaque appelant intermédiaire, et il aurait suffi
 * d'en oublier un pour afficher des euros à un salon suisse.
 *
 * Ici un composant appelle `usePrix()` et n'a rien à savoir : s'il est
 * sous un `DeviseProvider`, il formate dans la bonne devise ; sinon il
 * retombe sur l'euro, exactement comme avant.
 */
const DeviseContext = createContext<string>(DEFAULT_CURRENCY);

export function DeviseProvider({
  devise,
  children,
}: {
  devise: string | null | undefined;
  children: ReactNode;
}) {
  return (
    <DeviseContext.Provider value={devise || DEFAULT_CURRENCY}>
      {children}
    </DeviseContext.Provider>
  );
}

/** Le code de la devise courante, quand on a besoin du code lui-même. */
export function useDevise(): string {
  return useContext(DeviseContext);
}

/**
 * Formateur lié à la devise de la page.
 *
 * `prix(3500)` rend « 35,00 € » ou « 35,00 CHF » selon le prestataire, et
 * « Gratuit » à zéro, comme le formateur partagé.
 */
export function usePrix(): (cents: number, locale?: string) => string {
  const devise = useContext(DeviseContext);
  return useMemo(
    () => (cents: number, locale?: string) => formatPrice(cents, devise, locale),
    [devise],
  );
}
