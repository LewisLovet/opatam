/**
 * LocationPermissionPrompt
 *
 * Friendly explanation modal shown before the system location
 * permission dialog. Mirrors NotificationPermissionPrompt for visual
 * + behavioural consistency: bullet list of value, accept / "Plus
 * tard" choice, modal overlay.
 *
 * Why priming matters:
 *   - iOS only allows ONE permission prompt. If the user denies
 *     it, they have to manually go to Settings to re-enable.
 *   - Showing what we'll do with the location BEFORE asking
 *     significantly increases acceptance rates (industry rule of
 *     thumb: ~50 % bare prompt → ~80 % with priming).
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

export function LocationPermissionPrompt({ visible, onAccept, onDecline }: Props) {
  const { colors, spacing, radius } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: colors.surface, borderRadius: radius.xl }]}>
          {/* Icon */}
          <View style={[styles.iconCircle, { backgroundColor: '#DCFCE7' }]}>
            <Ionicons name="location-outline" size={36} color="#16A34A" />
          </View>

          {/* Title */}
          <Text variant="h3" align="center" style={{ marginTop: spacing.md }}>
            Trouvez les pros près de chez vous
          </Text>

          {/* Description */}
          <Text variant="body" color="textSecondary" align="center" style={{ marginTop: spacing.sm, lineHeight: 22 }}>
            Nous utilisons votre localisation pour :
          </Text>

          {/* Benefits list */}
          <View style={{ marginTop: spacing.md, gap: spacing.sm, width: '100%' }}>
            {[
              { icon: 'navigate-outline' as const, text: 'Afficher les prestataires proches' },
              { icon: 'map-outline' as const, text: 'Calculer la distance et le temps de trajet' },
              { icon: 'options-outline' as const, text: 'Trier les résultats par distance' },
            ].map((item) => (
              <View key={item.text} style={styles.benefitRow}>
                <View style={[styles.benefitIcon, { backgroundColor: '#F0FDF4' }]}>
                  <Ionicons name={item.icon} size={18} color="#16A34A" />
                </View>
                <Text variant="bodySmall" style={{ flex: 1, color: colors.text }}>
                  {item.text}
                </Text>
              </View>
            ))}
          </View>

          {/* Privacy reassurance */}
          <Text
            variant="caption"
            color="textMuted"
            align="center"
            style={{ marginTop: spacing.md, lineHeight: 16 }}
          >
            Votre position n'est jamais partagée avec les prestataires.
            Vous pouvez la désactiver à tout moment depuis les Réglages.
          </Text>

          {/* Buttons */}
          <View style={{ marginTop: spacing.xl, width: '100%', gap: spacing.sm }}>
            <Button
              title="Activer la localisation"
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
