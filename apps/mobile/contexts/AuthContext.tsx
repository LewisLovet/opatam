/**
 * AuthContext
 * Manages authentication state and actions using Firebase Auth
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  auth,
  authService,
  userRepository,
  onAuthChange,
  type User as FirebaseUser,
} from '@booking-app/firebase';
import type { User } from '@booking-app/shared';
import type { WithId } from '@booking-app/firebase';
import { getFirebaseErrorMessage } from '../utils';

interface AuthContextValue {
  // State
  user: FirebaseUser | null;
  userData: WithId<User> | null;
  isLoading: boolean;
  isAuthenticated: boolean;

  // Actions
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string, phone?: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userData, setUserData] = useState<WithId<User> | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Listen to auth state changes
  useEffect(() => {
    const unsubscribe = onAuthChange(async (firebaseUser) => {
      setUser(firebaseUser);

      if (firebaseUser) {
        // Load user data from Firestore
        try {
          const data = await userRepository.getById(firebaseUser.uid);
          setUserData(data);
        } catch (error) {
          console.error('Error loading user data:', error);
          setUserData(null);
        }
      } else {
        setUserData(null);
      }

      setIsLoading(false);
    });

    return unsubscribe;
  }, []);

  // Sign in
  const signIn = async (email: string, password: string) => {
    try {
      const { user: userData } = await authService.login({ email, password });
      setUserData(userData);
    } catch (error: any) {
      const code = error?.code || '';
      throw new Error(getFirebaseErrorMessage(code));
    }
  };

  // Sign up
  const signUp = async (email: string, password: string, displayName: string, phone?: string) => {
    try {
      const { user: userData } = await authService.registerClient({
        email,
        password,
        confirmPassword: password,
        displayName,
        phone,
      });
      setUserData(userData);
    } catch (error: any) {
      const code = error?.code || '';
      throw new Error(getFirebaseErrorMessage(code));
    }
  };

  // Sign out
  const signOut = async () => {
    try {
      await authService.logout();
      setUserData(null);
    } catch (error: any) {
      throw new Error('Erreur lors de la déconnexion');
    }
  };

  // Reset password
  const resetPassword = async (email: string) => {
    try {
      await authService.resetPassword(email);
    } catch (error: any) {
      const code = error?.code || '';
      throw new Error(getFirebaseErrorMessage(code));
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        userData,
        isLoading,
        isAuthenticated: !!user,
        signIn,
        signUp,
        signOut,
        resetPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
