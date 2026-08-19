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
import { isBlockedPeriodValid } from '@booking-app/shared';
import type { Member } from '@booking-app/shared';
import { Loader2, Ban } from 'lucide-react';

type WithId<T> = { id: string } & T;

function formatDateInput(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function formatTimeInput(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function combine(date: string, time: string): Date {
  const [y, m, day] = date.split('-').map(Number);
  const [h, min] = time.split(':').map(Number);
  return new Date(y, m - 1, day, h, min, 0, 0);
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
      : "En répétition quotidienne, l'heure de fin doit être après l'heure de début : sinon la tranche est vide et plus rien n'est bloqué. Choisissez « Une absence continue » pour partir le soir et revenir le matin.";

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
          const startDt =
            existing.startDate instanceof Date
              ? existing.startDate
              : (existing.startDate as any).toDate();
          const endDt =
            existing.endDate instanceof Date
              ? existing.endDate
              : (existing.endDate as any).toDate();
          setSelectedMemberIds([existing.memberId]);
          setStartDate(formatDateInput(startDt));
          setEndDate(formatDateInput(endDt));
          setAllDay(existing.allDay);
          setSpanMode(existing.spanMode === 'daily' ? 'daily' : 'continuous');
          setStartTime(existing.startTime ?? '09:00');
          setEndTime(existing.endTime ?? '18:00');
          setReason(existing.reason ?? '');
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
        setStartTime(initialStartTime ?? '09:00');
        setEndTime(initialEndTime ?? '18:00');
        setReason('');
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

  const handleSave = async () => {
    if (selectedMemberIds.length === 0) {
      toast.error('Sélectionnez au moins un membre');
      return;
    }
    const startDt = allDay
      ? combine(startDate, '00:00')
      : combine(startDate, startTime);
    const endDt = allDay
      ? combine(endDate, '23:59')
      : combine(endDate, endTime);

    // Ordre des JOURS d'abord — indépendant des heures, et seul cas où
    // comparer les dates a un sens.
    if (endDate < startDate) {
      toast.error('La date de fin doit être après le début');
      return;
    }

    // Puis la règle horaire PARTAGÉE, la même que le service et que
    // l'écran mobile.
    //
    // Comparer `endDt < startDt` ne convenait pas : sur un même jour,
    // « 22:00 → 00:00 » produit une fin à minuit du matin, donc
    // antérieure au début — le web refusait une période pourtant valide,
    // acceptée partout ailleurs. Et l'opérateur strict laissait passer
    // « 14:00 → 14:00 » et « 00:00 → 00:00 », que la création faisait
    // ensuite échouer côté service, mais que l'ÉDITION enregistrait :
    // elle écrit directement via le repository.
    //
    // Placée AVANT les deux branches, la vérification couvre les deux.
    // Garde de dernier recours : le bouton est déjà éteint dans ce cas.
    if (periodError) {
      toast.error(periodError);
      return;
    }

    setSaving(true);
    try {
      if (editId) {
        // Edit path — PATCH the existing doc. We only ever target a
        // single member in edit mode (the doc's owner), so fan-out
        // logic is bypassed.
        const member = members.find((m) => m.id === selectedMemberIds[0]);
        if (!member) {
          toast.error('Membre introuvable');
          return;
        }
        await blockedSlotRepository.update(providerId, editId, {
          memberId: member.id,
          locationId: member.locationId,
          startDate: startDt,
          endDate: endDt,
          allDay,
          startTime: allDay ? null : startTime,
          endTime: allDay ? null : endTime,
          spanMode,
          reason: reason.trim() || null,
        });
        toast.success('Période modifiée');
      } else {
        const targets = members.filter((m) => selectedMemberIds.includes(m.id));
        await Promise.all(
          targets.map((member) =>
            schedulingService.blockPeriod(providerId, {
              memberId: member.id,
              locationId: member.locationId,
              startDate: startDt,
              endDate: endDt,
              allDay,
              isRecurring: false,
              startTime: allDay ? null : startTime,
              endTime: allDay ? null : endTime,
              spanMode,
              reason: reason.trim() || null,
            }),
          ),
        );
        toast.success(
          targets.length > 1
            ? `Période bloquée pour ${targets.length} membres`
            : 'Période bloquée',
        );
      }
      onSaved?.();
      onClose();
    } catch (err) {
      console.error('[BlockPeriodModal] save failed:', err);
      toast.error(
        err instanceof Error ? err.message : 'Impossible de bloquer',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editId) return;
    if (!confirm('Supprimer cette période ?')) return;
    setDeleting(true);
    try {
      await schedulingService.unblockPeriod(providerId, editId);
      toast.success('Période supprimée');
      onSaved?.();
      onClose();
    } catch (err) {
      console.error('[BlockPeriodModal] delete failed:', err);
      toast.error('Impossible de supprimer');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-md">
      <ModalHeader
        title={isEditing ? 'Modifier la période' : 'Bloquer une période'}
        onClose={onClose}
      />
      <ModalBody className="space-y-5">
        {loading ? (
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

            {/* All-day toggle */}
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={allDay}
                onChange={(e) => setAllDay(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Toute la journée
              </span>
            </label>

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

            {periodError && (
              <p
                role="alert"
                className="rounded-lg bg-red-50 dark:bg-red-900/20 px-3 py-2 text-sm text-red-700 dark:text-red-300"
              >
                {periodError}
              </p>
            )}

            {/* Reason */}
            <Textarea
              label="Motif (optionnel)"
              placeholder="ex : Vacances, Formation, Maladie…"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              maxLength={200}
            />
          </>
        )}
      </ModalBody>
      <ModalFooter>
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
              disabled={saving || deleting || loading || periodError !== null}
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
      </ModalFooter>
    </Modal>
  );
}
