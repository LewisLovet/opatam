import {
  availabilityRepository,
  blockedSlotRepository,
  bookingRepository,
  serviceRepository,
  providerRepository,
} from '../repositories';
import type { Availability, AvailabilityConflict, BlockedSlot, TimeSlot } from '@booking-app/shared';
import {
  parseOrThrow,
  availabilitySchema,
  blockedSlotSchema,
  type AvailabilityInput,
  type BlockedSlotInput,
} from '@booking-app/shared';
import type { WithId } from '../repositories/base.repository';

/**
 * NOUVEAU MODÈLE: Centré sur le membre (1 membre = 1 lieu = 1 agenda)
 * - memberId est maintenant OBLIGATOIRE pour toutes les opérations
 * - Plus de fallback location-level
 * - locationId est dénormalisé depuis member.locationId
 */

interface AvailableSlotsParams {
  providerId: string;
  serviceId: string;
  memberId: string; // Obligatoire maintenant
  startDate: Date;
  endDate: Date;
  /** Effective TOTAL slot length in minutes (service + chosen
   *  variations/options + buffer). When set it overrides the base
   *  service.duration computation — used for services with variations so
   *  the slots match what's checked at booking time. */
  durationOverride?: number;
  /** Reschedule: exclude the booking being moved from the conflict check so
   *  it doesn't block its own (overlapping) slots — e.g. moving an 18h–20h
   *  booking to 17h. Mirrors SlotCheckParams.excludeBookingId. */
  excludeBookingId?: string;
}

interface SlotCheckParams {
  providerId: string;
  memberId: string; // Obligatoire maintenant
  datetime: Date;
  duration: number;
  excludeBookingId?: string; // Pour reschedule: exclure le booking actuel de la vérification
}

interface TimeSlotWithDate {
  date: Date;
  start: string;
  end: string;
  datetime: Date;
  endDatetime: Date;
}

/** Per-day availability for the booking calendar (computed in one batched pass). */
export interface DayAvailability {
  /** Local calendar date, YYYY-MM-DD. */
  date: string;
  /**
   * - `closed`    : member not open that day
   * - `full`      : open but no slot of the chosen duration fits (capacity 0)
   * - `almost_full`: capacity ≤ ALMOST_FULL_THRESHOLD
   * - `available` : plenty of room
   */
  status: 'available' | 'almost_full' | 'full' | 'closed';
  /** Realistic remaining capacity = max non-overlapping bookings that still fit. */
  capacity: number;
  /** Selectable start-times (overlapping, every slotInterval) for instant display. */
  slots: TimeSlotWithDate[];
}

interface AvailabilitySummaryParams {
  providerId: string;
  serviceId: string;
  memberId: string;
  startDate: Date;
  endDate: Date;
  /** Effective total slot length (service + variations/options + buffer). */
  durationOverride?: number;
}

/** Per-day occupancy for the service-AGNOSTIC month view (no service picked).
 *  Status is derived from how much of the open hours are taken (bookings ∪
 *  blocks), not from any service duration. Same 3-read batched pass. */
export interface DayOccupancy {
  /** Local calendar date, YYYY-MM-DD. */
  date: string;
  status: 'available' | 'almost_full' | 'full' | 'closed';
  /** Total open minutes that day (merged availability windows). */
  openMinutes: number;
  /** Open minutes still free (not taken by a booking or a block). */
  freeMinutes: number;
}

interface OccupancySummaryParams {
  providerId: string;
  memberId: string;
  startDate: Date;
  endDate: Date;
}

/** A day has only 2 (or fewer) bookings of room left → flag as "almost full". */
const ALMOST_FULL_THRESHOLD = 2;
/** Service-agnostic occupancy thresholds (fraction of open hours taken). */
const OCCUPANCY_ALMOST_FULL_RATIO = 0.75;
/** Below this many free minutes a day is effectively full (no useful gap). */
const OCCUPANCY_MIN_FREE_MINUTES = 15;

export class SchedulingService {
  /**
   * Set availability for a specific day/member
   * memberId est maintenant obligatoire
   */
  async setAvailability(providerId: string, input: AvailabilityInput): Promise<string> {
    // Validate input
    const validated = parseOrThrow(availabilitySchema, input);

    // Validate time slots
    for (const slot of validated.slots) {
      if (slot.start >= slot.end) {
        throw new Error(`Créneau invalide : ${slot.start} doit être avant ${slot.end}`);
      }
    }

    // Check for overlapping slots
    for (let i = 0; i < validated.slots.length; i++) {
      for (let j = i + 1; j < validated.slots.length; j++) {
        if (this.slotsOverlap(validated.slots[i], validated.slots[j])) {
          throw new Error('Les créneaux ne peuvent pas se chevaucher');
        }
      }
    }

    return availabilityRepository.set(providerId, {
      memberId: validated.memberId,
      locationId: validated.locationId,
      dayOfWeek: validated.dayOfWeek,
      slots: validated.slots,
      isOpen: validated.isOpen,
      effectiveFrom: null,
    });
  }

  /**
   * Set weekly schedule for a member
   * Nouveau modèle : memberId obligatoire, locationId dénormalisé
   */
  async setWeeklySchedule(
    providerId: string,
    memberId: string,
    locationId: string,
    schedule: Array<{ dayOfWeek: number; slots: TimeSlot[]; isOpen: boolean }>
  ): Promise<void> {
    await availabilityRepository.setWeeklySchedule(providerId, memberId, locationId, schedule);
  }

  /**
   * Set availability with effective date (scheduled change)
   * If effectiveFrom is in the future, creates a scheduled change
   */
  async setScheduledAvailability(
    providerId: string,
    input: AvailabilityInput & { effectiveFrom: Date }
  ): Promise<{ id: string; conflicts: AvailabilityConflict[] }> {
    // Validate input
    const validated = parseOrThrow(availabilitySchema, input);

    // Validate time slots
    for (const slot of validated.slots) {
      if (slot.start >= slot.end) {
        throw new Error(`Créneau invalide : ${slot.start} doit être avant ${slot.end}`);
      }
    }

    // Check for overlapping slots
    for (let i = 0; i < validated.slots.length; i++) {
      for (let j = i + 1; j < validated.slots.length; j++) {
        if (this.slotsOverlap(validated.slots[i], validated.slots[j])) {
          throw new Error('Les créneaux ne peuvent pas se chevaucher');
        }
      }
    }

    // Detect conflicts with existing bookings
    const conflicts = await this.detectConflicts(
      providerId,
      validated.memberId,
      validated.dayOfWeek,
      validated.slots,
      validated.isOpen,
      input.effectiveFrom
    );

    // Create the scheduled availability
    const id = await availabilityRepository.set(providerId, {
      memberId: validated.memberId,
      locationId: validated.locationId,
      dayOfWeek: validated.dayOfWeek,
      slots: validated.slots,
      isOpen: validated.isOpen,
      effectiveFrom: input.effectiveFrom,
    });

    return { id, conflicts };
  }

  /**
   * Detect booking conflicts for a scheduled availability change
   */
  async detectConflicts(
    providerId: string,
    memberId: string,
    dayOfWeek: number,
    newSlots: TimeSlot[],
    isOpen: boolean,
    effectiveFrom: Date
  ): Promise<AvailabilityConflict[]> {
    const conflicts: AvailabilityConflict[] = [];

    // Get upcoming bookings for this member from effectiveFrom date
    const farFuture = new Date(effectiveFrom);
    farFuture.setDate(farFuture.getDate() + 365); // Check up to 1 year ahead

    const bookings = await bookingRepository.getUpcomingByProvider(
      providerId,
      effectiveFrom,
      farFuture
    );

    // Filter bookings for this member and active status
    const relevantBookings = bookings.filter(
      (b) =>
        b.memberId === memberId &&
        (b.status === 'confirmed' || b.status === 'pending' || b.status === 'pending_payment')
    );

    for (const booking of relevantBookings) {
      const bookingDayOfWeek = booking.datetime.getDay();

      // Only check bookings on the affected day of week
      if (bookingDayOfWeek !== dayOfWeek) continue;

      // Check if the day is closed
      if (!isOpen) {
        conflicts.push({
          bookingId: booking.id || '',
          bookingDate: booking.datetime,
          clientName: booking.clientInfo.name,
          serviceName: booking.serviceName,
          conflictType: 'day_closed',
        });
        continue;
      }

      // Check if booking time falls within any of the new slots
      const bookingStartTime = this.formatTime(booking.datetime);
      const bookingEndTime = this.formatTime(booking.endDatetime);

      const isWithinNewSlots = newSlots.some(
        (slot) => slot.start <= bookingStartTime && slot.end >= bookingEndTime
      );

      if (!isWithinNewSlots) {
        conflicts.push({
          bookingId: booking.id || '',
          bookingDate: booking.datetime,
          clientName: booking.clientInfo.name,
          serviceName: booking.serviceName,
          conflictType: 'reduced_hours',
        });
      }
    }

    return conflicts;
  }

  /**
   * Get scheduled availability changes for a member
   */
  async getScheduledChanges(
    providerId: string,
    memberId: string
  ): Promise<WithId<Availability>[]> {
    return availabilityRepository.getScheduledChanges(providerId, memberId);
  }

  /**
   * Get all scheduled availability changes for a provider
   */
  async getAllScheduledChanges(providerId: string): Promise<WithId<Availability>[]> {
    return availabilityRepository.getAllScheduledChanges(providerId);
  }

  /**
   * Delete a scheduled availability change
   */
  async deleteScheduledChange(providerId: string, docId: string): Promise<void> {
    await availabilityRepository.deleteScheduledChange(providerId, docId);
  }

  /**
   * Apply scheduled changes that have become effective
   */
  async applyDueScheduledChanges(providerId: string): Promise<number> {
    return availabilityRepository.applyDueScheduledChanges(providerId);
  }

  /**
   * Get weekly schedule for a member
   */
  async getWeeklySchedule(
    providerId: string,
    memberId: string
  ): Promise<WithId<Availability>[]> {
    return availabilityRepository.getWeeklySchedule(providerId, memberId);
  }

  /**
   * Block a period (vacation, absence, etc.)
   * memberId est maintenant obligatoire
   */
  async blockPeriod(providerId: string, input: BlockedSlotInput): Promise<string> {
    // Validate input
    const validated = parseOrThrow(blockedSlotSchema, input);

    // Validate dates
    if (validated.endDate < validated.startDate) {
      throw new Error('La date de fin doit être après la date de début');
    }

    // Validate times if not all day
    if (!validated.allDay) {
      if (!validated.startTime || !validated.endTime) {
        throw new Error('Les heures sont requises si ce n\'est pas une journée entière');
      }
      // Only compare times if same day — different days allow any time combination
      const sameDay = validated.startDate.toDateString() === validated.endDate.toDateString();
      if (sameDay && validated.startTime >= validated.endTime) {
        throw new Error('L\'heure de fin doit être après l\'heure de début');
      }
    }

    return blockedSlotRepository.create(providerId, {
      memberId: validated.memberId,
      locationId: validated.locationId,
      startDate: validated.startDate,
      endDate: validated.endDate,
      allDay: validated.allDay,
      startTime: validated.allDay ? null : (validated.startTime ?? null),
      endTime: validated.allDay ? null : (validated.endTime ?? null),
      reason: validated.reason || null,
      // Activity fields — `category` flips this entry from a generic
      // blocked period into a typed planner activity (sport, meeting,
      // etc.). null/undefined keeps the legacy "blocked period" UX.
      category: validated.category ?? null,
      title: validated.title ?? null,
      address: validated.address ?? null,
      // Optional amount earned (cents). Important to whitelist
      // here — without it the field gets dropped on create even
      // though edit (which goes straight through the repo) keeps
      // it. That's the bug users hit on first save.
      amount: validated.amount ?? null,
    });
  }

  /**
   * Remove a blocked period
   */
  async unblockPeriod(providerId: string, blockedSlotId: string): Promise<void> {
    await blockedSlotRepository.delete(providerId, blockedSlotId);
  }

  /**
   * Get blocked slots for a provider
   */
  async getBlockedSlots(providerId: string): Promise<WithId<BlockedSlot>[]> {
    return blockedSlotRepository.getByProvider(providerId);
  }

  /**
   * Get blocked slots for a member
   */
  async getBlockedSlotsByMember(providerId: string, memberId: string): Promise<WithId<BlockedSlot>[]> {
    return blockedSlotRepository.getByMember(providerId, memberId);
  }

  /**
   * Get upcoming blocked slots
   */
  async getUpcomingBlockedSlots(providerId: string): Promise<WithId<BlockedSlot>[]> {
    return blockedSlotRepository.getUpcoming(providerId);
  }

  /**
   * Get blocked slots in a date range
   */
  async getBlockedSlotsInRange(providerId: string, startDate: Date, endDate: Date): Promise<WithId<BlockedSlot>[]> {
    return blockedSlotRepository.getInRange(providerId, startDate, endDate);
  }

  /**
   * Real-time subscription to blocked slots within a date range.
   * Use this in screens that need to stay in sync without manual
   * refetch (calendar, planning) — the callback fires immediately
   * with the current state and on every subsequent change.
   */
  subscribeToBlockedSlotsInRange(
    providerId: string,
    startDate: Date,
    endDate: Date,
    onChange: (slots: WithId<BlockedSlot>[]) => void,
    onError?: (err: Error) => void,
  ) {
    return blockedSlotRepository.subscribeInRange(providerId, startDate, endDate, onChange, onError);
  }

  /**
   * Calculate available time slots for booking
   * SIMPLIFIÉ: memberId est obligatoire, plus de fallback
   */
  async getAvailableSlots(params: AvailableSlotsParams): Promise<TimeSlotWithDate[]> {
    const { providerId, serviceId, memberId, startDate, endDate, durationOverride, excludeBookingId } = params;

    // Get service duration
    const service = await serviceRepository.getById(providerId, serviceId);
    if (!service) {
      throw new Error('Prestation non trouvée');
    }

    // Get provider settings for buffer time and slot interval
    const provider = await providerRepository.getById(providerId);
    const bufferTime = service.bufferTime || provider?.settings.defaultBufferTime || 0;
    // durationOverride is the full effective length (already includes the
    // chosen variations/options + buffer); otherwise fall back to base.
    const totalDuration = durationOverride ?? service.duration + bufferTime;
    const slotInterval = provider?.settings.slotInterval ?? 15;

    const availableSlots: TimeSlotWithDate[] = [];

    // Iterate through each day
    const currentDate = new Date(startDate);
    currentDate.setHours(0, 0, 0, 0);

    const endDateNormalized = new Date(endDate);
    endDateNormalized.setHours(23, 59, 59, 999);

    while (currentDate <= endDateNormalized) {
      const dayOfWeek = currentDate.getDay();

      // Get availability for this member on this day
      // Plus de fallback - direct lookup par memberId
      const availability = await availabilityRepository.get(
        providerId,
        memberId,
        dayOfWeek
      );

      console.log('[Scheduling] Day', dayOfWeek, '- Member', memberId, ':',
        availability ? `${availability.slots?.length} slots, isOpen: ${availability.isOpen}` : 'NOT FOUND');

      if (availability && availability.isOpen && availability.slots.length > 0) {
        // Get blocked slots for this date range
        const blockedSlots = await blockedSlotRepository.getInRange(
          providerId,
          currentDate,
          new Date(currentDate.getTime() + 24 * 60 * 60 * 1000)
        );

        // Filter blocked slots for this member
        const relevantBlockedSlots = blockedSlots.filter(
          (bs) => bs.memberId === memberId
        );

        // Get existing bookings for this date
        const dayStart = new Date(currentDate);
        const dayEnd = new Date(currentDate);
        dayEnd.setDate(dayEnd.getDate() + 1);

        const existingBookings = await bookingRepository.getUpcomingByProvider(providerId, dayStart, dayEnd);
        const relevantBookings = existingBookings.filter(
          (b) =>
            b.memberId === memberId &&
            b.id !== excludeBookingId && // reschedule: don't let a booking block its own slots
            (b.status === 'confirmed' || b.status === 'pending' || b.status === 'pending_payment')
        );

        // Generate slots for each availability window
        for (const slot of availability.slots) {
          const generatedSlots = this.generateTimeSlots(
            currentDate,
            slot.start,
            slot.end,
            totalDuration,
            slotInterval
          );

          // Filter out blocked, booked, and past/too-soon slots
          let filteredCount = 0;
          const now = new Date();
          const minBookingNoticeHours = provider?.settings.minBookingNotice ?? 2;
          const earliestBookable = new Date(now.getTime() + minBookingNoticeHours * 60 * 60 * 1000);

          for (const genSlot of generatedSlots) {
            const isBlocked = this.isTimeBlockedBySlots(
              genSlot.datetime,
              genSlot.endDatetime,
              relevantBlockedSlots
            );

            const isBooked = this.isTimeBookedByBookings(
              genSlot.datetime,
              genSlot.endDatetime,
              relevantBookings
            );

            const isTooSoon = genSlot.datetime <= earliestBookable;

            if (!isBlocked && !isBooked && !isTooSoon) {
              availableSlots.push(genSlot);
            } else {
              filteredCount++;
            }
          }

          console.log('[Scheduling] Window', slot.start, '-', slot.end, ':', generatedSlots.length, 'generated,', filteredCount, 'filtered out');
        }
      }

      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Sort by datetime to ensure chronological order regardless of availability window order
    availableSlots.sort((a, b) => a.datetime.getTime() - b.datetime.getTime());

    return availableSlots;
  }

  /**
   * Per-day availability summary for the booking calendar, computed in ONE
   * batched pass: 3 reads (weekly schedule + bookings in range + blocks in
   * range), then each day is derived in memory — instead of 2 reads × N days.
   * Returns each day's status + realistic capacity + the selectable slots, so
   * the UI shows day states BEFORE any click and opens a day instantly.
   * Same slot engine as getAvailableSlots → identical rules; the final booking
   * still re-validates live (isSlotAvailable), so a stale slot can never
   * double-book.
   */
  async getAvailabilitySummary(params: AvailabilitySummaryParams): Promise<DayAvailability[]> {
    const { providerId, serviceId, memberId, startDate, endDate, durationOverride } = params;

    const service = await serviceRepository.getById(providerId, serviceId);
    if (!service) throw new Error('Prestation non trouvée');
    const provider = await providerRepository.getById(providerId);
    const bufferTime = service.bufferTime || provider?.settings.defaultBufferTime || 0;
    const totalDuration = durationOverride ?? service.duration + bufferTime;
    const slotInterval = provider?.settings.slotInterval ?? 15;
    const minBookingNoticeHours = provider?.settings.minBookingNotice ?? 2;
    const now = new Date();
    const earliestBookable = new Date(now.getTime() + minBookingNoticeHours * 60 * 60 * 1000);

    const rangeStart = new Date(startDate);
    rangeStart.setHours(0, 0, 0, 0);
    const rangeEnd = new Date(endDate);
    rangeEnd.setHours(23, 59, 59, 999);

    // Never expose days beyond the provider's max booking advance — this is a
    // client-facing limit (the pro books via getAvailableSlots, not this).
    const maxAdvanceDays = provider?.settings.maxBookingAdvance ?? 60;
    const latestBookable = new Date(now);
    latestBookable.setHours(0, 0, 0, 0);
    latestBookable.setDate(latestBookable.getDate() + maxAdvanceDays);
    latestBookable.setHours(23, 59, 59, 999);
    if (rangeEnd > latestBookable) rangeEnd.setTime(latestBookable.getTime());

    // 3 batched reads for the whole range (instead of 2 per day).
    const [weekly, allBookings, allBlocked] = await Promise.all([
      availabilityRepository.getWeeklySchedule(providerId, memberId),
      bookingRepository.getUpcomingByProvider(providerId, rangeStart, rangeEnd),
      blockedSlotRepository.getInRange(providerId, rangeStart, rangeEnd),
    ]);

    const availabilityByDow = new Map<number, WithId<Availability>>();
    for (const a of weekly) availabilityByDow.set(a.dayOfWeek, a);

    const relevantBlocked = allBlocked.filter((bs) => bs.memberId === memberId);
    const relevantBookings = allBookings.filter(
      (b) =>
        b.memberId === memberId &&
        (b.status === 'confirmed' || b.status === 'pending' || b.status === 'pending_payment'),
    );

    const result: DayAvailability[] = [];
    const cursor = new Date(rangeStart);

    while (cursor <= rangeEnd) {
      const dateKey = this.toDateKey(cursor);
      const availability = availabilityByDow.get(cursor.getDay());

      if (!availability || !availability.isOpen || !availability.slots.length) {
        result.push({ date: dateKey, status: 'closed', capacity: 0, slots: [] });
      } else {
        const daySlots: TimeSlotWithDate[] = [];
        for (const window of availability.slots) {
          const generated = this.generateTimeSlots(cursor, window.start, window.end, totalDuration, slotInterval);
          for (const g of generated) {
            const blocked = this.isTimeBlockedBySlots(g.datetime, g.endDatetime, relevantBlocked);
            const booked = this.isTimeBookedByBookings(g.datetime, g.endDatetime, relevantBookings);
            const tooSoon = g.datetime <= earliestBookable;
            if (!blocked && !booked && !tooSoon) daySlots.push(g);
          }
        }
        daySlots.sort((a, b) => a.datetime.getTime() - b.datetime.getTime());
        const capacity = this.countNonOverlapping(daySlots);
        const status: DayAvailability['status'] =
          capacity === 0 ? 'full' : capacity <= ALMOST_FULL_THRESHOLD ? 'almost_full' : 'available';
        result.push({ date: dateKey, status, capacity, slots: daySlots });
      }

      cursor.setDate(cursor.getDate() + 1);
    }

    return result;
  }

  /**
   * Service-AGNOSTIC month occupancy (no service picked). For each day: how much
   * of the member's open hours is taken by bookings ∪ blocks → a coarse status
   * (open / busy / full / closed). Same efficient 3-read batched pass as
   * getAvailabilitySummary; no slot/duration math, so it's a quick "how busy am
   * I this month" overview rather than bookable slots.
   */
  async getOccupancySummary(params: OccupancySummaryParams): Promise<DayOccupancy[]> {
    const { providerId, memberId, startDate, endDate } = params;

    const rangeStart = new Date(startDate);
    rangeStart.setHours(0, 0, 0, 0);
    const rangeEnd = new Date(endDate);
    rangeEnd.setHours(23, 59, 59, 999);

    const [weekly, allBookings, allBlocked] = await Promise.all([
      availabilityRepository.getWeeklySchedule(providerId, memberId),
      bookingRepository.getUpcomingByProvider(providerId, rangeStart, rangeEnd),
      blockedSlotRepository.getInRange(providerId, rangeStart, rangeEnd),
    ]);

    const availabilityByDow = new Map<number, WithId<Availability>>();
    for (const a of weekly) availabilityByDow.set(a.dayOfWeek, a);

    const relevantBlocked = allBlocked.filter((bs) => bs.memberId === memberId);
    const relevantBookings = allBookings.filter(
      (b) =>
        b.memberId === memberId &&
        (b.status === 'confirmed' || b.status === 'pending' || b.status === 'pending_payment'),
    );

    const result: DayOccupancy[] = [];
    const cursor = new Date(rangeStart);

    while (cursor <= rangeEnd) {
      const dateKey = this.toDateKey(cursor);
      const availability = availabilityByDow.get(cursor.getDay());

      if (!availability || !availability.isOpen || !availability.slots.length) {
        result.push({ date: dateKey, status: 'closed', openMinutes: 0, freeMinutes: 0 });
        cursor.setDate(cursor.getDate() + 1);
        continue;
      }

      const dayStart = new Date(cursor);
      dayStart.setHours(0, 0, 0, 0);
      const dayStartMs = dayStart.getTime();
      const dayEndMs = dayStartMs + 24 * 60 * 60 * 1000;

      // Open windows in minutes-of-day.
      const openMerged = this.mergeIntervals(
        availability.slots
          .map((w) => [this.hhmmToMinutes(w.start), this.hhmmToMinutes(w.end)] as [number, number])
          .filter(([s, e]) => e > s),
      );
      const openMinutes = openMerged.reduce((sum, [s, e]) => sum + (e - s), 0);

      if (openMinutes === 0) {
        result.push({ date: dateKey, status: 'closed', openMinutes: 0, freeMinutes: 0 });
        cursor.setDate(cursor.getDate() + 1);
        continue;
      }

      // Occupied = bookings ∪ blocks, clamped to this day, in minutes-of-day.
      const clampToDay = (start: Date, end: Date): [number, number] | null => {
        const sMs = Math.max(start.getTime(), dayStartMs);
        const eMs = Math.min(end.getTime(), dayEndMs);
        if (eMs <= sMs) return null;
        return [Math.floor((sMs - dayStartMs) / 60000), Math.ceil((eMs - dayStartMs) / 60000)];
      };
      const occupied: Array<[number, number]> = [];
      for (const b of relevantBookings) {
        const iv = clampToDay(b.datetime, b.endDatetime);
        if (iv) occupied.push(iv);
      }
      for (const bs of relevantBlocked) {
        const iv = clampToDay(bs.startDate, bs.endDate);
        if (iv) occupied.push(iv);
      }
      const occupiedWithinOpen = this.intersectSum(openMerged, this.mergeIntervals(occupied));
      const freeMinutes = Math.max(0, openMinutes - occupiedWithinOpen);
      const ratio = occupiedWithinOpen / openMinutes;

      let status: DayOccupancy['status'];
      if (freeMinutes < OCCUPANCY_MIN_FREE_MINUTES || ratio >= 1) status = 'full';
      else if (ratio >= OCCUPANCY_ALMOST_FULL_RATIO) status = 'almost_full';
      else status = 'available';

      result.push({ date: dateKey, status, openMinutes, freeMinutes });
      cursor.setDate(cursor.getDate() + 1);
    }

    return result;
  }

  /** "HH:MM" → minutes since midnight. */
  private hhmmToMinutes(hhmm: string): number {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
  }

  /** Sort + merge overlapping/adjacent [start,end] minute intervals. */
  private mergeIntervals(intervals: Array<[number, number]>): Array<[number, number]> {
    if (intervals.length === 0) return [];
    const sorted = [...intervals].sort((a, b) => a[0] - b[0]);
    const merged: Array<[number, number]> = [[sorted[0][0], sorted[0][1]]];
    for (let i = 1; i < sorted.length; i++) {
      const last = merged[merged.length - 1];
      const [s, e] = sorted[i];
      if (s <= last[1]) last[1] = Math.max(last[1], e);
      else merged.push([s, e]);
    }
    return merged;
  }

  /** Total overlap length between two SORTED, merged interval sets. */
  private intersectSum(a: Array<[number, number]>, b: Array<[number, number]>): number {
    let i = 0;
    let j = 0;
    let sum = 0;
    while (i < a.length && j < b.length) {
      const start = Math.max(a[i][0], b[j][0]);
      const end = Math.min(a[i][1], b[j][1]);
      if (end > start) sum += end - start;
      if (a[i][1] < b[j][1]) i++;
      else j++;
    }
    return sum;
  }

  /**
   * Realistic capacity = how many bookings of the chosen duration can still be
   * placed back-to-back. The generated slots overlap (one every slotInterval),
   * so a naive count wildly overstates reality (3h free + 2h service + 10-min
   * interval → ~7 overlapping starts but only 1 real booking). Greedily pick
   * the earliest slot, then the next that starts at/after the previous end.
   * Expects `slots` sorted ascending by datetime.
   */
  private countNonOverlapping(slots: TimeSlotWithDate[]): number {
    let count = 0;
    let lastEnd = -Infinity;
    for (const s of slots) {
      if (s.datetime.getTime() >= lastEnd) {
        count++;
        lastEnd = s.endDatetime.getTime();
      }
    }
    return count;
  }

  /** Local YYYY-MM-DD (timezone-safe — toISOString would shift to UTC). */
  private toDateKey(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  /**
   * Check if a specific time slot is available
   * SIMPLIFIÉ: memberId est obligatoire, plus de fallback
   */
  async isSlotAvailable(params: SlotCheckParams): Promise<boolean> {
    const { providerId, memberId, datetime, duration, excludeBookingId } = params;

    // Reject slots in the past or too close to now (minBookingNotice)
    const provider = await providerRepository.getById(providerId);
    const minBookingNoticeHours = provider?.settings.minBookingNotice ?? 2;
    const now = new Date();
    const earliestBookable = new Date(now.getTime() + minBookingNoticeHours * 60 * 60 * 1000);
    if (datetime <= earliestBookable) {
      return false;
    }

    const endDatetime = new Date(datetime.getTime() + duration * 60 * 1000);
    const dayOfWeek = datetime.getDay();

    // Check availability for this member on this day
    // Plus de fallback
    const availability = await availabilityRepository.get(
      providerId,
      memberId,
      dayOfWeek
    );

    if (!availability || !availability.isOpen) {
      return false;
    }

    // Check if time falls within any availability slot
    const timeStr = this.formatTime(datetime);
    const endTimeStr = this.formatTime(endDatetime);
    const isWithinAvailability = availability.slots.some(
      (slot) => slot.start <= timeStr && slot.end >= endTimeStr
    );

    if (!isWithinAvailability) {
      return false;
    }

    // Check for blocked slots
    const blockedSlots = await blockedSlotRepository.getInRange(
      providerId,
      datetime,
      endDatetime
    );

    const isBlocked = blockedSlots.some(
      (bs) =>
        bs.memberId === memberId &&
        this.isTimeBlockedBySlot(datetime, endDatetime, bs)
    );

    if (isBlocked) {
      return false;
    }

    // Check for existing bookings
    const existingBookings = await bookingRepository.getUpcomingByProvider(providerId, datetime, endDatetime);
    const hasConflict = existingBookings.some(
      (b) =>
        b.id !== excludeBookingId && // Exclure le booking actuel (pour reschedule)
        b.memberId === memberId &&
        (b.status === 'confirmed' || b.status === 'pending' || b.status === 'pending_payment') &&
        this.timesOverlap(datetime, endDatetime, b.datetime, b.endDatetime)
    );

    return !hasConflict;
  }

  /**
   * Generate time slots for a given availability window
   */
  private generateTimeSlots(
    date: Date,
    startTime: string,
    endTime: string,
    slotDuration: number,
    slotInterval: number = 15
  ): TimeSlotWithDate[] {
    const slots: TimeSlotWithDate[] = [];

    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);

    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    let currentMinutes = startMinutes;

    while (currentMinutes + slotDuration <= endMinutes) {
      const slotStartHour = Math.floor(currentMinutes / 60);
      const slotStartMin = currentMinutes % 60;

      const slotEndMinutes = currentMinutes + slotDuration;
      const slotEndHour = Math.floor(slotEndMinutes / 60);
      const slotEndMin = slotEndMinutes % 60;

      const datetime = new Date(date);
      datetime.setHours(slotStartHour, slotStartMin, 0, 0);

      const endDatetime = new Date(date);
      endDatetime.setHours(slotEndHour, slotEndMin, 0, 0);

      slots.push({
        date: new Date(date),
        start: this.formatTimeFromMinutes(currentMinutes),
        end: this.formatTimeFromMinutes(slotEndMinutes),
        datetime,
        endDatetime,
      });

      // Move to next slot
      currentMinutes += slotInterval;
    }

    return slots;
  }

  /**
   * Check if two time slots overlap
   */
  private slotsOverlap(slot1: TimeSlot, slot2: TimeSlot): boolean {
    return slot1.start < slot2.end && slot2.start < slot1.end;
  }

  /**
   * Check if two datetime ranges overlap
   */
  private timesOverlap(start1: Date, end1: Date, start2: Date, end2: Date): boolean {
    return start1 < end2 && start2 < end1;
  }

  /**
   * Check if a time is blocked by any blocked slot
   */
  private isTimeBlockedBySlots(
    start: Date,
    end: Date,
    blockedSlots: WithId<BlockedSlot>[]
  ): boolean {
    return blockedSlots.some((bs) => this.isTimeBlockedBySlot(start, end, bs));
  }

  /**
   * Check if a time is blocked by a specific blocked slot
   */
  private isTimeBlockedBySlot(start: Date, end: Date, blockedSlot: BlockedSlot): boolean {
    // Check date range
    const slotDate = new Date(start);
    slotDate.setHours(0, 0, 0, 0);

    const blockStart = new Date(blockedSlot.startDate);
    blockStart.setHours(0, 0, 0, 0);

    const blockEnd = new Date(blockedSlot.endDate);
    blockEnd.setHours(23, 59, 59, 999);

    if (slotDate < blockStart || slotDate > blockEnd) {
      return false;
    }

    // If all day, the entire day is blocked
    if (blockedSlot.allDay) {
      return true;
    }

    // Check time range
    if (blockedSlot.startTime && blockedSlot.endTime) {
      const slotStartTime = this.formatTime(start);
      const slotEndTime = this.formatTime(end);

      return (
        slotStartTime < blockedSlot.endTime && blockedSlot.startTime < slotEndTime
      );
    }

    return false;
  }

  /**
   * Check if a time conflicts with existing bookings
   */
  private isTimeBookedByBookings(
    start: Date,
    end: Date,
    bookings: Array<{ datetime: Date; endDatetime: Date }>
  ): boolean {
    return bookings.some((b) => this.timesOverlap(start, end, b.datetime, b.endDatetime));
  }

  /**
   * Format date to time string (HH:mm)
   */
  private formatTime(date: Date): string {
    return date.toTimeString().substring(0, 5);
  }

  /**
   * Format minutes to time string (HH:mm)
   */
  private formatTimeFromMinutes(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }
}

// Singleton instance
export const schedulingService = new SchedulingService();
