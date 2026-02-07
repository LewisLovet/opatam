import Link from 'next/link';
import { SearchX } from 'lucide-react';

export default function ProviderNotFound() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="mb-6">
          <SearchX className="w-16 h-16 mx-auto text-gray-400 dark:text-gray-500" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Prestataire introuvable
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          Ce prestataire n&apos;existe pas ou n&apos;est plus disponible.
          Il a peut-être désactivé sa page ou changé d&apos;adresse.
        </p>
        <Link
          href="/"
          className="inline-flex items-center justify-center px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors"
        >
          Retour à l&apos;accueil
        </Link>
      </div>
    </div>
  );
}
