import { serviceRepository, bookingRepository } from '../repositories';
import type { Service } from '@booking-app/shared';
import {
  createServiceSchema,
  updateServiceSchema,
  type CreateServiceInput,
  type UpdateServiceInput,
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
      locationIds: validated.locationIds,
      memberIds: validated.memberIds || null,
      isActive: true,
      sortOrder,
    });

    const service = await serviceRepository.getById(providerId, serviceId);
    if (!service) {
      throw new Error('Erreur lors de la création de la prestation');
    }

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
}

// Singleton instance
export const catalogService = new CatalogService();
