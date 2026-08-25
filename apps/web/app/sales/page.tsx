'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader } from '@/components/ui';
import {
  ArrowRight,
  AlertTriangle,
  Link as LinkIcon,
  CalendarClock,
  Check,
  ChevronRight,
  Eye,
  Kanban,
  PartyPopper,
  Phone,
  Rocket,
  Megaphone,
  Wand2,
} from 'lucide-react';
import { STAGE_LABELS } from '@/lib/sales-leads';
import { enTetesStaff } from '@/app/sales/entetes';

/**
 * Tableau de bord commercial — la journée en un coup d'œil.
 *
 * Deux principes tenus depuis le premier retour d'usage :
 * - TOUT EN TOUTES LETTRES : chaque ligne nomme les étapes de configuration,
 *   l'échéance en français et l'action à mener avec les chiffres du compte.
 * - LES SIGNAUX D'ABORD : essais qui expirent, inscrits pas prêts, démos
 *   jamais ouvertes — le tableau de bord dit qui appeler, pas des courbes.
 */

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
interface DemoRow {
  id: string;
  businessName: string;
  url: string;
  expired: boolean;
  views: number;
  lastViewedAt: string | null;
  sentTo: string[];
  claimedProviderName: string | null;
  coverUrl: string | null;
}
interface ConversionRow {
  providerId: string;
  businessName: string | null;
  mrrCents: number;
  firstPaidAt: string | null;
}
interface LeadRow {
  id: string;
  ownerUid: string | null;
  profileUrl: string | null;
  city: string | null;
  stage: string;
  lostReason: string | null;
  businessName: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  nextActionAt: string | null;
}

/** Le tunnel, regroupé pour la lecture — les 10 étapes du modèle restent la
 *  vérité, l'affichage en montre 6. */
const TUNNEL: Array<{ label: string; stages: string[] }> = [
  { label: 'À contacter', stages: ['prospect'] },
  { label: 'En discussion', stages: ['contacte', 'reponse', 'qualifie'] },
  { label: 'Démo', stages: ['demo_planifiee', 'demo_realisee'] },
  { label: 'Compte créé', stages: ['essai_cree'] },
  { label: 'Activé', stages: ['essai_active'] },
  { label: 'Payant', stages: ['payant', 'conserve_j90'] },
];

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

function expireDans(jours: number): { texte: string; urgent: boolean } {
  if (jours <= 0) return { texte: "expire aujourd'hui", urgent: true };
  if (jours === 1) return { texte: 'expire demain', urgent: true };
  return { texte: `expire dans ${jours} jours`, urgent: false };
}

function depuis(iso: string): string {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (min < 60) return `il y a ${Math.max(1, min)} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const j = Math.round(h / 24);
  return j === 1 ? 'hier' : `il y a ${j} j`;
}

/**
 * L'état de configuration en UNE ligne discrète : quatre points, le score,
 * et seulement CE QUI MANQUE — lister les étapes déjà faites n'apprend rien
 * et fatigue l'œil (retour client sur les barres vertes).
 */
function Progression({ a }: { a: ActivationDetail }) {
  const items = [
    { ok: a.enoughServices, label: a.activeServicesCount === 0 ? 'les prestations' : `les prestations (${Math.min(a.activeServicesCount, 3)}/3)` },
    { ok: a.hasAvailability, label: 'les horaires' },
    { ok: a.published, label: 'la publication' },
    { ok: a.hasFirstBooking, label: 'la 1ʳᵉ réservation' },
  ];
  const faits = items.filter((i) => i.ok).length;
  const manquants = items.filter((i) => !i.ok).map((i) => i.label);
  return (
    <div className="flex items-center gap-2.5 text-[11px] text-gray-400 dark:text-gray-500">
      <span className="flex items-center gap-1" aria-label={`${faits} étapes sur 4`}>
        {items.map(({ ok, label }) => (
          <span
            key={label}
            className={`w-1.5 h-1.5 rounded-full ${ok ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600'}`}
          />
        ))}
      </span>
      <span className="tabular-nums font-medium text-gray-500 dark:text-gray-400">{faits}/4</span>
      {manquants.length > 0 && (
        <span className="truncate">
          il manque {manquants.length > 2 ? `${manquants.slice(0, 2).join(', ')}…` : manquants.join(' et ')}
        </span>
      )}
    </div>
  );
}

function CompteRow({
  nom,
  droite,
  a,
  urgent,
}: {
  nom: string;
  droite: React.ReactNode;
  a: ActivationDetail;
  urgent?: boolean;
}) {
  return (
    <div className="px-5 py-4">
      <div className="flex items-center gap-3 mb-2.5">
        <p className="flex-1 min-w-0 text-sm font-semibold text-gray-900 dark:text-white truncate">{nom}</p>
        {droite}
      </div>
      <Progression a={a} />
      <p className={`mt-2 text-xs rounded-lg px-3 py-2 ${
        urgent
          ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
          : 'bg-gray-50 dark:bg-gray-800/60 text-gray-600 dark:text-gray-300'
      }`}>
        <ArrowRight className="w-3 h-3 inline mr-1 -mt-0.5" />
        {prochaineAction(a)}
      </p>
    </div>
  );
}

function SectionCard({
  icone: Icone,
  ton,
  titre,
  sousTitre,
  children,
  action,
}: {
  icone: React.ComponentType<{ className?: string }>;
  ton: string;
  titre: string;
  sousTitre?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className={`w-8 h-8 rounded-lg inline-flex items-center justify-center flex-shrink-0 ${ton}`}>
            <Icone className="w-4 h-4" />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white leading-tight">{titre}</h2>
            {sousTitre && <p className="text-[11px] text-gray-400 leading-tight mt-0.5 truncate">{sousTitre}</p>}
          </div>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Vide({ texte }: { texte: string }) {
  return (
    <p className="text-sm text-gray-400 dark:text-gray-500 px-5 py-8 text-center">
      <Check className="w-4 h-4 inline mr-1.5 -mt-0.5 text-emerald-500" />
      {texte}
    </p>
  );
}

export default function SalesDashboardPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [demos, setDemos] = useState<DemoRow[] | null>(null);
  const [leads, setLeads] = useState<LeadRow[] | null>(null);
  const [conversions, setConversions] = useState<ConversionRow[] | null>(null);
  const [moi, setMoi] = useState<{
    uid: string;
    role: string;
    objectifPayantsMensuel: number | null;
    tauxCommissionPct: number | null;
  } | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const headers = await enTetesStaff();
        const [ovRes, demosRes, leadsRes, convRes, moiRes] = await Promise.all([
          fetch('/api/sales/overview', { headers }),
          fetch('/api/sales/demos', { headers }),
          fetch('/api/sales/leads', { headers }),
          fetch('/api/sales/conversions', { headers }),
          fetch('/api/sales/me', { headers }),
        ]);
        if (!ovRes.ok) throw new Error((await ovRes.json()).error ?? `Erreur ${ovRes.status}`);
        setData(await ovRes.json());
        if (demosRes.ok) setDemos((await demosRes.json()).demos);
        if (leadsRes.ok) setLeads((await leadsRes.json()).leads);
        if (convRes.ok) setConversions((await convRes.json()).conversions);
        if (moiRes.ok) setMoi(await moiRes.json());
      } catch (e) {
        setErreur(e instanceof Error ? e.message : 'Erreur inconnue');
      }
    })();
  }, []);

  const [lienCopie, setLienCopie] = useState(false);
  // Versements Connect — chargé à part (appel Stripe côté serveur, ne doit
  // pas retarder le reste du tableau de bord).
  const [connect, setConnect] = useState<{
    statut: 'aucun' | 'active' | 'pending' | 'restricted';
    aUneFiche: boolean;
    totalVerseCents: number;
    nbVersements: number;
  } | null>(null);
  useEffect(() => {
    void (async () => {
      const res = await fetch('/api/sales/connect', { headers: await enTetesStaff() });
      if (res.ok) setConnect(await res.json());
    })();
  }, []);

  const configurerVersements = async () => {
    const res = await fetch('/api/sales/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await enTetesStaff()) },
    });
    const d = await res.json();
    if (!res.ok) {
      alert(d.error ?? 'Configuration impossible');
      return;
    }
    window.location.href = d.url;
  };
  // Le lien personnel du commercial : signé, il attribue l'inscription à son
  // porteur — c'est LE lien à envoyer à un prospect hors démo.
  const copierMonLien = async () => {
    const res = await fetch('/api/sales/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await enTetesStaff()) },
      body: JSON.stringify({ campaign: 'lien-direct' }),
    });
    if (!res.ok) {
      alert((await res.json()).error ?? 'Génération du lien impossible');
      return;
    }
    const { url } = await res.json();
    await navigator.clipboard.writeText(url);
    setLienCopie(true);
    setTimeout(() => setLienCopie(false), 2500);
  };

  const prendre = async (l: LeadRow) => {
    if (!confirm(`Prendre en charge « ${l.businessName} » ? Il rejoindra votre pipeline.`)) return;
    const headers = { 'Content-Type': 'application/json', ...(await enTetesStaff()) };
    const res = await fetch('/api/sales/leads/claim', {
      method: 'POST',
      headers,
      body: JSON.stringify({ id: l.id }),
    });
    if (!res.ok) {
      alert((await res.json()).error ?? 'Prise en charge impossible');
    }
    const rel = await fetch('/api/sales/leads', { headers: await enTetesStaff() });
    if (rel.ok) setLeads((await rel.json()).leads);
  };

  if (erreur) return <p className="text-red-600">{erreur}</p>;
  if (!data) return <Loader />;

  const demosActives = (demos ?? []).filter((d) => !d.expired);
  const actifs = (leads ?? []).filter((l) => !l.lostReason && l.ownerUid !== null);
  const aPrendre = (leads ?? []).filter((l) => !l.lostReason && l.ownerUid === null);
  const finJour = new Date();
  finJour.setHours(23, 59, 59, 999);
  const aRelancer = actifs
    .filter((l) => l.nextActionAt && new Date(l.nextActionAt).getTime() <= finJour.getTime())
    .sort((a, b) => (a.nextActionAt! < b.nextActionAt! ? -1 : 1));
  const vuesTotal = demosActives.reduce((n, d) => n + d.views, 0);
  const converties = (demos ?? []).filter((d) => d.claimedProviderName).length;
  const jamaisOuvertes = demosActives.filter((d) => d.views === 0 && d.sentTo.length > 0);

  const aujourdHui = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const kpis = [
    {
      icone: CalendarClock,
      ton: 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
      valeur: data.essaisQuiExpirent.length,
      label: 'Essais qui se terminent',
      aide: 'dans les 7 prochains jours',
    },
    {
      icone: Rocket,
      ton: 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400',
      valeur: data.aActiver.length,
      label: 'Inscrits à accompagner',
      aide: 'pas encore prêts à recevoir des réservations',
    },
    {
      icone: Eye,
      ton: 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
      valeur: demos === null ? '—' : `${demosActives.length}`,
      label: 'Démos actives',
      aide: demos === null ? '' : `${vuesTotal} vue${vuesTotal > 1 ? 's' : ''} par les prospects`,
    },
    {
      icone: PartyPopper,
      ton: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
      valeur:
        conversions === null
          ? '—'
          : `${(conversions.reduce((n, c) => n + c.mrrCents, 0) / 100).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €`,
      label: 'MRR attribué',
      aide:
        conversions === null
          ? ''
          : conversions.length === 0
            ? 'aucun abonné payant attribué pour l’instant'
            : `${conversions.length} abonné${conversions.length > 1 ? 's' : ''} payant${conversions.length > 1 ? 's' : ''} · ${converties} via démo`,
    },
  ];

  return (
    <div className="space-y-6">
      {/* ── En-tête ── */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 capitalize">{aujourdHui}</p>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mt-0.5">Tableau de bord</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Les comptes qui ont besoin de vous aujourd&apos;hui, et pourquoi.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Le lien d'inscription attribué — copiable en un geste : c'est
              l'action la plus fréquente d'une journée de prospection. */}
          <button
            onClick={copierMonLien}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
            title="Un lien d'inscription signé : tout compte créé par ce lien vous est attribué"
          >
            {lienCopie ? <Check className="w-4 h-4 text-emerald-500" /> : <LinkIcon className="w-4 h-4" />}
            {lienCopie ? 'Lien copié !' : 'Mon lien d’inscription'}
          </button>
          <Link
            href="/sales/pipeline"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            <Kanban className="w-4 h-4" /> Pipeline
          </Link>
          <Link
            href="/sales/demo"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 shadow-lg shadow-red-600/20"
          >
            <Wand2 className="w-4 h-4" /> Nouvelle démo
          </Link>
        </div>
      </div>

      {/* ── Chiffres du jour ── */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {kpis.map(({ icone: Icone, ton, valeur, label, aide }) => (
          <div
            key={label}
            className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4"
          >
            <span className={`w-8 h-8 rounded-lg inline-flex items-center justify-center ${ton}`}>
              <Icone className="w-4 h-4" />
            </span>
            <p className="text-2xl font-bold tabular-nums text-gray-900 dark:text-white mt-2.5 leading-none">
              {valeur}
            </p>
            <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mt-1.5">{label}</p>
            {aide && <p className="text-[11px] text-gray-400 mt-0.5">{aide}</p>}
          </div>
        ))}
      </div>

      {/* ── Objectif du mois + commission — le moteur. TOUJOURS visible en
          rôle commercial, même sans réglages : « à définir » vaut mieux
          qu'une carte qui disparaît (le premier réflexe d'un commercial est
          de chercher où sont ses chiffres). ── */}
      {moi && (moi.role === 'sales' || moi.objectifPayantsMensuel !== null || moi.tauxCommissionPct !== null) && (() => {
        const debutMois = new Date();
        debutMois.setDate(1);
        debutMois.setHours(0, 0, 0, 0);
        const payantsCeMois = (conversions ?? []).filter(
          (c) => c.firstPaidAt && new Date(c.firstPaidAt) >= debutMois,
        ).length;
        const objectif = moi.objectifPayantsMensuel;
        // Commission du mois : % du MRR de chaque conversion des 12 derniers
        // mois (le modèle : % versé pendant 12 mois). Estimation hors
        // résiliations — l'exactitude viendra avec le suivi du churn.
        const il12Mois = new Date();
        il12Mois.setMonth(il12Mois.getMonth() - 12);
        const mrrCommissionnable = (conversions ?? [])
          .filter((c) => c.firstPaidAt && new Date(c.firstPaidAt) >= il12Mois)
          .reduce((n, c) => n + c.mrrCents, 0);
        const commission = moi.tauxCommissionPct !== null
          ? (mrrCommissionnable * moi.tauxCommissionPct) / 100 / 100
          : null;
        return (
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex-1 min-w-[220px]">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                  Objectif du mois — abonnés payants
                </p>
                {objectif !== null ? (
                  <>
                    <p className="text-xl font-bold tabular-nums text-gray-900 dark:text-white mt-1">
                      {payantsCeMois} <span className="text-sm font-normal text-gray-400">/ {objectif}</span>
                    </p>
                    <div className="mt-2 h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${payantsCeMois >= objectif ? 'bg-emerald-500' : 'bg-red-500'}`}
                        style={{ width: `${Math.min(100, Math.round((payantsCeMois / Math.max(1, objectif)) * 100))}%` }}
                      />
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-gray-400 mt-1">À définir par votre manager.</p>
                )}
              </div>
              {connect?.aUneFiche && (
                <div className="min-w-[190px]">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                    Mes versements
                  </p>
                  {connect.statut === 'active' ? (
                    <>
                      <p className="text-xl font-bold tabular-nums text-gray-900 dark:text-white mt-1">
                        {(connect.totalVerseCents / 100).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} €
                      </p>
                      <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                        ✓ Versements actifs · {connect.nbVersements} virement{connect.nbVersements > 1 ? 's' : ''}
                      </p>
                    </>
                  ) : (
                    <button
                      onClick={configurerVersements}
                      className="mt-1.5 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-xs font-semibold hover:opacity-90"
                    >
                      {connect.statut === 'aucun'
                        ? 'Configurer mes versements'
                        : 'Reprendre la configuration'}
                    </button>
                  )}
                  {connect.statut !== 'active' && (
                    <p className="text-[10px] text-gray-400 mt-1.5 max-w-[210px]">
                      Identité + IBAN via Stripe — requis pour recevoir vos commissions
                      (indépendants).
                    </p>
                  )}
                </div>
              )}
              <div className="text-right">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                  Commission estimée ce mois-ci
                </p>
                {commission !== null ? (
                  <>
                    <p className="text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400 mt-1">
                      {commission.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} €
                    </p>
                    <p className="text-[10px] text-gray-400">
                      {moi.tauxCommissionPct} % du MRR des conversions de 12 derniers mois — hors résiliations
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-gray-400 mt-1">Taux à définir.</p>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Prospects poussés par le manager — premier arrivé, premier servi ── */}
      {aPrendre.length > 0 && (
        <SectionCard
          icone={Megaphone}
          ton="bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
          titre="Prospects à prendre en charge"
          sousTitre="Proposés par le manager — le premier qui les prend se les attribue"
        >
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {aPrendre.map((l) => (
              <div key={l.id} className="flex items-center gap-3 px-5 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{l.businessName}</p>
                  <p className="text-[11px] text-gray-400 truncate">
                    {[l.city, STAGE_LABELS[l.stage as keyof typeof STAGE_LABELS]].filter(Boolean).join(' · ')}
                  </p>
                </div>
                {l.profileUrl?.startsWith('http') && (
                  <a
                    href={l.profileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-medium text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:underline whitespace-nowrap"
                  >
                    Voir le profil
                  </a>
                )}
                <button
                  onClick={() => prendre(l)}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 whitespace-nowrap"
                >
                  Prendre en charge
                </button>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* ── Le tunnel — la colonne vertébrale de l'écran ── */}
      <SectionCard
        icone={Kanban}
        ton="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300"
        titre="Votre tunnel"
        sousTitre="Où en sont vos prospects, du premier contact à l'abonnement"
        action={
          <Link
            href="/sales/pipeline"
            className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 whitespace-nowrap"
          >
            Ouvrir le pipeline <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        }
      >
        {leads === null ? (
          <p className="px-5 py-6 text-sm text-gray-400">Chargement…</p>
        ) : actifs.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
              Votre pipeline est vide — ajoutez vos premiers prospects pour que le tunnel prenne vie.
            </p>
            <Link
              href="/sales/pipeline"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-semibold hover:opacity-90"
            >
              <Kanban className="w-4 h-4" /> Ouvrir le pipeline
            </Link>
          </div>
        ) : (
          <div className="px-5 py-4">
            <div className="flex items-end gap-1.5">
              {TUNNEL.map((etape, i) => {
                const n = actifs.filter((l) => etape.stages.includes(l.stage)).length;
                const max = Math.max(1, ...TUNNEL.map((e2) => actifs.filter((l) => e2.stages.includes(l.stage)).length));
                return (
                  <Link
                    key={etape.label}
                    href="/sales/pipeline"
                    className="flex-1 group"
                    title={`${n} prospect${n > 1 ? 's' : ''} — ${etape.label}`}
                  >
                    <p className="text-lg font-bold tabular-nums text-gray-900 dark:text-white leading-none text-center">
                      {n}
                    </p>
                    <div className="mt-1.5 h-14 flex items-end rounded-md overflow-hidden bg-gray-100 dark:bg-gray-800">
                      <div
                        className={`w-full transition-all ${i >= 3 ? 'bg-emerald-500' : 'bg-red-500/80'} group-hover:opacity-80`}
                        style={{ height: `${Math.round((n / max) * 100)}%` }}
                      />
                    </div>
                    <p className="mt-1.5 text-[10px] text-center text-gray-500 dark:text-gray-400 leading-tight">
                      {etape.label}
                    </p>
                  </Link>
                );
              })}
            </div>
            <p className="mt-3 text-[11px] text-gray-400">
              « Payant » se remplira automatiquement quand l&apos;attribution des paiements sera branchée —
              en attendant, l&apos;étape se coche à la main sur la fiche.
            </p>
          </div>
        )}
      </SectionCard>

      {/* ── À relancer aujourd'hui — les rappels posés sur les fiches ── */}
      {aRelancer.length > 0 && (
        <SectionCard
          icone={Phone}
          ton="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400"
          titre="À relancer aujourd'hui"
          sousTitre="Les rappels que vous avez posés sur vos fiches prospects"
        >
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {aRelancer.slice(0, 8).map((l) => {
              const retard = new Date(l.nextActionAt!).toDateString() !== new Date().toDateString();
              return (
                <Link
                  key={l.id}
                  href={`/sales/pipeline?lead=${l.id}`}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/60"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{l.businessName}</p>
                    <p className="text-[11px] text-gray-400 truncate">
                      {[STAGE_LABELS[l.stage as keyof typeof STAGE_LABELS] ?? l.stage, l.contactName, l.phone]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                  {retard && (
                    <span className="text-[10px] font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 px-2 py-0.5 rounded-full">
                      en retard
                    </span>
                  )}
                  <ChevronRight className="w-4 h-4 text-gray-300" />
                </Link>
              );
            })}
          </div>
        </SectionCard>
      )}

      {/* ── Relance démos : envoyées mais jamais ouvertes ── */}
      {jamaisOuvertes.length > 0 && (
        <div className="rounded-2xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 px-5 py-4">
          <p className="text-sm text-blue-800 dark:text-blue-300">
            <Megaphone className="w-4 h-4 inline mr-1.5 -mt-0.5" />
            <strong>
              {jamaisOuvertes.length} démo{jamaisOuvertes.length > 1 ? 's' : ''} envoyée
              {jamaisOuvertes.length > 1 ? 's' : ''} jamais ouverte{jamaisOuvertes.length > 1 ? 's' : ''}
            </strong>{' '}
            — {jamaisOuvertes.slice(0, 3).map((d) => d.businessName).join(', ')}
            {jamaisOuvertes.length > 3 ? '…' : ''}. Un rappel téléphonique vaut mieux qu&apos;un
            deuxième e-mail.
          </p>
        </div>
      )}

      {/* ── Essais qui expirent ── */}
      <SectionCard
        icone={AlertTriangle}
        ton="bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400"
        titre="Leur essai gratuit se termine cette semaine"
        sousTitre="Un compte bien configuré avant la fin de l'essai a beaucoup plus de chances de s'abonner"
      >
        {data.essaisQuiExpirent.length === 0 ? (
          <Vide texte="Aucun essai ne se termine dans les 7 prochains jours." />
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {data.essaisQuiExpirent.map((e) => {
              const ech = expireDans(e.joursRestants);
              return (
                <CompteRow
                  key={e.providerId}
                  nom={e.businessName}
                  urgent={ech.urgent}
                  a={e.activation}
                  droite={
                    <span
                      className={`text-xs font-semibold whitespace-nowrap px-2.5 py-1 rounded-full ${
                        ech.urgent
                          ? 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                          : 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                      }`}
                    >
                      {ech.texte}
                    </span>
                  }
                />
              );
            })}
          </div>
        )}
      </SectionCard>

      {/* ── Inscrits à accompagner ── */}
      <SectionCard
        icone={Rocket}
        ton="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400"
        titre="Nouveaux inscrits pas encore prêts"
        sousTitre="Comptes créés ces 14 derniers jours à qui il manque une étape pour recevoir des réservations"
      >
        {data.aActiver.length === 0 ? (
          <Vide texte="Tous les inscrits récents sont prêts à recevoir des réservations." />
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {data.aActiver.map((r) => (
              <CompteRow
                key={r.providerId}
                nom={r.businessName}
                a={r.activation}
                droite={
                  <span className="text-xs text-gray-400 whitespace-nowrap">
                    {r.joursDepuisInscription === 0
                      ? "inscrit aujourd'hui"
                      : r.joursDepuisInscription === 1
                        ? 'inscrit hier'
                        : `inscrit il y a ${r.joursDepuisInscription} jours`}
                  </span>
                }
              />
            ))}
          </div>
        )}
      </SectionCard>

      {/* ── Vos démonstrations ── */}
      <SectionCard
        icone={Wand2}
        ton="bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
        titre="Vos démonstrations"
        sousTitre="Les plus récentes — le signal vert dit que le prospect a regardé"
        action={
          <Link
            href="/sales/demo"
            className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 whitespace-nowrap"
          >
            Tout voir <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        }
      >
        {demos === null ? (
          <p className="px-5 py-6 text-sm text-gray-400">Chargement…</p>
        ) : demos.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
              Aucune démo pour l&apos;instant — c&apos;est votre meilleur outil de conversion.
            </p>
            <Link
              href="/sales/demo"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-semibold hover:opacity-90"
            >
              <Wand2 className="w-4 h-4" /> Créer la première
            </Link>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 p-4">
            {demos.slice(0, 4).map((d) => (
              <Link
                key={d.id}
                href={`/sales/demo/${d.id}`}
                className="group rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden hover:shadow-md transition-shadow"
              >
                <div className="relative h-16 bg-gray-100 dark:bg-gray-800">
                  {d.coverUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={d.coverUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
                  )}
                  {d.claimedProviderName && (
                    <span className="absolute top-1.5 right-1.5 inline-flex items-center gap-1 text-[9px] font-semibold text-white bg-emerald-600 px-1.5 py-0.5 rounded-full">
                      <PartyPopper className="w-2.5 h-2.5" /> Converti
                    </span>
                  )}
                </div>
                <div className="px-3 py-2.5">
                  <p className="text-xs font-semibold text-gray-900 dark:text-white truncate group-hover:underline">
                    {d.businessName}
                  </p>
                  <p
                    className={`text-[10px] mt-0.5 inline-flex items-center gap-1 ${
                      d.views > 0 ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-gray-400'
                    }`}
                  >
                    <Eye className="w-2.5 h-2.5" />
                    {d.views === 0
                      ? d.sentTo.length > 0
                        ? 'envoyée, jamais ouverte'
                        : 'jamais ouverte'
                      : `${d.views} vue${d.views > 1 ? 's' : ''}${d.lastViewedAt ? ` · ${depuis(d.lastViewedAt)}` : ''}`}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
