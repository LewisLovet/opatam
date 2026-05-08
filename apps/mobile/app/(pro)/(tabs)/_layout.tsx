/**
 * Pro Tab Navigator
 * Bottom tab navigation for provider/professional screens
 */

import { useEffect, useRef } from 'react';
import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View, StyleSheet, Platform, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../theme';
import { useProvider } from '../../../contexts';
import { useProBookingBadges } from '../../../hooks';
import {
  MORE_TAB_FEATURE_KEYS,
  useNewFeatures,
} from '../../../hooks/useNewFeatures';

export default function ProTabsLayout() {
  const { colors, spacing } = useTheme();
  const router = useRouter();
  const { provider } = useProvider();
  const { todayCount, pendingCount } = useProBookingBadges(provider?.id);
  const insets = useSafeAreaInsets();
  // Discovery dot on the "Plus" tab — true while any new-feature
  // entry behind that tab hasn't been opened yet.
  const { hasAnyUnseen } = useNewFeatures();
  const moreHasNew = hasAnyUnseen(MORE_TAB_FEATURE_KEYS);

  // Pulse the dot continuously while there's something new — the
  // previous static 9px dot was easy to miss. Same pattern as the
  // ShareFAB indicator: outer ring expands + fades, inner solid
  // dot stays put.
  const pulseAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!moreHasNew) return;
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1400,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [moreHasNew, pulseAnim]);

  // See comment in (client)/(tabs)/_layout.tsx — same pattern, so the
  // tab buttons stay above Android's gesture bar / iPhone home indicator.
  const tabBarContentHeight = 56;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarPosition: 'bottom',
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          paddingTop: spacing.xs,
          paddingBottom: insets.bottom,
          height: tabBarContentHeight + insets.bottom,
          overflow: 'visible',
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
          marginTop: 4,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Accueil',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="grid-outline" size={size} color={color} />
          ),
          tabBarBadge: todayCount > 0 ? todayCount : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.primary, fontSize: 10 },
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: 'Agenda',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: '',
          tabBarIcon: () => (
            <View style={[styles.createButton, { backgroundColor: colors.surface }]}>
              <View
                style={[
                  styles.createButtonInner,
                  {
                    backgroundColor: colors.primary,
                    ...Platform.select({
                      ios: {
                        shadowColor: colors.primary,
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.3,
                        shadowRadius: 8,
                      },
                      android: {
                        elevation: 6,
                      },
                    }),
                  },
                ]}
              >
                <Ionicons name="add" size={28} color={colors.textInverse} />
              </View>
            </View>
          ),
          tabBarLabel: () => null,
        }}
        listeners={{
          tabPress: (e: any) => {
            e.preventDefault();
            // Route to the agenda tab and open the unified add sheet —
            // same 3 choices as the in-calendar FAB (Réservation /
            // Activité / Bloquer une période). Avoids forcing the pro
            // into the booking flow when they wanted an activity.
            router.push('/(pro)/(tabs)/calendar?action=add' as any);
          },
        }}
      />
      <Tabs.Screen
        name="bookings"
        options={{
          title: 'RDV',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="list-outline" size={size} color={color} />
          ),
          tabBarBadge: pendingCount > 0 ? pendingCount : undefined,
          tabBarBadgeStyle: { backgroundColor: '#F59E0B', fontSize: 10 },
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'Plus',
          tabBarIcon: ({ color, size }) => (
            <View>
              <Ionicons name="ellipsis-horizontal" size={size} color={color} />
              {moreHasNew && (
                <View pointerEvents="none" style={styles.moreIndicatorWrap}>
                  <Animated.View
                    style={[
                      styles.morePulseRing,
                      {
                        backgroundColor: '#E1306C',
                        opacity: pulseAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.6, 0],
                        }),
                        transform: [
                          {
                            scale: pulseAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0.9, 2.2],
                            }),
                          },
                        ],
                      },
                    ]}
                  />
                  <View
                    style={[
                      styles.moreDot,
                      {
                        backgroundColor: '#E1306C',
                        borderColor: colors.surface,
                      },
                    ]}
                  />
                </View>
              )}
            </View>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  createButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -20,
  },
  createButtonInner: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Discovery indicator overlaying the "Plus" icon when there's an
  // unseen feature in the More menu. Bigger + animated pulse so
  // it's actually noticeable in the bottom tab bar.
  moreIndicatorWrap: {
    position: 'absolute',
    top: -5,
    right: -7,
    width: 14,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  morePulseRing: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  moreDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
  },
});
