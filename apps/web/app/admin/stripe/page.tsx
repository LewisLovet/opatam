'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { Loader } from '@/components/ui';
import { AlertTriangle, ArrowRight, Gift, TrendingDown, TrendingUp, Users, Wallet } from 'lucide-react';
import { useStripeData } from './StripeDataContext';
import { Chiffre, Titre, eur } from './components';

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
    const frais = data.months.reduce(
      (s, m) => s + m.processingFees - m.connectFees - m.billingFees,
      0,
    );
    return {
      revenu, acomptes, rembourse, rembourseAcompte, frais,
      resultat: revenu + rembourse - frais,
    };
  }, [data]);

  if (erreur) return <p className="text-red-600">{erreur}</p>;
  if (!data || !bilan) return <Loader />;

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
                <td className="px-4 py-3 text-gray-700 dark:text-gray-300">Frais Stripe (traitement, Connect, Billing)</td>
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

      {/* ── Le récurrent ──────────────────────────────────────────────── */}
      <section>
        <Titre note="Un essai n'est pas un revenu, un code à 100 % non plus. Ni l'un ni l'autre n'entre dans le MRR.">
          Revenu récurrent
        </Titre>
        <div className="grid gap-4 sm:grid-cols-4">
          <Chiffre
            label="MRR encaissable" valeur={eur(data.mrrActive)} icone={TrendingUp} ton="positif"
            aide={`${data.activeCount} abonnements actifs, net de remise`}
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
