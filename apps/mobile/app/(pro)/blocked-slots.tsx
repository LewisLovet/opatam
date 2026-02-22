/**
 * Blocked Slots List Screen
 * Shows upcoming blocked slots with ability to delete
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  FlatList,
  Pressable,
  Alert,
  RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { Text, Card, Loader, EmptyState } from '../../components';
import { useProvider } from '../../contexts';
import { useBlockedSlots } from '../../hooks';
import { schedulingService, memberService } from '@booking-app/firebase';
import type { BlockedSlot, Member } from '@booking-app/shared';
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

  // Fetch members to resolve memberId → name
  const [members, setMembers] = useState<WithId<Member>[]>([]);
  useEffect(() => {
    if (!providerId) return;
    memberService.getByProvider(providerId).then((res) => setMembers(res as WithId<Member>[])).catch(() => {});
  }, [providerId]);

  const memberMap = useMemo(() => {
    const map: Record<string, WithId<Member>> = {};
    for (const m of members) map[m.id] = m;
    return map;
  }, [members]);

  // Group blocked slots that share the same dates + reason (created together for multiple members)
  interface SlotGroup {
    key: string;
    slots: WithId<BlockedSlot>[];
    startDate: Date;
    endDate: Date;
    allDay: boolean;
    reason: string | null;
    memberIds: string[];
  }

  const groupedSlots = useMemo(() => {
    const groups: Record<string, SlotGroup> = {};
    for (const slot of blockedSlots) {
      const sd = slot.startDate instanceof Date ? slot.startDate : (slot.startDate as any).toDate();
      const ed = slot.endDate instanceof Date ? slot.endDate : (slot.endDate as any).toDate();
      // Key: same start + end timestamp + allDay + reason
      const key = `${sd.getTime()}-${ed.getTime()}-${slot.allDay}-${slot.reason || ''}`;
      if (!groups[key]) {
        groups[key] = {
          key,
          slots: [],
          startDate: sd,
          endDate: ed,
          allDay: slot.allDay,
          reason: slot.reason,
          memberIds: [],
        };
      }
      groups[key].slots.push(slot);
      groups[key].memberIds.push(slot.memberId);
    }
    // Sort groups by startDate ascending
    return Object.values(groups).sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  }, [blockedSlots]);

  // Auto-refresh when screen regains focus (e.g. after creating a blocked slot)
  const isFirstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (isFirstFocus.current) {
        isFirstFocus.current = false;
        return;
      }
      refresh();
    }, [refresh]),
  );

  const handleDeleteGroup = (group: SlotGroup) => {
    const label = group.slots.length > 1
      ? `Supprimer ce blocage pour ${group.slots.length} membres ?`
      : `Supprimer le blocage du ${formatDate(group.startDate)} ?`;
    Alert.alert(
      'Supprimer le blocage',
      label,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              if (providerId) {
                await Promise.all(
                  group.slots.map((slot) => schedulingService.unblockPeriod(providerId, slot.id)),
                );
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

  const renderGroup = ({ item: group }: { item: SlotGroup }) => {
    const { startDate: sd, endDate: ed, allDay: isAllDay, reason: groupReason, memberIds } = group;
    const isMultiDay = sd.getFullYear() !== ed.getFullYear()
      || sd.getMonth() !== ed.getMonth()
      || sd.getDate() !== ed.getDate();

    // Check if all active members are in the group
    const activeMembers = members.filter((m) => m.isActive);
    const isAllMembers = activeMembers.length > 1 && memberIds.length >= activeMembers.length;

    return (
      <Card padding="md" shadow="sm" style={{ marginBottom: spacing.sm }}>
        <View style={styles.slotRow}>
          <View style={styles.slotInfo}>
            {groupReason && (
              <Text variant="body" style={{ fontWeight: '600', marginBottom: 2 }}>
                {groupReason}
              </Text>
            )}
            <Text variant={groupReason ? 'caption' : 'body'} color={groupReason ? 'textSecondary' : 'text'} style={groupReason ? undefined : { fontWeight: '600' }}>
              {isMultiDay
                ? `Du ${formatDate(sd)} au ${formatDate(ed)}`
                : formatDate(sd)}
            </Text>
            <Text variant="caption" color="textSecondary">
              {isAllDay
                ? isMultiDay ? `${Math.round((ed.getTime() - sd.getTime()) / 86400000) + 1} jours` : 'Journée entière'
                : `${formatTime(sd)} - ${formatTime(ed)}`}
            </Text>
            {/* Member badges */}
            {members.length > 1 && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs }}>
                {isAllMembers ? (
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: colors.primaryLight,
                      borderRadius: radius.full,
                      paddingHorizontal: spacing.sm,
                      paddingVertical: 3,
                    }}
                  >
                    <Ionicons name="people" size={12} color={colors.primary} style={{ marginRight: spacing.xs }} />
                    <Text variant="caption" style={{ fontWeight: '600', color: colors.primary }}>
                      Tous
                    </Text>
                  </View>
                ) : (
                  memberIds.map((memberId) => {
                    const member = memberMap[memberId];
                    const memberName = member?.name || 'Membre';
                    const memberColor = member?.color || colors.primary;
                    return (
                      <View
                        key={memberId}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          backgroundColor: memberColor + '18',
                          borderRadius: radius.full,
                          paddingHorizontal: spacing.sm,
                          paddingVertical: 3,
                        }}
                      >
                        <View
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: 4,
                            backgroundColor: memberColor,
                            marginRight: spacing.xs,
                          }}
                        />
                        <Text variant="caption" style={{ fontWeight: '600', color: memberColor }}>
                          {memberName.split(' ')[0]}
                        </Text>
                      </View>
                    );
                  })
                )}
              </View>
            )}
          </View>
          <Pressable
            onPress={() => handleDeleteGroup(group)}
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
          data={groupedSlots}
          keyExtractor={(item) => item.key}
          renderItem={renderGroup}
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
