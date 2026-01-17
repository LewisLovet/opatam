'use client';

import { useState, type FormEvent } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';

interface ClientFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  notes?: string;
}

interface ClientFormProps {
  onSubmit: (data: ClientFormData) => void;
  loading?: boolean;
  initialData?: Partial<ClientFormData>;
  showNotes?: boolean;
  submitLabel?: string;
  className?: string;
}

export function ClientForm({
  onSubmit,
  loading = false,
  initialData,
  showNotes = true,
  submitLabel = 'Confirmer la réservation',
  className = '',
}: ClientFormProps) {
  const [formData, setFormData] = useState<ClientFormData>({
    firstName: initialData?.firstName || '',
    lastName: initialData?.lastName || '',
    email: initialData?.email || '',
    phone: initialData?.phone || '',
    notes: initialData?.notes || '',
  });

  const [errors, setErrors] = useState<Partial<Record<keyof ClientFormData, string>>>({});

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof ClientFormData, string>> = {};

    if (!formData.firstName.trim()) {
      newErrors.firstName = 'Le prénom est requis';
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Le nom est requis';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'L\'email est requis';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Email invalide';
    }

    if (!formData.phone.trim()) {
      newErrors.phone = 'Le téléphone est requis';
    } else if (!/^[\d\s+()-]{10,}$/.test(formData.phone.replace(/\s/g, ''))) {
      newErrors.phone = 'Numéro de téléphone invalide';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      onSubmit(formData);
    }
  };

  const handleChange = (field: keyof ClientFormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  return (
    <form onSubmit={handleSubmit} className={`space-y-4 ${className}`}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="Prénom"
          type="text"
          value={formData.firstName}
          onChange={handleChange('firstName')}
          error={errors.firstName}
          placeholder="Jean"
          required
        />
        <Input
          label="Nom"
          type="text"
          value={formData.lastName}
          onChange={handleChange('lastName')}
          error={errors.lastName}
          placeholder="Dupont"
          required
        />
      </div>

      <Input
        label="Email"
        type="email"
        value={formData.email}
        onChange={handleChange('email')}
        error={errors.email}
        placeholder="jean.dupont@example.com"
        required
      />

      <Input
        label="Téléphone"
        type="tel"
        value={formData.phone}
        onChange={handleChange('phone')}
        error={errors.phone}
        placeholder="06 12 34 56 78"
        required
      />

      {showNotes && (
        <Textarea
          label="Notes (optionnel)"
          value={formData.notes}
          onChange={handleChange('notes')}
          placeholder="Informations complémentaires..."
          rows={3}
        />
      )}

      <div className="pt-4">
        <Button type="submit" fullWidth loading={loading} size="lg">
          {submitLabel}
        </Button>
      </div>

      <p className="text-xs text-center text-gray-500 dark:text-gray-400">
        En confirmant, vous acceptez nos{' '}
        <a href="/cgv" className="text-primary-600 dark:text-primary-400 hover:underline">
          conditions générales
        </a>{' '}
        et notre{' '}
        <a href="/confidentialite" className="text-primary-600 dark:text-primary-400 hover:underline">
          politique de confidentialité
        </a>
        .
      </p>
    </form>
  );
}
