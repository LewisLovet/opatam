'use client';

import { useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button, Avatar } from '@/components/ui';
import { uploadFile, storagePaths } from '@booking-app/firebase';
import { providerService } from '@booking-app/firebase';
import { Camera, Loader2, Trash2 } from 'lucide-react';
import { APP_CONFIG } from '@booking-app/shared';

interface PhotoUploadProps {
  onSuccess?: () => void;
}

export function PhotoUpload({ onSuccess }: PhotoUploadProps) {
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
      setError('Veuillez selectionner une image');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > APP_CONFIG.maxMemberPhotoSize) {
      setError('L\'image ne doit pas depasser 5 Mo');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Upload to Firebase Storage
      const path = `${storagePaths.providerPhotos(provider.id)}/${Date.now()}_${file.name}`;
      const photoURL = await uploadFile(path, file, { contentType: file.type });

      // Update provider with new photo URL
      await providerService.updateProvider(provider.id, { photoURL });

      await refreshProvider();
      onSuccess?.();
    } catch (err) {
      console.error('Upload error:', err);
      setError(err instanceof Error ? err.message : 'Erreur lors du telechargement');
    } finally {
      setLoading(false);
      // Reset input
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
      await providerService.updateProvider(provider.id, { photoURL: null });
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
      <div className="flex items-center gap-6">
        {/* Current Photo */}
        <div className="relative">
          <Avatar
            src={provider?.photoURL || undefined}
            alt={provider?.businessName || 'Photo de profil'}
            size="xl"
            fallback={provider?.businessName?.charAt(0) || 'P'}
          />
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
              <Loader2 className="w-6 h-6 text-white animate-spin" />
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleFileSelect}
            disabled={loading}
          >
            <Camera className="w-4 h-4 mr-2" />
            {provider?.photoURL ? 'Changer la photo' : 'Ajouter une photo'}
          </Button>

          {provider?.photoURL && (
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
          )}
        </div>
      </div>

      {/* Hint */}
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Photo de profil visible par vos clients. Format recommande: carre, minimum 200x200 pixels.
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
