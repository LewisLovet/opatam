'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Check } from 'lucide-react';
import Link from 'next/link';
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

interface Service {
  id: string;
  name: string;
  description: string | null;
  duration: number;
  price: number;
  bufferTime: number;
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
  locations: Location[];
  members: Member[];
  availabilities: Availability[];
  isTeam: boolean;
  preselectedServiceId?: string;
}

export type BookingStep = 'service' | 'member' | 'slot' | 'confirm';

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
  locations,
  members,
  availabilities,
  isTeam,
  preselectedServiceId,
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

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 py-6">
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
          </div>

          {/* Recap Sidebar */}
          <div className="hidden lg:block">
            <BookingRecap
              service={selectedService}
              member={selectedMember}
              location={selectedLocation}
              slot={state.slot}
              provider={provider}
            />
          </div>
        </div>
      </div>

      {/* Mobile Recap */}
      {selectedService && (
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
