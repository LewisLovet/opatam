import { memberRepository, bookingRepository, availabilityRepository } from '../repositories';
import type { Member } from '@booking-app/shared';
import {
  createMemberSchema,
  updateMemberSchema,
  type CreateMemberInput,
  type UpdateMemberInput,
} from '@booking-app/shared';
import type { WithId } from '../repositories/base.repository';

/**
 * NOUVEAU MODÈLE: 1 membre = 1 lieu = 1 agenda
 * - locationId (singulier) remplace locationIds (pluriel)
 * - Changement de lieu = mise à jour des disponibilités
 */
export class MemberService {
  /**
   * Create a new team member
   * Un membre est maintenant associé à UN seul lieu
   */
  async createMember(providerId: string, input: CreateMemberInput): Promise<WithId<Member>> {
    // Validate input
    const validated = createMemberSchema.parse(input);

    // Generate unique access code
    const accessCode = await this.generateUniqueAccessCode(validated.name);

    // Get current member count for sortOrder
    const existingMembers = await memberRepository.getByProvider(providerId);
    const sortOrder = existingMembers.length;

    // Create member with single locationId
    const memberId = await memberRepository.create(providerId, {
      name: validated.name,
      email: validated.email,
      phone: validated.phone || null,
      photoURL: null,
      accessCode,
      locationId: validated.locationId,
      isDefault: false, // Les membres créés manuellement ne sont pas par défaut
      isActive: true,
      sortOrder,
    });

    const member = await memberRepository.getById(providerId, memberId);
    if (!member) {
      throw new Error('Erreur lors de la création du membre');
    }

    return member;
  }

  /**
   * Create default member at registration
   * Ce membre représente le propriétaire du compte
   */
  async createDefaultMember(
    providerId: string,
    name: string,
    email: string,
    locationId: string
  ): Promise<WithId<Member>> {
    // Generate unique access code
    const accessCode = await this.generateUniqueAccessCode(name);

    // Create default member
    const memberId = await memberRepository.create(providerId, {
      name,
      email,
      phone: null,
      photoURL: null,
      accessCode,
      locationId,
      isDefault: true, // Membre par défaut
      isActive: true,
      sortOrder: 0,
    });

    const member = await memberRepository.getById(providerId, memberId);
    if (!member) {
      throw new Error('Erreur lors de la création du membre par défaut');
    }

    return member;
  }

  /**
   * Get the default member for a provider
   */
  async getDefaultMember(providerId: string): Promise<WithId<Member> | null> {
    return memberRepository.getDefaultMember(providerId);
  }

  /**
   * Update team member
   */
  async updateMember(
    providerId: string,
    memberId: string,
    input: UpdateMemberInput
  ): Promise<void> {
    // Validate input
    const validated = updateMemberSchema.parse(input);

    // Check member exists
    const member = await memberRepository.getById(providerId, memberId);
    if (!member) {
      throw new Error('Membre non trouvé');
    }

    await memberRepository.update(providerId, memberId, validated);
  }

  /**
   * Change member location
   * Met à jour le lieu ET synchronise les disponibilités
   */
  async changeLocation(
    providerId: string,
    memberId: string,
    newLocationId: string
  ): Promise<void> {
    const member = await memberRepository.getById(providerId, memberId);
    if (!member) {
      throw new Error('Membre non trouvé');
    }

    if (member.locationId === newLocationId) {
      return; // Pas de changement
    }

    // Update member's locationId
    await memberRepository.update(providerId, memberId, {
      locationId: newLocationId,
    });

    // Update locationId in all availability records for this member
    await availabilityRepository.updateLocationForMember(
      providerId,
      memberId,
      newLocationId
    );
  }

  /**
   * Deactivate member (soft delete)
   */
  async deactivateMember(providerId: string, memberId: string): Promise<void> {
    const member = await memberRepository.getById(providerId, memberId);
    if (!member) {
      throw new Error('Membre non trouvé');
    }

    // On ne peut pas désactiver le membre par défaut
    if (member.isDefault) {
      throw new Error('Impossible de désactiver le membre principal');
    }

    await memberRepository.toggleActive(providerId, memberId, false);
  }

  /**
   * Reactivate member
   */
  async reactivateMember(providerId: string, memberId: string): Promise<void> {
    const member = await memberRepository.getById(providerId, memberId);
    if (!member) {
      throw new Error('Membre non trouvé');
    }

    await memberRepository.toggleActive(providerId, memberId, true);
  }

  /**
   * Delete member permanently
   */
  async deleteMember(providerId: string, memberId: string): Promise<void> {
    const member = await memberRepository.getById(providerId, memberId);
    if (!member) {
      throw new Error('Membre non trouvé');
    }

    // On ne peut pas supprimer le membre par défaut
    if (member.isDefault) {
      throw new Error('Impossible de supprimer le membre principal');
    }

    // Check for future confirmed bookings
    const futureBookings = await bookingRepository.getByMember(providerId, memberId);
    const now = new Date();
    const hasConfirmedFutureBookings = futureBookings.some(
      (b) => b.datetime > now && (b.status === 'confirmed' || b.status === 'pending')
    );

    if (hasConfirmedFutureBookings) {
      throw new Error(
        'Impossible de supprimer ce membre car il a des réservations futures confirmées. Annulez ou réassignez ces réservations d\'abord.'
      );
    }

    // Delete member's availability
    await availabilityRepository.deleteByMember(providerId, memberId);

    // Delete member
    await memberRepository.delete(providerId, memberId);
  }

  /**
   * Regenerate access code for member
   */
  async regenerateAccessCode(providerId: string, memberId: string): Promise<string> {
    const member = await memberRepository.getById(providerId, memberId);
    if (!member) {
      throw new Error('Membre non trouvé');
    }

    const newAccessCode = await this.generateUniqueAccessCode(member.name);
    await memberRepository.update(providerId, memberId, { accessCode: newAccessCode });

    return newAccessCode;
  }

  /**
   * Get member by access code (for planning page)
   */
  async getMemberByAccessCode(code: string): Promise<(WithId<Member> & { providerId: string }) | null> {
    return memberRepository.getByAccessCode(code);
  }

  /**
   * Get all members for a provider
   */
  async getByProvider(providerId: string): Promise<WithId<Member>[]> {
    return memberRepository.getByProvider(providerId);
  }

  /**
   * Get active members for a provider
   */
  async getActiveByProvider(providerId: string): Promise<WithId<Member>[]> {
    return memberRepository.getActiveByProvider(providerId);
  }

  /**
   * Get member by ID
   */
  async getById(providerId: string, memberId: string): Promise<WithId<Member> | null> {
    return memberRepository.getById(providerId, memberId);
  }

  /**
   * Get members by location (1 membre = 1 lieu)
   */
  async getByLocation(providerId: string, locationId: string): Promise<WithId<Member>[]> {
    return memberRepository.getByLocation(providerId, locationId);
  }

  /**
   * Reorder members
   */
  async reorderMembers(providerId: string, orderedIds: string[]): Promise<void> {
    const updatePromises = orderedIds.map((memberId, index) =>
      memberRepository.update(providerId, memberId, { sortOrder: index })
    );
    await Promise.all(updatePromises);
  }

  /**
   * Update member photo
   */
  async updatePhoto(providerId: string, memberId: string, photoURL: string): Promise<void> {
    await memberRepository.update(providerId, memberId, { photoURL });
  }

  /**
   * Generate unique access code in format: PRENOM-XXXX
   */
  private async generateUniqueAccessCode(name: string): Promise<string> {
    const firstName = name
      .split(' ')[0]
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove accents
      .replace(/[^A-Z]/g, '') // Keep only letters
      .substring(0, 6);

    let code: string;
    let attempts = 0;
    const maxAttempts = 100;

    do {
      const randomPart = this.generateRandomCode(4);
      code = `${firstName}-${randomPart}`;
      attempts++;

      // Check if code exists
      const existing = await memberRepository.getByAccessCode(code);
      if (!existing) {
        return code;
      }
    } while (attempts < maxAttempts);

    // Fallback with longer random part
    const longRandomPart = this.generateRandomCode(6);
    return `${firstName}-${longRandomPart}`;
  }

  /**
   * Generate random alphanumeric code
   */
  private generateRandomCode(length: number): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude similar characters (0, O, 1, I)
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
}

// Singleton instance
export const memberService = new MemberService();
