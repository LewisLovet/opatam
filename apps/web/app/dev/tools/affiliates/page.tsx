'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface Affiliate {
  id: string;
  name: string;
  email: string;
  code: string;
  stripeAccountId: string;
  stripeAccountStatus: string;
  commission: number;
  stats: {
    totalReferrals: number;
    totalRevenue: number;
    totalCommission: number;
  };
  isActive: boolean;
  createdAt: string | null;
}

interface LogEntry {
  id: string;
  type: 'payment' | 'refund';
  affiliateCode: string;
  paymentIntentId: string;
  transferId?: string;
  amount: number;
  commission?: number;
  status: string;
  refunded?: boolean;
  createdAt: string;
}

export default function AffiliatesTestPage() {
  // State
  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [commission, setCommission] = useState('20');
  const [simAffiliateId, setSimAffiliateId] = useState('');
  const [simAmount, setSimAmount] = useState('19.90');

  // Load affiliates and logs
  const loadAffiliates = useCallback(async () => {
    try {
      const res = await fetch('/api/dev/affiliates');
      const data = await res.json();
      if (data.affiliates) setAffiliates(data.affiliates);
      if (data.logs) setLogs(data.logs);
    } catch (err: any) {
      console.error('Load error:', err);
    }
  }, []);

  useEffect(() => {
    loadAffiliates();
  }, [loadAffiliates]);

  // Auto-select first affiliate for simulation
  useEffect(() => {
    if (affiliates.length > 0 && !simAffiliateId) {
      setSimAffiliateId(affiliates[0].id);
    }
  }, [affiliates, simAffiliateId]);

  const runAction = async (label: string, fn: () => Promise<Response>) => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fn();
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');
      setResult({ label, data });
      await loadAffiliates();
    } catch (err: any) {
      setError(`${label}: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Actions
  const createAffiliate = () =>
    runAction('Créer affilié', () =>
      fetch('/api/dev/affiliates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, code, commission: Number(commission) }),
      })
    );

  const checkStatus = (id: string) =>
    runAction('Vérifier statut', () =>
      fetch('/api/dev/affiliates', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ affiliateId: id }),
      })
    );

  const deleteAffiliate = (id: string) =>
    runAction('Supprimer affilié', () =>
      fetch('/api/dev/affiliates', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ affiliateId: id }),
      })
    );

  const deleteAll = () =>
    runAction('Tout supprimer', () =>
      fetch('/api/dev/affiliates', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      })
    );

  const simulatePayment = () =>
    runAction('Simuler paiement', () =>
      fetch('/api/dev/affiliates/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'payment',
          affiliateId: simAffiliateId,
          amount: Number(simAmount),
        }),
      })
    );

  const simulateRefund = (logId: string) =>
    runAction('Simuler remboursement', () =>
      fetch('/api/dev/affiliates/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'refund',
          logId,
        }),
      })
    );

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-5xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link href="/dev/tools" className="text-sm text-slate-400 hover:text-white mb-2 inline-block">
              ← Dev Tools
            </Link>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              🤝 Stripe Connect — Affiliés
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Tester le système d'affiliation avec Stripe Connect en mode test
            </p>
          </div>
          {affiliates.length > 0 && (
            <button
              onClick={deleteAll}
              disabled={loading}
              className="px-3 py-1.5 text-xs font-medium bg-red-900/50 text-red-400 rounded-lg border border-red-800 hover:bg-red-900 transition-colors disabled:opacity-50"
            >
              Tout supprimer
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Section 1: Create Affiliate */}
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">
              1. Créer un affilié
            </h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Nom</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Marie Dupont"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Email</label>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="marie@example.com"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Code promo</label>
                  <input
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="MARIE"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 uppercase"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Commission (%)</label>
                  <input
                    type="number"
                    value={commission}
                    onChange={(e) => setCommission(e.target.value)}
                    min="1"
                    max="50"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
              <button
                onClick={createAffiliate}
                disabled={loading || !name || !email || !code}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-40"
              >
                {loading ? 'Création...' : 'Créer le compte Connect'}
              </button>
            </div>
          </div>

          {/* Section 2: Simulate Payment */}
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-5">
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">
              2. Simuler un paiement
            </h2>
            {affiliates.length === 0 ? (
              <p className="text-sm text-slate-500 italic">Créez d'abord un affilié</p>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Affilié</label>
                  <select
                    value={simAffiliateId}
                    onChange={(e) => setSimAffiliateId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    {affiliates.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.code}) — {a.commission}%
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Montant (€)</label>
                  <input
                    type="number"
                    value={simAmount}
                    onChange={(e) => setSimAmount(e.target.value)}
                    min="1"
                    step="0.01"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                {simAffiliateId && (
                  <div className="bg-slate-800/50 rounded-lg p-3 text-xs text-slate-400">
                    Commission : <span className="text-emerald-400 font-semibold">
                      {(Number(simAmount) * (affiliates.find((a) => a.id === simAffiliateId)?.commission || 0) / 100).toFixed(2)} €
                    </span>
                    {' '}({affiliates.find((a) => a.id === simAffiliateId)?.commission}% de {simAmount} €)
                  </div>
                )}
                <button
                  onClick={simulatePayment}
                  disabled={loading || !simAffiliateId}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-40"
                >
                  {loading ? 'Simulation...' : 'Simuler le paiement'}
                </button>
              </div>
            )}

            {/* Refund section */}
            <div className="mt-6 pt-4 border-t border-slate-800">
              <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-3">
                3. Remboursements
              </h2>
              {logs.filter((l) => l.type === 'payment' && !l.refunded).length === 0 ? (
                <p className="text-sm text-slate-500 italic">Aucun paiement à rembourser</p>
              ) : (
                <div className="space-y-2">
                  {logs.filter((l) => l.type === 'payment' && !l.refunded).map((log) => (
                    <div key={log.id} className="flex items-center justify-between bg-slate-800/50 rounded-lg p-2.5">
                      <div className="text-xs">
                        <p className="text-white font-medium">{(log.amount / 100).toFixed(2)} € → {log.affiliateCode}</p>
                        <p className="text-slate-500 font-mono text-[10px]">{log.paymentIntentId}</p>
                      </div>
                      <button
                        onClick={() => simulateRefund(log.id)}
                        disabled={loading}
                        className="text-xs px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-medium rounded-md transition-colors disabled:opacity-40"
                      >
                        Rembourser
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Affiliates List */}
        {affiliates.length > 0 && (
          <div className="mt-6 bg-slate-900 rounded-xl border border-slate-800 p-5">
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">
              Affiliés ({affiliates.length})
            </h2>
            <div className="space-y-2">
              {affiliates.map((a) => (
                <div key={a.id} className="flex items-center justify-between bg-slate-800/50 rounded-lg p-3">
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="text-sm font-medium text-white">{a.name}</p>
                      <p className="text-xs text-slate-400">{a.email}</p>
                    </div>
                    <span className="px-2 py-0.5 bg-blue-900/50 text-blue-400 text-xs font-mono rounded">
                      {a.code}
                    </span>
                    <span className="text-xs text-slate-500">
                      {a.commission}%
                    </span>
                    <span className={`px-2 py-0.5 text-xs rounded ${
                      a.stripeAccountStatus === 'active'
                        ? 'bg-emerald-900/50 text-emerald-400'
                        : 'bg-amber-900/50 text-amber-400'
                    }`}>
                      {a.stripeAccountStatus}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right text-xs">
                      <p className="text-slate-400">{a.stats.totalReferrals} filleuls</p>
                      <p className="text-emerald-400 font-medium">{(a.stats.totalCommission / 100).toFixed(2)} € gagnés</p>
                    </div>
                    <button
                      onClick={() => checkStatus(a.id)}
                      disabled={loading}
                      className="text-xs text-blue-400 hover:text-blue-300 px-2 py-1 bg-blue-900/30 rounded-md border border-blue-800/50"
                    >
                      Vérifier
                    </button>
                    <button
                      onClick={() => deleteAffiliate(a.id)}
                      disabled={loading}
                      className="text-xs text-red-400 hover:text-red-300 px-2 py-1"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Result / Error */}
        {error && (
          <div className="mt-6 bg-red-900/20 border border-red-800 rounded-xl p-4">
            <p className="text-sm text-red-400 font-medium">Erreur</p>
            <p className="text-xs text-red-300 mt-1">{error}</p>
          </div>
        )}

        {result && (
          <div className="mt-6 bg-emerald-900/20 border border-emerald-800 rounded-xl p-4">
            <p className="text-sm text-emerald-400 font-medium mb-2">{result.label} — Succès</p>
            {result.data?.onboardingUrl && (
              <a
                href={result.data.onboardingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 mb-3 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                Compléter l'onboarding Stripe →
              </a>
            )}
            <pre className="text-xs text-slate-300 overflow-auto max-h-60">
              {JSON.stringify(result.data, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
