'use client';

import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@booking-app/firebase';
import { espaceMembreOuvert } from '@booking-app/shared';

/**
 * Interrupteur de l'espace membre — doc Firestore `config/espaceMembre` :
 *   { enabledForAll: boolean, allowedProviderIds: string[] }
 *
 * Livré ÉTEINT : on l'ouvre à quelques salons pour tester, puis à tous,
 * depuis la console Firebase, sans redéployer. Le serveur applique la même
 * règle à l'invitation. Doc absent ou illisible = fermé (défaut sûr).
 *
 * `null` tant que la config n'est pas chargée, puis true/false.
 */
export function useEspaceMembreOuvert(providerId: string | null | undefined): boolean | null {
  const [config, setConfig] = useState<unknown>(undefined);
  useEffect(
    () =>
      onSnapshot(
        doc(db, 'config', 'espaceMembre'),
        (snap) => setConfig(snap.data() ?? null),
        () => setConfig(null),
      ),
    [],
  );
  if (config === undefined) return null;
  return espaceMembreOuvert(config, providerId);
}
