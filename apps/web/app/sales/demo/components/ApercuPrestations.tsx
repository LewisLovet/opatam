'use client';

import { Clock, Layers, Plus } from 'lucide-react';

/**
 * La carte du prospect, rendue comme un menu — pas comme un dump de JSON.
 *
 * Le même composant sert deux relectures : l'aperçu avant création (le
 * commercial vérifie le tri de l'IA) et la page d'édition d'une démo. Prix
 * en EUROS : c'est la forme `configEnEuros`, celle que l'humain relit.
 */

export interface ServiceEuros {
  name: string;
  description?: string;
  price?: number;
  duration?: number;
  variations?: { name: string; options: { name: string; price?: number; duration?: number }[] }[];
  options?: { name: string; price?: number; duration?: number }[];
}

export interface ConfigEurosDemo {
  businessName: string;
  description?: string;
  city?: string;
  sector?: string;
  themeId?: string;
  brandColor?: string;
  categories: { name: string; services: ServiceEuros[] }[];
}

function euros(n: number): string {
  return `${n.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} €`;
}

/** Prix affiché : le sien, sinon « à partir de » ses variations, sinon sur devis. */
function prixAffiche(s: ServiceEuros): { texte: string; partirDe: boolean } | null {
  if (typeof s.price === 'number') return { texte: euros(s.price), partirDe: (s.variations?.length ?? 0) > 0 };
  const choix = s.variations?.flatMap((v) => v.options.map((o) => o.price)).filter((p): p is number => typeof p === 'number') ?? [];
  if (choix.length) return { texte: euros(Math.min(...choix)), partirDe: true };
  return null;
}

export function ApercuPrestations({ config }: { config: ConfigEurosDemo }) {
  return (
    <div className="space-y-5">
      {config.categories.map((cat, ci) => (
        <div key={ci}>
          <div className="flex items-baseline gap-2 mb-2">
            <h4 className="text-[13px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              {cat.name}
            </h4>
            <span className="text-[11px] text-gray-400 dark:text-gray-500">
              {cat.services.length} prestation{cat.services.length > 1 ? 's' : ''}
            </span>
          </div>
          <div className="rounded-xl border border-gray-100 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800 overflow-hidden">
            {cat.services.map((svc, si) => {
              const prix = prixAffiche(svc);
              return (
                <div key={si} className="bg-white dark:bg-gray-900 px-4 py-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{svc.name}</p>
                      {svc.description ? (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{svc.description}</p>
                      ) : null}
                    </div>
                    <div className="text-right flex-shrink-0">
                      {prix ? (
                        <>
                          {prix.partirDe && (
                            <span className="block text-[10px] text-gray-400 leading-none">à partir de</span>
                          )}
                          <span className="text-sm font-semibold text-gray-900 dark:text-white tabular-nums">
                            {prix.texte}
                          </span>
                        </>
                      ) : (
                        <span className="inline-block text-[11px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 rounded-full">
                          sur devis — hors démo
                        </span>
                      )}
                      {typeof svc.duration === 'number' && (
                        <span className="flex items-center justify-end gap-1 text-[11px] text-gray-400 mt-0.5">
                          <Clock className="w-3 h-3" /> {svc.duration} min
                        </span>
                      )}
                    </div>
                  </div>

                  {(svc.variations?.length || svc.options?.length) ? (
                    <div className="mt-2 space-y-1.5">
                      {svc.variations?.map((v, vi) => (
                        <div key={`v${vi}`} className="flex flex-wrap items-center gap-1.5">
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-500 dark:text-gray-400">
                            <Layers className="w-3 h-3" /> {v.name} :
                          </span>
                          {v.options.map((o, oi) => (
                            <span
                              key={oi}
                              className="text-[11px] text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-full px-2 py-0.5"
                            >
                              {o.name}
                              {typeof o.price === 'number' ? ` · ${euros(o.price)}` : ''}
                            </span>
                          ))}
                        </div>
                      ))}
                      {svc.options?.map((o, oi) => (
                        <div key={`s${oi}`} className="flex items-center gap-1.5">
                          <span className="inline-flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400">
                            <Plus className="w-3 h-3" /> {o.name}
                          </span>
                          <span className="text-[11px] font-medium text-gray-600 dark:text-gray-300">
                            {typeof o.price === 'number' ? `+${euros(o.price)}` : ''}
                            {o.duration ? ` · +${o.duration} min` : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
