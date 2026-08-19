'use client';

import { useState } from 'react';
import {
  Button,
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Input,
  Switch,
} from '@/components/ui';
import { Plus, Trash2, Calendar, Clock, Loader2 } from 'lucide-react';
import { isBlockedPeriodValid } from '@booking-app/shared';
import type { BlockedSlot, Location, Member } from '@booking-app/shared';

type WithId<T> = { id: string } & T;

interface BlockedSlotsSectionProps {
  blockedSlots: WithId<BlockedSlot>[];
  locations: WithId<Location>[];
  members: WithId<Member>[];
  onAdd: (data: BlockedSlotFormData) => Promise<void>;
  onDelete: (slotId: string) => Promise<void>;
  hasTeams?: boolean;
}

// NOUVEAU MODÈLE: memberId et locationId sont obligatoires
export interface BlockedSlotFormData {
  startDate: Date;
  endDate: Date;
  allDay: boolean;
  startTime: string | null;
  endTime: string | null;
  /**
   * Lecture des heures quand la période couvre plusieurs jours. Sans objet
   * en journée entière ou sur un jour unique, où les deux lectures donnent
   * le même résultat. Voir le contrôle dédié dans le formulaire.
   */
  spanMode: 'continuous' | 'daily';
  reason: string | null;
  memberId: string; // Obligatoire
  locationId: string; // Obligatoire (dénormalisé depuis member.locationId)
}

const formatDate = (date: Date): string => {
  return date.toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
  });
};

const formatDateRange = (start: Date, end: Date): string => {
  const startStr = formatDate(start);
  const endStr = formatDate(end);
  if (startStr === endStr) return startStr;
  return `${startStr} - ${endStr}`;
};

/** Clé de jour, identique à celle qu'affichent les champs date du formulaire. */
const toDayKey = (date: Date): string => date.toISOString().split('T')[0];

/** « 18 août ». Sert uniquement aux phrases qui expliquent les deux lectures. */
const formatDayLabel = (date: Date): string =>
  date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });

const formatTimeRange = (startTime: string | null, endTime: string | null): string => {
  if (!startTime || !endTime) return 'Journée entière';
  return `${startTime} - ${endTime}`;
};

export function BlockedSlotsSection({
  blockedSlots,
  locations,
  members,
  onAdd,
  onDelete,
  hasTeams = false,
}: BlockedSlotsSectionProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // NOUVEAU MODÈLE: memberId et locationId sont obligatoires
  // Par défaut, on prend le premier membre (ou le membre par défaut)
  const defaultMember = members.find((m) => m.isDefault) || members[0];

  const getDefaultFormData = (): BlockedSlotFormData => ({
    startDate: new Date(),
    endDate: new Date(),
    allDay: true,
    startTime: null,
    endTime: null,
    spanMode: 'continuous',
    reason: null,
    memberId: defaultMember?.id || '',
    locationId: defaultMember?.locationId || '',
  });

  const [formData, setFormData] = useState<BlockedSlotFormData>(getDefaultFormData());

  /**
   * Période invalide, recalculée à chaque frappe.
   *
   * Ce formulaire ne vérifiait RIEN : une fin antérieure au début partait au
   * service, qui la refusait, et le rejet finissait dans un `console.error`.
   * Le professionnel voyait la modale se fermer sans rien enregistrer.
   *
   * Le message nomme le cas plutôt que d'énoncer la règle : l'inversion est
   * interdite le même jour pour une raison évidente, et en répétition
   * quotidienne pour une raison qui ne l'est pas.
   */
  const sameDayForm = toDayKey(formData.startDate) === toDayKey(formData.endDate);
  const periodError: string | null = isBlockedPeriodValid({
    allDay: formData.allDay,
    sameDay: sameDayForm,
    startTime: formData.startTime,
    endTime: formData.endTime,
    spanMode: formData.spanMode,
  })
    ? null
    : sameDayForm
      ? "Sur une même journée, l'heure de fin doit être après l'heure de début."
      : "En répétition quotidienne, l'heure de fin doit être après l'heure de début.";

  const resetForm = () => {
    setFormData(getDefaultFormData());
  };

  const handleOpenModal = () => {
    resetForm();
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    resetForm();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Garde de dernier recours : le bouton est déjà éteint dans ce cas.
    if (periodError) return;
    setLoading(true);
    try {
      await onAdd(formData);
      handleCloseModal();
    } catch (error) {
      console.error('Error adding blocked slot:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (slotId: string) => {
    setDeletingId(slotId);
    try {
      await onDelete(slotId);
    } catch (error) {
      console.error('Error deleting blocked slot:', error);
    } finally {
      setDeletingId(null);
    }
  };

  const getMemberName = (memberId: string | null): string => {
    if (!memberId) return 'Tous';
    const member = members.find((m) => m.id === memberId);
    return member?.name || 'Membre inconnu';
  };

  const getLocationName = (locationId: string | null): string => {
    if (!locationId) return 'Tous les lieux';
    const location = locations.find((l) => l.id === locationId);
    return location?.name || 'Lieu inconnu';
  };

  // Filter to show only upcoming or current blocked slots
  const upcomingSlots = blockedSlots.filter((slot) => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return slot.endDate >= now;
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">
            Périodes de fermeture
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Vacances, formations, absences...
          </p>
        </div>
        <Button size="sm" onClick={handleOpenModal}>
          <Plus className="w-4 h-4 mr-1" />
          Ajouter
        </Button>
      </div>

      {/* Blocked slots list */}
      {upcomingSlots.length === 0 ? (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
          <Calendar className="w-8 h-8 mx-auto mb-2 text-gray-400" />
          <p>Aucune période de fermeture prévue</p>
        </div>
      ) : (
        <div className="space-y-2">
          {upcomingSlots.map((slot) => (
            <div
              key={slot.id}
              className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-gray-900 dark:text-white">
                    {formatDateRange(slot.startDate, slot.endDate)}
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatTimeRange(slot.startTime, slot.endTime)}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                  {slot.reason && (
                    <span className="bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
                      {slot.reason}
                    </span>
                  )}
                  {hasTeams && slot.memberId && (
                    <span>{getMemberName(slot.memberId)}</span>
                  )}
                  {locations.length > 1 && slot.locationId && (
                    <span>{getLocationName(slot.locationId)}</span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(slot.id)}
                disabled={deletingId === slot.id}
                className="p-2 text-gray-400 hover:text-error-500 dark:hover:text-error-400 transition-colors disabled:opacity-50"
                aria-label="Supprimer"
              >
                {deletingId === slot.id ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add blocked slot modal */}
      <Modal isOpen={modalOpen} onClose={handleCloseModal} className="max-w-md">
        <form onSubmit={handleSubmit}>
          <ModalHeader title="Ajouter une fermeture" onClose={handleCloseModal} />

          <ModalBody className="space-y-5">
            {/* Date range */}
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Date début"
                type="date"
                value={formData.startDate.toISOString().split('T')[0]}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    startDate: new Date(e.target.value),
                  }))
                }
                required
              />
              <Input
                label="Date fin"
                type="date"
                value={formData.endDate.toISOString().split('T')[0]}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    endDate: new Date(e.target.value),
                  }))
                }
                required
              />
            </div>

            {/* All day toggle */}
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Journée entière
              </span>
              <Switch
                checked={formData.allDay}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    allDay: e.target.checked,
                    startTime: e.target.checked ? null : '09:00',
                    endTime: e.target.checked ? null : '18:00',
                  }))
                }
              />
            </div>

            {/* Time range (if not all day) */}
            {!formData.allDay && (
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Heure début"
                  type="time"
                  value={formData.startTime || ''}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      startTime: e.target.value,
                    }))
                  }
                  required
                />
                <Input
                  label="Heure fin"
                  type="time"
                  value={formData.endTime || ''}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      endTime: e.target.value,
                    }))
                  }
                  required
                />
              </div>
            )}

            {/* Lecture des heures — n'apparaît QUE si la période couvre
                plusieurs jours. Sur un seul jour les deux lectures donnent le
                même résultat, et poser la question n'ajouterait que du doute. */}
            {!formData.allDay &&
              toDayKey(formData.endDate) > toDayKey(formData.startDate) && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Sur cette période, ces heures signifient
                  </p>
                  {(
                    [
                      {
                        value: 'continuous' as const,
                        titre: 'Une absence continue',
                        detail: `Du ${formatDayLabel(formData.startDate)} à ${formData.startTime} jusqu'au ${formatDayLabel(formData.endDate)} à ${formData.endTime}, sans interruption — nuits et journées entières comprises.`,
                      },
                      {
                        value: 'daily' as const,
                        titre: 'Tous les jours, à ces heures',
                        detail: `De ${formData.startTime} à ${formData.endTime} chaque jour, du ${formatDayLabel(formData.startDate)} au ${formatDayLabel(formData.endDate)}. Le reste de la journée reste réservable.`,
                      },
                    ]
                  ).map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() =>
                        setFormData((prev) => ({ ...prev, spanMode: opt.value }))
                      }
                      aria-pressed={formData.spanMode === opt.value}
                      className={`w-full text-left rounded-xl border p-3 transition-colors ${
                        formData.spanMode === opt.value
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
            <Input
              label="Raison (optionnel)"
              value={formData.reason || ''}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  reason: e.target.value || null,
                }))
              }
              placeholder="Ex: Vacances, Formation..."
            />

            {/* Member selector - NOUVEAU MODÈLE: memberId obligatoire */}
            {members.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Membre concerné {hasTeams ? '' : '(vous)'}
                </label>
                <select
                  value={formData.memberId}
                  onChange={(e) => {
                    const selectedMember = members.find((m) => m.id === e.target.value);
                    setFormData((prev) => ({
                      ...prev,
                      memberId: e.target.value,
                      // Auto-update locationId from member
                      locationId: selectedMember?.locationId || prev.locationId,
                    }));
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  required
                >
                  {members.map((member) => {
                    const loc = locations.find((l) => l.id === member.locationId);
                    return (
                      <option key={member.id} value={member.id}>
                        {member.name} {loc ? `(${loc.name})` : ''}
                      </option>
                    );
                  })}
                </select>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  1 membre = 1 lieu = 1 agenda
                </p>
              </div>
            )}
          </ModalBody>

          <ModalFooter>
            <Button type="button" variant="outline" onClick={handleCloseModal}>
              Annuler
            </Button>
            <Button type="submit" disabled={loading || periodError !== null}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Ajout...
                </>
              ) : (
                'Ajouter'
              )}
            </Button>
          </ModalFooter>
        </form>
      </Modal>
    </div>
  );
}
