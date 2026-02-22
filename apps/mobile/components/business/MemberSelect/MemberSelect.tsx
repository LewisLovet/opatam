import React, { useState } from 'react';
import {
  View,
  Modal,
  Pressable,
  FlatList,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { WithId } from '@booking-app/firebase';
import type { Member } from '@booking-app/shared';
import { useTheme } from '../../../theme';
import { Text } from '../../Text';
import { Divider } from '../../Divider';

export interface MemberSelectProps {
  value: string | null;
  members: WithId<Member>[];
  onChange: (memberId: string | null) => void;
}

export function MemberSelect({ value, members, onChange }: MemberSelectProps) {
  const { colors, spacing, radius } = useTheme();
  const [isOpen, setIsOpen] = useState(false);

  const handleSelect = (memberId: string | null) => {
    onChange(memberId);
    setIsOpen(false);
  };

  const selectedMember = value ? members.find((m) => m.id === value) : null;
  const triggerLabel = selectedMember
    ? selectedMember.name.split(' ')[0]
    : 'Tous les membres';

  return (
    <>
      <Pressable
        onPress={() => setIsOpen(true)}
        style={({ pressed }) => [
          styles.trigger,
          {
            backgroundColor: value ? colors.primaryLight : colors.surface,
            borderRadius: radius.full,
            borderWidth: 1,
            borderColor: value ? colors.primary : colors.border,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
          },
          pressed && { opacity: 0.8 },
        ]}
      >
        {selectedMember ? (
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: selectedMember.color || colors.border,
              marginRight: spacing.xs,
            }}
          />
        ) : (
          <Ionicons
            name="people-outline"
            size={14}
            color={colors.textSecondary}
            style={{ marginRight: spacing.xs }}
          />
        )}
        <Text
          variant="label"
          color={value ? 'primary' : 'textSecondary'}
          style={styles.triggerText}
          numberOfLines={1}
        >
          {triggerLabel}
        </Text>
        <Ionicons
          name="chevron-down"
          size={14}
          color={value ? colors.primary : colors.textMuted}
          style={{ marginLeft: spacing.xs }}
        />
      </Pressable>

      <Modal
        visible={isOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsOpen(false)}
      >
        <SafeAreaView style={[styles.modal, { backgroundColor: colors.background }]}>
          <View
            style={[
              styles.modalHeader,
              { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
            ]}
          >
            <Text variant="h3">Choisir un membre</Text>
            <Pressable
              onPress={() => setIsOpen(false)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={24} color={colors.text} />
            </Pressable>
          </View>

          <Divider spacing={0} />

          <FlatList
            data={[null, ...members]}
            keyExtractor={(item) => item?.id || 'all'}
            renderItem={({ item }) => {
              const isSelected = item ? item.id === value : value === null;

              return (
                <Pressable
                  onPress={() => handleSelect(item?.id ?? null)}
                  style={({ pressed }) => [
                    styles.option,
                    { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
                    pressed && { backgroundColor: colors.surfaceSecondary },
                  ]}
                >
                  <View style={styles.optionLeft}>
                    {item ? (
                      <View
                        style={{
                          width: 12,
                          height: 12,
                          borderRadius: 6,
                          backgroundColor: item.color || colors.border,
                          marginRight: spacing.sm,
                        }}
                      />
                    ) : (
                      <Ionicons
                        name="people-outline"
                        size={16}
                        color={isSelected ? colors.primary : colors.text}
                        style={{ marginRight: spacing.sm }}
                      />
                    )}
                    <Text
                      variant="body"
                      color={isSelected ? 'primary' : 'text'}
                      style={{ fontWeight: isSelected ? '600' : '400' }}
                    >
                      {item ? item.name : 'Tous les membres'}
                    </Text>
                  </View>
                  {isSelected && (
                    <Ionicons name="checkmark" size={20} color={colors.primary} />
                  )}
                </Pressable>
              );
            }}
            ItemSeparatorComponent={() => <Divider spacing={0} />}
          />
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 36,
  },
  triggerText: {
    flex: 1,
  },
  modal: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  option: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 48,
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
});
