/**
 * NotificationPermissionPrompt
 * Shows a friendly explanation modal before the system notification permission dialog.
 * Increases opt-in rate by explaining the value before asking.
 */

import React from 'react';
import { View, Modal, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Text';
import { Button } from './Button';
import { useTheme } from '../theme';

interface Props {
  visible: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

export function NotificationPermissionPrompt({ visible, onAccept, onDecline }: Props) {
  const { colors, spacing, radius } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: colors.surface, borderRadius: radius.xl }]}>
          {/* Icon */}
          <View style={[styles.iconCircle, { backgroundColor: '#DBEAFE' }]}>
            <Ionicons name="notifications-outline" size={36} color="#2563EB" />
          </View>

          {/* Title */}
          <Text variant="h3" align="center" style={{ marginTop: spacing.md }}>
            Restez informé en temps réel
          </Text>

          {/* Description */}
          <Text variant="body" color="textSecondary" align="center" style={{ marginTop: spacing.sm, lineHeight: 22 }}>
            Activez les notifications pour être alerté de :
          </Text>

          {/* Benefits list */}
          <View style={{ marginTop: spacing.md, gap: spacing.sm, width: '100%' }}>
            {[
              { icon: 'calendar-outline' as const, text: 'Nouveaux rendez-vous' },
              { icon: 'time-outline' as const, text: 'Rappels avant vos RDV' },
              { icon: 'star-outline' as const, text: 'Avis de vos clients' },
              { icon: 'alert-circle-outline' as const, text: 'Annulations et modifications' },
            ].map((item) => (
              <View key={item.text} style={styles.benefitRow}>
                <View style={[styles.benefitIcon, { backgroundColor: '#EFF6FF' }]}>
                  <Ionicons name={item.icon} size={18} color="#2563EB" />
                </View>
                <Text variant="bodySmall" style={{ flex: 1, color: colors.text }}>
                  {item.text}
                </Text>
              </View>
            ))}
          </View>

          {/* Buttons */}
          <View style={{ marginTop: spacing.xl, width: '100%', gap: spacing.sm }}>
            <Button
              title="Activer les notifications"
              onPress={onAccept}
              fullWidth
            />
            <Pressable onPress={onDecline} style={styles.declineButton}>
              <Text variant="bodySmall" color="textMuted" style={{ textAlign: 'center' }}>
                Plus tard
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    padding: 28,
    alignItems: 'center',
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  benefitIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  declineButton: {
    paddingVertical: 10,
  },
});
