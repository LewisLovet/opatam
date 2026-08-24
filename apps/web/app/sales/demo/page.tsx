'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getAuth } from 'firebase/auth';
import {
  Check,
  Clipboard,
  ExternalLink,
  Eye,
  Loader2,
  Mail,
  PartyPopper,
  Pencil,
  Wand2,
} from 'lucide-react';
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
  url: string;
  createdAt: string | null;
  expiresAt: string | null;
  expired: boolean;
  views: number;
  lastViewedAt: string | null;
  sentTo: string[];
  claimedProviderName: string | null;
  photos: { logo: string | null; cover: string | null };
}

async function jeton(): Promise<Record<string, string>> {
  const t = await getAuth().currentUser?.getIdToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

function depuis(iso: string): string {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (min < 60) return `il y a ${Math.max(1, min)} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const j = Math.round(h / 24);
  return j === 1 ? 'hier' : `il y a ${j} j`;
}

export default function SalesDemoPage() {
  const [colle, setColle] = useState('');
  const [erreurs, setErreurs] = useState<string[]>([]);
  const [apercu, setApercu] = useState<DemoConfig | null>(null);
  const [themeChoisi, setThemeChoisi] = useState('');
  const [creation, setCreation] = useState(false);
  const [creee, setCreee] = useState<{ id: string; url: string; expiresAt: string } | null>(null);
  const [demos, setDemos] = useState<DemoRow[] | null>(null);
  const [promptCopie, setPromptCopie] = useState(false);
  const [lienCopie, setLienCopie] = useState<string | null>(null);

  const charger = async () => {
    const res = await fetch('/api/sales/demos', { headers: await jeton() });
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
        headers: { 'Content-Type': 'application/json', ...(await jeton()) },
        body: JSON.stringify({ pasted: colle, themeId: themeChoisi || null }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErreurs(data.erreurs ?? [data.error ?? 'Erreur serveur']);
        return;
      }
      setCreee(data);
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
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Centre de démonstration</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Montrez au prospect SA page Opatam, avec ses prestations et ses prix — avant même
          qu&apos;il ait un compte.
        </p>
      </div>

      {/* ── Création ── */}
      <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Nouvelle démo</h2>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Le prompt + la photo de la carte dans votre IA, puis collez sa réponse ici.
            </p>
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

      {/* ── Mes démos ── */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">
          Vos démos
        </h2>
        {demos === null ? (
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
        ) : demos.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 rounded-2xl border border-dashed border-gray-200 dark:border-gray-800 p-6 text-center">
            Aucune démo pour l&apos;instant — collez votre première carte ci-dessus.
          </p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {demos.map((d) => (
              <div
                key={d.id}
                className={`group rounded-2xl border bg-white dark:bg-gray-900 overflow-hidden transition-shadow hover:shadow-md ${
                  d.expired
                    ? 'border-gray-200 dark:border-gray-800 opacity-70'
                    : 'border-gray-200 dark:border-gray-800'
                }`}
              >
                {/* Vignette : photo téléversée sinon un bandeau neutre */}
                <Link href={`/sales/demo/${d.id}`} className="block relative h-20 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900">
                  {d.photos.cover && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={d.photos.cover} alt="" className="absolute inset-0 w-full h-full object-cover" />
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
                  <Link
                    href={`/sales/demo/${d.id}`}
                    className="block text-sm font-semibold text-gray-900 dark:text-white truncate hover:underline"
                  >
                    {d.businessName}
                  </Link>
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
                    <Link
                      href={`/sales/demo/${d.id}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-[11px] font-semibold hover:opacity-90"
                    >
                      <Pencil className="w-3 h-3" /> Modifier
                    </Link>
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
        )}
      </section>
    </div>
  );
}
