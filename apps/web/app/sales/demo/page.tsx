'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Bot,
  Camera,
  Check,
  ClipboardPaste,
  Clipboard,
  ExternalLink,
  Eye,
  Loader2,
  Mail,
  PartyPopper,
  Pencil,
  Search,
  Wand2,
} from 'lucide-react';
import { enTetesStaff } from '@/app/sales/entetes';
import { DEMO_PROMPT, parseDemoConfig, configEnEuros, type DemoConfig } from '@/lib/sales-demo';
import { ApercuPrestations, type ConfigEurosDemo } from './components/ApercuPrestations';
import { ChoixTheme } from './components/ChoixTheme';

/**
 * Centre de démonstration — créer la page d'un prospect à partir de sa carte.
 *
 * Parcours : copier le prompt → le coller dans SON IA avec la photo/PDF de la
 * carte → coller ici le JSON obtenu → relire l'aperçu (c'est la vraie
 * garantie contre les erreurs de tri de l'IA) → créer. Tout le reste — photos,
 * couleur, identité, envoi — se retouche sur la fiche de la démo.
 */

interface DemoRow {
  id: string;
  businessName: string;
  estLaMienne: boolean;
  ownerNom: string | null;
  ownerInitiales: string | null;
  url: string;
  createdAt: string | null;
  expiresAt: string | null;
  expired: boolean;
  views: number;
  lastViewedAt: string | null;
  sentTo: string[];
  claimedProviderName: string | null;
  photos: { logo: string | null; cover: string | null };
  coverUrl: string | null;
}



function depuis(iso: string): string {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (min < 60) return `il y a ${Math.max(1, min)} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const j = Math.round(h / 24);
  return j === 1 ? 'hier' : `il y a ${j} j`;
}

export default function SalesDemoPageWrapper() {
  // useSearchParams exige une frontière Suspense au prérendu.
  return (
    <Suspense fallback={<Loader2 className="w-5 h-5 animate-spin text-gray-400" />}>
      <SalesDemoPage />
    </Suspense>
  );
}

function SalesDemoPage() {
  const [colle, setColle] = useState('');
  const [erreurs, setErreurs] = useState<string[]>([]);
  const [apercu, setApercu] = useState<DemoConfig | null>(null);
  const [themeChoisi, setThemeChoisi] = useState('');
  const [creation, setCreation] = useState(false);
  const [creee, setCreee] = useState<{ id: string; url: string; expiresAt: string } | null>(null);
  const [demos, setDemos] = useState<DemoRow[] | null>(null);
  const [promptCopie, setPromptCopie] = useState(false);
  const [lienCopie, setLienCopie] = useState<string | null>(null);
  const [recherche, setRecherche] = useState('');
  const [filtre, setFiltre] = useState<'toutes' | 'jamais' | 'vues' | 'converties' | 'expirees'>('toutes');
  // Arrivée depuis une fiche prospect (?lead=) : la démo créée lui sera reliée.
  const searchParams = useSearchParams();
  const leadCibleId = searchParams.get('lead');
  const [leadCibleNom, setLeadCibleNom] = useState<string | null>(null);
  useEffect(() => {
    if (!leadCibleId) return;
    void (async () => {
      const res = await fetch('/api/sales/leads', { headers: await enTetesStaff() });
      if (res.ok) {
        const { leads } = await res.json();
        setLeadCibleNom(leads.find((l: { id: string }) => l.id === leadCibleId)?.businessName ?? null);
      }
    })();
  }, [leadCibleId]);

  const charger = async () => {
    const res = await fetch('/api/sales/demos', { headers: await enTetesStaff() });
    if (res.ok) setDemos((await res.json()).demos);
  };
  useEffect(() => {
    void charger();
  }, []);

  // Validation LOCALE à la frappe — le serveur revalide, mais le commercial
  // voit ses erreurs sans aller-retour.
  useEffect(() => {
    if (!colle.trim()) {
      setErreurs([]);
      setApercu(null);
      return;
    }
    const r = parseDemoConfig(colle);
    if (r.ok) {
      setErreurs([]);
      setApercu(r.config);
    } else {
      setErreurs(r.erreurs);
      setApercu(null);
    }
  }, [colle]);

  const copierPrompt = async () => {
    await navigator.clipboard.writeText(DEMO_PROMPT);
    setPromptCopie(true);
    setTimeout(() => setPromptCopie(false), 2500);
  };

  const creer = async () => {
    setCreation(true);
    setCreee(null);
    try {
      const res = await fetch('/api/sales/demos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await enTetesStaff()) },
        body: JSON.stringify({
          pasted: colle,
          themeId: themeChoisi || null,
          ...(leadCibleId ? { leadId: leadCibleId } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErreurs(data.erreurs ?? [data.error ?? 'Erreur serveur']);
        return;
      }
      setCreee(data);
      if (data.liaisonErreur) {
        alert(`Démo créée, mais NON reliée au prospect : ${data.liaisonErreur}`);
      }
      setColle('');
      setThemeChoisi('');
      void charger();
    } finally {
      setCreation(false);
    }
  };

  const copierLien = async (url: string) => {
    await navigator.clipboard.writeText(url);
    setLienCopie(url);
    setTimeout(() => setLienCopie(null), 2000);
  };

  const apercuEuros = apercu ? (configEnEuros(apercu) as unknown as ConfigEurosDemo) : null;
  const nbPrestations = apercu
    ? apercu.categories.reduce((n, c) => n + c.services.length, 0)
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Centre de démonstration</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Montrez au prospect SA page Opatam, avec ses prestations et ses prix — avant même
          qu&apos;il ait un compte.
        </p>
      </div>

      <div className="grid xl:grid-cols-3 gap-5 items-start">
      {/* ── Mode d'emploi — l'onboarding tient sur la page, pas dans une formation ── */}
      <aside className="xl:order-2 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Comment ça marche</h2>
        {[
          {
            icone: Camera,
            titre: 'Photographiez sa carte de prestations',
            texte:
              'Menu papier, PDF, visuel Canva, story Instagram — tout ce qui montre ses prestations ET ses prix. Une photo nette où les prix se lisent.',
          },
          {
            icone: Bot,
            titre: 'Donnez la photo + le prompt à votre IA',
            texte:
              'Ouvrez ChatGPT, Claude ou Gemini. Copiez le prompt (bouton ci-contre), collez-le dans la conversation, JOIGNEZ la photo (le trombone), envoyez. L’IA répond par un bloc de texte qui commence par { et finit par }.',
          },
          {
            icone: ClipboardPaste,
            titre: 'Collez sa réponse complète ici',
            texte:
              'L’aperçu montre exactement ce que verra le prospect : vérifiez les prix, les variations, les suppléments. Une erreur ? Corrigez le JSON à la main ou redemandez à l’IA, puis recollez.',
          },
          {
            icone: Wand2,
            titre: 'Créez, puis personnalisez',
            texte:
              'La démo reçoit automatiquement les photos de son métier et sa couleur. Sur sa fiche, ajoutez son vrai logo et sa photo, ajustez, puis envoyez-lui le lien par e-mail.',
          },
        ].map(({ icone: Icone, titre, texte }, i) => (
          <div key={titre} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span className="w-7 h-7 rounded-full bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 inline-flex items-center justify-center text-[11px] font-bold flex-shrink-0">
                {i + 1}
              </span>
              {i < 3 && <span className="w-px flex-1 bg-gray-200 dark:bg-gray-800 mt-1" />}
            </div>
            <div className="pb-1">
              <p className="text-[13px] font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
                <Icone className="w-3.5 h-3.5 text-gray-400" /> {titre}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">{texte}</p>
            </div>
          </div>
        ))}
        <p className="text-[11px] text-gray-400 border-t border-gray-100 dark:border-gray-800 pt-3">
          Le prompt impose à l&apos;IA de n&apos;inventer ni prestation ni prix : tout vient du
          document. Les mentions « sur devis » sont acceptées et signalées.
        </p>
      </aside>

      <div className="xl:order-1 xl:col-span-2 space-y-5">
      {/* ── Création ── */}
      <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Nouvelle démo</h2>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Le prompt + la photo de la carte dans votre IA, puis collez sa réponse ici.
            </p>
            {leadCibleId && (
              <p className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/30 rounded-full px-2.5 py-1">
                Sera reliée au prospect {leadCibleNom ? `« ${leadCibleNom} »` : ''}
              </p>
            )}
          </div>
          <button
            onClick={copierPrompt}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            {promptCopie ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Clipboard className="w-3.5 h-3.5" />}
            {promptCopie ? 'Prompt copié' : 'Copier le prompt'}
          </button>
        </div>

        <div className="px-5 py-4">
          <textarea
            value={colle}
            onChange={(e) => setColle(e.target.value)}
            placeholder='Collez la réponse de l&apos;IA — { "businessName": "…", "categories": [ … ] }'
            rows={colle.trim() ? 5 : 3}
            className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 p-3 font-mono text-xs text-gray-900 dark:text-gray-100"
          />

          {erreurs.length > 0 && (
            <ul className="mt-3 space-y-1 text-sm text-red-600 dark:text-red-400">
              {erreurs.map((e) => (
                <li key={e}>• {e}</li>
              ))}
            </ul>
          )}

          {apercuEuros && (
            <div className="mt-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                    {apercuEuros.businessName}
                    {apercuEuros.city ? (
                      <span className="font-normal text-gray-400"> · {apercuEuros.city}</span>
                    ) : null}
                  </p>
                  <p className="text-[11px] text-gray-400">
                    {nbPrestations} prestations reconnues — relisez avant de créer : c&apos;est
                    exactement ce que verra le prospect.
                  </p>
                </div>
                <button
                  onClick={creer}
                  disabled={creation}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-60"
                >
                  {creation ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                  Créer la démo
                </button>
              </div>

              <ChoixTheme valeur={themeChoisi} brandColor={apercuEuros.brandColor} onChange={setThemeChoisi} />

              <div className="rounded-xl bg-gray-50 dark:bg-gray-950/60 border border-gray-100 dark:border-gray-800 p-4">
                <ApercuPrestations config={apercuEuros} />
              </div>
            </div>
          )}

          {creee && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 px-4 py-3">
              <p className="text-sm text-emerald-800 dark:text-emerald-300">
                <Check className="w-4 h-4 inline mr-1" />
                Démo créée — valable jusqu&apos;au{' '}
                {new Date(creee.expiresAt).toLocaleDateString('fr-FR')}.
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => copierLien(creee.url)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-300 dark:border-emerald-700 text-xs font-medium text-emerald-800 dark:text-emerald-300"
                >
                  {lienCopie === creee.url ? 'Copié !' : 'Copier le lien'}
                </button>
                <Link
                  href={`/sales/demo/${creee.id}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700"
                >
                  <Pencil className="w-3 h-3" /> Personnaliser
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>
      </div>
      </div>

      {/* ── Mes démos ── */}
      <section>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Les démos — les vôtres et celles de l&apos;équipe
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative h-8">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
                placeholder="Nom ou e-mail du prospect…"
                className="w-56 h-8 rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 pl-8 pr-3 text-xs text-gray-900 dark:text-white"
              />
            </div>
            {(
              [
                ['toutes', 'Toutes'],
                ['jamais', 'Jamais ouvertes'],
                ['vues', 'Vues'],
                ['converties', 'Converties'],
                ['expirees', 'Expirées'],
              ] as const
            ).map(([v, l]) => (
              <button
                key={v}
                onClick={() => setFiltre(v)}
                className={`h-8 px-3 rounded-full text-[11px] font-medium transition-colors ${
                  filtre === v
                    ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
        {demos === null ? (
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
        ) : demos.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 rounded-2xl border border-dashed border-gray-200 dark:border-gray-800 p-6 text-center">
            Aucune démo pour l&apos;instant — collez votre première carte ci-dessus.
          </p>
        ) : (() => {
          const q = recherche.trim().toLowerCase();
          const visibles = demos.filter((d) => {
            if (filtre === 'jamais' && (d.views > 0 || d.expired)) return false;
            if (filtre === 'vues' && d.views === 0) return false;
            if (filtre === 'converties' && !d.claimedProviderName) return false;
            if (filtre === 'expirees' && !d.expired) return false;
            if (filtre === 'toutes' || filtre === 'vues' || filtre === 'converties') {
              // les expirées restent visibles partout sauf « jamais ouvertes »
            }
            if (!q) return true;
            return (
              d.businessName.toLowerCase().includes(q) ||
              d.sentTo.some((e) => e.toLowerCase().includes(q)) ||
              (d.claimedProviderName ?? '').toLowerCase().includes(q)
            );
          });
          if (visibles.length === 0) {
            return (
              <p className="text-sm text-gray-500 dark:text-gray-400 rounded-2xl border border-dashed border-gray-200 dark:border-gray-800 p-6 text-center">
                Aucune démo ne correspond{q ? ` à « ${recherche.trim()} »` : ' à ce filtre'}.
              </p>
            );
          }
          return (
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
            {visibles.map((d) => (
              <div
                key={d.id}
                className={`group rounded-2xl border bg-white dark:bg-gray-900 overflow-hidden transition-shadow hover:shadow-md ${
                  d.expired
                    ? 'border-gray-200 dark:border-gray-800 opacity-70'
                    : 'border-gray-200 dark:border-gray-800'
                }`}
              >
                {/* Vignette : photo téléversée sinon un bandeau neutre */}
                <Link
                  href={d.estLaMienne ? `/sales/demo/${d.id}` : d.url}
                  target={d.estLaMienne ? undefined : '_blank'}
                  className="block relative h-20 bg-gray-100 dark:bg-gray-800"
                >
                  {d.coverUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={d.coverUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
                  )}
                  {d.photos.logo && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={d.photos.logo}
                      alt=""
                      className="absolute left-4 -bottom-4 w-10 h-10 rounded-full border-2 border-white dark:border-gray-900 object-cover"
                    />
                  )}
                  {d.claimedProviderName && (
                    <span className="absolute top-2 right-2 inline-flex items-center gap-1 text-[10px] font-semibold text-white bg-emerald-600 px-2 py-0.5 rounded-full">
                      <PartyPopper className="w-3 h-3" /> Compte créé
                    </span>
                  )}
                  {d.expired && (
                    <span className="absolute top-2 left-2 text-[10px] font-semibold text-white bg-gray-500 px-2 py-0.5 rounded-full">
                      Expirée
                    </span>
                  )}
                </Link>

                <div className={`px-4 pb-3 ${d.photos.logo ? 'pt-6' : 'pt-3'}`}>
                  <div className="flex items-center justify-between gap-1.5">
                    {d.estLaMienne ? (
                      <Link
                        href={`/sales/demo/${d.id}`}
                        className="block text-sm font-semibold text-gray-900 dark:text-white truncate hover:underline"
                      >
                        {d.businessName}
                      </Link>
                    ) : (
                      <span className="block text-sm font-semibold text-gray-900 dark:text-white truncate">
                        {d.businessName}
                      </span>
                    )}
                    {!d.estLaMienne && d.ownerInitiales && (
                      <span
                        className="flex-shrink-0 w-5 h-5 rounded-full bg-gray-900 dark:bg-white text-[9px] font-bold text-white dark:text-gray-900 inline-flex items-center justify-center"
                        title={`Démo de ${d.ownerNom ?? 'un autre commercial'}`}
                      >
                        {d.ownerInitiales}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-[11px] text-gray-400">
                    <span
                      className={`inline-flex items-center gap-1 ${
                        d.views > 0 ? 'text-emerald-600 dark:text-emerald-400 font-medium' : ''
                      }`}
                    >
                      <Eye className="w-3 h-3" />
                      {d.views === 0
                        ? 'jamais ouverte'
                        : `${d.views} vue${d.views > 1 ? 's' : ''}${d.lastViewedAt ? ` · ${depuis(d.lastViewedAt)}` : ''}`}
                    </span>
                    {d.sentTo.length > 0 && (
                      <span className="inline-flex items-center gap-1 truncate">
                        <Mail className="w-3 h-3" /> {d.sentTo[d.sentTo.length - 1]}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 mt-3">
                    {d.estLaMienne && (
                      <Link
                        href={`/sales/demo/${d.id}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-[11px] font-semibold hover:opacity-90"
                      >
                        <Pencil className="w-3 h-3" /> Modifier
                      </Link>
                    )}
                    <a
                      href={d.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-[11px] font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                      <ExternalLink className="w-3 h-3" /> Ouvrir
                    </a>
                    <button
                      onClick={() => copierLien(d.url)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-[11px] font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                      {lienCopie === d.url ? <Check className="w-3 h-3 text-emerald-600" /> : <Clipboard className="w-3 h-3" />}
                      {lienCopie === d.url ? 'Copié' : 'Lien'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          );
        })()}
      </section>
    </div>
  );
}
