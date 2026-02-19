import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  collectionGroup,
  increment,
  type Firestore,
  type DocumentReference,
  type CollectionReference,
  type Query,
  type DocumentSnapshot,
  type QuerySnapshot,
  type WhereFilterOp,
  type OrderByDirection,
} from 'firebase/firestore';
import { app } from './config';

/**
 * Firestore instance
 */
export const db: Firestore = getFirestore(app);

/**
 * Collection references
 */
export const collections = {
  users: () => collection(db, 'users'),
  providers: () => collection(db, 'providers'),
  bookings: () => collection(db, 'bookings'),
  reviews: () => collection(db, 'reviews'),
  conversations: () => collection(db, 'conversations'),
  pageViewsDaily: () => collection(db, 'pageViewsDaily'),
} as const;

/**
 * Subcollection helpers for providers
 */
export const providerSubcollections = {
  members: (providerId: string) =>
    collection(db, 'providers', providerId, 'members'),
  locations: (providerId: string) =>
    collection(db, 'providers', providerId, 'locations'),
  services: (providerId: string) =>
    collection(db, 'providers', providerId, 'services'),
  availability: (providerId: string) =>
    collection(db, 'providers', providerId, 'availability'),
  blockedSlots: (providerId: string) =>
    collection(db, 'providers', providerId, 'blockedSlots'),
} as const;

/**
 * Subcollection helpers for conversations
 */
export const conversationSubcollections = {
  messages: (conversationId: string) =>
    collection(db, 'conversations', conversationId, 'messages'),
} as const;

/**
 * Collection group query for members (cross-provider search by access code)
 */
export function membersCollectionGroup() {
  return collectionGroup(db, 'members');
}

/**
 * Get server timestamp for writes
 */
export { serverTimestamp, Timestamp };

// Re-export Firestore utilities
export {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  onSnapshot,
  collectionGroup,
  increment,
  type DocumentReference,
  type CollectionReference,
  type Query,
  type DocumentSnapshot,
  type QuerySnapshot,
  type WhereFilterOp,
  type OrderByDirection,
};
