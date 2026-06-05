/**
 * Services Management Screen
 * List, create, edit, delete, toggle active/inactive services.
 * Services are grouped by category with category CRUD support.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { Text, Button, Input, Card, useToast } from '../../components';
import { useProvider } from '../../contexts';
import {
  serviceRepository,
  serviceCategoryRepository,
  locationRepository,
  memberRepository,
  type WithId,
} from '@booking-app/firebase';
import type {
  Service,
  ServiceCategory,
  Location,
  Member,
  ServiceVariation,
  ServiceOption,
  ServiceInfoField,
} from '@booking-app/shared/types';
import {
  resolveDeposit,
  SERVICE_COLORS,
  sanitizeVariations,
  sanitizeOptions,
  sanitizeInfoFields,
} from '@booking-app/shared';
import {
  VariationsEditor,
  OptionsEditor,
  InfoFieldsEditor,
} from '../../components/business/ServiceChoicesEditor';
import { EditorSection } from '../../components/business/EditorSection';
import { ServiceChoicesPreview } from '../../components/business/ServiceChoicesPreview';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'react-native';
import { uploadFile, storagePaths } from '@booking-app/firebase/storage';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DepositMode = 'inherit' | 'custom' | 'none';
type DepositCustomType = 'fixed' | 'percent';

interface ServiceFormData {
  name: string;
  description: string;
  photoURL: string | null;
  durationHours: string;
  durationMinutes: string;
  price: string;
  bufferTime: string;
  isActive: boolean;
  locationIds: string[];
  memberIds: string[] | null;
  categoryId: string | null;
  /** Hex color tinting bookings of this service on the calendar. null
   *  falls back to the member's color. */
  color: string | null;
  // Deposit configuration. The 3 modes mirror the web ServiceModal:
  // inherit (null on save), custom (type fixed/percent + value + hours)
  // or none (sentinel { type: 'none' }).
  depositMode: DepositMode;
  depositType: DepositCustomType;
  depositValue: string; // % when percent, € when fixed
  depositRefundHours: string;
  // Variations / options / info fields — same model as the web editor and
  // the registration wizard. Prices stored in cents.
  variations: ServiceVariation[];
  options: ServiceOption[];
  infoFields: ServiceInfoField[];
}

const DEFAULT_FORM: ServiceFormData = {
  name: '',
  description: '',
  photoURL: null,
  durationHours: '1',
  durationMinutes: '0',
  price: '',
  bufferTime: '0',
  isActive: true,
  locationIds: [],
  memberIds: null,
  categoryId: null,
  color: null,
  depositMode: 'inherit',
  depositType: 'percent',
  depositValue: '30',
  depositRefundHours: '24',
  variations: [],
  options: [],
  infoFields: [],
};

function minutesToHoursMinutes(totalMinutes: number): { hours: string; minutes: string } {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return { hours: String(h), minutes: String(m) };
}

function hoursMinutesToMinutes(hours: string, minutes: string): number {
  return (parseInt(hours, 10) || 0) * 60 + (parseInt(minutes, 10) || 0);
}

function formatDuration(min: number): string {
  if (min >= 60) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
  }
  return `${min} min`;
}

function formatPrice(cents: number, centsMax?: number | null): string {
  if (cents === 0 && !centsMax) return 'Gratuit';
  const fmt = (v: number) => `${(v / 100).toFixed(2)} €`;
  if (centsMax && centsMax > cents) return `De ${fmt(cents)} à ${fmt(centsMax)}`;
  return fmt(cents);
}

// ─── DepositBadge ───────────────────────────────────────────────────────
// Inline pill summarising the effective deposit on a service. Mirrors the
// web version (apps/web/.../ServiceCard.tsx).
function DepositBadge({
  service,
  depositsEnabled,
  defaultDeposit,
}: {
  service: WithId<Service>;
  depositsEnabled: boolean;
  defaultDeposit: { percent: number; refundDeadlineHours: number } | null;
}) {
  if (!depositsEnabled) return null;

  // Explicitly disabled — show a grey "Pas d'acompte" pill.
  if (service.deposit?.type === 'none') {
    return (
      <View
        style={{
          alignSelf: 'flex-start',
          backgroundColor: '#E5E7EB',
          paddingHorizontal: 8,
          paddingVertical: 2,
          borderRadius: 999,
          marginTop: 4,
        }}
      >
        <Text variant="caption" style={{ color: '#4B5563', fontWeight: '600', fontSize: 11 }}>
          Pas d&apos;acompte
        </Text>
      </View>
    );
  }

  const resolved = resolveDeposit(
    { price: service.price, deposit: service.deposit },
    { depositDefault: defaultDeposit },
  );
  if (!resolved || resolved.amount === 0) return null;
  const amount = (resolved.amount / 100).toFixed(2).replace('.', ',') + ' €';
  const suffix = resolved.source === 'service' ? 'perso' : 'défaut';
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        backgroundColor: '#DBEAFE',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 999,
        marginTop: 4,
      }}
    >
      <Text variant="caption" style={{ color: '#1D4ED8', fontWeight: '600', fontSize: 11 }}>
        Acompte {amount} · {suffix}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main Screen
// ---------------------------------------------------------------------------

export default function ServicesScreen() {
  const { colors, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { showToast } = useToast();
  const { provider, providerId } = useProvider();

  // Deposit gates (used to decide whether to show the badge)
  const depositsEnabled =
    !!provider?.depositsAddonActive &&
    provider?.stripeConnectStatus === 'active';
  const defaultDepositSettings = provider?.settings?.depositDefault ?? null;

  const [services, setServices] = useState<WithId<Service>[]>([]);
  const [categories, setCategories] = useState<WithId<ServiceCategory>[]>([]);
  const [locations, setLocations] = useState<WithId<Location>[]>([]);
  const [members, setMembers] = useState<WithId<Member>[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

  // Service modal state
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ServiceFormData>(DEFAULT_FORM);
  const [isSaving, setIsSaving] = useState(false);

  // Inline picker expanded state (inside the form modal)
  const [expandedPicker, setExpandedPicker] = useState<'category' | null>(null);

  // Portfolio picker — collapsed by default, shown when the user wants to
  // pick an existing portfolio photo instead of uploading a new one.
  const [showPortfolio, setShowPortfolio] = useState(false);
  const portfolioPhotos = provider?.portfolioPhotos ?? [];

  // Whether the "Variations & options" section of the form is expanded.
  const [choicesExpanded, setChoicesExpanded] = useState(false);
  // Client-view preview overlay (floating "Aperçu" button).
  const [showPreview, setShowPreview] = useState(false);

  // Category modal state
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [isSavingCategory, setIsSavingCategory] = useState(false);

  // Load data
  const loadData = useCallback(async () => {
    if (!providerId) return;
    try {
      const [srvs, cats, locs, mbrs] = await Promise.all([
        serviceRepository.getByProvider(providerId),
        serviceCategoryRepository.getByProvider(providerId),
        locationRepository.getActiveByProvider(providerId),
        memberRepository.getActiveByProvider(providerId),
      ]);
      setServices(srvs.sort((a, b) => a.sortOrder - b.sortOrder));
      setCategories(cats.sort((a, b) => a.sortOrder - b.sortOrder));
      setLocations(locs);
      setMembers(mbrs);
    } catch (err) {
      console.error('Error loading services:', err);
      showToast({ variant: 'error', message: 'Erreur lors du chargement' });
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [providerId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // ---------------------------------------------------------------------------
  // Category helpers
  // ---------------------------------------------------------------------------

  const toggleCollapse = (categoryId: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return next;
    });
  };

  const getServicesByCategory = () => {
    const grouped: Record<string, WithId<Service>[]> = {};
    const uncategorized: WithId<Service>[] = [];
    for (const s of services) {
      if (s.categoryId) {
        if (!grouped[s.categoryId]) grouped[s.categoryId] = [];
        grouped[s.categoryId].push(s);
      } else {
        uncategorized.push(s);
      }
    }
    return { grouped, uncategorized };
  };

  // Category CRUD
  const openCreateCategory = () => {
    setEditingCategoryId(null);
    setCategoryName('');
    setShowCategoryModal(true);
  };

  const openEditCategory = (cat: WithId<ServiceCategory>) => {
    setEditingCategoryId(cat.id);
    setCategoryName(cat.name);
    setShowCategoryModal(true);
  };

  const handleSaveCategory = async () => {
    if (!providerId) return;
    if (!categoryName.trim()) {
      showToast({ variant: 'error', message: 'Le nom est requis' });
      return;
    }
    setIsSavingCategory(true);
    try {
      if (editingCategoryId) {
        await serviceCategoryRepository.update(providerId, editingCategoryId, { name: categoryName.trim() });
        showToast({ variant: 'success', message: 'Catégorie modifiée' });
      } else {
        await serviceCategoryRepository.create(providerId, {
          name: categoryName.trim(),
          sortOrder: categories.length,
          isActive: true,
        });
        showToast({ variant: 'success', message: 'Catégorie créée' });
      }
      setShowCategoryModal(false);
      loadData();
    } catch (err: any) {
      showToast({ variant: 'error', message: err?.message || 'Erreur' });
    } finally {
      setIsSavingCategory(false);
    }
  };

  const handleDeleteCategory = (cat: WithId<ServiceCategory>) => {
    const count = services.filter((s) => s.categoryId === cat.id).length;
    Alert.alert(
      'Supprimer la catégorie',
      count > 0
        ? `"${cat.name}" contient ${count} prestation(s). Elles seront déplacées dans "Autres prestations".`
        : `Supprimer "${cat.name}" ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            if (!providerId) return;
            try {
              const affectedServices = services.filter((s) => s.categoryId === cat.id);
              for (const s of affectedServices) {
                await serviceRepository.update(providerId, s.id, { categoryId: null });
              }
              await serviceCategoryRepository.delete(providerId, cat.id);
              showToast({ variant: 'success', message: 'Catégorie supprimée' });
              loadData();
            } catch (err: any) {
              showToast({ variant: 'error', message: err?.message || 'Erreur' });
            }
          },
        },
      ]
    );
  };

  // ---------------------------------------------------------------------------
  // Service CRUD
  // ---------------------------------------------------------------------------

  const openCreate = () => {
    setEditingId(null);
    setForm({
      ...DEFAULT_FORM,
      locationIds: locations.map((l) => l.id),
    });
    setExpandedPicker(null);
    setShowPortfolio(false);
    setChoicesExpanded(false);
    setShowModal(true);
  };

  const openEdit = (service: WithId<Service>) => {
    setEditingId(service.id);
    const { hours, minutes } = minutesToHoursMinutes(service.duration);

    // Hydrate the deposit fields from whatever shape the service has.
    let depositMode: DepositMode = 'inherit';
    let depositType: DepositCustomType = 'percent';
    let depositValue = '30';
    let depositRefundHours = '24';
    if (service.deposit?.type === 'none') {
      depositMode = 'none';
    } else if (service.deposit?.type === 'fixed' || service.deposit?.type === 'percent') {
      depositMode = 'custom';
      depositType = service.deposit.type;
      // Fixed values are stored in cents — show in euros for input.
      depositValue =
        depositType === 'fixed'
          ? String((service.deposit.value ?? 0) / 100)
          : String(service.deposit.value ?? 30);
      depositRefundHours = String(service.deposit.refundDeadlineHours ?? 24);
    }

    setForm({
      name: service.name,
      description: service.description || '',
      photoURL: service.photoURL || null,
      durationHours: hours,
      durationMinutes: minutes,
      price: String(service.price / 100),
      bufferTime: String(service.bufferTime),
      isActive: service.isActive,
      locationIds: service.locationIds || [],
      memberIds: service.memberIds,
      categoryId: service.categoryId || null,
      color: service.color ?? null,
      depositMode,
      depositType,
      depositValue,
      depositRefundHours,
      variations: service.variations ?? [],
      options: service.options ?? [],
      infoFields: service.infoFields ?? [],
    });
    setExpandedPicker(null);
    setShowPortfolio(false);
    // Auto-expand the section when the service already has choices so the
    // provider sees them right away.
    setChoicesExpanded(
      (service.variations?.length ?? 0) > 0 ||
        (service.options?.length ?? 0) > 0 ||
        (service.infoFields?.length ?? 0) > 0,
    );
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!providerId) return;
    if (!form.name.trim()) {
      showToast({ variant: 'error', message: 'Le nom est requis' });
      return;
    }
    if (!form.price.trim() || isNaN(Number(form.price)) || Number(form.price) < 0) {
      showToast({ variant: 'error', message: 'Le prix doit être un nombre positif' });
      return;
    }
    const totalDuration = hoursMinutesToMinutes(form.durationHours, form.durationMinutes);
    if (totalDuration <= 0) {
      showToast({ variant: 'error', message: 'La durée doit être supérieure à 0' });
      return;
    }
    if (form.locationIds.length === 0) {
      showToast({ variant: 'error', message: 'Sélectionnez au moins un lieu' });
      return;
    }

    setIsSaving(true);
    try {
      const bufferTimeValue = parseInt(form.bufferTime, 10) || 0;
      const priceCents = Math.round(Number(form.price) * 100);

      // Build the deposit payload from the form mode + custom inputs.
      let depositPayload: Service['deposit'] | null;
      if (form.depositMode === 'inherit') {
        depositPayload = null;
      } else if (form.depositMode === 'none') {
        depositPayload = { type: 'none' };
      } else {
        const valueRaw = Number(form.depositValue);
        const hoursRaw = Number(form.depositRefundHours);
        if (!Number.isFinite(valueRaw) || valueRaw < 1) {
          showToast({ variant: 'error', message: "Le montant de l'acompte doit être > 0" });
          setIsSaving(false);
          return;
        }
        if (form.depositType === 'percent' && valueRaw > 100) {
          showToast({ variant: 'error', message: 'Le pourcentage ne peut pas dépasser 100' });
          setIsSaving(false);
          return;
        }
        const valueCents =
          form.depositType === 'fixed' ? Math.round(valueRaw * 100) : Math.round(valueRaw);
        if (form.depositType === 'fixed' && valueCents > priceCents) {
          showToast({ variant: 'error', message: "L'acompte fixe ne peut pas dépasser le prix" });
          setIsSaving(false);
          return;
        }
        depositPayload = {
          type: form.depositType,
          value: valueCents,
          refundDeadlineHours: Math.max(0, Math.min(720, Math.round(hoursRaw) || 24)),
        };
      }

      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        photoURL: form.photoURL,
        duration: totalDuration,
        price: priceCents,
        // Price ranges removed in favour of variations — flatten any
        // legacy range on the next save.
        priceMax: null,
        bufferTime: bufferTimeValue,
        isActive: form.isActive,
        locationIds: form.locationIds,
        memberIds: form.memberIds,
        categoryId: form.categoryId,
        color: form.color,
        deposit: depositPayload,
        variations: sanitizeVariations(form.variations),
        options: sanitizeOptions(form.options),
        infoFields: sanitizeInfoFields(form.infoFields),
      };

      if (editingId) {
        await serviceRepository.update(providerId, editingId, payload);
        showToast({ variant: 'success', message: 'Prestation modifiée' });
      } else {
        await serviceRepository.create(providerId, {
          ...payload,
          sortOrder: services.length,
        });
        showToast({ variant: 'success', message: 'Prestation créée' });
      }

      setShowModal(false);
      loadData();
    } catch (err: any) {
      showToast({ variant: 'error', message: err?.message || 'Erreur' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (service: WithId<Service>) => {
    if (!providerId) return;
    try {
      await serviceRepository.toggleActive(providerId, service.id, !service.isActive);
      setServices((prev) =>
        prev.map((s) => (s.id === service.id ? { ...s, isActive: !s.isActive } : s))
      );
    } catch (err: any) {
      showToast({ variant: 'error', message: err?.message || 'Erreur' });
    }
  };

  const handleDelete = (service: WithId<Service>) => {
    Alert.alert(
      'Supprimer la prestation',
      `Êtes-vous sûr de vouloir supprimer "${service.name}" ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            if (!providerId) return;
            try {
              await serviceRepository.delete(providerId, service.id);
              showToast({ variant: 'success', message: 'Prestation supprimée' });
              loadData();
            } catch (err: any) {
              showToast({ variant: 'error', message: err?.message || 'Erreur' });
            }
          },
        },
      ]
    );
  };

  const toggleLocationId = (id: string) => {
    setForm((prev) => ({
      ...prev,
      locationIds: prev.locationIds.includes(id)
        ? prev.locationIds.filter((x) => x !== id)
        : [...prev.locationIds, id],
    }));
  };

  const toggleMemberId = (id: string) => {
    setForm((prev) => {
      const current = prev.memberIds || [];
      const updated = current.includes(id)
        ? current.filter((x) => x !== id)
        : [...current, id];
      return { ...prev, memberIds: updated.length > 0 ? updated : null };
    });
  };

  const getCategoryName = (id: string | null) => {
    if (!id) return 'Sans catégorie';
    return categories.find((c) => c.id === id)?.name || 'Sans catégorie';
  };

  const toggleCategoryPicker = () => {
    setExpandedPicker((prev) => (prev === 'category' ? null : 'category'));
  };

  // ---------------------------------------------------------------------------
  // Render service card
  // ---------------------------------------------------------------------------

  const renderServiceCard = (service: WithId<Service>) => {
    // Resolve assigned members for this service
    const assignedMembers = service.memberIds
      ? members.filter((m) => service.memberIds!.includes(m.id))
      : null; // null = all members
    // If all active members are selected, treat as "Tous"
    const activeMembers = members.filter((m) => m.isActive);
    const isAllMembers = !assignedMembers
      || (activeMembers.length > 0 && assignedMembers.length >= activeMembers.length);

    return (
      <Pressable
        key={service.id}
        onPress={() => openEdit(service)}
        style={({ pressed }) => ({ opacity: pressed ? 0.95 : 1 })}
      >
        <Card padding="md" shadow="sm">
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            {/* Photo thumbnail */}
            {service.photoURL && (
              <Image
                source={{ uri: service.photoURL }}
                style={{ width: 48, height: 48, borderRadius: 8, marginRight: spacing.sm }}
                resizeMode="cover"
              />
            )}
            <View style={{ flex: 1, marginRight: spacing.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Text variant="body" style={{ fontWeight: '600' }}>{service.name}</Text>
                {!service.isActive && (
                  <View style={[styles.badge, { backgroundColor: '#FEE2E2' }]}>
                    <Text variant="caption" style={{ color: '#DC2626', fontWeight: '600', fontSize: 10 }}>Inactif</Text>
                  </View>
                )}
              </View>
              <Text variant="bodySmall" color="textSecondary" style={{ marginTop: 2 }}>
                {formatDuration(service.duration)} • {formatPrice(service.price, service.priceMax)}
              </Text>
              <DepositBadge
                service={service}
                depositsEnabled={depositsEnabled}
                defaultDeposit={defaultDepositSettings}
              />
              {service.description && (
                <Text variant="caption" color="textMuted" numberOfLines={1} style={{ marginTop: 4 }}>
                  {service.description}
                </Text>
              )}
              {/* Member chips */}
              {members.length > 1 && (
                <View style={styles.memberChipsRow}>
                  {isAllMembers ? (
                    <View style={[styles.memberChip, { backgroundColor: colors.primaryLight }]}>
                      <Ionicons name="people-outline" size={11} color={colors.primary} />
                      <Text style={[styles.memberChipText, { color: colors.primary }]}>
                        Tous les membres
                      </Text>
                    </View>
                  ) : (
                    assignedMembers!.map((m) => (
                      <View key={m.id} style={[styles.memberChip, { backgroundColor: (m.color || colors.primary) + '15' }]}>
                        <View style={[styles.memberChipDot, { backgroundColor: m.color || colors.primary }]} />
                        <Text style={[styles.memberChipText, { color: m.color || colors.primary }]}>
                          {m.name.split(' ')[0]}
                        </Text>
                      </View>
                    ))
                  )}
                </View>
              )}
            </View>
            <Pressable
              onPress={(e) => { e.stopPropagation(); handleDelete(service); }}
              hitSlop={12}
              style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1, padding: 4 })}
            >
              <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
            </Pressable>
          </View>
        </Card>
      </Pressable>
    );
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (isLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const { grouped, uncategorized } = getServicesByCategory();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomColor: colors.border }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.7 : 1 }]}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <Text variant="h3" style={{ fontWeight: '600' }}>Prestations</Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Pressable onPress={openCreateCategory} style={({ pressed }) => [styles.addBtn, { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, opacity: pressed ? 0.8 : 1 }]}>
              <Ionicons name="folder-outline" size={18} color={colors.primary} />
            </Pressable>
            <Pressable onPress={openCreate} style={({ pressed }) => [styles.addBtn, { backgroundColor: colors.primary, borderRadius: radius.md, opacity: pressed ? 0.8 : 1 }]}>
              <Ionicons name="add" size={22} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing['3xl'] }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {services.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.primaryLight }]}>
              <Ionicons name="pricetag-outline" size={32} color={colors.primary} />
            </View>
            <Text variant="h3" align="center" style={{ marginTop: spacing.md }}>Aucune prestation</Text>
            <Text variant="body" color="textSecondary" align="center" style={{ marginTop: spacing.xs }}>
              Ajoutez votre première prestation pour commencer à recevoir des réservations.
            </Text>
            <Button variant="primary" title="Ajouter une prestation" onPress={openCreate} style={{ marginTop: spacing.lg }} />
          </View>
        ) : (
          <View style={{ gap: spacing.lg }}>
            {/* Categorized services */}
            {categories.map((cat) => {
              const catServices = grouped[cat.id] || [];
              const isCollapsed = collapsedCategories.has(cat.id);
              return (
                <View key={cat.id}>
                  {/* Category header — collapse icon + name is tappable, edit button separate */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
                    <Pressable
                      onPress={() => toggleCollapse(cat.id)}
                      style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
                    >
                      <Ionicons
                        name={isCollapsed ? 'chevron-forward' : 'chevron-down'}
                        size={18}
                        color={colors.textSecondary}
                      />
                      <Text variant="label" color="textSecondary" style={{ flex: 1, marginLeft: spacing.xs, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        {cat.name}
                      </Text>
                    </Pressable>
                    <View style={[styles.countBadge, { backgroundColor: colors.primaryLight }]}>
                      <Text variant="caption" color="primary" style={{ fontWeight: '600', fontSize: 11 }}>{catServices.length}</Text>
                    </View>
                    <Pressable onPress={() => openEditCategory(cat)} hitSlop={12} style={{ marginLeft: spacing.sm, padding: 4 }}>
                      <Ionicons name="pencil-outline" size={16} color={colors.textMuted} />
                    </Pressable>
                  </View>

                  {/* Services in category */}
                  {!isCollapsed && (
                    <View style={{ gap: spacing.sm }}>
                      {catServices.length === 0 ? (
                        <Text variant="caption" color="textMuted" style={{ marginLeft: spacing.lg, fontStyle: 'italic' }}>
                          Aucune prestation dans cette catégorie
                        </Text>
                      ) : (
                        catServices.map(renderServiceCard)
                      )}
                    </View>
                  )}
                </View>
              );
            })}

            {/* Uncategorized services */}
            {uncategorized.length > 0 && (
              <View>
                {categories.length > 0 && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
                    <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
                    <Text variant="label" color="textSecondary" style={{ flex: 1, marginLeft: spacing.xs, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Autres prestations
                    </Text>
                    <View style={[styles.countBadge, { backgroundColor: colors.surfaceSecondary }]}>
                      <Text variant="caption" color="textSecondary" style={{ fontWeight: '600', fontSize: 11 }}>{uncategorized.length}</Text>
                    </View>
                  </View>
                )}
                <View style={{ gap: spacing.sm }}>
                  {uncategorized.map(renderServiceCard)}
                </View>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* ── Create/Edit Service Modal ── */}
      <Modal visible={showModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl }]}>
            {/* Modal Header */}
            <View style={[styles.modalHeader, { padding: spacing.lg, borderBottomColor: colors.border }]}>
              <Text variant="h3">{editingId ? 'Modifier' : 'Nouvelle prestation'}</Text>
              <Pressable onPress={() => setShowModal(false)}>
                <Ionicons name="close-circle" size={28} color={colors.textMuted} />
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing['3xl'] }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              automaticallyAdjustKeyboardInsets
            >
              <View style={{ gap: spacing.lg }}>
                <EditorSection
                  title="Essentiel"
                  subtitle="Nom, photo, catégorie, durée et prix"
                  icon="pricetag-outline"
                  collapsible={false}
                >
                <Input
                  label="Nom"
                  placeholder="Ex: Coupe femme"
                  value={form.name}
                  onChangeText={(t) => setForm((p) => ({ ...p, name: t }))}
                  autoCapitalize="sentences"
                />

                {/* Photo */}
                <View>
                  <Text variant="bodySmall" style={{ fontWeight: '500', marginBottom: spacing.xs, color: colors.text }}>
                    Photo <Text variant="caption" color="textMuted">(optionnel)</Text>
                  </Text>

                  {form.photoURL && (
                    <View style={{ position: 'relative', alignSelf: 'flex-start', marginBottom: spacing.sm }}>
                      <Image
                        source={{ uri: form.photoURL }}
                        style={{ width: 80, height: 80, borderRadius: radius.md }}
                        resizeMode="cover"
                      />
                      <Pressable
                        onPress={() => setForm((p) => ({ ...p, photoURL: null }))}
                        style={{ position: 'absolute', top: -6, right: -6 }}
                      >
                        <Ionicons name="close-circle" size={22} color={colors.error || '#ef4444'} />
                      </Pressable>
                    </View>
                  )}

                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                    <Pressable
                      onPress={async () => {
                        const result = await ImagePicker.launchImageLibraryAsync({
                          mediaTypes: ['images'],
                          allowsEditing: true,
                          aspect: [1, 1],
                          quality: 0.8,
                        });
                        if (!result.canceled && result.assets[0] && providerId) {
                          const uri = result.assets[0].uri;
                          const response = await fetch(uri);
                          const blob = await response.blob();
                          const path = `${storagePaths.providerPortfolio(providerId)}/crop-${Date.now()}.jpg`;
                          const url = await uploadFile(path, blob, { contentType: 'image/jpeg' });
                          setForm((p) => ({ ...p, photoURL: url }));
                          setShowPortfolio(false);
                        }
                      }}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: spacing.xs,
                        paddingVertical: spacing.sm,
                        paddingHorizontal: spacing.md,
                        borderRadius: radius.lg,
                        borderWidth: 1,
                        borderColor: colors.border,
                        backgroundColor: colors.surfaceSecondary,
                      }}
                    >
                      <Ionicons name="camera-outline" size={16} color={colors.textMuted} />
                      <Text variant="caption" color="textMuted" style={{ fontWeight: '500' }}>
                        {form.photoURL ? "Changer (appareil)" : "Depuis l'appareil"}
                      </Text>
                    </Pressable>

                    {portfolioPhotos.length > 0 && (
                      <Pressable
                        onPress={() => setShowPortfolio((v) => !v)}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: spacing.xs,
                          paddingVertical: spacing.sm,
                          paddingHorizontal: spacing.md,
                          borderRadius: radius.lg,
                          borderWidth: 1,
                          borderColor: showPortfolio ? colors.primary : colors.border,
                          backgroundColor: showPortfolio
                            ? (colors.primaryLight || '#e4effa')
                            : colors.surfaceSecondary,
                        }}
                      >
                        <Ionicons
                          name="folder-open-outline"
                          size={16}
                          color={showPortfolio ? colors.primary : colors.textMuted}
                        />
                        <Text
                          variant="caption"
                          color={showPortfolio ? 'primary' : 'textMuted'}
                          style={{ fontWeight: '500' }}
                        >
                          {form.photoURL ? 'Changer (portfolio)' : 'Depuis le portfolio'}
                        </Text>
                        <Text variant="caption" color="textMuted">
                          ({portfolioPhotos.length})
                        </Text>
                      </Pressable>
                    )}
                  </View>

                  {/* Portfolio gallery — only when explicitly opened */}
                  {showPortfolio && portfolioPhotos.length > 0 && (
                    <View
                      style={{
                        marginTop: spacing.sm,
                        padding: spacing.sm,
                        borderRadius: radius.md,
                        borderWidth: 1,
                        borderColor: colors.border,
                        backgroundColor: colors.surfaceSecondary,
                      }}
                    >
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                        {portfolioPhotos.map((url) => {
                          const isSelected = form.photoURL === url;
                          return (
                            <Pressable
                              key={url}
                              onPress={() => {
                                setForm((p) => ({ ...p, photoURL: url }));
                                setShowPortfolio(false);
                              }}
                              style={{
                                width: '23%',
                                aspectRatio: 1,
                                borderRadius: radius.md,
                                overflow: 'hidden',
                                borderWidth: 2,
                                borderColor: isSelected ? colors.primary : 'transparent',
                              }}
                            >
                              <Image
                                source={{ uri: url }}
                                style={{ width: '100%', height: '100%' }}
                                resizeMode="cover"
                              />
                              {isSelected && (
                                <View
                                  style={{
                                    position: 'absolute',
                                    inset: 0,
                                    backgroundColor: 'rgba(59,130,246,0.25)',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                  }}
                                >
                                  <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                                </View>
                              )}
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  )}
                </View>

                {/* Category — inline picker */}
                {categories.length > 0 && (
                  <View>
                    <Text variant="bodySmall" style={{ fontWeight: '500', marginBottom: spacing.xs, color: colors.text }}>Catégorie</Text>
                    <Pressable
                      onPress={toggleCategoryPicker}
                      style={[styles.selectBtn, { borderColor: expandedPicker === 'category' ? colors.primary : colors.border, borderRadius: radius.lg, padding: spacing.md }]}
                    >
                      <Text variant="body" color={form.categoryId ? 'text' : 'textMuted'}>
                        {getCategoryName(form.categoryId)}
                      </Text>
                      <Ionicons name={expandedPicker === 'category' ? 'chevron-up' : 'chevron-down'} size={20} color={colors.textMuted} />
                    </Pressable>
                    {expandedPicker === 'category' && (
                      <View style={[styles.inlinePicker, { borderColor: colors.border, borderRadius: radius.lg, marginTop: spacing.xs }]}>
                        <Pressable
                          onPress={() => { setForm((p) => ({ ...p, categoryId: null })); setExpandedPicker(null); }}
                          style={[styles.inlinePickerItem, { padding: spacing.sm, paddingHorizontal: spacing.md, backgroundColor: form.categoryId === null ? colors.primaryLight : 'transparent' }]}
                        >
                          <Text variant="bodySmall" color={form.categoryId === null ? 'primary' : 'textMuted'} style={{ flex: 1, fontWeight: form.categoryId === null ? '600' : '400' }}>
                            Sans catégorie
                          </Text>
                          {form.categoryId === null && <Ionicons name="checkmark" size={18} color={colors.primary} />}
                        </Pressable>
                        {categories.map((cat) => (
                          <Pressable
                            key={cat.id}
                            onPress={() => { setForm((p) => ({ ...p, categoryId: cat.id })); setExpandedPicker(null); }}
                            style={[styles.inlinePickerItem, { padding: spacing.sm, paddingHorizontal: spacing.md, backgroundColor: form.categoryId === cat.id ? colors.primaryLight : 'transparent' }]}
                          >
                            <Text variant="bodySmall" color={form.categoryId === cat.id ? 'primary' : 'text'} style={{ flex: 1, fontWeight: form.categoryId === cat.id ? '600' : '400' }}>
                              {cat.name}
                            </Text>
                            {form.categoryId === cat.id && <Ionicons name="checkmark" size={18} color={colors.primary} />}
                          </Pressable>
                        ))}
                      </View>
                    )}
                  </View>
                )}

                {/* Color picker — tints the booking on the calendar.
                    null = fall back to the member's color (existing behavior). */}
                <View>
                  <Text variant="bodySmall" style={{ fontWeight: '500', marginBottom: spacing.xs, color: colors.text }}>
                    Couleur sur le calendrier <Text variant="caption" color="textMuted">(optionnel)</Text>
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    <Pressable
                      onPress={() => setForm((p) => ({ ...p, color: null }))}
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 16,
                        borderWidth: 1.5,
                        borderStyle: 'dashed',
                        borderColor: form.color === null ? colors.text : colors.border,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text variant="caption" color="textMuted" style={{ fontSize: 12 }}>∅</Text>
                    </Pressable>
                    {SERVICE_COLORS.map((c) => {
                      const isSelected = form.color === c;
                      return (
                        <Pressable
                          key={c}
                          onPress={() => setForm((p) => ({ ...p, color: c }))}
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 16,
                            backgroundColor: c,
                            borderWidth: isSelected ? 2 : 0,
                            borderColor: colors.text,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {isSelected && (
                            <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                          )}
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                {/* Duration — hours + minutes inputs */}
                <View>
                  <Text variant="bodySmall" style={{ fontWeight: '500', marginBottom: spacing.xs, color: colors.text }}>Durée</Text>
                  <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
                    <View style={{ flex: 1 }}>
                      <Input
                        label=""
                        placeholder="1"
                        value={form.durationHours}
                        onChangeText={(t) => setForm((p) => ({ ...p, durationHours: t.replace(/[^0-9]/g, '') }))}
                        keyboardType="number-pad"
                      />
                    </View>
                    <Text variant="bodySmall" color="textSecondary" style={{ marginBottom: 4 }}>h</Text>
                    <View style={{ flex: 1 }}>
                      <Input
                        label=""
                        placeholder="0"
                        value={form.durationMinutes}
                        onChangeText={(t) => {
                          const cleaned = t.replace(/[^0-9]/g, '');
                          const val = parseInt(cleaned, 10);
                          if (cleaned === '' || (val >= 0 && val <= 59)) {
                            setForm((p) => ({ ...p, durationMinutes: cleaned }));
                          }
                        }}
                        keyboardType="number-pad"
                      />
                    </View>
                    <Text variant="bodySmall" color="textSecondary" style={{ marginBottom: 4 }}>min</Text>
                  </View>
                </View>

                <Input
                  label="Prix (€)"
                  placeholder="0"
                  value={form.price}
                  onChangeText={(t) => setForm((p) => ({ ...p, price: t }))}
                  keyboardType="decimal-pad"
                />

                <Input
                  label="Description (optionnel)"
                  placeholder="Décrivez cette prestation"
                  value={form.description}
                  onChangeText={(t) => setForm((p) => ({ ...p, description: t }))}
                  multiline
                  numberOfLines={3}
                />
                </EditorSection>

                <EditorSection
                  title="Réglages"
                  subtitle="Temps de battement et acompte"
                  icon="options-outline"
                  defaultOpen={false}
                >
                {/* Buffer time — free input with info box */}
                <View>
                  <Text variant="bodySmall" style={{ fontWeight: '500', marginBottom: spacing.xs, color: colors.text }}>
                    Temps de battement (minutes)
                  </Text>
                  <View style={[styles.infoBox, { backgroundColor: '#EFF6FF', borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.sm }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                      <Ionicons name="information-circle-outline" size={18} color="#3B82F6" style={{ marginTop: 1 }} />
                      <Text variant="caption" style={{ marginLeft: spacing.xs, flex: 1, color: '#1E40AF', lineHeight: 18 }}>
                        Temps de pause automatique ajouté après chaque rendez-vous. Permet de préparer le prochain client, ranger ou se déplacer.
                      </Text>
                    </View>
                  </View>
                  <Input
                    label=""
                    placeholder="0"
                    value={form.bufferTime}
                    onChangeText={(t) => setForm((p) => ({ ...p, bufferTime: t.replace(/[^0-9]/g, '') }))}
                    keyboardType="number-pad"
                  />
                </View>

                {/* Deposit configuration — only when add-on active */}
                {depositsEnabled && (
                  <View>
                    <Text
                      variant="bodySmall"
                      style={{ fontWeight: '500', marginBottom: spacing.sm, color: colors.text }}
                    >
                      Acompte sur cette prestation
                    </Text>
                    {(['inherit', 'custom', 'none'] as DepositMode[]).map((mode) => {
                      const checked = form.depositMode === mode;
                      const labels: Record<DepositMode, string> = {
                        inherit: defaultDepositSettings ? 'Acompte par défaut' : 'Aucun acompte (par défaut)',
                        custom: 'Acompte personnalisé',
                        none: "Pas d'acompte",
                      };
                      const hints: Record<DepositMode, string> = {
                        inherit: defaultDepositSettings
                          ? `${defaultDepositSettings.percent} % du prix · remboursable jusqu'à ${defaultDepositSettings.refundDeadlineHours}h avant le RDV`
                          : "Aucun acompte par défaut configuré → pas d'acompte demandé.",
                        custom: "Remplace l'acompte par défaut avec une valeur spécifique.",
                        none: defaultDepositSettings
                          ? "Désactive explicitement l'acompte sur cette prestation, même si vous avez un acompte par défaut."
                          : "Pas d'acompte demandé sur cette prestation.",
                      };
                      return (
                        <Pressable
                          key={mode}
                          onPress={() => setForm((p) => ({ ...p, depositMode: mode }))}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'flex-start',
                            paddingVertical: spacing.sm,
                            paddingHorizontal: spacing.md,
                            borderRadius: radius.md,
                            borderWidth: 1,
                            borderColor: checked ? colors.primary : colors.border,
                            backgroundColor: checked ? colors.primaryLight : colors.background,
                            marginBottom: spacing.xs,
                          }}
                        >
                          <View
                            style={{
                              width: 18,
                              height: 18,
                              borderRadius: 9,
                              borderWidth: 2,
                              borderColor: checked ? colors.primary : colors.border,
                              alignItems: 'center',
                              justifyContent: 'center',
                              marginTop: 2,
                              marginRight: spacing.sm,
                            }}
                          >
                            {checked && (
                              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary }} />
                            )}
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text variant="bodySmall" style={{ fontWeight: '600', color: colors.text }}>
                              {labels[mode]}
                            </Text>
                            <Text variant="caption" color="textSecondary" style={{ marginTop: 2 }}>
                              {hints[mode]}
                            </Text>
                          </View>
                        </Pressable>
                      );
                    })}

                    {/* Custom deposit form (only when mode === 'custom') */}
                    {form.depositMode === 'custom' && (
                      <View
                        style={{
                          marginTop: spacing.sm,
                          padding: spacing.md,
                          borderRadius: radius.md,
                          backgroundColor: colors.surface,
                          gap: spacing.sm,
                        }}
                      >
                        {/* Type segmented */}
                        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                          {(['percent', 'fixed'] as DepositCustomType[]).map((t) => {
                            const sel = form.depositType === t;
                            return (
                              <Pressable
                                key={t}
                                onPress={() =>
                                  setForm((p) => ({
                                    ...p,
                                    depositType: t,
                                    depositValue: t === 'percent' ? '30' : '10',
                                  }))
                                }
                                style={{
                                  flex: 1,
                                  paddingVertical: spacing.sm,
                                  borderRadius: radius.sm,
                                  borderWidth: 1,
                                  borderColor: sel ? colors.primary : colors.border,
                                  backgroundColor: sel ? colors.primaryLight : colors.background,
                                  alignItems: 'center',
                                }}
                              >
                                <Text
                                  variant="bodySmall"
                                  style={{
                                    fontWeight: sel ? '600' : '400',
                                    color: sel ? colors.primary : colors.textSecondary,
                                  }}
                                >
                                  {t === 'percent' ? 'Pourcentage' : 'Montant fixe'}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </View>

                        <Input
                          label={form.depositType === 'percent' ? 'Pourcentage (%)' : 'Montant (€)'}
                          placeholder={form.depositType === 'percent' ? '30' : '10'}
                          value={form.depositValue}
                          onChangeText={(t) =>
                            setForm((p) => ({
                              ...p,
                              depositValue: t.replace(form.depositType === 'percent' ? /[^0-9]/g : /[^0-9.,]/g, ''),
                            }))
                          }
                          keyboardType={form.depositType === 'percent' ? 'number-pad' : 'decimal-pad'}
                        />
                        <Input
                          label="Délai de remboursement (heures avant le RDV)"
                          placeholder="24"
                          value={form.depositRefundHours}
                          onChangeText={(t) => setForm((p) => ({ ...p, depositRefundHours: t.replace(/[^0-9]/g, '') }))}
                          keyboardType="number-pad"
                        />
                        <Text variant="caption" color="textSecondary">
                          0 = pas de remboursement automatique. Au-delà du délai, l&apos;acompte n&apos;est pas remboursé en cas d&apos;annulation par le client.
                        </Text>
                      </View>
                    )}
                  </View>
                )}

                </EditorSection>

                {(locations.length > 1 || members.length > 1) && (
                  <EditorSection
                    title="Disponibilité"
                    subtitle="Lieux et membres concernés"
                    icon="people-outline"
                    defaultOpen={false}
                  >
                {/* Locations */}
                {locations.length > 1 && (
                  <View>
                    <Text variant="bodySmall" style={{ fontWeight: '500', marginBottom: spacing.sm, color: colors.text }}>Lieux</Text>
                    {locations.map((loc) => (
                      <Pressable
                        key={loc.id}
                        onPress={() => toggleLocationId(loc.id)}
                        style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.xs }}
                      >
                        <Ionicons
                          name={form.locationIds.includes(loc.id) ? 'checkbox' : 'square-outline'}
                          size={22}
                          color={form.locationIds.includes(loc.id) ? colors.primary : colors.textMuted}
                        />
                        <Text variant="body" style={{ marginLeft: spacing.sm }}>{loc.name}</Text>
                      </Pressable>
                    ))}
                  </View>
                )}

                {/* Members with color dots */}
                {members.length > 1 && (
                  <View>
                    <Text variant="bodySmall" style={{ fontWeight: '500', marginBottom: spacing.sm, color: colors.text }}>
                      Membres
                    </Text>
                    {/* "Tous" toggle */}
                    <Pressable
                      onPress={() => setForm((p) => ({ ...p, memberIds: null }))}
                      style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.xs }}
                    >
                      <Ionicons
                        name={form.memberIds === null ? 'radio-button-on' : 'radio-button-off'}
                        size={22}
                        color={form.memberIds === null ? colors.primary : colors.textMuted}
                      />
                      <Ionicons name="people-outline" size={16} color={form.memberIds === null ? colors.primary : colors.textMuted} style={{ marginLeft: spacing.sm }} />
                      <Text variant="body" style={{ marginLeft: spacing.xs, fontWeight: form.memberIds === null ? '600' : '400', color: form.memberIds === null ? colors.primary : colors.text }}>
                        Tous les membres
                      </Text>
                    </Pressable>
                    {/* Individual members */}
                    {members.map((mbr) => {
                      const isSelected = (form.memberIds || []).includes(mbr.id);
                      return (
                        <Pressable
                          key={mbr.id}
                          onPress={() => {
                            if (form.memberIds === null) {
                              // Switching from "all" to specific: select only this one
                              setForm((p) => ({ ...p, memberIds: [mbr.id] }));
                            } else {
                              toggleMemberId(mbr.id);
                            }
                          }}
                          style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.xs }}
                        >
                          <Ionicons
                            name={isSelected ? 'checkbox' : 'square-outline'}
                            size={22}
                            color={isSelected ? colors.primary : colors.textMuted}
                          />
                          <View style={[styles.memberDot, { backgroundColor: mbr.color || colors.primary, marginLeft: spacing.sm }]} />
                          <Text variant="body" style={{ marginLeft: spacing.xs }}>{mbr.name}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
                  </EditorSection>
                )}

                <EditorSection
                  title="Variations & options"
                  subtitle="Choix, suppléments et infos demandées au client"
                  icon="construct-outline"
                  open={choicesExpanded}
                  onToggle={() => setChoicesExpanded((v) => !v)}
                >
                  <View style={{ gap: spacing.xs }}>
                    <Text variant="bodySmall" style={{ fontWeight: '600', color: colors.text }}>
                      Variations
                    </Text>
                    <Text variant="caption" color="textSecondary">
                      Des choix exclusifs qui fixent le prix et la durée (ex : Longueur).
                    </Text>
                    <VariationsEditor
                      variations={form.variations}
                      onChange={(n) => setForm((p) => ({ ...p, variations: n }))}
                    />
                  </View>

                  <View style={{ gap: spacing.xs }}>
                    <Text variant="bodySmall" style={{ fontWeight: '600', color: colors.text }}>
                      Options
                    </Text>
                    <Text variant="caption" color="textSecondary">
                      Des suppléments à cocher (ex : Mèches).
                    </Text>
                    <OptionsEditor
                      options={form.options}
                      onChange={(n) => setForm((p) => ({ ...p, options: n }))}
                    />
                  </View>

                  <View style={{ gap: spacing.xs }}>
                    <Text variant="bodySmall" style={{ fontWeight: '600', color: colors.text }}>
                      Infos demandées
                    </Text>
                    <Text variant="caption" color="textSecondary">
                      Des questions au client, sans impact sur le prix.
                    </Text>
                    <InfoFieldsEditor
                      fields={form.infoFields}
                      onChange={(n) => setForm((p) => ({ ...p, infoFields: n }))}
                    />
                  </View>
                </EditorSection>
              </View>
            </ScrollView>

            {/* Floating "client preview" button — above the sticky footer */}
            <Pressable
              onPress={() => setShowPreview(true)}
              style={{
                position: 'absolute',
                right: spacing.lg,
                bottom: insets.bottom + 80,
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.xs,
                paddingVertical: spacing.sm,
                paddingHorizontal: spacing.md,
                borderRadius: 999,
                backgroundColor: colors.text,
                shadowColor: '#000',
                shadowOpacity: 0.2,
                shadowRadius: 8,
                shadowOffset: { width: 0, height: 3 },
                elevation: 5,
              }}
            >
              <Ionicons name="eye-outline" size={18} color={colors.background} />
              <Text variant="bodySmall" style={{ fontWeight: '700', color: colors.background }}>
                Aperçu client
              </Text>
            </Pressable>

            {/* Save Button */}
            <View style={[styles.stickyFooter, { padding: spacing.lg, paddingBottom: insets.bottom + spacing.sm, borderTopColor: colors.border }]}>
              <Button
                variant="primary"
                title={isSaving ? 'Enregistrement...' : 'Enregistrer'}
                onPress={handleSave}
                loading={isSaving}
                disabled={isSaving}
                fullWidth
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Client preview Modal ── */}
      <Modal
        visible={showPreview}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPreview(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              { backgroundColor: colors.background, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl },
            ]}
          >
            <View style={[styles.modalHeader, { padding: spacing.lg, borderBottomColor: colors.border }]}>
              <Text variant="h3">Aperçu client</Text>
              <Pressable onPress={() => setShowPreview(false)}>
                <Ionicons name="close-circle" size={28} color={colors.textMuted} />
              </Pressable>
            </View>
            <ServiceChoicesPreview
              service={{
                name: form.name,
                price: Math.round((parseFloat(form.price) || 0) * 100),
                duration: hoursMinutesToMinutes(form.durationHours, form.durationMinutes),
                variations: sanitizeVariations(form.variations),
                options: sanitizeOptions(form.options),
                infoFields: sanitizeInfoFields(form.infoFields),
              }}
            />
          </View>
        </View>
      </Modal>

      {/* ── Category Create/Edit Modal ── */}
      <Modal visible={showCategoryModal} transparent animationType="fade">
        <View style={styles.categoryModalOverlay}>
          <View style={[styles.categoryModalContent, { backgroundColor: colors.background, borderRadius: radius.xl }]}>
            <Text variant="h3" style={{ marginBottom: spacing.md }}>
              {editingCategoryId ? 'Modifier la catégorie' : 'Nouvelle catégorie'}
            </Text>
            <Input
              label="Nom"
              placeholder="Ex: Soins visage"
              value={categoryName}
              onChangeText={setCategoryName}
              autoCapitalize="sentences"
              autoFocus
            />
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg }}>
              {editingCategoryId && (
                <Pressable
                  onPress={() => {
                    setShowCategoryModal(false);
                    const cat = categories.find((c) => c.id === editingCategoryId);
                    if (cat) handleDeleteCategory(cat);
                  }}
                  style={[styles.categoryDeleteBtn, { borderColor: '#DC2626' }]}
                >
                  <Ionicons name="trash-outline" size={20} color="#DC2626" />
                </Pressable>
              )}
              <Pressable
                onPress={() => setShowCategoryModal(false)}
                style={[styles.categoryActionBtn, { borderColor: colors.border, flex: 1 }]}
              >
                <Text variant="body" style={{ fontWeight: '600' }}>Annuler</Text>
              </Pressable>
              <Pressable
                onPress={handleSaveCategory}
                disabled={isSavingCategory || !categoryName.trim()}
                style={[styles.categoryActionBtn, { backgroundColor: colors.primary, flex: 1, opacity: (!categoryName.trim() || isSavingCategory) ? 0.5 : 1 }]}
              >
                <Text variant="body" style={{ fontWeight: '600', color: '#FFFFFF' }}>
                  {isSavingCategory ? 'Enregistrement...' : 'Enregistrer'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { borderBottomWidth: 1 },
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  addBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  countBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, minWidth: 24, alignItems: 'center' },
  emptyState: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 24 },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center' },
  selectBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalContent: { maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1 },
  stickyFooter: { borderTopWidth: 1 },
  // Inline picker
  inlinePicker: { borderWidth: 1, overflow: 'hidden' },
  inlinePickerItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  // Info box
  infoBox: {},
  // Member color dot
  memberDot: { width: 12, height: 12, borderRadius: 6 },
  // Category modal
  categoryModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  categoryModalContent: { width: '100%', padding: 24 },
  categoryDeleteBtn: { width: 48, height: 48, borderRadius: 12, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  categoryActionBtn: { paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: 'transparent', alignItems: 'center' },
  // Member chips on service cards
  memberChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  memberChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, gap: 5 },
  memberChipDot: { width: 6, height: 6, borderRadius: 3 },
  memberChipText: { fontSize: 11, fontWeight: '600' },
});
