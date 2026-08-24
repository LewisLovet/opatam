'use client';

import { Check, Clock, Percent, ShieldCheck, Ticket } from 'lucide-react';
import { SUBSCRIPTION_PLANS } from '@booking-app/shared';

/**
 * Offres — ce que le commercial présente au prospect, tel qu'il peut le
 * montrer sur son écran ou son téléphone pendant l'entretien.
 *
 * Les chiffres viennent de SUBSCRIPTION_PLANS (la même source que la page
 * publique et le checkout) : un tarif qui change ne peut pas laisser cette
 * page mentir.
 *
 * Les offres ENCADRÉES (essai prolongé, remise premier mois…) arriveront ici
 * sous forme de liens signés — même mécanique que l'attribution — pour
 * qu'une remise accordée soit traçable et infalsifiable. La politique de
 * remise reste à décider côté direction.
 */

function euros(cents: number): string {
  return (cents / 100).toLocaleString('fr-FR', {
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

const ARGUMENTS = [
  {
    icone: Clock,
    titre: '30 jours gratuits',
    texte: 'Essai complet sans carte bancaire — le prospect ne risque rien.',
  },
  {
    icone: Percent,
    titre: '0 % de commission',
    texte: 'Un abonnement fixe, jamais un pourcentage sur les réservations.',
  },
  {
    icone: ShieldCheck,
    titre: 'Sans engagement',
    texte: 'Résiliable à tout moment — le prix affiché est le prix payé.',
  },
];

export default function OffresPage() {
  const solo = SUBSCRIPTION_PLANS.solo;
  const team = SUBSCRIPTION_PLANS.team;

  const plans = [
    {
      nom: solo.name,
      pourQui: 'Indépendant·e — un agenda, un lieu',
      mensuel: solo.monthlyPrice,
      annuel: solo.yearlyPrice,
      features: solo.features,
      accent: false,
    },
    {
      nom: team.name,
      pourQui: 'Équipe — jusqu’à 10 agendas et 10 adresses',
      mensuel: team.baseMonthlyPrice,
      annuel: team.baseYearlyPrice,
      features: team.features,
      accent: true,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Offres</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Les tarifs à présenter au prospect — les mêmes chiffres que la page publique et le paiement.
        </p>
      </div>

      {/* Les trois arguments à poser AVANT le prix */}
      <div className="grid sm:grid-cols-3 gap-3">
        {ARGUMENTS.map(({ icone: Icone, titre, texte }) => (
          <div
            key={titre}
            className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4"
          >
            <span className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 inline-flex items-center justify-center">
              <Icone className="w-4 h-4" />
            </span>
            <p className="text-sm font-semibold text-gray-900 dark:text-white mt-2.5">{titre}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{texte}</p>
          </div>
        ))}
      </div>

      {/* Les deux plans */}
      <div className="grid lg:grid-cols-2 gap-4 max-w-4xl">
        {plans.map((p) => {
          const economie = p.mensuel * 12 - p.annuel;
          return (
            <div
              key={p.nom}
              className={`rounded-2xl border bg-white dark:bg-gray-900 overflow-hidden ${
                p.accent
                  ? 'border-red-300 dark:border-red-800 ring-1 ring-red-100 dark:ring-red-900/40'
                  : 'border-gray-200 dark:border-gray-800'
              }`}
            >
              <div className="px-6 pt-5 pb-4 border-b border-gray-100 dark:border-gray-800">
                <div className="flex items-baseline justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">{p.nom}</h2>
                    <p className="text-[11px] text-gray-400">{p.pourQui}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold tabular-nums text-gray-900 dark:text-white leading-none">
                      {euros(p.mensuel)}&nbsp;€
                      <span className="text-sm font-normal text-gray-400">/mois</span>
                    </p>
                    <p className="text-[11px] text-gray-400 mt-1">
                      ou {euros(p.annuel)} €/an
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                        {' '}
                        (−{euros(economie)} €)
                      </span>
                    </p>
                  </div>
                </div>
              </div>
              <ul className="px-6 py-4 space-y-2">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
                    <Check className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {/* Repères de conversation */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 max-w-4xl">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
          Repères pour l&apos;entretien
        </h2>
        <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
          <li className="flex items-start gap-2">
            <Check className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
            <span>
              <strong>Face à une plateforme à commission</strong> : à ~20 réservations par mois,
              une commission de 2 € dépasse déjà l&apos;abonnement Pro entier — et le fichier
              client reste la propriété du salon, pas de la marketplace.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <Check className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
            <span>
              <strong>Face au papier / DM Instagram</strong> : les rappels automatiques réduisent
              les lapins, et la page se remplit la nuit, quand le salon est fermé.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <Check className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
            <span>
              <strong>L&apos;annuel</strong> se propose après l&apos;adhésion au mensuel, jamais
              avant — deux mois offerts, même produit.
            </span>
          </li>
        </ul>
      </div>

      {/* Ce qui arrive ici */}
      <div className="rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 p-5 max-w-4xl flex items-start gap-3">
        <Ticket className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
          <strong className="text-gray-700 dark:text-gray-300">Bientôt ici :</strong> les offres
          encadrées — essai prolongé, remise sur le premier mois — sous forme de liens signés et
          traçables, comme l&apos;attribution. La politique de remise doit d&apos;abord être
          décidée côté direction : rien ne se promet à un prospect tant qu&apos;elle ne l&apos;est
          pas.
        </p>
      </div>
    </div>
  );
}
