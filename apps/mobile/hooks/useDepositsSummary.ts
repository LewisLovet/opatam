/**
 * useDepositsSummary Hook
 *
 * Aggregates deposit data for the pro dashboard "Acomptes encaissés"
 * card. Pulls confirmed bookings over the last 30 days, filters those
 * whose deposit was actually paid, and rolls up:
 *   - total amount collected (cents)
 *   - number of bookings concerned
 *   - top 3 services ranked by paid-deposit count
 *
 * Lives on the client because the providerStats* aggregation pipeline
 * doesn't track deposit revenue separately yet (Phase 2 territory).
 * Cheap to compute: a single Firestore query + in-memory reduce.
 */

import { useEffect, useState } from 'react';
import { bookingService } from '@booking-app/firebase';

const WINDOW_DAYS = 30;

export interface DepositsTopService {
  serviceId: string;
  serviceName: string;
  bookingsCount: number;
  totalAmount: number; // cents
}

export interface DepositsSummary {
  loading: boolean;
  /** Cents collected over the last 30 days from paid deposits. */
  totalAmount: number;
  /** Number of confirmed bookings whose deposit was paid. */
  bookingsCount: number;
  /** Top 3 services by paid-deposit count, descending. */
  topServices: DepositsTopService[];
}

const EMPTY: DepositsSummary = {
  loading: false,
  totalAmount: 0,
  bookingsCount: 0,
  topServices: [],
};

export function useDepositsSummary(
  providerId: string | undefined,
): DepositsSummary {
  const [state, setState] = useState<DepositsSummary>({
    ...EMPTY,
    loading: true,
  });

  useEffect(() => {
    if (!providerId) {
      setState(EMPTY);
      return;
    }
    let cancelled = false;
    setState((s) => ({ ...s, loading: true }));

    (async () => {
      try {
        const startDate = new Date(
          Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000,
        );
        const bookings = await bookingService.getProviderBookings(providerId, {
          startDate,
          status: 'confirmed',
        });

        let totalAmount = 0;
        let bookingsCount = 0;
        const byService = new Map<
          string,
          { name: string; count: number; total: number }
        >();

        for (const b of bookings) {
          // Only count bookings with an actually-paid deposit. Pending,
          // failed, refunded all stay out of the collected total.
          if (!b.deposit || b.deposit.status !== 'paid') continue;
          totalAmount += b.deposit.amount ?? 0;
          bookingsCount += 1;

          const sid = b.serviceId || '_unknown';
          const sname = b.serviceName || 'Prestation';
          const entry = byService.get(sid) ?? {
            name: sname,
            count: 0,
            total: 0,
          };
          entry.count += 1;
          entry.total += b.deposit.amount ?? 0;
          byService.set(sid, entry);
        }

        const topServices: DepositsTopService[] = [...byService.entries()]
          .map(([id, e]) => ({
            serviceId: id,
            serviceName: e.name,
            bookingsCount: e.count,
            totalAmount: e.total,
          }))
          .sort((a, b) => b.bookingsCount - a.bookingsCount)
          .slice(0, 3);

        if (!cancelled) {
          setState({
            loading: false,
            totalAmount,
            bookingsCount,
            topServices,
          });
        }
      } catch (err) {
        console.warn('[useDepositsSummary] error:', err);
        if (!cancelled) setState({ ...EMPTY, loading: false });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [providerId]);

  return state;
}
