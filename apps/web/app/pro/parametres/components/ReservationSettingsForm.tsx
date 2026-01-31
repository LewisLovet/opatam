'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Select, Button } from '@/components/ui';
import { providerService } from '@booking-app/firebase';
import { Loader2, Clock, Calendar, Info } from 'lucide-react';

interface ReservationSettingsFormProps {
  onSuccess?: () => void;
}

const MIN_BOOKING_NOTICE_OPTIONS = [
  { value: '0', label: 'Pas de delai minimum' },
  { value: '1', label: '1 heure' },
  { value: '2', label: '2 heures' },
  { value: '4', label: '4 heures' },
  { value: '6', label: '6 heures' },
  { value: '12', label: '12 heures' },
  { value: '24', label: '24 heures (1 jour)' },
  { value: '48', label: '48 heures (2 jours)' },
  { value: '72', label: '72 heures (3 jours)' },
  { value: '168', label: '168 heures (7 jours)' },
];

const MAX_BOOKING_ADVANCE_OPTIONS = [
  { value: '7', label: '7 jours' },
  { value: '14', label: '14 jours' },
  { value: '30', label: '30 jours (1 mois)' },
  { value: '60', label: '60 jours (2 mois)' },
  { value: '90', label: '90 jours (3 mois)' },
  { value: '180', label: '180 jours (6 mois)' },
  { value: '365', label: '365 jours (1 an)' },
];

export function ReservationSettingsForm({ onSuccess }: ReservationSettingsFormProps) {
  const { provider, refreshProvider } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    minBookingNotice: 2,
    maxBookingAdvance: 60,
  });

  // Initialize form with provider data
  useEffect(() => {
    if (provider?.settings) {
      setFormData({
        minBookingNotice: provider.settings.minBookingNotice ?? 2,
        maxBookingAdvance: provider.settings.maxBookingAdvance ?? 60,
      });
    }
  }, [provider]);

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: parseInt(value, 10) }));
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
          minBookingNotice: formData.minBookingNotice,
          maxBookingAdvance: formData.maxBookingAdvance,
          // Always allow cancellation (no deadline restriction)
          allowClientCancellation: true,
          cancellationDeadline: 0,
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
      {/* Min Booking Notice */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Delai minimum de reservation
          </label>
        </div>
        <Select
          name="minBookingNotice"
          value={formData.minBookingNotice.toString()}
          onChange={handleSelectChange}
          options={MIN_BOOKING_NOTICE_OPTIONS}
          hint="Combien de temps a l'avance un client doit reserver"
        />
      </div>

      {/* Max Booking Advance */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Delai maximum de reservation
          </label>
        </div>
        <Select
          name="maxBookingAdvance"
          value={formData.maxBookingAdvance.toString()}
          onChange={handleSelectChange}
          options={MAX_BOOKING_ADVANCE_OPTIONS}
          hint="Jusqu'a combien de temps a l'avance un client peut reserver"
        />
      </div>

      {/* Info Box */}
      <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-700 dark:text-blue-300">
          <p className="font-medium">A propos de ces parametres</p>
          <p className="mt-1 text-blue-600 dark:text-blue-400">
            Ces regles s'appliquent a toutes les nouvelles reservations.
            Les reservations existantes ne sont pas affectees par ces changements.
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
          Parametres de reservation mis a jour avec succes
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
