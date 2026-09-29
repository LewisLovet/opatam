'use client';

/**
 * BlockPeriodModal — block a multi-day or single-day period directly
 * from the calendar page.
 *
 * For full-blown vacation/team-wide blocking flows, /pro/activite has
 * a richer form with multi-member selection. This modal is the
 * lightweight inline counterpart so the pro can hammer in a
 * "Vacances 1-15 août" without leaving the calendar.
 *
 * Stored as a `blockedSlot` with `category=null` and `title=null` —
 * what differentiates a "blocked period" from an "activity" is the
 * absence of those two fields.
 */

import { useState, useEffect } from 'react';
import {
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
  Textarea,
  useToast,
} from '@/components/ui';
import {
  schedulingService,
  memberService,
  blockedSlotRepository,
} from '@booking-app/firebase';
import {
  isBlockedPeriodValid,
  genererOccurrences,
  horlogeDuFuseau,
  fuseauxDistincts,
  periodeDepuisSaisie,
  saisieDepuisPeriode,
  type SaisieMurale,
} from '@booking-app/shared';
import type { Member, Booking, BlockedSlot, BlockedSlotInput } from '@booking-app/shared';
import {
  RecurrenceFields,
  ChoixPortee,
  AvertissementConflits,
  brouillonDepuisRegle,
  regleAEnregistrer,
  type RecurrenceDraft,
} from './RecurrenceFields';
import { useFuseauxMembres } from './useFuseauxMembres';
import { Loader2, Ban, Sun } from 'lucide-react';

type WithId<T> = { id: string } & T;

/** Les motifs les plus fréquents — les mêmes que sur l'application mobile. */
const MOTIFS = ['Vacances', 'Formation', 'Maladie', 'Personnel', 'Férié', 'Réunion'];

function formatDateInput(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}



interface BlockPeriodModalProps {
  isOpen: boolean;
  onClose: () => void;
  providerId: string;
  /** ID of an existing blockedSlot when editing, undefined when creating. */
  editId?: string;
  initialDate?: Date;
  initialEndDate?: Date;
  /** Pre-fill with a contiguous time range (e.g. drag-selected
   *  block on the calendar). When provided the modal opens in
   *  single-day mode with the times locked to the selection. */
  initialStartTime?: string;
  initialEndTime?: string;
  initialMemberId?: string;
  onSaved?: () => void;
}

/** « 2026-08-18 » → « 18 août ». Sert uniquement aux phrases explicatives. */
function formatDayLabel(isoDay: string): string {
  const [y, m, d] = isoDay.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
  });
}

export function BlockPeriodModal({
  isOpen,
  onClose,
  providerId,
  editId,
  initialDate,
  initialEndDate,
  initialStartTime,
  initialEndTime,
  initialMemberId,
  onSaved,
}: BlockPeriodModalProps) {
  const isEditing = !!editId;
  const toast = useToast();

  const [members, setMembers] = useState<WithId<Member>[]>([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);

  const today = initialDate ?? new Date();
  const [startDate, setStartDate] = useState(formatDateInput(today));
  const [endDate, setEndDate] = useState(
    formatDateInput(initialEndDate ?? today),
  );
  const [allDay, setAllDay] = useState(!initialStartTime && !initialEndTime);
  /**
   * Comment lire les heures quand la période couvre plusieurs jours. Deux
   * intentions très différentes se saisissaient jusqu'ici de la même façon —
   * un départ en congés et une fermeture quotidienne — sans que rien ne les
   * distingue à l'écran ni en base.
   */
  const [spanMode, setSpanMode] = useState<'continuous' | 'daily'>('continuous');
  const [startTime, setStartTime] = useState(initialStartTime ?? '09:00');
  const [endTime, setEndTime] = useState(initialEndTime ?? '18:00');
  const [reason, setReason] = useState('');
  /** Répétition saisie ; `null` = période isolée. */
  const [recurrence, setRecurrence] = useState<RecurrenceDraft | null>(null);
  /** En édition : la série dont la période fait partie, et son début — pour « celle-ci et les suivantes ». */
  const [existingSeriesId, setExistingSeriesId] = useState<string | null>(null);
  const [existingStart, setExistingStart] = useState<Date | null>(null);
  /** Question posée en pied de modale quand la période est en série. */
  const [portee, setPortee] = useState<'enregistrer' | 'supprimer' | null>(null);
  /**
   * La portée RETENUE par le professionnel (« celle-ci » / « celle-ci et les
   * suivantes »). Distincte de `portee`, qui ne dit que QUELLE question est
   * posée et retombe à `null` dès qu'elle a été répondue : la déduire de
   * `portee` au moment de confirmer un conflit ramenait silencieusement à
   * « cette occurrence seulement ».
   */
  const [porteeRetenue, setPorteeRetenue] = useState<'cette' | 'suivantes'>('cette');
  /** Rendez-vous recouverts, montrés avant d'écrire ; `null` = pas encore regardé. */
  const [conflits, setConflits] = useState<WithId<Booking>[] | null>(null);
  /**
   * En édition : le document lu, en attente de SON fuseau pour remplir le
   * formulaire. Le lire avec les getters de l'appareil affichait 18:00 pour
   * une période à 09:00 à Los Angeles vue depuis Paris — et « Enregistrer »
   * sans rien toucher la déplaçait à 18:00 là-bas.
   */
  const [aHydrater, setAHydrater] = useState<BlockedSlot | null>(null);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  /**
   * Période invalide, recalculée à chaque frappe — et non plus au clic.
   *
   * Deux raisons de la remonter en amont. D'abord parce qu'un refus qui
   * n'arrive qu'au moment d'enregistrer laisse le professionnel composer
   * tranquillement une saisie impossible ; le bouton doit être éteint pendant
   * qu'il la compose. Ensuite parce que le message peut alors NOMMER le cas :
   * même journée et répétition quotidienne interdisent l'inversion pour des
   * raisons différentes, et la seconde est la moins évidente des deux.
   *
   * `spanMode` manquait à l'appel de `isBlockedPeriodValid` : sur plusieurs
   * jours le validateur concluait « départ et retour », donc valide, alors
   * même que le professionnel venait de choisir « tous les jours ». Une
   * tranche 18:00 → 09:00 répétée quotidiennement s'enregistrait sans un mot
   * et ne bloquait RIEN — exactement la panne silencieuse qu'on venait de
   * corriger dans le moteur.
   */
  const sameDay = startDate === endDate;
  const periodError: string | null = isBlockedPeriodValid({
    allDay,
    sameDay,
    startTime,
    endTime,
    spanMode,
  })
    ? null
    : sameDay
      ? "Sur une même journée, l'heure de fin doit être après l'heure de début."
      : "En répétition quotidienne, l'heure de fin doit être après l'heure de début.";

  // Reset whenever the modal opens. In edit mode we hydrate from the
  // existing blockedSlot doc; otherwise we fall back to the create
  // defaults derived from the props.
  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    let cancelled = false;
    (async () => {
      try {
        const result = (await memberService.getByProvider(providerId)) as WithId<Member>[];
        const activeMembers = result.filter((m) => m.isActive);
        if (cancelled) return;
        setMembers(activeMembers);

        if (editId) {
          // Edit mode — pull the existing doc and pre-fill the form.
          const existing = await blockedSlotRepository.getById(providerId, editId);
          if (cancelled) return;
          if (!existing) {
            toast.error('Période introuvable');
            onClose();
            return;
          }
          setSelectedMemberIds([existing.memberId]);
          setAllDay(existing.allDay);
          setSpanMode(existing.spanMode === 'daily' ? 'daily' : 'continuous');
          setReason(existing.reason ?? '');
          setExistingSeriesId(existing.seriesId ?? null);
          // L'instant ENREGISTRÉ, tel quel : c'est la borne de « celle-ci et
          // les suivantes », comparée aux instants stockés de la série.
          setExistingStart(new Date(existing.startDate.getTime()));
          // Jours et heures attendent le fuseau du lieu (voir `aHydrater`).
          setAHydrater(existing);
          setRecurrence(existing.recurrence ? brouillonDepuisRegle(existing.recurrence) : null);
          setPortee(null);
          setConflits(null);
          return;
        }

        // Create mode — pre-select either the requested member or,
        // by default, all (pros usually want a vacation to apply
        // across the team).
        if (initialMemberId) {
          setSelectedMemberIds([initialMemberId]);
        } else {
          setSelectedMemberIds(activeMembers.map((m) => m.id));
        }
        setStartDate(formatDateInput(initialDate ?? new Date()));
        setEndDate(formatDateInput(initialEndDate ?? initialDate ?? new Date()));
        setAllDay(!initialStartTime && !initialEndTime);
        // La modale n'est pas démontée entre deux ouvertures : sans cette
        // remise à zéro, le mode restait celui de la dernière ÉDITION. Après
        // avoir ouvert une fermeture quotidienne, la période suivante partait
        // en quotidien — un défaut que rien n'annonce, puisque le choix ne
        // s'affiche qu'une fois la période étalée sur plusieurs jours.
        setSpanMode('continuous');
        setAHydrater(null);
        setStartTime(initialStartTime ?? '09:00');
        setEndTime(initialEndTime ?? '18:00');
        setReason('');
        setRecurrence(null);
        setExistingSeriesId(null);
        setExistingStart(null);
        setPortee(null);
        setConflits(null);
      } catch (err) {
        console.error('[BlockPeriodModal] load failed:', err);
        toast.error('Impossible de charger les données');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, providerId, editId]);

  /**
   * Le fuseau de CHAQUE membre visé. Tant qu'un seul manque, rien ne part :
   * « lecture en cours » et « lieu sans fuseau » ne se confondent plus.
   */
  const { pret: fuseauxPrets, fuseaux } = useFuseauxMembres(providerId, selectedMemberIds, isOpen);

  // Édition : remplir le formulaire une fois le fuseau du membre CONNU, en
  // jours et heures murales DE SON LIEU.
  useEffect(() => {
    if (!aHydrater || !fuseauxPrets) return;
    const lu = saisieDepuisPeriode(aHydrater, fuseaux[aHydrater.memberId]);
    setStartDate(lu.jourDebut);
    setEndDate(lu.jourFin);
    // Journée entière : les heures sont sans objet, on garde les valeurs
    // proposées par défaut si l'on décoche.
    setStartTime(aHydrater.allDay ? '09:00' : lu.heureDebut);
    setEndTime(aHydrater.allDay ? '18:00' : lu.heureFin);
    setAHydrater(null);
  }, [aHydrater, fuseauxPrets, fuseaux]);

  /** Premier membre visé : celui que décrit l'aperçu de répétition. */
  const premier = selectedMemberIds[0];
  const fuseauApercu = premier ? fuseaux[premier] ?? undefined : undefined;
  /** Plusieurs fuseaux : l'heure saisie vaut dans CHAQUE lieu — on le dit. */
  const plusieursFuseaux = fuseauxDistincts(selectedMemberIds, fuseaux).length > 1;

  const allSelected =
    members.length > 0 && selectedMemberIds.length === members.length;

  const toggleMember = (id: string) => {
    setSelectedMemberIds((prev) =>
      prev.includes(id) ? prev.filter((mid) => mid !== id) : [...prev, id],
    );
  };

  const toggleAll = () => {
    setSelectedMemberIds(allSelected ? [] : members.map((m) => m.id));
  };

  /** Ce que le formulaire SAISIT : des jours et des heures murales, sans fuseau. */
  const saisieMurale = (): SaisieMurale => ({
    jourDebut: startDate,
    jourFin: endDate,
    heureDebut: startTime,
    heureFin: endTime,
    allDay,
  });

  /**
   * La période d'UN membre : la saisie résolue dans le fuseau de SON lieu.
   * « 09:00 » vaut 09:00 à Paris pour l'un, 09:00 à New York pour l'autre.
   */
  const periodePour = (memberId: string) =>
    periodeDepuisSaisie(saisieMurale(), fuseaux[memberId]);

  /** Contrôles communs à tous les membres ; `false` + toast si la saisie est irrecevable. */
  const saisieValide = (): boolean => {
    // Ordre des JOURS d'abord — indépendant des heures, et seul cas où
    // comparer les dates a un sens.
    if (endDate < startDate) {
      toast.error('La date de fin doit être après le début');
      return false;
    }
    // Puis la règle horaire PARTAGÉE, la même que le service et que
    // l'écran mobile. Garde de dernier recours : le bouton est déjà éteint.
    if (periodError) {
      toast.error(periodError);
      return false;
    }
    return true;
  };

  /** L'entrée du service pour UN membre : sa période, sa règle, dans son fuseau. */
  const inputPour = (member: WithId<Member>): BlockedSlotInput => {
    const p = periodePour(member.id);
    const fuseau = fuseaux[member.id] ?? undefined;
    return {
      memberId: member.id,
      locationId: member.locationId,
      startDate: p.startDate,
      endDate: p.endDate,
      allDay,
      startTime: allDay ? null : startTime,
      endTime: allDay ? null : endTime,
      spanMode,
      reason: reason.trim() || null,
      recurrence: recurrence ? regleAEnregistrer(recurrence, p, fuseau) : null,
    };
  };

  /**
   * Les périodes réellement écrites pour CE membre. « Cette occurrence
   * seulement » n'en écrit qu'UNE : déplier toute la série pour chercher des
   * conflits signalait des rendez-vous qu'on n'allait même pas toucher.
   */
  const periodesAEcrire = (member: WithId<Member>, quoi: 'cette' | 'suivantes') => {
    const input = inputPour(member);
    const base = { startDate: input.startDate, endDate: input.endDate };
    const serie = input.recurrence && !(isEditing && existingSeriesId && quoi === 'cette');
    const dates = serie
      ? genererOccurrences(base, input.recurrence!, horlogeDuFuseau(fuseaux[member.id]))
      : [base];
    return dates.map((d) => ({
      ...d,
      allDay,
      startTime: allDay ? null : startTime,
      endTime: allDay ? null : endTime,
      spanMode,
    }));
  };

  const handleSave = () => {
    if (selectedMemberIds.length === 0) {
      toast.error('Sélectionnez au moins un membre');
      return;
    }
    // Garde de dernier recours : le bouton est déjà éteint pendant la lecture.
    if (!fuseauxPrets) return;
    if (!saisieValide()) return;
    // En série, la question de la portée vient AVANT tout le reste.
    if (isEditing && existingSeriesId) {
      setPortee('enregistrer');
      return;
    }
    void enregistrer('cette', false);
  };

  /**
   * Écrit, dans cet ordre : prévenir des rendez-vous recouverts (une fois),
   * puis modifier cette occurrence / réécrire la suite de la série / créer.
   */
  const enregistrer = async (quoi: 'cette' | 'suivantes', ignorerConflits: boolean) => {
    setPorteeRetenue(quoi);
    if (!fuseauxPrets || !saisieValide()) return;
    const targets = isEditing
      ? members.filter((m) => m.id === selectedMemberIds[0])
      : members.filter((m) => selectedMemberIds.includes(m.id));
    if (targets.length === 0) {
      toast.error('Membre introuvable');
      return;
    }
    setSaving(true);
    try {
      // 1. Les rendez-vous que ces périodes recouvriraient. On prévient,
      //    on n'annule rien — et on ne pose la question qu'une fois.
      if (!ignorerConflits) {
        // Chaque membre confronté à SES périodes — pas à celles du premier.
        const periodesParMembre = Object.fromEntries(
          targets.map((m) => [m.id, periodesAEcrire(m, quoi)]),
        );
        const parMembre = await schedulingService.rendezVousRecouvertsParMembre(
          providerId,
          periodesParMembre,
        );
        const touches = [...parMembre.values()].flat();
        if (touches.length > 0) {
          setConflits(touches);
          return;
        }
      }
      setConflits(null);

      if (isEditing && editId) {
        const member = targets[0];
        const input = inputPour(member);
        if (quoi === 'suivantes' && existingSeriesId && existingStart) {
          // 2a. Réécrire la suite de la série depuis cette occurrence ; sans
          //     règle, c'est « arrêter la répétition ici ».
          await schedulingService.updateSeriesFrom(providerId, existingSeriesId, existingStart, input);
          toast.success('Cette occurrence et les suivantes ont été modifiées');
        } else if (!existingSeriesId && input.recurrence) {
          // 2b. Une période isolée devient une série. En UNE écriture :
          //     supprimer d'abord, créer ensuite, c'était perdre l'original
          //     si la création échouait — et rouvrir le créneau en silence.
          await schedulingService.convertirEnSerie(providerId, editId, input);
          toast.success('Période répétée');
        } else {
          // 2c. Cette occurrence seulement — la règle copiée sur le document
          //     ne bouge pas, l'occurrence reste dans sa série.
          await blockedSlotRepository.update(providerId, editId, {
            memberId: member.id,
            locationId: member.locationId,
            startDate: input.startDate,
            endDate: input.endDate,
            allDay,
            startTime: allDay ? null : startTime,
            endTime: allDay ? null : endTime,
            spanMode,
            reason: reason.trim() || null,
          });
          toast.success('Période modifiée');
        }
      } else {
        // 3. Création : une période — ou une série — par membre, chacune
        //    construite dans le fuseau de SON lieu.
        await Promise.all(
          targets.map((member) => {
            const input = inputPour(member);
            return input.recurrence
              ? schedulingService.blockPeriodRecurrent(providerId, input)
              : schedulingService.blockPeriod(providerId, input);
          }),
        );
        const combien = targets.length > 1 ? ` pour ${targets.length} membres` : '';
        toast.success(recurrence ? `Période répétée${combien}` : `Période bloquée${combien}`);
      }
      onSaved?.();
      onClose();
    } catch (err) {
      console.error('[BlockPeriodModal] save failed:', err);
      toast.error(err instanceof Error ? err.message : 'Impossible de bloquer');
    } finally {
      setSaving(false);
      setPortee(null);
    }
  };

  const handleDelete = () => {
    if (!editId) return;
    if (existingSeriesId) {
      setPortee('supprimer');
      return;
    }
    if (!confirm('Supprimer cette période ?')) return;
    void supprimer('cette');
  };

  const supprimer = async (quoi: 'cette' | 'suivantes') => {
    if (!editId) return;
    setDeleting(true);
    try {
      if (quoi === 'suivantes' && existingSeriesId && existingStart) {
        const n = await schedulingService.unblockSeries(providerId, existingSeriesId, existingStart);
        toast.success(n > 1 ? `${n} périodes supprimées` : 'Période supprimée');
      } else {
        await schedulingService.unblockPeriod(providerId, editId);
        toast.success('Période supprimée');
      }
      onSaved?.();
      onClose();
    } catch (err) {
      console.error('[BlockPeriodModal] delete failed:', err);
      toast.error('Impossible de supprimer');
    } finally {
      setDeleting(false);
      setPortee(null);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-md">
      <ModalHeader
        title={isEditing ? 'Modifier la période' : 'Bloquer une période'}
        onClose={onClose}
      />
      <ModalBody className="space-y-5">
        {loading || aHydrater ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
          </div>
        ) : (
          <>
            {/* Members */}
            {members.length > 1 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Pour quel(s) membre(s) ?
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={toggleAll}
                    className={`
                      px-3 py-1.5 rounded-full text-sm font-medium border transition-colors
                      ${allSelected
                        ? 'bg-primary-500 text-white border-primary-500'
                        : 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-100'}
                    `}
                  >
                    Tous
                  </button>
                  {members.map((m) => {
                    const isSelected = selectedMemberIds.includes(m.id);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => toggleMember(m.id)}
                        className={`
                          px-3 py-1.5 rounded-full text-sm font-medium border transition-colors
                          ${isSelected
                            ? 'bg-primary-500 text-white border-primary-500'
                            : 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-100'}
                        `}
                      >
                        {m.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Journée entière — même interrupteur que « Répéter », plus bas. */}
            <div className="flex items-center gap-3 rounded-2xl border border-gray-200 px-4 py-3 dark:border-gray-700">
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors ${
                  allDay ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-500 dark:bg-gray-800'
                }`}
              >
                <Sun className="h-[18px] w-[18px]" />
              </span>
              <span className="flex-1">
                <span className="block text-sm font-semibold text-gray-900 dark:text-white">Toute la journée</span>
                <span className="block text-xs text-gray-500 dark:text-gray-400">
                  {allDay ? 'Aucune réservation possible ces jours-là' : 'Seulement sur les heures choisies'}
                </span>
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={allDay}
                aria-label="Toute la journée"
                onClick={() => setAllDay(!allDay)}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 ${
                  allDay ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${allDay ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
              </button>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Du"
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  if (e.target.value > endDate) setEndDate(e.target.value);
                }}
                required
              />
              <Input
                label="Au"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
              />
            </div>

            {/* Times when not all-day */}
            {!allDay && (
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Début"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
                <Input
                  label="Fin"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
            )}

            {/* Lecture des heures — n'apparaît QUE si la période couvre
                plusieurs jours. Sur un seul jour les deux lectures donnent le
                même résultat, et poser la question n'ajouterait que du doute. */}
            {!allDay && endDate > startDate && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Sur cette période, ces heures signifient
                </p>
                {(
                  [
                    {
                      value: 'continuous' as const,
                      titre: 'Une absence continue',
                      detail: `Du ${formatDayLabel(startDate)} à ${startTime} jusqu'au ${formatDayLabel(endDate)} à ${endTime}, sans interruption — nuits et journées entières comprises.`,
                    },
                    {
                      value: 'daily' as const,
                      titre: 'Tous les jours, à ces heures',
                      detail: `De ${startTime} à ${endTime} chaque jour, du ${formatDayLabel(startDate)} au ${formatDayLabel(endDate)}. Le reste de la journée reste réservable.`,
                    },
                  ]
                ).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setSpanMode(opt.value)}
                    aria-pressed={spanMode === opt.value}
                    className={`w-full text-left rounded-xl border p-3 transition-colors ${
                      spanMode === opt.value
                        ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-400'
                    }`}
                  >
                    <span className="block text-sm font-semibold text-gray-900 dark:text-white">
                      {opt.titre}
                    </span>
                    <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {opt.detail}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {fuseauxPrets && premier && (
              <RecurrenceFields
                value={recurrence}
                onChange={setRecurrence}
                baseStart={periodePour(premier).startDate}
                baseEnd={periodePour(premier).endDate}
                fuseau={fuseauApercu}
                enSerie={!!existingSeriesId}
                disabled={saving || deleting}
              />
            )}
            {plusieursFuseaux && (
              <p className="rounded-lg bg-blue-50 dark:bg-blue-900/20 px-3 py-2 text-xs text-blue-800 dark:text-blue-200">
                Les membres choisis travaillent dans des fuseaux différents : les heures
                saisies s’appliquent à l’heure locale de chaque lieu.
              </p>
            )}
            {periodError && (
              <p
                role="alert"
                className="rounded-lg bg-red-50 dark:bg-red-900/20 px-3 py-2 text-sm text-red-700 dark:text-red-300"
              >
                {periodError}
              </p>
            )}

            {/* Motif — les plus courants en un clic, ou du texte libre. */}
            <div>
              <p className="mb-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">Motif (optionnel)</p>
              <div className="mb-2 flex flex-wrap gap-1.5">
                {MOTIFS.map((m) => {
                  const actif = reason.trim() === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setReason(actif ? '' : m)}
                      aria-pressed={actif}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                        actif
                          ? 'bg-primary-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
                      }`}
                    >
                      {m}
                    </button>
                  );
                })}
              </div>
              <Textarea
                placeholder="Ou précisez : congés d'été, salon professionnel…"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                maxLength={200}
              />
            </div>
          </>
        )}
      </ModalBody>
      <ModalFooter>
        {conflits ? (
          <AvertissementConflits
            bookings={conflits}
            verbe={isEditing ? 'Enregistrer' : 'Bloquer'}
            occupe={saving}
            onConfirmer={() => void enregistrer(porteeRetenue, true)}
            onAnnuler={() => { setConflits(null); setPortee(null); }}
          />
        ) : portee ? (
          <ChoixPortee
            action={portee}
            occupe={saving || deleting}
            onCette={() => (portee === 'supprimer' ? void supprimer('cette') : void enregistrer('cette', false))}
            onSuivantes={() => (portee === 'supprimer' ? void supprimer('suivantes') : void enregistrer('suivantes', false))}
            onAnnuler={() => setPortee(null)}
          />
        ) : (
        <div className="flex items-center justify-between gap-2 w-full">
          {isEditing ? (
            <Button
              variant="ghost"
              onClick={handleDelete}
              disabled={deleting || saving}
              className="text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Supprimer'}
            </Button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onClose} disabled={saving || deleting}>
              Annuler
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || deleting || loading || !!aHydrater || !fuseauxPrets || periodError !== null}
            >
              {saving ? (
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
              ) : (
                <Ban className="w-4 h-4 mr-1.5" />
              )}
              {isEditing ? 'Enregistrer' : 'Bloquer'}
            </Button>
          </div>
        </div>
        )}
      </ModalFooter>
    </Modal>
  );
}
