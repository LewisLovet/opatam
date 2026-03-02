/**
 * UpgradeToStudioModal
 * Shown when a Solo/Trial user tries to use a Studio-only feature
 * (e.g. adding more members, multiple locations).
 * Commercial design to incite upgrade to Studio plan.
 */

import React from 'react';
import { Modal, View, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Text, Button } from './index';
import { useTheme } from '../theme';
import { SUBSCRIPTION_PLANS } from '@booking-app/shared';

interface UpgradeToStudioModalProps {
  visible: boolean;
  onClose: () => void;
  /** Context message explaining which feature requires Studio */
  context?: string;
}

const STUDIO_HIGHLIGHTS = SUBSCRIPTION_PLANS.team.features;

export function UpgradeToStudioModal({ visible, onClose, context }: UpgradeToStudioModalProps) {
  const { colors, spacing } = useTheme();
  const router = useRouter();

  const handleUpgrade = () => {
    onClose();
    router.push('/(pro)/paywall');
  };

  const monthlyEquiv = (SUBSCRIPTION_PLANS.team.baseYearlyPrice / 100 / 12).toFixed(2).replace('.', ',');
  const yearlyPrice = (SUBSCRIPTION_PLANS.team.baseYearlyPrice / 100).toFixed(0);
  const monthlyPrice = (SUBSCRIPTION_PLANS.team.baseMonthlyPrice / 100).toFixed(2).replace('.', ',');

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
            <View style={[styles.iconCircle, { backgroundColor: '#8B5CF6' + '15' }]}>
              <Ionicons name="people-outline" size={32} color="#8B5CF6" />
            </View>
          </View>

          {/* Title */}
          <Text variant="h2" align="center" style={{ marginTop: spacing.md }}>
            Passez au plan Studio
          </Text>

          {/* Context message */}
          <Text variant="body" color="textSecondary" align="center" style={{ marginTop: spacing.sm, lineHeight: 22 }}>
            {context || 'Cette fonctionnalité est réservée au plan Studio. Gérez votre équipe et développez votre activité.'}
          </Text>

          {/* Price comparison */}
          <View style={[styles.priceCard, { backgroundColor: '#8B5CF6' + '08', borderColor: '#8B5CF6' + '20' }]}>
            <View style={styles.priceRow}>
              <Text style={[styles.priceText, { color: '#8B5CF6' }]}>
                {monthlyEquiv} €/mois
              </Text>
              <View style={styles.savingsBadge}>
                <Text style={styles.savingsText}>-33%</Text>
              </View>
            </View>
            <Text variant="caption" color="textSecondary">
              {yearlyPrice} €/an au lieu de {monthlyPrice} €/mois
            </Text>
          </View>

          {/* Studio features */}
          <View style={[styles.features, { marginTop: spacing.md }]}>
            {STUDIO_HIGHLIGHTS.map((feature, i) => (
              <View key={i} style={styles.featureRow}>
                <Ionicons name="checkmark-circle" size={18} color="#8B5CF6" />
                <Text variant="body" style={styles.featureText}>{feature}</Text>
              </View>
            ))}
          </View>

          {/* CTA Button */}
          <View style={{ marginTop: spacing.lg }}>
            <Button
              title="Découvrir le plan Studio"
              onPress={handleUpgrade}
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
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  priceText: {
    fontSize: 18,
    fontWeight: '700',
  },
  savingsBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  savingsText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#16A34A',
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
