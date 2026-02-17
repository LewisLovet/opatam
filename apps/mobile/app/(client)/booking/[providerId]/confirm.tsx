/**
 * Booking Step 3: Confirmation
 * Review booking details and confirm
 */

import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Linking,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { bookingService } from '@booking-app/firebase';
import { useTheme } from '../../../../theme';
import { Text, Card, Button, EmptyState, Avatar, useToast } from '../../../../components';
import { useBooking } from '../../../../contexts';
import { useAuth } from '../../../../contexts';
import { useLocations } from '../../../../hooks';

// Format date in French
function formatDate(date: Date): string {
  const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  const months = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

  return `${days[date.getDay()]} ${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

// Format time
function formatTime(timeStr: string): string {
  return timeStr.replace(':', 'h');
}

export default function ConfirmBookingScreen() {
  const { colors, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { showToast } = useToast();
  const { providerId } = useLocalSearchParams<{ providerId: string }>();

  // Auth context
  const { user, userData, isAuthenticated } = useAuth();

  // Booking context
  const {
    provider,
    service,
    member,
    memberId,
    locationId,
    selectedDate,
    selectedSlot,
    isReady,
    resetBooking,
  } = useBooking();

  // Get locations to display location info
  const { locations } = useLocations(providerId);
  const location = locations.find((l) => l.id === locationId);

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Handle booking confirmation
  const handleConfirm = async () => {
    if (!isReady || !selectedSlot || !provider || !service) {
      showToast({
        variant: 'error',
        message: 'Informations de réservation incomplètes',
      });
      return;
    }

    // Check if user is authenticated
    if (!isAuthenticated || !userData) {
      showToast({
        variant: 'warning',
        message: 'Veuillez vous connecter pour réserver',
      });
      router.push('/(auth)/login');
      return;
    }

    setIsSubmitting(true);

    try {
      await bookingService.createBooking({
        providerId: provider.id,
        serviceId: service.id,
        locationId: locationId!,
        memberId: memberId || undefined,
        datetime: selectedSlot.datetime,
        clientId: user?.uid, // Associate booking with logged-in user
        clientInfo: {
          name: userData.displayName || 'Client',
          email: userData.email,
          phone: userData.phone || '',
        },
      });

      // Reset booking state
      resetBooking();

      // Show success message
      showToast({
        variant: 'success',
        message: 'Réservation confirmée !',
      });

      // Navigate to bookings tab
      router.replace('/(client)/(tabs)/bookings');
    } catch (error: any) {
      console.error('Booking error:', error);
      showToast({
        variant: 'error',
        message: error.message || 'Erreur lors de la réservation',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Redirect if booking not ready
  if (!isReady || !selectedSlot || !selectedDate || !provider || !service) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: insets.top + spacing.md, paddingHorizontal: spacing.lg }]}>
          <Pressable
            onPress={() => router.back()}
            style={[styles.backButton, { backgroundColor: colors.surface, borderRadius: radius.full }]}
          >
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <Text variant="h2" style={styles.headerTitle}>Confirmation</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.errorContainer}>
          <EmptyState
            icon="alert-circle-outline"
            title="Erreur"
            description="Informations de réservation incomplètes"
            actionLabel="Retour"
            onAction={() => router.back()}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.md, paddingHorizontal: spacing.lg }]}>
        <Pressable
          onPress={() => router.back()}
          style={[styles.backButton, { backgroundColor: colors.surface, borderRadius: radius.full }]}
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text variant="h2" style={styles.headerTitle}>Confirmation</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + 120 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Success icon */}
        <View style={[styles.successIcon, { marginTop: spacing.xl }]}>
          <View style={[styles.iconCircle, { backgroundColor: colors.primaryLight || '#e4effa' }]}>
            <Ionicons name="calendar-outline" size={40} color={colors.primary} />
          </View>
        </View>

        <Text variant="h2" align="center" style={{ marginTop: spacing.lg }}>
          Vérifiez votre réservation
        </Text>
        <Text variant="body" color="textSecondary" align="center" style={{ marginTop: spacing.sm }}>
          Assurez-vous que toutes les informations sont correctes
        </Text>

        {/* Booking details */}
        <Card padding="lg" shadow="sm" style={{ marginTop: spacing.xl }}>
          {/* Service */}
          <View style={styles.detailRow}>
            <View style={[styles.detailIcon, { backgroundColor: colors.primaryLight || '#e4effa' }]}>
              <Ionicons name="pricetag-outline" size={20} color={colors.primary} />
            </View>
            <View style={styles.detailContent}>
              <Text variant="caption" color="textSecondary">Prestation</Text>
              <Text variant="body" style={{ fontWeight: '600' }}>{service.name}</Text>
              <Text variant="caption" color="textSecondary">
                {service.duration} min - {(service.price / 100).toFixed(2)} €
              </Text>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Date & Time */}
          <View style={styles.detailRow}>
            <View style={[styles.detailIcon, { backgroundColor: colors.primaryLight || '#e4effa' }]}>
              <Ionicons name="calendar-outline" size={20} color={colors.primary} />
            </View>
            <View style={styles.detailContent}>
              <Text variant="caption" color="textSecondary">Date et heure</Text>
              <Text variant="body" style={{ fontWeight: '600' }}>{formatDate(selectedDate)}</Text>
              <Text variant="caption" color="textSecondary">
                {formatTime(selectedSlot.start)} - {formatTime(selectedSlot.end)}
              </Text>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Member */}
          {member && (
            <>
              <View style={styles.detailRow}>
                <View style={[styles.detailIcon, { backgroundColor: colors.primaryLight || '#e4effa' }]}>
                  <Ionicons name="person-outline" size={20} color={colors.primary} />
                </View>
                <View style={styles.detailContent}>
                  <Text variant="caption" color="textSecondary">Avec</Text>
                  <Text variant="body" style={{ fontWeight: '600' }}>{member.name}</Text>
                </View>
              </View>

              <View style={[styles.divider, { backgroundColor: colors.border }]} />
            </>
          )}

          {/* Location */}
          {location && (
            <View style={styles.detailRow}>
              <View style={[styles.detailIcon, { backgroundColor: colors.primaryLight || '#e4effa' }]}>
                <Ionicons name="location-outline" size={20} color={colors.primary} />
              </View>
              <View style={styles.detailContent}>
                <Text variant="caption" color="textSecondary">Lieu</Text>
                <Text variant="body" style={{ fontWeight: '600' }}>{location.name}</Text>
                <Pressable
                  onPress={() => {
                    const fullAddress = location.address?.trim()
                      ? `${location.address}, ${location.postalCode} ${location.city}`
                      : `${location.postalCode} ${location.city}`;
                    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`);
                  }}
                  style={({ pressed }) => [pressed && { opacity: 0.7 }]}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text variant="caption" color="primary">
                      {location.address?.trim()
                        ? `${location.address}, ${location.postalCode} ${location.city}`
                        : `${location.postalCode} ${location.city}`}
                    </Text>
                    <Ionicons name="open-outline" size={12} color={colors.primary} style={{ marginLeft: 4 }} />
                  </View>
                </Pressable>
              </View>
            </View>
          )}
        </Card>

        {/* Provider info */}
        <Card padding="md" shadow="sm" style={{ marginTop: spacing.lg }}>
          <View style={styles.providerRow}>
            <Avatar
              size="lg"
              name={provider.businessName}
              imageUrl={provider.photoURL}
              style={{ marginRight: 12 }}
            />
            <View style={{ flex: 1 }}>
              <Text variant="body" style={{ fontWeight: '600' }}>{provider.businessName}</Text>
              <Text variant="caption" color="textSecondary">{provider.category}</Text>
            </View>
          </View>
        </Card>

        {/* Price summary */}
        <Card padding="lg" shadow="sm" style={{ marginTop: spacing.lg }}>
          <View style={styles.priceRow}>
            <Text variant="body">Total</Text>
            <Text variant="h2" color="primary">
              {service.price === 0 ? 'Gratuit' : `${(service.price / 100).toFixed(2)} €`}
            </Text>
          </View>
          <Text variant="caption" color="textSecondary" style={{ marginTop: spacing.xs }}>
            Paiement sur place
          </Text>
        </Card>

        {/* Login prompt if not authenticated */}
        {!isAuthenticated && (
          <Card padding="lg" shadow="sm" style={{ marginTop: spacing.lg, backgroundColor: colors.warning + '15' }}>
            <View style={styles.loginPrompt}>
              <Ionicons name="information-circle-outline" size={24} color={colors.warning} />
              <View style={{ flex: 1, marginLeft: spacing.sm }}>
                <Text variant="body" style={{ fontWeight: '600' }}>Connexion requise</Text>
                <Text variant="caption" color="textSecondary">
                  Connectez-vous pour confirmer votre réservation
                </Text>
              </View>
            </View>
          </Card>
        )}
      </ScrollView>

      {/* Confirm button */}
      <View
        style={[
          styles.footer,
          {
            paddingHorizontal: spacing.lg,
            paddingBottom: insets.bottom + spacing.md,
            backgroundColor: colors.background,
            borderTopColor: colors.border,
          },
        ]}
      >
        <Button
          variant="primary"
          title={isAuthenticated ? 'Confirmer la réservation' : 'Se connecter pour réserver'}
          onPress={handleConfirm}
          loading={isSubmitting}
          disabled={isSubmitting}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  headerTitle: {
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 44,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  scrollContent: {
    flexGrow: 1,
  },
  successIcon: {
    alignItems: 'center',
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  detailIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  detailContent: {
    flex: 1,
  },
  divider: {
    height: 1,
    marginVertical: 16,
    marginLeft: 52,
  },
  providerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  loginPrompt: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: 16,
    borderTopWidth: 1,
  },
});
