'use client';

/**
 * /dev/tools/storage — local-storage inspector for `@opatam/*` keys.
 *
 * Lets a dev see exactly what we've persisted in the browser
 * (discovery flags, "Nouveau" pills, anything we may add later)
 * and purge entries individually or in bulk WITHOUT touching keys
 * owned by other libs (theme picker, register form, Stripe presets,
 * etc.).
 *
 * Scoped on the `@opatam/` prefix as a safety guard: clicking
 * "Tout purger" wipes only what we own. Other keys present in
 * localStorage are listed for context but never touched.
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Database,
  RefreshCw,
  Sparkles,
  Trash2,
} from 'lucide-react';

const OPATAM_PREFIX = '@opatam/';

interface Entry {
  key: string;
  value: string;
  ours: boolean;
}

/**
 * Read every localStorage entry, split into "ours" (`@opatam/`)
 * and "other" so the UI can warn-then-protect for the second group.
 */
function readAll(): Entry[] {
  if (typeof window === 'undefined') return [];
  const out: Entry[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (!key) continue;
    const value = window.localStorage.getItem(key) ?? '';
    out.push({
      key,
      value,
      ours: key.startsWith(OPATAM_PREFIX),
    });
  }
  return out.sort((a, b) => {
    if (a.ours !== b.ours) return a.ours ? -1 : 1;
    return a.key.localeCompare(b.key);
  });
}

/** Pretty-print JSON values; fall back to the raw string. */
function previewValue(raw: string): string {
  if (!raw) return '';
  try {
    const parsed = JSON.parse(raw);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return raw;
  }
}

export default function StorageDevToolPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setEntries(readAll());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const removeKey = (key: string) => {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(key);
    refresh();
  };

  const wipeOurs = () => {
    if (typeof window === 'undefined') return;
    if (
      !window.confirm(
        'Supprimer toutes les clés @opatam/* ? Cette action ne touche pas votre thème, votre formulaire d\'inscription en cours, ni les presets Stripe.',
      )
    ) {
      return;
    }
    const keys = Object.keys(window.localStorage).filter((k) =>
      k.startsWith(OPATAM_PREFIX),
    );
    for (const k of keys) window.localStorage.removeItem(k);
    refresh();
  };

  const ours = entries.filter((e) => e.ours);
  const others = entries.filter((e) => !e.ours);

  return (
    <div className="p-6 lg:p-8 bg-slate-950 min-h-screen text-white">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Back link + title */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <Link
            href="/dev"
            className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4" /> Retour au Dev Hub
          </Link>
          <button
            type="button"
            onClick={refresh}
            className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white"
          >
            <RefreshCw className="w-4 h-4" /> Recharger
          </button>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-2">
            <Database className="w-5 h-5 text-purple-400" />
            <span className="text-sm font-medium text-purple-400/80">
              Local Storage Inspector
            </span>
          </div>
          <h1 className="text-3xl font-bold">Stockage local — clés Opatam</h1>
          <p className="text-slate-400 mt-2 text-sm">
            Toutes nos clés sont préfixées <code className="text-purple-300">@opatam/</code>.
            La purge est volontairement scopée — votre thème, votre
            inscription en cours et les presets Stripe ne seront pas
            touchés.
          </p>
        </div>

        {/* @opatam/* section */}
        <section className="rounded-xl bg-slate-900 border border-slate-800 p-5 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <h2 className="text-lg font-semibold">
                Clés @opatam/* ({ours.length})
              </h2>
            </div>
            {ours.length > 0 && (
              <button
                type="button"
                onClick={wipeOurs}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-medium"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Tout purger
              </button>
            )}
          </div>

          {ours.length === 0 ? (
            <p className="text-sm text-slate-500 italic">
              Aucune clé @opatam/* — l'app n'a encore rien persisté
              sur ce navigateur.
            </p>
          ) : (
            <ul className="divide-y divide-slate-800">
              {ours.map((entry) => (
                <li key={entry.key} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        setExpanded((e) => (e === entry.key ? null : entry.key))
                      }
                      className="text-left flex-1 min-w-0"
                    >
                      <code className="text-sm text-purple-300 break-all">
                        {entry.key}
                      </code>
                    </button>
                    <button
                      type="button"
                      onClick={() => removeKey(entry.key)}
                      className="p-1.5 rounded-md text-slate-400 hover:text-red-400 hover:bg-red-500/10 flex-shrink-0"
                      aria-label={`Supprimer ${entry.key}`}
                      title="Supprimer cette clé"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  {expanded === entry.key && (
                    <pre className="mt-2 px-3 py-2 rounded-md bg-slate-950 border border-slate-800 text-xs text-slate-300 overflow-x-auto whitespace-pre-wrap break-all">
                      {previewValue(entry.value)}
                    </pre>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Other keys — read-only context */}
        <section className="rounded-xl bg-slate-900/50 border border-slate-800/50 p-5 space-y-3">
          <h2 className="text-sm font-semibold text-slate-400">
            Autres clés ({others.length}) — non touchées par la purge
          </h2>
          {others.length === 0 ? (
            <p className="text-xs text-slate-500 italic">
              Aucune autre clé en localStorage.
            </p>
          ) : (
            <ul className="space-y-1">
              {others.map((entry) => (
                <li key={entry.key}>
                  <code className="text-xs text-slate-500 break-all">
                    {entry.key}
                  </code>
                </li>
              ))}
            </ul>
          )}
          <p className="text-[11px] text-slate-600 mt-2">
            Ces clés appartiennent au thème, au formulaire
            d'inscription, à des presets Stripe, etc. — la purge
            scopée les ignore par design.
          </p>
        </section>
      </div>
    </div>
  );
}
