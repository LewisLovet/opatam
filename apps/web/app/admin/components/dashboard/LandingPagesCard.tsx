'use client';

import { ExternalLink, Globe } from 'lucide-react';
import type { AdminOverview } from '@/services/admin/types';
import { DeltaPill, Panel, PanelTitle, nombre } from './primitives';

/**
 * Les vues de chaque page d'accueil sur 30 jours : la principale, puis les
 * pages métier du registre — une nouvelle page y apparaît d'elle-même.
 * Visites anonymes, sans cookie : des tendances, pas des visiteurs uniques.
 */
export function LandingPagesCard({ pages }: { pages: AdminOverview['landingPages'] }) {
  const max = Math.max(1, ...pages.map((p) => p.views30));
  const total = pages.reduce((s, p) => s + p.views30, 0);
  return (
    <Panel>
      <PanelTitle
        icon={<Globe className="h-4 w-4" />}
        accent="red"
        title="Pages d'accueil · 30 j"
        right={<span className="text-sm font-bold text-gray-900 dark:text-white">{nombre(total)}</span>}
      />
      <ul className="space-y-1 px-3 pb-3">
        {pages.map((p) => (
          <li key={p.key} className="rounded-xl px-2 py-2">
            <div className="flex items-baseline justify-between gap-2">
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="truncate text-sm font-semibold text-gray-900 dark:text-white">{p.label}</span>
                <a
                  href={`https://opatam.com${p.path}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-shrink-0 text-gray-300 hover:text-red-500 dark:text-gray-600"
                  aria-label={`Ouvrir ${p.path}`}
                >
                  <ExternalLink className="h-3 w-3" />
                </a>
                {p.draft && (
                  <span className="flex-shrink-0 rounded-full bg-gray-100 dark:bg-gray-700 px-1.5 py-px text-[10px] text-gray-500 dark:text-gray-400">
                    brouillon
                  </span>
                )}
              </span>
              <span className="flex-shrink-0 text-sm font-bold text-gray-900 dark:text-white">{nombre(p.views30)}</span>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
                <span
                  className="block h-full rounded-full bg-red-500"
                  style={{ width: `${Math.round((p.views30 / max) * 100)}%` }}
                />
              </span>
              <span className="w-40 flex-shrink-0 text-right">
                {p.views30 + p.previous === 0 ? (
                  <span className="text-[11px] text-gray-400">pas encore de visite</span>
                ) : (
                  <DeltaPill value={p.views30} previous={p.previous} suffix="" />
                )}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
