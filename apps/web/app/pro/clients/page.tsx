'use client';

/**
 * /pro/clients — provider's CRM-lite.
 *
 * Lists every distinct booker (`providerClients`) with denormalised
 * counters, tags and last-visit info. The dataset is small (a few
 * hundred rows max for an active salon over years) so we load
 * everything on mount and apply filters/sort/search client-side —
 * keeps the UX feeling instant and the Firestore cost flat.
 *
 * Phase 2A scope (this commit):
 *   - List + search + tag filters + sort
 *
 * Coming next:
 *   - Drawer / fiche client with notes + preferences edit
 *   - Booking history per client
 *   - "Nouveau RDV" pre-filled action
 */

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { providerClientRepository } from '@booking-app/firebase';
import type { Booking, ProviderClient } from '@booking-app/shared';
import { Loader, useToast } from '@/components/ui';
import { BookingDetailModal } from '@/components/booking';
import { Users, UserPlus } from 'lucide-react';
import { ClientFilters, type FiltersState } from './components/ClientFilters';
import { ClientRow } from './components/ClientRow';
import { ClientDrawer } from './components/ClientDrawer';

type WithId<T> = { id: string } & T;

const DEFAULT_FILTERS: FiltersState = {
  search: '',
  tags: [],
  sort: 'lastBooking-desc',
};

export default function ClientsPage() {
  const { provider } = useAuth();
  const toast = useToast();

  const [clients, setClients] = useState<WithId<ProviderClient>[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<FiltersState>(DEFAULT_FILTERS);

  // Drawer (fiche client)
  const [openClientId, setOpenClientId] = useState<string | null>(null);
  // Booking detail modal opened from inside the drawer's history list.
  const [selectedBooking, setSelectedBooking] = useState<WithId<Booking> | null>(null);

  // ── Fetch on mount / provider change ─────────────────────────────
  useEffect(() => {
    if (!provider?.id) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const rows = await providerClientRepository.getByProvider(provider.id);
        if (!cancelled) setClients(rows);
      } catch (err) {
        console.error('[ClientsPage] load error:', err);
        if (!cancelled) toast.error('Impossible de charger la liste des clients');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [provider?.id, toast]);

  // The drawer wants the live row from `clients`, not a cached copy,
  // so a save inside the drawer is reflected immediately in the list.
  const openClient = useMemo(
    () => clients.find((c) => c.id === openClientId) ?? null,
    [clients, openClientId],
  );

  // ── Filter + search + sort, derived from the in-memory base ──────
  const filteredClients = useMemo(() => {
    return applyFilters(clients, filters);
  }, [clients, filters]);

  // ── States ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Clients
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Le carnet de tous les clients qui ont déjà réservé chez vous.
          </p>
        </div>
      </header>

      {clients.length === 0 ? (
        <EmptyBaseState />
      ) : (
        <>
          <ClientFilters
            filters={filters}
            totalCount={clients.length}
            filteredCount={filteredClients.length}
            onChange={setFilters}
          />

          {filteredClients.length === 0 ? (
            <EmptyResultState />
          ) : (
            <ul className="space-y-2">
              {filteredClients.map((c) => (
                <li key={c.id}>
                  <ClientRow
                    client={c}
                    onClick={() => setOpenClientId(c.id)}
                  />
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {/* Fiche client drawer + booking detail modal triggered from
          inside the drawer's history list. The drawer stays mounted
          so the close transition isn't abrupt. */}
      {provider?.id && (
        <ClientDrawer
          isOpen={!!openClient}
          client={openClient}
          providerId={provider.id}
          onClose={() => setOpenClientId(null)}
          onPatched={(patch) => {
            // Apply the patch to the in-memory list so the row updates
            // without a refetch (notes / preferences are the only fields
            // the rule allows the provider to change).
            setClients((arr) =>
              arr.map((c) =>
                c.id === openClientId ? { ...c, ...patch } : c,
              ),
            );
          }}
          onBookingClick={(booking) => setSelectedBooking(booking)}
        />
      )}

      {selectedBooking && (
        <BookingDetailModal
          isOpen={!!selectedBooking}
          onClose={() => setSelectedBooking(null)}
          booking={selectedBooking}
          onUpdate={() => {
            // The drawer's history list re-mounts via its own effect
            // when the user switches client; for a same-client refresh
            // we'd need to lift the history up. Acceptable for now —
            // edits are rare from this surface.
            setSelectedBooking(null);
          }}
          providerSlug={provider?.slug}
        />
      )}
    </div>
  );
}

// ─── Empty states ────────────────────────────────────────────────────

function EmptyBaseState() {
  return (
    <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-10 text-center">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 mb-4">
        <Users className="w-6 h-6" />
      </div>
      <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
        Pas encore de client
      </h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
        Dès que vous recevrez votre première réservation, votre carnet
        de clients commencera à se remplir automatiquement.
      </p>
    </div>
  );
}

function EmptyResultState() {
  return (
    <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 p-10 text-center">
      <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 mb-4">
        <UserPlus className="w-6 h-6" />
      </div>
      <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
        Aucun client ne correspond
      </h2>
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Essayez d’ajuster votre recherche ou les filtres actifs.
      </p>
    </div>
  );
}

// ─── Filter / sort logic ─────────────────────────────────────────────

/**
 * Apply search → tag filter → sort, in that order.
 *
 * Search is matched on name / email / phone, case-insensitive,
 * substring. Tag filter is OR-of-tags (a client matching any
 * selected tag passes). Sort is applied last on the surviving rows.
 */
function applyFilters(
  base: WithId<ProviderClient>[],
  filters: FiltersState,
): WithId<ProviderClient>[] {
  const needle = filters.search.trim().toLowerCase();
  let out = base;

  if (needle) {
    out = out.filter((c) => {
      return (
        c.name.toLowerCase().includes(needle) ||
        (c.email?.toLowerCase().includes(needle) ?? false) ||
        (c.phone?.toLowerCase().includes(needle) ?? false)
      );
    });
  }

  if (filters.tags.length > 0) {
    out = out.filter((c) => c.tags.some((t) => filters.tags.includes(t)));
  }

  // Copy before sort — out may still reference the input array.
  out = [...out];
  switch (filters.sort) {
    case 'lastBooking-desc':
      out.sort((a, b) => b.lastBookingAt.getTime() - a.lastBookingAt.getTime());
      break;
    case 'lastBooking-asc':
      out.sort((a, b) => a.lastBookingAt.getTime() - b.lastBookingAt.getTime());
      break;
    case 'name-asc':
      out.sort((a, b) =>
        a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }),
      );
      break;
    case 'revenue-desc':
      out.sort((a, b) => b.totalRevenue - a.totalRevenue);
      break;
    case 'bookings-desc':
      out.sort((a, b) => b.bookingsCount - a.bookingsCount);
      break;
  }
  return out;
}
