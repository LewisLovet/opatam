/**
 * useNextAvailableDate Hook
 * Calculates the next available booking date for a provider
 */

import { useState, useEffect, useCallback } from 'react';
import { schedulingService, memberService, serviceRepository } from '@booking-app/firebase';

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

  // Format as "Lun. 3 février"
  const days = ['Dim.', 'Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.'];
  const months = [
    'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
    'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
  ];

  return `${days[date.getDay()]} ${date.getDate()} ${months[date.getMonth()]}`;
}

/**
 * Hook to get the next available booking date for a provider
 * @param providerId - The provider ID
 * @param memberId - Optional member ID (uses default member if not provided)
 */
export function useNextAvailableDate(
  providerId: string | undefined,
  memberId?: string
): UseNextAvailableDateResult {
  const [nextAvailableDate, setNextAvailableDate] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchNextAvailableDate = useCallback(async () => {
    if (!providerId) {
      setNextAvailableDate(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Get member to use (provided or default)
      let targetMemberId = memberId;
      if (!targetMemberId) {
        // Get the default member for this provider
        const members = await memberService.getActiveByProvider(providerId);
        const defaultMember = members.find((m) => m.isDefault) || members[0];
        if (!defaultMember) {
          setNextAvailableDate(null);
          setLoading(false);
          return;
        }
        targetMemberId = defaultMember.id;
      }

      // Get first active service to use for slot calculation
      const services = await serviceRepository.getByProvider(providerId);
      const activeService = services.find((s) => s.isActive);
      if (!activeService) {
        setNextAvailableDate(null);
        setLoading(false);
        return;
      }

      // Search for the next available slot, checking day by day
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const maxDaysToCheck = 60; // Check up to 60 days ahead
      let foundDate: Date | null = null;

      for (let i = 0; i < maxDaysToCheck && !foundDate; i++) {
        const checkDate = new Date(today);
        checkDate.setDate(checkDate.getDate() + i);

        const endOfDay = new Date(checkDate);
        endOfDay.setHours(23, 59, 59, 999);

        try {
          const slots = await schedulingService.getAvailableSlots({
            providerId,
            serviceId: activeService.id!,
            memberId: targetMemberId,
            startDate: checkDate,
            endDate: endOfDay,
          });

          if (slots.length > 0) {
            // Found available slots for this day
            foundDate = checkDate;
          }
        } catch {
          // Day has no availability, continue to next day
        }
      }

      setNextAvailableDate(foundDate);
    } catch (err: any) {
      console.error('Error fetching next available date:', err);
      setError(err.message || 'Erreur lors du chargement des disponibilités');
      setNextAvailableDate(null);
    } finally {
      setLoading(false);
    }
  }, [providerId, memberId]);

  useEffect(() => {
    fetchNextAvailableDate();
  }, [fetchNextAvailableDate]);

  const refresh = useCallback(async () => {
    await fetchNextAvailableDate();
  }, [fetchNextAvailableDate]);

  const formattedDate = formatNextAvailableDate(nextAvailableDate);

  return { nextAvailableDate, loading, error, formattedDate, refresh };
}
