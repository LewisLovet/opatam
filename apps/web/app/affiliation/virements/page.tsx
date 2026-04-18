'use client';

import { useMemo, useState } from 'react';
import {
  ArrowUpRight,
  ArrowDownLeft,
  Download,
  Euro,
  Calendar,
  Filter,
} from 'lucide-react';

import { useAffiliate, type LogEntry } from '../_shared/useAffiliate';
import { TVA_RATE } from '../_shared/constants';

type Period = 'all' | 'year' | 'month';
type Kind = 'all' | 'payment' | 'refund';

function matchesPeriod(log: LogEntry, period: Period): boolean {
  if (period === 'all') return true;
  if (!log.createdAt?.toDate) return false;
  const d = log.createdAt.toDate();
  const now = new Date();
  if (period === 'month') {
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }
  // year
  return d.getFullYear() === now.getFullYear();
}

export default function VirementsPage() {
  const { affiliate, logs, loading } = useAffiliate();
  const [period, setPeriod] = useState<Period>('all');
  const [kind, setKind] = useState<Kind>('all');

  const filtered = useMemo(() => {
    return logs.filter((l) => {
      if (!matchesPeriod(l, period)) return false;
      if (kind !== 'all' && l.type !== kind) return false;
      return true;
    });
  }, [logs, period, kind]);

  const totals = useMemo(() => {
    let payments = 0;
    let refunds = 0;
    let commissionPayments = 0;
    let commissionRefunds = 0;
    filtered.forEach((l) => {
      if (l.type === 'payment') {
        payments += l.amount || 0;
        commissionPayments += l.commission || 0;
      } else {
        refunds += l.amount || 0;
        commissionRefunds += l.commission || 0;
      }
    });
    return { payments, refunds, commissionPayments, commissionRefunds };
  }, [filtered]);

  const exportCSV = () => {
    if (!filtered.length || !affiliate) return;
    const header = 'Date,Type,Montant TTC,Montant HT,Commission,Source\n';
    const rows = filtered
      .map((l) => {
        const date = l.createdAt?.toDate ? l.createdAt.toDate().toLocaleDateString('fr-FR') : '';
        return `${date},${l.type},${(l.amount / 100).toFixed(2)},${(l.amount / 100 / (1 + TVA_RATE)).toFixed(2)},${(l.commission / 100).toFixed(2)},${l.source || 'checkout'}`;
      })
      .join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `commissions-${affiliate.code}-${new Date().toISOString().slice(0, 10)}.csv`;
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

  const netCommission = totals.commissionPayments - totals.commissionRefunds;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Virements et commissions</h1>
        <p className="text-sm text-gray-500 mt-1">
          Historique complet des transferts reçus sur votre compte Stripe
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-400 mb-1">Commissions</p>
          <p className="text-lg sm:text-xl font-bold text-emerald-600">
            +{(totals.commissionPayments / 100).toFixed(2)} €
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-400 mb-1">Remboursements</p>
          <p className="text-lg sm:text-xl font-bold text-red-500">
            -{(totals.commissionRefunds / 100).toFixed(2)} €
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-400 mb-1">Net</p>
          <p className="text-lg sm:text-xl font-bold text-gray-900">
            {(netCommission / 100).toFixed(2)} €
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-400 mb-1">Transactions</p>
          <p className="text-lg sm:text-xl font-bold text-gray-900">{filtered.length}</p>
        </div>
      </div>

      {/* Filters + export */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as Period)}
              className="bg-transparent text-sm text-gray-700 focus:outline-none cursor-pointer"
            >
              <option value="all">Toute la période</option>
              <option value="year">Cette année</option>
              <option value="month">Ce mois-ci</option>
            </select>
          </div>
          <div className="h-5 w-px bg-gray-200" />
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as Kind)}
              className="bg-transparent text-sm text-gray-700 focus:outline-none cursor-pointer"
            >
              <option value="all">Tout</option>
              <option value="payment">Commissions</option>
              <option value="refund">Remboursements</option>
            </select>
          </div>
        </div>
        <button
          onClick={exportCSV}
          disabled={filtered.length === 0}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Download className="w-4 h-4" />
          Exporter CSV
        </button>
      </div>

      {/* Transactions list */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center mb-4">
              <Euro className="w-5 h-5 text-gray-300" />
            </div>
            <p className="text-sm text-gray-400">Aucun virement pour cette période.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {filtered.map((log) => {
              const isRefund = log.type === 'refund';
              const date = log.createdAt?.toDate
                ? log.createdAt.toDate().toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })
                : '';
              return (
                <div key={log.id} className="px-4 sm:px-5 py-4 flex items-center gap-3">
                  <div className={`p-2 rounded-lg flex-shrink-0 ${isRefund ? 'bg-red-50' : 'bg-emerald-50'}`}>
                    {isRefund ? (
                      <ArrowDownLeft className="w-4 h-4 text-red-500" />
                    ) : (
                      <ArrowUpRight className="w-4 h-4 text-emerald-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 truncate">
                      {isRefund ? 'Remboursement' : 'Commission'}
                      {log.source === 'invoice'
                        ? ' (renouvellement)'
                        : log.source === 'checkout'
                        ? ' (1er paiement)'
                        : ''}
                    </p>
                    <p className="text-xs text-gray-400">{date}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={`text-sm font-semibold ${isRefund ? 'text-red-600' : 'text-emerald-600'}`}>
                      {isRefund ? '-' : '+'}
                      {((log.commission || log.amount || 0) / 100).toFixed(2)} €
                    </p>
                    {!isRefund && log.amount && (
                      <p className="text-[10px] text-gray-400">
                        sur {(log.amount / 100 / (1 + TVA_RATE)).toFixed(2)} € HT
                      </p>
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
