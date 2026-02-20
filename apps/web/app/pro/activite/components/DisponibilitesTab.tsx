'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { ConfirmDialog, useToast } from '@/components/ui';
import {
  schedulingService,
  locationService,
  memberService,
} from '@booking-app/firebase';
import { Loader2, Clock, Users } from 'lucide-react';
import { DayRow } from './DayRow';
import { MemberPills } from './MemberPills';
import { QuickTemplates } from './QuickTemplates';
import { StickyFooter } from './StickyFooter';
import { WeeklyPreview } from './WeeklyPreview';
import { BlockedSlotsSection, type BlockedSlotFormData } from './BlockedSlotsSection';
import { useScheduleReducer, type DaySchedule } from '../hooks/useScheduleReducer';
import type { BlockedSlot, Location, Member } from '@booking-app/shared';

type WithId<T> = { id: string } & T;

/**
 * Redesigned availability editor.
 * Always-editable interface with copy-to mechanism and sticky save bar.
 * No more view/edit toggle.
 */
export function DisponibilitesTab() {
  const { provider } = useAuth();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [blockedSlots, setBlockedSlots] = useState<WithId<BlockedSlot>[]>([]);
  const [locations, setLocations] = useState<WithId<Location>[]>([]);
  const [members, setMembers] = useState<WithId<Member>[]>([]);

  // Selected member
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

  // Confirm dialog for unsaved changes on member switch
  const [pendingMemberSwitch, setPendingMemberSwitch] = useState<string | null>(null);

  // Schedule state via reducer
  const {
    orderedSchedule,
    saving,
    isDirty,
    dirtyDays,
    dirtyCount,
    load,
    updateDay,
    copyTo,
    applyTemplate,
    reset,
    saveStart,
    saveSuccess,
    saveError,
  } = useScheduleReducer();

  // Derived
  const selectedMember = members.find((m) => m.id === selectedMemberId);
  const selectedLocation = selectedMember
    ? locations.find((l) => l.id === selectedMember.locationId)
    : null;
  const hasMultipleMembers = members.length > 1;

  // Fetch members, locations, blocked slots
  const fetchData = useCallback(async () => {
    if (!provider) return;

    setLoading(true);
    try {
      const [locationsData, membersData] = await Promise.all([
        locationService.getActiveByProvider(provider.id),
        memberService.getByProvider(provider.id),
      ]);

      setLocations(locationsData);
      setMembers(membersData);

      if (!selectedMemberId && membersData.length > 0) {
        const defaultMember = membersData.find((m) => m.isDefault) || membersData[0];
        if (defaultMember) {
          setSelectedMemberId(defaultMember.id);
        }
      }

      const blockedSlotsData = await schedulingService.getUpcomingBlockedSlots(provider.id);
      setBlockedSlots(blockedSlotsData);
    } catch (error) {
      console.error('Fetch error:', error);
      toast.error('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  }, [provider, selectedMemberId, toast]);

  // Fetch availability for selected member and load into reducer
  const fetchAvailability = useCallback(async () => {
    if (!provider || !selectedMemberId) return;

    try {
      const availabilityData = await schedulingService.getWeeklySchedule(
        provider.id,
        selectedMemberId
      );

      const defaultSchedule: DaySchedule[] = [
        { dayOfWeek: 0, isOpen: false, slots: [] },
        { dayOfWeek: 1, isOpen: true, slots: [{ start: '09:00', end: '18:00' }] },
        { dayOfWeek: 2, isOpen: true, slots: [{ start: '09:00', end: '18:00' }] },
        { dayOfWeek: 3, isOpen: true, slots: [{ start: '09:00', end: '18:00' }] },
        { dayOfWeek: 4, isOpen: true, slots: [{ start: '09:00', end: '18:00' }] },
        { dayOfWeek: 5, isOpen: true, slots: [{ start: '09:00', end: '18:00' }] },
        { dayOfWeek: 6, isOpen: false, slots: [] },
      ];

      const schedule = defaultSchedule.map((defaultDay) => {
        const existing = availabilityData.find((a) => a.dayOfWeek === defaultDay.dayOfWeek);
        if (existing) {
          return {
            dayOfWeek: existing.dayOfWeek,
            isOpen: existing.isOpen,
            slots: existing.slots,
          };
        }
        return defaultDay;
      });

      load(schedule);
    } catch (error) {
      console.error('Fetch availability error:', error);
    }
  }, [provider, selectedMemberId, load]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (selectedMemberId) {
      fetchAvailability();
    }
  }, [selectedMemberId, fetchAvailability]);

  // Handle member switch with unsaved changes check
  const handleMemberSelect = (memberId: string) => {
    if (memberId === selectedMemberId) return;
    if (isDirty) {
      setPendingMemberSwitch(memberId);
    } else {
      setSelectedMemberId(memberId);
    }
  };

  const confirmMemberSwitch = () => {
    if (pendingMemberSwitch) {
      reset();
      setSelectedMemberId(pendingMemberSwitch);
      setPendingMemberSwitch(null);
    }
  };

  // Save handler — batch save all 7 days
  const handleSave = async () => {
    if (!provider || !selectedMemberId || !selectedMember) return;

    saveStart();
    try {
      await schedulingService.setWeeklySchedule(
        provider.id,
        selectedMemberId,
        selectedMember.locationId,
        orderedSchedule.map((day) => ({
          dayOfWeek: day.dayOfWeek,
          slots: day.slots,
          isOpen: day.isOpen,
        }))
      );
      saveSuccess();
      toast.success('Disponibilités mises à jour');
    } catch (error) {
      console.error('Save error:', error);
      saveError();
      toast.error('Erreur lors de la sauvegarde');
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
      toast.success('Période de fermeture ajoutée');
      const blockedSlotsData = await schedulingService.getUpcomingBlockedSlots(provider.id);
      setBlockedSlots(blockedSlotsData);
    } catch (error) {
      console.error('Add blocked slot error:', error);
      toast.error("Erreur lors de l'ajout");
      throw error;
    }
  };

  // Handle delete blocked slot
  const handleDeleteBlockedSlot = async (slotId: string) => {
    if (!provider) return;

    try {
      await schedulingService.unblockPeriod(provider.id, slotId);
      toast.success('Période de fermeture supprimée');
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
          Aucun membre configuré
        </h3>
        <p className="text-gray-500 dark:text-gray-400">
          Ajoutez d&apos;abord un membre dans l&apos;onglet &quot;Équipe&quot; pour définir vos disponibilités.
        </p>
      </div>
    );
  }

  if (locations.length === 0) {
    return (
      <div className="text-center py-16 px-4">
        <Clock className="w-12 h-12 mx-auto mb-4 text-gray-400" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Aucun lieu configuré
        </h3>
        <p className="text-gray-500 dark:text-gray-400">
          Ajoutez d&apos;abord un lieu dans l&apos;onglet &quot;Lieux&quot; pour définir vos disponibilités.
        </p>
      </div>
    );
  }

  return (
    <div className="pb-20">
      {/* Header */}
      <div className="flex flex-col gap-4 mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            Vos disponibilités
            {saving && (
              <Loader2 className="w-4 h-4 text-primary-600 animate-spin" />
            )}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Configurez vos horaires d&apos;ouverture, puis enregistrez vos modifications.
          </p>
        </div>

        {/* Member pills selector */}
        {hasMultipleMembers && selectedMemberId && (
          <MemberPills
            members={members}
            locations={locations}
            selectedMemberId={selectedMemberId}
            onSelect={handleMemberSelect}
            disabled={saving}
          />
        )}

        {/* Single member info */}
        {!hasMultipleMembers && selectedMember && selectedLocation && (
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 px-4 py-2 rounded-lg">
            <Users className="w-4 h-4" />
            <span>
              Disponibilités de{' '}
              <span className="font-medium text-gray-900 dark:text-white">{selectedMember.name}</span>
              {' '}au{' '}
              <span className="font-medium text-gray-900 dark:text-white">{selectedLocation.name}</span>
            </span>
          </div>
        )}
      </div>

      {/* Split-panel layout: editor left, preview right on desktop */}
      <div className="xl:grid xl:grid-cols-[minmax(0,420px)_1fr] xl:gap-8">
        {/* Left column — editor (compact) */}
        <div className="space-y-4">
          {/* Quick templates */}
          <QuickTemplates onApply={applyTemplate} />

          {/* Day list — always editable */}
          <div className="space-y-0.5">
            {orderedSchedule.map((day) => (
              <DayRow
                key={day.dayOfWeek}
                dayOfWeek={day.dayOfWeek}
                isOpen={day.isOpen}
                slots={day.slots}
                onDayChange={updateDay}
                onCopyTo={copyTo}
                isDirty={dirtyDays.has(day.dayOfWeek)}
              />
            ))}
          </div>

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

        {/* Right column — weekly preview (desktop only) */}
        <div className="hidden xl:block">
          <div className="sticky top-24">
            <WeeklyPreview
              schedule={orderedSchedule}
              dirtyDays={dirtyDays}
            />
          </div>
        </div>
      </div>

      {/* Sticky save footer */}
      <StickyFooter
        dirtyCount={dirtyCount}
        saving={saving}
        onSave={handleSave}
        onCancel={reset}
      />

      {/* Confirm dialog for member switch with unsaved changes */}
      <ConfirmDialog
        isOpen={pendingMemberSwitch !== null}
        onClose={() => setPendingMemberSwitch(null)}
        onConfirm={confirmMemberSwitch}
        title="Modifications non enregistrées"
        message="Vous avez des modifications non enregistrées. Voulez-vous les abandonner et changer de membre ?"
        confirmLabel="Abandonner"
        cancelLabel="Rester"
        variant="warning"
      />
    </div>
  );
}
