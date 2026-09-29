import { memberRepository, memberAccessCodeRepository, bookingRepository, availabilityRepository } from '../repositories';
import type { Member } from '@booking-app/shared';
import {
  parseOrThrow,
  createMemberSchema,
  updateMemberSchema,
  PLAN_LIMITS,
  MEMBER_COLORS,
  type CreateMemberInput,
  type UpdateMemberInput,
} from '@booking-app/shared';
import type { WithId } from '../repositories/base.repository';

/** Lundi–vendredi 9 h–18 h, week-end fermé — la même proposition que les éditeurs d'horaires. */
const HORAIRES_PAR_DEFAUT = [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
  dayOfWeek,
  isOpen: dayOfWeek >= 1 && dayOfWeek <= 5,
  slots: dayOfWeek >= 1 && dayOfWeek <= 5 ? [{ start: '09:00', end: '18:00' }] : [],
}));

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
  async createMember(providerId: string, input: CreateMemberInput, providerPlan?: string): Promise<WithId<Member>> {
    // Validate input
    const validated = parseOrThrow(createMemberSchema, input);

    // Check plan member limit
    if (providerPlan) {
      const limits = PLAN_LIMITS[providerPlan as keyof typeof PLAN_LIMITS];
      if (limits) {
        const activeMembers = await memberRepository.getActiveByProvider(providerId);
        if (activeMembers.length >= limits.maxMembers) {
          throw new Error(
            `Votre plan ${providerPlan} est limité à ${limits.maxMembers} membre(s) actif(s). Passez au plan supérieur pour ajouter plus de membres.`
          );
        }
      }
    }

    // Get current member count for sortOrder
    const existingMembers = await memberRepository.getByProvider(providerId);
    const sortOrder = existingMembers.length;

    // Create member with single locationId
    const memberId = await memberRepository.create(providerId, {
      name: validated.name,
      email: validated.email,
      phone: validated.phone || null,
      photoURL: null,
      color: validated.color || MEMBER_COLORS[sortOrder % MEMBER_COLORS.length],
      locationId: validated.locationId,
      isDefault: false, // Les membres créés manuellement ne sont pas par défaut
      isActive: true,
      sortOrder,
    });

    // Le code d'accès au planning, APRÈS la fiche : la règle vérifie que le
    // membre existe. Rangé à part, jamais dans la fiche publique.
    await this.attribuerCodeSansBloquer(providerId, memberId, validated.name);

    // Horaires par défaut ENREGISTRÉS dès la création : l'éditeur affichait
    // déjà « lun–ven 9 h–18 h » pour un membre sans horaires, mais rien
    // n'existait en base tant qu'on n'enregistrait pas — le membre paraissait
    // configuré et n'avait aucun créneau (compte Studio, 2026-09-18).
    await availabilityRepository.setWeeklySchedule(
      providerId,
      memberId,
      validated.locationId,
      HORAIRES_PAR_DEFAUT,
    );

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
    // Create default member
    const memberId = await memberRepository.create(providerId, {
      name,
      email,
      phone: null,
      photoURL: null,
      color: MEMBER_COLORS[0],
      locationId,
      isDefault: true, // Membre par défaut
      isActive: true,
      sortOrder: 0,
    });

    await this.attribuerCodeSansBloquer(providerId, memberId, name);

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
    const validated = parseOrThrow(updateMemberSchema, input);

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
  async reactivateMember(providerId: string, memberId: string, providerPlan?: string): Promise<void> {
    const member = await memberRepository.getById(providerId, memberId);
    if (!member) {
      throw new Error('Membre non trouvé');
    }

    // Check plan member limit before reactivating
    if (providerPlan) {
      const limits = PLAN_LIMITS[providerPlan as keyof typeof PLAN_LIMITS];
      if (limits) {
        const activeMembers = await memberRepository.getActiveByProvider(providerId);
        if (activeMembers.length >= limits.maxMembers) {
          throw new Error(
            `Votre plan ${providerPlan} est limité à ${limits.maxMembers} membre(s) actif(s). Passez au plan supérieur pour réactiver ce membre.`
          );
        }
      }
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

    // Son code ne doit plus ouvrir aucun planning.
    await this.retirerCodesAcces(providerId, memberId);

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

    const newAccessCode = await this.attribuerCodeAcces(providerId, memberId, member.name);
    // L'ancien code cesse aussitôt d'ouvrir le planning.
    await this.retirerCodesAcces(providerId, memberId, newAccessCode);
    // Fiche d'avant la migration : son code y était encore écrit, et la
    // connexion au planning l'accepte tant qu'il y est.
    if (member.accessCode) await memberRepository.update(providerId, memberId, { accessCode: null });

    return newAccessCode;
  }

  /**
   * Les membres du salon AVEC leur code d'accès — pour les écrans du gérant,
   * seul à pouvoir lire les codes. La recherche d'un membre PAR son code
   * (connexion au planning) se fait côté serveur, jamais ici.
   */
  async getByProviderAvecCodes(providerId: string): Promise<WithId<Member>[]> {
    const [members, codes] = await Promise.all([
      memberRepository.getByProvider(providerId),
      // Sans les codes, l'écran de l'équipe doit quand même s'afficher.
      memberAccessCodeRepository.listByProvider(providerId).catch((err) => {
        console.warn('[memberService] codes d’accès illisibles', err);
        return [];
      }),
    ]);
    // Le plus récent gagne si un membre en avait plusieurs (régénération
    // interrompue) ; la fiche d'avant la migration sert de repli.
    const parMembre = new Map<string, { code: string; t: number }>();
    for (const c of codes) {
      const t = c.createdAt?.getTime() ?? 0;
      const actuel = parMembre.get(c.memberId);
      if (!actuel || t > actuel.t) parMembre.set(c.memberId, { code: c.code, t });
    }
    return members.map((m) => ({ ...m, accessCode: parMembre.get(m.id)?.code ?? m.accessCode ?? null }));
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
   * Attribue un code d'accès au membre, format PRENOM-XXXX, et le range dans
   * `memberAccessCodes`. L'unicité est celle de la base : un code déjà pris
   * est refusé à l'écriture, on en tire un autre.
   */
  private async attribuerCodeAcces(providerId: string, memberId: string, name: string): Promise<string> {
    const firstName = name
      .split(' ')[0]
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove accents
      .replace(/[^A-Z]/g, '') // Keep only letters
      .substring(0, 6) || 'MEMBRE'; // prénom sans lettre latine

    for (let essai = 0; essai < 12; essai++) {
      // Partie aléatoire allongée après quelques collisions.
      const code = `${firstName}-${this.generateRandomCode(essai < 8 ? 4 : 6)}`;
      if (await memberAccessCodeRepository.reserver(code, providerId, memberId)) return code;
    }
    throw new Error("Impossible d'attribuer un code d'accès à ce membre. Réessayez.");
  }

  /**
   * À la création, la fiche existe déjà : faire échouer l'appel pour un
   * code manquant ferait croire que le membre n'a pas été créé (on le
   * recréerait en double) — et, à l'inscription, bloquerait le compte.
   * Sans code, l'écran du gérant affiche « — » et propose de le régénérer.
   */
  private async attribuerCodeSansBloquer(providerId: string, memberId: string, name: string): Promise<void> {
    try {
      await this.attribuerCodeAcces(providerId, memberId, name);
    } catch (err) {
      console.warn('[memberService] code d’accès non attribué', memberId, err);
    }
  }

  /** Retire les codes du membre — tous, ou tous sauf `garder`. */
  private async retirerCodesAcces(providerId: string, memberId: string, garder?: string): Promise<void> {
    const codes = await memberAccessCodeRepository.listByProvider(providerId);
    await Promise.all(
      codes
        .filter((c) => c.memberId === memberId && c.code !== garder)
        .map((c) => memberAccessCodeRepository.delete(c.code)),
    );
  }

  /**
   * Generate random alphanumeric code
   */
  private generateRandomCode(length: number): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude similar characters (0, O, 1, I)
    // Tirage cryptographique quand la plateforme l'offre (navigateur, Node) ;
    // Math.random en repli (Hermes sans polyfill).
    const alea = new Uint32Array(length);
    const crypto = (globalThis as { crypto?: { getRandomValues?: (a: Uint32Array) => Uint32Array } }).crypto;
    if (crypto?.getRandomValues) crypto.getRandomValues(alea);
    else for (let i = 0; i < length; i++) alea[i] = Math.floor(Math.random() * 2 ** 32);
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(alea[i] % chars.length);
    }
    return result;
  }
}

// Singleton instance
export const memberService = new MemberService();
