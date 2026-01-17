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
  serverTimestamp,
  Timestamp,
  type Firestore,
} from 'firebase/firestore';
import type { Message } from '@booking-app/shared';
import { getFirebaseApp } from '../lib/config';
import { convertTimestamps, removeUndefined, type WithId } from './base.repository';

/**
 * Repository for messages subcollection (conversations/{conversationId}/messages)
 */
export class MessageRepository {
  private db: Firestore;

  constructor() {
    this.db = getFirestore(getFirebaseApp());
  }

  /**
   * Get collection reference for a conversation's messages
   */
  private getCollectionRef(conversationId: string) {
    return collection(this.db, 'conversations', conversationId, 'messages');
  }

  /**
   * Get document reference
   */
  private getDocRef(conversationId: string, messageId: string) {
    return doc(this.db, 'conversations', conversationId, 'messages', messageId);
  }

  /**
   * Create a new message
   */
  async create(
    conversationId: string,
    data: Omit<Message, 'id' | 'sentAt'>
  ): Promise<string> {
    const docData = removeUndefined({
      ...data,
      sentAt: serverTimestamp(),
    } as Record<string, unknown>);

    const docRef = await addDoc(this.getCollectionRef(conversationId), docData);
    return docRef.id;
  }

  /**
   * Get message by ID
   */
  async getById(conversationId: string, messageId: string): Promise<WithId<Message> | null> {
    const docRef = this.getDocRef(conversationId, messageId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    return {
      id: docSnap.id,
      ...convertTimestamps<Message>(docSnap.data()),
    };
  }

  /**
   * Get all messages in a conversation
   */
  async getByConversation(conversationId: string): Promise<WithId<Message>[]> {
    const q = query(
      this.getCollectionRef(conversationId),
      orderBy('sentAt', 'asc')
    );
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...convertTimestamps<Message>(docSnap.data()),
    }));
  }

  /**
   * Get recent messages in a conversation
   */
  async getRecent(conversationId: string, maxResults: number = 50): Promise<WithId<Message>[]> {
    const q = query(
      this.getCollectionRef(conversationId),
      orderBy('sentAt', 'desc'),
      limit(maxResults)
    );
    const querySnapshot = await getDocs(q);

    // Reverse to get chronological order
    return querySnapshot.docs
      .map((docSnap) => ({
        id: docSnap.id,
        ...convertTimestamps<Message>(docSnap.data()),
      }))
      .reverse();
  }

  /**
   * Get messages before a specific date (for pagination)
   */
  async getBefore(
    conversationId: string,
    before: Date,
    maxResults: number = 50
  ): Promise<WithId<Message>[]> {
    const q = query(
      this.getCollectionRef(conversationId),
      where('sentAt', '<', Timestamp.fromDate(before)),
      orderBy('sentAt', 'desc'),
      limit(maxResults)
    );
    const querySnapshot = await getDocs(q);

    // Reverse to get chronological order
    return querySnapshot.docs
      .map((docSnap) => ({
        id: docSnap.id,
        ...convertTimestamps<Message>(docSnap.data()),
      }))
      .reverse();
  }

  /**
   * Get messages after a specific date (for real-time updates)
   */
  async getAfter(conversationId: string, after: Date): Promise<WithId<Message>[]> {
    const q = query(
      this.getCollectionRef(conversationId),
      where('sentAt', '>', Timestamp.fromDate(after)),
      orderBy('sentAt', 'asc')
    );
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...convertTimestamps<Message>(docSnap.data()),
    }));
  }

  /**
   * Get unread messages for a user
   */
  async getUnread(conversationId: string, userId: string): Promise<WithId<Message>[]> {
    const q = query(
      this.getCollectionRef(conversationId),
      where('senderId', '!=', userId),
      where('isRead', '==', false),
      orderBy('senderId'),
      orderBy('sentAt', 'asc')
    );
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...convertTimestamps<Message>(docSnap.data()),
    }));
  }

  /**
   * Mark message as read
   */
  async markAsRead(conversationId: string, messageId: string): Promise<void> {
    const docRef = this.getDocRef(conversationId, messageId);
    await updateDoc(docRef, { isRead: true });
  }

  /**
   * Mark all messages as read for a user
   */
  async markAllAsRead(conversationId: string, userId: string): Promise<void> {
    const unread = await this.getUnread(conversationId, userId);
    const updates = unread.map((msg) =>
      updateDoc(this.getDocRef(conversationId, msg.id), { isRead: true })
    );
    await Promise.all(updates);
  }

  /**
   * Delete message
   */
  async delete(conversationId: string, messageId: string): Promise<void> {
    const docRef = this.getDocRef(conversationId, messageId);
    await deleteDoc(docRef);
  }

  /**
   * Count messages in a conversation
   */
  async countByConversation(conversationId: string): Promise<number> {
    const messages = await this.getByConversation(conversationId);
    return messages.length;
  }

  /**
   * Count unread messages for a user in a conversation
   */
  async countUnread(conversationId: string, userId: string): Promise<number> {
    const unread = await this.getUnread(conversationId, userId);
    return unread.length;
  }

  /**
   * Get last message in a conversation
   */
  async getLastMessage(conversationId: string): Promise<WithId<Message> | null> {
    const q = query(
      this.getCollectionRef(conversationId),
      orderBy('sentAt', 'desc'),
      limit(1)
    );
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return null;
    }

    const docSnap = querySnapshot.docs[0];
    return {
      id: docSnap.id,
      ...convertTimestamps<Message>(docSnap.data()),
    };
  }
}

// Singleton instance
export const messageRepository = new MessageRepository();
