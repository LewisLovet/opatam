/**
 * AuthContext
 * Manages authentication state and actions using Firebase Auth
 *
 * Apple Sign-In: Included in Expo SDK, works everywhere.
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  auth,
  authService,
  userRepository,
  onAuthChange,
  OAuthProvider,
  type User as FirebaseUser,
} from '@booking-app/firebase';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
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
  signInWithApple: () => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  refreshUserData: () => Promise<void>;
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
      const { user: returnedUserData } = await authService.login({ email, password });
      setUserData(returnedUserData);
      // Also update the Firebase user state immediately (onAuthChange will also fire but this is faster)
      setUser(auth.currentUser);
    } catch (error: any) {
      const code = error?.code || '';
      throw new Error(getFirebaseErrorMessage(code));
    }
  };

  // Sign up
  const signUp = async (email: string, password: string, displayName: string, phone?: string) => {
    try {
      const { user: returnedUserData } = await authService.registerClient({
        email,
        password,
        confirmPassword: password,
        displayName,
        phone,
      });
      setUserData(returnedUserData);
      // Also update the Firebase user state immediately
      setUser(auth.currentUser);
    } catch (error: any) {
      const code = error?.code || '';
      throw new Error(getFirebaseErrorMessage(code));
    }
  };

  // Sign in with Apple (works in Expo Go — included in Expo SDK)
  const signInWithApple = async () => {
    try {
      const nonce = Crypto.randomUUID();
      const hashedNonce = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        nonce,
      );

      const appleCredential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });

      const { identityToken } = appleCredential;
      if (!identityToken) {
        throw new Error('Token Apple manquant');
      }

      const provider = new OAuthProvider('apple.com');
      const credential = provider.credential({
        idToken: identityToken,
        rawNonce: nonce,
      });

      const { user: returnedUserData } = await authService.loginWithCredential(credential);

      // Apple only sends name on first sign-in, update if we have it
      if (appleCredential.fullName?.givenName && returnedUserData) {
        const fullName = [
          appleCredential.fullName.givenName,
          appleCredential.fullName.familyName,
        ].filter(Boolean).join(' ');

        if (fullName && returnedUserData.displayName === 'Utilisateur') {
          await userRepository.update(returnedUserData.id, { displayName: fullName });
          returnedUserData.displayName = fullName;
        }
      }

      setUserData(returnedUserData);
      setUser(auth.currentUser);
    } catch (error: any) {
      // User cancelled = don't throw
      if (error?.code === 'ERR_REQUEST_CANCELED') return;
      throw new Error(error.message || 'Erreur de connexion avec Apple');
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

  // Refresh user data from Firestore
  const refreshUserData = async () => {
    if (!user?.uid) return;
    try {
      const data = await userRepository.getById(user.uid);
      setUserData(data);
    } catch (error) {
      console.error('Error refreshing user data:', error);
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
        signInWithApple,
        signOut,
        resetPassword,
        refreshUserData,
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
