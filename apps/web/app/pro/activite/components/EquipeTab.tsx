'use client';

import { useState, useEffect, useCallback, useMemo, useRef, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Button, ConfirmDialog, useToast } from '@/components/ui';
import {
  memberService,
  locationService,
  catalogService,
  availabilityRepository,
  schedulingService,
  bookingRepository,
  uploadFile,
  storagePaths,
} from '@booking-app/firebase';
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CalendarCheck,
  CheckCircle2,
  Grid3X3,
  Loader2,
  Plus,
  Tag,
  Users,
} from 'lucide-react';
import { MemberCard } from './MemberCard';
import { MemberModal, type MemberFormData } from './MemberModal';
import { LieuSection } from './organisation/LieuSection';
import {
  AffectationsMatrice,
  sansPrestataire,
  type GroupeLieu,
} from './organisation/AffectationsMatrice';
import { MembrePanneau } from './organisation/MembrePanneau';
import { horairesEnVigueur, preparerCopieHoraires, resumerHoraires } from './organisation/horaires';
import type { Member, Location, Service, Availability } from '@booking-app/shared';
import {
  PLAN_LIMITS,
  computeEntitlements,
  diagnostiquerMembre,
  membreRealisePrestation,
} from '@booking-app/shared';
import { UpgradeTeamModal } from '@/components/modals/UpgradeTeamModal';

type WithId<T> = { id: string } & T;

export function EquipeTab() {
  const { provider } = useAuth();
  const router = useRouter();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<WithId<Member>[]>([]);
  const [locations, setLocations] = useState<WithId<Location>[]>([]);
  const [services, setServices] = useState<WithId<Service>[]>([]);
  // Horaires de TOUTE l'équipe, en une lecture : avec les prestations, ils
  // décident si un membre peut réellement recevoir des réservations.
  const [availabilities, setAvailabilities] = useState<WithId<Availability>[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<WithId<Member> | null>(null);
  const [selectedMemberServiceIds, setSelectedMemberServiceIds] = useState<string[]>([]);
  const [lieuParDefaut, setLieuParDefaut] = useState<string | undefined>(undefined);
  const [upcomingBookingsCount, setUpcomingBookingsCount] = useState(0);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);

  const [vue, setVue] = useState<'organisation' | 'affectations'>('organisation');
  // La personne dont on règle la configuration dans le panneau latéral.
  const [selectionId, setSelectionId] = useState<string | null>(null);
  const [copieEnCours, setCopieEnCours] = useState(false);
  // Les confirmations passent par une vraie fenêtre, jamais par
  // `window.confirm` : un navigateur qui la bloque rendait l'action
  // silencieuse, et on croyait que le bouton ne servait à rien.
  const [confirmation, setConfirmation] = useState<{
    titre: string;
    message: ReactNode;
    libelle: string;
    variante: 'danger' | 'warning';
    agir: () => Promise<void>;
  } | null>(null);
  const [confirmationEnCours, setConfirmationEnCours] = useState(false);
  const [changementLieuEnCours, setChangementLieuEnCours] = useState(false);
  const panneauRef = useRef<HTMLDivElement>(null);
  const [lieuxReplies, setLieuxReplies] = useState<string[]>([]);
  const [ecritures, setEcritures] = useState<Set<string>>(new Set());

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
  const activeMembers = useMemo(() => members.filter((m) => m.isActive), [members]);
  const isAtMemberLimit = activeMembers.length >= maxMembers;
  const isSoloPlan = plan === 'solo' || plan === 'trial';

  const fetchData = useCallback(async () => {
    if (!provider) return;

    setLoading(true);
    try {
      const [membersData, locationsData, servicesData, availabilitiesData] = await Promise.all([
        memberService.getByProvider(provider.id),
        locationService.getByProvider(provider.id),
        catalogService.getByProvider(provider.id),
        availabilityRepository.getByProvider(provider.id),
      ]);

      setMembers(membersData);
      setLocations(locationsData);
      setServices(servicesData);
      setAvailabilities(availabilitiesData);
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

  const fetchUpcomingBookings = useCallback(async (memberId: string) => {
    if (!provider) return;
    try {
      const bookings = await bookingRepository.getByMember(provider.id, memberId);
      const now = new Date();
      setUpcomingBookingsCount(
        bookings.filter(
          (b) => b.datetime >= now && (b.status === 'confirmed' || b.status === 'pending'),
        ).length,
      );
    } catch (error) {
      console.error('Fetch bookings error:', error);
      setUpcomingBookingsCount(0);
    }
  }, [provider]);

  // Un changement d'horaires programmé pour plus tard ne doit pas compter
  // comme un horaire d'aujourd'hui : sinon un membre sans aucun créneau
  // cette semaine s'afficherait « prêt ».
  const horairesActuels = useMemo(() => horairesEnVigueur(availabilities), [availabilities]);

  // Diagnostic de chaque membre — une seule fois, partagé par l'affichage
  // et par le comptage des créneaux.
  const etats = useMemo(
    () => new Map(members.map((m) => [m.id, diagnostiquerMembre(m, services, horairesActuels)])),
    [members, services, horairesActuels],
  );

  // Créneaux réservables sur 7 jours, par membre. C'est LE chiffre qui parle
  // au professionnel : « 0 créneau » se comprend sans lire, là où « horaires
  // non configurés » demande de savoir ce que ça implique. Calculé avec la
  // plus COURTE de ses prestations, donc la capacité maximale.
  const [creneaux, setCreneaux] = useState<Record<string, number | null>>({});
  // Les données fraîches, lues DANS l'effet sans en être des dépendances :
  // sinon cocher une case relancerait tout le comptage.
  const donneesRef = useRef({ services, etats });
  donneesRef.current = { services, etats };
  const signatureEtats = members
    .map((m) => {
      const e = etats.get(m.id);
      return `${m.id}:${m.isActive ? 1 : 0}:${e?.reservable ? 1 : 0}:${e?.prestations.length ?? 0}`;
    })
    .join('|');

  useEffect(() => {
    if (!provider || members.length === 0) return;
    const { services, etats } = donneesRef.current;
    let annule = false;
    const debut = new Date();
    debut.setHours(0, 0, 0, 0);
    const fin = new Date(debut);
    fin.setDate(fin.getDate() + 7);

    (async () => {
      const entrees = await Promise.all(
        members.map(async (m): Promise<[string, number | null]> => {
          const etat = etats.get(m.id);
          if (!m.isActive || !etat || !etat.reservable) return [m.id, 0];
          const presta = services
            .filter((svc) => etat.prestations.includes(svc.id))
            .sort(
              (a, b) => a.duration + (a.bufferTime ?? 0) - (b.duration + (b.bufferTime ?? 0)),
            )[0];
          if (!presta) return [m.id, 0];
          try {
            const jours = await schedulingService.getAvailabilitySummary({
              providerId: provider.id,
              serviceId: presta.id,
              memberId: m.id,
              startDate: debut,
              endDate: fin,
            });
            return [m.id, jours.reduce((n, j) => n + j.capacity, 0)];
          } catch {
            // Un comptage impossible ne doit pas faire croire à un blocage :
            // `null` masque le chiffre, la ligne reste lisible.
            return [m.id, null];
          }
        }),
      );
      if (!annule) setCreneaux(Object.fromEntries(entrees));
    })();

    return () => {
      annule = true;
    };
    // `signatureEtats` remplace `services` et `etats` : voir donneesRef.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider, members, signatureEtats]);

  /**
   * Qui réalise réellement cette prestation, en identifiants de membres.
   *
   * « Aucun membre désigné » (null OU liste vide) vaut « tous ceux que le
   * lieu autorise ». Il faut donc matérialiser cette liste avant toute
   * modification : sans ça, retirer une personne d'une prestation ouverte à
   * tous n'écrivait rien, et l'ajouter la restreignait à elle seule.
   */
  const membresRealisant = useCallback(
    (service: WithId<Service>): string[] => {
      if (service.memberIds && service.memberIds.length > 0) {
        return service.memberIds.filter((id) => members.some((m) => m.id === id));
      }
      return members
        .filter((m) => m.isActive && membreRealisePrestation(service, m.id, m.locationId))
        .map((m) => m.id);
    },
    [members],
  );

  // Les membres, groupés par lieu. Un lieu vide reste affiché : c'est
  // justement le cas qu'aucun écran ne signalait.
  const groupes = useMemo<GroupeLieu[]>(() => {
    const parLieu = locations.map((lieu) => ({
      lieu,
      membres: members.filter((m) => m.locationId === lieu.id),
    }));
    const orphelins = members.filter(
      (m) => !m.locationId || !locations.some((l) => l.id === m.locationId),
    );
    return orphelins.length > 0 ? [...parLieu, { lieu: null, membres: orphelins }] : parLieu;
  }, [locations, members]);

  const trier = useCallback(
    (liste: WithId<Member>[]) =>
      [...liste].sort((a, b) => {
        if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
        // Le diagnostic est connu dès le premier rendu, le comptage arrive
        // après : trier d'abord sur lui évite que la liste se réorganise
        // sous les yeux du professionnel quand les chiffres tombent.
        const bloqueA = etats.get(a.id)?.reservable === false ? 0 : 1;
        const bloqueB = etats.get(b.id)?.reservable === false ? 0 : 1;
        if (bloqueA !== bloqueB) return bloqueA - bloqueB;
        return (creneaux[a.id] ?? 0) - (creneaux[b.id] ?? 0);
      }),
    [etats, creneaux],
  );

  const getMemberServiceIds = useCallback(
    (memberId: string): string[] => {
      const membre = members.find((m) => m.id === memberId);
      return services
        .filter((s) => membreRealisePrestation(s, memberId, membre?.locationId))
        .map((s) => s.id);
    },
    [services, members],
  );

  const nbPrets = useMemo(
    () => activeMembers.filter((m) => etats.get(m.id)?.reservable).length,
    [activeMembers, etats],
  );
  const creneauxTotal = useMemo(
    () => activeMembers.reduce((n, m) => n + (creneaux[m.id] ?? 0), 0),
    [activeMembers, creneaux],
  );

  /** Ce qui empêche des rendez-vous d'exister, en clair, avec l'action qui répare. */
  const aVerifier = useMemo(() => {
    const items: { id: string; titre: string; detail: string; action: string; faire: () => void }[] = [];

    for (const m of activeMembers) {
      const etat = etats.get(m.id);
      if (!etat) continue;
      if (etat.blocages.includes('sansHoraires')) {
        items.push({
          id: `${m.id}-horaires`,
          titre: `${m.name} n’a aucun horaire enregistré`,
          detail: 'Aucun créneau ne peut être proposé tant que sa semaine n’est pas définie.',
          action: 'Définir ses horaires',
          faire: () => router.push('/pro/activite?tab=disponibilites'),
        });
      }
      if (etat.blocages.includes('sansPrestation')) {
        items.push({
          id: `${m.id}-prestations`,
          titre: `${m.name} ne réalise aucune prestation`,
          detail: 'Les clientes ne verront jamais cette personne dans le tunnel de réservation.',
          action: 'Attribuer des prestations',
          faire: () => setVue('affectations'),
        });
      }
    }

    for (const g of groupes) {
      if (g.lieu && g.lieu.isActive && g.membres.filter((m) => m.isActive).length === 0) {
        items.push({
          id: `${g.lieu.id}-vide`,
          titre: `${g.lieu.name} n’a aucun prestataire`,
          detail: 'Ce lieu ne propose aucun rendez-vous tant que personne n’y est rattaché.',
          action: 'Ajouter un prestataire',
          faire: () => handleOpenCreate(g.lieu!.id),
        });
      }
    }
    return items;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMembers, etats, groupes, router]);

  // Ce qui coince d'abord : au premier affichage, le panneau ouvre sur la
  // personne à régler, pas sur la première de la liste.
  useEffect(() => {
    if (members.length === 0) {
      setSelectionId(null);
      return;
    }
    setSelectionId((actuel) => {
      if (actuel && members.some((m) => m.id === actuel)) return actuel;
      const aRegler = members.find((m) => m.isActive && etats.get(m.id)?.reservable === false);
      return (aRegler ?? members.find((m) => m.isActive) ?? members[0]).id;
    });
  }, [members, etats]);

  const membreSelectionne = members.find((m) => m.id === selectionId) ?? null;

  const selectionner = (memberId: string) => {
    setSelectionId(memberId);
    // Sous xl le panneau est sous la liste : sans ça, le clic n'aurait
    // aucun effet visible sur un écran étroit.
    panneauRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  };

  /** Collègues dont la semaine peut être recopiée sur quelqu'un d'autre. */
  const sourcesHoraires = useCallback(
    (cibleId: string) =>
      members
        .filter((m) => m.id !== cibleId && m.isActive)
        .map((m) => ({ id: m.id, name: m.name, resume: resumerHoraires(horairesActuels, m.id) }))
        .filter((s): s is { id: string; name: string; resume: string } => s.resume !== null),
    [members, horairesActuels],
  );

  const changerLieu = async (memberId: string, locationId: string) => {
    if (!provider || !locationId) return;
    const membre = members.find((m) => m.id === memberId);
    if (!membre || membre.locationId === locationId) return;
    setChangementLieuEnCours(true);
    try {
      await memberService.changeLocation(provider.id, memberId, locationId);
      toast.success('Lieu de rattachement mis à jour');
      await fetchData();
    } catch (error) {
      console.error('Change location error:', error);
      toast.error('Le lieu n’a pas pu être changé');
    } finally {
      setChangementLieuEnCours(false);
    }
  };

  /**
   * Recopie la semaine d'un collègue sur quelqu'un qui n'en a pas.
   *
   * Le LIEU écrit est celui de la personne ciblée, jamais celui de la
   * source : les documents de disponibilité portent un `locationId`
   * dénormalisé, et le mélanger enverrait ses créneaux sur le mauvais lieu.
   */
  const copierHoraires = async (sourceId: string, cibleId: string) => {
    if (!provider) return;
    const cible = members.find((m) => m.id === cibleId);
    const source = members.find((m) => m.id === sourceId);
    if (!cible || !source || !cible.locationId) return;

    setCopieEnCours(true);
    try {
      const semaine = await availabilityRepository.getWeeklySchedule(provider.id, sourceId);
      const aEcrire = preparerCopieHoraires(semaine);
      if (aEcrire.length === 0) {
        toast.error(`${source.name} n’a aucun horaire à copier`);
        return;
      }
      // `cible.locationId` : le lieu écrit est celui de la personne qui
      // reçoit, jamais celui de la source (voir preparerCopieHoraires).
      await availabilityRepository.setWeeklySchedule(
        provider.id,
        cibleId,
        cible.locationId,
        aEcrire,
      );
      toast.success(`Horaires de ${source.name} copiés sur ${cible.name}`);
      await fetchData();
    } catch (error) {
      console.error('Copy schedule error:', error);
      toast.error('Les horaires n’ont pas pu être copiés');
    } finally {
      setCopieEnCours(false);
    }
  };

  /** Collègues vers qui recopier la semaine de quelqu'un. */
  const ciblesHoraires = useCallback(
    (sourceId: string) =>
      members
        .filter((m) => m.id !== sourceId && m.isActive && m.locationId)
        .map((m) => ({ id: m.id, name: m.name, resume: resumerHoraires(horairesActuels, m.id) })),
    [members, horairesActuels],
  );

  /**
   * Recopie une semaine sur plusieurs personnes d'un coup.
   *
   * Écraser l'agenda de quelqu'un ne se fait pas sans le dire : la fenêtre
   * nomme celles dont les horaires actuels vont disparaître.
   */
  const copierVers = (sourceId: string, cibleIds: string[]) => {
    if (!provider || cibleIds.length === 0) return;
    const source = members.find((m) => m.id === sourceId);
    if (!source) return;
    const cibles = cibleIds
      .map((id) => members.find((m) => m.id === id))
      .filter((m): m is WithId<Member> => !!m && !!m.locationId);
    if (cibles.length === 0) return;
    const ecrases = cibles.filter((m) => resumerHoraires(horairesActuels, m.id) !== null);

    setConfirmation({
      titre: 'Copier ces horaires ?',
      variante: ecrases.length > 0 ? 'warning' : 'danger',
      libelle: `Copier vers ${cibles.length} personne${cibles.length > 1 ? 's' : ''}`,
      message: (
        <>
          <p>
            La semaine de <strong>{source.name}</strong> va être copiée sur{' '}
            {cibles.map((m) => m.name).join(', ')}.
          </p>
          {ecrases.length > 0 && (
            <p className="mt-2">
              Les horaires actuels de {ecrases.map((m) => m.name).join(', ')} seront{' '}
              <strong>remplacés</strong>. Les rendez-vous déjà pris ne sont pas annulés, mais
              certains peuvent se retrouver hors des nouvelles heures.
            </p>
          )}
        </>
      ),
      agir: async () => {
        const semaine = await availabilityRepository.getWeeklySchedule(provider.id, sourceId);
        const aEcrire = preparerCopieHoraires(semaine);
        if (aEcrire.length === 0) {
          toast.error(`${source.name} n’a aucun horaire à copier`);
          return;
        }
        // Chaque destinataire reçoit SON propre lieu : le champ est
        // dénormalisé depuis le membre (voir preparerCopieHoraires).
        for (const cible of cibles) {
          await availabilityRepository.setWeeklySchedule(
            provider.id,
            cible.id,
            cible.locationId,
            aEcrire,
          );
        }
        toast.success(
          `Horaires copiés sur ${cibles.length} personne${cibles.length > 1 ? 's' : ''}`,
        );
        await fetchData();
      },
    });
  };

  /**
   * Rattacher quelqu'un à un autre lieu.
   *
   * `changeLocation` déplace aussi ses documents de disponibilité : ce
   * n'est pas un simple champ qu'on change, d'où la confirmation.
   */
  /** Prestataires actifs qu'on peut rattacher à ce lieu. */
  const deplacablesVers = useCallback(
    (locationId: string) =>
      members
        .filter((m) => m.isActive && m.locationId !== locationId)
        .map((m) => ({
          id: m.id,
          name: m.name,
          lieuNom: locations.find((l) => l.id === m.locationId)?.name ?? 'sans lieu',
        })),
    [members, locations],
  );

  const demanderDeplacement = (memberId: string, locationId: string) => {
    const membre = members.find((m) => m.id === memberId);
    const lieu = locations.find((l) => l.id === locationId);
    if (!membre || !lieu) return;
    const ancien = locations.find((l) => l.id === membre.locationId)?.name ?? 'son lieu actuel';

    setConfirmation({
      titre: `Rattacher ${membre.name} à ${lieu.name} ?`,
      variante: 'warning',
      libelle: 'Rattacher ici',
      message: (
        <>
          <p>
            {membre.name} quittera <strong>{ancien}</strong> pour <strong>{lieu.name}</strong>. Ses
            horaires suivent.
          </p>
          <p className="mt-2">
            Les prestations qu’il réalise dépendent aussi du lieu : certaines peuvent ne plus lui
            être proposées, d’autres le devenir.
          </p>
        </>
      ),
      agir: async () => {
        await changerLieu(memberId, locationId);
      },
    });
  };

  const handleOpenCreate = (locationId?: string) => {
    if (isAtMemberLimit) {
      setUpgradeModalOpen(true);
      return;
    }
    setSelectedMember(null);
    setSelectedMemberServiceIds([]);
    setLieuParDefaut(locationId);
    setUpcomingBookingsCount(0);
    setModalOpen(true);
  };

  const handleOpenEdit = async (member: WithId<Member>) => {
    setSelectedMember(member);
    setSelectedMemberServiceIds(getMemberServiceIds(member.id));
    setLieuParDefaut(undefined);
    await fetchUpcomingBookings(member.id);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedMember(null);
    setSelectedMemberServiceIds([]);
    setLieuParDefaut(undefined);
    setUpcomingBookingsCount(0);
  };

  type PlanAttributions = {
    ecritures: { serviceId: string; patch: { memberIds: string[]; isActive?: boolean } }[];
    /** Prestations que plus personne ne réalisera, pour le dire au pro. */
    orphelines: string[];
  };

  /**
   * Calcule ce qu'il faut écrire sur les prestations, SANS rien écrire.
   *
   * Une liste de membres vide vaut « tous ceux que le lieu autorise » : on
   * ne peut donc pas se contenter de la vider quand on retire la dernière
   * personne. La prestation est désactivée, ce qui la sort vraiment de la
   * réservation en ligne, et le pro en est informé par son nom.
   */
  const planifierAttributions = (memberId: string, newServiceIds: string[]): PlanAttributions => {
    const currentServiceIds = getMemberServiceIds(memberId);
    const servicesToAdd = newServiceIds.filter((id) => !currentServiceIds.includes(id));
    const servicesToRemove = currentServiceIds.filter((id) => !newServiceIds.includes(id));

    const ecritures: PlanAttributions['ecritures'] = [];
    const orphelines: string[] = [];

    for (const serviceId of servicesToAdd) {
      const service = services.find((s) => s.id === serviceId);
      if (!service) continue;
      const memberIds = [...new Set([...membresRealisant(service), memberId])];
      ecritures.push({
        serviceId,
        // Réattribuer une prestation restée sans personne la remet en ligne.
        patch: sansPrestataire(service)
          ? { memberIds: [memberId], isActive: true }
          : { memberIds },
      });
    }

    for (const serviceId of servicesToRemove) {
      const service = services.find((s) => s.id === serviceId);
      if (!service) continue;
      const restants = membresRealisant(service).filter((id) => id !== memberId);
      if (restants.length === 0) {
        orphelines.push(service.name);
        ecritures.push({ serviceId, patch: { memberIds: [], isActive: false } });
      } else {
        ecritures.push({ serviceId, patch: { memberIds: restants } });
      }
    }

    return { ecritures, orphelines };
  };

  const appliquerAttributions = async (plan: PlanAttributions) => {
    for (const { serviceId, patch } of plan.ecritures) {
      await catalogService.updateService(provider!.id, serviceId, patch);
    }
    if (plan.orphelines.length > 0) {
      toast.error(
        `Plus personne ne réalise : ${plan.orphelines.join(', ')}. ${
          plan.orphelines.length > 1 ? 'Ces prestations sont retirées' : 'Cette prestation est retirée'
        } de la réservation en ligne.`,
      );
    }
  };

  /**
   * Une case de la matrice ou du panneau. Écriture immédiate, affichage
   * optimiste.
   *
   * Retirer la DERNIÈRE personne n'est plus refusé. Comme une liste de
   * membres vide veut dire « tous ceux que le lieu autorise », on ne peut
   * pas se contenter de la vider : la prestation est désactivée, ce qui la
   * sort réellement de la réservation en ligne. Cocher quelqu'un la
   * remet en ligne.
   */
  const basculerAttribution = async (serviceId: string, memberId: string) => {
    if (!provider) return;
    const service = services.find((s) => s.id === serviceId);
    const membre = members.find((m) => m.id === memberId);
    if (!service || !membre) return;

    const orpheline = sansPrestataire(service);
    // On bascule ce qui est AFFICHÉ, pas le contenu brut du champ : une
    // prestation limitée à un autre lieu apparaît décochée alors que
    // l'identifiant du membre peut figurer dans la liste matérialisée.
    const affichee = orpheline
      ? false
      : membreRealisePrestation(service, memberId, membre.locationId);
    const actuels = orpheline ? [] : membresRealisant(service);
    const nouveaux = affichee
      ? actuels.filter((id) => id !== memberId)
      : [...new Set([...actuels, memberId])];

    let patch: { memberIds: string[]; isActive?: boolean };
    let annonce: string | null = null;
    if (nouveaux.length === 0) {
      patch = { memberIds: [], isActive: false };
      annonce = `« ${service.name} » n’est plus réalisée par personne : elle est retirée de la réservation en ligne.`;
    } else if (orpheline) {
      patch = { memberIds: nouveaux, isActive: true };
      annonce = `« ${service.name} » est de nouveau réservable en ligne.`;
    } else {
      patch = { memberIds: nouveaux };
    }

    const cle = `${serviceId}:${memberId}`;
    const avant = { memberIds: service.memberIds, isActive: service.isActive };
    setEcritures((prev) => new Set(prev).add(cle));
    setServices((prev) =>
      prev.map((s) => (s.id === serviceId ? { ...s, ...patch } : s)),
    );
    try {
      await catalogService.updateService(provider.id, serviceId, patch);
      if (annonce) toast.success(annonce);
    } catch (error) {
      console.error('Attribution error:', error);
      setServices((prev) => prev.map((s) => (s.id === serviceId ? { ...s, ...avant } : s)));
      toast.error('L’attribution n’a pas pu être enregistrée');
    } finally {
      setEcritures((prev) => {
        const suivant = new Set(prev);
        suivant.delete(cle);
        return suivant;
      });
    }
  };

  const handleSave = async (data: MemberFormData) => {
    if (!provider) return;

    try {
      let memberId: string;

      if (selectedMember) {
        // Les attributions sont CALCULÉES ET VALIDÉES avant la première
        // écriture : un refus ne doit pas laisser le nom, la couleur ou le
        // lieu déjà enregistrés pendant que la modale affiche une erreur.
        const plan = planifierAttributions(selectedMember.id, data.serviceIds);

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

        if (selectedMember.locationId !== data.locationId) {
          await memberService.changeLocation(provider.id, memberId, data.locationId);
        }

        await appliquerAttributions(plan);
        toast.success('Membre mis à jour');
      } else {
        const newMember = await memberService.createMember(provider.id, {
          name: data.name,
          email: data.email,
          phone: data.phone,
          color: data.color,
          locationId: data.locationId,
          isDefault: false,
          serviceIds: data.serviceIds,
        });
        memberId = newMember.id;

        if (data.photoFile) {
          try {
            const path = `${storagePaths.memberPhotos(provider.id, memberId)}/${Date.now()}_${data.photoFile.name}`;
            const photoURL = await uploadFile(path, data.photoFile, { contentType: data.photoFile.type });
            await memberService.updatePhoto(provider.id, memberId, photoURL);
          } catch {
            // Non bloquant : le membre existe, la photo repassera.
          }
        }

        await appliquerAttributions(planifierAttributions(memberId, data.serviceIds));
        toast.success('Membre créé');
      }
      await fetchData();
    } catch (error) {
      console.error('Save error:', error);
      throw error;
    }
  };

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

  const handleToggleActive = async (memberId: string, isActive: boolean) => {
    if (!provider) return;

    try {
      if (isActive) {
        if (isAtMemberLimit) {
          toast.error(
            isSoloPlan
              ? 'Passez au plan Studio pour réactiver ce membre'
              : `Limite de ${maxMembers} membres actifs atteinte`,
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
        const membre = members.find((m) => m.id === memberId);
        const resas = await bookingRepository.getByProvider(provider.id);
        const maintenant = new Date();
        const futures = resas.filter(
          (b) =>
            b.memberId === memberId &&
            ['confirmed', 'pending', 'pending_payment'].includes(b.status) &&
            b.datetime > maintenant,
        ).length;
        const desactiver = async () => {
          await memberService.deactivateMember(provider.id, memberId);
          toast.success('Membre désactivé');
          await fetchData();
        };

        if (futures > 0) {
          setConfirmation({
            titre: `Désactiver ${membre?.name ?? 'ce membre'} ?`,
            variante: 'warning',
            libelle: 'Désactiver quand même',
            message: (
              <>
                <p>
                  {futures} rendez-vous à venir {futures > 1 ? 'sont' : 'est'} sur cette personne.
                </p>
                <p className="mt-2">
                  Une fois désactivée, ces rendez-vous restent valides mais{' '}
                  <strong>ne bloquent plus les créneaux de vos autres membres</strong>. Des
                  clientes pourraient réserver par-dessus.
                </p>
                <p className="mt-2">Réattribuez-les d’abord depuis le planning, si possible.</p>
              </>
            ),
            agir: desactiver,
          });
          return;
        }
        await desactiver();
        return;
      }
      await fetchData();
    } catch (error) {
      console.error('Toggle active error:', error);
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const handleRegenerateCode = async (memberId: string): Promise<string> => {
    if (!provider) throw new Error('Provider not found');
    const newCode = await memberService.regenerateAccessCode(provider.id, memberId);
    await fetchData();
    return newCode;
  };

  const handleSendCode = async (memberId: string) => {
    if (!provider) return;
    const member = members.find((m) => m.id === memberId);
    if (!member) return;

    try {
      const response = await fetch('/api/send-member-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
        throw new Error(error.message || "Erreur lors de l'envoi");
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

  const chiffres = [
    {
      icone: Building2,
      libelle: 'Lieux',
      valeur: locations.filter((l) => l.isActive).length,
      note: groupes.filter((g) => g.lieu && g.membres.some((m) => m.isActive)).length + ' avec équipe',
    },
    {
      icone: Users,
      libelle: 'Prestataires',
      valeur: activeMembers.length,
      note: `${nbPrets} prêt${nbPrets > 1 ? 's' : ''} à réserver`,
    },
    {
      icone: Tag,
      libelle: 'Prestations',
      valeur: services.filter((s) => s.isActive !== false).length,
      note: 'au catalogue',
    },
    {
      icone: CalendarCheck,
      libelle: 'Créneaux',
      valeur: creneauxTotal,
      note: 'cette semaine',
    },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Votre organisation</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Vos lieux, votre équipe et ce que chacun peut réserver
          </p>
        </div>

        <div className="flex flex-col items-start sm:items-end gap-1">
          <Button onClick={() => handleOpenCreate()}>
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

      {members.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700">
          <Users className="w-12 h-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Aucun membre</h3>
          <p className="text-gray-500 dark:text-gray-400 text-center max-w-md">
            Ajoutez votre premier membre pour gérer plusieurs agendas et permettre à votre équipe
            d’accéder à leur planning.
          </p>
          <Button onClick={() => handleOpenCreate()} className="mt-6">
            <Plus className="w-4 h-4 mr-2" />
            Ajouter un membre
          </Button>
        </div>
      ) : (
        <>
          {/* Les quatre chiffres qui résument la configuration. */}
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-gray-200 bg-gray-200 lg:grid-cols-4 dark:border-gray-700 dark:bg-gray-700">
            {chiffres.map((c) => (
              <div key={c.libelle} className="min-w-0 bg-white px-3 py-2.5 sm:px-4 sm:py-3 dark:bg-gray-800">
                <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-gray-500 sm:text-xs dark:text-gray-400">
                  <c.icone className="h-3.5 w-3.5 flex-none text-primary-500" />
                  <span className="truncate">{c.libelle}</span>
                </div>
                <div className="mt-0.5 flex items-baseline gap-1.5 sm:mt-1 sm:gap-2">
                  <span className="text-lg font-semibold text-gray-900 sm:text-xl dark:text-white">
                    {c.valeur}
                  </span>
                  <span className="truncate text-[11px] text-gray-500 sm:text-xs dark:text-gray-400">
                    {c.note}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Ce qui empêche des rendez-vous d'exister, et le bouton qui répare. */}
          {aVerifier.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-warning-200 bg-warning-50/50 dark:border-warning-900 dark:bg-warning-950/10">
              <div className="flex items-center gap-2 px-4 pt-3.5">
                <AlertTriangle className="h-4 w-4 text-warning-600 dark:text-warning-400" />
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {aVerifier.length} point{aVerifier.length > 1 ? 's' : ''} à régler avant que les
                  clientes puissent réserver
                </p>
              </div>
              <div className="mt-2 space-y-px px-4 pb-4">
                {aVerifier.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col gap-2 rounded-lg bg-white px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between dark:bg-gray-800"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{item.titre}</p>
                      <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{item.detail}</p>
                    </div>
                    <button
                      type="button"
                      onClick={item.faire}
                      className="inline-flex flex-shrink-0 items-center gap-1 self-start rounded-lg border border-warning-300 px-3 py-1.5 text-xs font-semibold text-warning-800 hover:bg-warning-50 sm:self-auto dark:border-warning-800 dark:text-warning-300 dark:hover:bg-warning-950/30"
                    >
                      {item.action}
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {aVerifier.length === 0 && (
            <div className="flex items-center gap-2 rounded-xl border border-success-200 bg-success-50/60 px-4 py-3 dark:border-success-900 dark:bg-success-950/10">
              <CheckCircle2 className="h-4 w-4 flex-none text-success-600 dark:text-success-400" />
              <p className="text-sm text-success-800 dark:text-success-300">
                Toute votre équipe peut recevoir des réservations.
              </p>
            </div>
          )}

          {/* Deux façons de regarder la même chose : par lieu, ou par prestation. */}
          {/* Deux façons de regarder la même chose. Pleine largeur : c'est
              le choix structurant de la page, il doit se voir. */}
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-gray-100 p-1 dark:bg-gray-800">
            {(
              [
                {
                  cle: 'organisation' as const,
                  icone: Building2,
                  titre: 'Par lieu',
                  detail: 'Qui travaille où',
                },
                {
                  cle: 'affectations' as const,
                  icone: Grid3X3,
                  titre: 'Qui fait quoi',
                  detail: 'Prestations par personne',
                },
              ]
            ).map((o) => (
              <button
                key={o.cle}
                type="button"
                onClick={() => setVue(o.cle)}
                aria-pressed={vue === o.cle}
                className={`flex items-center justify-center gap-2.5 rounded-lg px-3 py-2.5 transition-colors ${
                  vue === o.cle
                    ? 'bg-white shadow-sm dark:bg-gray-700'
                    : 'hover:bg-white/60 dark:hover:bg-gray-700/50'
                }`}
              >
                <o.icone
                  className={`h-5 w-5 flex-none ${
                    vue === o.cle
                      ? 'text-primary-600 dark:text-primary-400'
                      : 'text-gray-400 dark:text-gray-500'
                  }`}
                />
                <span className="min-w-0 text-left">
                  <span
                    className={`block truncate text-sm font-semibold ${
                      vue === o.cle
                        ? 'text-gray-900 dark:text-white'
                        : 'text-gray-600 dark:text-gray-300'
                    }`}
                  >
                    {o.titre}
                  </span>
                  <span className="hidden truncate text-xs text-gray-500 sm:block dark:text-gray-400">
                    {o.detail}
                  </span>
                </span>
              </button>
            ))}
          </div>

          {/* `min-w-0` sur les colonnes : sans lui une colonne de grille
              garde `min-width: auto`, déborde de la largeur du téléphone et
              se fait COUPER — l'interrupteur et le chevron disparaissaient. */}
          <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_380px] xl:items-start">
          {vue === 'organisation' ? (
            <div className="min-w-0 space-y-3">
              {groupes.map((g) => {
                const cle = g.lieu?.id ?? 'sans-lieu';
                const actifs = g.membres.filter((m) => m.isActive);
                return (
                  <LieuSection
                    key={cle}
                    lieu={g.lieu}
                    nbMembres={g.membres.length}
                    nbPrets={actifs.filter((m) => etats.get(m.id)?.reservable).length}
                    ouvert={!lieuxReplies.includes(cle)}
                    onBasculer={() =>
                      setLieuxReplies((prev) =>
                        prev.includes(cle) ? prev.filter((id) => id !== cle) : [...prev, cle],
                      )
                    }
                    onAjouter={g.lieu ? () => handleOpenCreate(g.lieu!.id) : undefined}
                    deplacables={g.lieu ? deplacablesVers(g.lieu.id) : []}
                    onDeplacerIci={
                      g.lieu ? (memberId) => demanderDeplacement(memberId, g.lieu!.id) : undefined
                    }
                  >
                    {trier(g.membres).map((member) => (
                      <MemberCard
                        key={member.id}
                        member={member}
                        locations={locations}
                        services={services}
                        etat={etats.get(member.id)}
                        creneaux={creneaux[member.id] ?? null}
                        resumeHoraires={resumerHoraires(horairesActuels, member.id)}
                        masquerLieu
                        memberServiceIds={getMemberServiceIds(member.id)}
                        selectionne={member.id === selectionId}
                        onToggleActive={handleToggleActive}
                        onClick={() => selectionner(member.id)}
                        onCorriger={() => selectionner(member.id)}
                      />
                    ))}
                  </LieuSection>
                );
              })}
            </div>
          ) : (
            <div className="min-w-0">
            <AffectationsMatrice
              services={services}
              groupes={groupes.map((g) => ({ ...g, membres: trier(g.membres.filter((m) => m.isActive)) }))}
              onBasculer={basculerAttribution}
              enCours={ecritures}
              membreSelectionneId={selectionId}
              onSelectionnerMembre={setSelectionId}
              onModifierPrestation={(serviceId) =>
                router.push(`/pro/activite/prestations/${serviceId}`)
              }
              deplacablesVers={deplacablesVers}
              onAjouterA={handleOpenCreate}
              onDeplacerVers={demanderDeplacement}
            />
            </div>
          )}

            {/* Tout ce qu'on peut corriger sur une personne, sans quitter
                la page ni ouvrir de modale. */}
            <div ref={panneauRef} className="min-w-0 xl:sticky xl:top-4">
              {membreSelectionne ? (
                <MembrePanneau
                  membre={membreSelectionne}
                  lieux={locations.filter((l) => l.isActive)}
                  services={services}
                  etat={etats.get(membreSelectionne.id)}
                  creneaux={creneaux[membreSelectionne.id] ?? null}
                  resumeHoraires={resumerHoraires(horairesActuels, membreSelectionne.id)}
                  sources={sourcesHoraires(membreSelectionne.id)}
                  cibles={ciblesHoraires(membreSelectionne.id)}
                  enCours={ecritures}
                  copieEnCours={copieEnCours}
                  changementLieuEnCours={changementLieuEnCours}
                  onBasculerPrestation={basculerAttribution}
                  onChangerLieu={async (id, lieuId) => {
                    // La confirmation porte l'attente : ici on rend la main
                    // aussitôt pour que le select se rétablisse.
                    demanderDeplacement(id, lieuId);
                  }}
                  onCopierHoraires={copierHoraires}
                  onCopierVers={copierVers}
                  onBasculerActif={handleToggleActive}
                  onOuvrirFiche={() => handleOpenEdit(membreSelectionne)}
                  onDefinirHoraires={() => router.push('/pro/activite?tab=disponibilites')}
                />
              ) : null}
            </div>
          </div>
        </>
      )}

      <MemberModal
        isOpen={modalOpen}
        onClose={handleCloseModal}
        member={selectedMember}
        locations={locations}
        services={services}
        memberServiceIds={selectedMemberServiceIds}
        lieuParDefaut={lieuParDefaut}
        onSave={handleSave}
        estMembreSupplementaire={!selectedMember && members.length >= 1}
        onDelete={handleDelete}
        onRegenerateCode={handleRegenerateCode}
        onSendCode={handleSendCode}
        upcomingBookingsCount={upcomingBookingsCount}
      />

      <UpgradeTeamModal
        isOpen={upgradeModalOpen}
        onClose={() => setUpgradeModalOpen(false)}
        context="members"
      />

      <ConfirmDialog
        isOpen={confirmation !== null}
        onClose={() => setConfirmation(null)}
        title={confirmation?.titre ?? ''}
        message={confirmation?.message ?? ''}
        confirmLabel={confirmation?.libelle}
        variant={confirmation?.variante ?? 'warning'}
        loading={confirmationEnCours}
        onConfirm={async () => {
          if (!confirmation) return;
          setConfirmationEnCours(true);
          try {
            await confirmation.agir();
            setConfirmation(null);
          } catch (error) {
            console.error('Confirm action error:', error);
            toast.error('L’opération a échoué');
          } finally {
            setConfirmationEnCours(false);
          }
        }}
      />
    </div>
  );
}
