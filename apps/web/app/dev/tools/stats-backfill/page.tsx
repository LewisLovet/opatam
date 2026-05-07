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
import { getFunctions, httpsCallable } from 'firebase/functions';
import {
  app,
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
  type ProviderClient,
  type ProviderStatsDaily,
  type ProviderStatsMonthly,
  type ProviderStatsRolling,
  type ProviderStatsServiceBreakdown,
} from '@booking-app/shared';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { Calculator, CheckCircle2, Database, Loader2, RefreshCw, ShieldAlert, Trash2, Upload } from 'lucide-react';

/**
 * Dev-tool dark card. We don't reuse the global `<Card>` here
 * because that one ships with a white background designed for the
 * provider/admin areas — would be illegible on /dev's dark theme.
 */
function DevSection({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl bg-slate-900 border border-slate-800 p-5 sm:p-6">
      <header className="mb-5 pb-4 border-b border-slate-800/70">
        <h2 className="text-base font-semibold text-white">{title}</h2>
        {subtitle && (
          <p className="mt-1 text-xs text-slate-400">{subtitle}</p>
        )}
      </header>
      <div>{children}</div>
    </section>
  );
}

type WithId<T> = { id: string } & T;

interface DryRunResult {
  provider: WithId<Provider>;
  members: WithId<Member>[];
  bookings: WithId<Booking>[];
  daily: ProviderStatsDaily[];
  monthly: ProviderStatsMonthly[];
  rolling: ProviderStatsRolling;
  clients: ProviderClient[];
  ranAt: Date;
}

interface BackfillResponse {
  providerId: string;
  ranAt: string;
  performedWrites: boolean;
  counts: {
    bookingsScanned: number;
    daily: number;
    monthly: number;
    clients: number;
    rolling: 1;
  };
  totalRevenue: number;
  firstDate: string | null;
  lastDate: string | null;
}

export default function StatsBackfillDryRunPage() {
  const [providerId, setProviderId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DryRunResult | null>(null);

  // Live backfill state — separate from the dry-run so the user can
  // re-run the backfill without losing the dry-run preview.
  const [backfilling, setBackfilling] = useState(false);
  const [backfillResult, setBackfillResult] = useState<BackfillResponse | null>(null);
  const [backfillError, setBackfillError] = useState<string | null>(null);

  // Global ops state — backfill ALL providers + purge.
  const [globalRunning, setGlobalRunning] = useState<'backfill' | 'purge' | null>(null);
  const [globalResult, setGlobalResult] = useState<string | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [publishedOnly, setPublishedOnly] = useState(true);

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
        membersById[m.id] = { name: m.name };
      }

      const { daily, monthly, rolling, clients } = aggregateFullPipeline(
        bookings,
        {
          providerId: id,
          providerName: provider.businessName,
          membersById,
          // No registeredUsers map at dry-run time — the trigger
          // and backfill enrich from the users collection on the
          // server side. The dry-run uses the booking's denormalised
          // clientInfo, which is good enough to validate logic.
        },
      );

      setResult({
        provider,
        members,
        bookings,
        daily,
        monthly,
        rolling,
        clients,
        ranAt: new Date(),
      });
    } catch (err) {
      console.error('[stats-backfill dry-run]', err);
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  };

  /** Backfill ALL providers in one shot — confirmation required. */
  const runBackfillAll = async () => {
    if (confirmText !== 'BACKFILL_ALL') return;
    setGlobalRunning('backfill');
    setGlobalError(null);
    setGlobalResult(null);
    try {
      const fn = httpsCallable<
        { publishedOnly: boolean },
        {
          ranAt: string;
          totalDurationMs: number;
          totalProviders: number;
          successes: number;
          failures: number;
          results: { providerId: string; ok: boolean; error?: string }[];
        }
      >(getFunctions(app, 'europe-west1'), 'backfillAllProviderStats');
      const r = await fn({ publishedOnly });
      const failedIds = r.data.results
        .filter((x) => !x.ok)
        .map((x) => `${x.providerId} (${x.error ?? 'unknown'})`)
        .slice(0, 10);
      setGlobalResult(
        `✅ ${r.data.successes}/${r.data.totalProviders} providers en ${(r.data.totalDurationMs / 1000).toFixed(1)}s.${
          r.data.failures > 0
            ? `\n❌ ${r.data.failures} échec(s) :\n  - ${failedIds.join('\n  - ')}`
            : ''
        }`,
      );
      setConfirmText('');
    } catch (err) {
      setGlobalError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setGlobalRunning(null);
    }
  };

  /** Purge ALL stats — confirmation required. */
  const runPurgeAll = async () => {
    if (confirmText !== 'PURGE_ALL_STATS') return;
    setGlobalRunning('purge');
    setGlobalError(null);
    setGlobalResult(null);
    try {
      const fn = httpsCallable<
        { allProviders: boolean; confirm: string },
        {
          ranAt: string;
          scope: string;
          providersAffected: number;
          totals: { daily: number; monthly: number; rolling: number; clients: number };
        }
      >(getFunctions(app, 'europe-west1'), 'purgeProviderStats');
      const r = await fn({ allProviders: true, confirm: 'PURGE_ALL_STATS' });
      setGlobalResult(
        `🗑️ Purge OK sur ${r.data.providersAffected} providers : ${r.data.totals.daily} daily, ${r.data.totals.monthly} monthly, ${r.data.totals.rolling} rolling, ${r.data.totals.clients} clients.`,
      );
      setConfirmText('');
    } catch (err) {
      setGlobalError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setGlobalRunning(null);
    }
  };

  /** Purge a single provider. */
  const runPurgeOne = async () => {
    if (!result) return;
    const id = result.provider.id;
    if (!window.confirm(
      `🗑️ Purger les stats du provider "${result.provider.businessName}" ?\nSupprime ses providerStats* + providerClients (les notes/preferences seront perdues). Réversible en relançant le backfill.`,
    )) return;
    setGlobalRunning('purge');
    setGlobalError(null);
    setGlobalResult(null);
    try {
      const fn = httpsCallable<
        { providerId: string },
        { providersAffected: number; totals: { daily: number; monthly: number; rolling: number; clients: number } }
      >(getFunctions(app, 'europe-west1'), 'purgeProviderStats');
      const r = await fn({ providerId: id });
      setGlobalResult(
        `🗑️ Purge OK pour ${result.provider.businessName} : ${r.data.totals.daily} daily, ${r.data.totals.monthly} monthly, ${r.data.totals.rolling} rolling, ${r.data.totals.clients} clients.`,
      );
    } catch (err) {
      setGlobalError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setGlobalRunning(null);
    }
  };

  const runBackfill = async () => {
    if (!result) return;
    const id = result.provider.id;
    const ok = window.confirm(
      `⚠️ Backfill PROD\n\nÉcrire ${result.daily.length} daily + ${result.monthly.length} monthly + 1 rolling + ${result.clients.length} clients pour "${result.provider.businessName}" ?\n\nÉcrase les docs providerStats* + providerClients existants pour ce provider. Préserve les champs user-éditables (notes, preferences). Idempotent. Ne touche pas à bookings/users/providers.`,
    );
    if (!ok) return;
    setBackfilling(true);
    setBackfillError(null);
    setBackfillResult(null);
    try {
      const fn = httpsCallable<
        { providerId: string; performWrites: boolean },
        BackfillResponse
      >(getFunctions(app, 'europe-west1'), 'runProviderStatsBackfill');
      const response = await fn({ providerId: id, performWrites: true });
      setBackfillResult(response.data);
    } catch (err) {
      console.error('[stats-backfill prod]', err);
      setBackfillError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setBackfilling(false);
    }
  };

  return (
    // `dark` class enables Tailwind dark: variants on shared UI
    // components (Tabs, etc.) so they read against the slate-950
    // page background instead of fighting it with light defaults.
    <div className="dark p-6 lg:p-8 bg-slate-950 min-h-screen text-slate-100">
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
        <DevSection title="1. Cible">
          <div className="flex flex-col sm:flex-row gap-3 items-end">
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Provider ID (Firestore document id de la collection providers)
              </label>
              <Input
                value={providerId}
                onChange={(e) => setProviderId(e.target.value)}
                placeholder="ex: rNh3xKmQ8YzVf5pL2tWa"
                className="bg-slate-950 border-slate-700 text-slate-100 placeholder:text-slate-500"
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
        </DevSection>

        {/* Result */}
        {result && (
          <>
            <DryRunReport result={result} />

            {/* Live backfill section — appears once a dry-run is
                available so the user has eyeballed the numbers
                before pressing the "write to prod" button. */}
            <DevSection
              title="3. Backfill prod"
              subtitle="Écrit les docs providerStats* + providerClients en Firestore via la callable runProviderStatsBackfill (Admin SDK). Idempotent."
            >
              <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                <Button
                  onClick={runBackfill}
                  disabled={backfilling}
                  className="!bg-red-600 hover:!bg-red-500 !text-white !border-transparent"
                >
                  {backfilling ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Écriture en cours…
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Backfill PROD pour ce provider
                    </>
                  )}
                </Button>
                <p className="text-xs text-slate-400">
                  Confirmation requise. Écrase les docs existants.
                </p>
              </div>

              {backfillError && (
                <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm flex items-start gap-2">
                  <ShieldAlert className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{backfillError}</span>
                </div>
              )}

              {backfillResult && (
                <div className="mt-4 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 text-sm">
                  <div className="flex items-center gap-2 font-semibold mb-2">
                    <CheckCircle2 className="w-4 h-4" />
                    Backfill exécuté à {new Date(backfillResult.ranAt).toLocaleTimeString('fr-FR')}
                  </div>
                  <ul className="space-y-1 text-xs">
                    <li>• {backfillResult.counts.bookingsScanned} bookings scannés</li>
                    <li>• {backfillResult.counts.daily} docs providerStatsDaily écrits</li>
                    <li>• {backfillResult.counts.monthly} docs providerStatsMonthly écrits</li>
                    <li>• {backfillResult.counts.rolling} doc providerStatsRolling écrit</li>
                    <li>• {backfillResult.counts.clients} docs providerClients écrits</li>
                    <li>• Période : {backfillResult.firstDate ?? '—'} → {backfillResult.lastDate ?? '—'}</li>
                  </ul>
                </div>
              )}
              {/* Per-provider purge — undo a single backfill */}
              <div className="mt-4 pt-4 border-t border-slate-800">
                <Button
                  onClick={runPurgeOne}
                  disabled={globalRunning !== null}
                  className="!bg-slate-800 hover:!bg-slate-700 !text-slate-200 !border !border-slate-700"
                >
                  {globalRunning === 'purge' ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Purge…
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4 mr-2" />
                      Purger les stats de ce provider
                    </>
                  )}
                </Button>
                <p className="mt-2 text-xs text-slate-500">
                  Supprime providerStats* + providerClients pour ce provider. Réversible en relançant le backfill.
                </p>
              </div>
            </DevSection>
          </>
        )}

        {/* ── Section 4 - Global ops (always visible) ─────────── */}
        <DevSection
          title="4. Opérations globales"
          subtitle="Pour le rollout initial Phase 1B et les rollbacks. Confirmation typée requise."
        >
          <div className="space-y-4">
            {/* Confirmation input — gates both buttons below */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                Tape la phrase de confirmation pour activer les boutons (
                <code className="text-amber-300">BACKFILL_ALL</code> ou{' '}
                <code className="text-red-300">PURGE_ALL_STATS</code>)
              </label>
              <Input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="—"
                className="bg-slate-950 border-slate-700 text-slate-100 placeholder:text-slate-500 font-mono"
              />
            </div>

            {/* Backfill ALL */}
            <div className="rounded-lg border border-amber-700/40 bg-amber-500/5 p-4">
              <div className="flex items-start gap-3">
                <RefreshCw className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-amber-200">
                    Backfill ALL providers
                  </h3>
                  <p className="text-xs text-amber-200/70 mt-1">
                    Itère sur tous les providers et lance le backfill. Sequential (~2s/provider).
                    Confirmation typée : <code className="text-amber-100">BACKFILL_ALL</code>.
                  </p>
                  <label className="mt-3 flex items-center gap-2 text-xs text-amber-200/70">
                    <input
                      type="checkbox"
                      checked={publishedOnly}
                      onChange={(e) => setPublishedOnly(e.target.checked)}
                      className="rounded border-amber-500/40 bg-amber-500/10"
                    />
                    Seulement les providers publiés (<code>isPublished == true</code>)
                  </label>
                  <Button
                    onClick={runBackfillAll}
                    disabled={
                      globalRunning !== null || confirmText !== 'BACKFILL_ALL'
                    }
                    className="mt-3 !bg-amber-600 hover:!bg-amber-500 !text-white !border-transparent"
                  >
                    {globalRunning === 'backfill' ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        Backfill en cours…
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Lancer le backfill global
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>

            {/* Purge ALL */}
            <div className="rounded-lg border border-red-700/40 bg-red-500/5 p-4">
              <div className="flex items-start gap-3">
                <Trash2 className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-red-200">
                    Purge ALL stats
                  </h3>
                  <p className="text-xs text-red-200/70 mt-1">
                    Supprime TOUS les providerStats* + providerClients (notes/preferences inclus).
                    Réversible en relançant le backfill (sauf notes/preferences). Confirmation typée :{' '}
                    <code className="text-red-100">PURGE_ALL_STATS</code>.
                  </p>
                  <Button
                    onClick={runPurgeAll}
                    disabled={
                      globalRunning !== null || confirmText !== 'PURGE_ALL_STATS'
                    }
                    className="mt-3 !bg-red-600 hover:!bg-red-500 !text-white !border-transparent"
                  >
                    {globalRunning === 'purge' ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        Purge en cours…
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4 mr-2" />
                        Tout purger
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>

            {/* Result / error */}
            {globalError && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span className="whitespace-pre-line">{globalError}</span>
              </div>
            )}
            {globalResult && (
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 text-sm whitespace-pre-line">
                {globalResult}
              </div>
            )}
          </div>
        </DevSection>
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
    <DevSection
      title="2. Résultat"
      subtitle={`Calculé localement le ${result.ranAt.toLocaleString('fr-FR')} — aucune donnée écrite`}
    >
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
            <TabsTrigger value="clients">
              Clients ({result.clients.length})
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
          <TabsContent value="clients">
            <ClientsTable clients={result.clients} />
          </TabsContent>
          <TabsContent value="raw">
            <RawBookingsSample bookings={result.bookings} />
          </TabsContent>
        </Tabs>
    </DevSection>
  );
}

function SummaryTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg bg-slate-950 border border-slate-800 p-4">
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

function Heatmap90d({ data }: { data: number[] }) {
  // data is the flat 168-element array. Read as data[dow * 24 + hour].
  const max = Math.max(...data, 1);
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
            {Array.from({ length: 7 }, (_, dow) => (
              <tr key={dow}>
                <td className="text-slate-500 pr-2 text-right">{days[dow]}</td>
                {Array.from({ length: 24 }, (_, h) => {
                  const count = data[dow * 24 + h] ?? 0;
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

// ─── Clients tab ────────────────────────────────────────────────────

const TAG_STYLES: Record<string, string> = {
  new: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
  regular: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  vip: 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/30',
  at_risk: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  lost: 'bg-slate-600/30 text-slate-400 border-slate-600/40',
  noshow_prone: 'bg-red-500/20 text-red-300 border-red-500/30',
};

function ClientsTable({ clients }: { clients: ProviderClient[] }) {
  if (clients.length === 0) {
    return (
      <EmptyState label="Aucun client identifié (les bookings totalement anonymes — sans email ni clientId — sont écartés)." />
    );
  }
  // Sort by total revenue desc, ties broken by bookings count.
  const sorted = useMemo(
    () =>
      [...clients].sort(
        (a, b) =>
          b.totalRevenue - a.totalRevenue ||
          b.bookingsCount - a.bookingsCount,
      ),
    [clients],
  );
  const now = Date.now();
  return (
    <div className="overflow-x-auto">
      <p className="text-xs text-slate-500 mb-3">
        {clients.length} clients distincts agrégés depuis les bookings du provider.
        Triés par CA cumulé. Les tags sont calculés depuis les compteurs avec une
        date de référence = maintenant.
      </p>
      <table className="w-full text-sm">
        <thead className="text-xs uppercase tracking-wider text-slate-500 border-b border-slate-800">
          <tr>
            <Th>Nom</Th>
            <Th>Email / clé</Th>
            <Th right>RDV</Th>
            <Th right>Confirmés</Th>
            <Th right>No-show</Th>
            <Th right>CA cumulé</Th>
            <Th>Premier</Th>
            <Th>Dernier</Th>
            <Th right>Inactif (j)</Th>
            <Th>Tags</Th>
            <Th>Opt-in</Th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((c) => {
            const inactiveDays = Math.floor(
              (now - c.lastBookingAt.getTime()) / (24 * 60 * 60 * 1000),
            );
            return (
              <tr key={c.clientKey} className="border-b border-slate-800/60 hover:bg-slate-900/50">
                <Td className="font-medium text-white">{c.name || '—'}</Td>
                <Td className="text-slate-400 max-w-[220px] truncate">
                  {c.email ?? c.clientKey}
                </Td>
                <Td right>{c.bookingsCount}</Td>
                <Td right className="text-green-300">{c.confirmedCount}</Td>
                <Td right className={c.noshowCount > 0 ? 'text-red-300' : 'text-slate-500'}>
                  {c.noshowCount}
                </Td>
                <Td right className="font-semibold">{formatPrice(c.totalRevenue)}</Td>
                <Td mono className="text-xs">
                  {c.firstBookingAt.toISOString().slice(0, 10)}
                </Td>
                <Td mono className="text-xs">
                  {c.lastBookingAt.toISOString().slice(0, 10)}
                </Td>
                <Td right className={inactiveDays > 90 ? 'text-amber-400' : 'text-slate-400'}>
                  {inactiveDays}
                </Td>
                <Td>
                  <div className="flex flex-wrap gap-1">
                    {c.tags.length === 0 ? (
                      <span className="text-slate-600 text-xs">—</span>
                    ) : (
                      c.tags.map((t) => (
                        <span
                          key={t}
                          className={`inline-block px-1.5 py-0.5 rounded text-[10px] border ${
                            TAG_STYLES[t] ?? 'bg-slate-700/30 text-slate-300 border-slate-700'
                          }`}
                        >
                          {t}
                        </span>
                      ))
                    )}
                  </div>
                </Td>
                <Td>
                  {c.marketingOptIn ? (
                    <span className="text-emerald-400 text-xs">✓</span>
                  ) : (
                    <span className="text-slate-600 text-xs">—</span>
                  )}
                </Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
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
