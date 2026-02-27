/**
 * WebRedirectModal
 * Blocking screen shown to providers whose subscription has expired.
 * Cannot be dismissed — the only action is to refresh or sign out.
 * Shows a success/congratulation screen after account activation.
 *
 * NOTE: No external payment links — Apple IAP compliance (Guideline 3.1.1).
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from './Text';
import { Button } from './Button';
import { useTheme } from '../theme';
import { useAuth, useProvider } from '../contexts';

interface WebRedirectModalProps {
  visible: boolean;
  onDismiss?: () => void;
}

export function WebRedirectModal({ visible }: WebRedirectModalProps) {
  const { colors } = useTheme();
  const { userData, signOut } = useAuth();
  const { provider, refreshProvider } = useProvider();
  const [refreshing, setRefreshing] = useState(false);
  const [activated, setActivated] = useState(false);
  const didRequestRefresh = useRef(false);
  const scaleAnim = useRef(new Animated.Value(0)).current;

  // Check if subscription is now valid
  const isNowActive = (() => {
    if (!provider) return false;
    const { plan, subscription } = provider;
    if (subscription?.status === 'active') return true;
    if ((plan === 'solo' || plan === 'team') && subscription?.status === 'trialing') return true;
    if (plan === 'trial') {
      const raw = subscription?.validUntil;
      const validDate = raw instanceof Date
        ? raw
        : (raw as any)?.toDate?.()
          || (raw ? new Date(raw as any) : null);
      if (validDate && new Date() <= validDate) return true;
    }
    return false;
  })();

  // Show success ONLY after user clicked refresh AND provider data shows active
  useEffect(() => {
    if (didRequestRefresh.current && isNowActive && !activated && !refreshing) {
      didRequestRefresh.current = false;
      setActivated(true);
      scaleAnim.setValue(0);
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        tension: 80,
        useNativeDriver: true,
      }).start();
    }
  }, [isNowActive, refreshing]);

  if (!visible && !activated) return null;

  const handleRefresh = async () => {
    didRequestRefresh.current = true;
    setRefreshing(true);
    try {
      await refreshProvider();
    } catch {
      // If refresh fails, stay on this screen
      didRequestRefresh.current = false;
    } finally {
      setRefreshing(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch {
      // signOut will redirect via auth flow
    }
  };

  const displayName = userData?.displayName || '';

  // Success / Congratulations screen
  if (activated) {
    return (
      <View style={styles.overlay}>
        <View style={styles.scrollContent}>
          <Animated.View
            style={[
              styles.card,
              { backgroundColor: colors.background, transform: [{ scale: scaleAnim }] },
            ]}
          >
            {/* Success icon */}
            <View style={[styles.successIconContainer, { backgroundColor: '#dcfce7' }]}>
              <Ionicons name="checkmark-circle" size={48} color="#16a34a" />
            </View>

            <Text style={[styles.successTitle, { color: colors.text }]}>
              Compte activé !
            </Text>

            <Text style={[styles.successDescription, { color: colors.textSecondary }]}>
              {displayName ? `Félicitations ${displayName} ! ` : 'Félicitations ! '}
              Votre compte est maintenant actif. Profitez de toutes les fonctionnalités.
            </Text>

            <Button
              title="C'est parti !"
              onPress={() => {
                // Force one more refresh so SubscriptionGate re-evaluates and hides the modal
                setActivated(false);
                refreshProvider();
              }}
              fullWidth
            />
          </Animated.View>
        </View>
      </View>
    );
  }

  // Blocked screen
  return (
    <View style={styles.overlay}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Card */}
        <View style={[styles.card, { backgroundColor: colors.background }]}>
          {/* User greeting */}
          {displayName ? (
            <Text style={[styles.greeting, { color: colors.textSecondary }]}>
              Bonjour, {displayName}
            </Text>
          ) : null}

          {/* Icon */}
          <View style={[styles.iconContainer, { backgroundColor: '#FEF3C7' }]}>
            <Ionicons name="time-outline" size={36} color="#D97706" />
          </View>

          {/* Title */}
          <Text style={[styles.title, { color: colors.text }]}>
            Période d'essai terminée
          </Text>

          {/* Description */}
          <Text style={[styles.description, { color: colors.textSecondary }]}>
            Votre période d'essai est arrivée à son terme. Pour continuer à utiliser Opatam, activez votre compte depuis votre espace web.
          </Text>

          {/* Refresh status */}
          <Button
            title={refreshing ? 'Vérification...' : "J'ai activé mon compte"}
            onPress={handleRefresh}
            loading={refreshing}
            disabled={refreshing}
            fullWidth
          />

          <Text style={[styles.hint, { color: colors.textMuted }]}>
            Vous pourrez revenir sur l'app une fois votre compte activé.
          </Text>

          {/* Sign out */}
          <Pressable onPress={handleSignOut} style={styles.signOutButton}>
            <Ionicons name="log-out-outline" size={18} color={colors.textSecondary} />
            <Text style={[styles.signOutText, { color: colors.textSecondary }]}>
              Se déconnecter
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 24,
    paddingHorizontal: 28,
    paddingTop: 32,
    paddingBottom: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
  },
  greeting: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 20,
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 10,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 24,
  },
  hint: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 16,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 24,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  signOutText: {
    fontSize: 14,
    fontWeight: '500',
  },
  // Success screen
  successIconContainer: {
    width: 88,
    height: 88,
    borderRadius: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
  },
  successDescription: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 28,
  },
});
