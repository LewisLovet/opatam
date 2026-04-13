'use client';

import { useEffect, useState, useCallback } from 'react';
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
  };
}

interface LogEntry {
  id: string;
  type: string;
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

      // Get affiliateId from user doc
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const affiliateId = userDoc.data()?.affiliateId;
      if (!affiliateId) return;

      // Listen to affiliate doc in real-time
      const unsub = onSnapshot(doc(db, 'affiliates', affiliateId), (snap) => {
        if (snap.exists()) {
          setAffiliate({ id: snap.id, ...snap.data() } as AffiliateData);
        }
        setLoading(false);
      });

      // Fetch logs
      try {
        const logsQuery = query(
          collection(db, '_affiliateLogs'),
          where('affiliateId', '==', affiliateId),
          where('type', '==', 'payment'),
          orderBy('createdAt', 'desc'),
          limit(20)
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
                  if (data.url) {
                    window.open(data.url, '_blank');
                  }
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <Users className="w-4 h-4 text-blue-600" />
            </div>
            <span className="text-xs text-gray-500">Total filleuls</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{affiliate.stats.totalReferrals}</p>
        </div>

        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-2 bg-amber-50 rounded-lg">
              <Clock className="w-4 h-4 text-amber-600" />
            </div>
            <span className="text-xs text-gray-500">En essai</span>
          </div>
          <p className="text-2xl font-bold text-amber-600">{affiliate.stats.trialReferrals}</p>
        </div>

        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-2 bg-emerald-50 rounded-lg">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
            </div>
            <span className="text-xs text-gray-500">Convertis</span>
          </div>
          <p className="text-2xl font-bold text-emerald-600">{affiliate.stats.activeReferrals}</p>
        </div>

        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-2 bg-primary-50 rounded-lg">
              <Euro className="w-4 h-4 text-primary-600" />
            </div>
            <span className="text-xs text-gray-500">Commission totale</span>
          </div>
          <p className="text-2xl font-bold text-primary-600">{(affiliate.stats.totalCommission / 100).toFixed(2)} €</p>
        </div>
      </div>

      {/* Commission history */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">Historique des commissions</h2>
        </div>
        {logs.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">
            Aucune commission pour le moment. Partagez votre lien pour commencer.
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {logs.map((log) => (
              <div key={log.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-900">
                    Paiement de {(log.amount / 100).toFixed(2)} €
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {log.createdAt?.toDate ? log.createdAt.toDate().toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    }) : '—'}
                  </p>
                </div>
                <span className="text-sm font-semibold text-emerald-600">
                  +{(log.commission / 100).toFixed(2)} €
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
