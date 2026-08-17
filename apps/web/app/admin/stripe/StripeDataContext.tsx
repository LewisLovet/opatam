'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { adminStatsService } from '@/services/admin';
import type { StripeEconomics } from '@/services/admin/types';

/**
 * Les données Stripe, chargées UNE fois pour toute la section.
 *
 * Les trois vues montrent le même relevé sous trois angles. Les faire
 * charger chacune de leur côté rejouerait plusieurs pages d'API Stripe à
 * chaque changement d'onglet — lent, et facturé.
 */
const Ctx = createContext<{ data: StripeEconomics | null; erreur: string | null }>({
  data: null,
  erreur: null,
});

export const useStripeData = () => useContext(Ctx);

export function StripeDataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [data, setData] = useState<StripeEconomics | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    adminStatsService
      .getStripeEconomics(user.id)
      .then(setData)
      .catch((e) => setErreur(e instanceof Error ? e.message : 'Erreur inconnue'));
  }, [user?.id]);

  return <Ctx.Provider value={{ data, erreur }}>{children}</Ctx.Provider>;
}
