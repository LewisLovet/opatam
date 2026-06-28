/**
 * StoryShareModal — Preview & share story to social networks
 *
 * Flow:
 * 1. Renders StoryCard as a preview
 * 2. User customizes: display mode (services / hours / none), service selection
 * 3. Captures the card as a PNG via react-native-view-shot
 * 4. Shares via react-native-share (dev client/production) or expo-sharing (Expo Go)
 */

import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  Pressable,
  Alert,
  Platform,
  Linking,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';

// Safe import — react-native-view-shot requires native module
let captureRef: typeof import('react-native-view-shot').captureRef | null = null;
try {
  captureRef = require('react-native-view-shot').captureRef;
} catch {
  // Native module not available
}
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { catalogService, memberService, schedulingService } from '@booking-app/firebase';
import type { Service, Member } from '@booking-app/shared';
import { APP_CONFIG } from '@booking-app/shared';
import { useTheme } from '../../theme';
import { Text } from '../Text';
import { useNewFeatures } from '../../hooks/useNewFeatures';
import { useProvider } from '../../contexts';
import { useUpcomingAvailabilities } from '../../hooks/useUpcomingAvailabilities';
import { useServiceCategories } from '../../hooks/useServiceCategories';
import { ServicePickerModal } from '../business';
import { StatusBar } from 'expo-status-bar';
import { StoryCard, type MonthAvailabilityGrid, type MonthAvailabilityDay } from './StoryCard';

// Try to import react-native-share (only available in dev client / production builds)
let RNShare: typeof import('react-native-share').default | null = null;
try {
  const mod = require('react-native-share');
  RNShare = mod.default || mod;
} catch {
  // react-native-share not available (e.g. Expo Go)
}

// Facebook App ID required for Instagram Stories & Facebook Stories sharing
// Create one at https://developers.facebook.com if not yet available
const FACEBOOK_APP_ID = '2649028388814234';

const MONTHS_SHORT = [
  'janv', 'févr', 'mars', 'avr', 'mai', 'juin',
  'juill', 'août', 'sept', 'oct', 'nov', 'déc',
];

/** Build the human-readable date span for a given week offset. Mirrors
 *  the formatting the story card uses internally so the modal label
 *  matches what gets captured. */
function formatWeekRange(offset: number, days: number): string {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() + offset * 7);
  const end = new Date(start);
  end.setDate(end.getDate() + days - 1);

  const sameMonth = start.getMonth() === end.getMonth();
  const sameYear = start.getFullYear() === end.getFullYear();
  if (sameMonth && sameYear) {
    return `${start.getDate()} → ${end.getDate()} ${MONTHS_SHORT[end.getMonth()]} ${end.getFullYear()}`;
  }
  if (sameYear) {
    return `${start.getDate()} ${MONTHS_SHORT[start.getMonth()]} → ${end.getDate()} ${MONTHS_SHORT[end.getMonth()]} ${end.getFullYear()}`;
  }
  return `${start.getDate()} ${MONTHS_SHORT[start.getMonth()]} ${start.getFullYear()} → ${end.getDate()} ${MONTHS_SHORT[end.getMonth()]} ${end.getFullYear()}`;
}

/** Resolve a Date that's `offset` days after today (midnight). Used by
 *  the day-scope label + date picker initial value. */
function dateForDayOffset(offset: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  return d;
}

/** Compute the day offset between today and a picked date — clamped
 *  to [0, MAX] by the caller. */
function dayOffsetFromDate(picked: Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(picked);
  target.setHours(0, 0, 0, 0);
  const diff = Math.round(
    (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );
  return Math.max(0, diff);
}

const DAY_LABEL_NAMES = [
  'Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi',
];

/** "Aujourd'hui" / "Demain" / "Mardi 13 mai" — the headline of the
 *  day selector. Concise + readable across any offset. */
function formatDayOffsetLabel(offset: number): string {
  if (offset === 0) return "Aujourd'hui";
  if (offset === 1) return 'Demain';
  const d = dateForDayOffset(offset);
  return `${DAY_LABEL_NAMES[d.getDay()]} ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

/** Subtitle under the headline — full date so an offset like
 *  "Demain" still tells you exactly which day. */
function formatDayOffsetSubtitle(offset: number): string {
  const d = dateForDayOffset(offset);
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

type WithId<T> = { id: string } & T;

type DisplayMode = 'services' | 'availabilities' | 'none';
/**
 * Sub-toggle inside the "Dispos" mode — week-grid (the historical
 * heatmap) vs the new today-only list of free time slots. Picked
 * as a sub-mode rather than a 4th top-level mode to keep the
 * primary toggle to 3 chips and avoid crowding.
 */
type AvailabilityScope = 'week' | 'day' | 'month';

const FRENCH_MONTHS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

/** "Juin 2026" for `today + offset` months (1st of that month). */
function monthLabelForOffset(offset: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setMonth(d.getMonth() + offset, 1);
  return `${FRENCH_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

interface StoryShareModalProps {
  visible: boolean;
  onClose: () => void;
}

interface SocialNetwork {
  key: string;
  label: string;
  icon: string;
  color: string;
}

const NETWORKS: SocialNetwork[] = [
  { key: 'instagram', label: 'Instagram', icon: 'logo-instagram', color: '#E1306C' },
  { key: 'share', label: 'Partager', icon: 'share-outline', color: '#555555' },
];

const DISPLAY_MODES: { key: DisplayMode; label: string; icon: string }[] = [
  { key: 'services', label: 'Prestations', icon: 'pricetags-outline' },
  { key: 'availabilities', label: 'Dispos', icon: 'calendar-outline' },
  { key: 'none', label: 'QR Code', icon: 'qr-code-outline' },
];

export function StoryShareModal({ visible, onClose }: StoryShareModalProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { provider } = useProvider();
  const { categories } = useServiceCategories(provider?.id);
  const viewRef = useRef<View>(null);
  // "Nouveau" pill on the Dispos toggle — visible until the pro
  // taps it once. Mirrors the FAB indicator and is the canonical
  // "this feature has been seen" event.
  const { isNew, markSeen } = useNewFeatures();
  const showDisposNew = isNew('story-share-2026-05');
  const [sharing, setSharing] = useState<string | null>(null);
  const [services, setServices] = useState<WithId<Service>[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [displayMode, setDisplayMode] = useState<DisplayMode>('services');
  const [selectedServiceIds, setSelectedServiceIds] = useState<Set<string>>(new Set());
  const [showLinkReminder, setShowLinkReminder] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  // Story theme — applies globally (services, dispos, QR Code).
  // 'dark' = navy bg + accent blue, 'light' = the existing white/grey
  // gradient with primary blue accents. Defaults to light to match
  // the historical look of the existing share output.
  const [storyTheme, setStoryTheme] =
    useState<'light' | 'dark'>('light');

  // Week offset (0 = this week, 1 = next, …). Capped at 4 to keep
  // the share UX focused on near-term planning.
  const [weekOffset, setWeekOffset] = useState(0);
  const MAX_WEEK_OFFSET = 4;

  // Sub-toggle inside the "Dispos" mode — see AvailabilityScope above.
  const [availabilityScope, setAvailabilityScope] =
    useState<AvailabilityScope>('week');

  // Month scope state — month offset (0 = this month), an optional prestation
  // (null = general view), the resolved member, and the computed grid.
  const [monthOffset, setMonthOffset] = useState(0);
  const MAX_MONTH_OFFSET = 3;
  const [monthServiceId, setMonthServiceId] = useState<string | null>(null);
  const [monthDurationOverride, setMonthDurationOverride] = useState<number | undefined>(undefined);
  const [monthServiceLabel, setMonthServiceLabel] = useState('Vue générale');
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  // Team member selection for the availability story. null = all members
  // (availability is the union / best status across the team).
  const [members, setMembers] = useState<WithId<Member>[]>([]);
  const [storyMemberId, setStoryMemberId] = useState<string | null>(null);
  const [monthGrid, setMonthGrid] = useState<MonthAvailabilityGrid | undefined>(undefined);
  const [loadingMonth, setLoadingMonth] = useState(false);

  // Day offset (0 = today, 1 = tomorrow, …) used by the day scope.
  // Capped to 90 days so the picker stays sane — providers rarely
  // accept bookings further out than that.
  const [dayOffset, setDayOffset] = useState(0);
  const MAX_DAY_OFFSET = 90;

  // Native date-picker sheet for "pick a specific date" UX. Only
  // mounted when the user explicitly taps the date label.
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Fetch upcoming availabilities — only when the user actually opens
  // the "Dispos" mode, since it triggers a heavier scheduling query.
  // Day scope = single day window at `dayOffset`; week scope = the
  // existing 7-day heatmap at `weekOffset`. The hook prioritises
  // dayOffset over weekOffset when both are passed.
  const {
    grid: availabilityGrid,
    loading: loadingAvailabilities,
    refresh: refreshAvailabilities,
  } = useUpcomingAvailabilities({
    providerId: provider?.id,
    days: availabilityScope === 'day' ? 1 : 7,
    weekOffset: availabilityScope === 'day' ? undefined : weekOffset,
    dayOffset: availabilityScope === 'day' ? dayOffset : undefined,
    memberId: storyMemberId,
    enabled: visible && displayMode === 'availabilities' && availabilityScope !== 'month',
  });

  // Fetch services when the modal opens
  useEffect(() => {
    if (!visible || !provider) return;
    let cancelled = false;

    (async () => {
      setLoadingServices(true);
      try {
        const [data, membersData] = await Promise.all([
          catalogService.getActiveByProvider(provider.id),
          memberService.getByProvider(provider.id),
        ]);
        if (!cancelled) {
          setServices(data);
          // Pre-select first 5
          setSelectedServiceIds(new Set(data.slice(0, 5).map((s) => s.id)));
          setMembers(membersData);
        }
      } catch (err) {
        console.error('[StoryShare] Error loading services:', err);
      } finally {
        if (!cancelled) setLoadingServices(false);
      }
    })();

    return () => { cancelled = true; };
  }, [visible, provider]);

  // Build the month availability grid (per-day status) for the story. General
  // view → occupancy; a picked prestation → its availability. Adapts the story.
  useEffect(() => {
    if (
      !visible ||
      displayMode !== 'availabilities' ||
      availabilityScope !== 'month' ||
      !provider ||
      members.length === 0
    ) {
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingMonth(true);
      try {
        const first = new Date();
        first.setHours(0, 0, 0, 0);
        first.setMonth(first.getMonth() + monthOffset, 1);
        const dow = first.getDay();
        const offset = dow === 0 ? 6 : dow - 1;
        const gridStart = new Date(first);
        gridStart.setDate(first.getDate() - offset);
        gridStart.setHours(0, 0, 0, 0);
        const days42 = Array.from({ length: 42 }, (_, i) => {
          const d = new Date(gridStart);
          d.setDate(gridStart.getDate() + i);
          return d;
        });
        const gridEnd = new Date(days42[41]);
        gridEnd.setHours(23, 59, 59, 999);

        // A specific member → just them; otherwise merge across the whole team
        // — best status per day (available > almost_full > full > closed).
        const activeMembers = members.filter((m) => m.isActive !== false);
        const pool = activeMembers.length > 0 ? activeMembers : members;
        const targetMembers = storyMemberId ? pool.filter((m) => m.id === storyMemberId) : pool;
        const effective = targetMembers.length > 0 ? targetMembers : [pool[0]];
        const rank: Record<string, number> = { closed: 0, full: 1, almost_full: 2, available: 3 };

        const map: Record<string, string> = {};
        for (const mem of effective) {
          const ds = monthServiceId
            ? await schedulingService.getAvailabilitySummary({
                providerId: provider.id,
                serviceId: monthServiceId,
                memberId: mem.id,
                startDate: gridStart,
                endDate: gridEnd,
                durationOverride: monthDurationOverride,
              })
            : await schedulingService.getOccupancySummary({
                providerId: provider.id,
                memberId: mem.id,
                startDate: gridStart,
                endDate: gridEnd,
              });
          for (const d of ds) {
            const cur = map[d.date];
            if (!cur || (rank[d.status] ?? 0) > (rank[cur] ?? 0)) map[d.date] = d.status;
          }
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const horizon = new Date(today);
        horizon.setDate(horizon.getDate() + (provider.settings?.maxBookingAdvance ?? 60));
        horizon.setHours(23, 59, 59, 999);
        const month = first.getMonth();
        const key = (d: Date) =>
          `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
            d.getDate(),
          ).padStart(2, '0')}`;

        const gridDays: MonthAvailabilityDay[] = days42.map((d) => {
          const past = d < today;
          const beyond = d > horizon;
          let status: MonthAvailabilityDay['status'] = 'none';
          if (!past && !beyond) {
            const s = map[key(d)];
            status =
              s === 'available' || s === 'almost_full' || s === 'full' || s === 'closed'
                ? (s as MonthAvailabilityDay['status'])
                : 'none';
          }
          return {
            dateKey: key(d),
            dayOfMonth: d.getDate(),
            inMonth: d.getMonth() === month,
            status,
          };
        });

        const label = monthLabelForOffset(monthOffset);
        const serviceLabel = monthServiceId
          ? services.find((s) => s.id === monthServiceId)?.name ?? null
          : null;
        if (!cancelled) {
          setMonthGrid({
            monthLabel: label.charAt(0).toUpperCase() + label.slice(1),
            serviceLabel,
            days: gridDays,
          });
        }
      } catch (e) {
        if (!cancelled) console.error('[StoryShare] month grid error', e);
      } finally {
        if (!cancelled) setLoadingMonth(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, displayMode, availabilityScope, monthOffset, monthServiceId, monthDurationOverride, storyMemberId, members, provider, services]);

  const bookingUrl = provider?.slug
    ? `${APP_CONFIG.url}/p/${provider.slug}`
    : APP_CONFIG.url;

  // Capture the story card as a PNG file
  const captureStory = useCallback(async (): Promise<string | null> => {
    if (!viewRef.current || !captureRef) return null;

    try {
      const uri = await captureRef(viewRef, {
        format: 'png',
        quality: 1,
        width: 1080,
        height: 1920,
      });

      if (uri.startsWith('file://')) return uri;
      return `file://${uri}`;
    } catch (err) {
      console.error('[StoryShare] Capture error:', err);
      return null;
    }
  }, []);

  // Fallback share via expo-sharing
  const fallbackShare = useCallback(async (fileUri: string) => {
    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      await Sharing.shareAsync(fileUri, {
        mimeType: 'image/png',
        UTI: 'public.png',
        dialogTitle: `Réservez chez ${provider?.businessName || 'nous'}`,
      });
    } else {
      Alert.alert('Erreur', 'Le partage n\'est pas disponible sur cet appareil.');
    }
  }, [provider?.businessName]);

  // Check if app is installed, show install prompt if not
  const checkAppInstalled = useCallback(async (
    scheme: string,
    appName: string,
    iosId: string,
    androidPackage: string,
  ): Promise<boolean> => {
    const canOpen = await Linking.canOpenURL(`${scheme}://`);
    if (!canOpen) {
      const storeUrl = Platform.OS === 'ios'
        ? `https://apps.apple.com/app/${appName.toLowerCase()}/id${iosId}`
        : `https://play.google.com/store/apps/details?id=${androidPackage}`;
      Alert.alert(
        `${appName} non installé`,
        `Installez ${appName} pour partager en story.`,
        [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Installer', onPress: () => Linking.openURL(storeUrl) },
        ],
      );
      return false;
    }
    return true;
  }, []);

  // Copy booking link to clipboard
  const handleCopyLink = useCallback(async () => {
    await Clipboard.setStringAsync(bookingUrl);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }, [bookingUrl]);

  // Instagram — show link reminder modal first
  const handleShareInstagram = useCallback(() => {
    setLinkCopied(false);
    setShowLinkReminder(true);
  }, []);

  // Actual Instagram sharing (called after user confirms from reminder modal)
  const proceedShareInstagram = useCallback(async () => {
    setShowLinkReminder(false);
    setSharing('instagram');
    try {
      const installed = await checkAppInstalled('instagram', 'Instagram', '389801252', 'com.instagram.android');
      if (!installed) return;

      const fileUri = await captureStory();
      if (!fileUri) { Alert.alert('Erreur', 'Impossible de capturer l\'image.'); return; }

      if (RNShare) {
        await RNShare.shareSingle({
          social: RNShare.Social.INSTAGRAM_STORIES as any,
          type: 'image/png',
          url: fileUri,
          backgroundImage: fileUri,
          appId: FACEBOOK_APP_ID,
        } as any);
      } else {
        await fallbackShare(fileUri);
      }
    } catch (error: any) {
      if (error?.message?.includes?.('User did not share')) return;
      if (error?.code === 'ECANCELLED' || error?.code === 'ERR_SHARING_ABORTED') return;
      const fileUri = await captureStory();
      if (fileUri) await fallbackShare(fileUri);
    } finally {
      setSharing(null);
    }
  }, [captureStory, fallbackShare, checkAppInstalled]);

  // Generic share — opens system share sheet
  const handleGenericShare = useCallback(async () => {
    setSharing('share');
    try {
      const fileUri = await captureStory();
      if (!fileUri) { Alert.alert('Erreur', 'Impossible de capturer l\'image.'); return; }
      await fallbackShare(fileUri);
    } catch {
      // Ignore
    } finally {
      setSharing(null);
    }
  }, [captureStory, fallbackShare]);

  const networkHandlers: Record<string, () => void> = {
    instagram: handleShareInstagram,
    share: handleGenericShare,
  };

  if (!provider) return null;

  const location = provider.cities?.[0] || '';
  const isSharing = sharing !== null;
  const isLoading =
    loadingServices ||
    (displayMode === 'availabilities' &&
      (availabilityScope === 'month'
        ? loadingMonth || !monthGrid
        : loadingAvailabilities));

  const toggleServiceId = useCallback((id: string) => {
    setSelectedServiceIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        // Max 5
        if (next.size >= 5) return prev;
        next.add(id);
      }
      return next;
    });
  }, []);

  const filteredServices = services
    .filter((s) => selectedServiceIds.has(s.id))
    .map((s) => ({ name: s.name, price: s.price, duration: s.duration }));

  const storyCardProps = {
    businessName: provider.businessName,
    category: provider.category,
    city: location,
    photoURL: provider.photoURL,
    services: filteredServices,
    bookingUrl,
    displayMode,
    availabilityGrid,
    monthGrid,
    availabilityScope,
    storyTheme,
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
        {/* Light status-bar content so the phone info stays visible over the
            blue header band (matches the rest of the app). */}
        <StatusBar style="light" />
        {/* Header — blue band into the top safe area, like the other screens. */}
        <View
          style={[
            styles.header,
            { paddingTop: insets.top + 8, backgroundColor: colors.primary },
          ]}
        >
          <Pressable onPress={onClose} hitSlop={12} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
          </Pressable>
          <Text style={[styles.headerTitle, { color: '#FFFFFF' }]}>
            Créer une story
          </Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Off-screen capture target (full size, hidden) */}
        <View style={styles.offScreen} pointerEvents="none">
          <View ref={viewRef} collapsable={false}>
            <StoryCard {...storyCardProps} />
          </View>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Preview (mini) */}
          <View style={styles.previewWrapper}>
            {isLoading ? (
              <View style={[styles.loadingContainer, { backgroundColor: colors.surface }]}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : (
              <View style={[styles.previewClip, { backgroundColor: colors.surface }]}>
                <View style={styles.previewScaler}>
                  <StoryCard {...storyCardProps} />
                </View>
              </View>
            )}
          </View>

          {/* Display mode selector */}
          <View style={styles.sectionSpacing}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
              Contenu affiché
            </Text>
            <View style={styles.modeRow}>
              {DISPLAY_MODES.map((mode) => {
                const isActive = displayMode === mode.key;
                // Dispos is the recently-shipped sub-mode — flag it
                // until the pro taps it at least once. The pill
                // mirrors the FAB indicator (same key) so they stay
                // in sync: pick Dispos here → both go away.
                const showNewPill =
                  mode.key === 'availabilities' && showDisposNew;
                return (
                  <Pressable
                    key={mode.key}
                    onPress={() => {
                      setDisplayMode(mode.key);
                      if (mode.key === 'availabilities' && showDisposNew) {
                        markSeen('story-share-2026-05');
                      }
                    }}
                    style={[
                      styles.modeButton,
                      {
                        backgroundColor: isActive ? colors.primary : colors.surface,
                        borderWidth: 1,
                        borderColor: isActive ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Ionicons
                      name={mode.icon as any}
                      size={18}
                      color={isActive ? '#fff' : colors.textSecondary}
                    />
                    <Text
                      style={[
                        styles.modeLabel,
                        { color: isActive ? '#fff' : colors.text },
                      ]}
                    >
                      {mode.label}
                    </Text>
                    {showNewPill && (
                      <View
                        style={{
                          position: 'absolute',
                          top: -8,
                          right: -6,
                          paddingHorizontal: 6,
                          paddingVertical: 2,
                          borderRadius: 999,
                          backgroundColor: '#E1306C',
                          borderWidth: 1.5,
                          borderColor: colors.surface,
                        }}
                      >
                        <Text
                          style={{
                            color: '#FFFFFF',
                            fontSize: 9,
                            fontWeight: '800',
                            textTransform: 'uppercase',
                            letterSpacing: 0.4,
                          }}
                        >
                          Nouveau
                        </Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Scope sub-toggle inside "Dispos" — pick between the
              7-day heatmap and the today-only slot list. Sits above
              the week selector because it CHANGES whether the week
              selector is even relevant. */}
          {displayMode === 'availabilities' && (
            <View style={styles.sectionSpacing}>
              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                Quand ?
              </Text>
              <View
                style={[
                  styles.scopeToggle,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                {(
                  [
                    { key: 'week', label: 'Semaine', icon: 'calendar-outline' },
                    { key: 'day', label: 'Jour', icon: 'sunny-outline' },
                    { key: 'month', label: 'Mois', icon: 'grid-outline' },
                  ] as const
                ).map((opt) => {
                  const active = availabilityScope === opt.key;
                  return (
                    <Pressable
                      key={opt.key}
                      onPress={() => setAvailabilityScope(opt.key)}
                      style={[
                        styles.scopeToggleOption,
                        active && {
                          backgroundColor: colors.primary,
                        },
                      ]}
                    >
                      <Ionicons
                        name={opt.icon as any}
                        size={14}
                        color={active ? '#FFF' : colors.text}
                      />
                      <Text
                        style={[
                          styles.scopeToggleLabel,
                          { color: active ? '#FFF' : colors.text },
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {/* Member selector — Teams only. Applies to every Dispos scope
              (week / day / month). "Tous les membres" = union availability. */}
          {displayMode === 'availabilities' && members.length > 1 && (
            <View style={styles.sectionSpacing}>
              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                Membre
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, paddingRight: 8 }}
              >
                {[
                  { id: null as string | null, name: 'Tous les membres' },
                  ...members
                    .filter((m) => m.isActive !== false)
                    .map((m) => ({ id: m.id as string | null, name: m.name })),
                ].map((opt) => {
                  const active = (opt.id ?? null) === storyMemberId;
                  return (
                    <Pressable
                      key={opt.id ?? 'all'}
                      onPress={() => setStoryMemberId(opt.id)}
                      style={{
                        paddingHorizontal: 14,
                        paddingVertical: 8,
                        borderRadius: 999,
                        borderWidth: 1,
                        backgroundColor: active ? colors.primary : colors.surface,
                        borderColor: active ? colors.primary : colors.border,
                      }}
                    >
                      <Text
                        style={{ fontSize: 13, fontWeight: '600', color: active ? '#FFFFFF' : colors.text }}
                        numberOfLines={1}
                      >
                        {opt.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* Week selector — only in "Dispos" mode AND week scope. */}
          {displayMode === 'availabilities' && availabilityScope === 'week' && (
            <View style={styles.sectionSpacing}>
              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                Semaine
              </Text>
              <View
                style={[
                  styles.weekSelector,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Pressable
                  onPress={() => setWeekOffset((o) => Math.max(0, o - 1))}
                  disabled={weekOffset === 0}
                  hitSlop={8}
                  style={[
                    styles.weekArrow,
                    weekOffset === 0 && { opacity: 0.3 },
                  ]}
                >
                  <Ionicons name="chevron-back" size={20} color={colors.text} />
                </Pressable>
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={[styles.weekLabel, { color: colors.text }]}>
                    {weekOffset === 0
                      ? 'Cette semaine'
                      : weekOffset === 1
                        ? 'Semaine prochaine'
                        : `Dans ${weekOffset} semaines`}
                  </Text>
                  <Text style={[styles.weekRange, { color: colors.textSecondary }]}>
                    {formatWeekRange(weekOffset, 7)}
                  </Text>
                </View>
                <Pressable
                  onPress={() => setWeekOffset((o) => Math.min(MAX_WEEK_OFFSET, o + 1))}
                  disabled={weekOffset === MAX_WEEK_OFFSET}
                  hitSlop={8}
                  style={[
                    styles.weekArrow,
                    weekOffset === MAX_WEEK_OFFSET && { opacity: 0.3 },
                  ]}
                >
                  <Ionicons name="chevron-forward" size={20} color={colors.text} />
                </Pressable>
              </View>
            </View>
          )}

          {/* Day selector — only in "Dispos" mode AND day scope.
              Same chevron-pattern as the week selector but the label
              itself is tappable to open a native date picker for
              direct day selection (much faster than 30+ chevron taps
              if the pro wants a date 5 weeks out). */}
          {displayMode === 'availabilities' && availabilityScope === 'day' && (
            <View style={styles.sectionSpacing}>
              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                Jour
              </Text>
              <View
                style={[
                  styles.weekSelector,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Pressable
                  onPress={() => setDayOffset((o) => Math.max(0, o - 1))}
                  disabled={dayOffset === 0}
                  hitSlop={8}
                  style={[
                    styles.weekArrow,
                    dayOffset === 0 && { opacity: 0.3 },
                  ]}
                >
                  <Ionicons name="chevron-back" size={20} color={colors.text} />
                </Pressable>
                <Pressable
                  onPress={() => setShowDatePicker(true)}
                  style={{ flex: 1, alignItems: 'center' }}
                >
                  <Text style={[styles.weekLabel, { color: colors.text }]}>
                    {formatDayOffsetLabel(dayOffset)}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Text style={[styles.weekRange, { color: colors.textSecondary }]}>
                      {formatDayOffsetSubtitle(dayOffset)}
                    </Text>
                    <Ionicons
                      name="calendar-outline"
                      size={11}
                      color={colors.textSecondary}
                    />
                  </View>
                </Pressable>
                <Pressable
                  onPress={() =>
                    setDayOffset((o) => Math.min(MAX_DAY_OFFSET, o + 1))
                  }
                  disabled={dayOffset === MAX_DAY_OFFSET}
                  hitSlop={8}
                  style={[
                    styles.weekArrow,
                    dayOffset === MAX_DAY_OFFSET && { opacity: 0.3 },
                  ]}
                >
                  <Ionicons name="chevron-forward" size={20} color={colors.text} />
                </Pressable>
              </View>
              <Text
                style={[
                  styles.dayHint,
                  { color: colors.textSecondary },
                ]}
              >
                Touchez la date pour choisir un autre jour
              </Text>
            </View>
          )}

          {/* Month + prestation selectors — only in "Dispos" mode AND month
              scope. The story adapts: general view or the picked prestation. */}
          {displayMode === 'availabilities' && availabilityScope === 'month' && (
            <>
              <View style={styles.sectionSpacing}>
                <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                  Mois
                </Text>
                <View
                  style={[
                    styles.weekSelector,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                  ]}
                >
                  <Pressable
                    onPress={() => setMonthOffset((o) => Math.max(0, o - 1))}
                    disabled={monthOffset === 0}
                    hitSlop={8}
                    style={[styles.weekArrow, monthOffset === 0 && { opacity: 0.3 }]}
                  >
                    <Ionicons name="chevron-back" size={20} color={colors.text} />
                  </Pressable>
                  <View style={{ flex: 1, alignItems: 'center' }}>
                    <Text
                      style={[
                        styles.weekLabel,
                        { color: colors.text, textTransform: 'capitalize' },
                      ]}
                    >
                      {monthLabelForOffset(monthOffset)}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => setMonthOffset((o) => Math.min(MAX_MONTH_OFFSET, o + 1))}
                    disabled={monthOffset === MAX_MONTH_OFFSET}
                    hitSlop={8}
                    style={[
                      styles.weekArrow,
                      monthOffset === MAX_MONTH_OFFSET && { opacity: 0.3 },
                    ]}
                  >
                    <Ionicons name="chevron-forward" size={20} color={colors.text} />
                  </Pressable>
                </View>
              </View>

              <View style={styles.sectionSpacing}>
                <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                  Prestation
                </Text>
                <Pressable
                  onPress={() => setMonthPickerOpen(true)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: colors.border,
                    backgroundColor: colors.surface,
                  }}
                >
                  <Text
                    style={{ flex: 1, color: colors.text, fontSize: 14, fontWeight: '600' }}
                    numberOfLines={1}
                  >
                    {monthServiceLabel}
                  </Text>
                  <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
                </Pressable>
              </View>
            </>
          )}

          {/* Theme selector — applies to every story mode (services /
              dispos / QR Code), so the toggle stays visible regardless
              of what the pro wants to share. */}
          <View style={styles.sectionSpacing}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
              Thème
            </Text>
            <View style={styles.modeRow}>
              {[
                { key: 'light', label: 'Clair', icon: 'sunny-outline' },
                { key: 'dark', label: 'Sombre', icon: 'moon-outline' },
              ].map((variant) => {
                const isActive = storyTheme === variant.key;
                return (
                  <Pressable
                    key={variant.key}
                    onPress={() => setStoryTheme(variant.key as 'light' | 'dark')}
                    style={[
                      styles.modeButton,
                      {
                        backgroundColor: isActive ? colors.primary : colors.surface,
                        borderWidth: 1,
                        borderColor: isActive ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Ionicons
                      name={variant.icon as any}
                      size={18}
                      color={isActive ? '#fff' : colors.textSecondary}
                    />
                    <Text
                      style={[
                        styles.modeLabel,
                        { color: isActive ? '#fff' : colors.text },
                      ]}
                    >
                      {variant.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Service selection (only when mode = services) */}
          {displayMode === 'services' && services.length > 0 && (
            <View style={styles.sectionSpacing}>
              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                Prestations affichées (5 max)
              </Text>
              <View style={[styles.customizeCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                {services.map((service) => {
                  const selected = selectedServiceIds.has(service.id);
                  const disabledMax = !selected && selectedServiceIds.size >= 5;
                  return (
                    <Pressable
                      key={service.id}
                      onPress={() => toggleServiceId(service.id)}
                      disabled={disabledMax}
                      style={({ pressed }) => [
                        styles.serviceCheckRow,
                        pressed && { opacity: 0.7 },
                        disabledMax && { opacity: 0.35 },
                      ]}
                    >
                      <Ionicons
                        name={selected ? 'checkbox' : 'square-outline'}
                        size={20}
                        color={selected ? colors.primary : colors.textSecondary}
                      />
                      <Text
                        style={[
                          styles.serviceCheckName,
                          { color: selected ? colors.text : colors.textSecondary },
                        ]}
                        numberOfLines={1}
                      >
                        {service.name}
                      </Text>
                      <Text style={[styles.serviceCheckPrice, { color: colors.textSecondary }]}>
                        {service.price === 0 ? 'Gratuit' : `${(service.price / 100).toFixed(0)}€`}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {/* Network buttons */}
          <View style={styles.sectionSpacing}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
              Partager sur
            </Text>
            <View style={styles.networkRow}>
              {NETWORKS.map((network) => {
                const isActive = sharing === network.key;
                return (
                  <Pressable
                    key={network.key}
                    onPress={networkHandlers[network.key]}
                    disabled={isSharing || isLoading}
                    style={({ pressed }) => [
                      styles.networkButton,
                      {
                        backgroundColor: colors.surface,
                        borderWidth: 1,
                        borderColor: colors.border,
                      },
                      pressed && styles.buttonPressed,
                      (isSharing && !isActive) && styles.buttonDisabled,
                    ]}
                  >
                    {isActive ? (
                      <ActivityIndicator size="small" color={network.color} />
                    ) : (
                      <Ionicons name={network.icon as any} size={24} color={network.color} />
                    )}
                    <Text style={[styles.networkLabel, { color: colors.text }]}>
                      {network.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </ScrollView>

        {/* Prestation picker (shared with the agenda month view) — supports
            variations/options so the story uses the right availability. */}
        <ServicePickerModal
          visible={monthPickerOpen}
          onClose={() => setMonthPickerOpen(false)}
          services={services}
          categories={categories.map((c) => ({ id: c.id, name: c.name }))}
          currentServiceId={monthServiceId}
          onApply={(sid, dur, label) => {
            setMonthServiceId(sid);
            setMonthDurationOverride(dur);
            setMonthServiceLabel(label);
            setMonthPickerOpen(false);
          }}
        />

        {/* Link reminder modal for Instagram */}
        <Modal
          visible={showLinkReminder}
          transparent
          animationType="fade"
          onRequestClose={() => setShowLinkReminder(false)}
        >
          <Pressable style={styles.reminderOverlay} onPress={() => setShowLinkReminder(false)}>
            <Pressable style={[styles.reminderCard, { backgroundColor: colors.surface }]} onPress={() => {}}>
              <View style={[styles.reminderIconCircle, { backgroundColor: `${colors.primary}15` }]}>
                <Ionicons name="link-outline" size={28} color={colors.primary} />
              </View>

              <Text style={[styles.reminderTitle, { color: colors.text }]}>
                N'oubliez pas votre lien !
              </Text>

              <Text style={[styles.reminderDesc, { color: colors.textSecondary }]}>
                Instagram ne permet pas d'inclure de lien cliquable dans les stories. Pensez à ajouter votre lien de réservation en sticker pour que vos clients puissent réserver.
              </Text>

              {/* Copy link button */}
              <Pressable
                onPress={handleCopyLink}
                style={[
                  styles.reminderCopyButton,
                  {
                    backgroundColor: linkCopied ? '#10b981' : colors.surface,
                    borderColor: linkCopied ? '#10b981' : colors.border,
                  },
                ]}
              >
                <Ionicons
                  name={linkCopied ? 'checkmark-circle' : 'copy-outline'}
                  size={18}
                  color={linkCopied ? '#fff' : colors.primary}
                />
                <Text
                  style={[
                    styles.reminderCopyText,
                    { color: linkCopied ? '#fff' : colors.text },
                  ]}
                  numberOfLines={1}
                >
                  {linkCopied ? 'Lien copié !' : bookingUrl}
                </Text>
              </Pressable>

              {/* Continue button */}
              <Pressable
                onPress={proceedShareInstagram}
                style={[styles.reminderContinueButton, { backgroundColor: colors.primary }]}
              >
                <Ionicons name="logo-instagram" size={20} color="#fff" />
                <Text style={styles.reminderContinueText}>
                  Partager sur Instagram
                </Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>

        {/* ── Date picker — pick a specific day directly ───────────
            Android renders its native modal automatically when the
            element mounts; iOS shows an inline calendar so we wrap
            it in our own bottom-sheet Modal with a "Terminé" button
            for explicit dismissal. */}
        {showDatePicker && Platform.OS === 'android' && (
          <DateTimePicker
            value={dateForDayOffset(dayOffset)}
            mode="date"
            display="default"
            minimumDate={new Date()}
            maximumDate={dateForDayOffset(MAX_DAY_OFFSET)}
            onChange={(event: DateTimePickerEvent, selectedDate?: Date) => {
              setShowDatePicker(false);
              if (selectedDate && event.type === 'set') {
                setDayOffset(
                  Math.min(MAX_DAY_OFFSET, dayOffsetFromDate(selectedDate)),
                );
              }
            }}
          />
        )}
        {showDatePicker && Platform.OS === 'ios' && (
          <Modal
            transparent
            animationType="fade"
            visible
            onRequestClose={() => setShowDatePicker(false)}
          >
            <Pressable
              style={styles.datePickerBackdrop}
              onPress={() => setShowDatePicker(false)}
            >
              <Pressable
                style={[
                  styles.datePickerSheet,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                  },
                ]}
                onPress={() => {
                  /* swallow tap so backdrop dismiss doesn't fire */
                }}
              >
                <DateTimePicker
                  value={dateForDayOffset(dayOffset)}
                  mode="date"
                  display="inline"
                  minimumDate={new Date()}
                  maximumDate={dateForDayOffset(MAX_DAY_OFFSET)}
                  locale="fr-FR"
                  themeVariant={
                    // The theme tokens type colors.background as a string
                    // literal so a direct === comparison fails strict
                    // checks; cast to defeat that and pick by hex.
                    (colors.background as string) === '#0a1628' ||
                    (colors.background as string) === '#000000'
                      ? 'dark'
                      : 'light'
                  }
                  onChange={(_event, selectedDate) => {
                    if (selectedDate) {
                      setDayOffset(
                        Math.min(MAX_DAY_OFFSET, dayOffsetFromDate(selectedDate)),
                      );
                    }
                  }}
                />
                <Pressable
                  onPress={() => setShowDatePicker(false)}
                  style={[
                    styles.datePickerDoneBtn,
                    { backgroundColor: colors.primary },
                  ]}
                >
                  <Text style={styles.datePickerDoneText}>Terminé</Text>
                </Pressable>
              </Pressable>
            </Pressable>
          </Modal>
        )}
      </View>
    </Modal>
  );
}

const PREVIEW_SCALE = 0.52;
const PREVIEW_W = Math.round(360 * PREVIEW_SCALE);
const PREVIEW_H = Math.round(640 * PREVIEW_SCALE);

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
  },
  offScreen: {
    position: 'absolute',
    left: -9999,
    top: -9999,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backButton: {
    width: 24,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    gap: 20,
  },
  previewWrapper: {
    alignItems: 'center',
  },
  previewClip: {
    width: PREVIEW_W,
    height: PREVIEW_H,
    borderRadius: 10,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  previewScaler: {
    width: 360,
    height: 640,
    transform: [{ scale: PREVIEW_SCALE }],
    transformOrigin: 'top left',
  },
  loadingContainer: {
    width: PREVIEW_W,
    height: PREVIEW_H,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  sectionSpacing: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  modeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  modeLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  // Hint under the day selector — guides the user to tap the date
  // for direct picking.
  dayHint: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 6,
    textAlign: 'center',
  },
  // Native date-picker backdrop + sheet (iOS only — Android uses
  // its system modal). Plain centered card with the inline calendar
  // and a Terminé button below.
  datePickerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  datePickerSheet: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 16,
  },
  datePickerDoneBtn: {
    marginTop: 8,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  datePickerDoneText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  // Scope toggle (week vs day) inside the Dispos mode
  scopeToggle: {
    flexDirection: 'row',
    padding: 4,
    borderWidth: 1,
    borderRadius: 12,
    gap: 4,
  },
  scopeToggleOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
  },
  scopeToggleLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  weekSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderRadius: 12,
  },
  weekArrow: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
  },
  weekLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  weekRange: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  customizeCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 4,
  },
  serviceCheckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  serviceCheckName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
  },
  serviceCheckPrice: {
    fontSize: 13,
    fontWeight: '600',
  },
  networkRow: {
    flexDirection: 'row',
    gap: 12,
  },
  networkButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 16,
    borderRadius: 14,
  },
  networkLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  buttonPressed: {
    opacity: 0.7,
  },
  buttonDisabled: {
    opacity: 0.4,
  },

  // Link reminder modal
  reminderOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  reminderCard: {
    width: '100%',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 10,
  },
  reminderIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  reminderTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  reminderDesc: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  reminderCopyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    width: '100%',
    marginTop: 4,
  },
  reminderCopyText: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  reminderContinueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    width: '100%',
    marginTop: 4,
  },
  reminderContinueText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
});
