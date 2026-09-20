'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { ConfirmDialog, useToast } from '@/components/ui';
import {
  schedulingService,
  locationService,
  memberService,
  availabilityRepository,
} from '@booking-app/firebase';
import { Loader2, Clock, Users, AlertTriangle } from 'lucide-react';
import { DayRow } from './DayRow';
import { MemberPills } from './MemberPills';
import { QuickTemplates } from './QuickTemplates';
import { StickyFooter } from './StickyFooter';
import { WeeklyPreview } from './WeeklyPreview';
import { BlockedSlotsSection, type BlockedSlotFormData } from './BlockedSlotsSection';
import { CopierHorairesVers } from './organisation/CopierHorairesVers';
import { useScheduleReducer, type DaySchedule } from '../hooks/useScheduleReducer';
import { horairesEnVigueur, resumerHoraires } from '@booking-app/shared';
import type { BlockedSlot, Location, Member } from '@booking-app/shared';

type WithId<T> = { id: string } & T;

/**
 * Redesigned availability editor.
 * Always-editable interface with copy-to mechanism and sticky save bar.
 * No more view/edit toggle.
 */
export function DisponibilitesTab() {
  const { provider } = useAuth();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [blockedSlots, setBlockedSlots] = useState<WithId<BlockedSlot>[]>([]);
  const [locations, setLocations] = useState<WithId<Location>[]>([]);
  const [members, setMembers] = useState<WithId<Member>[]>([]);

  // Selected member
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  // `?memberId=` est un SIGNAL À USAGE UNIQUE, pas un état : « Définir ses
  // horaires » désigne qui ouvrir, puis on retire le paramètre. Le laisser
  // dans l'URL le faisait réimposer à chaque clic sur une autre pastille,
  // et le sélecteur devenait inutilisable après cette navigation.
  const router = useRouter();
  const searchParams = useSearchParams();
  const memberIdDemande = searchParams.get('memberId');
  // Lu dans `fetchData` SANS en être une dépendance : retirer le paramètre
  // relancerait sinon tout le chargement juste après l'avoir honoré.
  const demandeRef = useRef(memberIdDemande);
  demandeRef.current = memberIdDemande;

  // Confirm dialog for unsaved changes on member switch
  const [pendingMemberSwitch, setPendingMemberSwitch] = useState<string | null>(null);

  // Schedule state via reducer
  const {
    orderedSchedule,
    saving,
    isDirty,
    dirtyDays,
    dirtyCount,
    load,
    updateDay,
    copyTo,
    applyTemplate,
    reset,
    saveStart,
    saveSuccess,
    saveError,
  } = useScheduleReducer();

  // Derived
  const selectedMember = members.find((m) => m.id === selectedMemberId);
  const selectedLocation = selectedMember
    ? locations.find((l) => l.id === selectedMember.locationId)
    : null;
  const hasMultipleMembers = members.length > 1;

  // Fetch members, locations, blocked slots
  const fetchData = useCallback(async () => {
    if (!provider) return;

    setLoading(true);
    try {
      const [locationsData, membersData] = await Promise.all([
        locationService.getActiveByProvider(provider.id),
        memberService.getByProvider(provider.id),
      ]);

      setLocations(locationsData);
      setMembers(membersData);

      if (!selectedMemberId && membersData.length > 0) {
        // « Définir ses horaires » depuis l'onglet Équipe désigne QUI :
        // sans ça on atterrissait sur le membre par défaut et il fallait
        // retrouver la bonne personne à la main.
        const demande = membersData.find((m) => m.id === demandeRef.current);
        const defaultMember = demande || membersData.find((m) => m.isDefault) || membersData[0];
        if (defaultMember) {
          setSelectedMemberId(defaultMember.id);
        }
      }

      const blockedSlotsData = await schedulingService.getUpcomingBlockedSlots(provider.id);
      setBlockedSlots(blockedSlotsData);

      const tous = await availabilityRepository.getByProvider(provider.id);
      setHorairesEquipe(
        tous.map((a) => ({
          memberId: a.memberId,
          dayOfWeek: a.dayOfWeek,
          isOpen: a.isOpen,
          slots: a.slots ?? [],
          effectiveFrom: a.effectiveFrom ?? null,
        })),
      );
    } catch (error) {
      console.error('Fetch error:', error);
      toast.error('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  }, [provider, selectedMemberId, toast]);

  const [sansHoraires, setSansHoraires] = useState(false);
  // Horaires de TOUTE l'équipe : ils servent à dire ce qu'on remplacerait
  // chez chaque destinataire avant de diffuser une semaine.
  const [horairesEquipe, setHorairesEquipe] = useState<
    { memberId: string; dayOfWeek: number; isOpen: boolean; slots: { start: string; end: string }[]; effectiveFrom: Date | null }[]
  >([]);
  const [diffusion, setDiffusion] = useState<string[] | null>(null);
  const [diffusionEnCours, setDiffusionEnCours] = useState(false);

  // Fetch availability for selected member and load into reducer
  const fetchAvailability = useCallback(async () => {
    if (!provider || !selectedMemberId) return;

    try {
      const tousLesDocuments = await schedulingService.getWeeklySchedule(
        provider.id,
        selectedMemberId
      );
      // Ce que l'éditeur montre, c'est la semaine EN VIGUEUR. Les documents
      // bruts contiennent aussi les changements programmés pour plus tard ;
      // le premier trouvé gagnait, si bien qu'on pouvait afficher — et
      // réenregistrer comme horaires du jour — une semaine future.
      const availabilityData = horairesEnVigueur(tousLesDocuments);
      // Rien en vigueur pour ce membre : ce qu'on affiche est une
      // proposition, pas ses horaires. Sans enregistrement, il n'a AUCUN
      // créneau.
      setSansHoraires(availabilityData.length === 0);

      const defaultSchedule: DaySchedule[] = [
        { dayOfWeek: 0, isOpen: false, slots: [] },
        { dayOfWeek: 1, isOpen: true, slots: [{ start: '09:00', end: '18:00' }] },
        { dayOfWeek: 2, isOpen: true, slots: [{ start: '09:00', end: '18:00' }] },
        { dayOfWeek: 3, isOpen: true, slots: [{ start: '09:00', end: '18:00' }] },
        { dayOfWeek: 4, isOpen: true, slots: [{ start: '09:00', end: '18:00' }] },
        { dayOfWeek: 5, isOpen: true, slots: [{ start: '09:00', end: '18:00' }] },
        { dayOfWeek: 6, isOpen: false, slots: [] },
      ];

      const schedule = defaultSchedule.map((defaultDay) => {
        const existing = availabilityData.find((a) => a.dayOfWeek === defaultDay.dayOfWeek);
        if (existing) {
          return {
            dayOfWeek: existing.dayOfWeek,
            isOpen: existing.isOpen,
            slots: existing.slots,
          };
        }
        return defaultDay;
      });

      load(schedule);
    } catch (error) {
      console.error('Fetch availability error:', error);
    }
  }, [provider, selectedMemberId, load]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (selectedMemberId) {
      fetchAvailability();
    }
  }, [selectedMemberId, fetchAvailability]);

  // Une demande explicite doit gagner même quand quelqu'un est déjà
  // sélectionné — l'onglet peut rester monté d'une visite à l'autre, sans
  // quoi le deuxième « Définir ses horaires » ne ferait rien. Elle est
  // ensuite CONSOMMÉE : on attend que l'équipe soit chargée, on applique,
  // et on retire le paramètre de l'URL. Sans ce retrait, l'effet
  // réimposait cette personne à chaque sélection manuelle.
  useEffect(() => {
    if (!memberIdDemande || members.length === 0) return;

    if (
      memberIdDemande !== selectedMemberId &&
      members.some((m) => m.id === memberIdDemande)
    ) {
      // Des modifications non enregistrées passent par la même
      // confirmation qu'un changement de personne à la main.
      if (isDirty) setPendingMemberSwitch(memberIdDemande);
      else setSelectedMemberId(memberIdDemande);
    }

    const params = new URLSearchParams(searchParams.toString());
    params.delete('memberId');
    const reste = params.toString();
    router.replace(reste ? `/pro/activite?${reste}` : '/pro/activite', { scroll: false });
  }, [memberIdDemande, members, selectedMemberId, isDirty, searchParams, router]);

  // Handle member switch with unsaved changes check
  const handleMemberSelect = (memberId: string) => {
    if (memberId === selectedMemberId) return;
    if (isDirty) {
      setPendingMemberSwitch(memberId);
    } else {
      setSelectedMemberId(memberId);
    }
  };

  const confirmMemberSwitch = () => {
    if (pendingMemberSwitch) {
      reset();
      setSelectedMemberId(pendingMemberSwitch);
      setPendingMemberSwitch(null);
    }
  };

  // Save handler — batch save all 7 days
  const handleSave = async () => {
    if (!provider || !selectedMemberId || !selectedMember) return;

    saveStart();
    try {
      await schedulingService.setWeeklySchedule(
        provider.id,
        selectedMemberId,
        selectedMember.locationId,
        orderedSchedule.map((day) => ({
          dayOfWeek: day.dayOfWeek,
          slots: day.slots,
          isOpen: day.isOpen,
        }))
      );
      saveSuccess();
      toast.success('Disponibilités mises à jour');
    } catch (error) {
      console.error('Save error:', error);
      saveError();
      toast.error('Erreur lors de la sauvegarde');
    }
  };

  const horairesActuels = horairesEnVigueur(horairesEquipe);

  /** Collègues vers qui recopier la semaine affichée. */
  const ciblesDiffusion = members
    .filter((m) => m.id !== selectedMemberId && m.isActive && m.locationId)
    .map((m) => ({ id: m.id, name: m.name, resume: resumerHoraires(horairesActuels, m.id) }));

  /**
   * Pourquoi la diffusion est interdite, le cas échéant.
   *
   * On ne diffuse que des horaires RÉELLEMENT enregistrés : l'éditeur
   * affiche une semaine par défaut quand la base est vide, et des
   * modifications non enregistrées ne sont pas encore les horaires de la
   * personne. Recopier l'un ou l'autre donnerait à toute l'équipe une
   * semaine que la source elle-même n'a pas.
   */
  const raisonPasDeDiffusion = isDirty
    ? 'Enregistrez d’abord vos modifications.'
    : sansHoraires
      ? 'Enregistrez d’abord les horaires de cette personne.'
      : null;

  const appliquerDiffusion = async () => {
    if (!provider || !diffusion || !selectedMemberId) return;
    const source = members.find((m) => m.id === selectedMemberId);
    const cibles = diffusion
      .map((id) => members.find((m) => m.id === id))
      .filter((m): m is WithId<Member> => !!m && !!m.locationId);
    if (!source || cibles.length === 0) return;

    setDiffusionEnCours(true);
    try {
      const aEcrire = orderedSchedule.map((j) => ({
        dayOfWeek: j.dayOfWeek,
        slots: j.slots,
        isOpen: j.isOpen,
      }));
      // Chaque destinataire reçoit SON lieu : le champ est dénormalisé
      // depuis le membre, celui de la source enverrait ses créneaux
      // ailleurs.
      // Écritures séquentielles et INDÉPENDANTES : un échec en milieu de
      // liste laisse les précédentes écrites. On nomme qui a reçu la
      // semaine et qui est à refaire, sinon on croit que rien n'a bougé.
      const faits: string[] = [];
      const echecs: string[] = [];
      for (const cible of cibles) {
        try {
          await schedulingService.setWeeklySchedule(
            provider.id,
            cible.id,
            cible.locationId,
            aEcrire,
          );
          faits.push(cible.name);
        } catch (error) {
          console.error('Diffusion error:', error);
          echecs.push(cible.name);
        }
      }
      setDiffusion(null);
      await fetchData();
      if (echecs.length === 0) {
        toast.success(`Horaires copiés sur ${faits.length} personne${faits.length > 1 ? 's' : ''}`);
      } else if (faits.length === 0) {
        toast.error(`Aucune copie n’a abouti (${echecs.join(', ')}).`);
      } else {
        toast.warning(
          `Copiés sur ${faits.join(', ')}. Échec pour ${echecs.join(', ')} : à refaire pour ${
            echecs.length > 1 ? 'ces personnes' : 'cette personne'
          }.`,
        );
      }
    } catch (error) {
      console.error('Diffusion error:', error);
      toast.error('Les horaires n’ont pas pu être copiés');
    } finally {
      setDiffusionEnCours(false);
    }
  };

  // Handle add blocked slot
  const handleAddBlockedSlot = async (data: BlockedSlotFormData) => {
    if (!provider) return;

    try {
      await schedulingService.blockPeriod(provider.id, {
        startDate: data.startDate,
        endDate: data.endDate,
        allDay: data.allDay,
        isRecurring: false,
        startTime: data.startTime,
        endTime: data.endTime,
        spanMode: data.spanMode,
        reason: data.reason,
        memberId: data.memberId,
        locationId: data.locationId,
      });
      toast.success('Période de fermeture ajoutée');
      const blockedSlotsData = await schedulingService.getUpcomingBlockedSlots(provider.id);
      setBlockedSlots(blockedSlotsData);
    } catch (error) {
      console.error('Add blocked slot error:', error);
      toast.error("Erreur lors de l'ajout");
      throw error;
    }
  };

  // Handle delete blocked slot
  const handleDeleteBlockedSlot = async (slotId: string) => {
    if (!provider) return;

    try {
      await schedulingService.unblockPeriod(provider.id, slotId);
      toast.success('Période de fermeture supprimée');
      setBlockedSlots((prev) => prev.filter((s) => s.id !== slotId));
    } catch (error) {
      console.error('Delete blocked slot error:', error);
      toast.error('Erreur lors de la suppression');
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

  if (members.length === 0) {
    return (
      <div className="text-center py-16 px-4">
        <Users className="w-12 h-12 mx-auto mb-4 text-gray-400" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Aucun membre configuré
        </h3>
        <p className="text-gray-500 dark:text-gray-400">
          Ajoutez d&apos;abord un membre dans l&apos;onglet &quot;Équipe&quot; pour définir vos disponibilités.
        </p>
      </div>
    );
  }

  if (locations.length === 0) {
    return (
      <div className="text-center py-16 px-4">
        <Clock className="w-12 h-12 mx-auto mb-4 text-gray-400" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Aucun lieu configuré
        </h3>
        <p className="text-gray-500 dark:text-gray-400">
          Ajoutez d&apos;abord un lieu dans l&apos;onglet &quot;Lieux&quot; pour définir vos disponibilités.
        </p>
      </div>
    );
  }

  return (
    <div className="pb-20">
      {/* Header */}
      <div className="flex flex-col gap-4 mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            Vos disponibilités
            {saving && (
              <Loader2 className="w-4 h-4 text-primary-600 animate-spin" />
            )}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Configurez vos horaires d&apos;ouverture, puis enregistrez vos modifications.
          </p>
        </div>

        {/* Member pills selector */}
        {hasMultipleMembers && selectedMemberId && (
          <MemberPills
            members={members}
            locations={locations}
            selectedMemberId={selectedMemberId}
            onSelect={handleMemberSelect}
            disabled={saving}
          />
        )}

        {/* Single member info */}
        {!hasMultipleMembers && selectedMember && selectedLocation && (
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 px-4 py-2 rounded-lg">
            <Users className="w-4 h-4" />
            <span>
              Disponibilités de{' '}
              <span className="font-medium text-gray-900 dark:text-white">{selectedMember.name}</span>
              {' '}au{' '}
              <span className="font-medium text-gray-900 dark:text-white">{selectedLocation.name}</span>
            </span>
          </div>
        )}
      </div>

      {/* Split-panel layout: editor left, preview right on desktop */}
      <div className="xl:grid xl:grid-cols-[minmax(0,420px)_1fr] xl:gap-8">
        {/* Left column — editor (compact) */}
        <div className="space-y-4">
          {sansHoraires && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700 px-3 py-2 text-sm text-amber-900 dark:text-amber-200">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>
                Aucun horaire enregistré pour ce membre : les horaires affichés sont une proposition.
                Tant qu’ils ne sont pas enregistrés, ce membre n’a aucun créneau réservable.
              </span>
            </div>
          )}

          {/* Quick templates */}
          <QuickTemplates onApply={applyTemplate} />

          {/* Day list — always editable */}
          <div className="space-y-0.5">
            {orderedSchedule.map((day) => (
              <DayRow
                key={day.dayOfWeek}
                dayOfWeek={day.dayOfWeek}
                isOpen={day.isOpen}
                slots={day.slots}
                onDayChange={updateDay}
                onCopyTo={copyTo}
                isDirty={dirtyDays.has(day.dayOfWeek)}
              />
            ))}
          </div>

          {/* Diffuser cette semaine vers les collègues. Même composant et
              mêmes garde-fous que le panneau de l'onglet Équipe. */}
          {hasMultipleMembers && selectedMember && (
            <CopierHorairesVers
              sourceNom={selectedMember.name}
              cibles={ciblesDiffusion}
              raisonIndisponible={raisonPasDeDiffusion}
              enCours={diffusionEnCours}
              apparence="encadre"
              onCopier={(ids) => setDiffusion(ids)}
            />
          )}

          {/* Blocked slots section */}
          <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
            <BlockedSlotsSection
              blockedSlots={blockedSlots}
              locations={locations}
              members={members}
              onAdd={handleAddBlockedSlot}
              onDelete={handleDeleteBlockedSlot}
              hasTeams={hasMultipleMembers}
            />
          </div>
        </div>

        {/* Right column — weekly preview (desktop only) */}
        <div className="hidden xl:block">
          <div className="sticky top-24">
            <WeeklyPreview
              schedule={orderedSchedule}
              dirtyDays={dirtyDays}
            />
          </div>
        </div>
      </div>

      {/* Sticky save footer */}
      <StickyFooter
        dirtyCount={dirtyCount}
        saving={saving}
        onSave={handleSave}
        onCancel={reset}
      />

      {/* Diffusion des horaires : on nomme qui sera écrasé. */}
      <ConfirmDialog
        isOpen={diffusion !== null}
        onClose={() => setDiffusion(null)}
        onConfirm={appliquerDiffusion}
        title="Copier ces horaires ?"
        variant="warning"
        loading={diffusionEnCours}
        confirmLabel={`Copier vers ${diffusion?.length ?? 0} personne${(diffusion?.length ?? 0) > 1 ? 's' : ''}`}
        message={(() => {
          const noms = (diffusion ?? [])
            .map((id) => members.find((m) => m.id === id))
            .filter((m): m is WithId<Member> => !!m);
          const ecrases = noms.filter((m) => resumerHoraires(horairesActuels, m.id) !== null);
          return (
            <>
              <p>
                La semaine de <strong>{selectedMember?.name}</strong> va être copiée sur{' '}
                {noms.map((m) => m.name).join(', ')}.
              </p>
              {ecrases.length > 0 && (
                <p className="mt-2">
                  Les horaires actuels de {ecrases.map((m) => m.name).join(', ')} seront{' '}
                  <strong>remplacés</strong>. Les rendez-vous déjà pris ne sont pas annulés, mais
                  certains peuvent se retrouver hors des nouvelles heures.
                </p>
              )}
            </>
          );
        })()}
      />

      {/* Confirm dialog for member switch with unsaved changes */}
      <ConfirmDialog
        isOpen={pendingMemberSwitch !== null}
        onClose={() => setPendingMemberSwitch(null)}
        onConfirm={confirmMemberSwitch}
        title="Modifications non enregistrées"
        message="Vous avez des modifications non enregistrées. Voulez-vous les abandonner et changer de membre ?"
        confirmLabel="Abandonner"
        cancelLabel="Rester"
        variant="warning"
      />
    </div>
  );
}
