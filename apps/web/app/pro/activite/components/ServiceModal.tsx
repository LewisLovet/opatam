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
  Select,
} from '@/components/ui';
import { Loader2, Trash2 } from 'lucide-react';
import type { Service, ServiceCategory, Location, Member } from '@booking-app/shared';

type WithId<T> = { id: string } & T;

interface ServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  service?: WithId<Service> | null;
  locations: WithId<Location>[];
  members: WithId<Member>[];
  categories: WithId<ServiceCategory>[];
  isTeamPlan: boolean;
  onSave: (data: ServiceFormData) => Promise<void>;
  onDelete?: (serviceId: string) => Promise<void>;
}

export interface ServiceFormData {
  name: string;
  description: string | null;
  duration: number;
  price: number; // in cents
  bufferTime: number;
  categoryId: string | null;
  locationIds: string[];
  memberIds: string[] | null;
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
  onSave,
  onDelete,
}: ServiceModalProps) {
  const isEditing = !!service;
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState<ServiceFormData>({
    name: '',
    description: null,
    duration: 60,
    price: 0,
    bufferTime: 0,
    categoryId: null,
    locationIds: [],
    memberIds: null,
  });

  // Initialize form when modal opens or service changes
  useEffect(() => {
    if (isOpen) {
      if (service) {
        setFormData({
          name: service.name,
          description: service.description,
          duration: service.duration,
          price: service.price,
          bufferTime: service.bufferTime,
          categoryId: service.categoryId ?? null,
          locationIds: service.locationIds,
          memberIds: service.memberIds,
        });
      } else {
        // Default values for new service
        setFormData({
          name: '',
          description: null,
          duration: 60,
          price: 0,
          bufferTime: 0,
          categoryId: null,
          locationIds: locations.length > 0 ? [locations[0].id] : [],
          memberIds: null,
        });
      }
      setErrors({});
      setShowDeleteConfirm(false);
    }
  }, [isOpen, service, locations]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        name === 'duration' || name === 'bufferTime'
          ? parseInt(value, 10)
          : name === 'price'
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

    if (formData.locationIds.length === 0) {
      newErrors.locationIds = 'Sélectionnez au moins un lieu';
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
              label="Prix (EUR)"
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
          </div>

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
                        {location.address}, {location.city}
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
              'Créer'
            )}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
