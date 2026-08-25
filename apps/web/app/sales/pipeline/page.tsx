'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Building2,
  CalendarClock,
  Info,
  ExternalLink,
  Eye,
  Link2,
  Presentation,
  Check,
  ChevronRight,
  Loader2,
  Mail,
  MessageSquare,
  PartyPopper,
  Phone,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { enTetesStaff } from '@/app/sales/entetes';
import { SALES_STAGES, SALES_LOSS_REASONS, SALES_SECTORS, SALES_PLATFORMS } from '@booking-app/shared';
import { STAGE_LABELS, LOSS_LABELS, SECTOR_LABELS, SOURCES_PROSPECTION, PLATFORM_LABELS } from '@/lib/sales-leads';
import { GoogleAddressAutocomplete, type GoogleAddressSuggestion } from '@/components/ui/GoogleAddressAutocomplete';

/**
 * Pipeline — le tunnel du commercial en colonnes, et la fiche de chaque
 * prospect dans un panneau latéral.
 *
 * Les cartes se déplacent par glisser-déposer (HTML5 natif, pas de
 * bibliothèque) OU par le sélecteur d'étape de la fiche — le tactile n'a
 * pas de drag fiable. Chaque passage d'étape est journalisé côté serveur.
 *
 * « conserve_j90 » n'est pas une colonne : c'est un constat qui se mesurera
 * depuis l'attribution des paiements, pas un geste de commercial.
 */

interface Lead {
  id: string;
  ownerUid: string;
  stage: (typeof SALES_STAGES)[number];
  lostReason: (typeof SALES_LOSS_REASONS)[number] | null;
  businessName: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  sector: (typeof SALES_SECTORS)[number];
  isTeam: boolean;
  source: string | null;
  mainPain: string | null;
  currentPlatform: string | null;
  notes: string | null;
  linkedProviderId: string | null;
  optOut: boolean;
  nextActionAt: string | null;
  lastInteractionAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

interface DemoLiee {
  id: string;
  businessName: string;
  url: string;
  views: number;
  expired: boolean;
  leadId: string | null;
  staffUid: string;
  claimedProviderName: string | null;
}

interface Activity {
  id: string;
  type: 'note' | 'appel' | 'email' | 'demo' | 'changement_etape';
  stage: string | null;
  body: string | null;
  createdAt: string | null;
}

const COLONNES = SALES_STAGES.filter((s) => s !== 'conserve_j90');

/**
 * Le tableau regroupe les 9 étapes en 6 COLONNES qui remplissent l'écran —
 * mêmes regroupements que le tunnel du tableau de bord. Neuf colonnes en
 * défilement horizontal, presque toutes vides, ne ressemblaient à rien
 * (retour client). La sous-étape précise s'affiche en badge sur la carte et
 * se règle dans la fiche ; déposer une carte sur un groupe la place sur son
 * étape d'entrée.
 */
const GROUPES: Array<{
  label: string;
  stages: Array<(typeof SALES_STAGES)[number]>;
  entree: (typeof SALES_STAGES)[number];
  accent: string;
  aide: string;
}> = [
  {
    label: 'À contacter', stages: ['prospect'], entree: 'prospect', accent: 'bg-gray-400',
    aide: "Le contact existe (salon repéré, carte récupérée) mais personne ne lui a encore parlé.",
  },
  {
    label: 'En discussion', stages: ['contacte', 'reponse', 'qualifie'], entree: 'contacte', accent: 'bg-blue-500',
    aide: "Le premier contact a eu lieu. Sous-étapes : Contacté (message laissé), A répondu, Qualifié (besoin réel confirmé) — à régler dans la fiche.",
  },
  {
    label: 'Démo', stages: ['demo_planifiee', 'demo_realisee'], entree: 'demo_realisee', accent: 'bg-violet-500',
    aide: "Sa page de démonstration existe. Démo planifiée = rendez-vous pris pour la montrer ; Démo faite = il l'a vue ou reçue.",
  },
  {
    label: 'Compte créé', stages: ['essai_cree'], entree: 'essai_cree', accent: 'bg-amber-500',
    aide: "Le prospect s'est inscrit sur Opatam — son essai gratuit de 30 jours court. Automatique quand il valide depuis sa démo.",
  },
  {
    label: 'Activé', stages: ['essai_active'], entree: 'essai_active', accent: 'bg-emerald-500',
    aide: "Son compte est prêt à recevoir des réservations : prestations, horaires, page publiée, première réservation.",
  },
  {
    label: 'Payant', stages: ['payant', 'conserve_j90'], entree: 'payant', accent: 'bg-emerald-600',
    aide: "Il paie son abonnement. Se remplit automatiquement au premier paiement réel — l'étape qui compte pour la commission.",
  },
];



function depuis(iso: string): string {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (min < 60) return `il y a ${Math.max(1, min)} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const j = Math.round(h / 24);
  return j === 1 ? 'hier' : `il y a ${j} j`;
}

function echeance(iso: string): { texte: string; enRetard: boolean } {
  const cible = new Date(iso);
  const aujourdHui = new Date();
  aujourdHui.setHours(23, 59, 59, 999);
  const enRetard = cible.getTime() <= aujourdHui.getTime();
  return { texte: cible.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }), enRetard };
}

const CHAMP = 'w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-sm text-gray-900 dark:text-white';

/**
 * Une liste de valeurs connues + « Autre… » qui ouvre la saisie libre — le
 * schéma du client : choisir vite dans les cas courants, écrire quand il le
 * faut. `options` = [valeur stockée, libellé].
 */
function ChampAvecListe({
  valeur,
  options,
  onChange,
  placeholderAutre,
}: {
  valeur: string | null;
  options: Array<[string, string]>;
  onChange: (v: string | null) => void;
  placeholderAutre: string;
}) {
  const connue = valeur === null || options.some(([v]) => v === valeur);
  const [autre, setAutre] = useState(!connue);
  return (
    <div className="space-y-1.5">
      <select
        value={autre ? '_autre' : (valeur ?? '')}
        onChange={(e) => {
          if (e.target.value === '_autre') {
            setAutre(true);
            onChange(null);
          } else {
            setAutre(false);
            onChange(e.target.value || null);
          }
        }}
        className={CHAMP}
      >
        <option value="">—</option>
        {options.map(([v, l]) => (
          <option key={v} value={v}>{l}</option>
        ))}
        <option value="_autre">Autre…</option>
      </select>
      {autre && (
        <input
          autoFocus
          value={valeur ?? ''}
          onChange={(e) => onChange(e.target.value || null)}
          placeholder={placeholderAutre}
          className={CHAMP}
        />
      )}
    </div>
  );
}

const ICONES_ACTIVITE: Record<Activity['type'], React.ComponentType<{ className?: string }>> = {
  note: MessageSquare,
  appel: Phone,
  email: Mail,
  demo: PartyPopper,
  changement_etape: ChevronRight,
};

export default function PipelinePageWrapper() {
  // useSearchParams exige une frontière Suspense au prérendu.
  return (
    <Suspense fallback={<Loader2 className="w-5 h-5 animate-spin text-gray-400" />}>
      <PipelinePage />
    </Suspense>
  );
}

function PipelinePage() {
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [recherche, setRecherche] = useState('');
  const [voirPerdus, setVoirPerdus] = useState(false);
  const [ouvertId, setOuvertId] = useState<string | null>(null);
  const [creation, setCreation] = useState(false);
  const [demos, setDemos] = useState<DemoLiee[]>([]);
  // Colonne dont l'explication est dépliée (bouton ⓘ de son en-tête).
  const [aideColonne, setAideColonne] = useState<string | null>(null);

  const searchParams = useSearchParams();

  const charger = async () => {
    const res = await fetch('/api/sales/leads', { headers: await enTetesStaff() });
    if (res.ok) setLeads((await res.json()).leads);
  };
  const chargerDemos = async () => {
    const res = await fetch('/api/sales/demos', { headers: await enTetesStaff() });
    if (res.ok) setDemos((await res.json()).demos);
  };
  useEffect(() => {
    void chargerDemos();
  }, []);
  useEffect(() => {
    void charger();
  }, []);

  // Arrivée depuis le tableau de bord (?lead=) : la fiche s'ouvre seule.
  useEffect(() => {
    const cible = searchParams.get('lead');
    if (cible && leads?.some((l) => l.id === cible)) setOuvertId(cible);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leads]);

  const patch = async (id: string, champs: Record<string, unknown>): Promise<Lead | null> => {
    const res = await fetch('/api/sales/leads', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...(await enTetesStaff()) },
      body: JSON.stringify({ id, ...champs }),
    });
    if (!res.ok) return null;
    const { lead } = await res.json();
    setLeads((prev) => (prev ? prev.map((l) => (l.id === id ? lead : l)) : prev));
    return lead;
  };

  const deplacer = async (id: string, stage: Lead['stage']) => {
    // Optimiste : la carte change de colonne tout de suite.
    setLeads((prev) => (prev ? prev.map((l) => (l.id === id ? { ...l, stage } : l)) : prev));
    await patch(id, { stage });
  };

  const visibles = useMemo(() => {
    if (!leads) return [];
    const q = recherche.trim().toLowerCase();
    return leads.filter((l) => {
      if (!voirPerdus && l.lostReason) return false;
      if (voirPerdus && !l.lostReason) return false;
      if (!q) return true;
      return (
        l.businessName.toLowerCase().includes(q) ||
        (l.email ?? '').toLowerCase().includes(q) ||
        (l.contactName ?? '').toLowerCase().includes(q) ||
        (l.city ?? '').toLowerCase().includes(q)
      );
    });
  }, [leads, recherche, voirPerdus]);

  const ouvert = leads?.find((l) => l.id === ouvertId) ?? null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Pipeline</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Vos prospects, du premier contact à l&apos;abonnement — glissez les cartes ou ouvrez la fiche.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Nom, e-mail, ville…"
              className="w-52 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 pl-8 pr-3 py-2 text-xs text-gray-900 dark:text-white"
            />
          </div>
          <button
            onClick={() => setVoirPerdus((v) => !v)}
            className={`px-3 py-2 rounded-xl text-xs font-medium border transition-colors ${
              voirPerdus
                ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-transparent'
                : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}
          >
            Perdus
          </button>
          <button
            onClick={() => setCreation(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700"
          >
            <Plus className="w-4 h-4" /> Prospect
          </button>
        </div>
      </div>

      {leads === null ? (
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 items-start">
          {GROUPES.map((groupe) => {
            const cartes = visibles.filter((l) => groupe.stages.includes(l.stage));
            return (
              <div
                key={groupe.label}
                className="rounded-2xl bg-gray-100/70 dark:bg-gray-900/60 border border-gray-200/60 dark:border-gray-800 flex flex-col min-h-[280px]"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  const id = e.dataTransfer.getData('text/lead');
                  if (id) void deplacer(id, groupe.entree);
                }}
              >
                <div className="px-3 pt-3 pb-2">
                  <div className="flex items-center justify-between">
                    <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-600 dark:text-gray-300">
                      <span className={`w-2 h-2 rounded-full ${groupe.accent}`} />
                      {groupe.label}
                      <button
                        onClick={() => setAideColonne(aideColonne === groupe.label ? null : groupe.label)}
                        title={groupe.aide}
                        aria-label={`Explication : ${groupe.label}`}
                        className={`p-0.5 rounded transition-colors ${
                          aideColonne === groupe.label
                            ? 'text-red-500'
                            : 'text-gray-300 dark:text-gray-600 hover:text-gray-500'
                        }`}
                      >
                        <Info className="w-3 h-3" />
                      </button>
                    </p>
                    <span className="min-w-[20px] text-center text-[11px] font-semibold tabular-nums text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 rounded-full px-1.5 py-0.5">
                      {cartes.length}
                    </span>
                  </div>
                  {aideColonne === groupe.label && (
                    <p className="mt-1.5 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 rounded-lg px-2.5 py-2">
                      {groupe.aide}
                    </p>
                  )}
                </div>
                <div className="flex-1 px-2 pb-2 space-y-2">
                  {cartes.length === 0 && (
                    <div className="h-full min-h-[200px] rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-800 flex items-center justify-center">
                      <p className="text-[11px] text-gray-300 dark:text-gray-600 text-center px-3">
                        Déposez une carte ici
                      </p>
                    </div>
                  )}
                  {cartes.map((l) => {
                    const ech = l.nextActionAt ? echeance(l.nextActionAt) : null;
                    return (
                      <button
                        key={l.id}
                        draggable
                        onDragStart={(e) => e.dataTransfer.setData('text/lead', l.id)}
                        onClick={() => setOuvertId(l.id)}
                        className="w-full text-left rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 px-3 py-2.5 shadow-sm hover:shadow-md hover:-translate-y-px transition-all cursor-grab active:cursor-grabbing"
                      >
                        <p className="text-[13px] font-semibold text-gray-900 dark:text-white truncate">
                          {l.businessName}
                        </p>
                        <p className="text-[11px] text-gray-400 truncate mt-0.5">
                          {[SECTOR_LABELS[l.sector], l.city].filter(Boolean).join(' · ')}
                        </p>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5">
                          {/* Sous-étape précise quand la colonne en regroupe plusieurs */}
                          {groupe.stages.length > 1 && (
                            <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 rounded-full px-1.5 py-0.5">
                              {STAGE_LABELS[l.stage]}
                            </span>
                          )}
                          {ech && (
                            <span
                              className={`inline-flex items-center gap-1 text-[10px] font-medium ${
                                ech.enRetard
                                  ? 'text-red-600 dark:text-red-400'
                                  : 'text-gray-500 dark:text-gray-400'
                              }`}
                            >
                              <CalendarClock className="w-3 h-3" />
                              {ech.enRetard ? 'à relancer' : ech.texte}
                            </span>
                          )}
                          {l.linkedProviderId && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                              <Check className="w-3 h-3" /> compte
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {creation && (
        <NouveauProspect
          onFerme={() => setCreation(false)}
          onCree={(lead) => {
            setLeads((prev) => (prev ? [lead, ...prev] : [lead]));
            setCreation(false);
            setOuvertId(lead.id);
          }}
        />
      )}

      {ouvert && (
        <FicheProspect
          lead={ouvert}
          demos={demos}
          onDemosChange={chargerDemos}
          onFerme={() => setOuvertId(null)}
          onPatch={patch}
          onSupprime={(id) => {
            setLeads((prev) => (prev ? prev.filter((l) => l.id !== id) : prev));
            setOuvertId(null);
          }}
        />
      )}
    </div>
  );
}

// ── Création rapide ─────────────────────────────────────────────────────────

function NouveauProspect({
  onFerme,
  onCree,
}: {
  onFerme: () => void;
  onCree: (lead: Lead) => void;
}) {
  const [form, setForm] = useState({
    businessName: '',
    contactName: '',
    email: '',
    phone: '',
    city: '',
    sector: 'coiffure' as Lead['sector'],
    source: null as string | null,
    currentPlatform: null as string | null,
  });
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const creer = async () => {
    setEnvoi(true);
    setErreur(null);
    try {
      const res = await fetch('/api/sales/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await enTetesStaff()) },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setErreur(data.error ?? 'Erreur serveur');
        return;
      }
      onCree(data.lead);
    } finally {
      setEnvoi(false);
    }
  };

  const champ = 'w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-sm text-gray-900 dark:text-white';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gray-950/60 backdrop-blur-sm" onClick={onFerme} />
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-gray-900 dark:text-white">Nouveau prospect</h2>
          <button onClick={onFerme} className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-3">
          <input
            autoFocus
            placeholder="Nom de l'établissement *"
            value={form.businessName}
            onChange={(e) => setForm({ ...form, businessName: e.target.value })}
            className={champ}
          />
          <div className="grid grid-cols-2 gap-3">
            <input placeholder="Contact" value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} className={champ} />
            <input placeholder="Téléphone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={champ} />
          </div>
          <input type="email" placeholder="E-mail" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={champ} />
          <div className="grid grid-cols-2 gap-3">
            <GoogleAddressAutocomplete
              value={form.city}
              onChange={(v) => setForm({ ...form, city: v })}
              onSelect={(sug: GoogleAddressSuggestion) =>
                setForm({ ...form, city: sug.locality ?? sug.formattedAddress ?? '' })
              }
              placeholder="Ville"
            />
            <select value={form.sector} onChange={(e) => setForm({ ...form, sector: e.target.value as Lead['sector'] })} className={champ}>
              {SALES_SECTORS.map((s) => (
                <option key={s} value={s}>{SECTOR_LABELS[s]}</option>
              ))}
            </select>
          </div>
          <div>
            <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1">Source du contact</p>
            <ChampAvecListe
              valeur={form.source}
              options={SOURCES_PROSPECTION.map((v) => [v, v] as [string, string])}
              onChange={(v) => setForm({ ...form, source: v })}
              placeholderAutre="D'où vient ce contact ?"
            />
          </div>
          <div>
            <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1">
              Plateforme actuelle <span className="font-normal text-gray-400">— son outil de RDV aujourd'hui</span>
            </p>
            <ChampAvecListe
              valeur={form.currentPlatform}
              options={SALES_PLATFORMS.map((v) => [v, PLATFORM_LABELS[v] ?? v] as [string, string])}
              onChange={(v) => setForm({ ...form, currentPlatform: v })}
              placeholderAutre="Nom de l'outil"
            />
          </div>
          {erreur && <p className="text-sm text-red-600">{erreur}</p>}
          <button
            onClick={creer}
            disabled={envoi || !form.businessName.trim()}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50"
          >
            {envoi ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Créer le prospect
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Fiche prospect ──────────────────────────────────────────────────────────

function FicheProspect({
  lead,
  demos,
  onDemosChange,
  onFerme,
  onPatch,
  onSupprime,
}: {
  lead: Lead;
  demos: DemoLiee[];
  onDemosChange: () => void;
  onFerme: () => void;
  onPatch: (id: string, champs: Record<string, unknown>) => Promise<Lead | null>;
  onSupprime: (id: string) => void;
}) {
  const [form, setForm] = useState(lead);
  const [enregistrement, setEnregistrement] = useState(false);
  const [enregistre, setEnregistre] = useState(false);
  const [liaisonEnCours, setLiaisonEnCours] = useState(false);
  const [liaisonErreur, setLiaisonErreur] = useState<string | null>(null);
  const [activites, setActivites] = useState<Activity[] | null>(null);
  const [noteType, setNoteType] = useState<'note' | 'appel' | 'email'>('note');
  const [noteTexte, setNoteTexte] = useState('');
  const [noteEnvoi, setNoteEnvoi] = useState(false);
  const [perte, setPerte] = useState(false);
  const chargeRef = useRef(JSON.stringify(lead));

  // Changement de prospect sélectionné → recharger la fiche.
  useEffect(() => {
    setForm(lead);
    chargeRef.current = JSON.stringify(lead);
    setActivites(null);
    void (async () => {
      try {
        const res = await fetch(`/api/sales/leads/activities?leadId=${lead.id}`, { headers: await enTetesStaff() });
        // Un échec s'affiche comme un état, jamais comme un chargement infini.
        setActivites(res.ok ? (await res.json()).activities : []);
      } catch {
        setActivites([]);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead.id]);

  // La colonne (drag) peut changer pendant que la fiche est ouverte.
  useEffect(() => {
    setForm((f) => ({ ...f, stage: lead.stage }));
  }, [lead.stage]);

  const modifie = JSON.stringify(form) !== chargeRef.current;

  const enregistrer = async () => {
    setEnregistrement(true);
    try {
      const maj = await onPatch(lead.id, {
        businessName: form.businessName,
        contactName: form.contactName,
        email: form.email,
        phone: form.phone,
        city: form.city,
        sector: form.sector,
        isTeam: form.isTeam,
        source: form.source,
        mainPain: form.mainPain,
        currentPlatform: form.currentPlatform,
        notes: form.notes,
        stage: form.stage,
        nextActionAt: form.nextActionAt,
        optOut: form.optOut,
      });
      if (maj) {
        // La référence devient l'état COURANT du formulaire : le bouton
        // disparaît immédiatement (plus rien à enregistrer), remplacé par
        // une confirmation brève.
        chargeRef.current = JSON.stringify(form);
        setEnregistre(true);
        setTimeout(() => setEnregistre(false), 2500);
      }
    } finally {
      setEnregistrement(false);
    }
  };

  const ajouterNote = async () => {
    if (!noteTexte.trim()) return;
    setNoteEnvoi(true);
    try {
      const res = await fetch('/api/sales/leads/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await enTetesStaff()) },
        body: JSON.stringify({ leadId: lead.id, type: noteType, body: noteTexte.trim() }),
      });
      if (res.ok) {
        setNoteTexte('');
        const rel = await fetch(`/api/sales/leads/activities?leadId=${lead.id}`, { headers: await enTetesStaff() });
        if (rel.ok) setActivites((await rel.json()).activities);
      }
    } finally {
      setNoteEnvoi(false);
    }
  };

  const marquerPerdu = async (motif: (typeof SALES_LOSS_REASONS)[number]) => {
    await onPatch(lead.id, { lostReason: motif });
    setPerte(false);
    onFerme();
  };

  const supprimer = async () => {
    if (!confirm('Supprimer ce prospect et tout son historique ?')) return;
    await fetch(`/api/sales/leads?id=${lead.id}`, { method: 'DELETE', headers: await enTetesStaff() });
    onSupprime(lead.id);
  };

  const champ = 'w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-sm text-gray-900 dark:text-white';
  const etiquette = 'block text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1';

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-gray-950/40 backdrop-blur-[2px]" onClick={onFerme} />
      <div className="relative w-full max-w-md h-full bg-white dark:bg-gray-900 shadow-2xl overflow-y-auto">
        {/* En-tête */}
        <div className="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 px-5 py-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-base font-bold text-gray-900 dark:text-white truncate flex items-center gap-2">
              <Building2 className="w-4 h-4 text-gray-400 flex-shrink-0" />
              {form.businessName || 'Prospect'}
            </p>
            {lead.lostReason && (
              <p className="text-[11px] text-red-500 mt-0.5">Perdu — {LOSS_LABELS[lead.lostReason]}</p>
            )}
          </div>
          <button onClick={onFerme} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-5">
          {/* Étape + prochaine action */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={etiquette}>Étape</label>
              <select
                value={form.stage}
                onChange={(e) => setForm({ ...form, stage: e.target.value as Lead['stage'] })}
                className={champ}
              >
                {COLONNES.map((s) => (
                  <option key={s} value={s}>{STAGE_LABELS[s]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={etiquette}>Prochain contact</label>
              <input
                type="date"
                value={form.nextActionAt ? form.nextActionAt.slice(0, 10) : ''}
                onChange={(e) =>
                  setForm({
                    ...form,
                    nextActionAt: e.target.value ? new Date(`${e.target.value}T09:00:00`).toISOString() : null,
                  })
                }
                className={champ}
              />
            </div>
          </div>

          {/* Coordonnées */}
          <div className="space-y-3">
            <div>
              <label className={etiquette}>Établissement</label>
              <input value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} className={champ} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={etiquette}>Contact</label>
                <input value={form.contactName ?? ''} onChange={(e) => setForm({ ...form, contactName: e.target.value || null })} className={champ} />
              </div>
              <div>
                <label className={etiquette}>Téléphone</label>
                <input value={form.phone ?? ''} onChange={(e) => setForm({ ...form, phone: e.target.value || null })} className={champ} />
              </div>
            </div>
            <div>
              <label className={etiquette}>E-mail</label>
              <input type="email" value={form.email ?? ''} onChange={(e) => setForm({ ...form, email: e.target.value || null })} className={champ} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={etiquette}>Ville</label>
                <GoogleAddressAutocomplete
                  value={form.city ?? ''}
                  onChange={(v) => setForm({ ...form, city: v || null })}
                  onSelect={(sug: GoogleAddressSuggestion) =>
                    setForm({ ...form, city: sug.locality ?? sug.formattedAddress ?? null })
                  }
                  placeholder="Rechercher une ville..."
                />
              </div>
              <div>
                <label className={etiquette}>Secteur</label>
                <select value={form.sector} onChange={(e) => setForm({ ...form, sector: e.target.value as Lead['sector'] })} className={champ}>
                  {SALES_SECTORS.map((s) => (
                    <option key={s} value={s}>{SECTOR_LABELS[s]}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className={etiquette}>Source du contact</label>
              <ChampAvecListe
                valeur={form.source}
                options={SOURCES_PROSPECTION.map((v) => [v, v] as [string, string])}
                onChange={(v) => setForm({ ...form, source: v })}
                placeholderAutre="D'où vient ce contact ?"
              />
            </div>
            <div>
              <label className={etiquette}>
                Plateforme actuelle <span className="font-normal text-gray-400">— son outil de RDV aujourd&apos;hui, pour cibler l&apos;argumentaire</span>
              </label>
              <ChampAvecListe
                valeur={form.currentPlatform}
                options={SALES_PLATFORMS.map((v) => [v, PLATFORM_LABELS[v] ?? v] as [string, string])}
                onChange={(v) => setForm({ ...form, currentPlatform: v })}
                placeholderAutre="Nom de l'outil"
              />
            </div>
            <div>
              <label className={etiquette}>Problème principal exprimé</label>
              <input
                value={form.mainPain ?? ''}
                onChange={(e) => setForm({ ...form, mainPain: e.target.value || null })}
                placeholder="No-shows, agenda au téléphone, visibilité…"
                className={champ}
              />
            </div>
            <div>
              <label className={etiquette}>Notes</label>
              <textarea
                value={form.notes ?? ''}
                onChange={(e) => setForm({ ...form, notes: e.target.value || null })}
                rows={3}
                className={champ}
              />
            </div>
            <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
              <input
                type="checkbox"
                checked={form.optOut}
                onChange={(e) => setForm({ ...form, optOut: e.target.checked })}
                className="rounded"
              />
              Opposition à la prospection — plus aucun contact sortant
            </label>
          </div>

          {modifie ? (
            <button
              onClick={enregistrer}
              disabled={enregistrement}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-60"
            >
              {enregistrement ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Enregistrer les modifications
            </button>
          ) : enregistre ? (
            <p className="w-full text-center text-sm font-medium text-emerald-600 dark:text-emerald-400 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/20">
              <Check className="w-4 h-4 inline mr-1.5 -mt-0.5" />
              Modifications enregistrées
            </p>
          ) : null}

          {/* Démos du prospect — liées, à relier, ou à créer */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
              Démonstrations
            </p>
            {(() => {
              const liees = demos.filter((d) => d.leadId === lead.id);
              // Seules les démos DU MÊME commercial sont proposables : le
              // serveur refuse les liaisons croisées (l'attribution de la
              // commission en dépend) — autant ne pas les offrir.
              const orphelines = demos.filter(
                (d) => !d.leadId && !d.expired && d.staffUid === lead.ownerUid,
              );
              return (
                <div className="space-y-2">
                  {liees.map((d) => (
                    <div
                      key={d.id}
                      className="flex items-center gap-2.5 rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2"
                    >
                      <Presentation className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <Link
                          href={`/sales/demo/${d.id}`}
                          className="text-xs font-semibold text-gray-900 dark:text-white truncate hover:underline block"
                        >
                          {d.businessName}
                        </Link>
                        <p className={`text-[10px] ${d.views > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400'}`}>
                          <Eye className="w-2.5 h-2.5 inline mr-0.5 -mt-0.5" />
                          {d.expired ? 'expirée' : d.views === 0 ? 'jamais ouverte' : `${d.views} vue${d.views > 1 ? 's' : ''}`}
                        </p>
                      </div>
                      <a href={d.url} target="_blank" rel="noreferrer" className="p-1 text-gray-400 hover:text-gray-600" title="Ouvrir la démo">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                      <button
                        disabled={liaisonEnCours}
                        onClick={async () => {
                          setLiaisonEnCours(true);
                          setLiaisonErreur(null);
                          try {
                            const res = await fetch('/api/sales/demos', {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json', ...(await enTetesStaff()) },
                              body: JSON.stringify({ id: d.id, leadId: null }),
                            });
                            if (!res.ok) {
                              setLiaisonErreur((await res.json()).error ?? 'Déliaison impossible');
                              return;
                            }
                            onDemosChange();
                          } finally {
                            setLiaisonEnCours(false);
                          }
                        }}
                        className="p-1 text-gray-300 hover:text-red-500 disabled:opacity-40"
                        title="Délier cette démo"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <Link
                      href={`/sales/demo?lead=${lead.id}`}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-xs font-semibold hover:opacity-90"
                    >
                      <Presentation className="w-3.5 h-3.5" /> Créer une démo
                    </Link>
                    {orphelines.length > 0 && (
                      <select
                        value=""
                        disabled={liaisonEnCours}
                        onChange={async (e) => {
                          const demoId = e.target.value;
                          if (!demoId) return;
                          setLiaisonEnCours(true);
                          setLiaisonErreur(null);
                          try {
                            const res = await fetch('/api/sales/demos', {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json', ...(await enTetesStaff()) },
                              body: JSON.stringify({ id: demoId, leadId: lead.id }),
                            });
                            if (!res.ok) {
                              setLiaisonErreur((await res.json()).error ?? 'Liaison impossible');
                              return;
                            }
                            onDemosChange();
                          } finally {
                            setLiaisonEnCours(false);
                          }
                        }}
                        className="flex-1 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 px-2 py-2 text-xs text-gray-600 dark:text-gray-300 disabled:opacity-50"
                        title="Relier une démo existante non rattachée"
                      >
                        <option value="">{liaisonEnCours ? 'Liaison en cours…' : 'Relier une démo…'}</option>
                        {orphelines.map((d) => (
                          <option key={d.id} value={d.id}>{d.businessName}</option>
                        ))}
                      </select>
                    )}
                  </div>
                  {liaisonEnCours && (
                    <p className="text-[11px] text-gray-400 flex items-center gap-1.5">
                      <Loader2 className="w-3 h-3 animate-spin" /> Liaison en cours…
                    </p>
                  )}
                  {liaisonErreur && (
                    <p className="text-[11px] text-red-600 dark:text-red-400">{liaisonErreur}</p>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Journal */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
              Historique
            </p>
            <div className="flex gap-2 mb-2">
              {(['note', 'appel', 'email'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setNoteType(t)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-medium ${
                    noteType === t
                      ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                  }`}
                >
                  {t === 'note' ? 'Note' : t === 'appel' ? 'Appel' : 'E-mail'}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={noteTexte}
                onChange={(e) => setNoteTexte(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void ajouterNote();
                }}
                placeholder={
                  noteType === 'appel'
                    ? 'Résumé de l’appel…'
                    : noteType === 'email'
                      ? 'E-mail envoyé / reçu…'
                      : 'Une note…'
                }
                className={champ}
              />
              <button
                onClick={ajouterNote}
                disabled={noteEnvoi || !noteTexte.trim()}
                className="px-3 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-xs font-semibold disabled:opacity-50"
              >
                {noteEnvoi ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'OK'}
              </button>
            </div>

            <div className="mt-3 space-y-2.5">
              {activites === null ? (
                <p className="text-xs text-gray-400">Chargement…</p>
              ) : activites.length === 0 ? (
                <p className="text-xs text-gray-400">Aucune interaction pour l&apos;instant.</p>
              ) : (
                activites.map((a) => {
                  const Icone = ICONES_ACTIVITE[a.type];
                  return (
                    <div key={a.id} className="flex items-start gap-2.5">
                      <span className="w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-800 inline-flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Icone className="w-3 h-3 text-gray-500 dark:text-gray-400" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs text-gray-700 dark:text-gray-300">
                          {a.type === 'changement_etape' && a.stage
                            ? `Étape : ${STAGE_LABELS[a.stage as keyof typeof STAGE_LABELS] ?? a.stage}`
                            : a.body}
                        </p>
                        {a.createdAt && <p className="text-[10px] text-gray-400">{depuis(a.createdAt)}</p>}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Issue du prospect — un geste VISIBLE, pas un lien gris à chercher */}
          <div className="border-t border-gray-100 dark:border-gray-800 pt-4 space-y-3">
            {lead.lostReason ? (
              <button
                onClick={() => onPatch(lead.id, { lostReason: null })}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-emerald-300 dark:border-emerald-700 text-sm font-semibold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
              >
                Réactiver ce prospect
              </button>
            ) : perte ? (
              <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-3">
                <p className="text-xs font-medium text-red-800 dark:text-red-300 mb-2">
                  Pourquoi ce prospect est-il perdu ?
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {SALES_LOSS_REASONS.map((m) => (
                    <button
                      key={m}
                      onClick={() => marquerPerdu(m)}
                      className="px-2.5 py-1.5 rounded-full text-[11px] font-medium bg-white dark:bg-gray-900 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 hover:bg-red-600 hover:text-white hover:border-red-600"
                    >
                      {LOSS_LABELS[m]}
                    </button>
                  ))}
                  <button onClick={() => setPerte(false)} className="px-2.5 py-1.5 text-[11px] text-gray-500 hover:underline">
                    Annuler
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setPerte(true)}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:border-red-300 hover:text-red-600 dark:hover:text-red-400 transition-colors"
              >
                <X className="w-4 h-4" /> Marquer comme perdu
              </button>
            )}
            <div className="text-center">
              <button onClick={supprimer} className="inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-red-600">
                <Trash2 className="w-3.5 h-3.5" /> Supprimer (efface aussi l&apos;historique)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
