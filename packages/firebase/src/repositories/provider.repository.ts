import { where, limit, orderBy, type QueryConstraint } from 'firebase/firestore';
import type { Provider } from '@booking-app/shared';
import { normalizeCity } from '@booking-app/shared';
import { BaseRepository, type WithId } from './base.repository';

export interface ProviderSearchFilters {
  category?: string;
  city?: string;
  query?: string;
}

/**
 * Repository for providers collection
 */
export class ProviderRepository extends BaseRepository<Provider> {
  protected collectionName = 'providers';

  /**
   * Get provider by slug
   */
  async getBySlug(slug: string): Promise<WithId<Provider> | null> {
    const results = await this.query([
      where('slug', '==', slug),
      limit(1),
    ]);

    return results[0] || null;
  }

  /**
   * Get provider by user ID
   */
  async getByUserId(userId: string): Promise<WithId<Provider> | null> {
    const results = await this.query([
      where('userId', '==', userId),
      limit(1),
    ]);

    return results[0] || null;
  }

  /**
   * Get providers by category
   */
  async getByCategory(category: string): Promise<WithId<Provider>[]> {
    return this.query([
      where('category', '==', category),
      where('isPublished', '==', true),
      orderBy('rating.average', 'desc'),
    ]);
  }

  /**
   * Get all published providers
   */
  async getPublished(maxResults?: number): Promise<WithId<Provider>[]> {
    const constraints = [
      where('isPublished', '==', true),
      orderBy('createdAt', 'desc'),
    ];

    if (maxResults) {
      constraints.push(limit(maxResults) as unknown as typeof constraints[0]);
    }

    return this.query(constraints);
  }

  /**
   * Get verified providers
   */
  async getVerified(): Promise<WithId<Provider>[]> {
    return this.query([
      where('isVerified', '==', true),
      where('isPublished', '==', true),
    ]);
  }

  /**
   * Get providers by plan
   */
  async getByPlan(plan: Provider['plan']): Promise<WithId<Provider>[]> {
    return this.query([where('plan', '==', plan)]);
  }

  /**
   * Get top rated providers
   */
  async getTopRated(maxResults: number = 10): Promise<WithId<Provider>[]> {
    return this.query([
      where('isPublished', '==', true),
      where('rating.count', '>', 0),
      orderBy('rating.count', 'desc'),
      orderBy('rating.average', 'desc'),
      limit(maxResults),
    ]);
  }

  /**
   * Check if slug is available
   */
  async isSlugAvailable(slug: string, excludeId?: string): Promise<boolean> {
    const existing = await this.getBySlug(slug);
    if (!existing) return true;
    return excludeId ? existing.id === excludeId : false;
  }

  /**
   * Update provider rating
   */
  async updateRating(
    id: string,
    rating: Provider['rating']
  ): Promise<void> {
    await this.update(id, { rating });
  }

  /**
   * Toggle published status
   */
  async togglePublished(id: string, isPublished: boolean): Promise<void> {
    await this.update(id, { isPublished });
  }

  /**
   * Search providers for public page
   * Filters on isPublished: true, category, and city
   * Text search (query) is handled client-side for MVP
   */
  async searchProviders(filters: ProviderSearchFilters): Promise<WithId<Provider>[]> {
    const constraints: QueryConstraint[] = [
      where('isPublished', '==', true),
    ];

    // Filter by category if provided
    if (filters.category) {
      constraints.push(where('category', '==', filters.category));
    }

    // Filter by city if provided (uses array-contains on normalized cities)
    if (filters.city) {
      const normalizedCity = normalizeCity(filters.city);
      constraints.push(where('cities', 'array-contains', normalizedCity));
    }

    // Order by rating
    constraints.push(orderBy('rating.average', 'desc'));

    let results = await this.query(constraints);

    // Client-side text search for MVP (searches in businessName and description)
    if (filters.query) {
      const queryLower = filters.query.toLowerCase();
      results = results.filter(
        (provider) =>
          provider.businessName.toLowerCase().includes(queryLower) ||
          provider.description.toLowerCase().includes(queryLower)
      );
    }

    return results;
  }
}

// Singleton instance
export const providerRepository = new ProviderRepository();
