'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui';
import { getDaysRemaining } from '@/lib/date-utils';
import { APP_CONFIG, PLAN_LIMITS } from '@booking-app/shared';
import { memberService, locationService } from '@booking-app/firebase';
import {
  Sparkles,
  Clock,
  Zap,
  Users,
  Check,
  ExternalLink,
  Loader2,
  AlertCircle,
  RefreshCw,
  CreditCard,
  AlertTriangle,
  XCircle,
  ArrowRightLeft,
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
// Helpers
// ---------------------------------------------------------------------------

function formatPrice(cents: number): string {
  const amount = cents / 100;
  if (Number.isInteger(amount)) return `${amount}`;
  return amount.toFixed(2).replace('.', ',');
}

function formatDate(date: Date | null | undefined): string {
  if (!date) return '';
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(date));
}

function computeYearlySaving(
  monthlyPrice: StripePrice,
  yearlyPrice: StripePrice
): number {
  const yearlyFromMonthly = monthlyPrice.unitAmount * 12;
  if (yearlyFromMonthly === 0) return 0;
  return Math.round(
    ((yearlyFromMonthly - yearlyPrice.unitAmount) / yearlyFromMonthly) * 100
  );
}

// ---------------------------------------------------------------------------
// Section 1: Current Status Card
// ---------------------------------------------------------------------------

function CurrentStatusCard() {
  const { provider } = useAuth();

  const plan = provider?.plan || 'trial';
  const subscription = provider?.subscription;
  const status = subscription?.status || 'trialing';

  const daysRemaining = subscription?.validUntil
    ? getDaysRemaining(subscription.validUntil)
    : 0;

  const totalTrialDays = APP_CONFIG.trialDays;
  const progressPercent =
    plan === 'trial'
      ? Math.max(0, Math.min(100, (daysRemaining / totalTrialDays) * 100))
      : 0;

  const getProgressColor = () => {
    if (daysRemaining <= 1) return 'bg-red-500';
    if (daysRemaining <= 3) return 'bg-orange-500';
    return 'bg-emerald-500';
  };

  const getPlanLabel = (p: string) => {
    switch (p) {
      case 'trial':
        return 'Essai gratuit';
      case 'solo':
        return 'Pro';
      case 'team':
        return 'Studio';
      case 'test':
        return 'Test';
      default:
        return p;
    }
  };

  // A paid plan (solo/team) can be in 'trialing' status (Stripe trial period)
  const isPaidPlan = plan === 'solo' || plan === 'team' || plan === 'test';

  const getPlanBadgeVariant = () => {
    if (status === 'cancelled') return 'error' as const;
    if (status === 'past_due') return 'warning' as const;
    if (plan === 'trial') return 'warning' as const;
    if (status === 'active' || (isPaidPlan && status === 'trialing')) return 'success' as const;
    return 'default' as const;
  };

  const getBadgeLabel = () => {
    if (status === 'cancelled') return 'Annule';
    if (status === 'past_due') return 'Paiement en attente';
    if (plan === 'trial') {
      return daysRemaining > 0 ? 'En cours' : 'Expire';
    }
    if (status === 'active') return 'Actif';
    if (isPaidPlan && status === 'trialing') return 'Actif';
    return status;
  };

  return (
    <div className="p-6 bg-gradient-to-br from-primary-500/10 via-primary-600/5 to-transparent dark:from-primary-500/20 dark:via-primary-600/10 dark:to-transparent rounded-xl border border-primary-200 dark:border-primary-800">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Votre abonnement actuel
            </span>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
            {getPlanLabel(plan)}
          </h3>
        </div>
        <Badge variant={getPlanBadgeVariant()}>{getBadgeLabel()}</Badge>
      </div>

      {/* Trial-specific content */}
      {plan === 'trial' && (
        <div className="mt-5">
          {daysRemaining > 0 ? (
            <>
              <div className="flex items-baseline gap-2 mb-3">
                <span className="text-4xl font-extrabold text-gray-900 dark:text-white">
                  {daysRemaining}
                </span>
                <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  {daysRemaining === 1 ? 'jour restant' : 'jours restants'}
                </span>
              </div>
              <div className="w-full h-2.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-3">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${getProgressColor()}`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Votre essai gratuit se termine dans {daysRemaining}{' '}
                {daysRemaining === 1 ? 'jour' : 'jours'}
              </p>
            </>
          ) : (
            <div className="mt-3 flex items-center gap-2 text-red-600 dark:text-red-400">
              <AlertTriangle className="w-4 h-4" />
              <p className="text-sm font-medium">
                Votre periode d&apos;essai est terminee
              </p>
            </div>
          )}
        </div>
      )}

      {/* Active subscription content */}
      {isPaidPlan && (status === 'active' || status === 'trialing') && (
        <div className="mt-4 space-y-2">
          {subscription?.currentPeriodEnd && (
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <Clock className="w-4 h-4" />
              <span>
                Prochaine echeance : {formatDate(subscription.currentPeriodEnd)}
              </span>
            </div>
          )}
          {subscription?.cancelAtPeriodEnd && (
            <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-4 h-4" />
              <span>
                Votre abonnement se termine le{' '}
                {formatDate(subscription.currentPeriodEnd)}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Past due */}
      {status === 'past_due' && (
        <div className="mt-4 flex items-center gap-2 text-amber-600 dark:text-amber-400">
          <AlertTriangle className="w-4 h-4" />
          <p className="text-sm font-medium">
            Paiement en attente. Veuillez mettre a jour votre moyen de paiement.
          </p>
        </div>
      )}

      {/* Cancelled */}
      {status === 'cancelled' && (
        <div className="mt-4 flex items-center gap-2 text-red-600 dark:text-red-400">
          <XCircle className="w-4 h-4" />
          <p className="text-sm font-medium">
            Abonnement annule
            {subscription?.validUntil && (
              <>. Acces valide jusqu&apos;au {formatDate(subscription.validUntil)}</>
            )}
          </p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section 2: Choose a Plan
// ---------------------------------------------------------------------------

function ChoosePlanSection({
  mode = 'subscribe',
  currentPlan,
  subscriptionId,
  onPlanChanged,
}: {
  mode?: 'subscribe' | 'change';
  currentPlan?: string | null;
  subscriptionId?: string | null;
  onPlanChanged?: () => void;
}) {
  const { provider, user } = useAuth();
  const providerId = (provider as any)?.id || user?.providerId;

  const [prices, setPrices] = useState<StripePrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [billingInterval, setBillingInterval] = useState<BillingInterval>('month');
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [loadingPriceId, setLoadingPriceId] = useState<string | null>(null);
  const [activeMemberCount, setActiveMemberCount] = useState<number>(1);
  const [activeLocationCount, setActiveLocationCount] = useState<number>(1);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchPrices = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    fetchPrices();
  }, [fetchPrices]);

  useEffect(() => {
    if (!providerId) return;
    memberService
      .getActiveByProvider(providerId)
      .then((members) => setActiveMemberCount(members.length))
      .catch(() => setActiveMemberCount(1));
    locationService
      .getActiveByProvider(providerId)
      .then((locations) => setActiveLocationCount(locations.length))
      .catch(() => setActiveLocationCount(1));
  }, [providerId]);

  // Filter plans: hide 'test' plan in production only
  const isDev = process.env.NODE_ENV !== 'production';
  const getVisiblePrices = useCallback((): StripePrice[] => {
    const filtered = prices.filter((p) => p.plan !== null && (isDev || p.plan !== 'test'));
    const planSet = new Set(filtered.map((p) => p.plan));
    const result: StripePrice[] = [];

    for (const plan of planSet) {
      const match = filtered.find(
        (p) => p.plan === plan && p.interval === billingInterval
      );
      if (match) {
        result.push(match);
      } else {
        const fallback = filtered.find((p) => p.plan === plan);
        if (fallback) result.push(fallback);
      }
    }

    const order: Record<string, number> = { solo: 0, team: 1 };
    result.sort(
      (a, b) => (order[a.plan ?? ''] ?? 99) - (order[b.plan ?? ''] ?? 99)
    );

    return result;
  }, [prices, billingInterval]);

  // Compute max yearly savings for toggle badge
  const maxYearlySaving = useCallback((): number => {
    let maxSaving = 0;
    const plans = new Set(prices.filter((p) => p.plan !== 'test').map((p) => p.plan));
    for (const plan of plans) {
      const monthly = prices.find(
        (p) => p.plan === plan && p.interval === 'month'
      );
      const yearly = prices.find(
        (p) => p.plan === plan && p.interval === 'year'
      );
      if (monthly && yearly) {
        const saving = computeYearlySaving(monthly, yearly);
        if (saving > maxSaving) maxSaving = saving;
      }
    }
    return maxSaving;
  }, [prices]);

  const handleCheckout = async (priceId: string) => {
    if (!providerId) return;

    setCheckoutLoading(true);
    setLoadingPriceId(priceId);

    try {
      const selectedPrice = prices.find((p) => p.id === priceId);
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priceId,
          providerId,
          plan: selectedPrice?.plan ?? undefined,
          successUrl: '/pro/parametres?tab=abonnement',
          cancelUrl: '/pro/parametres?tab=abonnement',
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || data.error || 'Erreur lors du checkout');
        return;
      }

      if (data.url) {
        window.location.href = data.url;
      } else {
        setError("Pas d'URL de checkout recu");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setCheckoutLoading(false);
      setLoadingPriceId(null);
    }
  };

  const handleChangePlan = async (priceId: string) => {
    if (!providerId || !subscriptionId) return;

    setCheckoutLoading(true);
    setLoadingPriceId(priceId);
    setError(null);
    setSuccessMessage(null);

    try {
      const selectedPrice = prices.find((p) => p.id === priceId);
      const res = await fetch('/api/stripe/change-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscriptionId,
          newPriceId: priceId,
          newPlan: selectedPrice?.plan ?? 'solo',
          providerId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || 'Erreur lors du changement de plan');
        return;
      }

      setSuccessMessage(`Plan mis a jour vers ${selectedPrice?.planName ?? selectedPrice?.plan}. Les changements seront appliques sous peu.`);
      onPlanChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setCheckoutLoading(false);
      setLoadingPriceId(null);
    }
  };

  const visiblePrices = getVisiblePrices();
  const saving = maxYearlySaving();

  const PLAN_META: Record<
    string,
    { icon: React.ElementType; accentBg: string; accent: string; gradient: string }
  > = {
    solo: {
      icon: Zap,
      accentBg: 'bg-blue-50 dark:bg-blue-900/30',
      accent: 'text-blue-600 dark:text-blue-400',
      gradient:
        'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-blue-500/20 hover:shadow-blue-500/30',
    },
    team: {
      icon: Users,
      accentBg: 'bg-violet-50 dark:bg-violet-900/30',
      accent: 'text-violet-600 dark:text-violet-400',
      gradient:
        'bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 shadow-violet-500/20 hover:shadow-violet-500/30',
    },
    test: {
      icon: Zap,
      accentBg: 'bg-emerald-50 dark:bg-emerald-900/30',
      accent: 'text-emerald-600 dark:text-emerald-400',
      gradient:
        'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 shadow-emerald-500/20 hover:shadow-emerald-500/30',
    },
  };

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 p-6">
      <div className="flex items-center gap-2 mb-1">
        {mode === 'change' ? (
          <ArrowRightLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        ) : (
          <CreditCard className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        )}
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          {mode === 'change' ? 'Changer de plan' : 'Choisir un plan'}
        </h3>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        {mode === 'change'
          ? 'Selectionnez le nouveau plan. La difference sera calculee au prorata.'
          : 'Selectionnez le plan adapte a votre activite.'}
      </p>

      {/* Success message */}
      {successMessage && (
        <div className="flex items-center gap-2 mb-4 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
          <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
          <span className="text-sm text-emerald-700 dark:text-emerald-400">{successMessage}</span>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="rounded-xl border border-gray-200 dark:border-gray-700 p-5 animate-pulse"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700" />
                <div className="h-5 w-16 bg-gray-100 dark:bg-gray-700 rounded" />
              </div>
              <div className="h-8 w-24 bg-gray-100 dark:bg-gray-700 rounded mb-4" />
              <div className="space-y-2">
                {[1, 2, 3].map((j) => (
                  <div key={j} className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-gray-100 dark:bg-gray-700" />
                    <div className="h-3.5 flex-1 bg-gray-100 dark:bg-gray-700 rounded" />
                  </div>
                ))}
              </div>
              <div className="mt-5 h-10 bg-gray-100 dark:bg-gray-700 rounded-lg" />
            </div>
          ))}
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="text-center py-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-red-50 dark:bg-red-900/20 mb-3">
            <AlertCircle className="w-6 h-6 text-red-500 dark:text-red-400" />
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            {error}
          </p>
          <button
            type="button"
            onClick={fetchPrices}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Reessayer
          </button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && visiblePrices.length === 0 && (
        <div className="text-center py-8">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Aucun plan disponible pour le moment.
          </p>
        </div>
      )}

      {/* Billing toggle + plan cards */}
      {!loading && !error && visiblePrices.length > 0 && (
        <>
          {/* Billing interval toggle */}
          <div className="flex justify-center mb-6">
            <div className="inline-flex items-center gap-1 p-1 rounded-full bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600">
              <button
                type="button"
                onClick={() => setBillingInterval('month')}
                className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all duration-200 ${
                  billingInterval === 'month'
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                Mensuel
              </button>
              <button
                type="button"
                onClick={() => setBillingInterval('year')}
                className={`relative px-4 py-1.5 rounded-full text-sm font-semibold transition-all duration-200 ${
                  billingInterval === 'year'
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                Annuel
                {saving > 0 && (
                  <span className="absolute -top-2.5 -right-3 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500 text-white shadow-sm">
                    -{saving}%
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Plan cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {visiblePrices.map((price) => {
              const plan = price.plan ?? 'solo';
              const meta = PLAN_META[plan] ?? PLAN_META.solo;
              const Icon = meta.icon;
              const isThisLoading = loadingPriceId === price.id;
              const isCurrentPlan = mode === 'change' && plan === currentPlan;

              // Disable plan if member or location count exceeds its limit
              const planLimits = PLAN_LIMITS[plan as keyof typeof PLAN_LIMITS];
              const isMemberLimitExceeded = planLimits ? activeMemberCount > planLimits.maxMembers : false;
              const isLocationLimitExceeded = planLimits ? activeLocationCount > planLimits.maxLocations : false;
              const isPlanDisabled = isMemberLimitExceeded || isLocationLimitExceeded;

              // Compute yearly saving for this plan
              let savingPercent = 0;
              if (billingInterval === 'year') {
                const monthlyForPlan = prices.find(
                  (p) => p.plan === plan && p.interval === 'month'
                );
                if (monthlyForPlan) {
                  savingPercent = computeYearlySaving(monthlyForPlan, price);
                }
              }

              const displayPrice = formatPrice(price.unitAmount);
              const intervalLabel =
                price.interval === 'year' ? '/an' : '/mois';

              // CTA label
              const ctaLabel = isCurrentPlan
                ? 'Plan actuel'
                : mode === 'change'
                  ? `Passer au plan ${price.planName ?? plan}`
                  : 'Souscrire';

              const handleCta = () => {
                if (mode === 'change') {
                  handleChangePlan(price.id);
                } else {
                  handleCheckout(price.id);
                }
              };

              return (
                <div
                  key={price.id}
                  className={`rounded-xl border p-5 flex flex-col transition-shadow hover:shadow-md ${
                    isCurrentPlan
                      ? 'border-primary-300 dark:border-primary-700 bg-primary-50/50 dark:bg-primary-900/10'
                      : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800'
                  }`}
                >
                  {/* Plan header */}
                  <div className="flex items-center gap-3 mb-1">
                    <div
                      className={`flex items-center justify-center w-10 h-10 rounded-lg ${meta.accentBg}`}
                    >
                      <Icon className={`w-5 h-5 ${meta.accent}`} />
                    </div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-base font-bold text-gray-900 dark:text-white">
                        {price.planName ?? price.productName}
                      </h4>
                      {isCurrentPlan && (
                        <Badge variant="success">Actuel</Badge>
                      )}
                    </div>
                  </div>

                  {/* Description */}
                  {price.planDescription && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed mb-3 ml-[52px]">
                      {price.planDescription}
                    </p>
                  )}

                  {/* Price */}
                  <div className="mb-4">
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-extrabold text-gray-900 dark:text-white">
                        {displayPrice}&euro;
                      </span>
                      <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                        {intervalLabel}
                      </span>
                    </div>
                    {savingPercent > 0 && (
                      <div className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                        <Sparkles className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                        <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                          -{savingPercent}%
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Features */}
                  <ul className="space-y-2 mb-5 flex-1">
                    {price.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <div className="flex items-center justify-center w-4 h-4 rounded-full bg-emerald-50 dark:bg-emerald-900/20 flex-shrink-0 mt-0.5">
                          <Check className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {feature}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  {isCurrentPlan ? (
                    <button
                      type="button"
                      disabled
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 cursor-default"
                    >
                      <Check className="w-4 h-4" />
                      Plan actuel
                    </button>
                  ) : isPlanDisabled ? (
                    <div className="w-full text-center">
                      <button
                        type="button"
                        disabled
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed"
                      >
                        {ctaLabel}
                      </button>
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                        {isMemberLimitExceeded && isLocationLimitExceeded
                          ? `Vous avez ${activeMemberCount} membres et ${activeLocationCount} lieux actifs. Reduisez pour passer en Pro.`
                          : isMemberLimitExceeded
                            ? `Vous avez ${activeMemberCount} membres actifs. Desactivez-en pour passer en Pro.`
                            : `Vous avez ${activeLocationCount} lieux actifs. Desactivez-en pour passer en Pro.`}
                      </p>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleCta}
                      disabled={checkoutLoading || !providerId}
                      className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white shadow-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${meta.gradient}`}
                    >
                      {isThisLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          {mode === 'change' ? 'Changement...' : 'Redirection...'}
                        </>
                      ) : (
                        ctaLabel
                      )}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section 3: Manage Subscription
// ---------------------------------------------------------------------------

function ManageSubscriptionSection({ onChangePlan }: { onChangePlan?: () => void }) {
  const { provider } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const customerId = provider?.subscription?.stripeCustomerId;

  const handleManage = async () => {
    if (!customerId) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          returnUrl: window.location.href,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || 'Erreur lors de la redirection');
        return;
      }

      if (data.url) {
        window.location.href = data.url;
      } else {
        setError("Impossible d'ouvrir le portail de gestion");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        Gerer mon abonnement
      </h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
        Modifiez votre moyen de paiement, consultez vos factures ou gerez votre
        abonnement via notre portail securise.
      </p>

      {error && (
        <div className="flex items-center gap-2 mb-4 text-sm text-red-600 dark:text-red-400">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleManage}
          disabled={loading}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Redirection...
            </>
          ) : (
            <>
              <ExternalLink className="w-4 h-4" />
              Gerer mon abonnement
            </>
          )}
        </button>
        <button
          type="button"
          onClick={onChangePlan}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium border border-primary-300 dark:border-primary-700 text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-900/20 hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors"
        >
          <ArrowRightLeft className="w-4 h-4" />
          Changer de plan
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function SubscriptionSection() {
  const { provider, refreshProvider } = useAuth();
  const [showChangePlan, setShowChangePlan] = useState(false);

  const plan = provider?.plan || 'trial';
  const status = provider?.subscription?.status || 'trialing';
  const hasStripeCustomer = !!provider?.subscription?.stripeCustomerId;
  const subscriptionId = provider?.subscription?.stripeSubscriptionId ?? null;

  // Show plan chooser when trial, cancelled, incomplete, or unknown/corrupted plan
  const validPaidPlans = ['solo', 'team', 'test'];
  const showChoosePlan =
    plan === 'trial' ||
    status === 'cancelled' ||
    status === 'incomplete' ||
    !validPaidPlans.includes(plan);

  // Show manage section when there is an active Stripe customer
  const showManage =
    hasStripeCustomer &&
    (status === 'active' || status === 'past_due' || status === 'trialing');

  const handlePlanChanged = () => {
    setShowChangePlan(false);
    // Refresh provider data to reflect the new plan
    refreshProvider?.();
  };

  return (
    <div className="space-y-6">
      {/* Section 1: Current Status */}
      <CurrentStatusCard />

      {/* Section 2: Choose a Plan (new subscription) */}
      {showChoosePlan && <ChoosePlanSection />}

      {/* Section 2b: Change Plan (existing subscription) */}
      {showChangePlan && !showChoosePlan && (
        <ChoosePlanSection
          mode="change"
          currentPlan={plan}
          subscriptionId={subscriptionId}
          onPlanChanged={handlePlanChanged}
        />
      )}

      {/* Section 3: Manage Subscription */}
      {showManage && (
        <ManageSubscriptionSection
          onChangePlan={() => setShowChangePlan((prev) => !prev)}
        />
      )}
    </div>
  );
}
