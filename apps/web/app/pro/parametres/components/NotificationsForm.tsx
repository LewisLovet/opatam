'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Switch, Button, Checkbox } from '@/components/ui';
import { providerService } from '@booking-app/firebase';
import { Loader2, Bell, Clock, Info, Mail, Smartphone } from 'lucide-react';
import type { ProviderNotificationPreferences } from '@booking-app/shared';

interface NotificationsFormProps {
  onSuccess?: () => void;
}

const REMINDER_OPTIONS = [
  { value: 24, label: '24 heures avant' },
  { value: 2, label: '2 heures avant' },
];

const DEFAULT_PREFS: ProviderNotificationPreferences = {
  pushEnabled: true,
  emailEnabled: true,
  newBookingNotifications: true,
  confirmationNotifications: true,
  cancellationNotifications: true,
  reminderNotifications: true,
};

export function NotificationsForm({ onSuccess }: NotificationsFormProps) {
  const { provider, refreshProvider } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [reminderTimes, setReminderTimes] = useState<number[]>([24]);
  const [prefs, setPrefs] = useState<ProviderNotificationPreferences>(DEFAULT_PREFS);

  // Initialize form with provider data
  useEffect(() => {
    if (provider?.settings) {
      setReminderTimes(provider.settings.reminderTimes || [24]);
      setPrefs(provider.settings.notificationPreferences ?? DEFAULT_PREFS);
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

  const updatePref = (key: keyof ProviderNotificationPreferences, value: boolean) => {
    setPrefs((prev) => ({ ...prev, [key]: value }));
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
      await providerService.updateSettings(provider.id, {
        reminderTimes,
        notificationPreferences: prefs,
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

  const NOTIF_TYPES = [
    { key: 'newBookingNotifications' as const, label: 'Nouvelle réservation', desc: 'Quand un client réserve un créneau' },
    { key: 'confirmationNotifications' as const, label: 'Confirmation', desc: 'Quand une réservation est confirmée' },
    { key: 'cancellationNotifications' as const, label: 'Annulation', desc: 'Quand une réservation est annulée' },
    { key: 'reminderNotifications' as const, label: 'Rappels', desc: 'Rappels avant les rendez-vous' },
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Master toggles */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
          Canaux de notification
        </h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
            <div className="flex items-center gap-3">
              <Smartphone className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Notifications push</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Sur votre téléphone via l&apos;app mobile</p>
              </div>
            </div>
            <Switch
              checked={prefs.pushEnabled}
              onChange={(checked) => updatePref('pushEnabled', checked)}
            />
          </div>
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
            <div className="flex items-center gap-3">
              <Mail className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Notifications email</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Par email à votre adresse de compte</p>
              </div>
            </div>
            <Switch
              checked={prefs.emailEnabled}
              onChange={(checked) => updatePref('emailEnabled', checked)}
            />
          </div>
        </div>
      </div>

      {/* Per-type toggles */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
          Types de notification
        </h3>
        <div className="space-y-3">
          {NOTIF_TYPES.map(({ key, label, desc }) => (
            <div key={key} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{desc}</p>
              </div>
              <Switch
                checked={prefs[key]}
                onChange={(checked) => updatePref(key, checked)}
                disabled={!prefs.pushEnabled && !prefs.emailEnabled}
              />
            </div>
          ))}
        </div>
        {!prefs.pushEnabled && !prefs.emailEnabled && (
          <p className="text-sm text-warning-600 dark:text-warning-400">
            Activez au moins un canal (push ou email) pour recevoir des notifications.
          </p>
        )}
      </div>

      {/* Reminder Times */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
            Rappels automatiques aux clients
          </h3>
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
          <p className="font-medium">À propos des notifications</p>
          <p className="mt-1 text-blue-600 dark:text-blue-400">
            Les notifications vous informent en temps réel des nouvelles réservations,
            annulations et rappels. Les rappels sont envoyés automatiquement à vos clients.
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
