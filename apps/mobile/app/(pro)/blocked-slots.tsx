/**
 * Blocked Slots List Screen
 * Shows upcoming blocked slots with ability to delete
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  Alert,
  RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import i18n from '../../lib/i18n';
import { useTheme } from '../../theme';
import { Text, Card, Loader, EmptyState } from '../../components';
import { BrandedHeader } from '../../components/business/BrandedHeader';
import { useProvider } from '../../contexts';
import { useBlockedSlots } from '../../hooks';
import { schedulingService, memberService } from '@booking-app/firebase';
import type { BlockedSlot, Member } from '@booking-app/shared';
import type { WithId } from '@booking-app/firebase';

// Date localisée via Intl sur la langue de l'app (plus de tableaux FR en dur).
function formatDate(date: Date): string {
  return new Intl.DateTimeFormat(i18n.language, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date);
}

function formatTime(date: Date): string {
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
}

export default function BlockedSlotsScreen() {
  const { colors, spacing, radius } = useTheme();
  const { t } = useTranslation();
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
      ? t('proBlockedSlots.delete.messageMulti', { count: group.slots.length })
      : t('proBlockedSlots.delete.messageSingle', { date: formatDate(group.startDate) });
    Alert.alert(
      t('proBlockedSlots.delete.title'),
      label,
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('proBlockedSlots.delete.confirm'),
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
              Alert.alert(t('proBlockedSlots.delete.errorTitle'), t('proBlockedSlots.delete.error'));
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
                ? t('proBlockedSlots.range', { start: formatDate(sd), end: formatDate(ed) })
                : formatDate(sd)}
            </Text>
            <Text variant="caption" color="textSecondary">
              {isAllDay
                ? isMultiDay ? t('proBlockedSlots.days', { count: Math.round((ed.getTime() - sd.getTime()) / 86400000) + 1 }) : t('proBlockedSlots.allDay')
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
                      {t('proBlockedSlots.all')}
                    </Text>
                  </View>
                ) : (
                  memberIds.map((memberId) => {
                    const member = memberMap[memberId];
                    const memberName = member?.name || t('proBlockedSlots.memberFallback');
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
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Branded blue header — the "+" lives in the right slot
          so the chrome matches the rest of the pro space. */}
      <BrandedHeader
        title={t('proBlockedSlots.title')}
        rightAction={{
          icon: 'add',
          onPress: () => router.push('/(pro)/block-slot'),
          accessibilityLabel: t('proBlockedSlots.addA11y'),
        }}
      />

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
              title={t('proBlockedSlots.empty.title')}
              description={t('proBlockedSlots.empty.description')}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
});
