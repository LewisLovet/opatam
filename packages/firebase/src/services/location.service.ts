import { locationRepository, bookingRepository, memberRepository, availabilityRepository, providerRepository } from '../repositories';
import type { Location } from '@booking-app/shared';
import { normaliserFuseau, resoudreFuseauDeLieu } from '@booking-app/shared';
import {
  parseOrThrow,
  createLocationSchema,
  updateLocationSchema,
  normalizeCity,
  getCityRegion, getRegionFromPostalCode,
  getRegionFromCoords,
  PLAN_LIMITS,
  computeEntitlements,
  type CreateLocationInput,
  type UpdateLocationInput,
} from '@booking-app/shared';
import type { WithId } from '../repositories/base.repository';

/**
 * Le fuseau à poser sur un lieu QU'ON CRÉE.
 *
 * Un fuseau saisi explicitement est une correction manuelle et prime.
 * Sinon on résout depuis les coordonnées, à défaut le code postal. Si rien
 * ne tranche — France sans coordonnées ni code postal, pays non servi —
 * on n'écrit RIEN : le lieu ressort « à vérifier » dans le rapport plutôt
 * que gravé à l'heure de Paris.
 */
function fuseauALaCreation(validated: {
  timezone?: string | null;
  geopoint?: { latitude: number; longitude: number } | null;
  countryCode?: string | null;
  postalCode?: string | null;
}): Partial<Location> {
  if (validated.timezone) {
    const zone = normaliserFuseau(validated.timezone);
    if (!zone) {
      throw new Error(
        `Fuseau horaire invalide : « ${validated.timezone} ». Un identifiant IANA est attendu ` +
          `(« Indian/Reunion »), pas un décalage (« +04:00 »).`,
      );
    }
    return { timezone: zone, timezoneSource: 'manual', timezoneResolvedAt: new Date() };
  }
  const r = resoudreFuseauDeLieu(validated.geopoint, validated.countryCode, validated.postalCode);
  if (!r.fuseau) return {};
  return { timezone: r.fuseau, timezoneSource: 'automatic', timezoneResolvedAt: new Date() };
}

export class LocationService {
  /**
   * L'offre qui compte pour les limites : celle des droits calculés, pas le
   * champ `plan` brut. Un accès offert ou un abonnement payant doit lever la
   * limite ; un essai garde la sienne. Même règle que LieuxTab côté web.
   *
   * Renvoie `null` si le prestataire est introuvable : on ne bloque pas une
   * création sur une lecture ratée.
   */
  private async offreEffective(providerId: string): Promise<string | null> {
    try {
      const provider = await providerRepository.getById(providerId);
      if (!provider) return null;
      const ent = computeEntitlements(provider);
      return ent.source === 'paid' || ent.source === 'comp'
        ? (ent.effectivePlan ?? provider.plan ?? null)
        : (provider.plan ?? null);
    } catch {
      return null;
    }
  }

  /**
   * Create a new location
   */
  async createLocation(providerId: string, input: CreateLocationInput & { region?: string | null }, providerPlan?: string): Promise<WithId<Location>> {
    // Validate input
    const validated = parseOrThrow(createLocationSchema, input);

    // Limite de lieux de l'offre — TOUJOURS vérifiée ici.
    //
    // Cette garde existait déjà mais ne s'appliquait que si l'appelant
    // transmettait l'offre, et AUCUN ne le faisait : ni le web, ni le
    // mobile, ni les deux inscriptions. Elle n'avait donc jamais tourné, et
    // un compte solo pouvait créer autant de lieux qu'il voulait (cas
    // blomd.nails : offre solo, 2 lieux). On lit désormais le prestataire
    // nous-mêmes, pour qu'aucun client ne puisse sauter la vérification.
    //
    // L'offre EFFECTIVE, pas le champ brut : un accès offert ou un
    // abonnement payant doit lever la limite même si `plan` dit autre chose.
    const plan = providerPlan ?? (await this.offreEffective(providerId));
    const limits = plan ? PLAN_LIMITS[plan as keyof typeof PLAN_LIMITS] : null;
    if (limits) {
      const activeLocations = await locationRepository.getActiveByProvider(providerId);
      if (activeLocations.length >= limits.maxLocations) {
        throw new Error(
          `Votre offre est limitée à ${limits.maxLocations} lieu(x) actif(s). Passez à l'offre supérieure pour en ajouter.`
        );
      }
    }

    // Check if this is the first location (make it default)
    const existingLocations = await locationRepository.getByProvider(providerId);
    const isDefault = existingLocations.length === 0;

    // Create location
    const locationId = await locationRepository.create(providerId, {
      name: validated.name,
      address: validated.address || '',
      city: validated.city,
      postalCode: validated.postalCode,
      countryCode: validated.countryCode || 'FR',
      geopoint: validated.geopoint || null,
      description: validated.description || null,
      type: validated.type,
      travelRadius: validated.travelRadius ?? null,
      protectAddress: validated.protectAddress ?? false,
      approxArea: validated.approxArea ?? null,
      accessInstructions: validated.accessInstructions ?? null,
      isDefault,
      isActive: true,
      ...fuseauALaCreation(validated),
    });

    const location = await locationRepository.getById(providerId, locationId);
    if (!location) {
      throw new Error('Erreur lors de la création du lieu');
    }

    // Update provider's cities (pass region from address API if available)
    await this.updateProviderCities(providerId, input.region ?? undefined);

    return location;
  }

  /**
   * Update location
   */
  async updateLocation(
    providerId: string,
    locationId: string,
    input: UpdateLocationInput & { region?: string | null }
  ): Promise<void> {
    // Extract region before validation (not part of location schema)
    const { region: regionOverride, ...locationInput } = input;

    // Validate input
    const validated = parseOrThrow(updateLocationSchema, locationInput);

    // Check location exists
    const location = await locationRepository.getById(providerId, locationId);
    if (!location) {
      throw new Error('Lieu non trouvé');
    }

    // Le fuseau suit l'ADRESSE : déplacer un salon de Paris à Saint-Denis
    // doit changer son fuseau, sinon tous ses créneaux restent décalés.
    // On ne touche JAMAIS un fuseau posé à la main.
    const adresseABouge =
      validated.geopoint !== undefined ||
      validated.postalCode !== undefined ||
      validated.countryCode !== undefined;
    const fuseauFourni = validated.timezone !== undefined;

    let fuseauPatch: Partial<Location> = {};
    if (fuseauFourni) {
      // Saisi explicitement : c'est une correction MANUELLE, elle prime et
      // ne sera plus jamais recalculée.
      const zone = normaliserFuseau(validated.timezone);
      if (validated.timezone && !zone) {
        throw new Error(
          `Fuseau horaire invalide : « ${validated.timezone} ». Un identifiant IANA est attendu ` +
            `(« Indian/Reunion »), pas un décalage (« +04:00 »), qui ignorerait les changements d'heure.`,
        );
      }
      fuseauPatch = { timezone: zone, timezoneSource: zone ? 'manual' : null, timezoneResolvedAt: new Date() };
    } else if (adresseABouge && location.timezoneSource !== 'manual') {
      const r = resoudreFuseauDeLieu(
        validated.geopoint !== undefined ? validated.geopoint : location.geopoint,
        validated.countryCode ?? location.countryCode,
        validated.postalCode ?? location.postalCode,
      );
      // `null` = on ne sait pas trancher. On n'écrase alors PAS un fuseau
      // déjà connu, et on n'en invente pas un.
      if (r.fuseau) {
        fuseauPatch = { timezone: r.fuseau, timezoneSource: 'automatic', timezoneResolvedAt: new Date() };
      }
    }

    await locationRepository.update(providerId, locationId, { ...validated, ...fuseauPatch });

    // Update provider's cities if city or isActive changed
    if (validated.city !== undefined || validated.isActive !== undefined) {
      await this.updateProviderCities(providerId, regionOverride ?? undefined);
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
  async reactivateLocation(providerId: string, locationId: string, providerPlan?: string): Promise<void> {
    const location = await locationRepository.getById(providerId, locationId);
    if (!location) {
      throw new Error('Lieu non trouvé');
    }

    // Check plan location limit before reactivating
    if (providerPlan) {
      const limits = PLAN_LIMITS[providerPlan as keyof typeof PLAN_LIMITS];
      if (limits) {
        const activeLocations = await locationRepository.getActiveByProvider(providerId);
        if (activeLocations.length >= limits.maxLocations) {
          throw new Error(
            `Votre plan ${providerPlan} est limité à ${limits.maxLocations} lieu(x) actif(s). Passez au plan supérieur pour réactiver ce lieu.`
          );
        }
      }
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
   * Recalculate and update provider's cities array and geopoint
   * Called after location create/update/delete
   */
  async updateProviderCities(providerId: string, regionOverride?: string): Promise<void> {
    const activeLocations = await locationRepository.getActiveByProvider(providerId);

    // Extract and normalize unique cities
    const citiesSet = new Set<string>();
    for (const location of activeLocations) {
      if (location.city) {
        citiesSet.add(normalizeCity(location.city));
      }
    }

    // Get geopoint from default location (or first active with geopoint)
    const defaultLocation = activeLocations.find((l) => l.isDefault);
    const geopoint =
      defaultLocation?.geopoint ??
      activeLocations.find((l) => l.geopoint)?.geopoint ??
      null;

    // Get countryCode from default location (fallback to 'FR')
    const countryCode = defaultLocation?.countryCode ?? activeLocations[0]?.countryCode ?? 'FR';

    // Determine region: use override from address API, then city lookup (FR), then GPS fallback (FR)
    let region: string | null = regionOverride ?? null;
    if (!region && countryCode === 'FR') {
      const defaultCity = defaultLocation?.city || activeLocations[0]?.city || null;
      region = defaultCity ? getCityRegion(defaultCity) : null;
      // Le code postal d'abord : la liste de villes ne connaît que les
      // grandes, et le géocodage manque souvent (adresse saisie à la main,
      // inscription « ville seule »). Le département, lui, ne ment pas.
      if (!region) {
        const cp = defaultLocation?.postalCode || activeLocations.find((l) => l.postalCode)?.postalCode || null;
        region = getRegionFromPostalCode(cp);
      }
      if (!region && geopoint) {
        region = getRegionFromCoords(geopoint.latitude, geopoint.longitude);
      }
    }

    const cities = Array.from(citiesSet).sort();
    await providerRepository.update(providerId, { cities, geopoint, region, countryCode });
  }
}

// Singleton instance
export const locationService = new LocationService();
