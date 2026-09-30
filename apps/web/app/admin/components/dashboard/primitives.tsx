'use client';

import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';

/** Couleurs d'accent du tableau de bord — une par thème, jamais décoratives. */
export const ACCENTS = {
  red: { chip: 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400', stroke: '#EF4444', glow: 'from-red-50/80 dark:from-red-500/5' },
  violet: { chip: 'bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400', stroke: '#8B5CF6', glow: 'from-violet-50/80 dark:from-violet-500/5' },
  sky: { chip: 'bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400', stroke: '#0EA5E9', glow: 'from-sky-50/80 dark:from-sky-500/5' },
  emerald: { chip: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400', stroke: '#10B981', glow: 'from-emerald-50/80 dark:from-emerald-500/5' },
  amber: { chip: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400', stroke: '#F59E0B', glow: 'from-amber-50/80 dark:from-amber-500/5' },
} as const;
export type Accent = keyof typeof ACCENTS;

/** Carte de base : arrondie, aérée, légère ombre au survol. */
export function Panel({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700/60 shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

export function PanelTitle({
  icon,
  accent,
  title,
  right,
}: {
  icon: React.ReactNode;
  accent: Accent;
  title: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3">
      <h3 className="flex items-center gap-2.5 text-sm font-semibold text-gray-900 dark:text-white">
        <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${ACCENTS[accent].chip}`}>{icon}</span>
        {title}
      </h3>
      {right}
    </div>
  );
}

/** Variation en % par rapport à la période précédente. */
export function variation(value: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((value - previous) / previous) * 100);
}

/** Pastille « +12 % » verte / rouge / neutre, avec la période comparée. */
export function DeltaPill({
  value,
  previous,
  suffix = 'vs 30 j préc.',
}: {
  value: number;
  previous: number;
  suffix?: string;
}) {
  const pct = variation(value, previous);
  if (pct === null) {
    return (
      <span className="text-xs text-gray-400 dark:text-gray-500">
        {value > 0 ? 'nouveau sur la période' : 'rien sur la période'}
      </span>
    );
  }
  const hausse = pct > 0;
  const stable = pct === 0;
  const Icone = stable ? Minus : hausse ? ArrowUpRight : ArrowDownRight;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span
        className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-semibold ${
          stable
            ? 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
            : hausse
              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
              : 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400'
        }`}
      >
        <Icone className="h-3 w-3" />
        {hausse ? '+' : ''}
        {pct} %
      </span>
      <span className="text-gray-400 dark:text-gray-500">{suffix}</span>
    </span>
  );
}

/** Pastille ronde : photo ou initiale. */
export function Avatar({ name, photoURL, size = 28 }: { name: string; photoURL: string | null; size?: number }) {
  return (
    <span
      className="flex flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700 ring-2 ring-white dark:ring-gray-800"
      style={{ width: size, height: size }}
    >
      {photoURL ? (
        <img src={photoURL} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="text-[11px] font-semibold text-gray-600 dark:text-gray-300">
          {(name || '?').charAt(0).toUpperCase()}
        </span>
      )}
    </span>
  );
}

export const nombre = (n: number) => n.toLocaleString('fr-FR');
