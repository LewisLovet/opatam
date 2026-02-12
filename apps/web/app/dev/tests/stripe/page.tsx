'use client';

import { useState, useCallback, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import Link from 'next/link';
import { SUBSCRIPTION_PLANS } from '@booking-app/shared';
import {
  ArrowLeft,
  CreditCard,
  Webhook,
  Terminal,
  Sparkles,
  Crown,
  Users,
  Check,
  Zap,
  Shield,
  CircleDot,
  ExternalLink,
  Trash2,
  BookOpen,
} from 'lucide-react';

interface LogEntry {
  time: string;
  message: string;
}

interface StripePrice {
  id: string;
  productName: string;
  unitAmount: number;
  currency: string;
  interval: string | null;
  intervalCount: number | null;
  trialDays?: number;
}

interface ProviderOption {
  id: string;
  businessName: string;
  plan: string;
}

function CheckoutResult() {
  const searchParams = useSearchParams();
  const success = searchParams.get('success');
  const cancelled = searchParams.get('cancelled');
  const sessionId = searchParams.get('session_id');

  if (!success && !cancelled) return null;

  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-800/50">
      <div className="absolute inset-0 bg-slate-900" />
      <div className="relative px-6 py-4 border-b border-slate-800/50">
        <h3 className="text-lg font-semibold text-white">Résultat du Checkout</h3>
        <p className="text-sm text-slate-400 mt-0.5">Retour de la session Stripe Checkout</p>
      </div>
      <div className="relative p-6 space-y-3">
        {success === 'true' && (
          <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <Badge variant="success">Paiement réussi</Badge>
            </div>
            <p className="text-sm text-slate-300">
              Le checkout Stripe s&apos;est terminé avec succès.
            </p>
            {sessionId && (
              <p className="text-xs font-mono mt-2 text-slate-500 bg-slate-800/50 rounded-lg px-3 py-1.5 inline-block">
                Session ID: {sessionId}
              </p>
            )}
          </div>
        )}
        {cancelled === 'true' && (
          <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/5">
            <Badge variant="error">Paiement annulé</Badge>
            <p className="text-sm mt-2 text-slate-300">
              Le checkout Stripe a été annulé par l&apos;utilisateur.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function formatInterval(interval: string | null, intervalCount: number | null): string {
  if (!interval) return 'unique';
  const count = intervalCount ?? 1;
  if (interval === 'month') return count === 1 ? '/mois' : `/${count} mois`;
  if (interval === 'year') return count === 1 ? '/an' : `/${count} ans`;
  if (interval === 'week') return count === 1 ? '/semaine' : `/${count} semaines`;
  if (interval === 'day') return count === 1 ? '/jour' : `/${count} jours`;
  return `/${interval}`;
}

function formatCurrency(amountCents: number, currency: string): string {
  const amount = amountCents / 100;
  if (currency === 'eur') return `${amount.toFixed(2)}\u20AC`;
  if (currency === 'usd') return `$${amount.toFixed(2)}`;
  return `${amount.toFixed(2)} ${currency.toUpperCase()}`;
}

// Webhook event color mapping
const webhookEventColors: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  'checkout.session.completed': { bg: 'bg-emerald-500/5', border: 'border-emerald-500/20', text: 'text-emerald-400', dot: 'bg-emerald-400' },
  'invoice.paid': { bg: 'bg-blue-500/5', border: 'border-blue-500/20', text: 'text-blue-400', dot: 'bg-blue-400' },
  'customer.subscription.updated': { bg: 'bg-amber-500/5', border: 'border-amber-500/20', text: 'text-amber-400', dot: 'bg-amber-400' },
  'customer.subscription.deleted': { bg: 'bg-red-500/5', border: 'border-red-500/20', text: 'text-red-400', dot: 'bg-red-400' },
};

const webhookEvents = [
  { event: 'checkout.session.completed', description: 'Active l\'abonnement' },
  { event: 'invoice.paid', description: 'Renouvellement réussi' },
  { event: 'customer.subscription.updated', description: 'Changement de plan/annulation programmée' },
  { event: 'customer.subscription.deleted', description: 'Fin d\'abonnement + dépublication' },
];

export default function StripeTestPage() {
  // Prices state
  const [prices, setPrices] = useState<StripePrice[]>([]);
  const [pricesLoading, setPricesLoading] = useState(true);
  const [pricesError, setPricesError] = useState<string | null>(null);
  const [selectedPriceId, setSelectedPriceId] = useState<string | null>(null);

  // Checkout state
  const [providerId, setProviderId] = useState('test-provider-123');
  const [trialEnabled, setTrialEnabled] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  // Providers state
  const [providers, setProviders] = useState<ProviderOption[]>([]);
  const [providersLoading, setProvidersLoading] = useState(true);
  const [manualProviderInput, setManualProviderInput] = useState(false);

  // Portal state
  const [customerId, setCustomerId] = useState('');
  const [portalLoading, setPortalLoading] = useState(false);

  // Logs
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const addLog = useCallback((message: string) => {
    const now = new Date();
    const time = now.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    setLogs((prev) => [...prev, { time, message }]);
  }, []);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  // Fetch prices on mount
  useEffect(() => {
    const fetchPrices = async () => {
      setPricesLoading(true);
      setPricesError(null);
      try {
        const res = await fetch('/api/stripe/prices');
        if (!res.ok) {
          throw new Error(`Erreur HTTP ${res.status}`);
        }
        const data = await res.json();
        setPrices(data.prices ?? []);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erreur inconnue';
        setPricesError(message);
      } finally {
        setPricesLoading(false);
      }
    };

    fetchPrices();
  }, []);

  // Fetch providers on mount
  useEffect(() => {
    const fetchProviders = async () => {
      try {
        const res = await fetch('/api/providers/list');
        if (res.ok) {
          const data = await res.json();
          setProviders(data.providers ?? []);
          // Pre-select first provider if available
          if (data.providers?.length > 0 && providerId === 'test-provider-123') {
            setProviderId(data.providers[0].id);
          }
        }
      } catch (err) {
        console.error('Error fetching providers:', err);
      } finally {
        setProvidersLoading(false);
      }
    };
    fetchProviders();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCheckout = async (priceId: string) => {
    setCheckoutLoading(true);
    setSelectedPriceId(priceId);
    const selectedPrice = prices.find((p) => p.id === priceId);
    addLog('Appel POST /api/stripe/checkout...');
    addLog(`Price ID: ${priceId}`);
    if (selectedPrice) addLog(`Produit: ${selectedPrice.productName}`);
    addLog(`Provider ID: ${providerId}`);
    if (trialEnabled) addLog('Période d\'essai: 30 jours');

    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priceId,
          providerId: providerId.trim(),
          ...(trialEnabled ? { trialDays: 7 } : {}),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        addLog(`Erreur HTTP ${res.status}: ${data.error || JSON.stringify(data)}`);
        setCheckoutLoading(false);
        setSelectedPriceId(null);
        return;
      }

      if (data.url) {
        addLog(`Session créée : ${data.sessionId}`);
        addLog('Redirection vers Stripe Checkout...');
        window.location.href = data.url;
      } else {
        addLog(`Erreur : ${data.error || 'Pas d\'URL dans la réponse'}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue';
      addLog(`Erreur : ${message}`);
    } finally {
      setCheckoutLoading(false);
      setSelectedPriceId(null);
    }
  };

  const handlePortal = async () => {
    if (!customerId.trim()) {
      addLog('Erreur : Customer ID requis');
      return;
    }

    setPortalLoading(true);
    addLog('Appel POST /api/stripe/portal...');
    addLog(`Customer ID: ${customerId}`);

    try {
      const res = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: customerId.trim(),
          returnUrl: `${window.location.origin}/dev/tests/stripe`,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        addLog(`Erreur HTTP ${res.status}: ${data.error || JSON.stringify(data)}`);
        setPortalLoading(false);
        return;
      }

      if (data.url) {
        addLog('Redirection vers le Customer Portal...');
        window.location.href = data.url;
      } else {
        addLog(`Erreur : ${data.error || 'Pas d\'URL dans la réponse'}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue';
      addLog(`Erreur : ${message}`);
    } finally {
      setPortalLoading(false);
    }
  };

  const formatPrice = (cents: number) => {
    return `${(cents / 100).toFixed(0)}\u20AC`;
  };

  return (
    <div className="py-12 px-4 bg-slate-950 min-h-screen">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Back link */}
        <Link
          href="/dev/tests"
          className="group inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-300 transition-colors duration-200"
        >
          <ArrowLeft className="w-4 h-4 transition-transform duration-200 group-hover:-translate-x-0.5" />
          Retour aux tests
        </Link>

        {/* Page Header */}
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-transparent to-purple-500/5" />
          <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-500/10 rounded-full blur-3xl" />
          <div className="relative py-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg shadow-indigo-500/25">
                <CreditCard className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">
                  Test Stripe
                </h1>
                <p className="text-xs text-slate-500">Checkout, Portal & Webhooks</p>
              </div>
            </div>
          </div>
        </div>

        {/* Checkout Result (from query params) */}
        <Suspense fallback={null}>
          <CheckoutResult />
        </Suspense>

        {/* Section: Webhook Info */}
        <div className="relative overflow-hidden rounded-xl border border-slate-800/50">
          <div className="absolute inset-0 bg-slate-900" />
          <div className="relative px-6 py-4 border-b border-slate-800/50 flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="p-1.5 rounded-lg bg-emerald-500/10">
                <Webhook className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Webhook Stripe</h3>
                <p className="text-sm text-slate-400">Les événements Stripe sont traités par /api/stripe/webhook</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-medium text-emerald-400">Actif</span>
            </div>
          </div>
          <div className="relative p-6">
            <div className="space-y-3">
              <p className="text-sm font-medium text-slate-300 mb-3">Événements gérés :</p>
              <div className="grid gap-2">
                {webhookEvents.map((item) => {
                  const colors = webhookEventColors[item.event];
                  return (
                    <div
                      key={item.event}
                      className={`flex items-center gap-3 px-4 py-2.5 rounded-lg ${colors.bg} border ${colors.border} transition-all duration-200 hover:scale-[1.01]`}
                    >
                      <div className={`w-2 h-2 rounded-full ${colors.dot} flex-shrink-0`} />
                      <code className={`text-xs font-mono ${colors.text} font-medium`}>
                        {item.event}
                      </code>
                      <span className="text-xs text-slate-500 ml-auto">{item.description}</span>
                    </div>
                  );
                })}
              </div>

              {/* CLI Command - Terminal style */}
              <div className="mt-4 rounded-xl overflow-hidden border border-slate-700/50">
                <div className="flex items-center gap-2 px-4 py-2 bg-slate-800/80 border-b border-slate-700/50">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-500/60" />
                    <div className="w-3 h-3 rounded-full bg-amber-500/60" />
                    <div className="w-3 h-3 rounded-full bg-emerald-500/60" />
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono ml-2">terminal</span>
                </div>
                <div className="bg-slate-950 p-4 font-mono text-xs">
                  <p className="text-slate-600"># Lancer le Stripe CLI pour tester :</p>
                  <p className="text-emerald-400 mt-1">
                    <span className="text-slate-500">$</span> stripe listen --forward-to localhost:3000/api/stripe/webhook
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section 1: Stripe Checkout Test with dynamic prices */}
        <div className="relative overflow-hidden rounded-xl border border-slate-800/50">
          <div className="absolute inset-0 bg-slate-900" />
          <div className="relative px-6 py-4 border-b border-slate-800/50 flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="p-1.5 rounded-lg bg-indigo-500/10">
                <CreditCard className="w-4 h-4 text-indigo-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Stripe Checkout Test</h3>
                <p className="text-sm text-slate-400">Sélectionnez un prix pour lancer une session Stripe Checkout</p>
              </div>
            </div>
            <Badge variant="info">Test</Badge>
          </div>
          <div className="relative p-6 space-y-5">
            {/* Provider selector */}
            <div>
              {manualProviderInput ? (
                <>
                  <Input
                    label="Provider ID"
                    value={providerId}
                    onChange={(e) => setProviderId(e.target.value)}
                    placeholder="test-provider-123"
                  />
                  <button
                    type="button"
                    onClick={() => setManualProviderInput(false)}
                    className="mt-1 text-xs text-indigo-400 hover:text-indigo-300 hover:underline transition-colors"
                  >
                    Choisir depuis la liste
                  </button>
                </>
              ) : (
                <>
                  {providersLoading ? (
                    <div className="w-full">
                      <label className="block text-sm font-medium text-slate-300 mb-1.5">
                        Provider
                      </label>
                      <div className="flex items-center py-2">
                        <div className="w-4 h-4 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
                        <span className="ml-2 text-sm text-slate-500">
                          Chargement des providers...
                        </span>
                      </div>
                    </div>
                  ) : providers.length > 0 ? (
                    <Select
                      label="Provider"
                      value={providerId}
                      onChange={(e) => setProviderId(e.target.value)}
                      options={providers.map((p) => ({
                        value: p.id,
                        label: `${p.businessName} (${p.id}) \u2014 ${p.plan}`,
                      }))}
                    />
                  ) : (
                    <Input
                      label="Provider ID"
                      value={providerId}
                      onChange={(e) => setProviderId(e.target.value)}
                      placeholder="test-provider-123"
                      hint="Aucun provider trouvé dans Firestore"
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => setManualProviderInput(true)}
                    className="mt-1 text-xs text-indigo-400 hover:text-indigo-300 hover:underline transition-colors"
                  >
                    Saisir un ID manuellement
                  </button>
                </>
              )}
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="trial-toggle"
                checked={trialEnabled}
                onChange={(e) => setTrialEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-slate-900"
              />
              <label
                htmlFor="trial-toggle"
                className="text-sm font-medium text-slate-300"
              >
                Période d&apos;essai (30 jours)
              </label>
            </div>

            {/* Prix dynamiques */}
            <div>
              <p className="text-sm font-medium text-slate-300 mb-3">
                Prix disponibles dans Stripe
              </p>

              {pricesLoading && (
                <div className="flex items-center justify-center py-8">
                  <div className="w-6 h-6 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
                  <span className="ml-3 text-sm text-slate-500">
                    Chargement des prix...
                  </span>
                </div>
              )}

              {pricesError && (
                <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/5">
                  <p className="text-sm text-red-400">
                    Erreur lors du chargement des prix : {pricesError}
                  </p>
                </div>
              )}

              {!pricesLoading && !pricesError && prices.length === 0 && (
                <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5">
                  <p className="text-sm text-amber-400">
                    Aucun produit trouvé dans Stripe. Créez d&apos;abord un produit
                    dans le dashboard Stripe.
                  </p>
                </div>
              )}

              {!pricesLoading && !pricesError && prices.length > 0 && (
                <div className="grid gap-3">
                  {prices.map((price) => {
                    const isSelected = selectedPriceId === price.id;
                    return (
                      <button
                        key={price.id}
                        onClick={() => handleCheckout(price.id)}
                        disabled={checkoutLoading}
                        className={`group w-full text-left p-4 rounded-xl border transition-all duration-300 ${
                          isSelected
                            ? 'border-indigo-500/50 bg-indigo-500/10 ring-1 ring-indigo-500/30 shadow-[0_0_20px_rgba(99,102,241,0.15)]'
                            : 'border-slate-700/50 bg-slate-800/40 hover:border-indigo-500/30 hover:bg-slate-800/80 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/20'
                        } ${checkoutLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-white">
                              {price.productName}
                            </p>
                            <p className="text-xs font-mono text-slate-500 mt-0.5">
                              {price.id}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold text-white">
                              {formatCurrency(price.unitAmount, price.currency)}
                              <span className="text-sm font-normal text-slate-400 ml-0.5">
                                {formatInterval(price.interval, price.intervalCount)}
                              </span>
                            </p>
                            {price.trialDays && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mt-1">
                                <Sparkles className="w-3 h-3" />
                                {price.trialDays}j d&apos;essai
                              </span>
                            )}
                          </div>
                        </div>
                        {!isSelected && (
                          <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-600 group-hover:text-indigo-400 transition-colors">
                            <ExternalLink className="w-3 h-3" />
                            Cliquer pour lancer le checkout
                          </div>
                        )}
                        {isSelected && (
                          <div className="mt-3 flex items-center gap-2 text-sm text-indigo-400">
                            <div className="w-4 h-4 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
                            Redirection vers Stripe...
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Section 3: Customer Portal Test */}
        <div className="relative overflow-hidden rounded-xl border border-slate-800/50">
          <div className="absolute inset-0 bg-slate-900" />
          <div className="relative px-6 py-4 border-b border-slate-800/50 flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="p-1.5 rounded-lg bg-violet-500/10">
                <Shield className="w-4 h-4 text-violet-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Customer Portal Test</h3>
                <p className="text-sm text-slate-400">Tester l&apos;ouverture du portail client Stripe</p>
              </div>
            </div>
            <Badge variant="info">Test</Badge>
          </div>
          <div className="relative p-6 space-y-4">
            <Input
              label="Customer ID"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              placeholder="cus_xxx"
            />

            <Button
              onClick={handlePortal}
              loading={portalLoading}
              disabled={!customerId.trim()}
              fullWidth
              variant="primary"
            >
              Ouvrir le Portal
            </Button>
          </div>
        </div>

        {/* Section 4: Plans disponibles */}
        <div className="relative overflow-hidden rounded-xl border border-slate-800/50">
          <div className="absolute inset-0 bg-slate-900" />
          <div className="relative px-6 py-4 border-b border-slate-800/50">
            <div className="flex items-center gap-3">
              <div className="p-1.5 rounded-lg bg-purple-500/10">
                <Crown className="w-4 h-4 text-purple-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Plans disponibles</h3>
                <p className="text-sm text-slate-400">Informations sur les plans d&apos;abonnement (SUBSCRIPTION_PLANS)</p>
              </div>
            </div>
          </div>
          <div className="relative p-6 space-y-4">
            {/* Solo Plan */}
            <div className="group relative overflow-hidden rounded-xl border border-slate-700/50 hover:border-indigo-500/30 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/20">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-indigo-500/10">
                      <Zap className="w-4 h-4 text-indigo-400" />
                    </div>
                    <span className="text-lg font-bold text-white">
                      {SUBSCRIPTION_PLANS.solo.name}
                    </span>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                    Solo
                  </span>
                </div>
                <div className="flex gap-6 mb-4">
                  <div>
                    <span className="text-3xl font-bold bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
                      {formatPrice(SUBSCRIPTION_PLANS.solo.monthlyPrice)}
                    </span>
                    <span className="text-sm text-slate-400">/mois</span>
                  </div>
                  <div className="border-l border-slate-800 pl-6">
                    <span className="text-3xl font-bold bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
                      {formatPrice(SUBSCRIPTION_PLANS.solo.yearlyPrice)}
                    </span>
                    <span className="text-sm text-slate-400">/an</span>
                  </div>
                </div>
                <ul className="space-y-2">
                  {SUBSCRIPTION_PLANS.solo.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-2.5 text-sm text-slate-400">
                      <div className="w-4 h-4 rounded-full bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                        <Check className="w-2.5 h-2.5 text-emerald-400" />
                      </div>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Team Plan */}
            <div className="group relative overflow-hidden rounded-xl border border-slate-700/50 hover:border-purple-500/30 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/20">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              {/* Popular tag */}
              <div className="absolute top-3 right-3">
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/25">
                  POPULAIRE
                </span>
              </div>
              <div className="relative p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-purple-500/10">
                      <Users className="w-4 h-4 text-purple-400" />
                    </div>
                    <span className="text-lg font-bold text-white">
                      {SUBSCRIPTION_PLANS.team.name}
                    </span>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">
                    Team
                  </span>
                </div>
                <div className="flex flex-col gap-2 mb-4">
                  <div>
                    <span className="text-3xl font-bold bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
                      {formatPrice(SUBSCRIPTION_PLANS.team.baseMonthlyPrice)}
                    </span>
                    <span className="text-sm text-slate-400">
                      /mois (5 membres inclus)
                    </span>
                  </div>
                  <div>
                    <span className="text-3xl font-bold bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
                      {formatPrice(SUBSCRIPTION_PLANS.team.baseYearlyPrice)}
                    </span>
                    <span className="text-sm text-slate-400">
                      /an (5 membres inclus)
                    </span>
                  </div>
                </div>
                <ul className="space-y-2">
                  {SUBSCRIPTION_PLANS.team.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-2.5 text-sm text-slate-400">
                      <div className="w-4 h-4 rounded-full bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                        <Check className="w-2.5 h-2.5 text-emerald-400" />
                      </div>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Logs - Terminal Style */}
        <div className="relative overflow-hidden rounded-xl border border-slate-700/50">
          {/* Terminal header */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-slate-800/80 border-b border-slate-700/50">
            <div className="flex items-center gap-3">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500/60" />
                <div className="w-3 h-3 rounded-full bg-amber-500/60" />
                <div className="w-3 h-3 rounded-full bg-emerald-500/60" />
              </div>
              <div className="flex items-center gap-2">
                <Terminal className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-[11px] text-slate-500 font-mono font-medium">api-logs</span>
              </div>
            </div>
            {logs.length > 0 && (
              <button
                onClick={clearLogs}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200"
              >
                <Trash2 className="w-3 h-3" />
                Effacer
              </button>
            )}
          </div>
          {/* Terminal body */}
          <div className="bg-slate-950 p-4 min-h-[140px] max-h-[320px] overflow-y-auto font-mono text-xs">
            {logs.length === 0 ? (
              <div className="flex items-center gap-2 text-slate-600">
                <CircleDot className="w-3 h-3" />
                Aucun log. Lancez un test pour voir les résultats.
              </div>
            ) : (
              logs.map((log, i) => (
                <div key={i} className="py-0.5 flex gap-2">
                  <span className="text-slate-600 flex-shrink-0">[{log.time}]</span>
                  <span className={`${
                    log.message.startsWith('Erreur')
                      ? 'text-red-400'
                      : log.message.startsWith('Redirection')
                        ? 'text-emerald-400'
                        : log.message.startsWith('Session')
                          ? 'text-blue-400'
                          : 'text-slate-300'
                  }`}>
                    {log.message}
                  </span>
                </div>
              ))
            )}
            {/* Blinking cursor */}
            <div className="flex items-center gap-1 mt-1">
              <span className="text-emerald-500">$</span>
              <span className="w-2 h-4 bg-emerald-500/60 animate-pulse" />
            </div>
          </div>
        </div>

        {/* Instructions - Step by Step */}
        <div className="relative overflow-hidden rounded-xl border border-slate-800/50">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900 to-slate-950" />
          <div className="relative px-6 py-4 border-b border-slate-800/50">
            <div className="flex items-center gap-3">
              <div className="p-1.5 rounded-lg bg-amber-500/10">
                <BookOpen className="w-4 h-4 text-amber-400" />
              </div>
              <h3 className="text-base font-semibold text-white">Instructions</h3>
            </div>
          </div>
          <div className="relative p-6">
            <div className="space-y-4">
              {[
                {
                  step: 1,
                  text: (
                    <>
                      Configurez les variables d&apos;environnement{' '}
                      <code className="px-1.5 py-0.5 rounded-md bg-slate-800 text-amber-400 text-xs font-mono border border-slate-700/50">
                        STRIPE_SECRET_KEY
                      </code>{' '}
                      et{' '}
                      <code className="px-1.5 py-0.5 rounded-md bg-slate-800 text-amber-400 text-xs font-mono border border-slate-700/50">
                        NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
                      </code>
                    </>
                  ),
                },
                {
                  step: 2,
                  text: 'Les prix actifs de votre compte Stripe sont chargés automatiquement',
                },
                {
                  step: 3,
                  text: 'Cliquez sur un prix pour lancer le Checkout',
                },
                {
                  step: 4,
                  text: 'Après le paiement, vous serez redirigé ici avec le résultat',
                },
                {
                  step: 5,
                  text: (
                    <>
                      Pour le Portal, utilisez un{' '}
                      <code className="px-1.5 py-0.5 rounded-md bg-slate-800 text-amber-400 text-xs font-mono border border-slate-700/50">
                        cus_xxx
                      </code>{' '}
                      existant depuis Stripe
                    </>
                  ),
                },
              ].map((item) => (
                <div key={item.step} className="flex items-start gap-4 group">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                    <span className="text-xs font-bold text-indigo-400">{item.step}</span>
                  </div>
                  <p className="text-sm text-slate-400 pt-1.5 leading-relaxed">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
