'use client';

import { Plus, Trash2, Loader2 } from 'lucide-react';

interface ActionButtonsProps {
  isCreating: boolean;
  isDeleting: boolean;
  existingCount: number;
  providerCount: number;
  onProviderCountChange: (count: number) => void;
  onCreateClick: () => void;
  onDeleteClick: () => void;
}

const COUNT_OPTIONS = [5, 10, 15, 20, 30];

export function ActionButtons({
  isCreating,
  isDeleting,
  existingCount,
  providerCount,
  onProviderCountChange,
  onCreateClick,
  onDeleteClick,
}: ActionButtonsProps) {
  const isLoading = isCreating || isDeleting;

  return (
    <div className="space-y-4">
      {/* Sélecteur de nombre */}
      <div className="flex items-center gap-4">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Nombre de providers à générer :
        </label>
        <div className="flex gap-2">
          {COUNT_OPTIONS.map((count) => (
            <button
              key={count}
              onClick={() => onProviderCountChange(count)}
              disabled={isLoading}
              className={`
                px-4 py-2 rounded-lg text-sm font-medium transition-all
                ${providerCount === count
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }
                ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              {count}
            </button>
          ))}
        </div>
      </div>

      {/* Boutons d'action */}
      <div className="flex flex-wrap gap-4">
        {/* Bouton créer */}
        <button
          onClick={onCreateClick}
          disabled={isLoading}
          className={`
            flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all
            ${isLoading
              ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
              : 'bg-green-600 hover:bg-green-700 text-white shadow-md hover:shadow-lg'
            }
          `}
        >
          {isCreating ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Création en cours...
            </>
          ) : (
            <>
              <Plus className="w-5 h-5" />
              Générer {providerCount} providers
            </>
          )}
        </button>

        {/* Bouton supprimer */}
        <button
          onClick={onDeleteClick}
          disabled={isLoading || existingCount === 0}
          className={`
            flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all
            ${isLoading || existingCount === 0
              ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
              : 'bg-red-600 hover:bg-red-700 text-white shadow-md hover:shadow-lg'
            }
          `}
        >
          {isDeleting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Suppression en cours...
            </>
          ) : (
            <>
              <Trash2 className="w-5 h-5" />
              Supprimer les données de test
              {existingCount > 0 && (
                <span className="bg-red-500 px-2 py-0.5 rounded-full text-xs">
                  {existingCount}
                </span>
              )}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
