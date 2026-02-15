import { where, orderBy, limit } from 'firebase/firestore';
import type { Review } from '@booking-app/shared';
import { BaseRepository, type WithId } from './base.repository';

/**
 * Repository for reviews collection
 */
export class ReviewRepository extends BaseRepository<Review> {
  protected collectionName = 'reviews';

  /**
   * Get reviews by provider
   */
  async getByProvider(providerId: string): Promise<WithId<Review>[]> {
    return this.query([
      where('providerId', '==', providerId),
      where('isPublic', '==', true),
      orderBy('createdAt', 'desc'),
    ]);
  }

  /**
   * Get all reviews by provider (including private)
   */
  async getAllByProvider(providerId: string): Promise<WithId<Review>[]> {
    return this.query([
      where('providerId', '==', providerId),
      orderBy('createdAt', 'desc'),
    ]);
  }

  /**
   * Get review by booking ID
   */
  async getByBooking(bookingId: string): Promise<WithId<Review> | null> {
    const results = await this.query([
      where('bookingId', '==', bookingId),
      limit(1),
    ]);

    return results[0] || null;
  }

  /**
   * Get reviews by client
   */
  async getByClient(clientId: string): Promise<WithId<Review>[]> {
    return this.query([
      where('clientId', '==', clientId),
      orderBy('createdAt', 'desc'),
    ]);
  }

  /**
   * Get reviews by member
   */
  async getByMember(providerId: string, memberId: string): Promise<WithId<Review>[]> {
    return this.query([
      where('providerId', '==', providerId),
      where('memberId', '==', memberId),
      where('isPublic', '==', true),
      orderBy('createdAt', 'desc'),
    ]);
  }

  /**
   * Get recent reviews for provider
   */
  async getRecentByProvider(providerId: string, maxResults: number = 5): Promise<WithId<Review>[]> {
    return this.query([
      where('providerId', '==', providerId),
      where('isPublic', '==', true),
      orderBy('createdAt', 'desc'),
      limit(maxResults),
    ]);
  }

  /**
   * Get reviews by rating
   */
  async getByRating(providerId: string, rating: number): Promise<WithId<Review>[]> {
    return this.query([
      where('providerId', '==', providerId),
      where('rating', '==', rating),
      where('isPublic', '==', true),
      orderBy('createdAt', 'desc'),
    ]);
  }

  /**
   * Get high-rated reviews (4-5 stars)
   */
  async getHighRated(providerId: string, maxResults: number = 10): Promise<WithId<Review>[]> {
    return this.query([
      where('providerId', '==', providerId),
      where('rating', '>=', 4),
      where('isPublic', '==', true),
      orderBy('rating', 'desc'),
      orderBy('createdAt', 'desc'),
      limit(maxResults),
    ]);
  }

  /**
   * Get existing review by clientId for a provider (authenticated dedup)
   */
  async getByClientForProvider(clientId: string, providerId: string): Promise<WithId<Review> | null> {
    const results = await this.query([
      where('clientId', '==', clientId),
      where('providerId', '==', providerId),
      limit(1),
    ]);
    return results[0] || null;
  }

  /**
   * Get existing review by email for a provider (anonymous dedup)
   */
  async getByEmailForProvider(clientEmail: string, providerId: string): Promise<WithId<Review> | null> {
    const results = await this.query([
      where('clientEmail', '==', clientEmail.toLowerCase().trim()),
      where('providerId', '==', providerId),
      limit(1),
    ]);
    return results[0] || null;
  }

  /**
   * Check if client has reviewed booking
   */
  async hasReviewedBooking(clientId: string, bookingId: string): Promise<boolean> {
    const results = await this.query([
      where('clientId', '==', clientId),
      where('bookingId', '==', bookingId),
      limit(1),
    ]);

    return results.length > 0;
  }

  /**
   * Toggle review visibility
   */
  async togglePublic(id: string, isPublic: boolean): Promise<void> {
    await this.update(id, { isPublic });
  }

  /**
   * Calculate average rating for provider
   */
  async calculateAverageRating(providerId: string): Promise<{
    average: number;
    count: number;
    distribution: { 1: number; 2: number; 3: number; 4: number; 5: number };
  }> {
    const reviews = await this.getAllByProvider(providerId);

    if (reviews.length === 0) {
      return {
        average: 0,
        count: 0,
        distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      };
    }

    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let total = 0;

    for (const review of reviews) {
      total += review.rating;
      distribution[review.rating as 1 | 2 | 3 | 4 | 5]++;
    }

    return {
      average: Math.round((total / reviews.length) * 10) / 10,
      count: reviews.length,
      distribution,
    };
  }

  /**
   * Count reviews by provider
   */
  async countByProvider(providerId: string): Promise<number> {
    const reviews = await this.getByProvider(providerId);
    return reviews.length;
  }
}

// Singleton instance
export const reviewRepository = new ReviewRepository();
