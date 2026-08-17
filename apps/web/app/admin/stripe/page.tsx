'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { adminStatsService } from '@/services/admin';
import type { StripeEconomics } from '@/services/admin/types';
import { Loader } from '@/components/ui';
import { AlertTriangle, TrendingUp, Users, Wallet } from 'lucide-react';

const eur = (cents: number) =>
  (cents / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

const moisLisible = (m: string) =>
  new Date(m + '-01').toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });

/** Une valeur, son intitulé, et la phrase qui évite de la mal lire. */
function Chiffre({
  label, valeur, aide, ton = 'neutre', icone: Icone,
}: {
  label: string; valeur: string; aide?: string;
  ton?: 'neutre' | 'positif' | 'negatif'; icone?: typeof Wallet;
}) {
  const couleur =
    ton === 'positif' ? 'text-emerald-600 dark:text-emerald-400'
    : ton === 'negatif' ? 'text-red-600 dark:text-red-400'
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

export default function AdminStripePage() {
  const { user } = useAuth();
  const [data, setData] = useState<StripeEconomics | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    adminStatsService.getStripeEconomics(user.id).then(setData).catch((e) => setErreur(e.message));
  }, [user?.id]);

  if (erreur) return <p className="text-red-600 p-6">{erreur}</p>;
  if (!data) return <Loader />;

  const d = data.deposits;
  const coutAcomptes = d.processingFees - d.connectFees; // connectFees est négatif
  const partVolume = d.volume > 0 ? (coutAcomptes / d.volume) * 100 : 0;
  const coutParAcompte = d.count > 0 ? coutAcomptes / d.count : 0;
  const acompteMoyen = d.count > 0 ? d.volume / d.count : 0;

  // Abonnement de compte Connect : le poste qui grossit sans le volume.
  const abonnementCompte = data.connectByKind.find((k) => k.kind === 'Active Account Billing');
  const comptesFactures = abonnementCompte ? Math.round(-abonnementCompte.amount / 200) : 0;

  const totalFraisMensuels = data.months.length
    ? -(data.months.at(-1)!.connectFees + data.months.at(-1)!.billingFees) + data.months.at(-1)!.processingFees
    : 0;

  return (
    <div className="space-y-8 p-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Stripe</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Ce qui entre, ce qui sort, ce que ça coûte. Données lues directement chez Stripe.
        </p>
      </div>

      {/* ── Recettes ──────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">
          Revenu récurrent
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Chiffre
            label="MRR actif" valeur={eur(data.mrrActive)} icone={TrendingUp} ton="positif"
            aide={`${data.activeCount} abonnements en cours`}
          />
          <Chiffre
            label="MRR en essai" valeur={eur(data.mrrTrialing)} icone={Users}
            aide={`${data.trialingCount} essais — revenu à venir, pas encore encaissé`}
          />
          <Chiffre
            label="Frais Stripe du mois" valeur={eur(totalFraisMensuels)} ton="negatif" icone={Wallet}
            aide={data.mrrActive > 0 ? `${((totalFraisMensuels / data.mrrActive) * 100).toFixed(1)} % du MRR` : undefined}
          />
        </div>

        <div className="mt-4 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400">
              <tr>
                <th className="text-left font-medium px-4 py-2">Produit</th>
                <th className="text-right font-medium px-4 py-2">Abonnés</th>
                <th className="text-right font-medium px-4 py-2">MRR</th>
              </tr>
            </thead>
            <tbody>
              {data.byProduct.map((p) => (
                <tr key={p.label} className="border-t border-gray-100 dark:border-gray-800">
                  <td className="px-4 py-2 text-gray-900 dark:text-white">{p.label}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-gray-600 dark:text-gray-300">{p.subscribers}</td>
                  <td className="px-4 py-2 text-right tabular-nums font-medium text-gray-900 dark:text-white">{eur(p.mrr)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-gray-800">
            Ventilé par ligne d&apos;abonnement : un même abonnement peut porter un plan et le Pack sérénité,
            et les deux comptent séparément.
          </p>
        </div>
      </section>

      {/* ── L'acompte : la question qui décide ────────────────────────── */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">
          Fonctionnalité acompte
        </h2>
        {d.commission === 0 && (
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
          <Chiffre label="Volume traité" valeur={eur(d.volume)} aide={`${d.count} acomptes — argent qui transite, pas un revenu`} />
          <Chiffre label="Frais de traitement" valeur={eur(d.processingFees)} ton="negatif" />
          <Chiffre label="Frais Connect" valeur={eur(-d.connectFees)} ton="negatif" />
          <Chiffre
            label="Coût total" valeur={eur(coutAcomptes)} ton="negatif"
            aide={`${partVolume.toFixed(1)} % du volume traité, pour ${eur(d.commission)} de revenu`}
          />
        </div>
      </section>

      {/* ── Connect : le poste qui grossit tout seul ──────────────────── */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">
          Comptes connectés
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Chiffre label="Comptes reliés" valeur={String(data.accounts.connected)} aide="Un compte sans activité ne coûte rien" />
          <Chiffre
            label="Opérationnels" valeur={String(data.accounts.chargesEnabled)}
            aide="Peuvent encaisser — coût dès leur première transaction"
          />
          <Chiffre
            label="Facturés ce mois" valeur={String(comptesFactures)} ton="negatif"
            aide="Stripe facture 2 €/mois par compte ayant eu de l'activité"
          />
        </div>

        {data.accounts.chargesEnabled > comptesFactures && (
          <p className="mt-3 text-sm text-gray-600 dark:text-gray-300 leading-snug">
            Si les {data.accounts.chargesEnabled} comptes opérationnels devenaient tous actifs, l&apos;abonnement
            de compte seul passerait à{' '}
            <span className="font-semibold text-gray-900 dark:text-white">
              {eur(data.accounts.chargesEnabled * 200)}/mois
            </span>
            {' '}— soit {((data.accounts.chargesEnabled * 200) / Math.max(1, data.mrrActive) * 100).toFixed(0)} % du MRR actuel,
            sans un euro de revenu en face.
          </p>
        )}

        <div className="mt-4 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
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
      </section>

      {/* ── Mois par mois ─────────────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">
          Mois par mois
        </h2>
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400">
              <tr>
                <th className="text-left font-medium px-4 py-2">Mois</th>
                <th className="text-right font-medium px-4 py-2">Encaissé</th>
                <th className="text-right font-medium px-4 py-2">Traitement</th>
                <th className="text-right font-medium px-4 py-2">Remboursé</th>
                <th className="text-right font-medium px-4 py-2">Reversé aux pros</th>
                <th className="text-right font-medium px-4 py-2">Connect</th>
                <th className="text-right font-medium px-4 py-2">Billing</th>
              </tr>
            </thead>
            <tbody>
              {data.months.map((m) => (
                <tr key={m.month} className="border-t border-gray-100 dark:border-gray-800">
                  <td className="px-4 py-2 text-gray-900 dark:text-white">{moisLisible(m.month)}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-emerald-600 dark:text-emerald-400">{eur(m.collected)}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-red-600 dark:text-red-400">{eur(-m.processingFees)}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-red-600 dark:text-red-400">{eur(m.refunded)}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-gray-500 dark:text-gray-400">{eur(m.transferred)}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-red-600 dark:text-red-400">{eur(m.connectFees)}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-red-600 dark:text-red-400">{eur(m.billingFees)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 leading-snug">
          « Reversé aux pros » n&apos;est pas une charge : c&apos;est l&apos;argent des clientes qui transite par
          votre compte pour aller au salon. C&apos;est la colonne qui fait croire à des pertes.
        </p>
      </section>

      <p className="text-xs text-gray-400">
        Lu chez Stripe le {new Date(data.generatedAt).toLocaleString('fr-FR')} · cache de 10 minutes
      </p>
    </div>
  );
}
