/**
 * Pro Dashboard Screen
 * Main dashboard for providers with stats, today's bookings, and pending actions.
 * Redesigned with visual hierarchy, colored stat cards, and prominent action buttons.
 */

import { bookingService } from '@booking-app/firebase';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  Alert,
  Image,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BookingListItem,
  Button,
  Card,
  EmptyState,
  Loader,
  Text,
} from '../../../components';
import { useAuth, useProvider } from '../../../contexts';
import { useProviderDashboard } from '../../../hooks';
import { useTheme } from '../../../theme';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Safely convert Firestore Timestamp or Date to Date */
function toDate(dt: any): Date {
  if (dt instanceof Date) return dt;
  if (dt?.toDate) return dt.toDate();
  return new Date(dt);
}

const FRENCH_DAYS = [
  'Dimanche',
  'Lundi',
  'Mardi',
  'Mercredi',
  'Jeudi',
  'Vendredi',
  'Samedi',
];

const FRENCH_MONTHS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];

/** Formats a Date as "Lundi 12 février" */
function formatFrenchDate(date: Date): string {
  const day = FRENCH_DAYS[date.getDay()];
  const dayOfMonth = date.getDate();
  const month = FRENCH_MONTHS[date.getMonth()];
  return `${day} ${dayOfMonth} ${month}`;
}

/** Extracts "HH:MM" from a Date */
function formatTime(date: Date): string {
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

// ---------------------------------------------------------------------------
// Mini Stat Card (redesigned with colored backgrounds)
// ---------------------------------------------------------------------------

interface MiniStatCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string | number;
  bgColor: string;
  iconColor: string;
}

function MiniStatCard({ icon, label, value, bgColor, iconColor }: MiniStatCardProps) {
  const { colors, spacing, radius, shadows } = useTheme();

  return (
    <View
      style={[
        styles.miniStatCard,
        {
          backgroundColor: bgColor,
          borderRadius: radius.lg,
          padding: spacing.sm,
          ...shadows.sm,
        },
      ]}
    >
      <View
        style={[
          styles.miniStatIcon,
          {
            width: 28,
            height: 28,
            borderRadius: radius.full,
            backgroundColor: colors.surface,
            marginBottom: spacing.xs,
          },
        ]}
      >
        <Ionicons name={icon} size={14} color={iconColor} />
      </View>
      <Text variant="h3" style={styles.miniStatValue}>
        {value}
      </Text>
      <Text variant="caption" color="textSecondary" numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ProDashboardScreen() {
  const { colors, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { provider, providerId } = useProvider();
  const { user } = useAuth();
  const { data, isLoading, refresh } = useProviderDashboard(
    providerId,
    provider?.rating?.average,
  );

  // -- Booking actions -------------------------------------------------------

  const handleConfirm = useCallback(
    async (bookingId: string) => {
      if (!user) return;
      try {
        await bookingService.confirmBooking(bookingId, user.uid);
        await refresh();
      } catch (error) {
        Alert.alert('Erreur', 'Impossible de confirmer le rendez-vous.');
      }
    },
    [user, refresh],
  );

  const handleCancel = useCallback(
    (bookingId: string) => {
      Alert.alert(
        'Annuler le rendez-vous',
        'Êtes-vous sûr de vouloir annuler ce rendez-vous ?',
        [
          { text: 'Non', style: 'cancel' },
          {
            text: 'Oui, annuler',
            style: 'destructive',
            onPress: async () => {
              if (!user) return;
              try {
                await bookingService.cancelBooking(bookingId, 'provider', user.uid);
                await refresh();
              } catch (error) {
                Alert.alert('Erreur', "Impossible d'annuler le rendez-vous.");
              }
            },
          },
        ],
      );
    },
    [user, refresh],
  );

  const navigateToBooking = useCallback(
    (bookingId: string) => {
      router.push(`/(pro)/booking-detail/${bookingId}`);
    },
    [router],
  );

  // -- Share establishment ---------------------------------------------------

  const [showQRModal, setShowQRModal] = useState(false);
  const shopUrl = provider?.slug ? `https://opatam.com/p/${provider.slug}` : null;

  const handleCopyLink = useCallback(async () => {
    if (!shopUrl) return;
    try {
      await Clipboard.setStringAsync(shopUrl);
      Alert.alert('Lien copié', 'Le lien a été copié dans le presse-papiers.');
    } catch {
      Alert.alert('Erreur', 'Impossible de copier le lien.');
    }
  }, [shopUrl]);

  const handleShare = useCallback(async () => {
    if (!shopUrl) return;
    try {
      await Share.share({
        message: `Réservez chez ${provider?.businessName || 'nous'} sur Opatam : ${shopUrl}`,
        url: shopUrl,
      });
    } catch {
      // User cancelled or error
    }
  }, [shopUrl, provider?.businessName]);

  const handleViewShop = useCallback(() => {
    if (!provider?.slug) return;
    router.push({
      pathname: '/(client)/provider/[slug]',
      params: { slug: provider.slug, preview: '1' },
    });
  }, [provider?.slug, router]);

  const handleViewOnline = useCallback(() => {
    if (!shopUrl) return;
    Linking.openURL(shopUrl);
  }, [shopUrl]);

  const handleEditShop = useCallback(() => {
    Alert.alert(
      'Redirection vers le web',
      'La modification de votre boutique se fait depuis l\'interface web. Pour une meilleure expérience, nous vous recommandons d\'utiliser un ordinateur.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Continuer',
          onPress: () => Linking.openURL('https://opatam.com/pro/'),
        },
      ],
    );
  }, []);

  // -- Loading state ---------------------------------------------------------

  if (isLoading && data.todayBookings.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.brandedHeader, { backgroundColor: colors.primary, paddingTop: insets.top }]} />
        <View style={styles.loaderContainer}>
          <Loader />
        </View>
      </View>
    );
  }

  // -- Derived values --------------------------------------------------------

  const today = new Date();
  const formattedDate = formatFrenchDate(today);
  const firstName = user?.displayName?.split(' ')[0] || provider?.businessName || 'Pro';

  const {
    todayBookings,
    pendingBookings,
    weekBookingsCount,
    averageRating,
  } = data;

  const displayedTodayBookings = todayBookings.slice(0, 3);
  const remainingTodayCount = todayBookings.length - 3;

  // -- Render ----------------------------------------------------------------

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* ── Branded Header ────────────────────────────────────────── */}
      <View style={[styles.brandedHeader, { backgroundColor: colors.primary, paddingTop: insets.top }]}>
        <View style={[styles.brandedHeaderContent, { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.lg }]}>
          <Text variant="h1" style={{ color: '#FFFFFF' }}>Bonjour, {firstName}</Text>
          <Text variant="caption" style={{ color: 'rgba(255,255,255,0.7)', marginTop: spacing.xs }}>
            {formattedDate}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { padding: spacing.lg }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={refresh}
            tintColor={colors.primary}
          />
        }
      >

        {/* ── Quick Stats Row (horizontal scroll) ────────────────────── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[
            styles.statsScrollContent,
            { gap: spacing.sm, paddingRight: spacing.sm },
          ]}
          style={{ marginBottom: spacing.xl, marginHorizontal: -spacing.lg }}
          contentInset={{ left: spacing.lg, right: spacing.lg }}
          contentOffset={{ x: -spacing.lg, y: 0 }}
        >
          <MiniStatCard
            icon="today-outline"
            label="RDV aujourd'hui"
            value={todayBookings.length}
            bgColor={colors.primaryLight}
            iconColor={colors.primary}
          />
          <MiniStatCard
            icon="hourglass-outline"
            label="En attente"
            value={pendingBookings.length}
            bgColor={colors.warningLight}
            iconColor={colors.warning}
          />
          <MiniStatCard
            icon="calendar-outline"
            label="Cette semaine"
            value={weekBookingsCount}
            bgColor={colors.successLight}
            iconColor={colors.success}
          />
          <MiniStatCard
            icon="star-outline"
            label="Note moyenne"
            value={averageRating?.toFixed(1) || '-'}
            bgColor={colors.errorLight}
            iconColor={colors.error}
          />
        </ScrollView>

        {/* ── Section: Mon établissement ────────────────────────────── */}
        {provider?.slug && (
          <View style={{ marginBottom: spacing.xl }}>
            <Text variant="h3" style={{ marginBottom: spacing.md }}>
              Mon établissement
            </Text>
            <Card padding="md" shadow="sm">
              {/* Share buttons row */}
              <View style={[styles.shareGrid, { gap: spacing.sm, marginBottom: spacing.md }]}>
                <Pressable
                  onPress={() => setShowQRModal(true)}
                  style={({ pressed }) => [
                    styles.shareButton,
                    {
                      backgroundColor: pressed ? colors.primaryLight : colors.surfaceSecondary,
                      borderRadius: radius.lg,
                      padding: spacing.md,
                    },
                  ]}
                >
                  <Ionicons name="qr-code-outline" size={24} color={colors.primary} />
                  <Text variant="caption" color="primary" style={{ fontWeight: '500', marginTop: spacing.xs }}>
                    QR Code
                  </Text>
                </Pressable>

                <Pressable
                  onPress={handleShare}
                  style={({ pressed }) => [
                    styles.shareButton,
                    {
                      backgroundColor: pressed ? colors.primaryLight : colors.surfaceSecondary,
                      borderRadius: radius.lg,
                      padding: spacing.md,
                    },
                  ]}
                >
                  <Ionicons name="share-social-outline" size={24} color={colors.primary} />
                  <Text variant="caption" color="primary" style={{ fontWeight: '500', marginTop: spacing.xs }}>
                    Partager
                  </Text>
                </Pressable>

                <Pressable
                  onPress={handleViewShop}
                  style={({ pressed }) => [
                    styles.shareButton,
                    {
                      backgroundColor: pressed ? colors.primaryLight : colors.surfaceSecondary,
                      borderRadius: radius.lg,
                      padding: spacing.md,
                    },
                  ]}
                >
                  <Ionicons name="storefront-outline" size={24} color={colors.primary} />
                  <Text variant="caption" color="primary" style={{ fontWeight: '500', marginTop: spacing.xs }}>
                    Aperçu
                  </Text>
                </Pressable>
              </View>

              {/* Voir en ligne + Modifier buttons */}
              <View style={[styles.shopActions, { gap: spacing.sm }]}>
                <Pressable
                  onPress={handleViewOnline}
                  style={({ pressed }) => [
                    styles.shopActionButton,
                    {
                      backgroundColor: pressed ? colors.primaryDark : colors.primary,
                      borderRadius: radius.lg,
                      paddingVertical: spacing.sm,
                      paddingHorizontal: spacing.md,
                      opacity: pressed ? 0.9 : 1,
                    },
                  ]}
                >
                  <Ionicons name="globe-outline" size={18} color="#FFFFFF" style={{ marginRight: spacing.xs }} />
                  <Text variant="body" style={{ color: '#FFFFFF', fontWeight: '600' }}>
                    Voir en ligne
                  </Text>
                </Pressable>

                <Pressable
                  onPress={handleEditShop}
                  style={({ pressed }) => [
                    styles.shopActionButton,
                    {
                      backgroundColor: pressed ? colors.surfaceSecondary : colors.surface,
                      borderRadius: radius.lg,
                      paddingVertical: spacing.sm,
                      paddingHorizontal: spacing.md,
                      borderWidth: 1,
                      borderColor: colors.border,
                      opacity: pressed ? 0.9 : 1,
                    },
                  ]}
                >
                  <Ionicons name="create-outline" size={18} color={colors.text} style={{ marginRight: spacing.xs }} />
                  <Text variant="body" style={{ fontWeight: '600' }}>
                    Modifier
                  </Text>
                </Pressable>
              </View>
            </Card>
          </View>
        )}

        {/* ── Section: Aujourd'hui ───────────────────────────────────── */}
        <View style={{ marginBottom: spacing.xl }}>
          {/* Section header */}
          <View style={[styles.sectionHeader, { marginBottom: spacing.md }]}>
            <View style={styles.sectionTitleRow}>
              <Text variant="h3">Aujourd&apos;hui</Text>
              <View
                style={[
                  styles.countBadge,
                  {
                    backgroundColor: colors.primaryLight,
                    borderRadius: radius.full,
                    paddingHorizontal: spacing.sm,
                    paddingVertical: 2,
                    marginLeft: spacing.sm,
                  },
                ]}
              >
                <Text variant="caption" color="primary" style={{ fontWeight: '600' }}>
                  {todayBookings.length}
                </Text>
              </View>
            </View>
            {todayBookings.length > 0 && (
              <Pressable
                onPress={() => router.push('/(pro)/(tabs)/calendar')}
                hitSlop={8}
              >
                <Text variant="bodySmall" color="primary" style={{ fontWeight: '500' }}>
                  Voir tout →
                </Text>
              </Pressable>
            )}
          </View>

          {todayBookings.length === 0 ? (
            <EmptyState
              icon="calendar-clear-outline"
              title="Aucun rendez-vous"
              description="Vous n'avez pas de rendez-vous aujourd'hui."
            />
          ) : (
            <>
              <Card padding="none" shadow="sm">
                {displayedTodayBookings.map((booking) => {
                  const bookingDate = toDate(booking.datetime);
                  return (
                    <BookingListItem
                      key={booking.id}
                      time={formatTime(bookingDate)}
                      clientName={booking.clientInfo.name}
                      serviceName={booking.serviceName}
                      duration={booking.duration}
                      status={booking.status as 'pending' | 'confirmed' | 'cancelled' | 'noshow'}
                      onPress={() => navigateToBooking(booking.id)}
                      onConfirm={
                        booking.status === 'pending'
                          ? () => handleConfirm(booking.id)
                          : undefined
                      }
                      onCancel={
                        booking.status === 'pending'
                          ? () => handleCancel(booking.id)
                          : undefined
                      }
                    />
                  );
                })}
              </Card>
              {remainingTodayCount > 0 && (
                <Button
                  title={`Voir les ${remainingTodayCount} restants`}
                  variant="ghost"
                  size="sm"
                  onPress={() => router.push('/(pro)/(tabs)/calendar')}
                  style={{ marginTop: spacing.sm, alignSelf: 'center' }}
                />
              )}
            </>
          )}
        </View>

        {/* ── Section: A traiter (Pending) ────────────────────────────── */}
        <View style={{ marginBottom: spacing.xl }}>
          {/* Section header */}
          <View style={[styles.sectionHeader, { marginBottom: spacing.md }]}>
            <View style={styles.sectionTitleRow}>
              <Text variant="h3">A traiter</Text>
              {pendingBookings.length > 0 && (
                <View
                  style={[
                    styles.countBadge,
                    {
                      backgroundColor: colors.warningLight,
                      borderRadius: radius.full,
                      paddingHorizontal: spacing.sm,
                      paddingVertical: 2,
                      marginLeft: spacing.sm,
                    },
                  ]}
                >
                  <Text variant="caption" style={{ fontWeight: '600', color: colors.warningDark }}>
                    {pendingBookings.length}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {pendingBookings.length === 0 ? (
            <EmptyState
              icon="checkmark-circle-outline"
              title="Aucune demande en attente"
              description="Toutes les demandes ont été traitées."
            />
          ) : (
            <View style={{ gap: spacing.sm }}>
              {pendingBookings.slice(0, 5).map((booking) => {
                const bookingDate = toDate(booking.datetime);
                return (
                  <Card key={booking.id} padding="none" shadow="sm">
                    <BookingListItem
                      time={formatTime(bookingDate)}
                      clientName={booking.clientInfo.name}
                      serviceName={booking.serviceName}
                      duration={booking.duration}
                      status={booking.status as 'pending' | 'confirmed' | 'cancelled' | 'noshow'}
                      onPress={() => navigateToBooking(booking.id)}
                    />
                    {/* Prominent action buttons */}
                    <View
                      style={[
                        styles.pendingActions,
                        {
                          paddingHorizontal: spacing.md,
                          paddingBottom: spacing.md,
                          gap: spacing.sm,
                        },
                      ]}
                    >
                      <Button
                        title="Confirmer"
                        variant="primary"
                        size="sm"
                        onPress={() => handleConfirm(booking.id)}
                        fullWidth
                        leftIcon={
                          <Ionicons name="checkmark" size={16} color={colors.textInverse} />
                        }
                        style={{ flex: 1 }}
                      />
                      <Pressable
                        onPress={() => handleCancel(booking.id)}
                        hitSlop={8}
                        style={({ pressed }) => [
                          styles.cancelTextButton,
                          {
                            opacity: pressed ? 0.6 : 1,
                            paddingVertical: spacing.sm,
                            paddingHorizontal: spacing.md,
                          },
                        ]}
                      >
                        <Text variant="bodySmall" color="error" style={{ fontWeight: '500' }}>
                          Annuler
                        </Text>
                      </Pressable>
                    </View>
                  </Card>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      {/* ── QR Code Modal ────────────────────────────────────────── */}
      {shopUrl && (
        <Modal
          visible={showQRModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowQRModal(false)}
        >
          <Pressable
            style={styles.modalOverlay}
            onPress={() => setShowQRModal(false)}
          >
            <Pressable
              style={[
                styles.modalContent,
                {
                  backgroundColor: colors.surface,
                  borderRadius: radius.xl,
                  padding: spacing.xl,
                  margin: spacing.xl,
                },
              ]}
              onPress={() => {}} // Prevent closing when tapping content
            >
              <Text variant="h3" align="center" style={{ marginBottom: spacing.sm }}>
                Mon QR Code
              </Text>
              <Text variant="body" color="textSecondary" align="center" style={{ marginBottom: spacing.lg }}>
                Partagez ce QR code pour que vos clients accèdent à votre page de réservation
              </Text>
              <View style={[styles.qrContainer, { backgroundColor: '#FFFFFF', borderRadius: radius.lg, padding: spacing.md }]}>
                <Image
                  source={{ uri: `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(shopUrl)}&size=250x250&margin=10` }}
                  style={styles.qrImage}
                  resizeMode="contain"
                />
              </View>
              <Text variant="caption" color="textMuted" align="center" style={{ marginTop: spacing.md }}>
                {shopUrl}
              </Text>
              <Pressable
                onPress={() => {
                  handleCopyLink();
                  setShowQRModal(false);
                }}
                style={({ pressed }) => [
                  styles.modalButton,
                  {
                    backgroundColor: pressed ? colors.primaryDark : colors.primary,
                    borderRadius: radius.lg,
                    paddingVertical: spacing.md,
                    marginTop: spacing.lg,
                    width: '100%',
                  },
                ]}
              >
                <Ionicons name="copy-outline" size={18} color="#FFFFFF" style={{ marginRight: spacing.xs }} />
                <Text variant="body" style={{ color: '#FFFFFF', fontWeight: '600' }}>Copier le lien</Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    flexGrow: 1,
  },
  brandedHeader: {},
  brandedHeaderContent: {},
  statsScrollContent: {
    flexDirection: 'row',
    paddingLeft: 16,
  },
  miniStatCard: {
    width: 140,
    minHeight: 80,
  },
  miniStatIcon: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniStatValue: {
    fontWeight: '700',
    marginBottom: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  countBadge: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  pendingActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cancelTextButton: {
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 44,
    minHeight: 44,
  },
  shareGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  shareButton: {
    flex: 1,
    minWidth: '22%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shopActions: {
    flexDirection: 'row',
  },
  shopActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
  },
  qrContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrImage: {
    width: 200,
    height: 200,
  },
  modalActions: {
    flexDirection: 'row',
    width: '100%',
  },
  modalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
