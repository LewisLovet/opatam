import { serverTimestamp } from 'firebase/firestore';
import type { LandingGallery, LandingGalleryItem } from '@booking-app/shared';
import { BaseRepository, type WithId } from './base.repository';

/**
 * Repository for the `landingGalleries` collection.
 *
 * One document per vertical landing page (doc ID = vertical slug,
 * e.g. `nail-artist`). The doc holds an ordered list of image items
 * that the landing renders as a marquee.
 *
 * Why a single doc per vertical (and not a subcollection of items):
 *  - Galleries are tiny (10-20 items max in practice).
 *  - The landing reads the WHOLE gallery on every page render — a
 *    single doc read is cheaper than a subcollection query.
 *  - Atomic writes when reordering / editing items.
 *
 * Item ordering: items carry an `order` field. The repository sorts
 * by `order` ascending before returning to the caller, so consumers
 * never have to think about it.
 */
export class LandingGalleryRepository extends BaseRepository<LandingGallery> {
  protected collectionName = 'landingGalleries';

  /**
   * Fetch a vertical's gallery by slug. Returns `null` when the doc
   * doesn't exist yet (= no admin has populated it) — the landing
   * falls back to placeholders in that case.
   */
  async getBySlug(slug: string): Promise<WithId<LandingGallery> | null> {
    const doc = await this.getById(slug);
    if (!doc) return null;
    // Stable sort by `order` before returning. Defensive — admin
    // writes should already preserve order, but a manual Firestore
    // edit could break it.
    const items = [...(doc.items ?? [])].sort((a, b) => a.order - b.order);
    return { ...doc, items };
  }

  /**
   * Replace the entire item list for a vertical. Uses
   * `createWithId(slug)` under the hood — slug is the doc ID, so a
   * create-or-overwrite is the right semantic for the "save" button
   * in the admin.
   *
   * The `items` array is renumbered (`order` = index × 10) so future
   * inserts in the middle have room without renumbering everything.
   */
  async upsert(slug: string, items: LandingGalleryItem[]): Promise<void> {
    const normalisedItems = items.map((item, idx) => ({
      ...item,
      order: idx * 10,
    }));
    await this.createWithId(slug, {
      slug,
      items: normalisedItems,
      // BaseRepository.createWithId injects createdAt / updatedAt
      // via serverTimestamp(). Keep one explicit too in case the
      // base impl evolves — cheap belt-and-braces.
      updatedAt: serverTimestamp() as unknown as Date,
    } as Omit<LandingGallery, 'id' | 'createdAt' | 'updatedAt'> & { updatedAt: Date });
  }
}

export const landingGalleryRepository = new LandingGalleryRepository();
