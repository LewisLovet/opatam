import { locationRepository, bookingRepository, memberRepository, availabilityRepository, providerRepository } from '../repositories';
import type { Location } from '@booking-app/shared';
import {
  createLocationSchema,
  updateLocationSchema,
  normalizeCity,
  type CreateLocationInput,
  type UpdateLocationInput,
} from '@booking-app/shared';
import type { WithId } from '../repositories/base.repository';

export class LocationService {
  /**
   * Create a new location
   */
  async createLocation(providerId: string, input: CreateLocationInput): Promise<WithId<Location>> {
    // Validate input
    const validated = createLocationSchema.parse(input);

    // Check if this is the first location (make it default)
    const existingLocations = await locationRepository.getByProvider(providerId);
    const isDefault = existingLocations.length === 0;

    // Create location
    const locationId = await locationRepository.create(providerId, {
      name: validated.name,
      address: validated.address || '',
      city: validated.city,
      postalCode: validated.postalCode,
      geopoint: validated.geopoint || null,
      description: validated.description || null,
      type: validated.type,
      travelRadius: validated.travelRadius ?? null,
      isDefault,
      isActive: true,
    });

    const location = await locationRepository.getById(providerId, locationId);
    if (!location) {
      throw new Error('Erreur lors de la création du lieu');
    }

    // Update provider's cities
    await this.updateProviderCities(providerId);

    return location;
  }

  /**
   * Update location
   */
  async updateLocation(
    providerId: string,
    locationId: string,
    input: UpdateLocationInput
  ): Promise<void> {
    // Validate input
    const validated = updateLocationSchema.parse(input);

    // Check location exists
    const location = await locationRepository.getById(providerId, locationId);
    if (!location) {
      throw new Error('Lieu non trouvé');
    }

    await locationRepository.update(providerId, locationId, validated);

    // Update provider's cities if city or isActive changed
    if (validated.city !== undefined || validated.isActive !== undefined) {
      await this.updateProviderCities(providerId);
    }
  }

  /**
   * Delete location
   */
  async deleteLocation(providerId: string, locationId: string): Promise<void> {
    // Check location exists
    const location = await locationRepository.getById(providerId, locationId);
    if (!location) {
      throw new Error('Lieu non trouvé');
    }

    // Check for future confirmed bookings at this location
    const allBookings = await bookingRepository.getByProvider(providerId);
    const now = new Date();
    const hasFutureBookings = allBookings.some(
      (b) =>
        b.locationId === locationId &&
        b.datetime > now &&
        (b.status === 'confirmed' || b.status === 'pending')
    );

    if (hasFutureBookings) {
      throw new Error(
        'Impossible de supprimer ce lieu car il a des réservations futures. Annulez ou déplacez ces réservations d\'abord.'
      );
    }

    // NOUVEAU MODÈLE: Check if any members are assigned to this location
    // In the new model, members have a single locationId, so we can't just remove it
    const members = await memberRepository.getByLocation(providerId, locationId);
    if (members.length > 0) {
      // Get other locations to potentially reassign members
      const otherLocations = await locationRepository.getByProvider(providerId);
      const availableLocation = otherLocations.find((l) => l.id !== locationId && l.isActive);

      if (availableLocation) {
        // Reassign members to another location
        for (const member of members) {
          await memberRepository.update(providerId, member.id, { locationId: availableLocation.id });
          // Also update their availability records
          await availabilityRepository.updateLocationForMember(providerId, member.id, availableLocation.id);
        }
      } else {
        throw new Error(
          'Impossible de supprimer ce lieu car des membres y sont assignés et aucun autre lieu n\'est disponible.'
        );
      }
    }

    // If this was the default location, make another one default
    if (location.isDefault) {
      const remainingLocations = await locationRepository.getByProvider(providerId);
      const otherLocation = remainingLocations.find((l) => l.id !== locationId && l.isActive);
      if (otherLocation) {
        await locationRepository.update(providerId, otherLocation.id, { isDefault: true });
      }
    }

    await locationRepository.delete(providerId, locationId);

    // Update provider's cities
    await this.updateProviderCities(providerId);
  }

  /**
   * Set location as default
   */
  async setDefault(providerId: string, locationId: string): Promise<void> {
    // Check location exists
    const location = await locationRepository.getById(providerId, locationId);
    if (!location) {
      throw new Error('Lieu non trouvé');
    }

    await locationRepository.setDefault(providerId, locationId);
  }

  /**
   * Deactivate location (soft delete)
   */
  async deactivateLocation(providerId: string, locationId: string): Promise<void> {
    const location = await locationRepository.getById(providerId, locationId);
    if (!location) {
      throw new Error('Lieu non trouvé');
    }

    // Check for future bookings
    const allBookings = await bookingRepository.getByProvider(providerId);
    const now = new Date();
    const hasFutureBookings = allBookings.some(
      (b) =>
        b.locationId === locationId &&
        b.datetime > now &&
        (b.status === 'confirmed' || b.status === 'pending')
    );

    if (hasFutureBookings) {
      throw new Error(
        'Impossible de désactiver ce lieu car il a des réservations futures. Annulez ou déplacez ces réservations d\'abord.'
      );
    }

    await locationRepository.toggleActive(providerId, locationId, false);

    // Update provider's cities
    await this.updateProviderCities(providerId);
  }

  /**
   * Reactivate location
   */
  async reactivateLocation(providerId: string, locationId: string): Promise<void> {
    const location = await locationRepository.getById(providerId, locationId);
    if (!location) {
      throw new Error('Lieu non trouvé');
    }

    await locationRepository.toggleActive(providerId, locationId, true);

    // Update provider's cities
    await this.updateProviderCities(providerId);
  }

  /**
   * Get location by ID
   */
  async getById(providerId: string, locationId: string): Promise<WithId<Location> | null> {
    return locationRepository.getById(providerId, locationId);
  }

  /**
   * Get all locations for a provider
   */
  async getByProvider(providerId: string): Promise<WithId<Location>[]> {
    return locationRepository.getByProvider(providerId);
  }

  /**
   * Get active locations for a provider
   */
  async getActiveByProvider(providerId: string): Promise<WithId<Location>[]> {
    return locationRepository.getActiveByProvider(providerId);
  }

  /**
   * Get default location for a provider
   */
  async getDefault(providerId: string): Promise<WithId<Location> | null> {
    return locationRepository.getDefault(providerId);
  }

  /**
   * Get locations by city
   */
  async getByCity(providerId: string, city: string): Promise<WithId<Location>[]> {
    return locationRepository.getByCity(providerId, city);
  }

  /**
   * Update location geopoint (from address geocoding)
   */
  async updateGeopoint(
    providerId: string,
    locationId: string,
    geopoint: { latitude: number; longitude: number }
  ): Promise<void> {
    await locationRepository.update(providerId, locationId, { geopoint });
  }

  /**
   * Get count of locations
   */
  async countByProvider(providerId: string): Promise<number> {
    return locationRepository.countByProvider(providerId);
  }

  /**
   * Recalculate and update provider's cities array
   * Called after location create/update/delete
   */
  async updateProviderCities(providerId: string): Promise<void> {
    const activeLocations = await locationRepository.getActiveByProvider(providerId);

    // Extract and normalize unique cities
    const citiesSet = new Set<string>();
    for (const location of activeLocations) {
      if (location.city) {
        citiesSet.add(normalizeCity(location.city));
      }
    }

    const cities = Array.from(citiesSet).sort();
    await providerRepository.update(providerId, { cities });
  }
}

// Singleton instance
export const locationService = new LocationService();
