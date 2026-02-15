/**
 * ProviderContext
 * Loads and provides the provider document for pro screens.
 * Uses userData.providerId from AuthContext to fetch provider data.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { providerService } from '@booking-app/firebase';
import type { Provider } from '@booking-app/shared';
import type { WithId } from '@booking-app/firebase';
import { useAuth } from './AuthContext';

interface ProviderContextValue {
  provider: WithId<Provider> | null;
  providerId: string | null;
  isLoading: boolean;
  refreshProvider: () => Promise<void>;
}

const ProviderContext = createContext<ProviderContextValue | undefined>(undefined);

export function ProviderProvider({ children }: { children: ReactNode }) {
  const { userData } = useAuth();
  const [provider, setProvider] = useState<WithId<Provider> | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const providerId = userData?.providerId || null;

  const refreshProvider = useCallback(async () => {
    if (!providerId) {
      setProvider(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const providerData = await providerService.getById(providerId);
      setProvider(providerData);
    } catch (error) {
      console.error('Error loading provider:', error);
      setProvider(null);
    } finally {
      setIsLoading(false);
    }
  }, [providerId]);

  useEffect(() => {
    refreshProvider();
  }, [refreshProvider]);

  return (
    <ProviderContext.Provider value={{ provider, providerId, isLoading, refreshProvider }}>
      {children}
    </ProviderContext.Provider>
  );
}

export function useProvider() {
  const context = useContext(ProviderContext);
  if (!context) {
    throw new Error('useProvider must be used within a ProviderProvider');
  }
  return context;
}
