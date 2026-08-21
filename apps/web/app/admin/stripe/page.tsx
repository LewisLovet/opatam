'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { Loader } from '@/components/ui';
import { AlertTriangle, ArrowRight, Gift, TrendingDown, TrendingUp, Users, Wallet } from 'lucide-react';
import { useStripeData } from './StripeDataContext';
import { Chiffre, Titre, eur, moisCourt } from './components';

/** Renvoie vers la vue qui détaille le chiffre, avec le filtre déjà posé. */
function Creuser({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 text-xs font-medium text-primary-600 dark:text-primary-400 hover:underline"
    >
      {children}
      <ArrowRight className="w-3 h-3" />
    </Link>
  );
}

export default function AdminStripePage() {
  const { data, erreur } = useStripeData();

  /**
   * Le compte de résultat de la période.
   *
   * Séparer l'acompte de l'encaissement est le geste qui rend le relevé
   * lisible : les deux arrivent sur le même compte, mais l'un vous appartient
   * et l'autre traverse pour aller au salon. Les additionner faisait croire à
   * un chiffre d'affaires trois fois supérieur au réel.
   */
  const bilan = useMemo(() => {
    if (!data) return null;
    let revenu = 0;
    let acomptes = 0;
    let rembourse = 0;
    let rembourseAcompte = 0;
    for (const t of data.transactions) {
      if (t.category === 'revenu') revenu += t.amount;
      else if (t.category === 'acompte') acomptes += t.amount;
      else if (t.category === 'remboursement') {
        // Un acompte remboursé sort du bilan comme il y est entré : par la
        // porte de service. Le compter ici retrancherait du résultat un
        // argent qui n'y avait jamais été ajouté.
        if ((t.description ?? '').includes('Acompte')) rembourseAcompte += t.amount;
        else rembourse += t.amount;
      }
    }
    // Nets de ce qui vous revient sur les versements aux salons : sinon ce
    // tableau et le solde cumulé plus bas annonceraient deux résultats
    // différents pour la même période.
    const frais = data.months.reduce(
      (s, m) => s + m.processingFees - m.connectFees - m.billingFees - m.depositFeesRecovered,
      0,
    );
    return {
      revenu, acomptes, rembourse, rembourseAcompte, frais,
      recupere: data.deposits.feesRecovered,
      resultat: revenu + rembourse - frais,
    };
  }, [data]);

  /**
   * Le solde mois par mois, et ce qui le compose.
   *
   * Les acomptes sont absents des deux côtés : ni leur encaissement, ni leur
   * remboursement, ni la part de leur commission qui vous revient. Un solde
   * qui mélangerait l'argent des salons ne serait pas votre solde.
   */
  const soldes = useMemo(() => {
    if (!data) return [];
    let cumul = 0;
    return data.months.map((m) => {
      const frais = m.processingFees - m.connectFees - m.billingFees - m.depositFeesRecovered;
      const solde = m.revenue + m.refundedRevenue - frais;
      cumul += solde;
      return {
        mois: m.month,
        revenus: m.revenue,
        rembourse: m.refundedRevenue,
        frais,
        solde,
        cumul,
      };
    });
  }, [data]);

  if (erreur) return <p className="text-red-600">{erreur}</p>;
  if (!data || !bilan) return <Loader />;

  // Échelle commune aux deux moitiés du graphique : sans elle, une dépense de
  // 18 € et une recette de 30 € auraient la même hauteur de part et d'autre
  // de l'axe, ce qui inverserait la lecture.
  const echelle = Math.max(
    1,
    ...soldes.map((s) => Math.max(s.revenus, s.frais - s.rembourse, Math.abs(s.solde))),
  );

  const d = data.deposits;
  const coutAcomptes = d.processingFees - d.connectFees;
  const partVolume = d.volume > 0 ? (coutAcomptes / d.volume) * 100 : 0;
  const coutParAcompte = d.count > 0 ? coutAcomptes / d.count : 0;
  const acompteMoyen = d.count > 0 ? d.volume / d.count : 0;

  const dernier = data.months.at(-1);
  const fraisDernierMois = dernier
    ? dernier.processingFees - dernier.connectFees - dernier.billingFees
    : 0;

  const abonnementCompte = data.connectByKind.find((k) => k.kind === 'Active Account Billing');
  const comptesFactures = abonnementCompte ? Math.round(-abonnementCompte.amount / 200) : 0;

  const f = data.funnel;
  const sansFin = f.compAccess.filter((c) => !c.until).length;

  return (
    <div className="space-y-10">
      {/* ── Le résultat, en une ligne ──────────────────────────────────── */}
      <section>
        <Titre note="Sur toute la période couverte par le relevé. Les acomptes en sont exclus : ils ne vous appartiennent pas.">
          Résultat de la période
        </Titre>
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300">Encaissé (abonnements)</td>
                <td className="px-4 py-3 text-right tabular-nums font-medium text-emerald-600 dark:text-emerald-400">
                  {eur(bilan.revenu)}
                </td>
                <td className="px-4 py-3 text-right w-40"><Creuser href="/admin/stripe/revenus">Détail</Creuser></td>
              </tr>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300">Remboursements d&apos;abonnement</td>
                <td className="px-4 py-3 text-right tabular-nums font-medium text-red-600 dark:text-red-400">
                  {eur(bilan.rembourse)}
                </td>
                <td className="px-4 py-3 text-right">
                  <Creuser href="/admin/stripe/transactions">Voir les lignes</Creuser>
                </td>
              </tr>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                <td className="px-4 py-3">
                  <p className="text-gray-700 dark:text-gray-300">Frais Stripe (traitement, Connect, Billing)</p>
                  {bilan.recupere > 0 && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      net des {eur(bilan.recupere)} retenus sur les versements aux salons
                    </p>
                  )}
                </td>
                <td className="px-4 py-3 text-right tabular-nums font-medium text-red-600 dark:text-red-400">
                  {eur(-bilan.frais)}
                </td>
                <td className="px-4 py-3 text-right"><Creuser href="/admin/stripe/frais">Détail</Creuser></td>
              </tr>
              <tr className="bg-gray-50 dark:bg-gray-800/50">
                <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">Résultat</td>
                <td className={`px-4 py-3 text-right tabular-nums text-lg font-bold ${
                  bilan.resultat >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                }`}>
                  {eur(bilan.resultat)}
                </td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 leading-snug">
          Hors bilan : {eur(bilan.acomptes)} d&apos;acomptes encaissés
          {bilan.rembourseAcompte !== 0 && <> (dont {eur(-bilan.rembourseAcompte)} remboursés aux clientes)</>}, puis
          reversés aux salons. Cet argent traverse le compte sans jamais vous appartenir — c&apos;est lui qui rendait
          le relevé Stripe illisible. Leur coût de traitement, lui, reste à votre charge : voir plus bas.
        </p>
      </section>

      {/* ── Recettes, dépenses, solde ─────────────────────────────────── */}
      <section>
        <Titre note="Recettes vers le haut, dépenses vers le bas, solde en trait. Les acomptes sont exclus des deux côtés : ils ne vous appartiennent pas.">
          Recettes, dépenses et solde
        </Titre>

        <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <div className="flex gap-3">
            {soldes.map((s) => {
              const depenses = s.frais - s.rembourse;
              // Position du repère de solde, mesurée depuis l'axe central.
              const decalage = (s.solde / echelle) * 50;
              return (
                <div key={s.mois} className="flex-1 min-w-0">
                  <div className="relative h-48">
                    {/* Axe zéro */}
                    <div className="absolute inset-x-0 top-1/2 border-t border-gray-300 dark:border-gray-600" />

                    {/* Recettes, au-dessus */}
                    <div className="absolute inset-x-0 top-0 h-1/2 flex flex-col justify-end">
                      <div
                        className="bg-emerald-500 rounded-t-sm"
                        style={{ height: `${(s.revenus / echelle) * 100}%` }}
                        title={`Recettes ${moisCourt(s.mois)} — ${eur(s.revenus)}`}
                      />
                    </div>

                    {/* Dépenses, en dessous */}
                    <div className="absolute inset-x-0 bottom-0 h-1/2">
                      <div
                        className="bg-red-500 rounded-b-sm"
                        style={{ height: `${(depenses / echelle) * 100}%` }}
                        title={`Dépenses ${moisCourt(s.mois)} — ${eur(-depenses)}`}
                      />
                    </div>

                    {/* Le solde : un trait, pas une barre — c'est un résultat,
                        pas un flux, et le confondre avec les deux autres
                        laisserait croire qu'il s'y ajoute. */}
                    <div
                      className="absolute inset-x-1"
                      style={{ top: `calc(50% - ${decalage}% - 1px)` }}
                      title={`Solde ${moisCourt(s.mois)} — ${eur(s.solde)}`}
                    >
                      <div className={`h-0.5 ${s.solde >= 0 ? 'bg-gray-900 dark:bg-white' : 'bg-red-700 dark:bg-red-300'}`} />
                    </div>
                  </div>

                  <p className="text-[11px] text-center text-gray-500 dark:text-gray-400 mt-2 truncate">
                    {moisCourt(s.mois)}
                  </p>
                  <p className={`text-[11px] text-center tabular-nums font-medium truncate ${
                    s.solde >= 0 ? 'text-gray-900 dark:text-white' : 'text-red-600 dark:text-red-400'
                  }`}>
                    {(s.solde / 100).toFixed(0)} €
                  </p>
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-emerald-500" />Recettes</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-red-500" />Dépenses</span>
            <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 bg-gray-900 dark:bg-white" />Solde du mois</span>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-gray-200 dark:border-gray-700 overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400">
              <tr>
                <th className="text-left font-medium px-4 py-2">Mois</th>
                <th className="text-right font-medium px-4 py-2">Encaissé</th>
                <th className="text-right font-medium px-4 py-2">Remboursé</th>
                <th className="text-right font-medium px-4 py-2">Frais</th>
                <th className="text-right font-medium px-4 py-2">Solde</th>
                <th className="text-right font-medium px-4 py-2">Cumulé</th>
              </tr>
            </thead>
            <tbody>
              {soldes.map((s) => (
                <tr key={s.mois} className="border-t border-gray-100 dark:border-gray-800">
                  <td className="px-4 py-2 text-gray-900 dark:text-white">{moisCourt(s.mois)}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                    {s.revenus > 0 ? eur(s.revenus) : <span className="text-gray-300 dark:text-gray-600">—</span>}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-red-600 dark:text-red-400">
                    {s.rembourse < 0 ? eur(s.rembourse) : <span className="text-gray-300 dark:text-gray-600">—</span>}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-red-600 dark:text-red-400">{eur(-s.frais)}</td>
                  <td className={`px-4 py-2 text-right tabular-nums font-semibold ${
                    s.solde >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                  }`}>
                    {eur(s.solde)}
                  </td>
                  <td className={`px-4 py-2 text-right tabular-nums ${
                    s.cumul >= 0 ? 'text-gray-600 dark:text-gray-300' : 'text-red-600 dark:text-red-400'
                  }`}>
                    {eur(s.cumul)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {soldes.at(-1)?.mois === new Date().toISOString().slice(0, 7) && (
          <p className="mt-3 text-xs text-amber-700 dark:text-amber-500 leading-snug">
            Le mois en cours paraît toujours meilleur qu&apos;il ne sera : Stripe facture Connect à terme
            échu, donc les frais de {moisCourt(soldes.at(-1)!.mois)} ne seront prélevés qu&apos;au début du
            mois prochain. Comptez environ {eur(-(soldes.at(-2)?.frais ?? 0))} de plus, au vu du mois précédent.
          </p>
        )}
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 leading-snug">
          La colonne « Frais » est nette de ce qui vous revient sur les versements aux salons —{' '}
          {eur(data.deposits.feesRecovered)} sur la période. Le détail poste par poste est dans{' '}
          <Creuser href="/admin/stripe/frais">la vue Frais</Creuser>.
        </p>
      </section>

      {/* ── Le récurrent ──────────────────────────────────────────────── */}
      <section>
        <Titre note="Un essai n'est pas un revenu, un code à 100 % non plus. Ni l'un ni l'autre n'entre dans le MRR.">
          Revenu récurrent
        </Titre>
        <div className="grid gap-4 sm:grid-cols-4">
          <Chiffre
            label="MRR encaissable"
            valeur={eur(data.mrrActive)}
            icone={TrendingUp}
            /* L'indisponibilité se dit SUR le chiffre, pas ailleurs : un
               compteur d'erreurs relégué en bas de page laisserait lire le MRR
               comme une valeur exacte. */
            ton={data.mrrIndisponibleCount > 0 ? 'attention' : 'positif'}
            aide={
              data.mrrIndisponibleCount > 0
                ? `${data.activeCount} abonnements actifs — ${data.mrrIndisponibleCount} non chiffrés par Stripe, le montant est un minorant`
                : `${data.activeCount} abonnements actifs, net de remise`
            }
          />
          <Chiffre
            label="Essais en cours" valeur={eur(data.pipelineTrials)} icone={Users} ton="attention"
            aide={`${data.trialingCount} essais — NON compté dans le MRR`}
          />
          <Chiffre
            label="Perdu en remises" valeur={eur(data.mrrForfeitedToCoupons)} icone={TrendingDown} ton="negatif"
            aide={data.freeByCouponCount > 0
              ? `dont ${data.freeByCouponCount} abonnés actifs à 0 € (code 100 %)`
              : 'aucun abonné actif à 0 €'}
          />
          <Chiffre
            label="Frais Stripe du mois" valeur={eur(fraisDernierMois)} icone={Wallet} ton="negatif"
            aide={data.mrrActive > 0
              ? `${((fraisDernierMois / data.mrrActive) * 100).toFixed(1)} % du MRR encaissable`
              : undefined}
          />
        </div>
        <div className="mt-3 flex gap-4">
          <Creuser href="/admin/stripe/revenus">Répartition par produit et courbe mensuelle</Creuser>
          <Creuser href="/admin/stripe/frais">Évolution des frais</Creuser>
        </div>
      </section>

      {/* ── Les comptes connectés ─────────────────────────────────────── */}
      <section>
        <Titre note="Ce poste suit le nombre de comptes actifs, pas le chiffre d'affaires : il augmente quand vous réussissez à recruter.">
          Comptes connectés
        </Titre>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400">
                <tr>
                  <th className="text-left font-medium px-4 py-2">Nature du frais Connect</th>
                  <th className="text-right font-medium px-4 py-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {data.connectByKind.map((k) => (
                  <tr key={k.kind} className="border-t border-gray-100 dark:border-gray-800">
                    <td className="px-4 py-2 text-gray-900 dark:text-white">{k.kind}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-red-600 dark:text-red-400">{eur(k.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Reliés</span><span className="tabular-nums text-gray-900 dark:text-white">{data.accounts.connected}</span></div>
            <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Opérationnels</span><span className="tabular-nums text-gray-900 dark:text-white">{data.accounts.chargesEnabled}</span></div>
            <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Facturés ce mois</span><span className="tabular-nums text-red-600 dark:text-red-400">{comptesFactures}</span></div>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-snug pt-2 border-t border-gray-100 dark:border-gray-800">
              Stripe facture 2 €/mois par compte ayant eu de l&apos;activité. Si les {data.accounts.chargesEnabled} comptes
              opérationnels s&apos;activaient tous, ce poste seul passerait à {eur(data.accounts.chargesEnabled * 200)}/mois.
            </p>
          </div>
        </div>
      </section>

      {/* ── L'acompte ─────────────────────────────────────────────────── */}
      <section>
        <Titre>Fonctionnalité acompte</Titre>
        {d.commission === 0 && d.count > 0 && (
          <div className="mb-4 flex gap-3 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-900/20 p-4">
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
            <div className="text-sm text-amber-900 dark:text-amber-200">
              <p className="font-semibold">Aucune commission n&apos;est prélevée.</p>
              <p className="mt-1 leading-snug">
                L&apos;acompte est encaissé puis reversé intégralement au salon. Les frais restent à votre charge :
                chaque acompte de {eur(acompteMoyen)} en coûte {eur(coutParAcompte)}.
              </p>
            </div>
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-4">
          <Chiffre label="Volume traité" valeur={eur(d.volume)} aide={`${d.count} acomptes — argent qui transite`} />
          <Chiffre label="Frais de traitement" valeur={eur(d.processingFees)} ton="negatif" />
          <Chiffre label="Frais Connect" valeur={eur(-d.connectFees)} ton="negatif" />
          <Chiffre
            label="Coût total" valeur={eur(coutAcomptes)} ton="negatif"
            aide={`${partVolume.toFixed(1)} % du volume, pour ${eur(d.commission)} de revenu`}
          />
        </div>

        {/* Le point qui rend le relevé Stripe déroutant : la moitié des
            acomptes ne s'y trouve tout simplement pas. */}
        <div className="mt-4 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">
            Pourquoi si peu d&apos;acomptes portent des frais chez vous
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-300 mt-1.5 leading-snug">
            Il existe deux tunnels de paiement, et un seul passe par votre compte.
          </p>
          <div className="grid gap-4 sm:grid-cols-2 mt-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Mobile — paiement à destination
              </p>
              <p className="text-xl font-bold tabular-nums text-gray-900 dark:text-white mt-1">
                {d.count} acomptes · {eur(d.volume)}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-snug">
                Encaissés par la plateforme puis reversés. Ils apparaissent dans votre relevé et{' '}
                <span className="text-red-600 dark:text-red-400 font-medium">{eur(d.processingFees)}</span> de
                commission y est prélevée.
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Web — paiement direct
              </p>
              <p className="text-xl font-bold tabular-nums text-gray-900 dark:text-white mt-1">
                {d.direct.count} paiements · {eur(d.direct.volume)}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-snug">
                Encaissés directement sur le compte du salon. Invisibles de votre relevé, et leurs{' '}
                {eur(d.direct.fees)} de commission sont supportés par le prestataire, pas par vous.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-3">
          <Creuser href="/admin/stripe/transactions">Voir les acomptes ligne à ligne</Creuser>
        </div>
      </section>

      {/* ── Ce qui n'entre pas ────────────────────────────────────────── */}
      <section>
        <Titre note="Invisible depuis Stripe : l'essai de l'application et l'accès offert n'y créent aucun abonnement.">
          Ce qui n&apos;entre pas
        </Titre>
        <div className="grid gap-4 sm:grid-cols-4">
          <Chiffre label="Prestataires réels" valeur={String(f.realProviders)} aide="hors comptes de test" />
          <Chiffre label="Payants" valeur={String(f.paying)} ton="positif"
            aide={f.realProviders > 0 ? `${((f.paying / f.realProviders) * 100).toFixed(0)} % de la base` : undefined} />
          <Chiffre label="Essais en cours" valeur={String(f.trialActive)} aide="encore dans la fenêtre d'essai" />
          <Chiffre
            label="Essais expirés" valeur={String(f.trialExpiredNeverPaid)} ton="negatif" icone={TrendingDown}
            aide="essai terminé, jamais converti"
          />
        </div>

        {f.compAccess.length > 0 && (
          <div className="mt-4 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 dark:border-gray-800">
              <Gift className="w-4 h-4 text-gray-400" />
              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                Accès offerts — {f.compAccess.length}
              </p>
              {sansFin > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300">
                  {sansFin} sans date de fin
                </span>
              )}
            </div>
            <table className="w-full text-sm">
              <tbody>
                {f.compAccess.map((c) => (
                  <tr key={c.name} className="border-t border-gray-100 dark:border-gray-800">
                    <td className="px-4 py-2 text-gray-900 dark:text-white">{c.name}</td>
                    <td className="px-4 py-2 text-gray-500 dark:text-gray-400">{c.plan}</td>
                    <td className="px-4 py-2 text-right text-gray-500 dark:text-gray-400">
                      {c.until
                        ? `jusqu'au ${new Date(c.until).toLocaleDateString('fr-FR')}`
                        : <span className="text-amber-600 dark:text-amber-500">sans fin</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="text-xs text-gray-400">
        Lu chez Stripe et dans Firestore le {new Date(data.generatedAt).toLocaleString('fr-FR')} · cache de 10 minutes
      </p>
    </div>
  );
}
