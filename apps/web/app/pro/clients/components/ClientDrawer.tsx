'use client';

/**
 * Right-side slide-in drawer with the full fiche client.
 *
 * Sections (top to bottom):
 *   1. Header — avatar + name + email/phone + tags + close button
 *   2. KPIs grid — bookings, CA, taux confirmation, dates
 *   3. Notes privées — textarea, save on blur or via the save button
 *   4. Préférences — key/value list, add / edit / remove rows
 *   5. Marketing opt-in indicator (read-only)
 *   6. Historique RDV — lazy-loaded list (ClientHistoryList)
 *   7. Footer — "Nouveau RDV" CTA pre-filling the calendar create flow
 *
 * Notes & preferences are persisted via providerClientRepository,
 * which is allowed to PATCH only those two fields per the
 * Firestore rule (everything else is owned by the trigger / cron).
 *
 * The drawer takes the full viewport on mobile (better than the
 * centered Modal which clips on small screens) and slides from
 * the right at >= sm.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  X,
  Mail,
  Phone,
  Save,
  Plus,
  Trash2,
  CalendarPlus,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { Avatar, Badge, Button, useToast } from '@/components/ui';
import type { BadgeVariant } from '@/components/ui';
import {
  bookingRepository,
  providerClientRepository,
} from '@booking-app/firebase';
import {
  type ProviderClient,
  type ProviderClientTag,
  type Booking,
} from '@booking-app/shared';
import { ClientHistoryList } from './ClientHistoryList';
import { formatRevenue } from './format';

type WithId<T> = { id: string } & T;

interface Props {
  isOpen: boolean;
  client: WithId<ProviderClient> | null;
  providerId: string;
  onClose: () => void;
  /** Called after a successful save so the parent can update its
   *  in-memory list and re-sort if needed. */
  onPatched: (patch: Partial<ProviderClient>) => void;
  /** Open an existing booking from the history list. */
  onBookingClick?: (booking: WithId<Booking>) => void;
}

const TAG_LABELS: Record<ProviderClientTag, string> = {
  new: 'Nouveau',
  regular: 'Habitué',
  vip: 'VIP',
  at_risk: 'À risque',
  lost: 'Perdu',
  noshow_prone: 'Absent fréquent',
};

const TAG_VARIANTS: Record<ProviderClientTag, BadgeVariant> = {
  new: 'info',
  regular: 'success',
  vip: 'success',
  at_risk: 'warning',
  lost: 'error',
  noshow_prone: 'warning',
};

export function ClientDrawer({
  isOpen,
  client,
  providerId,
  onClose,
  onPatched,
  onBookingClick,
}: Props) {
  const router = useRouter();
  const toast = useToast();

  // Local edit state — initialised from `client` whenever the drawer
  // opens for a different doc.
  const [notes, setNotes] = useState('');
  const [prefs, setPrefs] = useState<Array<{ key: string; value: string }>>([]);
  const [saving, setSaving] = useState(false);
  // Captures the initial values so we can detect "is dirty" without
  // comparing on every keystroke.
  const baselineRef = useRef<{ notes: string; prefs: string }>({
    notes: '',
    prefs: '[]',
  });

  // Booking history — fetched here so we can derive both the list
  // AND the "services préférés" / "fréquence" cards from a single
  // query. Re-fetched whenever the drawer opens for a new client.
  const [bookings, setBookings] = useState<WithId<Booking>[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);

  useEffect(() => {
    if (!client) return;
    let cancelled = false;
    setHistoryLoading(true);
    setHistoryError(null);

    (async () => {
      try {
        // Pull whichever index is available — clientId for registered
        // users (more stable, survives email changes), email for
        // anonymous bookers. Then scope to this provider since the
        // repo methods don't filter by providerId.
        let raw: WithId<Booking>[] = [];
        if (client.clientId) {
          raw = await bookingRepository.getByClient(client.clientId);
        } else if (client.email) {
          raw = await bookingRepository.getByClientEmail(client.email);
        }
        const scoped = raw.filter((b) => b.providerId === providerId);
        if (!cancelled) setBookings(scoped);
      } catch (err) {
        console.error('[ClientDrawer] history error:', err);
        if (!cancelled) setHistoryError("Impossible de charger l'historique");
      } finally {
        if (!cancelled) setHistoryLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [client?.id, providerId]);

  // Re-sync local state when the drawer opens for a new client.
  useEffect(() => {
    if (!client) return;
    const initialNotes = client.notes ?? '';
    const initialPrefs = client.preferences
      ? Object.entries(client.preferences).map(([key, value]) => ({ key, value }))
      : [];
    setNotes(initialNotes);
    setPrefs(initialPrefs);
    baselineRef.current = {
      notes: initialNotes,
      prefs: JSON.stringify(initialPrefs),
    };
  }, [client?.id]);

  // Lock body scroll while open — same trick the Modal uses.
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isOpen]);

  // Esc to close.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const isDirty = useMemo(() => {
    return (
      notes !== baselineRef.current.notes ||
      JSON.stringify(prefs) !== baselineRef.current.prefs
    );
  }, [notes, prefs]);

  // ── Visit frequency — average gap between confirmed visits.
  //    Derived from the denormalised counters + dates so it's
  //    available even before the booking history finishes loading
  //    (faster first-paint).
  const frequencyLabel = useMemo(
    () => (client ? computeFrequency(client) : null),
    [client?.confirmedCount, client?.firstBookingAt, client?.lastBookingAt],
  );

  // ── Top services — derived from the booking history. Cancelled
  //    bookings are dropped so a serial-canceller doesn't pollute the
  //    "préférés" picture.
  const topServices = useMemo(
    () => computeTopServices(bookings),
    [bookings],
  );

  if (!isOpen || !client) return null;

  // ── Save handler ────────────────────────────────────────────────
  const handleSave = async () => {
    if (!isDirty) return;
    setSaving(true);
    try {
      // Strip empty key entries so we don't persist garbage rows.
      const prefMap = prefs.reduce<Record<string, string>>((acc, p) => {
        const k = p.key.trim();
        if (k) acc[k] = p.value;
        return acc;
      }, {});
      const trimmedNotes = notes.trim();
      await providerClientRepository.updateNotes(providerId, client.clientKey, {
        notes: trimmedNotes ? trimmedNotes : null,
        preferences: Object.keys(prefMap).length > 0 ? prefMap : null,
      });
      onPatched({
        notes: trimmedNotes ? trimmedNotes : null,
        preferences: Object.keys(prefMap).length > 0 ? prefMap : null,
      });
      baselineRef.current = {
        notes,
        prefs: JSON.stringify(prefs),
      };
      toast.success('Modifications enregistrées');
    } catch (err) {
      console.error('[ClientDrawer] save error:', err);
      toast.error("Échec de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  // ── Pré-rempli "Nouveau RDV" → calendar ─────────────────────────
  const handleCreateBooking = () => {
    const params = new URLSearchParams({ action: 'createBooking' });
    if (client.name) params.set('clientName', client.name);
    if (client.email) params.set('clientEmail', client.email);
    if (client.phone) params.set('clientPhone', client.phone);
    router.push(`/pro/calendrier?${params.toString()}`);
  };

  // ── Derived KPI values ──────────────────────────────────────────
  const confirmRate =
    client.bookingsCount > 0
      ? Math.round((client.confirmedCount / client.bookingsCount) * 100)
      : null;

  const fullName = client.name || 'Client sans nom';

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <aside className="relative z-10 h-full w-full sm:max-w-xl bg-white dark:bg-gray-900 shadow-xl flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700 flex items-start gap-3">
          <Avatar
            src={client.photoURL}
            alt={fullName}
            size="lg"
            className="flex-shrink-0"
          />
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
              {fullName}
            </h2>
            <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
              {client.email && (
                <span className="inline-flex items-center gap-1 truncate">
                  <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate">{client.email}</span>
                </span>
              )}
              {client.phone && (
                <span className="inline-flex items-center gap-1 truncate">
                  <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate">{client.phone}</span>
                </span>
              )}
            </div>
            {client.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {client.tags.map((tag) => (
                  <Badge key={tag} variant={TAG_VARIANTS[tag]} size="sm">
                    {TAG_LABELS[tag]}
                  </Badge>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
          {/* KPIs */}
          <section>
            <h3 className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 font-semibold mb-3">
              Vue d'ensemble
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Kpi label="Réservations" value={client.bookingsCount.toString()} />
              <Kpi label="CA cumulé" value={formatRevenue(client.totalRevenue)} />
              <Kpi
                label="Confirmation"
                value={confirmRate != null ? `${confirmRate}%` : '—'}
              />
              <Kpi
                label="No-show"
                value={
                  client.bookingsCount > 0
                    ? `${Math.round((client.noshowCount / client.bookingsCount) * 100)}%`
                    : '—'
                }
              />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3">
              <Kpi
                label="Première visite"
                value={formatLongDate(client.firstBookingAt)}
              />
              <Kpi
                label="Dernière visite"
                value={formatLongDate(client.lastBookingAt)}
              />
              <Kpi label="Fréquence" value={frequencyLabel ?? '—'} />
            </div>
          </section>

          {/* Services préférés — top 3 booked services for this client.
              Hidden until the history finishes loading so we don't
              flash an empty state on first open. */}
          <section>
            <h3 className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 font-semibold mb-3">
              Services préférés
            </h3>
            {historyLoading ? (
              <p className="text-sm text-gray-400 dark:text-gray-500">
                Calcul en cours…
              </p>
            ) : topServices.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500">
                Pas encore assez de données pour identifier des préférences.
              </p>
            ) : (
              <ul className="space-y-2">
                {topServices.map((s, i) => (
                  <li
                    key={s.name}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
                  >
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400">
                      {i === 0 ? <Sparkles className="w-3.5 h-3.5" /> : (
                        <span className="text-[11px] font-mono">{i + 1}</span>
                      )}
                    </span>
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate flex-1 min-w-0">
                      {s.name}
                    </p>
                    <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums flex-shrink-0">
                      {s.count} fois
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Notes */}
          <section>
            <h3 className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 font-semibold mb-2">
              Notes privées
            </h3>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="Allergies, préférences de coupe, anniversaire…"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
            />
            <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">
              Ces notes sont privées — visibles seulement par votre équipe.
            </p>
          </section>

          {/* Preferences */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 font-semibold">
                Préférences
              </h3>
              <button
                type="button"
                onClick={() =>
                  setPrefs((p) => [...p, { key: '', value: '' }])
                }
                className="inline-flex items-center gap-1 text-xs font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700"
              >
                <Plus className="w-3.5 h-3.5" />
                Ajouter
              </button>
            </div>
            {prefs.length === 0 ? (
              <p className="text-xs text-gray-400 dark:text-gray-500">
                Aucune préférence enregistrée. Cliquez sur « Ajouter » pour
                noter par exemple un coiffeur préféré ou un produit habituel.
              </p>
            ) : (
              <ul className="space-y-2">
                {prefs.map((p, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <input
                      type="text"
                      value={p.key}
                      onChange={(e) =>
                        setPrefs((arr) => {
                          const next = [...arr];
                          next[i] = { ...next[i], key: e.target.value };
                          return next;
                        })
                      }
                      placeholder="Clé (ex. coiffeur)"
                      className="w-1/3 px-2.5 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    />
                    <input
                      type="text"
                      value={p.value}
                      onChange={(e) =>
                        setPrefs((arr) => {
                          const next = [...arr];
                          next[i] = { ...next[i], value: e.target.value };
                          return next;
                        })
                      }
                      placeholder="Valeur (ex. Alex)"
                      className="flex-1 px-2.5 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setPrefs((arr) => arr.filter((_, idx) => idx !== i))
                      }
                      className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                      aria-label="Supprimer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Marketing — placeholder while the campaign features are
              still in development. We track the consent state under
              the hood (RGPD opt-in is captured at booking time and
              stored on the client doc) so the day we ship newsletters
              / promo SMS this section will surface that status; for
              now it's intentionally non-actionable. */}
          <section className="rounded-lg border border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50 px-3 py-2.5 flex items-center gap-3">
            <ShieldAlert className="w-5 h-5 text-gray-400 dark:text-gray-500 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                Fonctionnalités marketing
              </p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                En cours de développement — bientôt disponibles.
              </p>
            </div>
          </section>

          {/* History */}
          <section>
            <h3 className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 font-semibold mb-3">
              Historique des réservations
            </h3>
            <ClientHistoryList
              bookings={bookings}
              loading={historyLoading}
              error={historyError}
              onBookingClick={onBookingClick}
            />
          </section>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex items-center gap-2">
          <Button
            type="button"
            variant="primary"
            onClick={handleCreateBooking}
          >
            <CalendarPlus className="w-4 h-4 mr-1.5" />
            Nouveau RDV
          </Button>
          <div className="flex-1" />
          <Button
            type="button"
            variant="primary"
            onClick={handleSave}
            disabled={!isDirty || saving}
          >
            <Save className="w-4 h-4 mr-1.5" />
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </div>
      </aside>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2.5">
      <p className="text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {label}
      </p>
      <p className="text-sm font-semibold text-gray-900 dark:text-white mt-0.5 tabular-nums">
        {value}
      </p>
    </div>
  );
}

/** "12 mai 2026" — long enough to disambiguate, short enough to fit. */
function formatLongDate(d: Date | null): string {
  if (!d || d.getTime() === 0) return '—';
  return d.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Average gap between two confirmed visits, expressed in human terms.
 * Returns null when we don't have enough data to compute (need at
 * least 2 confirmed bookings — one alone gives no interval).
 *
 * Granularity:
 *   < 7 days     → "tous les N j"
 *   < 60 days    → "toutes les N sem"
 *   < 720 days   → "tous les N mois"
 *   otherwise    → "tous les N ans"
 */
function computeFrequency(client: ProviderClient): string | null {
  if (
    client.confirmedCount < 2 ||
    !client.firstBookingAt ||
    !client.lastBookingAt
  ) {
    return null;
  }
  const spanMs = client.lastBookingAt.getTime() - client.firstBookingAt.getTime();
  if (spanMs <= 0) return null;
  const avgDays = Math.round(
    spanMs / (1000 * 60 * 60 * 24) / (client.confirmedCount - 1),
  );
  if (avgDays < 7) return `Tous les ${avgDays} j`;
  if (avgDays < 60) {
    const weeks = Math.round(avgDays / 7);
    return `Toutes les ${weeks} sem`;
  }
  if (avgDays < 720) {
    const months = Math.round(avgDays / 30);
    return `Tous les ${months} mois`;
  }
  const years = Math.round(avgDays / 365);
  return `Tous les ${years} ans`;
}

/**
 * Top 3 booked services for a client. Cancelled bookings are
 * filtered out so a serial canceller doesn't pollute the picture;
 * pending and confirmed both count since intent to come back is
 * itself a signal of preference.
 */
function computeTopServices(
  bookings: WithId<Booking>[],
): Array<{ name: string; count: number }> {
  const counts = new Map<string, number>();
  for (const b of bookings) {
    if (b.status === 'cancelled') continue;
    const name = (b.serviceName || '').trim();
    if (!name) continue;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);
}
