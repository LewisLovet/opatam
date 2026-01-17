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
  limit,
  collectionGroup,
  serverTimestamp,
  type Firestore,
} from 'firebase/firestore';
import type { Member } from '@booking-app/shared';
import { getFirebaseApp } from '../lib/config';
import { convertTimestamps, removeUndefined, type WithId } from './base.repository';

/**
 * Repository for members subcollection (providers/{providerId}/members)
 */
export class MemberRepository {
  private db: Firestore;

  constructor() {
    this.db = getFirestore(getFirebaseApp());
  }

  /**
   * Get collection reference for a provider's members
   */
  private getCollectionRef(providerId: string) {
    return collection(this.db, 'providers', providerId, 'members');
  }

  /**
   * Get document reference
   */
  private getDocRef(providerId: string, memberId: string) {
    return doc(this.db, 'providers', providerId, 'members', memberId);
  }

  /**
   * Create a new member
   */
  async create(
    providerId: string,
    data: Omit<Member, 'id' | 'createdAt' | 'updatedAt'>
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
   * Get member by ID
   */
  async getById(providerId: string, memberId: string): Promise<WithId<Member> | null> {
    const docRef = this.getDocRef(providerId, memberId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    return {
      id: docSnap.id,
      ...convertTimestamps<Member>(docSnap.data()),
    };
  }

  /**
   * Get all members for a provider
   */
  async getByProvider(providerId: string): Promise<WithId<Member>[]> {
    const q = query(
      this.getCollectionRef(providerId),
      orderBy('sortOrder', 'asc')
    );
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...convertTimestamps<Member>(docSnap.data()),
    }));
  }

  /**
   * Get active members for a provider
   */
  async getActiveByProvider(providerId: string): Promise<WithId<Member>[]> {
    const q = query(
      this.getCollectionRef(providerId),
      where('isActive', '==', true),
      orderBy('sortOrder', 'asc')
    );
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...convertTimestamps<Member>(docSnap.data()),
    }));
  }

  /**
   * Get member by access code (across all providers)
   */
  async getByAccessCode(accessCode: string): Promise<(WithId<Member> & { providerId: string }) | null> {
    const q = query(
      collectionGroup(this.db, 'members'),
      where('accessCode', '==', accessCode),
      limit(1)
    );
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return null;
    }

    const docSnap = querySnapshot.docs[0];
    // Extract providerId from path: providers/{providerId}/members/{memberId}
    const providerId = docSnap.ref.parent.parent?.id;

    if (!providerId) {
      return null;
    }

    return {
      id: docSnap.id,
      providerId,
      ...convertTimestamps<Member>(docSnap.data()),
    };
  }

  /**
   * Get members by location
   */
  async getByLocation(providerId: string, locationId: string): Promise<WithId<Member>[]> {
    const q = query(
      this.getCollectionRef(providerId),
      where('locationIds', 'array-contains', locationId),
      where('isActive', '==', true)
    );
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...convertTimestamps<Member>(docSnap.data()),
    }));
  }

  /**
   * Update member
   */
  async update(
    providerId: string,
    memberId: string,
    data: Partial<Omit<Member, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<void> {
    const docRef = this.getDocRef(providerId, memberId);
    const docData = removeUndefined({
      ...data,
      updatedAt: serverTimestamp(),
    } as Record<string, unknown>);

    await updateDoc(docRef, docData);
  }

  /**
   * Delete member
   */
  async delete(providerId: string, memberId: string): Promise<void> {
    const docRef = this.getDocRef(providerId, memberId);
    await deleteDoc(docRef);
  }

  /**
   * Toggle member active status
   */
  async toggleActive(providerId: string, memberId: string, isActive: boolean): Promise<void> {
    await this.update(providerId, memberId, { isActive });
  }

  /**
   * Update sort order
   */
  async updateSortOrder(providerId: string, memberId: string, sortOrder: number): Promise<void> {
    await this.update(providerId, memberId, { sortOrder });
  }

  /**
   * Count members for a provider
   */
  async countByProvider(providerId: string): Promise<number> {
    const members = await this.getByProvider(providerId);
    return members.length;
  }
}

// Singleton instance
export const memberRepository = new MemberRepository();
