import { userRepository } from '../repositories';
import type { User, NotificationSettings } from '@booking-app/shared';
import type { WithId } from '../repositories/base.repository';

export class UserService {
  /**
   * Get user by ID
   */
  async getById(userId: string): Promise<WithId<User> | null> {
    return userRepository.getById(userId);
  }

  /**
   * Get user by email
   */
  async getByEmail(email: string): Promise<WithId<User> | null> {
    return userRepository.getByEmail(email);
  }

  /**
   * Update user profile
   */
  async updateProfile(
    userId: string,
    data: Partial<Pick<User, 'displayName' | 'phone' | 'city' | 'birthYear' | 'gender' | 'photoURL'>>
  ): Promise<void> {
    await userRepository.update(userId, data);
  }

  /**
   * Marque une visite du jour, au plus une fois par jour.
   *
   * `dejaVu` est la valeur DEJA CHARGEE du document : on ne relit rien.
   * Si elle date d'aujourd'hui, on n'ecrit pas — sinon chaque ouverture
   * d'application coûterait une ecriture. L'echec est avale : une mesure
   * d'audience ne doit jamais empecher quelqu'un d'utiliser l'application.
   */
  async marquerVisite(userId: string, dejaVu?: Date | null): Promise<void> {
    const maintenant = new Date();
    if (dejaVu) {
      const vu = new Date(dejaVu);
      const memeJour =
        vu.getFullYear() === maintenant.getFullYear() &&
        vu.getMonth() === maintenant.getMonth() &&
        vu.getDate() === maintenant.getDate();
      if (memeJour) return;
    }
    try {
      await userRepository.update(userId, { lastSeenAt: maintenant } as never);
    } catch {
      // Silencieux : voir l'en-tête.
    }
  }

  /**
   * Update user's provider ID (called when provider is created)
   */
  async setProviderId(userId: string, providerId: string): Promise<void> {
    await userRepository.update(userId, { providerId, role: 'provider' });
  }

  /**
   * Increment cancellation count (for no-show tracking)
   */
  async incrementCancellationCount(userId: string): Promise<void> {
    await userRepository.incrementCancellationCount(userId);
  }

  /**
   * Get users by role
   */
  async getByRole(role: User['role']): Promise<WithId<User>[]> {
    return userRepository.getByRole(role);
  }

  /**
   * Check if email is already registered
   */
  async isEmailRegistered(email: string): Promise<boolean> {
    const user = await userRepository.getByEmail(email);
    return user !== null;
  }

  /**
   * Update notification settings for a user (client)
   */
  async updateNotificationSettings(userId: string, settings: Partial<NotificationSettings>): Promise<void> {
    const user = await userRepository.getById(userId);
    if (!user) throw new Error('Utilisateur non trouvé');

    const current = user.notificationSettings ?? {
      pushEnabled: true,
      emailEnabled: true,
      reminderNotifications: true,
      confirmationNotifications: true,
      cancellationNotifications: true,
      rescheduleNotifications: true,
    };

    await userRepository.update(userId, {
      notificationSettings: { ...current, ...settings },
    });
  }

  /**
   * Delete user (soft delete - just removes from Firestore, Firebase Auth handled separately)
   */
  async deleteUser(userId: string): Promise<void> {
    await userRepository.delete(userId);
  }
}

// Singleton instance
export const userService = new UserService();
