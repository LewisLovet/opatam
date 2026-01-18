'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button, useToast } from '@/components/ui';
import {
  schedulingService,
  locationService,
  memberService,
} from '@booking-app/firebase';
import { Loader2, Clock, Pencil, Save, X, Users } from 'lucide-react';
import { AvailabilityGrid } from './AvailabilityGrid';
import { AvailabilityView } from './AvailabilityView';
import { BlockedSlotsSection, type BlockedSlotFormData } from './BlockedSlotsSection';
import type { Availability, BlockedSlot, Location, Member, TimeSlot } from '@booking-app/shared';

type WithId<T> = { id: string } & T;

interface DaySchedule {
  dayOfWeek: number;
  isOpen: boolean;
  slots: TimeSlot[];
}

/**
 * NOUVEAU MODÈLE: Centré sur le membre (1 membre = 1 lieu = 1 agenda)
 * - On sélectionne un membre, pas un lieu
 * - Le lieu est déduit du membre sélectionné
 */
export function DisponibilitesTab() {
  const { provider } = useAuth();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [availabilities, setAvailabilities] = useState<WithId<Availability>[]>([]);
  const [pendingChanges, setPendingChanges] = useState<DaySchedule[]>([]);
  const [blockedSlots, setBlockedSlots] = useState<WithId<BlockedSlot>[]>([]);
  const [locations, setLocations] = useState<WithId<Location>[]>([]);
  const [members, setMembers] = useState<WithId<Member>[]>([]);

  // Selected member (NOUVEAU MODÈLE: clé principale)
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

  // Get selected member and their location
  const selectedMember = members.find((m) => m.id === selectedMemberId);
  const selectedLocation = selectedMember
    ? locations.find((l) => l.id === selectedMember.locationId)
    : null;

  // Check if provider has multiple members
  const hasMultipleMembers = members.length > 1;

  // Fetch data
  const fetchData = useCallback(async () => {
    if (!provider) return;

    setLoading(true);
    try {
      // Fetch locations and members
      const [locationsData, membersData] = await Promise.all([
        locationService.getActiveByProvider(provider.id),
        memberService.getByProvider(provider.id),
      ]);

      setLocations(locationsData);
      setMembers(membersData);

      // Set default selected member (default member or first one)
      if (!selectedMemberId && membersData.length > 0) {
        const defaultMember = membersData.find((m) => m.isDefault) || membersData[0];
        if (defaultMember) {
          setSelectedMemberId(defaultMember.id);
        }
      }

      // Fetch blocked slots
      const blockedSlotsData = await schedulingService.getUpcomingBlockedSlots(provider.id);
      setBlockedSlots(blockedSlotsData);
    } catch (error) {
      console.error('Fetch error:', error);
      toast.error('Erreur lors du chargement des donnees');
    } finally {
      setLoading(false);
    }
  }, [provider, selectedMemberId, toast]);

  // Fetch availability for selected member
  const fetchAvailability = useCallback(async () => {
    if (!provider || !selectedMemberId) return;

    try {
      // NOUVEAU MODÈLE: getWeeklySchedule prend seulement providerId et memberId
      const availabilityData = await schedulingService.getWeeklySchedule(
        provider.id,
        selectedMemberId
      );
      setAvailabilities(availabilityData);
    } catch (error) {
      console.error('Fetch availability error:', error);
    }
  }, [provider, selectedMemberId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (selectedMemberId) {
      fetchAvailability();
    }
  }, [selectedMemberId, fetchAvailability]);

  // Start editing mode
  const handleStartEditing = () => {
    setIsEditing(true);
    setPendingChanges([]);
  };

  // Cancel editing and discard changes
  const handleCancelEditing = () => {
    setIsEditing(false);
    setPendingChanges([]);
  };

  // Track changes during editing (no auto-save)
  const handleScheduleChange = (schedule: DaySchedule[]) => {
    setPendingChanges(schedule);
  };

  // Save all pending changes
  const handleSaveChanges = async () => {
    if (!provider || !selectedMemberId || !selectedMember || pendingChanges.length === 0) return;

    setSaving(true);
    try {
      // Save each day that has changes
      // NOUVEAU MODÈLE: memberId obligatoire, locationId dénormalisé
      for (const day of pendingChanges) {
        await schedulingService.setAvailability(provider.id, {
          memberId: selectedMemberId,
          locationId: selectedMember.locationId,
          dayOfWeek: day.dayOfWeek,
          isOpen: day.isOpen,
          slots: day.slots,
        });
      }
      toast.success('Disponibilites mises a jour');
      setIsEditing(false);
      setPendingChanges([]);
      // Refresh data
      await fetchAvailability();
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  // Handle add blocked slot
  const handleAddBlockedSlot = async (data: BlockedSlotFormData) => {
    if (!provider) return;

    try {
      await schedulingService.blockPeriod(provider.id, {
        startDate: data.startDate,
        endDate: data.endDate,
        allDay: data.allDay,
        isRecurring: false,
        startTime: data.startTime,
        endTime: data.endTime,
        reason: data.reason,
        memberId: data.memberId,
        locationId: data.locationId,
      });
      toast.success('Periode de fermeture ajoutee');
      // Refresh blocked slots
      const blockedSlotsData = await schedulingService.getUpcomingBlockedSlots(provider.id);
      setBlockedSlots(blockedSlotsData);
    } catch (error) {
      console.error('Add blocked slot error:', error);
      toast.error('Erreur lors de l\'ajout');
      throw error;
    }
  };

  // Handle delete blocked slot
  const handleDeleteBlockedSlot = async (slotId: string) => {
    if (!provider) return;

    try {
      await schedulingService.unblockPeriod(provider.id, slotId);
      toast.success('Periode de fermeture supprimee');
      setBlockedSlots((prev) => prev.filter((s) => s.id !== slotId));
    } catch (error) {
      console.error('Delete blocked slot error:', error);
      toast.error('Erreur lors de la suppression');
      throw error;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
      </div>
    );
  }

  if (members.length === 0) {
    return (
      <div className="text-center py-16 px-4">
        <Users className="w-12 h-12 mx-auto mb-4 text-gray-400" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Aucun membre configure
        </h3>
        <p className="text-gray-500 dark:text-gray-400">
          Ajoutez d'abord un membre dans l'onglet "Equipe" pour definir vos disponibilites.
        </p>
      </div>
    );
  }

  if (locations.length === 0) {
    return (
      <div className="text-center py-16 px-4">
        <Clock className="w-12 h-12 mx-auto mb-4 text-gray-400" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Aucun lieu configure
        </h3>
        <p className="text-gray-500 dark:text-gray-400">
          Ajoutez d'abord un lieu dans l'onglet "Lieux" pour definir vos disponibilites.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            Vos disponibilites
            {saving && (
              <Loader2 className="w-4 h-4 text-primary-600 animate-spin" />
            )}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {isEditing ? 'Modifiez vos horaires d\'ouverture' : 'Definissez vos horaires d\'ouverture'}
          </p>
        </div>

        {/* Filters and actions */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Member selector (NOUVEAU MODÈLE: sélection du membre = sélection du lieu) */}
          {hasMultipleMembers && !isEditing && (
            <select
              value={selectedMemberId || ''}
              onChange={(e) => setSelectedMemberId(e.target.value || null)}
              className="px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              {members.map((member) => {
                const location = locations.find((l) => l.id === member.locationId);
                return (
                  <option key={member.id} value={member.id}>
                    {member.name} {location ? `(${location.name})` : ''}
                  </option>
                );
              })}
            </select>
          )}

          {/* Show selected location info when editing */}
          {isEditing && selectedLocation && (
            <div className="text-sm text-gray-500 dark:text-gray-400">
              <span className="font-medium">{selectedMember?.name}</span>
              <span className="mx-1">-</span>
              <span>{selectedLocation.name}</span>
            </div>
          )}

          {/* Edit / Save / Cancel buttons */}
          {isEditing ? (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancelEditing}
                disabled={saving}
              >
                <X className="w-4 h-4 mr-1" />
                Annuler
              </Button>
              <Button
                size="sm"
                onClick={handleSaveChanges}
                disabled={saving || pendingChanges.length === 0}
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-1" />
                )}
                Enregistrer
              </Button>
            </div>
          ) : (
            <Button size="sm" onClick={handleStartEditing}>
              <Pencil className="w-4 h-4 mr-1" />
              Modifier
            </Button>
          )}
        </div>
      </div>

      {/* Current member info */}
      {!hasMultipleMembers && selectedMember && selectedLocation && (
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 px-4 py-2 rounded-lg">
          <Users className="w-4 h-4" />
          <span>
            Disponibilites de <span className="font-medium text-gray-900 dark:text-white">{selectedMember.name}</span>
            {' '}au <span className="font-medium text-gray-900 dark:text-white">{selectedLocation.name}</span>
          </span>
        </div>
      )}

      {/* Availability view (consultation) or grid (editing) */}
      {isEditing ? (
        <AvailabilityGrid
          availabilities={availabilities}
          onChange={handleScheduleChange}
        />
      ) : (
        <AvailabilityView availabilities={availabilities} />
      )}

      {/* Blocked slots section */}
      <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
        <BlockedSlotsSection
          blockedSlots={blockedSlots}
          locations={locations}
          members={members}
          onAdd={handleAddBlockedSlot}
          onDelete={handleDeleteBlockedSlot}
          hasTeams={hasMultipleMembers}
        />
      </div>
    </div>
  );
}
