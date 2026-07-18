import {
  bookingRepository,
  providerRepository,
  serviceRepository,
  locationRepository,
  memberRepository,
  userRepository,
} from '../repositories';
import { schedulingService } from './scheduling.service';
import type {
  Booking,
  BookingDeposit,
  BookingStatus,
  BookingServiceItem,
  LoyaltySettings,
  ServiceSelections,
} from '@booking-app/shared';
import {
  parseOrThrow,
  createBookingSchema,
  resolveDeposit,
  computeServiceTotal,
  computeDiscountedTotal,
  buildBookingSelections,
  validateServiceSelections,
  emptyServiceSelections,
  isAccessOverrideActive,
  hasDepositAccess,
  getPublicAreaLabel,
  isLoyaltyConfigValid,
  isServiceLoyaltyEligible,
  applyLoyaltyToLine,
  type CreateBookingInput,
} from '@booking-app/shared';
import type { WithId } from '../repositories/base.repository';
import type { BookingFilters } from '../repositories/booking.repository';

export class BookingService {
  /**
   * Create a new booking.
   *
   * @param input  Validated booking input.
   * @param opts.skipDeposit  When true, ignore any deposit configuration on
   *   the service/provider. Used for pro-created manual bookings where
   *   payment is handled in person.
   */
  async createBooking(
    input: CreateBookingInput,
    opts: {
      skipDeposit?: boolean;
      /** Réglages fidélité à appliquer — fournis par la route API UNIQUEMENT
       *  quand le gate d'accès et l'armement du client sont vérifiés. */
      loyalty?: LoyaltySettings | null;
    } = {},
  ): Promise<WithId<Booking>> {
    // Validate input
    const validated = parseOrThrow(createBookingSchema, input);

    // Get provider
    const provider = await providerRepository.getById(validated.providerId);
    if (!provider) {
      throw new Error('Prestataire non trouvé');
    }

    // Check subscription status
    const { plan, subscription } = provider;
    if (subscription) {
      const validUntilRaw = subscription.validUntil;
      const validDate = validUntilRaw instanceof Date
        ? validUntilRaw
        : (validUntilRaw as any)?.toDate?.()
          || (validUntilRaw ? new Date(validUntilRaw as any) : null);

      const isSubscriptionValid =
        // Comp/offered access (admin grant) — immune to subscription status.
        // Must mirror the /api/bookings route gate, otherwise a comped
        // provider whose Stripe sub is cancelled gets blocked here.
        isAccessOverrideActive(provider.accessOverride) ||
        (plan !== 'trial' && subscription.status !== 'cancelled' && subscription.status !== 'incomplete') ||
        (plan === 'trial' && validDate && new Date() <= validDate);

      if (!isSubscriptionValid) {
        throw new Error('Ce prestataire n\'accepte pas de réservations pour le moment');
      }
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

    // Resolve the list of prestations. A multi-service appointment sends
    // `items`; a single-service booking is treated as a one-item list. The
    // server recomputes every price/duration from the authoritative Service
    // docs — the client only sends which variations/options it picked.
    const requestedItems =
      validated.items && validated.items.length > 0
        ? validated.items
        : [{ serviceId: validated.serviceId, selections: validated.selections }];
    const isMulti = requestedItems.length > 1;

    const resolvedItems = [];
    for (const reqItem of requestedItems) {
      const svc = await serviceRepository.getById(validated.providerId, reqItem.serviceId);
      if (!svc) {
        throw new Error('Prestation non trouvée');
      }
      const sel = reqItem.selections ?? emptyServiceSelections();
      // Guard: a service with required variations (or required info fields)
      // must come with valid selections. This stops a caller that ignores
      // choices — e.g. an outdated mobile build hitting /api/bookings with
      // only a serviceId — from creating a 0€/0min booking for a
      // variation-defined prestation. The web flow always sends valid
      // selections (its "Continuer" is gated), so it's unaffected.
      const validation = validateServiceSelections(svc, sel);
      if (!validation.valid) {
        throw new Error(
          `Cette prestation (« ${svc.name} ») nécessite des choix (${validation.missing.join(', ')}). Réservez-la depuis le site web.`,
        );
      }
      // Apply any active promotion (per-service or the provider's global one)
      // at the effective-price layer → the discount propagates automatically to
      // the deposit (resolveDeposit runs on effective.price), the Stripe charge,
      // emails and revenue stats. `original` is snapshotted for "économie".
      const eff = computeDiscountedTotal(svc, sel, provider.settings?.globalDiscount, new Date());
      const effective = { price: eff.price, duration: eff.duration };
      const denorm = buildBookingSelections(svc, sel);
      resolvedItems.push({ service: svc, effective, denorm, originalPrice: eff.original });
    }

    // ── Carte de fidélité ─────────────────────────────────────────
    // `opts.loyalty` n'arrive que si la route API a vérifié le gate
    // (hasLoyaltyAccess) ET l'armement (confirmedCount multiple du seuil,
    // lu via l'Admin SDK). Ici on applique la récompense à LA PREMIÈRE
    // prestation éligible du panier — avant resolveDeposit, pour que
    // l'acompte, Stripe, les emails et les stats suivent le prix réduit,
    // exactement comme les promos.
    let loyaltySnapshot: Booking['loyalty'] = null;
    if (opts.loyalty && isLoyaltyConfigValid(opts.loyalty)) {
      const target = resolvedItems.find((r) =>
        isServiceLoyaltyEligible(r.service.id, opts.loyalty!),
      );
      if (target) {
        const applied = applyLoyaltyToLine(
          target.effective.price,
          target.originalPrice,
          opts.loyalty,
        );
        if (applied) {
          target.effective.price = applied.price;
          loyaltySnapshot = {
            rewardType: opts.loyalty.rewardType,
            rewardValue: opts.loyalty.rewardValue,
            amountOff: applied.amountOff,
            threshold: opts.loyalty.threshold,
          };
        }
      }
    }

    const firstService = resolvedItems[0].service;
    // Aggregate totals across all prestations in the visit.
    const totalServiceDuration = resolvedItems.reduce(
      (sum, r) => sum + r.effective.duration,
      0,
    );
    const totalPrice = resolvedItems.reduce((sum, r) => sum + r.effective.price, 0);
    const totalOriginal = resolvedItems.reduce((sum, r) => sum + r.originalPrice, 0);
    // Buffer once, after the whole visit (use the last prestation's buffer).
    const lastBuffer = resolvedItems[resolvedItems.length - 1].service.bufferTime || 0;
    const totalDuration = totalServiceDuration + lastBuffer;

    // Denormalised per-item list (only persisted for true multi bookings).
    const bookingItems: BookingServiceItem[] = resolvedItems.map((r) => ({
      serviceId: r.service.id,
      serviceName: r.service.name,
      serviceColor: r.service.color ?? null,
      duration: r.effective.duration,
      price: r.effective.price,
      originalPrice: r.originalPrice > r.effective.price ? r.originalPrice : null,
      selectedVariations: r.denorm.selectedVariations,
      selectedOptions: r.denorm.selectedOptions,
      selectedInfoValues: r.denorm.selectedInfoValues,
      selectedInfo: r.denorm.selectedInfo,
    }));

    // Top-level (aggregate / first-item) values kept for back-compat readers.
    const { selectedVariations, selectedOptions, selectedInfoValues, selectedInfo } =
      resolvedItems[0].denorm;
    const aggregateServiceName = isMulti
      ? bookingItems.map((i) => i.serviceName).join(' + ')
      : firstService.name;

    // Check slot availability for the whole contiguous block.
    const isAvailable = await schedulingService.isSlotAvailable({
      providerId: validated.providerId,
      memberId: effectiveMemberId as string, // Now guaranteed to be non-null
      datetime: validated.datetime,
      duration: totalDuration,
    });

    if (!isAvailable) {
      throw new Error('Ce créneau n\'est plus disponible');
    }

    // End = start + sum of service durations (buffer is availability-only).
    const endDatetime = new Date(
      validated.datetime.getTime() + totalServiceDuration * 60 * 1000,
    );

    // Generate cancel token
    const cancelToken = this.generateCancelToken();

    // Resolve deposit — only honored if the provider has deposit access
    // (paid add-on, admin comp, or free base trial — see hasDepositAccess)
    // AND a working Connect account. Otherwise we silently skip (the
    // provider may have configured a deposit then lost access, e.g. the
    // trial ended without subscribing to Sérénité).
    // Pro-side manual bookings opt out via opts.skipDeposit.
    const depositReady =
      !opts.skipDeposit &&
      hasDepositAccess(provider) &&
      provider.stripeConnectStatus === 'active' &&
      !!provider.stripeConnectAccountId;
    // Deposit = sum of each prestation's resolved deposit (each on its own
    // effective price + per-service config). Null when none apply.
    let resolvedDeposit: { amount: number; refundDeadlineHours: number } | null = null;
    if (depositReady) {
      let amount = 0;
      let refundDeadlineHours = 0;
      let any = false;
      for (const r of resolvedItems) {
        const d = resolveDeposit(
          { ...r.service, price: r.effective.price },
          provider.settings ?? {},
        );
        if (d) {
          any = true;
          amount += d.amount;
          // Keep the most client-favourable (longest) refund window.
          refundDeadlineHours = Math.max(refundDeadlineHours, d.refundDeadlineHours);
        }
      }
      resolvedDeposit = any ? { amount, refundDeadlineHours: refundDeadlineHours || 24 } : null;
    }

    // Status precedence:
    //   deposit required  → pending_payment (Stripe Checkout flow)
    //   requires confirm  → pending
    //   else              → confirmed
    let status: BookingStatus;
    if (resolvedDeposit) {
      status = 'pending_payment';
    } else if (provider.settings.requiresConfirmation) {
      status = 'pending';
    } else {
      status = 'confirmed';
    }

    const depositField: BookingDeposit | null = resolvedDeposit
      ? {
          amount: resolvedDeposit.amount,
          refundDeadlineHours: resolvedDeposit.refundDeadlineHours,
          paymentIntentId: null,
          connectAccountId: null,
          checkoutSessionId: null,
          checkoutUrl: null,
          status: 'pending',
          paidAt: null,
          refundedAt: null,
          refundId: null,
          refundedBy: null,
          refundReason: null,
          reminderSentAt: null,
        }
      : null;

    // Create booking
    const bookingId = await bookingRepository.create({
      providerId: validated.providerId,
      clientId: validated.clientId || null, // Set if user is logged in
      memberId: effectiveMemberId || null, // Use effective member ID
      providerName: provider.businessName,
      providerPhoto: provider.photoURL,
      memberName: member?.name || null,
      memberPhoto: member?.photoURL || null,
      memberColor: member?.color || null,
      locationId: validated.locationId,
      locationName: location.name,
      // Address privacy: booking docs are publicly readable, so for a protected
      // location we snapshot only the approximate area — never the exact street.
      // The exact address is disclosed later per isAddressRevealed (UI + emails).
      locationProtected: !!location.protectAddress,
      locationApproxArea: location.protectAddress ? getPublicAreaLabel(location) : null,
      locationAddress: location.protectAddress
        ? getPublicAreaLabel(location)
        : location.address
          ? `${location.address}, ${location.postalCode} ${location.city}`
          : `${location.postalCode} ${location.city}`,
      // Top-level = first prestation; aggregate name when multi.
      serviceId: firstService.id,
      serviceName: aggregateServiceName,
      serviceColor: firstService.color || null,
      // Aggregate effective values (sum across all prestations).
      duration: totalServiceDuration,
      price: totalPrice,
      // Pre-discount total when a promo applied — lets emails/récap show the
      // crossed-out price + savings. null when no promo.
      ...(totalOriginal > totalPrice ? { originalPrice: totalOriginal } : {}),
      // Snapshot fidélité (réduction déjà incluse dans `price`).
      ...(loyaltySnapshot ? { loyalty: loyaltySnapshot } : {}),
      priceMax: isMulti ? null : firstService.priceMax ?? null,
      // Denormalised choices of the first prestation (back-compat); the
      // full per-prestation detail lives in `items` for multi bookings.
      ...(selectedVariations.length ? { selectedVariations } : {}),
      ...(selectedOptions.length ? { selectedOptions } : {}),
      ...(Object.keys(selectedInfoValues).length ? { selectedInfoValues } : {}),
      ...(selectedInfo.length ? { selectedInfo } : {}),
      // Per-prestation list — only persisted for true multi-service visits.
      ...(isMulti ? { items: bookingItems } : {}),
      clientInfo: validated.clientInfo!,
      // Language the client booked in — drives the language of every
      // transactional email/notification to THIS client (fallback fr).
      ...(validated.clientLocale ? { clientLocale: validated.clientLocale } : {}),
      datetime: validated.datetime,
      endDatetime,
      status,
      cancelledAt: null,
      cancelledBy: null,
      cancelReason: null,
      cancelToken,
      remindersSent: [],
      reviewRequestSentAt: null,
      deposit: depositField,
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
   * Real-time subscription to a provider's bookings. Same filter
   * semantics as `getProviderBookings` but the callback fires on
   * every Firestore change (add / edit / cancel). Returns an
   * unsubscribe to call on cleanup.
   */
  subscribeToProviderBookings(
    providerId: string,
    filters: BookingFilters | undefined,
    onChange: (bookings: WithId<Booking>[]) => void,
    onError?: (err: Error) => void,
  ) {
    return bookingRepository.subscribeByProvider(providerId, filters, onChange, onError);
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
      pending_payment: 'en attente de paiement',
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

    // Get service (existence check + buffer). The slot width must use the
    // booking's STORED duration (the sum across all prestations for a
    // multi-prestation appointment), NOT a re-fetch of the first service —
    // otherwise a multi booking could be moved into a slot too short for
    // the whole visit and overlap the next one.
    const service = await serviceRepository.getById(booking.providerId, booking.serviceId);
    if (!service) {
      throw new Error('Prestation non trouvée');
    }

    const totalDuration = booking.duration + (service.bufferTime || 0);

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

  /**
   * Adjust ONLY this booking's effective duration (its time block), without
   * touching the Service's configured duration. Use case: the pro realises a
   * visit will be shorter (free up time to fit another behind) or longer
   * (avoid making the next client wait).
   *
   * Mechanics: we rewrite the booking's `duration` + `endDatetime`. Since the
   * whole availability engine (slot generation AND isSlotAvailable) derives
   * busy ranges from each booking's `datetime`→`endDatetime`, shortening
   * immediately frees the released window and lengthening blocks it.
   *
   * Lengthening is REJECTED if the new end overlaps another active booking of
   * the same member (no silent double-booking). Shortening is always allowed.
   * `items` and the Service stay untouched.
   */
  async adjustBookingDuration(
    bookingId: string,
    newDurationMin: number,
    adminUserId: string
  ): Promise<WithId<Booking>> {
    const booking = await bookingRepository.getById(bookingId);
    if (!booking) {
      throw new Error('Réservation non trouvée');
    }

    await this.verifyProviderAccess(booking.providerId, adminUserId);

    if (booking.status === 'cancelled' || booking.status === 'noshow') {
      throw new Error('Impossible de modifier la durée de ce rendez-vous');
    }

    const MIN_DURATION = 5;
    const MAX_DURATION = 24 * 60;
    if (!Number.isFinite(newDurationMin) || newDurationMin < MIN_DURATION || newDurationMin > MAX_DURATION) {
      throw new Error(`La durée doit être comprise entre ${MIN_DURATION} minutes et 24 heures`);
    }

    const newEndDatetime = new Date(booking.datetime.getTime() + newDurationMin * 60 * 1000);
    const isLengthening = newEndDatetime.getTime() > booking.endDatetime.getTime();

    // Block lengthening into another active booking of the same member.
    if (isLengthening) {
      const overlapping = await bookingRepository.getUpcomingByProvider(
        booking.providerId,
        booking.datetime,
        newEndDatetime
      );
      const hasConflict = overlapping.some(
        (b) =>
          b.id !== bookingId &&
          b.memberId === booking.memberId &&
          (b.status === 'confirmed' || b.status === 'pending' || b.status === 'pending_payment') &&
          // Strict time overlap with [booking.datetime, newEndDatetime).
          b.datetime.getTime() < newEndDatetime.getTime() &&
          b.endDatetime.getTime() > booking.datetime.getTime()
      );
      if (hasConflict) {
        throw new Error(
          'La nouvelle durée chevaucherait le rendez-vous suivant. Raccourcissez-la ou décalez l’autre rendez-vous.'
        );
      }
    }

    await bookingRepository.update(bookingId, {
      duration: newDurationMin,
      endDatetime: newEndDatetime,
    });

    const updatedBooking = await bookingRepository.getById(bookingId);
    if (!updatedBooking) {
      throw new Error('Erreur lors de la mise à jour de la réservation');
    }
    return updatedBooking;
  }

  /**
   * Append a prestation to an EXISTING booking (same client, back-to-back).
   * The booking becomes multi-service: `items` grows, `duration`/`price`
   * aggregate, and `endDatetime` extends. Availability of the WHOLE extended
   * block is re-checked (excluding this booking) so it can't overlap the next
   * appointment. Variations aren't selectable here, so a service with REQUIRED
   * variations is rejected (add it from the web instead).
   */
  async addServiceToBooking(
    bookingId: string,
    serviceId: string,
    adminUserId: string,
    selections?: ServiceSelections,
  ): Promise<WithId<Booking>> {
    const booking = await bookingRepository.getById(bookingId);
    if (!booking) {
      throw new Error('Réservation non trouvée');
    }
    await this.verifyProviderAccess(booking.providerId, adminUserId);

    const mutableStatuses: BookingStatus[] = ['pending_payment', 'pending', 'confirmed'];
    if (!mutableStatuses.includes(booking.status)) {
      throw new Error('Ce rendez-vous ne peut plus être modifié.');
    }

    const service = await serviceRepository.getById(booking.providerId, serviceId);
    if (!service) {
      throw new Error('Prestation non trouvée');
    }

    const sel = selections ?? emptyServiceSelections();
    const validation = validateServiceSelections(service, sel);
    if (!validation.valid) {
      throw new Error(
        `Choix manquants pour « ${service.name} » : ${validation.missing.join(', ')}.`,
      );
    }
    const effective = computeServiceTotal(service, sel);
    const denorm = buildBookingSelections(service, sel);

    // Existing items: the stored list, or a single synthesised item from the
    // current top-level fields (legacy / single-service bookings).
    const existingItems: BookingServiceItem[] =
      booking.items && booking.items.length > 0
        ? booking.items
        : [
            {
              serviceId: booking.serviceId,
              serviceName: booking.serviceName,
              serviceColor: booking.serviceColor ?? null,
              duration: booking.duration,
              price: booking.price,
              selectedVariations: booking.selectedVariations ?? [],
              selectedOptions: booking.selectedOptions ?? [],
              selectedInfoValues: booking.selectedInfoValues ?? {},
              selectedInfo: booking.selectedInfo ?? [],
            },
          ];

    const newItem: BookingServiceItem = {
      serviceId: service.id,
      serviceName: service.name,
      serviceColor: service.color ?? null,
      duration: effective.duration,
      price: effective.price,
      selectedVariations: denorm.selectedVariations,
      selectedOptions: denorm.selectedOptions,
      selectedInfoValues: denorm.selectedInfoValues,
      selectedInfo: denorm.selectedInfo,
    };

    const newItems = [...existingItems, newItem];
    const newServiceDuration = booking.duration + effective.duration;
    const newPrice = booking.price + effective.price;
    const newEndDatetime = new Date(
      booking.datetime.getTime() + newServiceDuration * 60 * 1000,
    );

    // Re-check the whole extended block (services back-to-back + the NEW last
    // prestation's buffer). Skipped when no member is assigned (best effort).
    if (booking.memberId) {
      const lastBuffer = service.bufferTime || 0;
      const isAvailable = await schedulingService.isSlotAvailable({
        providerId: booking.providerId,
        memberId: booking.memberId,
        datetime: booking.datetime,
        duration: newServiceDuration + lastBuffer,
        excludeBookingId: bookingId,
      });
      if (!isAvailable) {
        throw new Error(
          'Pas de disponibilité juste après ce rendez-vous pour ajouter cette prestation.',
        );
      }
    }

    await bookingRepository.update(bookingId, {
      items: newItems,
      serviceName: newItems.map((i) => i.serviceName).join(' + '),
      duration: newServiceDuration,
      price: newPrice,
      priceMax: null,
      endDatetime: newEndDatetime,
    });

    const updated = await bookingRepository.getById(bookingId);
    if (!updated) {
      throw new Error('Erreur lors de la mise à jour de la réservation');
    }
    return updated;
  }

  /**
   * Remove the LAST prestation from a multi-service booking. Mirror of
   * `addServiceToBooking`: shortens duration/price and pulls back endDatetime.
   * A booking must keep at least one prestation — when only one would remain
   * the call is rejected (cancel the whole booking instead). When it drops
   * back to a single prestation, `items` is cleared (the top-level fields
   * already reflect that first prestation).
   */
  async removeLastServiceFromBooking(
    bookingId: string,
    adminUserId: string,
  ): Promise<WithId<Booking>> {
    const booking = await bookingRepository.getById(bookingId);
    if (!booking) {
      throw new Error('Réservation non trouvée');
    }
    await this.verifyProviderAccess(booking.providerId, adminUserId);

    const mutableStatuses: BookingStatus[] = ['pending_payment', 'pending', 'confirmed'];
    if (!mutableStatuses.includes(booking.status)) {
      throw new Error('Ce rendez-vous ne peut plus être modifié.');
    }

    const items: BookingServiceItem[] =
      booking.items && booking.items.length > 0
        ? booking.items
        : [
            {
              serviceId: booking.serviceId,
              serviceName: booking.serviceName,
              serviceColor: booking.serviceColor ?? null,
              duration: booking.duration,
              price: booking.price,
              selectedVariations: booking.selectedVariations ?? [],
              selectedOptions: booking.selectedOptions ?? [],
              selectedInfoValues: booking.selectedInfoValues ?? {},
              selectedInfo: booking.selectedInfo ?? [],
            },
          ];

    if (items.length <= 1) {
      throw new Error(
        'Une réservation doit garder au moins une prestation. Annulez le rendez-vous à la place.',
      );
    }

    const remaining = items.slice(0, -1);
    const newDuration = remaining.reduce((sum, i) => sum + i.duration, 0);
    const newPrice = remaining.reduce((sum, i) => sum + i.price, 0);
    const newEndDatetime = new Date(booking.datetime.getTime() + newDuration * 60 * 1000);

    await bookingRepository.update(bookingId, {
      // Back to a single prestation → drop the per-item list (top-level
      // fields already reflect the first/only prestation).
      items: remaining.length >= 2 ? remaining : [],
      serviceName: remaining.map((i) => i.serviceName).join(' + '),
      duration: newDuration,
      price: newPrice,
      priceMax: null,
      endDatetime: newEndDatetime,
    });

    const updated = await bookingRepository.getById(bookingId);
    if (!updated) {
      throw new Error('Erreur lors de la mise à jour de la réservation');
    }
    return updated;
  }
}

// Singleton instance
export const bookingService = new BookingService();
