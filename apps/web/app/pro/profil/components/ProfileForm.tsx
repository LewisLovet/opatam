'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Input, Textarea, Select, Button } from '@/components/ui';
import { providerService } from '@booking-app/firebase';
import { CATEGORIES, APP_CONFIG } from '@booking-app/shared';
import { Loader2, ExternalLink } from 'lucide-react';

interface ProfileFormProps {
  onSuccess?: () => void;
}

export function ProfileForm({ onSuccess }: ProfileFormProps) {
  const { provider, refreshProvider } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    businessName: '',
    category: '',
    description: '',
  });

  // Initialize form with provider data
  useEffect(() => {
    if (provider) {
      setFormData({
        businessName: provider.businessName || '',
        category: provider.category || '',
        description: provider.description || '',
      });
    }
  }, [provider]);

  const categoryOptions = CATEGORIES.map((cat) => ({
    value: cat.id,
    label: cat.label,
  }));

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setError(null);
    setSuccess(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!provider) return;

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      await providerService.updateProvider(provider.id, {
        businessName: formData.businessName,
        category: formData.category,
        description: formData.description,
      });

      await refreshProvider();
      setSuccess(true);
      onSuccess?.();
    } catch (err) {
      console.error('Update error:', err);
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  const publicUrl = provider?.slug
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/p/${provider.slug}`
    : null;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Business Name */}
      <Input
        label="Nom de l'entreprise"
        name="businessName"
        value={formData.businessName}
        onChange={handleChange}
        placeholder="Ex: Salon de beauté Marie"
        required
      />

      {/* Category */}
      <Select
        label="Catégorie"
        name="category"
        value={formData.category}
        onChange={handleChange}
        options={categoryOptions}
        placeholder="Sélectionnez une catégorie"
        required
      />

      {/* Description */}
      <Textarea
        label="Description"
        name="description"
        value={formData.description}
        onChange={handleChange}
        placeholder="Decrivez votre activite en quelques lignes..."
        rows={4}
        hint="Cette description sera visible sur votre page publique"
      />

      {/* Slug Preview */}
      {provider?.slug && (
        <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg overflow-hidden">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            URL de votre page publique
          </p>
          <div className="flex items-center gap-2 min-w-0">
            <code className="flex-1 min-w-0 text-sm text-primary-600 dark:text-primary-400 bg-white dark:bg-gray-800 px-3 py-2 rounded border border-gray-200 dark:border-gray-700 truncate block overflow-hidden">
              {publicUrl}
            </code>
            {provider.isPublished && (
              <a
                href={`/p/${provider.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 text-gray-500 hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400 transition-colors"
                title="Voir la page"
              >
                <ExternalLink className="w-5 h-5" />
              </a>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Le slug est genere automatiquement a partir du nom de l'entreprise
          </p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-error-50 dark:bg-error-900/20 text-error-700 dark:text-error-400 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Success Message */}
      {success && (
        <div className="p-4 bg-success-50 dark:bg-success-900/20 text-success-700 dark:text-success-400 rounded-lg text-sm">
          Informations mises a jour avec succes
        </div>
      )}

      {/* Submit Button */}
      <div className="flex justify-end">
        <Button type="submit" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Enregistrement...
            </>
          ) : (
            'Enregistrer'
          )}
        </Button>
      </div>
    </form>
  );
}
