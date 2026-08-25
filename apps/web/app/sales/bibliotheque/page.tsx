'use client';

import { Suspense, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { BadgeCheck, BookOpen, Check, Loader2 } from 'lucide-react';
import { BATTLECARDS, AVANTAGES_OPATAM } from './battlecards';
import { CarteDetail } from './CarteDetail';

/**
 * Bibliothèque — les battlecards face à chaque concurrent.
 *
 * Règle éditoriale : reconnaître les forces du concurrent, ne dire que du
 * vérifié, afficher ce qu'il ne faut PAS dire. La fiche prospect ouvre
 * directement la bonne carte via ?carte=<id> (champ « Plateforme actuelle »).
 */

// ── La page ──────────────────────────────────────────────────────────────────

export default function BibliothequePageWrapper() {
  return (
    <Suspense fallback={<Loader2 className="w-5 h-5 animate-spin text-gray-400" />}>
      <BibliothequePage />
    </Suspense>
  );
}

function BibliothequePage() {
  const searchParams = useSearchParams();
  const [ouverte, setOuverte] = useState<string>(
    () => searchParams.get('carte') ?? BATTLECARDS[0].id,
  );
  const [avantagesOuverts, setAvantagesOuverts] = useState(false);

  const carte = useMemo(() => BATTLECARDS.find((c) => c.id === ouverte) ?? BATTLECARDS[0], [ouverte]);
  const parPriorite = (p: 1 | 2 | 3) => BATTLECARDS.filter((c) => c.priorite === p);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Bibliothèque</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-2xl">
          L&apos;argumentaire face à chaque concurrent — leurs vraies forces, nos avantages
          vérifiés, et ce qu&apos;il ne faut pas dire. La fiche d&apos;un prospect ouvre
          directement la bonne carte selon sa plateforme actuelle.
        </p>
      </div>

      {/* Le socle : les avantages toujours défendables */}
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <button
          onClick={() => setAvantagesOuverts((o) => !o)}
          className="w-full flex items-center justify-between px-5 py-3.5 text-left"
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
            <BadgeCheck className="w-4 h-4 text-emerald-500" />
            Les avantages Opatam défendables sans risque — tous vérifiés dans le produit
          </span>
          <span className="text-xs text-gray-400">{avantagesOuverts ? 'replier' : 'déplier'}</span>
        </button>
        {avantagesOuverts && (
          <ul className="px-5 pb-4 grid sm:grid-cols-2 gap-x-6 gap-y-1.5">
            {AVANTAGES_OPATAM.map((a) => (
              <li key={a} className="text-sm text-gray-600 dark:text-gray-300 flex items-start gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-500 mt-0.5 flex-shrink-0" />
                {a}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid lg:grid-cols-[240px_1fr] gap-5 items-start">
        {/* Navigation des cartes */}
        <nav className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 space-y-4 lg:sticky lg:top-6">
          {([1, 2, 3] as const).map((p) => (
            <div key={p}>
              <p className="px-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1">
                {p === 1 ? 'Priorité 1' : p === 2 ? 'Priorité 2' : 'Autres situations'}
              </p>
              {parPriorite(p).map((c) => (
                <button
                  key={c.id}
                  onClick={() => setOuverte(c.id)}
                  className={`w-full text-left px-2.5 py-2 rounded-xl text-sm transition-colors flex items-center gap-2 ${
                    ouverte === c.id
                      ? 'bg-red-600 text-white font-semibold'
                      : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  <BookOpen className={`w-3.5 h-3.5 ${ouverte === c.id ? '' : 'text-gray-300 dark:text-gray-600'}`} />
                  {c.nom}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <CarteDetail carte={carte} />
      </div>
    </div>
  );
}
