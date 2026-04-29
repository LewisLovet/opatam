import { where, orderBy, limit } from 'firebase/firestore';
import type { Article, ArticleCategory } from '@booking-app/shared';
import { BaseRepository, type WithId } from './base.repository';

/**
 * Repository for the `articles` collection (top-level, global to Opatam).
 * Articles drive the public blog at /blog and the "À la une" homepage block.
 */
export class ArticleRepository extends BaseRepository<Article> {
  protected collectionName = 'articles';

  /**
   * Get a single published article by slug. Returns null for drafts/unknown.
   * Used by /blog/[slug] page (server component).
   */
  async getPublishedBySlug(slug: string): Promise<WithId<Article> | null> {
    const results = await this.query([
      where('slug', '==', slug),
      where('status', '==', 'published'),
      limit(1),
    ]);
    return results[0] || null;
  }

  /**
   * Admin variant — finds an article by slug regardless of status.
   * Used by the admin editor to detect slug collisions.
   */
  async getBySlug(slug: string): Promise<WithId<Article> | null> {
    const results = await this.query([where('slug', '==', slug), limit(1)]);
    return results[0] || null;
  }

  /**
   * All published articles, sorted newest first. Used by /blog index.
   */
  async getPublished(maxResults = 50): Promise<WithId<Article>[]> {
    return this.query([
      where('status', '==', 'published'),
      orderBy('publishedAt', 'desc'),
      limit(maxResults),
    ]);
  }

  /**
   * Published articles in a single category. Used by /blog/categorie/[cat].
   */
  async getPublishedByCategory(
    category: ArticleCategory,
    maxResults = 50
  ): Promise<WithId<Article>[]> {
    return this.query([
      where('status', '==', 'published'),
      where('category', '==', category),
      orderBy('publishedAt', 'desc'),
      limit(maxResults),
    ]);
  }

  /**
   * Featured published articles for the homepage block.
   */
  async getFeatured(maxResults = 3): Promise<WithId<Article>[]> {
    return this.query([
      where('status', '==', 'published'),
      where('isFeatured', '==', true),
      orderBy('publishedAt', 'desc'),
      limit(maxResults),
    ]);
  }

  /**
   * "Articles similaires" — same category, excluding the one being viewed.
   */
  async getRelated(
    category: ArticleCategory,
    excludeId: string,
    maxResults = 3
  ): Promise<WithId<Article>[]> {
    const items = await this.query([
      where('status', '==', 'published'),
      where('category', '==', category),
      orderBy('publishedAt', 'desc'),
      // pull one extra so we can drop the current article
      limit(maxResults + 1),
    ]);
    return items.filter((a) => a.id !== excludeId).slice(0, maxResults);
  }

  /**
   * Admin list — every article including drafts, sorted newest first.
   */
  async getAllForAdmin(maxResults = 200): Promise<WithId<Article>[]> {
    return this.query([orderBy('updatedAt', 'desc'), limit(maxResults)]);
  }
}

export const articleRepository = new ArticleRepository();
