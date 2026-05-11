import {
  where,
  orderBy,
  limit,
  Timestamp,
  query,
  onSnapshot,
  type Unsubscribe,
  type QueryConstraint,
} from 'firebase/firestore';
import type { Booking, BookingStatus } from '@booking-app/shared';
import { BaseRepository, convertTimestamps, removeUndefined, type WithId } from './base.repository';

/**
 * Booking filter options
 */
export interface BookingFilters {
  status?: BookingStatus | BookingStatus[];
  memberId?: string;
  locationId?: string;
  serviceId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}

/**
 * Repository for bookings collection
 */
export class BookingRepository extends BaseRepository<Booking> {
  protected collectionName = 'bookings';

  /**
   * Override create to handle date conversion
   */
  async create(data: Omit<Booking, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const docData = removeUndefined({
      ...data,
      datetime: Timestamp.fromDate(data.datetime),
      endDatetime: Timestamp.fromDate(data.endDatetime),
      cancelledAt: data.cancelledAt ? Timestamp.fromDate(data.cancelledAt) : null,
      remindersSent: data.remindersSent.map((d) => Timestamp.fromDate(d)),
    } as Record<string, unknown>);

    return super.create(docData as unknown as Omit<Booking, 'id' | 'createdAt' | 'updatedAt'>);
  }

  /**
   * Get bookings by provider
   */
  async getByProvider(providerId: string, filters?: BookingFilters): Promise<WithId<Booking>[]> {
    const constraints = [
      where('providerId', '==', providerId),
      orderBy('datetime', 'desc'),
    ];

    if (filters?.status) {
      if (Array.isArray(filters.status)) {
        constraints.push(where('status', 'in', filters.status));
      } else {
        constraints.push(where('status', '==', filters.status));
      }
    }

    if (filters?.memberId) {
      constraints.push(where('memberId', '==', filters.memberId));
    }

    if (filters?.locationId) {
      constraints.push(where('locationId', '==', filters.locationId));
    }

    if (filters?.startDate) {
      constraints.push(where('datetime', '>=', Timestamp.fromDate(filters.startDate)));
    }

    if (filters?.endDate) {
      constraints.push(where('datetime', '<=', Timestamp.fromDate(filters.endDate)));
    }

    if (filters?.limit) {
      constraints.push(limit(filters.limit) as unknown as typeof constraints[0]);
    }

    return this.query(constraints);
  }

  /**
   * Real-time subscription to a provider's bookings. Same filter
   * semantics as `getByProvider` but updates the callback whenever
   * Firestore emits a change (add / edit / cancel). Returns an
   * unsubscribe to call on cleanup.
   *
   * Use this when the consumer needs the calendar / dashboard to
   * stay in sync without a pull-to-refresh — adding a booking in
   * one screen reflects on every other open screen.
   */
  subscribeByProvider(
    providerId: string,
    filters: BookingFilters | undefined,
    onChange: (bookings: WithId<Booking>[]) => void,
    onError?: (err: Error) => void,
  ): Unsubscribe {
    const constraints: QueryConstraint[] = [
      where('providerId', '==', providerId),
      orderBy('datetime', 'desc'),
    ];
    if (filters?.status) {
      if (Array.isArray(filters.status)) {
        constraints.push(where('status', 'in', filters.status));
      } else {
        constraints.push(where('status', '==', filters.status));
      }
    }
    if (filters?.memberId) constraints.push(where('memberId', '==', filters.memberId));
    if (filters?.locationId) constraints.push(where('locationId', '==', filters.locationId));
    if (filters?.startDate) constraints.push(where('datetime', '>=', Timestamp.fromDate(filters.startDate)));
    if (filters?.endDate) constraints.push(where('datetime', '<=', Timestamp.fromDate(filters.endDate)));
    if (filters?.limit) constraints.push(limit(filters.limit));

    const q = query(this.getCollectionRef(), ...constraints);
    return onSnapshot(
      q,
      (snap) => {
        const bookings = snap.docs.map((docSnap) => ({
          id: docSnap.id,
          ...convertTimestamps<Booking>(docSnap.data()),
        }));
        onChange(bookings);
      },
      (err) => {
        console.error('[bookingRepository] subscribeByProvider error', err);
        onError?.(err);
      },
    );
  }

  /**
   * Get bookings by client
   */
  async getByClient(clientId: string): Promise<WithId<Booking>[]> {
    return this.query([
      where('clientId', '==', clientId),
      orderBy('datetime', 'desc'),
    ]);
  }

  /**
   * Get bookings by client email (for non-logged-in users)
   */
  async getByClientEmail(email: string): Promise<WithId<Booking>[]> {
    return this.query([
      where('clientInfo.email', '==', email),
      orderBy('datetime', 'desc'),
    ]);
  }

  /**
   * Get bookings by member
   */
  async getByMember(providerId: string, memberId: string): Promise<WithId<Booking>[]> {
    return this.query([
      where('providerId', '==', providerId),
      where('memberId', '==', memberId),
      orderBy('datetime', 'desc'),
    ]);
  }

  /**
   * Get booking by cancel token
   */
  async getByCancelToken(token: string): Promise<WithId<Booking> | null> {
    const results = await this.query([
      where('cancelToken', '==', token),
      limit(1),
    ]);

    return results[0] || null;
  }

  /**
   * Get upcoming bookings in date range.
   * Includes `pending_payment` so a slot in mid-Stripe-Checkout is treated
   * as taken (otherwise four clients could grab the same slot in parallel).
   */
  async getUpcoming(from: Date, to: Date): Promise<WithId<Booking>[]> {
    return this.query([
      where('datetime', '>=', Timestamp.fromDate(from)),
      where('datetime', '<=', Timestamp.fromDate(to)),
      where('status', 'in', ['pending_payment', 'pending', 'confirmed']),
      orderBy('datetime', 'asc'),
    ]);
  }

  /**
   * Get upcoming bookings for a provider. Includes `pending_payment` for
   * the same reason as `getUpcoming` — slot reservation during checkout.
   */
  async getUpcomingByProvider(providerId: string, from: Date, to: Date): Promise<WithId<Booking>[]> {
    return this.query([
      where('providerId', '==', providerId),
      where('datetime', '>=', Timestamp.fromDate(from)),
      where('datetime', '<=', Timestamp.fromDate(to)),
      where('status', 'in', ['pending_payment', 'pending', 'confirmed']),
      orderBy('datetime', 'asc'),
    ]);
  }

  /**
   * Get bookings needing reminders
   */
  async getNeedingReminders(reminderTime: Date): Promise<WithId<Booking>[]> {
    return this.query([
      where('datetime', '<=', Timestamp.fromDate(reminderTime)),
      where('status', '==', 'confirmed'),
      orderBy('datetime', 'asc'),
    ]);
  }

  /**
   * Get bookings by status
   */
  async getByStatus(status: BookingStatus): Promise<WithId<Booking>[]> {
    return this.query([
      where('status', '==', status),
      orderBy('datetime', 'desc'),
    ]);
  }

  /**
   * Get pending bookings for provider
   */
  async getPendingByProvider(providerId: string): Promise<WithId<Booking>[]> {
    return this.query([
      where('providerId', '==', providerId),
      where('status', '==', 'pending'),
      orderBy('datetime', 'asc'),
    ]);
  }

  /**
   * Get today's bookings for provider
   */
  async getTodayByProvider(providerId: string): Promise<WithId<Booking>[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return this.query([
      where('providerId', '==', providerId),
      where('datetime', '>=', Timestamp.fromDate(today)),
      where('datetime', '<', Timestamp.fromDate(tomorrow)),
      where('status', 'in', ['pending_payment', 'pending', 'confirmed']),
      orderBy('datetime', 'asc'),
    ]);
  }

  /**
   * Update booking status
   */
  async updateStatus(
    id: string,
    status: BookingStatus,
    cancelData?: {
      cancelledBy: 'client' | 'provider';
      cancelReason?: string;
    }
  ): Promise<void> {
    const updateData: Partial<Booking> = { status };

    if (status === 'cancelled' && cancelData) {
      updateData.cancelledAt = new Date();
      updateData.cancelledBy = cancelData.cancelledBy;
      updateData.cancelReason = cancelData.cancelReason || null;
    }

    await this.update(id, updateData);
  }

  /**
   * Add reminder sent timestamp
   */
  async addReminderSent(id: string, sentAt: Date): Promise<void> {
    const booking = await this.getById(id);
    if (booking) {
      await this.update(id, {
        remindersSent: [...booking.remindersSent, sentAt],
      });
    }
  }

  /**
   * Count bookings by provider
   */
  async countByProvider(providerId: string, status?: BookingStatus): Promise<number> {
    const filters: BookingFilters = {};
    if (status) {
      filters.status = status;
    }

    const bookings = await this.getByProvider(providerId, filters);
    return bookings.length;
  }

  /**
   * Get statistics for provider
   */
  async getStatsByProvider(providerId: string): Promise<{
    total: number;
    pending: number;
    confirmed: number;
    cancelled: number;
    noshow: number;
  }> {
    const bookings = await this.getByProvider(providerId);

    return {
      total: bookings.length,
      pending: bookings.filter((b) => b.status === 'pending').length,
      confirmed: bookings.filter((b) => b.status === 'confirmed').length,
      cancelled: bookings.filter((b) => b.status === 'cancelled').length,
      noshow: bookings.filter((b) => b.status === 'noshow').length,
    };
  }
}

// Singleton instance
export const bookingRepository = new BookingRepository();
