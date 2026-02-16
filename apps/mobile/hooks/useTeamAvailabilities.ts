/**
 * useTeamAvailabilities Hook
 * Calculates next available date for each member of a Team plan provider
 */

import { useState, useEffect, useCallback } from 'react';
import { schedulingService, memberService, serviceRepository } from '@booking-app/firebase';
import type { WithId } from '@booking-app/firebase';
import type { Member } from '@booking-app/shared';

export interface MemberAvailability {
  memberId: string;
  memberName: string;
  memberPhoto: string | null;
  nextDate: Date | null;
  formattedDate: string | null;
}

export interface UseTeamAvailabilitiesResult {
  memberAvailabilities: MemberAvailability[];
  earliestDate: Date | null;
  earliestFormattedDate: string | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Format date for display: "Aujourd'hui", "Demain", or "Lun. 3 février"
 */
function formatDate(date: Date | null): string | null {
  if (!date) return null;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (dateOnly.getTime() === today.getTime()) return "Aujourd'hui";
  if (dateOnly.getTime() === tomorrow.getTime()) return 'Demain';

  const days = ['Dim.', 'Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.'];
  const months = [
    'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
    'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
  ];
  return `${days[date.getDay()]} ${date.getDate()} ${months[date.getMonth()]}`;
}

/**
 * Find the next available date for a single member
 */
async function findNextDateForMember(
  providerId: string,
  memberId: string,
  serviceId: string
): Promise<Date | null> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < 60; i++) {
    const checkDate = new Date(today);
    checkDate.setDate(checkDate.getDate() + i);
    const endOfDay = new Date(checkDate);
    endOfDay.setHours(23, 59, 59, 999);

    try {
      const slots = await schedulingService.getAvailableSlots({
        providerId,
        serviceId,
        memberId,
        startDate: checkDate,
        endDate: endOfDay,
      });
      if (slots.length > 0) return checkDate;
    } catch {
      // No availability for this day
    }
  }
  return null;
}

/**
 * Hook to get next available date per member for Team plan providers
 */
export function useTeamAvailabilities(
  providerId: string | undefined,
  isTeam: boolean
): UseTeamAvailabilitiesResult {
  const [memberAvailabilities, setMemberAvailabilities] = useState<MemberAvailability[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAvailabilities = useCallback(async () => {
    if (!providerId || !isTeam) {
      setMemberAvailabilities([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Get active members and first active service
      const [members, services] = await Promise.all([
        memberService.getActiveByProvider(providerId),
        serviceRepository.getByProvider(providerId),
      ]);

      const activeService = services.find((s) => s.isActive);
      if (!activeService || members.length <= 1) {
        setMemberAvailabilities([]);
        setLoading(false);
        return;
      }

      // Fetch next date for each member in parallel
      const results = await Promise.all(
        members.map(async (member) => {
          const nextDate = await findNextDateForMember(
            providerId,
            member.id,
            activeService.id!
          );
          return {
            memberId: member.id,
            memberName: member.name,
            memberPhoto: member.photoURL,
            nextDate,
            formattedDate: formatDate(nextDate),
          };
        })
      );

      setMemberAvailabilities(results);
    } catch (err: any) {
      console.error('Error fetching team availabilities:', err);
      setError(err.message || 'Erreur lors du chargement des disponibilités');
    } finally {
      setLoading(false);
    }
  }, [providerId, isTeam]);

  useEffect(() => {
    fetchAvailabilities();
  }, [fetchAvailabilities]);

  // Compute earliest date across all members
  const datesWithValue = memberAvailabilities
    .filter((ma) => ma.nextDate !== null)
    .map((ma) => ma.nextDate!);

  const earliestDate = datesWithValue.length > 0
    ? datesWithValue.sort((a, b) => a.getTime() - b.getTime())[0]
    : null;

  return {
    memberAvailabilities,
    earliestDate,
    earliestFormattedDate: formatDate(earliestDate),
    loading,
    error,
    refresh: fetchAvailabilities,
  };
}
