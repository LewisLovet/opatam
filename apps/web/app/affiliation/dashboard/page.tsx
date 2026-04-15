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

// Prix de base de l'abonnement TTC
const BASE_PRICE_TTC = 19.90;
const TVA_RATE = 0.20;

// Objectifs / paliers
const MILESTONES = [
  { target: 5, label: 'Bronze', color: 'text-amber-700 bg-amber-100 border-amber-300' },
  { target: 10, label: 'Argent', color: 'text-gray-600 bg-gray-100 border-gray-300' },
  { target: 25, label: 'Or', color: 'text-yellow-700 bg-yellow-100 border-yellow-300' },
  { target: 50, label: 'Platine', color: 'text-cyan-700 bg-cyan-100 border-cyan-300' },
  { target: 100, label: 'Diamant', color: 'text-blue-700 bg-blue-100 border-blue-300' },
  { target: 250, label: 'Elite', color: 'text-violet-700 bg-violet-100 border-violet-300' },
  { target: 500, label: 'Master', color: 'text-purple-700 bg-purple-100 border-purple-300' },
  { target: 1000, label: 'Légende', color: 'text-primary-700 bg-primary-100 border-primary-300' },
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

      try {
        const logsQuery = query(
          collection(db, '_affiliateLogs'),
          where('affiliateId', '==', affiliateId),
          orderBy('createdAt', 'desc'),
          limit(50)
        );
        const logsSnap = await getDocs(logsQuery);
        setLogs(logsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as LogEntry)));
      } catch {}

      return () => unsub();
    });
    return () => unsubscribe();
  }, []);

  const copyLink = () => {
    if (!affiliate) return;
    navigator.clipboard.writeText(`https://opatam.com/register?ref=${affiliate.code}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const exportCSV = () => {
    if (!logs.length) return;
    const payments = logs.filter((l) => l.type === 'payment');
    const header = 'Date,Type,Montant TTC (€),Montant HT (€),Commission (€),Source\n';
    const rows = payments.map((l) => {
      const date = l.createdAt?.toDate ? l.createdAt.toDate().toLocaleDateString('fr-FR') : '—';
      const ttc = (l.amount / 100).toFixed(2);
      const ht = (l.amount / 100 / (1 + TVA_RATE)).toFixed(2);
      return `${date},Commission,${ttc},${ht},${(l.commission / 100).toFixed(2)},${l.source || 'checkout'}`;
    }).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `commissions-${affiliate?.code || 'export'}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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

  // Calculs — premier mois (avec réduction éventuelle) vs mois suivants (plein tarif)
  const commissionRate = affiliate.commission / 100;
  const hasDiscount = !!affiliate.discount && affiliate.discount > 0;
  const discountRate = hasDiscount ? affiliate.discount! / 100 : 0;
  const isOngoingDiscount = affiliate.discountDuration === 'forever';

  // Premier mois
  const firstMonthTTC = BASE_PRICE_TTC * (1 - discountRate);
  const firstMonthHT = firstMonthTTC / (1 + TVA_RATE);
  const firstMonthCommission = firstMonthHT * commissionRate;

  // Mois suivants (plein tarif sauf si réduction permanente)
  const recurringTTC = isOngoingDiscount ? firstMonthTTC : BASE_PRICE_TTC;
  const recurringHT = recurringTTC / (1 + TVA_RATE);
  const recurringCommission = recurringHT * commissionRate;

  // Revenu récurrent mensuel estimé (basé sur les abonnés actifs au tarif récurrent)
  const monthlyRecurring = affiliate.stats.activeReferrals * recurringCommission;

  const payments = logs.filter((l) => l.type === 'payment');
  const refunds = logs.filter((l) => l.type === 'refund');
  const thisMonth = payments.filter((l) => {
    if (!l.createdAt?.toDate) return false;
    const d = l.createdAt.toDate();
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const thisMonthCommission = thisMonth.reduce((s, l) => s + (l.commission || 0), 0);

  // Prochain palier
  const currentSubs = affiliate.stats.activeReferrals;
  const nextMilestone = MILESTONES.find((m) => m.target > currentSubs) || MILESTONES[MILESTONES.length - 1];
  const prevMilestoneItem = [...MILESTONES].reverse().find((m) => m.target <= currentSubs);
  const prevTarget = prevMilestoneItem?.target || 0;
  const progress = nextMilestone.target > prevTarget
    ? ((currentSubs - prevTarget) / (nextMilestone.target - prevTarget)) * 100
    : 100;

  const linkClicks = affiliate.stats.linkClicks || 0;
  const conversionRate = linkClicks > 0 ? ((affiliate.stats.totalReferrals / linkClicks) * 100).toFixed(1) : '—';

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto">
      {/* Stripe Success Modal */}
      {showStripeSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setShowStripeSuccess(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-8 text-center" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mb-5">
              <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Félicitations !</h2>
            <p className="text-sm text-gray-500 mb-6">Votre compte Stripe est configuré. Partagez votre lien et commencez à gagner !</p>
            <button onClick={() => setShowStripeSuccess(false)} className="w-full py-2.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold rounded-lg transition-colors">
              C'est parti !
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Bonjour, {affiliate.name}</h1>
        <p className="text-sm text-gray-500 mt-1">Voici un résumé de votre activité d'affiliation</p>
      </div>

      {/* Stripe warning */}
      {affiliate.stripeAccountStatus !== 'active' && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-800">Configuration Stripe incomplète</p>
            <p className="text-xs text-amber-600 mt-1 mb-3">Complétez la configuration pour recevoir vos commissions.</p>
            <button
              onClick={async () => {
                try {
                  const res = await fetch('/api/affiliates/onboarding', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ affiliateId: affiliate.id }) });
                  const data = await res.json();
                  if (data.url) window.open(data.url, '_blank');
                } catch {}
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Configurer mon compte Stripe
            </button>
          </div>
        </div>
      )}

      {/* Mon offre — calcul détaillé format reçu */}
      <div className="mb-6 bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 bg-gradient-to-r from-primary-600 to-indigo-600 flex items-center gap-2">
          <Zap className="w-5 h-5 text-white" />
          <h2 className="text-sm font-bold text-white">Détail de votre commission</h2>
        </div>
        <div className={`grid ${hasDiscount && !isOngoingDiscount ? 'grid-cols-2' : 'grid-cols-1 max-w-xs mx-auto'} divide-x divide-gray-100`}>
          {/* Colonne 1 : Premier mois (ou seul si pas de réduction) */}
          <div className="p-5">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">
              {hasDiscount && !isOngoingDiscount ? `${DURATION_LABELS[affiliate.discountDuration || 'once']}` : 'Chaque mois'}
            </p>
            <div className="space-y-2.5">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Abonnement TTC</span>
                <span className="text-gray-900 font-medium">{BASE_PRICE_TTC.toFixed(2)} €</span>
              </div>
              {hasDiscount && (
                <div className="flex justify-between text-sm">
                  <span className="text-amber-600">Réduction -{affiliate.discount}%</span>
                  <span className="text-amber-600 font-medium">-{(BASE_PRICE_TTC * discountRate).toFixed(2)} €</span>
                </div>
              )}
              {hasDiscount && (
                <div className="flex justify-between text-sm border-t border-dashed border-gray-200 pt-2">
                  <span className="text-gray-500">L'abonné paie</span>
                  <span className="text-gray-900 font-medium">{firstMonthTTC.toFixed(2)} €</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">TVA (20%)</span>
                <span className="text-gray-400">-{(firstMonthTTC - firstMonthHT).toFixed(2)} €</span>
              </div>
              <div className="flex justify-between text-sm border-t border-gray-200 pt-2">
                <span className="text-gray-500">Base HT</span>
                <span className="text-gray-700 font-medium">{firstMonthHT.toFixed(2)} €</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Commission ({affiliate.commission}%)</span>
                <span className="text-primary-600 font-bold">{firstMonthCommission.toFixed(2)} €</span>
              </div>
              <div className="bg-primary-50 border border-primary-200 rounded-lg p-3 text-center mt-3">
                <p className="text-[11px] text-primary-500 font-medium">Vous gagnez</p>
                <p className="text-xl font-bold text-primary-700">{firstMonthCommission.toFixed(2)} €</p>
                <p className="text-[10px] text-primary-400">par abonné / mois</p>
              </div>
            </div>
          </div>

          {/* Colonne 2 : Mois suivants (seulement si réduction temporaire) */}
          {hasDiscount && !isOngoingDiscount && (
            <div className="p-5">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Mois suivants</p>
              <div className="space-y-2.5">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Abonnement TTC</span>
                  <span className="text-gray-900 font-medium">{BASE_PRICE_TTC.toFixed(2)} €</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400 line-through">Réduction</span>
                  <span className="text-gray-300">—</span>
                </div>
                <div className="flex justify-between text-sm border-t border-dashed border-gray-200 pt-2">
                  <span className="text-gray-500">L'abonné paie</span>
                  <span className="text-gray-900 font-medium">{BASE_PRICE_TTC.toFixed(2)} €</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">TVA (20%)</span>
                  <span className="text-gray-400">-{(BASE_PRICE_TTC - BASE_PRICE_TTC / (1 + TVA_RATE)).toFixed(2)} €</span>
                </div>
                <div className="flex justify-between text-sm border-t border-gray-200 pt-2">
                  <span className="text-gray-500">Base HT</span>
                  <span className="text-gray-700 font-medium">{recurringHT.toFixed(2)} €</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Commission ({affiliate.commission}%)</span>
                  <span className="text-emerald-600 font-bold">{recurringCommission.toFixed(2)} €</span>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-center mt-3">
                  <p className="text-[11px] text-emerald-500 font-medium">Vous gagnez</p>
                  <p className="text-xl font-bold text-emerald-700">{recurringCommission.toFixed(2)} €</p>
                  <p className="text-[10px] text-emerald-400">par abonné / mois</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Share link */}
      <div className="mb-6 bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
        <p className="text-sm font-semibold text-gray-900 mb-2">Votre lien de partage</p>
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-700 font-mono truncate">
            opatam.com/register?ref={affiliate.code}
          </div>
          <button onClick={copyLink} className="px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2">
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copié' : 'Copier'}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
          <p className="text-[11px] text-gray-500 mb-1">Clics</p>
          <p className="text-xl font-bold text-gray-900">{linkClicks}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
          <p className="text-[11px] text-gray-500 mb-1">Inscrits</p>
          <p className="text-xl font-bold text-blue-600">{affiliate.stats.totalReferrals}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
          <p className="text-[11px] text-gray-500 mb-1">En essai</p>
          <p className="text-xl font-bold text-amber-600">{affiliate.stats.trialReferrals}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
          <p className="text-[11px] text-gray-500 mb-1">Abonnés actifs</p>
          <p className="text-xl font-bold text-emerald-600">{affiliate.stats.activeReferrals}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
          <p className="text-[11px] text-gray-500 mb-1">Conversion</p>
          <p className="text-xl font-bold text-indigo-600">{conversionRate}%</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
          <p className="text-[11px] text-gray-500 mb-1">Récurrent/mois</p>
          <p className="text-xl font-bold text-primary-600">{monthlyRecurring.toFixed(2)} €</p>
        </div>
      </div>

      {/* Revenus */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 text-center">
          <p className="text-xs text-emerald-600 font-medium mb-1">Total gagné</p>
          <p className="text-2xl font-bold text-emerald-700">{(affiliate.stats.totalCommission / 100).toFixed(2)} €</p>
        </div>
        <div className="bg-violet-50 border border-violet-200 rounded-xl p-5 text-center">
          <p className="text-xs text-violet-600 font-medium mb-1">Ce mois-ci</p>
          <p className="text-2xl font-bold text-violet-700">{(thisMonthCommission / 100).toFixed(2)} €</p>
        </div>
      </div>

      {/* Objectifs / Paliers */}
      <div className="mb-6 bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Target className="w-5 h-5 text-primary-600" />
          <h2 className="text-sm font-bold text-gray-900">Objectifs</h2>
          <span className="text-xs text-gray-400 ml-auto">{currentSubs} abonné{currentSubs > 1 ? 's' : ''} actif{currentSubs > 1 ? 's' : ''}</span>
        </div>

        {/* Progress bar */}
        <div className="mb-4">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
            <span>{prevMilestoneItem ? `${prevMilestoneItem.label} (${prevMilestoneItem.target})` : '0'}</span>
            <span>{nextMilestone.label} — {nextMilestone.target} abonnés</span>
          </div>
          <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary-500 to-indigo-500 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-1.5 text-center">
            Plus que {nextMilestone.target - currentSubs} abonné{nextMilestone.target - currentSubs > 1 ? 's' : ''} pour atteindre le niveau {nextMilestone.label}
          </p>
        </div>

        {/* Paliers table */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {MILESTONES.map((m) => {
            const gain = m.target * recurringCommission;
            const reached = currentSubs >= m.target;
            return (
              <div
                key={m.target}
                className={`rounded-lg p-3 text-center border transition-all ${
                  reached ? m.color : 'bg-gray-50 border-gray-200'
                }`}
              >
                <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${reached ? '' : 'text-gray-400'}`}>{m.label}</p>
                <p className={`text-xs font-semibold ${reached ? '' : 'text-gray-500'}`}>{m.target} abonnés</p>
                <p className={`text-sm font-bold ${reached ? '' : 'text-gray-700'}`}>{gain.toFixed(0)} €<span className="text-[10px] font-normal text-gray-400">/mois</span></p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Transactions */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-6">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Virements et commissions</h2>
          {payments.length > 0 && (
            <button onClick={exportCSV} className="inline-flex items-center gap-1.5 text-xs font-medium text-primary-600 hover:text-primary-700 px-3 py-1.5 bg-primary-50 rounded-lg transition-colors">
              <Download className="w-3.5 h-3.5" />
              Exporter CSV
            </button>
          )}
        </div>
        {logs.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">
            Aucun virement pour le moment. Partagez votre lien pour commencer.
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {logs.map((log) => {
              const isRefund = log.type === 'refund';
              const date = log.createdAt?.toDate
                ? log.createdAt.toDate().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                : '—';
              return (
                <div key={log.id} className="px-5 py-3 flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${isRefund ? 'bg-red-50' : 'bg-emerald-50'}`}>
                    {isRefund ? <ArrowDownLeft className="w-4 h-4 text-red-500" /> : <ArrowUpRight className="w-4 h-4 text-emerald-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900">
                      {isRefund ? 'Remboursement' : 'Commission'}
                      {log.source === 'invoice' ? ' (renouvellement)' : log.source === 'checkout' ? ' (1er paiement)' : ''}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{date}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-semibold ${isRefund ? 'text-red-600' : 'text-emerald-600'}`}>
                      {isRefund ? '-' : '+'}{((log.commission || log.amount || 0) / 100).toFixed(2)} €
                    </p>
                    {!isRefund && log.amount && (
                      <p className="text-[10px] text-gray-400">sur {(log.amount / 100).toFixed(2)} € TTC ({(log.amount / 100 / (1 + TVA_RATE)).toFixed(2)} € HT)</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
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
