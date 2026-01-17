import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  type UserCredential,
} from 'firebase/auth';
import { auth, googleProvider } from '../lib/auth';
import { userRepository } from '../repositories';
import type { User } from '@booking-app/shared';
import {
  loginSchema,
  registerClientSchema,
  registerProviderSchema,
  forgotPasswordSchema,
  type LoginInput,
  type RegisterClientInput,
  type RegisterProviderInput,
} from '@booking-app/shared';
import type { WithId } from '../repositories/base.repository';

export class AuthService {
  /**
   * Register a new client user
   */
  async registerClient(input: RegisterClientInput): Promise<{ user: WithId<User>; credential: UserCredential }> {
    // Validate input
    const validated = registerClientSchema.parse(input);

    // Create Firebase Auth user
    const credential = await createUserWithEmailAndPassword(
      auth,
      validated.email,
      validated.password
    );

    // Create Firestore user document
    const userId = credential.user.uid;
    await userRepository.createWithId(userId, {
      email: validated.email,
      displayName: validated.displayName,
      phone: validated.phone || null,
      photoURL: credential.user.photoURL,
      role: 'client',
      providerId: null,
      city: null,
      birthYear: null,
      gender: null,
      cancellationCount: 0,
    });

    const user = await userRepository.getById(userId);
    if (!user) {
      throw new Error('Erreur lors de la création du compte');
    }

    return { user, credential };
  }

  /**
   * Register a new provider user
   * SIMPLIFIE: Cree juste le User avec role: 'provider'
   * Le Provider document est cree APRES, lors de l'onboarding (via providerService.createProvider)
   */
  async registerProvider(input: RegisterProviderInput): Promise<{ user: WithId<User>; credential: UserCredential }> {
    // Validate input
    const validated = registerProviderSchema.parse(input);

    // Create Firebase Auth user
    const credential = await createUserWithEmailAndPassword(
      auth,
      validated.email,
      validated.password
    );

    // Create Firestore user document
    // Note: providerId est null - sera set lors de la creation du Provider (onboarding)
    const userId = credential.user.uid;
    await userRepository.createWithId(userId, {
      email: validated.email,
      displayName: validated.displayName,
      phone: validated.phone || null,
      photoURL: credential.user.photoURL,
      role: 'provider', // Role provider mais pas encore de Provider document
      providerId: null, // Sera rempli a l'onboarding quand le Provider est cree
      city: null,
      birthYear: null,
      gender: null,
      cancellationCount: 0,
    });

    const user = await userRepository.getById(userId);
    if (!user) {
      throw new Error('Erreur lors de la création du compte');
    }

    return { user, credential };
  }

  /**
   * Login with email and password
   */
  async login(input: LoginInput): Promise<{ user: WithId<User>; credential: UserCredential }> {
    // Validate input
    const validated = loginSchema.parse(input);

    // Sign in with Firebase Auth
    const credential = await signInWithEmailAndPassword(
      auth,
      validated.email,
      validated.password
    );

    // Get user from Firestore
    const user = await userRepository.getById(credential.user.uid);
    if (!user) {
      // Create user document if it doesn't exist (e.g., migrated user)
      await userRepository.createWithId(credential.user.uid, {
        email: credential.user.email || validated.email,
        displayName: credential.user.displayName || validated.email.split('@')[0],
        phone: credential.user.phoneNumber,
        photoURL: credential.user.photoURL,
        role: 'client',
        providerId: null,
        city: null,
        birthYear: null,
        gender: null,
        cancellationCount: 0,
      });

      const newUser = await userRepository.getById(credential.user.uid);
      if (!newUser) {
        throw new Error('Erreur lors de la connexion');
      }
      return { user: newUser, credential };
    }

    return { user, credential };
  }

  /**
   * Login with Google
   */
  async loginWithGoogle(): Promise<{ user: WithId<User>; credential: UserCredential; isNewUser: boolean }> {
    const credential = await signInWithPopup(auth, googleProvider);
    const userId = credential.user.uid;

    // Check if user exists
    let user = await userRepository.getById(userId);
    let isNewUser = false;

    if (!user) {
      // Create new user from Google profile
      isNewUser = true;
      await userRepository.createWithId(userId, {
        email: credential.user.email || '',
        displayName: credential.user.displayName || 'Utilisateur',
        phone: credential.user.phoneNumber,
        photoURL: credential.user.photoURL,
        role: 'client',
        providerId: null,
        city: null,
        birthYear: null,
        gender: null,
        cancellationCount: 0,
      });

      user = await userRepository.getById(userId);
      if (!user) {
        throw new Error('Erreur lors de la connexion avec Google');
      }
    }

    return { user, credential, isNewUser };
  }

  /**
   * Logout current user
   */
  async logout(): Promise<void> {
    await signOut(auth);
  }

  /**
   * Send password reset email
   */
  async resetPassword(email: string): Promise<void> {
    const validated = forgotPasswordSchema.parse({ email });
    await sendPasswordResetEmail(auth, validated.email);
  }

  /**
   * Get current authenticated user from Firestore
   */
  async getCurrentUser(): Promise<WithId<User> | null> {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) {
      return null;
    }

    return userRepository.getById(firebaseUser.uid);
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return auth.currentUser !== null;
  }

  /**
   * Get current Firebase Auth user
   */
  getFirebaseUser() {
    return auth.currentUser;
  }

  /**
   * Check if user has completed provider onboarding
   * (i.e., has a Provider document linked)
   */
  async hasCompletedProviderOnboarding(userId: string): Promise<boolean> {
    const user = await userRepository.getById(userId);
    return user?.providerId !== null;
  }
}

// Singleton instance
export const authService = new AuthService();
