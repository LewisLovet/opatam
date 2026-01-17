import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  type Firestore,
} from 'firebase/firestore';
import type { Service } from '@booking-app/shared';
import { getFirebaseApp } from '../lib/config';
import { convertTimestamps, removeUndefined, type WithId } from './base.repository';

/**
 * Repository for services subcollection (providers/{providerId}/services)
 */
export class ServiceRepository {
  private db: Firestore;

  constructor() {
    this.db = getFirestore(getFirebaseApp());
  }

  /**
   * Get collection reference for a provider's services
   */
  private getCollectionRef(providerId: string) {
    return collection(this.db, 'providers', providerId, 'services');
  }

  /**
   * Get document reference
   */
  private getDocRef(providerId: string, serviceId: string) {
    return doc(this.db, 'providers', providerId, 'services', serviceId);
  }

  /**
   * Create a new service
   */
  async create(
    providerId: string,
    data: Omit<Service, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<string> {
    const docData = removeUndefined({
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    } as Record<string, unknown>);

    const docRef = await addDoc(this.getCollectionRef(providerId), docData);
    return docRef.id;
  }

  /**
   * Get service by ID
   */
  async getById(providerId: string, serviceId: string): Promise<WithId<Service> | null> {
    const docRef = this.getDocRef(providerId, serviceId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    return {
      id: docSnap.id,
      ...convertTimestamps<Service>(docSnap.data()),
    };
  }

  /**
   * Get all services for a provider
   */
  async getByProvider(providerId: string): Promise<WithId<Service>[]> {
    const q = query(
      this.getCollectionRef(providerId),
      orderBy('sortOrder', 'asc')
    );
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...convertTimestamps<Service>(docSnap.data()),
    }));
  }

  /**
   * Get active services for a provider
   */
  async getActiveByProvider(providerId: string): Promise<WithId<Service>[]> {
    const q = query(
      this.getCollectionRef(providerId),
      where('isActive', '==', true),
      orderBy('sortOrder', 'asc')
    );
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...convertTimestamps<Service>(docSnap.data()),
    }));
  }

  /**
   * Get services by location
   */
  async getByLocation(providerId: string, locationId: string): Promise<WithId<Service>[]> {
    const q = query(
      this.getCollectionRef(providerId),
      where('locationIds', 'array-contains', locationId),
      where('isActive', '==', true),
      orderBy('sortOrder', 'asc')
    );
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...convertTimestamps<Service>(docSnap.data()),
    }));
  }

  /**
   * Get services by member
   */
  async getByMember(providerId: string, memberId: string): Promise<WithId<Service>[]> {
    const q = query(
      this.getCollectionRef(providerId),
      where('memberIds', 'array-contains', memberId),
      where('isActive', '==', true),
      orderBy('sortOrder', 'asc')
    );
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...convertTimestamps<Service>(docSnap.data()),
    }));
  }

  /**
   * Get services by price range
   */
  async getByPriceRange(
    providerId: string,
    minPrice: number,
    maxPrice: number
  ): Promise<WithId<Service>[]> {
    const q = query(
      this.getCollectionRef(providerId),
      where('price', '>=', minPrice),
      where('price', '<=', maxPrice),
      where('isActive', '==', true)
    );
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...convertTimestamps<Service>(docSnap.data()),
    }));
  }

  /**
   * Update service
   */
  async update(
    providerId: string,
    serviceId: string,
    data: Partial<Omit<Service, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<void> {
    const docRef = this.getDocRef(providerId, serviceId);
    const docData = removeUndefined({
      ...data,
      updatedAt: serverTimestamp(),
    } as Record<string, unknown>);

    await updateDoc(docRef, docData);
  }

  /**
   * Delete service
   */
  async delete(providerId: string, serviceId: string): Promise<void> {
    const docRef = this.getDocRef(providerId, serviceId);
    await deleteDoc(docRef);
  }

  /**
   * Toggle service active status
   */
  async toggleActive(providerId: string, serviceId: string, isActive: boolean): Promise<void> {
    await this.update(providerId, serviceId, { isActive });
  }

  /**
   * Update sort order
   */
  async updateSortOrder(providerId: string, serviceId: string, sortOrder: number): Promise<void> {
    await this.update(providerId, serviceId, { sortOrder });
  }

  /**
   * Count services for a provider
   */
  async countByProvider(providerId: string): Promise<number> {
    const services = await this.getByProvider(providerId);
    return services.length;
  }
}

// Singleton instance
export const serviceRepository = new ServiceRepository();
