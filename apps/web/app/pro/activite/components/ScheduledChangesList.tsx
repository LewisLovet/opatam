'use client';

import { useState } from 'react';
import { Button, Badge } from '@/components/ui';
import { schedulingService } from '@booking-app/firebase';
import type { Availability, Member, Location, TimeSlot } from '@booking-app/shared';
import { Calendar, Clock, Trash2, User, MapPin, Loader2 } from 'lucide-react';

type WithId<T> = { id: string } & T;

interface ScheduledChangesListProps {
  providerId: string;
  scheduledChanges: WithId<Availability>[];
  members: WithId<Member>[];
  locations: WithId<Location>[];
  onDelete: (changeId: string) => void;
  loading?: boolean;
}

const DAY_NAMES = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const DAY_NAMES_FULL = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

export function ScheduledChangesList({
  providerId,
  scheduledChanges,
  members,
  locations,
  onDelete,
  loading = false,
}: ScheduledChangesListProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (changeId: string) => {
    setDeletingId(changeId);
    try {
      await schedulingService.deleteScheduledChange(providerId, changeId);
      onDelete(changeId);
    } catch (error) {
      console.error('Error deleting scheduled change:', error);
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(date);
  };

  const formatSlots = (slots: TimeSlot[]) => {
    if (slots.length === 0) return 'Ferme';
    return slots.map((s) => `${s.start} - ${s.end}`).join(', ');
  };

  const getMemberName = (memberId: string) => {
    const member = members.find((m) => m.id === memberId);
    return member?.name || 'Membre inconnu';
  };

  const getLocationName = (locationId: string) => {
    const location = locations.find((l) => l.id === locationId);
    return location?.name || 'Lieu inconnu';
  };

  // Group changes by effectiveFrom date
  const groupedChanges = scheduledChanges.reduce((acc, change) => {
    if (!change.effectiveFrom) return acc;
    const dateKey = change.effectiveFrom.toISOString().split('T')[0];
    if (!acc[dateKey]) {
      acc[dateKey] = [];
    }
    acc[dateKey].push(change);
    return acc;
  }, {} as Record<string, WithId<Availability>[]>);

  // Sort dates
  const sortedDates = Object.keys(groupedChanges).sort();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 text-primary-600 animate-spin" />
      </div>
    );
  }

  if (scheduledChanges.length === 0) {
    return (
      <div className="text-center py-8 px-4">
        <Calendar className="w-10 h-10 mx-auto mb-3 text-gray-400" />
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Aucun changement planifié
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
          Les changements planifiés apparaîtront ici
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {sortedDates.map((dateKey) => {
        const changes = groupedChanges[dateKey];
        const effectiveDate = new Date(dateKey);

        return (
          <div key={dateKey} className="space-y-3">
            {/* Date header */}
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary-600 dark:text-primary-400" />
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                A partir du {formatDate(effectiveDate)}
              </span>
              <Badge variant="info" size="sm">
                {changes.length} jour(s)
              </Badge>
            </div>

            {/* Changes for this date */}
            <div className="space-y-2 pl-6">
              {changes.map((change) => (
                <div
                  key={change.id}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700"
                >
                  <div className="flex-1 min-w-0">
                    {/* Day and status */}
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-900 dark:text-white">
                        {DAY_NAMES_FULL[change.dayOfWeek]}
                      </span>
                      {!change.isOpen && (
                        <Badge variant="error" size="sm">Ferme</Badge>
                      )}
                    </div>

                    {/* Slots */}
                    {change.isOpen && change.slots.length > 0 && (
                      <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400 mb-1">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{formatSlots(change.slots)}</span>
                      </div>
                    )}

                    {/* Member and location */}
                    <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-500">
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {getMemberName(change.memberId)}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {getLocationName(change.locationId)}
                      </span>
                    </div>
                  </div>

                  {/* Delete button */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(change.id)}
                    disabled={deletingId === change.id}
                    className="text-gray-500 hover:text-error-600 dark:text-gray-400 dark:hover:text-error-400"
                  >
                    {deletingId === change.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
