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
import type { Service, ServiceCategory, Location, Member } from '@booking-app/shared/types';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'react-native';
import { uploadFile, storagePaths } from '@booking-app/firebase/storage';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ServiceFormData {
  name: string;
  description: string;
  photoURL: string | null;
  durationHours: string;
  durationMinutes: string;
  price: string;
  priceMax: string;
  isPriceRange: boolean;
  bufferTime: string;
  isActive: boolean;
  locationIds: string[];
  memberIds: string[] | null;
  categoryId: string | null;
}

const DEFAULT_FORM: ServiceFormData = {
  name: '',
  description: '',
  photoURL: null,
  durationHours: '1',
  durationMinutes: '0',
  price: '',
  priceMax: '',
  isPriceRange: false,
  bufferTime: '0',
  isActive: true,
  locationIds: [],
  memberIds: null,
  categoryId: null,
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

// ---------------------------------------------------------------------------
// Main Screen
// ---------------------------------------------------------------------------

export default function ServicesScreen() {
  const { colors, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { showToast } = useToast();
  const { provider, providerId } = useProvider();

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
    setShowModal(true);
  };

  const openEdit = (service: WithId<Service>) => {
    setEditingId(service.id);
    const { hours, minutes } = minutesToHoursMinutes(service.duration);
    setForm({
      name: service.name,
      description: service.description || '',
      photoURL: service.photoURL || null,
      durationHours: hours,
      durationMinutes: minutes,
      price: String(service.price / 100),
      priceMax: service.priceMax ? String(service.priceMax / 100) : '',
      isPriceRange: !!service.priceMax,
      bufferTime: String(service.bufferTime),
      isActive: service.isActive,
      locationIds: service.locationIds || [],
      memberIds: service.memberIds,
      categoryId: service.categoryId || null,
    });
    setExpandedPicker(null);
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
      const priceMaxCents = form.isPriceRange && form.priceMax.trim()
        ? Math.round(Number(form.priceMax) * 100)
        : null;
      const priceCents = Math.round(Number(form.price) * 100);

      if (priceMaxCents !== null && priceMaxCents <= priceCents) {
        showToast({ variant: 'error', message: 'Le prix max doit être supérieur au prix min' });
        setIsSaving(false);
        return;
      }

      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        photoURL: form.photoURL,
        duration: totalDuration,
        price: priceCents,
        priceMax: priceMaxCents,
        bufferTime: bufferTimeValue,
        isActive: form.isActive,
        locationIds: form.locationIds,
        memberIds: form.memberIds,
        categoryId: form.categoryId,
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
              <View style={{ gap: spacing.md }}>
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

                  {form.photoURL ? (
                    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm }}>
                      <View style={{ position: 'relative' }}>
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
                          }
                        }}
                        style={{ paddingVertical: spacing.xs }}
                      >
                        <Text variant="caption" color="primary" style={{ fontWeight: '500' }}>
                          Changer
                        </Text>
                      </Pressable>
                    </View>
                  ) : (
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
                        }
                      }}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: spacing.sm,
                        paddingVertical: spacing.md,
                        paddingHorizontal: spacing.md,
                        borderRadius: radius.lg,
                        borderWidth: 1,
                        borderStyle: 'dashed',
                        borderColor: colors.border,
                      }}
                    >
                      <Ionicons name="image-outline" size={20} color={colors.textMuted} />
                      <Text variant="bodySmall" color="textMuted" style={{ fontWeight: '500' }}>
                        Ajouter une photo
                      </Text>
                    </Pressable>
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
                  label={form.isPriceRange ? 'Prix min (€)' : 'Prix (€)'}
                  placeholder="0"
                  value={form.price}
                  onChangeText={(t) => setForm((p) => ({ ...p, price: t }))}
                  keyboardType="decimal-pad"
                />

                {form.isPriceRange && (
                  <Input
                    label="Prix max (€)"
                    placeholder="0"
                    value={form.priceMax}
                    onChangeText={(t) => setForm((p) => ({ ...p, priceMax: t }))}
                    keyboardType="decimal-pad"
                  />
                )}

                {/* Price options */}
                <View style={{ flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap' }}>
                  <Pressable
                    onPress={() => {
                      setForm((p) => ({
                        ...p,
                        isPriceRange: !p.isPriceRange,
                        priceMax: !p.isPriceRange ? '' : '',
                      }));
                    }}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
                  >
                    <Ionicons
                      name={form.isPriceRange ? 'checkbox' : 'square-outline'}
                      size={20}
                      color={form.isPriceRange ? colors.primary : colors.textMuted}
                    />
                    <Text variant="bodySmall" color={form.isPriceRange ? 'primary' : 'textSecondary'} style={{ fontWeight: form.isPriceRange ? '600' : '400' }}>
                      Fourchette de prix
                    </Text>
                  </Pressable>
                </View>

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

                <Input
                  label="Description (optionnel)"
                  placeholder="Décrivez cette prestation"
                  value={form.description}
                  onChangeText={(t) => setForm((p) => ({ ...p, description: t }))}
                  multiline
                  numberOfLines={3}
                />

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
              </View>
            </ScrollView>

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
