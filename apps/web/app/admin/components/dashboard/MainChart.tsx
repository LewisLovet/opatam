'use client';

import { useEffect, useState } from 'react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Activity } from 'lucide-react';
import { formatPrice } from '@booking-app/shared';
import { adminStatsService } from '@/services/admin';
import type { SeriesData, SeriesMetric } from '@/services/admin/types';
import { ACCENTS, type Accent, DeltaPill, Panel, PanelTitle, nombre } from './primitives';

const METRIQUES: { key: SeriesMetric; label: string; accent: Accent; money?: boolean }[] = [
  { key: 'bookings', label: 'Réservations', accent: 'violet' },
  { key: 'fees', label: 'Frais perçus', accent: 'emerald', money: true },
  { key: 'home', label: "Pages d'accueil", accent: 'red' },
  { key: 'signups', label: 'Inscriptions', accent: 'sky' },
  { key: 'views', label: 'Vues des vitrines', accent: 'amber' },
];
const PERIODES = [7, 30, 90] as const;
type Periode = (typeof PERIODES)[number];

const court = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });

/**
 * Un seul grand graphique à onglets plutôt que quatre petits qui se
 * répètent, avec la période précédente en pointillés pour juger d'un coup
 * d'œil si l'on progresse.
 */
export function MainChart() {
  const [metrique, setMetrique] = useState<SeriesMetric>('bookings');
  const [periode, setPeriode] = useState<Periode>(30);
  const [cache, setCache] = useState<Record<string, SeriesData>>({});
  const [erreur, setErreur] = useState(false);
  const cle = `${metrique}-${periode}`;
  const serie = cache[cle];
  const conf = METRIQUES.find((m) => m.key === metrique)!;
  const couleur = ACCENTS[conf.accent].stroke;

  useEffect(() => {
    if (cache[cle]) return;
    let annule = false;
    setErreur(false);
    adminStatsService
      .getSeries(metrique, periode)
      .then((s) => !annule && setCache((c) => ({ ...c, [cle]: s })))
      .catch(() => !annule && setErreur(true));
    return () => {
      annule = true;
    };
  }, [cle, metrique, periode, cache]);

  const format = (v: number) => (conf.money ? formatPrice(v, 'EUR') : nombre(v));
  const points = (serie?.current ?? []).map((p, i) => ({
    label: court(p.date),
    date: p.date,
    actuel: conf.money ? p.value / 100 : p.value,
    precedent: serie?.previous[i] ? (conf.money ? serie.previous[i].value / 100 : serie.previous[i].value) : null,
    brut: p.value,
    brutPrec: serie?.previous[i]?.value ?? 0,
  }));
  const total = (serie?.current ?? []).reduce((s, p) => s + p.value, 0);
  const totalPrec = (serie?.previous ?? []).reduce((s, p) => s + p.value, 0);

  return (
    <Panel className="flex flex-col">
      <PanelTitle
        icon={<Activity className="h-4 w-4" />}
        accent={conf.accent}
        title="Évolution"
        right={
          <div className="flex items-center gap-1 rounded-lg bg-gray-100 dark:bg-gray-700/60 p-0.5">
            {PERIODES.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriode(p)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  periode === p
                    ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
                }`}
              >
                {p} j
              </button>
            ))}
          </div>
        }
      />

      <div className="flex flex-wrap gap-1.5 px-5">
        {METRIQUES.map((m) => {
          const actif = m.key === metrique;
          return (
            <button
              key={m.key}
              type="button"
              onClick={() => setMetrique(m.key)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                actif
                  ? ACCENTS[m.accent].chip
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/40'
              }`}
            >
              {m.label}
            </button>
          );
        })}
      </div>

      <div className="flex items-end justify-between gap-3 px-5 pt-4">
        <div>
          <p className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            {serie ? format(total) : '—'}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">sur les {periode} derniers jours</p>
        </div>
        {serie && <DeltaPill value={total} previous={totalPrec} suffix={`vs ${periode} j préc.`} />}
      </div>

      <div className="h-64 px-2 pb-3 pt-2">
        {erreur ? (
          <div className="flex h-full items-center justify-center text-sm text-gray-400">Courbe indisponible</div>
        ) : !serie ? (
          <div className="flex h-full items-center justify-center text-sm text-gray-400">Chargement…</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={`degrade-${metrique}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={couleur} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={couleur} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#9CA3AF" opacity={0.15} vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9CA3AF' }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={24} />
              <YAxis
                tick={{ fontSize: 11, fill: '#9CA3AF' }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
                width={44}
                tickFormatter={(v: number) => (conf.money ? `${v} €` : `${v}`)}
              />
              <Tooltip
                cursor={{ stroke: couleur, strokeOpacity: 0.3 }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const p = payload[0].payload as (typeof points)[number];
                  return (
                    <div className="rounded-xl bg-gray-900 px-3 py-2 text-xs text-gray-100 shadow-lg">
                      <p className="text-gray-400">
                        {new Date(`${p.date}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                      </p>
                      <p className="mt-0.5 text-sm font-semibold" style={{ color: couleur }}>
                        {format(p.brut)}
                      </p>
                      <p className="text-gray-400">période précédente : {format(p.brutPrec)}</p>
                    </div>
                  );
                }}
              />
              <Line
                type="monotone"
                dataKey="precedent"
                stroke="#9CA3AF"
                strokeWidth={1.5}
                strokeDasharray="4 4"
                dot={false}
                isAnimationActive={false}
              />
              <Area
                type="monotone"
                dataKey="actuel"
                stroke={couleur}
                strokeWidth={2.5}
                fill={`url(#degrade-${metrique})`}
                activeDot={{ r: 4 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
      <p className="px-5 pb-4 text-[11px] text-gray-400 dark:text-gray-500">
        Pointillés : la période précédente, jour pour jour.
        {metrique === 'fees' ? ' En euros ; les autres devises ne sont jamais additionnées.' : ''}
        {metrique === 'views' ? ' Le jour en cours se complète la nuit.' : ''}
        {metrique === 'home' ? " L'accueil et les pages métier réunis, indicatif (visites anonymes, sans cookie)." : ''}
      </p>
    </Panel>
  );
}
