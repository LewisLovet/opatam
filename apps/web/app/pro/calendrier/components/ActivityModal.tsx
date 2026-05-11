'use client';

/**
 * ActivityModal — create / edit a personal activity for the pro.
 *
 * Backed by the same `blockedSlots` collection as the "Bloquer une
 * période" flow (see packages/shared/src/types/index.ts) — what flips
 * an entry from a generic blocked period to a typed activity is
 * presence of `category` + `title`.
 *
 * Mirrors the mobile create-activity screen so the two flows stay in
 * sync UX-wise: category chip row, title, member (if multi), date +
 * start/end times, optional address & notes.
 */

import { useState, useEffect, useMemo } from 'react';
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
  blockedSlotRepository,
  memberService,
} from '@booking-app/firebase';
import {
  ACTIVITY_CATEGORY_META,
  type ActivityCategory,
  type Member,
} from '@booking-app/shared';
import {
  Loader2, Clock, Users, Euro,
  Briefcase, Dumbbell, Handshake, Heart, FileText, Plane, Zap, Circle,
} from 'lucide-react';

type WithId<T> = { id: string } & T;

const CATEGORIES: {
  key: ActivityCategory;
  label: string;
  color: string;
  Icon: typeof Dumbbell;
}[] = [
  // Prestation listed first — paid off-platform work is the most
  // common reason a pro logs an activity with an amount, so it's
  // the natural default tap target. Mirrors the order in
  // apps/mobile/components/business/Activity/categoryMeta.ts.
  { key: 'prestation', label: 'Prestation', color: ACTIVITY_CATEGORY_META.prestation.color, Icon: Briefcase },
  { key: 'sport',      label: 'Sport',      color: ACTIVITY_CATEGORY_META.sport.color,      Icon: Dumbbell },
  { key: 'meeting',    label: 'Meeting',    color: ACTIVITY_CATEGORY_META.meeting.color,    Icon: Handshake },
  { key: 'personal',   label: 'Perso',      color: ACTIVITY_CATEGORY_META.personal.color,   Icon: Heart },
  { key: 'admin',      label: 'Admin',      color: ACTIVITY_CATEGORY_META.admin.color,      Icon: FileText },
  { key: 'travel',     label: 'Trajet',     color: ACTIVITY_CATEGORY_META.travel.color,     Icon: Plane },
  { key: 'imprevu',    label: 'Imprévu',    color: ACTIVITY_CATEGORY_META.imprevu.color,    Icon: Zap },
  { key: 'other',      label: 'Autre',      color: ACTIVITY_CATEGORY_META.other.color,      Icon: Circle },
];

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

interface ActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  providerId: string;
  /** ID of an existing blockedSlot when editing, undefined when creating. */
  editId?: string;
  /** Pre-fill date when creating (e.g. clicked on a calendar slot). */
  initialDate?: Date;
  /** Pre-fill HH:MM start time (drag-selected on the calendar). */
  initialStartTime?: string;
  /** Pre-fill HH:MM end time (drag-selected on the calendar). */
  initialEndTime?: string;
  /** Pre-select a specific member when creating. */
  initialMemberId?: string;
  onSaved?: () => void;
}

export function ActivityModal({
  isOpen,
  onClose,
  providerId,
  editId,
  initialDate,
  initialStartTime,
  initialEndTime,
  initialMemberId,
  onSaved,
}: ActivityModalProps) {
  const isEditing = !!editId;
  const toast = useToast();

  const [members, setMembers] = useState<WithId<Member>[]>([]);
  const [memberId, setMemberId] = useState<string>('');
  // Default to "prestation" — the most likely category when a
  // pro logs an activity with an amount (paid off-platform work).
  // Same default as the mobile create-activity sheet.
  const [category, setCategory] = useState<ActivityCategory>('prestation');
  const [title, setTitle] = useState('');

  const initialDateStr = formatDateInput(initialDate ?? new Date());
  const initialStart = (() => {
    const d = initialDate ? new Date(initialDate) : new Date();
    if (!initialDate) d.setMinutes(0, 0, 0);
    return d;
  })();
  const initialEnd = (() => {
    const d = new Date(initialStart);
    d.setHours(d.getHours() + 1);
    return d;
  })();

  const [date, setDate] = useState<string>(initialDateStr);
  const [startTime, setStartTime] = useState<string>(
    initialStartTime ?? formatTimeInput(initialStart),
  );
  const [endTime, setEndTime] = useState<string>(
    initialEndTime ?? formatTimeInput(initialEnd),
  );
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  // Amount in euros as a raw string (what the user types). Parsed
  // to integer cents at submit time. Stored as string so the input
  // can hold partial states like "12." while the user is typing.
  // Empty string = no amount (this is an unpaid activity).
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const activeCategory = useMemo(
    () => CATEGORIES.find((c) => c.key === category) ?? CATEGORIES[0],
    [category],
  );

  // Reset form whenever the modal opens
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
          // Edit mode: hydrate from existing blockedSlot
          const existing = await blockedSlotRepository.getById(providerId, editId);
          if (cancelled) return;
          if (!existing) {
            toast.error('Activité introuvable');
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
          setMemberId(existing.memberId);
          if (existing.category) setCategory(existing.category);
          setTitle(existing.title || '');
          setDate(formatDateInput(startDt));
          setStartTime(formatTimeInput(startDt));
          setEndTime(formatTimeInput(endDt));
          setAddress(existing.address || '');
          setNotes(existing.reason || '');
          // Amount stored in cents → display in euros. Falsy
          // (null / undefined / 0) shows as empty input, not "0".
          setAmount(
            typeof existing.amount === 'number' && existing.amount > 0
              ? (existing.amount / 100).toString()
              : '',
          );
        } else {
          // Create mode defaults
          const requested = initialMemberId
            ? activeMembers.find((m) => m.id === initialMemberId)
            : null;
          const fallback =
            activeMembers.find((m) => m.isDefault) || activeMembers[0];
          const target = requested || fallback;
          if (target) setMemberId(target.id);
          setCategory('prestation');
          setTitle('');
          setDate(initialDateStr);
          setStartTime(initialStartTime ?? formatTimeInput(initialStart));
          setEndTime(initialEndTime ?? formatTimeInput(initialEnd));
          setAddress('');
          setNotes('');
          setAmount('');
        }
      } catch (err) {
        console.error('[ActivityModal] load failed:', err);
        toast.error('Impossible de charger les données');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, editId, providerId]);

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error('Donnez un titre à votre activité');
      return;
    }
    if (!memberId) {
      toast.error('Sélectionnez un membre');
      return;
    }
    const startDt = combine(date, startTime);
    const endDt = combine(date, endTime);
    if (endDt <= startDt) {
      toast.error("L'heure de fin doit être après l'heure de début");
      return;
    }
    const member = members.find((m) => m.id === memberId);
    if (!member) {
      toast.error('Membre introuvable');
      return;
    }

    // Parse amount → integer cents. Tolerant of comma decimal
    // separators ("12,50") which French keyboards default to.
    // Empty / unparseable / ≤0 sends `null` to indicate "no
    // amount" — keeps the BlockedSlot a plain activity rather
    // than a paid one for the stats pipeline.
    const trimmedAmount = amount.trim().replace(',', '.');
    const parsedAmount = trimmedAmount === '' ? NaN : Number(trimmedAmount);
    const amountCents =
      Number.isFinite(parsedAmount) && parsedAmount > 0
        ? Math.round(parsedAmount * 100)
        : null;

    setSaving(true);
    try {
      if (editId) {
        await blockedSlotRepository.update(providerId, editId, {
          memberId: member.id,
          locationId: member.locationId,
          startDate: startDt,
          endDate: endDt,
          allDay: false,
          startTime,
          endTime,
          reason: notes.trim() || null,
          category,
          title: title.trim(),
          address: address.trim() || null,
          amount: amountCents,
        });
        toast.success('Activité modifiée');
      } else {
        await schedulingService.blockPeriod(providerId, {
          memberId: member.id,
          locationId: member.locationId,
          startDate: startDt,
          endDate: endDt,
          allDay: false,
          isRecurring: false,
          startTime,
          endTime,
          reason: notes.trim() || null,
          category,
          title: title.trim(),
          address: address.trim() || null,
          amount: amountCents,
        });
        toast.success('Activité ajoutée à votre agenda');
      }
      onSaved?.();
      onClose();
    } catch (err) {
      console.error('[ActivityModal] save failed:', err);
      toast.error(
        err instanceof Error ? err.message : "Impossible d'enregistrer",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!editId) return;
    if (!confirm('Supprimer cette activité ?')) return;
    setDeleting(true);
    try {
      await schedulingService.unblockPeriod(providerId, editId);
      toast.success('Activité supprimée');
      onSaved?.();
      onClose();
    } catch (err) {
      console.error('[ActivityModal] delete failed:', err);
      toast.error('Impossible de supprimer');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-md">
      <ModalHeader
        title={isEditing ? "Modifier l'activité" : 'Nouvelle activité'}
        onClose={onClose}
      />

      <ModalBody className="space-y-5">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
          </div>
        ) : (
          <>
            {/* Category chips */}
            <div>
              <label className="block text-xs uppercase tracking-wide font-semibold text-gray-500 dark:text-gray-400 mb-2">
                Catégorie
              </label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((cat) => {
                  const isSelected = cat.key === category;
                  const Icon = cat.Icon;
                  return (
                    <button
                      key={cat.key}
                      type="button"
                      onClick={() => setCategory(cat.key)}
                      className={`
                        inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium
                        transition-all border
                        ${isSelected
                          ? 'text-white border-transparent shadow-sm'
                          : 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700'}
                      `}
                      style={
                        isSelected
                          ? { backgroundColor: cat.color }
                          : undefined
                      }
                    >
                      <Icon
                        className="w-3.5 h-3.5"
                        style={!isSelected ? { color: cat.color } : undefined}
                      />
                      {cat.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Title */}
            <Input
              label="Titre"
              placeholder="ex : Crossfit, Déjeuner avec…"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={80}
              required
            />

            {/* Member (if multi) */}
            {members.length > 1 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <Users className="inline w-4 h-4 mr-1.5 -mt-0.5" />
                  Pour
                </label>
                <div className="flex flex-wrap gap-2">
                  {members.map((member) => {
                    const isSelected = member.id === memberId;
                    return (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() => setMemberId(member.id)}
                        className={`
                          px-3 py-1.5 rounded-full text-sm font-medium border transition-colors
                          ${isSelected
                            ? 'bg-primary-500 text-white border-primary-500'
                            : 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-100'}
                        `}
                      >
                        {member.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Date + times */}
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-3 sm:col-span-1">
                <Input
                  label="Date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>
              <div>
                <Input
                  label="Début"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  required
                />
              </div>
              <div>
                <Input
                  label="Fin"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Address (optional) */}
            <Input
              label="Adresse (optionnel)"
              placeholder="ex : Salle de sport, 12 rue X"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              maxLength={200}
            />

            {/* Amount (optional) — paid off-platform work.
                Type="text" + inputMode="decimal" rather than
                type="number" so French keyboards offer the comma
                key by default and the input handles partial states
                like "12." while the user is typing. Parsed to
                integer cents at submit, see handleSubmit. */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Montant (optionnel)
              </label>
              <div className="relative">
                <Euro className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500 pointer-events-none" />
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="ex : 80"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Pour les prestations payées hors plateforme. Le montant
                apparaîtra dans &laquo; Autres revenus &raquo; de vos statistiques.
              </p>
            </div>

            {/* Notes (optional) */}
            <Textarea
              label="Notes (optionnel)"
              placeholder="Détails supplémentaires…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              maxLength={200}
            />
          </>
        )}
      </ModalBody>

      <ModalFooter>
        <div className="flex items-center justify-between w-full gap-2">
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
              disabled={saving || deleting || loading}
              style={{ backgroundColor: activeCategory.color, borderColor: activeCategory.color }}
            >
              {saving ? (
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
              ) : (
                <Clock className="w-4 h-4 mr-1.5" />
              )}
              {isEditing ? 'Enregistrer' : "Ajouter"}
            </Button>
          </div>
        </div>
      </ModalFooter>
    </Modal>
  );
}
