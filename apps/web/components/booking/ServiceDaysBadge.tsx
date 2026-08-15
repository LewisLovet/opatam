'use client';

import { CalendarDays } from 'lucide-react';
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

  // Rendue comme la ligne de durée — même taille, même gabarit d'icône, pas
  // de fond. C'est une information de la même famille (« combien de temps »,
  // « quels jours »), pas une alerte : un aplat coloré sur deux lignes
  // pesait plus lourd que le nom de la prestation.
  return (
    <span
      className={`flex items-center gap-1.5 text-sm text-sky-700 dark:text-sky-400 ${className}`}
    >
      <CalendarDays className="w-4 h-4 shrink-0" />
      {label}
    </span>
  );
}
