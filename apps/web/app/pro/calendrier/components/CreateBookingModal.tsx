'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
  Select,
  useToast,
} from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { bookingService, catalogService, schedulingService } from '@booking-app/firebase';
import type { Member, Location, Service } from '@booking-app/shared';
import {
  Loader2,
  ChevronRight,
  ChevronLeft,
  User,
  MapPin,
  Calendar,
  Clock,
  Scissors,
  AlertTriangle,
  Check,
  Users,
} from 'lucide-react';

type WithId<T> = { id: string } & T;

interface CreateBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialDate?: Date | null;
  initialMemberId?: string;
  initialLocationId?: string;
  members: WithId<Member>[];
  locations: WithId<Location>[];
  isTeamPlan: boolean;
  onCreated: () => void;
}

type Step = 'service' | 'slots' | 'member' | 'client' | 'confirm';

interface SlotWithMembers {
  time: string;
  label: string;
  memberIds: string[];
  memberNames: string[];
}

interface FormData {
  locationId: string;
  serviceId: string;
  date: string;
  time: string;
  memberId: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  notes: string;
}

export function CreateBookingModal({
  isOpen,
  onClose,
  initialDate,
  initialMemberId,
  initialLocationId,
  members,
  locations,
  isTeamPlan,
  onCreated,
}: CreateBookingModalProps) {
  const { provider } = useAuth();
  const toast = useToast();

  const [step, setStep] = useState<Step>('service');
  const [loading, setLoading] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [services, setServices] = useState<WithId<Service>[]>([]);
  const [availableSlots, setAvailableSlots] = useState<SlotWithMembers[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState<FormData>({
    locationId: '',
    serviceId: '',
    date: formatDateForInput(new Date()),
    time: '',
    memberId: '',
    clientName: '',
    clientEmail: '',
    clientPhone: '',
    notes: '',
  });

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep('service');
      setFormData({
        locationId: initialLocationId || (locations.length === 1 ? locations[0].id : ''),
        serviceId: '',
        date: initialDate ? formatDateForInput(initialDate) : formatDateForInput(new Date()),
        time: initialDate ? formatTimeForSelect(initialDate) : '',
        memberId: initialMemberId || '',
        clientName: '',
        clientEmail: '',
        clientPhone: '',
        notes: '',
      });
      setErrors({});
      setAvailableSlots([]);
    }
  }, [isOpen, initialDate, initialMemberId, initialLocationId, locations]);

  // Load services when modal opens
  useEffect(() => {
    if (!provider || !isOpen) return;

    const loadServices = async () => {
      try {
        const data = await catalogService.getActiveByProvider(provider.id);
        setServices(data);
      } catch (error) {
        console.error('Error loading services:', error);
      }
    };

    loadServices();
  }, [provider, isOpen]);

  // Filter services by location
  const filteredServices = useMemo(() => {
    if (!formData.locationId) return services;
    return services.filter((s) => s.locationIds.includes(formData.locationId));
  }, [services, formData.locationId]);

  // Get members for selected location (NOUVEAU MODÈLE: 1 membre = 1 lieu)
  const locationMembers = useMemo(() => {
    if (!formData.locationId) return members;
    return members.filter((m) => m.locationId === formData.locationId);
  }, [members, formData.locationId]);

  // Load available time slots for ALL members
  // NOUVEAU MODÈLE: memberId est obligatoire, on itère toujours sur les membres
  const loadSlots = useCallback(async () => {
    if (!provider || !formData.serviceId || !formData.date || !formData.locationId) {
      setAvailableSlots([]);
      return;
    }

    // NOUVEAU MODÈLE: On doit avoir au moins un membre pour ce lieu
    if (locationMembers.length === 0) {
      console.log('[CreateBooking] No members for location', formData.locationId);
      setAvailableSlots([]);
      return;
    }

    setLoadingSlots(true);
    try {
      // Parse date correctly in local timezone
      // formData.date is "YYYY-MM-DD" string
      const [year, month, day] = formData.date.split('-').map(Number);
      const date = new Date(year, month - 1, day, 0, 0, 0, 0); // Local midnight
      const endDate = new Date(year, month - 1, day, 23, 59, 59, 999); // Local end of day

      console.log('[CreateBooking] Loading slots for:', formData.date, 'dayOfWeek:', date.getDay());

      const service = services.find((s) => s.id === formData.serviceId);
      if (!service) {
        return;
      }

      // NOUVEAU MODÈLE: Toujours itérer sur les membres du lieu (filtrés par service si applicable)
      const membersToCheck = locationMembers.filter(
        (m) => !service.memberIds || service.memberIds.includes(m.id)
      );

      if (membersToCheck.length === 0) {
        console.log('[CreateBooking] No members eligible for this service at this location');
        setAvailableSlots([]);
        setLoadingSlots(false);
        return;
      }

      const slotsByTime: Map<string, SlotWithMembers> = new Map();

      await Promise.all(
        membersToCheck.map(async (member) => {
          try {
            // NOUVEAU MODÈLE: memberId est maintenant obligatoire
            const slots = await schedulingService.getAvailableSlots({
              providerId: provider.id,
              serviceId: formData.serviceId,
              memberId: member.id,
              startDate: date,
              endDate: endDate,
            });

            console.log('[CreateBooking] Slots for member', member.id, ':', slots.length);

            slots.forEach((slot) => {
              const existing = slotsByTime.get(slot.start);
              if (existing) {
                if (!existing.memberIds.includes(member.id)) {
                  existing.memberIds.push(member.id);
                  existing.memberNames.push(member.name);
                }
              } else {
                slotsByTime.set(slot.start, {
                  time: slot.start,
                  label: slot.start,
                  memberIds: [member.id],
                  memberNames: [member.name],
                });
              }
            });
          } catch (error) {
            console.error(`[CreateBooking] Error loading slots for member ${member.id}:`, error);
          }
        })
      );

      // Sort slots by time
      const sortedSlots = Array.from(slotsByTime.values()).sort((a, b) =>
        a.time.localeCompare(b.time)
      );

      console.log('[CreateBooking] Total slots found:', sortedSlots.length);
      setAvailableSlots(sortedSlots);
    } catch (error) {
      console.error('[CreateBooking] Error loading available slots:', error);
      setAvailableSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  }, [provider, formData.serviceId, formData.date, formData.locationId, services, locationMembers]);

  // Load slots when service or date changes
  useEffect(() => {
    if (step === 'slots') {
      loadSlots();
    }
  }, [step, loadSlots]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: '' }));

    // Reset dependent fields
    if (name === 'locationId') {
      setFormData((prev) => ({ ...prev, serviceId: '', time: '', memberId: '' }));
    }
    if (name === 'date') {
      setFormData((prev) => ({ ...prev, time: '', memberId: '' }));
    }
  };

  const handleSelectSlot = (slot: SlotWithMembers) => {
    setFormData((prev) => ({ ...prev, time: slot.time }));

    // NOUVEAU MODÈLE: Il y a toujours au moins un membre
    if (slot.memberIds.length === 1) {
      // Only one member available - auto-select and skip member step
      setFormData((prev) => ({ ...prev, memberId: slot.memberIds[0] }));
      setStep('client');
    } else {
      // Multiple members available - show member selection
      setStep('member');
    }
  };

  const handleSelectMember = (memberId: string) => {
    setFormData((prev) => ({ ...prev, memberId }));
    setStep('client');
  };

  // Validation
  const validateService = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.locationId) {
      newErrors.locationId = 'Le lieu est requis';
    }
    if (!formData.serviceId) {
      newErrors.serviceId = 'La prestation est requise';
    }
    if (!formData.date) {
      newErrors.date = 'La date est requise';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateClient = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.clientName?.trim()) {
      newErrors.clientName = 'Le nom est requis';
    }
    if (!formData.clientEmail?.trim()) {
      newErrors.clientEmail = "L'email est requis";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.clientEmail)) {
      newErrors.clientEmail = "L'email n'est pas valide";
    }
    if (!formData.clientPhone?.trim()) {
      newErrors.clientPhone = 'Le téléphone est requis';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (step === 'service') {
      if (validateService()) {
        setStep('slots');
      }
    } else if (step === 'client') {
      if (validateClient()) {
        setStep('confirm');
      }
    }
  };

  const handleBack = () => {
    if (step === 'slots') setStep('service');
    else if (step === 'member') setStep('slots');
    else if (step === 'client') {
      // Go back to member if multiple members were available
      const selectedSlot = availableSlots.find((s) => s.time === formData.time);
      if (selectedSlot && selectedSlot.memberIds.length > 1) {
        setStep('member');
      } else {
        setStep('slots');
      }
    } else if (step === 'confirm') setStep('client');
  };

  const handleSubmit = async () => {
    if (!provider) return;

    setLoading(true);
    try {
      const [hours, minutes] = formData.time.split(':').map(Number);
      // Parse date correctly in local timezone (formData.date is "YYYY-MM-DD")
      const [year, month, day] = formData.date.split('-').map(Number);
      const datetime = new Date(year, month - 1, day, hours, minutes, 0, 0);

      const bookingData = {
        providerId: provider.id,
        locationId: formData.locationId,
        serviceId: formData.serviceId,
        memberId: formData.memberId || undefined,
        datetime,
        clientInfo: {
          name: formData.clientName.trim(),
          email: formData.clientEmail.trim(),
          phone: formData.clientPhone.trim(),
        },
      };

      await bookingService.createBooking(bookingData);

      // Send confirmation email
      try {
        await fetch('/api/bookings/confirmation-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clientEmail: formData.clientEmail.trim(),
            clientName: formData.clientName.trim(),
            serviceName: selectedService?.name || '',
            datetime: datetime.toISOString(),
            duration: selectedService?.duration || 0,
            price: selectedService?.price || 0,
            providerName: provider.businessName || '',
            locationName: selectedLocation?.name || '',
            locationAddress: selectedLocation?.address || '',
            memberName: selectedMember?.name,
          }),
        });
      } catch (emailError) {
        console.error('Error sending confirmation email:', emailError);
        // Don't fail the booking creation if email fails
      }

      toast.success('Rendez-vous créé avec succès');
      onCreated();
    } catch (error) {
      console.error('Error creating booking:', error);
      const message = error instanceof Error ? error.message : 'Erreur lors de la création';
      toast.error(message);
      setErrors({ submit: message });
    } finally {
      setLoading(false);
    }
  };

  const selectedService = services.find((s) => s.id === formData.serviceId);
  const selectedLocation = locations.find((l) => l.id === formData.locationId);
  const selectedMember = members.find((m) => m.id === formData.memberId);
  const selectedSlot = availableSlots.find((s) => s.time === formData.time);

  // Step progress
  // NOUVEAU MODÈLE: member step only if multiple members available for selected slot
  const steps: Step[] = selectedSlot && selectedSlot.memberIds.length > 1
    ? ['service', 'slots', 'member', 'client', 'confirm']
    : ['service', 'slots', 'client', 'confirm'];
  const currentStepIndex = steps.indexOf(step);
  const totalSteps = steps.length;

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-md">
      <ModalHeader title="Nouveau rendez-vous" onClose={onClose} />

      <ModalBody>
        {/* Step indicator */}
        <div className="flex items-center justify-center gap-1 mb-6">
          {steps.map((s, idx) => (
            <div key={s} className="flex items-center">
              <div
                className={`
                  flex items-center justify-center w-7 h-7 rounded-full text-xs font-medium
                  ${idx <= currentStepIndex ? 'bg-primary-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-500'}
                `}
              >
                {idx < currentStepIndex ? <Check className="w-4 h-4" /> : idx + 1}
              </div>
              {idx < totalSteps - 1 && (
                <div className={`w-6 h-0.5 ${idx < currentStepIndex ? 'bg-primary-500' : 'bg-gray-200 dark:bg-gray-700'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step title */}
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-4">
          {step === 'service' && 'Choisir la prestation'}
          {step === 'slots' && 'Choisir un créneau'}
          {step === 'member' && 'Choisir un membre'}
          {step === 'client' && 'Informations client'}
          {step === 'confirm' && 'Confirmation'}
        </p>

        {/* Step content */}
        <div className="space-y-4 min-h-[300px]">
          {/* Step: Service Selection */}
          {step === 'service' && (
            <>
              {/* Location */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <MapPin className="w-4 h-4 inline mr-1" />
                  Lieu <span className="text-error-500">*</span>
                </label>
                <Select
                  name="locationId"
                  value={formData.locationId}
                  onChange={handleChange}
                  error={errors.locationId}
                  placeholder="Sélectionnez un lieu"
                  options={locations.map((loc) => ({
                    value: loc.id,
                    label: loc.name,
                  }))}
                />
              </div>

              {/* Service */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <Scissors className="w-4 h-4 inline mr-1" />
                  Prestation <span className="text-error-500">*</span>
                </label>
                <Select
                  name="serviceId"
                  value={formData.serviceId}
                  onChange={handleChange}
                  error={errors.serviceId}
                  disabled={!formData.locationId}
                  placeholder="Sélectionnez une prestation"
                  options={filteredServices.map((svc) => ({
                    value: svc.id,
                    label: `${svc.name} - ${svc.duration} min - ${formatPrice(svc.price)}`,
                  }))}
                />
              </div>

              {/* Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <Calendar className="w-4 h-4 inline mr-1" />
                  Date <span className="text-error-500">*</span>
                </label>
                <Input
                  name="date"
                  type="date"
                  value={formData.date}
                  onChange={handleChange}
                  error={errors.date}
                  min={formatDateForInput(new Date())}
                />
              </div>
            </>
          )}

          {/* Step: Slot Selection */}
          {step === 'slots' && (
            <>
              {/* Selected service summary */}
              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm">
                <p className="font-medium text-gray-900 dark:text-white">{selectedService?.name}</p>
                <p className="text-gray-500 dark:text-gray-400">
                  {new Date(formData.date).toLocaleDateString('fr-FR', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                  })} • {selectedService?.duration} min • {selectedService && formatPrice(selectedService.price)}
                </p>
              </div>

              {/* Time slots */}
              {loadingSlots ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
                  <span className="ml-2 text-gray-500">Chargement des créneaux...</span>
                </div>
              ) : availableSlots.length > 0 ? (
                <div className="grid grid-cols-3 gap-2 max-h-[240px] overflow-y-auto">
                  {availableSlots.map((slot) => (
                    <button
                      key={slot.time}
                      type="button"
                      onClick={() => handleSelectSlot(slot)}
                      className={`
                        p-2 rounded-lg border text-center transition-all
                        ${formData.time === slot.time
                          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30'
                          : 'border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-600'}
                      `}
                    >
                      <span className="block font-medium text-gray-900 dark:text-white">
                        {slot.label}
                      </span>
                      {isTeamPlan && slot.memberNames.length > 0 && (
                        <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                          {slot.memberNames.length === 1
                            ? slot.memberNames[0]
                            : `${slot.memberNames.length} dispos`}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="p-4 bg-warning-50 dark:bg-warning-900/20 text-warning-700 dark:text-warning-300 rounded-lg text-center">
                  <AlertTriangle className="w-6 h-6 mx-auto mb-2" />
                  <p>Aucun créneau disponible pour cette date</p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setStep('service')}
                    className="mt-2"
                  >
                    Changer de date
                  </Button>
                </div>
              )}
            </>
          )}

          {/* Step: Member Selection */}
          {step === 'member' && (
            <>
              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm mb-4">
                <p className="font-medium text-gray-900 dark:text-white">{selectedService?.name}</p>
                <p className="text-gray-500 dark:text-gray-400">
                  {new Date(formData.date).toLocaleDateString('fr-FR', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                  })} à {formData.time}
                </p>
              </div>

              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                <Users className="w-4 h-4 inline mr-1" />
                Plusieurs membres sont disponibles pour ce créneau :
              </p>

              <div className="space-y-2">
                {selectedSlot?.memberIds.map((memberId, idx) => {
                  const member = members.find((m) => m.id === memberId);
                  if (!member) return null;

                  return (
                    <button
                      key={memberId}
                      type="button"
                      onClick={() => handleSelectMember(memberId)}
                      className={`
                        w-full p-3 rounded-lg border text-left transition-all flex items-center gap-3
                        ${formData.memberId === memberId
                          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30'
                          : 'border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-600'}
                      `}
                    >
                      <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/50 flex items-center justify-center">
                        <User className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{member.name}</p>
                        {member.email && (
                          <p className="text-xs text-gray-500 dark:text-gray-400">{member.email}</p>
                        )}
                      </div>
                      {formData.memberId === memberId && (
                        <Check className="w-5 h-5 text-primary-500 ml-auto" />
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* Step: Client Info */}
          {step === 'client' && (
            <>
              <Input
                label="Nom du client"
                name="clientName"
                value={formData.clientName}
                onChange={handleChange}
                placeholder="Ex: Marie Dupont"
                error={errors.clientName}
                required
              />

              <Input
                label="Email"
                name="clientEmail"
                type="email"
                value={formData.clientEmail}
                onChange={handleChange}
                placeholder="marie.dupont@example.com"
                error={errors.clientEmail}
                required
              />

              <Input
                label="Téléphone"
                name="clientPhone"
                type="tel"
                value={formData.clientPhone}
                onChange={handleChange}
                placeholder="06 12 34 56 78"
                error={errors.clientPhone}
                required
              />

              <Input
                label="Notes (optionnel)"
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                placeholder="Informations supplémentaires..."
              />
            </>
          )}

          {/* Step: Confirmation */}
          {step === 'confirm' && (
            <div className="space-y-4">
              <div className="p-4 bg-primary-50 dark:bg-primary-900/20 rounded-xl">
                <h4 className="font-medium text-primary-900 dark:text-primary-100 mb-3">
                  Récapitulatif
                </h4>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Scissors className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                    <span className="text-primary-800 dark:text-primary-200">
                      {selectedService?.name} - {selectedService?.duration} min
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                    <span className="text-primary-800 dark:text-primary-200 capitalize">
                      {new Date(formData.date).toLocaleDateString('fr-FR', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                      })}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                    <span className="text-primary-800 dark:text-primary-200">{formData.time}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                    <span className="text-primary-800 dark:text-primary-200">{selectedLocation?.name}</span>
                  </div>

                  {selectedMember && (
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                      <span className="text-primary-800 dark:text-primary-200">{selectedMember.name}</span>
                    </div>
                  )}
                </div>

                <div className="mt-3 pt-3 border-t border-primary-200 dark:border-primary-800">
                  <p className="text-lg font-semibold text-primary-900 dark:text-primary-100">
                    {selectedService && formatPrice(selectedService.price)}
                  </p>
                </div>
              </div>

              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">Client</h4>
                <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                  <p>{formData.clientName}</p>
                  <p>{formData.clientEmail}</p>
                  <p>{formData.clientPhone}</p>
                  {formData.notes && <p className="italic">{formData.notes}</p>}
                </div>
              </div>
            </div>
          )}

          {/* Error message */}
          {errors.submit && (
            <div className="p-3 bg-error-50 dark:bg-error-900/20 text-error-700 dark:text-error-400 rounded-lg text-sm flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{errors.submit}</span>
            </div>
          )}
        </div>
      </ModalBody>

      <ModalFooter>
        {step === 'service' && (
          <>
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button type="button" onClick={handleNext}>
              Suivant
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </>
        )}

        {step === 'slots' && (
          <>
            <Button type="button" variant="outline" onClick={handleBack}>
              <ChevronLeft className="w-4 h-4 mr-1" />
              Retour
            </Button>
            {/* No next button - clicking a slot advances */}
          </>
        )}

        {step === 'member' && (
          <>
            <Button type="button" variant="outline" onClick={handleBack}>
              <ChevronLeft className="w-4 h-4 mr-1" />
              Retour
            </Button>
            {/* No next button - clicking a member advances */}
          </>
        )}

        {step === 'client' && (
          <>
            <Button type="button" variant="outline" onClick={handleBack}>
              <ChevronLeft className="w-4 h-4 mr-1" />
              Retour
            </Button>
            <Button type="button" onClick={handleNext}>
              Suivant
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </>
        )}

        {step === 'confirm' && (
          <>
            <Button type="button" variant="outline" onClick={handleBack}>
              <ChevronLeft className="w-4 h-4 mr-1" />
              Modifier
            </Button>
            <Button type="button" onClick={handleSubmit} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Création...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-1" />
                  Confirmer
                </>
              )}
            </Button>
          </>
        )}
      </ModalFooter>
    </Modal>
  );
}

// Helper functions
function formatDateForInput(date: Date): string {
  return date.toISOString().split('T')[0];
}

function formatTimeForSelect(date: Date): string {
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = Math.floor(date.getMinutes() / 15) * 15;
  return `${hours}:${minutes.toString().padStart(2, '0')}`;
}

function formatPrice(priceInCentimes: number): string {
  // Convert centimes to euros
  const priceInEuros = priceInCentimes / 100;
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(priceInEuros);
}
