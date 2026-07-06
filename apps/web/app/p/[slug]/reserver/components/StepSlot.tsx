'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Loader2, Check, Flame, ArrowRight, CalendarX } from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';
import { generateDemoSlots } from '../../demoData';

interface TimeSlotWithDate {
  date: string;
  start: string;
  end: string;
  datetime: string;
  endDatetime: string;
}

type DayStatus = 'available' | 'almost_full' | 'full' | 'closed';

interface DayInfo {
  status: DayStatus;
  capacity: number;
  slots: TimeSlotWithDate[];
}

interface StepSlotProps {
  providerId: string;
  serviceId: string;
  memberId: string;
  serviceDuration: number;
  maxAdvanceDays: number;
  selectedSlot: TimeSlotWithDate | null;
  onSelect: (slot: TimeSlotWithDate) => void;
  onBack: () => void;
  openDays: number[]; // Array of open day numbers (0=Sunday, 1=Monday, etc.)
  isDemo?: boolean;
}

// Local YYYY-MM-DD — must match the server's key (toISOString would shift to UTC).
function dateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function StepSlot({
  providerId,
  serviceId,
  memberId,
  serviceDuration,
  maxAdvanceDays,
  selectedSlot,
  onSelect,
  onBack,
  openDays,
  isDemo = false,
}: StepSlotProps) {
  const t = useTranslations('booking.slot');
  const tCommon = useTranslations('booking.common');
  const locale = useLocale();
  // Localised calendar labels (arrays live in the dictionaries).
  const dayNames = t.raw('days') as string[];
  const monthNames = t.raw('months') as string[];
  const today = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }, []);

  const dateRange = useMemo(() => {
    const max = new Date(today);
    max.setDate(max.getDate() + maxAdvanceDays);
    return { min: today, max };
  }, [today, maxAdvanceDays]);

  const [summary, setSummary] = useState<Record<string, DayInfo>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [currentMonth, setCurrentMonth] = useState(today);
  const autoSelectedRef = useRef(false);

  // ── Fetch the whole range in ONE batched call ───────────────────────────
  useEffect(() => {
    let cancelled = false;
    autoSelectedRef.current = false;
    setLoading(true);
    setError(null);

    const buildAndSet = (entries: Record<string, DayInfo>) => {
      if (cancelled) return;
      setSummary(entries);
      // Auto-select the first day with real capacity (once).
      if (!autoSelectedRef.current) {
        const firstKey = Object.keys(entries)
          .filter((k) => entries[k].capacity > 0)
          .sort()[0];
        if (firstKey) {
          const [y, m, d] = firstKey.split('-').map(Number);
          const first = new Date(y, m - 1, d);
          setSelectedDate(first);
          setCurrentMonth(first);
          autoSelectedRef.current = true;
        }
      }
      setLoading(false);
    };

    // Demo mode — synthesize a summary locally so the marketing/demo page works.
    if (isDemo) {
      const entries: Record<string, DayInfo> = {};
      const cur = new Date(dateRange.min);
      while (cur <= dateRange.max) {
        if (openDays.includes(cur.getDay())) {
          const slots = generateDemoSlots(new Date(cur), serviceDuration);
          entries[dateKey(cur)] = {
            status: slots.length === 0 ? 'full' : slots.length <= 2 ? 'almost_full' : 'available',
            capacity: Math.min(slots.length, 5),
            slots,
          };
        } else {
          entries[dateKey(cur)] = { status: 'closed', capacity: 0, slots: [] };
        }
        cur.setDate(cur.getDate() + 1);
      }
      const timer = setTimeout(() => buildAndSet(entries), 250);
      return () => { cancelled = true; clearTimeout(timer); };
    }

    const params = new URLSearchParams({
      providerId,
      serviceId,
      memberId,
      from: dateKey(dateRange.min),
      to: dateKey(dateRange.max),
      duration: String(serviceDuration),
    });

    fetch(`/api/slots/summary?${params}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(t('loadError')))))
      .then((data: { days: Array<DayInfo & { date: string }> }) => {
        const entries: Record<string, DayInfo> = {};
        for (const d of data.days || []) {
          entries[d.date] = { status: d.status, capacity: d.capacity, slots: d.slots };
        }
        buildAndSet(entries);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : tCommon('error'));
        setLoading(false);
      });

    return () => { cancelled = true; };
  }, [providerId, serviceId, memberId, serviceDuration, isDemo, openDays, dateRange.min, dateRange.max]);

  // ── Derived ─────────────────────────────────────────────────────────────
  const selectedInfo = selectedDate ? summary[dateKey(selectedDate)] : undefined;

  const nextAvailableAfter = useCallback(
    (from: Date | null): Date | null => {
      const fromKey = from ? dateKey(from) : '';
      const key = Object.keys(summary)
        .filter((k) => summary[k].capacity > 0 && (!fromKey || k > fromKey))
        .sort()[0];
      if (!key) return null;
      const [y, m, d] = key.split('-').map(Number);
      return new Date(y, m - 1, d);
    },
    [summary],
  );

  const hasAnyAvailability = useMemo(
    () => Object.values(summary).some((d) => d.capacity > 0),
    [summary],
  );

  // Calendar grid for the current month
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days: (Date | null)[] = [];
    for (let i = 0; i < firstDay.getDay(); i++) days.push(null);
    for (let i = 1; i <= lastDay.getDate(); i++) days.push(new Date(year, month, i));
    return days;
  }, [currentMonth]);

  const goToPreviousMonth = () => {
    const prev = new Date(currentMonth);
    prev.setMonth(prev.getMonth() - 1);
    if (prev >= new Date(dateRange.min.getFullYear(), dateRange.min.getMonth(), 1)) setCurrentMonth(prev);
  };
  const goToNextMonth = () => {
    const next = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
    if (next <= new Date(dateRange.max.getFullYear(), dateRange.max.getMonth(), 1)) setCurrentMonth(next);
  };
  const canGoPrevious = useMemo(() => {
    const prev = new Date(currentMonth);
    prev.setMonth(prev.getMonth() - 1);
    return prev >= new Date(dateRange.min.getFullYear(), dateRange.min.getMonth(), 1);
  }, [currentMonth, dateRange.min]);
  const canGoNext = useMemo(() => {
    const next = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
    return next <= new Date(dateRange.max.getFullYear(), dateRange.max.getMonth(), 1);
  }, [currentMonth, dateRange.max]);

  const jumpToNextAvailable = () => {
    const next = nextAvailableAfter(selectedDate && summary[dateKey(selectedDate)]?.capacity ? selectedDate : null);
    if (next) {
      setSelectedDate(next);
      setCurrentMonth(next);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={onBack}
          className="p-2 -ml-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          aria-label={tCommon('back')}
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          {t('title')}
        </h2>
        {!loading && !error && hasAnyAvailability && nextAvailableAfter(selectedDate) && (
          <button
            onClick={jumpToNextAvailable}
            className="ml-auto inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 dark:text-primary-400 hover:underline whitespace-nowrap"
          >
            {t('nextAvailability')} <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
        </div>
      ) : error ? (
        <div className="text-center py-8 text-red-500 dark:text-red-400">{error}</div>
      ) : !hasAnyAvailability ? (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800/50 rounded-xl px-6">
          <CalendarX className="w-10 h-10 text-gray-400 dark:text-gray-500 mx-auto mb-3" />
          <p className="font-semibold text-gray-900 dark:text-white">{t('noAvailabilityTitle')}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {t('noAvailabilityHint', { days: maxAdvanceDays })}
          </p>
        </div>
      ) : (
        <>
          {/* Calendar */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 mb-5">
            <div className="flex items-center justify-between mb-4">
              <button
                onClick={goToPreviousMonth}
                disabled={!canGoPrevious}
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                aria-label={t('prevMonth')}
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <h3 className="font-semibold text-gray-900 dark:text-white">
                {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
              </h3>
              <button
                onClick={goToNextMonth}
                disabled={!canGoNext}
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                aria-label={t('nextMonth')}
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 mb-1">
              {dayNames.map((day) => (
                <div key={day} className="text-center text-xs font-medium text-gray-500 dark:text-gray-400 py-2">
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((date, index) => {
                if (!date) return <div key={`empty-${index}`} className="aspect-square" />;

                const key = dateKey(date);
                const info = summary[key];
                const isPast = date < dateRange.min;
                const isToday = key === dateKey(today);
                const selected = !!selectedDate && key === dateKey(selectedDate);
                const status: DayStatus | 'past' = isPast ? 'past' : info?.status ?? 'closed';
                const clickable = status === 'available' || status === 'almost_full';

                let cls = '';
                let label: string | null = null;
                let dot = false;
                if (selected) {
                  cls = 'bg-primary-600 text-white font-semibold';
                } else if (status === 'available') {
                  cls = `text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 ${isToday ? 'ring-1 ring-primary-300 dark:ring-primary-700' : ''}`;
                  dot = true;
                } else if (status === 'almost_full') {
                  cls = 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30';
                  label = t('spotsShort', { count: info!.capacity });
                } else if (status === 'full') {
                  cls = 'text-gray-400 dark:text-gray-600 line-through cursor-not-allowed';
                  label = t('full');
                } else {
                  cls = 'text-gray-300 dark:text-gray-600 cursor-not-allowed';
                  if (status === 'closed' && !isPast) label = t('closed');
                }

                return (
                  <button
                    key={key}
                    onClick={() => clickable && setSelectedDate(date)}
                    disabled={!clickable}
                    className={`aspect-square flex flex-col items-center justify-center gap-0.5 text-sm rounded-lg transition-colors ${cls}`}
                  >
                    <span>{date.getDate()}</span>
                    {dot && !selected && (
                      <span className="w-1 h-1 rounded-full bg-emerald-500" />
                    )}
                    {label && <span className="text-[11px] leading-none">{label}</span>}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3 text-xs text-gray-500 dark:text-gray-400">
              <span className="inline-flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />{t('available')}</span>
              <span className="inline-flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-amber-500" />{t('almostFull')}</span>
              <span className="inline-flex items-center gap-1.5"><span className="line-through">{t('full')}</span></span>
              <span className="inline-flex items-center gap-1.5"><span className="opacity-60">{t('closed')}</span></span>
            </div>
          </div>

          {/* Time slots */}
          {selectedDate && (
            <div>
              <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  {selectedDate.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })}
                </h3>
                {selectedInfo?.status === 'almost_full' && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400">
                    <Flame className="w-3.5 h-3.5" />
                    {t('almostFullBadge', { count: selectedInfo.capacity })}
                  </span>
                )}
              </div>

              {!selectedInfo || selectedInfo.slots.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 dark:bg-gray-800/50 rounded-xl px-4">
                  <p className="text-gray-500 dark:text-gray-400">{t('dayFull')}</p>
                  {nextAvailableAfter(null) && (
                    <button
                      onClick={jumpToNextAvailable}
                      className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 dark:text-primary-400 hover:underline"
                    >
                      {t('seeNextAvailability')} <ArrowRight className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {selectedInfo.slots.map((slot) => {
                    const selected = selectedSlot?.datetime === slot.datetime;
                    return (
                      <button
                        key={slot.datetime}
                        onClick={() => onSelect(slot)}
                        className={`relative py-3 px-4 rounded-lg border-2 transition-all ${
                          selected
                            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-primary-300 dark:hover:border-primary-700'
                        }`}
                      >
                        {selected && (
                          <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-primary-500 rounded-full flex items-center justify-center shadow-sm">
                            <Check className="w-3 h-3 text-white" strokeWidth={3} />
                          </span>
                        )}
                        <div className="flex flex-col items-center">
                          <span className={`text-sm font-semibold ${selected ? 'text-primary-600 dark:text-primary-400' : 'text-gray-900 dark:text-white'}`}>
                            {slot.start}
                          </span>
                          <span className={`text-xs ${selected ? 'text-primary-500/70 dark:text-primary-400/70' : 'text-gray-400 dark:text-gray-500'}`}>
                            → {slot.end}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
