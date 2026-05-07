'use client';

import { Star, XCircle, UserX } from 'lucide-react';

interface Props {
  cancellationRate: number; // 0..1
  noshowRate: number; // 0..1
  averageRating: number | null; // 0..5 or null if no reviews
  ratingCount: number;
}

export function QualityIndicators({
  cancellationRate,
  noshowRate,
  averageRating,
  ratingCount,
}: Props) {
  return (
    <section className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 sm:p-5">
      <header className="mb-4">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">
          Indicateurs qualité
        </h2>
      </header>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Tile
          icon={<XCircle className="w-4 h-4" />}
          label="Taux d'annulation"
          value={`${(cancellationRate * 100).toFixed(1)}%`}
          tone={cancellationRate > 0.1 ? 'warning' : 'default'}
        />
        <Tile
          icon={<UserX className="w-4 h-4" />}
          label="Taux de no-show"
          value={`${(noshowRate * 100).toFixed(1)}%`}
          tone={noshowRate > 0.05 ? 'warning' : 'default'}
        />
        <Tile
          icon={<Star className="w-4 h-4" />}
          label="Note moyenne"
          value={
            averageRating === null ? '—' : averageRating.toFixed(1) + ' / 5'
          }
          sublabel={ratingCount > 0 ? `${ratingCount} avis` : 'aucun avis'}
        />
      </div>
    </section>
  );
}

interface TileProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  sublabel?: string;
  tone?: 'default' | 'warning';
}

function Tile({ icon, label, value, sublabel, tone = 'default' }: TileProps) {
  const valueClass =
    tone === 'warning'
      ? 'text-amber-600 dark:text-amber-400'
      : 'text-gray-900 dark:text-white';
  return (
    <div className="rounded-lg bg-gray-50 dark:bg-gray-900/40 px-4 py-3">
      <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
        {icon}
        {label}
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className={`text-xl font-bold ${valueClass}`}>{value}</span>
        {sublabel && (
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {sublabel}
          </span>
        )}
      </div>
    </div>
  );
}
