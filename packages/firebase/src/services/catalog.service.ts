import { serviceRepository, bookingRepository, providerRepository, serviceCategoryRepository } from '../repositories';
import type { Service, ServiceCategory } from '@booking-app/shared';
import {
  createServiceSchema,
  updateServiceSchema,
  createServiceCategorySchema,
  updateServiceCategorySchema,
  type CreateServiceInput,
  type UpdateServiceInput,
  type CreateServiceCategoryInput,
  type UpdateServiceCategoryInput,
} from '@booking-app/shared';
import type { WithId } from '../repositories/base.repository';

export class CatalogService {
  /**
   * Create a new service (prestation)
   */
  async createService(providerId: string, input: CreateServiceInput): Promise<WithId<Service>> {
    // Validate input
    const validated = createServiceSchema.parse(input);

    // Get current service count for sortOrder
    const existingServices = await serviceRepository.getByProvider(providerId);
    const sortOrder = existingServices.length;

    // Create service
    const serviceId = await serviceRepository.create(providerId, {
      name: validated.name,
      description: validated.description || null,
      duration: validated.duration,
      price: validated.price,
      bufferTime: validated.bufferTime || 0,
      categoryId: validated.categoryId ?? null,
      locationIds: validated.locationIds,
      memberIds: validated.memberIds || null,
      isActive: true,
      sortOrder,
    });

    const service = await serviceRepository.getById(providerId, serviceId);
    if (!service) {
      throw new Error('Erreur lors de la création de la prestation');
    }

    // Update provider's minPrice
    await this.updateProviderMinPrice(providerId);

    return service;
  }

  /**
   * Update service
   */
  async updateService(
    providerId: string,
    serviceId: string,
    input: UpdateServiceInput
  ): Promise<void> {
    // Validate input
    const validated = updateServiceSchema.parse(input);

    // Check service exists
    const service = await serviceRepository.getById(providerId, serviceId);
    if (!service) {
      throw new Error('Prestation non trouvée');
    }

    await serviceRepository.update(providerId, serviceId, validated);

    // Update provider's minPrice if price or isActive changed
    if (validated.price !== undefined || validated.isActive !== undefined) {
      await this.updateProviderMinPrice(providerId);
    }
  }

  /**
   * Delete service
   */
  async deleteService(providerId: string, serviceId: string): Promise<void> {
    // Check service exists
    const service = await serviceRepository.getById(providerId, serviceId);
    if (!service) {
      throw new Error('Prestation non trouvée');
    }

    // Check for future confirmed bookings using this service
    const allBookings = await bookingRepository.getByProvider(providerId);
    const now = new Date();
    const hasFutureBookings = allBookings.some(
      (b) =>
        b.serviceId === serviceId &&
        b.datetime > now &&
        (b.status === 'confirmed' || b.status === 'pending')
    );

    if (hasFutureBookings) {
      throw new Error(
        'Impossible de supprimer cette prestation car elle est utilisée dans des réservations futures. Désactivez-la plutôt.'
      );
    }

    await serviceRepository.delete(providerId, serviceId);

    // Update provider's minPrice
    await this.updateProviderMinPrice(providerId);
  }

  /**
   * Deactivate service (soft delete)
   */
  async deactivateService(providerId: string, serviceId: string): Promise<void> {
    const service = await serviceRepository.getById(providerId, serviceId);
    if (!service) {
      throw new Error('Prestation non trouvée');
    }

    await serviceRepository.toggleActive(providerId, serviceId, false);

    // Update provider's minPrice
    await this.updateProviderMinPrice(providerId);
  }

  /**
   * Reactivate service
   */
  async reactivateService(providerId: string, serviceId: string): Promise<void> {
    const service = await serviceRepository.getById(providerId, serviceId);
    if (!service) {
      throw new Error('Prestation non trouvée');
    }

    await serviceRepository.toggleActive(providerId, serviceId, true);

    // Update provider's minPrice
    await this.updateProviderMinPrice(providerId);
  }

  /**
   * Reorder services
   */
  async reorderServices(providerId: string, orderedIds: string[]): Promise<void> {
    const updatePromises = orderedIds.map((serviceId, index) =>
      serviceRepository.update(providerId, serviceId, { sortOrder: index })
    );
    await Promise.all(updatePromises);
  }

  /**
   * Get service by ID
   */
  async getById(providerId: string, serviceId: string): Promise<WithId<Service> | null> {
    return serviceRepository.getById(providerId, serviceId);
  }

  /**
   * Get all services for a provider
   */
  async getByProvider(providerId: string): Promise<WithId<Service>[]> {
    return serviceRepository.getByProvider(providerId);
  }

  /**
   * Get active services for a provider
   */
  async getActiveByProvider(providerId: string): Promise<WithId<Service>[]> {
    return serviceRepository.getActiveByProvider(providerId);
  }

  /**
   * Get services available at a specific location
   */
  async getByLocation(providerId: string, locationId: string): Promise<WithId<Service>[]> {
    return serviceRepository.getByLocation(providerId, locationId);
  }

  /**
   * Get services that a specific member can perform
   */
  async getByMember(providerId: string, memberId: string): Promise<WithId<Service>[]> {
    return serviceRepository.getByMember(providerId, memberId);
  }

  /**
   * Get services by price range
   */
  async getByPriceRange(
    providerId: string,
    minPrice: number,
    maxPrice: number
  ): Promise<WithId<Service>[]> {
    return serviceRepository.getByPriceRange(providerId, minPrice, maxPrice);
  }

  /**
   * Get count of services
   */
  async countByProvider(providerId: string): Promise<number> {
    return serviceRepository.countByProvider(providerId);
  }

  /**
   * Add location to service
   */
  async addLocation(providerId: string, serviceId: string, locationId: string): Promise<void> {
    const service = await serviceRepository.getById(providerId, serviceId);
    if (!service) {
      throw new Error('Prestation non trouvée');
    }

    if (!service.locationIds.includes(locationId)) {
      await serviceRepository.update(providerId, serviceId, {
        locationIds: [...service.locationIds, locationId],
      });
    }
  }

  /**
   * Remove location from service
   */
  async removeLocation(providerId: string, serviceId: string, locationId: string): Promise<void> {
    const service = await serviceRepository.getById(providerId, serviceId);
    if (!service) {
      throw new Error('Prestation non trouvée');
    }

    const updatedLocationIds = service.locationIds.filter((id) => id !== locationId);
    if (updatedLocationIds.length === 0) {
      throw new Error('Une prestation doit avoir au moins un lieu');
    }

    await serviceRepository.update(providerId, serviceId, {
      locationIds: updatedLocationIds,
    });
  }

  /**
   * Add member to service
   */
  async addMember(providerId: string, serviceId: string, memberId: string): Promise<void> {
    const service = await serviceRepository.getById(providerId, serviceId);
    if (!service) {
      throw new Error('Prestation non trouvée');
    }

    const currentMemberIds = service.memberIds || [];
    if (!currentMemberIds.includes(memberId)) {
      await serviceRepository.update(providerId, serviceId, {
        memberIds: [...currentMemberIds, memberId],
      });
    }
  }

  /**
   * Remove member from service
   */
  async removeMember(providerId: string, serviceId: string, memberId: string): Promise<void> {
    const service = await serviceRepository.getById(providerId, serviceId);
    if (!service) {
      throw new Error('Prestation non trouvée');
    }

    if (service.memberIds) {
      const updatedMemberIds = service.memberIds.filter((id) => id !== memberId);
      await serviceRepository.update(providerId, serviceId, {
        memberIds: updatedMemberIds.length > 0 ? updatedMemberIds : null,
      });
    }
  }

  /**
   * Duplicate service
   */
  async duplicateService(providerId: string, serviceId: string): Promise<WithId<Service>> {
    const service = await serviceRepository.getById(providerId, serviceId);
    if (!service) {
      throw new Error('Prestation non trouvée');
    }

    // Get current count for sortOrder
    const existingServices = await serviceRepository.getByProvider(providerId);
    const sortOrder = existingServices.length;

    // Create duplicate
    const newServiceId = await serviceRepository.create(providerId, {
      name: `${service.name} (copie)`,
      description: service.description,
      duration: service.duration,
      price: service.price,
      bufferTime: service.bufferTime,
      categoryId: service.categoryId,
      locationIds: service.locationIds,
      memberIds: service.memberIds,
      isActive: false, // Start as inactive
      sortOrder,
    });

    const newService = await serviceRepository.getById(providerId, newServiceId);
    if (!newService) {
      throw new Error('Erreur lors de la duplication de la prestation');
    }

    return newService;
  }

  // ─── Service Categories ──────────────────────────────────────────

  async createCategory(providerId: string, input: CreateServiceCategoryInput): Promise<WithId<ServiceCategory>> {
    const validated = createServiceCategorySchema.parse(input);

    const existing = await serviceCategoryRepository.getByProvider(providerId);
    const sortOrder = existing.length;

    const categoryId = await serviceCategoryRepository.create(providerId, {
      name: validated.name,
      sortOrder,
      isActive: true,
    });

    const category = await serviceCategoryRepository.getById(providerId, categoryId);
    if (!category) {
      throw new Error('Erreur lors de la création de la catégorie');
    }

    return category;
  }

  async updateCategory(
    providerId: string,
    categoryId: string,
    input: UpdateServiceCategoryInput
  ): Promise<void> {
    const validated = updateServiceCategorySchema.parse(input);

    const category = await serviceCategoryRepository.getById(providerId, categoryId);
    if (!category) {
      throw new Error('Catégorie non trouvée');
    }

    await serviceCategoryRepository.update(providerId, categoryId, validated);
  }

  async deleteCategory(providerId: string, categoryId: string): Promise<void> {
    const category = await serviceCategoryRepository.getById(providerId, categoryId);
    if (!category) {
      throw new Error('Catégorie non trouvée');
    }

    // Unassign services from this category
    const services = await serviceRepository.getByProvider(providerId);
    const assignedServices = services.filter((s) => s.categoryId === categoryId);
    await Promise.all(
      assignedServices.map((s) =>
        serviceRepository.update(providerId, s.id, { categoryId: null })
      )
    );

    await serviceCategoryRepository.delete(providerId, categoryId);
  }

  async getCategoriesByProvider(providerId: string): Promise<WithId<ServiceCategory>[]> {
    return serviceCategoryRepository.getByProvider(providerId);
  }

  async reorderCategories(providerId: string, orderedIds: string[]): Promise<void> {
    await Promise.all(
      orderedIds.map((categoryId, index) =>
        serviceCategoryRepository.update(providerId, categoryId, { sortOrder: index })
      )
    );
  }

  /**
   * Recalculate and update provider's minPrice
   * Called after service create/update/delete
   */
  async updateProviderMinPrice(providerId: string): Promise<void> {
    const activeServices = await serviceRepository.getActiveByProvider(providerId);

    let minPrice: number | null = null;
    if (activeServices.length > 0) {
      minPrice = Math.min(...activeServices.map((s) => s.price));
    }

    await providerRepository.update(providerId, { minPrice });
  }
}

// Singleton instance
export const catalogService = new CatalogService();
