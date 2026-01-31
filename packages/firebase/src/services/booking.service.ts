import {
  bookingRepository,
  providerRepository,
  serviceRepository,
  locationRepository,
  memberRepository,
  userRepository,
} from '../repositories';
import { schedulingService } from './scheduling.service';
import type { Booking, BookingStatus } from '@booking-app/shared';
import {
  createBookingSchema,
  type CreateBookingInput,
} from '@booking-app/shared';
import type { WithId } from '../repositories/base.repository';
import type { BookingFilters } from '../repositories/booking.repository';

export class BookingService {
  /**
   * Create a new booking
   */
  async createBooking(input: CreateBookingInput): Promise<WithId<Booking>> {
    // Validate input
    const validated = createBookingSchema.parse(input);

    // Get provider
    const provider = await providerRepository.getById(validated.providerId);
    if (!provider) {
      throw new Error('Prestataire non trouvé');
    }

    // Get service
    const service = await serviceRepository.getById(validated.providerId, validated.serviceId);
    if (!service) {
      throw new Error('Prestation non trouvée');
    }

    // Get location
    const location = await locationRepository.getById(validated.providerId, validated.locationId);
    if (!location) {
      throw new Error('Lieu non trouvé');
    }

    // NOUVEAU MODÈLE: memberId est requis pour la vérification de disponibilité
    // Si non fourni, on trouve le membre par défaut du lieu sélectionné
    let member = null;
    let effectiveMemberId = validated.memberId;

    if (validated.memberId) {
      member = await memberRepository.getById(validated.providerId, validated.memberId);
      if (!member) {
        throw new Error('Membre non trouvé');
      }
    } else {
      // Find default member for this location
      const members = await memberRepository.getByLocation(validated.providerId, validated.locationId);
      const defaultMember = members.find((m) => m.isDefault) || members[0];
      if (!defaultMember) {
        throw new Error('Aucun membre trouvé pour ce lieu');
      }
      member = defaultMember;
      effectiveMemberId = defaultMember.id;
    }

    // Calculate total duration including buffer
    const totalDuration = service.duration + service.bufferTime;

    // Check slot availability
    const isAvailable = await schedulingService.isSlotAvailable({
      providerId: validated.providerId,
      memberId: effectiveMemberId as string, // Now guaranteed to be non-null
      datetime: validated.datetime,
      duration: totalDuration,
    });

    if (!isAvailable) {
      throw new Error('Ce créneau n\'est plus disponible');
    }

    // Calculate end datetime
    const endDatetime = new Date(validated.datetime.getTime() + service.duration * 60 * 1000);

    // Generate cancel token
    const cancelToken = this.generateCancelToken();

    // Determine initial status based on provider settings
    const status: BookingStatus = provider.settings.requiresConfirmation ? 'pending' : 'confirmed';

    // Create booking
    const bookingId = await bookingRepository.create({
      providerId: validated.providerId,
      clientId: validated.clientId || null, // Set if user is logged in
      memberId: effectiveMemberId || null, // Use effective member ID
      providerName: provider.businessName,
      providerPhoto: provider.photoURL,
      memberName: member?.name || null,
      memberPhoto: member?.photoURL || null,
      locationId: validated.locationId,
      locationName: location.name,
      locationAddress: `${location.address}, ${location.postalCode} ${location.city}`,
      serviceId: validated.serviceId,
      serviceName: service.name,
      duration: service.duration,
      price: service.price,
      clientInfo: validated.clientInfo!,
      datetime: validated.datetime,
      endDatetime,
      status,
      cancelledAt: null,
      cancelledBy: null,
      cancelReason: null,
      cancelToken,
      remindersSent: [],
      reviewRequestSentAt: null,
    });

    const booking = await bookingRepository.getById(bookingId);
    if (!booking) {
      throw new Error('Erreur lors de la création de la réservation');
    }

    return booking;
  }

  /**
   * Confirm a pending booking (provider action)
   */
  async confirmBooking(bookingId: string, adminUserId: string): Promise<void> {
    const booking = await bookingRepository.getById(bookingId);
    if (!booking) {
      throw new Error('Réservation non trouvée');
    }

    // Verify admin has access to this provider
    await this.verifyProviderAccess(booking.providerId, adminUserId);

    if (booking.status !== 'pending') {
      throw new Error(`Impossible de confirmer une réservation ${this.getStatusLabel(booking.status)}`);
    }

    await bookingRepository.updateStatus(bookingId, 'confirmed');
  }

  /**
   * Cancel a booking
   */
  async cancelBooking(
    bookingId: string,
    cancelledBy: 'client' | 'provider',
    userId: string,
    reason?: string
  ): Promise<void> {
    const booking = await bookingRepository.getById(bookingId);
    if (!booking) {
      throw new Error('Réservation non trouvée');
    }

    // Verify access
    if (cancelledBy === 'provider') {
      await this.verifyProviderAccess(booking.providerId, userId);
    } else if (cancelledBy === 'client' && booking.clientId) {
      if (booking.clientId !== userId) {
        throw new Error('Vous n\'êtes pas autorisé à annuler cette réservation');
      }
    }

    if (booking.status === 'cancelled') {
      throw new Error('Cette réservation est déjà annulée');
    }

    await bookingRepository.updateStatus(bookingId, 'cancelled', {
      cancelledBy,
      cancelReason: reason,
    });

    // Increment cancellation count for client if client cancelled
    if (cancelledBy === 'client' && booking.clientId) {
      await userRepository.incrementCancellationCount(booking.clientId);
    }
  }

  /**
   * Cancel a booking by cancel token (for web without account)
   */
  async cancelBookingByToken(token: string, reason?: string): Promise<void> {
    const booking = await bookingRepository.getByCancelToken(token);
    if (!booking) {
      throw new Error('Réservation non trouvée ou lien invalide');
    }

    if (booking.status === 'cancelled') {
      throw new Error('Cette réservation est déjà annulée');
    }

    // Check if booking is in the past
    if (booking.datetime < new Date()) {
      throw new Error('Impossible d\'annuler une réservation passée');
    }

    await bookingRepository.updateStatus(booking.id, 'cancelled', {
      cancelledBy: 'client',
      cancelReason: reason || 'Annulé via lien',
    });
  }

  /**
   * Mark booking as no-show
   */
  async markNoShow(bookingId: string, adminUserId: string): Promise<void> {
    const booking = await bookingRepository.getById(bookingId);
    if (!booking) {
      throw new Error('Réservation non trouvée');
    }

    await this.verifyProviderAccess(booking.providerId, adminUserId);

    if (booking.status !== 'confirmed') {
      throw new Error(`Impossible de marquer comme absent une réservation ${this.getStatusLabel(booking.status)}`);
    }

    await bookingRepository.updateStatus(bookingId, 'noshow');

    // Increment cancellation count for client
    if (booking.clientId) {
      await userRepository.incrementCancellationCount(booking.clientId);
    }
  }

  /**
   * Get provider's bookings with filters
   */
  async getProviderBookings(
    providerId: string,
    filters?: BookingFilters
  ): Promise<WithId<Booking>[]> {
    return bookingRepository.getByProvider(providerId, filters);
  }

  /**
   * Get client's bookings
   */
  async getClientBookings(clientId: string): Promise<WithId<Booking>[]> {
    return bookingRepository.getByClient(clientId);
  }

  /**
   * Get booking by ID
   */
  async getById(bookingId: string): Promise<WithId<Booking> | null> {
    return bookingRepository.getById(bookingId);
  }

  /**
   * Get today's bookings for a provider
   */
  async getTodayBookings(providerId: string): Promise<WithId<Booking>[]> {
    return bookingRepository.getTodayByProvider(providerId);
  }

  /**
   * Get pending bookings for a provider
   */
  async getPendingBookings(providerId: string): Promise<WithId<Booking>[]> {
    return bookingRepository.getPendingByProvider(providerId);
  }

  /**
   * Get upcoming bookings in date range
   */
  async getUpcomingBookings(from: Date, to: Date): Promise<WithId<Booking>[]> {
    return bookingRepository.getUpcoming(from, to);
  }

  /**
   * Get booking statistics for a provider
   */
  async getStatistics(providerId: string): Promise<{
    total: number;
    pending: number;
    confirmed: number;
    cancelled: number;
    noshow: number;
  }> {
    return bookingRepository.getStatsByProvider(providerId);
  }

  /**
   * Associate booking with logged-in client
   */
  async associateWithClient(bookingId: string, clientId: string): Promise<void> {
    const booking = await bookingRepository.getById(bookingId);
    if (!booking) {
      throw new Error('Réservation non trouvée');
    }

    // Only associate if not already associated
    if (!booking.clientId) {
      await bookingRepository.update(bookingId, { clientId });
    }
  }

  /**
   * Add reminder sent timestamp
   */
  async markReminderSent(bookingId: string): Promise<void> {
    const booking = await bookingRepository.getById(bookingId);
    if (!booking) {
      throw new Error('Réservation non trouvée');
    }

    await bookingRepository.update(bookingId, {
      remindersSent: [...booking.remindersSent, new Date()],
    });
  }

  /**
   * Verify user has access to provider
   */
  private async verifyProviderAccess(providerId: string, userId: string): Promise<void> {
    const provider = await providerRepository.getById(providerId);
    if (!provider) {
      throw new Error('Prestataire non trouvé');
    }

    if (provider.userId !== userId) {
      // Check if user is a team member with access code
      const user = await userRepository.getById(userId);
      if (!user || user.providerId !== providerId) {
        throw new Error('Vous n\'êtes pas autorisé à effectuer cette action');
      }
    }
  }

  /**
   * Generate cancel token
   */
  private generateCancelToken(): string {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let token = '';
    for (let i = 0; i < 32; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
  }

  /**
   * Get human-readable status label
   */
  private getStatusLabel(status: BookingStatus): string {
    const labels: Record<BookingStatus, string> = {
      pending: 'en attente',
      confirmed: 'confirmée',
      cancelled: 'annulée',
      noshow: 'absence',
    };
    return labels[status];
  }

  /**
   * Send review request email and mark as sent
   */
  async sendReviewRequest(bookingId: string, adminUserId: string): Promise<void> {
    const booking = await bookingRepository.getById(bookingId);
    if (!booking) {
      throw new Error('Réservation non trouvée');
    }

    await this.verifyProviderAccess(booking.providerId, adminUserId);

    // Verify booking is past and confirmed
    if (booking.datetime > new Date()) {
      throw new Error('Le rendez-vous n\'est pas encore passé');
    }

    if (booking.status !== 'confirmed') {
      throw new Error('Impossible de demander un avis pour cette réservation');
    }

    if (booking.reviewRequestSentAt) {
      throw new Error('La demande d\'avis a déjà été envoyée');
    }

    // Mark as sent (the actual email is sent by the API route)
    await bookingRepository.update(bookingId, {
      reviewRequestSentAt: new Date(),
    });
  }

  /**
   * Reschedule a booking to a new datetime
   * Returns the old datetime for email notification purposes
   */
  async rescheduleBooking(
    bookingId: string,
    newDatetime: Date,
    adminUserId: string
  ): Promise<{ oldDatetime: Date; newDatetime: Date; booking: WithId<Booking> }> {
    const booking = await bookingRepository.getById(bookingId);
    if (!booking) {
      throw new Error('Réservation non trouvée');
    }

    // Verify admin has access to this provider
    await this.verifyProviderAccess(booking.providerId, adminUserId);

    // Cannot reschedule cancelled or noshow bookings
    if (booking.status === 'cancelled') {
      throw new Error('Impossible de reprogrammer une réservation annulée');
    }
    if (booking.status === 'noshow') {
      throw new Error('Impossible de reprogrammer une réservation marquée comme absence');
    }

    // Cannot reschedule to the past
    if (newDatetime < new Date()) {
      throw new Error('Impossible de reprogrammer vers une date passée');
    }

    // Get service to calculate total duration
    const service = await serviceRepository.getById(booking.providerId, booking.serviceId);
    if (!service) {
      throw new Error('Prestation non trouvée');
    }

    const totalDuration = service.duration + service.bufferTime;

    // Check if new slot is available (excluding current booking)
    const isAvailable = await schedulingService.isSlotAvailable({
      providerId: booking.providerId,
      memberId: booking.memberId as string,
      datetime: newDatetime,
      duration: totalDuration,
      excludeBookingId: bookingId,
    });

    if (!isAvailable) {
      throw new Error('Ce créneau n\'est plus disponible');
    }

    // Calculate new end datetime
    const newEndDatetime = new Date(newDatetime.getTime() + booking.duration * 60 * 1000);

    // Store old datetime for email
    const oldDatetime = booking.datetime;

    // Update booking
    await bookingRepository.update(bookingId, {
      datetime: newDatetime,
      endDatetime: newEndDatetime,
    });

    // Get updated booking
    const updatedBooking = await bookingRepository.getById(bookingId);
    if (!updatedBooking) {
      throw new Error('Erreur lors de la mise à jour de la réservation');
    }

    return {
      oldDatetime,
      newDatetime,
      booking: updatedBooking,
    };
  }
}

// Singleton instance
export const bookingService = new BookingService();
