'use client';

import { Megaphone } from 'lucide-react';

interface AcquisitionData {
  channel: string;
  label: string;
  providers: number;
}

interface AcquisitionBreakdownTableProps {
  data: AcquisitionData[];
}

/**
 * D'où viennent les prestataires — réponses à « Comment avez-vous connu
 * Opatam ? » posée à l'inscription. Les comptes antérieurs à la question
 * apparaissent en « Non renseigné » : le pourcentage est calculé sur les
 * réponses renseignées, pour lire l'acquisition et non l'historique.
 */
export function AcquisitionBreakdownTable({ data }: AcquisitionBreakdownTableProps) {
  const renseignes = data.filter((d) => d.channel !== 'inconnu').reduce((s, d) => s + d.providers, 0);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
      <div className="flex items-center gap-2 mb-4">
        <Megaphone className="w-5 h-5 text-red-500" />
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          D&apos;où viennent les prestataires
        </h3>
      </div>

      {data.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
          Aucune donnée disponible
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                <th className="pb-3 font-medium">Source</th>
                <th className="pb-3 font-medium text-right">Prestataires</th>
                <th className="pb-3 font-medium text-right">% des réponses</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
              {data.map((src) => (
                <tr key={src.channel} className={src.channel === 'inconnu' ? 'text-gray-400' : ''}>
                  <td className="py-3 font-medium text-gray-900 dark:text-white">
                    {src.channel === 'inconnu' ? <span className="text-gray-400">{src.label}</span> : src.label}
                  </td>
                  <td className="py-3 text-right text-gray-600 dark:text-gray-300">{src.providers}</td>
                  <td className="py-3 text-right">
                    {src.channel === 'inconnu' ? (
                      <span className="text-xs text-gray-400">—</span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400">
                        {renseignes > 0 ? `${Math.round((src.providers / renseignes) * 100)}%` : '0%'}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
