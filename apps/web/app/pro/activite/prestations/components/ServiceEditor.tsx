'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { catalogService } from '@booking-app/firebase';
import { Trash2, Eye } from 'lucide-react';
import { Button, useToast, Modal } from '@/components/ui';
import { ConfirmDialog } from '@/components/ui';
import type {
  Location,
  Member,
  Service,
  ServiceCategory,
} from '@booking-app/shared';
import { EditorTopBar } from './EditorTopBar';
import { SectionEssentiel } from './SectionEssentiel';
import { SectionReglages } from './SectionReglages';
import { SectionDisponibilite } from './SectionDisponibilite';
import { SectionVariations } from './SectionVariations';
import { ServicePreview } from './ServicePreview';
import {
  emptyServiceFormData,
  serviceToFormData,
  type ServiceFormData,
} from './types';
import {
  sanitizeVariations,
  sanitizeOptions,
  sanitizeInfoFields,
} from './choiceHelpers';

type WithId<T> = { id: string } & T;

const BACK_HREF = '/pro/activite?tab=prestations';

interface ServiceEditorProps {
  providerId: string;
  /** The prestation being edited, or null when creating. */
  service: WithId<Service> | null;
  locations: WithId<Location>[];
  members: WithId<Member>[];
  categories: WithId<ServiceCategory>[];
  isTeamPlan: boolean;
  depositsEnabled: boolean;
  defaultDeposit: { percent: number; refundDeadlineHours: number } | null;
}

/**
 * Full-page prestation editor. Owns the form state, the dirty guard and
 * the save flow. Sections (Essentiel, Réglages, Disponibilité,
 * Variations) are plugged in here; only Essentiel is wired in this
 * milestone, the rest land next.
 */
export function ServiceEditor({
  providerId,
  service,
  locations,
  members,
  categories,
  isTeamPlan,
  depositsEnabled,
  defaultDeposit,
}: ServiceEditorProps) {
  const router = useRouter();
  const toast = useToast();
  const isEditing = !!service;

  const [formData, setFormData] = useState<ServiceFormData>(() =>
    service
      ? serviceToFormData(service)
      : emptyServiceFormData(locations.length > 0 ? [locations[0].id] : []),
  );
  // Categories are held in state so we can add one on the fly without a
  // full reload (the picker in Réglages creates + selects it).
  const [categoryList, setCategoryList] = useState(categories);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  // Mobile-only: the preview lives in a modal instead of a side pane.
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // Snapshot of the opening state — the dirty guard compares against it.
  const initialSnapshotRef = useRef<string>(JSON.stringify(formData));
  const isDirty = JSON.stringify(formData) !== initialSnapshotRef.current;

  const update = useCallback((patch: Partial<ServiceFormData>) => {
    setFormData((prev) => ({ ...prev, ...patch }));
    setErrors((prev) => {
      // Clear the errors for the fields being edited.
      const next = { ...prev };
      for (const key of Object.keys(patch)) delete next[key];
      return next;
    });
  }, []);

  // Create a category inline and select it immediately.
  const handleCreateCategory = useCallback(
    async (name: string) => {
      const cat = await catalogService.createCategory(providerId, { name });
      setCategoryList((prev) => [...prev, cat]);
      setFormData((prev) => ({ ...prev, categoryId: cat.id }));
      return cat;
    },
    [providerId],
  );

  // Warn on hard navigation (refresh / tab close) while dirty.
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  const validate = (): boolean => {
    const next: Record<string, string> = {};

    if (!formData.name.trim()) {
      next.name = 'Le nom est requis';
    } else if (formData.name.trim().length < 2) {
      next.name = 'Le nom doit contenir au moins 2 caractères';
    }
    if (formData.price < 0) {
      next.price = 'Le prix ne peut pas être négatif';
    }
    if (formData.locationIds.length === 0) {
      next.locationIds = 'Sélectionnez au moins un lieu';
    }
    // In "Selon les variations" mode there must be at least one complete
    // variation (a name + one named choice), else pricing is undefined.
    if (
      formData.variations.length > 0 &&
      sanitizeVariations(formData.variations).length === 0
    ) {
      next.variations =
        'Complétez au moins une variation : un nom et au moins un choix nommé.';
    }
    if (formData.deposit && formData.deposit.type !== 'none') {
      const v = formData.deposit.value ?? 0;
      if (!Number.isFinite(v) || v < 1) {
        next.depositValue = "Le montant de l'acompte doit être supérieur à 0";
      } else if (formData.deposit.type === 'fixed' && v > formData.price) {
        next.depositValue = "L'acompte fixe ne peut pas dépasser le prix";
      } else if (formData.deposit.type === 'percent' && v > 100) {
        next.depositValue = 'Le pourcentage ne peut pas dépasser 100 %';
      }
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const goBack = () => router.push(BACK_HREF);

  const handleDelete = async () => {
    if (!service) return;
    setDeleting(true);
    try {
      await catalogService.deleteService(providerId, service.id);
      toast.success('Prestation supprimée');
      initialSnapshotRef.current = JSON.stringify(formData); // suppress guard
      goBack();
    } catch (error) {
      console.error('Delete error:', error);
      toast.error(
        error instanceof Error ? error.message : 'Une erreur est survenue',
      );
      setShowDeleteConfirm(false);
    } finally {
      setDeleting(false);
    }
  };

  const handleBack = () => {
    if (isDirty) {
      setShowLeaveConfirm(true);
    } else {
      goBack();
    }
  };

  const handleSave = async () => {
    if (!validate()) {
      toast.error('Vérifiez les champs en rouge');
      return;
    }
    // Strip half-filled choices so Firestore stays clean and Zod (which
    // requires non-empty names) doesn't reject the payload.
    const payload: ServiceFormData = {
      ...formData,
      // Price ranges are no longer authored manually — a varying price is
      // expressed through variations — so never persist a priceMax.
      priceMax: null,
      variations: sanitizeVariations(formData.variations),
      options: sanitizeOptions(formData.options),
      infoFields: sanitizeInfoFields(formData.infoFields),
    };

    setSaving(true);
    try {
      if (service) {
        await catalogService.updateService(providerId, service.id, payload);
        toast.success('Prestation mise à jour');
      } else {
        await catalogService.createService(providerId, {
          ...payload,
          isOnline: false,
        });
        toast.success('Prestation créée');
      }
      // Mark clean so the leave-guard doesn't fire on the redirect.
      initialSnapshotRef.current = JSON.stringify(formData);
      goBack();
    } catch (error) {
      console.error('Save error:', error);
      // A Zod validation error's `.message` is a raw JSON array of issues —
      // never show that to the pro. Surface the first issue's human message.
      const zodIssues = (error as { issues?: { message?: string }[] })?.issues;
      const friendly =
        Array.isArray(zodIssues) && zodIssues[0]?.message
          ? zodIssues[0].message
          : error instanceof Error
            ? error.message
            : 'Une erreur est survenue';
      toast.error(friendly);
    } finally {
      setSaving(false);
    }
  };

  return (
    // On desktop the editor owns a viewport-height column: the form pane
    // scrolls on its own while the preview pane stays put. (The app shell
    // traps `position: sticky`, so we create a real scroll context here
    // instead.) On mobile it's a normal stacked, window-scrolled page.
    <div className="pb-12 lg:pb-0 lg:h-[calc(100vh-4rem)] lg:flex lg:flex-col lg:overflow-hidden">
      <EditorTopBar
        isEditing={isEditing}
        title={formData.name}
        saving={saving}
        isDirty={isDirty}
        onBack={handleBack}
        onSave={handleSave}
      />

      <div className="mt-5 w-full lg:flex lg:gap-6 lg:flex-1 lg:min-h-0 lg:overflow-hidden">
        <div className="flex-1 min-w-0 space-y-4 lg:min-h-0 lg:overflow-y-auto lg:pr-1 lg:pb-12">
        <SectionEssentiel
          data={formData}
          errors={errors}
          isEditing={isEditing}
          update={update}
        />

        <SectionReglages
          data={formData}
          errors={errors}
          categories={categoryList}
          onCreateCategory={handleCreateCategory}
          depositsEnabled={depositsEnabled}
          defaultDeposit={defaultDeposit}
          update={update}
        />

        <SectionVariations data={formData} update={update} />
        {errors.variations && (
          <p className="text-sm text-error-600 dark:text-error-400 px-1 -mt-2">
            {errors.variations}
          </p>
        )}

        <SectionDisponibilite
          data={formData}
          errors={errors}
          locations={locations}
          members={members}
          isTeamPlan={isTeamPlan}
          update={update}
        />

        {/* Danger zone — delete is only available when editing. */}
        {isEditing && (
          <div className="pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={saving || deleting}
              className="text-error-600 hover:text-error-700"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Supprimer la prestation
            </Button>
          </div>
        )}
        </div>

        {/* Live client preview — own pane on desktop (stays in view while
            the form scrolls). On mobile it's hidden here and opened in a
            modal via the floating "Voir l'aperçu" button instead. */}
        <div className="hidden lg:block lg:w-[360px] lg:flex-shrink-0 lg:min-h-0 lg:overflow-y-auto lg:pb-4">
          <ServicePreview data={formData} />
        </div>
      </div>

      {/* Mobile: floating button → preview in a modal (more intuitive than
          a panel stacked far below the form). */}
      <button
        type="button"
        onClick={() => setShowPreviewModal(true)}
        className="lg:hidden fixed bottom-4 left-1/2 -translate-x-1/2 z-40 inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-primary-600 text-white text-sm font-medium shadow-lg shadow-primary-600/30 hover:bg-primary-700 transition-colors"
      >
        <Eye className="w-4 h-4" />
        Voir l&apos;aperçu
      </button>

      <Modal
        isOpen={showPreviewModal}
        onClose={() => setShowPreviewModal(false)}
        className="max-w-md w-full"
      >
        <ServicePreview
          data={formData}
          embedded
          onClose={() => setShowPreviewModal(false)}
        />
      </Modal>

      <ConfirmDialog
        isOpen={showLeaveConfirm}
        onClose={() => setShowLeaveConfirm(false)}
        onConfirm={() => {
          setShowLeaveConfirm(false);
          goBack();
        }}
        title="Modifications non enregistrées"
        message="Vous avez des modifications non enregistrées. Si vous quittez maintenant, elles seront perdues."
        confirmLabel="Quitter sans enregistrer"
        cancelLabel="Continuer l'édition"
        variant="danger"
      />

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="Supprimer la prestation"
        message="Êtes-vous sûr de vouloir supprimer cette prestation ? Cette action est irréversible."
        confirmLabel="Supprimer"
        loading={deleting}
        variant="danger"
      />
    </div>
  );
}
