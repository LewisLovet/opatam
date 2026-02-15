import {
  reviewRepository,
  bookingRepository,
  providerRepository,
  userRepository,
} from '../repositories';
import type { Review, Provider } from '@booking-app/shared';
import {
  createReviewSchema,
  type CreateReviewInput,
} from '@booking-app/shared';
import type { WithId } from '../repositories/base.repository';

export class ReviewService {
  /**
   * Submit a review for a past booking (authenticated client)
   * Dedup: one review per client per provider. Updates existing review if found.
   */
  async submitReview(clientId: string, input: CreateReviewInput): Promise<WithId<Review>> {
    // Validate input
    const validated = createReviewSchema.parse(input);

    // Get the booking
    const booking = await bookingRepository.getById(validated.bookingId);
    if (!booking) {
      throw new Error('Réservation non trouvée');
    }

    // Verify booking date has passed
    if (booking.datetime > new Date()) {
      throw new Error('Vous ne pouvez donner un avis qu\'après votre rendez-vous');
    }

    // Verify client owns the booking
    if (booking.clientId !== clientId) {
      // Also check by email
      const user = await userRepository.getById(clientId);
      if (!user || user.email !== booking.clientInfo.email) {
        throw new Error('Vous n\'êtes pas autorisé à donner un avis sur cette réservation');
      }
    }

    // Get client info
    const client = await userRepository.getById(clientId);
    if (!client) {
      throw new Error('Utilisateur non trouvé');
    }

    const clientEmail = client.email.toLowerCase().trim();

    // Check if client already has a review for this provider (dedup by client+provider)
    const existingReview = await reviewRepository.getByClientForProvider(clientId, validated.providerId)
      || await reviewRepository.getByEmailForProvider(clientEmail, validated.providerId);

    if (existingReview) {
      // Update the existing review instead of creating a new one
      await reviewRepository.update(existingReview.id, {
        bookingId: validated.bookingId,
        memberId: booking.memberId,
        rating: validated.rating,
        comment: validated.comment || null,
        clientName: client.displayName,
        clientPhoto: client.photoURL,
      });

      const updated = await reviewRepository.getById(existingReview.id);
      if (!updated) {
        throw new Error('Erreur lors de la mise à jour de l\'avis');
      }

      await this.recalculateProviderRating(validated.providerId);
      return updated;
    }

    // Create new review
    const reviewId = await reviewRepository.create({
      providerId: validated.providerId,
      bookingId: validated.bookingId,
      clientId,
      clientEmail,
      memberId: booking.memberId,
      clientName: client.displayName,
      clientPhoto: client.photoURL,
      rating: validated.rating,
      comment: validated.comment || null,
      isPublic: true,
    });

    const review = await reviewRepository.getById(reviewId);
    if (!review) {
      throw new Error('Erreur lors de la création de l\'avis');
    }

    // Recalculate provider rating
    await this.recalculateProviderRating(validated.providerId);

    return review;
  }

  /**
   * Update review visibility
   */
  async setReviewVisibility(reviewId: string, isPublic: boolean): Promise<void> {
    const review = await reviewRepository.getById(reviewId);
    if (!review) {
      throw new Error('Avis non trouvé');
    }

    await reviewRepository.update(reviewId, { isPublic });

    // Recalculate provider rating (only public reviews count)
    await this.recalculateProviderRating(review.providerId);
  }

  /**
   * Delete a review (admin only)
   */
  async deleteReview(reviewId: string, adminUserId: string): Promise<void> {
    const review = await reviewRepository.getById(reviewId);
    if (!review) {
      throw new Error('Avis non trouvé');
    }

    // Verify admin owns the provider
    const provider = await providerRepository.getById(review.providerId);
    if (!provider || provider.userId !== adminUserId) {
      throw new Error('Vous n\'êtes pas autorisé à supprimer cet avis');
    }

    await reviewRepository.delete(reviewId);

    // Recalculate provider rating
    await this.recalculateProviderRating(review.providerId);
  }

  /**
   * Get all reviews for a provider
   */
  async getProviderReviews(providerId: string): Promise<WithId<Review>[]> {
    return reviewRepository.getByProvider(providerId);
  }

  /**
   * Get public reviews for a provider (for public page)
   */
  async getPublicProviderReviews(providerId: string): Promise<WithId<Review>[]> {
    const reviews = await reviewRepository.getByProvider(providerId);
    return reviews.filter((r) => r.isPublic);
  }

  /**
   * Get reviews for a specific member
   */
  async getMemberReviews(providerId: string, memberId: string): Promise<WithId<Review>[]> {
    return reviewRepository.getByMember(providerId, memberId);
  }

  /**
   * Get review by booking ID
   */
  async getByBooking(bookingId: string): Promise<WithId<Review> | null> {
    return reviewRepository.getByBooking(bookingId);
  }

  /**
   * Get existing review for a client (by email) at a provider
   */
  async getByEmailForProvider(clientEmail: string, providerId: string): Promise<WithId<Review> | null> {
    return reviewRepository.getByEmailForProvider(clientEmail, providerId);
  }

  /**
   * Submit a review by booking ID (for non-authenticated clients via email link)
   * Dedup: one review per email per provider. Updates existing review if found.
   */
  async submitReviewByBooking(
    bookingId: string,
    rating: number,
    comment?: string
  ): Promise<WithId<Review>> {
    // Get the booking
    const booking = await bookingRepository.getById(bookingId);
    if (!booking) {
      throw new Error('Réservation non trouvée');
    }

    // Verify booking date has passed
    const now = new Date();
    if (booking.datetime > now) {
      throw new Error('Vous ne pouvez donner un avis qu\'après votre rendez-vous');
    }

    // Validate rating
    if (rating < 1 || rating > 5 || !Number.isInteger(rating)) {
      throw new Error('La note doit être un nombre entier entre 1 et 5');
    }

    const clientEmail = booking.clientInfo.email.toLowerCase().trim();

    // Check if this client (by email) already has a review for this provider
    const existingReview = await reviewRepository.getByEmailForProvider(clientEmail, booking.providerId);

    if (existingReview) {
      // Update the existing review
      await reviewRepository.update(existingReview.id, {
        bookingId,
        memberId: booking.memberId,
        rating,
        comment: comment || null,
        clientName: booking.clientInfo.name,
      });

      const updated = await reviewRepository.getById(existingReview.id);
      if (!updated) {
        throw new Error('Erreur lors de la mise à jour de l\'avis');
      }

      await this.recalculateProviderRating(booking.providerId);
      return updated;
    }

    // Also check by clientId if booking has one
    if (booking.clientId) {
      const existingByClient = await reviewRepository.getByClientForProvider(booking.clientId, booking.providerId);
      if (existingByClient) {
        await reviewRepository.update(existingByClient.id, {
          bookingId,
          memberId: booking.memberId,
          rating,
          comment: comment || null,
          clientName: booking.clientInfo.name,
          clientEmail,
        });

        const updated = await reviewRepository.getById(existingByClient.id);
        if (!updated) {
          throw new Error('Erreur lors de la mise à jour de l\'avis');
        }

        await this.recalculateProviderRating(booking.providerId);
        return updated;
      }
    }

    // Create new review with clientId from booking (null for anonymous)
    const reviewId = await reviewRepository.create({
      providerId: booking.providerId,
      bookingId,
      clientId: booking.clientId || null,
      clientEmail,
      memberId: booking.memberId,
      clientName: booking.clientInfo.name,
      clientPhoto: null,
      rating,
      comment: comment || null,
      isPublic: true,
    });

    const review = await reviewRepository.getById(reviewId);
    if (!review) {
      throw new Error('Erreur lors de la création de l\'avis');
    }

    // Recalculate provider rating
    await this.recalculateProviderRating(booking.providerId);

    return review;
  }

  /**
   * Get review by ID
   */
  async getById(reviewId: string): Promise<WithId<Review> | null> {
    return reviewRepository.getById(reviewId);
  }

  /**
   * Check if client can review a booking.
   * Returns 'can_review' | 'can_update' | false.
   * 'can_update' means the client already has a review for this provider (will update it).
   */
  async canReview(clientId: string, bookingId: string): Promise<'can_review' | 'can_update' | false> {
    const booking = await bookingRepository.getById(bookingId);
    if (!booking) {
      return false;
    }

    // Must be past
    if (booking.datetime > new Date()) {
      return false;
    }

    // Must be the client
    if (booking.clientId !== clientId) {
      const user = await userRepository.getById(clientId);
      if (!user || user.email !== booking.clientInfo.email) {
        return false;
      }
    }

    // Check if already has a review for this provider
    const existingReview = await reviewRepository.getByClientForProvider(clientId, booking.providerId);
    if (existingReview) {
      return 'can_update';
    }

    return 'can_review';
  }

  /**
   * Get client's reviews
   */
  async getClientReviews(clientId: string): Promise<WithId<Review>[]> {
    return reviewRepository.getByClient(clientId);
  }

  /**
   * Recalculate provider rating from all public reviews
   */
  private async recalculateProviderRating(providerId: string): Promise<void> {
    const reviews = await reviewRepository.getByProvider(providerId);
    const publicReviews = reviews.filter((r) => r.isPublic);

    if (publicReviews.length === 0) {
      await providerRepository.update(providerId, {
        rating: {
          average: 0,
          count: 0,
          distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        },
      });
      return;
    }

    // Calculate distribution
    const distribution: Provider['rating']['distribution'] = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let total = 0;

    for (const review of publicReviews) {
      distribution[review.rating as 1 | 2 | 3 | 4 | 5]++;
      total += review.rating;
    }

    const average = total / publicReviews.length;

    await providerRepository.update(providerId, {
      rating: {
        average: Math.round(average * 10) / 10, // Round to 1 decimal
        count: publicReviews.length,
        distribution,
      },
    });
  }

  /**
   * Get rating summary for a provider
   */
  async getRatingSummary(providerId: string): Promise<{
    average: number;
    count: number;
    distribution: { 1: number; 2: number; 3: number; 4: number; 5: number };
  }> {
    const provider = await providerRepository.getById(providerId);
    if (!provider) {
      throw new Error('Prestataire non trouvé');
    }

    return provider.rating;
  }
}

// Singleton instance
export const reviewService = new ReviewService();
