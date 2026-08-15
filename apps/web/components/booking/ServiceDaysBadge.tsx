'use client';

import { useTranslations } from 'next-intl';
import { describeServiceDays, joinDays } from '@/lib/serviceDays';

/**
 * Pastille « Le lundi et le mardi uniquement » sur une carte de prestation.
 *
 * Ne rend RIEN quand la prestation n'a aucune restriction — c'est le cas de
 * l'immense majorité, et une carte ne doit pas s'alourdir pour une
 * information vide.
 *
 * Au-delà de quatre jours ouverts, `describeServiceDays` bascule à la forme
 * négative (« Sauf le dimanche ») : c'est ce qui empêche la pastille de
 * s'étaler sur trois lignes et de manger la carte.
 */
export function ServiceDaysBadge({
  availableDays,
  className = '',
}: {
  availableDays?: number[];
  className?: string;
}) {
  const t = useTranslations('booking.service');
  const phrase = describeServiceDays(availableDays);
  if (!phrase) return null;

  const days = joinDays(phrase.days, (d) => t(`weekdayLong.${d}`), t('and'));
  const label = phrase.key === 'only' ? t('dayBadgeOnly', { days }) : t('dayBadgeExcept', { days });

  return (
    <span
      className={`inline-flex items-center text-[11px] font-medium text-sky-700 bg-sky-50 dark:text-sky-300 dark:bg-sky-900/30 px-1.5 py-0.5 rounded whitespace-nowrap ${className}`}
    >
      {label}
    </span>
  );
}
