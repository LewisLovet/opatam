'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button, Badge } from '@/components/ui';
import { providerService } from '@booking-app/firebase';
import {
  Loader2,
  Globe,
  GlobeLock,
  CheckCircle,
  XCircle,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';

interface PublicationSectionProps {
  onSuccess?: () => void;
}

interface RequirementCheck {
  canPublish: boolean;
  missingItems: string[];
  completeness: {
    hasBusinessName: boolean;
    hasCategory: boolean;
    hasLocation: boolean;
    hasService: boolean;
    hasAvailability: boolean;
  };
}

export function PublicationSection({ onSuccess }: PublicationSectionProps) {
  const { provider, refreshProvider } = useAuth();
  const [loading, setLoading] = useState(false);
  const [checkingRequirements, setCheckingRequirements] = useState(true);
  const [requirements, setRequirements] = useState<RequirementCheck | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Check requirements on mount and when provider changes
  useEffect(() => {
    if (provider) {
      checkRequirements();
    }
  }, [provider?.id]);

  const checkRequirements = async () => {
    if (!provider) return;

    setCheckingRequirements(true);
    try {
      const result = await providerService.checkPublishRequirements(provider.id);
      setRequirements(result);
    } catch (err) {
      console.error('Check requirements error:', err);
    } finally {
      setCheckingRequirements(false);
    }
  };

  const handlePublish = async () => {
    if (!provider) return;

    setLoading(true);
    setError(null);

    try {
      const result = await providerService.publishProvider(provider.id);

      if (!result.canPublish) {
        setRequirements(result);
        setError('Veuillez completer tous les elements requis avant de publier');
        return;
      }

      await refreshProvider();
      onSuccess?.();
    } catch (err) {
      console.error('Publish error:', err);
      setError(err instanceof Error ? err.message : 'Erreur lors de la publication');
    } finally {
      setLoading(false);
    }
  };

  const handleUnpublish = async () => {
    if (!provider) return;

    setLoading(true);
    setError(null);

    try {
      await providerService.unpublishProvider(provider.id);
      await refreshProvider();
      onSuccess?.();
    } catch (err) {
      console.error('Unpublish error:', err);
      setError(err instanceof Error ? err.message : 'Erreur lors de la depublication');
    } finally {
      setLoading(false);
    }
  };

  const publicUrl = provider?.slug
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/${provider.slug}`
    : null;

  const requirementItems = [
    { key: 'hasBusinessName', label: 'Nom de l\'entreprise', href: '#profile' },
    { key: 'hasCategory', label: 'Categorie', href: '#profile' },
    { key: 'hasLocation', label: 'Au moins un lieu', href: '/pro/lieux' },
    { key: 'hasService', label: 'Au moins une prestation', href: '/pro/prestations' },
    { key: 'hasAvailability', label: 'Disponibilites configurees', href: '/pro/disponibilites' },
  ];

  return (
    <div className="space-y-6">
      {/* Current Status */}
      <div className="flex items-center gap-4">
        <div
          className={`p-3 rounded-xl ${
            provider?.isPublished
              ? 'bg-success-100 dark:bg-success-900/30 text-success-600 dark:text-success-400'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
          }`}
        >
          {provider?.isPublished ? (
            <Globe className="w-6 h-6" />
          ) : (
            <GlobeLock className="w-6 h-6" />
          )}
        </div>

        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-900 dark:text-white">
              {provider?.isPublished ? 'Page publiee' : 'Page non publiee'}
            </h3>
            <Badge variant={provider?.isPublished ? 'success' : 'default'}>
              {provider?.isPublished ? 'En ligne' : 'Hors ligne'}
            </Badge>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {provider?.isPublished
              ? 'Votre page est visible par les clients'
              : 'Votre page n\'est pas visible par les clients'}
          </p>
        </div>
      </div>

      {/* Public URL (if published) */}
      {provider?.isPublished && publicUrl && (
        <div className="p-4 bg-success-50 dark:bg-success-900/10 border border-success-200 dark:border-success-800 rounded-lg">
          <p className="text-sm font-medium text-success-700 dark:text-success-400 mb-2">
            Votre page est accessible a l'adresse:
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-sm bg-white dark:bg-gray-800 px-3 py-2 rounded border border-success-200 dark:border-success-700 truncate">
              {publicUrl}
            </code>
            <a
              href={`/${provider.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-success-600 hover:text-success-700 dark:text-success-400 dark:hover:text-success-300 transition-colors"
              title="Voir la page"
            >
              <ExternalLink className="w-5 h-5" />
            </a>
          </div>
        </div>
      )}

      {/* Requirements Checklist */}
      {!provider?.isPublished && (
        <div className="space-y-4">
          <h4 className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-warning-500" />
            Elements requis pour la publication
          </h4>

          {checkingRequirements ? (
            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              Verification...
            </div>
          ) : (
            <ul className="space-y-2">
              {requirementItems.map((item) => {
                const isComplete =
                  requirements?.completeness[item.key as keyof typeof requirements.completeness];
                return (
                  <li key={item.key} className="flex items-center gap-3">
                    {isComplete ? (
                      <CheckCircle className="w-5 h-5 text-success-500" />
                    ) : (
                      <XCircle className="w-5 h-5 text-gray-300 dark:text-gray-600" />
                    )}
                    <span
                      className={
                        isComplete
                          ? 'text-gray-900 dark:text-white'
                          : 'text-gray-500 dark:text-gray-400'
                      }
                    >
                      {item.label}
                    </span>
                    {!isComplete && (
                      <a
                        href={item.href}
                        className="text-sm text-primary-600 dark:text-primary-400 hover:underline"
                      >
                        Configurer
                      </a>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-error-50 dark:bg-error-900/20 text-error-700 dark:text-error-400 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3">
        {provider?.isPublished ? (
          <Button
            type="button"
            variant="outline"
            onClick={handleUnpublish}
            disabled={loading}
            className="text-warning-600 border-warning-300 hover:bg-warning-50 dark:text-warning-400 dark:border-warning-600 dark:hover:bg-warning-900/20"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Depublication...
              </>
            ) : (
              <>
                <GlobeLock className="w-4 h-4 mr-2" />
                Depublier
              </>
            )}
          </Button>
        ) : (
          <Button
            type="button"
            onClick={handlePublish}
            disabled={loading || !requirements?.canPublish}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Publication...
              </>
            ) : (
              <>
                <Globe className="w-4 h-4 mr-2" />
                Publier ma page
              </>
            )}
          </Button>
        )}

        <Button
          type="button"
          variant="ghost"
          onClick={checkRequirements}
          disabled={checkingRequirements}
        >
          Actualiser le statut
        </Button>
      </div>
    </div>
  );
}
