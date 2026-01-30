/**
 * BookingContext
 * Manages the booking flow state across multiple screens
 */

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import type { Service, Member, Location, Provider } from '@booking-app/shared';
import type { WithId } from '@booking-app/firebase';

// Time slot from scheduling service
interface TimeSlot {
  date: Date;
  start: string;
  end: string;
  datetime: Date;
  endDatetime: Date;
}

interface BookingState {
  // Provider info
  provider: WithId<Provider> | null;
  providerId: string | null;

  // Selected service
  service: WithId<Service> | null;
  serviceId: string | null;

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
  // Actions
  initBooking: (provider: WithId<Provider>, service: WithId<Service>) => void;
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
  service: null,
  serviceId: null,
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

  // Initialize booking with provider and service
  const initBooking = useCallback((provider: WithId<Provider>, service: WithId<Service>) => {
    setState({
      ...initialState,
      provider,
      providerId: provider.id,
      service,
      serviceId: service.id,
    });
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
    !!state.serviceId &&
    !!state.memberId &&
    !!state.selectedSlot;

  return (
    <BookingContext.Provider
      value={{
        ...state,
        initBooking,
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
