/**
 * StampRow
 * Rangée de tampons : `filled` cercles remplis sur `threshold`.
 * `appearAnims` (cinématique d'activation) : une Animated.Value par tampon
 * rempli — le tampon reste invisible tant que sa valeur est à 0.
 *
 * Le DERNIER emplacement du cycle est celui qui débloque la réduction : il
 * se distingue de tous les autres (plus grand, contour doré, icône de
 * récompense) et rayonne une fois atteint — on doit voir d'un coup d'œil
 * où l'on va.
 */

import React from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../theme';

export interface StampRowProps {
  filled: number;
  threshold: number;
  appearAnims?: Animated.Value[] | null;
}

export function StampRow({ filled, threshold, appearAnims }: StampRowProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.stampRow}>
      {Array.from({ length: threshold }, (_, i) => {
        const isFilled = i < filled;
        // Dernier emplacement du cycle = celui qui débloque la réduction.
        const isReward = i === threshold - 1;

        const stamp = isReward ? (
          <View style={styles.rewardWrap}>
            {/* Halo : la récompense « rayonne » une fois atteinte. */}
            {isFilled && (
              <View style={[styles.rewardHalo, { backgroundColor: colors.warning + '33' }]} />
            )}
            <View
              style={[
                styles.rewardStamp,
                {
                  borderColor: colors.warning,
                  backgroundColor: isFilled ? colors.warning : colors.surfaceSecondary,
                },
              ]}
            >
              <Ionicons name="gift" size={15} color={isFilled ? '#FFFFFF' : colors.warning} />
            </View>
          </View>
        ) : (
          <View
            style={[
              styles.stamp,
              isFilled
                ? { backgroundColor: colors.primary }
                : {
                    backgroundColor: colors.surfaceSecondary,
                    borderWidth: 1.5,
                    borderColor: colors.border,
                  },
            ]}
          >
            {isFilled && <Ionicons name="checkmark" size={13} color="#FFFFFF" />}
          </View>
        );

        const anim = isFilled ? appearAnims?.[i] : undefined;
        if (!anim) return <View key={i}>{stamp}</View>;
        return (
          <Animated.View
            key={i}
            style={{
              opacity: anim,
              // Le spring dépasse 1 → petit rebond « pop » sur chaque tampon.
              transform: [
                { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] }) },
              ],
            }}
          >
            {stamp}
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  stampRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  stamp: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rewardWrap: {
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rewardHalo: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  rewardStamp: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
