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
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useNavigation } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Text, Button } from '../../components';
import { useTheme } from '../../theme';
import { useAuth, useProvider, useRevenueCat } from '../../contexts';
import { SUBSCRIPTION_PLANS } from '@booking-app/shared';
import i18n from '../../lib/i18n';
import type { PurchasesPackage } from 'react-native-purchases';

type BillingCycle = 'monthly' | 'annual';

/** Locale for number/currency formatting, following the app language. */
function numberLocale(): string {
  return i18n.language === 'en' ? 'en-GB' : 'fr-FR';
}

/** Amount (in currency units, not cents) → localized currency string. */
function formatCurrency(amount: number, currency = 'EUR'): string {
  return new Intl.NumberFormat(numberLocale(), { style: 'currency', currency }).format(amount);
}

export default function PaywallScreen() {
  const { colors, spacing } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const navigation = useNavigation();
  const canGoBack = navigation.canGoBack();
  const { userData, signOut } = useAuth();
  const { refreshProvider } = useProvider();
  const { currentOffering, purchasePackage, restorePurchases, isReady } = useRevenueCat();

  const [selectedPlan, setSelectedPlan] = useState<'solo' | 'team'>('solo');
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('annual');
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const displayName = userData?.displayName || '';

  // Find a RevenueCat package matching plan + cycle
  const findPackage = (plan: 'solo' | 'team', cycle: BillingCycle): PurchasesPackage | undefined => {
    if (!currentOffering) return undefined;
    return currentOffering.availablePackages.find((p) => {
      const id = p.product.identifier.toLowerCase();
      const planMatch = plan === 'solo' ? id.includes('solo') : id.includes('team');
      const cycleMatch = cycle === 'monthly' ? id.includes('monthly') : id.includes('yearly');
      return planMatch && cycleMatch;
    });
  };

  // Get price string from RevenueCat (App Store price), fallback to hardcoded
  const getPrice = (plan: 'solo' | 'team', cycle: BillingCycle): string => {
    const pkg = findPackage(plan, cycle);
    if (pkg) return pkg.product.priceString;
    // Fallback if offerings not loaded yet
    const cents = plan === 'solo'
      ? (cycle === 'monthly' ? SUBSCRIPTION_PLANS.solo.monthlyPrice : SUBSCRIPTION_PLANS.solo.yearlyPrice)
      : (cycle === 'monthly' ? SUBSCRIPTION_PLANS.team.baseMonthlyPrice : SUBSCRIPTION_PLANS.team.baseYearlyPrice);
    return formatCurrency(cents / 100);
  };

  const getMonthlyEquivalent = (plan: 'solo' | 'team'): string => {
    const pkg = findPackage(plan, 'annual');
    if (pkg) {
      return formatCurrency(pkg.product.price / 12, pkg.product.currencyCode || 'EUR');
    }
    // Fallback
    const yearlyPrice = plan === 'solo' ? SUBSCRIPTION_PLANS.solo.yearlyPrice : SUBSCRIPTION_PLANS.team.baseYearlyPrice;
    return formatCurrency(yearlyPrice / 100 / 12);
  };

  const handlePurchase = async () => {
    if (purchasing) return;

    const pkg = findPackage(selectedPlan, billingCycle);
    if (!pkg) {
      Alert.alert(
        t('paywall.offersUnavailableTitle'),
        t('paywall.offersUnavailableMessage'),
      );
      return;
    }

    setPurchasing(true);
    try {
      const success = await purchasePackage(pkg.identifier);
      if (success) {
        await refreshProvider();
        // Close paywall modal if navigable
        if (canGoBack) router.back();
      }
    } catch (error: any) {
      Alert.alert(
        t('paywall.purchaseErrorTitle'),
        error.message || t('paywall.purchaseErrorMessage')
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
        Alert.alert(t('paywall.restoreSuccessTitle'), t('paywall.restoreSuccessMessage'));
      } else {
        Alert.alert(t('paywall.restoreNoneTitle'), t('paywall.restoreNoneMessage'));
      }
    } catch {
      Alert.alert(t('paywall.purchaseErrorTitle'), t('paywall.restoreErrorMessage'));
    } finally {
      setRestoring(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert(
      t('paywall.signOutTitle'),
      t('paywall.signOutMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('paywall.signOutConfirm'), style: 'destructive', onPress: signOut },
      ],
    );
  };

  const plans = [
    {
      id: 'solo' as const,
      name: SUBSCRIPTION_PLANS.solo.name,
      tagline: t('paywall.soloTagline'),
      icon: 'person-outline',
      features: SUBSCRIPTION_PLANS.solo.features,
    },
    {
      id: 'team' as const,
      name: SUBSCRIPTION_PLANS.team.name,
      tagline: t('paywall.teamTagline'),
      icon: 'people-outline',
      features: SUBSCRIPTION_PLANS.team.features,
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* Close button when opened as modal */}
      {canGoBack && (
        <Pressable
          onPress={() => router.back()}
          style={styles.closeButton}
        >
          <Ionicons name="close" size={24} color={colors.text} />
        </Pressable>
      )}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 20 }]}
      >
        {/* Header */}
        <View style={styles.header}>
          {displayName ? (
            <Text style={[styles.greeting, { color: colors.textSecondary }]}>
              {t('paywall.greeting', { name: displayName })}
            </Text>
          ) : null}
          <Text style={[styles.title, { color: colors.text }]}>
            {t('paywall.title')}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {t('paywall.subtitle')}
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
              {t('paywall.monthly')}
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
              {t('paywall.annual')}
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
                  /{billingCycle === 'monthly' ? t('paywall.perMonth') : t('paywall.perYear')}
                </Text>
                {billingCycle === 'annual' && (
                  <Text style={[styles.monthlyEquivalent, { color: colors.textMuted }]}>
                    {t('paywall.monthlyEquivalent', { price: getMonthlyEquivalent(plan.id) })}
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
          {!isReady ? (
            <View style={styles.loadingOfferings}>
              <ActivityIndicator size="small" color={colors.textMuted} />
              <Text style={[styles.loadingText, { color: colors.textMuted }]}>
                {t('paywall.loadingOffers')}
              </Text>
            </View>
          ) : !currentOffering ? (
            <View style={styles.loadingOfferings}>
              <Ionicons name="warning-outline" size={16} color="#DC2626" />
              <Text style={[styles.loadingText, { color: '#DC2626' }]}>
                {t('paywall.offersLoadError')}
              </Text>
            </View>
          ) : (
            <Button
              title={purchasing
                ? t('paywall.processing')
                : t('paywall.subscribeCta', {
                    price: getPrice(selectedPlan, billingCycle),
                    period: billingCycle === 'monthly' ? t('paywall.perMonth') : t('paywall.perYear'),
                  })}
              onPress={handlePurchase}
              loading={purchasing}
              disabled={purchasing}
              fullWidth
            />
          )}
        </View>

        {/* Legal notice */}
        <Text style={[styles.legalText, { color: colors.textMuted }]}>
          {t('paywall.legalNotice')}
        </Text>

        {/* Legal links */}
        <View style={styles.legalLinks}>
          <Pressable onPress={() => Linking.openURL('https://opatam.com/cgu')}>
            <Text style={[styles.legalLinkText, { color: colors.primary }]}>
              {t('paywall.termsLink')}
            </Text>
          </Pressable>
          <Text style={{ color: colors.textMuted }}>·</Text>
          <Pressable onPress={() => Linking.openURL('https://opatam.com/confidentialite')}>
            <Text style={[styles.legalLinkText, { color: colors.primary }]}>
              {t('paywall.privacyLink')}
            </Text>
          </Pressable>
        </View>

        {/* Footer links */}
        <View style={styles.footer}>
          <Pressable onPress={handleRestore} disabled={restoring} style={styles.footerLink}>
            <Text style={[styles.footerText, { color: colors.primary }]}>
              {restoring ? t('paywall.restoring') : t('paywall.restore')}
            </Text>
          </Pressable>

          <Pressable onPress={handleSignOut} style={styles.footerLink}>
            <Ionicons name="log-out-outline" size={16} color={colors.textSecondary} />
            <Text style={[styles.footerText, { color: colors.textSecondary }]}>
              {t('paywall.signOut')}
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
  closeButton: {
    position: 'absolute',
    top: 8,
    right: 16,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
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
  // Legal
  legalText: {
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
    marginBottom: 12,
  },
  legalLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  legalLinkText: {
    fontSize: 13,
    fontWeight: '500',
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
