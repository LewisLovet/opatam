import { where, limit } from 'firebase/firestore';
import type { User } from '@booking-app/shared';
import { BaseRepository, type WithId } from './base.repository';

/**
 * Repository for users collection
 */
export class UserRepository extends BaseRepository<User> {
  protected collectionName = 'users';

  /**
   * Get user by email
   */
  async getByEmail(email: string): Promise<WithId<User> | null> {
    const results = await this.query([
      where('email', '==', email),
      limit(1),
    ]);

    return results[0] || null;
  }

  /**
   * Get user by provider ID
   */
  async getByProviderId(providerId: string): Promise<WithId<User> | null> {
    const results = await this.query([
      where('providerId', '==', providerId),
      limit(1),
    ]);

    return results[0] || null;
  }

  /**
   * Get users by role
   */
  async getByRole(role: User['role']): Promise<WithId<User>[]> {
    return this.query([where('role', '==', role)]);
  }

  /**
   * Get users by city
   */
  async getByCity(city: string): Promise<WithId<User>[]> {
    return this.query([where('city', '==', city)]);
  }

  /**
   * Increment cancellation count
   */
  async incrementCancellationCount(id: string): Promise<void> {
    const user = await this.getById(id);
    if (user) {
      await this.update(id, {
        cancellationCount: user.cancellationCount + 1,
      });
    }
  }
}

// Singleton instance
export const userRepository = new UserRepository();
