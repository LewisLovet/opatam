'use client';

/**
 * /admin/acquisition — ce que produit la page d'accueil, jour par jour.
 *
 * Une seule question : la page convainc-t-elle, et d'où viennent ceux
 * qu'elle convainc ? D'où trois blocs :
 *   - l'ENTONNOIR sur la période : vues → clics → inscriptions → pages
 *     publiées → abonnés, avec les taux de passage ;
 *   - la ventilation des inscrits PAR CAMPAGNE mesurée (utm/référent) et
 *     PAR RÉPONSE déclarée (« comment nous avez-vous connus ? ») ;
 *   - le détail par jour.
 *
 * Les compteurs du site sont indicatifs (voir lib/siteMetrics) ; les
 * inscriptions, pages et abonnements viennent de la base, ce sont eux qui
 * comptent. Les comptes de test sont exclus.
 */

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Megaphone, RefreshCw } from 'lucide-react';
import { adminHeaders } from '@/services/admin/adminFetch';
import { acquisitionChannelLabel } from '@booking-app/shared';

type Jour = {
  day: string;
  'view:home': number; 'click:vitrine': number; 'click:demo': number; 'click:pricing': number;
  'video:play': number; 'video:provider': number; 'download:ios': number; 'download:android': number;
  'scroll:50': number; 'scroll:90': number;
  signups: number; published: number; paying: number;
};
type Donnees = {
  days: Jour[];
  totals: Omit<Jour, 'day'>;
  bySource: { source: string; medium: string; campaign: string; signups: number; published: number; paying: number }[];
  byChannel: { channel: string; signups: number; published: number; paying: number }[];
};

const PERIODES = [7, 30, 90] as const;

const nombre = (n: number) => new Intl.NumberFormat('fr-FR').format(n);
const taux = (num: number, den: number) => (den > 0 ? `${((num / den) * 100).toFixed(1).replace('.', ',')} %` : '—');
const jourCourt = (d: string) =>
  new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(`${d}T12:00:00`));

export default function AdminAcquisitionPage() {
  const [days, setDays] = useState<(typeof PERIODES)[number]>(30);
  const [data, setData] = useState<Donnees | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const charger = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/stats?type=acquisition&days=${days}`, { headers: await adminHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (e) {
      console.error('[admin/acquisition]', e);
      setError('Impossible de charger les chiffres.');
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { void charger(); }, [charger]);

  const t = data?.totals;
  const clics = t ? t['click:vitrine'] + t['click:pricing'] : 0;
  const stores = t ? t['download:ios'] + t['download:android'] : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Acquisition</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Ce que produit la page d&apos;accueil : qui la voit, qui clique, qui s&apos;inscrit, et d&apos;où ils viennent.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            {PERIODES.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setDays(p)}
                className={`px-3 py-2 text-sm font-medium ${
                  days === p
                    ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                {p} j
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => void charger()}
            className="p-2 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-gray-900 dark:hover:text-white"
            aria-label="Rafraîchir"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {error && (
        <p className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          {error}
        </p>
      )}

      {loading || !t ? (
        <div className="p-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
      ) : (
        <>
          {/* ── L'entonnoir ── */}
          <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">L&apos;entonnoir sur {days} jours</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { label: 'Vues de l’accueil', valeur: t['view:home'], sous: null },
                { label: 'Clics « Créer ma vitrine »', valeur: clics, sous: `${taux(clics, t['view:home'])} des vues` },
                { label: 'Clics « Essayer la démo »', valeur: t['click:demo'], sous: `${taux(t['click:demo'], t['view:home'])} des vues` },
                { label: 'Inscriptions', valeur: t.signups, sous: `${taux(t.signups, t['view:home'])} des vues` },
                { label: 'Pages publiées', valeur: t.published, sous: `${taux(t.published, t.signups)} des inscrits` },
                { label: 'Abonnés', valeur: t.paying, sous: `${taux(t.paying, t.signups)} des inscrits` },
              ].map((k) => (
                <div key={k.label} className="rounded-xl bg-gray-50 dark:bg-gray-800/60 p-4">
                  <p className="text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400">{k.label}</p>
                  <p className="text-2xl font-bold tabular-nums text-gray-900 dark:text-white mt-1">{nombre(k.valeur)}</p>
                  {k.sous && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{k.sous}</p>}
                </div>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              {[
                ['Vidéos lancées', t['video:play']],
                ['Clics vers un prestataire depuis une vidéo', t['video:provider']],
                ['Clics App Store / Google Play', stores],
                ['Ont lu la moitié · le bas de la page', `${nombre(t['scroll:50'])} · ${nombre(t['scroll:90'])}`],
              ].map(([label, valeur]) => (
                <div key={String(label)} className="flex items-baseline justify-between gap-3 rounded-lg border border-gray-100 dark:border-gray-800 px-3 py-2">
                  <span className="text-gray-600 dark:text-gray-300">{label}</span>
                  <span className="font-semibold tabular-nums text-gray-900 dark:text-white">{typeof valeur === 'number' ? nombre(valeur) : valeur}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-3">
              Vues et clics sont des compteurs indicatifs. Inscriptions, pages publiées et abonnés viennent de la base ; « publiées » et « abonnés » sont l&apos;état d&apos;aujourd&apos;hui des inscrits de la période.
            </p>
          </section>

          {/* ── D'où viennent les inscrits ── */}
          <div className="grid lg:grid-cols-2 gap-6">
            <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2"><Megaphone className="w-4 h-4" /> Par campagne, mesuré</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Lu sur le lien d&apos;arrivée (utm_source, utm_medium, utm_campaign) ou le site référent. « direct » = aucun.</p>
              </div>
              <Tableau
                entetes={['Source', 'Support', 'Campagne', 'Inscrits', 'Publiées', 'Abonnés']}
                lignes={data!.bySource.map((l) => [l.source, l.medium, l.campaign, nombre(l.signups), nombre(l.published), nombre(l.paying)])}
                vide="Aucune inscription sur la période."
              />
            </section>
            <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Par réponse, déclaré</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">« Comment avez-vous connu Opatam ? », posé à l&apos;inscription.</p>
              </div>
              <Tableau
                entetes={['Réponse', 'Inscrits', 'Publiées', 'Abonnés']}
                lignes={data!.byChannel.map((l) => [
                  l.channel === 'non renseigné' ? 'Non renseigné' : acquisitionChannelLabel(l.channel as never),
                  nombre(l.signups), nombre(l.published), nombre(l.paying),
                ])}
                vide="Aucune inscription sur la période."
              />
            </section>
          </div>

          {/* ── Le détail par jour ── */}
          <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Jour par jour</h2>
            </div>
            <Tableau
              entetes={['Jour', 'Vues', 'Vitrine', 'Démo', 'Tarifs', 'Vidéos', 'Stores', '50 %', '90 %', 'Inscrits', 'Publiées', 'Abonnés']}
              lignes={[...data!.days].reverse().map((j) => [
                jourCourt(j.day), nombre(j['view:home']), nombre(j['click:vitrine']), nombre(j['click:demo']), nombre(j['click:pricing']),
                nombre(j['video:play']), nombre(j['download:ios'] + j['download:android']), nombre(j['scroll:50']), nombre(j['scroll:90']),
                nombre(j.signups), nombre(j.published), nombre(j.paying),
              ])}
              vide="Rien sur la période."
            />
          </section>
        </>
      )}
    </div>
  );
}

function Tableau({ entetes, lignes, vide }: { entetes: string[]; lignes: string[][]; vide: string }) {
  if (lignes.length === 0) {
    return <p className="px-5 py-8 text-sm text-gray-400 text-center">{vide}</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800">
            {entetes.map((e, i) => (
              <th key={e} className={`px-4 py-2.5 font-medium whitespace-nowrap ${i > 0 ? 'text-right' : ''}`}>{e}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50 dark:divide-gray-800/60">
          {lignes.map((l, i) => (
            <tr key={i}>
              {l.map((c, j) => (
                <td key={j} className={`px-4 py-2 whitespace-nowrap ${j > 0 ? 'text-right tabular-nums' : ''} text-gray-800 dark:text-gray-200`}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
