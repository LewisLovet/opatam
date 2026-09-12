import { serverTimestamp } from 'firebase/firestore';
import type { LandingVideo, LandingVideoItem } from '@booking-app/shared';
import { BaseRepository, type WithId } from './base.repository';

/**
 * Dépôt de la collection `landingVideos` — les vidéos de prestataires mises
 * en avant sur une page publique (aujourd'hui l'accueil, doc `home`).
 *
 * Même forme que `landingGalleries` : UN document par emplacement, portant
 * la liste ordonnée. La page lit tout le bloc à chaque rendu ; un document
 * unique coûte une lecture là où une sous-collection en coûterait autant que
 * de vidéos, et le réordonnancement reste atomique.
 */
export class LandingVideoRepository extends BaseRepository<LandingVideo> {
  protected collectionName = 'landingVideos';

  /**
   * Le bloc d'un emplacement, trié. `null` quand aucun admin ne l'a encore
   * alimenté — la page masque alors la section plutôt que d'afficher un vide.
   *
   * `publishedOnly` (défaut) écarte les entrées en préparation : l'admin,
   * lui, veut la liste complète.
   */
  async getBySlug(
    slug: string,
    { publishedOnly = true }: { publishedOnly?: boolean } = {},
  ): Promise<WithId<LandingVideo> | null> {
    const doc = await this.getById(slug);
    if (!doc) return null;
    const items = [...(doc.items ?? [])]
      .filter((item) => (publishedOnly ? item.published !== false : true))
      .sort((a, b) => a.order - b.order);
    return { ...doc, items };
  }

  /**
   * Remplace toute la liste d'un emplacement. Les `order` sont renumérotés
   * (index × 10) : une insertion ultérieure au milieu a de la place sans
   * toucher aux autres.
   */
  async upsert(slug: string, items: LandingVideoItem[]): Promise<void> {
    const normalised = items.map((item, idx) => ({ ...item, order: idx * 10 }));
    await this.createWithId(slug, {
      slug,
      items: normalised,
      updatedAt: serverTimestamp() as unknown as Date,
    } as Omit<LandingVideo, 'id' | 'createdAt' | 'updatedAt'> & { updatedAt: Date });
  }
}

export const landingVideoRepository = new LandingVideoRepository();
