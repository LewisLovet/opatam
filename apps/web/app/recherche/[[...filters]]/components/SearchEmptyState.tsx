'use client';

interface SearchEmptyStateProps {
  query?: string;
  category?: string;
  city?: string;
  onClearFilters: () => void;
}

export function SearchEmptyState({
  query,
  category,
  city,
  onClearFilters,
}: SearchEmptyStateProps) {
  const hasFilters = query || category || city;

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      {/* Icon */}
      <div className="w-20 h-20 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-6">
        <svg
          className="w-10 h-10 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </div>

      {/* Message */}
      <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
        Aucun prestataire trouvé
      </h3>

      <p className="text-gray-500 dark:text-gray-400 max-w-md mb-6">
        {hasFilters ? (
          <>
            Nous n'avons trouvé aucun prestataire correspondant à vos critères
            {query && <span className="font-medium"> "{query}"</span>}
            {category && <span className="font-medium"> dans la catégorie sélectionnée</span>}
            {city && <span className="font-medium"> à {city}</span>}.
          </>
        ) : (
          "Il n'y a pas encore de prestataires disponibles. Revenez bientôt !"
        )}
      </p>

      {/* Actions */}
      {hasFilters && (
        <button
          onClick={onClearFilters}
          className="px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors"
        >
          Effacer les filtres
        </button>
      )}
    </div>
  );
}
