import { userRepository } from '../repositories';
import type { User } from '@booking-app/shared';
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
   * Update user's provider ID (called when provider is created)
   */
  async setProviderId(userId: string, providerId: string): Promise<void> {
    await userRepository.update(userId, { providerId, role: 'provider' });
  }

  /**
   * Upgrade client to provider role
   */
  async upgradeToProvider(userId: string, providerId: string): Promise<void> {
    const user = await userRepository.getById(userId);
    if (!user) {
      throw new Error('Utilisateur non trouvé');
    }

    const newRole = user.role === 'client' ? 'both' : 'provider';
    await userRepository.update(userId, { providerId, role: newRole });
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
   * Delete user (soft delete - just removes from Firestore, Firebase Auth handled separately)
   */
  async deleteUser(userId: string): Promise<void> {
    await userRepository.delete(userId);
  }
}

// Singleton instance
export const userService = new UserService();
