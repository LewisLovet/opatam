'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Copy,
  Check,
  Target,
  Zap,
  BarChart3,
  ArrowLeftRight,
  AlertTriangle,
  ExternalLink,
  QrCode,
} from 'lucide-react';

import { useAffiliate } from '../_shared/useAffiliate';
import {
  BASE_PRICE_TTC,
  MILESTONES,
  DURATION_LABELS,
  computeCommission,
} from '../_shared/constants';
import { QrShareModal } from '../_shared/QrShareModal';

function DashboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  // Aperçu only needs the affiliate doc + the current month's pre-aggregated
  // stat. No need to load the full logs list here.
  const { affiliate, monthlyStats, loading } = useAffiliate({
    includeAggregates: true,
    logsLimit: 0,
  });
  const [copied, setCopied] = useState(false);
  const [showStripeSuccess, setShowStripeSuccess] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);

  useEffect(() => {
    if (searchParams.get('stripe') === 'success') {
      setShowStripeSuccess(true);
      router.replace('/affiliation/dashboard');
    }
  }, [searchParams, router]);

  // Sync Stripe status when affiliate data is available (also runs on ?stripe=success)
  useEffect(() => {
    if (!affiliate?.id) return;
    const justOnboarded = searchParams.get('stripe') === 'success';
    fetch('/api/affiliates/sync-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ affiliateId: affiliate.id, force: justOnboarded }),
    }).catch(() => {});
  }, [affiliate?.id, searchParams]);

  const copyLink = () => {
    if (!affiliate) return;
    navigator.clipboard.writeText(`https://opatam.com/register?ref=${affiliate.code}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-6 h-6 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
      </div>
    );
  }
  if (!affiliate) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-gray-400">Compte affilié non trouvé</p>
      </div>
    );
  }

  const c = computeCommission(affiliate);
  const monthlyRecurring = affiliate.stats.activeReferrals * c.recurringCommission;

  // "Ce mois-ci" = pre-aggregated net commission for the current month (~1 doc read)
  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const currentMonthStat = monthlyStats.find((s) => s.monthKey === currentMonthKey);
  const thisMonthCommission =
    (currentMonthStat?.commissionGross ?? 0) - (currentMonthStat?.commissionRefunds ?? 0);
  const totalPaymentsCount = monthlyStats.reduce((s, m) => s + (m.paymentCount ?? 0), 0);

  const currentSubs = affiliate.stats.activeReferrals;
  const nextMilestone = MILESTONES.find((m) => m.target > currentSubs) || MILESTONES[MILESTONES.length - 1];
  const prevMilestoneItem = [...MILESTONES].reverse().find((m) => m.target <= currentSubs);
  const prevTarget = prevMilestoneItem?.target || 0;
  const progress = nextMilestone.target > prevTarget
    ? ((currentSubs - prevTarget) / (nextMilestone.target - prevTarget)) * 100
    : 100;
  const linkClicks = affiliate.stats.linkClicks || 0;
  const conversionRate = linkClicks > 0
    ? ((affiliate.stats.totalReferrals / linkClicks) * 100).toFixed(1)
    : '0';

  const stripeNotActive = affiliate.stripeAccountStatus !== 'active';

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
      {/* Stripe Success Modal */}
      {showStripeSuccess && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={() => setShowStripeSuccess(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-8 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mb-5">
              <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Felicitations !</h2>
            <p className="text-sm text-gray-500 mb-6">
              Votre compte Stripe est configure. Partagez votre lien et commencez a gagner !
            </p>
            <button
              onClick={() => setShowStripeSuccess(false)}
              className="w-full py-2.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              C'est parti !
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Bonjour, {affiliate.name}</h1>
        <p className="text-sm text-gray-500 mt-1">Voici un resume de votre activite d&apos;affiliation</p>
      </div>

      {/* Stripe warning — link to /compte for the actual setup */}
      {stripeNotActive && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-800">Configuration Stripe incomplete</p>
            <p className="text-xs text-amber-600 mt-1 mb-3">
              Completez la configuration de votre compte Stripe pour recevoir vos commissions.
            </p>
            <Link
              href="/affiliation/compte"
              className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Configurer mon compte
            </Link>
          </div>
        </div>
      )}

      {/* === OBJECTIF PRINCIPAL === */}
      <div className="mb-6 relative overflow-hidden rounded-2xl border border-gray-200 shadow-sm">
        <div className={`absolute inset-0 bg-gradient-to-br ${nextMilestone.gradient} opacity-[0.07]`} />
        <div className="relative p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-5 h-5 text-primary-600" />
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Prochain objectif</p>
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">
                Niveau <span className={nextMilestone.text}>{nextMilestone.label}</span>
              </h2>
              <p className="text-sm text-gray-500 mb-4">
                {currentSubs} / {nextMilestone.target} abonnes actifs — plus que <span className="font-semibold text-gray-700">{nextMilestone.target - currentSubs}</span>
              </p>
              <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full bg-gradient-to-r ${nextMilestone.gradient} rounded-full transition-all duration-700`}
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>
            </div>
            <div className="sm:text-right flex-shrink-0">
              <p className="text-xs text-gray-400 mb-1">Gain mensuel a ce palier</p>
              <p className="text-3xl sm:text-4xl font-bold text-gray-900">
                {(nextMilestone.target * c.recurringCommission).toFixed(0)}
                <span className="text-lg text-gray-400 font-normal"> €/mois</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* === PALIERS === */}
      <div className="mb-6 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="flex gap-2 sm:grid sm:grid-cols-4 lg:grid-cols-8 min-w-max sm:min-w-0">
          {MILESTONES.map((m) => {
            const gain = m.target * c.recurringCommission;
            const reached = currentSubs >= m.target;
            const isNext = m.target === nextMilestone.target;
            return (
              <div
                key={m.target}
                className={`relative rounded-xl p-3 text-center border transition-all min-w-[90px] ${
                  reached ? m.bg : isNext ? 'bg-white border-gray-300 shadow-sm' : 'bg-gray-50/50 border-gray-100'
                }`}
              >
                {isNext && !reached && <div className={`absolute -top-px left-0 right-0 h-1 rounded-t-xl bg-gradient-to-r ${m.gradient}`} />}
                <p className={`text-[9px] font-bold uppercase tracking-wider mb-0.5 ${reached ? m.text : isNext ? 'text-gray-700' : 'text-gray-300'}`}>{m.label}</p>
                <p className={`text-[11px] ${reached ? m.text : isNext ? 'text-gray-600' : 'text-gray-300'}`}>{m.target}</p>
                <p className={`text-sm font-bold mt-0.5 ${reached ? m.text : isNext ? 'text-gray-900' : 'text-gray-300'}`}>{gain.toFixed(0)} €</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* === LIEN DE PARTAGE === */}
      <div className="mb-6 bg-white border border-gray-200 rounded-xl p-4 sm:p-5 shadow-sm">
        <p className="text-sm font-semibold text-gray-900 mb-2">Votre lien de partage</p>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-700 font-mono truncate">
            opatam.com/register?ref={affiliate.code}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={copyLink}
              className="flex-1 sm:flex-initial px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copie' : 'Copier'}
            </button>
            <button
              onClick={() => setQrOpen(true)}
              className="flex-1 sm:flex-initial px-4 py-2.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
              title="Voir le QR code"
            >
              <QrCode className="w-4 h-4" />
              QR code
            </button>
          </div>
        </div>
      </div>

      {/* QR code modal */}
      <QrShareModal
        open={qrOpen}
        onClose={() => setQrOpen(false)}
        url={`https://opatam.com/register?ref=${affiliate.code}`}
        code={affiliate.code}
        name={affiliate.name}
      />

      {/* === KPIs === */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 sm:gap-3 mb-6">
        {[
          { label: 'Clics', value: linkClicks, color: 'text-gray-900' },
          { label: 'Inscrits', value: affiliate.stats.totalReferrals, color: 'text-blue-600' },
          { label: 'En essai', value: affiliate.stats.trialReferrals, color: 'text-amber-600' },
          { label: 'Abonnes', value: currentSubs, color: 'text-emerald-600' },
          { label: 'Conversion', value: `${conversionRate}%`, color: 'text-indigo-600' },
          { label: 'Recurrent', value: `${monthlyRecurring.toFixed(0)} €`, color: 'text-primary-600' },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl p-3 sm:p-4 border border-gray-200 shadow-sm text-center">
            <p className="text-[10px] sm:text-[11px] text-gray-400 mb-0.5">{s.label}</p>
            <p className={`text-lg sm:text-xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* === REVENUS (résumé) === */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 sm:p-5 text-center">
          <p className="text-xs text-emerald-600 font-medium mb-1">Total gagne</p>
          <p className="text-xl sm:text-2xl font-bold text-emerald-700">
            {(affiliate.stats.totalCommission / 100).toFixed(2)} €
          </p>
        </div>
        <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 sm:p-5 text-center">
          <p className="text-xs text-violet-600 font-medium mb-1">Ce mois-ci</p>
          <p className="text-xl sm:text-2xl font-bold text-violet-700">
            {(thisMonthCommission / 100).toFixed(2)} €
          </p>
        </div>
      </div>

      {/* === QUICK LINKS vers les nouvelles pages === */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
        <Link
          href="/affiliation/statistiques"
          className="group bg-white border border-gray-200 hover:border-primary-300 hover:shadow-md rounded-xl p-4 flex items-center gap-3 transition-all"
        >
          <div className="p-2.5 rounded-lg bg-primary-50 text-primary-600 group-hover:bg-primary-100 transition-colors">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-900">Voir les statistiques</p>
            <p className="text-xs text-gray-500">Evolution de vos revenus et filleuls</p>
          </div>
        </Link>
        <Link
          href="/affiliation/virements"
          className="group bg-white border border-gray-200 hover:border-emerald-300 hover:shadow-md rounded-xl p-4 flex items-center gap-3 transition-all"
        >
          <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100 transition-colors">
            <ArrowLeftRight className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-900">Mes virements</p>
            <p className="text-xs text-gray-500">
              {totalPaymentsCount} commission{totalPaymentsCount > 1 ? 's' : ''} reçue{totalPaymentsCount > 1 ? 's' : ''}
            </p>
          </div>
        </Link>
      </div>

      {/* === DETAIL COMMISSION === */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden mb-6">
        <div className="px-4 sm:px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <Zap className="w-4 h-4 text-primary-600" />
          <h2 className="text-sm font-semibold text-gray-900">Detail de votre commission</h2>
        </div>
        <div className={`grid ${c.hasDiscount && !c.isOngoingDiscount ? 'sm:grid-cols-2' : 'max-w-sm mx-auto'} divide-y sm:divide-y-0 sm:divide-x divide-gray-100`}>
          {/* Premier mois / chaque mois */}
          <div className="p-4 sm:p-5">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
              {c.hasDiscount && !c.isOngoingDiscount
                ? DURATION_LABELS[affiliate.discountDuration || 'once']
                : 'Chaque mois'}
            </p>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Abonnement TTC</span>
                <span className="text-gray-900 font-medium">{BASE_PRICE_TTC.toFixed(2)} €</span>
              </div>
              {c.hasDiscount && (
                <div className="flex justify-between text-sm">
                  <span className="text-amber-600">Reduction -{affiliate.discount}%</span>
                  <span className="text-amber-600 font-medium">-{(BASE_PRICE_TTC * c.discountRate).toFixed(2)} €</span>
                </div>
              )}
              {c.hasDiscount && (
                <div className="flex justify-between text-sm border-t border-dashed border-gray-200 pt-2">
                  <span className="text-gray-500">L&apos;abonne paie</span>
                  <span className="text-gray-900 font-medium">{c.firstMonthTTC.toFixed(2)} €</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">TVA (20%)</span>
                <span className="text-gray-400">-{(c.firstMonthTTC - c.firstMonthHT).toFixed(2)} €</span>
              </div>
              <div className="flex justify-between text-sm border-t border-gray-200 pt-2">
                <span className="text-gray-500">Base HT</span>
                <span className="text-gray-700 font-medium">{c.firstMonthHT.toFixed(2)} €</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Commission ({affiliate.commission}%)</span>
                <span className="text-primary-600 font-bold">{c.firstMonthCommission.toFixed(2)} €</span>
              </div>
              <div className="bg-primary-50 border border-primary-200 rounded-lg p-3 text-center mt-2">
                <p className="text-[11px] text-primary-500 font-medium">Vous gagnez</p>
                <p className="text-xl font-bold text-primary-700">{c.firstMonthCommission.toFixed(2)} €</p>
                <p className="text-[10px] text-primary-400">par abonne / mois</p>
              </div>
            </div>
          </div>
          {/* Mois suivants */}
          {c.hasDiscount && !c.isOngoingDiscount && (
            <div className="p-4 sm:p-5">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Mois suivants</p>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Abonnement TTC</span>
                  <span className="text-gray-900 font-medium">{BASE_PRICE_TTC.toFixed(2)} €</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-300 line-through">Reduction</span>
                  <span className="text-gray-300">—</span>
                </div>
                <div className="flex justify-between text-sm border-t border-dashed border-gray-200 pt-2">
                  <span className="text-gray-500">L&apos;abonne paie</span>
                  <span className="text-gray-900 font-medium">{BASE_PRICE_TTC.toFixed(2)} €</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">TVA (20%)</span>
                  <span className="text-gray-400">-{(BASE_PRICE_TTC - c.recurringHT).toFixed(2)} €</span>
                </div>
                <div className="flex justify-between text-sm border-t border-gray-200 pt-2">
                  <span className="text-gray-500">Base HT</span>
                  <span className="text-gray-700 font-medium">{c.recurringHT.toFixed(2)} €</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Commission ({affiliate.commission}%)</span>
                  <span className="text-emerald-600 font-bold">{c.recurringCommission.toFixed(2)} €</span>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-center mt-2">
                  <p className="text-[11px] text-emerald-500 font-medium">Vous gagnez</p>
                  <p className="text-xl font-bold text-emerald-700">{c.recurringCommission.toFixed(2)} €</p>
                  <p className="text-[10px] text-emerald-400">par abonne / mois</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AffiliateDashboardPage() {
  return (
    <Suspense>
      <DashboardContent />
    </Suspense>
  );
}
