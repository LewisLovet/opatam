'use client';

import { useState } from 'react';
import { X, User, Store, Scissors, CalendarDays, Clock, Euro, ArrowRightLeft } from 'lucide-react';
import { statusConfig } from '@/lib/booking-utils';
import type { BookingStatus } from '@booking-app/shared';

interface BookingItem {
  id: string;
  clientName: string;
  clientId: string | null;
  providerId: string | null;
  providerName: string;
  serviceName: string;
  datetime: string | null;
  status: BookingStatus;
  price: number;
  createdAt: string | null;
}

interface BookingTableProps {
  items: BookingItem[];
  onStatusChange?: (bookingId: string, newStatus: BookingStatus) => Promise<void>;
}

function formatDatetime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDatetimeLong(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const date = d.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const time = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  return `${date} à ${time}`;
}

function StatusBadge({ status, size = 'sm' }: { status: BookingStatus; size?: 'sm' | 'md' }) {
  const config = statusConfig[status];
  if (!config) return <span className="text-xs text-gray-500">{status}</span>;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium ${config.bgColor} ${config.color} ${
        size === 'md' ? 'px-3 py-1.5 text-sm' : 'px-2.5 py-1 text-xs'
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dotColor}`} />
      {config.label}
    </span>
  );
}

const STATUS_OPTIONS: { value: BookingStatus; label: string; color: string }[] = [
  { value: 'pending', label: 'En attente', color: 'border-amber-200 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400' },
  { value: 'confirmed', label: 'Confirmé', color: 'border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400' },
  { value: 'cancelled', label: 'Annulé', color: 'border-red-200 text-red-700 hover:bg-red-50 dark:border-red-700 dark:text-red-400' },
  { value: 'noshow', label: 'Absent', color: 'border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400' },
];

function InfoRow({ icon: Icon, label, children }: { icon: any; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4 text-gray-500 dark:text-gray-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] uppercase tracking-wider text-gray-400 dark:text-gray-500 font-medium">{label}</p>
        <div className="text-sm font-medium text-gray-900 dark:text-white mt-0.5">{children}</div>
      </div>
    </div>
  );
}

function BookingModal({
  booking,
  onClose,
  onStatusChange,
}: {
  booking: BookingItem;
  onClose: () => void;
  onStatusChange?: (bookingId: string, newStatus: BookingStatus) => Promise<void>;
}) {
  const [changingStatus, setChangingStatus] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const handleStatusChange = async (newStatus: BookingStatus) => {
    if (!onStatusChange || newStatus === booking.status) return;
    setUpdatingStatus(true);
    try {
      await onStatusChange(booking.id, newStatus);
      setChangingStatus(false);
    } catch (err) {
      console.error('Erreur changement statut:', err);
    } finally {
      setUpdatingStatus(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with gradient accent */}
        <div className="relative px-6 pt-5 pb-4">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary-500 via-primary-400 to-primary-600" />
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Détail de la réservation</h3>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600 transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 pb-2">
          <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
            <InfoRow icon={User} label="Client">
              {booking.clientName}
            </InfoRow>

            <InfoRow icon={Store} label="Prestataire">
              {booking.providerName}
            </InfoRow>

            <InfoRow icon={Scissors} label="Prestation">
              {booking.serviceName || '—'}
            </InfoRow>

            <InfoRow icon={CalendarDays} label="Date du RDV">
              <span className="capitalize">{formatDatetimeLong(booking.datetime)}</span>
            </InfoRow>

            <InfoRow icon={Clock} label="Pris le">
              <span className="text-gray-600 dark:text-gray-300 font-normal capitalize">{formatDatetimeLong(booking.createdAt)}</span>
            </InfoRow>

            <InfoRow icon={Euro} label="Prix">
              {booking.price ? (
                <span className="text-base font-semibold">{(booking.price / 100).toFixed(2)} €</span>
              ) : (
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Gratuit</span>
              )}
            </InfoRow>
          </div>
        </div>

        {/* Status section */}
        <div className="mx-6 mb-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-700/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-gray-400 dark:text-gray-500 font-medium mb-1.5">Statut</p>
              <StatusBadge status={booking.status} size="md" />
            </div>
            {onStatusChange && !changingStatus && (
              <button
                onClick={() => setChangingStatus(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-primary-600 hover:text-primary-700 bg-primary-50 hover:bg-primary-100 dark:bg-primary-900/20 dark:text-primary-400 dark:hover:bg-primary-900/30 transition-all"
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                Changer
              </button>
            )}
          </div>

          {/* Status change */}
          {changingStatus && onStatusChange && (
            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Nouveau statut :</p>
              <div className="flex flex-wrap gap-2">
                {STATUS_OPTIONS.filter((s) => s.value !== booking.status).map((s) => (
                  <button
                    key={s.value}
                    onClick={() => handleStatusChange(s.value)}
                    disabled={updatingStatus}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all disabled:opacity-50 ${s.color}`}
                  >
                    {updatingStatus ? '...' : s.label}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setChangingStatus(false)}
                className="mt-2 text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                Annuler
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800">
          <button
            onClick={onClose}
            className="w-full px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-600 transition-all"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

export function BookingTable({ items, onStatusChange }: BookingTableProps) {
  const [selectedBooking, setSelectedBooking] = useState<BookingItem | null>(null);

  if (items.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl p-8 text-center text-gray-400 text-sm">
        Aucune réservation trouvée
      </div>
    );
  }

  const handleStatusChange = async (bookingId: string, newStatus: BookingStatus) => {
    if (!onStatusChange) return;
    await onStatusChange(bookingId, newStatus);
    // Update the selected booking's status in place
    setSelectedBooking((prev) => (prev && prev.id === bookingId ? { ...prev, status: newStatus } : prev));
  };

  return (
    <>
      {/* Desktop table */}
      <div className="hidden md:block bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-700">
              <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Client
              </th>
              <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Prestataire
              </th>
              <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Service
              </th>
              <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Date RDV
              </th>
              <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Pris le
              </th>
              <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Statut
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((booking) => (
              <tr
                key={booking.id}
                onClick={() => setSelectedBooking(booking)}
                className="border-b border-gray-50 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors cursor-pointer"
              >
                <td className="px-5 py-3">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {booking.clientName}
                  </p>
                </td>
                <td className="px-5 py-3">
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    {booking.providerName}
                  </p>
                </td>
                <td className="px-5 py-3">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {booking.serviceName}
                  </p>
                </td>
                <td className="px-5 py-3 text-sm text-gray-500 dark:text-gray-400">
                  {formatDatetime(booking.datetime)}
                </td>
                <td className="px-5 py-3 text-sm text-gray-400 dark:text-gray-500">
                  {formatDatetime(booking.createdAt)}
                </td>
                <td className="px-5 py-3">
                  <StatusBadge status={booking.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {items.map((booking) => (
          <div
            key={booking.id}
            onClick={() => setSelectedBooking(booking)}
            className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700 cursor-pointer hover:border-gray-200 dark:hover:border-gray-600 transition-colors active:scale-[0.99]"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {booking.clientName}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                  {booking.providerName} · {booking.serviceName}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  {formatDatetime(booking.datetime)}
                </p>
                <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
                  Pris le {formatDatetime(booking.createdAt)}
                </p>
              </div>
              <StatusBadge status={booking.status} />
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {selectedBooking && (
        <BookingModal
          booking={selectedBooking}
          onClose={() => setSelectedBooking(null)}
          onStatusChange={onStatusChange ? handleStatusChange : undefined}
        />
      )}
    </>
  );
}
