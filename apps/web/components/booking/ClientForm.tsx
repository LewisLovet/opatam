'use client';

import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
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
  submitLabel,
  className = '',
}: ClientFormProps) {
  const t = useTranslations('booking.clientForm');
  const tConfirm = useTranslations('booking.confirm');
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
      newErrors.firstName = t('firstNameRequired');
    }

    if (!formData.lastName.trim()) {
      newErrors.lastName = t('lastNameRequired');
    }

    if (!formData.email.trim()) {
      newErrors.email = t('emailRequired');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = t('emailInvalid');
    }

    if (!formData.phone.trim()) {
      newErrors.phone = t('phoneRequired');
    } else if (!/^[\d\s+()-]{10,}$/.test(formData.phone.replace(/\s/g, ''))) {
      newErrors.phone = t('phoneInvalid');
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
          label={t('firstNameLabel')}
          type="text"
          value={formData.firstName}
          onChange={handleChange('firstName')}
          error={errors.firstName}
          placeholder={t('firstNamePlaceholder')}
          required
        />
        <Input
          label={t('lastNameLabel')}
          type="text"
          value={formData.lastName}
          onChange={handleChange('lastName')}
          error={errors.lastName}
          placeholder={t('lastNamePlaceholder')}
          required
        />
      </div>

      <Input
        label={t('emailLabel')}
        type="email"
        value={formData.email}
        onChange={handleChange('email')}
        error={errors.email}
        placeholder={t('emailPlaceholder')}
        required
      />

      <Input
        label={t('phoneLabel')}
        type="tel"
        value={formData.phone}
        onChange={handleChange('phone')}
        error={errors.phone}
        placeholder={t('phonePlaceholder')}
        required
      />

      {showNotes && (
        <Textarea
          label={t('notesLabel')}
          value={formData.notes}
          onChange={handleChange('notes')}
          placeholder={t('notesPlaceholder')}
          rows={3}
        />
      )}

      <div className="pt-4">
        <Button type="submit" fullWidth loading={loading} size="lg">
          {submitLabel ?? tConfirm('submit')}
        </Button>
      </div>

      <p className="text-xs text-center text-gray-500 dark:text-gray-400">
        {t.rich('terms', {
          cgv: (chunks) => (
            <a href="/cgv" className="text-primary-600 dark:text-primary-400 hover:underline">
              {chunks}
            </a>
          ),
          privacy: (chunks) => (
            <a href="/confidentialite" className="text-primary-600 dark:text-primary-400 hover:underline">
              {chunks}
            </a>
          ),
        })}
      </p>
    </form>
  );
}
