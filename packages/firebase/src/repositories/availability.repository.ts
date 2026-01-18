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
 *
 * NOUVEAU MODÈLE: Centré sur le membre (1 membre = 1 lieu = 1 agenda)
 * Document ID format: {memberId}_{dayOfWeek}
 *
 * Le locationId est dénormalisé depuis member.locationId pour performance
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
   * Nouveau format: {memberId}_{dayOfWeek}
   */
  private generateDocId(memberId: string, dayOfWeek: number): string {
    return `${memberId}_${dayOfWeek}`;
  }

  /**
   * Get document reference
   */
  private getDocRef(providerId: string, docId: string) {
    return doc(this.db, 'providers', providerId, 'availability', docId);
  }

  /**
   * Set availability (create or update)
   * memberId est maintenant obligatoire
   */
  async set(
    providerId: string,
    data: Omit<Availability, 'updatedAt'>
  ): Promise<string> {
    const docId = this.generateDocId(data.memberId, data.dayOfWeek);
    const docRef = this.getDocRef(providerId, docId);

    const docData = removeUndefined({
      ...data,
      updatedAt: serverTimestamp(),
    } as Record<string, unknown>);

    await setDoc(docRef, docData);

    return docId;
  }

  /**
   * Get availability by member and day
   */
  async get(
    providerId: string,
    memberId: string,
    dayOfWeek: number
  ): Promise<WithId<Availability> | null> {
    const docId = this.generateDocId(memberId, dayOfWeek);
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
   * Get availability by location (via le champ dénormalisé)
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
   * Get availability by member (principal use case)
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
   * Get availability for a specific day (all members)
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
   * Get availability for member on a specific day
   */
  async getForDay(
    providerId: string,
    memberId: string,
    dayOfWeek: number
  ): Promise<WithId<Availability> | null> {
    return this.get(providerId, memberId, dayOfWeek);
  }

  /**
   * Get weekly schedule for a member (7 days)
   */
  async getWeeklySchedule(
    providerId: string,
    memberId: string
  ): Promise<WithId<Availability>[]> {
    return this.getByMember(providerId, memberId);
  }

  /**
   * Set weekly schedule for a member (7 days)
   */
  async setWeeklySchedule(
    providerId: string,
    memberId: string,
    locationId: string,
    schedule: Array<{ dayOfWeek: number; slots: Availability['slots']; isOpen: boolean }>
  ): Promise<void> {
    const updates = schedule.map((day) =>
      this.set(providerId, {
        memberId,
        locationId,
        dayOfWeek: day.dayOfWeek,
        slots: day.slots,
        isOpen: day.isOpen,
      })
    );

    await Promise.all(updates);
  }

  /**
   * Delete availability for a member on a specific day
   */
  async delete(
    providerId: string,
    memberId: string,
    dayOfWeek: number
  ): Promise<void> {
    const docId = this.generateDocId(memberId, dayOfWeek);
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

  /**
   * Update locationId for all availabilities of a member
   * (À utiliser quand un membre change de lieu)
   */
  async updateLocationForMember(
    providerId: string,
    memberId: string,
    newLocationId: string
  ): Promise<void> {
    const availabilities = await this.getByMember(providerId, memberId);

    const updates = availabilities.map((av) =>
      this.set(providerId, {
        memberId: av.memberId,
        locationId: newLocationId,
        dayOfWeek: av.dayOfWeek,
        slots: av.slots,
        isOpen: av.isOpen,
      })
    );

    await Promise.all(updates);
  }
}

// Singleton instance
export const availabilityRepository = new AvailabilityRepository();
