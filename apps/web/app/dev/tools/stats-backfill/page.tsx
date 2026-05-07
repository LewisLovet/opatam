'use client';

/**
 * Dev tool — provider stats backfill DRY RUN.
 *
 * Phase 1A of the provider-stats project: read-only preview that
 * lets us validate the aggregation output before touching Firestore
 * with a real backfill.
 *
 * What it does:
 *  1. Fetches every booking for a given provider (live, indexed query)
 *  2. Fetches the current member roster (for name denormalization)
 *  3. Runs the SHARED `aggregateFullPipeline` from
 *     @booking-app/shared/utils/providerStats — exactly the same
 *     code that the production backfill / trigger / cron will use
 *  4. Renders the resulting Daily / Monthly / Rolling docs in tabs
 *     so we can eyeball the numbers
 *
 * What it DOES NOT do: any write to Firestore. Zero side effects.
 */

import { useMemo, useState } from 'react';
import {
  bookingRepository,
  memberService,
  providerRepository,
} from '@booking-app/firebase';
import {
  aggregateFullPipeline,
  formatPrice,
  type Booking,
  type Member,
  type Provider,
  type ProviderStatsDaily,
  type ProviderStatsMonthly,
  type ProviderStatsRolling,
  type ProviderStatsServiceBreakdown,
} from '@booking-app/shared';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { Calculator, Database, Loader2, ShieldAlert } from 'lucide-react';

type WithId<T> = { id: string } & T;

interface DryRunResult {
  provider: WithId<Provider>;
  members: WithId<Member>[];
  bookings: WithId<Booking>[];
  daily: ProviderStatsDaily[];
  monthly: ProviderStatsMonthly[];
  rolling: ProviderStatsRolling;
  ranAt: Date;
}

export default function StatsBackfillDryRunPage() {
  const [providerId, setProviderId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DryRunResult | null>(null);

  const runDryRun = async () => {
    const id = providerId.trim();
    if (!id) {
      setError('Provider ID requis');
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const [provider, members, bookings] = await Promise.all([
        providerRepository.getById(id),
        memberService.getByProvider(id),
        bookingRepository.getByProvider(id),
      ]);

      if (!provider) {
        throw new Error(`Provider ${id} introuvable`);
      }

      const membersById: Record<string, { name: string }> = {};
      for (const m of members) {
        membersById[m.id] = { name: m.displayName };
      }

      const { daily, monthly, rolling } = aggregateFullPipeline(
        bookings,
        {
          providerId: id,
          providerName: provider.businessName,
          membersById,
        },
      );

      setResult({
        provider,
        members,
        bookings,
        daily,
        monthly,
        rolling,
        ranAt: new Date(),
      });
    } catch (err) {
      console.error('[stats-backfill dry-run]', err);
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 lg:p-8 bg-slate-950 min-h-screen text-slate-100">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2 mb-3 text-purple-400/80 text-sm font-medium">
            <Calculator className="w-4 h-4" />
            Dev Tools / Provider stats
          </div>
          <h1 className="text-3xl font-bold">Stats backfill — Dry run</h1>
          <p className="text-slate-400 mt-2 max-w-3xl">
            Fetch tous les bookings d'un provider, lance le pipeline
            d'agrégation <code className="text-purple-300">@booking-app/shared/utils/providerStats</code>{' '}
            en mémoire, et affiche le résultat. <strong>Aucune écriture Firestore</strong> —
            c'est exactement les docs qui seront produits par le backfill prod, pour validation visuelle.
          </p>
        </div>

        {/* Input */}
        <Card>
          <CardHeader title="1. Cible" />
          <CardBody>
            <div className="flex flex-col sm:flex-row gap-3 items-end">
              <div className="flex-1">
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Provider ID (Firestore document id de la collection providers)
                </label>
                <Input
                  value={providerId}
                  onChange={(e) => setProviderId(e.target.value)}
                  placeholder="ex: rNh3xKmQ8YzVf5pL2tWa"
                />
              </div>
              <Button
                onClick={runDryRun}
                disabled={loading || !providerId.trim()}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Calcul…
                  </>
                ) : (
                  'Lancer le dry-run'
                )}
              </Button>
            </div>
            {error && (
              <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </CardBody>
        </Card>

        {/* Result */}
        {result && <DryRunReport result={result} />}
      </div>
    </div>
  );
}

// ─── Report (the big tabbed display) ─────────────────────────────────

function DryRunReport({ result }: { result: DryRunResult }) {
  const totalBookings = result.bookings.length;
  const totalConfirmed = result.bookings.filter((b) => b.status === 'confirmed').length;
  const totalRevenueAll = result.daily.reduce((s, d) => s + d.revenue, 0);
  const firstDate = result.daily[0]?.date ?? '—';
  const lastDate = result.daily[result.daily.length - 1]?.date ?? '—';

  return (
    <Card>
      <CardHeader
        title="2. Résultat"
        subtitle={`Calculé localement le ${result.ranAt.toLocaleString('fr-FR')} — aucune donnée écrite`}
      />
      <CardBody>
        {/* Summary strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <SummaryTile
            label="Provider"
            value={result.provider.businessName}
            sub={result.provider.id}
          />
          <SummaryTile
            label="Bookings (toutes statuts)"
            value={totalBookings.toString()}
            sub={`dont ${totalConfirmed} confirmés`}
          />
          <SummaryTile
            label="CA total agrégé"
            value={formatPrice(totalRevenueAll)}
            sub="∑ revenue.daily (confirmés)"
          />
          <SummaryTile
            label="Période couverte"
            value={result.daily.length === 0 ? '—' : `${result.daily.length} jours`}
            sub={result.daily.length === 0 ? 'aucun jour' : `${firstDate} → ${lastDate}`}
          />
        </div>

        <Tabs defaultValue="daily">
          <TabsList>
            <TabsTrigger value="daily">
              Daily ({result.daily.length})
            </TabsTrigger>
            <TabsTrigger value="monthly">
              Monthly ({result.monthly.length})
            </TabsTrigger>
            <TabsTrigger value="rolling">
              Rolling
            </TabsTrigger>
            <TabsTrigger value="raw">
              Bookings bruts ({result.bookings.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="daily">
            <DailyTable daily={result.daily} />
          </TabsContent>
          <TabsContent value="monthly">
            <MonthlyTable monthly={result.monthly} />
          </TabsContent>
          <TabsContent value="rolling">
            <RollingPanel rolling={result.rolling} />
          </TabsContent>
          <TabsContent value="raw">
            <RawBookingsSample bookings={result.bookings} />
          </TabsContent>
        </Tabs>
      </CardBody>
    </Card>
  );
}

function SummaryTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg bg-slate-900 border border-slate-800 p-4">
      <div className="text-[11px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-1 text-lg font-semibold text-white truncate">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-slate-400 truncate">{sub}</div>}
    </div>
  );
}

// ─── Daily tab ──────────────────────────────────────────────────────

function DailyTable({ daily }: { daily: ProviderStatsDaily[] }) {
  // Most recent first — that's how we'd typically scan them.
  const sorted = useMemo(() => [...daily].reverse(), [daily]);
  if (sorted.length === 0) {
    return <EmptyState label="Aucun jour avec des bookings." />;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-xs uppercase tracking-wider text-slate-500 border-b border-slate-800">
          <tr>
            <Th>Date</Th>
            <Th right>Total</Th>
            <Th right>Confirmés</Th>
            <Th right>Pending</Th>
            <Th right>Cancelled</Th>
            <Th right>No-show</Th>
            <Th right>CA</Th>
            <Th right>Clients uniques</Th>
            <Th right>Nouveaux clients</Th>
            <Th>Top service ce jour</Th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((d) => {
            const topService = [...d.services].sort((a, b) => b.revenue - a.revenue)[0];
            return (
              <tr key={d.date} className="border-b border-slate-800/60 hover:bg-slate-900/50">
                <Td mono>{d.date}</Td>
                <Td right>{d.bookingsCount}</Td>
                <Td right className="text-green-300">{d.confirmedCount}</Td>
                <Td right className="text-amber-300">{d.pendingCount + d.pendingPaymentCount}</Td>
                <Td right className="text-slate-500">{d.cancelledCount}</Td>
                <Td right className="text-slate-500">{d.noshowCount}</Td>
                <Td right className="font-semibold">{formatPrice(d.revenue)}</Td>
                <Td right>{d.clientHashes.length}</Td>
                <Td right className="text-emerald-300">+{d.newClientHashes.length}</Td>
                <Td className="text-slate-300">
                  {topService ? `${topService.serviceName} (${formatPrice(topService.revenue)})` : '—'}
                </Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Monthly tab ────────────────────────────────────────────────────

function MonthlyTable({ monthly }: { monthly: ProviderStatsMonthly[] }) {
  const sorted = useMemo(() => [...monthly].reverse(), [monthly]);
  if (sorted.length === 0) {
    return <EmptyState label="Aucun mois avec des bookings." />;
  }
  // Visual scale for the bar chart inline in the table.
  const maxRevenue = Math.max(...monthly.map((m) => m.revenue), 1);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-xs uppercase tracking-wider text-slate-500 border-b border-slate-800">
          <tr>
            <Th>Mois</Th>
            <Th right>Bookings</Th>
            <Th right>Confirmés</Th>
            <Th right>CA</Th>
            <Th right>Clients</Th>
            <Th right>+Nouveaux</Th>
            <Th>Trend visuel</Th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((m) => (
            <tr key={m.month} className="border-b border-slate-800/60 hover:bg-slate-900/50">
              <Td mono>{m.month}</Td>
              <Td right>{m.bookingsCount}</Td>
              <Td right className="text-green-300">{m.confirmedCount}</Td>
              <Td right className="font-semibold">{formatPrice(m.revenue)}</Td>
              <Td right>{m.clientHashes.length}</Td>
              <Td right className="text-emerald-300">+{m.newClientHashes.length}</Td>
              <Td>
                <div className="h-3 w-32 bg-slate-800 rounded overflow-hidden">
                  <div
                    className="h-full bg-purple-500"
                    style={{ width: `${(m.revenue / maxRevenue) * 100}%` }}
                  />
                </div>
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Rolling tab ────────────────────────────────────────────────────

function RollingPanel({ rolling }: { rolling: ProviderStatsRolling }) {
  return (
    <div className="space-y-8">
      <RollingTopServices title="Top services 30j" data={rolling.topServices30d} />
      <RollingTopServices title="Top services 90j" data={rolling.topServices90d} />
      <RollingTopServices title="Top services all-time" data={rolling.topServicesAllTime} />

      <RollingTopClients title="Top clients 30j" data={rolling.topClients30d} />
      <RollingTopClients title="Top clients 90j" data={rolling.topClients90d} />
      <RollingTopClients title="Top clients all-time" data={rolling.topClientsAllTime} />

      <Heatmap90d data={rolling.heatmap90d} />
    </div>
  );
}

function RollingTopServices({
  title,
  data,
}: {
  title: string;
  data: ProviderStatsServiceBreakdown[];
}) {
  return (
    <section>
      <h3 className="text-sm font-semibold text-slate-200 mb-3">{title}</h3>
      {data.length === 0 ? (
        <EmptyState label="Aucune donnée sur cette fenêtre." />
      ) : (
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-wider text-slate-500 border-b border-slate-800">
            <tr>
              <Th>#</Th>
              <Th>Service</Th>
              <Th right>Bookings</Th>
              <Th right>Confirmés</Th>
              <Th right>CA</Th>
            </tr>
          </thead>
          <tbody>
            {data.map((s, i) => (
              <tr key={s.serviceId} className="border-b border-slate-800/60">
                <Td mono className="text-slate-500">{i + 1}</Td>
                <Td>{s.serviceName}</Td>
                <Td right>{s.bookingsCount}</Td>
                <Td right className="text-green-300">{s.confirmedCount}</Td>
                <Td right className="font-semibold">{formatPrice(s.revenue)}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function RollingTopClients({
  title,
  data,
}: {
  title: string;
  data: { clientHash: string; bookingsCount: number; revenue: number }[];
}) {
  return (
    <section>
      <h3 className="text-sm font-semibold text-slate-200 mb-3">{title}</h3>
      {data.length === 0 ? (
        <EmptyState label="Aucune donnée sur cette fenêtre." />
      ) : (
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-wider text-slate-500 border-b border-slate-800">
            <tr>
              <Th>#</Th>
              <Th>Client (clé)</Th>
              <Th right>RDV</Th>
              <Th right>CA cumulé</Th>
            </tr>
          </thead>
          <tbody>
            {data.map((c, i) => (
              <tr key={c.clientHash} className="border-b border-slate-800/60">
                <Td mono className="text-slate-500">{i + 1}</Td>
                <Td mono className="text-xs text-slate-300">{c.clientHash}</Td>
                <Td right>{c.bookingsCount}</Td>
                <Td right className="font-semibold">{formatPrice(c.revenue)}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function Heatmap90d({ data }: { data: number[][] }) {
  const max = Math.max(...data.flat(), 1);
  const days = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
  return (
    <section>
      <h3 className="text-sm font-semibold text-slate-200 mb-3">Heatmap jour×heure (90j)</h3>
      <div className="overflow-x-auto">
        <table className="text-[10px]">
          <thead>
            <tr>
              <th className="w-10" />
              {Array.from({ length: 24 }, (_, h) => (
                <th key={h} className="w-5 h-5 text-slate-500">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, dow) => (
              <tr key={dow}>
                <td className="text-slate-500 pr-2 text-right">{days[dow]}</td>
                {row.map((count, h) => {
                  const intensity = count / max;
                  return (
                    <td
                      key={h}
                      title={`${days[dow]} ${h}h — ${count} booking${count !== 1 ? 's' : ''}`}
                      className="w-5 h-5"
                      style={{
                        background:
                          count === 0
                            ? 'rgb(15, 23, 42)'
                            : `rgba(168, 85, 247, ${0.15 + intensity * 0.85})`,
                      }}
                    />
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ─── Raw bookings sample ────────────────────────────────────────────

function RawBookingsSample({ bookings }: { bookings: WithId<Booking>[] }) {
  // Show a sample so the user can sanity-check the input the
  // aggregation walked over. Capped at 50 most recent.
  const sample = useMemo(
    () => [...bookings].sort((a, b) => b.datetime.getTime() - a.datetime.getTime()).slice(0, 50),
    [bookings],
  );
  if (sample.length === 0) {
    return <EmptyState label="Ce provider n'a aucun booking." />;
  }
  return (
    <div className="overflow-x-auto">
      <p className="text-xs text-slate-500 mb-3">
        50 derniers bookings (sur {bookings.length} total) — sanity check de l'input.
      </p>
      <table className="w-full text-xs">
        <thead className="text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-800">
          <tr>
            <Th>Datetime</Th>
            <Th>Service</Th>
            <Th>Client</Th>
            <Th>Statut</Th>
            <Th right>Prix</Th>
            <Th>Member</Th>
          </tr>
        </thead>
        <tbody>
          {sample.map((b) => (
            <tr key={b.id} className="border-b border-slate-800/60">
              <Td mono>{b.datetime.toISOString().slice(0, 16).replace('T', ' ')}</Td>
              <Td>{b.serviceName}</Td>
              <Td className="text-slate-400">{b.clientInfo?.email ?? '—'}</Td>
              <Td>
                <span
                  className={`inline-block px-1.5 py-0.5 rounded text-[10px] ${
                    b.status === 'confirmed'
                      ? 'bg-green-500/15 text-green-300'
                      : b.status === 'cancelled'
                        ? 'bg-red-500/15 text-red-300'
                        : b.status === 'noshow'
                          ? 'bg-orange-500/15 text-orange-300'
                          : 'bg-slate-700/30 text-slate-300'
                  }`}
                >
                  {b.status}
                </span>
              </Td>
              <Td right>{formatPrice(b.price)}</Td>
              <Td className="text-slate-400">{b.memberName ?? '—'}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Generic table cells / empty state ──────────────────────────────

function Th({
  children,
  right = false,
}: {
  children: React.ReactNode;
  right?: boolean;
}) {
  return (
    <th
      className={`py-2 px-2 font-medium ${right ? 'text-right' : 'text-left'}`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  right = false,
  mono = false,
  className = '',
}: {
  children: React.ReactNode;
  right?: boolean;
  mono?: boolean;
  className?: string;
}) {
  return (
    <td
      className={`py-2 px-2 ${right ? 'text-right' : ''} ${mono ? 'font-mono' : ''} ${className}`}
    >
      {children}
    </td>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-800 p-6 text-center text-sm text-slate-500 flex flex-col items-center gap-2">
      <Database className="w-6 h-6 text-slate-700" />
      {label}
    </div>
  );
}
