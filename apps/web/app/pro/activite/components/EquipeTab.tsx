'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button, useToast } from '@/components/ui';
import {
  memberService,
  locationService,
  catalogService,
  bookingRepository,
} from '@booking-app/firebase';
import { Loader2, Users, Plus } from 'lucide-react';
import { MemberCard } from './MemberCard';
import { MemberModal, type MemberFormData } from './MemberModal';
import type { Member, Location, Service } from '@booking-app/shared';
import { PLAN_LIMITS } from '@booking-app/shared';

type WithId<T> = { id: string } & T;

export function EquipeTab() {
  const { provider } = useAuth();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<WithId<Member>[]>([]);
  const [locations, setLocations] = useState<WithId<Location>[]>([]);
  const [services, setServices] = useState<WithId<Service>[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<WithId<Member> | null>(null);
  const [selectedMemberServiceIds, setSelectedMemberServiceIds] = useState<string[]>([]);
  const [upcomingBookingsCount, setUpcomingBookingsCount] = useState(0);

  // Plan member limit check (no limit during trial — enforced at plan selection)
  const plan = provider?.plan || 'trial';
  const planLimits = plan !== 'trial' ? PLAN_LIMITS[plan as keyof typeof PLAN_LIMITS] : null;
  const maxMembers = planLimits?.maxMembers ?? Infinity;
  const activeMembers = members.filter((m) => m.isActive);
  const isAtMemberLimit = plan !== 'trial' && activeMembers.length >= maxMembers;
  const isSoloPlan = plan === 'solo';

  // Fetch data
  const fetchData = useCallback(async () => {
    if (!provider) return;

    setLoading(true);
    try {
      const [membersData, locationsData, servicesData] = await Promise.all([
        memberService.getByProvider(provider.id),
        locationService.getByProvider(provider.id),
        catalogService.getByProvider(provider.id),
      ]);

      setMembers(membersData);
      setLocations(locationsData);
      setServices(servicesData);
    } catch (error) {
      console.error('Fetch error:', error);
      toast.error('Erreur lors du chargement des membres');
    } finally {
      setLoading(false);
    }
  }, [provider, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Count upcoming bookings for selected member
  const fetchUpcomingBookings = useCallback(async (memberId: string) => {
    if (!provider) return;

    try {
      const bookings = await bookingRepository.getByMember(provider.id, memberId);
      const now = new Date();
      const upcoming = bookings.filter(
        (b) => b.datetime >= now && (b.status === 'confirmed' || b.status === 'pending')
      );
      setUpcomingBookingsCount(upcoming.length);
    } catch (error) {
      console.error('Fetch bookings error:', error);
      setUpcomingBookingsCount(0);
    }
  }, [provider]);

  // Get services assigned to a member (memberIds is null = all members, or includes memberId)
  const getMemberServiceIds = useCallback((memberId: string): string[] => {
    return services
      .filter((s) => s.memberIds === null || s.memberIds.includes(memberId))
      .map((s) => s.id);
  }, [services]);

  // Handle open modal for create
  const handleOpenCreate = () => {
    setSelectedMember(null);
    setSelectedMemberServiceIds([]);
    setUpcomingBookingsCount(0);
    setModalOpen(true);
  };

  // Handle open modal for edit
  const handleOpenEdit = async (member: WithId<Member>) => {
    setSelectedMember(member);
    setSelectedMemberServiceIds(getMemberServiceIds(member.id));
    await fetchUpcomingBookings(member.id);
    setModalOpen(true);
  };

  // Handle close modal
  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedMember(null);
    setSelectedMemberServiceIds([]);
    setUpcomingBookingsCount(0);
  };

  // Update service memberIds based on form selection
  const updateServiceMemberAssignments = async (memberId: string, newServiceIds: string[]) => {
    const currentServiceIds = getMemberServiceIds(memberId);

    // Services to add this member to
    const servicesToAdd = newServiceIds.filter((id) => !currentServiceIds.includes(id));
    // Services to remove this member from
    const servicesToRemove = currentServiceIds.filter((id) => !newServiceIds.includes(id));

    // Update services
    for (const serviceId of servicesToAdd) {
      const service = services.find((s) => s.id === serviceId);
      if (service) {
        const newMemberIds = service.memberIds === null
          ? [memberId]
          : [...service.memberIds, memberId];
        await catalogService.updateService(provider!.id, serviceId, {
          memberIds: newMemberIds,
        });
      }
    }

    for (const serviceId of servicesToRemove) {
      const service = services.find((s) => s.id === serviceId);
      if (service && service.memberIds !== null) {
        const newMemberIds = service.memberIds.filter((id) => id !== memberId);
        await catalogService.updateService(provider!.id, serviceId, {
          memberIds: newMemberIds.length > 0 ? newMemberIds : null,
        });
      }
    }
  };

  // Handle save (create or update)
  const handleSave = async (data: MemberFormData) => {
    if (!provider) return;

    try {
      let memberId: string;

      if (selectedMember) {
        // Update member
        await memberService.updateMember(provider.id, selectedMember.id, {
          name: data.name,
          email: data.email,
          phone: data.phone,
          locationId: data.locationId, // NOUVEAU MODÈLE: 1 membre = 1 lieu
        });
        memberId = selectedMember.id;

        // If location changed, use the dedicated method to sync availability
        if (selectedMember.locationId !== data.locationId) {
          await memberService.changeLocation(provider.id, memberId, data.locationId);
        }

        // Update service assignments
        await updateServiceMemberAssignments(memberId, data.serviceIds);

        toast.success('Membre mis a jour');
      } else {
        // Create member
        const newMember = await memberService.createMember(provider.id, {
          name: data.name,
          email: data.email,
          phone: data.phone,
          locationId: data.locationId, // NOUVEAU MODÈLE: 1 membre = 1 lieu
          isDefault: false, // Not a default member
          serviceIds: data.serviceIds,
        });
        memberId = newMember.id;

        // Update service assignments for new member (already included above, but keep for safety)
        await updateServiceMemberAssignments(memberId, data.serviceIds);

        toast.success('Membre cree');
      }
      await fetchData();
    } catch (error) {
      console.error('Save error:', error);
      throw error;
    }
  };

  // Handle delete
  const handleDelete = async (memberId: string) => {
    if (!provider) return;

    try {
      await memberService.deleteMember(provider.id, memberId);
      toast.success('Membre supprime');
      await fetchData();
    } catch (error) {
      console.error('Delete error:', error);
      throw error;
    }
  };

  // Handle toggle active
  const handleToggleActive = async (memberId: string, isActive: boolean) => {
    if (!provider) return;

    try {
      if (isActive) {
        // Check plan limit before reactivating
        if (isAtMemberLimit) {
          toast.error(
            isSoloPlan
              ? 'Passez au plan Studio pour reactiver ce membre'
              : `Limite de ${maxMembers} membres actifs atteinte`
          );
          return;
        }
        await memberService.reactivateMember(provider.id, memberId);
        toast.success('Membre active');
      } else {
        await memberService.deactivateMember(provider.id, memberId);
        toast.success('Membre desactive');
      }
      await fetchData();
    } catch (error) {
      console.error('Toggle active error:', error);
      toast.error('Erreur lors de la mise a jour');
    }
  };

  // Handle regenerate code
  const handleRegenerateCode = async (memberId: string): Promise<string> => {
    if (!provider) throw new Error('Provider not found');

    const newCode = await memberService.regenerateAccessCode(provider.id, memberId);
    await fetchData();
    return newCode;
  };

  // Handle send code by email
  const handleSendCode = async (memberId: string) => {
    if (!provider) return;

    const member = members.find((m) => m.id === memberId);
    if (!member) return;

    try {
      const response = await fetch('/api/send-member-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          providerId: provider.id,
          memberId: member.id,
          memberName: member.name,
          memberEmail: member.email,
          accessCode: member.accessCode,
          businessName: provider.businessName,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Erreur lors de l\'envoi');
      }
    } catch (error) {
      console.error('Send code error:', error);
      throw error;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Votre equipe
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Gerez les membres de votre equipe
          </p>
        </div>

        <div className="flex flex-col items-end gap-1">
          <Button onClick={handleOpenCreate} disabled={isAtMemberLimit}>
            <Plus className="w-4 h-4 mr-2" />
            Ajouter
          </Button>
          {isAtMemberLimit && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              {isSoloPlan
                ? 'Passez au plan Studio pour ajouter des membres'
                : `Limite de ${maxMembers} membres atteinte`}
            </p>
          )}
        </div>
      </div>

      {/* Members list */}
      {members.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700">
          <Users className="w-12 h-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Aucun membre
          </h3>
          <p className="text-gray-500 dark:text-gray-400 text-center max-w-md">
            Ajoutez votre premier membre pour gerer plusieurs agendas et permettre a votre equipe d'acceder a leur planning.
          </p>
          <Button onClick={handleOpenCreate} className="mt-6" disabled={isAtMemberLimit}>
            <Plus className="w-4 h-4 mr-2" />
            Ajouter un membre
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {members.map((member) => (
            <MemberCard
              key={member.id}
              member={member}
              locations={locations}
              services={services}
              memberServiceIds={getMemberServiceIds(member.id)}
              onToggleActive={handleToggleActive}
              onClick={() => handleOpenEdit(member)}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      <MemberModal
        isOpen={modalOpen}
        onClose={handleCloseModal}
        member={selectedMember}
        locations={locations}
        services={services}
        memberServiceIds={selectedMemberServiceIds}
        onSave={handleSave}
        onDelete={handleDelete}
        onRegenerateCode={handleRegenerateCode}
        onSendCode={handleSendCode}
        upcomingBookingsCount={upcomingBookingsCount}
      />
    </div>
  );
}
