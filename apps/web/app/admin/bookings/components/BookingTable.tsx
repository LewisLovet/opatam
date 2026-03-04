'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
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
}

function formatDatetime(iso: string | null): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function StatusBadge({ status }: { status: BookingStatus }) {
  const config = statusConfig[status];
  if (!config) return <span className="text-xs text-gray-500">{status}</span>;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.bgColor} ${config.color}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dotColor}`} />
      {config.label}
    </span>
  );
}

export function BookingTable({ items }: BookingTableProps) {
  if (items.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl p-8 text-center text-gray-400 text-sm">
        Aucune r&eacute;servation trouv&eacute;e
      </div>
    );
  }

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
                Date
              </th>
              <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Statut
              </th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {items.map((booking) => (
              <tr
                key={booking.id}
                className="border-b border-gray-50 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
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
                <td className="px-5 py-3">
                  <StatusBadge status={booking.status} />
                </td>
                <td className="px-5 py-3">
                  <Link
                    href={`/admin/bookings/${booking.id}`}
                    className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors inline-flex"
                  >
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {items.map((booking) => (
          <Link
            key={booking.id}
            href={`/admin/bookings/${booking.id}`}
            className="block bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {booking.clientName}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                  {booking.providerName} &middot; {booking.serviceName}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  {formatDatetime(booking.datetime)}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <StatusBadge status={booking.status} />
                <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
