'use client';

import { useState, useEffect, useMemo } from 'react';
import type { Service, Member } from '@booking-app/shared';
import { Loader2, Lock } from 'lucide-react';

type WithId<T> = { id: string } & T;
type DayStatus = 'available' | 'almost_full' | 'full' | 'closed';

interface DaySummary {
  status: DayStatus;
  /** Realistic remaining capacity — only in per-service mode. */
  capacity?: number;
}

interface MonthViewProps {
  providerId: string;
  /** Any date within the month to display. */
  selectedDate: Date;
  services: WithId<Service>[];
  members: WithId<Member>[];
  /** Resolved member whose schedule drives the grid (member-centric model). */
  memberId: string | null;
  isTeamPlan: boolean;
  /** Client booking horizon in days (provider.settings.maxBookingAdvance).
   *  Days beyond it are NOT bookable, whatever the schedule. */
  maxBookingAdvance: number;
  /** Click a day → open that day in the day view. */
  onDayClick: (date: Date) => void;
}

/** Local YYYY-MM-DD (timezone-safe). */
function toKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Monday on/before the 1st of the month (grid start). */
function gridStartFor(date: Date): Date {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const dow = first.getDay(); // 0=Sun
  const offset = dow === 0 ? 6 : dow - 1; // back to Monday
  const start = new Date(first);
  start.setDate(first.getDate() - offset);
  start.setHours(0, 0, 0, 0);
  return start;
}

const STATUS_STYLE: Record<
  DayStatus,
  { dot: string; text: string; cell: string }
> = {
  available: {
    dot: 'bg-emerald-500',
    text: 'text-emerald-700 dark:text-emerald-400',
    cell: 'bg-white dark:bg-gray-800 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 cursor-pointer',
  },
  almost_full: {
    dot: 'bg-amber-500',
    text: 'text-amber-700 dark:text-amber-400',
    cell: 'bg-amber-50 dark:bg-amber-900/15 hover:bg-amber-100 dark:hover:bg-amber-900/25 cursor-pointer',
  },
  full: {
    dot: 'bg-rose-400',
    text: 'text-gray-400 dark:text-gray-500 line-through',
    cell: 'bg-gray-50 dark:bg-gray-800/40',
  },
  closed: {
    dot: 'bg-gray-300 dark:bg-gray-600',
    text: 'text-gray-400 dark:text-gray-500',
    cell: 'bg-gray-50/60 dark:bg-gray-800/30',
  },
};

const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

export function MonthView({
  providerId,
  selectedDate,
  services,
  members,
  memberId,
  isTeamPlan,
  maxBookingAdvance,
  onDayClick,
}: MonthViewProps) {
  // null = service-agnostic occupancy mode (just statuses).
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [summary, setSummary] = useState<Record<string, DaySummary>>({});
  const [loading, setLoading] = useState(false);

  const serviceMode = serviceId !== null;
  const month = selectedDate.getMonth();

  const days = useMemo(() => {
    const start = gridStartFor(selectedDate);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [selectedDate]);

  const fromKey = toKey(days[0]);
  const toKeyStr = toKey(days[41]);

  useEffect(() => {
    if (!providerId || !memberId) return;
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        const url = serviceId
          ? `/api/slots/summary?providerId=${providerId}&serviceId=${serviceId}&memberId=${memberId}&from=${fromKey}&to=${toKeyStr}`
          : `/api/slots/occupancy?providerId=${providerId}&memberId=${memberId}&from=${fromKey}&to=${toKeyStr}`;
        const res = await fetch(url);
        const json = await res.json();
        if (cancelled) return;
        const map: Record<string, DaySummary> = {};
        for (const d of json.days ?? []) {
          map[d.date] = { status: d.status, capacity: d.capacity };
        }
        setSummary(map);
      } catch (e) {
        if (!cancelled) console.error('[MonthView] load error', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [providerId, memberId, serviceId, fromKey, toKeyStr]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Client booking horizon: past this date clients simply can't book, whatever
  // the schedule says — so we flag those days instead of leaving them blank.
  const horizonDate = new Date(today);
  horizonDate.setDate(horizonDate.getDate() + maxBookingAdvance);
  horizonDate.setHours(23, 59, 59, 999);
  const horizonLabel = horizonDate.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const gridBeyondHorizon = days[41] > horizonDate;

  const dayLabel = (s: DaySummary | undefined): string => {
    if (!s) return '';
    if (s.status === 'closed') return 'Fermé';
    if (s.status === 'full') return 'Complet';
    if (serviceMode && typeof s.capacity === 'number') return `${s.capacity} pl.`;
    return s.status === 'almost_full' ? 'Chargé' : 'Disponible';
  };

  return (
    <div className="p-3 sm:p-4">
      {/* Selector row */}
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Disponibilités&nbsp;:
        </label>
        <select
          value={serviceId ?? ''}
          onChange={(e) => setServiceId(e.target.value || null)}
          className="text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="">Vue générale (sans prestation)</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        {isTeamPlan && memberId && (
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {members.find((m) => m.id === memberId)?.name ?? ''}
          </span>
        )}
        {loading && <Loader2 className="w-4 h-4 animate-spin text-primary-500" />}
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-1 sm:gap-1.5 mb-1.5">
        {WEEKDAYS.map((w) => (
          <div
            key={w}
            className="text-center text-xs font-medium text-gray-500 dark:text-gray-400 py-1"
          >
            {w}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
        {days.map((d, i) => {
          const key = toKey(d);
          const s = summary[key];
          const status = s?.status ?? 'closed';
          const style = STATUS_STYLE[status];
          const inMonth = d.getMonth() === month;
          const isPast = d < today;
          const isBeyond = d > horizonDate;
          const isToday = d.getTime() === today.getTime();
          const clickable =
            !isPast && !isBeyond && (status === 'available' || status === 'almost_full');

          return (
            <button
              key={i}
              type="button"
              disabled={!clickable}
              onClick={() => clickable && onDayClick(d)}
              title={isBeyond ? `Réservable seulement jusqu'au ${horizonLabel}` : undefined}
              className={`
                min-h-[58px] sm:min-h-[68px] rounded-lg border border-gray-200/60 dark:border-gray-700/40
                flex flex-col items-center justify-center gap-1 px-1 py-1.5 transition-colors
                ${isBeyond ? 'bg-gray-50/60 dark:bg-gray-800/30' : style.cell}
                ${!inMonth ? 'opacity-40' : ''}
                ${isPast || isBeyond ? 'opacity-50' : ''}
                ${clickable ? '' : 'cursor-default'}
              `}
            >
              <span
                className={`text-sm font-semibold ${
                  isToday
                    ? 'w-6 h-6 flex items-center justify-center rounded-full bg-primary-500 text-white'
                    : 'text-gray-900 dark:text-white'
                }`}
              >
                {d.getDate()}
              </span>
              {isBeyond ? (
                <Lock className="w-3 h-3 text-gray-300 dark:text-gray-600" />
              ) : s && !isPast ? (
                <span className={`flex items-center gap-1 text-[11px] font-medium ${style.text}`}>
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${style.dot}`} />
                  {/* Narrow view (mobile / thin) → dot only; text from sm: up. */}
                  <span className="hidden sm:inline">{dayLabel(s)}</span>
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Booking-horizon notice — keeps the pro from reading "blank/locked"
          far-out days as bookable. */}
      {gridBeyondHorizon && (
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-gray-50 dark:bg-gray-800/40 border border-gray-200/60 dark:border-gray-700/40 px-3 py-2 text-xs text-gray-600 dark:text-gray-400">
          <Lock className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-gray-400" />
          <span>
            Vos clients ne peuvent réserver que jusqu&apos;au{' '}
            <strong className="font-semibold text-gray-700 dark:text-gray-300">{horizonLabel}</strong>{' '}
            (J+{maxBookingAdvance}, selon vos paramètres de réservation). Au-delà, aucun
            créneau ne leur est proposé.{' '}
            <a
              href="/pro/parametres"
              className="text-primary-600 dark:text-primary-400 font-medium hover:underline"
            >
              Modifier le délai →
            </a>
          </span>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-4 text-xs text-gray-600 dark:text-gray-400">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500" /> Disponible
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-500" />{' '}
          {serviceMode ? 'Bientôt complet' : 'Chargé'}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-rose-400" /> Complet
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-600" /> Fermé
        </span>
        {gridBeyondHorizon && (
          <span className="flex items-center gap-1.5">
            <Lock className="w-3 h-3 text-gray-400" /> Hors délai
          </span>
        )}
      </div>
    </div>
  );
}
