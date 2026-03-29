'use client';

import { useState, useCallback, useEffect } from 'react';
import Cropper from 'react-easy-crop';
import type { Area } from 'react-easy-crop';
import { Modal, ModalHeader, ModalBody, ModalFooter, Button } from '@/components/ui';
import { RotateCcw } from 'lucide-react';

interface ImageCropModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  /** Aspect ratio (default: 1 for square) */
  aspect?: number;
  /** Called with the cropped image blob */
  onCropComplete: (croppedBlob: Blob) => void;
}

/**
 * Create a cropped image from the source using canvas.
 * Expects a blob: URL (already CORS-safe) from the useEffect conversion.
 */
async function getCroppedImg(blobUrl: string, pixelCrop: Area): Promise<Blob> {
  const image = new Image();

  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = reject;
    image.src = blobUrl;
  });

  const canvas = document.createElement('canvas');
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;
  const ctx = canvas.getContext('2d');

  if (!ctx) throw new Error('Could not get canvas context');

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Canvas toBlob failed'));
      },
      'image/jpeg',
      0.9
    );
  });
}

export function ImageCropModal({
  isOpen,
  onClose,
  imageUrl,
  aspect = 1,
  onCropComplete,
}: ImageCropModalProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [saving, setSaving] = useState(false);
  const [localImageUrl, setLocalImageUrl] = useState<string | null>(null);

  // Convert remote URLs to local blob URLs via proxy to avoid CORS/tainted canvas
  useEffect(() => {
    if (!isOpen || !imageUrl) return;

    if (imageUrl.startsWith('blob:') || imageUrl.startsWith('data:')) {
      setLocalImageUrl(imageUrl);
      return;
    }

    let revoke: string | null = null;
    // Use server proxy to avoid CORS — the image comes from localhost, no taint
    const proxyUrl = `/api/image-proxy?url=${encodeURIComponent(imageUrl)}`;
    fetch(proxyUrl)
      .then((r) => r.blob())
      .then((blob) => {
        revoke = URL.createObjectURL(blob);
        setLocalImageUrl(revoke);
      })
      .catch(() => setLocalImageUrl(imageUrl)); // fallback

    return () => {
      if (revoke) URL.revokeObjectURL(revoke);
      setLocalImageUrl(null);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
    };
  }, [isOpen, imageUrl]);

  const onCropChange = useCallback((_: unknown, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const handleReset = () => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
  };

  const handleSave = async () => {
    if (!croppedAreaPixels || !localImageUrl) return;

    setSaving(true);
    try {
      const croppedBlob = await getCroppedImg(localImageUrl, croppedAreaPixels);
      onCropComplete(croppedBlob);
      onClose();
    } catch (cropErr) {
      console.warn('[ImageCrop] Crop failed:', cropErr);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-2xl">
      <ModalHeader title="Recadrer la photo" onClose={onClose} />
      <ModalBody>
        <div className="relative w-full h-80 sm:h-96 bg-gray-900 rounded-lg overflow-hidden">
          {localImageUrl && <Cropper
            image={localImageUrl}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropChange}
            cropShape="rect"
            showGrid
          />}
        </div>

        {/* Zoom slider */}
        <div className="mt-4 flex items-center gap-3">
          <span className="text-sm text-gray-500 dark:text-gray-400 w-12">Zoom</span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary-600"
          />
          <span className="text-sm text-gray-500 dark:text-gray-400 w-10 text-right">
            {Math.round(zoom * 100)}%
          </span>
        </div>
      </ModalBody>
      <ModalFooter>
        <div className="flex items-center justify-between w-full">
          <button
            type="button"
            onClick={handleReset}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Reinitialiser
          </button>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={onClose}>
              Annuler
            </Button>
            <Button onClick={handleSave} loading={saving}>
              Valider
            </Button>
          </div>
        </div>
      </ModalFooter>
    </Modal>
  );
}
