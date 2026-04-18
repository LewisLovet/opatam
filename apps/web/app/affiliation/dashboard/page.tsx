'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, collection, query, where, orderBy, limit, getDocs, onSnapshot } from 'firebase/firestore';
import { auth, db } from '@booking-app/firebase';
import {
  Users,
  Euro,
  TrendingUp,
  Clock,
  Copy,
  Check,
  ExternalLink,
  AlertTriangle,
  Download,
  ArrowUpRight,
  ArrowDownLeft,
  MousePointerClick,
  Target,
  Zap,
  ChevronRight,
} from 'lucide-react';

interface AffiliateData {
  id: string;
  name: string;
  code: string;
  commission: number;
  discount: number | null;
  discountDuration: string | null;
  stripeAccountId: string;
  stripeAccountStatus: string;
  stats: {
    totalReferrals: number;
    activeReferrals: number;
    trialReferrals: number;
    totalRevenue: number;
    totalCommission: number;
    linkClicks?: number;
  };
}

interface LogEntry {
  id: string;
  type: 'payment' | 'refund';
  amount: number;
  commission: number;
  affiliateCode: string;
  source: string;
  createdAt: any;
}

const DURATION_LABELS: Record<string, string> = {
  once: 'le 1er mois',
  repeating_3: 'les 3 premiers mois',
  repeating_12: 'la 1ère année',
  forever: 'permanent',
};

const BASE_PRICE_TTC = 19.90;
const TVA_RATE = 0.20;

const MILESTONES = [
  { target: 20, label: 'Bronze', gradient: 'from-amber-600 to-amber-500', bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700' },
  { target: 50, label: 'Argent', gradient: 'from-gray-500 to-gray-400', bg: 'bg-gray-50 border-gray-200', text: 'text-gray-600' },
  { target: 100, label: 'Or', gradient: 'from-yellow-500 to-amber-400', bg: 'bg-yellow-50 border-yellow-200', text: 'text-yellow-700' },
  { target: 200, label: 'Platine', gradient: 'from-cyan-600 to-teal-500', bg: 'bg-cyan-50 border-cyan-200', text: 'text-cyan-700' },
  { target: 500, label: 'Diamant', gradient: 'from-blue-600 to-indigo-500', bg: 'bg-blue-50 border-blue-200', text: 'text-blue-700' },
  { target: 1000, label: 'Elite', gradient: 'from-violet-600 to-purple-500', bg: 'bg-violet-50 border-violet-200', text: 'text-violet-700' },
  { target: 2500, label: 'Master', gradient: 'from-purple-600 to-pink-500', bg: 'bg-purple-50 border-purple-200', text: 'text-purple-700' },
  { target: 5000, label: 'Legende', gradient: 'from-primary-600 to-indigo-600', bg: 'bg-primary-50 border-primary-200', text: 'text-primary-700' },
];

function DashboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [affiliate, setAffiliate] = useState<AffiliateData | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [showStripeSuccess, setShowStripeSuccess] = useState(false);

  useEffect(() => {
    if (searchParams.get('stripe') === 'success') {
      setShowStripeSuccess(true);
      router.replace('/affiliation/dashboard');
    }
  }, [searchParams, router]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) return;
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const affiliateId = userDoc.data()?.affiliateId;
      if (!affiliateId) return;

      const unsub = onSnapshot(doc(db, 'affiliates', affiliateId), (snap) => {
        if (snap.exists()) setAffiliate({ id: snap.id, ...snap.data() } as AffiliateData);
        setLoading(false);
      });

      // Sync Stripe account status on mount. Fire-and-forget — the Firestore
      // listener above will pick up the update automatically. Runs more
      // aggressively if we just came back from Stripe onboarding.
      const justOnboarded = searchParams.get('stripe') === 'success';
      fetch('/api/affiliates/sync-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ affiliateId, force: justOnboarded }),
      }).catch(() => {});

      try {
        const logsQuery = query(collection(db, '_affiliateLogs'), where('affiliateId', '==', affiliateId), orderBy('createdAt', 'desc'), limit(50));
        const logsSnap = await getDocs(logsQuery);
        setLogs(logsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as LogEntry)));
      } catch {}

      return () => unsub();
    });
    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const copyLink = () => {
    if (!affiliate) return;
    navigator.clipboard.writeText(`https://opatam.com/register?ref=${affiliate.code}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const exportCSV = () => {
    if (!logs.length) return;
    const pmts = logs.filter((l) => l.type === 'payment');
    const header = 'Date,Montant TTC,Montant HT,Commission,Source\n';
    const rows = pmts.map((l) => {
      const date = l.createdAt?.toDate ? l.createdAt.toDate().toLocaleDateString('fr-FR') : '';
      return `${date},${(l.amount / 100).toFixed(2)},${(l.amount / 100 / (1 + TVA_RATE)).toFixed(2)},${(l.commission / 100).toFixed(2)},${l.source || 'checkout'}`;
    }).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `commissions-${affiliate?.code || 'export'}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="flex items-center justify-center h-96"><div className="w-6 h-6 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" /></div>;
  if (!affiliate) return <div className="flex items-center justify-center h-96"><p className="text-gray-400">Compte affilie non trouve</p></div>;

  const commissionRate = affiliate.commission / 100;
  const hasDiscount = !!affiliate.discount && affiliate.discount > 0;
  const discountRate = hasDiscount ? affiliate.discount! / 100 : 0;
  const isOngoingDiscount = affiliate.discountDuration === 'forever';

  const firstMonthTTC = BASE_PRICE_TTC * (1 - discountRate);
  const firstMonthHT = firstMonthTTC / (1 + TVA_RATE);
  const firstMonthCommission = firstMonthHT * commissionRate;

  const recurringTTC = isOngoingDiscount ? firstMonthTTC : BASE_PRICE_TTC;
  const recurringHT = recurringTTC / (1 + TVA_RATE);
  const recurringCommission = recurringHT * commissionRate;

  const monthlyRecurring = affiliate.stats.activeReferrals * recurringCommission;

  const payments = logs.filter((l) => l.type === 'payment');
  const thisMonth = payments.filter((l) => {
    if (!l.createdAt?.toDate) return false;
    const d = l.createdAt.toDate();
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const thisMonthCommission = thisMonth.reduce((s, l) => s + (l.commission || 0), 0);

  const currentSubs = affiliate.stats.activeReferrals;
  const nextMilestone = MILESTONES.find((m) => m.target > currentSubs) || MILESTONES[MILESTONES.length - 1];
  const prevMilestoneItem = [...MILESTONES].reverse().find((m) => m.target <= currentSubs);
  const prevTarget = prevMilestoneItem?.target || 0;
  const progress = nextMilestone.target > prevTarget ? ((currentSubs - prevTarget) / (nextMilestone.target - prevTarget)) * 100 : 100;
  const linkClicks = affiliate.stats.linkClicks || 0;
  const conversionRate = linkClicks > 0 ? ((affiliate.stats.totalReferrals / linkClicks) * 100).toFixed(1) : '0';

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
      {/* Stripe Success Modal */}
      {showStripeSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setShowStripeSuccess(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-8 text-center" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mb-5">
              <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Felicitations !</h2>
            <p className="text-sm text-gray-500 mb-6">Votre compte Stripe est configure. Partagez votre lien et commencez a gagner !</p>
            <button onClick={() => setShowStripeSuccess(false)} className="w-full py-2.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold rounded-lg transition-colors">C'est parti !</button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Bonjour, {affiliate.name}</h1>
        <p className="text-sm text-gray-500 mt-1">Voici un resume de votre activite d'affiliation</p>
      </div>

      {/* Stripe warning */}
      {affiliate.stripeAccountStatus !== 'active' && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-800">Configuration Stripe incomplete</p>
            <p className="text-xs text-amber-600 mt-1 mb-3">Completez la configuration pour recevoir vos commissions.</p>
            <button
              onClick={async () => {
                try {
                  const res = await fetch('/api/affiliates/onboarding', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ affiliateId: affiliate.id }),
                  });
                  const data = await res.json();
                  // Redirect in the same tab to avoid popup blockers. Stripe
                  // sends the user back to /affiliation/dashboard?stripe=success
                  // once onboarding is complete.
                  if (data.url) window.location.href = data.url;
                } catch {}
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <ExternalLink className="w-4 h-4" />Configurer mon compte Stripe
            </button>
          </div>
        </div>
      )}

      {/* === OBJECTIF PRINCIPAL — carte hero === */}
      <div className="mb-6 relative overflow-hidden rounded-2xl border border-gray-200 shadow-sm">
        <div className={`absolute inset-0 bg-gradient-to-br ${nextMilestone.gradient} opacity-[0.07]`} />
        <div className="relative p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
            {/* Left — progress */}
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
              {/* Progress bar */}
              <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-full bg-gradient-to-r ${nextMilestone.gradient} rounded-full transition-all duration-700`} style={{ width: `${Math.min(progress, 100)}%` }} />
              </div>
            </div>
            {/* Right — gain */}
            <div className="sm:text-right flex-shrink-0">
              <p className="text-xs text-gray-400 mb-1">Gain mensuel a ce palier</p>
              <p className="text-3xl sm:text-4xl font-bold text-gray-900">{(nextMilestone.target * recurringCommission).toFixed(0)} <span className="text-lg text-gray-400 font-normal">&euro;/mois</span></p>
            </div>
          </div>
        </div>
      </div>

      {/* === PALIERS === */}
      <div className="mb-6 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="flex gap-2 sm:grid sm:grid-cols-4 lg:grid-cols-8 min-w-max sm:min-w-0">
          {MILESTONES.map((m) => {
            const gain = m.target * recurringCommission;
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
                <p className={`text-sm font-bold mt-0.5 ${reached ? m.text : isNext ? 'text-gray-900' : 'text-gray-300'}`}>{gain.toFixed(0)} &euro;</p>
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
          <button onClick={copyLink} className="px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2">
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copie' : 'Copier'}
          </button>
        </div>
      </div>

      {/* === STATS === */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 sm:gap-3 mb-6">
        {[
          { label: 'Clics', value: linkClicks, color: 'text-gray-900' },
          { label: 'Inscrits', value: affiliate.stats.totalReferrals, color: 'text-blue-600' },
          { label: 'En essai', value: affiliate.stats.trialReferrals, color: 'text-amber-600' },
          { label: 'Abonnes', value: currentSubs, color: 'text-emerald-600' },
          { label: 'Conversion', value: `${conversionRate}%`, color: 'text-indigo-600' },
          { label: 'Recurrent', value: `${monthlyRecurring.toFixed(0)} \u20ac`, color: 'text-primary-600' },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl p-3 sm:p-4 border border-gray-200 shadow-sm text-center">
            <p className="text-[10px] sm:text-[11px] text-gray-400 mb-0.5">{s.label}</p>
            <p className={`text-lg sm:text-xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* === REVENUS === */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 sm:p-5 text-center">
          <p className="text-xs text-emerald-600 font-medium mb-1">Total gagne</p>
          <p className="text-xl sm:text-2xl font-bold text-emerald-700">{(affiliate.stats.totalCommission / 100).toFixed(2)} &euro;</p>
        </div>
        <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 sm:p-5 text-center">
          <p className="text-xs text-violet-600 font-medium mb-1">Ce mois-ci</p>
          <p className="text-xl sm:text-2xl font-bold text-violet-700">{(thisMonthCommission / 100).toFixed(2)} &euro;</p>
        </div>
      </div>

      {/* === TRANSACTIONS === */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-6">
        <div className="px-4 sm:px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Virements et commissions</h2>
          {payments.length > 0 && (
            <button onClick={exportCSV} className="inline-flex items-center gap-1.5 text-xs font-medium text-primary-600 hover:text-primary-700 px-3 py-1.5 bg-primary-50 rounded-lg transition-colors">
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Exporter CSV</span>
              <span className="sm:hidden">CSV</span>
            </button>
          )}
        </div>
        {logs.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">Aucun virement pour le moment. Partagez votre lien pour commencer.</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {logs.map((log) => {
              const isRefund = log.type === 'refund';
              const date = log.createdAt?.toDate ? log.createdAt.toDate().toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
              return (
                <div key={log.id} className="px-4 sm:px-5 py-3 flex items-center gap-3">
                  <div className={`p-2 rounded-lg flex-shrink-0 ${isRefund ? 'bg-red-50' : 'bg-emerald-50'}`}>
                    {isRefund ? <ArrowDownLeft className="w-4 h-4 text-red-500" /> : <ArrowUpRight className="w-4 h-4 text-emerald-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 truncate">
                      {isRefund ? 'Remboursement' : 'Commission'}{log.source === 'invoice' ? ' (renouvellement)' : log.source === 'checkout' ? ' (1er paiement)' : ''}
                    </p>
                    <p className="text-xs text-gray-400">{date}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`text-sm font-semibold ${isRefund ? 'text-red-600' : 'text-emerald-600'}`}>
                      {isRefund ? '-' : '+'}{((log.commission || log.amount || 0) / 100).toFixed(2)} &euro;
                    </p>
                    {!isRefund && log.amount && (
                      <p className="text-[10px] text-gray-400">sur {(log.amount / 100 / (1 + TVA_RATE)).toFixed(2)} &euro; HT</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* === DETAIL COMMISSION (en bas) === */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden mb-6">
        <div className="px-4 sm:px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <Zap className="w-4 h-4 text-primary-600" />
          <h2 className="text-sm font-semibold text-gray-900">Detail de votre commission</h2>
        </div>
        <div className={`grid ${hasDiscount && !isOngoingDiscount ? 'sm:grid-cols-2' : 'max-w-sm mx-auto'} divide-y sm:divide-y-0 sm:divide-x divide-gray-100`}>
          {/* Premier mois */}
          <div className="p-4 sm:p-5">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
              {hasDiscount && !isOngoingDiscount ? DURATION_LABELS[affiliate.discountDuration || 'once'] : 'Chaque mois'}
            </p>
            <div className="space-y-2">
              <div className="flex justify-between text-sm"><span className="text-gray-500">Abonnement TTC</span><span className="text-gray-900 font-medium">{BASE_PRICE_TTC.toFixed(2)} &euro;</span></div>
              {hasDiscount && <div className="flex justify-between text-sm"><span className="text-amber-600">Reduction -{affiliate.discount}%</span><span className="text-amber-600 font-medium">-{(BASE_PRICE_TTC * discountRate).toFixed(2)} &euro;</span></div>}
              {hasDiscount && <div className="flex justify-between text-sm border-t border-dashed border-gray-200 pt-2"><span className="text-gray-500">L'abonne paie</span><span className="text-gray-900 font-medium">{firstMonthTTC.toFixed(2)} &euro;</span></div>}
              <div className="flex justify-between text-sm"><span className="text-gray-500">TVA (20%)</span><span className="text-gray-400">-{(firstMonthTTC - firstMonthHT).toFixed(2)} &euro;</span></div>
              <div className="flex justify-between text-sm border-t border-gray-200 pt-2"><span className="text-gray-500">Base HT</span><span className="text-gray-700 font-medium">{firstMonthHT.toFixed(2)} &euro;</span></div>
              <div className="flex justify-between text-sm"><span className="text-gray-500">Commission ({affiliate.commission}%)</span><span className="text-primary-600 font-bold">{firstMonthCommission.toFixed(2)} &euro;</span></div>
              <div className="bg-primary-50 border border-primary-200 rounded-lg p-3 text-center mt-2">
                <p className="text-[11px] text-primary-500 font-medium">Vous gagnez</p>
                <p className="text-xl font-bold text-primary-700">{firstMonthCommission.toFixed(2)} &euro;</p>
                <p className="text-[10px] text-primary-400">par abonne / mois</p>
              </div>
            </div>
          </div>
          {/* Mois suivants */}
          {hasDiscount && !isOngoingDiscount && (
            <div className="p-4 sm:p-5">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Mois suivants</p>
              <div className="space-y-2">
                <div className="flex justify-between text-sm"><span className="text-gray-500">Abonnement TTC</span><span className="text-gray-900 font-medium">{BASE_PRICE_TTC.toFixed(2)} &euro;</span></div>
                <div className="flex justify-between text-sm"><span className="text-gray-300 line-through">Reduction</span><span className="text-gray-300">&mdash;</span></div>
                <div className="flex justify-between text-sm border-t border-dashed border-gray-200 pt-2"><span className="text-gray-500">L'abonne paie</span><span className="text-gray-900 font-medium">{BASE_PRICE_TTC.toFixed(2)} &euro;</span></div>
                <div className="flex justify-between text-sm"><span className="text-gray-500">TVA (20%)</span><span className="text-gray-400">-{(BASE_PRICE_TTC - recurringHT).toFixed(2)} &euro;</span></div>
                <div className="flex justify-between text-sm border-t border-gray-200 pt-2"><span className="text-gray-500">Base HT</span><span className="text-gray-700 font-medium">{recurringHT.toFixed(2)} &euro;</span></div>
                <div className="flex justify-between text-sm"><span className="text-gray-500">Commission ({affiliate.commission}%)</span><span className="text-emerald-600 font-bold">{recurringCommission.toFixed(2)} &euro;</span></div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-center mt-2">
                  <p className="text-[11px] text-emerald-500 font-medium">Vous gagnez</p>
                  <p className="text-xl font-bold text-emerald-700">{recurringCommission.toFixed(2)} &euro;</p>
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
