'use client';

import { useMemo, useState } from 'react';
import { Loader } from '@/components/ui';
import { TrendingDown, TrendingUp, Users } from 'lucide-react';
import { useStripeData } from '../StripeDataContext';
import { Chiffre, TableauTransactions, Titre, eur, moisCourt } from '../components';

/** Une gamme par produit, stable d'un écran à l'autre. */
const COULEURS = ['bg-emerald-500', 'bg-teal-500', 'bg-cyan-500', 'bg-sky-500', 'bg-indigo-500'];

export default function RevenusPage() {
  const { data, erreur } = useStripeData();
  const [moisChoisi, setMoisChoisi] = useState<string | null>(null);

  /**
   * Encaissements réels par mois, hors acomptes.
   *
   * Un acompte n'est PAS un revenu : il traverse le compte pour aller au
   * salon. Le mélanger aux abonnements gonflerait la courbe d'un argent qui
   * n'a jamais été à nous — c'est exactement ce qui rendait le relevé Stripe
   * illisible.
   */
  const encaisse = useMemo(() => {
    if (!data) return [];
    const par: Record<string, { revenu: number; frais: number }> = {};
    for (const t of data.transactions) {
      const mois = t.created.slice(0, 7);
      par[mois] = par[mois] ?? { revenu: 0, frais: 0 };
      if (t.category === 'revenu') {
        par[mois].revenu += t.amount;
        par[mois].frais += t.fee;
      } else if (t.category === 'remboursement' && !(t.description ?? '').includes('Acompte')) {
        par[mois].revenu += t.amount; // négatif
      }
    }
    return Object.entries(par)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([mois, v]) => ({ mois, ...v }));
  }, [data]);

  const detail = useMemo(() => {
    if (!data) return [];
    return data.transactions.filter(
      (t) =>
        (t.category === 'revenu' ||
          (t.category === 'remboursement' && !(t.description ?? '').includes('Acompte'))) &&
        (!moisChoisi || t.created.startsWith(moisChoisi)),
    );
  }, [data, moisChoisi]);

  if (erreur) return <p className="text-red-600">{erreur}</p>;
  if (!data) return <Loader />;

  const max = Math.max(1, ...encaisse.map((e) => Math.abs(e.revenu)));
  const totalMrr = Math.max(1, data.mrrActive);

  return (
    <div className="space-y-10">
      <section>
        <Titre note="Le MRR ne compte que les abonnements actifs, net de remise. Un essai et un code à 100 % ne sont pas du revenu.">
          Revenu récurrent
        </Titre>
        <div className="grid gap-4 sm:grid-cols-3">
          <Chiffre
            label="MRR encaissable" valeur={eur(data.mrrActive)} icone={TrendingUp} ton="positif"
            aide={`${data.activeCount} abonnements actifs`}
          />
          <Chiffre
            label="Essais en cours" valeur={eur(data.pipelineTrials)} icone={Users} ton="attention"
            aide={`${data.trialingCount} essais — NON compté dans le MRR`}
          />
          <Chiffre
            label="Perdu en remises" valeur={eur(data.mrrForfeitedToCoupons)} icone={TrendingDown} ton="negatif"
            aide={data.freeByCouponCount > 0
              ? `dont ${data.freeByCouponCount} abonnés actifs à 0 €`
              : 'aucun abonné actif à 0 €'}
          />
        </div>
      </section>

      <section>
        <Titre note="Chaque produit à sa place : le Pack sérénité est ventilé séparément même quand il partage l'abonnement d'un plan.">
          Répartition du MRR
        </Titre>

        {/* Barre de proportion — plus lisible qu'un camembert sur trois parts. */}
        <div className="flex h-10 rounded-lg overflow-hidden mb-4">
          {data.byProduct.map((p, i) => (
            <div
              key={p.label}
              className={`${COULEURS[i % COULEURS.length]} flex items-center justify-center`}
              style={{ width: `${(p.mrr / totalMrr) * 100}%` }}
              title={`${p.label} — ${eur(p.mrr)}`}
            >
              {p.mrr / totalMrr > 0.12 && (
                <span className="text-[11px] font-semibold text-white px-1 truncate">
                  {((p.mrr / totalMrr) * 100).toFixed(0)} %
                </span>
              )}
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400">
              <tr>
                <th className="text-left font-medium px-4 py-2">Produit</th>
                <th className="text-right font-medium px-4 py-2">Abonnés</th>
                <th className="text-right font-medium px-4 py-2">MRR net</th>
                <th className="text-right font-medium px-4 py-2">Part</th>
              </tr>
            </thead>
            <tbody>
              {data.byProduct.map((p, i) => (
                <tr key={p.label} className="border-t border-gray-100 dark:border-gray-800">
                  <td className="px-4 py-2">
                    <span className="flex items-center gap-2 text-gray-900 dark:text-white">
                      <span className={`w-3 h-3 rounded-sm ${COULEURS[i % COULEURS.length]}`} />
                      {p.label}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-gray-600 dark:text-gray-300">{p.subscribers}</td>
                  <td className="px-4 py-2 text-right tabular-nums font-medium text-gray-900 dark:text-white">{eur(p.mrr)}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-gray-500 dark:text-gray-400">
                    {((p.mrr / totalMrr) * 100).toFixed(0)} %
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <Titre note="Encaissements réels, acomptes exclus — ils ne vous appartiennent pas. Cliquez un mois pour voir le détail.">
          Encaissé mois par mois
        </Titre>

        <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <div className="flex items-end gap-3 h-48">
            {encaisse.map((e) => (
              <div key={e.mois} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                <span className="text-[11px] tabular-nums font-medium text-gray-700 dark:text-gray-300">
                  {(e.revenu / 100).toFixed(0)}
                </span>
                <button
                  type="button"
                  onClick={() => setMoisChoisi(moisChoisi === e.mois ? null : e.mois)}
                  className={`w-full rounded-md transition-opacity hover:opacity-80 ${
                    e.revenu < 0 ? 'bg-red-500' : 'bg-emerald-500'
                  }`}
                  style={{ height: `${(Math.abs(e.revenu) / max) * 100}%`, minHeight: '4px' }}
                  aria-label={`${moisCourt(e.mois)} : ${eur(e.revenu)}`}
                />
                <span className={`text-[11px] ${
                  moisChoisi === e.mois
                    ? 'text-gray-900 dark:text-white font-medium'
                    : 'text-gray-500 dark:text-gray-400'
                }`}>
                  {moisCourt(e.mois)}
                </span>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-4">
            Un mois peut retomber à zéro, voire passer sous la barre : un abonnement encaissé puis remboursé
            dans le même mois s&apos;annule, mais ses frais de traitement, eux, restent dus.
          </p>
        </div>
      </section>

      <section>
        <Titre>
          Détail des encaissements
          {moisChoisi && <span className="ml-2 normal-case text-gray-900 dark:text-white">— {moisCourt(moisChoisi)}</span>}
        </Titre>
        {moisChoisi && (
          <button
            type="button"
            onClick={() => setMoisChoisi(null)}
            className="mb-3 text-xs text-primary-600 dark:text-primary-400 hover:underline"
          >
            Voir toute la période
          </button>
        )}
        <TableauTransactions transactions={detail} vide="Aucun encaissement sur ce mois." />
      </section>
    </div>
  );
}
