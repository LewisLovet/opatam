import {
  availabilityRepository,
  blockedSlotRepository,
  bookingRepository,
  serviceRepository,
  providerRepository,
} from '../repositories';
import type { Availability, AvailabilityConflict, BlockedSlot, TimeSlot } from '@booking-app/shared';
import {
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

export class SchedulingService {
  /**
   * Set availability for a specific day/member
   * memberId est maintenant obligatoire
   */
  async setAvailability(providerId: string, input: AvailabilityInput): Promise<string> {
    // Validate input
    const validated = availabilitySchema.parse(input);

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
    const validated = availabilitySchema.parse(input);

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
        (b.status === 'confirmed' || b.status === 'pending')
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
    const validated = blockedSlotSchema.parse(input);

    // Validate dates
    if (validated.endDate < validated.startDate) {
      throw new Error('La date de fin doit être après la date de début');
    }

    // Validate times if not all day
    if (!validated.allDay) {
      if (!validated.startTime || !validated.endTime) {
        throw new Error('Les heures sont requises si ce n\'est pas une journée entière');
      }
      if (validated.startTime >= validated.endTime) {
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
   * Calculate available time slots for booking
   * SIMPLIFIÉ: memberId est obligatoire, plus de fallback
   */
  async getAvailableSlots(params: AvailableSlotsParams): Promise<TimeSlotWithDate[]> {
    const { providerId, serviceId, memberId, startDate, endDate } = params;

    // Get service duration
    const service = await serviceRepository.getById(providerId, serviceId);
    if (!service) {
      throw new Error('Prestation non trouvée');
    }

    // Get provider settings for buffer time and slot interval
    const provider = await providerRepository.getById(providerId);
    const bufferTime = service.bufferTime || provider?.settings.defaultBufferTime || 0;
    const totalDuration = service.duration + bufferTime;
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

        const existingBookings = await bookingRepository.getUpcoming(dayStart, dayEnd);
        const relevantBookings = existingBookings.filter(
          (b) =>
            b.providerId === providerId &&
            b.memberId === memberId &&
            (b.status === 'confirmed' || b.status === 'pending')
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

          // Filter out blocked and booked slots
          let filteredCount = 0;
          const now = new Date();

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

            const isPast = genSlot.datetime <= now;

            if (!isBlocked && !isBooked && !isPast) {
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

    return availableSlots;
  }

  /**
   * Check if a specific time slot is available
   * SIMPLIFIÉ: memberId est obligatoire, plus de fallback
   */
  async isSlotAvailable(params: SlotCheckParams): Promise<boolean> {
    const { providerId, memberId, datetime, duration, excludeBookingId } = params;

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
    const existingBookings = await bookingRepository.getUpcoming(datetime, endDatetime);
    const hasConflict = existingBookings.some(
      (b) =>
        b.id !== excludeBookingId && // Exclure le booking actuel (pour reschedule)
        b.providerId === providerId &&
        b.memberId === memberId &&
        (b.status === 'confirmed' || b.status === 'pending') &&
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
