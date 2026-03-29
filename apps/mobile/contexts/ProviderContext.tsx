/**
 * ProviderContext
 * Loads and provides the provider document for pro screens.
 * Uses userData.providerId from AuthContext to fetch provider data.
 * Listens to Firestore in real-time via onSnapshot so changes
 * (e.g. subscription updates from webhooks) are reflected immediately.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { providerService, collections, doc, onSnapshot } from '@booking-app/firebase';
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

  // Real-time listener: updates provider state when Firestore document changes
  useEffect(() => {
    if (!providerId) {
      setProvider(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const providerRef = doc(collections.providers(), providerId);
    const unsubscribe = onSnapshot(providerRef, (snap) => {
      if (snap.exists()) {
        setProvider({ id: snap.id, ...snap.data() } as WithId<Provider>);
      } else {
        setProvider(null);
      }
      setIsLoading(false);
    }, (error) => {
      console.error('Error listening to provider:', error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [providerId]);

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

/**
 * useSubscriptionStatus
 * Derives subscription state from provider data.
 * Used by the "Plus" screen to show status and by screens to gate features.
 */
export function useSubscriptionStatus() {
  const { provider, isLoading } = useProvider();

  if (isLoading || !provider) {
    return { isActive: false, isTrialing: false, isExpired: false, needsSubscription: false, plan: null as string | null, status: null as string | null, daysRemaining: null as number | null, paymentSource: null as string | null };
  }

  const { plan, subscription } = provider;

  const isActive = subscription?.status === 'active';
  const isTrialing = (plan === 'solo' || plan === 'team') && subscription?.status === 'trialing';

  let trialValid = false;
  if (plan === 'trial') {
    const raw = subscription?.validUntil;
    const validDate = raw instanceof Date
      ? raw
      : (raw as any)?.toDate?.()
        || (raw ? new Date(raw as any) : null);
    trialValid = !!validDate && new Date() <= validDate;
  }

  const isTest = plan === 'test';
  const needsSubscription = !isActive && !isTrialing && !trialValid && !isTest;

  // Calculate days remaining for trial
  let daysRemaining: number | null = null;
  if (plan === 'trial' && subscription?.validUntil) {
    const raw = subscription.validUntil;
    const validDate = raw instanceof Date
      ? raw
      : (raw as any)?.toDate?.()
        || (raw ? new Date(raw as any) : null);
    if (validDate) {
      const diff = validDate.getTime() - Date.now();
      daysRemaining = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
    }
  }

  return {
    isActive,
    isTrialing: isTrialing || trialValid,
    isExpired: needsSubscription,
    needsSubscription,
    plan: plan || null,
    status: subscription?.status || null,
    daysRemaining,
    paymentSource: subscription?.paymentSource || null,
  };
}
