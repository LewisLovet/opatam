'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { adminBookingService } from '@/services/admin/adminBookingService';
import type { BookingFilters as BookingFiltersType, PaginatedResult } from '@/services/admin/types';
import { BookingFilters, BookingTable } from './components';
import { Loader } from '@/components/ui';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { BookingStatus } from '@booking-app/shared';

export default function AdminBookingsPage() {
  const { user } = useAuth();
  const [filters, setFilters] = useState<BookingFiltersType>({});
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<PaginatedResult<any> | null>(null);
  const [loading, setLoading] = useState(true);

  const loadBookings = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const data = await adminBookingService.getBookings(user.id, filters, page);
      setResult(data);
    } catch (err) {
      console.error('Error loading bookings:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id, filters, page]);

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [filters]);

  const handleStatusChange = async (bookingId: string, newStatus: BookingStatus) => {
    if (!user?.id) return;
    await adminBookingService.updateBookingStatus(user.id, bookingId, newStatus);
    // Refresh list to reflect change
    await loadBookings();
  };

  const totalPages = result ? Math.ceil(result.total / result.pageSize) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Réservations</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {result ? `${result.total} réservation${result.total > 1 ? 's' : ''}` : 'Chargement...'}
        </p>
      </div>

      {/* Filters */}
      <BookingFilters filters={filters} onChange={setFilters} />

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader size="lg" />
        </div>
      ) : (
        <>
          <BookingTable items={result?.items || []} onStatusChange={handleStatusChange} />

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Page {page} sur {totalPages}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
