'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Plus,
  Trash2,
  RefreshCw,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  CreditCard,
  Clock,
  Ban,
  Receipt,
  AlertTriangle,
} from 'lucide-react';

interface Booking {
  id: string;
  status: string;
  providerName: string;
  clientName: string;
  serviceName: string;
  datetime: string | null;
  createdAt: string | null;
  deposit: {
    amount: number;
    status: 'pending' | 'paid' | 'refunded' | 'failed';
    refundDeadlineHours: number;
    paidAt: string | null;
    refundedAt: string | null;
    disputeId: string | null;
    disputeStatus: string | null;
  } | null;
}

interface LogLine {
  ts: string;
  level: 'info' | 'success' | 'warn' | 'error';
  message: string;
}

type SimEvent =
  | 'payment_success'
  | 'payment_expired'
  | 'payment_failed'
  | 'refund'
  | 'dispute_created';

const EVENTS: Array<{ id: SimEvent; label: string; icon: any; color: string }> = [
  { id: 'payment_success', label: 'Paiement réussi', icon: CheckCircle2, color: 'green' },
  { id: 'payment_expired', label: 'Session expirée', icon: Clock, color: 'gray' },
  { id: 'payment_failed', label: 'Carte refusée', icon: XCircle, color: 'amber' },
  { id: 'refund', label: 'Refund externe', icon: Receipt, color: 'blue' },
  { id: 'dispute_created', label: 'Litige (chargeback)', icon: AlertTriangle, color: 'red' },
];

export default function DepositsPlaygroundPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const logEndRef = useRef<HTMLDivElement>(null);

  const reload = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/dev/deposits-playground');
      const data = await res.json();
      setBookings(data.bookings ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, []);

  // Auto-scroll log timeline
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const appendLogs = (lines: LogLine[]) => {
    setLogs((prev) => [...prev, ...lines]);
  };

  const createBooking = async (refundDeadlineHours: number, offsetHours: number) => {
    setBusy('create');
    appendLogs([
      {
        ts: new Date().toISOString(),
        level: 'info',
        message: `→ Création d'un booking de test (délai remboursement ${refundDeadlineHours}h, RDV dans ${offsetHours}h)`,
      },
    ]);
    try {
      const res = await fetch('/api/dev/deposits-playground', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', refundDeadlineHours, bookingDatetimeOffsetHours: offsetHours }),
      });
      const data = await res.json();
      if (data.logs) appendLogs(data.logs);
      await reload();
    } catch (e) {
      appendLogs([
        {
          ts: new Date().toISOString(),
          level: 'error',
          message: e instanceof Error ? e.message : 'Erreur',
        },
      ]);
    } finally {
      setBusy(null);
    }
  };

  const simulate = async (bookingId: string, event: SimEvent, label: string) => {
    setBusy(`${bookingId}:${event}`);
    appendLogs([
      {
        ts: new Date().toISOString(),
        level: 'info',
        message: `→ Simulation "${label}" sur ${bookingId.slice(0, 8)}…`,
      },
    ]);
    try {
      const res = await fetch('/api/dev/deposits-playground', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'simulate', bookingId, event }),
      });
      const data = await res.json();
      if (data.logs) appendLogs(data.logs);
      await reload();
    } catch (e) {
      appendLogs([
        {
          ts: new Date().toISOString(),
          level: 'error',
          message: e instanceof Error ? e.message : 'Erreur',
        },
      ]);
    } finally {
      setBusy(null);
    }
  };

  const triggerViaStripe = async (bookingId: string, event: SimEvent, label: string) => {
    setBusy(`${bookingId}:trigger:${event}`);
    appendLogs([
      {
        ts: new Date().toISOString(),
        level: 'info',
        message: `→ stripe trigger "${label}" — l'event va passer par stripe listen + le vrai handler`,
      },
    ]);
    try {
      const res = await fetch('/api/dev/deposits-playground/stripe-trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId, event }),
      });
      const data = await res.json();
      if (data.command) {
        appendLogs([
          { ts: new Date().toISOString(), level: 'info', message: `$ ${data.command}` },
        ]);
      }
      if (data.ok) {
        appendLogs([
          {
            ts: new Date().toISOString(),
            level: 'success',
            message: `Stripe a émis l'event — vérifie tes terminaux stripe listen + les logs Next.js du webhook`,
          },
        ]);
        if (data.stdout) {
          for (const line of String(data.stdout).split('\n').filter(Boolean)) {
            appendLogs([{ ts: new Date().toISOString(), level: 'info', message: `  ${line}` }]);
          }
        }
      } else {
        appendLogs([
          {
            ts: new Date().toISOString(),
            level: 'error',
            message: data.error || 'Échec stripe trigger',
          },
        ]);
        if (data.stderr) {
          for (const line of String(data.stderr).split('\n').filter(Boolean)) {
            appendLogs([{ ts: new Date().toISOString(), level: 'warn', message: `  ${line}` }]);
          }
        }
      }
      // Reload after a brief delay so the webhook has time to mutate
      // before we re-fetch the booking list.
      setTimeout(() => reload(), 1500);
    } catch (e) {
      appendLogs([
        {
          ts: new Date().toISOString(),
          level: 'error',
          message: e instanceof Error ? e.message : 'Erreur',
        },
      ]);
    } finally {
      setBusy(null);
    }
  };

  const cleanup = async () => {
    if (!confirm('Supprimer TOUS les bookings playground ?')) return;
    setBusy('cleanup');
    try {
      const res = await fetch('/api/dev/deposits-playground', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cleanup' }),
      });
      const data = await res.json();
      if (data.logs) appendLogs(data.logs);
      await reload();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Acomptes — playground
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Crée des bookings fictifs et simule chaque event sans Stripe ni stripe listen. Les mutations sont identiques à celles que feraient les webhooks en prod.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={reload}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Recharger
          </button>
          <button
            onClick={cleanup}
            disabled={busy === 'cleanup'}
            className="flex items-center gap-2 px-3 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white text-sm font-medium rounded-lg"
          >
            <Trash2 className="w-4 h-4" />
            Tout supprimer
          </button>
        </div>
      </div>

      {/* CREATE controls */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 mb-6 bg-white dark:bg-gray-800">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
          Créer un booking de test
        </h2>
        <div className="flex flex-wrap gap-2">
          <CreateButton
            label="Standard (RDV+48h, délai 24h)"
            onClick={() => createBooking(24, 48)}
            disabled={busy === 'create'}
            primary
          />
          <CreateButton
            label="Hors délai (RDV+1h, délai 24h)"
            onClick={() => createBooking(24, 1)}
            disabled={busy === 'create'}
          />
          <CreateButton
            label="Pas remboursable (délai 0h)"
            onClick={() => createBooking(0, 48)}
            disabled={busy === 'create'}
          />
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
          Les 3 modes couvrent les cas du flow refund : dans le délai, hors délai, jamais remboursable.
        </p>
      </div>

      {/* BOOKINGS list */}
      <div className="space-y-3 mb-6">
        {loading && bookings.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : bookings.length === 0 ? (
          <div className="text-center py-8 text-sm text-gray-500 dark:text-gray-400 border border-dashed border-gray-300 dark:border-gray-700 rounded-xl">
            Aucun booking de test. Crée-en un ci-dessus.
          </div>
        ) : (
          bookings.map((b) => (
            <BookingCard
              key={b.id}
              booking={b}
              busy={busy}
              onSimulate={simulate}
              onTriggerViaStripe={triggerViaStripe}
            />
          ))
        )}
      </div>

      {/* LOGS timeline */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-xl bg-gray-900 text-gray-100 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800 bg-gray-950">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            Timeline des événements
          </p>
          <button
            onClick={() => setLogs([])}
            className="text-xs text-gray-500 hover:text-gray-300"
          >
            Vider
          </button>
        </div>
        <div className="px-4 py-3 max-h-80 overflow-y-auto font-mono text-xs space-y-1">
          {logs.length === 0 ? (
            <p className="text-gray-500">Les actions apparaîtront ici.</p>
          ) : (
            logs.map((line, i) => <LogRow key={i} line={line} />)
          )}
          <div ref={logEndRef} />
        </div>
      </div>
    </div>
  );
}

function CreateButton({
  label,
  onClick,
  disabled,
  primary,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
        primary
          ? 'bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 text-white'
          : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200'
      }`}
    >
      <Plus className="w-4 h-4" />
      {label}
    </button>
  );
}

function StatusPill({ status }: { status: string }) {
  const palette: Record<string, string> = {
    pending_payment: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    confirmed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    cancelled: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    pending: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  };
  return (
    <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded ${palette[status] ?? 'bg-gray-100 text-gray-700'}`}>
      {status}
    </span>
  );
}

function DepositPill({ status }: { status: string | undefined }) {
  if (!status) return null;
  const palette: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    paid: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
    refunded: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    failed: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  };
  return (
    <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded ${palette[status] ?? 'bg-gray-100 text-gray-700'}`}>
      acompte: {status}
    </span>
  );
}

function BookingCard({
  booking,
  busy,
  onSimulate,
  onTriggerViaStripe,
}: {
  booking: Booking;
  busy: string | null;
  onSimulate: (id: string, event: SimEvent, label: string) => void;
  onTriggerViaStripe: (id: string, event: SimEvent, label: string) => void;
}) {
  const isInDeadline = (() => {
    if (!booking.datetime || !booking.deposit) return false;
    if (booking.deposit.refundDeadlineHours <= 0) return false;
    const deadline = new Date(booking.datetime).getTime() - booking.deposit.refundDeadlineHours * 3600 * 1000;
    return Date.now() < deadline;
  })();

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <code className="text-xs font-mono text-gray-500 dark:text-gray-400">{booking.id.slice(0, 12)}…</code>
            <StatusPill status={booking.status} />
            <DepositPill status={booking.deposit?.status} />
            {booking.deposit?.disputeId && (
              <span className="inline-block px-2 py-0.5 text-xs font-medium rounded bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
                LITIGE
              </span>
            )}
          </div>
          <p className="text-sm text-gray-700 dark:text-gray-300">
            {booking.serviceName} — {booking.clientName}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            RDV : {booking.datetime ? new Date(booking.datetime).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }) : '?'}
            {' · '}
            Acompte : {booking.deposit ? `${(booking.deposit.amount / 100).toFixed(2)} €` : '—'}
            {' · '}
            Délai refund : {booking.deposit?.refundDeadlineHours}h
            {booking.deposit && (
              <span className={`ml-2 ${isInDeadline ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>
                {isInDeadline ? '(dans le délai)' : '(hors délai)'}
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Mode 1 — Direct Firestore mutation (no Stripe involved) */}
      <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
        <div className="w-full flex items-center gap-2 mb-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Mutation directe Firestore
          </p>
          <span className="text-xs text-gray-400">— rapide, pas de Stripe</span>
        </div>
        {EVENTS.map((evt) => {
          const Icon = evt.icon;
          const key = `${booking.id}:${evt.id}`;
          const isBusy = busy === key;
          return (
            <button
              key={evt.id}
              onClick={() => onSimulate(booking.id, evt.id, evt.label)}
              disabled={busy !== null}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border transition-colors disabled:opacity-50 ${
                evt.color === 'green'
                  ? 'border-green-300 text-green-700 hover:bg-green-50 dark:border-green-700 dark:text-green-300 dark:hover:bg-green-900/20'
                  : evt.color === 'amber'
                  ? 'border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-900/20'
                  : evt.color === 'red'
                  ? 'border-red-300 text-red-700 hover:bg-red-50 dark:border-red-700 dark:text-red-300 dark:hover:bg-red-900/20'
                  : evt.color === 'blue'
                  ? 'border-blue-300 text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-300 dark:hover:bg-blue-900/20'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700'
              }`}
            >
              {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Icon className="w-3.5 h-3.5" />}
              {evt.label}
            </button>
          );
        })}
      </div>

      {/* Mode 2 — Real Stripe event via stripe trigger */}
      <div className="flex flex-wrap gap-2 pt-3">
        <div className="w-full flex items-center gap-2 mb-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-purple-600 dark:text-purple-400">
            Via Stripe CLI (réel)
          </p>
          <span className="text-xs text-gray-400">
            — passe par <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">stripe listen</code> et le vrai webhook
          </span>
        </div>
        {EVENTS.map((evt) => {
          const Icon = evt.icon;
          const key = `${booking.id}:trigger:${evt.id}`;
          const isBusy = busy === key;
          return (
            <button
              key={evt.id}
              onClick={() => onTriggerViaStripe(booking.id, evt.id, evt.label)}
              disabled={busy !== null}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-purple-300 text-purple-700 hover:bg-purple-50 dark:border-purple-700 dark:text-purple-300 dark:hover:bg-purple-900/20 transition-colors disabled:opacity-50"
            >
              {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Icon className="w-3.5 h-3.5" />}
              {evt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function LogRow({ line }: { line: LogLine }) {
  const time = new Date(line.ts).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const levelColor: Record<LogLine['level'], string> = {
    info: 'text-gray-300',
    success: 'text-green-400',
    warn: 'text-amber-400',
    error: 'text-red-400',
  };
  const levelIcon: Record<LogLine['level'], React.ReactNode> = {
    info: <span>·</span>,
    success: <CheckCircle2 className="w-3 h-3 inline" />,
    warn: <AlertCircle className="w-3 h-3 inline" />,
    error: <XCircle className="w-3 h-3 inline" />,
  };
  return (
    <div className="flex items-start gap-2">
      <span className="text-gray-600 flex-shrink-0">{time}</span>
      <span className={`flex-shrink-0 ${levelColor[line.level]}`}>{levelIcon[line.level]}</span>
      <span className={levelColor[line.level]}>{line.message}</span>
    </div>
  );
}
