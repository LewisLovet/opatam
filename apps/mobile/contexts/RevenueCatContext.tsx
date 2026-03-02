/**
 * RevenueCatContext
 * Initializes RevenueCat SDK, identifies the provider (Firebase UID),
 * and exposes subscription status + paywall helpers.
 *
 * - SDK configured once on mount with the test API key
 * - User identified with providerId so RevenueCat events map to the correct provider
 * - Exposes current entitlements, purchase helpers, and restore
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import { Platform } from 'react-native';
import Purchases, {
  LOG_LEVEL,
  type CustomerInfo,
  type PurchasesOffering,
} from 'react-native-purchases';
import { useAuth } from './AuthContext';
import { useProvider } from './ProviderContext';

// RevenueCat API keys (from .env.local via EXPO_PUBLIC_ prefix)
const REVENUECAT_API_KEY_IOS = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_IOS || '';
const REVENUECAT_API_KEY_ANDROID = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_ANDROID || '';

// Entitlement IDs (must match RevenueCat dashboard)
const ENTITLEMENT_SOLO = 'solo_access';
const ENTITLEMENT_TEAM = 'team_access';

interface RevenueCatContextValue {
  // State
  isReady: boolean;
  customerInfo: CustomerInfo | null;

  // Entitlements
  hasSoloAccess: boolean;
  hasTeamAccess: boolean;
  hasAnyAccess: boolean;

  // Current offering (products/plans to show in paywall)
  currentOffering: PurchasesOffering | null;

  // Actions
  purchasePackage: (packageId: string) => Promise<boolean>;
  restorePurchases: () => Promise<boolean>;
  refreshCustomerInfo: () => Promise<void>;
}

const RevenueCatContext = createContext<RevenueCatContextValue | undefined>(undefined);

export function RevenueCatProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { providerId } = useProvider();
  const [isReady, setIsReady] = useState(false);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [currentOffering, setCurrentOffering] = useState<PurchasesOffering | null>(null);

  // Derive entitlements from customerInfo
  const hasSoloAccess = !!customerInfo?.entitlements.active[ENTITLEMENT_SOLO];
  const hasTeamAccess = !!customerInfo?.entitlements.active[ENTITLEMENT_TEAM];
  const hasAnyAccess = hasSoloAccess || hasTeamAccess;

  // Initialize SDK
  useEffect(() => {
    const init = async () => {
      try {
        if (__DEV__) {
          Purchases.setLogLevel(LOG_LEVEL.DEBUG);
        }

        const apiKey = Platform.OS === 'ios'
          ? REVENUECAT_API_KEY_IOS
          : REVENUECAT_API_KEY_ANDROID;

        await Purchases.configure({ apiKey });
        setIsReady(true);
      } catch (error) {
        console.error('[RevenueCat] Init error:', error);
      }
    };

    init();
  }, []);

  // Identify user with providerId (Firebase UID) when available
  useEffect(() => {
    if (!isReady || !providerId) return;

    const identify = async () => {
      try {
        const info = await Purchases.logIn(providerId);
        setCustomerInfo(info.customerInfo);
      } catch (error) {
        console.error('[RevenueCat] Login error:', error);
      }
    };

    identify();
  }, [isReady, providerId]);

  // Logout from RevenueCat when user signs out
  useEffect(() => {
    if (!isReady) return;
    if (!user) {
      // User signed out — reset RevenueCat to anonymous
      Purchases.logOut().catch(() => {});
      setCustomerInfo(null);
    }
  }, [isReady, user]);

  // Fetch offerings once identified
  useEffect(() => {
    if (!isReady || !providerId) return;

    const fetchOfferings = async () => {
      try {
        const offerings = await Purchases.getOfferings();
        setCurrentOffering(offerings.current);
      } catch (error) {
        console.error('[RevenueCat] Offerings error:', error);
      }
    };

    fetchOfferings();
  }, [isReady, providerId]);

  // Listen to customer info updates (purchases, renewals, cancellations)
  useEffect(() => {
    if (!isReady) return;

    const listener = (info: CustomerInfo) => {
      setCustomerInfo(info);
    };

    Purchases.addCustomerInfoUpdateListener(listener);
    return () => {
      Purchases.removeCustomerInfoUpdateListener(listener);
    };
  }, [isReady]);

  // Purchase a specific package from the current offering
  const purchasePackage = useCallback(async (packageId: string): Promise<boolean> => {
    if (!currentOffering) return false;

    const pkg = currentOffering.availablePackages.find(
      (p) => p.identifier === packageId
    );
    if (!pkg) {
      console.error('[RevenueCat] Package not found:', packageId);
      return false;
    }

    try {
      const { customerInfo: updatedInfo } = await Purchases.purchasePackage(pkg);
      setCustomerInfo(updatedInfo);

      // Check if the purchase granted an entitlement
      const hasEntitlement =
        !!updatedInfo.entitlements.active[ENTITLEMENT_SOLO] ||
        !!updatedInfo.entitlements.active[ENTITLEMENT_TEAM];

      return hasEntitlement;
    } catch (error: any) {
      // User cancelled — not an error
      if (error.userCancelled) return false;
      console.error('[RevenueCat] Purchase error:', error);
      throw error;
    }
  }, [currentOffering]);

  // Restore previous purchases (e.g. reinstall or new device)
  const restorePurchases = useCallback(async (): Promise<boolean> => {
    try {
      const info = await Purchases.restorePurchases();
      setCustomerInfo(info);

      const hasEntitlement =
        !!info.entitlements.active[ENTITLEMENT_SOLO] ||
        !!info.entitlements.active[ENTITLEMENT_TEAM];

      return hasEntitlement;
    } catch (error) {
      console.error('[RevenueCat] Restore error:', error);
      throw error;
    }
  }, []);

  // Manually refresh customer info
  const refreshCustomerInfo = useCallback(async () => {
    try {
      const info = await Purchases.getCustomerInfo();
      setCustomerInfo(info);
    } catch (error) {
      console.error('[RevenueCat] Refresh error:', error);
    }
  }, []);

  return (
    <RevenueCatContext.Provider
      value={{
        isReady,
        customerInfo,
        hasSoloAccess,
        hasTeamAccess,
        hasAnyAccess,
        currentOffering,
        purchasePackage,
        restorePurchases,
        refreshCustomerInfo,
      }}
    >
      {children}
    </RevenueCatContext.Provider>
  );
}

export function useRevenueCat() {
  const context = useContext(RevenueCatContext);
  if (!context) {
    throw new Error('useRevenueCat must be used within a RevenueCatProvider');
  }
  return context;
}
