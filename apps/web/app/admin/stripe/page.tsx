'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { adminStatsService } from '@/services/admin';
import type { StripeEconomics } from '@/services/admin/types';
import { Loader } from '@/components/ui';
import { AlertTriangle, Gift, TrendingDown, TrendingUp, Users, Wallet } from 'lucide-react';

const eur = (cents: number) =>
  (cents / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

const moisCourt = (m: string) =>
  new Date(m + '-01').toLocaleDateString('fr-FR', { month: 'short' });

function Chiffre({
  label, valeur, aide, ton = 'neutre', icone: Icone,
}: {
  label: string; valeur: string; aide?: string;
  ton?: 'neutre' | 'positif' | 'negatif' | 'attention'; icone?: typeof Wallet;
}) {
  const couleur =
    ton === 'positif' ? 'text-emerald-600 dark:text-emerald-400'
    : ton === 'negatif' ? 'text-red-600 dark:text-red-400'
    : ton === 'attention' ? 'text-amber-600 dark:text-amber-500'
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

function Titre({ children, note }: { children: React.ReactNode; note?: string }) {
  return (
    <div className="mb-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{children}</h2>
      {note && <p className="text-xs text-gray-400 mt-1">{note}</p>}
    </div>
  );
}

/**
 * Évolution des frais, en barres empilées.
 *
 * Trois postes seulement, et la même couleur d'un mois à l'autre : ce qu'on
 * cherche à voir ici n'est pas le montant d'un mois mais la PENTE — les frais
 * Connect croissent avec le nombre de comptes, pas avec le chiffre d'affaires.
 */
function EvolutionFrais({ months }: { months: StripeEconomics['months'] }) {
  const total = (m: StripeEconomics['months'][number]) =>
    m.processingFees - m.connectFees - m.billingFees;
  const max = Math.max(1, ...months.map(total));

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-5">
      <div className="flex items-end gap-3 h-48">
        {months.map((m) => {
          const t = total(m);
          const h = (v: number) => `${(v / max) * 100}%`;
          return (
            <div key={m.month} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
              <span className="text-[11px] tabular-nums font-medium text-gray-700 dark:text-gray-300">
                {t > 0 ? (t / 100).toFixed(2) : '—'}
              </span>
              <div className="w-full flex flex-col-reverse rounded-md overflow-hidden" style={{ height: h(t) }}>
                <div className="bg-red-500" style={{ height: h(-m.connectFees) }} title="Connect" />
                <div className="bg-orange-400" style={{ height: h(m.processingFees) }} title="Traitement" />
                <div className="bg-amber-300" style={{ height: h(-m.billingFees) }} title="Billing" />
              </div>
              <span className="text-[11px] text-gray-500 dark:text-gray-400">{moisCourt(m.month)}</span>
            </div>
          );
        })}
      </div>
      <div className="flex gap-4 mt-4 text-xs text-gray-500 dark:text-gray-400">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-red-500" />Connect</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-orange-400" />Traitement</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-amber-300" />Billing</span>
      </div>
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
    <div className="space-y-10 p-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Stripe</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Ce qui entre, ce que ça coûte, et ce qui n&apos;entre pas.
        </p>
      </div>

      {/* ── Revenu réel ───────────────────────────────────────────────── */}
      <section>
        <Titre note="Un essai n'est pas un revenu, un code à 100 % non plus. Ni l'un ni l'autre n'entre dans le MRR.">
          Revenu récurrent réel
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

        <div className="mt-4 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400">
              <tr>
                <th className="text-left font-medium px-4 py-2">Produit</th>
                <th className="text-right font-medium px-4 py-2">Abonnés</th>
                <th className="text-right font-medium px-4 py-2">MRR net</th>
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
        </div>
      </section>

      {/* ── Ce qu'on paye ─────────────────────────────────────────────── */}
      <section>
        <Titre note="La pente compte plus que le montant : les frais Connect suivent le nombre de comptes actifs, pas le chiffre d'affaires.">
          Ce que l&apos;on paye, mois par mois
        </Titre>
        <EvolutionFrais months={data.months} />

        <div className="mt-4 grid gap-4 md:grid-cols-2">
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
            <p className="font-semibold text-gray-900 dark:text-white">Comptes connectés</p>
            <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Reliés</span><span className="tabular-nums">{data.accounts.connected}</span></div>
            <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Opérationnels</span><span className="tabular-nums">{data.accounts.chargesEnabled}</span></div>
            <div className="flex justify-between"><span className="text-gray-500 dark:text-gray-400">Facturés ce mois</span><span className="tabular-nums text-red-600 dark:text-red-400">{comptesFactures}</span></div>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-snug pt-2 border-t border-gray-100 dark:border-gray-800">
              Stripe facture 2 €/mois par compte ayant eu de l&apos;activité. Si les {data.accounts.chargesEnabled} comptes
              opérationnels s&apos;activaient tous, ce poste seul passerait à {eur(data.accounts.chargesEnabled * 200)}/mois.
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-gray-200 dark:border-gray-700 overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400">
              <tr>
                <th className="text-left font-medium px-4 py-2">Mois</th>
                <th className="text-right font-medium px-4 py-2">Encaissé</th>
                <th className="text-right font-medium px-4 py-2">Traitement</th>
                <th className="text-right font-medium px-4 py-2">Connect</th>
                <th className="text-right font-medium px-4 py-2">Billing</th>
                <th className="text-right font-medium px-4 py-2">Remboursé</th>
                <th className="text-right font-medium px-4 py-2">Reversé aux pros</th>
              </tr>
            </thead>
            <tbody>
              {data.months.map((m) => (
                <tr key={m.month} className="border-t border-gray-100 dark:border-gray-800">
                  <td className="px-4 py-2 text-gray-900 dark:text-white">{m.month}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-emerald-600 dark:text-emerald-400">{eur(m.collected)}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-red-600 dark:text-red-400">{eur(-m.processingFees)}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-red-600 dark:text-red-400">{eur(m.connectFees)}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-red-600 dark:text-red-400">{eur(m.billingFees)}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-red-600 dark:text-red-400">{eur(m.refunded)}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-gray-500 dark:text-gray-400">{eur(m.transferred)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 leading-snug">
          « Reversé aux pros » n&apos;est pas une charge : c&apos;est l&apos;argent des clientes qui transite par votre
          compte pour aller au salon. C&apos;est la colonne qui fait croire à des pertes.
        </p>
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
