'use client';

import { Area, AreaChart, ResponsiveContainer } from 'recharts';
import { ACCENTS, type Accent } from './primitives';

interface HeroKpiProps {
  label: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  accent: Accent;
  /** Ligne sous le chiffre : variation, précision… */
  detail?: React.ReactNode;
  /** Mini-courbe (une valeur par jour). */
  spark?: number[];
  /** À la place de la courbe : une jauge 0–1. */
  gauge?: number;
  footer?: React.ReactNode;
}

/** Grande carte de chiffre clé : pastille d'icône, chiffre, variation, courbe. */
export function HeroKpi({ label, value, icon, accent, detail, spark, gauge, footer }: HeroKpiProps) {
  const a = ACCENTS[accent];
  const idDegrade = `hero-${accent}`;
  const points = (spark ?? []).map((v, i) => ({ i, v }));
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-gray-100 dark:border-gray-700/60 bg-gradient-to-br ${a.glow} to-white dark:to-gray-800 bg-white dark:bg-gray-800 p-5 shadow-sm transition-shadow hover:shadow-md`}
    >
      <div className="flex items-center gap-2.5">
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${a.chip}`}>{icon}</span>
        <span className="text-sm font-medium text-gray-600 dark:text-gray-300">{label}</span>
      </div>
      <div className="mt-3 text-3xl font-bold tracking-tight text-gray-900 dark:text-white">{value}</div>
      <div className="mt-1.5 min-h-[20px]">{detail}</div>
      {footer && <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">{footer}</div>}

      {points.length > 1 && (
        <div className="-mx-5 -mb-5 mt-3 h-14">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={points} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={idDegrade} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={a.stroke} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={a.stroke} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="v"
                stroke={a.stroke}
                strokeWidth={2}
                fill={`url(#${idDegrade})`}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {gauge !== undefined && (
        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
          <div
            className="h-full rounded-full"
            style={{ width: `${Math.round(Math.min(1, Math.max(0, gauge)) * 100)}%`, backgroundColor: a.stroke }}
          />
        </div>
      )}

    </div>
  );
}
