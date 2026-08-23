'use client';

import { useEffect, useState } from 'react';
import { getAuth } from 'firebase/auth';
import { Loader } from '@/components/ui';
import { AlertTriangle, Clock, Rocket, TrendingUp } from 'lucide-react';

/** Ce que renvoie /api/sales/overview. */
interface Overview {
  role: 'admin' | 'sales' | 'sales_manager';
  essaisQuiExpirent: Array<{
    providerId: string;
    businessName: string;
    joursRestants: number;
    activation: { score: number; activated: boolean; nextStep: string | null };
  }>;
  aActiver: Array<{
    providerId: string;
    businessName: string;
    joursDepuisInscription: number;
    activation: { score: number; activated: boolean; nextStep: string | null };
  }>;
  pipeline: { total: number; parEtape: Record<string, number> };
}

const NEXT_STEP_LABELS: Record<string, string> = {
  prestations: 'Ajouter des prestations (min. 3)',
  disponibilites: 'Configurer les disponibilités',
  publier: 'Publier la page',
  premiere_reservation: 'Obtenir la première réservation',
};

/**
 * Tableau de bord commercial — dynamique dès le premier jour.
 *
 * Avant tout prospect saisi, il montre déjà ce que le produit sait : les
 * essais qui expirent cette semaine et les inscrits récents pas encore
 * activés, chacun avec sa « prochaine meilleure action » — celle de
 * computeActivation, la définition officielle.
 */
export default function SalesDashboardPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const token = await getAuth().currentUser?.getIdToken();
        const res = await fetch('/api/sales/overview', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error((await res.json()).error ?? `Erreur ${res.status}`);
        setData(await res.json());
      } catch (e) {
        setErreur(e instanceof Error ? e.message : 'Erreur inconnue');
      }
    })();
  }, []);

  if (erreur) return <p className="text-red-600">{erreur}</p>;
  if (!data) return <Loader />;

  const kpis = [
    {
      icone: Clock,
      label: 'Essais qui expirent (7 j)',
      valeur: data.essaisQuiExpirent.length,
      ton: data.essaisQuiExpirent.length > 0 ? 'text-amber-600 dark:text-amber-500' : 'text-gray-900 dark:text-white',
    },
    {
      icone: Rocket,
      label: 'Inscrits récents à activer',
      valeur: data.aActiver.length,
      ton: data.aActiver.length > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white',
    },
    {
      icone: TrendingUp,
      label: 'Prospects au pipeline',
      valeur: data.pipeline.total,
      ton: 'text-gray-900 dark:text-white',
    },
  ];

  const Progression = ({ score }: { score: number }) => (
    <span className="inline-flex items-center gap-1" title={`${score}/4 critères d'activation`}>
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className={`w-1.5 h-4 rounded-sm ${i < score ? 'bg-emerald-500' : 'bg-gray-200 dark:bg-gray-700'}`}
        />
      ))}
    </span>
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Tableau de bord</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Ce qui demande une action aujourd&apos;hui — alimenté par l&apos;usage réel des comptes.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-3">
        {kpis.map(({ icone: Icone, label, valeur, ton }) => (
          <div key={label} className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
            <div className="flex items-center gap-2 mb-1">
              <Icone className="w-4 h-4 text-gray-400" />
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</p>
            </div>
            <p className={`text-3xl font-bold tabular-nums ${ton}`}>{valeur}</p>
          </div>
        ))}
      </div>

      {/* Essais qui expirent */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">
          Essais qui expirent cette semaine
        </h2>
        {data.essaisQuiExpirent.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 rounded-xl border border-dashed border-gray-200 dark:border-gray-800 p-6 text-center">
            Aucun essai n&apos;expire dans les 7 prochains jours.
          </p>
        ) : (
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
            {data.essaisQuiExpirent.map((e) => (
              <div key={e.providerId} className="flex items-center gap-4 px-4 py-3">
                <AlertTriangle className={`w-4 h-4 flex-shrink-0 ${e.joursRestants <= 1 ? 'text-red-500' : 'text-amber-500'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{e.businessName}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {e.activation.activated
                      ? 'Compte activé — proposer l’abonnement'
                      : NEXT_STEP_LABELS[e.activation.nextStep ?? ''] ?? 'Accompagner la configuration'}
                  </p>
                </div>
                <Progression score={e.activation.score} />
                <span className={`text-xs font-semibold tabular-nums whitespace-nowrap ${e.joursRestants <= 1 ? 'text-red-600' : 'text-amber-600'}`}>
                  {e.joursRestants === 0 ? "aujourd'hui" : `J-${e.joursRestants}`}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Inscrits à activer */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">
          Inscrits des 14 derniers jours, pas encore activés
        </h2>
        {data.aActiver.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 rounded-xl border border-dashed border-gray-200 dark:border-gray-800 p-6 text-center">
            Tous les inscrits récents sont activés.
          </p>
        ) : (
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
            {data.aActiver.map((r) => (
              <div key={r.providerId} className="flex items-center gap-4 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{r.businessName}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {NEXT_STEP_LABELS[r.activation.nextStep ?? ''] ?? '—'}
                  </p>
                </div>
                <Progression score={r.activation.score} />
                <span className="text-xs text-gray-400 tabular-nums whitespace-nowrap">
                  inscrit il y a {r.joursDepuisInscription} j
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
