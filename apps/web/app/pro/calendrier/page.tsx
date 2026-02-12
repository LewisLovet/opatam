'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { bookingService, schedulingService, memberService, locationService } from '@booking-app/firebase';
import type { Booking, Member, Location, Availability, BlockedSlot } from '@booking-app/shared';
import { CalendarHeader } from './components/CalendarHeader';
import { DayView } from './components/DayView';
import { WeekView } from './components/WeekView';
import { BookingDetailModal } from '@/components/booking';
import { CreateBookingModal } from './components/CreateBookingModal';
import { Loader2 } from 'lucide-react';

type WithId<T> = { id: string } & T;
type ViewMode = 'day' | 'week';

export default function CalendarPage() {
  const { user, provider } = useAuth();

  // View state
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  });

  // Filters
  const [selectedMemberId, setSelectedMemberId] = useState<string>('all');
  const [selectedLocationId, setSelectedLocationId] = useState<string>('all');

  // Data
  const [bookings, setBookings] = useState<WithId<Booking>[]>([]);
  const [members, setMembers] = useState<WithId<Member>[]>([]);
  const [locations, setLocations] = useState<WithId<Location>[]>([]);
  const [availabilities, setAvailabilities] = useState<WithId<Availability>[]>([]);
  const [blockedSlots, setBlockedSlots] = useState<WithId<BlockedSlot>[]>([]);

  // Loading states
  const [loading, setLoading] = useState(true);
  const [loadingBookings, setLoadingBookings] = useState(false);

  // Modals
  const [selectedBooking, setSelectedBooking] = useState<WithId<Booking> | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createModalDate, setCreateModalDate] = useState<Date | null>(null);

  const isTeamPlan = provider?.plan === 'team' || provider?.plan === 'trial';

  // Calculate date range based on view mode
  const dateRange = useMemo(() => {
    const start = new Date(selectedDate);
    const end = new Date(selectedDate);

    if (viewMode === 'week') {
      // Get start of week (Monday)
      const day = start.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      start.setDate(start.getDate() + diff);
      start.setHours(0, 0, 0, 0);

      // End of week (Sunday)
      end.setTime(start.getTime());
      end.setDate(end.getDate() + 6);
      end.setHours(23, 59, 59, 999);
    } else {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    }

    return { start, end };
  }, [selectedDate, viewMode]);

  // Load initial data (members, locations, availabilities)
  useEffect(() => {
    if (!provider) return;

    const loadInitialData = async () => {
      setLoading(true);
      try {
        // First load members, locations, and blocked slots
        // Note: même les plans solo ont un membre créé automatiquement — il faut toujours les charger
        const [membersData, locationsData, blockedData] = await Promise.all([
          memberService.getByProvider(provider.id),
          locationService.getByProvider(provider.id),
          schedulingService.getBlockedSlots(provider.id),
        ]);

        // NOUVEAU MODÈLE: Availability est centré sur le membre (1 membre = 1 lieu = 1 agenda)
        const activeLocations = locationsData.filter((l) => l.isActive);
        const activeMembersData = membersData.filter((m) => m.isActive);

        // Load availability for each active member
        const availabilityPromises: Promise<WithId<Availability>[]>[] = [];
        for (const member of activeMembersData) {
          availabilityPromises.push(
            schedulingService.getWeeklySchedule(provider.id, member.id)
          );
        }

        const availabilityResults = await Promise.all(availabilityPromises);
        const availabilitiesData = availabilityResults.flat();

        setMembers(membersData.filter((m) => m.isActive));
        setLocations(activeLocations);
        setAvailabilities(availabilitiesData);
        setBlockedSlots(blockedData);

        // Set default location if only one
        if (activeLocations.length === 1) {
          setSelectedLocationId(activeLocations[0].id);
        }

        // Set default member if only one (skip member selection)
        const activeMembers = membersData.filter((m) => m.isActive);
        if (activeMembers.length === 1) {
          setSelectedMemberId(activeMembers[0].id);
        }
      } catch (error) {
        console.error('[Calendar] Error loading initial data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, [provider]);

  // Load bookings for the current date range
  const loadBookings = useCallback(async () => {
    if (!provider) return;

    setLoadingBookings(true);
    try {
      const filters: {
        startDate?: Date;
        endDate?: Date;
        memberId?: string;
        locationId?: string;
      } = {
        startDate: dateRange.start,
        endDate: dateRange.end,
      };

      if (selectedMemberId !== 'all') {
        filters.memberId = selectedMemberId;
      }
      if (selectedLocationId !== 'all') {
        filters.locationId = selectedLocationId;
      }

      const bookingsData = await bookingService.getProviderBookings(provider.id, filters);

      // Filter by date range client-side as well (in case service doesn't support it fully)
      // Also exclude cancelled bookings from the calendar view
      const filteredBookings = bookingsData.filter((b) => {
        const bookingDate = new Date(b.datetime);
        const isInDateRange = bookingDate >= dateRange.start && bookingDate <= dateRange.end;
        const isNotCancelled = b.status !== 'cancelled';
        return isInDateRange && isNotCancelled;
      });

      setBookings(filteredBookings);
    } catch (error) {
      console.error('Error loading bookings:', error);
    } finally {
      setLoadingBookings(false);
    }
  }, [provider, dateRange, selectedMemberId, selectedLocationId]);

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  // Navigation handlers
  const handlePrevious = () => {
    const newDate = new Date(selectedDate);
    if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() - 7);
    } else {
      newDate.setDate(newDate.getDate() - 1);
    }
    setSelectedDate(newDate);
  };

  const handleNext = () => {
    const newDate = new Date(selectedDate);
    if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() + 7);
    } else {
      newDate.setDate(newDate.getDate() + 1);
    }
    setSelectedDate(newDate);
  };

  const handleToday = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    setSelectedDate(today);
  };

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
  };

  // Booking actions
  const handleBookingClick = (booking: WithId<Booking>) => {
    setSelectedBooking(booking);
    setIsDetailModalOpen(true);
  };

  const handleCreateBooking = (date?: Date) => {
    setCreateModalDate(date || selectedDate);
    setIsCreateModalOpen(true);
  };

  const handleSlotClick = (date: Date, memberId?: string) => {
    if (memberId && memberId !== 'all') {
      setSelectedMemberId(memberId);
    }
    handleCreateBooking(date);
  };

  const handleBookingUpdate = async () => {
    await loadBookings();
    setIsDetailModalOpen(false);
    setSelectedBooking(null);
  };

  const handleBookingCreated = async () => {
    await loadBookings();
    setIsCreateModalOpen(false);
    setCreateModalDate(null);
  };

  // Filter active members based on selected location
  // NOUVEAU MODÈLE: 1 membre = 1 lieu (locationId au lieu de locationIds)
  const activeMembers = useMemo(() => {
    if (selectedLocationId === 'all') return members;
    return members.filter((m) => m.locationId === selectedLocationId);
  }, [members, selectedLocationId]);

  // Get availabilities for the displayed period
  const getAvailabilityForDay = useCallback(
    (date: Date, memberId: string | null, locationId: string) => {
      const dayOfWeek = date.getDay();

      // First try to find member-specific availability
      let found = availabilities.find(
        (a) =>
          a.dayOfWeek === dayOfWeek &&
          (a.locationId === locationId || locationId === 'all') &&
          (a.memberId === memberId || (!a.memberId && !memberId))
      );

      // Fallback to location-level availability if member-specific not found
      if (!found && memberId) {
        found = availabilities.find(
          (a) =>
            a.dayOfWeek === dayOfWeek &&
            (a.locationId === locationId || locationId === 'all') &&
            !a.memberId
        );
      }

      return found;
    },
    [availabilities]
  );

  // Get blocked slots for a specific date
  const getBlockedSlotsForDay = useCallback(
    (date: Date, memberId: string | null, locationId: string) => {
      const dayStart = new Date(date);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(date);
      dayEnd.setHours(23, 59, 59, 999);

      return blockedSlots.filter((bs) => {
        const matchesMember = !bs.memberId || bs.memberId === memberId;
        const matchesLocation = !bs.locationId || bs.locationId === locationId || locationId === 'all';
        const matchesDate = bs.startDate <= dayEnd && bs.endDate >= dayStart;
        return matchesMember && matchesLocation && matchesDate;
      });
    },
    [blockedSlots]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4 min-w-0">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
          Calendrier
        </h1>
        <p className="mt-1 text-gray-600 dark:text-gray-400">
          Gérez vos rendez-vous
        </p>
      </div>

      {/* Calendar Header */}
      <CalendarHeader
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        selectedDate={selectedDate}
        dateRange={dateRange}
        onDateSelect={handleDateSelect}
        onPrevious={handlePrevious}
        onNext={handleNext}
        onToday={handleToday}
        members={activeMembers}
        locations={locations}
        selectedMemberId={selectedMemberId}
        selectedLocationId={selectedLocationId}
        onMemberChange={setSelectedMemberId}
        onLocationChange={setSelectedLocationId}
        onCreateBooking={() => handleCreateBooking()}
        isTeamPlan={isTeamPlan}
      />

      {/* Calendar View */}
      <div className="bg-gray-100/50 dark:bg-gray-900/50 rounded-xl border border-gray-200/60 dark:border-gray-700/40 overflow-hidden min-w-0">
        {loadingBookings && (
          <div className="absolute inset-0 bg-white/50 dark:bg-gray-800/50 flex items-center justify-center z-10">
            <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
          </div>
        )}

        {viewMode === 'day' ? (
          <DayView
            date={selectedDate}
            bookings={bookings}
            members={activeMembers}
            selectedMemberId={selectedMemberId}
            selectedLocationId={selectedLocationId}
            isTeamPlan={isTeamPlan}
            onBookingClick={handleBookingClick}
            onSlotClick={handleSlotClick}
            getAvailabilityForDay={getAvailabilityForDay}
            getBlockedSlotsForDay={getBlockedSlotsForDay}
          />
        ) : (
          <WeekView
            startDate={dateRange.start}
            bookings={bookings}
            members={activeMembers}
            selectedMemberId={selectedMemberId}
            selectedLocationId={selectedLocationId}
            isTeamPlan={isTeamPlan}
            onBookingClick={handleBookingClick}
            onSlotClick={handleSlotClick}
            onDayClick={(date) => {
              setSelectedDate(date);
              setViewMode('day');
            }}
            onMemberSelect={setSelectedMemberId}
            getAvailabilityForDay={getAvailabilityForDay}
            getBlockedSlotsForDay={getBlockedSlotsForDay}
          />
        )}
      </div>

      {/* Booking Detail Modal */}
      <BookingDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedBooking(null);
        }}
        booking={selectedBooking}
        onUpdate={handleBookingUpdate}
        providerSlug={provider?.slug}
      />

      {/* Create Booking Modal */}
      <CreateBookingModal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setCreateModalDate(null);
        }}
        initialDate={createModalDate}
        initialMemberId={selectedMemberId !== 'all' ? selectedMemberId : undefined}
        initialLocationId={selectedLocationId !== 'all' ? selectedLocationId : undefined}
        members={members}
        locations={locations}
        isTeamPlan={isTeamPlan}
        onCreated={handleBookingCreated}
      />
    </div>
  );
}
