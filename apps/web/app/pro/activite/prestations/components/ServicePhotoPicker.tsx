'use client';

import { useState, useRef } from 'react';
import Image from 'next/image';
import { Camera, Check, Crop, FolderOpen, Loader2, X } from 'lucide-react';
import { ImageCropModal } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { providerService } from '@booking-app/firebase';
import { uploadFile, storagePaths } from '@booking-app/firebase/storage';

interface ServicePhotoPickerProps {
  photoURL: string | null;
  onChange: (url: string | null) => void;
}

/**
 * Self-contained photo picker for a prestation: upload from device or
 * pick from the provider portfolio, with a square crop step. Newly
 * cropped images are appended to the provider portfolio. Reads the
 * provider (portfolio + id) straight from auth so the editor doesn't
 * have to thread props through.
 */
export function ServicePhotoPicker({ photoURL, onChange }: ServicePhotoPickerProps) {
  const { provider, refreshProvider } = useAuth();
  const portfolioPhotos = provider?.portfolioPhotos ?? [];
  const providerId = provider?.id ?? '';

  const [uploading, setUploading] = useState(false);
  const [showPortfolio, setShowPortfolio] = useState(false);
  const [cropImageUrl, setCropImageUrl] = useState<string | null>(null);
  const [showCropModal, setShowCropModal] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Le fichier doit être une image');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('La photo ne doit pas dépasser 5 Mo');
      return;
    }
    setError('');
    const localUrl = URL.createObjectURL(file);
    setCropImageUrl(localUrl);
    setShowCropModal(true);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSelectPortfolioPhoto = (url: string) => {
    setCropImageUrl(url);
    setShowCropModal(true);
  };

  const handleCropComplete = async (croppedBlob: Blob) => {
    setUploading(true);
    setError('');
    try {
      const path = `${storagePaths.providerPortfolio(providerId)}/crop-${Date.now()}.jpg`;
      const url = await uploadFile(path, croppedBlob, { contentType: 'image/jpeg' });
      // Persist the new shot onto the provider portfolio, then refresh
      // auth so the gallery reflects it immediately.
      await providerService.updateProvider(providerId, {
        portfolioPhotos: [...portfolioPhotos, url],
      });
      await refreshProvider();
      onChange(url);
    } catch {
      setError("Erreur lors de l'upload");
    } finally {
      setUploading(false);
      if (cropImageUrl?.startsWith('blob:')) URL.revokeObjectURL(cropImageUrl);
      setCropImageUrl(null);
    }
  };

  return (
    <div>
      {/* Selected photo preview */}
      {photoURL && (
        <div className="relative inline-flex items-end gap-2 mb-3">
          <div className="relative">
            <Image
              src={photoURL}
              alt="Photo de la prestation"
              width={120}
              height={120}
              className="rounded-lg object-cover border border-gray-200 dark:border-gray-700"
              style={{ width: 120, height: 120 }}
            />
            <button
              type="button"
              onClick={() => onChange(null)}
              className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              setCropImageUrl(photoURL);
              setShowCropModal(true);
            }}
            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 bg-gray-100 dark:bg-gray-800 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            <Crop className="w-3 h-3" />
            Recadrer
          </button>
        </div>
      )}

      {/* Source choice */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handlePhotoUpload}
        className="hidden"
      />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
        >
          {uploading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Camera className="w-4 h-4" />
          )}
          {uploading ? 'Upload…' : photoURL ? 'Changer (appareil)' : "Depuis l'appareil"}
        </button>
        {portfolioPhotos.length > 0 && (
          <button
            type="button"
            onClick={() => setShowPortfolio((v) => !v)}
            className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
              showPortfolio
                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <FolderOpen className="w-4 h-4" />
            {photoURL ? 'Changer (portfolio)' : 'Depuis le portfolio'}
            <span className="text-[11px] text-gray-400">({portfolioPhotos.length})</span>
          </button>
        )}
      </div>

      {/* Portfolio gallery */}
      {showPortfolio && portfolioPhotos.length > 0 && (
        <div className="mt-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40">
          <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
            {portfolioPhotos.map((url) => (
              <button
                key={url}
                type="button"
                onClick={() => {
                  handleSelectPortfolioPhoto(url);
                  setShowPortfolio(false);
                }}
                className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                  photoURL === url
                    ? 'border-primary-500 ring-2 ring-primary-500/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <Image src={url} alt="" fill className="object-cover" />
                {photoURL === url && (
                  <div className="absolute inset-0 bg-primary-500/20 flex items-center justify-center">
                    <Check className="w-5 h-5 text-white drop-shadow" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {!photoURL && (
        <p className="mt-2 text-xs text-gray-400">
          {portfolioPhotos.length > 0
            ? "Choisissez une photo depuis l'appareil ou parmi celles déjà dans votre portfolio."
            : 'La photo sera ajoutée à votre portfolio.'}
        </p>
      )}
      {error && <p className="mt-1 text-sm text-red-500">{error}</p>}

      {cropImageUrl && (
        <ImageCropModal
          isOpen={showCropModal}
          onClose={() => {
            setShowCropModal(false);
            if (cropImageUrl.startsWith('blob:')) URL.revokeObjectURL(cropImageUrl);
            setCropImageUrl(null);
          }}
          imageUrl={cropImageUrl}
          aspect={1}
          onCropComplete={handleCropComplete}
        />
      )}
    </div>
  );
}
