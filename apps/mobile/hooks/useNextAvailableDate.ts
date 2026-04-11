/**
 * useNextAvailableDate Hook
 * Reads the cached nextAvailableSlot from the provider document.
 * This value is kept up-to-date by Cloud Functions:
 *   - onBookingWrite: recalculates after each booking change
 *   - recalculateExpiredSlots: runs every 2h for stale values
 */

import { useState, useEffect, useCallback } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@booking-app/firebase';

export interface UseNextAvailableDateResult {
  nextAvailableDate: Date | null;
  loading: boolean;
  error: string | null;
  formattedDate: string | null;
  refresh: () => Promise<void>;
}

/**
 * Format the next available date for display
 * Returns: "Aujourd'hui", "Demain", or "Lun. 3 février"
 */
function formatNextAvailableDate(date: Date | null): string | null {
  if (!date) return null;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (dateOnly.getTime() === today.getTime()) {
    return "Aujourd'hui";
  }

  if (dateOnly.getTime() === tomorrow.getTime()) {
    return 'Demain';
  }

  const days = ['Dim.', 'Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.'];
  const months = [
    'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
    'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
  ];

  return `${days[date.getDay()]} ${date.getDate()} ${months[date.getMonth()]}`;
}

/**
 * Hook to get the next available booking date for a provider.
 * Reads directly from the provider's cached `nextAvailableSlot` field
 * instead of recalculating (which was doing 60 Firestore queries).
 */
export function useNextAvailableDate(
  providerId: string | undefined,
): UseNextAvailableDateResult {
  const [nextAvailableDate, setNextAvailableDate] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!providerId) {
      setNextAvailableDate(null);
      setLoading(false);
      return;
    }

    // Real-time listener on provider doc for nextAvailableSlot
    const unsubscribe = onSnapshot(
      doc(db, 'providers', providerId),
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          const slot = data.nextAvailableSlot;
          setNextAvailableDate(slot?.toDate?.() ?? null);
        } else {
          setNextAvailableDate(null);
        }
        setLoading(false);
      },
      (err) => {
        console.error('Error listening to nextAvailableSlot:', err);
        setError(err.message || 'Erreur');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [providerId]);

  const refresh = useCallback(async () => {
    // No-op — the onSnapshot listener keeps it up to date automatically
  }, []);

  const formattedDate = formatNextAvailableDate(nextAvailableDate);

  return { nextAvailableDate, loading, error, formattedDate, refresh };
}
