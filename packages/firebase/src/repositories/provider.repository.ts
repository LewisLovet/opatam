import { where, limit, orderBy, type QueryConstraint, type DocumentSnapshot } from 'firebase/firestore';
import type { Provider } from '@booking-app/shared';
import { normalizeCity } from '@booking-app/shared';
import { BaseRepository, type WithId } from './base.repository';

export interface PaginatedResult<T> {
  items: WithId<T>[];
  lastDoc: DocumentSnapshot | null;
  hasMore: boolean;
}

export interface ProviderSearchFilters {
  category?: string;
  city?: string;
  region?: string;
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
   * Get published providers by city (for nearby search)
   */
  async getPublishedByCity(city: string, maxResults: number = 50): Promise<WithId<Provider>[]> {
    const normalizedCity = normalizeCity(city);
    return this.query([
      where('isPublished', '==', true),
      where('cities', 'array-contains', normalizedCity),
      orderBy('rating.average', 'desc'),
      limit(maxResults),
    ]);
  }

  /**
   * Get all published providers (limited, for nearby fallback when no city match)
   */
  async getPublishedAll(maxResults: number = 30): Promise<WithId<Provider>[]> {
    return this.query([
      where('isPublished', '==', true),
      orderBy('rating.average', 'desc'),
      limit(maxResults),
    ]);
  }

  /**
   * Get published providers by region
   */
  async getPublishedByRegion(region: string, maxResults: number = 50): Promise<WithId<Provider>[]> {
    return this.query([
      where('isPublished', '==', true),
      where('region', '==', region),
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
   * Text search uses array-contains on searchTokens for word-based matching
   */
  async searchProviders(filters: ProviderSearchFilters): Promise<WithId<Provider>[]> {
    const constraints: QueryConstraint[] = [
      where('isPublished', '==', true),
    ];

    // Filter by category if provided
    if (filters.category) {
      constraints.push(where('category', '==', filters.category));
    }

    // Filter by region if provided (== filter, compatible with array-contains)
    if (filters.region) {
      constraints.push(where('region', '==', filters.region));
    }

    // Normalize search query token
    const searchToken = filters.query && filters.query.length >= 3
      ? filters.query
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]/g, '')
      : null;

    // Note: Firestore can only have ONE array-contains per query
    // If we have both city and search query, we need to do client-side filtering for one of them
    if (filters.city && searchToken) {
      // Use searchTokens for query, filter city client-side
      constraints.push(where('searchTokens', 'array-contains', searchToken));
      constraints.push(orderBy('rating.average', 'desc'));

      const results = await this.query(constraints);
      const normalizedCity = normalizeCity(filters.city);
      return results.filter((provider) => provider.cities.includes(normalizedCity));
    }

    // Filter by city if provided (uses array-contains on normalized cities)
    if (filters.city) {
      const normalizedCity = normalizeCity(filters.city);
      constraints.push(where('cities', 'array-contains', normalizedCity));
    }

    // If query provided, use array-contains on searchTokens
    if (searchToken) {
      constraints.push(where('searchTokens', 'array-contains', searchToken));
    }

    // Order by rating
    constraints.push(orderBy('rating.average', 'desc'));

    return this.query(constraints);
  }

  /**
   * Search providers with pagination support
   * Returns paginated results with cursor for infinite scroll
   */
  async searchProvidersPaginated(
    filters: ProviderSearchFilters,
    pageSize: number = 10,
    cursor?: DocumentSnapshot
  ): Promise<PaginatedResult<Provider>> {
    const constraints: QueryConstraint[] = [
      where('isPublished', '==', true),
    ];

    // Filter by category if provided
    if (filters.category) {
      constraints.push(where('category', '==', filters.category));
    }

    // Filter by region if provided (== filter, compatible with array-contains)
    if (filters.region) {
      constraints.push(where('region', '==', filters.region));
    }

    // Normalize search query token
    const searchToken = filters.query && filters.query.length >= 3
      ? filters.query
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]/g, '')
      : null;

    // Note: Firestore can only have ONE array-contains per query
    // If we have both city and search query, we need to fetch more and filter client-side
    if (filters.city && searchToken) {
      // Use searchTokens for query, filter city client-side
      // Fetch more to compensate for client-side filtering
      constraints.push(where('searchTokens', 'array-contains', searchToken));
      constraints.push(orderBy('rating.average', 'desc'));

      // Fetch extra to have enough after filtering
      const fetchSize = pageSize * 3;
      const result = await this.queryPaginated(constraints, fetchSize, cursor);
      const normalizedCity = normalizeCity(filters.city);
      const filteredItems = result.items.filter((provider) =>
        provider.cities.includes(normalizedCity)
      );

      // Take only pageSize items
      const items = filteredItems.slice(0, pageSize);
      // hasMore is true if we got more filtered results OR if there are more unfiltered results
      const hasMore = filteredItems.length > pageSize || result.hasMore;

      return { items, lastDoc: result.lastDoc, hasMore };
    }

    // Filter by city if provided (uses array-contains on normalized cities)
    if (filters.city) {
      const normalizedCity = normalizeCity(filters.city);
      constraints.push(where('cities', 'array-contains', normalizedCity));
    }

    // If query provided, use array-contains on searchTokens
    if (searchToken) {
      constraints.push(where('searchTokens', 'array-contains', searchToken));
    }

    // Order by rating
    constraints.push(orderBy('rating.average', 'desc'));

    return this.queryPaginated(constraints, pageSize, cursor);
  }
}

// Singleton instance
export const providerRepository = new ProviderRepository();
