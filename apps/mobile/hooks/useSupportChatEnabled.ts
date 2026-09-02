/**
 * Interrupteur du chat de support — doc Firestore `config/supportChat` :
 *   { enabledForAll: boolean, allowedProviderIds: string[] }
 *
 * Miroir du hook web : permet de livrer le chat ÉTEINT (OTA production)
 * puis de l'allumer depuis la console Firebase sans nouvel update.
 * Doc absent ou illisible = chat masqué (défaut sûr).
 *
 * Retour tri-état : `null` tant que la config n'est pas chargée (ne rien
 * afficher, mais ne rien conclure non plus), puis true/false.
 */

import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@booking-app/firebase';

export function useSupportChatEnabled(uid: string | null): boolean | null {
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

  if (!cfg) return null;
  if (!uid) return false;
  return cfg.enabledForAll || cfg.allowed.includes(uid);
}
