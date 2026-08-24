'use client';

import { useEffect, useState } from 'react';
import { getAuth } from 'firebase/auth';
import { Loader } from '@/components/ui';
import { AlertTriangle, Check, Clock, Rocket, TrendingUp, X } from 'lucide-react';

/** Ce que renvoie /api/sales/overview. */
interface ActivationDetail {
  published: boolean;
  enoughServices: boolean;
  hasAvailability: boolean;
  hasFirstBooking: boolean;
  activated: boolean;
  score: number;
  nextStep: 'publier' | 'prestations' | 'disponibilites' | 'premiere_reservation' | null;
  activeServicesCount: number;
}
interface Overview {
  essaisQuiExpirent: Array<{ providerId: string; businessName: string; joursRestants: number; activation: ActivationDetail }>;
  aActiver: Array<{ providerId: string; businessName: string; joursDepuisInscription: number; activation: ActivationDetail }>;
  pipeline: { total: number };
}

/** L'action à mener, en toutes lettres et avec les chiffres du compte. */
function prochaineAction(a: ActivationDetail): string {
  switch (a.nextStep) {
    case 'prestations':
      return a.activeServicesCount === 0
        ? "L'aider à créer ses premières prestations (aucune pour l'instant, il en faut 3)"
        : `L'aider à compléter ses prestations (${a.activeServicesCount} sur 3 minimum)`;
    case 'disponibilites':
      return "L'aider à renseigner ses horaires d'ouverture — sans eux, aucun créneau n'est réservable";
    case 'publier':
      return 'Tout est configuré : il ne reste qu’à publier sa page pour la rendre visible';
    case 'premiere_reservation':
      return 'Compte prêt — faire une réservation test avec lui, ou partager son lien';
    default:
      return 'Compte entièrement configuré — proposer l’abonnement';
  }
}

/** Quand l'essai se termine, en français, pas en code. */
function expireDans(jours: number): { texte: string; urgent: boolean } {
  if (jours <= 0) return { texte: "expire aujourd'hui", urgent: true };
  if (jours === 1) return { texte: 'expire demain', urgent: true };
  return { texte: `expire dans ${jours} jours`, urgent: false };
}

/** Les 4 étapes de configuration, nommées — plus de jauge muette. */
function Criteres({ a }: { a: ActivationDetail }) {
  const items = [
    { ok: a.enoughServices, label: `Prestations (${Math.min(a.activeServicesCount, 3)}/3)` },
    { ok: a.hasAvailability, label: 'Horaires' },
    { ok: a.published, label: 'Page publiée' },
    { ok: a.hasFirstBooking, label: '1ʳᵉ réservation' },
  ];
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1">
      {items.map(({ ok, label }) => (
        <span
          key={label}
          className={`inline-flex items-center gap-1 text-xs ${
            ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400 dark:text-gray-500'
          }`}
        >
          {ok ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
          {label}
        </span>
      ))}
    </div>
  );
}

/**
 * Tableau de bord commercial.
 *
 * TOUT EST DIT EN TOUTES LETTRES — retour d'usage du premier écran : les
 * « J-1 », jauges à segments et libellés télégraphiques n'étaient compris
 * que par leur auteur. Chaque ligne nomme les 4 étapes de configuration,
 * l'échéance en français, et l'action à mener avec les chiffres du compte.
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
      label: 'Essais qui se terminent cette semaine',
      valeur: data.essaisQuiExpirent.length,
      aide: 'à contacter en priorité',
      ton: data.essaisQuiExpirent.length > 0 ? 'text-amber-600 dark:text-amber-500' : 'text-gray-900 dark:text-white',
    },
    {
      icone: Rocket,
      label: 'Nouveaux inscrits à accompagner',
      valeur: data.aActiver.length,
      aide: 'comptes créés récemment, pas encore prêts à recevoir des réservations',
      ton: data.aActiver.length > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white',
    },
    {
      icone: TrendingUp,
      label: 'Prospects dans votre pipeline',
      valeur: data.pipeline.total,
      aide: 'module en construction',
      ton: 'text-gray-900 dark:text-white',
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Tableau de bord</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Les comptes qui ont besoin de vous aujourd&apos;hui, et pourquoi.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {kpis.map(({ icone: Icone, label, valeur, aide, ton }) => (
          <div key={label} className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
            <div className="flex items-center gap-2 mb-1">
              <Icone className="w-4 h-4 text-gray-400" />
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</p>
            </div>
            <p className={`text-3xl font-bold tabular-nums ${ton}`}>{valeur}</p>
            <p className="text-xs text-gray-400 mt-1">{aide}</p>
          </div>
        ))}
      </div>

      {/* Essais qui expirent */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Leur essai gratuit se termine cette semaine
        </h2>
        <p className="text-xs text-gray-400 mt-1 mb-3 max-w-2xl">
          Passé cette date, leur page est dépubliée s&apos;ils ne s&apos;abonnent pas. Un compte bien
          configuré avant la fin de l&apos;essai a beaucoup plus de chances de s&apos;abonner — chaque
          ligne montre où en est la configuration et ce qui les aiderait maintenant.
        </p>
        {data.essaisQuiExpirent.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 rounded-xl border border-dashed border-gray-200 dark:border-gray-800 p-6 text-center">
            Aucun essai ne se termine dans les 7 prochains jours.
          </p>
        ) : (
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
            {data.essaisQuiExpirent.map((e) => {
              const ech = expireDans(e.joursRestants);
              return (
                <div key={e.providerId} className="px-4 py-3.5">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className={`w-4 h-4 flex-shrink-0 ${ech.urgent ? 'text-red-500' : 'text-amber-500'}`} />
                    <p className="flex-1 min-w-0 text-sm font-semibold text-gray-900 dark:text-white truncate">
                      {e.businessName}
                    </p>
                    <span className={`text-xs font-semibold whitespace-nowrap px-2 py-0.5 rounded-full ${
                      ech.urgent
                        ? 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        : 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                    }`}>
                      {ech.texte}
                    </span>
                  </div>
                  <div className="mt-2 ml-7 space-y-1.5">
                    <Criteres a={e.activation} />
                    <p className="text-xs text-gray-600 dark:text-gray-300">
                      <span className="font-semibold">À faire :</span> {prochaineAction(e.activation)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Inscrits à accompagner */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Nouveaux inscrits pas encore prêts
        </h2>
        <p className="text-xs text-gray-400 mt-1 mb-3 max-w-2xl">
          Comptes créés ces 14 derniers jours à qui il manque au moins une des 4 étapes pour
          recevoir des réservations : des prestations, des horaires, une page publiée, une
          première réservation.
        </p>
        {data.aActiver.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 rounded-xl border border-dashed border-gray-200 dark:border-gray-800 p-6 text-center">
            Tous les inscrits récents sont prêts.
          </p>
        ) : (
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
            {data.aActiver.map((r) => (
              <div key={r.providerId} className="px-4 py-3.5">
                <div className="flex items-center gap-3">
                  <p className="flex-1 min-w-0 text-sm font-semibold text-gray-900 dark:text-white truncate">
                    {r.businessName}
                  </p>
                  <span className="text-xs text-gray-400 whitespace-nowrap">
                    {r.joursDepuisInscription === 0
                      ? "inscrit aujourd'hui"
                      : r.joursDepuisInscription === 1
                        ? 'inscrit hier'
                        : `inscrit il y a ${r.joursDepuisInscription} jours`}
                  </span>
                </div>
                <div className="mt-2 space-y-1.5">
                  <Criteres a={r.activation} />
                  <p className="text-xs text-gray-600 dark:text-gray-300">
                    <span className="font-semibold">À faire :</span> {prochaineAction(r.activation)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
