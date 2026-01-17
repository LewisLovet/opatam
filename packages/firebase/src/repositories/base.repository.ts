import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  QueryConstraint,
  serverTimestamp,
  Timestamp,
  type DocumentData,
  type Firestore,
} from 'firebase/firestore';
import { getFirebaseApp } from '../lib/config';

/**
 * Check if a value is a Firestore special object (Timestamp, FieldValue, etc.)
 */
function isFirestoreSpecialObject(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;

  // Check for Timestamp instance
  if (value instanceof Timestamp) return true;

  // Check for FieldValue (serverTimestamp, increment, etc.)
  // These have a _methodName property
  if ('_methodName' in value) return true;

  return false;
}

/**
 * Remove undefined values from an object recursively
 * Firestore doesn't accept undefined values, so we need to remove them
 * Preserves Firestore special objects (Timestamp, FieldValue, etc.)
 */
export function removeUndefined<T extends Record<string, unknown>>(obj: T): T {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) {
      continue; // Skip undefined values
    } else if (value instanceof Date || isFirestoreSpecialObject(value)) {
      // Preserve Date and Firestore special objects as-is
      result[key] = value;
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = removeUndefined(value as Record<string, unknown>);
    } else if (Array.isArray(value)) {
      result[key] = value.map((item) =>
        item instanceof Date || isFirestoreSpecialObject(item)
          ? item
          : item && typeof item === 'object' && !Array.isArray(item)
            ? removeUndefined(item as Record<string, unknown>)
            : item
      );
    } else {
      result[key] = value;
    }
  }

  return result as T;
}

/**
 * Convert Firestore timestamps to Date objects recursively
 */
export function convertTimestamps<T>(data: DocumentData): T {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    if (value instanceof Timestamp) {
      result[key] = value.toDate();
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = convertTimestamps(value);
    } else if (Array.isArray(value)) {
      result[key] = value.map((item) =>
        item instanceof Timestamp
          ? item.toDate()
          : item && typeof item === 'object'
            ? convertTimestamps(item)
            : item
      );
    } else {
      result[key] = value;
    }
  }

  return result as T;
}

/**
 * Entity with ID
 */
export type WithId<T> = T & { id: string };

/**
 * Abstract base repository for Firestore collections
 */
export abstract class BaseRepository<T> {
  protected db: Firestore;
  protected abstract collectionName: string;

  constructor() {
    this.db = getFirestore(getFirebaseApp());
  }

  /**
   * Get collection reference
   */
  protected getCollectionRef() {
    return collection(this.db, this.collectionName);
  }

  /**
   * Get document reference
   */
  protected getDocRef(id: string) {
    return doc(this.db, this.collectionName, id);
  }

  /**
   * Create a new document with auto-generated ID
   */
  async create(data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const docData = removeUndefined({
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    } as Record<string, unknown>);

    const docRef = await addDoc(this.getCollectionRef(), docData);
    return docRef.id;
  }

  /**
   * Create a new document with a specific ID
   */
  async createWithId(id: string, data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<void> {
    const docRef = this.getDocRef(id);
    const docData = removeUndefined({
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    } as Record<string, unknown>);

    await setDoc(docRef, docData);
  }

  /**
   * Get document by ID
   */
  async getById(id: string): Promise<WithId<T> | null> {
    const docRef = this.getDocRef(id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    return {
      id: docSnap.id,
      ...convertTimestamps<T>(docSnap.data()),
    };
  }

  /**
   * Get all documents
   */
  async getAll(): Promise<WithId<T>[]> {
    const querySnapshot = await getDocs(this.getCollectionRef());

    return querySnapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...convertTimestamps<T>(docSnap.data()),
    }));
  }

  /**
   * Query documents with constraints
   */
  async query(constraints: QueryConstraint[]): Promise<WithId<T>[]> {
    const q = query(this.getCollectionRef(), ...constraints);
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...convertTimestamps<T>(docSnap.data()),
    }));
  }

  /**
   * Update document by ID
   */
  async update(id: string, data: Partial<Omit<T, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void> {
    const docRef = this.getDocRef(id);
    const docData = removeUndefined({
      ...data,
      updatedAt: serverTimestamp(),
    } as Record<string, unknown>);

    await updateDoc(docRef, docData);
  }

  /**
   * Delete document by ID
   */
  async delete(id: string): Promise<void> {
    const docRef = this.getDocRef(id);
    await deleteDoc(docRef);
  }

  /**
   * Check if document exists
   */
  async exists(id: string): Promise<boolean> {
    const docRef = this.getDocRef(id);
    const docSnap = await getDoc(docRef);
    return docSnap.exists();
  }
}
