'use client';

import { useState } from 'react';
import { Modal, ModalHeader, ModalBody, ModalFooter, Button, Input } from '@/components/ui';
import { schedulingService } from '@booking-app/firebase';
import type { Availability, AvailabilityConflict, TimeSlot, Member, Location } from '@booking-app/shared';
import { Loader2, AlertTriangle, Calendar, Clock, User, MapPin } from 'lucide-react';

type WithId<T> = { id: string } & T;

interface DaySchedule {
  dayOfWeek: number;
  isOpen: boolean;
  slots: TimeSlot[];
}

interface AvailabilityChangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  providerId: string;
  member: WithId<Member>;
  location: WithId<Location>;
  currentSchedule: DaySchedule[];
  newSchedule: DaySchedule[];
  onSuccess: () => void;
}

const DAY_NAMES = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

export function AvailabilityChangeModal({
  isOpen,
  onClose,
  providerId,
  member,
  location,
  currentSchedule,
  newSchedule,
  onSuccess,
}: AvailabilityChangeModalProps) {
  const [step, setStep] = useState<'date' | 'conflicts' | 'confirm'>('date');
  const [effectiveDate, setEffectiveDate] = useState<string>('');
  const [conflicts, setConflicts] = useState<AvailabilityConflict[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get minimum date (tomorrow)
  const getMinDate = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  };

  // Find what days have changed
  const getChangedDays = (): number[] => {
    const changedDays: number[] = [];
    for (const newDay of newSchedule) {
      const currentDay = currentSchedule.find((d) => d.dayOfWeek === newDay.dayOfWeek);
      if (!currentDay) {
        changedDays.push(newDay.dayOfWeek);
        continue;
      }

      // Check if isOpen changed
      if (currentDay.isOpen !== newDay.isOpen) {
        changedDays.push(newDay.dayOfWeek);
        continue;
      }

      // Check if slots changed
      const currentSlots = JSON.stringify(currentDay.slots);
      const newSlots = JSON.stringify(newDay.slots);
      if (currentSlots !== newSlots) {
        changedDays.push(newDay.dayOfWeek);
      }
    }
    return changedDays;
  };

  const changedDays = getChangedDays();

  // Check for conflicts
  const handleCheckConflicts = async () => {
    if (!effectiveDate) {
      setError('Veuillez selectionner une date d\'effet');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const effectiveDateObj = new Date(effectiveDate);
      effectiveDateObj.setHours(0, 0, 0, 0);

      const allConflicts: AvailabilityConflict[] = [];

      // Check conflicts for each changed day
      for (const dayOfWeek of changedDays) {
        const newDay = newSchedule.find((d) => d.dayOfWeek === dayOfWeek);
        if (!newDay) continue;

        const dayConflicts = await schedulingService.detectConflicts(
          providerId,
          member.id,
          dayOfWeek,
          newDay.slots,
          newDay.isOpen,
          effectiveDateObj
        );

        allConflicts.push(...dayConflicts);
      }

      setConflicts(allConflicts);
      setStep(allConflicts.length > 0 ? 'conflicts' : 'confirm');
    } catch (err) {
      console.error('Error checking conflicts:', err);
      setError(err instanceof Error ? err.message : 'Erreur lors de la verification');
    } finally {
      setLoading(false);
    }
  };

  // Save scheduled changes
  const handleSave = async () => {
    if (!effectiveDate) return;

    setLoading(true);
    setError(null);

    try {
      const effectiveDateObj = new Date(effectiveDate);
      effectiveDateObj.setHours(0, 0, 0, 0);

      // Save each changed day with effectiveFrom
      for (const dayOfWeek of changedDays) {
        const newDay = newSchedule.find((d) => d.dayOfWeek === dayOfWeek);
        if (!newDay) continue;

        await schedulingService.setScheduledAvailability(providerId, {
          memberId: member.id,
          locationId: location.id,
          dayOfWeek: newDay.dayOfWeek,
          isOpen: newDay.isOpen,
          slots: newDay.slots,
          effectiveFrom: effectiveDateObj,
        });
      }

      onSuccess();
      handleClose();
    } catch (err) {
      console.error('Error saving scheduled changes:', err);
      setError(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setStep('date');
    setEffectiveDate('');
    setConflicts([]);
    setError(null);
    onClose();
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(date);
  };

  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose}>
      <ModalHeader onClose={handleClose}>
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-primary-600 dark:text-primary-400" />
          <span>Planifier le changement</span>
        </div>
      </ModalHeader>

      <ModalBody>
        {/* Context info */}
        <div className="mb-6 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg space-y-2">
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <User className="w-4 h-4" />
            <span>{member.name}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <MapPin className="w-4 h-4" />
            <span>{location.name}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <Clock className="w-4 h-4" />
            <span>{changedDays.length} jour(s) modifie(s): {changedDays.map((d) => DAY_NAMES[d]).join(', ')}</span>
          </div>
        </div>

        {/* Step 1: Select date */}
        {step === 'date' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Sélectionnez la date à partir de laquelle les nouveaux horaires seront appliqués.
            </p>
            <Input
              type="date"
              label="Date d'effet"
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
              min={getMinDate()}
              hint="Le changement sera actif à partir de cette date"
            />
          </div>
        )}

        {/* Step 2: Show conflicts */}
        {step === 'conflicts' && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 bg-warning-50 dark:bg-warning-900/20 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-warning-600 dark:text-warning-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-warning-800 dark:text-warning-200">
                  {conflicts.length} réservation(s) en conflit
                </p>
                <p className="text-sm text-warning-700 dark:text-warning-300 mt-1">
                  Ces réservations tombent en dehors des nouveaux horaires.
                  Vous devrez les replanifier ou les annuler manuellement.
                </p>
              </div>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {conflicts.map((conflict, index) => (
                <div
                  key={`${conflict.bookingId}-${index}`}
                  className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {conflict.clientName}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {conflict.serviceName}
                      </p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      conflict.conflictType === 'day_closed'
                        ? 'bg-error-100 text-error-700 dark:bg-error-900/30 dark:text-error-400'
                        : 'bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-400'
                    }`}>
                      {conflict.conflictType === 'day_closed' ? 'Jour fermé' : 'Hors horaires'}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                    {formatDate(conflict.bookingDate)} à {formatTime(conflict.bookingDate)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Confirm */}
        {step === 'confirm' && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-4 bg-success-50 dark:bg-success-900/20 rounded-lg">
              <Calendar className="w-5 h-5 text-success-600 dark:text-success-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-success-800 dark:text-success-200">
                  Aucun conflit détecté
                </p>
                <p className="text-sm text-success-700 dark:text-success-300 mt-1">
                  Le changement peut être planifié sans affecter les réservations existantes.
                </p>
              </div>
            </div>

            <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Les nouveaux horaires seront appliques a partir du:
              </p>
              <p className="font-medium text-gray-900 dark:text-white mt-1">
                {effectiveDate && formatDate(new Date(effectiveDate))}
              </p>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-4 p-3 bg-error-50 dark:bg-error-900/20 text-error-700 dark:text-error-400 rounded-lg text-sm">
            {error}
          </div>
        )}
      </ModalBody>

      <ModalFooter>
        <Button variant="ghost" onClick={handleClose} disabled={loading}>
          Annuler
        </Button>

        {step === 'date' && (
          <Button onClick={handleCheckConflicts} disabled={loading || !effectiveDate}>
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Verification...
              </>
            ) : (
              'Verifier les conflits'
            )}
          </Button>
        )}

        {step === 'conflicts' && (
          <Button onClick={handleSave} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Enregistrement...
              </>
            ) : (
              'Planifier quand meme'
            )}
          </Button>
        )}

        {step === 'confirm' && (
          <Button onClick={handleSave} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Enregistrement...
              </>
            ) : (
              'Confirmer'
            )}
          </Button>
        )}
      </ModalFooter>
    </Modal>
  );
}
