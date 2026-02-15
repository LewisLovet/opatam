/**
 * Block Slot Screen
 * Form to create a blocked period (vacation, absence, etc.)
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Pressable,
  Alert,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '../../theme';
import { Text, Button, Card, Switch, Input, Loader } from '../../components';
import { useProvider } from '../../contexts';
import { schedulingService, memberService } from '@booking-app/firebase';
import type { Member } from '@booking-app/shared';
import type { WithId } from '@booking-app/firebase';

const days = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const months = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

function formatDate(date: Date): string {
  return `${days[date.getDay()]} ${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

function formatTime(date: Date): string {
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
}

export default function BlockSlotScreen() {
  const { colors, spacing, radius } = useTheme();
  const router = useRouter();
  const { providerId } = useProvider();
  const { date: dateParam } = useLocalSearchParams<{ date?: string }>();

  // Parse initial date from query param (ISO string) or fallback to today
  const initialDate = (() => {
    if (dateParam) {
      const parsed = new Date(dateParam);
      if (!isNaN(parsed.getTime())) return parsed;
    }
    return new Date();
  })();

  const [members, setMembers] = useState<WithId<Member>[]>([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [startDate, setStartDate] = useState(initialDate);
  const [endDate, setEndDate] = useState(initialDate);
  const [allDay, setAllDay] = useState(true);
  const [reason, setReason] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Date picker visibility
  const [showStartDate, setShowStartDate] = useState(false);
  const [showEndDate, setShowEndDate] = useState(false);
  const [showStartTime, setShowStartTime] = useState(false);
  const [showEndTime, setShowEndTime] = useState(false);

  useEffect(() => {
    if (!providerId) return;
    memberService
      .getByProvider(providerId)
      .then((result) => {
        const activeMembers = (result as WithId<Member>[]).filter((m) => m.isActive);
        setMembers(activeMembers);
        if (activeMembers.length === 1) {
          setSelectedMemberIds([activeMembers[0].id]);
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [providerId]);

  const allSelected = members.length > 0 && selectedMemberIds.length === members.length;

  const toggleMember = (id: string) => {
    setSelectedMemberIds((prev) =>
      prev.includes(id) ? prev.filter((mid) => mid !== id) : [...prev, id],
    );
  };

  const toggleAll = () => {
    setSelectedMemberIds(allSelected ? [] : members.map((m) => m.id));
  };

  const handleSubmit = async () => {
    if (!providerId || selectedMemberIds.length === 0) {
      Alert.alert('Erreur', 'Veuillez sélectionner au moins un membre');
      return;
    }

    try {
      setIsSubmitting(true);

      const selectedMembers = members.filter((m) => selectedMemberIds.includes(m.id));

      await Promise.all(
        selectedMembers.map((member) =>
          schedulingService.blockPeriod(providerId, {
            memberId: member.id,
            locationId: member.locationId,
            startDate,
            endDate,
            allDay,
            isRecurring: false,
            startTime: allDay ? null : formatTime(startDate),
            endTime: allDay ? null : formatTime(endDate),
            reason: reason.trim() || null,
          }),
        ),
      );

      const label = selectedMembers.length > 1
        ? `Créneau bloqué pour ${selectedMembers.length} membres`
        : 'Créneau bloqué avec succès';
      Alert.alert('Succès', label, [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error) {
      console.error('Error blocking slot:', error);
      Alert.alert('Erreur', error instanceof Error ? error.message : 'Impossible de bloquer le créneau');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.center}>
          <Loader />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { padding: spacing.lg, paddingBottom: spacing.md }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text variant="h2" style={{ marginLeft: spacing.md }}>
          Bloquer un créneau
        </Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.lg, paddingTop: 0 }}>
        {/* Member selection */}
        {members.length > 1 && (
          <View style={{ marginBottom: spacing.lg }}>
            <Text variant="body" style={{ fontWeight: '600', marginBottom: spacing.sm }}>
              Membres
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', gap: spacing.xs }}>
                <Pressable
                  onPress={toggleAll}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: allSelected ? colors.primary : colors.surface,
                      borderColor: allSelected ? colors.primary : colors.border,
                      borderRadius: radius.full,
                      paddingHorizontal: spacing.md,
                      paddingVertical: spacing.sm,
                    },
                  ]}
                >
                  <Text
                    variant="bodySmall"
                    style={{
                      color: allSelected ? '#fff' : colors.text,
                      fontWeight: '500',
                    }}
                  >
                    Tous
                  </Text>
                </Pressable>
                {members.map((member) => {
                  const isSelected = selectedMemberIds.includes(member.id);
                  return (
                    <Pressable
                      key={member.id}
                      onPress={() => toggleMember(member.id)}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: isSelected ? colors.primary : colors.surface,
                          borderColor: isSelected ? colors.primary : colors.border,
                          borderRadius: radius.full,
                          paddingHorizontal: spacing.md,
                          paddingVertical: spacing.sm,
                        },
                      ]}
                    >
                      <Text
                        variant="bodySmall"
                        style={{
                          color: isSelected ? '#fff' : colors.text,
                          fontWeight: '500',
                        }}
                      >
                        {member.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        )}

        {/* All day toggle */}
        <View
          style={[
            styles.toggleRow,
            {
              backgroundColor: colors.surface,
              borderRadius: radius.md,
              padding: spacing.md,
              borderWidth: 1,
              borderColor: colors.border,
              marginBottom: spacing.md,
            },
          ]}
        >
          <Text variant="body" style={{ flex: 1 }}>Journée entière</Text>
          <Switch value={allDay} onValueChange={setAllDay} />
        </View>

        {/* Start date */}
        <View style={{ marginBottom: spacing.md }}>
          <Text variant="body" style={{ fontWeight: '600', marginBottom: spacing.xs }}>
            Date de début
          </Text>
          <Pressable
            onPress={() => setShowStartDate(true)}
            style={[
              styles.dateButton,
              {
                backgroundColor: colors.surface,
                borderRadius: radius.md,
                padding: spacing.md,
                borderWidth: 1,
                borderColor: colors.border,
              },
            ]}
          >
            <Ionicons name="calendar-outline" size={20} color={colors.textSecondary} />
            <Text variant="body" style={{ marginLeft: spacing.sm }}>
              {formatDate(startDate)}
            </Text>
          </Pressable>
          {showStartDate && (
            <DateTimePicker
              value={startDate}
              mode="date"
              minimumDate={new Date()}
              onChange={(_: any, date: Date | undefined) => {
                setShowStartDate(false);
                if (date) {
                  setStartDate(date);
                  if (date > endDate) setEndDate(date);
                }
              }}
            />
          )}
        </View>

        {/* Start time (if not all day) */}
        {!allDay && (
          <View style={{ marginBottom: spacing.md }}>
            <Text variant="body" style={{ fontWeight: '600', marginBottom: spacing.xs }}>
              Heure de début
            </Text>
            <Pressable
              onPress={() => setShowStartTime(true)}
              style={[
                styles.dateButton,
                {
                  backgroundColor: colors.surface,
                  borderRadius: radius.md,
                  padding: spacing.md,
                  borderWidth: 1,
                  borderColor: colors.border,
                },
              ]}
            >
              <Ionicons name="time-outline" size={20} color={colors.textSecondary} />
              <Text variant="body" style={{ marginLeft: spacing.sm }}>
                {formatTime(startDate)}
              </Text>
            </Pressable>
            {showStartTime && (
              <DateTimePicker
                value={startDate}
                mode="time"
                is24Hour
                minuteInterval={15}
                onChange={(_: any, date: Date | undefined) => {
                  setShowStartTime(false);
                  if (date) setStartDate(date);
                }}
              />
            )}
          </View>
        )}

        {/* End date */}
        <View style={{ marginBottom: spacing.md }}>
          <Text variant="body" style={{ fontWeight: '600', marginBottom: spacing.xs }}>
            Date de fin
          </Text>
          <Pressable
            onPress={() => setShowEndDate(true)}
            style={[
              styles.dateButton,
              {
                backgroundColor: colors.surface,
                borderRadius: radius.md,
                padding: spacing.md,
                borderWidth: 1,
                borderColor: colors.border,
              },
            ]}
          >
            <Ionicons name="calendar-outline" size={20} color={colors.textSecondary} />
            <Text variant="body" style={{ marginLeft: spacing.sm }}>
              {formatDate(endDate)}
            </Text>
          </Pressable>
          {showEndDate && (
            <DateTimePicker
              value={endDate}
              mode="date"
              minimumDate={startDate}
              onChange={(_: any, date: Date | undefined) => {
                setShowEndDate(false);
                if (date) setEndDate(date);
              }}
            />
          )}
        </View>

        {/* End time (if not all day) */}
        {!allDay && (
          <View style={{ marginBottom: spacing.md }}>
            <Text variant="body" style={{ fontWeight: '600', marginBottom: spacing.xs }}>
              Heure de fin
            </Text>
            <Pressable
              onPress={() => setShowEndTime(true)}
              style={[
                styles.dateButton,
                {
                  backgroundColor: colors.surface,
                  borderRadius: radius.md,
                  padding: spacing.md,
                  borderWidth: 1,
                  borderColor: colors.border,
                },
              ]}
            >
              <Ionicons name="time-outline" size={20} color={colors.textSecondary} />
              <Text variant="body" style={{ marginLeft: spacing.sm }}>
                {formatTime(endDate)}
              </Text>
            </Pressable>
            {showEndTime && (
              <DateTimePicker
                value={endDate}
                mode="time"
                is24Hour
                minuteInterval={15}
                onChange={(_: any, date: Date | undefined) => {
                  setShowEndTime(false);
                  if (date) setEndDate(date);
                }}
              />
            )}
          </View>
        )}

        {/* Reason */}
        <View style={{ marginBottom: spacing.xl }}>
          <Input
            label="Motif (optionnel)"
            value={reason}
            onChangeText={setReason}
            placeholder="Vacances, formation, etc."
          />
        </View>

        {/* Submit */}
        <Button
          title="Bloquer le créneau"
          variant="primary"
          onPress={handleSubmit}
          disabled={isSubmitting || selectedMemberIds.length === 0}
        />
      </ScrollView>
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
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chip: {
    borderWidth: 1,
  },
});
