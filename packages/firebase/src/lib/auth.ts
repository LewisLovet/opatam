import {
  getAuth,
  initializeAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
  OAuthProvider,
  signInWithCredential,
  updateEmail as firebaseUpdateEmail,
  updatePassword as firebaseUpdatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  deleteUser as firebaseDeleteUser,
  type Auth,
  type User,
  type UserCredential,
} from 'firebase/auth';
import { app } from './config';

/**
 * Firebase Auth instance
 * In React Native: uses initializeAuth with AsyncStorage persistence
 * On Web: uses default getAuth (indexedDB persistence)
 */
function getAuthInstance(): Auth {
  // Detect React Native environment
  const isReactNative =
    typeof navigator !== 'undefined' && navigator.product === 'ReactNative';

  if (isReactNative) {
    try {
      // Dynamic imports so web bundlers don't try to resolve RN-only modules
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { getReactNativePersistence } = require('firebase/auth');
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      return initializeAuth(app, {
        persistence: getReactNativePersistence(AsyncStorage),
      });
    } catch {
      // Fallback if AsyncStorage or RN persistence not available
      return getAuth(app);
    }
  }

  return getAuth(app);
}

export const auth: Auth = getAuthInstance();

/**
 * Sign in with email and password
 */
export async function signInWithEmail(
  email: string,
  password: string
): Promise<UserCredential> {
  return signInWithEmailAndPassword(auth, email, password);
}

/**
 * Create a new user with email and password
 */
export async function createUserWithEmail(
  email: string,
  password: string
): Promise<UserCredential> {
  return createUserWithEmailAndPassword(auth, email, password);
}

/**
 * Sign out the current user
 */
export async function signOutUser(): Promise<void> {
  return signOut(auth);
}

/**
 * Send password reset email
 */
export async function resetPassword(email: string): Promise<void> {
  return sendPasswordResetEmail(auth, email);
}

/**
 * Subscribe to auth state changes
 */
export function onAuthChange(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback);
}

/**
 * Get the current user
 */
export function getCurrentUser(): User | null {
  return auth.currentUser;
}

/**
 * Update user email (requires recent authentication)
 */
export async function updateUserEmail(newEmail: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('No user logged in');
  return firebaseUpdateEmail(user, newEmail);
}

/**
 * Update user password (requires recent authentication)
 */
export async function updateUserPassword(newPassword: string): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('No user logged in');
  return firebaseUpdatePassword(user, newPassword);
}

/**
 * Reauthenticate user with email/password (required before sensitive operations)
 */
export async function reauthenticateUser(
  currentPassword: string
): Promise<UserCredential> {
  const user = auth.currentUser;
  if (!user || !user.email) throw new Error('No user logged in');
  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  return reauthenticateWithCredential(user, credential);
}

/**
 * Delete the current user account (requires recent authentication)
 */
export async function deleteCurrentUser(): Promise<void> {
  const user = auth.currentUser;
  if (!user) throw new Error('No user logged in');
  return firebaseDeleteUser(user);
}

// Re-export types and functions for convenience
export {
  OAuthProvider,
  signInWithCredential,
  EmailAuthProvider,
  reauthenticateWithCredential,
  type User,
  type UserCredential,
};
