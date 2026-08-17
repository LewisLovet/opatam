'use client';

import { useMemo, useState } from 'react';
import { Loader } from '@/components/ui';
import { useStripeData } from '../StripeDataContext';
import { Chiffre, TableauTransactions, Titre, eur, moisCourt } from '../components';

/**
 * Les trois postes, avec ce qu'ils SONT et ce qui les fait monter.
 *
 * L'explication n'est pas de la décoration : « Connect » ne veut rien dire sur
 * un relevé, et c'est pourtant le poste qui croît le plus vite. Sans le
 * `moteur`, un chiffre qui grimpe reste inexplicable.
 */
const POSTES = [
  {
    cle: 'connect',
    libelle: 'Connect',
    classe: 'bg-red-500',
    texte: 'text-red-600 dark:text-red-400',
    quoi: 'Ce que coûtent les comptes prestataires eux-mêmes.',
    moteur: '2 € par mois et par compte ayant eu de l’activité, ~0,25 % du volume qui y transite, et un frais par virement vers leur banque.',
    suit: 'le nombre de prestataires actifs',
  },
  {
    cle: 'traitement',
    libelle: 'Traitement',
    classe: 'bg-orange-400',
    texte: 'text-orange-600 dark:text-orange-400',
    quoi: 'La commission carte sur chaque encaissement passant par VOTRE compte.',
    moteur: '1,5 % + 0,25 € par paiement en Europe. Le fixe de 0,25 € domine sur les petits montants : un acompte de 13 € coûte 0,45 €, soit 3,5 %.',
    suit: 'le nombre de paiements, pas leur montant',
  },
  {
    cle: 'billing',
    libelle: 'Billing',
    classe: 'bg-amber-300',
    texte: 'text-amber-600 dark:text-amber-500',
    quoi: 'Le moteur d’abonnements de Stripe, facturé à l’usage.',
    moteur: 'Un pourcentage des sommes facturées en récurrent. Poste marginal aujourd’hui.',
    suit: 'le chiffre d’affaires des abonnements',
  },
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
   *
   * Un frais Connect se rattache au mois qu'il COUVRE (`period`), pas à sa date
   * de prélèvement — sinon le détail ne retrouverait pas le montant affiché.
   */
  const detail = useMemo(() => {
    if (!data) return [];
    return data.transactions.filter((t) => {
      const mois = t.category.startsWith('frais-') ? (t.period ?? t.created.slice(0, 7)) : t.created.slice(0, 7);
      if (moisChoisi && mois !== moisChoisi) return false;
      if (!posteChoisi) return t.fee > 0 || t.category.startsWith('frais-');
      if (posteChoisi === 'traitement') return t.fee > 0;
      if (posteChoisi === 'connect') return t.category === 'frais-connect';
      return t.category === 'frais-billing';
    });
  }, [data, moisChoisi, posteChoisi]);

  if (erreur) return <p className="text-red-600">{erreur}</p>;
  if (!data || !totaux) return <Loader />;

  const cumul = totaux.reduce((s, t) => s + t.total, 0);
  const dernier = totaux.at(-1);

  const selectionLisible = [
    moisChoisi ? moisCourt(moisChoisi) : null,
    posteChoisi ? POSTES.find((p) => p.cle === posteChoisi)!.libelle : null,
  ].filter(Boolean).join(' · ');

  return (
    <div className="space-y-10">
      <section>
        <div className="grid gap-4 sm:grid-cols-3">
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
      </section>

      {/* ── Un poste, une explication, une courbe ─────────────────────── */}
      <section>
        <Titre note="Chaque poste a sa propre échelle : ce qu'on lit ici est une PENTE, pas une comparaison de hauteurs. Cliquez une carte pour n'afficher que ses lignes.">
          De quoi ces frais sont faits
        </Titre>

        <div className="grid gap-4 lg:grid-cols-3">
          {POSTES.map((p) => {
            const serie = totaux.map((t) => t[p.cle]);
            const max = Math.max(1, ...serie);
            const total = serie.reduce((s, v) => s + v, 0);
            const part = cumul > 0 ? (total / cumul) * 100 : 0;
            const actif = posteChoisi === p.cle;

            return (
              <button
                key={p.cle}
                type="button"
                onClick={() => setPosteChoisi(actif ? null : p.cle)}
                aria-pressed={actif}
                className={`text-left rounded-xl border p-4 transition-colors ${
                  actif
                    ? 'border-gray-900 dark:border-white bg-gray-50 dark:bg-gray-800/50'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`w-3 h-3 rounded-sm ${p.classe}`} />
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">{p.libelle}</span>
                  <span className="ml-auto text-xs text-gray-400 tabular-nums">{part.toFixed(0)} %</span>
                </div>

                <p className={`text-2xl font-bold tabular-nums mt-2 ${p.texte}`}>{eur(-total)}</p>

                {/* Petite série, échelle propre au poste : on lit la tendance. */}
                <div className="flex items-end gap-1 h-14 mt-3" aria-hidden="true">
                  {totaux.map((t) => (
                    <div key={t.mois} className="flex-1 flex flex-col justify-end h-full">
                      <div
                        className={`${p.classe} rounded-sm ${actif ? '' : 'opacity-70'}`}
                        style={{ height: `${Math.max(2, (t[p.cle] / max) * 100)}%` }}
                      />
                    </div>
                  ))}
                </div>
                <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                  <span>{moisCourt(totaux[0].mois)}</span>
                  <span>{moisCourt(totaux.at(-1)!.mois)}</span>
                </div>

                <p className="text-xs text-gray-600 dark:text-gray-300 mt-3 leading-snug">{p.quoi}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 leading-snug">{p.moteur}</p>
                <p className="text-[11px] text-gray-400 mt-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                  Augmente avec <span className="font-medium text-gray-600 dark:text-gray-300">{p.suit}</span>.
                </p>
              </button>
            );
          })}
        </div>
      </section>

      {/* ── Le tableau, seule vue vraiment comparable ─────────────────── */}
      <section>
        <Titre note="Les frais Connect sont rattachés au mois qu'ils couvrent, pas à celui où Stripe les prélève — il facture à terme échu.">
          Mois par mois
        </Titre>
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400">
              <tr>
                <th className="text-left font-medium px-4 py-2">Mois</th>
                {POSTES.map((p) => (
                  <th key={p.cle} className="text-right font-medium px-4 py-2">
                    <span className="inline-flex items-center gap-1.5">
                      <span className={`w-2.5 h-2.5 rounded-sm ${p.classe}`} />
                      {p.libelle}
                    </span>
                  </th>
                ))}
                <th className="text-right font-medium px-4 py-2">Total</th>
              </tr>
            </thead>
            <tbody>
              {totaux.map((t) => (
                <tr
                  key={t.mois}
                  onClick={() => { setMoisChoisi(moisChoisi === t.mois ? null : t.mois); }}
                  className={`border-t border-gray-100 dark:border-gray-800 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/40 ${
                    moisChoisi === t.mois ? 'bg-gray-50 dark:bg-gray-800/40' : ''
                  }`}
                >
                  <td className="px-4 py-2 text-gray-900 dark:text-white">{moisCourt(t.mois)}</td>
                  {POSTES.map((p) => (
                    <td key={p.cle} className="px-4 py-2 text-right tabular-nums text-gray-600 dark:text-gray-300">
                      {t[p.cle] > 0 ? eur(-t[p.cle]) : <span className="text-gray-300 dark:text-gray-600">—</span>}
                    </td>
                  ))}
                  <td className="px-4 py-2 text-right tabular-nums font-semibold text-red-600 dark:text-red-400">
                    {eur(-t.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-gray-400">Cliquez une ligne pour n&apos;afficher que ce mois.</p>
      </section>

      {/* ── Le détail ─────────────────────────────────────────────────── */}
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

        <TableauTransactions transactions={detail} vide="Aucun frais sur cette sélection." />

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
