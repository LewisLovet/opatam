'use client';

import { useState, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui';
import { uploadFile, storagePaths, deleteFile } from '@booking-app/firebase';
import { providerService } from '@booking-app/firebase';
import { ImagePlus, Loader2, X, GripVertical } from 'lucide-react';
import { APP_CONFIG } from '@booking-app/shared';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface PortfolioUploadProps {
  onSuccess?: () => void;
}

// Sortable photo item
function SortablePhoto({
  url,
  index,
  deletingIndex,
  onRemove,
}: {
  url: string;
  index: number;
  deletingIndex: number | null;
  onRemove: (index: number) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: url });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        relative aspect-square rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 group
        ${isDragging ? 'z-10 shadow-xl ring-2 ring-primary-500 opacity-90' : ''}
      `}
    >
      <img
        src={url}
        alt={`Portfolio ${index + 1}`}
        className="w-full h-full object-cover pointer-events-none"
        draggable={false}
      />

      {/* Drag handle */}
      <button
        type="button"
        className="absolute top-2 left-2 p-1.5 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-all cursor-grab active:cursor-grabbing"
        title="Glisser pour réordonner"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="w-4 h-4" />
      </button>

      {/* Delete button */}
      <button
        type="button"
        onClick={() => onRemove(index)}
        disabled={deletingIndex === index}
        className="absolute top-2 right-2 p-1.5 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 hover:bg-error-600 transition-all"
        title="Supprimer"
      >
        {deletingIndex === index ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <X className="w-4 h-4" />
        )}
      </button>
    </div>
  );
}

export function PortfolioUpload({ onSuccess }: PortfolioUploadProps) {
  const { provider, refreshProvider } = useAuth();
  const [loading, setLoading] = useState(false);
  const [deletingIndex, setDeletingIndex] = useState<number | null>(null);
  const [reordering, setReordering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const portfolioPhotos = provider?.portfolioPhotos || [];
  const canAddMore = portfolioPhotos.length < APP_CONFIG.maxPortfolioPhotos;

  // dnd-kit sensors with activation distance to avoid accidental drags
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !provider) return;

    const oldIndex = portfolioPhotos.indexOf(active.id as string);
    const newIndex = portfolioPhotos.indexOf(over.id as string);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(portfolioPhotos, oldIndex, newIndex);

    setReordering(true);
    setError(null);
    try {
      await providerService.updateProvider(provider.id, { portfolioPhotos: reordered });
      await refreshProvider();
    } catch (err) {
      console.error('Reorder error:', err);
      setError(err instanceof Error ? err.message : 'Erreur lors du réordonnancement');
    } finally {
      setReordering(false);
    }
  }, [provider, portfolioPhotos, refreshProvider]);

  const handleFileSelect = () => {
    if (!canAddMore) {
      setError(`Vous avez atteint la limite de ${APP_CONFIG.maxPortfolioPhotos} photos`);
      return;
    }
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !provider) return;

    // Check how many we can add
    const remainingSlots = APP_CONFIG.maxPortfolioPhotos - portfolioPhotos.length;
    const filesToUpload = Array.from(files).slice(0, remainingSlots);

    if (filesToUpload.length === 0) {
      setError(`Vous avez atteint la limite de ${APP_CONFIG.maxPortfolioPhotos} photos`);
      return;
    }

    // Validate all files
    for (const file of filesToUpload) {
      if (!file.type.startsWith('image/')) {
        setError('Veuillez sélectionner uniquement des images');
        return;
      }
      if (file.size > APP_CONFIG.maxMemberPhotoSize) {
        setError('Chaque image ne doit pas dépasser 5 Mo');
        return;
      }
    }

    setLoading(true);
    setError(null);

    try {
      const newUrls: string[] = [];

      for (const file of filesToUpload) {
        const path = `${storagePaths.providerPortfolio(provider.id)}/${Date.now()}_${file.name}`;
        const url = await uploadFile(path, file, { contentType: file.type });
        newUrls.push(url);
      }

      // Update provider with new portfolio photos
      const updatedPhotos = [...portfolioPhotos, ...newUrls];
      await providerService.updateProvider(provider.id, { portfolioPhotos: updatedPhotos });

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

  const handleRemove = async (index: number) => {
    if (!provider) return;

    setDeletingIndex(index);
    setError(null);

    try {
      const updatedPhotos = portfolioPhotos.filter((_, i) => i !== index);
      await providerService.updateProvider(provider.id, { portfolioPhotos: updatedPhotos });

      await refreshProvider();
      onSuccess?.();
    } catch (err) {
      console.error('Remove error:', err);
      setError(err instanceof Error ? err.message : 'Erreur lors de la suppression');
    } finally {
      setDeletingIndex(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Photo Grid with drag & drop */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={portfolioPhotos} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {/* Existing Photos (sortable) */}
            {portfolioPhotos.map((url, index) => (
              <SortablePhoto
                key={url}
                url={url}
                index={index}
                deletingIndex={deletingIndex}
                onRemove={handleRemove}
              />
            ))}

            {/* Add Photo Button */}
            {canAddMore && (
              <button
                type="button"
                onClick={handleFileSelect}
                disabled={loading}
                className={`
                  aspect-square rounded-lg border-2 border-dashed
                  border-gray-300 dark:border-gray-600
                  bg-gray-50 dark:bg-gray-800/50
                  flex flex-col items-center justify-center gap-1
                  transition-colors
                  ${!loading ? 'cursor-pointer hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/10' : ''}
                `}
              >
                {loading ? (
                  <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
                ) : (
                  <>
                    <ImagePlus className="w-6 h-6 text-gray-400" />
                    <span className="text-xs text-gray-500 dark:text-gray-400">Ajouter</span>
                  </>
                )}
              </button>
            )}
          </div>
        </SortableContext>
      </DndContext>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Counter & hint */}
      <p className="text-sm text-gray-500 dark:text-gray-400">
        {portfolioPhotos.length} / {APP_CONFIG.maxPortfolioPhotos} photos
        {portfolioPhotos.length > 1 && !reordering && (
          <span> · Glissez les photos pour les réordonner</span>
        )}
        {reordering && (
          <span> · Enregistrement...</span>
        )}
      </p>

      {/* Hint */}
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Ajoutez des photos de vos realisations pour montrer votre travail aux clients.
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
