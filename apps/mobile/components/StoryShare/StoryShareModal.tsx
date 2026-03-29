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

// Safe import — react-native-view-shot requires native module
let captureRef: typeof import('react-native-view-shot').captureRef | null = null;
try {
  captureRef = require('react-native-view-shot').captureRef;
} catch {
  // Native module not available
}
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { catalogService } from '@booking-app/firebase';
import type { Service } from '@booking-app/shared';
import { APP_CONFIG } from '@booking-app/shared';
import { useTheme } from '../../theme';
import { Text } from '../Text';
import { useProvider } from '../../contexts';
import { useOpeningHours } from '../../hooks/useOpeningHours';
import { StoryCard } from './StoryCard';
import type { DayScheduleItem } from './StoryCard';

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

type WithId<T> = { id: string } & T;

type DisplayMode = 'services' | 'hours' | 'none';

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
  { key: 'hours', label: 'Horaires', icon: 'time-outline' },
  { key: 'none', label: 'QR Code', icon: 'qr-code-outline' },
];

export function StoryShareModal({ visible, onClose }: StoryShareModalProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { provider } = useProvider();
  const viewRef = useRef<View>(null);
  const [sharing, setSharing] = useState<string | null>(null);
  const [services, setServices] = useState<WithId<Service>[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [displayMode, setDisplayMode] = useState<DisplayMode>('services');
  const [selectedServiceIds, setSelectedServiceIds] = useState<Set<string>>(new Set());
  const [showLinkReminder, setShowLinkReminder] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  // Fetch opening hours
  const { weekSchedule, loading: loadingHours, refresh: refreshHours } = useOpeningHours(provider?.id);

  // Fetch services + refresh hours when modal opens
  useEffect(() => {
    if (!visible || !provider) return;
    let cancelled = false;

    // Refresh hours to pick up any changes made in availability screen
    refreshHours();

    (async () => {
      setLoadingServices(true);
      try {
        const data = await catalogService.getActiveByProvider(provider.id);
        if (!cancelled) {
          setServices(data);
          // Pre-select first 5
          setSelectedServiceIds(new Set(data.slice(0, 5).map((s) => s.id)));
        }
      } catch (err) {
        console.error('[StoryShare] Error loading services:', err);
      } finally {
        if (!cancelled) setLoadingServices(false);
      }
    })();

    return () => { cancelled = true; };
  }, [visible, provider]);

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
  const isLoading = loadingServices || loadingHours;

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
    weekSchedule: weekSchedule as DayScheduleItem[],
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <Pressable onPress={onClose} hitSlop={12} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
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
                return (
                  <Pressable
                    key={mode.key}
                    onPress={() => setDisplayMode(mode.key)}
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
