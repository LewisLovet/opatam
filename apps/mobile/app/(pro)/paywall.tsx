/**
 * Paywall Screen
 * Shows Solo and Team subscription plans with native IAP purchase buttons.
 * Displayed when the provider's trial has expired and no active subscription.
 * Includes restore purchases and sign-out options.
 */

import React, { useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text, Button } from '../../components';
import { useTheme } from '../../theme';
import { useAuth, useProvider, useRevenueCat } from '../../contexts';
import { SUBSCRIPTION_PLANS } from '@booking-app/shared';

type BillingCycle = 'monthly' | 'annual';

// Map RevenueCat package identifiers to display info
const PACKAGE_MAP = {
  monthly: {
    solo: '$rc_monthly', // RevenueCat standard identifier for monthly
    team: '$rc_monthly',
  },
  annual: {
    solo: '$rc_annual', // RevenueCat standard identifier for annual
    team: '$rc_annual',
  },
} as const;

export default function PaywallScreen() {
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const { userData, signOut } = useAuth();
  const { refreshProvider } = useProvider();
  const { currentOffering, purchasePackage, restorePurchases, isReady } = useRevenueCat();

  const [selectedPlan, setSelectedPlan] = useState<'solo' | 'team'>('solo');
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('annual');
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const displayName = userData?.displayName || '';

  // Get prices from RevenueCat offerings or fall back to constants
  const getPrice = (plan: 'solo' | 'team', cycle: BillingCycle): string => {
    if (!currentOffering) {
      // Fallback to constants
      if (plan === 'solo') {
        return cycle === 'monthly'
          ? `${(SUBSCRIPTION_PLANS.solo.monthlyPrice / 100).toFixed(2).replace('.', ',')} €`
          : `${(SUBSCRIPTION_PLANS.solo.yearlyPrice / 100).toFixed(2).replace('.', ',')} €`;
      }
      return cycle === 'monthly'
        ? `${(SUBSCRIPTION_PLANS.team.baseMonthlyPrice / 100).toFixed(2).replace('.', ',')} €`
        : `${(SUBSCRIPTION_PLANS.team.baseYearlyPrice / 100).toFixed(2).replace('.', ',')} €`;
    }

    // Try to find the package in offerings
    const pkg = currentOffering.availablePackages.find((p) => {
      const id = p.product.identifier.toLowerCase();
      const planMatch = plan === 'solo' ? id.includes('solo') : id.includes('team');
      const cycleMatch = cycle === 'monthly' ? id.includes('monthly') : id.includes('yearly');
      return planMatch && cycleMatch;
    });

    if (pkg) {
      return pkg.product.priceString;
    }

    // Final fallback
    return '—';
  };

  const getMonthlyEquivalent = (plan: 'solo' | 'team'): string => {
    if (plan === 'solo') {
      return `${(SUBSCRIPTION_PLANS.solo.yearlyPrice / 100 / 12).toFixed(2).replace('.', ',')} €/mois`;
    }
    return `${(SUBSCRIPTION_PLANS.team.baseYearlyPrice / 100 / 12).toFixed(2).replace('.', ',')} €/mois`;
  };

  const handlePurchase = async () => {
    if (!currentOffering || purchasing) return;

    // Find the right package by product identifier
    const pkg = currentOffering.availablePackages.find((p) => {
      const id = p.product.identifier.toLowerCase();
      const planMatch = selectedPlan === 'solo' ? id.includes('solo') : id.includes('team');
      const cycleMatch = billingCycle === 'monthly' ? id.includes('monthly') : id.includes('yearly');
      return planMatch && cycleMatch;
    });

    if (!pkg) {
      Alert.alert('Erreur', 'Offre non disponible. Veuillez réessayer.');
      return;
    }

    setPurchasing(true);
    try {
      const success = await purchasePackage(pkg.identifier);
      if (success) {
        // Refresh provider data so the subscription gate opens
        await refreshProvider();
      }
    } catch (error: any) {
      Alert.alert(
        'Erreur',
        error.message || "Une erreur est survenue lors de l'achat."
      );
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    if (restoring) return;
    setRestoring(true);
    try {
      const success = await restorePurchases();
      if (success) {
        await refreshProvider();
        Alert.alert('Succès', 'Votre abonnement a été restauré.');
      } else {
        Alert.alert('Aucun abonnement', "Aucun abonnement actif n'a été trouvé.");
      }
    } catch {
      Alert.alert('Erreur', 'Impossible de restaurer les achats.');
    } finally {
      setRestoring(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert(
      'Déconnexion',
      'Êtes-vous sûr de vouloir vous déconnecter ?',
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Déconnecter', style: 'destructive', onPress: signOut },
      ],
    );
  };

  const plans = [
    {
      id: 'solo' as const,
      name: SUBSCRIPTION_PLANS.solo.name,
      tagline: 'Pour les indépendants',
      icon: 'person-outline',
      features: SUBSCRIPTION_PLANS.solo.features,
    },
    {
      id: 'team' as const,
      name: SUBSCRIPTION_PLANS.team.name,
      tagline: 'Pour les équipes',
      icon: 'people-outline',
      features: SUBSCRIPTION_PLANS.team.features,
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 20 }]}
      >
        {/* Header */}
        <View style={styles.header}>
          {displayName ? (
            <Text style={[styles.greeting, { color: colors.textSecondary }]}>
              Bonjour, {displayName}
            </Text>
          ) : null}
          <Text style={[styles.title, { color: colors.text }]}>
            Activez votre compte
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Votre période d'essai est terminée.{'\n'}Choisissez votre formule pour continuer.
          </Text>
        </View>

        {/* Billing Cycle Toggle */}
        <View style={[styles.cycleToggle, { backgroundColor: colors.surfaceSecondary }]}>
          <Pressable
            onPress={() => setBillingCycle('monthly')}
            style={[
              styles.cycleButton,
              billingCycle === 'monthly' && { backgroundColor: colors.background },
              billingCycle === 'monthly' && styles.cycleButtonActive,
            ]}
          >
            <Text style={[
              styles.cycleText,
              { color: billingCycle === 'monthly' ? colors.text : colors.textSecondary },
              billingCycle === 'monthly' && { fontWeight: '600' },
            ]}>
              Mensuel
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setBillingCycle('annual')}
            style={[
              styles.cycleButton,
              billingCycle === 'annual' && { backgroundColor: colors.background },
              billingCycle === 'annual' && styles.cycleButtonActive,
            ]}
          >
            <Text style={[
              styles.cycleText,
              { color: billingCycle === 'annual' ? colors.text : colors.textSecondary },
              billingCycle === 'annual' && { fontWeight: '600' },
            ]}>
              Annuel
            </Text>
            <View style={styles.savingsBadge}>
              <Text style={styles.savingsText}>-17%</Text>
            </View>
          </Pressable>
        </View>

        {/* Plan Cards */}
        {plans.map((plan) => {
          const isSelected = selectedPlan === plan.id;
          const price = getPrice(plan.id, billingCycle);

          return (
            <Pressable
              key={plan.id}
              onPress={() => setSelectedPlan(plan.id)}
              style={[
                styles.planCard,
                {
                  backgroundColor: colors.background,
                  borderColor: isSelected ? colors.primary : colors.border,
                  borderWidth: isSelected ? 2 : 1,
                },
              ]}
            >
              {/* Plan header */}
              <View style={styles.planHeader}>
                <View style={[styles.planIcon, { backgroundColor: isSelected ? colors.primary + '15' : colors.surfaceSecondary }]}>
                  <Ionicons name={plan.icon as any} size={22} color={isSelected ? colors.primary : colors.textSecondary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.planName, { color: colors.text }]}>{plan.name}</Text>
                  <Text style={[styles.planTagline, { color: colors.textSecondary }]}>{plan.tagline}</Text>
                </View>
                <View style={[styles.radio, { borderColor: isSelected ? colors.primary : colors.border }]}>
                  {isSelected && <View style={[styles.radioInner, { backgroundColor: colors.primary }]} />}
                </View>
              </View>

              {/* Price */}
              <View style={styles.priceRow}>
                <Text style={[styles.price, { color: colors.text }]}>{price}</Text>
                <Text style={[styles.pricePeriod, { color: colors.textSecondary }]}>
                  /{billingCycle === 'monthly' ? 'mois' : 'an'}
                </Text>
                {billingCycle === 'annual' && (
                  <Text style={[styles.monthlyEquivalent, { color: colors.textMuted }]}>
                    soit {getMonthlyEquivalent(plan.id)}
                  </Text>
                )}
              </View>

              {/* Features */}
              {isSelected && (
                <View style={styles.features}>
                  {plan.features.map((feature, i) => (
                    <View key={i} style={styles.featureRow}>
                      <Ionicons name="checkmark-circle" size={18} color="#16A34A" />
                      <Text style={[styles.featureText, { color: colors.text }]}>{feature}</Text>
                    </View>
                  ))}
                </View>
              )}
            </Pressable>
          );
        })}

        {/* Purchase Button */}
        <View style={styles.purchaseSection}>
          <Button
            title={purchasing ? 'Traitement en cours...' : `S'abonner — ${getPrice(selectedPlan, billingCycle)}/${billingCycle === 'monthly' ? 'mois' : 'an'}`}
            onPress={handlePurchase}
            loading={purchasing}
            disabled={purchasing || !isReady}
            fullWidth
          />

          {!isReady && (
            <View style={styles.loadingOfferings}>
              <ActivityIndicator size="small" color={colors.textMuted} />
              <Text style={[styles.loadingText, { color: colors.textMuted }]}>
                Chargement des offres...
              </Text>
            </View>
          )}
        </View>

        {/* Footer links */}
        <View style={styles.footer}>
          <Pressable onPress={handleRestore} disabled={restoring} style={styles.footerLink}>
            <Text style={[styles.footerText, { color: colors.primary }]}>
              {restoring ? 'Restauration...' : 'Restaurer mes achats'}
            </Text>
          </Pressable>

          <Pressable onPress={handleSignOut} style={styles.footerLink}>
            <Ionicons name="log-out-outline" size={16} color={colors.textSecondary} />
            <Text style={[styles.footerText, { color: colors.textSecondary }]}>
              Se déconnecter
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  greeting: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  // Billing cycle toggle
  cycleToggle: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  cycleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  cycleButtonActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  cycleText: {
    fontSize: 14,
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
  // Plan cards
  planCard: {
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  planIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planName: {
    fontSize: 18,
    fontWeight: '700',
  },
  planTagline: {
    fontSize: 13,
    marginTop: 1,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  // Price
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 14,
    paddingLeft: 56, // align with text after icon
    flexWrap: 'wrap',
    gap: 4,
  },
  price: {
    fontSize: 24,
    fontWeight: '700',
  },
  pricePeriod: {
    fontSize: 15,
  },
  monthlyEquivalent: {
    fontSize: 12,
    width: '100%',
  },
  // Features
  features: {
    marginTop: 16,
    paddingLeft: 56,
    gap: 10,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  featureText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  // Purchase section
  purchaseSection: {
    marginTop: 8,
    marginBottom: 16,
  },
  loadingOfferings: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
  },
  loadingText: {
    fontSize: 13,
  },
  // Footer
  footer: {
    alignItems: 'center',
    gap: 16,
    paddingBottom: 20,
  },
  footerLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
  },
  footerText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
