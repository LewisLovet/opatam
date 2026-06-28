'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft,
  Loader2,
  Check,
  Clock,
  Info,
  CalendarCheck,
  ChevronRight as ChevronRightIcon,
} from 'lucide-react';
import { Modal, ModalHeader, ModalBody } from '@/components/ui';
import {
  resolveDeposit,
  computeServiceTotal,
  emptyServiceSelections,
  serviceHasChoices,
  validateServiceSelections,
  getServiceMinPrice,
  type ServiceSelections,
  type ServiceVariation,
  type ServiceOption,
  type ServiceInfoField,
} from '@booking-app/shared';
// Phase A: reuse the redesigned tunnel slot picker (day states, capacity,
// "Prochaine dispo", /api/slots/summary) instead of the legacy local SlotStep.
import { StepSlot } from '@/app/p/[slug]/reserver/components/StepSlot';
// Phase B: reuse the tunnel's variations/options picker.
import { ServiceChoicesPicker } from '@/components/booking/ServiceChoicesPicker';

// ─── Types ──────────────────────────────────────────────────────────────────────

interface Service {
  id: string;
  name: string;
  description: string | null;
  duration: number;
  price: number;
  bufferTime: number;
  categoryId: string | null;
  deposit?: {
    type: 'fixed' | 'percent';
    value: number;
    refundDeadlineHours: number;
  } | null;
  variations?: ServiceVariation[];
  options?: ServiceOption[];
  infoFields?: ServiceInfoField[];
}

interface ServiceCategory {
  id: string;
  name: string;
  sortOrder: number;
}

interface ProviderSettings {
  requiresConfirmation: boolean;
  maxBookingAdvance: number;
  minBookingNotice: number;
  depositDefault?: {
    percent: number;
    refundDeadlineHours: number;
  } | null;
  [key: string]: unknown;
}

interface BookingDataResponse {
  provider: {
    id: string;
    businessName: string;
    slug: string;
    settings: ProviderSettings;
    depositsAddonActive: boolean;
    stripeConnectStatus: 'pending' | 'active' | 'restricted' | null;
  };
  services: Service[];
  serviceCategories: ServiceCategory[];
  member: { id: string; name: string; locationId: string };
  location: {
    id: string;
    name: string;
    address: string;
    city: string;
    postalCode: string;
    type: string;
  } | null;
  availabilities: {
    memberId: string;
    dayOfWeek: number;
    slots: { start: string; end: string }[];
    isOpen: boolean;
  }[];
}

interface TimeSlotWithDate {
  date: string;
  start: string;
  end: string;
  datetime: string;
  endDatetime: string;
}

type DrawerStep = 'service' | 'choices' | 'slot' | 'client' | 'success';

interface NewBookingDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  accessCode: string;
  memberId: string;
  providerId: string;
  onBookingCreated: () => void;
}

// ─── Main Component ─────────────────────────────────────────────────────────────

export function NewBookingDrawer({
  isOpen,
  onClose,
  accessCode,
  memberId,
  providerId,
  onBookingCreated,
}: NewBookingDrawerProps) {
  const [data, setData] = useState<BookingDataResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Booking state
  const [step, setStep] = useState<DrawerStep>('service');
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlotWithDate | null>(null);
  const [selections, setSelections] = useState<ServiceSelections>(emptyServiceSelections());
  const [choicesMissing, setChoicesMissing] = useState<Set<string>>(new Set());
  const [clientInfo, setClientInfo] = useState({ name: '', email: '', phone: '' });
  // Off by default — the pro explicitly opts in to send the payment link.
  const [askDeposit, setAskDeposit] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [paymentRequested, setPaymentRequested] = useState(false);

  // Fetch booking data on open
  useEffect(() => {
    if (!isOpen) return;

    const fetchData = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(
          `/api/planning/booking-data?code=${encodeURIComponent(accessCode)}`
        );
        const result = await res.json();
        if (!res.ok) {
          setError(result.error || 'Erreur lors du chargement');
          return;
        }
        setData(result);
      } catch {
        setError('Erreur de connexion');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isOpen, accessCode]);

  // Reset state when closing
  const handleClose = () => {
    onClose();
    // Delay reset so animation plays with content still visible
    setTimeout(() => {
      setStep('service');
      setSelectedServiceId(null);
      setSelectedSlot(null);
      setSelections(emptyServiceSelections());
      setChoicesMissing(new Set());
      setClientInfo({ name: '', email: '', phone: '' });
      setSubmitError(null);
      setAskDeposit(false);
      setPaymentRequested(false);
    }, 200);
  };

  const selectedService = useMemo(
    () => data?.services.find((s) => s.id === selectedServiceId) || null,
    [data, selectedServiceId]
  );

  // Effective price + duration including the chosen variations/options.
  const total = useMemo(
    () => (selectedService ? computeServiceTotal(selectedService, selections) : null),
    [selectedService, selections],
  );

  // Resolved deposit for the selected service. null when no deposit
  // applies (no override + no provider default), or when the deposits
  // add-on isn't active / Connect isn't ready — those gates exist on the
  // server too; we mirror them here so we don't show a misleading
  // checkbox the API would silently ignore.
  const resolvedDeposit = useMemo(() => {
    if (!data || !selectedService) return null;
    const ready =
      data.provider.depositsAddonActive &&
      data.provider.stripeConnectStatus === 'active';
    if (!ready) return null;
    return resolveDeposit(
      { price: total?.price ?? selectedService.price, deposit: selectedService.deposit },
      { depositDefault: data.provider.settings.depositDefault },
    );
  }, [data, selectedService, total]);

  const openDays = useMemo(() => {
    if (!data) return [];
    return data.availabilities
      .filter((a) => a.isOpen && a.slots.length > 0)
      .map((a) => a.dayOfWeek);
  }, [data]);

  // Handlers
  const handleServiceSelect = (serviceId: string) => {
    const svc = data?.services.find((s) => s.id === serviceId);
    setSelectedServiceId(serviceId);
    setSelectedSlot(null);
    setSelections(emptyServiceSelections());
    setChoicesMissing(new Set());
    // A service with variations/options → configure it before the slot.
    setStep(svc && serviceHasChoices(svc) ? 'choices' : 'slot');
  };

  // Validate required variations/options before moving to the slot picker.
  const handleChoicesContinue = () => {
    if (!selectedService) return;
    const { valid, missing } = validateServiceSelections(selectedService, selections);
    if (!valid) {
      setChoicesMissing(new Set(missing));
      return;
    }
    setChoicesMissing(new Set());
    setStep('slot');
  };

  const handleSlotSelect = (slot: TimeSlotWithDate) => {
    setSelectedSlot(slot);
    setStep('client');
  };

  const handleBack = () => {
    if (step === 'choices') setStep('service');
    else if (step === 'slot')
      setStep(selectedService && serviceHasChoices(selectedService) ? 'choices' : 'service');
    else if (step === 'client') setStep('slot');
  };

  const handleSubmit = async () => {
    if (!data || !selectedServiceId || !selectedSlot) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const willAskDeposit = !!resolvedDeposit && askDeposit;
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerId,
          serviceId: selectedServiceId,
          memberId,
          locationId: data.member.locationId,
          datetime: selectedSlot.datetime,
          clientInfo,
          selections,
          source: 'pro',
          askDeposit: willAskDeposit,
        }),
      });

      if (!res.ok) {
        const result = await res.json();
        throw new Error(result.error || 'Erreur lors de la réservation');
      }

      const result = await res.json();
      setPaymentRequested(!!result.paymentRequested);
      setStep('success');
      onBookingCreated();
      // Auto-close after showing confirmation. Give the pro a touch more
      // time when a payment email was triggered so they can read it.
      setTimeout(() => {
        handleClose();
      }, result.paymentRequested ? 4000 : 2000);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step labels for stepper
  const steps = [
    { id: 'service' as const, label: 'Prestation' },
    { id: 'slot' as const, label: 'Créneau' },
    { id: 'client' as const, label: 'Client' },
  ];
  // 'choices' is part of the "Prestation" stage in the stepper.
  const currentStepIndex = step === 'choices' ? 0 : steps.findIndex((s) => s.id === step);

  return (
    <Modal isOpen={isOpen} onClose={handleClose} className="max-w-2xl">
      <ModalHeader title="Nouveau rendez-vous" onClose={handleClose} />

      <ModalBody className="p-0">
        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="p-6 text-center">
            <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
            <button
              onClick={handleClose}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Fermer
            </button>
          </div>
        )}

        {/* Content */}
        {data && !loading && !error && (
          <div>
            {/* Stepper */}
            {step !== 'success' && (
              <div className="px-6 py-3 border-b border-gray-100 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  {steps.map((s, index) => {
                    const isCompleted = index < currentStepIndex;
                    const isCurrent = s.id === step || (step === 'choices' && s.id === 'service');
                    return (
                      <div key={s.id} className="flex items-center flex-1">
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
                              isCompleted
                                ? 'bg-primary-600 text-white'
                                : isCurrent
                                ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 ring-2 ring-primary-600'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500'
                            }`}
                          >
                            {isCompleted ? (
                              <Check className="w-3.5 h-3.5" />
                            ) : (
                              index + 1
                            )}
                          </div>
                          <span
                            className={`text-xs font-medium hidden sm:block ${
                              isCurrent
                                ? 'text-primary-600 dark:text-primary-400'
                                : isCompleted
                                ? 'text-gray-700 dark:text-gray-300'
                                : 'text-gray-400 dark:text-gray-500'
                            }`}
                          >
                            {s.label}
                          </span>
                        </div>
                        {index < steps.length - 1 && (
                          <div
                            className={`flex-1 h-0.5 mx-2 ${
                              isCompleted
                                ? 'bg-primary-600'
                                : 'bg-gray-200 dark:bg-gray-700'
                            }`}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="p-6">
              {step === 'service' && (
                <ServiceStep
                  services={data.services}
                  categories={data.serviceCategories}
                  selectedServiceId={selectedServiceId}
                  onSelect={handleServiceSelect}
                />
              )}

              {step === 'choices' && selectedService && (
                <div>
                  <button
                    onClick={handleBack}
                    className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white mb-3"
                  >
                    <ArrowLeft className="w-4 h-4" /> Retour
                  </button>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {selectedService.name}
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-4">
                    Composez la prestation
                  </p>
                  <ServiceChoicesPicker
                    service={{
                      variations: selectedService.variations,
                      options: selectedService.options,
                      infoFields: selectedService.infoFields,
                    }}
                    selections={selections}
                    onChange={setSelections}
                    missing={choicesMissing}
                  />
                  <div className="mt-6 flex items-center justify-between gap-4 border-t border-gray-100 dark:border-gray-700 pt-4">
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">
                      {total ? `${formatPrice(total.price)} · ${formatDuration(total.duration)}` : ''}
                    </span>
                    <button
                      onClick={handleChoicesContinue}
                      className="px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg text-sm transition-colors"
                    >
                      Continuer
                    </button>
                  </div>
                </div>
              )}

              {step === 'slot' && selectedService && data && (
                <StepSlot
                  providerId={providerId}
                  serviceId={selectedService.id}
                  memberId={memberId}
                  serviceDuration={(total?.duration ?? selectedService.duration) + selectedService.bufferTime}
                  maxAdvanceDays={data.provider.settings.maxBookingAdvance}
                  openDays={openDays}
                  selectedSlot={selectedSlot}
                  onSelect={handleSlotSelect}
                  onBack={handleBack}
                />
              )}

              {step === 'client' && (
                <ClientStep
                  clientInfo={clientInfo}
                  onChange={(info) =>
                    setClientInfo((prev) => ({ ...prev, ...info }))
                  }
                  onSubmit={handleSubmit}
                  onBack={handleBack}
                  isSubmitting={isSubmitting}
                  error={submitError}
                  requiresConfirmation={
                    data.provider.settings.requiresConfirmation
                  }
                  resolvedDeposit={resolvedDeposit}
                  askDeposit={askDeposit}
                  onAskDepositChange={setAskDeposit}
                />
              )}

              {step === 'success' && (
                <SuccessStep
                  service={selectedService}
                  slot={selectedSlot}
                  clientName={clientInfo.name}
                  clientEmail={clientInfo.email}
                  requiresConfirmation={
                    data.provider.settings.requiresConfirmation
                  }
                  paymentRequested={paymentRequested}
                  onClose={handleClose}
                />
              )}
            </div>
          </div>
        )}
      </ModalBody>
    </Modal>
  );
}

// ─── Step 1: Service Selection ──────────────────────────────────────────────────

function ServiceStep({
  services,
  categories,
  selectedServiceId,
  onSelect,
}: {
  services: Service[];
  categories: ServiceCategory[];
  selectedServiceId: string | null;
  onSelect: (serviceId: string) => void;
}) {
  const hasCategories = categories.length > 0;

  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(
    () => {
      if (categories.length <= 3) return new Set<string>();
      const sorted = [...categories].sort((a, b) => a.sortOrder - b.sortOrder);
      return new Set(sorted.slice(1).map((c) => c.id));
    }
  );

  const toggleCategory = (categoryId: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return next;
    });
  };

  const grouped = useMemo(() => {
    if (!hasCategories) return null;
    const sortedCategories = [...categories].sort(
      (a, b) => a.sortOrder - b.sortOrder
    );
    const groups: { category: ServiceCategory; services: Service[] }[] = [];
    for (const cat of sortedCategories) {
      const catServices = services.filter((s) => s.categoryId === cat.id);
      if (catServices.length > 0) groups.push({ category: cat, services: catServices });
    }
    const uncategorized = services.filter(
      (s) => !s.categoryId || !categories.some((c) => c.id === s.categoryId)
    );
    return { groups, uncategorized };
  }, [services, categories, hasCategories]);

  if (services.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500 dark:text-gray-400">
          Aucune prestation disponible.
        </p>
      </div>
    );
  }

  const renderService = (service: Service) => (
    <button
      key={service.id}
      onClick={() => onSelect(service.id)}
      className={`w-full text-left p-3.5 rounded-xl border-2 transition-all ${
        service.id === selectedServiceId
          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-primary-300 dark:hover:border-primary-700'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm text-gray-900 dark:text-white">
              {service.name}
            </h3>
            {service.id === selectedServiceId && (
              <div className="w-4 h-4 rounded-full bg-primary-500 flex items-center justify-center">
                <Check className="w-2.5 h-2.5 text-white" />
              </div>
            )}
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500">
            <Clock className="w-3.5 h-3.5" />
            <span>{formatDuration(service.duration)}</span>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          {((service.variations?.length ?? 0) > 0 || (service.options?.length ?? 0) > 0) && (
            <span className="block text-[10px] font-normal text-gray-400">à partir de</span>
          )}
          <span className="text-sm font-bold text-gray-900 dark:text-white">
            {formatPrice(getServiceMinPrice(service))}
          </span>
        </div>
      </div>
    </button>
  );

  if (!hasCategories || !grouped) {
    return (
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
          Choisissez une prestation
        </h2>
        <div className="space-y-2">{services.map(renderService)}</div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
        Choisissez une prestation
      </h2>
      <div className="space-y-4">
        {grouped.groups.map(({ category, services: catServices }) => {
          const isCollapsed = collapsedCategories.has(category.id);
          return (
            <div key={category.id}>
              <button
                type="button"
                onClick={() => toggleCategory(category.id)}
                className="flex items-center gap-2 mb-2 w-full text-left bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg px-3 py-2 transition-colors"
              >
                <div className="w-1 h-4 bg-primary-500 rounded-full flex-shrink-0" />
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                  {category.name}
                </h3>
                <span className="bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 text-xs font-semibold px-1.5 py-0.5 rounded-full">
                  {catServices.length}
                </span>
                <ChevronRightIcon
                  className={`w-4 h-4 text-gray-400 ml-auto transition-transform duration-200 ${
                    !isCollapsed ? 'rotate-90' : ''
                  }`}
                />
              </button>
              {!isCollapsed && (
                <div className="space-y-2">{catServices.map(renderService)}</div>
              )}
            </div>
          );
        })}
        {grouped.uncategorized.length > 0 && (
          <div>
            {grouped.groups.length > 0 && (
              <button
                type="button"
                onClick={() => toggleCategory('__uncategorized__')}
                className="flex items-center gap-2 mb-2 w-full text-left bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg px-3 py-2 transition-colors"
              >
                <div className="w-1 h-4 bg-primary-500 rounded-full flex-shrink-0" />
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                  Autres
                </h3>
                <span className="bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 text-xs font-semibold px-1.5 py-0.5 rounded-full">
                  {grouped.uncategorized.length}
                </span>
                <ChevronRightIcon
                  className={`w-4 h-4 text-gray-400 ml-auto transition-transform duration-200 ${
                    !collapsedCategories.has('__uncategorized__') ? 'rotate-90' : ''
                  }`}
                />
              </button>
            )}
            {!collapsedCategories.has('__uncategorized__') && (
              <div className="space-y-2">
                {grouped.uncategorized.map(renderService)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Step 3: Client Info ────────────────────────────────────────────────────────

const isValidPhone = (phone: string): boolean => {
  const cleaned = phone.replace(/[\s.\-()]/g, '');
  if (!/^(\+)?[0-9]+$/.test(cleaned)) return false;
  const digitCount = cleaned.replace(/\D/g, '').length;
  return digitCount >= 8 && digitCount <= 15;
};

function ClientStep({
  clientInfo,
  onChange,
  onSubmit,
  onBack,
  isSubmitting,
  error,
  requiresConfirmation,
  resolvedDeposit,
  askDeposit,
  onAskDepositChange,
}: {
  clientInfo: { name: string; email: string; phone: string };
  onChange: (info: Partial<typeof clientInfo>) => void;
  onSubmit: () => void;
  onBack: () => void;
  isSubmitting: boolean;
  error: string | null;
  requiresConfirmation: boolean;
  resolvedDeposit: { amount: number; refundDeadlineHours: number; source: 'service' | 'default' } | null;
  askDeposit: boolean;
  onAskDepositChange: (v: boolean) => void;
}) {
  const isNameValid = clientInfo.name.trim().length >= 2;
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientInfo.email);
  const isPhoneValid = isValidPhone(clientInfo.phone);
  const isValid = isNameValid && isEmailValid && isPhoneValid;

  const handlePhoneChange = (value: string) => {
    const cleaned = value.replace(/[^\d\s\-.()+]/g, '');
    onChange({ phone: cleaned });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isValid && !isSubmitting) onSubmit();
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={onBack}
          disabled={isSubmitting}
          className="p-1.5 -ml-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Informations du client
        </h2>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label
            htmlFor="client-name"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Nom complet
          </label>
          <input
            type="text"
            id="client-name"
            value={clientInfo.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="Jean Dupont"
            disabled={isSubmitting}
            className={`w-full px-3 py-2.5 rounded-lg border bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-50 text-sm ${
              clientInfo.name && !isNameValid
                ? 'border-red-300 dark:border-red-700'
                : 'border-gray-300 dark:border-gray-600'
            }`}
          />
          {clientInfo.name && !isNameValid && (
            <p className="mt-1 text-xs text-red-500">Au moins 2 caractères</p>
          )}
        </div>

        <div>
          <label
            htmlFor="client-email"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Email
          </label>
          <input
            type="email"
            id="client-email"
            value={clientInfo.email}
            onChange={(e) => onChange({ email: e.target.value })}
            placeholder="jean@exemple.com"
            disabled={isSubmitting}
            className={`w-full px-3 py-2.5 rounded-lg border bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-50 text-sm ${
              clientInfo.email && !isEmailValid
                ? 'border-red-300 dark:border-red-700'
                : 'border-gray-300 dark:border-gray-600'
            }`}
          />
          {clientInfo.email && !isEmailValid && (
            <p className="mt-1 text-xs text-red-500">Format d'email invalide</p>
          )}
        </div>

        <div>
          <label
            htmlFor="client-phone"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Téléphone
          </label>
          <input
            type="tel"
            id="client-phone"
            value={clientInfo.phone}
            onChange={(e) => handlePhoneChange(e.target.value)}
            placeholder="06 12 34 56 78"
            disabled={isSubmitting}
            className={`w-full px-3 py-2.5 rounded-lg border bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-50 text-sm ${
              clientInfo.phone && !isPhoneValid
                ? 'border-red-300 dark:border-red-700'
                : 'border-gray-300 dark:border-gray-600'
            }`}
          />
          {clientInfo.phone && !isPhoneValid && (
            <p className="mt-1 text-xs text-red-500">Numéro invalide</p>
          )}
        </div>

        {requiresConfirmation && (
          <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700 dark:text-blue-300">
              La réservation sera en attente de confirmation par le prestataire.
            </p>
          </div>
        )}

        {resolvedDeposit && (
          <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={askDeposit}
                onChange={(e) => onAskDepositChange(e.target.checked)}
                disabled={isSubmitting}
                className="mt-0.5 w-4 h-4 text-amber-600 border-amber-300 rounded focus:ring-amber-500"
              />
              <div className="flex-1">
                <p className="text-xs font-semibold text-amber-900 dark:text-amber-200">
                  Demander l'acompte au client
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                  {askDeposit
                    ? `Un email avec un lien de paiement de ${formatPrice(resolvedDeposit.amount)} sera envoyé. La résa reste en attente jusqu'au paiement.`
                    : "Aucune demande d'acompte. Vous encaisserez en personne."}
                </p>
              </div>
            </label>
          </div>
        )}

        <button
          type="submit"
          disabled={!isValid || isSubmitting}
          className="w-full py-2.5 px-4 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2 text-sm"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Réservation en cours...
            </>
          ) : resolvedDeposit && askDeposit ? (
            'Créer et envoyer le lien de paiement'
          ) : (
            'Confirmer le rendez-vous'
          )}
        </button>
      </form>
    </div>
  );
}

// ─── Success Step ───────────────────────────────────────────────────────────────

function SuccessStep({
  service,
  slot,
  clientName,
  clientEmail,
  requiresConfirmation,
  paymentRequested,
  onClose,
}: {
  service: Service | null;
  slot: TimeSlotWithDate | null;
  clientName: string;
  clientEmail: string;
  requiresConfirmation: boolean;
  paymentRequested: boolean;
  onClose: () => void;
}) {
  const iconBg = paymentRequested
    ? 'bg-amber-100 dark:bg-amber-900/30'
    : 'bg-green-100 dark:bg-green-900/30';
  const iconColor = paymentRequested
    ? 'text-amber-600 dark:text-amber-400'
    : 'text-green-600 dark:text-green-400';

  return (
    <div className="text-center py-4">
      <div className={`mx-auto w-14 h-14 rounded-full ${iconBg} flex items-center justify-center mb-4`}>
        <CalendarCheck className={`w-7 h-7 ${iconColor}`} />
      </div>
      <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
        {paymentRequested
          ? 'Lien de paiement envoyé'
          : requiresConfirmation
          ? 'Rendez-vous créé'
          : 'Rendez-vous confirmé'}
      </h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        {paymentRequested
          ? `Un email a été envoyé à ${clientEmail} avec le lien de paiement. La résa restera en attente jusqu'au paiement (30 min max).`
          : requiresConfirmation
          ? 'Le rendez-vous est en attente de confirmation.'
          : 'Le rendez-vous a été ajouté à votre planning.'}
      </p>

      {service && slot && (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 mb-6 text-left max-w-xs mx-auto">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">
            {service.name}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {clientName}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {new Date(slot.datetime).toLocaleDateString('fr-FR', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}{' '}
            à {slot.start}
          </p>
        </div>
      )}

      <button
        onClick={onClose}
        className="px-6 py-2.5 bg-primary-600 text-white hover:bg-primary-700 rounded-lg text-sm font-medium transition-colors"
      >
        Fermer
      </button>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return rem === 0 ? `${hours}h` : `${hours}h${rem}`;
}

function formatPrice(cents: number): string {
  if (cents === 0) return 'Gratuit';
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}
