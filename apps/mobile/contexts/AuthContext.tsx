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
  userService,
  providerService,
  memberAccountRepository,
  onAuthChange,
  reauthenticateUser,
  deleteCurrentUser,
  OAuthProvider,
  type User as FirebaseUser,
} from '@booking-app/firebase';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import type { MemberAccount, User } from '@booking-app/shared';
import type { WithId } from '@booking-app/firebase';
import { getFirebaseErrorMessage } from '../utils';
import i18n from '../lib/i18n';

interface AuthContextValue {
  // State
  user: FirebaseUser | null;
  userData: WithId<User> | null;
  /**
   * Espace membre : le compte est relié à UN membre d'un salon Studio
   * (`memberAccounts/{uid}`, écrit par le serveur). `undefined` = pas encore
   * lu — l'aiguillage attend, sinon un membre partirait côté client.
   * `null` = pas membre (ou accès retiré).
   */
  compteMembre: MemberAccount | null | undefined;
  isLoading: boolean;
  isAuthenticated: boolean;

  // Actions
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string, phone?: string) => Promise<void>;
  signInWithApple: () => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: (password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  refreshUserData: () => Promise<void>;
  refreshCompteMembre: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userData, setUserData] = useState<WithId<User> | null>(null);
  const [compteMembre, setCompteMembre] = useState<MemberAccount | null | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);

  /** Le compte membre de `uid`, actif — ou `null`. Jamais d'exception. */
  const lireCompteMembre = async (uid: string): Promise<MemberAccount | null> => {
    const compte = await memberAccountRepository.getMine(uid).catch((err) => {
      console.warn('[AUTH] compte membre illisible', err);
      return null;
    });
    return compte?.active === true ? compte : null;
  };

  // Listen to auth state changes
  useEffect(() => {
    const unsubscribe = onAuthChange(async (firebaseUser) => {
      setUser(firebaseUser);

      if (firebaseUser) {
        // Load user data from Firestore
        try {
          const [data, compte] = await Promise.all([
            userRepository.getById(firebaseUser.uid),
            lireCompteMembre(firebaseUser.uid),
          ]);
          setCompteMembre(compte);
          setUserData(data);
          // Présence : au plus une écriture par jour, sans relecture (le
          // document vient d'être chargé). Non attendu volontairement, une
          // mesure d'audience ne doit pas retarder l'ouverture.
          if (data) {
            void userService.marquerVisite(data.id, data.lastSeenAt ?? null);
          }
        } catch (error) {
          console.error('Error loading user data:', error);
          setUserData(null);
          setCompteMembre(null);
        }
      } else {
        setUserData(null);
        setCompteMembre(null);
      }

      setIsLoading(false);
    });

    return unsubscribe;
  }, []);

  // Sign in
  const signIn = async (email: string, password: string) => {
    try {
      const { user: returnedUserData } = await authService.login({ email, password });
      // Le compte membre AVANT les données : l'aiguillage part dès que
      // `userData` arrive, et un membre ne doit pas atterrir côté client.
      setCompteMembre(await lireCompteMembre(returnedUserData.id));
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
        throw new Error(i18n.t('errors.auth.appleTokenMissing'));
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
      throw new Error(error.message || i18n.t('errors.auth.appleSignInFailed'));
    }
  };

  // Sign out
  const signOut = async () => {
    try {
      await authService.logout();
      setUserData(null);
      setCompteMembre(null);
    } catch (error: any) {
      throw new Error(i18n.t('errors.auth.signOutFailed'));
    }
  };

  // Delete account
  const deleteAccount = async (password: string) => {
    if (!user?.uid) throw new Error(i18n.t('errors.auth.noUserSignedIn'));

    try {
      // Reauthenticate before deletion
      await reauthenticateUser(password);

      // Delete provider data if user is a provider
      if (userData?.providerId) {
        await providerService.deleteProvider(userData.providerId);
      }

      // Espace membre : le lien vers la fiche du salon disparaît avec le
      // compte (le gérant voit « pas d'accès », le membre reste dans l'équipe).
      if (compteMembre) {
        await memberAccountRepository.quitter(user.uid).catch((err) => {
          console.warn('[AUTH] lien membre non supprimé', err);
        });
        setCompteMembre(null);
      }

      // Clear userData before deleting so the push token cleanup hook
      // won't try to update a deleted document
      setUserData(null);

      // Delete Firestore user document
      await userRepository.delete(user.uid);

      // Delete Firebase Auth account
      await deleteCurrentUser();
    } catch (error: any) {
      const code = error?.code || '';
      if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        throw new Error(i18n.t('errors.auth.wrongPassword'));
      }
      throw new Error(error.message || i18n.t('errors.auth.deleteAccountFailed'));
    }
  };

  // Reset password (branded email via Cloud Function)
  const resetPassword = async (email: string) => {
    try {
      const { callRequestPasswordReset } = await import('@booking-app/firebase');
      await callRequestPasswordReset(email);
    } catch (error: any) {
      console.error('[AUTH] resetPassword error:', error);
      const code = error?.code || '';
      throw new Error(getFirebaseErrorMessage(code));
    }
  };

  /** Relit le compte membre (accès retiré ou rendu pendant la session). */
  const refreshCompteMembre = async () => {
    if (!user?.uid) return;
    setCompteMembre(await lireCompteMembre(user.uid));
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
        compteMembre,
        isLoading,
        isAuthenticated: !!user,
        signIn,
        signUp,
        signInWithApple,
        signOut,
        deleteAccount,
        resetPassword,
        refreshUserData,
        refreshCompteMembre,
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
