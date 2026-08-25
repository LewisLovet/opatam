'use client';

import { useEffect, useState } from 'react';
import { Check, Clipboard, Clock, Loader2, Mail, Percent, Send, ShieldCheck, Ticket } from 'lucide-react';
import { SUBSCRIPTION_PLANS } from '@booking-app/shared';
import { enTetesStaff } from '@/app/sales/entetes';

interface OffreCatalogue {
  id: string;
  label: string;
  pitch: string;
  annuelSeulement: boolean;
  active: boolean;
}
interface CodeGenere {
  code: string;
  offerId: string;
  email: string | null;
  claimedByProviderId: string | null;
  createdAt: string | null;
  expiresAt: string | null;
  expired: boolean;
}

/**
 * Offres — ce que le commercial présente au prospect, tel qu'il peut le
 * montrer sur son écran ou son téléphone pendant l'entretien.
 *
 * Les chiffres viennent de SUBSCRIPTION_PLANS (la même source que la page
 * publique et le checkout) : un tarif qui change ne peut pas laisser cette
 * page mentir.
 *
 * Les offres ENCADRÉES : catalogue décidé par la direction (2026-08-26),
 * codes Stripe à usage unique valables 14 jours, génération libre mais
 * intégralement tracée. Le lien généré porte l'attribution signée ET le
 * code (pré-rempli côté abonnement après inscription).
 */

function euros(cents: number): string {
  return (cents / 100).toLocaleString('fr-FR', {
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

const ARGUMENTS = [
  {
    icone: Clock,
    titre: '30 jours gratuits',
    texte: 'Essai complet sans carte bancaire — le prospect ne risque rien.',
  },
  {
    icone: Percent,
    titre: '0 % de commission',
    texte: 'Un abonnement fixe, jamais un pourcentage sur les réservations.',
  },
  {
    icone: ShieldCheck,
    titre: 'Sans engagement',
    texte: 'Résiliable à tout moment — le prix affiché est le prix payé.',
  },
];

export default function OffresPage() {
  const solo = SUBSCRIPTION_PLANS.solo;
  const team = SUBSCRIPTION_PLANS.team;

  const [catalogue, setCatalogue] = useState<OffreCatalogue[] | null>(null);
  const [codes, setCodes] = useState<CodeGenere[]>([]);
  const [role, setRole] = useState<string | null>(null);
  const [ouverte, setOuverte] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [messagePerso, setMessagePerso] = useState('');
  const [generation, setGeneration] = useState(false);
  const [resultat, setResultat] = useState<{ code: string; url: string; emailEnvoye: boolean } | null>(null);
  const [copie, setCopie] = useState(false);

  const charger = async () => {
    const [res, moiRes] = await Promise.all([
      fetch('/api/sales/offres', { headers: await enTetesStaff() }),
      fetch('/api/sales/me', { headers: await enTetesStaff() }),
    ]);
    if (res.ok) {
      const d = await res.json();
      setCatalogue(d.catalogue);
      setCodes(d.codes);
    }
    if (moiRes.ok) setRole((await moiRes.json()).role);
  };
  useEffect(() => {
    void charger();
  }, []);

  const generer = async (offerId: string) => {
    setGeneration(true);
    setResultat(null);
    try {
      const res = await fetch('/api/sales/offres', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await enTetesStaff()) },
        body: JSON.stringify({
          offerId,
          email: email.trim() || undefined,
          message: messagePerso.trim() || undefined,
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        alert(d.error ?? 'Génération impossible');
        return;
      }
      setResultat(d);
      setEmail('');
      setMessagePerso('');
      void charger();
    } finally {
      setGeneration(false);
    }
  };

  const basculerOffre = async (o: OffreCatalogue) => {
    const desactivees = (catalogue ?? [])
      .filter((c) => (c.id === o.id ? o.active : !c.active))
      .map((c) => c.id);
    const res = await fetch('/api/sales/offres', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...(await enTetesStaff()) },
      body: JSON.stringify({ desactivees }),
    });
    if (!res.ok) alert(res.status === 403 ? 'Réservé aux administrateurs.' : 'Modification impossible');
    void charger();
  };

  const plans = [
    {
      nom: solo.name,
      pourQui: 'Indépendant·e — un agenda, un lieu',
      mensuel: solo.monthlyPrice,
      annuel: solo.yearlyPrice,
      features: solo.features,
      accent: false,
    },
    {
      nom: team.name,
      pourQui: 'Équipe — jusqu’à 10 agendas et 10 adresses',
      mensuel: team.baseMonthlyPrice,
      annuel: team.baseYearlyPrice,
      features: team.features,
      accent: true,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Offres</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Les tarifs à présenter au prospect — les mêmes chiffres que la page publique et le paiement.
        </p>
      </div>

      {/* Les trois arguments à poser AVANT le prix */}
      <div className="grid sm:grid-cols-3 gap-3">
        {ARGUMENTS.map(({ icone: Icone, titre, texte }) => (
          <div
            key={titre}
            className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4"
          >
            <span className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 inline-flex items-center justify-center">
              <Icone className="w-4 h-4" />
            </span>
            <p className="text-sm font-semibold text-gray-900 dark:text-white mt-2.5">{titre}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{texte}</p>
          </div>
        ))}
      </div>

      {/* Les deux plans */}
      <div className="grid lg:grid-cols-2 gap-4 max-w-4xl">
        {plans.map((p) => {
          const economie = p.mensuel * 12 - p.annuel;
          return (
            <div
              key={p.nom}
              className={`rounded-2xl border bg-white dark:bg-gray-900 overflow-hidden ${
                p.accent
                  ? 'border-red-300 dark:border-red-800 ring-1 ring-red-100 dark:ring-red-900/40'
                  : 'border-gray-200 dark:border-gray-800'
              }`}
            >
              <div className="px-6 pt-5 pb-4 border-b border-gray-100 dark:border-gray-800">
                <div className="flex items-baseline justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">{p.nom}</h2>
                    <p className="text-[11px] text-gray-400">{p.pourQui}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold tabular-nums text-gray-900 dark:text-white leading-none">
                      {euros(p.mensuel)}&nbsp;€
                      <span className="text-sm font-normal text-gray-400">/mois</span>
                    </p>
                    <p className="text-[11px] text-gray-400 mt-1">
                      ou {euros(p.annuel)} €/an
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                        {' '}
                        (−{euros(economie)} €)
                      </span>
                    </p>
                  </div>
                </div>
              </div>
              <ul className="px-6 py-4 space-y-2">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
                    <Check className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {/* Repères de conversation */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 max-w-4xl">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
          Repères pour l&apos;entretien
        </h2>
        <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
          <li className="flex items-start gap-2">
            <Check className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
            <span>
              <strong>Face à une plateforme à commission</strong> : à ~20 réservations par mois,
              une commission de 2 € dépasse déjà l&apos;abonnement Pro entier — et le fichier
              client reste la propriété du salon, pas de la marketplace.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <Check className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
            <span>
              <strong>Face au papier / DM Instagram</strong> : les rappels automatiques réduisent
              les lapins, et la page se remplit la nuit, quand le salon est fermé.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <Check className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
            <span>
              <strong>L&apos;annuel</strong> se propose après l&apos;adhésion au mensuel, jamais
              avant — deux mois offerts, même produit.
            </span>
          </li>
        </ul>
      </div>

      {/* ── Proposer une offre — codes uniques, 14 jours, tout est tracé ── */}
      <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden max-w-4xl">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2.5">
          <span className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 inline-flex items-center justify-center">
            <Ticket className="w-4 h-4" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Proposer une offre</h2>
            <p className="text-[11px] text-gray-400">
              Code à usage unique, valable 14 jours — envoyé par e-mail ou partagé en lien. Chaque
              code est tracé à votre nom.
            </p>
          </div>
        </div>
        <div className="p-4 grid sm:grid-cols-2 gap-3">
          {(catalogue ?? []).map((o) => (
            <div
              key={o.id}
              className={`rounded-xl border p-4 ${
                o.active
                  ? 'border-gray-200 dark:border-gray-700'
                  : 'border-gray-100 dark:border-gray-800 opacity-50'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {o.label}
                  {o.annuelSeulement && (
                    <span className="ml-1.5 text-[10px] font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 rounded-full px-1.5 py-0.5">
                      annuel
                    </span>
                  )}
                </p>
                {role === 'admin' && (
                  <button
                    onClick={() => basculerOffre(o)}
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      o.active
                        ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
                    }`}
                    title={o.active ? 'Désactiver cette offre' : 'Activer cette offre'}
                  >
                    {o.active ? 'Active' : 'Désactivée'}
                  </button>
                )}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{o.pitch}</p>
              {o.active && (
                <button
                  onClick={() => {
                    setOuverte(ouverte === o.id ? null : o.id);
                    setResultat(null);
                  }}
                  className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 dark:text-red-400 hover:underline"
                >
                  <Send className="w-3.5 h-3.5" /> Proposer cette offre
                </button>
              )}
              {ouverte === o.id && (
                <div className="mt-3 space-y-2 border-t border-gray-100 dark:border-gray-800 pt-3">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="E-mail du prospect (optionnel — sinon, lien à partager)"
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-xs text-gray-900 dark:text-white"
                  />
                  <textarea
                    value={messagePerso}
                    onChange={(e) => setMessagePerso(e.target.value.slice(0, 600))}
                    placeholder="Un mot personnel en tête d'e-mail (optionnel)"
                    rows={2}
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-xs text-gray-900 dark:text-gray-100"
                  />
                  <button
                    onClick={() => generer(o.id)}
                    disabled={generation}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 disabled:opacity-50"
                  >
                    {generation ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Ticket className="w-3.5 h-3.5" />}
                    {email.trim() ? 'Générer et envoyer' : 'Générer le code'}
                  </button>
                  {resultat && (
                    <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 px-3 py-2.5 text-xs text-emerald-800 dark:text-emerald-300">
                      <p>
                        Code <strong className="font-mono">{resultat.code}</strong>
                        {resultat.emailEnvoye ? ' — envoyé par e-mail ✓' : ''}
                      </p>
                      <button
                        onClick={async () => {
                          await navigator.clipboard.writeText(resultat.url);
                          setCopie(true);
                          setTimeout(() => setCopie(false), 2000);
                        }}
                        className="mt-1 inline-flex items-center gap-1 font-medium hover:underline"
                      >
                        <Clipboard className="w-3 h-3" /> {copie ? 'Lien copié !' : 'Copier le lien'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── Codes générés — la traçabilité ── */}
      {codes.length > 0 && (
        <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden max-w-4xl">
          <div className="px-5 py-3.5 border-b border-gray-100 dark:border-gray-800">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
              Codes générés <span className="text-gray-400 font-normal">· {codes.length}</span>
            </h2>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {codes.slice(0, 20).map((c) => (
              <div key={c.code} className="px-5 py-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                <span className="font-mono font-semibold text-gray-900 dark:text-white">{c.code}</span>
                <span className="text-gray-500 dark:text-gray-400">
                  {(catalogue ?? []).find((o) => o.id === c.offerId)?.label ?? c.offerId}
                </span>
                {c.email && (
                  <span className="text-gray-400 inline-flex items-center gap-1">
                    <Mail className="w-3 h-3" /> {c.email}
                  </span>
                )}
                <span className="ml-auto">
                  {c.claimedByProviderId ? (
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">compte créé ✓</span>
                  ) : c.expired ? (
                    <span className="text-gray-400">expiré</span>
                  ) : (
                    <span className="text-gray-500 dark:text-gray-400">
                      valable jusqu&apos;au {c.expiresAt ? new Date(c.expiresAt).toLocaleDateString('fr-FR') : '—'}
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
