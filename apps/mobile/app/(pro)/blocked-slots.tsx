/**
 * Blocked Slots List Screen
 * Shows upcoming blocked slots with ability to delete
 */

import React from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  FlatList,
  Pressable,
  Alert,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { Text, Card, Loader, EmptyState } from '../../components';
import { useProvider } from '../../contexts';
import { useBlockedSlots } from '../../hooks';
import { schedulingService } from '@booking-app/firebase';
import type { BlockedSlot } from '@booking-app/shared';
import type { WithId } from '@booking-app/firebase';

const days = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const months = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

function formatDate(date: Date): string {
  return `${days[date.getDay()]} ${date.getDate()} ${months[date.getMonth()]}`;
}

function formatTime(date: Date): string {
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
}

export default function BlockedSlotsScreen() {
  const { colors, spacing, radius } = useTheme();
  const router = useRouter();
  const { providerId } = useProvider();
  const { blockedSlots, isLoading, refresh } = useBlockedSlots(providerId);

  const handleDelete = (slot: WithId<BlockedSlot>) => {
    Alert.alert(
      'Supprimer le blocage',
      `Supprimer le blocage du ${formatDate(slot.startDate instanceof Date ? slot.startDate : (slot.startDate as any).toDate())} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              if (providerId) {
                await schedulingService.unblockPeriod(providerId, slot.id);
                refresh();
              }
            } catch (error) {
              Alert.alert('Erreur', 'Impossible de supprimer le blocage');
            }
          },
        },
      ],
    );
  };

  const renderSlot = ({ item }: { item: WithId<BlockedSlot> }) => {
    const startDate = item.startDate instanceof Date ? item.startDate : (item.startDate as any).toDate();
    const endDate = item.endDate instanceof Date ? item.endDate : (item.endDate as any).toDate();
    const isAllDay = item.allDay;

    return (
      <Card padding="md" shadow="sm" style={{ marginBottom: spacing.sm }}>
        <View style={styles.slotRow}>
          <View style={styles.slotInfo}>
            <Text variant="body" style={{ fontWeight: '600' }}>
              {formatDate(startDate)}
            </Text>
            <Text variant="caption" color="textSecondary">
              {isAllDay
                ? 'Journée entière'
                : `${formatTime(startDate)} - ${formatTime(endDate)}`}
            </Text>
            {item.reason && (
              <Text variant="caption" color="textMuted" style={{ marginTop: 4 }}>
                {item.reason}
              </Text>
            )}
            {item.memberId && (
              <Text variant="caption" color="textSecondary" style={{ marginTop: 2 }}>
                Membre: {item.memberId}
              </Text>
            )}
          </View>
          <Pressable
            onPress={() => handleDelete(item)}
            hitSlop={12}
            style={[
              styles.deleteButton,
              {
                backgroundColor: colors.errorLight,
                borderRadius: radius.full,
              },
            ]}
          >
            <Ionicons name="trash-outline" size={18} color={colors.error} />
          </Pressable>
        </View>
      </Card>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { padding: spacing.lg, paddingBottom: spacing.md }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text variant="h2" style={{ flex: 1, marginLeft: spacing.md }}>
          Créneaux bloqués
        </Text>
        <Pressable
          onPress={() => router.push('/(pro)/block-slot')}
          style={[
            styles.addButton,
            {
              backgroundColor: colors.primary,
              borderRadius: radius.full,
            },
          ]}
        >
          <Ionicons name="add" size={24} color="#fff" />
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <Loader />
        </View>
      ) : (
        <FlatList
          data={blockedSlots}
          keyExtractor={(item) => item.id}
          renderItem={renderSlot}
          contentContainerStyle={{ padding: spacing.lg, paddingTop: 0 }}
          refreshControl={
            <RefreshControl refreshing={false} onRefresh={refresh} />
          }
          ListEmptyComponent={
            <EmptyState
              icon="ban-outline"
              title="Aucun créneau bloqué"
              description="Bloquez des créneaux pour indiquer vos indisponibilités"
            />
          }
        />
      )}
    </SafeAreaView>
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
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  slotInfo: {
    flex: 1,
  },
  deleteButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
