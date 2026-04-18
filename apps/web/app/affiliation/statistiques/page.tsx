'use client';

import { useMemo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Users,
  Euro,
  PieChart as PieIcon,
  Trophy,
} from 'lucide-react';

import { useAffiliate } from '../_shared/useAffiliate';
import {
  getMonthlyRevenue,
  getCumulativeCommission,
  getMonthlySignups,
  getReferralStatusBreakdown,
  getTopReferrals,
  compareCurrentToPreviousMonth,
} from '../_shared/chartData';

function formatEuro(cents: number): string {
  return `${(cents / 100).toFixed(0)} €`;
}

function formatDelta(d: number | null): { label: string; tone: 'up' | 'down' | 'flat' } {
  if (d === null) return { label: '—', tone: 'flat' };
  if (Math.abs(d) < 0.5) return { label: '0%', tone: 'flat' };
  const sign = d > 0 ? '+' : '';
  return {
    label: `${sign}${d.toFixed(0)}%`,
    tone: d > 0 ? 'up' : 'down',
  };
}

export default function StatistiquesPage() {
  // Pulls pre-aggregated monthlyStats (~13 docs) + topReferrals (5 docs) +
  // referrals list (donut). Total reads per visit: ~30 instead of hundreds.
  const { affiliate, monthlyStats, topReferrals, referrals, loading } = useAffiliate({
    includeReferrals: true,
    includeAggregates: true,
    logsLimit: 0, // we don't need raw logs on this page
  });

  const data = useMemo(() => {
    return {
      revenue: getMonthlyRevenue(monthlyStats, 12),
      cumulative: getCumulativeCommission(monthlyStats, 12),
      signups: getMonthlySignups(monthlyStats, 12),
      status: getReferralStatusBreakdown(referrals),
      top: getTopReferrals(topReferrals, 5),
      compareCommission: compareCurrentToPreviousMonth(monthlyStats, 'commission'),
      compareCount: compareCurrentToPreviousMonth(monthlyStats, 'count'),
    };
  }, [monthlyStats, topReferrals, referrals]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-6 h-6 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
      </div>
    );
  }
  if (!affiliate) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-gray-400">Compte affilié non trouvé</p>
      </div>
    );
  }

  const hasAnyData = monthlyStats.length > 0 || referrals.length > 0;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Statistiques</h1>
        <p className="text-sm text-gray-500 mt-1">
          Évolution détaillée de votre activité d&apos;affiliation
        </p>
      </div>

      {!hasAnyData && (
        <div className="bg-white border border-dashed border-gray-300 rounded-xl p-10 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center mb-4">
            <TrendingUp className="w-5 h-5 text-gray-300" />
          </div>
          <p className="text-sm text-gray-500">
            Les statistiques apparaîtront ici dès que vous aurez vos premiers filleuls.
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Partagez votre lien pour commencer à en recevoir.
          </p>
        </div>
      )}

      {hasAnyData && (
        <>
          {/* KPI comparatif ce mois vs précédent */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
            <CompareCard
              title="Commissions ce mois"
              icon={<Euro className="w-4 h-4" />}
              current={formatEuro(data.compareCommission.thisMonth)}
              previous={`Mois dernier : ${formatEuro(data.compareCommission.lastMonth)}`}
              delta={formatDelta(data.compareCommission.deltaPercent)}
            />
            <CompareCard
              title="Paiements reçus ce mois"
              icon={<Users className="w-4 h-4" />}
              current={`${data.compareCount.thisMonth}`}
              previous={`Mois dernier : ${data.compareCount.lastMonth}`}
              delta={formatDelta(data.compareCount.deltaPercent)}
            />
          </div>

          {/* Revenus mensuels */}
          <ChartCard title="Revenus mensuels (12 derniers mois)" subtitle="1er paiement + renouvellements, en euros">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.revenue} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => `${(v / 100).toFixed(0)}€`}
                />
                <Tooltip
                  formatter={((value: number, name: string) => [
                    `${(value / 100).toFixed(2)} €`,
                    name === 'value' ? '1er paiement' : 'Renouvellement',
                  ]) as never}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                />
                <Bar dataKey="value" stackId="a" fill="#6366f1" radius={[0, 0, 0, 0]} />
                <Bar dataKey="value2" stackId="a" fill="#a5b4fc" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Commission cumulée */}
          <ChartCard title="Commission cumulée" subtitle="Total gagné depuis le début, mois par mois">
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={data.cumulative} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="cumGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => `${(v / 100).toFixed(0)}€`}
                />
                <Tooltip
                  formatter={((value: number) => [`${(value / 100).toFixed(2)} €`, 'Cumulé']) as never}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#10b981"
                  strokeWidth={2}
                  fill="url(#cumGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Ligne 2 colonnes : signups + status donut */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            <ChartCard title="Nouveaux filleuls par mois" subtitle="Inscriptions via votre lien parrain" compact>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data.signups} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 11, fill: '#9ca3af' }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    formatter={((value: number) => [value, 'Nouveaux']) as never}
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                  />
                  <Bar dataKey="value" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard
              title="Répartition actuelle"
              subtitle="Statut de vos filleuls aujourd'hui"
              icon={<PieIcon className="w-4 h-4 text-gray-400" />}
              compact
            >
              {data.status.length === 0 ? (
                <div className="h-[220px] flex items-center justify-center">
                  <p className="text-sm text-gray-400">Aucun filleul pour le moment</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={data.status}
                      dataKey="value"
                      nameKey="label"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                    >
                      {data.status.map((slice, i) => (
                        <Cell key={i} fill={slice.color} stroke="white" strokeWidth={2} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={((value: number, name: string) => [value, name]) as never}
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                    />
                    <Legend
                      verticalAlign="bottom"
                      iconType="circle"
                      formatter={(value) => <span style={{ fontSize: 11, color: '#6b7280' }}>{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </div>

          {/* Top filleuls */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-500" />
              <h2 className="text-sm font-semibold text-gray-900">Top 5 de vos filleuls</h2>
            </div>
            {data.top.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-400">
                Aucune commission reçue pour l&apos;instant.
              </div>
            ) : (
              <ol className="divide-y divide-gray-50">
                {data.top.map((t, i) => (
                  <li key={t.providerId} className="px-5 py-3 flex items-center gap-3">
                    <span
                      className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold flex-shrink-0 ${
                        i === 0
                          ? 'bg-amber-100 text-amber-700'
                          : i === 1
                          ? 'bg-gray-100 text-gray-700'
                          : i === 2
                          ? 'bg-orange-100 text-orange-700'
                          : 'bg-gray-50 text-gray-500'
                      }`}
                    >
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900 font-medium truncate">{t.businessName}</p>
                      <p className="text-xs text-gray-400">
                        {t.paymentCount} paiement{t.paymentCount > 1 ? 's' : ''}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-emerald-600 flex-shrink-0">
                      {(t.commission / 100).toFixed(2)} €
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function CompareCard({
  title,
  icon,
  current,
  previous,
  delta,
}: {
  title: string;
  icon: React.ReactNode;
  current: string;
  previous: string;
  delta: { label: string; tone: 'up' | 'down' | 'flat' };
}) {
  const tone =
    delta.tone === 'up'
      ? 'text-emerald-600 bg-emerald-50 border-emerald-200'
      : delta.tone === 'down'
      ? 'text-red-600 bg-red-50 border-red-200'
      : 'text-gray-500 bg-gray-50 border-gray-200';
  const Icon = delta.tone === 'up' ? TrendingUp : delta.tone === 'down' ? TrendingDown : Minus;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5">
      <div className="flex items-center gap-2 text-gray-500 text-xs mb-2">
        {icon}
        <span>{title}</span>
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-2xl sm:text-3xl font-bold text-gray-900">{current}</p>
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${tone}`}>
          <Icon className="w-3 h-3" />
          {delta.label}
        </span>
      </div>
      <p className="text-xs text-gray-400 mt-1">{previous}</p>
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
  icon,
  compact,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  icon?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={`bg-white border border-gray-200 rounded-xl shadow-sm ${compact ? 'mb-0' : 'mb-4'}`}
    >
      <div className="px-5 pt-4 pb-2 flex items-start gap-2">
        {icon}
        <div className="flex-1">
          <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
          {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <div className="px-2 pb-3">{children}</div>
    </div>
  );
}
