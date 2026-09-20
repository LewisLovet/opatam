'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

export interface CibleHoraires {
  id: string;
  name: string;
  /** Ce que cette personne a AUJOURD'HUI, pour qu'on sache ce qu'on remplace. */
  resume: string | null;
}

interface Props {
  /** Nom de la personne dont on diffuse la semaine. */
  sourceNom: string;
  cibles: CibleHoraires[];
  /** Empêche la diffusion et dit pourquoi (modifications non enregistrées…). */
  raisonIndisponible?: string | null;
  enCours?: boolean;
  onCopier: (cibleIds: string[]) => void;
  /** `discret` s'intègre dans un encart existant ; `encadre` se pose seul. */
  apparence?: 'discret' | 'encadre';
}

/**
 * Recopier la semaine de quelqu'un sur ses collègues.
 *
 * Partagé par le panneau de l'onglet Équipe et par l'éditeur d'horaires :
 * la même manœuvre doit se présenter et se comporter pareil aux deux
 * endroits, sinon elle s'apprend deux fois.
 *
 * La confirmation et l'écriture sont à la charge de l'appelant : ce
 * composant ne fait que choisir les destinataires.
 */
export function CopierHorairesVers({
  sourceNom,
  cibles,
  raisonIndisponible = null,
  enCours = false,
  onCopier,
  apparence = 'discret',
}: Props) {
  const [ouvert, setOuvert] = useState(false);
  const [choisis, setChoisis] = useState<string[]>([]);

  if (cibles.length === 0) return null;

  const cadre =
    apparence === 'encadre'
      ? 'rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800'
      : 'border-t border-success-200 pt-2 dark:border-success-900';

  const fermer = () => {
    setOuvert(false);
    setChoisis([]);
  };

  if (!ouvert) {
    return (
      <div className={cadre}>
        <button
          type="button"
          disabled={!!raisonIndisponible}
          onClick={() => setOuvert(true)}
          className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:text-gray-200 dark:hover:bg-gray-900"
        >
          <Copy className="h-3.5 w-3.5" />
          Copier ces horaires vers d’autres prestataires
        </button>
        {raisonIndisponible && (
          <p className="mt-1 text-center text-[11px] text-gray-500 dark:text-gray-400">
            {raisonIndisponible}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={cadre}>
      <div className="space-y-2">
        <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">
          Copier la semaine de {sourceNom} vers&nbsp;:
        </p>
        <div className="max-h-40 space-y-1 overflow-y-auto">
          {cibles.map((c) => {
            const coche = choisis.includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() =>
                  setChoisis((prev) =>
                    prev.includes(c.id) ? prev.filter((id) => id !== c.id) : [...prev, c.id],
                  )
                }
                aria-pressed={coche}
                className={`flex w-full items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left transition-colors ${
                  coche
                    ? 'border-primary-300 bg-primary-50 dark:border-primary-700 dark:bg-primary-950/30'
                    : 'border-gray-200 bg-white hover:border-primary-200 dark:border-gray-700 dark:bg-gray-900'
                }`}
              >
                <span
                  className={`flex h-4 w-4 flex-none items-center justify-center rounded border ${
                    coche
                      ? 'border-primary-600 bg-primary-600 text-white'
                      : 'border-gray-300 dark:border-gray-600'
                  }`}
                >
                  {coche && <Check className="h-3 w-3" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium text-gray-900 dark:text-white">
                    {c.name}
                  </span>
                  <span className="block truncate text-[11px] text-gray-500 dark:text-gray-400">
                    {c.resume ? `remplace : ${c.resume}` : 'aucun horaire aujourd’hui'}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={fermer}
            className="flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-900"
          >
            Annuler
          </button>
          <button
            type="button"
            disabled={choisis.length === 0 || enCours}
            onClick={() => {
              onCopier(choisis);
              fermer();
            }}
            className="flex-1 rounded-lg bg-primary-600 px-2 py-1.5 text-xs font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
          >
            Copier vers {choisis.length || ''}
          </button>
        </div>
      </div>
    </div>
  );
}
