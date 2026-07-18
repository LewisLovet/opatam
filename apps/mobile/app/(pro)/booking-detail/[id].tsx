/**
 * Pro Booking Detail Screen
 * Shows full booking details with client info, service details, and action buttons
 * for providers to confirm, cancel, or mark no-show.
 * Redesigned with premium client card, icon-circle detail rows, and prominent actions.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Pressable,
  TextInput,
  Alert,
  Linking,
  Modal,
  LayoutAnimation,
  Platform,
  UIManager,
  ActivityIndicator,
  Keyboard,
  InputAccessoryView,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  bookingService,
  schedulingService,
  memberService,
  serviceRepository,
  serviceCategoryRepository,
} from '@booking-app/firebase';
import {
  formatDuration,
  serviceHasChoices,
  getServiceMinDuration,
  computeServiceTotal,
  buildBookingSelections,
  emptyServiceSelections,
} from '@booking-app/shared';
import type {
  Booking,
  Member,
  Service,
  ServiceCategory,
  ServiceSelections,
  BookingSelectedVariation,
  BookingSelectedOption,
  BookingSelectedInfo,
} from '@booking-app/shared';
import { ServiceChoicesPreview } from '../../../components/business/ServiceChoicesPreview';
import type { WithId } from '@booking-app/firebase';
import i18n from '../../../lib/i18n';
import { useTheme } from '../../../theme';
import {
  Text,
  Card,
  Button,
  Loader,
  Avatar,
  CalendarStrip,
  TimeSlotSection,
  EmptyState,
} from '../../../components';
import { BookingStatusBadge } from '../../../components/business';
import { useAuth, useProvider } from '../../../contexts';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ---------- Date formatting helpers ----------

/** Locale for date/number formatting, following the current app language */
function dateLocale(): string {
  return i18n.language === 'en' ? 'en-GB' : 'fr-FR';
}

function toDate(datetime: Date | any): Date {
  if (datetime instanceof Date) return datetime;
  if (datetime?.toDate) return datetime.toDate();
  return new Date(datetime);
}

function formatDateLong(datetime: Date | any): string {
  const date = toDate(datetime);
  const label = date.toLocaleDateString(dateLocale(), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function formatTime(datetime: Date | any): string {
  const date = toDate(datetime);
  return date.toLocaleTimeString(dateLocale(), {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatEndTime(datetime: Date | any, durationMinutes: number): string {
  const date = toDate(datetime);
  const endDate = new Date(date.getTime() + durationMinutes * 60 * 1000);
  return endDate.toLocaleTimeString(dateLocale(), {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatPrice(cents: number): string {
  return (cents / 100).toLocaleString(dateLocale(), {
    style: 'currency',
    currency: 'EUR',
  });
}

/**
 * Renders the variation / option choices the client made for one
 * prestation (denormalised on the booking, so names are frozen).
 * Variation = "Longueur : Mi-dos", option = "+ Mèches incluses (15 €)".
 * Returns null when there's nothing to show (legacy / choice-less
 * prestation), so the caller can drop it in unconditionally.
 */
function ServiceChoiceLines({
  variations,
  options,
  info,
  colors,
  spacing,
}: {
  variations?: BookingSelectedVariation[];
  options?: BookingSelectedOption[];
  info?: BookingSelectedInfo[];
  colors: ReturnType<typeof useTheme>['colors'];
  spacing: ReturnType<typeof useTheme>['spacing'];
}) {
  const hasVariations = !!variations && variations.length > 0;
  const hasOptions = !!options && options.length > 0;
  const hasInfo = !!info && info.length > 0;
  if (!hasVariations && !hasOptions && !hasInfo) return null;

  return (
    <View style={{ marginTop: spacing.xs, gap: 2 }}>
      {variations?.map((v) => (
        <Text key={`${v.variationId}:${v.optionId}`} variant="caption" color="textSecondary">
          {v.variationName} : <Text variant="caption" style={{ color: colors.text, fontWeight: '600' }}>{v.optionName}</Text>
        </Text>
      ))}
      {options?.map((o) => (
        <View key={o.optionId}>
          <Text variant="caption" color="textSecondary">
            + {o.optionName}
            {o.price > 0 ? `  (${formatPrice(o.price)})` : ''}
          </Text>
          {o.nestedVariations?.map((v) => (
            <Text
              key={`${o.optionId}:${v.variationId}:${v.optionId}`}
              variant="caption"
              color="textSecondary"
              style={{ marginLeft: spacing.md }}
            >
              {v.variationName} : {v.optionName}
            </Text>
          ))}
          {o.info?.map((inf) => (
            <Text
              key={`${o.optionId}:info:${inf.fieldId}`}
              variant="caption"
              color="textSecondary"
              style={{ marginLeft: spacing.md }}
            >
              {inf.label} : <Text variant="caption" style={{ color: colors.text, fontWeight: '600' }}>{inf.value}</Text>
            </Text>
          ))}
        </View>
      ))}
      {info?.map((inf) => (
        <Text key={`info:${inf.fieldId}`} variant="caption" color="textSecondary">
          {inf.label} : <Text variant="caption" style={{ color: colors.text, fontWeight: '600' }}>{inf.value}</Text>
        </Text>
      ))}
    </View>
  );
}

// ---------- Reschedule slot types & config ----------

type Period = 'morning' | 'afternoon' | 'evening';

interface SlotWithMember {
  date: Date;
  start: string;
  end: string;
  datetime: Date;
  endDatetime: Date;
  memberId: string;
}

const PERIODS_CONFIG: {
  key: Period;
  labelKey: string;
  icon: keyof typeof Ionicons.glyphMap;
  backgroundColor: string;
  accentColor: string;
}[] = [
  { key: 'morning', labelKey: 'proBookingDetail.periods.morning', icon: 'sunny', backgroundColor: '#FEF3C7', accentColor: '#D97706' },
  { key: 'afternoon', labelKey: 'proBookingDetail.periods.afternoon', icon: 'partly-sunny', backgroundColor: '#FFEDD5', accentColor: '#EA580C' },
  { key: 'evening', labelKey: 'proBookingDetail.periods.evening', icon: 'moon', backgroundColor: '#E0E7FF', accentColor: '#4F46E5' },
];

function getHour(time: string): number {
  return parseInt(time.split(':')[0], 10);
}

// ---------- Detail row component (redesigned with icon circles) ----------

function DetailRow({
  icon,
  label,
  value,
  valueColor,
  valueWeight,
  colors,
  spacing,
  radius,
  isLast,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  valueColor?: string;
  valueWeight?: '400' | '500' | '600' | '700';
  colors: any;
  spacing: any;
  radius: any;
  isLast?: boolean;
}) {
  return (
    <View>
      <View style={detailRowStyles.row}>
        <View
          style={[
            detailRowStyles.iconCircle,
            {
              backgroundColor: colors.primaryLight,
              borderRadius: radius.full,
            },
          ]}
        >
          <Ionicons name={icon} size={18} color={colors.primary} />
        </View>
        <View style={detailRowStyles.textContainer}>
          <Text variant="caption" color="textSecondary">
            {label}
          </Text>
          <Text
            variant="body"
            style={{
              fontWeight: valueWeight || '600',
              marginTop: 2,
              color: valueColor || colors.text,
            }}
          >
            {value}
          </Text>
        </View>
      </View>
      {!isLast && (
        <View
          style={[
            detailRowStyles.separator,
            {
              backgroundColor: colors.divider,
              marginLeft: 52,
              marginVertical: spacing.sm,
            },
          ]}
        />
      )}
    </View>
  );
}

const detailRowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
  },
  iconCircle: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  separator: {
    height: 1,
  },
});

// ---------- Contact pill component ----------

function ContactPill({
  icon,
  text,
  onPress,
  onCopy,
  colors,
  radius,
  spacing,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
  onPress: () => void;
  onCopy: () => void;
  colors: any;
  radius: any;
  spacing: any;
}) {
  return (
    <View style={contactPillStyles.pillRow}>
      <Pressable
        onPress={onPress}
        hitSlop={4}
        style={({ pressed }) => [
          contactPillStyles.pill,
          {
            backgroundColor: colors.surfaceSecondary,
            borderRadius: radius.full,
            paddingLeft: spacing.md,
            paddingRight: spacing.xs,
            paddingVertical: spacing.sm,
            opacity: pressed ? 0.7 : 1,
          },
        ]}
      >
        <Ionicons name={icon} size={14} color={colors.primary} style={{ marginRight: 6 }} />
        <Text variant="caption" color="primary" style={{ fontWeight: '500' }}>
          {text}
        </Text>
        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            onCopy();
          }}
          hitSlop={8}
          style={({ pressed }) => [
            contactPillStyles.copyButton,
            {
              marginLeft: spacing.sm,
              opacity: pressed ? 0.5 : 1,
              backgroundColor: pressed ? colors.primaryLight : 'transparent',
              borderRadius: radius.full,
            },
          ]}
        >
          <Ionicons name="copy-outline" size={13} color={colors.textMuted} />
        </Pressable>
      </Pressable>
    </View>
  );
}

const contactPillStyles = StyleSheet.create({
  pillRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
  },
  copyButton: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

// ---------- Main screen ----------

export default function ProBookingDetailScreen() {
  const { colors, spacing, radius } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuth();
  const { providerId } = useProvider();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [booking, setBooking] = useState<WithId<Booking> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Load booking data
  const loadBooking = useCallback(async () => {
    if (!id) {
      setError(i18n.t('proBookingDetail.errors.missingId'));
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await bookingService.getById(id);
      if (!result) {
        setError(i18n.t('proBookingDetail.errors.notFound'));
      } else {
        setBooking(result);
      }
    } catch (err: any) {
      console.error('Error loading booking:', err);
      setError(err.message || i18n.t('proBookingDetail.errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadBooking();
  }, [loadBooking]);

  // ---------- Actions ----------

  const handleConfirm = useCallback(async () => {
    if (!booking || !user?.uid) return;

    Alert.alert(
      i18n.t('proBookingDetail.confirmAlert.title'),
      i18n.t('proBookingDetail.confirmAlert.message'),
      [
        { text: i18n.t('proBookingDetail.alerts.no'), style: 'cancel' },
        {
          text: i18n.t('proBookingDetail.confirmAlert.yes'),
          onPress: async () => {
            setActionLoading(true);
            try {
              await bookingService.confirmBooking(booking.id, user.uid);
              await loadBooking();
            } catch (err: any) {
              console.error('Error confirming booking:', err);
              Alert.alert(
                i18n.t('proBookingDetail.alerts.errorTitle'),
                err.message || i18n.t('proBookingDetail.confirmAlert.error'),
              );
            } finally {
              setActionLoading(false);
            }
          },
        },
      ],
    );
  }, [booking, user, loadBooking]);

  const handleCancel = useCallback(async () => {
    if (!booking || !user?.uid) return;

    Alert.alert(
      i18n.t('proBookingDetail.cancelAlert.title'),
      i18n.t('proBookingDetail.cancelAlert.message'),
      [
        { text: i18n.t('proBookingDetail.alerts.no'), style: 'cancel' },
        {
          text: i18n.t('proBookingDetail.cancelAlert.yes'),
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              await bookingService.cancelBooking(booking.id, 'provider', user.uid);
              await loadBooking();
            } catch (err: any) {
              console.error('Error cancelling booking:', err);
              Alert.alert(
                i18n.t('proBookingDetail.alerts.errorTitle'),
                err.message || i18n.t('proBookingDetail.cancelAlert.error'),
              );
            } finally {
              setActionLoading(false);
            }
          },
        },
      ],
    );
  }, [booking, user, loadBooking]);

  const handleMarkNoShow = useCallback(async () => {
    if (!booking || !user?.uid) return;

    Alert.alert(
      i18n.t('proBookingDetail.noShowAlert.title'),
      i18n.t('proBookingDetail.noShowAlert.message'),
      [
        { text: i18n.t('proBookingDetail.alerts.no'), style: 'cancel' },
        {
          text: i18n.t('proBookingDetail.noShowAlert.yes'),
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              await bookingService.markNoShow(booking.id, user.uid);
              await loadBooking();
            } catch (err: any) {
              console.error('Error marking no-show:', err);
              Alert.alert(
                i18n.t('proBookingDetail.alerts.errorTitle'),
                err.message || i18n.t('proBookingDetail.noShowAlert.error'),
              );
            } finally {
              setActionLoading(false);
            }
          },
        },
      ],
    );
  }, [booking, user, loadBooking]);

  // -- Adjust-duration state (shorten/lengthen this booking only) --
  const [showDurationModal, setShowDurationModal] = useState(false);
  const [durationDraft, setDurationDraft] = useState<number>(0);

  // -- Reschedule state (slot-based flow) --
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState<Date>(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  });
  const [rescheduleSlots, setRescheduleSlots] = useState<SlotWithMember[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedRescheduleSlot, setSelectedRescheduleSlot] = useState<SlotWithMember | null>(null);
  const [rescheduleMembers, setRescheduleMembers] = useState<WithId<Member>[]>([]);
  const [expandedSections, setExpandedSections] = useState<Record<Period, boolean>>({
    morning: false,
    afternoon: false,
    evening: false,
  });

  // Load members when modal opens
  useEffect(() => {
    if (!showRescheduleModal || !providerId) return;
    memberService
      .getByProvider(providerId)
      .then((result) => setRescheduleMembers((result as WithId<Member>[]).filter((m) => m.isActive)))
      .catch(() => setRescheduleMembers([]));
  }, [showRescheduleModal, providerId]);

  // ── Add a prestation to this booking (multi-prestation) ──────────────────
  const [showAddService, setShowAddService] = useState(false);
  const [addServiceList, setAddServiceList] = useState<WithId<Service>[]>([]);
  const [addServiceCategories, setAddServiceCategories] = useState<WithId<ServiceCategory>[]>([]);
  const [addingServiceId, setAddingServiceId] = useState<string | null>(null);
  // Service awaiting variation/option choices before being added (null = list).
  const [pendingChoiceService, setPendingChoiceService] = useState<WithId<Service> | null>(null);
  // Per-service: does it fit in the free time right after this booking?
  // (id absent / true = fits ; false = not enough time → greyed out)
  const [serviceFit, setServiceFit] = useState<Record<string, boolean>>({});
  // Add awaiting final confirmation (recap view) — chosen prestation + choices.
  const [pendingConfirm, setPendingConfirm] = useState<{
    service: WithId<Service>;
    selections?: ServiceSelections;
  } | null>(null);
  const [removingLast, setRemovingLast] = useState(false);

  useEffect(() => {
    if (!showAddService || !providerId) return;
    serviceRepository
      .getActiveByProvider(providerId)
      .then((result) => setAddServiceList(result as WithId<Service>[]))
      .catch(() => setAddServiceList([]));
    serviceCategoryRepository
      .getByProvider(providerId)
      .then((result) => setAddServiceCategories(result as WithId<ServiceCategory>[]))
      .catch(() => setAddServiceCategories([]));
  }, [showAddService, providerId]);

  // Compute which prestations fit in the free time right after this booking
  // (between its end and the next obstacle for that member). Greys out the
  // ones too long. Uses the SAME availability check as the actual add.
  useEffect(() => {
    if (!showAddService || !booking || addServiceList.length === 0) {
      setServiceFit({});
      return;
    }
    const memberId = booking.memberId;
    if (!memberId) {
      setServiceFit({}); // no member assigned → can't check, allow all
      return;
    }
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        addServiceList.map(async (s) => {
          // Shortest reachable duration (variations only add time) + buffer.
          const dur = getServiceMinDuration(s) + (s.bufferTime || 0);
          try {
            const ok = await schedulingService.isSlotAvailable({
              providerId: booking.providerId,
              memberId,
              datetime: booking.endDatetime,
              duration: dur,
              excludeBookingId: booking.id,
            });
            return [s.id, ok] as const;
          } catch {
            return [s.id, true] as const; // fail-open
          }
        }),
      );
      if (!cancelled) setServiceFit(Object.fromEntries(entries));
    })();
    return () => {
      cancelled = true;
    };
  }, [showAddService, booking, addServiceList]);

  // Persist the chosen prestation (with optional variation/option selections).
  const submitAddService = useCallback(
    async (serviceId: string, selections?: ServiceSelections) => {
      if (!booking || !user?.uid) return;
      setAddingServiceId(serviceId);
      try {
        await bookingService.addServiceToBooking(booking.id, serviceId, user.uid, selections);
        await loadBooking();
        setPendingChoiceService(null);
        setPendingConfirm(null);
        setShowAddService(false);
      } catch (e: any) {
        Alert.alert(
          i18n.t('proBookingDetail.addService.errorTitle'),
          e?.message || i18n.t('proBookingDetail.addService.errorRetry'),
        );
      } finally {
        setAddingServiceId(null);
      }
    },
    [booking, user, loadBooking],
  );

  // Remove the LAST prestation from a multi-prestation booking.
  const handleRemoveLastService = useCallback(() => {
    if (!booking || !user?.uid) return;
    const items = booking.items ?? [];
    const lastName =
      items[items.length - 1]?.serviceName ?? i18n.t('proBookingDetail.removeService.thisService');
    Alert.alert(
      i18n.t('proBookingDetail.removeService.title'),
      i18n.t('proBookingDetail.removeService.message', { name: lastName }),
      [
        { text: i18n.t('common.cancel'), style: 'cancel' },
        {
          text: i18n.t('proBookingDetail.removeService.confirm'),
          style: 'destructive',
          onPress: async () => {
            setRemovingLast(true);
            try {
              await bookingService.removeLastServiceFromBooking(booking.id, user.uid);
              await loadBooking();
            } catch (e: any) {
              Alert.alert(
                i18n.t('proBookingDetail.alerts.errorTitle'),
                e?.message || i18n.t('proBookingDetail.removeService.error'),
              );
            } finally {
              setRemovingLast(false);
            }
          },
        },
      ],
    );
  }, [booking, user, loadBooking]);

  // Tap a service → open the choices picker if it has any, else go straight
  // to the confirmation recap.
  const handleServiceTap = useCallback((service: WithId<Service>) => {
    if (serviceHasChoices(service)) {
      setPendingChoiceService(service);
    } else {
      setPendingConfirm({ service });
    }
  }, []);

  const renderAddServiceBand = (label: string, count: number) => (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        marginTop: spacing.sm,
        backgroundColor: colors.surfaceSecondary,
        borderRadius: 12,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        borderLeftWidth: 3,
        borderLeftColor: colors.primary,
      }}
    >
      <Ionicons name="folder" size={15} color={colors.primary} />
      <Text variant="bodySmall" style={{ flex: 1, fontWeight: '700', color: colors.text }} numberOfLines={1}>
        {label}
      </Text>
      <View style={{ backgroundColor: colors.primary, minWidth: 20, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 10, alignItems: 'center' }}>
        <Text variant="caption" style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 11 }}>{count}</Text>
      </View>
    </View>
  );

  const renderAddServiceRow = (s: WithId<Service>) => {
    const busy = addingServiceId === s.id;
    const hasChoices = serviceHasChoices(s);
    const fits = serviceFit[s.id] !== false; // undefined (not checked) = fits
    return (
      <Pressable
        key={s.id}
        onPress={() => fits && handleServiceTap(s)}
        disabled={!!addingServiceId || !fits}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          padding: spacing.md,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: colors.border,
          borderLeftWidth: 3,
          borderLeftColor: fits ? s.color || colors.primary : colors.border,
          backgroundColor: pressed && fits ? colors.surfaceSecondary : colors.background,
          opacity: !fits ? 0.5 : addingServiceId && !busy ? 0.5 : 1,
        })}
      >
        <View style={{ flex: 1 }}>
          <Text variant="body" style={{ fontWeight: '600', color: fits ? colors.text : colors.textMuted }}>
            {s.name}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: 2 }}>
            <Text variant="caption" color="textSecondary">
              {formatDuration(s.duration)} · {formatPrice(s.price)}
            </Text>
            {!fits ? (
              <View style={{ backgroundColor: (colors.error || '#DC2626') + '18', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6 }}>
                <Text variant="caption" style={{ fontSize: 10, fontWeight: '600', color: colors.error || '#DC2626' }}>
                  {t('proBookingDetail.addService.notEnoughTime')}
                </Text>
              </View>
            ) : hasChoices ? (
              <View style={{ backgroundColor: colors.primaryLight || '#e4effa', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6 }}>
                <Text variant="caption" color="primary" style={{ fontSize: 10, fontWeight: '600' }}>
                  {t('proBookingDetail.addService.optionsBadge')}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
        {busy ? (
          <ActivityIndicator color={colors.primary} />
        ) : !fits ? (
          <Ionicons name="time-outline" size={20} color={colors.textMuted} />
        ) : (
          <Ionicons name={hasChoices ? 'chevron-forward' : 'add-circle-outline'} size={22} color={colors.primary} />
        )}
      </Pressable>
    );
  };

  // Load available slots when date changes in reschedule modal
  useEffect(() => {
    if (!showRescheduleModal || !booking || !providerId) return;

    const loadSlots = async () => {
      setLoadingSlots(true);
      setSelectedRescheduleSlot(null);

      try {
        const activeMembers = rescheduleMembers.filter((m) => m.isActive);
        const allSlots: SlotWithMember[] = [];

        const promises = activeMembers.map(async (member) => {
          try {
            const memberSlots = await schedulingService.getAvailableSlots({
              providerId,
              serviceId: booking.serviceId,
              memberId: member.id,
              startDate: rescheduleDate,
              endDate: rescheduleDate,
              // Reschedule: don't let this booking block its own overlapping slots.
              excludeBookingId: booking.id,
            });
            return memberSlots.map((slot) => ({ ...slot, memberId: member.id }));
          } catch {
            return [];
          }
        });

        const results = await Promise.all(promises);
        for (const memberSlots of results) {
          allSlots.push(...memberSlots);
        }

        allSlots.sort((a, b) => a.datetime.getTime() - b.datetime.getTime());

        // Deduplicate
        const seen = new Set<string>();
        const uniqueSlots = allSlots.filter((slot) => {
          const key = `${slot.datetime.getTime()}-${slot.memberId}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

        setRescheduleSlots(uniqueSlots);
        setExpandedSections({ morning: false, afternoon: false, evening: false });
      } catch {
        setRescheduleSlots([]);
      } finally {
        setLoadingSlots(false);
      }
    };

    if (rescheduleMembers.length > 0) {
      loadSlots();
    }
  }, [showRescheduleModal, rescheduleDate, booking, providerId, rescheduleMembers]);

  // Group slots by period
  const groupedRescheduleSlots = useMemo(() => {
    const morning: string[] = [];
    const afternoon: string[] = [];
    const evening: string[] = [];
    const seen = new Set<string>();

    for (const slot of rescheduleSlots) {
      if (seen.has(slot.start)) continue;
      seen.add(slot.start);
      const hour = getHour(slot.start);
      if (hour < 12) morning.push(slot.start);
      else if (hour < 17) afternoon.push(slot.start);
      else evening.push(slot.start);
    }
    return { morning, afternoon, evening };
  }, [rescheduleSlots]);

  // Map time string to slot
  const rescheduleSlotByTime = useMemo(() => {
    const map = new Map<string, SlotWithMember>();
    for (const slot of rescheduleSlots) {
      if (!map.has(slot.start)) map.set(slot.start, slot);
    }
    return map;
  }, [rescheduleSlots]);

  const handleReschedule = useCallback(() => {
    if (!booking) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    setRescheduleDate(today);
    setSelectedRescheduleSlot(null);
    setRescheduleSlots([]);
    setShowRescheduleModal(true);
  }, [booking]);

  const handleSelectRescheduleSlot = useCallback((time: string) => {
    const slot = rescheduleSlotByTime.get(time);
    if (slot) setSelectedRescheduleSlot(slot);
  }, [rescheduleSlotByTime]);

  const handleRescheduleDateChange = useCallback((date: Date) => {
    setRescheduleDate(date);
    setSelectedRescheduleSlot(null);
  }, []);

  const toggleRescheduleSection = useCallback((period: Period) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedSections((prev) => ({ ...prev, [period]: !prev[period] }));
  }, []);

  const handleRescheduleConfirm = useCallback(async () => {
    if (!booking || !user?.uid || !selectedRescheduleSlot) return;

    const newDatetime = selectedRescheduleSlot.datetime;
    setShowRescheduleModal(false);

    Alert.alert(
      i18n.t('proBookingDetail.reschedule.title'),
      i18n.t('proBookingDetail.reschedule.confirmMessage', {
        date: formatDateLong(newDatetime),
        time: formatTime(newDatetime),
      }),
      [
        { text: i18n.t('common.cancel'), style: 'cancel' },
        {
          text: i18n.t('common.confirm'),
          onPress: async () => {
            setActionLoading(true);
            try {
              await bookingService.rescheduleBooking(booking.id, newDatetime, user.uid);
              await loadBooking();
              Alert.alert(
                i18n.t('proBookingDetail.alerts.successTitle'),
                i18n.t('proBookingDetail.reschedule.success'),
              );
            } catch (err: any) {
              Alert.alert(
                i18n.t('proBookingDetail.alerts.errorTitle'),
                err.message || i18n.t('proBookingDetail.reschedule.error'),
              );
            } finally {
              setActionLoading(false);
            }
          },
        },
      ],
    );
  }, [booking, user, selectedRescheduleSlot, loadBooking]);

  // -- Adjust duration (this booking's time block only, not the service) --
  const handleOpenDuration = useCallback(() => {
    if (!booking) return;
    setDurationDraft(booking.duration);
    setShowDurationModal(true);
  }, [booking]);

  const bumpDuration = useCallback((delta: number) => {
    setDurationDraft((d) => Math.max(5, Math.min(24 * 60, d + delta)));
  }, []);

  const handleAdjustDurationConfirm = useCallback(async () => {
    if (!booking || !user?.uid) return;
    setShowDurationModal(false);
    setActionLoading(true);
    try {
      await bookingService.adjustBookingDuration(booking.id, durationDraft, user.uid);
      await loadBooking();
      Alert.alert(
        i18n.t('proBookingDetail.alerts.successTitle'),
        i18n.t('proBookingDetail.duration.updateSuccess'),
      );
    } catch (err: any) {
      Alert.alert(
        i18n.t('proBookingDetail.alerts.errorTitle'),
        err.message || i18n.t('proBookingDetail.duration.updateError'),
      );
    } finally {
      setActionLoading(false);
    }
  }, [booking, user, durationDraft, loadBooking]);

  // Final recap confirmation before applying the new duration.
  const handleSaveDuration = useCallback(() => {
    if (!booking) return;
    const orig = booking.duration;
    const delta = durationDraft - orig;
    const end = formatEndTime(booking.datetime, durationDraft);
    Alert.alert(
      i18n.t('proBookingDetail.duration.confirmTitle'),
      i18n.t('proBookingDetail.duration.confirmMessage', {
        from: orig,
        to: durationDraft,
        delta: delta < 0 ? `−${-delta}` : `+${delta}`,
        end,
      }),
      [
        { text: i18n.t('common.cancel'), style: 'cancel' },
        { text: i18n.t('common.confirm'), onPress: handleAdjustDurationConfirm },
      ],
    );
  }, [booking, durationDraft, handleAdjustDurationConfirm]);

  const handleCallClient = useCallback((phone: string) => {
    Linking.openURL(`tel:${phone}`).catch(() => {
      Alert.alert(
        i18n.t('proBookingDetail.alerts.errorTitle'),
        i18n.t('proBookingDetail.contact.phoneError'),
      );
    });
  }, []);

  const handleEmailClient = useCallback((email: string) => {
    Linking.openURL(`mailto:${email}`).catch(() => {
      Alert.alert(
        i18n.t('proBookingDetail.alerts.errorTitle'),
        i18n.t('proBookingDetail.contact.emailError'),
      );
    });
  }, []);

  const handleCopyToClipboard = useCallback(async (text: string) => {
    try {
      await Clipboard.setStringAsync(text);
    } catch {
      // Fallback: noop
    }
    Alert.alert(
      i18n.t('proBookingDetail.contact.copiedTitle'),
      i18n.t('proBookingDetail.contact.copiedMessage', { text }),
    );
  }, []);

  // ---------- Loading state ----------

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loaderContainer}>
          <Loader />
        </View>
      </SafeAreaView>
    );
  }

  // ---------- Error state ----------

  if (error || !booking) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingHorizontal: spacing.lg, paddingVertical: spacing.md }]}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.backButton,
              {
                backgroundColor: colors.surfaceSecondary,
                borderRadius: radius.full,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </Pressable>
          <Text variant="h3" style={{ flex: 1, marginLeft: spacing.md }}>
            {t('proBookingDetail.headerTitle')}
          </Text>
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.error} />
          <Text
            variant="body"
            color="error"
            style={{ marginTop: spacing.md, textAlign: 'center' }}
          >
            {error || t('proBookingDetail.errors.notFound')}
          </Text>
          <Button
            variant="outline"
            title={t('common.back')}
            onPress={() => router.back()}
            style={{ marginTop: spacing.lg }}
          />
        </View>
      </SafeAreaView>
    );
  }

  // ---------- Derived values ----------

  const bookingDate = toDate(booking.datetime);
  const isPast = bookingDate < new Date();

  // Multi-prestation: when the booking carries 2+ items we list each
  // prestation (name · durée · prix) with its own choices; otherwise we
  // show the single service name + its top-level choices.
  const bookingItems = booking.items ?? [];
  const isMultiService = bookingItems.length >= 2;

  // Build detail rows
  // Detail rows — service / member are now surfaced in the dedicated
  // "Service" card above, so they no longer appear here. This list is
  // strictly logistics: when, where, how much.
  const detailRows: {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    value: string;
    valueColor?: string;
    valueWeight?: '400' | '500' | '600' | '700';
  }[] = [
    { icon: 'calendar-outline', label: t('proBookingDetail.details.date'), value: formatDateLong(booking.datetime) },
    {
      icon: 'time-outline',
      label: t('proBookingDetail.details.time'),
      value: `${formatTime(booking.datetime)} - ${formatEndTime(booking.datetime, booking.duration)}`,
    },
    { icon: 'hourglass-outline', label: t('proBookingDetail.details.duration'), value: `${booking.duration} min` },
  ];

  if (booking.locationName) {
    detailRows.push({
      icon: 'location-outline',
      label: t('proBookingDetail.details.location'),
      value: booking.locationAddress || booking.locationName,
    });
  }

  detailRows.push({
    icon: 'cash-outline',
    label: t('proBookingDetail.details.price'),
    value: formatPrice(booking.price),
    valueColor: colors.primary,
    valueWeight: '700' as const,
  });

  // Loyalty reward snapshotted at booking time — stays readable even if the
  // pro changes the loyalty settings afterwards. Shown right under the price.
  if (booking.loyalty && booking.loyalty.amountOff > 0) {
    detailRows.push({
      icon: 'gift-outline',
      label: t('proLoyalty.badge.label'),
      value:
        booking.loyalty.rewardType === 'percent'
          ? t('proLoyalty.badge.percent', {
              percent: booking.loyalty.rewardValue,
              amount: formatPrice(booking.loyalty.amountOff),
            })
          : t('proLoyalty.badge.amount', { amount: formatPrice(booking.loyalty.amountOff) }),
      valueColor: colors.success,
      valueWeight: '700' as const,
    });
  }

  // Deposit row — surfaces the Sérénité add-on benefit directly
  // on the booking. Status-specific colour so the pro instantly
  // sees whether the money has actually been collected.
  if (booking.deposit && booking.deposit.amount > 0) {
    const status = booking.deposit.status;
    const statusLabel: Record<typeof status, string> = {
      paid: t('proBookingDetail.deposit.status.paid'),
      refunded: t('proBookingDetail.deposit.status.refunded'),
      failed: t('proBookingDetail.deposit.status.failed'),
      pending: t('proBookingDetail.deposit.status.pending'),
    };
    const statusColor: Record<typeof status, string> = {
      paid: colors.success,
      refunded: colors.textMuted,
      failed: colors.error,
      pending: colors.warning,
    };
    const statusIcon: Record<typeof status, keyof typeof Ionicons.glyphMap> = {
      paid: 'checkmark-circle',
      refunded: 'arrow-undo',
      failed: 'alert-circle',
      pending: 'time-outline',
    };
    detailRows.push({
      icon: statusIcon[status],
      label: t('proBookingDetail.details.deposit'),
      value: `${formatPrice(booking.deposit.amount)} · ${statusLabel[status]}`,
      valueColor: statusColor[status],
      valueWeight: '700' as const,
    });

    // When the deposit is paid, show the balance still to collect in person
    // (price − acompte) so the pro doesn't have to compute it.
    if (status === 'paid') {
      detailRows.push({
        icon: 'wallet-outline',
        label: t('proBookingDetail.details.remainingBalance'),
        value: formatPrice(Math.max(0, booking.price - booking.deposit.amount)),
        valueColor: colors.text,
        valueWeight: '700' as const,
      });
    }
  }

  if ((booking as any).notes) {
    detailRows.push({
      icon: 'document-text-outline',
      label: t('proBookingDetail.details.notes'),
      value: (booking as any).notes,
    });
  }

  // ---------- Render ----------

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: spacing['3xl'] }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View
          style={[
            styles.header,
            { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
          ]}
        >
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.backButton,
              {
                backgroundColor: colors.surfaceSecondary,
                borderRadius: radius.full,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </Pressable>
          <Text variant="h3" style={{ flex: 1, marginLeft: spacing.md }}>
            {t('proBookingDetail.headerTitle')}
          </Text>
        </View>

        {/* ── 1. Client card (TOP — most important info) ─────────── */}
        <Card
          padding="lg"
          shadow="sm"
          style={{ marginHorizontal: spacing.lg, marginTop: spacing.sm, marginBottom: spacing.md }}
        >
          <View style={styles.clientCardContent}>
            <Avatar size="xl" name={booking.clientInfo.name} />
            <Text
              variant="h1"
              style={{
                marginTop: spacing.md,
                textAlign: 'center',
                fontWeight: '700',
              }}
            >
              {booking.clientInfo.name}
            </Text>

            {/* Contact pills row */}
            <View style={[styles.contactRow, { marginTop: spacing.md, gap: spacing.sm }]}>
              {booking.clientInfo.phone ? (
                <ContactPill
                  icon="call-outline"
                  text={booking.clientInfo.phone}
                  onPress={() => handleCallClient(booking.clientInfo.phone ?? "")}
                  onCopy={() => handleCopyToClipboard(booking.clientInfo.phone ?? "")}
                  colors={colors}
                  radius={radius}
                  spacing={spacing}
                />
              ) : null}
              {booking.clientInfo.email ? (
                <ContactPill
                  icon="mail-outline"
                  text={booking.clientInfo.email}
                  onPress={() => handleEmailClient(booking.clientInfo.email)}
                  onCopy={() => handleCopyToClipboard(booking.clientInfo.email)}
                  colors={colors}
                  radius={radius}
                  spacing={spacing}
                />
              ) : null}
            </View>
          </View>
        </Card>

        {/* ── 2. Service + Member + Status card ───────────────────
              Pulled out of the generic detail list because the pro
              wants to read service & assigned member at a glance. */}
        <Card
          padding="lg"
          shadow="sm"
          style={{ marginHorizontal: spacing.lg, marginBottom: spacing.md }}
        >
          <Text
            variant="caption"
            color="textSecondary"
            style={{
              textTransform: 'uppercase',
              fontWeight: '600',
              letterSpacing: 0.5,
              marginBottom: spacing.xs,
            }}
          >
            {t('proBookingDetail.serviceSectionTitle', { count: isMultiService ? bookingItems.length : 1 })}
          </Text>
          {isMultiService ? (
            <View>
              {bookingItems.map((item, idx) => {
                const isLast = idx === bookingItems.length - 1;
                const canEdit =
                  booking.status === 'pending_payment' ||
                  booking.status === 'pending' ||
                  booking.status === 'confirmed';
                return (
                  <View
                    key={`${item.serviceId}-${idx}`}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'flex-start',
                      gap: spacing.sm,
                      paddingVertical: spacing.sm,
                      borderTopWidth: idx === 0 ? 0 : 1,
                      borderTopColor: colors.border,
                    }}
                  >
                    {/* Order badge — these prestations run back-to-back */}
                    <View
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 11,
                        backgroundColor: colors.primaryLight || '#e4effa',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginTop: 1,
                      }}
                    >
                      <Text variant="caption" color="primary" style={{ fontWeight: '800', fontSize: 11 }}>
                        {idx + 1}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: spacing.sm }}>
                        <Text variant="body" style={{ fontWeight: '700', flexShrink: 1 }}>
                          {item.serviceName}
                        </Text>
                        <Text variant="body" style={{ fontWeight: '700', flexShrink: 0 }}>
                          {item.price > 0 ? formatPrice(item.price) : t('common.free')}
                        </Text>
                      </View>
                      <Text variant="caption" color="textMuted">{formatDuration(item.duration)}</Text>
                      <ServiceChoiceLines
                        variations={item.selectedVariations}
                        options={item.selectedOptions}
                        info={item.selectedInfo}
                        colors={colors}
                        spacing={spacing}
                      />
                      {isLast && canEdit && (
                        <Pressable
                          onPress={handleRemoveLastService}
                          disabled={removingLast}
                          hitSlop={6}
                          style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.xs, alignSelf: 'flex-start' }}
                        >
                          {removingLast ? (
                            <ActivityIndicator size="small" color={colors.error} />
                          ) : (
                            <Ionicons name="trash-outline" size={14} color={colors.error} />
                          )}
                          <Text variant="caption" style={{ color: colors.error, fontWeight: '600' }}>
                            {t('proBookingDetail.removeService.link')}
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  </View>
                );
              })}

              {/* Total */}
              <View
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  borderTopWidth: 1,
                  borderTopColor: colors.border,
                  paddingTop: spacing.sm,
                  marginTop: spacing.xs,
                }}
              >
                <Text variant="body" style={{ fontWeight: '800' }}>{t('proBookingDetail.total')}</Text>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text variant="body" style={{ fontWeight: '800' }}>{formatPrice(booking.price)}</Text>
                  <Text variant="caption" color="textMuted">{formatDuration(booking.duration)}</Text>
                </View>
              </View>
            </View>
          ) : (
            <>
              <Text variant="h2" style={{ fontWeight: '700' }}>
                {booking.serviceName}
              </Text>
              <ServiceChoiceLines
                variations={booking.selectedVariations}
                options={booking.selectedOptions}
                info={booking.selectedInfo}
                colors={colors}
                spacing={spacing}
              />
            </>
          )}

          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: spacing.sm,
              marginTop: spacing.sm,
            }}
          >
            {booking.memberName && (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: booking.memberColor
                    ? `${booking.memberColor}20`
                    : colors.surfaceSecondary,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.xs,
                  borderRadius: radius.full,
                  gap: spacing.xs,
                }}
              >
                <Ionicons
                  name="person-outline"
                  size={14}
                  color={booking.memberColor || colors.textSecondary}
                />
                <Text
                  variant="caption"
                  style={{
                    fontWeight: '600',
                    color: booking.memberColor || colors.text,
                  }}
                >
                  {booking.memberName}
                </Text>
              </View>
            )}
            <BookingStatusBadge status={booking.status} size="md" />
          </View>
        </Card>

        {/* ── 3. Logistics — date / time / location / price ─────── */}
        <Card
          padding="lg"
          shadow="sm"
          style={{ marginHorizontal: spacing.lg, marginBottom: spacing.md }}
        >
          <Text
            variant="caption"
            color="textSecondary"
            style={{
              marginBottom: spacing.md,
              textTransform: 'uppercase',
              fontWeight: '600',
              letterSpacing: 0.5,
            }}
          >
            {t('proBookingDetail.detailsSectionTitle')}
          </Text>
          <View>
            {detailRows.map((row, index) => (
              <DetailRow
                key={row.label}
                icon={row.icon}
                label={row.label}
                value={row.value}
                valueColor={row.valueColor}
                valueWeight={row.valueWeight}
                colors={colors}
                spacing={spacing}
                radius={radius}
                isLast={index === detailRows.length - 1}
              />
            ))}
          </View>
        </Card>

        {/* Action buttons - clear and prominent */}
        {booking.status === 'pending' && (
          <View
            style={[
              styles.actionsContainer,
              {
                paddingHorizontal: spacing.lg,
                marginTop: spacing.sm,
                gap: spacing.sm,
              },
            ]}
          >
            <View style={[styles.actionsRow, { gap: spacing.sm }]}>
              <Button
                title={t('common.confirm')}
                variant="primary"
                onPress={handleConfirm}
                disabled={actionLoading}
                loading={actionLoading}
                fullWidth
                leftIcon={
                  <Ionicons name="checkmark" size={18} color={colors.textInverse} />
                }
                style={{ flex: 1 }}
              />
              <Button
                title={t('common.cancel')}
                variant="outline"
                onPress={handleCancel}
                disabled={actionLoading}
                fullWidth
                leftIcon={
                  <Ionicons name="close" size={18} color={colors.primary} />
                }
                style={{
                  flex: 1,
                  borderColor: colors.error,
                }}
              />
            </View>
            <Button
              title={t('proBookingDetail.actions.reschedule')}
              variant="outline"
              onPress={handleReschedule}
              disabled={actionLoading}
              fullWidth
              leftIcon={
                <Ionicons name="calendar-outline" size={18} color={colors.primary} />
              }
            />
            <Button
              title={t('proBookingDetail.actions.adjustDuration')}
              variant="outline"
              onPress={handleOpenDuration}
              disabled={actionLoading}
              fullWidth
              leftIcon={
                <Ionicons name="hourglass-outline" size={18} color={colors.primary} />
              }
            />
          </View>
        )}

        {(booking.status === 'pending_payment' ||
          booking.status === 'pending' ||
          booking.status === 'confirmed') && (
          <View style={[styles.actionsContainer, { paddingHorizontal: spacing.lg, marginTop: spacing.sm }]}>
            <Button
              title={t('proBookingDetail.actions.addService')}
              variant="outline"
              onPress={() => setShowAddService(true)}
              disabled={actionLoading}
              fullWidth
              leftIcon={<Ionicons name="add" size={18} color={colors.primary} />}
            />
          </View>
        )}

        {booking.status === 'confirmed' && (
          <View
            style={[
              styles.actionsContainer,
              {
                paddingHorizontal: spacing.lg,
                marginTop: spacing.sm,
                gap: spacing.sm,
              },
            ]}
          >
            <Button
              title={t('proBookingDetail.actions.reschedule')}
              variant="outline"
              onPress={handleReschedule}
              disabled={actionLoading}
              fullWidth
              leftIcon={
                <Ionicons name="calendar-outline" size={18} color={colors.primary} />
              }
            />
            {!isPast && (
              <Button
                title={t('proBookingDetail.actions.adjustDuration')}
                variant="outline"
                onPress={handleOpenDuration}
                disabled={actionLoading}
                fullWidth
                leftIcon={
                  <Ionicons name="hourglass-outline" size={18} color={colors.primary} />
                }
              />
            )}
            {isPast && (
              <Button
                title={t('proBookingDetail.actions.markNoShow')}
                variant="outline"
                onPress={handleMarkNoShow}
                disabled={actionLoading}
                loading={actionLoading}
                fullWidth
                leftIcon={
                  <Ionicons name="alert-circle-outline" size={18} color={colors.warning} />
                }
                style={{ borderColor: colors.warning }}
              />
            )}
            <Button
              title={t('proBookingDetail.actions.cancelBooking')}
              variant="outline"
              onPress={handleCancel}
              disabled={actionLoading}
              fullWidth
              leftIcon={
                <Ionicons name="close-circle-outline" size={18} color={colors.error} />
              }
              style={{ borderColor: colors.error }}
            />
          </View>
        )}
      </ScrollView>

      {/* ===== Reschedule Modal (full-screen with available slots) ===== */}
      <Modal
        visible={showRescheduleModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowRescheduleModal(false)}
      >
        <SafeAreaView style={[rescheduleStyles.container, { backgroundColor: colors.background }]}>
          {/* Header */}
          <View
            style={[
              rescheduleStyles.header,
              {
                paddingHorizontal: spacing.lg,
                paddingVertical: spacing.md,
                borderBottomWidth: 1,
                borderBottomColor: colors.divider,
              },
            ]}
          >
            <Pressable onPress={() => setShowRescheduleModal(false)}>
              <Text variant="body" color="textSecondary">
                {t('common.close')}
              </Text>
            </Pressable>
            <Text variant="body" style={{ fontWeight: '600' }}>
              {t('proBookingDetail.reschedule.title')}
            </Text>
            <View style={{ width: 50 }} />
          </View>

          {/* Calendar strip */}
          <View style={{ paddingVertical: spacing.md }}>
            <CalendarStrip
              selectedDate={rescheduleDate}
              onSelectDate={handleRescheduleDateChange}
            />
          </View>

          {/* Available slots */}
          <ScrollView
            contentContainerStyle={{
              paddingHorizontal: spacing.lg,
              paddingBottom: spacing['3xl'],
            }}
            showsVerticalScrollIndicator={false}
          >
            <Text variant="h3" style={{ marginBottom: spacing.md }}>
              {t('proBookingDetail.reschedule.availableSlots')}
            </Text>

            {loadingSlots ? (
              <Card padding="lg" shadow="sm">
                <View style={rescheduleStyles.loaderContainer}>
                  <Loader />
                  <Text
                    variant="body"
                    color="textSecondary"
                    style={{ marginTop: spacing.md }}
                  >
                    {t('proBookingDetail.reschedule.loadingSlots')}
                  </Text>
                </View>
              </Card>
            ) : rescheduleSlots.length === 0 ? (
              <EmptyState
                icon="time-outline"
                title={t('proBookingDetail.reschedule.noSlotsTitle')}
                description={t('proBookingDetail.reschedule.noSlotsDescription')}
              />
            ) : (
              <View>
                {PERIODS_CONFIG.map((period) => (
                  <TimeSlotSection
                    key={period.key}
                    title={t(period.labelKey)}
                    icon={period.icon}
                    backgroundColor={period.backgroundColor}
                    accentColor={period.accentColor}
                    slots={groupedRescheduleSlots[period.key]}
                    isExpanded={expandedSections[period.key]}
                    onToggle={() => toggleRescheduleSection(period.key)}
                    selectedSlot={selectedRescheduleSlot?.start || null}
                    onSelectSlot={handleSelectRescheduleSlot}
                  />
                ))}
              </View>
            )}
          </ScrollView>

          {/* Fixed bottom confirm button */}
          {selectedRescheduleSlot && (
            <View
              style={[
                rescheduleStyles.bottomBar,
                {
                  padding: spacing.lg,
                  paddingBottom: spacing.xl,
                  backgroundColor: colors.background,
                  borderTopWidth: 1,
                  borderTopColor: colors.divider,
                },
              ]}
            >
              <Button
                title={t('proBookingDetail.reschedule.confirmWithTime', { time: selectedRescheduleSlot.start })}
                variant="primary"
                size="lg"
                onPress={handleRescheduleConfirm}
                fullWidth
                leftIcon={
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={20}
                    color={colors.textInverse}
                  />
                }
              />
            </View>
          )}
        </SafeAreaView>
      </Modal>

      {/* ===== Adjust duration Modal (this booking's time block only) ===== */}
      <Modal
        visible={showDurationModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDurationModal(false)}
      >
        <Pressable
          onPress={() => setShowDurationModal(false)}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: spacing.lg }}
        >
          <Pressable
            onPress={() => Keyboard.dismiss()}
            style={{ width: '100%', maxWidth: 420, backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg }}
          >
            <Text variant="h3" align="center">{t('proBookingDetail.actions.adjustDuration')}</Text>
            <Text variant="caption" color="textSecondary" align="center" style={{ marginTop: 4 }}>
              {t('proBookingDetail.duration.subtitle')}
            </Text>

            {/* Direct editor: − / editable value / + */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.lg, marginTop: spacing.lg }}>
              <Pressable
                onPress={() => bumpDuration(-5)}
                disabled={durationDraft <= 5}
                style={({ pressed }) => ({
                  width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.border,
                  alignItems: 'center', justifyContent: 'center',
                  opacity: durationDraft <= 5 ? 0.4 : pressed ? 0.6 : 1,
                })}
              >
                <Ionicons name="remove" size={22} color={colors.text} />
              </Pressable>

              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                <TextInput
                  value={String(durationDraft)}
                  onChangeText={(t) => setDurationDraft(Math.min(24 * 60, Math.max(0, parseInt(t.replace(/[^0-9]/g, '') || '0', 10))))}
                  keyboardType="number-pad"
                  maxLength={4}
                  selectTextOnFocus
                  inputAccessoryViewID={Platform.OS === 'ios' ? 'durationAccessory' : undefined}
                  style={{ minWidth: 70, textAlign: 'center', fontSize: 40, fontWeight: '800', color: colors.primary, padding: 0 }}
                />
                <Text variant="body" color="textSecondary">min</Text>
              </View>

              <Pressable
                onPress={() => bumpDuration(5)}
                disabled={durationDraft >= 24 * 60}
                style={({ pressed }) => ({
                  width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.border,
                  alignItems: 'center', justifyContent: 'center',
                  opacity: durationDraft >= 24 * 60 ? 0.4 : pressed ? 0.6 : 1,
                })}
              >
                <Ionicons name="add" size={22} color={colors.text} />
              </Pressable>
            </View>

            {/* Real-time recap */}
            <View
              style={{
                marginTop: spacing.lg,
                borderRadius: radius.lg,
                paddingVertical: spacing.sm,
                paddingHorizontal: spacing.md,
                backgroundColor:
                  durationDraft === booking.duration
                    ? colors.surfaceSecondary
                    : durationDraft < booking.duration
                      ? '#16A34A15'
                      : '#D9770615',
              }}
            >
              <Text
                variant="caption"
                align="center"
                style={{
                  lineHeight: 18,
                  color:
                    durationDraft === booking.duration
                      ? colors.textMuted
                      : durationDraft < booking.duration
                        ? '#16A34A'
                        : '#D97706',
                }}
              >
                {durationDraft === booking.duration
                  ? t('proBookingDetail.duration.unchanged', { duration: booking.duration })
                  : t('proBookingDetail.duration.recap', {
                      from: booking.duration,
                      to: durationDraft,
                      delta:
                        durationDraft < booking.duration
                          ? `−${booking.duration - durationDraft}`
                          : `+${durationDraft - booking.duration}`,
                      end: formatEndTime(booking.datetime, durationDraft),
                    })}
              </Text>
            </View>

            <Text variant="caption" color="textMuted" align="center" style={{ marginTop: spacing.md, lineHeight: 18 }}>
              {t('proBookingDetail.duration.hint')}
            </Text>

            <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
              <Button
                title={t('common.save')}
                onPress={handleSaveDuration}
                disabled={actionLoading || durationDraft === booking.duration || durationDraft < 5}
                fullWidth
              />
              <Pressable onPress={() => setShowDurationModal(false)} style={{ paddingVertical: 10 }}>
                <Text variant="body" color="textSecondary" align="center">{t('common.cancel')}</Text>
              </Pressable>
            </View>

            {/* iOS number-pad has no return key — provide an OK bar to dismiss it. */}
            {Platform.OS === 'ios' && (
              <InputAccessoryView nativeID="durationAccessory">
                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', backgroundColor: colors.surfaceSecondary, paddingHorizontal: 12, paddingVertical: 8 }}>
                  <Pressable onPress={() => Keyboard.dismiss()} hitSlop={8} style={{ paddingHorizontal: 16, paddingVertical: 4 }}>
                    <Text variant="body" style={{ color: colors.primary, fontWeight: '700' }}>OK</Text>
                  </Pressable>
                </View>
              </InputAccessoryView>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* ===== Add a prestation Modal ===== */}
      <Modal
        visible={showAddService}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setPendingChoiceService(null);
          setPendingConfirm(null);
          setShowAddService(false);
        }}
      >
        <SafeAreaView style={[rescheduleStyles.container, { backgroundColor: colors.background }]}>
          {pendingConfirm ? (
            // ── Confirmation recap (final acceptance before adding) ──
            <>
              <View style={[rescheduleStyles.header, { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider }]}>
                <Pressable
                  onPress={() => {
                    const svc = pendingConfirm.service;
                    setPendingConfirm(null);
                    if (serviceHasChoices(svc)) setPendingChoiceService(svc);
                  }}
                  hitSlop={8}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}
                >
                  <Ionicons name="chevron-back" size={22} color={colors.text} />
                  <Text variant="h3">{t('proBookingDetail.addService.confirmTitle')}</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setPendingConfirm(null);
                    setPendingChoiceService(null);
                    setShowAddService(false);
                  }}
                  hitSlop={8}
                >
                  <Ionicons name="close" size={24} color={colors.text} />
                </Pressable>
              </View>
              {(() => {
                const sel = pendingConfirm.selections ?? emptyServiceSelections();
                const eff = computeServiceTotal(pendingConfirm.service, sel);
                const denorm = buildBookingSelections(pendingConfirm.service, sel);
                const existing = bookingItems.length
                  ? bookingItems.map((i) => ({ name: i.serviceName, price: i.price }))
                  : [{ name: booking.serviceName, price: booking.price }];
                const newTotalPrice = booking.price + eff.price;
                const newTotalDuration = booking.duration + eff.duration;
                const adding = addingServiceId === pendingConfirm.service.id;
                return (
                  <>
                    <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
                      {/* Prestation being added — hero */}
                      <View style={{ borderRadius: 16, padding: spacing.lg, backgroundColor: colors.primaryLight || '#e4effa', gap: spacing.xs }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
                            <Ionicons name="add" size={15} color="#FFFFFF" />
                          </View>
                          <Text variant="caption" color="primary" style={{ fontWeight: '800', letterSpacing: 0.5 }}>
                            {t('proBookingDetail.addService.addedBadge')}
                          </Text>
                        </View>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: spacing.sm, marginTop: 2 }}>
                          <Text variant="h3" style={{ fontWeight: '800', flex: 1 }} numberOfLines={2}>
                            {pendingConfirm.service.name}
                          </Text>
                          <Text variant="h3" color="primary" style={{ fontWeight: '800' }}>{formatPrice(eff.price)}</Text>
                        </View>
                        {(denorm.selectedVariations.length > 0 || denorm.selectedOptions.length > 0) && (
                          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 }}>
                            {denorm.selectedVariations.map((v) => (
                              <View key={v.variationId} style={{ backgroundColor: colors.background, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 }}>
                                <Text variant="caption" color="textSecondary">{v.variationName} : {v.optionName}</Text>
                              </View>
                            ))}
                            {denorm.selectedOptions.map((o) => (
                              <View key={o.optionId} style={{ backgroundColor: colors.background, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 }}>
                                <Text variant="caption" color="textSecondary">+ {o.optionName}</Text>
                              </View>
                            ))}
                          </View>
                        )}
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                          <Ionicons name="time-outline" size={13} color={colors.primary} />
                          <Text variant="caption" color="primary" style={{ fontWeight: '600' }}>{formatDuration(eff.duration)}</Text>
                        </View>
                      </View>

                      {/* Booking recap card */}
                      <Card padding="lg" shadow="sm">
                        <Text variant="bodySmall" style={{ fontWeight: '700', marginBottom: spacing.sm, color: colors.text }}>
                          {t('proBookingDetail.addService.recapTitle')}
                        </Text>
                        {existing.map((it, idx) => (
                          <View key={idx} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm, paddingVertical: 5 }}>
                            <Text variant="bodySmall" color="textSecondary" style={{ flex: 1 }} numberOfLines={1}>{it.name}</Text>
                            <Text variant="bodySmall" color="textSecondary">{formatPrice(it.price)}</Text>
                          </View>
                        ))}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm, paddingVertical: 5 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary }} />
                            <Text variant="bodySmall" color="primary" style={{ fontWeight: '700', flex: 1 }} numberOfLines={1}>
                              {pendingConfirm.service.name}
                            </Text>
                          </View>
                          <Text variant="bodySmall" color="primary" style={{ fontWeight: '700' }}>{formatPrice(eff.price)}</Text>
                        </View>

                        <View style={{ height: 1, backgroundColor: colors.border, marginVertical: spacing.sm }} />

                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Text variant="body" style={{ fontWeight: '800' }}>{t('proBookingDetail.addService.newTotal')}</Text>
                          <Text variant="h2" color="primary" style={{ fontWeight: '800' }}>{formatPrice(newTotalPrice)}</Text>
                        </View>

                        <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
                          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, padding: spacing.md, borderRadius: 12, backgroundColor: colors.surfaceSecondary }}>
                            <Ionicons name="time-outline" size={16} color={colors.primary} />
                            <View style={{ flex: 1 }}>
                              <Text variant="caption" color="textMuted">{t('proBookingDetail.details.time')}</Text>
                              <Text variant="bodySmall" style={{ fontWeight: '700' }} numberOfLines={1}>
                                {formatTime(booking.datetime)} – {formatEndTime(booking.datetime, newTotalDuration)}
                              </Text>
                            </View>
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, padding: spacing.md, borderRadius: 12, backgroundColor: colors.surfaceSecondary }}>
                            <Ionicons name="hourglass-outline" size={16} color={colors.primary} />
                            <View>
                              <Text variant="caption" color="textMuted">{t('proBookingDetail.details.duration')}</Text>
                              <Text variant="bodySmall" style={{ fontWeight: '700' }}>{formatDuration(newTotalDuration)}</Text>
                            </View>
                          </View>
                        </View>
                      </Card>
                    </ScrollView>

                    <View style={{ padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.divider }}>
                      <Button
                        title={t('proBookingDetail.addService.confirmTitle')}
                        variant="primary"
                        fullWidth
                        onPress={() => submitAddService(pendingConfirm.service.id, pendingConfirm.selections)}
                        disabled={adding}
                        loading={adding}
                        leftIcon={<Ionicons name="checkmark" size={18} color="#FFFFFF" />}
                      />
                    </View>
                  </>
                );
              })()}
            </>
          ) : pendingChoiceService ? (
            // ── Choices picker (service with variations / options / infos) ──
            <>
              <View style={[rescheduleStyles.header, { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider }]}>
                <Pressable
                  onPress={() => setPendingChoiceService(null)}
                  hitSlop={8}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexShrink: 1 }}
                >
                  <Ionicons name="chevron-back" size={22} color={colors.text} />
                  <Text variant="h3" numberOfLines={1} style={{ flexShrink: 1 }}>
                    {pendingChoiceService.name}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setPendingChoiceService(null);
                    setShowAddService(false);
                  }}
                  hitSlop={8}
                >
                  <Ionicons name="close" size={24} color={colors.text} />
                </Pressable>
              </View>
              <ServiceChoicesPreview
                mode="picker"
                confirmLabel={t('proBookingDetail.addService.continueLabel')}
                confirmLoading={false}
                onConfirm={(sel) => {
                  setPendingConfirm({ service: pendingChoiceService, selections: sel });
                  setPendingChoiceService(null);
                }}
                service={{
                  name: pendingChoiceService.name,
                  price: pendingChoiceService.price,
                  duration: pendingChoiceService.duration,
                  photoURL: pendingChoiceService.photoURL,
                  variations: pendingChoiceService.variations ?? [],
                  options: pendingChoiceService.options ?? [],
                  infoFields: pendingChoiceService.infoFields ?? [],
                }}
              />
            </>
          ) : (
            // ── Service list grouped by category ──
            <>
              <View style={[rescheduleStyles.header, { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider }]}>
                <Text variant="h3">{t('proBookingDetail.actions.addService')}</Text>
                <Pressable onPress={() => setShowAddService(false)} hitSlop={8}>
                  <Ionicons name="close" size={24} color={colors.text} />
                </Pressable>
              </View>
              <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xl }}>
                <Text variant="bodySmall" color="textSecondary" style={{ marginBottom: spacing.xs }}>
                  {t('proBookingDetail.addService.description')}
                </Text>
                {addServiceList.length === 0 ? (
                  <View style={{ alignItems: 'center', paddingVertical: spacing.xl }}>
                    <ActivityIndicator color={colors.primary} />
                  </View>
                ) : (
                  (() => {
                    const grouped = addServiceCategories
                      .map((cat) => ({ cat, items: addServiceList.filter((s) => s.categoryId === cat.id) }))
                      .filter((g) => g.items.length > 0);
                    const knownCatIds = new Set(addServiceCategories.map((c) => c.id));
                    const uncategorized = addServiceList.filter(
                      (s) => !s.categoryId || !knownCatIds.has(s.categoryId),
                    );
                    return (
                      <>
                        {grouped.map(({ cat, items }) => (
                          <View key={cat.id} style={{ gap: spacing.sm }}>
                            {renderAddServiceBand(cat.name, items.length)}
                            {items.map(renderAddServiceRow)}
                          </View>
                        ))}
                        {uncategorized.length > 0 && (
                          <View style={{ gap: spacing.sm }}>
                            {grouped.length > 0 && renderAddServiceBand(t('proBookingDetail.addService.otherServices'), uncategorized.length)}
                            {uncategorized.map(renderAddServiceRow)}
                          </View>
                        )}
                      </>
                    );
                  })()
                )}
              </ScrollView>
            </>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  clientCardContent: {
    alignItems: 'center',
  },
  contactRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  actionsContainer: {},
  actionsRow: {
    flexDirection: 'row',
  },
});

const rescheduleStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  loaderContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
  },
  bottomBar: {},
});
