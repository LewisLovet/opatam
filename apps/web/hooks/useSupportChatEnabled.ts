'use client';

import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@booking-app/firebase';

/**
 * Interrupteur du chat de support — doc Firestore `config/supportChat` :
 *   { enabledForAll: boolean, allowedProviderIds: string[] }
 *
 * Permet de déployer le chat ÉTEINT puis de l'allumer depuis la console
 * Firebase (enabledForAll: true), sans redéployer. En attendant, seuls les
 * comptes listés dans allowedProviderIds et les admins plateforme le voient.
 * Doc absent ou illisible = chat masqué (défaut sûr).
 *
 * Retour tri-état : `null` tant que la config n'est pas chargée (ne rien
 * afficher, mais ne rien conclure non plus), puis true/false.
 */
export function useSupportChatEnabled(uid: string | null, isAdmin: boolean): boolean | null {
  const [cfg, setCfg] = useState<{ enabledForAll: boolean; allowed: string[] } | null>(null);

  useEffect(() => {
    return onSnapshot(
      doc(db, 'config', 'supportChat'),
      (snap) => {
        const x = snap.data();
        setCfg({
          enabledForAll: x?.enabledForAll === true,
          allowed: Array.isArray(x?.allowedProviderIds)
            ? x.allowedProviderIds.filter((v: unknown): v is string => typeof v === 'string')
            : [],
        });
      },
      () => setCfg({ enabledForAll: false, allowed: [] }),
    );
  }, []);

  if (isAdmin) return true;
  if (!cfg) return null;
  if (!uid) return false;
  return cfg.enabledForAll || cfg.allowed.includes(uid);
}
