'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import {
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
  Textarea,
  Select,
  ConfirmDialog,
  ImageCropModal,
} from '@/components/ui';
import { Loader2, Trash2, ImagePlus, X, Check, Crop } from 'lucide-react';
import type { Service, ServiceCategory, Location, Member } from '@booking-app/shared';
import { uploadFile, storagePaths } from '@booking-app/firebase/storage';

type WithId<T> = { id: string } & T;

interface ServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  service?: WithId<Service> | null;
  locations: WithId<Location>[];
  members: WithId<Member>[];
  categories: WithId<ServiceCategory>[];
  isTeamPlan: boolean;
  /** Provider ID for uploading new photos to portfolio */
  providerId: string;
  /** Existing portfolio photos to select from */
  portfolioPhotos: string[];
  /** Callback when a new photo is uploaded (to refresh provider data) */
  onPortfolioUpdate?: (newPhotos: string[]) => void;
  onSave: (data: ServiceFormData) => Promise<void>;
  onDelete?: (serviceId: string) => Promise<void>;
  /**
   * Whether the provider has the deposits add-on active. When false the
   * deposit section is rendered locked, with a link to /pro/parametres
   * to activate it. Default false to be safe.
   */
  depositsEnabled?: boolean;
  /**
   * Provider-level default deposit. Shown as a hint when no per-service
   * override is set. Null when not configured.
   */
  defaultDeposit?: { percent: number; refundDeadlineHours: number } | null;
}

export interface ServiceFormData {
  name: string;
  description: string | null;
  photoURL: string | null;
  duration: number;
  price: number; // in cents
  priceMax: number | null; // in cents (null = prix fixe)
  bufferTime: number;
  categoryId: string | null;
  locationIds: string[];
  memberIds: string[] | null;
  /**
   * Per-service deposit override.
   *  - null  → fall back to the provider's default deposit (or no deposit)
   *  - fixed → value is in cents, must be ≤ price
   *  - percent → value is 1-100
   */
  deposit: {
    type: 'fixed' | 'percent';
    value: number;
    refundDeadlineHours: number;
  } | null;
}


const BUFFER_TIME_OPTIONS = [
  { value: '0', label: 'Aucun' },
  { value: '5', label: '5 min' },
  { value: '10', label: '10 min' },
  { value: '15', label: '15 min' },
  { value: '30', label: '30 min' },
];

export function ServiceModal({
  isOpen,
  onClose,
  service,
  locations,
  members,
  categories,
  isTeamPlan,
  providerId,
  portfolioPhotos,
  onPortfolioUpdate,
  onSave,
  onDelete,
  depositsEnabled = false,
  defaultDeposit = null,
}: ServiceModalProps) {
  const isEditing = !!service;
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [cropImageUrl, setCropImageUrl] = useState<string | null>(null);
  const [showCropModal, setShowCropModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState<ServiceFormData>({
    name: '',
    description: null,
    photoURL: null,
    duration: 60,
    price: 0,
    priceMax: null,
    bufferTime: 0,
    categoryId: null,
    locationIds: [],
    memberIds: null,
    deposit: null,
  });

  // Initialize form when modal opens or service changes
  useEffect(() => {
    if (isOpen) {
      if (service) {
        setFormData({
          name: service.name,
          description: service.description,
          photoURL: service.photoURL ?? null,
          duration: service.duration,
          price: service.price,
          priceMax: service.priceMax ?? null,
          bufferTime: service.bufferTime,
          categoryId: service.categoryId ?? null,
          locationIds: service.locationIds,
          memberIds: service.memberIds,
          deposit: service.deposit ?? null,
        });
      } else {
        // Default values for new service
        setFormData({
          name: '',
          description: null,
          photoURL: null,
          duration: 60,
          price: 0,
          priceMax: null,
          bufferTime: 0,
          categoryId: null,
          locationIds: locations.length > 0 ? [locations[0].id] : [],
          memberIds: null,
          deposit: null,
        });
      }
      setErrors({});
      setShowDeleteConfirm(false);
    }
  }, [isOpen, service, locations]);

  // When a new file is selected, create a local preview URL and open crop modal
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrors((prev) => ({ ...prev, photo: 'Le fichier doit être une image' }));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrors((prev) => ({ ...prev, photo: 'La photo ne doit pas depasser 5 Mo' }));
      return;
    }

    setErrors((prev) => ({ ...prev, photo: '' }));
    const localUrl = URL.createObjectURL(file);
    setCropImageUrl(localUrl);
    setShowCropModal(true);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // When selecting an existing portfolio photo → open crop
  const handleSelectPortfolioPhoto = (url: string) => {
    setCropImageUrl(url);
    setShowCropModal(true);
  };

  // After crop is done → upload cropped version and link to service
  const handleCropComplete = async (croppedBlob: Blob) => {
    setUploading(true);
    setErrors((prev) => ({ ...prev, photo: '' }));

    try {
      const path = `${storagePaths.providerPortfolio(providerId)}/crop-${Date.now()}.jpg`;
      const url = await uploadFile(path, croppedBlob, { contentType: 'image/jpeg' });
      // Add cropped photo to portfolio
      const newPhotos = [...portfolioPhotos, url];
      onPortfolioUpdate?.(newPhotos);
      // Link to this service
      setFormData((prev) => ({ ...prev, photoURL: url }));
    } catch {
      setErrors((prev) => ({ ...prev, photo: 'Erreur lors de l\'upload' }));
    } finally {
      setUploading(false);
      // Cleanup local URL if it was a local file
      if (cropImageUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(cropImageUrl);
      }
      setCropImageUrl(null);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        name === 'duration' || name === 'bufferTime'
          ? parseInt(value, 10)
          : name === 'price' || name === 'priceMax'
            ? Math.round(parseFloat(value || '0') * 100) // Convert euros to cents
            : name === 'categoryId'
              ? value || null // empty string → null
              : value || null,
    }));
    setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const handleLocationToggle = (locationId: string) => {
    setFormData((prev) => {
      const isSelected = prev.locationIds.includes(locationId);
      return {
        ...prev,
        locationIds: isSelected
          ? prev.locationIds.filter((id) => id !== locationId)
          : [...prev.locationIds, locationId],
      };
    });
    setErrors((prev) => ({ ...prev, locationIds: '' }));
  };

  const handleMemberToggle = (memberId: string) => {
    setFormData((prev) => {
      const currentIds = prev.memberIds || [];
      const isSelected = currentIds.includes(memberId);
      const newIds = isSelected
        ? currentIds.filter((id) => id !== memberId)
        : [...currentIds, memberId];
      return {
        ...prev,
        memberIds: newIds.length > 0 ? newIds : null,
      };
    });
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Le nom est requis';
    } else if (formData.name.length < 2) {
      newErrors.name = 'Le nom doit contenir au moins 2 caractères';
    }

    if (formData.price < 0) {
      newErrors.price = 'Le prix ne peut pas être négatif';
    }

    if (formData.priceMax !== null && formData.priceMax <= formData.price) {
      newErrors.priceMax = 'Le prix max doit être supérieur au prix min';
    }

    if (formData.locationIds.length === 0) {
      newErrors.locationIds = 'Sélectionnez au moins un lieu';
    }

    if (formData.deposit) {
      if (!Number.isFinite(formData.deposit.value) || formData.deposit.value < 1) {
        newErrors.depositValue = "Le montant de l'acompte doit être supérieur à 0";
      } else if (
        formData.deposit.type === 'fixed' &&
        formData.deposit.value > formData.price
      ) {
        newErrors.depositValue = "L'acompte fixe ne peut pas dépasser le prix";
      } else if (formData.deposit.type === 'percent' && formData.deposit.value > 100) {
        newErrors.depositValue = 'Le pourcentage ne peut pas dépasser 100 %';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      await onSave(formData);
      onClose();
    } catch (error) {
      console.error('Save error:', error);
      setErrors({
        submit: error instanceof Error ? error.message : 'Une erreur est survenue',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!service || !onDelete) return;

    setDeleting(true);
    try {
      await onDelete(service.id);
      onClose();
    } catch (error) {
      console.error('Delete error:', error);
      setErrors({
        submit: error instanceof Error ? error.message : 'Une erreur est survenue',
      });
      setShowDeleteConfirm(false);
    } finally {
      setDeleting(false);
    }
  };

  // Convert cents to euros for display
  const priceInEuros = formData.price / 100;
  const priceMaxInEuros = formData.priceMax ? formData.priceMax / 100 : 0;
  const isPriceRange = formData.priceMax !== null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-xl">
      <form onSubmit={handleSubmit} className="flex flex-col overflow-hidden max-h-[inherit]">
        <ModalHeader
          title={isEditing ? 'Modifier la prestation' : 'Nouvelle prestation'}
          onClose={onClose}
        />

        <ModalBody className="space-y-6">
          {/* Name */}
          <Input
            label="Nom de la prestation"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="Ex: Coupe femme"
            error={errors.name}
            required
          />

          {/* Description */}
          <Textarea
            label="Description"
            name="description"
            value={formData.description || ''}
            onChange={handleChange}
            placeholder="Décrivez cette prestation..."
            rows={3}
            hint="Optionnel - visible par les clients lors de la réservation"
          />

          {/* Photo (from portfolio) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Photo <span className="text-gray-400 font-normal">(optionnel)</span>
            </label>

            {/* Selected photo preview */}
            {formData.photoURL && (
              <div className="relative inline-flex items-end gap-2 mb-3">
                <div className="relative">
                  <Image
                    src={formData.photoURL}
                    alt="Photo de la prestation"
                    width={120}
                    height={120}
                    className="rounded-lg object-cover border border-gray-200 dark:border-gray-700"
                    style={{ width: 120, height: 120 }}
                  />
                  <button
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, photoURL: null }))}
                    className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setCropImageUrl(formData.photoURL);
                    setShowCropModal(true);
                  }}
                  className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 bg-gray-100 dark:bg-gray-800 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                >
                  <Crop className="w-3 h-3" />
                  Recadrer
                </button>
              </div>
            )}

            {/* Portfolio gallery */}
            {portfolioPhotos.length > 0 && (
              <div className="grid grid-cols-5 gap-2 mb-2">
                {portfolioPhotos.map((url) => (
                  <button
                    key={url}
                    type="button"
                    onClick={() => handleSelectPortfolioPhoto(url)}
                    className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                      formData.photoURL === url
                        ? 'border-primary-500 ring-2 ring-primary-500/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <Image
                      src={url}
                      alt=""
                      fill
                      className="object-cover"
                    />
                    {formData.photoURL === url && (
                      <div className="absolute inset-0 bg-primary-500/20 flex items-center justify-center">
                        <Check className="w-5 h-5 text-white drop-shadow" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Upload new photo button */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handlePhotoUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              {uploading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ImagePlus className="w-4 h-4" />
              )}
              {uploading ? 'Upload en cours...' : 'Ajouter une photo'}
            </button>
            <p className="mt-1 text-xs text-gray-400">
              {portfolioPhotos.length > 0
                ? 'Selectionnez une photo du portfolio ou ajoutez-en une nouvelle'
                : 'La photo sera ajoutee a votre portfolio'}
            </p>
            {errors.photo && (
              <p className="mt-1 text-sm text-red-500">{errors.photo}</p>
            )}
          </div>

          {/* Duration & Price */}
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Durée (minutes)"
              name="duration"
              type="number"
              value={formData.duration.toString()}
              onChange={handleChange}
              min="5"
              max="480"
              step="5"
              hint="De 5 min à 8h"
              required
            />

            <Input
              label={isPriceRange ? 'Prix min (EUR)' : 'Prix (EUR)'}
              name="price"
              type="number"
              value={priceInEuros.toString()}
              onChange={handleChange}
              placeholder="0"
              min="0"
              step="0.01"
              error={errors.price}
              required
            />

            {isPriceRange && (
              <Input
                label="Prix max (EUR)"
                name="priceMax"
                type="number"
                value={priceMaxInEuros.toString()}
                onChange={handleChange}
                placeholder="0"
                min="0"
                step="0.01"
                error={errors.priceMax}
                required
              />
            )}
          </div>

          {/* Price options */}
          <div className="flex items-center gap-4 flex-wrap">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isPriceRange}
                onChange={(e) => {
                  if (e.target.checked) {
                    setFormData((prev) => ({ ...prev, priceMax: prev.price > 0 ? prev.price + 1000 : 1000 }));
                  } else {
                    setFormData((prev) => ({ ...prev, priceMax: null }));
                  }
                  setErrors((prev) => ({ ...prev, priceMax: '' }));
                }}
                className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className={`text-sm ${isPriceRange ? 'text-primary-600 font-medium' : 'text-gray-500 dark:text-gray-400'}`}>
                Fourchette de prix
              </span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.price === 0 && !isPriceRange}
                onChange={(e) => {
                  setFormData((prev) => ({
                    ...prev,
                    price: e.target.checked ? 0 : prev.price || 0,
                    priceMax: e.target.checked ? null : prev.priceMax,
                  }));
                  setErrors((prev) => ({ ...prev, price: '', priceMax: '' }));
                }}
                className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className={`text-sm ${formData.price === 0 && !isPriceRange ? 'text-primary-600 font-medium' : 'text-gray-500 dark:text-gray-400'}`}>
                RDV gratuit
              </span>
            </label>
          </div>

          {/* ── Acompte (per-service deposit override) ─────────────── */}
          <DepositSection
            depositsEnabled={depositsEnabled}
            defaultDeposit={defaultDeposit}
            servicePrice={formData.price}
            deposit={formData.deposit}
            onChange={(next) => {
              setFormData((prev) => ({ ...prev, deposit: next }));
              setErrors((prev) => ({ ...prev, depositValue: '' }));
            }}
            error={errors.depositValue}
          />

          {/* Buffer time */}
          <Select
            label="Temps de battement après RDV"
            name="bufferTime"
            value={formData.bufferTime.toString()}
            onChange={handleChange}
            options={BUFFER_TIME_OPTIONS}
            hint="Temps de pause entre deux rendez-vous"
          />

          {/* Category */}
          {categories.length > 0 && (
            <Select
              label="Catégorie"
              name="categoryId"
              value={formData.categoryId || ''}
              onChange={handleChange}
              options={[
                { value: '', label: 'Sans catégorie' },
                ...categories.map((cat) => ({
                  value: cat.id,
                  label: cat.name,
                })),
              ]}
            />
          )}

          {/* Locations */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Lieux disponibles
            </label>
            {locations.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                Aucun lieu configuré. Créez d'abord un lieu dans l'onglet "Lieux".
              </p>
            ) : (
              <div className="space-y-2">
                {locations.map((location) => (
                  <label
                    key={location.id}
                    className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={formData.locationIds.includes(location.id)}
                      onChange={() => handleLocationToggle(location.id)}
                      className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {location.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {location.address?.trim() ? `${location.address}, ${location.city}` : location.city}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            )}
            {errors.locationIds && (
              <p className="mt-1.5 text-sm text-error-600 dark:text-error-400">
                {errors.locationIds}
              </p>
            )}
          </div>

          {/* Members (Teams only) */}
          {isTeamPlan && members.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Membres assignes
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                Laissez vide pour que tous les membres puissent effectuer cette prestation
              </p>
              <div className="space-y-2">
                {members.map((member) => (
                  <label
                    key={member.id}
                    className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={formData.memberIds?.includes(member.id) || false}
                      onChange={() => handleMemberToggle(member.id)}
                      className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {member.name}
                      </p>
                      {member.email && (
                        <p className="text-xs text-gray-500 dark:text-gray-400">{member.email}</p>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Error message */}
          {errors.submit && (
            <div className="p-4 bg-error-50 dark:bg-error-900/20 text-error-700 dark:text-error-400 rounded-lg text-sm">
              {errors.submit}
            </div>
          )}
        </ModalBody>

        <ModalFooter>
          {/* Delete button (editing only) */}
          {isEditing && onDelete && (
            <div className="flex-1">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowDeleteConfirm(true)}
                className="text-error-600 hover:text-error-700"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Supprimer
              </Button>
            </div>
          )}

          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Annuler
          </Button>

          <Button type="submit" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {isEditing ? 'Mise à jour...' : 'Création...'}
              </>
            ) : isEditing ? (
              'Mettre à jour'
            ) : (
              'Créer'
            )}
          </Button>
        </ModalFooter>
      </form>

      {/* Delete confirmation dialog */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="Supprimer la prestation"
        message="Êtes-vous sûr de vouloir supprimer cette prestation ? Cette action est irréversible."
        confirmLabel="Supprimer"
        loading={deleting}
        variant="danger"
      />

      {/* Image crop modal */}
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
    </Modal>
  );
}

// ─── DepositSection ─────────────────────────────────────────────────────
// Per-service deposit override card. Three states:
//   1. Add-on disabled → muted card with link to activate
//   2. Override OFF + default exists → hint "Acompte par défaut X% (= Y€)"
//   3. Override ON → form (radio fixe/%, value input, refund deadline)

interface DepositSectionProps {
  depositsEnabled: boolean;
  defaultDeposit: { percent: number; refundDeadlineHours: number } | null;
  servicePrice: number; // cents
  deposit: ServiceFormData['deposit'];
  onChange: (next: ServiceFormData['deposit']) => void;
  error?: string;
}

function DepositSection({
  depositsEnabled,
  defaultDeposit,
  servicePrice,
  deposit,
  onChange,
  error,
}: DepositSectionProps) {
  const overrideOn = !!deposit;

  // Add-on not active → locked card with link to /pro/parametres
  if (!depositsEnabled) {
    return (
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40 p-4">
        <div className="flex items-start gap-2">
          <span className="text-base">🔒</span>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            <p className="font-medium text-gray-900 dark:text-white">Acompte</p>
            <p className="text-xs mt-1">
              Activez l&apos;add-on Acomptes pour demander un acompte sur cette prestation.{' '}
              <a
                href="/pro/parametres?tab=paiements"
                className="text-primary-600 dark:text-primary-400 hover:underline font-medium"
              >
                Aller aux paramètres →
              </a>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Compute previewed amount for both default and override
  const defaultAmount = defaultDeposit
    ? Math.round((servicePrice * defaultDeposit.percent) / 100)
    : 0;
  const overrideAmount = deposit
    ? deposit.type === 'fixed'
      ? deposit.value
      : Math.round((servicePrice * deposit.value) / 100)
    : 0;

  const fmt = (cents: number) => (cents / 100).toFixed(2).replace('.', ',') + ' €';

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-white">
            Acompte spécifique pour cette prestation
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {overrideOn
              ? 'Override actif — remplace l\'acompte par défaut.'
              : defaultDeposit
              ? `Sans override, l'acompte par défaut s'applique : ${defaultDeposit.percent} % (= ${fmt(defaultAmount)}).`
              : "Sans override et sans acompte par défaut, aucun acompte ne sera demandé."}
          </p>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={overrideOn}
          onClick={() =>
            onChange(
              overrideOn
                ? null
                : { type: 'percent', value: 30, refundDeadlineHours: 24 }
            )
          }
          className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
            overrideOn ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'
          }`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
              overrideOn ? 'translate-x-5' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>

      {overrideOn && deposit && (
        <div className="space-y-3 pt-3 border-t border-gray-100 dark:border-gray-700">
          {/* Type selector */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() =>
                onChange({ ...deposit, type: 'percent', value: 30 })
              }
              className={`flex-1 px-3 py-2 rounded-md border text-sm font-medium transition-colors ${
                deposit.type === 'percent'
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:border-gray-300'
              }`}
            >
              Pourcentage
            </button>
            <button
              type="button"
              onClick={() =>
                onChange({
                  ...deposit,
                  type: 'fixed',
                  value: Math.min(servicePrice, 1000),
                })
              }
              className={`flex-1 px-3 py-2 rounded-md border text-sm font-medium transition-colors ${
                deposit.type === 'fixed'
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:border-gray-300'
              }`}
            >
              Montant fixe
            </button>
          </div>

          {/* Value input */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                {deposit.type === 'percent' ? 'Pourcentage' : 'Montant'}
              </label>
              <div className="relative">
                <input
                  type="number"
                  min={1}
                  max={deposit.type === 'percent' ? 100 : servicePrice / 100}
                  step={deposit.type === 'percent' ? 1 : 0.01}
                  value={
                    deposit.type === 'percent'
                      ? deposit.value
                      : (deposit.value / 100).toFixed(2)
                  }
                  onChange={(e) => {
                    const raw = parseFloat(e.target.value) || 0;
                    const next =
                      deposit.type === 'percent'
                        ? Math.round(raw)
                        : Math.round(raw * 100); // euros → cents
                    onChange({ ...deposit, value: next });
                  }}
                  className={`w-full pl-3 pr-8 py-2 rounded-lg border ${
                    error ? 'border-red-500' : 'border-gray-200 dark:border-gray-700'
                  } bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500`}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                  {deposit.type === 'percent' ? '%' : '€'}
                </span>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1 block">
                Délai de remboursement
              </label>
              <div className="relative">
                <input
                  type="number"
                  min={0}
                  max={720}
                  step={1}
                  value={deposit.refundDeadlineHours}
                  onChange={(e) => {
                    const v = Math.max(0, Math.min(720, parseInt(e.target.value, 10) || 0));
                    onChange({ ...deposit, refundDeadlineHours: v });
                  }}
                  className="w-full pl-3 pr-12 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                  heures
                </span>
              </div>
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
          )}

          {/* Live preview */}
          <div className="rounded-md bg-gray-50 dark:bg-gray-900/40 px-3 py-2 text-xs text-gray-600 dark:text-gray-400">
            <strong className="text-gray-900 dark:text-white">Acompte demandé :</strong>{' '}
            {servicePrice > 0 ? fmt(overrideAmount) : 'configurez d\'abord le prix'}
            {deposit.refundDeadlineHours === 0
              ? ' · non remboursable'
              : ` · remboursé si annulation > ${deposit.refundDeadlineHours} h avant`}
          </div>
        </div>
      )}
    </div>
  );
}
