'use client';

import { useState, useEffect } from 'react';
import {
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
} from '@/components/ui';
import { Loader2, Trash2 } from 'lucide-react';
import type { ServiceCategory } from '@booking-app/shared';

type WithId<T> = { id: string } & T;

export interface CategoryFormData {
  name: string;
}

interface CategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  category?: WithId<ServiceCategory> | null;
  onSave: (data: CategoryFormData) => Promise<void>;
  onDelete?: (categoryId: string) => Promise<void>;
}

export function CategoryModal({
  isOpen,
  onClose,
  category,
  onSave,
  onDelete,
}: CategoryModalProps) {
  const isEditing = !!category;
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState<CategoryFormData>({
    name: '',
  });

  // Initialize form when modal opens or category changes
  useEffect(() => {
    if (isOpen) {
      if (category) {
        setFormData({ name: category.name });
      } else {
        setFormData({ name: '' });
      }
      setErrors({});
      setShowDeleteConfirm(false);
    }
  }, [isOpen, category]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Le nom est requis';
    } else if (formData.name.length > 50) {
      newErrors.name = 'Le nom ne peut pas dépasser 50 caractères';
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
    if (!category || !onDelete) return;

    setDeleting(true);
    try {
      await onDelete(category.id);
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
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-md">
      <form onSubmit={handleSubmit} className="flex flex-col overflow-hidden max-h-[inherit]">
        <ModalHeader
          title={isEditing ? 'Modifier la catégorie' : 'Nouvelle catégorie'}
          onClose={onClose}
        />

        <ModalBody className="space-y-6">
          {/* Name */}
          <Input
            label="Nom de la catégorie"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="Ex: Coupes, Colorations..."
            maxLength={50}
            error={errors.name}
            required
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
              'Créer'
            )}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
