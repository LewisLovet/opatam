'use client';

import type { StripeTx } from '@/services/admin/types';
import type { LucideIcon } from 'lucide-react';

export const eur = (cents: number) =>
  (cents / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

export const moisCourt = (m: string) =>
  new Date(m + '-01').toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });

export const jour = (iso: string) =>
  new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' });

export function Chiffre({
  label, valeur, aide, ton = 'neutre', icone: Icone,
}: {
  label: string; valeur: string; aide?: string;
  ton?: 'neutre' | 'positif' | 'negatif' | 'attention'; icone?: LucideIcon;
}) {
  const couleur =
    ton === 'positif' ? 'text-emerald-600 dark:text-emerald-400'
    : ton === 'negatif' ? 'text-red-600 dark:text-red-400'
    : ton === 'attention' ? 'text-amber-600 dark:text-amber-500'
    : 'text-gray-900 dark:text-white';
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center gap-2 mb-1">
        {Icone && <Icone className="w-4 h-4 text-gray-400" />}
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</p>
      </div>
      <p className={`text-2xl font-bold tabular-nums ${couleur}`}>{valeur}</p>
      {aide && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-snug">{aide}</p>}
    </div>
  );
}

export function Titre({ children, note }: { children: React.ReactNode; note?: string }) {
  return (
    <div className="mb-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{children}</h2>
      {note && <p className="text-xs text-gray-400 mt-1 max-w-2xl leading-snug">{note}</p>}
    </div>
  );
}

const LIBELLES: Record<StripeTx['category'], { texte: string; classe: string }> = {
  revenu: { texte: 'Revenu', classe: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' },
  acompte: { texte: 'Acompte', classe: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
  'frais-connect': { texte: 'Frais Connect', classe: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
  'frais-billing': { texte: 'Frais Billing', classe: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' },
  remboursement: { texte: 'Remboursement', classe: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400' },
  reversement: { texte: 'Reversé au pro', classe: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
  virement: { texte: 'Virement bancaire', classe: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
  reserve: { texte: 'Fonds réservés', classe: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400' },
  autre: { texte: 'Autre', classe: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
};

export function Etiquette({ categorie }: { categorie: StripeTx['category'] }) {
  const l = LIBELLES[categorie];
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap ${l.classe}`}>
      {l.texte}
    </span>
  );
}

/**
 * Le relevé, ligne à ligne.
 *
 * La colonne « frais » est distincte du montant : sur un encaissement,
 * Stripe prélève sa commission À L'INTÉRIEUR de la transaction. Les
 * confondre ferait disparaître les frais de traitement du décompte, alors
 * qu'ils représentent le second poste de coût.
 */
export function TableauTransactions({
  transactions, vide = 'Aucune transaction.',
}: {
  transactions: StripeTx[]; vide?: string;
}) {
  if (transactions.length === 0)
    return <p className="text-sm text-gray-500 dark:text-gray-400 py-6 text-center">{vide}</p>;

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-x-auto">
      <table className="w-full text-sm min-w-[680px]">
        <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400">
          <tr>
            <th className="text-left font-medium px-4 py-2">Date</th>
            <th className="text-left font-medium px-4 py-2">Poste</th>
            <th className="text-left font-medium px-4 py-2">Libellé</th>
            <th className="text-right font-medium px-4 py-2">Montant</th>
            <th className="text-right font-medium px-4 py-2">Frais</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((t) => (
            <tr key={t.id} className="border-t border-gray-100 dark:border-gray-800">
              <td className="px-4 py-2 whitespace-nowrap tabular-nums text-gray-500 dark:text-gray-400">{jour(t.created)}</td>
              <td className="px-4 py-2"><Etiquette categorie={t.category} /></td>
              <td className="px-4 py-2 text-gray-700 dark:text-gray-300 max-w-md">
                <span className="line-clamp-2">{t.description || <span className="text-gray-400">—</span>}</span>
              </td>
              <td className={`px-4 py-2 text-right tabular-nums font-medium ${
                t.amount < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'
              }`}>
                {eur(t.amount)}
              </td>
              <td className="px-4 py-2 text-right tabular-nums text-red-600 dark:text-red-400">
                {t.fee ? eur(-t.fee) : <span className="text-gray-300 dark:text-gray-600">—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
