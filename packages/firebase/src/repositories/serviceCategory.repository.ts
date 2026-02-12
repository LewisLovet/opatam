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
  orderBy,
  serverTimestamp,
  type Firestore,
} from 'firebase/firestore';
import type { ServiceCategory } from '@booking-app/shared';
import { getFirebaseApp } from '../lib/config';
import { convertTimestamps, removeUndefined, type WithId } from './base.repository';

/**
 * Repository for serviceCategories subcollection (providers/{providerId}/serviceCategories)
 */
export class ServiceCategoryRepository {
  private db: Firestore;

  constructor() {
    this.db = getFirestore(getFirebaseApp());
  }

  private getCollectionRef(providerId: string) {
    return collection(this.db, 'providers', providerId, 'serviceCategories');
  }

  private getDocRef(providerId: string, categoryId: string) {
    return doc(this.db, 'providers', providerId, 'serviceCategories', categoryId);
  }

  async create(
    providerId: string,
    data: Omit<ServiceCategory, 'createdAt' | 'updatedAt'>
  ): Promise<string> {
    const docData = removeUndefined({
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    } as Record<string, unknown>);

    const docRef = await addDoc(this.getCollectionRef(providerId), docData);
    return docRef.id;
  }

  async getById(providerId: string, categoryId: string): Promise<WithId<ServiceCategory> | null> {
    const docRef = this.getDocRef(providerId, categoryId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    return {
      id: docSnap.id,
      ...convertTimestamps<ServiceCategory>(docSnap.data()),
    };
  }

  async getByProvider(providerId: string): Promise<WithId<ServiceCategory>[]> {
    const q = query(
      this.getCollectionRef(providerId),
      orderBy('sortOrder', 'asc')
    );
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...convertTimestamps<ServiceCategory>(docSnap.data()),
    }));
  }

  async update(
    providerId: string,
    categoryId: string,
    data: Partial<Omit<ServiceCategory, 'createdAt' | 'updatedAt'>>
  ): Promise<void> {
    const docRef = this.getDocRef(providerId, categoryId);
    const docData = removeUndefined({
      ...data,
      updatedAt: serverTimestamp(),
    } as Record<string, unknown>);

    await updateDoc(docRef, docData);
  }

  async delete(providerId: string, categoryId: string): Promise<void> {
    const docRef = this.getDocRef(providerId, categoryId);
    await deleteDoc(docRef);
  }
}

export const serviceCategoryRepository = new ServiceCategoryRepository();
