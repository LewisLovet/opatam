/**
 * BookingContext
 * Manages the booking flow state across multiple screens.
 *
 * Multi-prestation: the visit is a CART of prestations booked back-to-back.
 * `cart[0]` is the "primary" service — its values are surfaced via the derived
 * `service` / `serviceId` / `selections` fields so older single-service code
 * keeps working. Durations sum across the cart; a single buffer is added after
 * the last one for the slot search.
 */

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import type { Service, Member, Location, Provider, ServiceSelections } from '@booking-app/shared';
import { emptyServiceSelections } from '@booking-app/shared';
import type { WithId } from '@booking-app/firebase';

// Time slot from scheduling service
interface TimeSlot {
  date: Date;
  start: string;
  end: string;
  datetime: Date;
  endDatetime: Date;
}

/** One prestation in the visit, with its chosen variations/options/infos. */
export interface CartItem {
  service: WithId<Service>;
  selections: ServiceSelections;
}

interface BookingState {
  // Provider info
  provider: WithId<Provider> | null;
  providerId: string | null;

  // Multi-prestation cart (cart[0] = primary).
  cart: CartItem[];

  // Selected member (team member performing the service)
  member: WithId<Member> | null;
  memberId: string | null;

  // Selected location
  location: WithId<Location> | null;
  locationId: string | null;

  // Selected date and time slot
  selectedDate: Date | null;
  selectedSlot: TimeSlot | null;
}

interface BookingContextValue extends BookingState {
  // Derived (primary prestation = cart[0]) — back-compat for single-service code
  service: WithId<Service> | null;
  serviceId: string | null;
  selections: ServiceSelections | null;

  // Actions
  initBooking: (provider: WithId<Provider>, service?: WithId<Service>) => void;
  addToCart: (service: WithId<Service>, selections?: ServiceSelections) => void;
  removeFromCart: (index: number) => void;
  setSelections: (selections: ServiceSelections) => void;
  setMember: (member: WithId<Member>) => void;
  setLocation: (location: WithId<Location>) => void;
  setDateAndSlot: (date: Date, slot: TimeSlot) => void;
  resetBooking: () => void;

  // Computed
  isReady: boolean;
  currentStep: 'member' | 'date' | 'confirm';
}

const initialState: BookingState = {
  provider: null,
  providerId: null,
  cart: [],
  member: null,
  memberId: null,
  location: null,
  locationId: null,
  selectedDate: null,
  selectedSlot: null,
};

const BookingContext = createContext<BookingContextValue | undefined>(undefined);

export function BookingProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<BookingState>(initialState);

  // Initialise with a provider (and optionally seed the cart with one service).
  const initBooking = useCallback((provider: WithId<Provider>, service?: WithId<Service>) => {
    setState({
      ...initialState,
      provider,
      providerId: provider.id,
      cart: service ? [{ service, selections: emptyServiceSelections() }] : [],
    });
  }, []);

  // Append a prestation to the cart (duplicates allowed). Clears the chosen
  // slot since the visit duration changed.
  const addToCart = useCallback((service: WithId<Service>, selections?: ServiceSelections) => {
    setState((prev) => ({
      ...prev,
      cart: [...prev.cart, { service, selections: selections ?? emptyServiceSelections() }],
      selectedDate: null,
      selectedSlot: null,
    }));
  }, []);

  const removeFromCart = useCallback((index: number) => {
    setState((prev) => ({
      ...prev,
      cart: prev.cart.filter((_, i) => i !== index),
      selectedDate: null,
      selectedSlot: null,
    }));
  }, []);

  // Update the primary (cart[0]) prestation's choices.
  const setSelections = useCallback((selections: ServiceSelections) => {
    setState((prev) =>
      prev.cart.length === 0
        ? prev
        : { ...prev, cart: [{ ...prev.cart[0], selections }, ...prev.cart.slice(1)] },
    );
  }, []);

  // Set member (and their associated location)
  const setMember = useCallback((member: WithId<Member>) => {
    setState((prev) => ({
      ...prev,
      member,
      memberId: member.id,
      // Member has a single locationId in the new model
      locationId: member.locationId,
      // Reset date/slot when member changes
      selectedDate: null,
      selectedSlot: null,
    }));
  }, []);

  // Set location (optional override)
  const setLocation = useCallback((location: WithId<Location>) => {
    setState((prev) => ({
      ...prev,
      location,
      locationId: location.id,
    }));
  }, []);

  // Set date and time slot
  const setDateAndSlot = useCallback((date: Date, slot: TimeSlot) => {
    setState((prev) => ({
      ...prev,
      selectedDate: date,
      selectedSlot: slot,
    }));
  }, []);

  // Reset booking state
  const resetBooking = useCallback(() => {
    setState(initialState);
  }, []);

  // Compute current step
  const getCurrentStep = (): 'member' | 'date' | 'confirm' => {
    if (!state.memberId) return 'member';
    if (!state.selectedSlot) return 'date';
    return 'confirm';
  };

  // Check if booking is ready for confirmation
  const isReady =
    !!state.providerId &&
    state.cart.length > 0 &&
    !!state.memberId &&
    !!state.selectedSlot;

  const primary = state.cart[0] ?? null;

  return (
    <BookingContext.Provider
      value={{
        ...state,
        // Derived primary prestation
        service: primary?.service ?? null,
        serviceId: primary?.service.id ?? null,
        selections: primary?.selections ?? null,
        initBooking,
        addToCart,
        removeFromCart,
        setSelections,
        setMember,
        setLocation,
        setDateAndSlot,
        resetBooking,
        isReady,
        currentStep: getCurrentStep(),
      }}
    >
      {children}
    </BookingContext.Provider>
  );
}

export function useBooking() {
  const context = useContext(BookingContext);
  if (!context) {
    throw new Error('useBooking must be used within BookingProvider');
  }
  return context;
}
