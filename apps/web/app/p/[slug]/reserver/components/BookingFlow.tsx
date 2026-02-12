'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Check, CalendarCheck, Sparkles, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { APP_CONFIG } from '@booking-app/shared/constants';
import { StepService } from './StepService';
import { StepMember } from './StepMember';
import { StepSlot } from './StepSlot';
import { StepConfirm } from './StepConfirm';
import { BookingRecap } from './BookingRecap';

// Types
interface Provider {
  id: string;
  businessName: string;
  slug: string;
  photoURL: string | null;
  plan: string;
  settings: {
    reminderTimes: number[];
    requiresConfirmation: boolean;
    defaultBufferTime: number;
    timezone: string;
    minBookingNotice: number;
    maxBookingAdvance: number;
    allowClientCancellation: boolean;
    cancellationDeadline: number;
  };
}

interface ServiceCategory {
  id: string;
  name: string;
  sortOrder: number;
}

interface Service {
  id: string;
  name: string;
  description: string | null;
  duration: number;
  price: number;
  bufferTime: number;
  categoryId?: string | null;
  locationIds: string[];
  memberIds: string[] | null;
}

interface Location {
  id: string;
  name: string;
  address: string;
  city: string;
  postalCode: string;
  type: 'fixed' | 'mobile';
}

interface Member {
  id: string;
  name: string;
  photoURL: string | null;
  locationId: string;
  isDefault: boolean;
}

interface Availability {
  id: string;
  memberId: string;
  locationId: string;
  dayOfWeek: number;
  slots: { start: string; end: string }[];
  isOpen: boolean;
}

interface TimeSlotWithDate {
  date: string;
  start: string;
  end: string;
  datetime: string;
  endDatetime: string;
}

interface BookingFlowProps {
  provider: Provider;
  services: Service[];
  serviceCategories?: ServiceCategory[];
  locations: Location[];
  members: Member[];
  availabilities: Availability[];
  isTeam: boolean;
  preselectedServiceId?: string;
  isDemo?: boolean;
}

export type BookingStep = 'service' | 'member' | 'slot' | 'confirm' | 'demo-success';

interface BookingState {
  serviceId: string | null;
  memberId: string | null;
  locationId: string | null;
  slot: TimeSlotWithDate | null;
  clientInfo: {
    name: string;
    email: string;
    phone: string;
  };
}

const initialClientInfo = {
  name: '',
  email: '',
  phone: '',
};

export function BookingFlow({
  provider,
  services,
  serviceCategories = [],
  locations,
  members,
  availabilities,
  isTeam,
  preselectedServiceId,
  isDemo = false,
}: BookingFlowProps) {
  const router = useRouter();

  // Determine initial service
  const initialServiceId = useMemo(() => {
    if (preselectedServiceId && services.some((s) => s.id === preselectedServiceId)) {
      return preselectedServiceId;
    }
    return null;
  }, [preselectedServiceId, services]);

  // Booking state
  const [state, setState] = useState<BookingState>({
    serviceId: initialServiceId,
    memberId: null,
    locationId: null,
    slot: null,
    clientInfo: initialClientInfo,
  });

  // Current step
  const [currentStep, setCurrentStep] = useState<BookingStep>(
    initialServiceId ? (isTeam ? 'member' : 'slot') : 'service'
  );

  // Loading and error states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get selected entities
  const selectedService = useMemo(
    () => services.find((s) => s.id === state.serviceId) || null,
    [services, state.serviceId]
  );

  const selectedMember = useMemo(
    () => members.find((m) => m.id === state.memberId) || null,
    [members, state.memberId]
  );

  const selectedLocation = useMemo(
    () => locations.find((l) => l.id === state.locationId) || null,
    [locations, state.locationId]
  );

  // Get available members for selected service
  const availableMembers = useMemo(() => {
    if (!selectedService) return [];

    // If service has specific members assigned, filter to those
    if (selectedService.memberIds && selectedService.memberIds.length > 0) {
      return members.filter((m) => selectedService.memberIds?.includes(m.id));
    }

    // If service has specific locations, filter members by those locations
    if (selectedService.locationIds.length > 0) {
      return members.filter((m) => selectedService.locationIds.includes(m.locationId));
    }

    return members;
  }, [selectedService, members]);

  // Auto-select member if only one available (for non-team or single member scenarios)
  useEffect(() => {
    if (!isTeam && selectedService && !state.memberId) {
      const defaultMember = members.find((m) => m.isDefault) || members[0];
      if (defaultMember) {
        setState((prev) => ({
          ...prev,
          memberId: defaultMember.id,
          locationId: defaultMember.locationId,
        }));
      }
    }
  }, [isTeam, selectedService, members, state.memberId]);

  // Get open days for selected member (days where isOpen=true and has slots)
  const openDays = useMemo(() => {
    if (!state.memberId) return [];
    return availabilities
      .filter((a) => a.memberId === state.memberId && a.isOpen && a.slots.length > 0)
      .map((a) => a.dayOfWeek);
  }, [state.memberId, availabilities]);

  // Steps configuration
  const steps: { id: BookingStep; label: string }[] = useMemo(() => {
    const baseSteps: { id: BookingStep; label: string }[] = [
      { id: 'service', label: 'Prestation' },
    ];

    if (isTeam) {
      baseSteps.push({ id: 'member', label: 'Professionnel' });
    }

    baseSteps.push(
      { id: 'slot', label: 'Date & Heure' },
      { id: 'confirm', label: 'Confirmation' }
    );

    return baseSteps;
  }, [isTeam]);

  const currentStepIndex = steps.findIndex((s) => s.id === currentStep);

  // Navigation handlers
  const handleServiceSelect = (serviceId: string) => {
    setState((prev) => ({
      ...prev,
      serviceId,
      memberId: null,
      locationId: null,
      slot: null,
    }));

    if (isTeam) {
      setCurrentStep('member');
    } else {
      // Auto-select default member for solo providers
      const defaultMember = members.find((m) => m.isDefault) || members[0];
      if (defaultMember) {
        setState((prev) => ({
          ...prev,
          serviceId,
          memberId: defaultMember.id,
          locationId: defaultMember.locationId,
          slot: null,
        }));
      }
      setCurrentStep('slot');
    }
  };

  const handleMemberSelect = (memberId: string) => {
    const member = members.find((m) => m.id === memberId);
    setState((prev) => ({
      ...prev,
      memberId,
      locationId: member?.locationId || null,
      slot: null,
    }));
    setCurrentStep('slot');
  };

  const handleSlotSelect = (slot: TimeSlotWithDate) => {
    setState((prev) => ({ ...prev, slot }));
    setCurrentStep('confirm');
  };

  const handleClientInfoChange = (info: Partial<BookingState['clientInfo']>) => {
    setState((prev) => ({
      ...prev,
      clientInfo: { ...prev.clientInfo, ...info },
    }));
  };

  const handleBack = () => {
    const currentIndex = steps.findIndex((s) => s.id === currentStep);
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1].id);
    }
  };

  const handleSubmit = async () => {
    if (!state.serviceId || !state.memberId || !state.slot || !state.locationId) {
      setError('Informations manquantes');
      return;
    }

    // Demo mode — skip real API, show success screen
    if (isDemo) {
      setIsSubmitting(true);
      // Brief delay to simulate submission feel
      await new Promise((r) => setTimeout(r, 800));
      setIsSubmitting(false);
      setCurrentStep('demo-success');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerId: provider.id,
          providerSlug: provider.slug,
          serviceId: state.serviceId,
          memberId: state.memberId,
          locationId: state.locationId,
          datetime: state.slot.datetime,
          clientInfo: state.clientInfo,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Une erreur est survenue');
      }

      const { bookingId } = await response.json();
      router.push(`/reservation/confirmation/${bookingId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center gap-4">
          <Link
            href={`/p/${provider.slug}`}
            className="p-2 -ml-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="font-semibold text-gray-900 dark:text-white truncate">
              {provider.businessName}
            </h1>
          </div>
        </div>
      </header>

      {/* Progress Steps */}
      {currentStep !== 'demo-success' && (
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => {
              const isCompleted = index < currentStepIndex;
              const isCurrent = index === currentStepIndex;

              return (
                <div key={step.id} className="flex items-center flex-1">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                        isCompleted
                          ? 'bg-primary-600 text-white'
                          : isCurrent
                          ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 ring-2 ring-primary-600'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500'
                      }`}
                    >
                      {isCompleted ? <Check className="w-4 h-4" /> : index + 1}
                    </div>
                    <span
                      className={`text-sm font-medium hidden sm:block ${
                        isCurrent
                          ? 'text-primary-600 dark:text-primary-400'
                          : isCompleted
                          ? 'text-gray-700 dark:text-gray-300'
                          : 'text-gray-400 dark:text-gray-500'
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>
                  {index < steps.length - 1 && (
                    <div
                      className={`flex-1 h-0.5 mx-2 sm:mx-4 ${
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
      </div>
      )}

      {/* Main Content — pb-24 on mobile to account for fixed bottom recap bar */}
      <div className={`max-w-4xl mx-auto px-4 py-6 ${selectedService && currentStep !== 'demo-success' ? 'pb-24 lg:pb-6' : ''}`}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Step Content */}
          <div className="lg:col-span-2">
            {error && (
              <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">
                {error}
              </div>
            )}

            {currentStep === 'service' && (
              <StepService
                services={services}
                categories={serviceCategories}
                selectedServiceId={state.serviceId}
                onSelect={handleServiceSelect}
              />
            )}

            {currentStep === 'member' && selectedService && (
              <StepMember
                members={availableMembers}
                locations={locations}
                selectedMemberId={state.memberId}
                onSelect={handleMemberSelect}
                onBack={handleBack}
              />
            )}

            {currentStep === 'slot' && selectedService && state.memberId && (
              <StepSlot
                providerId={provider.id}
                serviceId={state.serviceId!}
                memberId={state.memberId}
                serviceDuration={selectedService.duration + selectedService.bufferTime}
                maxAdvanceDays={provider.settings.maxBookingAdvance}
                selectedSlot={state.slot}
                onSelect={handleSlotSelect}
                onBack={handleBack}
                openDays={openDays}
                isDemo={isDemo}
              />
            )}

            {currentStep === 'confirm' && selectedService && state.slot && (
              <StepConfirm
                clientInfo={state.clientInfo}
                onChange={handleClientInfoChange}
                onSubmit={handleSubmit}
                onBack={handleBack}
                isSubmitting={isSubmitting}
                requiresConfirmation={provider.settings.requiresConfirmation}
              />
            )}

            {/* Demo success screen */}
            {currentStep === 'demo-success' && (
              <div className="text-center py-12">
                <div className="mx-auto w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-6">
                  <CalendarCheck className="w-8 h-8 text-green-600 dark:text-green-400" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  Réservation confirmée !
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-sm mx-auto">
                  C&apos;est exactement ce que vos clients verront après avoir réservé chez vous.
                </p>

                {/* Recap */}
                {selectedService && state.slot && (
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-5 mb-8 max-w-sm mx-auto text-left">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{selectedService.name}</p>
                    {selectedMember && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">avec {selectedMember.name}</p>
                    )}
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      {new Date(state.slot.datetime).toLocaleDateString('fr-FR', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                      })} à {state.slot.start}
                    </p>
                  </div>
                )}

                {/* CTA */}
                <div className="flex flex-col items-center gap-3">
                  <div className="bg-primary-50 dark:bg-primary-900/20 rounded-xl px-5 py-4 max-w-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                      <p className="text-sm font-semibold text-primary-700 dark:text-primary-300">
                        Cette page pourrait être la vôtre
                      </p>
                    </div>
                    <p className="text-xs text-primary-600/80 dark:text-primary-400/80">
                      Configurez votre page de réservation en 5 minutes. Vos clients pourront réserver 24h/24.
                    </p>
                  </div>

                  <Link
                    href="/register"
                    className="inline-flex items-center gap-2 bg-primary-600 text-white hover:bg-primary-700 px-6 py-3 text-sm font-semibold rounded-lg transition-colors"
                  >
                    Creer ma page gratuitement
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                  <p className="text-xs text-gray-500 dark:text-gray-500">
                    {APP_CONFIG.trialDays} jours gratuits, sans carte bancaire
                  </p>

                  <Link
                    href="/p/demo"
                    className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 mt-2"
                  >
                    ← Retour à la boutique démo
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Recap Sidebar */}
          {currentStep !== 'demo-success' && (
          <div className="hidden lg:block">
            <BookingRecap
              service={selectedService}
              member={selectedMember}
              location={selectedLocation}
              slot={state.slot}
              provider={provider}
            />
          </div>
          )}
        </div>
      </div>

      {/* Mobile Recap */}
      {selectedService && currentStep !== 'demo-success' && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4 z-30">
          <BookingRecap
            service={selectedService}
            member={selectedMember}
            location={selectedLocation}
            slot={state.slot}
            provider={provider}
            compact
          />
        </div>
      )}
    </div>
  );
}
