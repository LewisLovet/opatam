import {
  conversationRepository,
  messageRepository,
  providerRepository,
  userRepository,
} from '../repositories';
import type { Conversation, Message } from '@booking-app/shared';
import { sendMessageSchema, type SendMessageInput } from '@booking-app/shared';
import type { WithId } from '../repositories/base.repository';

export class MessagingService {
  /**
   * Get or create a conversation between provider and client
   */
  async getOrCreateConversation(
    providerId: string,
    clientId: string
  ): Promise<WithId<Conversation>> {
    // Check if conversation already exists
    const existing = await conversationRepository.getByParticipants(providerId, clientId);
    if (existing) {
      return existing;
    }

    // Get provider and client info
    const provider = await providerRepository.getById(providerId);
    if (!provider) {
      throw new Error('Prestataire non trouvé');
    }

    const client = await userRepository.getById(clientId);
    if (!client) {
      throw new Error('Client non trouvé');
    }

    // Create new conversation
    const conversationId = await conversationRepository.create({
      providerId,
      clientId,
      providerName: provider.businessName,
      providerPhoto: provider.photoURL,
      clientName: client.displayName,
      clientPhoto: client.photoURL,
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

    const conversation = await conversationRepository.getById(conversationId);
    if (!conversation) {
      throw new Error('Erreur lors de la création de la conversation');
    }

    return conversation;
  }

  /**
   * Send a message in a conversation
   */
  async sendMessage(
    conversationId: string,
    senderId: string,
    senderType: 'provider' | 'client',
    input: SendMessageInput
  ): Promise<WithId<Message>> {
    // Validate input
    const validated = sendMessageSchema.parse(input);

    // Verify conversation exists
    const conversation = await conversationRepository.getById(conversationId);
    if (!conversation) {
      throw new Error('Conversation non trouvée');
    }

    // Verify sender is a participant
    if (senderType === 'provider') {
      const provider = await providerRepository.getById(conversation.providerId);
      if (!provider || provider.userId !== senderId) {
        throw new Error('Vous n\'êtes pas autorisé à envoyer des messages dans cette conversation');
      }
    } else {
      if (conversation.clientId !== senderId) {
        throw new Error('Vous n\'êtes pas autorisé à envoyer des messages dans cette conversation');
      }
    }

    // Create message
    const messageId = await messageRepository.create(conversationId, {
      senderId,
      senderType,
      text: validated.text,
      isRead: false,
    });

    // Update conversation's last message
    await conversationRepository.updateLastMessage(conversationId, {
      text: validated.text.substring(0, 100), // Truncate for preview
      senderId,
      sentAt: new Date(),
    });

    // Increment unread count for the other party
    const recipientType = senderType === 'provider' ? 'client' : 'provider';
    await conversationRepository.incrementUnread(conversationId, recipientType);

    const message = await messageRepository.getById(conversationId, messageId);
    if (!message) {
      throw new Error('Erreur lors de l\'envoi du message');
    }

    return message;
  }

  /**
   * Mark messages as read for a participant
   */
  async markAsRead(
    conversationId: string,
    participantType: 'provider' | 'client',
    userId: string
  ): Promise<void> {
    // Verify conversation exists
    const conversation = await conversationRepository.getById(conversationId);
    if (!conversation) {
      throw new Error('Conversation non trouvée');
    }

    // Verify user is a participant
    if (participantType === 'provider') {
      const provider = await providerRepository.getById(conversation.providerId);
      if (!provider || provider.userId !== userId) {
        throw new Error('Vous n\'êtes pas autorisé à accéder à cette conversation');
      }
    } else {
      if (conversation.clientId !== userId) {
        throw new Error('Vous n\'êtes pas autorisé à accéder à cette conversation');
      }
    }

    // Mark all messages as read
    await messageRepository.markAllAsRead(conversationId, userId);

    // Reset unread count
    await conversationRepository.markRead(conversationId, participantType);
  }

  /**
   * Get conversations for a user
   */
  async getConversations(
    userId: string,
    userType: 'provider' | 'client'
  ): Promise<WithId<Conversation>[]> {
    if (userType === 'provider') {
      // Get provider by user ID
      const provider = await providerRepository.getByUserId(userId);
      if (!provider) {
        return [];
      }
      return conversationRepository.getByProvider(provider.id);
    } else {
      return conversationRepository.getByClient(userId);
    }
  }

  /**
   * Get conversation by ID
   */
  async getConversationById(conversationId: string): Promise<WithId<Conversation> | null> {
    return conversationRepository.getById(conversationId);
  }

  /**
   * Get messages in a conversation
   */
  async getMessages(conversationId: string): Promise<WithId<Message>[]> {
    return messageRepository.getByConversation(conversationId);
  }

  /**
   * Get recent messages in a conversation
   */
  async getRecentMessages(
    conversationId: string,
    limit: number = 50
  ): Promise<WithId<Message>[]> {
    return messageRepository.getRecent(conversationId, limit);
  }

  /**
   * Get messages before a specific date (for pagination)
   */
  async getMessagesBefore(
    conversationId: string,
    before: Date,
    limit: number = 50
  ): Promise<WithId<Message>[]> {
    return messageRepository.getBefore(conversationId, before, limit);
  }

  /**
   * Get messages after a specific date (for real-time updates)
   */
  async getMessagesAfter(conversationId: string, after: Date): Promise<WithId<Message>[]> {
    return messageRepository.getAfter(conversationId, after);
  }

  /**
   * Get total unread count for a user
   */
  async getTotalUnreadCount(
    userId: string,
    userType: 'provider' | 'client'
  ): Promise<number> {
    const conversations = await this.getConversations(userId, userType);
    return conversations.reduce((total, conv) => {
      return total + conv.unreadCount[userType];
    }, 0);
  }

  /**
   * Archive a conversation
   */
  async archiveConversation(conversationId: string, userId: string): Promise<void> {
    const conversation = await conversationRepository.getById(conversationId);
    if (!conversation) {
      throw new Error('Conversation non trouvée');
    }

    // Verify user is a participant
    const provider = await providerRepository.getById(conversation.providerId);
    if (provider?.userId !== userId && conversation.clientId !== userId) {
      throw new Error('Vous n\'êtes pas autorisé à archiver cette conversation');
    }

    await conversationRepository.archive(conversationId);
  }

  /**
   * Unarchive a conversation
   */
  async unarchiveConversation(conversationId: string, userId: string): Promise<void> {
    const conversation = await conversationRepository.getById(conversationId);
    if (!conversation) {
      throw new Error('Conversation non trouvée');
    }

    // Verify user is a participant
    const provider = await providerRepository.getById(conversation.providerId);
    if (provider?.userId !== userId && conversation.clientId !== userId) {
      throw new Error('Vous n\'êtes pas autorisé à modifier cette conversation');
    }

    await conversationRepository.unarchive(conversationId);
  }

  /**
   * Get archived conversations for a user
   */
  async getArchivedConversations(
    userId: string,
    userType: 'provider' | 'client'
  ): Promise<WithId<Conversation>[]> {
    if (userType === 'provider') {
      const provider = await providerRepository.getByUserId(userId);
      if (!provider) {
        return [];
      }
      return conversationRepository.getArchivedByProvider(provider.id);
    } else {
      return conversationRepository.getArchivedByClient(userId);
    }
  }

  /**
   * Check if user can access conversation
   */
  async canAccessConversation(conversationId: string, userId: string): Promise<boolean> {
    const conversation = await conversationRepository.getById(conversationId);
    if (!conversation) {
      return false;
    }

    // Check if provider
    const provider = await providerRepository.getById(conversation.providerId);
    if (provider?.userId === userId) {
      return true;
    }

    // Check if client
    if (conversation.clientId === userId) {
      return true;
    }

    return false;
  }
}

// Singleton instance
export const messagingService = new MessagingService();
