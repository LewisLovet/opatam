'use client';

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { onAuthChange, type User as FirebaseUser } from '@booking-app/firebase';
import { authService, providerService, userRepository } from '@booking-app/firebase';
import type { User, Provider } from '@booking-app/shared';

type WithId<T> = { id: string } & T;

interface AuthContextType {
  // State
  firebaseUser: FirebaseUser | null;
  user: WithId<User> | null;
  provider: WithId<Provider> | null;
  loading: boolean;

  // Computed
  isAuthenticated: boolean;
  isProvider: boolean;
  hasCompletedOnboarding: boolean;

  // Actions
  refreshUser: () => Promise<void>;
  refreshProvider: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [user, setUser] = useState<WithId<User> | null>(null);
  const [provider, setProvider] = useState<WithId<Provider> | null>(null);
  const [loading, setLoading] = useState(true);

  // Refresh user data from Firestore
  const refreshUser = useCallback(async () => {
    if (!firebaseUser) {
      setUser(null);
      return;
    }

    try {
      const userData = await userRepository.getById(firebaseUser.uid);
      setUser(userData);
    } catch (error) {
      console.error('Error refreshing user:', error);
      setUser(null);
    }
  }, [firebaseUser]);

  // Refresh provider data from Firestore
  const refreshProvider = useCallback(async () => {
    if (!user?.providerId) {
      setProvider(null);
      return;
    }

    try {
      const providerData = await providerService.getById(user.providerId);
      setProvider(providerData);
    } catch (error) {
      console.error('Error refreshing provider:', error);
      setProvider(null);
    }
  }, [user?.providerId]);

  // Logout
  const logout = useCallback(async () => {
    try {
      await authService.logout();
      setUser(null);
      setProvider(null);
    } catch (error) {
      console.error('Error logging out:', error);
      throw error;
    }
  }, []);

  // Listen to Firebase auth state changes
  useEffect(() => {
    const unsubscribe = onAuthChange(async (fbUser) => {
      setFirebaseUser(fbUser);

      if (fbUser) {
        try {
          // Fetch user data from Firestore
          const userData = await userRepository.getById(fbUser.uid);
          setUser(userData);

          // If user has a providerId, fetch provider data
          if (userData?.providerId) {
            const providerData = await providerService.getById(userData.providerId);
            setProvider(providerData);
          } else {
            setProvider(null);
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
          setUser(null);
          setProvider(null);
        }
      } else {
        setUser(null);
        setProvider(null);
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Refresh provider when user.providerId changes
  useEffect(() => {
    if (user?.providerId && !provider) {
      refreshProvider();
    }
  }, [user?.providerId, provider, refreshProvider]);

  // Computed values
  const isAuthenticated = firebaseUser !== null && user !== null;
  const isProvider = user?.role === 'provider';
  const hasCompletedOnboarding = isProvider && user?.providerId !== null;

  const value: AuthContextType = {
    firebaseUser,
    user,
    provider,
    loading,
    isAuthenticated,
    isProvider,
    hasCompletedOnboarding,
    refreshUser,
    refreshProvider,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
