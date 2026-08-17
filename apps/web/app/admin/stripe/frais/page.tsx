'use client';

import { useMemo, useState } from 'react';
import { Loader } from '@/components/ui';
import { useStripeData } from '../StripeDataContext';
import { Chiffre, TableauTransactions, Titre, eur, moisCourt } from '../components';

/** Les trois postes de frais, dans l'ordre où on veut les lire. */
const POSTES = [
  { cle: 'connect', libelle: 'Connect', classe: 'bg-red-500' },
  { cle: 'traitement', libelle: 'Traitement', classe: 'bg-orange-400' },
  { cle: 'billing', libelle: 'Billing', classe: 'bg-amber-300' },
] as const;

type Poste = (typeof POSTES)[number]['cle'];

export default function FraisPage() {
  const { data, erreur } = useStripeData();
  const [moisChoisi, setMoisChoisi] = useState<string | null>(null);
  const [posteChoisi, setPosteChoisi] = useState<Poste | null>(null);

  const totaux = useMemo(() => {
    if (!data) return null;
    return data.months.map((m) => ({
      mois: m.month,
      traitement: m.processingFees,
      connect: -m.connectFees,
      billing: -m.billingFees,
      total: m.processingFees - m.connectFees - m.billingFees,
    }));
  }, [data]);

  /**
   * Les transactions derrière la sélection.
   *
   * Les frais de traitement ne sont PAS des transactions à part : Stripe les
   * prélève à l'intérieur de l'encaissement. Les retrouver demande donc de
   * chercher les lignes qui portent un `fee`, pas celles de type « frais ».
   */
  const detail = useMemo(() => {
    if (!data) return [];
    return data.transactions.filter((t) => {
      if (moisChoisi && !t.created.startsWith(moisChoisi)) return false;
      if (!posteChoisi) return t.fee > 0 || t.category.startsWith('frais-');
      if (posteChoisi === 'traitement') return t.fee > 0;
      if (posteChoisi === 'connect') return t.category === 'frais-connect';
      return t.category === 'frais-billing';
    });
  }, [data, moisChoisi, posteChoisi]);

  if (erreur) return <p className="text-red-600">{erreur}</p>;
  if (!data || !totaux) return <Loader />;

  const max = Math.max(1, ...totaux.map((t) => t.total));
  const cumul = totaux.reduce((s, t) => s + t.total, 0);
  const dernier = totaux.at(-1);

  const selectionLisible = [
    moisChoisi ? moisCourt(moisChoisi) : null,
    posteChoisi ? POSTES.find((p) => p.cle === posteChoisi)!.libelle : null,
  ].filter(Boolean).join(' · ');

  return (
    <div className="space-y-10">
      <section>
        <Titre note="Cliquez un mois ou un poste pour voir les transactions qui composent le montant.">
          Évolution des frais
        </Titre>

        <div className="grid gap-4 sm:grid-cols-3 mb-6">
          <Chiffre label="Frais du dernier mois" valeur={eur(dernier?.total ?? 0)} ton="negatif" />
          <Chiffre
            label="Cumul sur la période" valeur={eur(cumul)} ton="negatif"
            aide={`${data.months.length} mois`}
          />
          <Chiffre
            label="Part du MRR" ton="negatif"
            valeur={data.mrrActive > 0 ? `${(((dernier?.total ?? 0) / data.mrrActive) * 100).toFixed(1)} %` : '—'}
            aide="frais du dernier mois rapportés au MRR encaissable"
          />
        </div>

        {/* Graphique — chaque segment est cliquable, d'où les <button>. */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <div className="flex items-end gap-3 h-52">
            {totaux.map((t) => (
              <div key={t.mois} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                <span className="text-[11px] tabular-nums font-medium text-gray-700 dark:text-gray-300">
                  {t.total > 0 ? (t.total / 100).toFixed(2) : '—'}
                </span>
                <div
                  className="w-full flex flex-col-reverse rounded-md overflow-hidden"
                  style={{ height: `${(t.total / max) * 100}%` }}
                >
                  {POSTES.map((p) => (
                    <button
                      key={p.cle}
                      type="button"
                      onClick={() => { setMoisChoisi(t.mois); setPosteChoisi(p.cle); }}
                      className={`${p.classe} hover:opacity-80 transition-opacity`}
                      style={{ height: `${(t[p.cle] / Math.max(1, t.total)) * 100}%` }}
                      title={`${p.libelle} — ${eur(t[p.cle])}`}
                      aria-label={`${p.libelle} de ${moisCourt(t.mois)} : ${eur(t[p.cle])}`}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => { setMoisChoisi(t.mois); setPosteChoisi(null); }}
                  className={`text-[11px] px-1.5 py-0.5 rounded transition-colors ${
                    moisChoisi === t.mois
                      ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  {moisCourt(t.mois)}
                </button>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-4 mt-4 text-xs text-gray-500 dark:text-gray-400">
            {POSTES.map((p) => (
              <button
                key={p.cle}
                type="button"
                onClick={() => { setPosteChoisi(posteChoisi === p.cle ? null : p.cle); setMoisChoisi(null); }}
                className={`flex items-center gap-1.5 hover:text-gray-900 dark:hover:text-white ${
                  posteChoisi === p.cle ? 'text-gray-900 dark:text-white font-medium' : ''
                }`}
              >
                <span className={`w-3 h-3 rounded-sm ${p.classe}`} />
                {p.libelle}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-gray-200 dark:border-gray-700 overflow-x-auto">
          <table className="w-full text-sm min-w-[520px]">
            <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400">
              <tr>
                <th className="text-left font-medium px-4 py-2">Mois</th>
                <th className="text-right font-medium px-4 py-2">Traitement</th>
                <th className="text-right font-medium px-4 py-2">Connect</th>
                <th className="text-right font-medium px-4 py-2">Billing</th>
                <th className="text-right font-medium px-4 py-2">Total</th>
              </tr>
            </thead>
            <tbody>
              {totaux.map((t) => (
                <tr
                  key={t.mois}
                  onClick={() => { setMoisChoisi(t.mois); setPosteChoisi(null); }}
                  className={`border-t border-gray-100 dark:border-gray-800 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/40 ${
                    moisChoisi === t.mois ? 'bg-gray-50 dark:bg-gray-800/40' : ''
                  }`}
                >
                  <td className="px-4 py-2 text-gray-900 dark:text-white">{moisCourt(t.mois)}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-red-600 dark:text-red-400">{eur(-t.traitement)}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-red-600 dark:text-red-400">{eur(-t.connect)}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-red-600 dark:text-red-400">{eur(-t.billing)}</td>
                  <td className="px-4 py-2 text-right tabular-nums font-semibold text-red-600 dark:text-red-400">{eur(-t.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <Titre note="Les frais de traitement ne sont pas des lignes à part : Stripe les prélève à l'intérieur de l'encaissement. La colonne « Frais » les isole.">
          D&apos;où viennent ces montants
          {selectionLisible && <span className="ml-2 normal-case text-gray-900 dark:text-white">— {selectionLisible}</span>}
        </Titre>

        {(moisChoisi || posteChoisi) && (
          <button
            type="button"
            onClick={() => { setMoisChoisi(null); setPosteChoisi(null); }}
            className="mb-3 text-xs text-primary-600 dark:text-primary-400 hover:underline"
          >
            Voir tous les frais de la période
          </button>
        )}

        <TableauTransactions
          transactions={detail}
          vide="Aucun frais sur cette sélection."
        />

        <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">
          Total de la sélection :{' '}
          <span className="font-semibold tabular-nums text-red-600 dark:text-red-400">
            {eur(-detail.reduce((s, t) => s + t.fee + (t.category.startsWith('frais-') ? -t.amount : 0), 0))}
          </span>
        </p>
      </section>
    </div>
  );
}
