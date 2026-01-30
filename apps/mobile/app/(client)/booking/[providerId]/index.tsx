/**
 * Booking Step 1: Member Selection
 * Allows user to select a team member for their appointment
 */

import React, { useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../../theme';
import { Text, Card, EmptyState, useToast } from '../../../../components';
import { useBooking } from '../../../../contexts';
import { useProviderById, useServices, useMembers, useLocations } from '../../../../hooks';
import type { Member } from '@booking-app/shared';
import type { WithId } from '@booking-app/firebase';

export default function MemberSelectionScreen() {
  const { colors, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { showToast } = useToast();
  const { providerId, serviceId } = useLocalSearchParams<{ providerId: string; serviceId: string }>();

  // Booking context
  const { initBooking, setMember, provider: bookingProvider, service: bookingService } = useBooking();

  // Fetch data - use useProviderById since we have the ID, not the slug
  const { provider, loading: loadingProvider, error: providerError } = useProviderById(providerId);
  const { services, loading: loadingServices } = useServices(providerId);
  const { members, loading: loadingMembers, error: membersError } = useMembers(providerId);
  const { locations } = useLocations(providerId);

  // Initialize booking when data is loaded
  useEffect(() => {
    if (provider && services.length > 0 && serviceId) {
      const selectedService = services.find((s) => s.id === serviceId);
      if (selectedService && !bookingProvider) {
        initBooking(provider, selectedService);
      }
    }
  }, [provider, services, serviceId, initBooking, bookingProvider]);

  // Loading state
  const isLoading = loadingProvider || loadingServices || loadingMembers;

  // Handle member selection
  const handleSelectMember = (member: WithId<Member>) => {
    setMember(member);
    // Navigate to date selection
    router.push(`/(client)/booking/${providerId}/date`);
  };

  // Auto-select if only one member
  useEffect(() => {
    if (!loadingMembers && members.length === 1) {
      handleSelectMember(members[0]);
    }
  }, [loadingMembers, members]);

  // Get location name for a member
  const getMemberLocation = (member: WithId<Member>): string => {
    const location = locations.find((l) => l.id === member.locationId);
    return location ? `${location.name} - ${location.city}` : '';
  };

  // Get initials for avatar
  const getInitials = (name: string): string => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  // Loading view
  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: insets.top + spacing.md, paddingHorizontal: spacing.lg }]}>
          <Pressable
            onPress={() => router.back()}
            style={[styles.backButton, { backgroundColor: colors.surface, borderRadius: radius.full }]}
          >
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <Text variant="h2" style={styles.headerTitle}>Choisir un membre</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  // Error view
  if (providerError || membersError || !provider) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: insets.top + spacing.md, paddingHorizontal: spacing.lg }]}>
          <Pressable
            onPress={() => router.back()}
            style={[styles.backButton, { backgroundColor: colors.surface, borderRadius: radius.full }]}
          >
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <Text variant="h2" style={styles.headerTitle}>Choisir un membre</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.errorContainer}>
          <EmptyState
            icon="alert-circle-outline"
            title="Erreur"
            description={providerError || membersError || 'Données non trouvées'}
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
        <Text variant="h2" style={styles.headerTitle}>Choisir un membre</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Service info */}
      {bookingService && (
        <View style={[styles.serviceInfo, { paddingHorizontal: spacing.lg, marginTop: spacing.md }]}>
          <Card padding="md" shadow="sm">
            <View style={styles.serviceRow}>
              <View style={{ flex: 1 }}>
                <Text variant="body" style={{ fontWeight: '600' }}>
                  {bookingService.name}
                </Text>
                <Text variant="caption" color="textSecondary">
                  {bookingService.duration} min
                </Text>
              </View>
              <Text variant="h3" color="primary">
                {(bookingService.price / 100).toFixed(2)} €
              </Text>
            </View>
          </Card>
        </View>
      )}

      {/* Members list */}
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + spacing.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text variant="caption" color="textSecondary" style={{ marginBottom: spacing.md, marginTop: spacing.lg }}>
          Sélectionnez la personne qui réalisera votre prestation
        </Text>

        {members.length === 0 ? (
          <Card padding="lg" shadow="sm">
            <EmptyState
              icon="people-outline"
              title="Aucun membre disponible"
              description="Ce prestataire n'a pas encore de membres d'équipe"
            />
          </Card>
        ) : (
          <View style={{ gap: spacing.md }}>
            {members.map((member) => (
              <Pressable
                key={member.id}
                onPress={() => handleSelectMember(member)}
                style={({ pressed }) => [
                  styles.memberCard,
                  {
                    backgroundColor: colors.surface,
                    borderRadius: radius.lg,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                {/* Avatar */}
                {member.photoURL ? (
                  <Image
                    source={{ uri: member.photoURL }}
                    style={[styles.avatar, { backgroundColor: colors.surfaceSecondary }]}
                  />
                ) : (
                  <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
                    <Text variant="body" style={{ color: '#FFFFFF', fontWeight: '600' }}>
                      {getInitials(member.name)}
                    </Text>
                  </View>
                )}

                {/* Member info */}
                <View style={styles.memberInfo}>
                  <Text variant="body" style={{ fontWeight: '600' }}>
                    {member.name}
                  </Text>
                  {getMemberLocation(member) && (
                    <View style={styles.locationRow}>
                      <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
                      <Text variant="caption" color="textSecondary" style={{ marginLeft: 4 }}>
                        {getMemberLocation(member)}
                      </Text>
                    </View>
                  )}
                  {member.isDefault && (
                    <View style={[styles.defaultBadge, { backgroundColor: colors.primaryLight || '#e4effa' }]}>
                      <Text variant="caption" color="primary" style={{ fontWeight: '500' }}>
                        Principal
                      </Text>
                    </View>
                  )}
                </View>

                {/* Arrow */}
                <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  serviceInfo: {
    // Dynamic
  },
  serviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scrollContent: {
    flexGrow: 1,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  memberInfo: {
    flex: 1,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  defaultBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
});
