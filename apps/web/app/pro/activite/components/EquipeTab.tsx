'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button, useToast } from '@/components/ui';
import {
  memberService,
  locationService,
  catalogService,
  bookingRepository,
  uploadFile,
  storagePaths,
} from '@booking-app/firebase';
import { Loader2, Users, Plus } from 'lucide-react';
import { MemberCard } from './MemberCard';
import { MemberModal, type MemberFormData } from './MemberModal';
import type { Member, Location, Service } from '@booking-app/shared';
import { PLAN_LIMITS, computeEntitlements } from '@booking-app/shared';
import { UpgradeTeamModal } from '@/components/modals/UpgradeTeamModal';

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
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);

  // Plan member limit check — tier depuis les droits calculés (un comp `team`
  // doit avoir les limites Studio même si `provider.plan` dit `trial`) ; le
  // trial garde ses propres plafonds. Même règle que LieuxTab.
  const ent = computeEntitlements(provider);
  const plan =
    ent.source === 'paid' || ent.source === 'comp'
      ? (ent.effectivePlan ?? 'trial')
      : (provider?.plan || 'trial');
  const planLimits = PLAN_LIMITS[plan as keyof typeof PLAN_LIMITS] ?? null;
  const maxMembers = planLimits?.maxMembers ?? Infinity;
  const activeMembers = members.filter((m) => m.isActive);
  const isAtMemberLimit = activeMembers.length >= maxMembers;
  const isSoloPlan = plan === 'solo' || plan === 'trial';

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

    // `memberIds === null` signifie « tous les membres ». Décocher une telle
    // prestation ne changeait RIEN : la boucle l'ignorait, la case se
    // décochait à l'écran et l'attribution restait intacte. On matérialise
    // donc la liste (tous les membres actifs sauf celui-ci) avant de retirer.
    //
    // Et comme une liste vide vaut elle aussi « tous les membres » partout
    // dans le code, retirer le DERNIER membre rendait la prestation à toute
    // l'équipe. On refuse, et on le fait AVANT la moindre écriture : un
    // refus au milieu laissait une sauvegarde à moitié faite, suivie d'un
    // « Membre mis à jour » qui la contredisait.
    const retraits = servicesToRemove
      .map((serviceId) => {
        const service = services.find((s) => s.id === serviceId);
        if (!service) return null;
        const actuels = service.memberIds ?? activeMembers.map((m) => m.id);
        return { service, restants: actuels.filter((id) => id !== memberId) };
      })
      .filter((x): x is { service: WithId<Service>; restants: string[] } => x !== null);

    const orphelines = retraits.filter((r) => r.restants.length === 0);
    if (orphelines.length > 0) {
      throw new Error(
        `Une prestation doit rester attribuée à au moins un membre : ${orphelines
          .map((r) => r.service.name)
          .join(', ')}`,
      );
    }

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

    for (const { service, restants } of retraits) {
      await catalogService.updateService(provider!.id, service.id, {
        memberIds: restants,
      });
    }
  };

  // Handle save (create or update)
  const handleSave = async (data: MemberFormData) => {
    if (!provider) return;

    try {
      let memberId: string;

      if (selectedMember) {
        // Le lieu est volontairement ABSENT d'`updateMember` : c'est
        // `changeLocation` qui l'écrit, et il commence par vérifier que le
        // lieu change vraiment. En l'écrivant ici d'abord, cette garde
        // voyait le nouveau lieu déjà posé, sortait aussitôt, et les
        // documents de disponibilité restaient sur l'ancien lieu.
        await memberService.updateMember(provider.id, selectedMember.id, {
          name: data.name,
          email: data.email,
          phone: data.phone,
          color: data.color,
        });
        memberId = selectedMember.id;

        // If location changed, use the dedicated method to sync availability
        if (selectedMember.locationId !== data.locationId) {
          await memberService.changeLocation(provider.id, memberId, data.locationId);
        }

        // Update service assignments
        await updateServiceMemberAssignments(memberId, data.serviceIds);

        toast.success('Membre mis à jour');
      } else {
        // Create member
        const newMember = await memberService.createMember(provider.id, {
          name: data.name,
          email: data.email,
          phone: data.phone,
          color: data.color,
          locationId: data.locationId, // NOUVEAU MODÈLE: 1 membre = 1 lieu
          isDefault: false, // Not a default member
          serviceIds: data.serviceIds,
        });
        memberId = newMember.id;

        // Upload photo if one was selected during creation
        if (data.photoFile) {
          try {
            const path = `${storagePaths.memberPhotos(provider.id, memberId)}/${Date.now()}_${data.photoFile.name}`;
            const photoURL = await uploadFile(path, data.photoFile, { contentType: data.photoFile.type });
            await memberService.updatePhoto(provider.id, memberId, photoURL);
          } catch {
            // Non-blocking: member created but photo upload failed
          }
        }

        // Update service assignments for new member (already included above, but keep for safety)
        await updateServiceMemberAssignments(memberId, data.serviceIds);

        toast.success('Membre créé');
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
      toast.success('Membre supprimé');
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
              ? 'Passez au plan Studio pour réactiver ce membre'
              : `Limite de ${maxMembers} membres actifs atteinte`
          );
          return;
        }
        await memberService.reactivateMember(provider.id, memberId);
        toast.success('Membre activé');
      } else {
        // Garde-fou : un membre désactivé qui porte des rendez-vous futurs
        // les rend INVISIBLES pour les créneaux des autres membres — la
        // recette exacte des doubles réservations. On prévient, chiffres à
        // l'appui, avant d'accepter.
        const resas = await bookingRepository.getByProvider(provider.id);
        const maintenant = new Date();
        const futures = resas.filter(
          (b) =>
            b.memberId === memberId &&
            ['confirmed', 'pending', 'pending_payment'].includes(b.status) &&
            b.datetime > maintenant,
        ).length;
        if (futures > 0) {
          const ok = window.confirm(
            `${futures} rendez-vous à venir ${futures > 1 ? 'sont' : 'est'} sur ce membre.\n\n` +
              'Une fois désactivé, ces rendez-vous resteront valides mais NE BLOQUERONT ' +
              'PLUS les créneaux de vos autres membres — des clientes pourraient réserver ' +
              'par-dessus.\n\nRéattribuez-les d\u2019abord depuis le planning, ou confirmez ' +
              'en connaissance de cause.',
          );
          if (!ok) return;
        }
        await memberService.deactivateMember(provider.id, memberId);
        toast.success('Membre désactivé');
      }
      await fetchData();
    } catch (error) {
      console.error('Toggle active error:', error);
      toast.error('Erreur lors de la mise à jour');
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
            Votre équipe
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Gérez les membres de votre équipe
          </p>
        </div>

        <div className="flex flex-col items-end gap-1">
          <Button onClick={isAtMemberLimit ? () => setUpgradeModalOpen(true) : handleOpenCreate}>
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
            Ajoutez votre premier membre pour gérer plusieurs agendas et permettre à votre équipe d'accéder à leur planning.
          </p>
          <Button onClick={isAtMemberLimit ? () => setUpgradeModalOpen(true) : handleOpenCreate} className="mt-6">
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
        estMembreSupplementaire={!selectedMember && members.length >= 1}
        onDelete={handleDelete}
        onRegenerateCode={handleRegenerateCode}
        onSendCode={handleSendCode}
        upcomingBookingsCount={upcomingBookingsCount}
      />

      {/* Upgrade modal */}
      <UpgradeTeamModal
        isOpen={upgradeModalOpen}
        onClose={() => setUpgradeModalOpen(false)}
        context="members"
      />
    </div>
  );
}
