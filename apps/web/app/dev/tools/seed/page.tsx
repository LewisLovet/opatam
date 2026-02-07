'use client';

import { useEffect } from 'react';
import { useSeedData } from './_hooks/useSeedData';
import {
  SeedStats,
  LogsPanel,
  ActionButtons,
} from './_components';
import { AlertTriangle, Info } from 'lucide-react';

export default function TestSeedPage() {
  const {
    isCreating,
    isDeleting,
    logs,
    stats,
    existingTestProviders,
    providerCount,
    createTestData,
    deleteTestData,
    checkExistingTestData,
    setProviderCount,
    clearLogs,
  } = useSeedData();

  useEffect(() => {
    checkExistingTestData();
  }, [checkExistingTestData]);

  return (
    <div className="py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Generateur de donnees de test
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Generez des providers de test aleatoires avec leurs services, membres, locations et disponibilites.
            Chaque generation cree des donnees uniques et differentes.
          </p>
        </div>

        {/* Warning existing data */}
        {existingTestProviders.length > 0 && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-medium text-yellow-800 dark:text-yellow-200">
                  Donnees de test existantes
                </h3>
                <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                  {existingTestProviders.length} provider(s) de test trouve(s) dans la base.
                  Vous pouvez les supprimer avant d'en creer de nouveaux, ou generer des providers supplementaires.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <ActionButtons
          isCreating={isCreating}
          isDeleting={isDeleting}
          existingCount={existingTestProviders.length}
          providerCount={providerCount}
          onProviderCountChange={setProviderCount}
          onCreateClick={createTestData}
          onDeleteClick={deleteTestData}
        />

        {/* Stats */}
        <SeedStats stats={stats} />

        {/* Logs */}
        <LogsPanel logs={logs} onClear={clearLogs} />

        {/* Info box */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Info className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <h3 className="font-medium text-blue-800 dark:text-blue-200">
              A savoir
            </h3>
          </div>
          <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1 list-disc list-inside">
            <li>Chaque generation cree des providers <strong>uniques et aleatoires</strong> (noms, villes, services, images...)</li>
            <li>Les providers de test sont prefixes avec <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">test-seed-</code></li>
            <li>Les images proviennent de <strong>Unsplash</strong> et sont differentes a chaque generation</li>
            <li>Le champ <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">nextAvailableSlot</code> reste null - utilisez <strong>recalculateAllProviders</strong> pour le calculer</li>
            <li>Tous les providers sont crees avec <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">isPublished: true</code></li>
          </ul>
        </div>
      </div>
    </div>
  );
}
