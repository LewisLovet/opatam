'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Switch, Button, Checkbox } from '@/components/ui';
import { providerService } from '@booking-app/firebase';
import { Loader2, Bell, Clock, Info } from 'lucide-react';

interface NotificationsFormProps {
  onSuccess?: () => void;
}

const REMINDER_OPTIONS = [
  { value: 24, label: '24 heures avant' },
  { value: 12, label: '12 heures avant' },
  { value: 6, label: '6 heures avant' },
  { value: 2, label: '2 heures avant' },
  { value: 1, label: '1 heure avant' },
];

export function NotificationsForm({ onSuccess }: NotificationsFormProps) {
  const { provider, refreshProvider } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [reminderTimes, setReminderTimes] = useState<number[]>([24]);

  // Initialize form with provider data
  useEffect(() => {
    if (provider?.settings) {
      setReminderTimes(provider.settings.reminderTimes || [24]);
    }
  }, [provider]);

  const handleReminderToggle = (value: number, checked: boolean) => {
    setReminderTimes((prev) => {
      if (checked) {
        return [...prev, value].sort((a, b) => b - a);
      }
      return prev.filter((v) => v !== value);
    });
    setError(null);
    setSuccess(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!provider) return;

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      await providerService.updateProvider(provider.id, {
        settings: {
          ...provider.settings,
          reminderTimes,
        },
      });

      await refreshProvider();
      setSuccess(true);
      onSuccess?.();
    } catch (err) {
      console.error('Update error:', err);
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Reminder Times */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Rappels automatiques aux clients
          </label>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Sélectionnez quand envoyer des rappels par email aux clients avant leur rendez-vous.
        </p>

        <div className="space-y-3 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
          {REMINDER_OPTIONS.map((option) => (
            <div key={option.value} className="flex items-center gap-3">
              <Checkbox
                id={`reminder-${option.value}`}
                checked={reminderTimes.includes(option.value)}
                onChange={(e) => handleReminderToggle(option.value, e.target.checked)}
              />
              <label
                htmlFor={`reminder-${option.value}`}
                className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer"
              >
                <Clock className="w-4 h-4 text-gray-400" />
                {option.label}
              </label>
            </div>
          ))}
        </div>

        {reminderTimes.length === 0 && (
          <p className="text-sm text-warning-600 dark:text-warning-400">
            Aucun rappel ne sera envoyé aux clients.
          </p>
        )}
      </div>

      {/* Info Box */}
      <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-700 dark:text-blue-300">
          <p className="font-medium">À propos des rappels</p>
          <p className="mt-1 text-blue-600 dark:text-blue-400">
            Les rappels sont envoyés automatiquement par email aux clients.
            Vous recevez également une notification pour chaque nouvelle réservation.
          </p>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-error-50 dark:bg-error-900/20 text-error-700 dark:text-error-400 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Success Message */}
      {success && (
        <div className="p-4 bg-success-50 dark:bg-success-900/20 text-success-700 dark:text-success-400 rounded-lg text-sm">
          Paramètres de notifications mis à jour avec succès
        </div>
      )}

      {/* Submit Button */}
      <div className="flex justify-end">
        <Button type="submit" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Enregistrement...
            </>
          ) : (
            'Enregistrer'
          )}
        </Button>
      </div>
    </form>
  );
}
