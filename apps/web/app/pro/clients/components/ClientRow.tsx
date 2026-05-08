'use client';

/**
 * One row of the /pro/clients list.
 *
 * Designed to fit a lot of useful info at a glance without feeling
 * cluttered:
 *   - Avatar + name on the left
 *   - Tags (max 3, truncated with "+N" if more)
 *   - 3 KPIs (RDV count, CA, last visit) on the right
 *
 * The whole row is a button so it's keyboard-accessible — clicking
 * opens the client drawer (Étape 3, not yet implemented).
 */

import { Avatar, Badge } from '@/components/ui';
import type { ProviderClient } from '@booking-app/shared';
import { Mail, Phone, ChevronRight } from 'lucide-react';
import { formatRevenue } from './format';
import { TAG_META_BY_VALUE } from './tagMeta';

type WithId<T> = { id: string } & T;

interface Props {
  client: WithId<ProviderClient>;
  onClick: () => void;
}

export function ClientRow({ client, onClick }: Props) {
  const fullName = client.name || 'Client sans nom';
  const lastVisit = formatRelativeDate(client.lastBookingAt);

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 sm:gap-4 px-3 sm:px-4 py-3 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-primary-400 dark:hover:border-primary-500 hover:shadow-sm transition-all text-left"
    >
      <Avatar
        src={client.photoURL}
        alt={fullName}
        size="md"
        className="flex-shrink-0"
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
            {fullName}
          </p>
          {client.tags.slice(0, 2).map((tag) => {
            const meta = TAG_META_BY_VALUE[tag];
            return (
              <Badge
                key={tag}
                variant={meta.variant}
                size="sm"
                className="flex-shrink-0"
                title={meta.hint}
              >
                {meta.label}
              </Badge>
            );
          })}
          {client.tags.length > 2 && (
            <Badge
              variant="default"
              size="sm"
              className="flex-shrink-0"
              title={client.tags
                .slice(2)
                .map((t) => TAG_META_BY_VALUE[t]?.label ?? t)
                .join(' · ')}
            >
              +{client.tags.length - 2}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500 dark:text-gray-400">
          {client.email && (
            <span className="inline-flex items-center gap-1 truncate">
              <Mail className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">{client.email}</span>
            </span>
          )}
          {client.phone && (
            <span className="hidden sm:inline-flex items-center gap-1 truncate">
              <Phone className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">{client.phone}</span>
            </span>
          )}
        </div>
      </div>

      {/* KPIs — hidden on the smallest screens to keep the row readable */}
      <div className="hidden md:flex items-center gap-6 text-right flex-shrink-0">
        <KPI label="RDV" value={client.bookingsCount.toString()} />
        <KPI label="CA" value={formatRevenue(client.totalRevenue)} />
        <KPI label="Vu" value={lastVisit} />
      </div>

      <ChevronRight className="w-4 h-4 text-gray-300 dark:text-gray-600 flex-shrink-0" />
    </button>
  );
}

function KPI({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-[64px]">
      <p className="text-sm font-semibold text-gray-900 dark:text-white tabular-nums">
        {value}
      </p>
      <p className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500">
        {label}
      </p>
    </div>
  );
}

/**
 * "il y a 3 j" / "le 12 mai" / "—" — friendly relative date for the
 * last booking column. Anything older than 30 days falls back to the
 * absolute date so the pro can spot it on a calendar mentally.
 */
function formatRelativeDate(d: Date): string {
  if (!d || d.getTime() === 0) return '—';
  const now = Date.now();
  const diffMs = now - d.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days < 0) return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  if (days === 0) return "aujourd'hui";
  if (days === 1) return 'hier';
  if (days < 7) return `il y a ${days} j`;
  if (days < 30) return `il y a ${Math.floor(days / 7)} sem`;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}
