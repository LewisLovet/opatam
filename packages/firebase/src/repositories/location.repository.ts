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
import type { Location, LocationType } from '@booking-app/shared';
import { getFirebaseApp } from '../lib/config';
import { convertTimestamps, removeUndefined, type WithId } from './base.repository';

/**
 * Normalize location data to ensure new fields have default values
 * This handles backwards compatibility for documents created before type/travelRadius fields
 */
function normalizeLocation(data: Record<string, unknown>): Location {
  const location = convertTimestamps<Location>(data);
  return {
    ...location,
    type: (location.type as LocationType) || 'fixed',
    travelRadius: location.travelRadius ?? null,
  };
}

/**
 * Repository for locations subcollection (providers/{providerId}/locations)
 */
export class LocationRepository {
  private db: Firestore;

  constructor() {
    this.db = getFirestore(getFirebaseApp());
  }

  /**
   * Get collection reference for a provider's locations
   */
  private getCollectionRef(providerId: string) {
    return collection(this.db, 'providers', providerId, 'locations');
  }

  /**
   * Get document reference
   */
  private getDocRef(providerId: string, locationId: string) {
    return doc(this.db, 'providers', providerId, 'locations', locationId);
  }

  /**
   * Create a new location
   */
  async create(
    providerId: string,
    data: Omit<Location, 'id' | 'createdAt' | 'updatedAt'>
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
   * Get location by ID
   */
  async getById(providerId: string, locationId: string): Promise<WithId<Location> | null> {
    const docRef = this.getDocRef(providerId, locationId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    return {
      id: docSnap.id,
      ...normalizeLocation(docSnap.data()),
    };
  }

  /**
   * Get all locations for a provider
   */
  async getByProvider(providerId: string): Promise<WithId<Location>[]> {
    const q = query(
      this.getCollectionRef(providerId),
      orderBy('createdAt', 'asc')
    );
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...normalizeLocation(docSnap.data()),
    }));
  }

  /**
   * Get active locations for a provider
   */
  async getActiveByProvider(providerId: string): Promise<WithId<Location>[]> {
    const q = query(
      this.getCollectionRef(providerId),
      where('isActive', '==', true),
      orderBy('createdAt', 'asc')
    );
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...normalizeLocation(docSnap.data()),
    }));
  }

  /**
   * Get default location for a provider
   */
  async getDefault(providerId: string): Promise<WithId<Location> | null> {
    const q = query(
      this.getCollectionRef(providerId),
      where('isDefault', '==', true)
    );
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return null;
    }

    const docSnap = querySnapshot.docs[0];
    return {
      id: docSnap.id,
      ...normalizeLocation(docSnap.data()),
    };
  }

  /**
   * Get locations by city
   */
  async getByCity(providerId: string, city: string): Promise<WithId<Location>[]> {
    const q = query(
      this.getCollectionRef(providerId),
      where('city', '==', city),
      where('isActive', '==', true)
    );
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...normalizeLocation(docSnap.data()),
    }));
  }

  /**
   * Update location
   */
  async update(
    providerId: string,
    locationId: string,
    data: Partial<Omit<Location, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<void> {
    const docRef = this.getDocRef(providerId, locationId);
    const docData = removeUndefined({
      ...data,
      updatedAt: serverTimestamp(),
    } as Record<string, unknown>);

    await updateDoc(docRef, docData);
  }

  /**
   * Delete location
   */
  async delete(providerId: string, locationId: string): Promise<void> {
    const docRef = this.getDocRef(providerId, locationId);
    await deleteDoc(docRef);
  }

  /**
   * Set as default location (unset others)
   */
  async setDefault(providerId: string, locationId: string): Promise<void> {
    // First, unset all other defaults
    const locations = await this.getByProvider(providerId);
    const updates = locations
      .filter((loc) => loc.isDefault && loc.id !== locationId)
      .map((loc) => this.update(providerId, loc.id, { isDefault: false }));

    await Promise.all(updates);

    // Set the new default
    await this.update(providerId, locationId, { isDefault: true });
  }

  /**
   * Toggle location active status
   */
  async toggleActive(providerId: string, locationId: string, isActive: boolean): Promise<void> {
    await this.update(providerId, locationId, { isActive });
  }

  /**
   * Count locations for a provider
   */
  async countByProvider(providerId: string): Promise<number> {
    const locations = await this.getByProvider(providerId);
    return locations.length;
  }
}

// Singleton instance
export const locationRepository = new LocationRepository();
