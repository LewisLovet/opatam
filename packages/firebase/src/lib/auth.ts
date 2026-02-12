import {
  getAuth,
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
 * Note: React Native persistence is handled separately in the mobile app
 */
function getAuthInstance(): Auth {
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
