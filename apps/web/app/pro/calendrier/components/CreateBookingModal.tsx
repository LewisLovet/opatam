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
import { catalogService, schedulingService, providerClientRepository } from '@booking-app/firebase';
import type { Member, Location, Service, ServiceSelections, ProviderClient } from '@booking-app/shared';
import {
  resolveDeposit,
  computeServiceTotal,
  validateServiceSelections,
  emptyServiceSelections,
  serviceHasChoices,
  formatDuration,
} from '@booking-app/shared';
import { ServiceChoicesPicker } from '@/components/booking/ServiceChoicesPicker';
import { ClientAutocomplete } from './ClientAutocomplete';
import {
  Loader2,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  User,
  MapPin,
  Calendar,
  Clock,
  Tag,
  AlertTriangle,
  Check,
  Users,
  Sun,
  Sunset,
  Moon,
  Plus,
  Trash2,
} from 'lucide-react';

type WithId<T> = { id: string } & T;

// Period configuration for grouping slots
type Period = 'morning' | 'afternoon' | 'evening';

interface PeriodConfig {
  key: Period;
  label: string;
  icon: typeof Sun;
  bgColor: string;
  textColor: string;
  iconColor: string;
}

const PERIODS_CONFIG: PeriodConfig[] = [
  {
    key: 'morning',
    label: 'Matin',
    icon: Sun,
    bgColor: 'bg-amber-50 dark:bg-amber-900/20',
    textColor: 'text-amber-800 dark:text-amber-200',
    iconColor: 'text-amber-500',
  },
  {
    key: 'afternoon',
    label: 'Après-midi',
    icon: Sunset,
    bgColor: 'bg-orange-50 dark:bg-orange-900/20',
    textColor: 'text-orange-800 dark:text-orange-200',
    iconColor: 'text-orange-500',
  },
  {
    key: 'evening',
    label: 'Soir',
    icon: Moon,
    bgColor: 'bg-indigo-50 dark:bg-indigo-900/20',
    textColor: 'text-indigo-800 dark:text-indigo-200',
    iconColor: 'text-indigo-500',
  },
];

// Group slots by period
interface GroupedSlots {
  morning: SlotWithMembers[];
  afternoon: SlotWithMembers[];
  evening: SlotWithMembers[];
}

function groupSlotsByPeriod(slots: SlotWithMembers[]): GroupedSlots {
  const grouped: GroupedSlots = {
    morning: [],
    afternoon: [],
    evening: [],
  };

  for (const slot of slots) {
    const hour = parseInt(slot.time.split(':')[0], 10);
    if (hour >= 0 && hour < 12) {
      grouped.morning.push(slot);
    } else if (hour >= 12 && hour < 18) {
      grouped.afternoon.push(slot);
    } else {
      grouped.evening.push(slot);
    }
  }

  return grouped;
}

interface CreateBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialDate?: Date | null;
  initialMemberId?: string;
  initialLocationId?: string;
  /** Pre-fill the client identity step from the existing client base
   *  (e.g. user clicked "Nouveau RDV" from /pro/clients). Empty
   *  strings are treated as missing. */
  initialClient?: {
    name?: string;
    email?: string;
    phone?: string;
  } | null;
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
  initialClient,
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
  const [clients, setClients] = useState<WithId<ProviderClient>[]>([]);
  const [availableSlots, setAvailableSlots] = useState<SlotWithMembers[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [askDeposit, setAskDeposit] = useState(true);

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

  // MULTI-PRESTATION ("panier"): the booking can hold several
  // prestations. cart[0] is the "primary" service — many existing
  // references (slot loading, deposit estimate) treat it as such, so we
  // keep formData.serviceId in sync with cart[0].serviceId.
  const [cart, setCart] = useState<{ serviceId: string; selections: ServiceSelections }[]>([]);

  // Draft state for the "+ Ajouter une prestation" affordance: the
  // service the pro is currently configuring before pushing to the cart.
  const [draftServiceId, setDraftServiceId] = useState('');
  const [draftSelections, setDraftSelections] = useState<ServiceSelections>(emptyServiceSelections());
  const [draftShowMissing, setDraftShowMissing] = useState(false);

  // Keep formData.serviceId == cart[0].serviceId (the "primary"). Slot
  // loading, validation and the deposit estimate rely on it.
  useEffect(() => {
    const primary = cart[0]?.serviceId ?? '';
    setFormData((prev) => (prev.serviceId === primary ? prev : { ...prev, serviceId: primary }));
  }, [cart]);

  // Expanded sections state for time slot periods
  const [expandedSections, setExpandedSections] = useState<Record<Period, boolean>>({
    morning: true,
    afternoon: false,
    evening: false,
  });

  // Group available slots by period
  const groupedSlots = useMemo(() => groupSlotsByPeriod(availableSlots), [availableSlots]);

  // Toggle section expand/collapse
  const toggleSection = (period: Period) => {
    setExpandedSections((prev) => ({
      ...prev,
      [period]: !prev[period],
    }));
  };

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
        clientName: initialClient?.name?.trim() ?? '',
        clientEmail: initialClient?.email?.trim() ?? '',
        clientPhone: initialClient?.phone?.trim() ?? '',
        notes: '',
      });
      setErrors({});
      setAvailableSlots([]);
      setAskDeposit(true);
      setCart([]);
      setDraftServiceId('');
      setDraftSelections(emptyServiceSelections());
      setDraftShowMissing(false);
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

  // Load the provider's existing clients for the "Informations client"
  // autocomplete. Degrades gracefully (manual entry) if it fails.
  useEffect(() => {
    if (!provider || !isOpen) return;

    let cancelled = false;
    const loadClients = async () => {
      try {
        const data = await providerClientRepository.getByProvider(provider.id);
        if (!cancelled) setClients(data);
      } catch (error) {
        console.error('Error loading clients for autocomplete:', error);
        if (!cancelled) setClients([]);
      }
    };

    loadClients();
    return () => {
      cancelled = true;
    };
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
    if (!provider || cart.length === 0 || !formData.date || !formData.locationId) {
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

      // Resolve every cart prestation to its Service doc.
      const cartServices = cart.map((item) => ({
        item,
        service: services.find((s) => s.id === item.serviceId),
      }));
      if (cartServices.some((c) => !c.service)) {
        return;
      }
      const primaryService = cartServices[0].service!;

      // Total block length = sum of each prestation's effective
      // duration + a SINGLE buffer at the end (the last service's
      // bufferTime). durationOverride drives the whole booking length.
      const totalDuration =
        cartServices.reduce(
          (sum, c) => sum + computeServiceTotal(c.service!, c.item.selections).duration,
          0,
        ) + (cartServices[cartServices.length - 1].service!.bufferTime ?? 0);

      // NOUVEAU MODÈLE: Toujours itérer sur les membres du lieu.
      // Un membre doit pouvoir réaliser TOUTES les prestations du
      // panier. Quand le pro a déjà pré-sélectionné un membre (filtre
      // du header → initialMemberId), on restreint le picker à ce
      // membre — sinon une activité qui bloque ce membre serait
      // masquée par la dispo d'un autre membre, et le pro verrait un
      // slot "libre" qui en réalité ne l'est pas pour le membre qu'il
      // vient de choisir.
      const membersToCheck = locationMembers
        .filter((m) =>
          cartServices.every(
            (c) => !c.service!.memberIds || c.service!.memberIds.includes(m.id),
          ),
        )
        .filter((m) => !formData.memberId || m.id === formData.memberId);

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
            // NOUVEAU MODÈLE: memberId est maintenant obligatoire.
            // durationOverride = longueur totale du panier (somme des
            // durées effectives + un seul buffer) — calculée plus haut.
            const slots = await schedulingService.getAvailableSlots({
              providerId: provider.id,
              serviceId: primaryService.id,
              memberId: member.id,
              startDate: date,
              endDate: endDate,
              durationOverride: totalDuration,
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
  }, [provider, cart, formData.date, formData.locationId, formData.memberId, services, locationMembers]);

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
      // Services are location-filtered → clear the cart + draft so a
      // prestation from another location can't linger.
      setFormData((prev) => ({ ...prev, serviceId: '', time: '', memberId: '' }));
      setCart([]);
      setDraftServiceId('');
      setDraftSelections(emptyServiceSelections());
      setDraftShowMissing(false);
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
    if (cart.length === 0) {
      newErrors.serviceId = 'Au moins une prestation est requise';
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

      // Use the public /api/bookings endpoint with source:'pro' so the
      // deposit / Checkout / email flow is consistent with the planning
      // drawer. Bypassing the API (calling bookingService directly) would
      // skip slot reservation, the deposit-payment-request email, and the
      // pro-vs-public branching baked into the route.
      const willAskDeposit = !!resolvedDeposit && askDeposit;
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerId: provider.id,
          locationId: formData.locationId,
          serviceId: cart[0].serviceId,
          items: cart.map((c) => ({ serviceId: c.serviceId, selections: c.selections })),
          memberId: formData.memberId || undefined,
          datetime: datetime.toISOString(),
          clientInfo: {
            name: formData.clientName.trim(),
            email: formData.clientEmail.trim(),
            phone: formData.clientPhone.trim(),
          },
          source: 'pro',
          askDeposit: willAskDeposit,
        }),
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || 'Erreur lors de la création');
      }

      // onBookingWrite Cloud Function fires the confirmation/notification
      // emails (deferred until paid for pending_payment, immediate
      // otherwise). The deposit-payment-request email is sent by the
      // /api/bookings route itself when paymentRequested is true.

      toast.success(
        result.paymentRequested
          ? `Lien de paiement envoyé à ${formData.clientEmail.trim()}`
          : 'Rendez-vous créé avec succès',
      );
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

  // Cart prestations resolved to their Service docs + effective
  // price/duration (variations/options applied). Drives the cart list,
  // the running total, the confirm recap and the deposit estimate.
  const cartLines = useMemo(
    () =>
      cart
        .map((item) => {
          const service = services.find((s) => s.id === item.serviceId);
          if (!service) return null;
          const total = computeServiceTotal(service, item.selections);
          return { item, service, price: total.price, duration: total.duration };
        })
        .filter((l): l is NonNullable<typeof l> => l !== null),
    [cart, services],
  );
  const cartTotalPrice = useMemo(
    () => cartLines.reduce((sum, l) => sum + l.price, 0),
    [cartLines],
  );
  const cartTotalDuration = useMemo(
    () => cartLines.reduce((sum, l) => sum + l.duration, 0),
    [cartLines],
  );

  // Resolved deposit for the selected service. null when no deposit
  // applies, or when the deposits add-on isn't ready (Stripe Connect
  // not active, add-on disabled). Same gating as the public flow.
  const resolvedDeposit = useMemo(() => {
    if (!provider || !selectedService) return null;
    const ready =
      provider.depositsAddonActive &&
      provider.stripeConnectStatus === 'active';
    if (!ready) return null;
    // Estimate on the SUMMED effective price across the cart, using the
    // primary (cart[0]) service's deposit config. The server recomputes
    // the authoritative deposit at creation time.
    return resolveDeposit(
      { price: cartTotalPrice, deposit: selectedService.deposit },
      { depositDefault: provider.settings?.depositDefault },
    );
  }, [provider, selectedService, cartTotalPrice]);

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

              {/* Prestations (panier) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <Tag className="w-4 h-4 inline mr-1" />
                  Prestations <span className="text-error-500">*</span>
                </label>

                {/* Cart list */}
                {cartLines.length > 0 && (
                  <div className="space-y-2 mb-3">
                    {cartLines.map((line, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between gap-2 p-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-sm text-gray-900 dark:text-white truncate">
                            {line.service.name}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {formatDuration(line.duration)} • {formatPrice(line.price)}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setCart((prev) => prev.filter((_, i) => i !== idx))}
                          className="flex-shrink-0 p-1.5 rounded-md text-gray-400 hover:text-error-500 hover:bg-error-50 dark:hover:bg-error-900/20 transition-colors"
                          aria-label="Retirer la prestation"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}

                    {/* Running total */}
                    <div className="flex items-center justify-between px-2.5 py-2 rounded-lg bg-gray-50 dark:bg-gray-800/60 text-sm">
                      <span className="font-medium text-gray-700 dark:text-gray-300">Total</span>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {formatDuration(cartTotalDuration)} • {formatPrice(cartTotalPrice)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Add a prestation */}
                <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-600 p-3 space-y-3">
                  <Select
                    name="draftServiceId"
                    value={draftServiceId}
                    onChange={(e) => {
                      setDraftServiceId(e.target.value);
                      setDraftSelections(emptyServiceSelections());
                      setDraftShowMissing(false);
                    }}
                    disabled={!formData.locationId}
                    placeholder="+ Ajouter une prestation"
                    options={filteredServices.map((svc) => ({
                      value: svc.id,
                      label: `${svc.name} - ${svc.duration} min - ${formatPrice(svc.price)}`,
                    }))}
                  />

                  {(() => {
                    const draftService = filteredServices.find((s) => s.id === draftServiceId);
                    if (!draftService) return null;

                    const hasChoices = serviceHasChoices(draftService);
                    const { valid, missing } = validateServiceSelections(
                      draftService,
                      draftSelections,
                    );
                    const draftTotal = computeServiceTotal(draftService, draftSelections);

                    const addToCart = () => {
                      if (!valid) {
                        setDraftShowMissing(true);
                        return;
                      }
                      setCart((prev) => [
                        ...prev,
                        { serviceId: draftService.id, selections: draftSelections },
                      ]);
                      setDraftServiceId('');
                      setDraftSelections(emptyServiceSelections());
                      setDraftShowMissing(false);
                    };

                    return (
                      <>
                        {hasChoices && (
                          <ServiceChoicesPicker
                            service={draftService}
                            selections={draftSelections}
                            onChange={setDraftSelections}
                            missing={draftShowMissing ? new Set(missing) : undefined}
                          />
                        )}
                        <div className="flex items-center justify-between gap-2 pt-1">
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            {formatDuration(draftTotal.duration)} • {formatPrice(draftTotal.price)}
                          </span>
                          <Button
                            type="button"
                            size="sm"
                            onClick={addToCart}
                            disabled={!valid}
                          >
                            <Plus className="w-4 h-4 mr-1" />
                            Ajouter au RDV
                          </Button>
                        </div>
                      </>
                    );
                  })()}
                </div>

                {errors.serviceId && (
                  <p className="mt-1 text-sm text-error-500">{errors.serviceId}</p>
                )}
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
              {/* Selected prestations summary */}
              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-sm">
                <p className="font-medium text-gray-900 dark:text-white">
                  {cartLines.map((l) => l.service.name).join(' + ')}
                </p>
                <p className="text-gray-500 dark:text-gray-400">
                  {new Date(formData.date).toLocaleDateString('fr-FR', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                  })} • {formatDuration(cartTotalDuration)} • {formatPrice(cartTotalPrice)}
                </p>
              </div>

              {/* Time slots grouped by period */}
              {loadingSlots ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
                  <span className="ml-2 text-gray-500">Chargement des créneaux...</span>
                </div>
              ) : availableSlots.length > 0 ? (
                <div className="space-y-2 max-h-[280px] overflow-y-auto">
                  {PERIODS_CONFIG.map((period) => {
                    const periodSlots = groupedSlots[period.key];
                    if (periodSlots.length === 0) return null;

                    const Icon = period.icon;
                    const isExpanded = expandedSections[period.key];
                    const hasSelectedSlot = periodSlots.some(s => s.time === formData.time);

                    return (
                      <div key={period.key} className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                        {/* Section header */}
                        <button
                          type="button"
                          onClick={() => toggleSection(period.key)}
                          className={`
                            w-full flex items-center justify-between px-3 py-2.5 transition-colors
                            ${period.bgColor}
                          `}
                        >
                          <div className="flex items-center gap-2">
                            <Icon className={`w-4 h-4 ${period.iconColor}`} />
                            <span className={`font-medium text-sm ${period.textColor}`}>
                              {period.label}
                            </span>
                            <span className={`text-xs ${period.textColor} opacity-75`}>
                              ({periodSlots.length} créneaux)
                            </span>
                            {hasSelectedSlot && !isExpanded && (
                              <span className="ml-2 px-2 py-0.5 bg-primary-500 text-white text-xs rounded-full">
                                {formData.time}
                              </span>
                            )}
                          </div>
                          <ChevronDown
                            className={`w-4 h-4 ${period.textColor} transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                          />
                        </button>

                        {/* Section content */}
                        {isExpanded && (
                          <div className="p-2 bg-white dark:bg-gray-800 grid grid-cols-4 gap-1.5">
                            {periodSlots.map((slot) => (
                              <button
                                key={slot.time}
                                type="button"
                                onClick={() => handleSelectSlot(slot)}
                                className={`
                                  px-2 py-1.5 rounded-md border text-center transition-all text-sm
                                  ${formData.time === slot.time
                                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/30 ring-1 ring-primary-500'
                                    : 'border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-600'}
                                `}
                              >
                                <span className="block font-medium text-gray-900 dark:text-white">
                                  {slot.label}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
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
                <p className="font-medium text-gray-900 dark:text-white">
                  {cartLines.map((l) => l.service.name).join(' + ')}
                </p>
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
            <div className="space-y-4">
              <ClientAutocomplete
                clients={clients}
                name={formData.clientName}
                email={formData.clientEmail}
                phone={formData.clientPhone}
                errors={{
                  clientName: errors.clientName,
                  clientEmail: errors.clientEmail,
                  clientPhone: errors.clientPhone,
                }}
                onFieldChange={(field, value) => {
                  setFormData((prev) => ({ ...prev, [field]: value }));
                  setErrors((prev) => ({ ...prev, [field]: '' }));
                }}
                onSelectClient={(client) => {
                  setFormData((prev) => ({
                    ...prev,
                    clientName: client.name,
                    clientEmail: client.email,
                    clientPhone: client.phone,
                  }));
                  setErrors((prev) => ({
                    ...prev,
                    clientName: '',
                    clientEmail: '',
                    clientPhone: '',
                  }));
                }}
              />

              <Input
                label="Notes (optionnel)"
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                placeholder="Informations supplémentaires..."
              />
            </div>
          )}

          {/* Step: Confirmation */}
          {step === 'confirm' && (
            <div className="space-y-4">
              <div className="p-4 bg-primary-50 dark:bg-primary-900/20 rounded-xl">
                <h4 className="font-medium text-primary-900 dark:text-primary-100 mb-3">
                  Récapitulatif
                </h4>

                <div className="space-y-2 text-sm">
                  <div className="flex items-start gap-2">
                    <Tag className="w-4 h-4 text-primary-600 dark:text-primary-400 mt-0.5" />
                    <div className="flex-1 space-y-1">
                      {cartLines.map((line, idx) => (
                        <div key={idx} className="flex items-center justify-between gap-2">
                          <span className="text-primary-800 dark:text-primary-200">
                            {line.service.name}
                          </span>
                          <span className="text-primary-700 dark:text-primary-300 whitespace-nowrap">
                            {formatPrice(line.price)}
                          </span>
                        </div>
                      ))}
                    </div>
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

                <div className="mt-3 pt-3 border-t border-primary-200 dark:border-primary-800 flex items-baseline justify-between">
                  <span className="text-sm text-primary-700 dark:text-primary-300">
                    {formatDuration(cartTotalDuration)}
                  </span>
                  <p className="text-lg font-semibold text-primary-900 dark:text-primary-100">
                    {formatPrice(cartTotalPrice)}
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

              {resolvedDeposit && (
                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={askDeposit}
                      onChange={(e) => setAskDeposit(e.target.checked)}
                      disabled={loading}
                      className="mt-0.5 w-4 h-4 text-amber-600 border-amber-300 rounded focus:ring-amber-500"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                        Demander l'acompte au client
                      </p>
                      <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                        {askDeposit
                          ? `Un email avec un lien de paiement de ${formatPrice(resolvedDeposit.amount)} sera envoyé. La résa reste en attente jusqu'au paiement (30 min max).`
                          : "Aucune demande d'acompte. Vous encaisserez en personne."}
                      </p>
                    </div>
                  </label>
                </div>
              )}
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
            {/* Show next button when a slot is already selected */}
            {formData.time && (
              <Button type="button" onClick={() => handleSelectSlot(availableSlots.find(s => s.time === formData.time)!)}>
                Suivant
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            )}
          </>
        )}

        {step === 'member' && (
          <>
            <Button type="button" variant="outline" onClick={handleBack}>
              <ChevronLeft className="w-4 h-4 mr-1" />
              Retour
            </Button>
            {/* Show next button when a member is already selected */}
            {formData.memberId && (
              <Button type="button" onClick={() => handleSelectMember(formData.memberId)}>
                Suivant
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            )}
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
              ) : resolvedDeposit && askDeposit ? (
                <>
                  <Check className="w-4 h-4 mr-1" />
                  Créer et envoyer le lien
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
