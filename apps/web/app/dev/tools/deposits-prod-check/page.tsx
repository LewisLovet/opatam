'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, Loader2, RefreshCw, AlertCircle } from 'lucide-react';

interface CheckResult {
  ok: boolean;
  detail: string;
  data?: any;
}

interface ModeReport {
  mode: 'live' | 'test';
  addon: CheckResult;
  platformWebhook: CheckResult;
  connectWebhook: CheckResult;
}

interface Report {
  requiredPlatformEvents: string[];
  requiredConnectEvents: string[];
  live?: ModeReport;
  test?: ModeReport;
}

export default function DepositsProdCheckPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/dev/deposits-prod-check');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setReport(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Acomptes — checklist de mise en prod
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Lecture seule sur Stripe (live + test). Aucun appel d'écriture.
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Re-tester
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300">
          {error}
        </div>
      )}

      {loading && !report && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
        </div>
      )}

      {report && (
        <div className="space-y-6">
          {/* LIVE — critique pour la prod */}
          {report.live && <ModeCard title="Stripe LIVE (production)" report={report.live} priority />}

          {/* TEST — bonus */}
          {report.test && <ModeCard title="Stripe TEST (dev)" report={report.test} />}

          {!report.test && (
            <div className="p-4 rounded-lg bg-gray-50 border border-gray-200 dark:bg-gray-800 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-400">
              <AlertCircle className="w-4 h-4 inline mr-2 -mt-0.5" />
              Le check TEST est ignoré : <code className="text-xs bg-gray-200 dark:bg-gray-700 px-1 rounded">STRIPE_SECRET_KEY_DEV</code> n'est pas configuré.
            </div>
          )}

          {/* Required events — référence */}
          <details className="border border-gray-200 dark:border-gray-700 rounded-lg">
            <summary className="cursor-pointer p-4 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50">
              Référence des events Stripe attendus
            </summary>
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 grid md:grid-cols-2 gap-4 text-xs">
              <div>
                <p className="font-semibold text-gray-700 dark:text-gray-300 mb-2">Plateforme</p>
                <ul className="space-y-1 font-mono text-gray-600 dark:text-gray-400">
                  {report.requiredPlatformEvents.map((evt) => (
                    <li key={evt}>{evt}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="font-semibold text-gray-700 dark:text-gray-300 mb-2">Connect</p>
                <ul className="space-y-1 font-mono text-gray-600 dark:text-gray-400">
                  {report.requiredConnectEvents.map((evt) => (
                    <li key={evt}>{evt}</li>
                  ))}
                </ul>
              </div>
            </div>
          </details>
        </div>
      )}
    </div>
  );
}

function ModeCard({
  title,
  report,
  priority,
}: {
  title: string;
  report: ModeReport;
  priority?: boolean;
}) {
  const allOk = report.addon.ok && report.platformWebhook.ok && report.connectWebhook.ok;

  return (
    <div
      className={`rounded-xl border-2 overflow-hidden ${
        allOk
          ? 'border-green-300 dark:border-green-700'
          : priority
            ? 'border-red-300 dark:border-red-700'
            : 'border-amber-300 dark:border-amber-700'
      }`}
    >
      <div
        className={`px-5 py-3 ${
          allOk
            ? 'bg-green-50 dark:bg-green-900/20'
            : priority
              ? 'bg-red-50 dark:bg-red-900/20'
              : 'bg-amber-50 dark:bg-amber-900/20'
        }`}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">{title}</h2>
          {allOk ? (
            <span className="text-xs font-bold text-green-700 dark:text-green-300 uppercase tracking-wide">
              ✓ Prêt
            </span>
          ) : (
            <span
              className={`text-xs font-bold uppercase tracking-wide ${
                priority ? 'text-red-700 dark:text-red-300' : 'text-amber-700 dark:text-amber-300'
              }`}
            >
              {priority ? '⚠ Bloque la prod' : '⚠ Incomplet'}
            </span>
          )}
        </div>
      </div>
      <div className="p-5 bg-white dark:bg-gray-800 space-y-3">
        <CheckRow label="Produit Sérénité (metadata.addon = deposits)" result={report.addon} />
        <CheckRow label="Webhook plateforme" result={report.platformWebhook} />
        <CheckRow label="Webhook Connect (events des comptes connectés)" result={report.connectWebhook} />
      </div>
    </div>
  );
}

function CheckRow({ label, result }: { label: string; result: CheckResult }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className={`rounded-lg border ${
        result.ok
          ? 'border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10'
          : 'border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10'
      }`}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-start gap-3 p-3 text-left"
      >
        <div className="flex-shrink-0 mt-0.5">
          {result.ok ? (
            <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
          ) : (
            <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p
            className={`text-sm font-medium ${
              result.ok ? 'text-green-900 dark:text-green-100' : 'text-red-900 dark:text-red-100'
            }`}
          >
            {label}
          </p>
          <p
            className={`text-xs mt-0.5 ${
              result.ok ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'
            }`}
          >
            {result.detail}
          </p>
        </div>
        {result.data ? (
          <span className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {open ? '▾' : '▸'}
          </span>
        ) : null}
      </button>
      {open && result.data ? (
        <pre className="px-3 pb-3 text-xs font-mono text-gray-600 dark:text-gray-400 overflow-x-auto">
          {JSON.stringify(result.data, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}
