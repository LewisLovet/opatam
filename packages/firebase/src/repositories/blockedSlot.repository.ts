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
  Timestamp,
  type Firestore,
} from 'firebase/firestore';
import type { BlockedSlot } from '@booking-app/shared';
import { getFirebaseApp } from '../lib/config';
import { convertTimestamps, removeUndefined, type WithId } from './base.repository';

/**
 * Repository for blockedSlots subcollection (providers/{providerId}/blockedSlots)
 */
export class BlockedSlotRepository {
  private db: Firestore;

  constructor() {
    this.db = getFirestore(getFirebaseApp());
  }

  /**
   * Get collection reference for a provider's blocked slots
   */
  private getCollectionRef(providerId: string) {
    return collection(this.db, 'providers', providerId, 'blockedSlots');
  }

  /**
   * Get document reference
   */
  private getDocRef(providerId: string, blockedSlotId: string) {
    return doc(this.db, 'providers', providerId, 'blockedSlots', blockedSlotId);
  }

  /**
   * Create a new blocked slot
   */
  async create(
    providerId: string,
    data: Omit<BlockedSlot, 'id' | 'createdAt'>
  ): Promise<string> {
    const docData = removeUndefined({
      ...data,
      startDate: Timestamp.fromDate(data.startDate),
      endDate: Timestamp.fromDate(data.endDate),
      createdAt: serverTimestamp(),
    } as Record<string, unknown>);

    const docRef = await addDoc(this.getCollectionRef(providerId), docData);
    return docRef.id;
  }

  /**
   * Get blocked slot by ID
   */
  async getById(providerId: string, blockedSlotId: string): Promise<WithId<BlockedSlot> | null> {
    const docRef = this.getDocRef(providerId, blockedSlotId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    return {
      id: docSnap.id,
      ...convertTimestamps<BlockedSlot>(docSnap.data()),
    };
  }

  /**
   * Get all blocked slots for a provider
   */
  async getByProvider(providerId: string): Promise<WithId<BlockedSlot>[]> {
    const q = query(
      this.getCollectionRef(providerId),
      orderBy('startDate', 'asc')
    );
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...convertTimestamps<BlockedSlot>(docSnap.data()),
    }));
  }

  /**
   * Get blocked slots by member
   */
  async getByMember(providerId: string, memberId: string): Promise<WithId<BlockedSlot>[]> {
    const q = query(
      this.getCollectionRef(providerId),
      where('memberId', '==', memberId),
      orderBy('startDate', 'asc')
    );
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...convertTimestamps<BlockedSlot>(docSnap.data()),
    }));
  }

  /**
   * Get blocked slots by location
   */
  async getByLocation(providerId: string, locationId: string): Promise<WithId<BlockedSlot>[]> {
    const q = query(
      this.getCollectionRef(providerId),
      where('locationId', '==', locationId),
      orderBy('startDate', 'asc')
    );
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...convertTimestamps<BlockedSlot>(docSnap.data()),
    }));
  }

  /**
   * Get blocked slots in date range
   */
  async getInRange(
    providerId: string,
    startDate: Date,
    endDate: Date
  ): Promise<WithId<BlockedSlot>[]> {
    const q = query(
      this.getCollectionRef(providerId),
      where('startDate', '<=', Timestamp.fromDate(endDate)),
      where('endDate', '>=', Timestamp.fromDate(startDate)),
      orderBy('startDate', 'asc')
    );
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...convertTimestamps<BlockedSlot>(docSnap.data()),
    }));
  }

  /**
   * Get blocked slots for member in date range
   */
  async getByMemberInRange(
    providerId: string,
    memberId: string | null,
    startDate: Date,
    endDate: Date
  ): Promise<WithId<BlockedSlot>[]> {
    const q = query(
      this.getCollectionRef(providerId),
      where('memberId', '==', memberId),
      where('startDate', '<=', Timestamp.fromDate(endDate)),
      orderBy('startDate', 'asc')
    );
    const querySnapshot = await getDocs(q);

    // Filter by endDate in memory (Firestore limitation on multiple range filters)
    return querySnapshot.docs
      .map((docSnap) => ({
        id: docSnap.id,
        ...convertTimestamps<BlockedSlot>(docSnap.data()),
      }))
      .filter((slot) => slot.endDate >= startDate);
  }

  /**
   * Get upcoming blocked slots
   */
  async getUpcoming(providerId: string): Promise<WithId<BlockedSlot>[]> {
    const now = new Date();
    const q = query(
      this.getCollectionRef(providerId),
      where('endDate', '>=', Timestamp.fromDate(now)),
      orderBy('endDate', 'asc'),
      orderBy('startDate', 'asc')
    );
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...convertTimestamps<BlockedSlot>(docSnap.data()),
    }));
  }

  /**
   * Update blocked slot
   */
  async update(
    providerId: string,
    blockedSlotId: string,
    data: Partial<Omit<BlockedSlot, 'id' | 'createdAt'>>
  ): Promise<void> {
    const docRef = this.getDocRef(providerId, blockedSlotId);
    const updateData: Record<string, unknown> = { ...data };

    if (data.startDate) {
      updateData.startDate = Timestamp.fromDate(data.startDate);
    }
    if (data.endDate) {
      updateData.endDate = Timestamp.fromDate(data.endDate);
    }

    await updateDoc(docRef, removeUndefined(updateData));
  }

  /**
   * Delete blocked slot
   */
  async delete(providerId: string, blockedSlotId: string): Promise<void> {
    const docRef = this.getDocRef(providerId, blockedSlotId);
    await deleteDoc(docRef);
  }

  /**
   * Delete all blocked slots for a member
   */
  async deleteByMember(providerId: string, memberId: string): Promise<void> {
    const slots = await this.getByMember(providerId, memberId);
    const deletes = slots.map((slot) =>
      deleteDoc(this.getDocRef(providerId, slot.id))
    );
    await Promise.all(deletes);
  }

  /**
   * Delete past blocked slots (cleanup)
   */
  async deletePast(providerId: string): Promise<number> {
    const now = new Date();
    const q = query(
      this.getCollectionRef(providerId),
      where('endDate', '<', Timestamp.fromDate(now))
    );
    const querySnapshot = await getDocs(q);

    const deletes = querySnapshot.docs.map((docSnap) =>
      deleteDoc(docSnap.ref)
    );
    await Promise.all(deletes);

    return querySnapshot.size;
  }
}

// Singleton instance
export const blockedSlotRepository = new BlockedSlotRepository();
