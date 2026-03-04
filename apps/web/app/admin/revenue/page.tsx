'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { adminStatsService } from '@/services/admin';
import type { RevenueStats } from '@/services/admin/types';
import { AdminStatCard } from '@/app/admin/components';
import { Loader } from '@/components/ui';
import { DollarSign, CreditCard, Clock, XCircle } from 'lucide-react';

function formatCurrency(amountInCents: number): string {
  return (amountInCents / 100).toLocaleString('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }) + ' \u20ac';
}

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'paid') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
        Payé
      </span>
    );
  }
  if (status === 'open') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
        En attente
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400">
      {status}
    </span>
  );
}

export default function AdminRevenuePage() {
  const { user } = useAuth();
  const [data, setData] = useState<RevenueStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const stats = await adminStatsService.getRevenueStats(user!.id);
        if (!cancelled) setData(stats);
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Erreur lors du chargement des revenus');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [user?.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Revenue</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Suivi des revenus et abonnements Stripe
          </p>
        </div>
        <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 p-4 rounded-xl text-sm">
          {error}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const totalMrr = data.mrr;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Revenue</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Suivi des revenus et abonnements Stripe
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <AdminStatCard
          label="MRR"
          value={data.mrr}
          icon={<DollarSign className="w-5 h-5 text-red-500" />}
          format="currency"
        />
        <AdminStatCard
          label="Abonnements actifs"
          value={data.activeSubscriptions}
          icon={<CreditCard className="w-5 h-5 text-red-500" />}
          format="number"
        />
        <AdminStatCard
          label="Essais en cours"
          value={data.trialSubscriptions}
          icon={<Clock className="w-5 h-5 text-red-500" />}
          format="number"
        />
        <AdminStatCard
          label="Annulés ce mois"
          value={data.cancelledThisMonth}
          icon={<XCircle className="w-5 h-5 text-red-500" />}
          format="number"
        />
      </div>

      {/* Subscriptions by plan */}
      {data.subscriptionsByPlan.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Répartition par plan
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                  <th className="px-5 py-3 font-medium">Plan</th>
                  <th className="px-5 py-3 font-medium text-right">Abonnés</th>
                  <th className="px-5 py-3 font-medium text-right">MRR</th>
                  <th className="px-5 py-3 font-medium text-right">% du total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {data.subscriptionsByPlan.map((plan) => {
                  const pct = totalMrr > 0 ? ((plan.mrr / totalMrr) * 100).toFixed(1) : '0.0';
                  return (
                    <tr
                      key={plan.plan}
                      className="text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                    >
                      <td className="px-5 py-3 font-medium text-gray-900 dark:text-white">
                        {plan.plan}
                      </td>
                      <td className="px-5 py-3 text-right">{plan.count}</td>
                      <td className="px-5 py-3 text-right">{formatCurrency(plan.mrr)}</td>
                      <td className="px-5 py-3 text-right">{pct}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent payments */}
      {data.recentPayments.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Derniers paiements
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                  <th className="px-5 py-3 font-medium">Date</th>
                  <th className="px-5 py-3 font-medium">Client</th>
                  <th className="px-5 py-3 font-medium hidden md:table-cell">Email</th>
                  <th className="px-5 py-3 font-medium text-right">Montant</th>
                  <th className="px-5 py-3 font-medium text-center">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {data.recentPayments.map((payment) => (
                  <tr
                    key={payment.id}
                    className="text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <td className="px-5 py-3 whitespace-nowrap">
                      {formatDate(payment.created)}
                    </td>
                    <td className="px-5 py-3">
                      <div className="truncate max-w-[200px]">
                        {payment.providerName || '-'}
                      </div>
                    </td>
                    <td className="px-5 py-3 hidden md:table-cell">
                      <div className="truncate max-w-[200px] text-gray-500 dark:text-gray-400">
                        {payment.customerEmail || '-'}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right whitespace-nowrap font-medium">
                      {formatCurrency(payment.amount)}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <StatusBadge status={payment.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
