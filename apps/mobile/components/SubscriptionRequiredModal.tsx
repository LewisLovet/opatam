/**
 * SubscriptionRequiredModal
 * Shown when a user with expired trial tries to use a premium feature.
 * Commercial design to incite subscription purchase.
 */

import React from 'react';
import { Modal, View, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Text, Button } from './index';
import { useTheme } from '../theme';
import { SUBSCRIPTION_PLANS } from '@booking-app/shared';

interface SubscriptionRequiredModalProps {
  visible: boolean;
  onClose: () => void;
  /** Context message explaining why subscription is needed */
  context?: string;
}

const FEATURES = SUBSCRIPTION_PLANS.solo.features;

export function SubscriptionRequiredModal({ visible, onClose, context }: SubscriptionRequiredModalProps) {
  const { colors, spacing } = useTheme();
  const router = useRouter();

  const handleSubscribe = () => {
    onClose();
    router.push('/(pro)/paywall');
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={[styles.modal, { backgroundColor: colors.background }]} onPress={(e) => e.stopPropagation()}>
          {/* Close button */}
          <Pressable onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={22} color={colors.textMuted} />
          </Pressable>

          {/* Icon */}
          <View style={styles.iconContainer}>
            <View style={[styles.iconCircle, { backgroundColor: colors.primary + '15' }]}>
              <Ionicons name="rocket-outline" size={32} color={colors.primary} />
            </View>
          </View>

          {/* Title */}
          <Text variant="h2" align="center" style={{ marginTop: spacing.md }}>
            Passez au plan Pro
          </Text>

          {/* Context message */}
          <Text variant="body" color="textSecondary" align="center" style={{ marginTop: spacing.sm, lineHeight: 22 }}>
            {context || 'Votre période d\'essai est terminée. Abonnez-vous pour débloquer toutes les fonctionnalités.'}
          </Text>

          {/* Price highlight */}
          <View style={[styles.priceCard, { backgroundColor: colors.primary + '08', borderColor: colors.primary + '20' }]}>
            <Text style={[styles.priceText, { color: colors.primary }]}>
              À partir de {(SUBSCRIPTION_PLANS.solo.yearlyPrice / 100 / 12).toFixed(2).replace('.', ',')} €/mois
            </Text>
            <Text variant="caption" color="textSecondary">
              Soit {(SUBSCRIPTION_PLANS.solo.yearlyPrice / 100).toFixed(0)} €/an — sans engagement
            </Text>
          </View>

          {/* Features */}
          <View style={[styles.features, { marginTop: spacing.md }]}>
            {FEATURES.map((feature, i) => (
              <View key={i} style={styles.featureRow}>
                <Ionicons name="checkmark-circle" size={18} color="#16A34A" />
                <Text variant="body" style={styles.featureText}>{feature}</Text>
              </View>
            ))}
          </View>

          {/* CTA Button */}
          <View style={{ marginTop: spacing.lg }}>
            <Button
              title="Voir les offres"
              onPress={handleSubscribe}
              fullWidth
            />
          </View>

          {/* Secondary action */}
          <Pressable onPress={onClose} style={{ marginTop: spacing.md, paddingVertical: 8 }}>
            <Text variant="caption" color="textMuted" align="center">
              Plus tard
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
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
  modal: {
    width: '100%',
    borderRadius: 20,
    padding: 24,
    maxHeight: '85%',
  },
  closeButton: {
    position: 'absolute',
    top: 14,
    right: 14,
    zIndex: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    alignItems: 'center',
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  priceCard: {
    marginTop: 16,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  priceText: {
    fontSize: 18,
    fontWeight: '700',
  },
  features: {
    gap: 10,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  featureText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
});
