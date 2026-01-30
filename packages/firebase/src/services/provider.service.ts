import {
  providerRepository,
  userRepository,
  locationRepository,
  serviceRepository,
  availabilityRepository,
  memberRepository,
  blockedSlotRepository,
} from '../repositories';
import type { Provider, ProviderPlan } from '@booking-app/shared';
import {
  createProviderSchema,
  updateProviderSchema,
  generateSearchTokens,
  type CreateProviderInput,
  type UpdateProviderInput,
} from '@booking-app/shared';
import type { WithId } from '../repositories/base.repository';

interface PublishCheckResult {
  canPublish: boolean;
  missingItems: string[];
  completeness: {
    hasBusinessName: boolean;
    hasCategory: boolean;
    hasLocation: boolean;
    hasService: boolean;
    hasAvailability: boolean;
  };
}

interface SearchFilters {
  category?: string;
  city?: string;
  query?: string;
  limit?: number;
}

// Duree du trial en jours
const TRIAL_DURATION_DAYS = 7;

export class ProviderService {
  /**
   * Create a new provider for a user
   * Le plan est TOUJOURS 'trial' a la creation
   * IMPORTANT: Provider.id === User.id (meme ID pour simplifier)
   */
  async createProvider(userId: string, input: CreateProviderInput): Promise<WithId<Provider>> {
    // Validate input
    const validated = createProviderSchema.parse(input);

    // Check if provider already exists for this user (Provider.id === User.id)
    const existingProvider = await providerRepository.getById(userId);
    if (existingProvider) {
      throw new Error('Cet utilisateur a déjà un compte prestataire');
    }

    // Generate unique slug
    const slug = await this.generateUniqueSlug(validated.businessName);

    // Calculate trial end date
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + TRIAL_DURATION_DAYS);

    // Generate search tokens from business name
    const searchTokens = generateSearchTokens(validated.businessName);

    // Create provider with userId as document ID (Provider.id === User.id)
    await providerRepository.createWithId(userId, {
      userId,
      plan: 'trial', // Toujours trial a la creation
      businessName: validated.businessName,
      description: validated.description || '',
      category: validated.category || '',
      slug,
      photoURL: null,
      coverPhotoURL: null,
      portfolioPhotos: [],
      socialLinks: {
        instagram: null,
        facebook: null,
        tiktok: null,
        website: null,
      },
      rating: {
        average: 0,
        count: 0,
        distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      },
      settings: {
        reminderTimes: [24, 2], // 24h and 2h before
        requiresConfirmation: false,
        defaultBufferTime: 15,
        timezone: 'Europe/Paris',
        minBookingNotice: 2,
        maxBookingAdvance: 60,
        allowClientCancellation: true,
        cancellationDeadline: 24,
      },
      subscription: {
        plan: 'trial',
        tier: 'standard',
        memberCount: 1, // 1 par defaut, augmente si team
        validUntil: trialEndDate,
        stripeCustomerId: null,
        stripeSubscriptionId: null,
      },
      isPublished: false,
      isVerified: false,
      cities: [],
      minPrice: null,
      searchTokens,
    });

    // Update user with providerId (= userId)
    await userRepository.update(userId, { providerId: userId, role: 'provider' });

    const provider = await providerRepository.getById(userId);
    if (!provider) {
      throw new Error('Erreur lors de la création du compte prestataire');
    }

    return provider;
  }

  /**
   * Update provider profile
   */
  async updateProvider(providerId: string, input: UpdateProviderInput): Promise<void> {
    // Validate input
    const validated = updateProviderSchema.parse(input);

    // Check provider exists
    const provider = await providerRepository.getById(providerId);
    if (!provider) {
      throw new Error('Prestataire non trouvé');
    }

    // If business name changed, update slug and search tokens
    if (validated.businessName && validated.businessName !== provider.businessName) {
      const newSlug = await this.generateUniqueSlug(validated.businessName);
      const searchTokens = generateSearchTokens(validated.businessName);
      await providerRepository.update(providerId, { ...validated, slug: newSlug, searchTokens } as Parameters<typeof providerRepository.update>[1]);
    } else {
      await providerRepository.update(providerId, validated as Parameters<typeof providerRepository.update>[1]);
    }
  }

  /**
   * Upgrade plan from trial to solo or team
   * Appele apres le paiement Stripe
   */
  async upgradePlan(providerId: string, newPlan: 'solo' | 'team'): Promise<void> {
    const provider = await providerRepository.getById(providerId);
    if (!provider) {
      throw new Error('Prestataire non trouvé');
    }

    const memberCount = newPlan === 'team' ? 5 : 1;

    await providerRepository.update(providerId, {
      plan: newPlan,
      subscription: {
        ...provider.subscription,
        plan: newPlan,
        memberCount,
        // validUntil sera mis a jour par Stripe webhook
      },
    });
  }

  /**
   * Update provider settings
   */
  async updateSettings(
    providerId: string,
    settings: Partial<Provider['settings']>
  ): Promise<void> {
    const provider = await providerRepository.getById(providerId);
    if (!provider) {
      throw new Error('Prestataire non trouvé');
    }

    await providerRepository.update(providerId, {
      settings: { ...provider.settings, ...settings },
    });
  }

  /**
   * Update social links
   */
  async updateSocialLinks(
    providerId: string,
    socialLinks: Partial<Provider['socialLinks']>
  ): Promise<void> {
    const provider = await providerRepository.getById(providerId);
    if (!provider) {
      throw new Error('Prestataire non trouvé');
    }

    await providerRepository.update(providerId, {
      socialLinks: { ...provider.socialLinks, ...socialLinks },
    });
  }

  /**
   * Check if provider can be published
   * Retourne une liste detaillee des elements manquants
   */
  async checkPublishRequirements(providerId: string): Promise<PublishCheckResult> {
    const missingItems: string[] = [];

    // Get provider
    const provider = await providerRepository.getById(providerId);
    if (!provider) {
      throw new Error('Prestataire non trouvé');
    }

    // Check business name
    const hasBusinessName = !!provider.businessName && provider.businessName.length >= 2;
    if (!hasBusinessName) {
      missingItems.push('Nom de l\'entreprise');
    }

    // Check category
    const hasCategory = !!provider.category && provider.category.length >= 1;
    if (!hasCategory) {
      missingItems.push('Catégorie d\'activité');
    }

    // Check locations
    const locations = await locationRepository.getActiveByProvider(providerId);
    const hasLocation = locations.length > 0;
    if (!hasLocation) {
      missingItems.push('Au moins un lieu');
    }

    // Check services
    const services = await serviceRepository.getActiveByProvider(providerId);
    const hasService = services.length > 0;
    if (!hasService) {
      missingItems.push('Au moins une prestation');
    }

    // Check availability for each active location
    let hasAvailability = false;
    if (hasLocation) {
      for (const location of locations) {
        const availabilities = await availabilityRepository.getByLocation(providerId, location.id);
        const hasOpenDay = availabilities.some((a) => a.isOpen && a.slots.length > 0);
        if (hasOpenDay) {
          hasAvailability = true;
        } else {
          missingItems.push(`Disponibilités pour "${location.name}"`);
        }
      }
    } else {
      missingItems.push('Disponibilités (créez d\'abord un lieu)');
    }

    return {
      canPublish: missingItems.length === 0,
      missingItems,
      completeness: {
        hasBusinessName,
        hasCategory,
        hasLocation,
        hasService,
        hasAvailability,
      },
    };
  }

  /**
   * Publish provider profile
   * Verifie que tous les elements requis sont presents
   */
  async publishProvider(providerId: string): Promise<PublishCheckResult> {
    const checkResult = await this.checkPublishRequirements(providerId);

    if (!checkResult.canPublish) {
      return checkResult; // Retourne les elements manquants sans throw
    }

    await providerRepository.togglePublished(providerId, true);
    return checkResult;
  }

  /**
   * Unpublish provider profile
   */
  async unpublishProvider(providerId: string): Promise<void> {
    await providerRepository.togglePublished(providerId, false);
  }

  /**
   * Check if trial has expired
   */
  isTrialExpired(provider: Provider): boolean {
    if (provider.plan !== 'trial') {
      return false;
    }
    return new Date() > provider.subscription.validUntil;
  }

  /**
   * Get days remaining in trial
   */
  getTrialDaysRemaining(provider: Provider): number {
    if (provider.plan !== 'trial') {
      return 0;
    }
    const now = new Date();
    const validUntil = provider.subscription.validUntil;
    const diffTime = validUntil.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  }

  /**
   * Get provider by slug (for public page)
   */
  async getBySlug(slug: string): Promise<WithId<Provider> | null> {
    return providerRepository.getBySlug(slug);
  }

  /**
   * Get provider by user ID
   */
  async getByUserId(userId: string): Promise<WithId<Provider> | null> {
    return providerRepository.getByUserId(userId);
  }

  /**
   * Get provider by ID
   */
  async getById(providerId: string): Promise<WithId<Provider> | null> {
    return providerRepository.getById(providerId);
  }

  /**
   * Search providers with filters
   * Uses Firestore queries for category/city, client-side for text search
   */
  async search(filters: SearchFilters): Promise<WithId<Provider>[]> {
    return providerRepository.searchProviders({
      category: filters.category,
      city: filters.city,
      query: filters.query,
    });
  }

  /**
   * Get top rated providers
   */
  async getTopRated(limit: number = 10): Promise<WithId<Provider>[]> {
    return providerRepository.getTopRated(limit);
  }

  /**
   * Get providers by category
   */
  async getByCategory(category: string): Promise<WithId<Provider>[]> {
    return providerRepository.getByCategory(category);
  }

  /**
   * Generate a unique slug from business name
   */
  private async generateUniqueSlug(businessName: string): Promise<string> {
    const baseSlug = businessName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove accents
      .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with dashes
      .replace(/^-+|-+$/g, ''); // Remove leading/trailing dashes

    let slug = baseSlug;
    let counter = 1;

    while (!(await providerRepository.isSlugAvailable(slug))) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    return slug;
  }

  /**
   * Delete provider and all associated data
   * WARNING: This is an irreversible operation
   * Deletes: Members, Locations, Services, Availabilities, BlockedSlots
   * Note: Bookings and Reviews are kept for historical purposes
   */
  async deleteProvider(providerId: string): Promise<void> {
    const provider = await providerRepository.getById(providerId);
    if (!provider) {
      throw new Error('Prestataire non trouve');
    }

    // Delete all subcollections in parallel
    const [members, locations, services, availabilities, blockedSlots] = await Promise.all([
      memberRepository.getByProvider(providerId),
      locationRepository.getByProvider(providerId),
      serviceRepository.getByProvider(providerId),
      availabilityRepository.getByProvider(providerId),
      blockedSlotRepository.getByProvider(providerId),
    ]);

    // Delete members
    const memberDeletes = members.map((m) => memberRepository.delete(providerId, m.id));

    // Delete locations
    const locationDeletes = locations.map((l) => locationRepository.delete(providerId, l.id));

    // Delete services
    const serviceDeletes = services.map((s) => serviceRepository.delete(providerId, s.id));

    // Delete availabilities
    const availabilityDeletes = availabilities.map((a) =>
      availabilityRepository.delete(providerId, a.memberId, a.dayOfWeek)
    );

    // Delete blocked slots
    const blockedSlotDeletes = blockedSlots.map((b) =>
      blockedSlotRepository.delete(providerId, b.id)
    );

    // Execute all deletes in parallel
    await Promise.all([
      ...memberDeletes,
      ...locationDeletes,
      ...serviceDeletes,
      ...availabilityDeletes,
      ...blockedSlotDeletes,
    ]);

    // Delete the provider document itself
    await providerRepository.delete(providerId);

    // Update user to remove provider reference
    await userRepository.update(providerId, { providerId: null, role: 'client' });
  }
}

// Singleton instance
export const providerService = new ProviderService();
