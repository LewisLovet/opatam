/**
 * Hooks - Main Export
 *
 * Custom React hooks for Firebase data fetching
 */

export { useProviders, useTopProviders } from './useProviders';
export type { UseProvidersOptions, UseProvidersResult } from './useProviders';

export { useProvider } from './useProvider';
export type { UseProviderResult } from './useProvider';

export { useServices } from './useServices';
export type { UseServicesResult } from './useServices';

export { useServiceCategories } from './useServiceCategories';
export type { UseServiceCategoriesResult } from './useServiceCategories';

export { useReviews } from './useReviews';
export type { UseReviewsResult } from './useReviews';

export { useLocations } from './useLocations';
export type { UseLocationsResult } from './useLocations';

export { useNavigateToProvider } from './useNavigateToProvider';

export { useAppReady } from './useAppReady';

export { useClientBookings } from './useClientBookings';
export type { UseClientBookingsResult } from './useClientBookings';

export { useNextBooking } from './useNextBooking';
export type { UseNextBookingResult } from './useNextBooking';

export { useMembers } from './useMembers';
export type { UseMembersResult } from './useMembers';

export { useAvailableSlots } from './useAvailableSlots';
export type { UseAvailableSlotsResult, UseAvailableSlotsParams, TimeSlot, DaySlots } from './useAvailableSlots';

export { useProviderById } from './useProviderById';
export type { UseProviderByIdResult } from './useProviderById';

export { useNextAvailableDate } from './useNextAvailableDate';
export type { UseNextAvailableDateResult } from './useNextAvailableDate';

export { useUserLocation } from './useUserLocation';
export type { UserLocation, UseUserLocationResult } from './useUserLocation';

export { useNearbyProviders } from './useNearbyProviders';
export type { NearbyProvider, UseNearbyProvidersResult } from './useNearbyProviders';
