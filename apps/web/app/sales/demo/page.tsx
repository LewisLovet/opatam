'use client';

import { useEffect, useState } from 'react';
import { getAuth } from 'firebase/auth';
import { Check, Clipboard, ExternalLink, Loader2, Trash2, Wand2 } from 'lucide-react';
import { DEMO_PROMPT, parseDemoConfig, type DemoConfig } from '@/lib/sales-demo';
import { themeDepuisCouleur, nomDuTheme } from '@/lib/sales-demo-theme';

interface DemoRow {
  id: string;
  businessName: string;
  url: string;
  createdAt: string | null;
  expiresAt: string | null;
  expired: boolean;
}

async function jeton(): Promise<Record<string, string>> {
  const t = await getAuth().currentUser?.getIdToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

/**
 * Centre de démonstration — créer la page d'un prospect à partir de sa carte.
 *
 * Parcours : copier le prompt → le coller dans SON IA avec la photo/PDF de la
 * carte → coller ici le JSON obtenu → validation en français → la démo est
 * créée, lien partageable 30 jours, vitrine + réservation testable.
 */
export default function SalesDemoPage() {
  const [colle, setColle] = useState('');
  const [erreurs, setErreurs] = useState<string[]>([]);
  const [apercu, setApercu] = useState<DemoConfig | null>(null);
  const [creation, setCreation] = useState(false);
  const [creee, setCreee] = useState<{ url: string; expiresAt: string } | null>(null);
  const [demos, setDemos] = useState<DemoRow[] | null>(null);
  const [promptCopie, setPromptCopie] = useState(false);
  const [lienCopie, setLienCopie] = useState<string | null>(null);

  const charger = async () => {
    const res = await fetch('/api/sales/demos', { headers: await jeton() });
    if (res.ok) setDemos((await res.json()).demos);
  };
  useEffect(() => { void charger(); }, []);

  // Validation LOCALE à la frappe — le serveur revalide, mais le commercial
  // voit ses erreurs sans aller-retour.
  useEffect(() => {
    if (!colle.trim()) { setErreurs([]); setApercu(null); return; }
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
        body: JSON.stringify({ pasted: colle }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErreurs(data.erreurs ?? [data.error ?? 'Erreur serveur']);
        return;
      }
      setCreee(data);
      setColle('');
      void charger();
    } finally {
      setCreation(false);
    }
  };

  const supprimer = async (id: string) => {
    await fetch(`/api/sales/demos?id=${id}`, { method: 'DELETE', headers: await jeton() });
    void charger();
  };

  const copierLien = async (url: string) => {
    await navigator.clipboard.writeText(url);
    setLienCopie(url);
    setTimeout(() => setLienCopie(null), 2000);
  };

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Centre de démonstration</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Montrez au prospect SA page Opatam, avec ses prestations et ses prix — avant même qu&apos;il ait un compte.
        </p>
      </div>

      {/* Étape 1 */}
      <section className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
          1. Copiez le prompt, donnez-le à votre IA avec la carte du prospect
        </h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-3">
          Photo, PDF ou visuel Canva de sa carte de prestations. ChatGPT, Claude ou Gemini — le prompt
          fonctionne partout et demande une réponse au format exact attendu ici.
        </p>
        <button
          onClick={copierPrompt}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-medium hover:opacity-90"
        >
          {promptCopie ? <Check className="w-4 h-4" /> : <Clipboard className="w-4 h-4" />}
          {promptCopie ? 'Copié !' : 'Copier le prompt'}
        </button>
      </section>

      {/* Étape 2 */}
      <section className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
          2. Collez la réponse de l&apos;IA
        </h2>
        <textarea
          value={colle}
          onChange={(e) => setColle(e.target.value)}
          placeholder='{ "businessName": "…", "categories": [ … ] }'
          rows={8}
          className="mt-3 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-950 p-3 font-mono text-xs text-gray-900 dark:text-gray-100"
        />
        {erreurs.length > 0 && (
          <ul className="mt-3 space-y-1 text-sm text-red-600 dark:text-red-400">
            {erreurs.map((e) => <li key={e}>• {e}</li>)}
          </ul>
        )}
        {apercu && (
          <div className="mt-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-emerald-800 dark:text-emerald-300">
                <Check className="w-4 h-4 inline mr-1" />
                <strong>{apercu.businessName}</strong>
                {apercu.city ? ` · ${apercu.city}` : ''}
                {apercu.sector ? ` · ${apercu.sector}` : ''}
                {' — '}
                {apercu.categories.reduce((n, c) => n + c.services.length, 0)} prestations
              </p>
              <button
                onClick={creer}
                disabled={creation}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-60"
              >
                {creation ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                Créer la démo
              </button>
            </div>
            {apercu.brandColor && (
              <p className="mt-1 flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400">
                <span
                  className="inline-block w-3 h-3 rounded-full border border-black/10"
                  style={{ backgroundColor: apercu.brandColor }}
                />
                Couleur relevée {apercu.brandColor} → thème «{' '}
                {nomDuTheme(themeDepuisCouleur(apercu.brandColor))} »
              </p>
            )}
            {/* Relisez AVANT de créer : cet arbre est exactement ce que
                l'IA a trié — une variation prise pour une prestation ou un
                supplément mal rangé se voit ici d'un coup d'œil. */}
            <div className="mt-3 space-y-3 border-t border-emerald-200 dark:border-emerald-800 pt-3">
              {apercu.categories.map((cat, ci) => (
                <div key={ci}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                    {cat.name}
                  </p>
                  <ul className="mt-1 space-y-1">
                    {cat.services.map((svc, si) => (
                      <li key={si} className="text-sm text-gray-800 dark:text-gray-200">
                        <span className="font-medium">{svc.name}</span>
                        <span className="text-gray-500 dark:text-gray-400">
                          {' '}— {(svc.price / 100).toLocaleString('fr-FR')} € · {svc.duration} min
                        </span>
                        {svc.variations?.map((v, vi) => (
                          <span key={vi} className="block pl-4 text-xs text-gray-600 dark:text-gray-400">
                            {v.name} :{' '}
                            {v.options
                              .map((o) => `${o.name} ${(o.price / 100).toLocaleString('fr-FR')} €`)
                              .join(' · ')}
                          </span>
                        ))}
                        {svc.options?.map((o, oi) => (
                          <span key={oi} className="block pl-4 text-xs text-gray-600 dark:text-gray-400">
                            + {o.name} : +{(o.price / 100).toLocaleString('fr-FR')} €
                            {o.duration ? ` (+${o.duration} min)` : ''}
                          </span>
                        ))}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-400">
              Relisez cet aperçu avant de créer : c&apos;est exactement ce que verra le prospect.
              Un supplément mal rangé ou une variation transformée en prestation se corrige en
              refaisant la demande à l&apos;IA.
            </p>
          </div>
        )}
        {creee && (
          <div className="mt-3 rounded-lg bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 px-4 py-3 text-sm">
            <p className="font-semibold text-gray-900 dark:text-white mb-1">Démo créée ✓</p>
            <div className="flex flex-wrap items-center gap-3">
              <a href={creee.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-red-600 dark:text-red-400 hover:underline">
                Ouvrir la page <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <button onClick={() => copierLien(creee.url)} className="inline-flex items-center gap-1 text-gray-600 dark:text-gray-300 hover:underline">
                <Clipboard className="w-3.5 h-3.5" /> {lienCopie === creee.url ? 'Lien copié !' : 'Copier le lien'}
              </button>
              <span className="text-xs text-gray-400">
                valable jusqu&apos;au {new Date(creee.expiresAt).toLocaleDateString('fr-FR')}
              </span>
            </div>
          </div>
        )}
      </section>

      {/* Mes démos */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">
          Vos démos
        </h2>
        {demos === null ? (
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
        ) : demos.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 rounded-xl border border-dashed border-gray-200 dark:border-gray-800 p-6 text-center">
            Aucune démo pour l&apos;instant.
          </p>
        ) : (
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
            {demos.map((d) => (
              <div key={d.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{d.businessName}</p>
                  <p className="text-xs text-gray-400">
                    {d.expired
                      ? 'expirée'
                      : d.expiresAt
                        ? `valable jusqu'au ${new Date(d.expiresAt).toLocaleDateString('fr-FR')}`
                        : ''}
                  </p>
                </div>
                {!d.expired && (
                  <>
                    <a href={d.url} target="_blank" rel="noreferrer" className="text-xs text-red-600 dark:text-red-400 hover:underline inline-flex items-center gap-1">
                      Ouvrir <ExternalLink className="w-3 h-3" />
                    </a>
                    <button onClick={() => copierLien(d.url)} className="text-xs text-gray-500 hover:underline">
                      {lienCopie === d.url ? 'Copié !' : 'Copier'}
                    </button>
                  </>
                )}
                <button onClick={() => supprimer(d.id)} title="Supprimer" className="text-gray-300 hover:text-red-500">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
