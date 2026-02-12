'use client';

import { useState, useEffect } from 'react';
import {
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
  Textarea,
  Checkbox,
  AddressAutocomplete,
  type AddressSuggestion,
} from '@/components/ui';
import { Loader2, Trash2, Building2, Car } from 'lucide-react';
import type { Location, LocationType } from '@booking-app/shared';

type WithId<T> = { id: string } & T;

interface LocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  location?: WithId<Location> | null;
  onSave: (data: LocationFormData) => Promise<void>;
  onDelete?: (locationId: string) => Promise<void>;
}

export interface LocationFormData {
  name: string;
  address: string;
  postalCode: string;
  city: string;
  description: string | null;
  isDefault: boolean;
  type: LocationType;
  travelRadius: number | null;
  geopoint?: { latitude: number; longitude: number } | null;
}

export function LocationModal({
  isOpen,
  onClose,
  location,
  onSave,
  onDelete,
}: LocationModalProps) {
  const isEditing = !!location;
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState<LocationFormData>({
    name: '',
    address: '',
    postalCode: '',
    city: '',
    description: null,
    isDefault: false,
    type: 'fixed',
    travelRadius: null,
  });

  // Initialize form when modal opens or location changes
  useEffect(() => {
    if (isOpen) {
      if (location) {
        setFormData({
          name: location.name,
          address: location.address,
          postalCode: location.postalCode,
          city: location.city,
          description: location.description,
          isDefault: location.isDefault,
          type: location.type || 'fixed',
          travelRadius: location.travelRadius,
        });
      } else {
        setFormData({
          name: '',
          address: '',
          postalCode: '',
          city: '',
          description: null,
          isDefault: false,
          type: 'fixed',
          travelRadius: null,
        });
      }
      setErrors({});
      setShowDeleteConfirm(false);
    }
  }, [isOpen, location]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value || null,
    }));
    setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: checked,
    }));
  };

  const handleTypeChange = (type: LocationType) => {
    setFormData((prev) => ({
      ...prev,
      type,
      // Reset travelRadius when switching to fixed
      travelRadius: type === 'fixed' ? null : prev.travelRadius || 15,
      // Clear address when switching to mobile (optional)
      address: type === 'mobile' ? '' : prev.address,
    }));
    setErrors((prev) => ({ ...prev, type: '', travelRadius: '', address: '' }));
  };

  const handleRadiusChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    setFormData((prev) => ({
      ...prev,
      travelRadius: isNaN(value) ? null : Math.min(100, Math.max(1, value)),
    }));
    setErrors((prev) => ({ ...prev, travelRadius: '' }));
  };

  const handleAddressSelect = (suggestion: AddressSuggestion) => {
    setFormData((prev) => ({
      ...prev,
      address: suggestion.label,
      postalCode: suggestion.postcode,
      city: suggestion.city,
      geopoint: suggestion.coordinates,
    }));
    setErrors((prev) => ({ ...prev, address: '', postalCode: '', city: '' }));
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name?.trim()) {
      newErrors.name = 'Le nom est requis';
    } else if (formData.name.length < 2) {
      newErrors.name = 'Le nom doit contenir au moins 2 caractères';
    }

    // Address required only for fixed type — must be selected from autocomplete
    if (formData.type === 'fixed') {
      if (!formData.address?.trim()) {
        newErrors.address = "L'adresse est requise";
      } else if (!formData.geopoint) {
        newErrors.address = 'Veuillez sélectionner une adresse dans la liste';
      }
    }

    if (!formData.postalCode?.trim()) {
      newErrors.postalCode = 'Le code postal est requis';
    } else if (!/^\d{5}$/.test(formData.postalCode)) {
      newErrors.postalCode = 'Le code postal doit contenir 5 chiffres';
    }

    if (!formData.city?.trim()) {
      newErrors.city = 'La ville est requise';
    } else if (formData.city.length < 2) {
      newErrors.city = 'La ville doit contenir au moins 2 caractères';
    }

    // Travel radius required for mobile type
    if (formData.type === 'mobile') {
      if (!formData.travelRadius || formData.travelRadius < 1) {
        newErrors.travelRadius = 'Le rayon de déplacement est requis';
      } else if (formData.travelRadius > 100) {
        newErrors.travelRadius = 'Le rayon ne peut pas dépasser 100 km';
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
    if (!location || !onDelete) return;

    setDeleting(true);
    try {
      await onDelete(location.id);
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

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-lg">
      <form onSubmit={handleSubmit} className="flex flex-col overflow-hidden max-h-[inherit]">
        <ModalHeader
          title={isEditing ? 'Modifier le lieu' : 'Nouveau lieu'}
          onClose={onClose}
        />

        <ModalBody className="space-y-5">
          {/* Type selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Type de lieu
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleTypeChange('fixed')}
                className={`
                  flex items-center gap-3 p-4 rounded-xl border-2 transition-all
                  ${formData.type === 'fixed'
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'}
                `}
              >
                <div className={`
                  w-10 h-10 rounded-lg flex items-center justify-center
                  ${formData.type === 'fixed'
                    ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-600 dark:text-primary-400'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'}
                `}>
                  <Building2 className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <p className={`font-medium ${formData.type === 'fixed' ? 'text-primary-700 dark:text-primary-300' : 'text-gray-900 dark:text-white'}`}>
                    Lieu fixe
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Salon, cabinet...
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleTypeChange('mobile')}
                className={`
                  flex items-center gap-3 p-4 rounded-xl border-2 transition-all
                  ${formData.type === 'mobile'
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'}
                `}
              >
                <div className={`
                  w-10 h-10 rounded-lg flex items-center justify-center
                  ${formData.type === 'mobile'
                    ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-600 dark:text-primary-400'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'}
                `}>
                  <Car className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <p className={`font-medium ${formData.type === 'mobile' ? 'text-primary-700 dark:text-primary-300' : 'text-gray-900 dark:text-white'}`}>
                    Déplacement
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    A domicile
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Name */}
          <Input
            label="Nom du lieu"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder={formData.type === 'fixed' ? 'Ex: Mon salon' : 'Ex: A domicile'}
            error={errors.name}
            required
          />

          {/* Address - only for fixed type */}
          {formData.type === 'fixed' && (
            <AddressAutocomplete
              label="Adresse"
              value={formData.address}
              onChange={(value) => {
                setFormData((prev) => ({
                  ...prev,
                  address: value,
                  postalCode: '',
                  city: '',
                  geopoint: null,
                }));
                setErrors((prev) => ({ ...prev, address: '' }));
              }}
              onSelect={handleAddressSelect}
              placeholder="Ex: 12 rue de la Paix"
              error={errors.address}
              required
            />
          )}

          {/* City and Postal Code */}
          <div className="grid grid-cols-3 gap-4">
            <Input
              label="Code postal"
              name="postalCode"
              value={formData.postalCode}
              onChange={formData.type === 'fixed' ? undefined : handleChange}
              readOnly={formData.type === 'fixed'}
              placeholder="75001"
              error={errors.postalCode}
              required
              maxLength={5}
              className={formData.type === 'fixed' ? 'bg-gray-50 dark:bg-gray-900 cursor-default' : ''}
            />

            <div className="col-span-2">
              <Input
                label={formData.type === 'fixed' ? 'Ville' : 'Zone centrale'}
                name="city"
                value={formData.city}
                onChange={formData.type === 'fixed' ? undefined : handleChange}
                readOnly={formData.type === 'fixed'}
                placeholder="Paris"
                error={errors.city}
                required
                className={formData.type === 'fixed' ? 'bg-gray-50 dark:bg-gray-900 cursor-default' : ''}
              />
            </div>
          </div>

          {/* Travel radius - only for mobile type */}
          {formData.type === 'mobile' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Rayon de deplacement
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min="1"
                  max="50"
                  value={formData.travelRadius || 15}
                  onChange={handleRadiusChange}
                  className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary-600"
                />
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={formData.travelRadius || ''}
                    onChange={handleRadiusChange}
                    className="w-16 px-2 py-1.5 text-center text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                  <span className="text-sm text-gray-500 dark:text-gray-400">km</span>
                </div>
              </div>
              {errors.travelRadius && (
                <p className="mt-1.5 text-sm text-error-600 dark:text-error-400">
                  {errors.travelRadius}
                </p>
              )}
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Zone de deplacement autour de {formData.city || 'la ville'}
              </p>
            </div>
          )}

          {/* Description */}
          <Textarea
            label="Description"
            name="description"
            value={formData.description || ''}
            onChange={handleChange}
            placeholder={formData.type === 'mobile' ? 'Ex: Frais de deplacement : 10€' : 'Ex: Parking gratuit disponible'}
            rows={3}
            hint="Optionnel - informations complementaires"
          />

          {/* Default checkbox */}
          <Checkbox
            name="isDefault"
            checked={formData.isDefault}
            onChange={handleCheckboxChange}
            label="Définir comme lieu principal"
            disabled={location?.isDefault}
            description={location?.isDefault ? 'Ce lieu est déjà le lieu principal' : undefined}
          />

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
              {showDeleteConfirm ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Confirmer ?</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowDeleteConfirm(false)}
                    disabled={deleting}
                  >
                    Non
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleDelete}
                    disabled={deleting}
                    className="text-error-600 hover:text-error-700"
                  >
                    {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Oui, supprimer'}
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="text-error-600 hover:text-error-700"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Supprimer
                </Button>
              )}
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
              'Enregistrer'
            )}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
