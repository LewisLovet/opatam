'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { trackEvent } from '@/lib/meta-pixel';
import { ArrowLeft, Check, CalendarCheck, Store, Info, ArrowRight, Trash2, Plus } from 'lucide-react';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { localizedPath } from '@/lib/localizedPath';
import { LanguageSwitcher } from '@/components/common/LanguageSwitcher';
import { APP_CONFIG } from '@booking-app/shared/constants';
import type { ServiceDiscount } from '@booking-app/shared';
import {
  computeDiscountedTotal,
  resolveServiceDiscount,
  getDiscountDaysLeft,
  validateServiceSelections,
  emptyServiceSelections,
  serviceHasChoices,
  formatPrice,
  formatDuration,
  type ServiceSelections,
  type ServiceVariation,
  type ServiceOption,
  type ServiceInfoField,
} from '@booking-app/shared';
import { ServiceChoicesPicker } from '@/components/booking/ServiceChoicesPicker';
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
    bookingNotice?: string | null;
    globalDiscount?: ServiceDiscount | null;
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
  variations?: ServiceVariation[];
  options?: ServiceOption[];
  infoFields?: ServiceInfoField[];
  discount?: ServiceDiscount | null;
}

interface Location {
  id: string;
  name: string;
  address: string;
  city: string;
  postalCode: string;
  type: 'fixed' | 'mobile';
  protectAddress?: boolean;
  approxArea?: string | null;
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

/** One prestation in the "panier": a service + its chosen variations/options. */
interface CartItem {
  serviceId: string;
  selections: ServiceSelections;
}

interface BookingState {
  /** Primary service — kept in sync with cart[0]?.serviceId. Many
   *  references (member filtering, selectedService, recap) rely on it. */
  serviceId: string | null;
  /** Multi-prestation cart. cart[0] is the primary service. */
  cart: CartItem[];
  memberId: string | null;
  locationId: string | null;
  slot: TimeSlotWithDate | null;
  /** Variations / options chosen for the selected service. */
  selections: ServiceSelections;
  clientInfo: {
    name: string;
    email: string;
    phone: string;
  };
}

/** Human-readable labels of the chosen variations/options for a service. */
function fmtChoiceEuro(cents: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function buildChoiceLabels(
  service: Service | undefined,
  selections: ServiceSelections,
  locale: string,
): string[] {
  if (!service) return [];
  const labels: string[] = [];
  // Variations: "Longueur : Mi-dos"
  for (const v of service.variations ?? []) {
    const chosen = v.options.find((o) => o.id === selections.variations[v.id]);
    if (chosen) labels.push(`${v.name} : ${chosen.name}`);
  }
  // Options (add-ons): "+ Mèches (+15 €)" with their nested variations/infos
  for (const o of service.options ?? []) {
    const selOpt = selections.options[o.id];
    if (!selOpt) continue;
    labels.push(o.price > 0 ? `+ ${o.name} (+${fmtChoiceEuro(o.price, locale)})` : `+ ${o.name}`);
    for (const nv of o.nestedVariations ?? []) {
      const chosen = nv.options.find((x) => x.id === selOpt.nestedVariations[nv.id]);
      if (chosen) labels.push(`${nv.name} : ${chosen.name}`);
    }
    for (const nf of o.nestedInfoFields ?? []) {
      const val = selOpt.infoValues[nf.id];
      if (val) labels.push(`${nf.name} : ${val}`);
    }
  }
  // Top-level info answers: "Allergies ? : Oui"
  for (const f of service.infoFields ?? []) {
    const val = selections.infoValues[f.id];
    if (val) labels.push(`${f.name} : ${val}`);
  }
  return labels;
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
  const t = useTranslations('booking');
  const locale = useLocale();

  // Determine initial service (deep-link via ?service=)
  const initialService = useMemo(() => {
    if (preselectedServiceId) {
      return services.find((s) => s.id === preselectedServiceId) ?? null;
    }
    return null;
  }, [preselectedServiceId, services]);

  // A deep-linked service with NO choices can be added to the cart straight
  // away (and the flow advances past the service step). A deep-linked
  // service WITH choices must be configured first, so we seed the
  // configuration view instead of the cart and stay on the service step.
  const initialHasChoices = !!initialService && serviceHasChoices(initialService);
  const initialCart: CartItem[] =
    initialService && !initialHasChoices
      ? [{ serviceId: initialService.id, selections: emptyServiceSelections() }]
      : [];

  // Booking state
  const [state, setState] = useState<BookingState>({
    serviceId: initialService?.id ?? null,
    cart: initialCart,
    memberId: null,
    locationId: null,
    slot: null,
    selections: emptyServiceSelections(),
    clientInfo: initialClientInfo,
  });

  // When set, the service step shows the variations/options picker for this
  // service instead of the cart + service list. Used both for the
  // "+ ajouter" draft and for a deep-linked service that needs configuring.
  const [configuringServiceId, setConfiguringServiceId] = useState<string | null>(
    initialHasChoices ? initialService!.id : null,
  );

  // Whether the "add another prestation" service list is expanded. The list
  // is always shown while the cart is empty (there is nothing to recap yet);
  // once the cart has at least one prestation it collapses behind a
  // "+ Ajouter une autre prestation" button so the recap reads clearly.
  const [isAddingService, setIsAddingService] = useState(false);

  // Always start on the service step — even with a deep-link (?service=).
  // The preselected prestation is pre-loaded in the cart (or its choices
  // picker is opened), but we stay here so the client sees the
  // "Composez votre rendez-vous" panier and can ADD other prestations
  // before continuing, instead of being dropped straight into the calendar.
  const [currentStep, setCurrentStep] = useState<BookingStep>('service');

  // Loading and error states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Booking notice modal — shown ONCE before proceeding to the slot step
  // (on "Continuer"), not on every prestation added to the cart.
  const [showNotice, setShowNotice] = useState(false);
  const [noticeAcknowledged, setNoticeAcknowledged] = useState(false);

  // Keep state.serviceId == cart[0].serviceId (the "primary"). Member
  // filtering, selectedService and the recap rely on it — mirrors the pro
  // modal which keeps formData.serviceId in sync with cart[0].
  useEffect(() => {
    const primary = state.cart[0]?.serviceId ?? null;
    setState((prev) => (prev.serviceId === primary ? prev : { ...prev, serviceId: primary }));
  }, [state.cart]);

  // Get selected entities
  const selectedService = useMemo(
    () => services.find((s) => s.id === state.serviceId) || null,
    [services, state.serviceId]
  );

  // Cart prestations resolved to their Service docs + effective
  // price/duration (variations/options applied). Drives the cart list, the
  // running total, the slot duration, the recap.
  // Shop-wide promo applied to services without their own discount.
  const globalDiscount = provider.settings.globalDiscount ?? null;

  const cartLines = useMemo(
    () =>
      state.cart
        .map((item) => {
          const service = services.find((s) => s.id === item.serviceId);
          if (!service) return null;
          const total = computeDiscountedTotal(service, item.selections, globalDiscount);
          return {
            item,
            service,
            price: total.price,
            duration: total.duration,
            original: total.original,
          };
        })
        .filter((l): l is NonNullable<typeof l> => l !== null),
    [state.cart, services, globalDiscount],
  );

  // Summed effective price/duration over the whole cart. The duration also
  // adds a SINGLE buffer at the end (the last cart service's bufferTime),
  // which drives the slot length — mirrors the pro modal's totalDuration.
  const cartTotalPrice = useMemo(
    () => cartLines.reduce((sum, l) => sum + l.price, 0),
    [cartLines],
  );
  // Pre-discount total + aggregate % — drives the crossed-out price / badge.
  const cartTotalOriginal = useMemo(
    () => cartLines.reduce((sum, l) => sum + l.original, 0),
    [cartLines],
  );
  const cartDiscountPercent = useMemo(
    () =>
      cartTotalOriginal > cartTotalPrice
        ? Math.round(((cartTotalOriginal - cartTotalPrice) / cartTotalOriginal) * 100)
        : null,
    [cartTotalOriginal, cartTotalPrice],
  );
  // Soonest-ending active promo in the cart → drives the urgency line in the
  // recap ("Plus que N jours · jusqu'au …").
  const cartPromo = useMemo(() => {
    let best: { daysLeft: number; endsAt: string } | null = null;
    for (const l of cartLines) {
      const active = resolveServiceDiscount(l.service, globalDiscount);
      const daysLeft = getDiscountDaysLeft(active);
      if (daysLeft == null || !active?.endsAt) continue;
      if (!best || daysLeft < best.daysLeft) best = { daysLeft, endsAt: active.endsAt };
    }
    return best;
  }, [cartLines, globalDiscount]);
  const cartTotalDuration = useMemo(
    () => cartLines.reduce((sum, l) => sum + l.duration, 0),
    [cartLines],
  );
  const cartSlotDuration = useMemo(
    () =>
      cartLines.length === 0
        ? 0
        : cartTotalDuration + (cartLines[cartLines.length - 1].service.bufferTime ?? 0),
    [cartLines, cartTotalDuration],
  );

  // How many times each service sits in the cart (duplicates allowed) — drives
  // the "✓ Ajouté ×N" badge on the service cards.
  const cartCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of state.cart) {
      counts[item.serviceId] = (counts[item.serviceId] ?? 0) + 1;
    }
    return counts;
  }, [state.cart]);

  // Human-readable labels of every cart item's chosen variations/options
  // for the recap. When the cart holds more than one prestation, each label
  // is prefixed with the service name (e.g. "Dread locks · Longueur: Mi-dos")
  // so the client can tell which prestation a choice belongs to.
  const choiceLabels = useMemo(() => {
    const multi = cartLines.length > 1;
    const labels: string[] = [];
    for (const line of cartLines) {
      const itemLabels = buildChoiceLabels(line.service, line.item.selections, locale);
      if (multi) {
        // Always surface the service name (with its choices appended).
        labels.push(
          itemLabels.length > 0
            ? `${line.service.name} · ${itemLabels.join(' · ')}`
            : line.service.name,
        );
      } else {
        labels.push(...itemLabels);
      }
    }
    return labels;
  }, [cartLines, locale]);

  const selectedMember = useMemo(
    () => members.find((m) => m.id === state.memberId) || null,
    [members, state.memberId]
  );

  const selectedLocation = useMemo(
    () => locations.find((l) => l.id === state.locationId) || null,
    [locations, state.locationId]
  );

  // Get members who can perform EVERY prestation in the cart (intersection).
  // A member qualifies for a single cart service when: it's in the service's
  // memberIds (if set), else its location is in the service's locationIds
  // (if set), else any member qualifies.
  const availableMembers = useMemo(() => {
    if (cartLines.length === 0) return [];

    const qualifiesFor = (memberId: string, locationId: string, svc: Service) => {
      if (svc.memberIds && svc.memberIds.length > 0) {
        return svc.memberIds.includes(memberId);
      }
      if (svc.locationIds.length > 0) {
        return svc.locationIds.includes(locationId);
      }
      return true;
    };

    return members.filter((m) =>
      cartLines.every((line) => qualifiesFor(m.id, m.locationId, line.service)),
    );
  }, [cartLines, members]);

  // Meta Pixel — InitiateCheckout once per landing on the booking
  // flow. We fire on mount (not per-step) because reaching this page
  // is already strong intent: the visitor clicked "Réserver" from the
  // public profile. We include the preselected service price when
  // available so Meta can optimise on value, but it's not required
  // (the event is still useful without a value).
  useEffect(() => {
    if (isDemo) return;
    trackEvent('InitiateCheckout', {
      content_name: provider.businessName,
      content_category: 'booking',
      content_ids: [provider.slug],
      value: selectedService?.price ? selectedService.price / 100 : undefined,
      currency: selectedService?.price ? 'EUR' : undefined,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      { id: 'service', label: t('steps.service') },
    ];

    if (isTeam) {
      baseSteps.push({ id: 'member', label: t('steps.member') });
    }

    baseSteps.push(
      { id: 'slot', label: t('steps.slot') },
      { id: 'confirm', label: t('steps.confirm') }
    );

    return baseSteps;
  }, [isTeam, t]);

  const currentStepIndex = steps.findIndex((s) => s.id === currentStep);

  // Navigation handlers

  // Add a fully-resolved prestation to the cart.
  const addToCart = (item: CartItem) => {
    setState((prev) => ({
      ...prev,
      cart: [...prev.cart, item],
      // Adding/removing a prestation changes the total duration → any
      // already-picked member/slot must be re-validated downstream.
      memberId: null,
      locationId: null,
      slot: null,
    }));
    // Collapse the service list → back to the cart recap.
    setIsAddingService(false);
  };

  const removeFromCart = (index: number) => {
    setState((prev) => ({
      ...prev,
      cart: prev.cart.filter((_, i) => i !== index),
      memberId: null,
      locationId: null,
      slot: null,
    }));
  };

  // Tap a service in the list: a service with variations/options opens the
  // picker (stay on the service step); a plain one is added straight away.
  // No booking notice here — it now shows once, on "Continuer".
  const handleServiceSelect = (serviceId: string) => {
    const svc = services.find((s) => s.id === serviceId);
    if (svc && serviceHasChoices(svc)) {
      setState((prev) => ({ ...prev, selections: emptyServiceSelections() }));
      setConfiguringServiceId(serviceId);
    } else if (svc) {
      addToCart({ serviceId, selections: emptyServiceSelections() });
    }
  };

  // The service currently being configured in the choices picker (the draft).
  const configuringService = useMemo(
    () => services.find((s) => s.id === configuringServiceId) || null,
    [services, configuringServiceId],
  );

  const draftValidation = useMemo(
    () =>
      configuringService
        ? validateServiceSelections(configuringService, state.selections)
        : { valid: true, missing: [] as string[] },
    [configuringService, state.selections],
  );
  const draftMissingSet = useMemo(
    () => new Set(draftValidation.missing),
    [draftValidation],
  );
  const draftEffective = useMemo(
    () =>
      configuringService
        ? computeDiscountedTotal(configuringService, state.selections, globalDiscount)
        : { price: 0, duration: 0, original: 0, discountPercent: null },
    [configuringService, state.selections, globalDiscount],
  );
  const draftHasPromo =
    draftEffective.discountPercent != null && draftEffective.original > draftEffective.price;

  // Confirm the chosen variations/options → push the draft to the cart and
  // return to the cart view (so the client can add more or continue).
  const handleAddConfiguredToCart = () => {
    if (!configuringServiceId || !draftValidation.valid) return;
    addToCart({ serviceId: configuringServiceId, selections: state.selections });
    setConfiguringServiceId(null);
    setState((prev) => ({ ...prev, selections: emptyServiceSelections() }));
  };

  const handleChoicesBack = () => {
    setConfiguringServiceId(null);
    setState((prev) => ({ ...prev, selections: emptyServiceSelections() }));
  };

  // Advance from the service step to the next step. The booking notice (if
  // any) is shown ONCE here, before proceeding — not on every add.
  const advanceFromService = () => {
    if (state.cart.length === 0) return;
    if (isTeam) {
      setCurrentStep('member');
    } else {
      // Auto-select default member for solo providers.
      const defaultMember = members.find((m) => m.isDefault) || members[0];
      if (defaultMember) {
        setState((prev) => ({
          ...prev,
          memberId: defaultMember.id,
          locationId: defaultMember.locationId,
          slot: null,
        }));
      }
      setCurrentStep('slot');
    }
  };

  const handleContinueFromService = () => {
    if (state.cart.length === 0) return;
    const notice = provider.settings.bookingNotice;
    if (notice && !noticeAcknowledged) {
      setShowNotice(true);
    } else {
      advanceFromService();
    }
  };

  const handleNoticeAccept = () => {
    setShowNotice(false);
    setNoticeAcknowledged(true);
    advanceFromService();
  };

  const handleNoticeClose = () => {
    setShowNotice(false);
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
    if (state.cart.length === 0 || !state.memberId || !state.slot || !state.locationId) {
      setError(t('flow.errorMissingInfo'));
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
          serviceId: state.cart[0].serviceId,
          // Multi-prestation cart: the server recomputes price + duration
          // from every item and persists items[]. serviceId above stays the
          // primary (cart[0]) for backward compatibility.
          items: state.cart.map((c) => ({
            serviceId: c.serviceId,
            selections: c.selections,
          })),
          memberId: state.memberId,
          locationId: state.locationId,
          datetime: state.slot.datetime,
          clientInfo: state.clientInfo,
          // Kept for single-prestation backward compat (== items[0].selections).
          selections: state.cart[0].selections,
          // Language the client booked in → transactional emails follow it.
          clientLocale: locale,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || t('common.error'));
      }

      const data = await response.json();
      // Deposit-required booking: hop to Stripe Checkout. The booking is
      // already reserved server-side as pending_payment.
      if (data.requiresPayment && data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }
      router.push(localizedPath(`/reservation/confirmation/${data.bookingId}`, locale));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('common.error'));
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center gap-4">
          <Link
            href={localizedPath(`/p/${provider.slug}`, locale)}
            className="p-2 -ml-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="font-semibold text-gray-900 dark:text-white truncate">
              {provider.businessName}
            </h1>
          </div>
          {/* Clients land here straight from a QR code / bio link — give them
              a manual language switch even though we auto-detect. */}
          <LanguageSwitcher />
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

      {/* Main Content — bottom padding to clear the fixed bottom bar:
          on the service step the sticky "Continuer" bar shows on ALL widths
          (pb-28); on the other steps only the mobile recap bar (pb-24 lg:pb-6). */}
      <div
        className={`max-w-4xl mx-auto px-4 py-6 ${
          currentStep === 'demo-success'
            ? ''
            : currentStep === 'service' && !configuringServiceId
              ? 'pb-28'
              : selectedService
                ? 'pb-24 lg:pb-6'
                : ''
        }`}
      >
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Step Content */}
          <div className="lg:col-span-2">
            {error && (
              <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400">
                {error}
              </div>
            )}

            {currentStep === 'service' && !configuringServiceId && (
              <div>
                {/* Service-step header — sets the "build a list" expectation. */}
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {t('flow.title')}
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {t('flow.subtitle')}
                  </p>
                </div>

                {/* Cart (panier) — ALWAYS visible so the cart model is obvious. */}
                <div className="mb-6">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">
                    {t('flow.cartTitle')}
                  </h3>
                  {cartLines.length === 0 ? (
                    <div className="rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 px-4 py-6 text-center">
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                        {t('flow.cartEmpty')}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        {t('flow.cartEmptyHint')}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {cartLines.map((line, idx) => {
                        const itemLabels = buildChoiceLabels(line.service, line.item.selections, locale);
                        return (
                          <div
                            key={idx}
                            className="flex items-start justify-between gap-3 p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-gray-900 dark:text-white">
                                {line.service.name}
                              </p>
                              {itemLabels.length > 0 && (
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                  {itemLabels.join(' · ')}
                                </p>
                              )}
                              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                                {formatDuration(line.duration)} · {formatPrice(line.price, 'EUR', locale)}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeFromCart(idx)}
                              className="flex-shrink-0 p-2 -mr-1 rounded-lg text-gray-400 hover:text-error-500 hover:bg-error-50 dark:hover:bg-error-900/20 transition-colors"
                              aria-label={t('flow.removeService')}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        );
                      })}

                      {/* Running total */}
                      <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/60">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          {t('common.total')}
                        </span>
                        <span className="text-sm font-semibold text-gray-900 dark:text-white">
                          {formatDuration(cartTotalDuration)} · {formatPrice(cartTotalPrice, 'EUR', locale)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Service list — shown while the cart is empty, or on demand
                    via "+ Ajouter une autre prestation" once it has items, so
                    the recap above stays front and centre. */}
                {state.cart.length === 0 || isAddingService ? (
                  <div>
                    <StepService
                      services={services}
                      categories={serviceCategories}
                      selectedServiceId={null}
                      onSelect={handleServiceSelect}
                      cartCounts={cartCounts}
                      globalDiscount={globalDiscount}
                    />
                    {state.cart.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setIsAddingService(false)}
                        className="mt-4 w-full px-4 py-2.5 rounded-xl text-sm font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                      >
                        {t('flow.cancelAdd')}
                      </button>
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsAddingService(true)}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-primary-300 dark:border-primary-700 text-sm font-semibold text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    {t('flow.addAnother')}
                  </button>
                )}

                {/* Continue — sticky bar pinned to the bottom of the screen
                    so it's reachable without scrolling past the whole list.
                    Disabled until the cart has at least one prestation; the
                    label surfaces the count + total. */}
                <div className="fixed bottom-0 inset-x-0 z-30 bg-white/95 dark:bg-gray-900/95 backdrop-blur border-t border-gray-200 dark:border-gray-700 shadow-[0_-2px_10px_rgba(0,0,0,0.06)]">
                  <div className="max-w-4xl mx-auto px-4 py-3 flex justify-end">
                    <button
                      type="button"
                      onClick={handleContinueFromService}
                      disabled={state.cart.length === 0}
                      className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-5 py-3 sm:py-2.5 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {state.cart.length === 0
                        ? t('flow.continue')
                        : t('flow.continueWithCart', {
                            count: state.cart.length,
                            total: formatPrice(cartTotalPrice, 'EUR', locale),
                          })}
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Variations / options picker for the service being configured */}
            {currentStep === 'service' && configuringServiceId && configuringService && (
              <div>
                <button
                  type="button"
                  onClick={handleChoicesBack}
                  className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white mb-4"
                >
                  <ArrowLeft className="w-4 h-4" />
                  {t('common.back')}
                </button>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  {configuringService.name}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-5">
                  {t('flow.configureSubtitle')}
                </p>

                <ServiceChoicesPicker
                  service={{
                    variations: configuringService.variations,
                    options: configuringService.options,
                    infoFields: configuringService.infoFields,
                  }}
                  selections={state.selections}
                  onChange={(sel) =>
                    setState((prev) => ({ ...prev, selections: sel }))
                  }
                  missing={draftMissingSet}
                />

                <div className="mt-6 flex items-center justify-between lg:justify-end gap-4 border-t border-gray-100 dark:border-gray-800 pt-4">
                  {/* Price/duration shown here only on mobile — on desktop it
                      lives in the recap sidebar to avoid duplication. */}
                  <div className="lg:hidden">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {formatDuration(draftEffective.duration)}
                    </p>
                    <p className="text-lg font-bold">
                      {draftHasPromo && (
                        <span className="mr-1.5 text-sm font-normal text-gray-400 line-through">
                          {formatPrice(draftEffective.original, 'EUR', locale)}
                        </span>
                      )}
                      <span
                        className={
                          draftHasPromo
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-gray-900 dark:text-white'
                        }
                      >
                        {formatPrice(draftEffective.price, 'EUR', locale)}
                      </span>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddConfiguredToCart}
                    disabled={!draftValidation.valid}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {t('flow.addToCart')}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
                {!draftValidation.valid && (
                  <p className="mt-2 text-right text-xs text-error-600 dark:text-error-400">
                    {t('flow.missingChoices', { items: draftValidation.missing.join(', ') })}
                  </p>
                )}
              </div>
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
                serviceDuration={cartSlotDuration}
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
                  {t('flow.demo.confirmedTitle')}
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-sm mx-auto">
                  {t('flow.demo.confirmedText')}
                </p>

                {/* Recap */}
                {selectedService && state.slot && (
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-5 mb-8 max-w-sm mx-auto text-left">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{selectedService.name}</p>
                    {selectedMember && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('flow.demo.with', { name: selectedMember.name })}</p>
                    )}
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      {t('common.dateAtTime', {
                        date: new Date(state.slot.datetime).toLocaleDateString(locale, {
                          weekday: 'long',
                          day: 'numeric',
                          month: 'long',
                        }),
                        time: state.slot.start,
                      })}
                    </p>
                  </div>
                )}

                {/* App download CTA */}
                <div style={{ backgroundColor: '#f9fafb', border: '1px solid #e5e7eb' }} className="rounded-xl p-5 mb-4 max-w-sm mx-auto">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#111827' }}>
                      <span className="font-bold text-sm" style={{ color: '#ffffff' }}>O</span>
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-sm font-semibold mb-0.5" style={{ color: '#111827' }}>
                        {t('appCta.title')}
                      </p>
                      <p className="text-xs mb-3" style={{ color: '#6b7280' }}>
                        {t('appCta.subtitle')}
                      </p>
                      <div className="flex gap-2">
                        <a
                          href="https://apps.apple.com/app/opatam/id6759246218"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-xs font-medium rounded-lg hover:opacity-90 transition-opacity"
                        >
                          <svg className="w-3.5 h-3.5" viewBox="0 0 384 512" fill="currentColor"><path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5c0 26.2 4.8 53.3 14.4 81.2 12.8 36.9 59 127.7 107.2 126.3 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-93z"/><path d="M262.2 97.3c29.4-35.6 26.5-68.2 25.7-79.7-25.6 1.5-55.1 17.7-72.1 38.2-18.6 22.3-29.6 49.8-27.1 79.6 27.6 2.1 53.4-13.6 73.5-38.1z"/></svg>
                          App Store
                        </a>
                        <a
                          href="https://play.google.com/store/apps/details?id=com.kamerleontech.opatam"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-xs font-medium rounded-lg hover:opacity-90 transition-opacity"
                        >
                          <svg className="w-3.5 h-3.5" viewBox="0 0 512 512" fill="currentColor"><path d="M325.3 234.3L104.6 13l280.8 161.2-60.1 60.1zM47 0C34 6.8 25.3 19.2 25.3 35.3v441.3c0 16.1 8.7 28.5 21.7 35.3l256.6-256L47 0zm425.2 225.6l-58.9-34.1-65.7 64.5 65.7 64.5 60.1-34.1c18-14.3 18-46.5-1.2-60.8zM104.6 499l280.8-161.2-60.1-60.1L104.6 499z"/></svg>
                          Google Play
                        </a>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Pro CTA */}
                <div className="flex flex-col items-center gap-3">
                  <div style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe' }} className="rounded-xl px-5 py-4 max-w-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <Store className="w-5 h-5" style={{ color: '#2563eb' }} />
                      <p className="text-sm font-semibold" style={{ color: '#1d4ed8' }}>
                        {t('proCta.title')}
                      </p>
                    </div>
                    <p className="text-xs" style={{ color: '#3b82f6' }}>
                      {t('proCta.subtitle')}
                    </p>
                  </div>

                  <Link
                    href="/register"
                    className="inline-flex items-center gap-2 bg-primary-600 text-white hover:bg-primary-700 px-6 py-3 text-sm font-semibold rounded-lg transition-colors"
                  >
                    {t('proCta.button')}
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                  <p className="text-xs text-gray-500 dark:text-gray-500">
                    {t('flow.demo.trialNote', { days: APP_CONFIG.trialDays })}
                  </p>

                  <Link
                    href={localizedPath('/p/demo', locale)}
                    className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 mt-2"
                  >
                    {t('flow.demo.backToShop')}
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
              serviceLabel={cartLines.length > 1 ? t('flow.servicesCount', { count: cartLines.length }) : undefined}
              member={selectedMember}
              location={selectedLocation}
              slot={state.slot}
              provider={provider}
              effectivePrice={cartTotalPrice}
              effectiveDuration={cartTotalDuration}
              originalPrice={cartTotalOriginal}
              discountPercent={cartDiscountPercent}
              promoEndsAt={cartPromo?.endsAt ?? null}
              promoDaysLeft={cartPromo?.daysLeft ?? null}
              choiceLabels={choiceLabels}
            />
          </div>
          )}
        </div>
      </div>

      {/* Mobile Recap — hidden while configuring choices, and on the service
          step (the sticky "Continuer" bar already shows the total there). */}
      {cartLines.length > 0 &&
        currentStep !== 'demo-success' &&
        currentStep !== 'service' &&
        !configuringServiceId && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4 z-30">
          <BookingRecap
            service={selectedService}
            serviceLabel={cartLines.length > 1 ? t('flow.servicesCount', { count: cartLines.length }) : undefined}
            member={selectedMember}
            location={selectedLocation}
            slot={state.slot}
            provider={provider}
            effectivePrice={cartTotalPrice}
            effectiveDuration={cartTotalDuration}
            originalPrice={cartTotalOriginal}
            discountPercent={cartDiscountPercent}
            promoEndsAt={cartPromo?.endsAt ?? null}
            promoDaysLeft={cartPromo?.daysLeft ?? null}
            choiceLabels={choiceLabels}
            compact
          />
        </div>
      )}
      {/* Booking Notice Modal */}
      {showNotice && provider.settings.bookingNotice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleNoticeClose} />
          <div className="relative w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 animate-fade-in">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <Info className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                {t('flow.notice.title')}
              </h3>
            </div>
            <p className="text-gray-600 dark:text-gray-300 text-sm whitespace-pre-line mb-6">
              {provider.settings.bookingNotice}
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleNoticeClose}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                {t('common.back')}
              </button>
              <button
                onClick={handleNoticeAccept}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors"
              >
                {t('flow.notice.accept')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
