'use client';

import { useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui';
import { uploadFile, storagePaths } from '@booking-app/firebase';
import { providerService } from '@booking-app/firebase';
import { ImagePlus, Loader2, Trash2 } from 'lucide-react';
import { APP_CONFIG } from '@booking-app/shared';

interface CoverPhotoUploadProps {
  onSuccess?: () => void;
}

export function CoverPhotoUpload({ onSuccess }: CoverPhotoUploadProps) {
  const { provider, refreshProvider } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !provider) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Veuillez sélectionner une image');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > APP_CONFIG.maxMemberPhotoSize) {
      setError('L\'image ne doit pas dépasser 5 Mo');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Upload to Firebase Storage
      const path = `${storagePaths.providerCover(provider.id)}/${Date.now()}_${file.name}`;
      const coverPhotoURL = await uploadFile(path, file, { contentType: file.type });

      // Update provider with new cover photo URL
      await providerService.updateProvider(provider.id, { coverPhotoURL });

      await refreshProvider();
      onSuccess?.();
    } catch (err) {
      console.error('Upload error:', err);
      setError(err instanceof Error ? err.message : 'Erreur lors du telechargement');
    } finally {
      setLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemove = async () => {
    if (!provider) return;

    setLoading(true);
    setError(null);

    try {
      await providerService.updateProvider(provider.id, { coverPhotoURL: null });
      await refreshProvider();
      onSuccess?.();
    } catch (err) {
      console.error('Remove error:', err);
      setError(err instanceof Error ? err.message : 'Erreur lors de la suppression');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Cover Photo Preview */}
      <div className="relative">
        {provider?.coverPhotoURL ? (
          <div className="relative aspect-[3/1] w-full rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800">
            <img
              src={provider.coverPhotoURL}
              alt="Photo de couverture"
              className="w-full h-full object-cover"
            />
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                <Loader2 className="w-8 h-8 text-white animate-spin" />
              </div>
            )}
          </div>
        ) : (
          <div
            onClick={!loading ? handleFileSelect : undefined}
            className={`
              aspect-[3/1] w-full rounded-xl border-2 border-dashed
              border-gray-300 dark:border-gray-600
              bg-gray-50 dark:bg-gray-800/50
              flex flex-col items-center justify-center gap-2
              transition-colors
              ${!loading ? 'cursor-pointer hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/10' : ''}
            `}
          >
            {loading ? (
              <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
            ) : (
              <>
                <ImagePlus className="w-8 h-8 text-gray-400" />
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Cliquez pour ajouter une photo de couverture
                </p>
              </>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />

        {provider?.coverPhotoURL && (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleFileSelect}
              disabled={loading}
            >
              <ImagePlus className="w-4 h-4 mr-2" />
              Changer
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleRemove}
              disabled={loading}
              className="text-error-600 hover:text-error-700 dark:text-error-400"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Supprimer
            </Button>
          </>
        )}
      </div>

      {/* Hint */}
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Photo de couverture affichee en haut de votre page publique. Format recommande: 1200x400 pixels.
      </p>

      {/* Error */}
      {error && (
        <div className="p-3 bg-error-50 dark:bg-error-900/20 text-error-700 dark:text-error-400 rounded-lg text-sm">
          {error}
        </div>
      )}
    </div>
  );
}
