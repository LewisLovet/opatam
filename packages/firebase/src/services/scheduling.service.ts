import {
  availabilityRepository,
  blockedSlotRepository,
  bookingRepository,
  locationRepository,
  memberRepository,
  serviceRepository,
  providerRepository,
} from '../repositories';
import type { Availability, AvailabilityConflict, BlockedSlot, TimeSlot } from '@booking-app/shared';
import { isServiceOpenOnDay, blockedWindowForDay } from '@booking-app/shared';
import {
  ajouterJours,
  bornesDeJourLocal,
  heureLocale,
  instantDepuisHeureLocale,
  jourLocal,
  jourSemaineCalendaire,
  jourSemaineLocal,
  minutesLocales,
  normaliserFuseau,
} from '@booking-app/shared';
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
  /**
   * Fuseau IANA du LIEU (« Indian/Reunion »). Les horaires configurés sont
   * des heures murales : sans lui, la conversion en instants dépend de la
   * machine qui exécute. Absent → `FUSEAU_COMPAT` le temps du chantier ;
   * fourni mais invalide → erreur, jamais de repli silencieux.
   */
  timeZone?: string;
}

interface SlotCheckParams {
  providerId: string;
  memberId: string; // Obligatoire maintenant
  datetime: Date;
  duration: number;
  excludeBookingId?: string; // Pour reschedule: exclure le booking actuel de la vérification
  /**
   * Prestations réservées sur ce créneau. Sert à vérifier leurs jours
   * autorisés — sans elles, la restriction par jour ne serait qu'un effet
   * d'affichage, contournable par un appel direct à l'API.
   *
   * Facultatif pour ne pas casser les appelants existants : une réservation
   * sans prestation connue est vérifiée comme avant.
   */
  serviceIds?: string[];
  /**
   * Fuseau IANA du LIEU. C'est lui qui dit à quel JOUR et à quelle HEURE
   * LOCALE correspond l'instant vérifié : `datetime.getDay()` répondait
   * dans le fuseau de la machine, donc un rendez-vous de début ou de fin
   * de journée pouvait être comparé aux horaires du mauvais jour.
   */
  timeZone?: string;
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
   * - `closed`        : member not open that day
   * - `service_closed`: member open, but the service isn't offered that day
   *                     (`availableDays`). Distinct de `closed` et de `full`
   *                     à dessein : « fermé » accuserait le professionnel
   *                     d'être absent, « complet » ferait croire à une forte
   *                     demande. Ni l'un ni l'autre n'est vrai, et les deux
   *                     découragent le client au lieu de l'orienter vers un
   *                     jour où la prestation existe.
   * - `full`          : open but no slot of the chosen duration fits (capacity 0)
   * - `almost_full`   : capacity ≤ ALMOST_FULL_THRESHOLD
   * - `available`     : plenty of room
   */
  status: 'available' | 'almost_full' | 'full' | 'closed' | 'service_closed';
  /** Realistic remaining capacity = max non-overlapping bookings that still fit. */
  capacity: number;
  /** Selectable start-times (overlapping, every slotInterval) for instant display. */
  slots: TimeSlotWithDate[];
}

interface AvailabilitySummaryParams {
  providerId: string;
  /** Prestation principale — porte la durée et le temps de battement. */
  serviceId: string;
  memberId: string;
  startDate: Date;
  endDate: Date;
  /** Effective total slot length (service + variations/options + buffer). */
  durationOverride?: number;
  /**
   * Prestations SUPPLÉMENTAIRES du panier. Un rendez-vous groupé tient sur un
   * seul créneau : un jour n'est réservable que s'il est autorisé par TOUTES.
   * Sans elles, le calendrier ouvrait des jours que la validation refusait
   * ensuite — A du lundi au vendredi plus B du mardi au samedi laissaient le
   * lundi cliquable.
   */
  extraServiceIds?: string[];
  /**
   * Fuseau IANA du LIEU (« Indian/Reunion »). Les horaires configurés sont
   * des heures murales : sans lui, la conversion en instants dépend de la
   * machine qui exécute. Absent → `FUSEAU_COMPAT` le temps du chantier ;
   * fourni mais invalide → erreur, jamais de repli silencieux.
   */
  timeZone?: string;
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
  /**
   * Fuseau IANA du LIEU. Absent → `FUSEAU_COMPAT` le temps du chantier ;
   * fourni mais invalide → erreur, jamais de repli silencieux.
   */
  timeZone?: string;
}

/**
 * ÉCHAFAUDAGE — fuseau utilisé tant qu'aucun appelant n'en fournit un.
 *
 * Étape 3 du chantier fuseaux : le moteur sait désormais convertir dans un
 * fuseau EXPLICITE, mais `location.timezone` n'existe pas encore (étape 4)
 * et les appelants ne le passent pas encore (étape 6). En attendant, on
 * reproduit exactement le comportement d'aujourd'hui : le serveur web force
 * Europe/Paris (`apps/web/next.config.ts`), donc ce repli ne change RIEN
 * pour les salons français — il fige juste par écrit ce qui était subi.
 *
 * Ce n'est PAS le repli silencieux qui a mis « Europe/Paris » sur les
 * prestataires portugais : un fuseau FOURNI mais invalide lève une erreur,
 * il n'est jamais remplacé en douce. Seul un `timeZone` absent retombe ici.
 *
 * À SUPPRIMER à l'étape 12, quand tous les appelants fourniront le fuseau
 * du lieu. C'est la dernière hypothèse « tout le monde est à Paris » du
 * moteur.
 */
const FUSEAU_COMPAT = 'Europe/Paris';

function fuseauDuMoteur(timeZone: string | null | undefined): string {
  if (timeZone === null || timeZone === undefined) return FUSEAU_COMPAT;
  const zone = normaliserFuseau(timeZone);
  if (!zone) {
    throw new Error(
      `Fuseau IANA invalide : « ${timeZone} ». Un décalage brut (« +04:00 ») ne connaît ` +
        `pas les changements d'heure et ne peut pas servir de fuseau de lieu.`,
    );
  }
  return zone;
}

/** A day has only 2 (or fewer) bookings of room left → flag as "almost full". */
const ALMOST_FULL_THRESHOLD = 2;
/** Service-agnostic occupancy thresholds (fraction of open hours taken). */
const OCCUPANCY_ALMOST_FULL_RATIO = 0.75;
/** Below this many free minutes a day is effectively full (no useful gap). */
const OCCUPANCY_MIN_FREE_MINUTES = 15;

export class SchedulingService {
  /**
   * Le fuseau du lieu où ce membre travaille, relu EN BASE.
   *
   * Pourquoi le moteur le résout lui-même plutôt que de l'exiger de ses
   * appelants : il y en a une quinzaine — tunnel public, espace pro web,
   * écrans mobiles, calculs de capacité — et il suffirait qu'un seul
   * l'oublie pour que ce salon-là reparte sur l'heure de Paris sans que
   * rien ne le signale. Un appelant qui connaît déjà le lieu peut toujours
   * passer `timeZone` et s'épargner ces deux lectures.
   *
   * `undefined` quand le lieu n'a pas encore de fuseau : le moteur garde
   * alors son repli de compatibilité. On ne DEVINE jamais.
   */
  private async fuseauDuLieuDuMembre(
    providerId: string,
    memberId: string | null | undefined,
  ): Promise<string | undefined> {
    if (!memberId) return undefined;
    try {
      const member = await memberRepository.getById(providerId, memberId);
      if (!member?.locationId) return undefined;
      const location = await locationRepository.getById(providerId, member.locationId);
      return location?.timezone ?? undefined;
    } catch {
      // Une lecture impossible ne doit pas empêcher de proposer des
      // créneaux : on retombe sur le comportement d'avant le chantier.
      return undefined;
    }
  }

  /**
   * Set availability for a specific day/member
   * memberId est maintenant obligatoire
   */
  async setAvailability(providerId: string, input: AvailabilityInput): Promise<string> {
    // Validate input
    const validated = parseOrThrow(availabilitySchema, input);

    // Validate time slots
    for (const slot of validated.slots) {
      if (slot.start === slot.end || this.hhmmToMinutes(slot.start) >= this.endMin(slot.end)) {
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
      if (slot.start === slot.end || this.hhmmToMinutes(slot.start) >= this.endMin(slot.end)) {
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
    effectiveFrom: Date,
    /** Fuseau IANA du lieu — décide du jour de la semaine d'un rendez-vous. */
    timeZone?: string
  ): Promise<AvailabilityConflict[]> {
    const fuseau = fuseauDuMoteur(timeZone);
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
      const bookingDayOfWeek = jourSemaineLocal(booking.datetime, fuseau);

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

      // Check if booking time falls within any of the new slots.
      // Heures LOCALES DU LIEU — les horaires saisis en sont, l'instant du
      // rendez-vous n'en est pas.
      const bookingStartTime = heureLocale(booking.datetime, fuseau);
      const bookingEndTime = heureLocale(booking.endDatetime, fuseau);

      const isWithinNewSlots = newSlots.some(
        (slot) =>
          this.hhmmToMinutes(slot.start) <= this.hhmmToMinutes(bookingStartTime) &&
          this.endMin(slot.end) >= this.endMin(bookingEndTime)
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
      // Une fin "00:00" vaut minuit = fin de journée (1440), donc un blocage
      // 22:00→00:00 le même jour est valide. `start === end` (00:00→00:00
      // compris) reste refusé : saisie ambiguë.
      //
      // La comparaison s'applique dès que les heures décrivent UNE MÊME
      // journée — période d'un seul jour, ou tranche répétée sur plusieurs.
      // Elle ne s'applique PAS à une période continue sur plusieurs jours :
      // partir un vendredi à 18:00 pour revenir le lundi à 09:00 est
      // parfaitement légitime, et c'est justement l'inversion qui l'exprime.
      const sameDay = validated.startDate.toDateString() === validated.endDate.toDateString();
      const trancheQuotidienne = sameDay || validated.spanMode === 'daily';
      if (
        trancheQuotidienne &&
        (validated.startTime === validated.endTime ||
          this.hhmmToMinutes(validated.startTime) >= this.endMin(validated.endTime))
      ) {
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
      // Sans effet si `allDay` ou si la période tient sur un jour : les deux
      // lectures y donnent le même résultat, autant ne rien écrire.
      spanMode: validated.spanMode ?? 'continuous',
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
    const fuseau = fuseauDuMoteur(
      params.timeZone ?? (await this.fuseauDuLieuDuMembre(providerId, memberId)),
    );

    const [service, provider] = await Promise.all([
      serviceRepository.getById(providerId, serviceId),
      providerRepository.getById(providerId),
    ]);
    if (!service) {
      throw new Error('Prestation non trouvée');
    }

    const bufferTime = service.bufferTime || provider?.settings.defaultBufferTime || 0;
    // durationOverride is the full effective length (already includes the
    // chosen variations/options + buffer); otherwise fall back to base.
    const totalDuration = durationOverride ?? service.duration + bufferTime;
    const slotInterval = provider?.settings.slotInterval ?? 15;

    // Les bornes sont celles des JOURNÉES LOCALES du lieu, pas de celles de
    // la machine : `setHours(0,0,0,0)` visait minuit là où tournait le code.
    // `bornesDeJourLocal` ne suppose jamais 24 h — une journée de bascule en
    // dure 23 ou 25.
    const jourDebut = jourLocal(startDate, fuseau);
    const jourFin = jourLocal(endDate, fuseau);
    const rangeStart = bornesDeJourLocal(jourDebut, fuseau).debut;
    const rangeEnd = bornesDeJourLocal(jourFin, fuseau).fin;

    // 3 lectures pour TOUTE la plage, au lieu de 3 PAR JOUR.
    //
    // La version précédente rouvrait les mêmes collections à chaque tour de
    // boucle : sur 7 jours cela faisait 23 aller-retours en série, sur 60
    // jours 182. Or les horaires ne comptent que 7 documents (un par jour de
    // semaine), et les réservations comme les créneaux bloqués se lisent
    // aussi bien sur l'intervalle entier — ils n'étaient de toute façon pas
    // filtrés par membre côté Firestore, mais en mémoire juste après.
    //
    // C'est exactement le schéma déjà employé par `getAvailabilitySummary`
    // et `getOccupancySummary` ci-dessous ; `getAvailableSlots` ne l'avait
    // jamais reçu.
    const [weekly, allBookings, allBlocked] = await Promise.all([
      availabilityRepository.getWeeklySchedule(providerId, memberId),
      bookingRepository.getUpcomingByProvider(providerId, rangeStart, rangeEnd),
      blockedSlotRepository.getInRange(providerId, rangeStart, rangeEnd),
    ]);

    const availabilityByDow = new Map<number, WithId<Availability>>();
    for (const a of weekly) availabilityByDow.set(a.dayOfWeek, a);

    const relevantBlockedSlots = allBlocked.filter((bs) => bs.memberId === memberId);
    const relevantBookings = allBookings.filter(
      (b) =>
        b.memberId === memberId &&
        b.id !== excludeBookingId && // reschedule: don't let a booking block its own slots
        (b.status === 'confirmed' || b.status === 'pending' || b.status === 'pending_payment'),
    );

    // `now` est figé avant la boucle : le calculer à l'intérieur faisait
    // dériver le seuil de préavis d'un jour à l'autre sur les longues plages.
    const now = new Date();
    const minBookingNoticeHours = provider?.settings.minBookingNotice ?? 2;
    const earliestBookable = new Date(now.getTime() + minBookingNoticeHours * 60 * 60 * 1000);

    const availableSlots: TimeSlotWithDate[] = [];

    // On avance en JOURS CALENDAIRES (« 2026-09-23 »), pas en `Date` : un
    // curseur `Date` avec `setDate(+1)` et `getDay()` lit le jour de la
    // semaine dans le fuseau de la machine. Pour un salon réunionnais vu
    // depuis un serveur parisien, cela pouvait appliquer les horaires du
    // mauvais jour. Une date calendaire, elle, n'a pas de fuseau.
    for (let jour = jourDebut; jour <= jourFin; jour = ajouterJours(jour, 1)) {
      const jourSemaine = jourSemaineCalendaire(jour);
      const availability = availabilityByDow.get(jourSemaine);
      // La prestation peut restreindre ses jours EN PLUS des horaires du
      // membre. Les deux conditions doivent être réunies : un mardi fermé
      // le reste, même si la prestation l'autorise.
      const serviceOpen = isServiceOpenOnDay(service, jourSemaine);

      if (serviceOpen && availability && availability.isOpen && availability.slots.length > 0) {
        // Generate slots for each availability window
        for (const slot of availability.slots) {
          const generatedSlots = this.generateTimeSlots(
            jour,
            slot.start,
            slot.end,
            totalDuration,
            slotInterval,
            fuseau
          );

          // Filter out blocked, booked, and past/too-soon slots
          for (const genSlot of generatedSlots) {
            const isBlocked = this.isTimeBlockedBySlots(
              genSlot.datetime,
              genSlot.endDatetime,
              relevantBlockedSlots,
              fuseau
            );

            const isBooked = this.isTimeBookedByBookings(
              genSlot.datetime,
              genSlot.endDatetime,
              relevantBookings
            );

            const isTooSoon = genSlot.datetime <= earliestBookable;

            if (!isBlocked && !isBooked && !isTooSoon) {
              availableSlots.push(genSlot);
            }
          }
        }
      }

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
    const { providerId, serviceId, memberId, startDate, endDate, durationOverride, extraServiceIds } =
      params;

    const service = await serviceRepository.getById(providerId, serviceId);
    if (!service) throw new Error('Prestation non trouvée');

    // Les prestations secondaires du panier ne servent qu'à restreindre les
    // jours : la durée est déjà agrégée dans `durationOverride`.
    const others = extraServiceIds?.length
      ? (
          await Promise.all(
            extraServiceIds
              .filter((id) => id !== serviceId)
              .map((id) => serviceRepository.getById(providerId, id)),
          )
        ).filter((svc): svc is NonNullable<typeof svc> => Boolean(svc))
      : [];
    const provider = await providerRepository.getById(providerId);
    const fuseau = fuseauDuMoteur(
      params.timeZone ?? (await this.fuseauDuLieuDuMembre(providerId, memberId)),
    );
    const bufferTime = service.bufferTime || provider?.settings.defaultBufferTime || 0;
    const totalDuration = durationOverride ?? service.duration + bufferTime;
    const slotInterval = provider?.settings.slotInterval ?? 15;
    const minBookingNoticeHours = provider?.settings.minBookingNotice ?? 2;
    const now = new Date();
    const earliestBookable = new Date(now.getTime() + minBookingNoticeHours * 60 * 60 * 1000);

    // Bornes des JOURNÉES LOCALES du lieu (voir getAvailableSlots).
    const jourDebut = jourLocal(startDate, fuseau);
    const rangeStart = bornesDeJourLocal(jourDebut, fuseau).debut;
    let rangeEnd = bornesDeJourLocal(jourLocal(endDate, fuseau), fuseau).fin;

    // Never expose days beyond the provider's max booking advance — this is a
    // client-facing limit (the pro books via getAvailableSlots, not this).
    const maxAdvanceDays = provider?.settings.maxBookingAdvance ?? 60;
    const latestBookable = bornesDeJourLocal(
      ajouterJours(jourLocal(now, fuseau), maxAdvanceDays),
      fuseau,
    ).fin;
    if (rangeEnd > latestBookable) rangeEnd = latestBookable;

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

    // Jours CALENDAIRES, comme dans `getAvailableSlots` : un curseur `Date`
    // lit son jour de la semaine dans le fuseau de la machine.
    // `rangeEnd` a pu être ramené en arrière par le plafond de réservation
    // à l'avance, d'où la borne relue ici plutôt que `jourFin`.
    const dernierJour = jourLocal(rangeEnd, fuseau);
    for (let jour = jourDebut; jour <= dernierJour; jour = ajouterJours(jour, 1)) {
      const dateKey = jour;
      const jourSemaine = jourSemaineCalendaire(jour);
      const availability = availabilityByDow.get(jourSemaine);
      // Un jour non couvert par la prestation se présente comme fermé : du
      // point de vue du client, il n'y a rien à y réserver.
      const serviceOpen =
        isServiceOpenOnDay(service, jourSemaine) &&
        others.every((svc) => isServiceOpenOnDay(svc, jourSemaine));

      const providerClosed = !availability || !availability.isOpen || !availability.slots.length;
      if (providerClosed || !serviceOpen) {
        // Le professionnel fermé prime : c'est l'information la plus simple,
        // et elle vaut pour toutes les prestations. On ne parle de
        // « non proposé » que lorsqu'il est ouvert par ailleurs.
        result.push({
          date: dateKey,
          status: providerClosed ? 'closed' : 'service_closed',
          capacity: 0,
          slots: [],
        });
      } else {
        const daySlots: TimeSlotWithDate[] = [];
        for (const window of availability.slots) {
          const generated = this.generateTimeSlots(jour, window.start, window.end, totalDuration, slotInterval, fuseau);
          for (const g of generated) {
            const blocked = this.isTimeBlockedBySlots(g.datetime, g.endDatetime, relevantBlocked, fuseau);
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
    const fuseau = fuseauDuMoteur(
      params.timeZone ?? (await this.fuseauDuLieuDuMembre(providerId, memberId)),
    );

    const jourDebut = jourLocal(startDate, fuseau);
    const jourFin = jourLocal(endDate, fuseau);
    const rangeStart = bornesDeJourLocal(jourDebut, fuseau).debut;
    const rangeEnd = bornesDeJourLocal(jourFin, fuseau).fin;

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

    for (let jour = jourDebut; jour <= jourFin; jour = ajouterJours(jour, 1)) {
      const dateKey = jour;
      const availability = availabilityByDow.get(jourSemaineCalendaire(jour));

      if (!availability || !availability.isOpen || !availability.slots.length) {
        result.push({ date: dateKey, status: 'closed', openMinutes: 0, freeMinutes: 0 });
        continue;
      }

      // Les bornes réelles de la journée locale. `dayStart + 24 h` était
      // faux les deux dimanches de bascule : la journée en dure 23 ou 25,
      // et une réservation du lendemain pouvait être comptée dans la veille.
      const bornes = bornesDeJourLocal(jour, fuseau);
      const dayStartMs = bornes.debut.getTime();
      const dayEndMs = bornes.fin.getTime() + 1;

      // Open windows in minutes-of-day.
      const openMerged = this.mergeIntervals(
        availability.slots
          .map((w) => [this.hhmmToMinutes(w.start), this.endMin(w.end)] as [number, number])
          .filter(([s, e]) => e > s),
      );
      const openMinutes = openMerged.reduce((sum, [s, e]) => sum + (e - s), 0);

      if (openMinutes === 0) {
        result.push({ date: dateKey, status: 'closed', openMinutes: 0, freeMinutes: 0 });
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
    }

    return result;
  }

  /** "HH:MM" → minutes since midnight. */
  private hhmmToMinutes(hhmm: string): number {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
  }

  /**
   * Minutes for a window END time. A slot/window ending at "00:00" means
   * midnight = END OF DAY (24:00 = 1440), not the start of the day (0).
   * Without this, a range like 19:00→00:00 has end < start → 0 slots.
   * (Only used for END values; a START of "00:00" stays 0, which is correct.)
   */
  private endMin(hhmm: string): number {
    const m = this.hhmmToMinutes(hhmm);
    return m === 0 ? 24 * 60 : m;
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
  /**
   * Check if a specific time slot is available
   * SIMPLIFIÉ: memberId est obligatoire, plus de fallback
   */
  async isSlotAvailable(params: SlotCheckParams): Promise<boolean> {
    const { providerId, memberId, datetime, duration, excludeBookingId, serviceIds } = params;
    const fuseau = fuseauDuMoteur(
      params.timeZone ?? (await this.fuseauDuLieuDuMembre(providerId, memberId)),
    );

    // Jours autorisés par les prestations réservées. Toutes doivent accepter
    // ce jour : un rendez-vous groupé tient sur un seul créneau.
    if (serviceIds?.length) {
      const services = await Promise.all(
        serviceIds.map((id) => serviceRepository.getById(providerId, id)),
      );
      const dow = jourSemaineLocal(datetime, fuseau);
      if (!services.every((svc) => isServiceOpenOnDay(svc, dow))) {
        return false;
      }
    }

    // Reject slots in the past or too close to now (minBookingNotice)
    const provider = await providerRepository.getById(providerId);
    const minBookingNoticeHours = provider?.settings.minBookingNotice ?? 2;
    const now = new Date();
    const earliestBookable = new Date(now.getTime() + minBookingNoticeHours * 60 * 60 * 1000);
    if (datetime <= earliestBookable) {
      return false;
    }

    const endDatetime = new Date(datetime.getTime() + duration * 60 * 1000);
    const dayOfWeek = jourSemaineLocal(datetime, fuseau);

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

    // Check if time falls within any availability slot.
    // Heures LOCALES DU LIEU : `formatTime` lisait l'heure de la machine,
    // si bien qu'un créneau valide chez le salon pouvait être refusé —
    // ou, plus grave, un créneau hors horaires accepté.
    const timeStr = heureLocale(datetime, fuseau);
    const endTimeStr = heureLocale(endDatetime, fuseau);
    const isWithinAvailability = availability.slots.some(
      (slot) =>
        this.hhmmToMinutes(slot.start) <= this.hhmmToMinutes(timeStr) &&
        this.endMin(slot.end) >= this.endMin(endTimeStr)
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
        this.isTimeBlockedBySlot(datetime, endDatetime, bs, fuseau)
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
    jour: string,
    startTime: string,
    endTime: string,
    slotDuration: number,
    slotInterval: number = 15,
    fuseau: string = FUSEAU_COMPAT
  ): TimeSlotWithDate[] {
    const slots: TimeSlotWithDate[] = [];

    // "00:00" en END = minuit = fin de journée (1440), pas 0 — sinon une plage
    // finissant à minuit (ex. 19:00→00:00) ne génère aucun créneau.
    const startMinutes = this.hhmmToMinutes(startTime);
    const endMinutes = this.endMin(endTime);

    // Le jour auquel le créneau appartient, comme instant. Remplace
    // `new Date(date)` : c'était minuit dans le fuseau de la MACHINE.
    const jourDebut = bornesDeJourLocal(jour, fuseau).debut;

    let currentMinutes = startMinutes;

    while (currentMinutes + slotDuration <= endMinutes) {
      const slotEndMinutes = currentMinutes + slotDuration;

      // Conversion EXPLICITE, validée par aller-retour (voir fuseaux.ts).
      // `null` = cette heure murale n'existe pas ce jour-là, l'horloge
      // locale l'a sautée : aucun créneau n'est proposé. Avant, `setHours`
      // rendait quand même une date — d'où deux créneaux différents sur le
      // même instant le dimanche du passage à l'heure d'été.
      const datetime = instantDepuisHeureLocale(jour, currentMinutes, fuseau);
      if (!datetime) {
        currentMinutes += slotInterval;
        continue;
      }

      // La FIN se calcule en temps RÉEL, pas en heure murale : une
      // prestation d'une heure dure une heure, même si l'horloge saute
      // pendant. Identique à l'ancien calcul les jours ordinaires.
      const endDatetime = new Date(datetime.getTime() + slotDuration * 60 * 1000);

      slots.push({
        date: new Date(jourDebut),
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
    return (
      this.hhmmToMinutes(slot1.start) < this.endMin(slot2.end) &&
      this.hhmmToMinutes(slot2.start) < this.endMin(slot1.end)
    );
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
    blockedSlots: WithId<BlockedSlot>[],
    fuseau: string = FUSEAU_COMPAT
  ): boolean {
    return blockedSlots.some((bs) => this.isTimeBlockedBySlot(start, end, bs, fuseau));
  }

  /**
   * Check if a time is blocked by a specific blocked slot
   */
  private isTimeBlockedBySlot(
    start: Date,
    end: Date,
    blockedSlot: BlockedSlot,
    fuseau: string = FUSEAU_COMPAT,
  ): boolean {
    // ── Une seule définition de la règle ──────────────────────────────────
    //
    // Elle vivait ici, et une SECONDE interprétation vivait côté Cloud
    // Functions (`calculateNextAvailableSlot`), qui ne lisait que `allDay` :
    // une fermeture horaire n'y comptait pour rien et `nextAvailableSlot`
    // annonçait disponible un jour entièrement bloqué. Deux exemplaires,
    // deux comportements — c'est déjà comme ça qu'un blocage multi-jours
    // avait fini par n'écarter aucun créneau chez Grs.hair du 18 au 22 août
    // 2026. La règle est donc remontée dans `@booking-app/shared`, testée,
    // et `functions` en garde un miroir explicite faute de pouvoir importer.
    const fenetre = blockedWindowForDay(
      {
        allDay: blockedSlot.allDay,
        startDate: blockedSlot.startDate,
        endDate: blockedSlot.endDate,
        startTime: blockedSlot.startTime,
        endTime: blockedSlot.endTime,
        spanMode: blockedSlot.spanMode,
      },
      start,
      fuseau
    );
    if (!fenetre) return false;

    // Minutes LOCALES DU LIEU : la fenêtre bloquée est saisie en heures
    // murales, l'instant du créneau n'en est pas une.
    const slotStartMin = minutesLocales(start, fuseau);
    const finMin = minutesLocales(end, fuseau);
    const slotEndMin = finMin === 0 ? 24 * 60 : finMin;
    return slotStartMin < fenetre.endMin && fenetre.startMin < slotEndMin;
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
  /**
   * Format minutes to time string (HH:mm)
   */
  private formatTimeFromMinutes(minutes: number): string {
    // % 24 → un créneau finissant à 1440 (minuit) s'affiche "00:00", pas "24:00".
    const hours = Math.floor(minutes / 60) % 24;
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }
}

// Singleton instance
export const schedulingService = new SchedulingService();
