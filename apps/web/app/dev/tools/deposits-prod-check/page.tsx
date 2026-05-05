'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, Loader2, RefreshCw, AlertCircle, Copy, Check } from 'lucide-react';

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

          {/* Local testing guide */}
          <LocalTestingGuide testProductOk={report.test?.addon.ok ?? false} onCloned={load} />

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

// ─── Local testing guide ───────────────────────────────────────────────

function CopyableCmd({ cmd }: { cmd: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-stretch gap-0 bg-gray-900 text-gray-100 rounded-md overflow-hidden font-mono text-xs">
      <pre className="flex-1 px-3 py-2.5 overflow-x-auto whitespace-pre">{cmd}</pre>
      <button
        onClick={async () => {
          await navigator.clipboard.writeText(cmd);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="px-3 hover:bg-gray-800 transition-colors flex items-center"
        title="Copier"
      >
        {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
      </button>
    </div>
  );
}

function LocalTestingGuide({ testProductOk, onCloned }: { testProductOk: boolean; onCloned: () => void }) {
  const [cloning, setCloning] = useState(false);
  const [cloneResult, setCloneResult] = useState<string | null>(null);

  const cloneTestProduct = async () => {
    setCloning(true);
    setCloneResult(null);
    try {
      const res = await fetch('/api/dev/deposits-prod-check/clone-test-product', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setCloneResult(
        data.created
          ? `✓ Créé : product=${data.product}, price=${data.price}`
          : `Déjà présent : product=${data.product}, price=${data.price}`
      );
      onCloned();
    } catch (e) {
      setCloneResult(`Erreur : ${e instanceof Error ? e.message : 'unknown'}`);
    } finally {
      setCloning(false);
    }
  };

  return (
    <details className="border border-blue-200 dark:border-blue-800 rounded-lg bg-blue-50/40 dark:bg-blue-900/10" open>
      <summary className="cursor-pointer p-4 text-sm font-medium text-blue-900 dark:text-blue-100 hover:bg-blue-100/50 dark:hover:bg-blue-900/20">
        Tester en local — guide pas-à-pas
      </summary>
      <div className="p-4 border-t border-blue-200 dark:border-blue-800 space-y-5 text-sm text-gray-700 dark:text-gray-300">
        {/* Step 1 — clone product */}
        <section>
          <p className="font-semibold text-gray-900 dark:text-white mb-2">1. Produit Sérénité en mode TEST</p>
          {testProductOk ? (
            <p className="text-green-700 dark:text-green-300 text-xs">✓ Déjà présent en TEST.</p>
          ) : (
            <>
              <p className="mb-2 text-xs">
                Le produit n'existe pas encore en mode TEST. Un clic et on copie le LIVE (mêmes valeurs + metadata).
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={cloneTestProduct}
                  disabled={cloning}
                  className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-xs font-medium rounded-md transition-colors"
                >
                  {cloning && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Cloner le produit en TEST
                </button>
                {cloneResult && (
                  <span className="text-xs text-gray-600 dark:text-gray-400">{cloneResult}</span>
                )}
              </div>
            </>
          )}
        </section>

        {/* Step 2 — stripe listen */}
        <section>
          <p className="font-semibold text-gray-900 dark:text-white mb-2">2. Lance <code className="text-xs bg-gray-200 dark:bg-gray-800 px-1 rounded">stripe listen</code></p>
          <p className="mb-2 text-xs">
            Dans deux terminaux (un pour les events plateforme, un pour les events Connect).
          </p>
          <div className="space-y-2">
            <div>
              <p className="text-xs text-gray-500 mb-1">Terminal 1 — events plateforme</p>
              <CopyableCmd cmd="stripe listen --forward-to localhost:3000/api/stripe/webhook" />
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Terminal 2 — events Connect (les events des comptes connectés)</p>
              <CopyableCmd cmd="stripe listen --forward-connect-to localhost:3000/api/stripe/webhook" />
            </div>
          </div>
          <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
            Chaque terminal affiche un secret <code className="bg-gray-200 dark:bg-gray-800 px-1 rounded text-[11px]">whsec_…</code> à la première ligne.
          </p>
        </section>

        {/* Step 3 — env vars */}
        <section>
          <p className="font-semibold text-gray-900 dark:text-white mb-2">3. Variables d'env locales</p>
          <p className="mb-2 text-xs">
            Dans <code className="bg-gray-200 dark:bg-gray-800 px-1 rounded text-[11px]">apps/web/.env.local</code>, copie les deux secrets affichés par <code className="bg-gray-200 dark:bg-gray-800 px-1 rounded text-[11px]">stripe listen</code> :
          </p>
          <CopyableCmd cmd={`STRIPE_WEBHOOK_SECRET_DEV=whsec_…    # secret du terminal 1\nSTRIPE_WEBHOOK_SECRET_DEV_CONNECT=whsec_…    # secret du terminal 2`} />
          <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
            Notre code (<code className="bg-gray-200 dark:bg-gray-800 px-1 rounded text-[11px]">getWebhookSecrets</code>) essaie les trois secrets — le bon est trouvé automatiquement.
          </p>
          <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
            Redémarre <code className="bg-gray-200 dark:bg-gray-800 px-1 rounded text-[11px]">next dev</code> après modification de l'env.
          </p>
        </section>

        {/* Step 4 — flow */}
        <section>
          <p className="font-semibold text-gray-900 dark:text-white mb-2">4. Flow E2E</p>
          <ol className="list-decimal list-inside space-y-1 text-xs">
            <li>Sur ton compte pro de test : active <strong>Stripe Connect</strong> (mode test) et l'add-on Sérénité.</li>
            <li>Ajoute un acompte sur une prestation — montant minimum 100 (1 €) en cents.</li>
            <li>Réserve cette prestation depuis une fenêtre privée (ou un autre compte client).</li>
            <li>Paie l'acompte avec la carte test <code className="bg-gray-200 dark:bg-gray-800 px-1 rounded text-[11px]">4242 4242 4242 4242</code> + n'importe quel CVC + date future.</li>
            <li>La résa doit flipper en <strong>confirmed</strong> en quelques secondes (vérifie dans <code className="bg-gray-200 dark:bg-gray-800 px-1 rounded text-[11px]">stripe listen</code> et dans l'agenda pro).</li>
          </ol>
        </section>

        {/* Step 5 — trigger fictif */}
        <section>
          <p className="font-semibold text-gray-900 dark:text-white mb-2">5. Trigger d'event factice (optionnel)</p>
          <p className="mb-2 text-xs">
            Pour tester un handler particulier sans faire un vrai paiement (ex : <code className="bg-gray-200 dark:bg-gray-800 px-1 rounded text-[11px]">charge.dispute.created</code>) :
          </p>
          <CopyableCmd cmd="stripe trigger charge.dispute.created" />
        </section>
      </div>
    </details>
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
