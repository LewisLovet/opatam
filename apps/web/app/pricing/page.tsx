'use client';

import { useState, useEffect, Suspense, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { APP_CONFIG, SUBSCRIPTION_PLANS } from '@booking-app/shared';
import {
  Check,
  Sparkles,
  Crown,
  Users,
  Zap,
  Star,
  ArrowRight,
  Shield,
  Clock,
  X,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Settings,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StripePrice {
  id: string;
  productName: string;
  unitAmount: number;
  currency: string;
  interval: string | null;
  intervalCount: number | null;
  trialDays?: number;
  plan: string | null;
  features: string[];
  planName: string | null;
  planDescription: string | null;
}

type BillingInterval = 'month' | 'year';

// ---------------------------------------------------------------------------
// Plan metadata: icons, accent colours, visual treatment
// ---------------------------------------------------------------------------

const PLAN_META: Record<
  string,
  {
    icon: React.ElementType;
    accent: string;
    accentBg: string;
    accentBorder: string;
    accentText: string;
    gradient: string;
    ring: string;
    badge?: string;
    badgeStyle?: string;
    cardStyle?: string;
  }
> = {
  solo: {
    icon: Zap,
    accent: 'text-blue-600',
    accentBg: 'bg-blue-50',
    accentBorder: 'border-blue-200',
    accentText: 'text-blue-700',
    gradient: 'from-blue-500 to-blue-600',
    ring: 'ring-blue-500/20',
  },
  team: {
    icon: Users,
    accent: 'text-violet-600',
    accentBg: 'bg-violet-50',
    accentBorder: 'border-violet-200',
    accentText: 'text-violet-700',
    gradient: 'from-violet-500 to-purple-600',
    ring: 'ring-violet-500/20',
    badge: 'Recommandé',
    badgeStyle:
      'bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-lg shadow-violet-500/25',
    cardStyle: 'border-violet-300 shadow-xl shadow-violet-500/10 ring-1 ring-violet-200',
  },
  test: {
    icon: Settings,
    accent: 'text-gray-500',
    accentBg: 'bg-gray-50',
    accentBorder: 'border-gray-200',
    accentText: 'text-gray-600',
    gradient: 'from-gray-400 to-gray-500',
    ring: 'ring-gray-400/20',
    badge: 'Plan Test',
    badgeStyle: 'bg-gray-100 text-gray-500 border border-gray-300',
    cardStyle: 'border-dashed opacity-80',
  },
};

// ---------------------------------------------------------------------------
// FAQ Data
// ---------------------------------------------------------------------------

const FAQ_ITEMS = [
  {
    q: "Que se passe-t-il à la fin de l'essai gratuit ?",
    a: "À la fin des 30 jours d'essai, votre abonnement commence automatiquement. Vous ne serez débité qu'après la période d'essai. Vous pouvez annuler à tout moment avant la fin de l'essai sans être facturé.",
  },
  {
    q: 'Puis-je changer de plan à tout moment ?',
    a: "Oui, vous pouvez passer d'un plan Pro à un plan Studio (ou inversement) à tout moment depuis votre espace professionnel. Le changement est effectif immédiatement et la facturation est ajustée au prorata.",
  },
  {
    q: 'Comment fonctionne la facturation annuelle ?',
    a: "Avec la facturation annuelle, vous payez une seule fois pour 12 mois d'utilisation et vous bénéficiez d'une réduction significative par rapport au tarif mensuel. Le montant est débité en une seule fois au début de la période.",
  },
  {
    q: "Y a-t-il des frais supplémentaires ou des commissions ?",
    a: "Non. Opatam fonctionne avec un prix fixe mensuel ou annuel, sans aucune commission sur vos réservations. Pas de frais cachés, pas de surprises. Vous gardez 100% de vos revenus.",
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatPrice(cents: number): string {
  const amount = cents / 100;
  if (Number.isInteger(amount)) return `${amount}`;
  return amount.toFixed(2).replace('.', ',');
}

function computeYearlySaving(monthlyPrice: StripePrice, yearlyPrice: StripePrice): number {
  const yearlyFromMonthly = monthlyPrice.unitAmount * 12;
  if (yearlyFromMonthly === 0) return 0;
  return Math.round(((yearlyFromMonthly - yearlyPrice.unitAmount) / yearlyFromMonthly) * 100);
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusBanner() {
  const searchParams = useSearchParams();
  const success = searchParams.get('success');
  const cancelled = searchParams.get('cancelled');

  if (success === 'true') {
    return (
      <div className="mx-auto max-w-3xl mb-8 animate-in fade-in slide-in-from-top-2 duration-500">
        <div className="flex items-center gap-3 px-5 py-4 rounded-xl bg-emerald-50 border border-emerald-200">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <div>
            <p className="font-semibold text-emerald-900">Paiement réussi !</p>
            <p className="text-sm text-emerald-700">
              Votre abonnement est maintenant actif. Bienvenue sur Opatam !
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (cancelled === 'true') {
    return (
      <div className="mx-auto max-w-3xl mb-8 animate-in fade-in slide-in-from-top-2 duration-500">
        <div className="flex items-center gap-3 px-5 py-4 rounded-xl bg-amber-50 border border-amber-200">
          <XCircle className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <div>
            <p className="font-semibold text-amber-900">Paiement annulé</p>
            <p className="text-sm text-amber-700">
              Vous avez annulé le paiement. N&apos;hésitez pas à réessayer lorsque vous serez prêt.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-b border-gray-100 last:border-0">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full py-5 text-left group"
      >
        <span className="font-medium text-gray-900 pr-4 group-hover:text-blue-600 transition-colors">
          {question}
        </span>
        {isOpen ? (
          <ChevronUp className="w-5 h-5 text-gray-400 flex-shrink-0" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />
        )}
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          isOpen ? 'max-h-96 pb-5' : 'max-h-0'
        }`}
      >
        <p className="text-gray-600 text-sm leading-relaxed">{answer}</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Plan Card
// ---------------------------------------------------------------------------

function PlanCard({
  price,
  allPrices,
  billingInterval,
  providerId,
  onCheckout,
  isLoading,
  loadingPriceId,
}: {
  price: StripePrice;
  allPrices: StripePrice[];
  billingInterval: BillingInterval;
  providerId: string;
  onCheckout: (priceId: string) => void;
  isLoading: boolean;
  loadingPriceId: string | null;
}) {
  const plan = price.plan ?? 'solo';
  const meta = PLAN_META[plan] ?? PLAN_META.solo;
  const Icon = meta.icon;
  const isPopular = plan === 'team';
  const isTest = plan === 'test';
  const isThisLoading = loadingPriceId === price.id;

  // Compute yearly savings
  let savingPercent = 0;
  if (billingInterval === 'year') {
    const monthlyPriceForPlan = allPrices.find(
      (p) => p.plan === plan && p.interval === 'month'
    );
    if (monthlyPriceForPlan) {
      savingPercent = computeYearlySaving(monthlyPriceForPlan, price);
    }
  }

  const isFree = price.unitAmount === 0;
  const displayPrice = formatPrice(price.unitAmount);
  const intervalLabel = price.interval === 'year' ? '/an' : '/mois';

  // Team plan includes up to 5 members
  const memberPriceLabel = plan === 'team' ? 'Jusqu\u2019à 5 membres inclus' : null;

  return (
    <div
      className={`relative flex flex-col rounded-2xl border bg-white transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${
        isPopular
          ? 'border-violet-300 shadow-xl shadow-violet-500/15 ring-1 ring-violet-200'
          : isTest
            ? 'border-dashed border-gray-300 opacity-85 hover:opacity-100'
            : 'border-gray-200 shadow-sm hover:shadow-lg hover:border-gray-300'
      }`}
    >
      {/* Gradient accent bar at the top of the popular card */}
      {isPopular && (
        <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl bg-gradient-to-r from-violet-500 via-purple-500 to-violet-600" />
      )}

      {/* Subtle gradient background for the popular card */}
      {isPopular && (
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-violet-50/60 via-white to-white pointer-events-none" />
      )}

      {/* Popular / Test badge */}
      {meta.badge && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-10">
          <span
            className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap ${meta.badgeStyle}`}
          >
            {isPopular && <Crown className="w-3.5 h-3.5" />}
            {meta.badge}
          </span>
        </div>
      )}

      <div className={`relative flex flex-col flex-1 p-7 ${isPopular ? 'pt-9' : 'pt-8'}`}>
        {/* Plan header */}
        <div className="flex items-center gap-3 mb-3">
          <div
            className={`flex items-center justify-center w-11 h-11 rounded-xl ${meta.accentBg}`}
          >
            <Icon className={`w-5 h-5 ${meta.accent}`} />
          </div>
          <h3 className="text-lg font-bold text-gray-900">
            {price.planName ?? price.productName}
          </h3>
        </div>

        {/* Description */}
        {price.planDescription && (
          <p className="text-sm text-gray-500 leading-relaxed mb-6 min-h-[2.5rem]">
            {price.planDescription}
          </p>
        )}
        {isTest && !price.planDescription && (
          <p className="text-xs text-gray-400 mb-6 min-h-[2.5rem]">Vérification du flow de paiement</p>
        )}

        {/* Price */}
        <div className="mb-6">
          <div className="flex items-baseline gap-1">
            {isFree ? (
              <span className="text-4xl font-extrabold text-gray-900">Gratuit</span>
            ) : (
              <>
                <span className="text-4xl font-extrabold text-gray-900">
                  {displayPrice}&euro;
                </span>
                <span className="text-base text-gray-500 font-medium">{intervalLabel}</span>
              </>
            )}
          </div>

          {/* Per-member pricing for team plan */}
          {memberPriceLabel && (
            <p className="text-xs text-violet-600/80 font-medium mt-1.5">
              {memberPriceLabel}
            </p>
          )}

          {!isFree && !isTest && (
            <p className="text-sm font-semibold text-emerald-600 mt-2">
              Sans engagement
            </p>
          )}

          <div className="flex flex-wrap gap-2 mt-3">
            {savingPercent > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-xs font-semibold text-emerald-700">
                  -{savingPercent}%
                </span>
              </span>
            )}
            {price.trialDays && price.trialDays > 0 && !isFree && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200">
                <Clock className="w-3.5 h-3.5 text-blue-600" />
                <span className="text-xs font-semibold text-blue-700">
                  {price.trialDays}j d&apos;essai gratuit
                </span>
              </span>
            )}
          </div>
        </div>

        {/* Divider */}
        <div className={`border-t mb-6 ${isPopular ? 'border-violet-100' : 'border-gray-100'}`} />

        {/* Features */}
        <ul className="space-y-3.5 mb-8 flex-1">
          {price.features.map((feature, i) => (
            <li key={i} className="flex items-start gap-3">
              <div
                className={`flex items-center justify-center w-5 h-5 rounded-full flex-shrink-0 mt-0.5 ${
                  isTest ? 'bg-gray-100' : meta.accentBg
                }`}
              >
                <Check
                  className={`w-3 h-3 ${isTest ? 'text-gray-400' : meta.accent}`}
                />
              </div>
              <span className={`text-sm leading-relaxed ${isTest ? 'text-gray-500' : 'text-gray-700'}`}>
                {feature}
              </span>
            </li>
          ))}
        </ul>

        {/* CTA */}
        <button
          type="button"
          onClick={() => onCheckout(price.id)}
          disabled={isLoading || !providerId.trim()}
          className={`w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl text-sm font-bold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
            isPopular
              ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white hover:from-violet-700 hover:to-purple-700 shadow-lg shadow-violet-500/25 hover:shadow-xl hover:shadow-violet-500/30 hover:scale-[1.02]'
              : isTest
                ? 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200'
                : 'bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/30 hover:scale-[1.02]'
          }`}
        >
          {isThisLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Redirection...
            </>
          ) : isFree ? (
            <>Tester gratuitement</>
          ) : price.trialDays && price.trialDays > 0 ? (
            <>
              Commencer l&apos;essai gratuit
              <ArrowRight className="w-4 h-4" />
            </>
          ) : (
            <>
              Choisir {price.planName ?? 'ce plan'}
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

function PricingPageContent() {
  // Data
  const [prices, setPrices] = useState<StripePrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // UI
  const [billingInterval, setBillingInterval] = useState<BillingInterval>('month');
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [loadingPriceId, setLoadingPriceId] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  // Provider ID (testing — collapsible)
  const [providerId, setProviderId] = useState('');
  const [showProviderInput, setShowProviderInput] = useState(false);
  const [trialEnabled, setTrialEnabled] = useState(true);

  // Fetch prices
  useEffect(() => {
    const fetchPrices = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/stripe/prices');
        if (!res.ok) throw new Error(`Erreur ${res.status}`);
        const data = await res.json();
        setPrices(data.prices ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur inconnue');
      } finally {
        setLoading(false);
      }
    };
    fetchPrices();
  }, []);

  // Group prices by plan and filter by current interval
  const getVisiblePrices = useCallback((): StripePrice[] => {
    // Get unique plans
    const planSet = new Set(prices.map((p) => p.plan));
    const result: StripePrice[] = [];

    for (const plan of planSet) {
      // For each plan, find the price matching the current billing interval
      const match = prices.find(
        (p) => p.plan === plan && p.interval === billingInterval
      );
      if (match) {
        result.push(match);
      } else {
        // Fallback: use first price for this plan (for test plan with only monthly, etc.)
        const fallback = prices.find((p) => p.plan === plan);
        if (fallback) result.push(fallback);
      }
    }

    // Preserve API sort order (solo, team, test)
    const order: Record<string, number> = { solo: 0, team: 1, test: 2 };
    result.sort(
      (a, b) => (order[a.plan ?? ''] ?? 99) - (order[b.plan ?? ''] ?? 99)
    );

    return result;
  }, [prices, billingInterval]);

  // Compute max yearly savings for the toggle badge
  const maxYearlySaving = useCallback((): number => {
    let maxSaving = 0;
    const plans = new Set(prices.map((p) => p.plan));
    for (const plan of plans) {
      const monthly = prices.find((p) => p.plan === plan && p.interval === 'month');
      const yearly = prices.find((p) => p.plan === plan && p.interval === 'year');
      if (monthly && yearly) {
        const saving = computeYearlySaving(monthly, yearly);
        if (saving > maxSaving) maxSaving = saving;
      }
    }
    return maxSaving;
  }, [prices]);

  // Checkout handler
  const handleCheckout = async (priceId: string) => {
    if (!providerId.trim()) {
      setShowProviderInput(true);
      setCheckoutError('Veuillez entrer un Provider ID pour continuer.');
      return;
    }

    setCheckoutLoading(true);
    setLoadingPriceId(priceId);
    setCheckoutError(null);

    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priceId,
          providerId: providerId.trim(),
          plan: prices.find((p) => p.id === priceId)?.plan ?? undefined,
          ...(trialEnabled ? { trialDays: APP_CONFIG.trialDays } : {}),
          successUrl: '/pricing',
          cancelUrl: '/pricing',
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setCheckoutError(data.message || data.error || 'Erreur lors du checkout');
        return;
      }

      if (data.url) {
        window.location.href = data.url;
      } else {
        setCheckoutError("Pas d'URL de checkout reçu");
      }
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setCheckoutLoading(false);
      setLoadingPriceId(null);
    }
  };

  const visiblePrices = getVisiblePrices();
  const saving = maxYearlySaving();

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-gray-50">
      {/* Provider ID config bar — discreet collapsible at very top */}
      <div className="bg-gray-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <button
            type="button"
            onClick={() => setShowProviderInput(!showProviderInput)}
            className="w-full flex items-center justify-between py-2.5 text-xs text-gray-400 hover:text-gray-200 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Settings className="w-3.5 h-3.5" />
              <span>Configuration test</span>
              {providerId && (
                <span className="px-2 py-0.5 rounded bg-gray-800 text-gray-300 font-mono text-[10px]">
                  {providerId}
                </span>
              )}
            </div>
            {showProviderInput ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>

          <div
            className={`overflow-hidden transition-all duration-300 ${
              showProviderInput ? 'max-h-40 pb-4' : 'max-h-0'
            }`}
          >
            <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3">
              <div className="flex-1 w-full sm:max-w-xs">
                <label className="block text-xs text-gray-400 mb-1">Provider ID</label>
                <input
                  type="text"
                  value={providerId}
                  onChange={(e) => setProviderId(e.target.value)}
                  placeholder="ex: abc123..."
                  className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 font-mono"
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={trialEnabled}
                  onChange={(e) => setTrialEnabled(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-600 bg-gray-800 text-blue-500 focus:ring-blue-500 focus:ring-offset-gray-900"
                />
                <span className="text-xs text-gray-300">
                  Essai gratuit ({APP_CONFIG.trialDays} jours)
                </span>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Status banners */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-8">
        <Suspense fallback={null}>
          <StatusBanner />
        </Suspense>
      </div>

      {/* Checkout error */}
      {checkoutError && (
        <div className="max-w-3xl mx-auto px-4 sm:px-6 mb-4">
          <div className="flex items-center gap-3 px-5 py-4 rounded-xl bg-red-50 border border-red-200">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            <p className="text-sm text-red-700">{checkoutError}</p>
            <button
              type="button"
              onClick={() => setCheckoutError(null)}
              className="ml-auto text-red-400 hover:text-red-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="pt-12 sm:pt-20 pb-12 sm:pb-16 text-center px-4">
        {/* Logo / Home link */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xl font-extrabold text-gray-900 mb-8 hover:opacity-80 transition-opacity"
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
            <Star className="w-4 h-4 text-white" />
          </div>
          {APP_CONFIG.name}
        </Link>

        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-gray-900 tracking-tight max-w-2xl mx-auto">
          Choisissez le plan{' '}
          <span className="bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">
            idéal
          </span>{' '}
          pour votre activité
        </h1>
        <p className="mt-4 sm:mt-6 text-base sm:text-lg text-gray-500 max-w-xl mx-auto leading-relaxed">
          Lancez-vous avec {APP_CONFIG.trialDays} jours d&apos;essai gratuit.
          Sans engagement, sans commission sur vos réservations.
        </p>

        {/* Billing Toggle */}
        {!loading && prices.length > 0 && (
          <div className="mt-8 sm:mt-10 inline-flex items-center gap-3 p-1.5 rounded-full bg-gray-100 border border-gray-200">
            <button
              type="button"
              onClick={() => setBillingInterval('month')}
              className={`px-5 py-2 rounded-full text-sm font-semibold transition-all duration-200 ${
                billingInterval === 'month'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Mensuel
            </button>
            <button
              type="button"
              onClick={() => setBillingInterval('year')}
              className={`relative px-5 py-2 rounded-full text-sm font-semibold transition-all duration-200 ${
                billingInterval === 'year'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Annuel
              {saving > 0 && (
                <span className="absolute -top-2.5 -right-2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500 text-white shadow-sm">
                  -{saving}%
                </span>
              )}
            </button>
          </div>
        )}
      </header>

      {/* Plans Grid */}
      <section className="pb-16 sm:pb-24 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          {/* Loading skeleton */}
          {loading && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="rounded-2xl border border-gray-200 bg-white p-6 pt-8 animate-pulse"
                >
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-11 h-11 rounded-xl bg-gray-100" />
                    <div className="h-5 w-20 bg-gray-100 rounded" />
                  </div>
                  <div className="h-10 w-32 bg-gray-100 rounded mb-6" />
                  <div className="space-y-3">
                    {[1, 2, 3, 4].map((j) => (
                      <div key={j} className="flex items-center gap-3">
                        <div className="w-5 h-5 rounded-full bg-gray-100" />
                        <div className="h-4 flex-1 bg-gray-100 rounded" />
                      </div>
                    ))}
                  </div>
                  <div className="mt-8 h-12 bg-gray-100 rounded-xl" />
                </div>
              ))}
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div className="text-center py-16">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-red-50 mb-4">
                <AlertCircle className="w-8 h-8 text-red-500" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Impossible de charger les plans
              </h3>
              <p className="text-gray-500 mb-6">{error}</p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="px-6 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 transition-colors"
              >
                Réessayer
              </button>
            </div>
          )}

          {/* Empty */}
          {!loading && !error && prices.length === 0 && (
            <div className="text-center py-16">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-50 mb-4">
                <AlertCircle className="w-8 h-8 text-amber-500" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Aucun plan disponible
              </h3>
              <p className="text-gray-500">
                Les plans tarifaires ne sont pas encore configurés. Revenez bientôt.
              </p>
            </div>
          )}

          {/* Cards */}
          {!loading && !error && visiblePrices.length > 0 && (
            <div
              className={`grid gap-6 lg:gap-8 ${
                visiblePrices.length === 1
                  ? 'grid-cols-1 max-w-md mx-auto'
                  : visiblePrices.length === 2
                    ? 'grid-cols-1 md:grid-cols-2 max-w-3xl mx-auto'
                    : 'grid-cols-1 md:grid-cols-3'
              }`}
            >
              {visiblePrices.map((price) => (
                <PlanCard
                  key={price.id}
                  price={price}
                  allPrices={prices}
                  billingInterval={billingInterval}
                  providerId={providerId}
                  onCheckout={handleCheckout}
                  isLoading={checkoutLoading}
                  loadingPriceId={loadingPriceId}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Trust signals */}
      <section className="pb-16 sm:pb-20 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-50 mb-3">
                <Shield className="w-6 h-6 text-blue-600" />
              </div>
              <h4 className="font-semibold text-gray-900 mb-1">Paiement sécurisé</h4>
              <p className="text-sm text-gray-500">
                Via Stripe, leader mondial du paiement en ligne
              </p>
            </div>
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-50 mb-3">
                <Clock className="w-6 h-6 text-emerald-600" />
              </div>
              <h4 className="font-semibold text-gray-900 mb-1">{APP_CONFIG.trialDays}j d&apos;essai gratuit</h4>
              <p className="text-sm text-gray-500">
                Testez toutes les fonctionnalités sans engagement
              </p>
            </div>
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-violet-50 mb-3">
                <Sparkles className="w-6 h-6 text-violet-600" />
              </div>
              <h4 className="font-semibold text-gray-900 mb-1">0% de commission</h4>
              <p className="text-sm text-gray-500">
                Prix fixe, gardez 100% de vos revenus
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="pb-20 sm:pb-28 px-4 sm:px-6">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 text-center mb-2">
            Questions fréquentes
          </h2>
          <p className="text-center text-gray-500 mb-10">
            Tout ce que vous devez savoir avant de commencer
          </p>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-6 sm:px-8 divide-y divide-gray-100">
            {FAQ_ITEMS.map((item, i) => (
              <FAQItem key={i} question={item.q} answer={item.a} />
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-400">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
              <Star className="w-2.5 h-2.5 text-white" />
            </div>
            <span className="font-semibold text-gray-500">{APP_CONFIG.name}</span>
          </div>
          <p>&copy; {new Date().getFullYear()} {APP_CONFIG.name}. Tous droits réservés.</p>
        </div>
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Default export — wraps content in Suspense for useSearchParams
// ---------------------------------------------------------------------------

export default function PricingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-gray-50 flex items-center justify-center">
          <div className="flex items-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            <span className="text-gray-500 font-medium">Chargement...</span>
          </div>
        </div>
      }
    >
      <PricingPageContent />
    </Suspense>
  );
}
