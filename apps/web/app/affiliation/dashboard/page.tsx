'use client';

import { useEffect, useState } from 'react';
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

export default function AffiliateDashboardPage() {
  const [affiliate, setAffiliate] = useState<AffiliateData | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) return;

      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const affiliateId = userDoc.data()?.affiliateId;
      if (!affiliateId) return;

      // Real-time listener on affiliate doc
      const unsub = onSnapshot(doc(db, 'affiliates', affiliateId), (snap) => {
        if (snap.exists()) {
          setAffiliate({ id: snap.id, ...snap.data() } as AffiliateData);
        }
        setLoading(false);
      });

      // Fetch all logs (payments + refunds)
      try {
        const logsQuery = query(
          collection(db, '_affiliateLogs'),
          where('affiliateId', '==', affiliateId),
          orderBy('createdAt', 'desc'),
          limit(50)
        );
        const logsSnap = await getDocs(logsQuery);
        setLogs(logsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as LogEntry)));
      } catch {
        // Index might not exist yet
      }

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
    const header = 'Date,Type,Montant paiement (€),Commission (€),Source\n';
    const rows = payments.map((l) => {
      const date = l.createdAt?.toDate
        ? l.createdAt.toDate().toLocaleDateString('fr-FR')
        : '—';
      return `${date},Commission,${(l.amount / 100).toFixed(2)},${(l.commission / 100).toFixed(2)},${l.source || 'checkout'}`;
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

  const payments = logs.filter((l) => l.type === 'payment');
  const refunds = logs.filter((l) => l.type === 'refund');
  const thisMonth = payments.filter((l) => {
    if (!l.createdAt?.toDate) return false;
    const d = l.createdAt.toDate();
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const thisMonthCommission = thisMonth.reduce((s, l) => s + (l.commission || 0), 0);

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Bonjour, {affiliate.name}</h1>
        <p className="text-sm text-gray-500 mt-1">Voici un résumé de votre activité d'affiliation</p>
      </div>

      {/* Onboarding warning */}
      {affiliate.stripeAccountStatus !== 'active' && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-800">Configuration Stripe incomplète</p>
            <p className="text-xs text-amber-600 mt-1 mb-3">
              Complétez la configuration de votre compte pour recevoir vos commissions.
            </p>
            <button
              onClick={async () => {
                try {
                  const res = await fetch('/api/affiliates/onboarding', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ affiliateId: affiliate.id }),
                  });
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

      {/* Share link */}
      <div className="mb-6 bg-primary-50 border border-primary-200 rounded-xl p-5">
        <p className="text-sm font-semibold text-primary-800 mb-2">Votre lien de partage</p>
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-white border border-primary-200 rounded-lg px-4 py-2.5 text-sm text-gray-700 font-mono truncate">
            opatam.com/register?ref={affiliate.code}
          </div>
          <button
            onClick={copyLink}
            className="px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copié' : 'Copier'}
          </button>
        </div>
        <div className="flex items-center gap-4 mt-3 text-xs text-primary-600">
          <span className="font-semibold">Code : {affiliate.code}</span>
          <span>Commission : {affiliate.commission}%</span>
          {affiliate.discount && (
            <span>Réduction filleuls : -{affiliate.discount}% sur {DURATION_LABELS[affiliate.discountDuration || 'once']}</span>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 bg-blue-50 rounded-lg">
              <Users className="w-3.5 h-3.5 text-blue-600" />
            </div>
            <span className="text-[11px] text-gray-500">Filleuls</span>
          </div>
          <p className="text-xl font-bold text-gray-900">{affiliate.stats.totalReferrals}</p>
        </div>

        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 bg-amber-50 rounded-lg">
              <Clock className="w-3.5 h-3.5 text-amber-600" />
            </div>
            <span className="text-[11px] text-gray-500">En essai</span>
          </div>
          <p className="text-xl font-bold text-amber-600">{affiliate.stats.trialReferrals}</p>
        </div>

        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 bg-emerald-50 rounded-lg">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            <span className="text-[11px] text-gray-500">Convertis</span>
          </div>
          <p className="text-xl font-bold text-emerald-600">{affiliate.stats.activeReferrals}</p>
        </div>

        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 bg-primary-50 rounded-lg">
              <Euro className="w-3.5 h-3.5 text-primary-600" />
            </div>
            <span className="text-[11px] text-gray-500">Total gagné</span>
          </div>
          <p className="text-xl font-bold text-primary-600">{(affiliate.stats.totalCommission / 100).toFixed(2)} €</p>
        </div>

        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 bg-violet-50 rounded-lg">
              <Euro className="w-3.5 h-3.5 text-violet-600" />
            </div>
            <span className="text-[11px] text-gray-500">Ce mois</span>
          </div>
          <p className="text-xl font-bold text-violet-600">{(thisMonthCommission / 100).toFixed(2)} €</p>
        </div>
      </div>

      {/* Link clicks */}
      {affiliate.stats.linkClicks !== undefined && (
        <div className="mb-6 bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex items-center gap-4">
          <div className="p-3 bg-indigo-50 rounded-xl">
            <MousePointerClick className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">{affiliate.stats.linkClicks} clics sur votre lien</p>
            <p className="text-xs text-gray-500">Nombre de personnes qui ont visité la page d'inscription via votre lien</p>
          </div>
          {affiliate.stats.totalReferrals > 0 && affiliate.stats.linkClicks! > 0 && (
            <div className="ml-auto text-right">
              <p className="text-lg font-bold text-indigo-600">
                {((affiliate.stats.totalReferrals / affiliate.stats.linkClicks!) * 100).toFixed(1)}%
              </p>
              <p className="text-[11px] text-gray-400">Taux de conversion</p>
            </div>
          )}
        </div>
      )}

      {/* Transactions */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-6">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Virements et commissions</h2>
          {payments.length > 0 && (
            <button
              onClick={exportCSV}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-primary-600 hover:text-primary-700 px-3 py-1.5 bg-primary-50 rounded-lg transition-colors"
            >
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
                ? log.createdAt.toDate().toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : '—';

              return (
                <div key={log.id} className="px-5 py-3 flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${isRefund ? 'bg-red-50' : 'bg-emerald-50'}`}>
                    {isRefund ? (
                      <ArrowDownLeft className="w-4 h-4 text-red-500" />
                    ) : (
                      <ArrowUpRight className="w-4 h-4 text-emerald-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900">
                      {isRefund ? 'Remboursement' : 'Commission'}
                      {log.source === 'invoice' ? ' (renouvellement)' : log.source === 'checkout' ? ' (premier paiement)' : ''}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{date}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-semibold ${isRefund ? 'text-red-600' : 'text-emerald-600'}`}>
                      {isRefund ? '-' : '+'}{((log.commission || log.amount || 0) / 100).toFixed(2)} €
                    </p>
                    {!isRefund && log.amount && (
                      <p className="text-[11px] text-gray-400">sur {(log.amount / 100).toFixed(2)} € payés</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="bg-gray-50 rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Récapitulatif</h3>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-lg font-bold text-gray-900">{payments.length}</p>
            <p className="text-xs text-gray-500">Virements reçus</p>
          </div>
          <div>
            <p className="text-lg font-bold text-red-600">{refunds.length}</p>
            <p className="text-xs text-gray-500">Remboursements</p>
          </div>
          <div>
            <p className="text-lg font-bold text-emerald-600">
              {((affiliate.stats.totalCommission) / 100).toFixed(2)} €
            </p>
            <p className="text-xs text-gray-500">Solde net</p>
          </div>
        </div>
      </div>
    </div>
  );
}
