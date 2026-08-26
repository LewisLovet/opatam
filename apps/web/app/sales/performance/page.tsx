'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Calculator,
  Euro,
  Loader2,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import { SUBSCRIPTION_PLANS } from '@booking-app/shared';
import { enTetesStaff } from '@/app/sales/entetes';

/**
 * Performance — la page du MANAGER : les chiffres de chacun, les tendances,
 * et un simulateur de chiffre d'affaires / commissions.
 *
 * Règle d'or héritée du chantier : la commission est assise sur le HORS
 * TAXES (TVA 20 % réputée incluse dans les tarifs TTC) — le simulateur rend
 * la bascule explicite plutôt que de la cacher.
 */

interface MembreEquipe {
  uid: string;
  displayName: string;
  email: string;
  role: string;
  active: boolean;
  objectifPayantsMensuel: number | null;
  tauxCommissionPct: number | null;
  stripeAccountStatus: string | null;
  chiffres: {
    prospects: number;
    prospectsPerdus: number;
    demos: number;
    vuesDemos: number;
    comptesCrees: number;
    payants: number;
    payantsCeMois: number;
    mrrCents: number;
    commissionsVerseesCents: number;
  };
}

interface PointTendance {
  mois: string;
  prospects: number;
  demos: number;
  payants: number;
  mrrAjouteCents: number;
  commissionsCents: number;
}

const MOIS_COURTS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

function libelleMois(cle: string): string {
  const [annee, mois] = cle.split('-').map(Number);
  return `${MOIS_COURTS[mois - 1]} ${String(annee).slice(2)}`;
}

function euros(cents: number, decimales = 0): string {
  return (cents / 100).toLocaleString('fr-FR', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  });
}

export default function PerformancePage() {
  const [team, setTeam] = useState<MembreEquipe[] | null>(null);
  const [tendance, setTendance] = useState<PointTendance[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const entetes = await enTetesStaff();
      const [teamRes, perfRes] = await Promise.all([
        fetch('/api/sales/team', { headers: entetes }),
        fetch('/api/sales/performance', { headers: entetes }),
      ]);
      if (!teamRes.ok || !perfRes.ok) {
        setErreur(teamRes.status === 403 || perfRes.status === 403 ? 'Réservé aux managers.' : 'Chargement impossible.');
        return;
      }
      setTeam((await teamRes.json()).team);
      setTendance((await perfRes.json()).tendance);
    })();
  }, []);

  // ── Simulateur ────────────────────────────────────────────────────────────
  const solo = SUBSCRIPTION_PLANS.solo;
  const studio = SUBSCRIPTION_PLANS.team;
  const [simClients, setSimClients] = useState(20);
  const [simTaux, setSimTaux] = useState(20);
  const [simPartStudio, setSimPartStudio] = useState(20); // % de clients Studio
  const [simPartAnnuel, setSimPartAnnuel] = useState(20); // % d'abonnés à l'année
  const [simHT, setSimHT] = useState(true); // true = commission assise sur le HT (règle réelle)

  const sim = useMemo(() => {
    const nStudio = Math.round((simClients * simPartStudio) / 100);
    const nSolo = simClients - nStudio;
    // MRR TTC : l'annuel est mensualisé (2 mois offerts déjà dans son prix).
    const mrrTtc = (n: number, mensuel: number, annuel: number) => {
      const nAnnuel = Math.round((n * simPartAnnuel) / 100);
      return (n - nAnnuel) * mensuel + nAnnuel * (annuel / 12);
    };
    const caMensuelTtc = mrrTtc(nSolo, solo.monthlyPrice, solo.yearlyPrice) + mrrTtc(nStudio, studio.baseMonthlyPrice, studio.baseYearlyPrice);
    const caMensuelHt = caMensuelTtc / 1.2;
    const baseCommission = simHT ? caMensuelHt : caMensuelTtc;
    const commissionMensuelle = (baseCommission * simTaux) / 100;
    return {
      nSolo,
      nStudio,
      caMensuelTtc,
      caMensuelHt,
      commissionMensuelle,
      netEntrepriseMensuel: caMensuelHt - commissionMensuelle,
    };
  }, [simClients, simTaux, simPartStudio, simPartAnnuel, simHT, solo, studio]);

  // ── KPI globaux ───────────────────────────────────────────────────────────
  const kpi = useMemo(() => {
    if (!team) return null;
    const total = (f: (m: MembreEquipe) => number) => team.reduce((n, m) => n + f(m), 0);
    const payants = total((m) => m.chiffres.payants);
    const demos = total((m) => m.chiffres.demos);
    return {
      mrrCents: total((m) => m.chiffres.mrrCents),
      payants,
      payantsCeMois: total((m) => m.chiffres.payantsCeMois),
      demos,
      conversionDemo: demos > 0 ? Math.round((payants / demos) * 100) : null,
      commissionsVerseesCents: total((m) => m.chiffres.commissionsVerseesCents),
    };
  }, [team]);

  const maxBarres = useMemo(
    () => Math.max(1, ...(tendance ?? []).map((p) => p.payants)),
    [tendance],
  );
  const maxMrr = useMemo(
    () => Math.max(1, ...(tendance ?? []).map((p) => p.mrrAjouteCents)),
    [tendance],
  );

  if (erreur) {
    return <p className="text-sm text-gray-500">{erreur}</p>;
  }
  if (!team || !tendance || !kpi) {
    return <Loader2 className="w-5 h-5 animate-spin text-gray-400" />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Performance</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Les chiffres de l&apos;équipe, les tendances, et le simulateur de chiffre d&apos;affaires.
        </p>
      </div>

      {/* ── KPI ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: 'MRR attribué (TTC)', valeur: `${euros(kpi.mrrCents)} €`, note: `${euros(kpi.mrrCents / 1.2)} € HT` },
          { label: 'Abonnés payants', valeur: String(kpi.payants), note: `${kpi.payantsCeMois} ce mois-ci` },
          { label: 'Démos créées', valeur: String(kpi.demos), note: 'toutes périodes' },
          { label: 'Conversion démo → payant', valeur: kpi.conversionDemo !== null ? `${kpi.conversionDemo} %` : '—', note: 'indicatif' },
          { label: 'Commissions versées', valeur: `${euros(kpi.commissionsVerseesCents)} €`, note: 'virements Stripe effectués' },
        ].map((k) => (
          <div key={k.label} className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">{k.label}</p>
            <p className="text-xl font-bold tabular-nums text-gray-900 dark:text-white mt-1">{k.valeur}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">{k.note}</p>
          </div>
        ))}
      </div>

      {/* ── Tendance 12 mois ── */}
      <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 inline-flex items-center justify-center">
            <TrendingUp className="w-4 h-4" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Tendance — 12 derniers mois</h2>
            <p className="text-[11px] text-gray-400">
              Barres : nouveaux abonnés payants · trait : MRR ajouté (TTC) — survolez pour le détail.
            </p>
          </div>
        </div>
        <div className="p-5 overflow-x-auto">
          <div className="flex items-end gap-2 min-w-[560px] h-40">
            {tendance.map((p) => (
              <div
                key={p.mois}
                className="flex-1 flex flex-col items-center gap-1 group"
                title={`${libelleMois(p.mois)} — ${p.payants} payant${p.payants > 1 ? 's' : ''}, +${euros(p.mrrAjouteCents)} € MRR, ${p.demos} démos, ${p.prospects} prospects`}
              >
                <span className="text-[10px] tabular-nums text-gray-400 opacity-0 group-hover:opacity-100">
                  {p.payants}
                </span>
                <div className="w-full flex items-end gap-0.5" style={{ height: '110px' }}>
                  <div
                    className="flex-1 rounded-t bg-blue-500/80 group-hover:bg-blue-600 transition-colors"
                    style={{ height: `${(p.payants / maxBarres) * 100}%`, minHeight: p.payants > 0 ? 4 : 0 }}
                  />
                  <div
                    className="flex-1 rounded-t bg-emerald-400/60 group-hover:bg-emerald-500 transition-colors"
                    style={{ height: `${(p.mrrAjouteCents / maxMrr) * 100}%`, minHeight: p.mrrAjouteCents > 0 ? 4 : 0 }}
                  />
                </div>
                <span className="text-[10px] text-gray-400 whitespace-nowrap">{libelleMois(p.mois)}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4 mt-3 text-[11px] text-gray-400">
            <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-blue-500/80" /> Nouveaux payants</span>
            <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-emerald-400/60" /> MRR ajouté</span>
          </div>
        </div>
      </section>

      {/* ── Simulateur ── */}
      <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 inline-flex items-center justify-center">
            <Calculator className="w-4 h-4" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Simulateur de chiffre d&apos;affaires</h2>
            <p className="text-[11px] text-gray-400">
              Clients payants, mix d&apos;abonnements, taux de commission — au tarif catalogue, hors remises et churn.
            </p>
          </div>
        </div>
        <div className="p-5 grid lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            {[
              { label: 'Clients payants', valeur: simClients, suffixe: '', min: 1, max: 500, set: setSimClients },
              { label: 'Part Studio (équipes)', valeur: simPartStudio, suffixe: ' %', min: 0, max: 100, set: setSimPartStudio },
              { label: 'Part abonnés à l’année', valeur: simPartAnnuel, suffixe: ' %', min: 0, max: 100, set: setSimPartAnnuel },
              { label: 'Taux de commission', valeur: simTaux, suffixe: ' %', min: 0, max: 40, set: setSimTaux },
            ].map((c) => (
              <div key={c.label}>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-300">{c.label}</label>
                  <span className="text-sm font-bold tabular-nums text-gray-900 dark:text-white">
                    {c.valeur}{c.suffixe}
                  </span>
                </div>
                <input
                  type="range"
                  min={c.min}
                  max={c.max}
                  value={c.valeur}
                  onChange={(e) => c.set(Number(e.target.value))}
                  className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                />
              </div>
            ))}
            <label className="flex items-center gap-2.5 pt-1 cursor-pointer select-none">
              <button
                type="button"
                role="switch"
                aria-checked={simHT}
                onClick={() => setSimHT((v) => !v)}
                className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors ${
                  simHT ? 'bg-emerald-600' : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                    simHT ? 'translate-x-4' : 'translate-x-0.5'
                  }`}
                />
              </button>
              <span className="text-xs text-gray-600 dark:text-gray-300">
                Commission assise sur le <strong>hors taxes</strong>
                <span className="text-gray-400"> — la règle réelle des virements (TVA 20 %)</span>
              </span>
            </label>
          </div>

          <div className="rounded-xl bg-gray-50 dark:bg-gray-800/60 p-4 space-y-3 self-start">
            <p className="text-[11px] text-gray-400">
              {sim.nSolo} × Pro ({euros(solo.monthlyPrice)} € TTC) · {sim.nStudio} × Studio ({euros(studio.baseMonthlyPrice)} € TTC)
              · {simPartAnnuel} % à l&apos;année (mensualisé)
            </p>
            {[
              { icone: Euro, label: 'CA mensuel (MRR)', valeur: `${euros(sim.caMensuelTtc)} € TTC`, note: `${euros(sim.caMensuelHt)} € HT` },
              { icone: Wallet, label: 'Commission commerciale / mois', valeur: `${euros(sim.commissionMensuelle)} €`, note: simHT ? `${simTaux} % du HT` : `${simTaux} % du TTC — ⚠ pas la règle réelle` },
              { icone: TrendingUp, label: 'Net entreprise / mois (HT − commission)', valeur: `${euros(sim.netEntrepriseMensuel)} €`, note: `${euros(sim.netEntrepriseMensuel * 12)} € sur 12 mois` },
            ].map((l) => (
              <div key={l.label} className="flex items-start gap-3">
                <span className="w-8 h-8 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 inline-flex items-center justify-center text-gray-500 flex-shrink-0">
                  <l.icone className="w-4 h-4" />
                </span>
                <div>
                  <p className="text-[11px] text-gray-400">{l.label}</p>
                  <p className="text-lg font-bold tabular-nums text-gray-900 dark:text-white leading-tight">{l.valeur}</p>
                  <p className="text-[11px] text-gray-400">{l.note}</p>
                </div>
              </div>
            ))}
            <p className="text-[11px] text-gray-400 pt-1 border-t border-gray-200 dark:border-gray-700">
              Hors frais Stripe, remises commerciales, churn et abonnements Play/App Store
              (encaissés par les stores à des tarifs différents).
            </p>
          </div>
        </div>
      </section>

      {/* ── Les chiffres de chacun ── */}
      <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 inline-flex items-center justify-center">
            <Users className="w-4 h-4" />
          </span>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Les chiffres de chacun</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-gray-400 border-b border-gray-100 dark:border-gray-800">
                <th className="px-5 py-2.5 font-semibold">Commercial</th>
                <th className="px-3 py-2.5 font-semibold text-right">Prospects</th>
                <th className="px-3 py-2.5 font-semibold text-right">Démos</th>
                <th className="px-3 py-2.5 font-semibold text-right">Comptes</th>
                <th className="px-3 py-2.5 font-semibold text-right">Payants</th>
                <th className="px-3 py-2.5 font-semibold text-right">Ce mois / objectif</th>
                <th className="px-3 py-2.5 font-semibold text-right">MRR (TTC)</th>
                <th className="px-3 py-2.5 font-semibold text-right">Taux</th>
                <th className="px-5 py-2.5 font-semibold text-right">Commissions versées</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800/60">
              {team.map((m) => (
                <tr key={m.uid} className={m.active ? '' : 'opacity-50'}>
                  <td className="px-5 py-3">
                    <p className="font-semibold text-gray-900 dark:text-white">{m.displayName}</p>
                    <p className="text-[11px] text-gray-400">
                      {m.role === 'sales_manager' ? 'Manager' : 'Commercial'}
                      {!m.active && ' · inactif'}
                      {m.stripeAccountStatus !== 'active' && m.role === 'sales' && (
                        <span className="text-amber-600 dark:text-amber-400"> · versements non configurés</span>
                      )}
                    </p>
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-gray-700 dark:text-gray-300">{m.chiffres.prospects}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-gray-700 dark:text-gray-300">{m.chiffres.demos}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-gray-700 dark:text-gray-300">{m.chiffres.comptesCrees}</td>
                  <td className="px-3 py-3 text-right tabular-nums font-semibold text-gray-900 dark:text-white">{m.chiffres.payants}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-gray-700 dark:text-gray-300">
                    {m.chiffres.payantsCeMois}
                    <span className="text-gray-400"> / {m.objectifPayantsMensuel ?? '—'}</span>
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-gray-700 dark:text-gray-300">{euros(m.chiffres.mrrCents)} €</td>
                  <td className="px-3 py-3 text-right tabular-nums text-gray-700 dark:text-gray-300">
                    {m.tauxCommissionPct !== null ? `${m.tauxCommissionPct} %` : '—'}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">
                    {euros(m.chiffres.commissionsVerseesCents)} €
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="px-5 py-3 text-[11px] text-gray-400 border-t border-gray-100 dark:border-gray-800">
          Réglages (objectif, taux) dans l&apos;onglet Équipe. MRR au tarif catalogue TTC ; les
          commissions versées sont les virements Stripe réellement effectués (assiette HT).
        </p>
      </section>
    </div>
  );
}
