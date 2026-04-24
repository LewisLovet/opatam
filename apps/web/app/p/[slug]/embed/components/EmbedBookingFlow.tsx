'use client';

import { useState, useMemo, useEffect } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { StepMember } from '../../reserver/components/StepMember';
import { StepSlot } from '../../reserver/components/StepSlot';
import { StepConfirm } from '../../reserver/components/StepConfirm';
import { EmbedServices } from './EmbedServices';
import { EmbedHeader } from './EmbedHeader';
import { EmbedFooter } from './EmbedFooter';
import { EmbedSuccess } from './EmbedSuccess';

// ─── Types (slim, only what the widget needs) ──────────────────────────────

interface EmbedProvider {
  id: string;
  businessName: string;
  slug: string;
  photoURL: string | null;
  plan: string;
  settings: {
    maxBookingAdvance: number;
    requiresConfirmation: boolean;
    bookingNotice?: string | null;
  };
}

interface EmbedService {
  id: string;
  name: string;
  description: string | null;
  photoURL: string | null;
  duration: number;
  price: number;
  priceMax: number | null;
  bufferTime: number;
  categoryId: string | null;
  locationIds: string[];
  memberIds: string[] | null;
}

interface EmbedServiceCategory {
  id: string;
  name: string;
  sortOrder: number;
}

interface EmbedLocation {
  id: string;
  name: string;
  address: string;
  city: string;
  postalCode: string;
  type: 'fixed' | 'mobile';
}

interface EmbedMember {
  id: string;
  name: string;
  photoURL: string | null;
  locationId: string;
  isDefault: boolean;
}

interface EmbedAvailability {
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

interface EmbedBookingFlowProps {
  provider: EmbedProvider;
  services: EmbedService[];
  serviceCategories: EmbedServiceCategory[];
  locations: EmbedLocation[];
  members: EmbedMember[];
  availabilities: EmbedAvailability[];
  /** Pre-selected service id from ?service=... in the URL */
  preselectedServiceId?: string | null;
  /** Show the mini provider header (true for popup/floating modes). */
  showHeader?: boolean;
  /** Demo mode — don't hit the real booking API. */
  isDemo?: boolean;
}

type Step = 'services' | 'member' | 'slot' | 'confirm' | 'success';

// ─── Component ─────────────────────────────────────────────────────────────

export function EmbedBookingFlow({
  provider,
  services,
  serviceCategories,
  locations,
  members,
  availabilities,
  preselectedServiceId = null,
  showHeader = false,
  isDemo = false,
}: EmbedBookingFlowProps) {
  const isTeam = provider.plan === 'team' && members.length > 1;

  // ── State ────────────────────────────────────────────────────────────────
  const initialServiceId = useMemo(() => {
    if (preselectedServiceId && services.some((s) => s.id === preselectedServiceId)) {
      return preselectedServiceId;
    }
    return null;
  }, [preselectedServiceId, services]);

  const [step, setStep] = useState<Step>(initialServiceId ? (isTeam ? 'member' : 'slot') : 'services');
  const [serviceId, setServiceId] = useState<string | null>(initialServiceId);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [locationId, setLocationId] = useState<string | null>(null);
  const [slot, setSlot] = useState<TimeSlotWithDate | null>(null);
  const [clientInfo, setClientInfo] = useState({ name: '', email: '', phone: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Booking notice modal
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [pendingServiceId, setPendingServiceId] = useState<string | null>(null);

  // ── Derived ──────────────────────────────────────────────────────────────
  const selectedService = useMemo(
    () => services.find((s) => s.id === serviceId) || null,
    [services, serviceId]
  );
  const selectedMember = useMemo(
    () => members.find((m) => m.id === memberId) || null,
    [members, memberId]
  );
  const selectedLocation = useMemo(
    () => locations.find((l) => l.id === locationId) || null,
    [locations, locationId]
  );

  const availableMembers = useMemo(() => {
    if (!selectedService) return [];
    if (selectedService.memberIds && selectedService.memberIds.length > 0) {
      return members.filter((m) => selectedService.memberIds?.includes(m.id));
    }
    if (selectedService.locationIds.length > 0) {
      return members.filter((m) => selectedService.locationIds.includes(m.locationId));
    }
    return members;
  }, [selectedService, members]);

  const openDays = useMemo(() => {
    if (!memberId) return [];
    return availabilities
      .filter((a) => a.memberId === memberId && a.isOpen && a.slots.length > 0)
      .map((a) => a.dayOfWeek);
  }, [memberId, availabilities]);

  // ── Auto-select solo member on service change ────────────────────────────
  useEffect(() => {
    if (!isTeam && selectedService && !memberId) {
      const defaultMember = members.find((m) => m.isDefault) || members[0];
      if (defaultMember) {
        setMemberId(defaultMember.id);
        setLocationId(defaultMember.locationId);
      }
    }
  }, [isTeam, selectedService, members, memberId]);

  // ── Post height message on step change so iframe auto-resizes ────────────
  useEffect(() => {
    // Defer by a tick to let DOM repaint before measuring
    const t = setTimeout(() => {
      try {
        window.parent.postMessage(
          { type: 'opatam-embed-height', height: document.documentElement.scrollHeight },
          '*'
        );
      } catch { /* no-op */ }
    }, 0);
    return () => clearTimeout(t);
  }, [step]);

  // ── Actions ──────────────────────────────────────────────────────────────
  const proceedWithService = (id: string) => {
    setServiceId(id);
    setMemberId(null);
    setLocationId(null);
    setSlot(null);
    setError(null);

    if (isTeam) {
      setStep('member');
    } else {
      const defaultMember = members.find((m) => m.isDefault) || members[0];
      if (defaultMember) {
        setMemberId(defaultMember.id);
        setLocationId(defaultMember.locationId);
      }
      setStep('slot');
    }
  };

  const handleServiceSelect = (id: string) => {
    if (provider.settings.bookingNotice) {
      setPendingServiceId(id);
      setNoticeOpen(true);
    } else {
      proceedWithService(id);
    }
  };

  const handleNoticeAccept = () => {
    setNoticeOpen(false);
    if (pendingServiceId) {
      proceedWithService(pendingServiceId);
      setPendingServiceId(null);
    }
  };

  const handleBack = () => {
    setError(null);
    if (step === 'confirm') setStep('slot');
    else if (step === 'slot') setStep(isTeam ? 'member' : 'services');
    else if (step === 'member') setStep('services');
  };

  const handleReset = () => {
    setServiceId(null);
    setMemberId(null);
    setLocationId(null);
    setSlot(null);
    setClientInfo({ name: '', email: '', phone: '' });
    setError(null);
    setStep('services');
  };

  const handleSubmit = async () => {
    if (!serviceId || !memberId || !slot || !locationId) {
      setError('Informations manquantes');
      return;
    }

    if (isDemo) {
      setSubmitting(true);
      await new Promise((r) => setTimeout(r, 700));
      setSubmitting(false);
      setStep('success');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providerId: provider.id,
          providerSlug: provider.slug,
          serviceId,
          memberId,
          locationId,
          datetime: slot.datetime,
          clientInfo,
          source: 'embed',
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Une erreur est survenue');
      }
      setStep('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Small compact recap shown above member/slot/confirm steps ────────────
  const renderRecap = () => {
    if (!selectedService || step === 'services' || step === 'success') return null;
    return (
      <div className="mb-4 p-2.5 rounded-lg bg-primary-50 dark:bg-primary-900/10 border border-primary-100 dark:border-primary-900/30">
        <p className="text-xs text-primary-600 dark:text-primary-400 font-medium uppercase tracking-wide">
          Prestation
        </p>
        <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
          {selectedService.name}
        </p>
      </div>
    );
  };

  return (
    <div className="min-h-[400px] flex flex-col bg-white dark:bg-gray-900">
      {showHeader && (
        <EmbedHeader
          businessName={provider.businessName}
          photoURL={provider.photoURL}
        />
      )}

      <div className="flex-1 px-4 pt-4">
        {/* Recap card (sub-step specific Back button is inside each Step component) */}
        {renderRecap()}

        {/* Error banner */}
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Step content */}
        {step === 'services' && (
          <EmbedServices
            services={services}
            categories={serviceCategories}
            onSelect={handleServiceSelect}
          />
        )}

        {step === 'member' && selectedService && (
          <StepMember
            members={availableMembers}
            locations={locations}
            selectedMemberId={memberId}
            onSelect={(id) => {
              const m = members.find((mm) => mm.id === id);
              setMemberId(id);
              setLocationId(m?.locationId || null);
              setSlot(null);
              setStep('slot');
            }}
            onBack={handleBack}
          />
        )}

        {step === 'slot' && selectedService && memberId && (
          <StepSlot
            providerId={provider.id}
            serviceId={serviceId!}
            memberId={memberId}
            serviceDuration={selectedService.duration + selectedService.bufferTime}
            maxAdvanceDays={provider.settings.maxBookingAdvance}
            selectedSlot={slot}
            onSelect={(s) => {
              setSlot(s);
              setStep('confirm');
            }}
            onBack={handleBack}
            openDays={openDays}
            isDemo={isDemo}
          />
        )}

        {step === 'confirm' && selectedService && slot && (
          <StepConfirm
            clientInfo={clientInfo}
            onChange={(info) => setClientInfo((c) => ({ ...c, ...info }))}
            onSubmit={handleSubmit}
            onBack={handleBack}
            isSubmitting={submitting}
            requiresConfirmation={provider.settings.requiresConfirmation}
          />
        )}

        {step === 'success' && selectedService && slot && (
          <EmbedSuccess
            serviceName={selectedService.name}
            memberName={selectedMember?.name || null}
            locationName={selectedLocation?.name || null}
            datetime={slot.datetime}
            onReset={handleReset}
          />
        )}

        {/* Spinner overlay during submit */}
        {submitting && (
          <div className="fixed inset-0 z-40 bg-white/60 dark:bg-gray-900/60 backdrop-blur-sm flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
          </div>
        )}
      </div>

      <EmbedFooter />

      {/* Booking notice modal (overlayed on top of everything) */}
      {noticeOpen && provider.settings.bookingNotice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => {
              setNoticeOpen(false);
              setPendingServiceId(null);
            }}
          />
          <div className="relative w-full max-w-sm bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-5 animate-fade-in">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-9 h-9 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              </div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                Information importante
              </h3>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-line mb-5">
              {provider.settings.bookingNotice}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setNoticeOpen(false);
                  setPendingServiceId(null);
                }}
                className="flex-1 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Retour
              </button>
              <button
                onClick={handleNoticeAccept}
                className="flex-1 px-3 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors"
              >
                Continuer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
