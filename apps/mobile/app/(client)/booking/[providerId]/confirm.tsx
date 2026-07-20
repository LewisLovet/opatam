/**
 * Booking Step 3: Confirmation
 * Review booking details and confirm
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Linking,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useStripe } from '@stripe/stripe-react-native';
import { useTheme } from '../../../../theme';
import { Text, Card, Button, EmptyState, Avatar, Input, useToast } from '../../../../components';
import { BookingStepHeader } from '../../../../components/business/BookingStepHeader';
import { useLoyaltyPreview } from '../../../../hooks/useLoyaltyPreview';
import { useBooking } from '../../../../contexts';
import { useAuth } from '../../../../contexts';
import { useLocations } from '../../../../hooks';
import { computeDiscountedTotal } from '@booking-app/shared';
import { bookingService } from '@booking-app/firebase';
import { API_URL } from '../../../../lib/config';
import i18n, { getAppLocale } from '../../../../lib/i18n';

/** App Store / Play Store URLs for the "update" CTA. iOS app id +
 *  Android package come from app.json. The `itms-apps://` /
 *  `market://` schemes open the store app directly when present;
 *  the https:// fallbacks open in-browser when the schemes aren't
 *  registered (e.g. simulator). */
const STORE_URLS = {
  ios: 'itms-apps://apps.apple.com/app/id6759246218',
  iosFallback: 'https://apps.apple.com/app/id6759246218',
  android: 'market://details?id=com.kamerleontech.opatam',
  androidFallback:
    'https://play.google.com/store/apps/details?id=com.kamerleontech.opatam',
} as const;

/**
 * Shows a native dialog inviting the user to update Opatam, with a
 * direct link to the App Store / Play Store. Triggered when the
 * server refuses a booking via 426 + CLIENT_UPGRADE_REQUIRED.
 */
function showAppUpgradeDialog(message: string): void {
  Alert.alert(i18n.t('bookingFlow.confirm.upgrade.title'), message, [
    { text: i18n.t('bookingFlow.confirm.upgrade.later'), style: 'cancel' },
    {
      text: i18n.t('bookingFlow.confirm.upgrade.update'),
      style: 'default',
      onPress: async () => {
        const primary = Platform.OS === 'ios' ? STORE_URLS.ios : STORE_URLS.android;
        const fallback =
          Platform.OS === 'ios'
            ? STORE_URLS.iosFallback
            : STORE_URLS.androidFallback;
        try {
          const canOpen = await Linking.canOpenURL(primary);
          await Linking.openURL(canOpen ? primary : fallback);
        } catch {
          // Final fallback — if even the https URL fails, drop the
          // user on the web home page rather than crashing.
          Linking.openURL('https://opatam.com').catch(() => {});
        }
      },
    },
  ]);
}

/**
 * Révélation fidélité : POST /api/bookings ne renvoie que { bookingId } —
 * pas la résa. La réduction fidélité éventuellement appliquée (snapshot
 * booking.loyalty, posé côté serveur) se lit donc sur le doc créé, que le
 * client peut lire (clientId stampé avant la réponse). Timeout court +
 * best-effort : la fidélité ne doit jamais retarder ni casser le succès.
 * Retourne la mention à accoler au toast de succès, ou null.
 */
async function getLoyaltyAppliedMessage(bookingId: string): Promise<string | null> {
  try {
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500));
    const loyalty = await Promise.race([
      bookingService.getById(bookingId).then((b) => b?.loyalty ?? null),
      timeout,
    ]);
    if (!loyalty || !loyalty.amountOff) return null;
    const euros = loyalty.amountOff / 100;
    const amount = Number.isInteger(euros) ? String(euros) : euros.toFixed(2);
    return i18n.t('bookingFlow.confirm.loyaltyApplied', { amount });
  } catch {
    return null;
  }
}

// Format date in the app's current language
function formatDate(date: Date): string {
  const locale = i18n.language === 'en' ? 'en-GB' : 'fr-FR';
  const formatted = date.toLocaleDateString(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  // Match the previous rendering ("Dimanche 12 juillet 2026") — capitalized.
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

// Format time — "14h30" in French, "14:30" in English
function formatTime(timeStr: string): string {
  return i18n.language === 'en' ? timeStr : timeStr.replace(':', 'h');
}

export default function ConfirmBookingScreen() {
  const { colors, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { showToast } = useToast();
  const { t } = useTranslation();
  const { providerId } = useLocalSearchParams<{ providerId: string }>();

  // Auth context
  const { user, userData, isAuthenticated } = useAuth();

  // Booking context
  const {
    provider,
    service,
    member,
    memberId,
    locationId,
    selections,
    selectedDate,
    selectedSlot,
    cart,
    isReady,
    resetBooking,
  } = useBooking();

  // Shop-wide promo applied to services without their own discount.
  const globalDiscount = provider?.settings?.globalDiscount ?? null;

  // Whole-visit totals across the cart (discount applied).
  const cartPriceBase = cart.reduce(
    (sum, c) => sum + computeDiscountedTotal(c.service, c.selections, globalDiscount).price,
    0,
  );
  // Réduction fidélité armée : le récap doit afficher le prix qui sera
  // réellement facturé (même calcul que le serveur — useLoyaltyPreview).
  const loyaltyPreview = useLoyaltyPreview(provider, cart, globalDiscount, t);
  const cartPrice = cartPriceBase - loyaltyPreview.amountOff;
  const cartOriginal = cart.reduce(
    (sum, c) => sum + computeDiscountedTotal(c.service, c.selections, globalDiscount).original,
    0,
  );
  const cartDuration = cart.reduce(
    (sum, c) => sum + computeDiscountedTotal(c.service, c.selections, globalDiscount).duration,
    0,
  );
  const cartHasPromo = cartOriginal > cartPrice;
  const isMulti = cart.length > 1;

  // Get locations to display location info
  const { locations } = useLocations(providerId);
  const location = locations.find((l) => l.id === locationId);

  // Phone state — pre-fill from profile if available
  const [phone, setPhone] = useState(userData?.phone || '');

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Stripe PaymentSheet — used when the booked service requires a deposit
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  // Phone validation
  const isPhoneValid = (() => {
    const cleaned = phone.replace(/[\s.\-()]/g, '');
    if (!/^(\+)?[0-9]+$/.test(cleaned)) return false;
    const digitCount = cleaned.replace(/\D/g, '').length;
    return digitCount >= 8 && digitCount <= 15;
  })();

  // Handle booking confirmation
  const handleConfirm = async () => {
    if (!isReady || !selectedSlot || !provider || !service) {
      showToast({
        variant: 'error',
        message: t('bookingFlow.confirm.incompleteInfo'),
      });
      return;
    }

    // Check if user is authenticated. Require user.uid explicitly:
    // useClientBookings queries by clientId == user.uid, so a booking
    // saved with a null clientId would never appear in "Mes rendez-vous".
    if (!isAuthenticated || !userData || !user?.uid) {
      showToast({
        variant: 'warning',
        message: t('bookingFlow.confirm.loginToBook'),
      });
      router.push('/(auth)/login');
      return;
    }
    const clientUid = user.uid;

    // Validate phone
    if (!phone.trim() || !isPhoneValid) {
      showToast({
        variant: 'error',
        message: t('bookingFlow.confirm.invalidPhoneToast'),
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const cleanedPhone = phone.replace(/\s/g, '');

      // Route through /api/bookings (source:'mobile') so the deposit flow
      // is honored: server creates the booking, computes the deposit, and
      // returns either { bookingId } (no deposit) or {bookingId,
      // requiresPayment, paymentIntent, ephemeralKey, customer} (deposit).
      // `clientCapabilities` advertises which client-side flows this
      // build can drive — server uses it to refuse deposit-required
      // bookings on legacy mobile builds (which would otherwise leave
      // the doc in pending_payment forever). Add new entries here when
      // shipping new payment flows (apple-pay, paypal, etc.).
      // Identité VÉRIFIÉE côté serveur (audit P1.1) : le token Firebase
      // prouve l'uid — la fidélité (cumul + consommation) n'accepte que ça.
      const idToken = await user.getIdToken();
      const res = await fetch(`${API_URL}/api/bookings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          providerId: provider.id,
          serviceId: service.id,
          // Multi-prestation visit: the server recomputes durations/prices and
          // aggregates. serviceId (first) kept for back-compat.
          items: cart.map((c) => ({ serviceId: c.service.id, selections: c.selections })),
          locationId: locationId!,
          memberId: memberId || undefined,
          datetime: selectedSlot.datetime,
          clientId: clientUid,
          clientInfo: {
            name: userData.displayName || 'Client',
            email: userData.email,
            phone: cleanedPhone,
          },
          source: 'mobile',
          // Langue de l'app au moment de la résa — snapshotée en
          // booking.clientLocale côté serveur, pilote les 6 emails client.
          clientLocale: getAppLocale(),
          clientCapabilities: ['deposit'],
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        // 426 + CLIENT_UPGRADE_REQUIRED → server refused because this
        // build is too old for the booking flow this service needs.
        // Surface a dedicated dialog with a deep link to the store
        // instead of a plain error toast — gives the user something
        // actionable. Should not fire on the current build (we
        // advertise 'deposit' above) but the handler is forward-safe
        // for future capabilities the server may add to its allowlist.
        if (data?.code === 'CLIENT_UPGRADE_REQUIRED') {
          showAppUpgradeDialog(
            data.error || t('bookingFlow.confirm.upgrade.defaultMessage'),
          );
          setIsSubmitting(false);
          return;
        }
        throw new Error(data.error || t('bookingFlow.confirm.bookingError'));
      }

      if (data.requiresPayment && data.paymentIntent) {
        // Deposit flow: present PaymentSheet on the connected account.
        // The booking is reserved as `pending_payment` server-side; the
        // checkout.session-equivalent webhook (`payment_intent.succeeded`
        // through `charge.refunded` listening on Connect events) will
        // flip it to `confirmed`. If the user cancels here, the cron
        // will purge the booking after 30 min.
        // No `stripeAccountId` needed — the API uses Destination charges,
        // so the PaymentIntent is on the platform. Funds get routed to
        // the pro's connected account via `transfer_data` automatically.
        const init = await initPaymentSheet({
          merchantDisplayName: provider.businessName ?? 'Opatam',
          paymentIntentClientSecret: data.paymentIntent,
          customerId: data.customer,
          customerEphemeralKeySecret: data.ephemeralKey,
          allowsDelayedPaymentMethods: false,
          applePay: { merchantCountryCode: 'FR' },
          googlePay: { merchantCountryCode: 'FR', currencyCode: 'EUR' },
          returnURL: 'opatam://stripe-redirect',
          defaultBillingDetails: {
            email: userData.email,
            name: userData.displayName ?? undefined,
            phone: cleanedPhone,
          },
        });
        if (init.error) throw new Error(init.error.message);

        // Loop while the user keeps retrying the PaymentSheet. We re-use
        // the same PaymentIntent — Stripe accepts multiple presentation
        // attempts on a single intent until it succeeds or is cancelled.
        // On final cancel, we abandon the booking server-side so the
        // slot is freed immediately (no 30 min cron wait).
        while (true) {
          const { error: payError } = await presentPaymentSheet();
          if (!payError) break; // success → fall through to confirmation

          if (payError.code !== 'Canceled') {
            // Hard payment error (card declined, network, etc.). Surface
            // it and stay on the screen so the user can act. The booking
            // stays as pending_payment; cron will purge if needed.
            showToast({
              variant: 'error',
              message: payError.message || t('bookingFlow.confirm.paymentFailed'),
            });
            return;
          }

          // User dismissed the sheet. Ask whether they want to retry or
          // abandon — without this the slot stays locked for 30 min.
          const choice = await new Promise<'retry' | 'abandon'>((resolve) => {
            Alert.alert(
              t('bookingFlow.confirm.paymentCancelled.title'),
              t('bookingFlow.confirm.paymentCancelled.message'),
              [
                {
                  text: t('bookingFlow.confirm.paymentCancelled.abandon'),
                  style: 'destructive',
                  onPress: () => resolve('abandon'),
                },
                {
                  text: t('common.retry'),
                  style: 'default',
                  onPress: () => resolve('retry'),
                },
              ],
              { cancelable: false },
            );
          });

          if (choice === 'retry') continue; // re-present the sheet

          // Abandon → free the slot now. We need to actually verify the
          // server confirmed the deletion before telling the user the
          // slot is free, otherwise they hit "créneau indisponible" on
          // retry while the booking still exists.
          let abandoned = false;
          try {
            const abRes = await fetch(`${API_URL}/api/bookings/abandon`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                bookingId: data.bookingId,
                clientId: clientUid,
              }),
            });
            const abData = await abRes.json().catch(() => ({}));
            if (abRes.ok && abData.abandoned) {
              abandoned = true;
            } else {
              console.warn('Abandon failed:', abRes.status, abData);
            }
          } catch (err) {
            console.warn('Abandon call failed:', err);
          }

          // Wipe the booking flow state, then unwind the entire
          // booking stack and bounce back to the provider page. The
          // previous version replaced only the *current* screen
          // with the booking flow's start — the inner Stack still
          // had `index → date → confirm` underneath, so the user
          // had to mash back 3-5 times to actually leave. Abandoning
          // a booking means the user wants out of the flow, full stop.
          resetBooking();
          showToast({
            variant: abandoned ? 'info' : 'error',
            message: abandoned
              ? t('bookingFlow.confirm.abandonSuccess')
              : t('bookingFlow.confirm.abandonPending'),
          });
          // dismissAll pops every screen in the booking inner Stack
          // back to its root so React Navigation drops the cached
          // intermediate routes. The replace then takes us out to
          // the provider page — landing somewhere actionable rather
          // than back at booking/index where the user could retap
          // straight into the same flow they just abandoned.
          if (typeof router.dismissAll === 'function') {
            try { router.dismissAll(); } catch { /* nothing to dismiss */ }
          }
          if (provider?.slug) {
            router.replace(`/(client)/provider/${provider.slug}` as any);
          } else {
            router.replace('/(client)/(tabs)');
          }
          return;
        }

        // Payment succeeded — webhook will flip status to confirmed.
        // The bookings tab will pick it up on next refresh.
        const loyaltyMsgDeposit = await getLoyaltyAppliedMessage(data.bookingId);
        resetBooking();
        showToast({
          variant: 'success',
          message: loyaltyMsgDeposit
            ? `${t('bookingFlow.confirm.depositPaidSuccess')} ${loyaltyMsgDeposit}`
            : t('bookingFlow.confirm.depositPaidSuccess'),
        });
        router.replace('/(client)/(tabs)/bookings');
        return;
      }

      // No deposit → booking is already confirmed (or pending pro
      // confirmation depending on provider settings).
      const loyaltyMsg = await getLoyaltyAppliedMessage(data.bookingId);
      resetBooking();
      showToast({
        variant: 'success',
        message: loyaltyMsg
          ? `${t('bookingFlow.confirm.bookingConfirmed')} ${loyaltyMsg}`
          : t('bookingFlow.confirm.bookingConfirmed'),
      });
      router.replace('/(client)/(tabs)/bookings');
    } catch (error: any) {
      console.error('Booking error:', error);
      showToast({
        variant: 'error',
        message: error.message || t('bookingFlow.confirm.bookingError'),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Redirect if booking not ready
  if (!isReady || !selectedSlot || !selectedDate || !provider || !service) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <BookingStepHeader title={t('bookingFlow.confirm.title')} onBack={() => router.back()} />
        <View style={styles.errorContainer}>
          <EmptyState
            icon="alert-circle-outline"
            title={t('bookingFlow.errorTitle')}
            description={t('bookingFlow.confirm.incompleteInfo')}
            actionLabel={t('common.back')}
            onAction={() => router.back()}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <BookingStepHeader title={t('bookingFlow.confirm.title')} onBack={() => router.back()} />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingHorizontal: spacing.lg, paddingBottom: insets.bottom + 120 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Success icon */}
        <View style={[styles.successIcon, { marginTop: spacing.xl }]}>
          <View style={[styles.iconCircle, { backgroundColor: colors.primaryLight || '#e4effa' }]}>
            <Ionicons name="calendar-outline" size={40} color={colors.primary} />
          </View>
        </View>

        <Text variant="h2" align="center" style={{ marginTop: spacing.lg }}>
          {t('bookingFlow.confirm.reviewTitle')}
        </Text>
        <Text variant="body" color="textSecondary" align="center" style={{ marginTop: spacing.sm }}>
          {t('bookingFlow.confirm.reviewSubtitle')}
        </Text>

        {/* Booking details */}
        <Card padding="lg" shadow="sm" style={{ marginTop: spacing.xl }}>
          {/* Service */}
          <View style={styles.detailRow}>
            <View style={[styles.detailIcon, { backgroundColor: colors.primaryLight || '#e4effa' }]}>
              <Ionicons name="pricetag-outline" size={20} color={colors.primary} />
            </View>
            <View style={styles.detailContent}>
              <Text variant="caption" color="textSecondary">{t('bookingFlow.confirm.serviceLabel', { count: cart.length })}</Text>
              {isMulti ? (
                <>
                  {cart.map((c, idx) => {
                    const e = computeDiscountedTotal(c.service, c.selections, globalDiscount);
                    const ePromo = e.discountPercent != null && e.original > e.price;
                    return (
                      <View key={idx} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm, marginTop: idx ? 2 : 0 }}>
                        <Text variant="body" style={{ fontWeight: '600', flex: 1 }} numberOfLines={1}>
                          {idx + 1}. {c.service.name}
                        </Text>
                        <Text variant="caption" color="textSecondary">
                          {e.duration} min ·{' '}
                          {ePromo ? (
                            <Text variant="caption">
                              <Text variant="caption" style={{ textDecorationLine: 'line-through', color: colors.textMuted }}>
                                {(e.original / 100).toFixed(2)} €
                              </Text>
                              <Text variant="caption" style={{ color: '#E11D48', fontWeight: '600' }}>
                                {'  '}{(e.price / 100).toFixed(2)} €
                              </Text>
                            </Text>
                          ) : (
                            `${(e.price / 100).toFixed(2)} €`
                          )}
                        </Text>
                      </View>
                    );
                  })}
                </>
              ) : (
                <>
                  <Text variant="body" style={{ fontWeight: '600' }}>{service.name}</Text>
                  <Text variant="caption" color="textSecondary">
                    {cartDuration} min -{' '}
                    {cartHasPromo ? (
                      <Text variant="caption">
                        <Text variant="caption" style={{ textDecorationLine: 'line-through', color: colors.textMuted }}>
                          {(cartOriginal / 100).toFixed(2)} €
                        </Text>
                        <Text variant="caption" style={{ color: '#E11D48', fontWeight: '600' }}>
                          {'  '}{(cartPrice / 100).toFixed(2)} €
                        </Text>
                      </Text>
                    ) : (
                      `${(cartPrice / 100).toFixed(2)} €`
                    )}
                  </Text>
                </>
              )}
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Date & Time */}
          <View style={styles.detailRow}>
            <View style={[styles.detailIcon, { backgroundColor: colors.primaryLight || '#e4effa' }]}>
              <Ionicons name="calendar-outline" size={20} color={colors.primary} />
            </View>
            <View style={styles.detailContent}>
              <Text variant="caption" color="textSecondary">{t('bookingFlow.confirm.dateTime')}</Text>
              <Text variant="body" style={{ fontWeight: '600' }}>{formatDate(selectedDate)}</Text>
              <Text variant="caption" color="textSecondary">
                {formatTime(selectedSlot.start)} - {formatTime(selectedSlot.end)}
              </Text>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Member */}
          {member && (
            <>
              <View style={styles.detailRow}>
                <View style={[styles.detailIcon, { backgroundColor: colors.primaryLight || '#e4effa' }]}>
                  <Ionicons name="person-outline" size={20} color={colors.primary} />
                </View>
                <View style={styles.detailContent}>
                  <Text variant="caption" color="textSecondary">{t('bookingFlow.confirm.with')}</Text>
                  <Text variant="body" style={{ fontWeight: '600' }}>{member.name}</Text>
                </View>
              </View>

              <View style={[styles.divider, { backgroundColor: colors.border }]} />
            </>
          )}

          {/* Location */}
          {location && (
            <View style={styles.detailRow}>
              <View style={[styles.detailIcon, { backgroundColor: colors.primaryLight || '#e4effa' }]}>
                <Ionicons name="location-outline" size={20} color={colors.primary} />
              </View>
              <View style={styles.detailContent}>
                <Text variant="caption" color="textSecondary">{t('bookingFlow.confirm.location')}</Text>
                <Text variant="body" style={{ fontWeight: '600' }}>{location.name}</Text>
                {location.protectAddress ? (
                  <>
                    <Text variant="caption" color="textSecondary">
                      {location.approxArea?.trim() || `${location.postalCode} ${location.city}`}
                    </Text>
                    <Text variant="caption" color="textSecondary" style={{ marginTop: 2 }}>
                      {t('bookingFlow.confirm.addressAfterConfirmation')}
                    </Text>
                  </>
                ) : (
                  <Pressable
                    onPress={() => {
                      const fullAddress = location.address?.trim()
                        ? `${location.address}, ${location.postalCode} ${location.city}`
                        : `${location.postalCode} ${location.city}`;
                      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`);
                    }}
                    style={({ pressed }) => [pressed && { opacity: 0.7 }]}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text variant="caption" color="primary">
                        {location.address?.trim()
                          ? `${location.address}, ${location.postalCode} ${location.city}`
                          : `${location.postalCode} ${location.city}`}
                      </Text>
                      <Ionicons name="open-outline" size={12} color={colors.primary} style={{ marginLeft: 4 }} />
                    </View>
                  </Pressable>
                )}
              </View>
            </View>
          )}
        </Card>

        {/* Phone field */}
        <Card padding="lg" shadow="sm" style={{ marginTop: spacing.lg }}>
          <Text variant="label" color="textSecondary" style={{ marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            {t('bookingFlow.confirm.contactDetails')}
          </Text>
          <Input
            label={t('bookingFlow.confirm.phoneLabel')}
            placeholder={t('bookingFlow.confirm.phonePlaceholder')}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            autoComplete="tel"
            error={phone.length > 0 && !isPhoneValid ? t('bookingFlow.confirm.invalidPhone') : undefined}
          />
        </Card>

        {/* Provider info */}
        <Card padding="md" shadow="sm" style={{ marginTop: spacing.lg }}>
          <View style={styles.providerRow}>
            <Avatar
              size="lg"
              name={provider.businessName}
              imageUrl={provider.photoURL}
              style={{ marginRight: 12 }}
            />
            <View style={{ flex: 1 }}>
              <Text variant="body" style={{ fontWeight: '600' }}>{provider.businessName}</Text>
              <Text variant="caption" color="textSecondary">{provider.category}</Text>
            </View>
          </View>
        </Card>

        {/* Price summary */}
        <Card padding="lg" shadow="sm" style={{ marginTop: spacing.lg }}>
          <View style={styles.priceRow}>
            <Text variant="body">{t('bookingFlow.total')}</Text>
            <View style={{ alignItems: 'flex-end' }}>
              {cartHasPromo && (
                <Text
                  variant="bodySmall"
                  style={{ textDecorationLine: 'line-through', color: colors.textMuted }}
                >
                  {(cartOriginal / 100).toFixed(2)} €
                </Text>
              )}
              <Text variant="h2" style={{ color: cartHasPromo ? '#E11D48' : colors.primary }}>
                {cartPrice === 0 ? t('common.free') : `${(cartPrice / 100).toFixed(2)} €`}
              </Text>
            </View>
          </View>
          {cartHasPromo && (
            <Text variant="caption" style={{ color: '#E11D48', fontWeight: '600', marginTop: spacing.xs }}>
              {t('bookingFlow.confirm.youSave', { amount: ((cartOriginal - cartPrice) / 100).toFixed(2) })}
            </Text>
          )}
          {loyaltyPreview.rewardLabel && (
            <Text variant="caption" style={{ color: colors.primary, fontWeight: '600', marginTop: spacing.xs }}>
              {t('bookingFlow.confirm.loyaltyLine', { reward: loyaltyPreview.rewardLabel })}
            </Text>
          )}
          <Text variant="caption" color="textSecondary" style={{ marginTop: spacing.xs }}>
            {t('bookingFlow.confirm.payOnSite')}
          </Text>
        </Card>

        {/* Login prompt if not authenticated */}
        {!isAuthenticated && (
          <Card padding="lg" shadow="sm" style={{ marginTop: spacing.lg, backgroundColor: colors.warning + '15' }}>
            <View style={styles.loginPrompt}>
              <Ionicons name="information-circle-outline" size={24} color={colors.warning} />
              <View style={{ flex: 1, marginLeft: spacing.sm }}>
                <Text variant="body" style={{ fontWeight: '600' }}>{t('bookingFlow.confirm.loginRequired')}</Text>
                <Text variant="caption" color="textSecondary">
                  {t('bookingFlow.confirm.loginRequiredDescription')}
                </Text>
              </View>
            </View>
          </Card>
        )}
      </ScrollView>

      {/* Confirm button */}
      <View
        style={[
          styles.footer,
          {
            paddingHorizontal: spacing.lg,
            paddingBottom: insets.bottom + spacing.md,
            backgroundColor: colors.background,
            borderTopColor: colors.border,
          },
        ]}
      >
        <Button
          variant="primary"
          title={isAuthenticated ? t('bookingFlow.confirm.confirmButton') : t('bookingFlow.confirm.loginButton')}
          onPress={handleConfirm}
          loading={isSubmitting}
          disabled={isSubmitting || (isAuthenticated && !isPhoneValid)}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 44,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  scrollContent: {
    flexGrow: 1,
  },
  successIcon: {
    alignItems: 'center',
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  detailIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  detailContent: {
    flex: 1,
  },
  divider: {
    height: 1,
    marginVertical: 16,
    marginLeft: 52,
  },
  providerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  loginPrompt: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: 16,
    borderTopWidth: 1,
  },
});
