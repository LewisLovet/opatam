'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Select, Button, Textarea, Switch } from '@/components/ui';
import { providerService } from '@booking-app/firebase';
import {
  Loader2,
  Clock,
  Calendar,
  Info,
  Timer,
  MessageSquareWarning,
  Star,
  Sparkles,
} from 'lucide-react';
import { useNewFeatures } from '@/hooks/useNewFeatures';

interface ReservationSettingsFormProps {
  onSuccess?: () => void;
}

const MIN_BOOKING_NOTICE_OPTIONS = [
  { value: '0', label: 'Pas de délai minimum' },
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

const SLOT_INTERVAL_OPTIONS = [
  { value: '5', label: '5 minutes' },
  { value: '10', label: '10 minutes' },
  { value: '15', label: '15 minutes' },
  { value: '20', label: '20 minutes' },
  { value: '30', label: '30 minutes' },
  { value: '45', label: '45 minutes' },
  { value: '60', label: '1 heure' },
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
  const { isNew, markSeen } = useNewFeatures();
  const showAutoReviewNew = isNew('auto-review-2026-05');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    minBookingNotice: 2,
    maxBookingAdvance: 60,
    slotInterval: 15,
    bookingNotice: '',
    // Default true (opt-out behaviour) — matches the schema and
    // the mobile booking-settings screen. Provider can flip the
    // toggle to disable the cron sending.
    autoReviewReminder: true,
  });

  // Initialize form with provider data
  useEffect(() => {
    if (provider?.settings) {
      setFormData({
        minBookingNotice: provider.settings.minBookingNotice ?? 2,
        maxBookingAdvance: provider.settings.maxBookingAdvance ?? 60,
        slotInterval: provider.settings.slotInterval ?? 15,
        bookingNotice: provider.settings.bookingNotice ?? '',
        autoReviewReminder: provider.settings.autoReviewReminder ?? true,
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
          slotInterval: formData.slotInterval,
          bookingNotice: formData.bookingNotice.trim() || null,
          autoReviewReminder: formData.autoReviewReminder,
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
            Délai minimum de réservation
          </label>
        </div>
        <Select
          name="minBookingNotice"
          value={formData.minBookingNotice.toString()}
          onChange={handleSelectChange}
          options={MIN_BOOKING_NOTICE_OPTIONS}
          hint="Combien de temps à l'avance un client doit réserver"
        />
      </div>

      {/* Max Booking Advance */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Délai maximum de réservation
          </label>
        </div>
        <Select
          name="maxBookingAdvance"
          value={formData.maxBookingAdvance.toString()}
          onChange={handleSelectChange}
          options={MAX_BOOKING_ADVANCE_OPTIONS}
          hint="Jusqu'à combien de temps à l'avance un client peut réserver"
        />
      </div>

      {/* Slot Interval */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Timer className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Intervalle entre les créneaux
          </label>
        </div>
        <Select
          name="slotInterval"
          value={formData.slotInterval.toString()}
          onChange={handleSelectChange}
          options={SLOT_INTERVAL_OPTIONS}
          hint="Fréquence des créneaux proposés aux clients (ex : toutes les 15 min)"
        />
      </div>

      {/* Booking Notice */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <MessageSquareWarning className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Avertissement avant reservation
          </label>
        </div>
        <Textarea
          name="bookingNotice"
          value={formData.bookingNotice}
          onChange={(e) => {
            setFormData((prev) => ({ ...prev, bookingNotice: e.target.value }));
            setError(null);
            setSuccess(false);
          }}
          placeholder="Ex: Merci d'arriver 5 minutes avant votre rendez-vous. En cas d'annulation tardive, des frais pourront s'appliquer."
          rows={3}
          hint="Ce message sera affiche aux clients avant la confirmation de leur reservation (max 1000 caracteres)"
        />
        <p className="text-xs text-gray-400 text-right">
          {formData.bookingNotice.length}/1000
        </p>
      </div>

      {/* Auto review reminder toggle */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-2 flex-1 min-w-0">
            <Star className="w-4 h-4 text-gray-500 dark:text-gray-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Relance automatique des avis
                </label>
                {showAutoReviewNew && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-primary-500 text-white shadow-sm">
                    <Sparkles className="w-3 h-3" />
                    Nouveau
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Email envoyé 1h après le RDV pour demander un avis.
                Ne fonctionne que pour les RDV confirmés.
              </p>
            </div>
          </div>
          <Switch
            checked={formData.autoReviewReminder}
            onChange={(e) => {
              const next = e.target.checked;
              setFormData((p) => ({ ...p, autoReviewReminder: next }));
              setError(null);
              setSuccess(false);
              if (showAutoReviewNew) markSeen('auto-review-2026-05');
            }}
          />
        </div>
      </div>

      {/* Info Box */}
      <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-700 dark:text-blue-300">
          <p className="font-medium">À propos de ces paramètres</p>
          <p className="mt-1 text-blue-600 dark:text-blue-400">
            Ces règles s'appliquent à toutes les nouvelles réservations.
            Les réservations existantes ne sont pas affectées par ces changements.
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
          Paramètres de réservation mis à jour avec succès
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
