import type { Provider, Location, Service } from '@booking-app/shared';
import type { ProviderCardData } from './ProviderCard';

/**
 * Helper to build ProviderCardData from provider, locations and services
 *
 * @param providerId - The provider's document ID
 * @param provider - The provider document data
 * @param locations - Array of active locations (with their IDs)
 * @param services - Array of active services (with their IDs)
 * @returns ProviderCardData ready for display
 */
export function buildProviderCardData(
  providerId: string,
  provider: Provider,
  locations: Array<{ id: string; data: Location }>,
  services: Array<{ id: string; data: Service }>
): ProviderCardData {
  // Get city from default location, or first active location
  const defaultLocation = locations.find((loc) => loc.data.isDefault && loc.data.isActive);
  const firstActiveLocation = locations.find((loc) => loc.data.isActive);
  const city = defaultLocation?.data.city ?? firstActiveLocation?.data.city ?? null;

  // Get minimum price from active services
  const activeServices = services.filter((svc) => svc.data.isActive);
  const minPrice =
    activeServices.length > 0
      ? Math.min(...activeServices.map((svc) => svc.data.price))
      : null;

  return {
    id: providerId,
    businessName: provider.businessName,
    photoURL: provider.photoURL,
    category: provider.category,
    description: provider.description || null,
    isVerified: provider.isVerified,
    rating: provider.rating.average,
    reviewCount: provider.rating.count,
    city,
    minPrice,
  };
}

/**
 * Helper to build ProviderCardData from raw data (useful for mock data)
 */
export function buildProviderCardDataFromRaw(data: {
  id: string;
  businessName: string;
  photoURL?: string | null;
  category: string;
  description?: string | null;
  isVerified?: boolean;
  rating?: number;
  reviewCount?: number;
  city?: string | null;
  minPrice?: number | null;
}): ProviderCardData {
  return {
    id: data.id,
    businessName: data.businessName,
    photoURL: data.photoURL ?? null,
    category: data.category,
    description: data.description ?? null,
    isVerified: data.isVerified ?? false,
    rating: data.rating,
    reviewCount: data.reviewCount,
    city: data.city ?? null,
    minPrice: data.minPrice ?? null,
  };
}
