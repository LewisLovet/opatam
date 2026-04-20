import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithCredential,
  signOut,
  sendPasswordResetEmail,
  type UserCredential,
  type AuthCredential,
} from 'firebase/auth';
import { auth } from '../lib/auth';
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
   * Error thrown when a user tries to register with an email that already
   * belongs to a real client/provider account. Caught by the UI to show
   * a "Cet email est déjà utilisé" message with a "Se connecter" CTA.
   */
  static readonly EMAIL_ALREADY_USED = 'EMAIL_ALREADY_USED';

  /**
   * Look up an existing Auth account for this email by attempting to sign
   * in with the provided password. Used by registerClient/registerProvider
   * to detect the "upgrade an affiliate account" case.
   *
   * Returns the WithId<User> if found, null if no account exists.
   * Throws if an account exists but the password is wrong.
   */
  private async tryLoginExisting(
    email: string,
    password: string,
  ): Promise<{ user: WithId<User>; credential: UserCredential } | null> {
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      const userId = credential.user.uid;
      const user = await userRepository.getById(userId);
      if (!user) return null; // Auth exists but no Firestore doc — treated as new
      return { user, credential };
    } catch (err: any) {
      // auth/user-not-found or auth/invalid-credential → no account
      if (
        err?.code === 'auth/user-not-found' ||
        err?.code === 'auth/invalid-credential' ||
        err?.code === 'auth/invalid-email'
      ) {
        return null;
      }
      // auth/wrong-password → account exists but password incorrect
      // → propagate so the UI can tell the user
      throw err;
    }
  }

  /**
   * Register a new client user.
   *
   * If an account already exists for this email:
   *  - and its role is 'affiliate' → upgrade it to 'client' (preserving
   *    affiliateId). Requires the user's current password to match.
   *  - and its role is 'client' or 'provider' → reject with EMAIL_ALREADY_USED.
   */
  async registerClient(input: RegisterClientInput): Promise<{ user: WithId<User>; credential: UserCredential }> {
    const validated = registerClientSchema.parse(input);

    // Upgrade path — existing user (probably an affiliate)
    const existing = await this.tryLoginExisting(validated.email, validated.password);
    if (existing) {
      if (existing.user.role === 'affiliate') {
        await userRepository.update(existing.user.id, {
          role: 'client',
          displayName: validated.displayName,
          phone: validated.phone || null,
        });
        const refreshed = await userRepository.getById(existing.user.id);
        if (!refreshed) throw new Error('Erreur lors de la mise à jour du compte');
        return { user: refreshed, credential: existing.credential };
      }
      // Real client or provider already exists → refuse duplicate
      throw new Error(AuthService.EMAIL_ALREADY_USED);
    }

    // Fresh register
    const credential = await createUserWithEmailAndPassword(
      auth,
      validated.email,
      validated.password
    );
    const userId = credential.user.uid;
    await userRepository.createWithId(userId, {
      email: validated.email,
      displayName: validated.displayName,
      phone: validated.phone || null,
      photoURL: credential.user.photoURL,
      role: 'client',
      providerId: null,
      affiliateId: null,
      city: null,
      birthYear: null,
      gender: null,
      cancellationCount: 0,
      pushTokens: [],
    });

    const user = await userRepository.getById(userId);
    if (!user) throw new Error('Erreur lors de la création du compte');
    return { user, credential };
  }

  /**
   * Register a new provider user.
   *
   * Same upgrade logic as registerClient — an existing 'affiliate' role
   * can be upgraded to 'provider' preserving affiliateId. The provider
   * document itself is created later during onboarding.
   */
  async registerProvider(input: RegisterProviderInput): Promise<{ user: WithId<User>; credential: UserCredential }> {
    const validated = registerProviderSchema.parse(input);

    const existing = await this.tryLoginExisting(validated.email, validated.password);
    if (existing) {
      if (existing.user.role === 'affiliate') {
        await userRepository.update(existing.user.id, {
          role: 'provider',
          displayName: validated.displayName,
          phone: validated.phone || null,
          // providerId stays null until provider doc is created in onboarding
        });
        const refreshed = await userRepository.getById(existing.user.id);
        if (!refreshed) throw new Error('Erreur lors de la mise à jour du compte');
        return { user: refreshed, credential: existing.credential };
      }
      throw new Error(AuthService.EMAIL_ALREADY_USED);
    }

    // Fresh register
    const credential = await createUserWithEmailAndPassword(
      auth,
      validated.email,
      validated.password
    );
    const userId = credential.user.uid;
    await userRepository.createWithId(userId, {
      email: validated.email,
      displayName: validated.displayName,
      phone: validated.phone || null,
      photoURL: credential.user.photoURL,
      role: 'provider',
      providerId: null,
      affiliateId: null,
      city: null,
      birthYear: null,
      gender: null,
      cancellationCount: 0,
      pushTokens: [],
    });

    const user = await userRepository.getById(userId);
    if (!user) throw new Error('Erreur lors de la création du compte');
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
        affiliateId: null,
        city: null,
        birthYear: null,
        gender: null,
        cancellationCount: 0,
        pushTokens: [],
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
   * Login with a Firebase credential (Apple from native SDKs)
   * Used by mobile app for native social sign-in
   */
  async loginWithCredential(credential: AuthCredential): Promise<{ user: WithId<User>; credential: UserCredential; isNewUser: boolean }> {
    const userCredential = await signInWithCredential(auth, credential);
    const userId = userCredential.user.uid;

    let user = await userRepository.getById(userId);
    let isNewUser = false;

    if (!user) {
      isNewUser = true;
      await userRepository.createWithId(userId, {
        email: userCredential.user.email || '',
        displayName: userCredential.user.displayName || 'Utilisateur',
        phone: userCredential.user.phoneNumber,
        photoURL: userCredential.user.photoURL,
        role: 'client',
        providerId: null,
        affiliateId: null,
        city: null,
        birthYear: null,
        gender: null,
        cancellationCount: 0,
        pushTokens: [],
      });

      user = await userRepository.getById(userId);
      if (!user) {
        throw new Error('Erreur lors de la connexion');
      }
    }

    return { user, credential: userCredential, isNewUser };
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
