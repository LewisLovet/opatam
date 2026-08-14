/**
 * useTeamAvailabilities Hook
 * Calculates next available date for each member of a Team plan provider
 */

import { useState, useEffect, useCallback } from 'react';
import { schedulingService, memberService, serviceRepository } from '@booking-app/firebase';
import type { WithId } from '@booking-app/firebase';
import type { Member } from '@booking-app/shared';
import i18n from '../lib/i18n';

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
 * Format date for display: "Aujourd'hui"/"Today", "Demain"/"Tomorrow", or a
 * localized short date like "Lun. 3 février" / "Mon, February 3"
 */
function formatDate(date: Date | null): string | null {
  if (!date) return null;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (dateOnly.getTime() === today.getTime()) return i18n.t('dates.today');
  if (dateOnly.getTime() === tomorrow.getTime()) return i18n.t('dates.tomorrow');

  const formatted = date.toLocaleDateString(i18n.language, {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
  });
  // Intl lowercases weekdays in French — keep the capitalized display
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

/** Fenêtre de recherche de la prochaine disponibilité, en jours. */
const LOOKAHEAD_DAYS = 60;

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
  const horizon = new Date(today);
  horizon.setDate(horizon.getDate() + LOOKAHEAD_DAYS - 1);
  horizon.setHours(23, 59, 59, 999);

  // UN appel sur tout l'horizon, au lieu d'un appel par jour.
  //
  // La version précédente interrogeait le service jour après jour et
  // s'arrêtait au premier succès : rapide quand le membre est libre demain,
  // mais jusqu'à 60 tours quand il ne l'est pas — et c'est justement le cas
  // d'un membre fraîchement ajouté dont les horaires ne sont pas encore
  // réglés. Depuis que `getAvailableSlots` lit toute sa plage en une fois,
  // demander 60 jours coûte le même nombre de requêtes qu'en demander un.
  try {
    const slots = await schedulingService.getAvailableSlots({
      providerId,
      serviceId,
      memberId,
      startDate: today,
      endDate: horizon,
    });
    if (slots.length === 0) return null;
    // Les créneaux sont déjà triés chronologiquement par le service ; on
    // ramène la date du premier, à minuit, comme le faisait l'ancienne
    // boucle avec son `checkDate`.
    const first = new Date(slots[0].datetime);
    first.setHours(0, 0, 0, 0);
    return first;
  } catch {
    return null;
  }
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
      setError(err.message || i18n.t('errors.availability.loadFailed'));
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
