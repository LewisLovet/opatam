/**
 * Services Management Screen
 * List, create, edit, delete, toggle active/inactive services.
 * Services are grouped by category with category CRUD support.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Platform,
  Animated,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import i18n from '../../lib/i18n';
import { Text, Button, Input, Card, useToast } from '../../components';
import { useProvider } from '../../contexts';
import {
  serviceRepository,
  serviceCategoryRepository,
  locationRepository,
  memberRepository,
  providerService,
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
  LoyaltySettings,
} from '@booking-app/shared/types';
import {
  resolveDeposit,
  getActiveDiscount,
  buildServiceDiscountPreview,
  resolveExcludedIds,
  getServiceMinPrice,
  hasDepositAccess,
  hasLoyaltyAccess,
  isLoyaltyConfigValid,
  SERVICE_COLORS,
  sanitizeVariations,
  sanitizeOptions,
  sanitizeInfoFields,
  type DiscountPreviewRow,
  type ServiceDiscountPreview,
} from '@booking-app/shared';
import {
  VariationsEditor,
  OptionsEditor,
  InfoFieldsEditor,
} from '../../components/business/ServiceChoicesEditor';
import { EditorSection } from '../../components/business/EditorSection';
import { ServiceChoicesPreview } from '../../components/business/ServiceChoicesPreview';
import { OverlaySheet } from '../../components/OverlaySheet';
import { KeyboardAvoidingSheet } from '../../components/KeyboardAvoidingSheet';
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
  // Promotion (percentage). Empty/disabled = no promo on this service.
  discountEnabled: boolean;
  discountPercent: string;
  /** Variation-option / option ids excluded from the promo (per-line). */
  discountExcludedIds: string[];
  discountStartsAt: string | null; // YYYY-MM-DD inclusive
  discountEndsAt: string | null;
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
  discountEnabled: false,
  discountPercent: '10',
  discountExcludedIds: [],
  discountStartsAt: null,
  discountEndsAt: null,
  variations: [],
  options: [],
  infoFields: [],
};

// Promo date helpers — store as YYYY-MM-DD (local), bridge to/from Date for the
// native picker.
function ymdToDate(ymd: string | null): Date {
  if (!ymd) return new Date();
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}
function dateToYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
// Locale for date/number formatting, following the current app language.
function dateLocale(): string {
  return i18n.language === 'en' ? 'en-GB' : 'fr-FR';
}
function formatPromoDate(ymd: string): string {
  return ymdToDate(ymd).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short', year: 'numeric' });
}

function euroCents(cents: number): string {
  if (cents === 0) return i18n.t('common.free');
  return new Intl.NumberFormat(dateLocale(), { style: 'currency', currency: 'EUR' }).format(cents / 100);
}

/** A "12 € → 9,60 €" preview line. When `onToggle` is set, the row is tappable
 *  (checkbox + greyed "non incluse") to include/exclude it from the promo. */
function PromoPriceRow({ row, onToggle }: { row: DiscountPreviewRow; onToggle?: () => void }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const reduced = row.applies && row.discounted < row.original;
  const content = (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, paddingVertical: 2 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
        {onToggle && (
          <View style={{ width: 18, height: 18, borderRadius: 4, borderWidth: row.applies ? 0 : 1.5, borderColor: colors.border, backgroundColor: row.applies ? '#E11D48' : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
            {row.applies && <Ionicons name="checkmark" size={13} color="#fff" />}
          </View>
        )}
        <Text variant="bodySmall" style={{ flex: 1, color: row.applies ? colors.text : colors.textMuted }} numberOfLines={1}>
          {row.name}
        </Text>
      </View>
      {reduced ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text variant="bodySmall" style={{ color: colors.textMuted, textDecorationLine: 'line-through' }}>
            {euroCents(row.original)}
          </Text>
          <Text variant="bodySmall" style={{ color: '#E11D48', fontWeight: '600' }}>
            {euroCents(row.discounted)}
          </Text>
        </View>
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text variant="bodySmall" color="textSecondary">{euroCents(row.original)}</Text>
          {onToggle && !row.applies && (
            <Text variant="caption" color="textMuted" style={{ fontSize: 10 }}>{t('proServices.promo.preview.notIncluded')}</Text>
          )}
        </View>
      )}
    </View>
  );
  return onToggle ? <Pressable onPress={onToggle}>{content}</Pressable> : content;
}

/** Provider-facing, interactive before/after breakdown. Tap a variation/option
 *  line to include or exclude it from the promo. */
function PromoPreview({ preview, onToggleLine }: { preview: ServiceDiscountPreview; onToggleLine: (id: string) => void }) {
  const { colors, spacing, radius } = useTheme();
  const { t } = useTranslation();
  const hasLines = preview.variations.length > 0 || preview.options.length > 0;
  return (
    <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface, padding: spacing.sm, gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text variant="caption" color="textSecondary" style={{ fontWeight: '700', textTransform: 'uppercase' }}>
          {t('proServices.promo.preview.title')}
        </Text>
        <View style={{ backgroundColor: '#E11D48', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 }}>
          <Text variant="caption" style={{ color: '#fff', fontWeight: '700', fontSize: 10 }}>−{preview.percent}%</Text>
        </View>
      </View>
      {hasLines && (
        <Text variant="caption" color="textMuted">
          {t('proServices.promo.preview.tapHint')}
        </Text>
      )}
      {preview.base && (
        <PromoPriceRow row={{ id: null, name: t('proServices.promo.preview.baseService'), original: preview.base.original, discounted: preview.base.discounted, applies: true }} />
      )}
      {preview.variations.map((g, gi) => (
        <View key={gi} style={{ gap: 2 }}>
          <Text variant="caption" color="textMuted" style={{ fontWeight: '500' }}>{g.name}</Text>
          <View style={{ gap: 2, paddingLeft: spacing.sm, borderLeftWidth: 2, borderLeftColor: colors.border }}>
            {g.rows.map((r) => <PromoPriceRow key={r.id} row={r} onToggle={() => onToggleLine(r.id!)} />)}
          </View>
        </View>
      ))}
      {preview.options.length > 0 && (
        <View style={{ gap: 2 }}>
          <Text variant="caption" color="textMuted" style={{ fontWeight: '500' }}>{t('proServices.promo.preview.optionsGroup')}</Text>
          <View style={{ gap: 2, paddingLeft: spacing.sm, borderLeftWidth: 2, borderLeftColor: colors.border }}>
            {preview.options.map((r) => <PromoPriceRow key={r.id} row={r} onToggle={() => onToggleLine(r.id!)} />)}
          </View>
        </View>
      )}
    </View>
  );
}

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
  if (cents === 0 && !centsMax) return i18n.t('common.free');
  const fmt = (v: number) =>
    new Intl.NumberFormat(dateLocale(), { style: 'currency', currency: 'EUR' }).format(v / 100);
  if (centsMax && centsMax > cents) {
    return i18n.t('proServices.priceRange', { min: fmt(cents), max: fmt(centsMax) });
  }
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
  const { t } = useTranslation();
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
          {t('proServices.badge.noDeposit')}
        </Text>
      </View>
    );
  }

  const resolved = resolveDeposit(
    { price: service.price, deposit: service.deposit },
    { depositDefault: defaultDeposit },
  );
  if (!resolved || resolved.amount === 0) return null;
  const amount = euroCents(resolved.amount);
  const suffix =
    resolved.source === 'service'
      ? t('proServices.badge.sourceCustom')
      : t('proServices.badge.sourceDefault');
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
        {t('proServices.badge.deposit', { amount, source: suffix })}
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
  const { t } = useTranslation();
  const { provider, providerId } = useProvider();

  // Deposit gates (used to decide whether to show the badge).
  // hasDepositAccess = paid add-on, comp, or free base trial.
  const depositsEnabled =
    hasDepositAccess(provider) &&
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

  // Global (shop-wide) promotion modal state.
  const [globalPromoOpen, setGlobalPromoOpen] = useState(false);
  const [gSaving, setGSaving] = useState(false);
  const [gDateField, setGDateField] = useState<'start' | 'end' | null>(null);
  const [gForm, setGForm] = useState({
    enabled: false,
    percent: '10',
    includeExtras: true,
    startsAt: null as string | null,
    endsAt: null as string | null,
  });

  const openGlobalPromo = () => {
    const g = provider?.settings?.globalDiscount ?? null;
    setGForm({
      enabled: !!g,
      percent: g ? String(g.percent) : '10',
      includeExtras: g?.includeExtras ?? true,
      startsAt: g?.startsAt ?? null,
      endsAt: g?.endsAt ?? null,
    });
    setGlobalPromoOpen(true);
  };

  const saveGlobalPromo = async () => {
    if (!providerId) return;
    let globalDiscount: Service['discount'] | null = null;
    if (gForm.enabled) {
      const pct = Number(gForm.percent);
      if (!Number.isFinite(pct) || pct < 1 || pct > 100) {
        showToast({ variant: 'error', message: t('proServices.errors.percentRange') });
        return;
      }
      if (gForm.startsAt && gForm.endsAt && gForm.startsAt > gForm.endsAt) {
        showToast({ variant: 'error', message: t('proServices.errors.endAfterStart') });
        return;
      }
      globalDiscount = {
        percent: Math.round(pct),
        includeExtras: gForm.includeExtras,
        startsAt: gForm.startsAt,
        endsAt: gForm.endsAt,
      };
    }
    setGSaving(true);
    try {
      await providerService.updateSettings(providerId, { globalDiscount });
      showToast({
        variant: 'success',
        message: gForm.enabled ? t('proServices.globalPromo.saved') : t('proServices.globalPromo.disabled'),
      });
      setGlobalPromoOpen(false);
    } catch {
      showToast({ variant: 'error', message: t('common.error') });
    } finally {
      setGSaving(false);
    }
  };

  // Carte de fidélité — settings sheet state. Gated by hasLoyaltyAccess
  // (paid plan / registered card / comp): locked pros get an upsell card
  // that routes to the paywall instead of the editor.
  const loyaltyAccess = hasLoyaltyAccess(provider);
  const [loyaltyOpen, setLoyaltyOpen] = useState(false);
  const [lSaving, setLSaving] = useState(false);
  const [lForm, setLForm] = useState({
    enabled: false,
    threshold: '5',
    rewardType: 'percent' as LoyaltySettings['rewardType'],
    rewardValue: '10',
    /** Opt-out model — ids listed here are NOT eligible (same as promos). */
    excludedServiceIds: [] as string[],
  });

  const openLoyalty = () => {
    if (!loyaltyAccess) {
      router.push('/(pro)/paywall' as any);
      return;
    }
    const l = provider?.settings?.loyalty ?? null;
    setLForm({
      enabled: !!l?.enabled,
      threshold: l ? String(l.threshold) : '5',
      rewardType: l?.rewardType ?? 'percent',
      // Amounts are stored in cents but edited in euros.
      rewardValue: l
        ? l.rewardType === 'amount'
          ? String(l.rewardValue / 100)
          : String(l.rewardValue)
        : '10',
      excludedServiceIds: l?.excludedServiceIds ?? [],
    });
    setLoyaltyOpen(true);
  };

  const saveLoyalty = async () => {
    if (!providerId) return;
    const existing = provider?.settings?.loyalty ?? null;
    let loyalty: LoyaltySettings | null;
    if (lForm.enabled) {
      const threshold = Number(lForm.threshold);
      if (!Number.isInteger(threshold) || threshold < 1) {
        showToast({ variant: 'error', message: t('proLoyalty.errors.threshold') });
        return;
      }
      let rewardValue: number;
      if (lForm.rewardType === 'percent') {
        rewardValue = Math.round(Number(lForm.rewardValue));
        if (!Number.isFinite(rewardValue) || rewardValue < 1 || rewardValue > 100) {
          showToast({ variant: 'error', message: t('proLoyalty.errors.percentRange') });
          return;
        }
      } else {
        rewardValue = Math.round(Number(lForm.rewardValue.replace(',', '.')) * 100);
        if (!Number.isFinite(rewardValue) || rewardValue < 100) {
          showToast({ variant: 'error', message: t('proLoyalty.errors.amountMin') });
          return;
        }
      }
      loyalty = {
        enabled: true,
        threshold,
        rewardType: lForm.rewardType,
        rewardValue,
        excludedServiceIds: lForm.excludedServiceIds,
      };
    } else {
      // Toggled off: keep the previous config (so re-enabling restores it)
      // but flag it disabled. Never configured → stay null.
      loyalty = existing ? { ...existing, enabled: false } : null;
    }
    setLSaving(true);
    try {
      await providerService.updateSettings(providerId, { loyalty });
      showToast({
        variant: 'success',
        message: lForm.enabled ? t('proLoyalty.saved') : t('proLoyalty.disabledToast'),
      });
      setLoyaltyOpen(false);
    } catch {
      showToast({ variant: 'error', message: t('common.error') });
    } finally {
      setLSaving(false);
    }
  };

  // Inline picker expanded state (inside the form modal)
  const [expandedPicker, setExpandedPicker] = useState<'category' | null>(null);

  // Portfolio picker — collapsed by default, shown when the user wants to
  // pick an existing portfolio photo instead of uploading a new one.
  const [showPortfolio, setShowPortfolio] = useState(false);
  const portfolioPhotos = provider?.portfolioPhotos ?? [];

  // Whether the "Variations & options" section of the form is expanded.
  const [choicesExpanded, setChoicesExpanded] = useState(false);
  // Which promo date is being picked ('start' | 'end' | null).
  const [promoDateField, setPromoDateField] = useState<'start' | 'end' | null>(null);
  // Client-view preview overlay (floating "Aperçu" button).
  const [showPreview, setShowPreview] = useState(false);
  // Gentle permanent "breathing" of the floating preview button so the pro
  // always knows the client preview lives there (mirrors the web editor).
  const previewBreath = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(previewBreath, { toValue: 1, duration: 1400, useNativeDriver: true }),
        Animated.timing(previewBreath, { toValue: 0, duration: 1400, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [previewBreath]);
  // Service whose "Déplacer vers une catégorie" sheet is open (null = closed).
  const [moveTarget, setMoveTarget] = useState<WithId<Service> | null>(null);

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
      showToast({ variant: 'error', message: t('proServices.loadError') });
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
      showToast({ variant: 'error', message: t('proServices.errors.nameRequired') });
      return;
    }
    setIsSavingCategory(true);
    try {
      if (editingCategoryId) {
        await serviceCategoryRepository.update(providerId, editingCategoryId, { name: categoryName.trim() });
        showToast({ variant: 'success', message: t('proServices.toasts.categoryUpdated') });
      } else {
        await serviceCategoryRepository.create(providerId, {
          name: categoryName.trim(),
          sortOrder: categories.length,
          isActive: true,
        });
        showToast({ variant: 'success', message: t('proServices.toasts.categoryCreated') });
      }
      setShowCategoryModal(false);
      loadData();
    } catch (err: any) {
      showToast({ variant: 'error', message: err?.message || t('common.error') });
    } finally {
      setIsSavingCategory(false);
    }
  };

  const handleDeleteCategory = (cat: WithId<ServiceCategory>) => {
    const count = services.filter((s) => s.categoryId === cat.id).length;
    Alert.alert(
      t('proServices.deleteCategory.title'),
      count > 0
        ? t('proServices.deleteCategory.messageWithServices', { name: cat.name, count })
        : t('proServices.deleteCategory.messageEmpty', { name: cat.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('proServices.deleteConfirm'),
          style: 'destructive',
          onPress: async () => {
            if (!providerId) return;
            try {
              const affectedServices = services.filter((s) => s.categoryId === cat.id);
              for (const s of affectedServices) {
                await serviceRepository.update(providerId, s.id, { categoryId: null });
              }
              await serviceCategoryRepository.delete(providerId, cat.id);
              showToast({ variant: 'success', message: t('proServices.toasts.categoryDeleted') });
              loadData();
            } catch (err: any) {
              showToast({ variant: 'error', message: err?.message || t('common.error') });
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
      discountEnabled: !!service.discount,
      discountPercent: service.discount ? String(service.discount.percent) : '10',
      // Migrate legacy includeExtras into the per-line excludedIds model.
      discountExcludedIds: service.discount ? Array.from(resolveExcludedIds(service, service.discount)) : [],
      discountStartsAt: service.discount?.startsAt ?? null,
      discountEndsAt: service.discount?.endsAt ?? null,
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
      showToast({ variant: 'error', message: t('proServices.errors.nameRequired') });
      return;
    }
    if (!form.price.trim() || isNaN(Number(form.price)) || Number(form.price) < 0) {
      showToast({ variant: 'error', message: t('proServices.errors.pricePositive') });
      return;
    }
    const totalDuration = hoursMinutesToMinutes(form.durationHours, form.durationMinutes);
    if (totalDuration <= 0) {
      showToast({ variant: 'error', message: t('proServices.errors.durationPositive') });
      return;
    }
    if (form.locationIds.length === 0) {
      showToast({ variant: 'error', message: t('proServices.errors.locationRequired') });
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
          showToast({ variant: 'error', message: t('proServices.errors.depositPositive') });
          setIsSaving(false);
          return;
        }
        if (form.depositType === 'percent' && valueRaw > 100) {
          showToast({ variant: 'error', message: t('proServices.errors.depositPercentMax') });
          setIsSaving(false);
          return;
        }
        const valueCents =
          form.depositType === 'fixed' ? Math.round(valueRaw * 100) : Math.round(valueRaw);
        if (form.depositType === 'fixed' && valueCents > priceCents) {
          showToast({ variant: 'error', message: t('proServices.errors.depositFixedMax') });
          setIsSaving(false);
          return;
        }
        depositPayload = {
          type: form.depositType,
          value: valueCents,
          refundDeadlineHours: Math.max(0, Math.min(720, Math.round(hoursRaw) || 24)),
        };
      }

      // Build the promotion payload (percentage). null = no promo.
      let discountPayload: Service['discount'] | null = null;
      if (form.discountEnabled) {
        const pct = Number(form.discountPercent);
        if (!Number.isFinite(pct) || pct < 1 || pct > 100) {
          showToast({ variant: 'error', message: t('proServices.errors.percentRange') });
          setIsSaving(false);
          return;
        }
        if (
          form.discountStartsAt &&
          form.discountEndsAt &&
          form.discountStartsAt > form.discountEndsAt
        ) {
          showToast({ variant: 'error', message: t('proServices.errors.endAfterStart') });
          setIsSaving(false);
          return;
        }
        discountPayload = {
          percent: Math.round(pct),
          excludedIds: form.discountExcludedIds,
          startsAt: form.discountStartsAt,
          endsAt: form.discountEndsAt,
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
        discount: discountPayload,
        variations: sanitizeVariations(form.variations),
        options: sanitizeOptions(form.options),
        infoFields: sanitizeInfoFields(form.infoFields),
      };

      if (editingId) {
        await serviceRepository.update(providerId, editingId, payload);
        showToast({ variant: 'success', message: t('proServices.toasts.serviceUpdated') });
      } else {
        await serviceRepository.create(providerId, {
          ...payload,
          sortOrder: services.length,
        });
        showToast({ variant: 'success', message: t('proServices.toasts.serviceCreated') });
      }

      setShowModal(false);
      loadData();
    } catch (err: any) {
      showToast({ variant: 'error', message: err?.message || t('common.error') });
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
      showToast({ variant: 'error', message: err?.message || t('common.error') });
    }
  };

  const handleDelete = (service: WithId<Service>) => {
    Alert.alert(
      t('proServices.deleteService.title'),
      t('proServices.deleteService.message', { name: service.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('proServices.deleteConfirm'),
          style: 'destructive',
          onPress: async () => {
            if (!providerId) return;
            try {
              await serviceRepository.delete(providerId, service.id);
              showToast({ variant: 'success', message: t('proServices.toasts.serviceDeleted') });
              loadData();
            } catch (err: any) {
              showToast({ variant: 'error', message: err?.message || t('common.error') });
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
    if (!id) return t('proServices.noCategory');
    return categories.find((c) => c.id === id)?.name || t('proServices.noCategory');
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

    // Promotion badge — service's own promo wins, else the shop-wide one (so a
    // global promo shows on every prestation too).
    const ownActive = getActiveDiscount(service.discount);
    const globalActive = getActiveDiscount(provider?.settings?.globalDiscount ?? null);
    const effectiveActive = ownActive ?? globalActive;
    const fromGlobal = !ownActive && !!globalActive;
    const ownInactive = !!service.discount && !ownActive && !globalActive;

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
                    <Text variant="caption" style={{ color: '#DC2626', fontWeight: '600', fontSize: 10 }}>{t('proServices.inactiveBadge')}</Text>
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
              {(effectiveActive || ownInactive) && (
                <View style={{ flexDirection: 'row', marginTop: 4 }}>
                  <View
                    style={[
                      styles.badge,
                      {
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 3,
                        backgroundColor: effectiveActive ? 'rgba(225,29,72,0.12)' : '#F4F4F5',
                      },
                    ]}
                  >
                    <Ionicons
                      name="pricetag"
                      size={10}
                      color={effectiveActive ? '#E11D48' : '#71717A'}
                    />
                    <Text
                      variant="caption"
                      style={{
                        color: effectiveActive ? '#E11D48' : '#71717A',
                        fontWeight: '600',
                        fontSize: 10,
                      }}
                    >
                      {effectiveActive
                        ? fromGlobal
                          ? t('proServices.promo.badgeActiveGlobal', { percent: effectiveActive.percent })
                          : t('proServices.promo.badgeActive', { percent: effectiveActive.percent })
                        : t('proServices.promo.badgeInactive', { percent: service.discount!.percent })}
                    </Text>
                  </View>
                </View>
              )}
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
                        {t('proServices.availability.allMembers')}
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
            <View style={{ alignItems: 'center', gap: spacing.sm }}>
              {categories.length > 0 && (
                <Pressable
                  onPress={(e) => { e.stopPropagation(); setMoveTarget(service); }}
                  hitSlop={12}
                  style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1, padding: 4 })}
                >
                  <Ionicons name="folder-outline" size={19} color={colors.textMuted} />
                </Pressable>
              )}
              <Pressable
                onPress={(e) => { e.stopPropagation(); handleDelete(service); }}
                hitSlop={12}
                style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1, padding: 4 })}
              >
                <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
              </Pressable>
            </View>
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

  // Move a service to another category. (Drag & drop was dropped: the DnD
  // lib was incompatible with this React version — replaced by a reliable
  // "Déplacer vers…" picker triggered from each card.)
  const moveServiceToCategory = async (
    service: WithId<Service>,
    categoryId: string | null,
  ) => {
    setMoveTarget(null);
    if (!providerId || (service.categoryId ?? null) === categoryId) return;
    setServices((prev) =>
      prev.map((s) => (s.id === service.id ? { ...s, categoryId } : s)),
    ); // optimistic
    try {
      await serviceRepository.update(providerId, service.id, { categoryId });
      showToast({ variant: 'success', message: t('proServices.toasts.serviceMoved') });
    } catch {
      showToast({ variant: 'error', message: t('proServices.toasts.moveFailed') });
      loadData();
    }
  };

  const renderCategoryBand = (
    label: string,
    count: number,
    opts: { collapsed?: boolean; onToggle?: () => void; onEdit?: () => void; accent: string },
  ) => (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        marginTop: spacing.lg,
        marginBottom: spacing.xs,
        backgroundColor: colors.surfaceSecondary,
        borderRadius: radius.lg,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        borderLeftWidth: 3,
        borderLeftColor: opts.accent,
      }}
    >
      <Pressable
        onPress={opts.onToggle}
        disabled={!opts.onToggle}
        hitSlop={8}
        style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 }}
      >
        <Ionicons
          name={opts.collapsed ? 'chevron-forward' : 'chevron-down'}
          size={18}
          color={colors.textSecondary}
        />
        <Ionicons
          name={opts.onEdit ? 'folder' : 'ellipsis-horizontal-circle-outline'}
          size={16}
          color={opts.accent}
        />
        <Text variant="body" style={{ flex: 1, fontWeight: '700', color: colors.text }} numberOfLines={1}>
          {label}
        </Text>
      </Pressable>
      <View style={[styles.countBadge, { backgroundColor: opts.accent }]}>
        <Text variant="caption" style={{ fontWeight: '700', fontSize: 11, color: '#FFFFFF' }}>
          {count}
        </Text>
      </View>
      {opts.onEdit && (
        <Pressable onPress={opts.onEdit} hitSlop={10} style={{ padding: 4 }}>
          <Ionicons name="pencil-outline" size={16} color={colors.textMuted} />
        </Pressable>
      )}
    </View>
  );

  const renderListFooter = () => (
    <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
      <Pressable
        onPress={openCreateCategory}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.sm,
          paddingVertical: spacing.md,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderStyle: 'dashed',
          borderColor: colors.border,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <Ionicons name="folder-outline" size={18} color={colors.primary} />
        <Text variant="bodySmall" style={{ fontWeight: '600', color: colors.primary }}>
          {t('proServices.addCategory')}
        </Text>
      </Pressable>
      <Pressable
        onPress={openCreate}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.sm,
          paddingVertical: spacing.md,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderStyle: 'dashed',
          borderColor: colors.border,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <Ionicons name="add" size={18} color={colors.primary} />
        <Text variant="bodySmall" style={{ fontWeight: '600', color: colors.primary }}>
          {t('proServices.addService')}
        </Text>
      </Pressable>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header — bandeau bleu (référence: availability.tsx) */}
      <View style={{ backgroundColor: colors.primary, paddingTop: insets.top }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md }}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}>
            <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
          </Pressable>
          <Text variant="h3" style={{ fontWeight: '600', color: '#FFFFFF' }}>{t('proServices.title')}</Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Pressable onPress={openCreateCategory} style={({ pressed }) => [styles.addBtn, { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: radius.md, opacity: pressed ? 0.8 : 1 }]}>
              <Ionicons name="folder-outline" size={18} color="#FFFFFF" />
            </Pressable>
            <Pressable onPress={openCreate} style={({ pressed }) => [styles.addBtn, { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: radius.md, opacity: pressed ? 0.8 : 1 }]}>
              <Ionicons name="add" size={22} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>
      </View>

      {services.length === 0 ? (
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, padding: spacing.lg }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.emptyState}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.primaryLight }]}>
              <Ionicons name="pricetag-outline" size={32} color={colors.primary} />
            </View>
            <Text variant="h3" align="center" style={{ marginTop: spacing.md }}>{t('proServices.emptyTitle')}</Text>
            <Text variant="body" color="textSecondary" align="center" style={{ marginTop: spacing.xs }}>
              {t('proServices.emptyDescription')}
            </Text>
            <Button variant="primary" title={t('proServices.addService')} onPress={openCreate} style={{ marginTop: spacing.lg }} />
          </View>
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing['3xl'] }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          showsVerticalScrollIndicator={false}
        >
          {(() => {
            const g = provider?.settings?.globalDiscount ?? null;
            const gActive = getActiveDiscount(g);
            return (
              <Pressable
                onPress={openGlobalPromo}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.sm,
                  backgroundColor: gActive ? 'rgba(225,29,72,0.10)' : colors.surface,
                  borderWidth: 1,
                  borderColor: gActive ? 'rgba(225,29,72,0.35)' : colors.border,
                  borderRadius: radius.lg,
                  padding: spacing.md,
                  marginTop: spacing.md,
                  marginBottom: spacing.md,
                }}
              >
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: gActive ? 'rgba(225,29,72,0.15)' : colors.primaryLight, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="pricetags" size={18} color={gActive ? '#E11D48' : colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="bodySmall" style={{ fontWeight: '600', color: colors.text }}>
                    {t('proServices.globalPromo.title')}
                  </Text>
                  <Text variant="caption" color="textSecondary" style={{ marginTop: 1 }}>
                    {g
                      ? gActive
                        ? t('proServices.globalPromo.activeSummary', { percent: g.percent })
                        : t('proServices.globalPromo.inactiveSummary', { percent: g.percent })
                      : t('proServices.globalPromo.promptSummary')}
                  </Text>
                </View>
                <Text variant="bodySmall" style={{ fontWeight: '600', color: colors.primary }}>
                  {g ? t('proServices.globalPromo.edit') : t('proServices.globalPromo.configure')}
                </Text>
              </Pressable>
            );
          })()}
          {(() => {
            const l = provider?.settings?.loyalty ?? null;
            const lActive = loyaltyAccess && isLoyaltyConfigValid(l);
            const summary = !loyaltyAccess
              ? t('proLoyalty.card.lockedSummary')
              : l
                ? l.enabled
                  ? l.rewardType === 'percent'
                    ? t('proLoyalty.card.activeSummaryPercent', { percent: l.rewardValue, threshold: l.threshold })
                    : t('proLoyalty.card.activeSummaryAmount', { amount: formatPrice(l.rewardValue), threshold: l.threshold })
                  : t('proLoyalty.card.inactiveSummary')
                : t('proLoyalty.card.promptSummary');
            return (
              <Pressable
                onPress={openLoyalty}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.sm,
                  backgroundColor: lActive ? 'rgba(124,58,237,0.10)' : colors.surface,
                  borderWidth: 1,
                  borderColor: lActive ? 'rgba(124,58,237,0.35)' : colors.border,
                  borderRadius: radius.lg,
                  padding: spacing.md,
                  marginBottom: spacing.md,
                }}
              >
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: lActive ? 'rgba(124,58,237,0.15)' : colors.primaryLight, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons
                    name={loyaltyAccess ? 'gift-outline' : 'lock-closed'}
                    size={18}
                    color={lActive ? '#7C3AED' : colors.primary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="bodySmall" style={{ fontWeight: '600', color: colors.text }}>
                    {t('proLoyalty.card.title')}
                  </Text>
                  <Text variant="caption" color="textSecondary" style={{ marginTop: 1 }}>
                    {summary}
                  </Text>
                </View>
                <Text variant="bodySmall" style={{ fontWeight: '600', color: colors.primary }}>
                  {!loyaltyAccess
                    ? t('proLoyalty.card.unlock')
                    : l
                      ? t('proLoyalty.card.edit')
                      : t('proLoyalty.card.configure')}
                </Text>
              </Pressable>
            );
          })()}
          {categories.map((cat) => {
            const catServices = grouped[cat.id] || [];
            const collapsed = collapsedCategories.has(cat.id);
            return (
              <View key={cat.id}>
                {renderCategoryBand(cat.name, catServices.length, {
                  collapsed,
                  onToggle: () => toggleCollapse(cat.id),
                  onEdit: () => openEditCategory(cat),
                  accent: colors.primary,
                })}
                {!collapsed && (
                  <View style={{ gap: spacing.sm, marginLeft: spacing.md }}>
                    {catServices.length === 0 ? (
                      <Text variant="caption" color="textMuted" style={{ fontStyle: 'italic', paddingVertical: spacing.xs }}>
                        {t('proServices.emptyCategory')}
                      </Text>
                    ) : (
                      catServices.map(renderServiceCard)
                    )}
                  </View>
                )}
              </View>
            );
          })}

          {uncategorized.length > 0 && (
            <View>
              {categories.length > 0 &&
                renderCategoryBand(t('proServices.uncategorizedBand'), uncategorized.length, { accent: colors.textMuted })}
              <View style={{ gap: spacing.sm, marginLeft: categories.length > 0 ? spacing.md : 0 }}>
                {uncategorized.map(renderServiceCard)}
              </View>
            </View>
          )}

          {renderListFooter()}
        </ScrollView>
      )}

      {/* ── Create/Edit Service Modal ── */}
      <Modal visible={showModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl }]}>
            {/* Modal Header */}
            <View style={[styles.modalHeader, { padding: spacing.lg, borderBottomColor: colors.border }]}>
              <Text variant="h3">{editingId ? t('proServices.form.editTitle') : t('proServices.form.createTitle')}</Text>
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
                  title={t('proServices.form.essentialsTitle')}
                  subtitle={t('proServices.form.essentialsSubtitle')}
                  icon="pricetag-outline"
                  collapsible={false}
                >
                <Input
                  label={t('proServices.form.nameLabel')}
                  placeholder={t('proServices.form.namePlaceholder')}
                  value={form.name}
                  onChangeText={(t) => setForm((p) => ({ ...p, name: t }))}
                  autoCapitalize="sentences"
                />

                {/* Photo */}
                <View>
                  <Text variant="bodySmall" style={{ fontWeight: '500', marginBottom: spacing.xs, color: colors.text }}>
                    {t('proServices.form.photoLabel')} <Text variant="caption" color="textMuted">{t('proServices.form.optional')}</Text>
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
                        {form.photoURL ? t('proServices.form.changeFromDevice') : t('proServices.form.fromDevice')}
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
                          {form.photoURL ? t('proServices.form.changeFromPortfolio') : t('proServices.form.fromPortfolio')}
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
                    <Text variant="bodySmall" style={{ fontWeight: '500', marginBottom: spacing.xs, color: colors.text }}>{t('proServices.form.categoryLabel')}</Text>
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
                            {t('proServices.noCategory')}
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
                    {t('proServices.form.colorLabel')} <Text variant="caption" color="textMuted">{t('proServices.form.optional')}</Text>
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ flexDirection: 'row', gap: 8, paddingRight: spacing.md, alignItems: 'center' }}
                  >
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
                  </ScrollView>
                </View>

                {form.variations.length > 0 ? (
                  /* With variations, the base price/duration are ignored — hide
                     them so the pro isn't asked for numbers that have no effect
                     (mirrors the web editor & onboarding). */
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'flex-start',
                      gap: spacing.sm,
                      borderRadius: radius.md,
                      borderWidth: 1,
                      borderColor: colors.primaryLight || '#bfdbfe',
                      backgroundColor: colors.primaryLight ? `${colors.primaryLight}66` : '#eff6ff',
                      padding: spacing.md,
                    }}
                  >
                    <Ionicons name="layers-outline" size={18} color={colors.primary} style={{ marginTop: 1 }} />
                    <Text variant="caption" style={{ flex: 1, color: colors.text }}>
                      {t('proServices.form.variationsPricingBefore')}{' '}
                      <Text variant="caption" style={{ fontWeight: '700', color: colors.primary }}>
                        {euroCents(getServiceMinPrice({ price: 0, variations: sanitizeVariations(form.variations) }))}
                      </Text>
                      {t('proServices.form.variationsPricingAfter')}
                    </Text>
                  </View>
                ) : (
                  <>
                    {/* Duration — single minutes input with a live hour preview */}
                    <View>
                      <Text variant="bodySmall" style={{ fontWeight: '500', marginBottom: spacing.xs, color: colors.text }}>{t('proServices.form.durationLabel')}</Text>
                      <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
                        <View style={{ width: 110 }}>
                          <Input
                            label=""
                            placeholder="60"
                            value={(() => {
                              const total = hoursMinutesToMinutes(form.durationHours, form.durationMinutes);
                              return total ? String(total) : '';
                            })()}
                            onChangeText={(t) => {
                              const total = parseInt(t.replace(/[^0-9]/g, ''), 10) || 0;
                              const { hours, minutes } = minutesToHoursMinutes(total);
                              setForm((p) => ({ ...p, durationHours: hours, durationMinutes: minutes }));
                            }}
                            keyboardType="number-pad"
                          />
                        </View>
                        <Text variant="bodySmall" color="textSecondary">{t('proServices.form.durationMinUnit')}</Text>
                        {hoursMinutesToMinutes(form.durationHours, form.durationMinutes) >= 60 && (
                          <View style={{ paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary }}>
                            <Text variant="bodySmall" color="textSecondary" style={{ fontWeight: '600' }}>
                              {t('proServices.form.durationPreview', { duration: formatDuration(hoursMinutesToMinutes(form.durationHours, form.durationMinutes)) })}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>

                    <Input
                      label={t('proServices.form.priceLabel')}
                      placeholder="0"
                      value={form.price}
                      onChangeText={(t) => setForm((p) => ({ ...p, price: t }))}
                      keyboardType="decimal-pad"
                    />
                  </>
                )}

                <Input
                  label={t('proServices.form.descriptionLabel')}
                  placeholder={t('proServices.form.descriptionPlaceholder')}
                  value={form.description}
                  onChangeText={(t) => setForm((p) => ({ ...p, description: t }))}
                  multiline
                  numberOfLines={3}
                />
                </EditorSection>

                <EditorSection
                  title={t('proServices.settingsSection.title')}
                  subtitle={t('proServices.settingsSection.subtitle')}
                  icon="options-outline"
                  defaultOpen={false}
                >
                {/* Buffer time — free input with info box */}
                <View>
                  <Text variant="bodySmall" style={{ fontWeight: '500', marginBottom: spacing.xs, color: colors.text }}>
                    {t('proServices.settingsSection.bufferLabel')}
                  </Text>
                  <View style={[styles.infoBox, { backgroundColor: '#EFF6FF', borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.sm }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                      <Ionicons name="information-circle-outline" size={18} color="#3B82F6" style={{ marginTop: 1 }} />
                      <Text variant="caption" style={{ marginLeft: spacing.xs, flex: 1, color: '#1E40AF', lineHeight: 18 }}>
                        {t('proServices.settingsSection.bufferInfo')}
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
                      {t('proServices.deposit.label')}
                    </Text>
                    {(['inherit', 'custom', 'none'] as DepositMode[]).map((mode) => {
                      const checked = form.depositMode === mode;
                      const labels: Record<DepositMode, string> = {
                        inherit: defaultDepositSettings
                          ? t('proServices.deposit.modeInheritWithDefault')
                          : t('proServices.deposit.modeInheritNoDefault'),
                        custom: t('proServices.deposit.modeCustom'),
                        none: t('proServices.deposit.modeNone'),
                      };
                      const hints: Record<DepositMode, string> = {
                        inherit: defaultDepositSettings
                          ? t('proServices.deposit.hintInheritWithDefault', {
                              percent: defaultDepositSettings.percent,
                              hours: defaultDepositSettings.refundDeadlineHours,
                            })
                          : t('proServices.deposit.hintInheritNoDefault'),
                        custom: t('proServices.deposit.hintCustom'),
                        none: defaultDepositSettings
                          ? t('proServices.deposit.hintNoneWithDefault')
                          : t('proServices.deposit.hintNoneNoDefault'),
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
                          {(['percent', 'fixed'] as DepositCustomType[]).map((dt) => {
                            const sel = form.depositType === dt;
                            return (
                              <Pressable
                                key={dt}
                                onPress={() =>
                                  setForm((p) => ({
                                    ...p,
                                    depositType: dt,
                                    depositValue: dt === 'percent' ? '30' : '10',
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
                                  {dt === 'percent' ? t('proServices.deposit.typePercent') : t('proServices.deposit.typeFixed')}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </View>

                        <Input
                          label={form.depositType === 'percent' ? t('proServices.deposit.percentLabel') : t('proServices.deposit.amountLabel')}
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
                          label={t('proServices.deposit.refundDelayLabel')}
                          placeholder="24"
                          value={form.depositRefundHours}
                          onChangeText={(t) => setForm((p) => ({ ...p, depositRefundHours: t.replace(/[^0-9]/g, '') }))}
                          keyboardType="number-pad"
                        />
                        <Text variant="caption" color="textSecondary">
                          {t('proServices.deposit.refundDelayNote')}
                        </Text>
                      </View>
                    )}
                  </View>
                )}

                </EditorSection>

                <EditorSection
                  title={t('proServices.promo.sectionTitle')}
                  subtitle={t('proServices.promo.sectionSubtitle')}
                  icon="pricetag-outline"
                  defaultOpen={form.discountEnabled}
                >
                  {/* Enable toggle */}
                  <Pressable
                    onPress={() => setForm((p) => ({ ...p, discountEnabled: !p.discountEnabled }))}
                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.xs }}
                  >
                    <Text variant="bodySmall" style={{ fontWeight: '600', color: colors.text, flex: 1 }}>
                      {t('proServices.promo.enable')}
                    </Text>
                    <View style={{ width: 44, height: 26, borderRadius: 13, backgroundColor: form.discountEnabled ? colors.primary : colors.border, justifyContent: 'center', padding: 2 }}>
                      <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff', alignSelf: form.discountEnabled ? 'flex-end' : 'flex-start' }} />
                    </View>
                  </Pressable>

                  {form.discountEnabled && (
                    <View style={{ marginTop: spacing.sm, gap: spacing.sm }}>
                      <Input
                        label={t('proServices.promo.percentLabel')}
                        placeholder="10"
                        value={form.discountPercent}
                        onChangeText={(t) => setForm((p) => ({ ...p, discountPercent: t.replace(/[^0-9]/g, '') }))}
                        keyboardType="number-pad"
                      />

                      {/* Live, interactive before/after preview — tap a line to
                          include/exclude it from the promo. */}
                      {(() => {
                        const preview = buildServiceDiscountPreview(
                          {
                            price: Math.round((Number(form.price) || 0) * 100),
                            variations: form.variations,
                            options: form.options,
                          },
                          { percent: Number(form.discountPercent) || 0, excludedIds: form.discountExcludedIds },
                        );
                        if (!preview) return null;
                        return (
                          <PromoPreview
                            preview={preview}
                            onToggleLine={(id) =>
                              setForm((p) => ({
                                ...p,
                                discountExcludedIds: p.discountExcludedIds.includes(id)
                                  ? p.discountExcludedIds.filter((x) => x !== id)
                                  : [...p.discountExcludedIds, id],
                              }))
                            }
                          />
                        );
                      })()}

                      {/* Date window */}
                      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                        {(['start', 'end'] as const).map((which) => {
                          const ymd = which === 'start' ? form.discountStartsAt : form.discountEndsAt;
                          return (
                            <Pressable
                              key={which}
                              onPress={() => setPromoDateField(which)}
                              style={{ flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
                            >
                              <View style={{ flex: 1 }}>
                                <Text variant="caption" color="textSecondary">
                                  {which === 'start' ? t('proServices.promo.start') : t('proServices.promo.end')}
                                </Text>
                                <Text variant="bodySmall" style={{ color: ymd ? colors.text : colors.textMuted, marginTop: 1 }}>
                                  {ymd ? formatPromoDate(ymd) : t('proServices.promo.optionalDate')}
                                </Text>
                              </View>
                              <Ionicons name="calendar-outline" size={16} color={colors.textMuted} />
                            </Pressable>
                          );
                        })}
                      </View>
                      <Text variant="caption" color="textSecondary">
                        {t('proServices.promo.permanentNote')}
                      </Text>
                    </View>
                  )}
                </EditorSection>

                {(locations.length > 1 || members.length > 1) && (
                  <EditorSection
                    title={t('proServices.availability.title')}
                    subtitle={t('proServices.availability.subtitle')}
                    icon="people-outline"
                    defaultOpen={false}
                  >
                {/* Locations */}
                {locations.length > 1 && (
                  <View>
                    <Text variant="bodySmall" style={{ fontWeight: '500', marginBottom: spacing.sm, color: colors.text }}>{t('proServices.availability.locations')}</Text>
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
                      {t('proServices.availability.members')}
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
                        {t('proServices.availability.allMembers')}
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
                  title={t('proServices.choices.title')}
                  subtitle={t('proServices.choices.subtitle')}
                  icon="construct-outline"
                  open={choicesExpanded}
                  onToggle={() => setChoicesExpanded((v) => !v)}
                >
                  <View style={{ gap: spacing.xs }}>
                    <Text variant="bodySmall" style={{ fontWeight: '600', color: colors.text }}>
                      {t('proServices.choices.variationsTitle')}
                    </Text>
                    <Text variant="caption" color="textSecondary">
                      {t('proServices.choices.variationsHint')}
                    </Text>
                    <VariationsEditor
                      variations={form.variations}
                      onChange={(n) => setForm((p) => ({ ...p, variations: n }))}
                    />
                  </View>

                  <View style={{ gap: spacing.xs }}>
                    <Text variant="bodySmall" style={{ fontWeight: '600', color: colors.text }}>
                      {t('proServices.choices.optionsTitle')}
                    </Text>
                    <Text variant="caption" color="textSecondary">
                      {t('proServices.choices.optionsHint')}
                    </Text>
                    <OptionsEditor
                      options={form.options}
                      onChange={(n) => setForm((p) => ({ ...p, options: n }))}
                    />
                  </View>

                  <View style={{ gap: spacing.xs }}>
                    <Text variant="bodySmall" style={{ fontWeight: '600', color: colors.text }}>
                      {t('proServices.choices.infoTitle')}
                    </Text>
                    <Text variant="caption" color="textSecondary">
                      {t('proServices.choices.infoHint')}
                    </Text>
                    <InfoFieldsEditor
                      fields={form.infoFields}
                      onChange={(n) => setForm((p) => ({ ...p, infoFields: n }))}
                    />
                  </View>
                </EditorSection>
              </View>
            </ScrollView>

            {/* Floating "client preview" button — above the sticky footer.
                Breathes permanently (scale + glow) so the pro knows the
                preview reacts to what they configure. */}
            <Animated.View
              style={{
                position: 'absolute',
                right: spacing.lg,
                bottom: insets.bottom + 84,
                borderRadius: 999,
                transform: [
                  {
                    scale: previewBreath.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 1.05],
                    }),
                  },
                ],
                shadowColor: colors.primary,
                shadowOpacity: 0.55,
                shadowRadius: 12,
                shadowOffset: { width: 0, height: 3 },
                elevation: 8,
              }}
            >
            <Pressable
              onPress={() => setShowPreview(true)}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.sm,
                paddingVertical: spacing.sm,
                paddingLeft: spacing.sm,
                paddingRight: spacing.md,
                borderRadius: 999,
                backgroundColor: colors.primary,
                opacity: pressed ? 0.9 : 1,
              })}
            >
              <View
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 15,
                  backgroundColor: 'rgba(255,255,255,0.25)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="eye" size={17} color="#FFFFFF" />
              </View>
              <View>
                <Text variant="bodySmall" style={{ fontWeight: '700', color: '#FFFFFF', lineHeight: 16 }}>
                  {t('proServices.preview.clientPreview')}
                </Text>
                <Text variant="caption" style={{ color: 'rgba(255,255,255,0.85)', fontSize: 10, lineHeight: 12 }}>
                  {t('proServices.preview.buttonSubtitle')}
                </Text>
              </View>
            </Pressable>
            </Animated.View>

            {/* Save Button */}
            <View style={[styles.stickyFooter, { padding: spacing.lg, paddingBottom: insets.bottom + spacing.sm, borderTopColor: colors.border }]}>
              <Button
                variant="primary"
                title={isSaving ? t('proServices.saving') : t('common.save')}
                onPress={handleSave}
                loading={isSaving}
                disabled={isSaving}
                fullWidth
              />
            </View>
          </View>

          {/* Client preview — bottom-sheet animée, rendue en overlay À
              L'INTÉRIEUR de la modale d'édition (iOS n'affiche qu'une <Modal>
              à la fois → une 2e Modal sœur ne s'afficherait pas). */}
          <OverlaySheet visible={showPreview} onClose={() => setShowPreview(false)}>
            <View style={[styles.modalHeader, { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, borderBottomColor: colors.border }]}>
              <Text variant="h3">{t('proServices.preview.clientPreview')}</Text>
              <Pressable onPress={() => setShowPreview(false)}>
                <Ionicons name="close-circle" size={28} color={colors.textMuted} />
              </Pressable>
            </View>
            <ServiceChoicesPreview
              safeAreaBottom
              service={{
                name: form.name,
                price: Math.round((parseFloat(form.price) || 0) * 100),
                duration: hoursMinutesToMinutes(form.durationHours, form.durationMinutes),
                photoURL: form.photoURL,
                variations: sanitizeVariations(form.variations),
                options: sanitizeOptions(form.options),
                infoFields: sanitizeInfoFields(form.infoFields),
              }}
            />
          </OverlaySheet>

          {/* Promo date picker. iOS: inline picker in an overlay sheet (a 2nd
              Modal wouldn't show over the editor Modal). Android: system dialog. */}
          {Platform.OS === 'ios' && (
            <OverlaySheet
              visible={promoDateField !== null}
              onClose={() => setPromoDateField(null)}
              heightPct={0.55}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm }}>
                <Pressable
                  hitSlop={8}
                  onPress={() => {
                    const key = promoDateField === 'start' ? 'discountStartsAt' : 'discountEndsAt';
                    setForm((p) => ({ ...p, [key]: null }));
                    setPromoDateField(null);
                  }}
                >
                  <Text variant="body" color="textSecondary">{t('proServices.promo.clear')}</Text>
                </Pressable>
                <Text variant="body" style={{ fontWeight: '600' }}>
                  {promoDateField === 'start' ? t('proServices.promo.pickerTitleStart') : t('proServices.promo.pickerTitleEnd')}
                </Text>
                <Pressable hitSlop={8} onPress={() => setPromoDateField(null)}>
                  <Text variant="body" color="primary" style={{ fontWeight: '600' }}>{t('proServices.promo.ok')}</Text>
                </Pressable>
              </View>
              <DateTimePicker
                value={ymdToDate(promoDateField === 'start' ? form.discountStartsAt : form.discountEndsAt)}
                mode="date"
                display="inline"
                onChange={(_, date) => {
                  if (!date || !promoDateField) return;
                  const key = promoDateField === 'start' ? 'discountStartsAt' : 'discountEndsAt';
                  setForm((p) => ({ ...p, [key]: dateToYmd(date) }));
                }}
                style={{ height: 320 }}
              />
            </OverlaySheet>
          )}
          {Platform.OS === 'android' && promoDateField !== null && (
            <DateTimePicker
              value={ymdToDate(promoDateField === 'start' ? form.discountStartsAt : form.discountEndsAt)}
              mode="date"
              onChange={(_, date) => {
                const which = promoDateField;
                setPromoDateField(null);
                if (date && which) {
                  const key = which === 'start' ? 'discountStartsAt' : 'discountEndsAt';
                  setForm((p) => ({ ...p, [key]: dateToYmd(date) }));
                }
              }}
            />
          )}
        </View>
      </Modal>

      {/* ── Déplacer vers une catégorie ── */}
      <Modal
        visible={moveTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setMoveTarget(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setMoveTarget(null)}>
          <Pressable
            style={[styles.modalContent, { maxHeight: '70%', backgroundColor: colors.background, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={[styles.modalHeader, { padding: spacing.lg, borderBottomColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text variant="h3">{t('proServices.move.title')}</Text>
                {moveTarget && (
                  <Text variant="caption" color="textSecondary" numberOfLines={1}>
                    {moveTarget.name}
                  </Text>
                )}
              </View>
              <Pressable onPress={() => setMoveTarget(null)}>
                <Ionicons name="close-circle" size={28} color={colors.textMuted} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.xs }}>
              {categories.map((cat) => {
                const current = moveTarget?.categoryId === cat.id;
                return (
                  <Pressable
                    key={cat.id}
                    onPress={() => moveTarget && moveServiceToCategory(moveTarget, cat.id)}
                    style={({ pressed }) => ({
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: spacing.sm,
                      paddingVertical: spacing.md,
                      paddingHorizontal: spacing.md,
                      borderRadius: radius.lg,
                      backgroundColor: current ? colors.primaryLight : pressed ? colors.surfaceSecondary : 'transparent',
                    })}
                  >
                    <Ionicons name="folder" size={18} color={colors.primary} />
                    <Text variant="body" style={{ flex: 1, fontWeight: current ? '700' : '400', color: current ? colors.primary : colors.text }}>
                      {cat.name}
                    </Text>
                    {current && <Ionicons name="checkmark" size={18} color={colors.primary} />}
                  </Pressable>
                );
              })}
              <Pressable
                onPress={() => moveTarget && moveServiceToCategory(moveTarget, null)}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.sm,
                  paddingVertical: spacing.md,
                  paddingHorizontal: spacing.md,
                  borderRadius: radius.lg,
                  backgroundColor: !moveTarget?.categoryId ? colors.primaryLight : pressed ? colors.surfaceSecondary : 'transparent',
                })}
              >
                <Ionicons name="ellipsis-horizontal-circle-outline" size={18} color={colors.textMuted} />
                <Text variant="body" style={{ flex: 1, fontWeight: !moveTarget?.categoryId ? '700' : '400', color: !moveTarget?.categoryId ? colors.primary : colors.text }}>
                  {t('proServices.move.noCategoryOption')}
                </Text>
                {!moveTarget?.categoryId && <Ionicons name="checkmark" size={18} color={colors.primary} />}
              </Pressable>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Category Create/Edit Modal ── */}
      <Modal visible={showCategoryModal} transparent animationType="fade">
        <KeyboardAvoidingSheet style={styles.categoryModalOverlay}>
          <View style={[styles.categoryModalContent, { backgroundColor: colors.background, borderRadius: radius.xl }]}>
            <Text variant="h3" style={{ marginBottom: spacing.md }}>
              {editingCategoryId ? t('proServices.categoryModal.editTitle') : t('proServices.categoryModal.createTitle')}
            </Text>
            <Input
              label={t('proServices.form.nameLabel')}
              placeholder={t('proServices.categoryModal.namePlaceholder')}
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
                <Text variant="body" style={{ fontWeight: '600' }}>{t('common.cancel')}</Text>
              </Pressable>
              <Pressable
                onPress={handleSaveCategory}
                disabled={isSavingCategory || !categoryName.trim()}
                style={[styles.categoryActionBtn, { backgroundColor: colors.primary, flex: 1, opacity: (!categoryName.trim() || isSavingCategory) ? 0.5 : 1 }]}
              >
                <Text variant="body" style={{ fontWeight: '600', color: '#FFFFFF' }}>
                  {isSavingCategory ? t('proServices.saving') : t('common.save')}
                </Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingSheet>
      </Modal>

      {/* Global (shop-wide) promotion modal */}
      <Modal visible={globalPromoOpen} transparent animationType="slide" onRequestClose={() => setGlobalPromoOpen(false)}>
        <KeyboardAvoidingSheet>
          <Pressable style={{ flex: 1 }} onPress={() => setGlobalPromoOpen(false)} />
          <View style={{ backgroundColor: colors.background, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, paddingBottom: insets.bottom + spacing.lg, gap: spacing.md }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text variant="h3">{t('proServices.globalPromo.title')}</Text>
              <Pressable onPress={() => setGlobalPromoOpen(false)} hitSlop={8}>
                <Ionicons name="close-circle" size={28} color={colors.textMuted} />
              </Pressable>
            </View>
            <Text variant="caption" color="textSecondary">
              {t('proServices.globalPromo.description')}
            </Text>

            <Pressable
              onPress={() => setGForm((f) => ({ ...f, enabled: !f.enabled }))}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.xs }}
            >
              <Text variant="bodySmall" style={{ fontWeight: '600', color: colors.text, flex: 1 }}>
                {t('proServices.globalPromo.enable')}
              </Text>
              <View style={{ width: 44, height: 26, borderRadius: 13, backgroundColor: gForm.enabled ? colors.primary : colors.border, justifyContent: 'center', padding: 2 }}>
                <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff', alignSelf: gForm.enabled ? 'flex-end' : 'flex-start' }} />
              </View>
            </Pressable>

            {gForm.enabled && (
              <View style={{ gap: spacing.sm }}>
                <Input
                  label={t('proServices.promo.percentLabel')}
                  placeholder="10"
                  value={gForm.percent}
                  onChangeText={(t) => setGForm((f) => ({ ...f, percent: t.replace(/[^0-9]/g, '') }))}
                  keyboardType="number-pad"
                />
                <Pressable
                  onPress={() => setGForm((f) => ({ ...f, includeExtras: !f.includeExtras }))}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.xs }}
                >
                  <Text variant="bodySmall" style={{ color: colors.text, flex: 1, marginRight: spacing.sm }}>
                    {t('proServices.globalPromo.includeExtras')}
                  </Text>
                  <View style={{ width: 44, height: 26, borderRadius: 13, backgroundColor: gForm.includeExtras ? colors.primary : colors.border, justifyContent: 'center', padding: 2 }}>
                    <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff', alignSelf: gForm.includeExtras ? 'flex-end' : 'flex-start' }} />
                  </View>
                </Pressable>
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  {(['start', 'end'] as const).map((which) => {
                    const ymd = which === 'start' ? gForm.startsAt : gForm.endsAt;
                    return (
                      <Pressable
                        key={which}
                        onPress={() => setGDateField(which)}
                        style={{ flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
                      >
                        <View style={{ flex: 1 }}>
                          <Text variant="caption" color="textSecondary">{which === 'start' ? t('proServices.promo.start') : t('proServices.promo.end')}</Text>
                          <Text variant="bodySmall" style={{ color: ymd ? colors.text : colors.textMuted, marginTop: 1 }}>
                            {ymd ? formatPromoDate(ymd) : t('proServices.promo.optionalDate')}
                          </Text>
                        </View>
                        <Ionicons name="calendar-outline" size={16} color={colors.textMuted} />
                      </Pressable>
                    );
                  })}
                </View>
                <Text variant="caption" color="textSecondary">
                  {t('proServices.promo.permanentNote')}
                </Text>
              </View>
            )}

            <Button
              variant="primary"
              title={gSaving ? t('proServices.saving') : t('common.save')}
              onPress={saveGlobalPromo}
              disabled={gSaving}
              fullWidth
            />
          </View>
        </KeyboardAvoidingSheet>

        {/* Global promo date picker */}
        {Platform.OS === 'ios' && (
          <OverlaySheet visible={gDateField !== null} onClose={() => setGDateField(null)} heightPct={0.55}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm }}>
              <Pressable
                hitSlop={8}
                onPress={() => {
                  const key = gDateField === 'start' ? 'startsAt' : 'endsAt';
                  setGForm((f) => ({ ...f, [key]: null }));
                  setGDateField(null);
                }}
              >
                <Text variant="body" color="textSecondary">{t('proServices.promo.clear')}</Text>
              </Pressable>
              <Text variant="body" style={{ fontWeight: '600' }}>
                {gDateField === 'start' ? t('proServices.promo.pickerTitleStart') : t('proServices.promo.pickerTitleEnd')}
              </Text>
              <Pressable hitSlop={8} onPress={() => setGDateField(null)}>
                <Text variant="body" color="primary" style={{ fontWeight: '600' }}>{t('proServices.promo.ok')}</Text>
              </Pressable>
            </View>
            <DateTimePicker
              value={ymdToDate(gDateField === 'start' ? gForm.startsAt : gForm.endsAt)}
              mode="date"
              display="inline"
              onChange={(_, date) => {
                if (!date || !gDateField) return;
                const key = gDateField === 'start' ? 'startsAt' : 'endsAt';
                setGForm((f) => ({ ...f, [key]: dateToYmd(date) }));
              }}
              style={{ height: 320 }}
            />
          </OverlaySheet>
        )}
        {Platform.OS === 'android' && gDateField !== null && (
          <DateTimePicker
            value={ymdToDate(gDateField === 'start' ? gForm.startsAt : gForm.endsAt)}
            mode="date"
            onChange={(_, date) => {
              const which = gDateField;
              setGDateField(null);
              if (date && which) {
                const key = which === 'start' ? 'startsAt' : 'endsAt';
                setGForm((f) => ({ ...f, [key]: dateToYmd(date) }));
              }
            }}
          />
        )}
      </Modal>

      {/* ── Loyalty card settings sheet ── */}
      <Modal visible={loyaltyOpen} transparent animationType="slide" onRequestClose={() => setLoyaltyOpen(false)}>
        <KeyboardAvoidingSheet>
          <Pressable style={{ flex: 1 }} onPress={() => setLoyaltyOpen(false)} />
          <View style={{ backgroundColor: colors.background, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, paddingBottom: insets.bottom + spacing.lg, gap: spacing.md, maxHeight: '88%' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text variant="h3">{t('proLoyalty.modal.title')}</Text>
              <Pressable onPress={() => setLoyaltyOpen(false)} hitSlop={8}>
                <Ionicons name="close-circle" size={28} color={colors.textMuted} />
              </Pressable>
            </View>
            <Text variant="caption" color="textSecondary">
              {t('proLoyalty.modal.description', {
                threshold: Number.isInteger(Number(lForm.threshold)) && Number(lForm.threshold) >= 1 ? Number(lForm.threshold) : 'X',
              })}
            </Text>

            <Pressable
              onPress={() => setLForm((f) => ({ ...f, enabled: !f.enabled }))}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.xs }}
            >
              <Text variant="bodySmall" style={{ fontWeight: '600', color: colors.text, flex: 1 }}>
                {t('proLoyalty.modal.enable')}
              </Text>
              <View style={{ width: 44, height: 26, borderRadius: 13, backgroundColor: lForm.enabled ? colors.primary : colors.border, justifyContent: 'center', padding: 2 }}>
                <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff', alignSelf: lForm.enabled ? 'flex-end' : 'flex-start' }} />
              </View>
            </Pressable>

            {lForm.enabled && (
              <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ gap: spacing.sm }} showsVerticalScrollIndicator={false}>
                <Input
                  label={t('proLoyalty.modal.thresholdLabel')}
                  placeholder="5"
                  value={lForm.threshold}
                  onChangeText={(v) => setLForm((f) => ({ ...f, threshold: v.replace(/[^0-9]/g, '') }))}
                  keyboardType="number-pad"
                />
                <Text variant="caption" color="textSecondary">
                  {t('proLoyalty.modal.rewardLabel')}
                </Text>
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  {(['percent', 'amount'] as const).map((type) => {
                    const selected = lForm.rewardType === type;
                    return (
                      <Pressable
                        key={type}
                        onPress={() =>
                          setLForm((f) => (f.rewardType === type ? f : { ...f, rewardType: type, rewardValue: '' }))
                        }
                        style={{
                          flex: 1,
                          borderWidth: 1,
                          borderColor: selected ? colors.primary : colors.border,
                          backgroundColor: selected ? colors.primaryLight : 'transparent',
                          borderRadius: radius.md,
                          paddingVertical: spacing.sm,
                          alignItems: 'center',
                        }}
                      >
                        <Text variant="bodySmall" style={{ fontWeight: '700', color: selected ? colors.primary : colors.textSecondary }}>
                          {type === 'percent' ? '%' : '€'}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Input
                  label={lForm.rewardType === 'percent' ? t('proLoyalty.modal.percentValueLabel') : t('proLoyalty.modal.amountValueLabel')}
                  placeholder={lForm.rewardType === 'percent' ? '10' : '5'}
                  value={lForm.rewardValue}
                  onChangeText={(v) =>
                    setLForm((f) => ({
                      ...f,
                      rewardValue:
                        f.rewardType === 'percent'
                          ? v.replace(/[^0-9]/g, '')
                          : v.replace(/[^0-9.,]/g, ''),
                    }))
                  }
                  keyboardType={lForm.rewardType === 'percent' ? 'number-pad' : 'decimal-pad'}
                />

                <Text variant="bodySmall" style={{ fontWeight: '600', color: colors.text, marginTop: spacing.xs }}>
                  {t('proLoyalty.modal.eligibleTitle')}
                </Text>
                {services.length === 0 ? (
                  <Text variant="caption" color="textSecondary">
                    {t('proLoyalty.modal.noServices')}
                  </Text>
                ) : (
                  <>
                    <Text variant="caption" color="textSecondary">
                      {t('proLoyalty.modal.eligibleHint')}
                    </Text>
                    <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, overflow: 'hidden' }}>
                      {services.map((s, idx) => {
                        // Opt-out model: checked (default) = eligible.
                        const checked = !lForm.excludedServiceIds.includes(s.id);
                        return (
                          <Pressable
                            key={s.id}
                            onPress={() =>
                              setLForm((f) => ({
                                ...f,
                                excludedServiceIds: checked
                                  ? [...f.excludedServiceIds, s.id]
                                  : f.excludedServiceIds.filter((id) => id !== s.id),
                              }))
                            }
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: spacing.sm,
                              paddingHorizontal: spacing.md,
                              paddingVertical: spacing.sm,
                              borderTopWidth: idx === 0 ? 0 : 1,
                              borderTopColor: colors.border,
                            }}
                          >
                            <Ionicons
                              name={checked ? 'checkbox' : 'square-outline'}
                              size={20}
                              color={checked ? colors.primary : colors.textMuted}
                            />
                            <Text
                              variant="bodySmall"
                              numberOfLines={1}
                              style={{ flex: 1, color: checked ? colors.text : colors.textMuted }}
                            >
                              {s.name}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </>
                )}
              </ScrollView>
            )}

            <Button
              variant="primary"
              title={lSaving ? t('proServices.saving') : t('common.save')}
              onPress={saveLoyalty}
              disabled={lSaving}
              fullWidth
            />
          </View>
        </KeyboardAvoidingSheet>
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
