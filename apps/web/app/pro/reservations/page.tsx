'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { bookingService, memberService } from '@booking-app/firebase';
import type { Booking, Member, BookingStatus } from '@booking-app/shared';
import { BookingDetailModal } from '@/components/booking';
import { useToast } from '@/components/ui';
import { BookingFilters, BookingList } from './components';
import type { BookingFiltersState } from './components';
import { Loader2, ChevronLeft, ChevronRight } from 'lucide-react';

type WithId<T> = { id: string } & T;

const ITEMS_PER_PAGE = 20;

const DEFAULT_FILTERS: BookingFiltersState = {
  status: 'all',
  memberId: 'all',
  startDate: '',
  endDate: '',
  periodType: 'week',
  periodOffset: 0,
};

export default function ReservationsPage() {
  const { user, provider } = useAuth();
  const toast = useToast();

  // Data
  const [bookings, setBookings] = useState<WithId<Booking>[]>([]);
  const [members, setMembers] = useState<WithId<Member>[]>([]);

  // Filters
  const [filters, setFilters] = useState<BookingFiltersState>(DEFAULT_FILTERS);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Loading states
  const [loading, setLoading] = useState(true);
  const [loadingBookings, setLoadingBookings] = useState(false);

  // Modal
  const [selectedBooking, setSelectedBooking] = useState<WithId<Booking> | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const isTeamPlan = provider?.plan === 'team' || provider?.plan === 'trial';
  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  // Load initial data (members)
  useEffect(() => {
    if (!provider) return;

    const loadInitialData = async () => {
      setLoading(true);
      try {
        if (isTeamPlan) {
          const membersData = await memberService.getByProvider(provider.id);
          setMembers(membersData.filter((m) => m.isActive));
        }
      } catch (error) {
        console.error('[Reservations] Error loading initial data:', error);
        toast.error('Erreur lors du chargement des données');
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, [provider, isTeamPlan]);

  // Load bookings
  const loadBookings = useCallback(async () => {
    if (!provider) return;

    setLoadingBookings(true);
    try {
      const queryFilters: {
        status?: BookingStatus;
        memberId?: string;
        startDate?: Date;
        endDate?: Date;
      } = {};

      if (filters.status !== 'all') {
        queryFilters.status = filters.status as BookingStatus;
      }
      if (filters.memberId !== 'all') {
        queryFilters.memberId = filters.memberId;
      }
      if (filters.startDate) {
        queryFilters.startDate = new Date(filters.startDate);
      }
      if (filters.endDate) {
        const endDate = new Date(filters.endDate);
        endDate.setHours(23, 59, 59, 999);
        queryFilters.endDate = endDate;
      }

      const bookingsData = await bookingService.getProviderBookings(
        provider.id,
        queryFilters
      );

      // Client-side filtering for status (in case service doesn't support it)
      let filteredBookings = bookingsData;
      if (filters.status !== 'all') {
        filteredBookings = bookingsData.filter((b) => b.status === filters.status);
      }

      // Sort by date (most recent first for past, soonest first for future)
      const now = new Date();
      filteredBookings.sort((a, b) => {
        const dateA = new Date(a.datetime);
        const dateB = new Date(b.datetime);
        // For current/future dates, show soonest first
        // For past dates, show most recent first
        return dateA.getTime() - dateB.getTime();
      });

      setTotalCount(filteredBookings.length);

      // Paginate
      const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
      const paginatedBookings = filteredBookings.slice(
        startIndex,
        startIndex + ITEMS_PER_PAGE
      );

      setBookings(paginatedBookings);
    } catch (error) {
      console.error('[Reservations] Error loading bookings:', error);
      toast.error('Erreur lors du chargement des réservations');
    } finally {
      setLoadingBookings(false);
    }
  }, [provider, filters, currentPage]);

  useEffect(() => {
    if (!loading && filters.startDate && filters.endDate) {
      loadBookings();
    }
  }, [loadBookings, loading, filters.startDate, filters.endDate]);

  // Filter handlers
  const handleFilterChange = (newFilters: Partial<BookingFiltersState>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
    setCurrentPage(1); // Reset to first page on filter change
  };

  const handleResetFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setCurrentPage(1);
  };

  // Pagination handlers
  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage((prev) => prev - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage((prev) => prev + 1);
    }
  };

  // Booking actions
  const handleViewBooking = (booking: WithId<Booking>) => {
    setSelectedBooking(booking);
    setIsModalOpen(true);
  };

  const handleConfirmBooking = async (booking: WithId<Booking>) => {
    if (!user) return;
    try {
      await bookingService.confirmBooking(booking.id, user.id);
      toast.success('Réservation confirmée');
      loadBookings();
    } catch (error) {
      console.error('Error confirming booking:', error);
      toast.error('Erreur lors de la confirmation');
    }
  };

  const handleCancelBooking = async (booking: WithId<Booking>) => {
    if (!user) return;
    try {
      await bookingService.cancelBooking(booking.id, 'provider', user.id);
      toast.success('Réservation annulée');
      loadBookings();
    } catch (error) {
      console.error('Error cancelling booking:', error);
      toast.error("Erreur lors de l'annulation");
    }
  };

  const handleCompleteBooking = async (booking: WithId<Booking>) => {
    if (!user) return;
    try {
      await bookingService.completeBooking(booking.id, user.id);
      toast.success('Réservation marquée comme terminée');
      loadBookings();
    } catch (error) {
      console.error('Error completing booking:', error);
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const handleNoShowBooking = async (booking: WithId<Booking>) => {
    if (!user) return;
    try {
      await bookingService.markNoShow(booking.id, user.id);
      toast.success('Réservation marquée comme absent');
      loadBookings();
    } catch (error) {
      console.error('Error marking no-show:', error);
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const handleBookingUpdate = async () => {
    await loadBookings();
    setIsModalOpen(false);
    setSelectedBooking(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
          Réservations
        </h1>
        <p className="mt-1 text-gray-600 dark:text-gray-400">
          Gérez toutes vos réservations
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <BookingFilters
          filters={filters}
          onChange={handleFilterChange}
          onReset={handleResetFilters}
          members={members}
          isTeamPlan={isTeamPlan}
        />
      </div>

      {/* Bookings list */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {loadingBookings ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
          </div>
        ) : (
          <BookingList
            bookings={bookings}
            members={members}
            isTeamPlan={isTeamPlan}
            onView={handleViewBooking}
            onConfirm={handleConfirmBooking}
            onCancel={handleCancelBooking}
            onComplete={handleCompleteBooking}
            onNoShow={handleNoShowBooking}
          />
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Page {currentPage} sur {totalPages} ({totalCount} résultats)
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePreviousPage}
                disabled={currentPage === 1}
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={handleNextPage}
                disabled={currentPage === totalPages}
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Booking Detail Modal */}
      <BookingDetailModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedBooking(null);
        }}
        booking={selectedBooking}
        onUpdate={handleBookingUpdate}
      />
    </div>
  );
}
