import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
  type Firestore,
} from 'firebase/firestore';
import type { Availability } from '@booking-app/shared';
import { getFirebaseApp } from '../lib/config';
import { convertTimestamps, removeUndefined, type WithId } from './base.repository';

/**
 * Repository for availability subcollection (providers/{providerId}/availability)
 * Uses composite document IDs: {locationId}_{memberId}_{dayOfWeek} or {locationId}_null_{dayOfWeek}
 */
export class AvailabilityRepository {
  private db: Firestore;

  constructor() {
    this.db = getFirestore(getFirebaseApp());
  }

  /**
   * Get collection reference for a provider's availability
   */
  private getCollectionRef(providerId: string) {
    return collection(this.db, 'providers', providerId, 'availability');
  }

  /**
   * Generate document ID from availability data
   */
  private generateDocId(locationId: string, memberId: string | null, dayOfWeek: number): string {
    return `${locationId}_${memberId || 'null'}_${dayOfWeek}`;
  }

  /**
   * Get document reference
   */
  private getDocRef(providerId: string, docId: string) {
    return doc(this.db, 'providers', providerId, 'availability', docId);
  }

  /**
   * Set availability (create or update)
   */
  async set(
    providerId: string,
    data: Omit<Availability, 'updatedAt'>
  ): Promise<string> {
    const docId = this.generateDocId(data.locationId, data.memberId, data.dayOfWeek);
    const docRef = this.getDocRef(providerId, docId);

    const docData = removeUndefined({
      ...data,
      updatedAt: serverTimestamp(),
    } as Record<string, unknown>);

    await setDoc(docRef, docData);

    return docId;
  }

  /**
   * Get availability by composite key
   */
  async get(
    providerId: string,
    locationId: string,
    memberId: string | null,
    dayOfWeek: number
  ): Promise<WithId<Availability> | null> {
    const docId = this.generateDocId(locationId, memberId, dayOfWeek);
    const docRef = this.getDocRef(providerId, docId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    return {
      id: docSnap.id,
      ...convertTimestamps<Availability>(docSnap.data()),
    };
  }

  /**
   * Get all availability for a provider
   */
  async getByProvider(providerId: string): Promise<WithId<Availability>[]> {
    const querySnapshot = await getDocs(this.getCollectionRef(providerId));

    return querySnapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...convertTimestamps<Availability>(docSnap.data()),
    }));
  }

  /**
   * Get availability by location
   */
  async getByLocation(providerId: string, locationId: string): Promise<WithId<Availability>[]> {
    const q = query(
      this.getCollectionRef(providerId),
      where('locationId', '==', locationId)
    );
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...convertTimestamps<Availability>(docSnap.data()),
    }));
  }

  /**
   * Get availability by member
   */
  async getByMember(providerId: string, memberId: string): Promise<WithId<Availability>[]> {
    const q = query(
      this.getCollectionRef(providerId),
      where('memberId', '==', memberId)
    );
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...convertTimestamps<Availability>(docSnap.data()),
    }));
  }

  /**
   * Get availability for a specific day
   */
  async getByDay(providerId: string, dayOfWeek: number): Promise<WithId<Availability>[]> {
    const q = query(
      this.getCollectionRef(providerId),
      where('dayOfWeek', '==', dayOfWeek)
    );
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...convertTimestamps<Availability>(docSnap.data()),
    }));
  }

  /**
   * Get availability for location and member on a specific day
   */
  async getForDay(
    providerId: string,
    locationId: string,
    memberId: string | null,
    dayOfWeek: number
  ): Promise<WithId<Availability> | null> {
    return this.get(providerId, locationId, memberId, dayOfWeek);
  }

  /**
   * Get weekly availability for location and member
   */
  async getWeeklySchedule(
    providerId: string,
    locationId: string,
    memberId: string | null
  ): Promise<WithId<Availability>[]> {
    const q = query(
      this.getCollectionRef(providerId),
      where('locationId', '==', locationId),
      where('memberId', '==', memberId)
    );
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...convertTimestamps<Availability>(docSnap.data()),
    }));
  }

  /**
   * Set weekly schedule (7 days)
   */
  async setWeeklySchedule(
    providerId: string,
    locationId: string,
    memberId: string | null,
    schedule: Array<{ dayOfWeek: number; slots: Availability['slots']; isOpen: boolean }>
  ): Promise<void> {
    const updates = schedule.map((day) =>
      this.set(providerId, {
        locationId,
        memberId,
        dayOfWeek: day.dayOfWeek,
        slots: day.slots,
        isOpen: day.isOpen,
      })
    );

    await Promise.all(updates);
  }

  /**
   * Delete availability
   */
  async delete(
    providerId: string,
    locationId: string,
    memberId: string | null,
    dayOfWeek: number
  ): Promise<void> {
    const docId = this.generateDocId(locationId, memberId, dayOfWeek);
    const docRef = this.getDocRef(providerId, docId);
    await deleteDoc(docRef);
  }

  /**
   * Delete all availability for a location
   */
  async deleteByLocation(providerId: string, locationId: string): Promise<void> {
    const availability = await this.getByLocation(providerId, locationId);
    const deletes = availability.map((av) =>
      deleteDoc(this.getDocRef(providerId, av.id))
    );
    await Promise.all(deletes);
  }

  /**
   * Delete all availability for a member
   */
  async deleteByMember(providerId: string, memberId: string): Promise<void> {
    const availability = await this.getByMember(providerId, memberId);
    const deletes = availability.map((av) =>
      deleteDoc(this.getDocRef(providerId, av.id))
    );
    await Promise.all(deletes);
  }
}

// Singleton instance
export const availabilityRepository = new AvailabilityRepository();
