import { where, orderBy, limit } from 'firebase/firestore';
import type { Conversation } from '@booking-app/shared';
import { BaseRepository, type WithId } from './base.repository';

/**
 * Repository for conversations collection
 */
export class ConversationRepository extends BaseRepository<Conversation> {
  protected collectionName = 'conversations';

  /**
   * Get conversation by participants
   */
  async getByParticipants(providerId: string, clientId: string): Promise<WithId<Conversation> | null> {
    const results = await this.query([
      where('providerId', '==', providerId),
      where('clientId', '==', clientId),
      limit(1),
    ]);

    return results[0] || null;
  }

  /**
   * Get or create conversation between provider and client
   */
  async getOrCreate(
    providerId: string,
    clientId: string,
    metadata: {
      providerName: string;
      providerPhoto: string | null;
      clientName: string;
      clientPhoto: string | null;
    }
  ): Promise<WithId<Conversation>> {
    const existing = await this.getByParticipants(providerId, clientId);

    if (existing) {
      return existing;
    }

    const id = await this.create({
      providerId,
      clientId,
      providerName: metadata.providerName,
      providerPhoto: metadata.providerPhoto,
      clientName: metadata.clientName,
      clientPhoto: metadata.clientPhoto,
      lastMessage: {
        text: '',
        senderId: '',
        sentAt: new Date(),
      },
      unreadCount: {
        provider: 0,
        client: 0,
      },
    });

    return (await this.getById(id))!;
  }

  /**
   * Get conversations by provider
   */
  async getByProvider(providerId: string): Promise<WithId<Conversation>[]> {
    return this.query([
      where('providerId', '==', providerId),
      orderBy('updatedAt', 'desc'),
    ]);
  }

  /**
   * Get conversations by client
   */
  async getByClient(clientId: string): Promise<WithId<Conversation>[]> {
    return this.query([
      where('clientId', '==', clientId),
      orderBy('updatedAt', 'desc'),
    ]);
  }

  /**
   * Get conversations with unread messages for provider
   */
  async getUnreadByProvider(providerId: string): Promise<WithId<Conversation>[]> {
    return this.query([
      where('providerId', '==', providerId),
      where('unreadCount.provider', '>', 0),
      orderBy('unreadCount.provider', 'desc'),
      orderBy('updatedAt', 'desc'),
    ]);
  }

  /**
   * Get conversations with unread messages for client
   */
  async getUnreadByClient(clientId: string): Promise<WithId<Conversation>[]> {
    return this.query([
      where('clientId', '==', clientId),
      where('unreadCount.client', '>', 0),
      orderBy('unreadCount.client', 'desc'),
      orderBy('updatedAt', 'desc'),
    ]);
  }

  /**
   * Update last message
   */
  async updateLastMessage(
    id: string,
    lastMessage: Conversation['lastMessage']
  ): Promise<void> {
    await this.update(id, { lastMessage });
  }

  /**
   * Increment unread count for provider
   */
  async incrementProviderUnread(id: string): Promise<void> {
    const conversation = await this.getById(id);
    if (conversation) {
      await this.update(id, {
        unreadCount: {
          ...conversation.unreadCount,
          provider: conversation.unreadCount.provider + 1,
        },
      });
    }
  }

  /**
   * Increment unread count for client
   */
  async incrementClientUnread(id: string): Promise<void> {
    const conversation = await this.getById(id);
    if (conversation) {
      await this.update(id, {
        unreadCount: {
          ...conversation.unreadCount,
          client: conversation.unreadCount.client + 1,
        },
      });
    }
  }

  /**
   * Mark as read by provider
   */
  async markReadByProvider(id: string): Promise<void> {
    const conversation = await this.getById(id);
    if (conversation) {
      await this.update(id, {
        unreadCount: {
          ...conversation.unreadCount,
          provider: 0,
        },
      });
    }
  }

  /**
   * Mark as read by client
   */
  async markReadByClient(id: string): Promise<void> {
    const conversation = await this.getById(id);
    if (conversation) {
      await this.update(id, {
        unreadCount: {
          ...conversation.unreadCount,
          client: 0,
        },
      });
    }
  }

  /**
   * Count unread conversations for provider
   */
  async countUnreadByProvider(providerId: string): Promise<number> {
    const conversations = await this.getUnreadByProvider(providerId);
    return conversations.length;
  }

  /**
   * Count unread conversations for client
   */
  async countUnreadByClient(clientId: string): Promise<number> {
    const conversations = await this.getUnreadByClient(clientId);
    return conversations.length;
  }

  /**
   * Get total unread message count for provider
   */
  async getTotalUnreadCountByProvider(providerId: string): Promise<number> {
    const conversations = await this.getByProvider(providerId);
    return conversations.reduce((total, conv) => total + conv.unreadCount.provider, 0);
  }

  /**
   * Get total unread message count for client
   */
  async getTotalUnreadCountByClient(clientId: string): Promise<number> {
    const conversations = await this.getByClient(clientId);
    return conversations.reduce((total, conv) => total + conv.unreadCount.client, 0);
  }

  /**
   * Increment unread count for a participant type
   */
  async incrementUnread(id: string, participantType: 'provider' | 'client'): Promise<void> {
    if (participantType === 'provider') {
      await this.incrementProviderUnread(id);
    } else {
      await this.incrementClientUnread(id);
    }
  }

  /**
   * Mark as read by participant type
   */
  async markRead(id: string, participantType: 'provider' | 'client'): Promise<void> {
    if (participantType === 'provider') {
      await this.markReadByProvider(id);
    } else {
      await this.markReadByClient(id);
    }
  }

  /**
   * Archive a conversation
   */
  async archive(id: string): Promise<void> {
    await this.update(id, { isArchived: true } as Partial<Conversation>);
  }

  /**
   * Unarchive a conversation
   */
  async unarchive(id: string): Promise<void> {
    await this.update(id, { isArchived: false } as Partial<Conversation>);
  }

  /**
   * Get archived conversations by provider
   */
  async getArchivedByProvider(providerId: string): Promise<WithId<Conversation>[]> {
    return this.query([
      where('providerId', '==', providerId),
      where('isArchived', '==', true),
      orderBy('updatedAt', 'desc'),
    ]);
  }

  /**
   * Get archived conversations by client
   */
  async getArchivedByClient(clientId: string): Promise<WithId<Conversation>[]> {
    return this.query([
      where('clientId', '==', clientId),
      where('isArchived', '==', true),
      orderBy('updatedAt', 'desc'),
    ]);
  }
}

// Singleton instance
export const conversationRepository = new ConversationRepository();
