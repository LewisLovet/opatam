/**
 * ServiceCard Component
 * Displays a service with name, description, duration and price
 * Design: colored left border, prominent name, price badge, duration with icon
 */

import React, { useState } from 'react';
import { View, StyleSheet, Pressable, Image, Modal, Dimensions } from 'react-native';
import type { NativeSyntheticEvent, TextLayoutEventData } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { formatDiscountBadge } from '@booking-app/shared';
import { useTheme } from '../../../theme';
import { Text } from '../../Text';

export interface ServiceCardProps {
  /** Service name */
  name: string;
  /** Service description */
  description?: string | null;
  /** Photo URL */
  photoURL?: string | null;
  /** Duration in minutes */
  duration: number;
  /** Price in euros */
  price: number;
  /** Price max in euros (null = fixed price) */
  priceMax?: number | null;
  /** Pre-discount price in euros — when set and > price, shows a crossed-out
   *  original + a "−X%" badge (active promotion). */
  originalPrice?: number | null;
  /** Active promo percentage (for the "−X%" badge). */
  discountPercent?: number | null;
  /** Montant fixe de la promo en CENTIMES (pastille « −10 € »). Exclusif
   *  avec `discountPercent`. */
  discountAmount?: number | null;
  /** `false` = visible mais non réservable : carte grisée, pastille. */
  isAvailable?: boolean;
  /** Jours réservables (0 = dimanche). Vide = tous les jours. */
  availableDays?: number[];
  /** Motif codé, traduit dans la langue de la cliente. */
  unavailableReason?: string | null;
  /** Texte libre, uniquement pour le motif « autre » (non traduit). */
  unavailableNote?: string | null;
  /** Pre-formatted urgency line ("Plus que N jours"); null = hide. */
  promoCountdown?: string | null;
  /** When the price is a "from" (service has variations/options), show the
   *  "À partir de" hint above it. */
  priceFrom?: boolean;
  /** Whether this service is selected */
  selected?: boolean;
  /** Press handler */
  onPress?: () => void;
}

const PROMO_COLOR = '#E11D48';

const LEFT_BORDER_WIDTH = 4;

function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (remainingMinutes === 0) {
    return `${hours}h`;
  }
  return `${hours}h${remainingMinutes}`;
}

export function ServiceCard({
  name,
  description,
  photoURL,
  duration,
  price,
  priceMax,
  originalPrice,
  discountPercent,
  discountAmount,
  isAvailable = true,
  availableDays,
  unavailableReason,
  unavailableNote,
  promoCountdown,
  priceFrom = false,
  selected = false,
  onPress,
}: ServiceCardProps) {
  const { colors, spacing, radius, shadows } = useTheme();
  const { t } = useTranslation();

  const formatPrice = (euros: number, eurosMax?: number | null): string => {
    if (euros === 0 && !eurosMax) return t('common.free');
    const fmt = (v: number) => (v % 1 === 0 ? `${v} €` : `${v.toFixed(2)} €`);
    if (eurosMax && eurosMax > euros) {
      return t('components.serviceCard.priceRange', { min: fmt(euros), max: fmt(eurosMax) });
    }
    return fmt(euros);
  };

  const hasPromo =
    (discountPercent != null || discountAmount != null) &&
    originalPrice != null &&
    originalPrice > price;
  const promoBadge = formatDiscountBadge({
    percent: discountPercent ?? undefined,
    amount: discountAmount ?? undefined,
  });
  const unavailable = isAvailable === false;
  // Motif dans la langue de la CLIENTE. « other » — ou un document antérieur
  // aux motifs, qui n'a qu'une note — retombe sur le texte libre du pro.
  const unavailableLabel = !unavailable
    ? null
    : unavailableReason && unavailableReason !== 'other'
      ? t(`components.serviceCard.unavailableReason.${unavailableReason}`)
      : (unavailableNote ?? null);
  // Même règle que sur le web : au-delà de quatre jours ouverts, on énonce
  // ce qui est FERMÉ. « Sauf le dimanche » tient sur une ligne, la liste des
  // six autres jours n'y tiendrait pas — et sur mobile la place manque.
  const dayLabel = (() => {
    const days = availableDays;
    if (!days || days.length === 0 || days.length === 7) return null;
    const order = [1, 2, 3, 4, 5, 6, 0];
    const open = order.filter((d) => days.includes(d));
    const listed = open.length <= 4 ? open : order.filter((d) => !days.includes(d));
    const names = listed.map((d) => t(`components.serviceCard.weekdayLong.${d}`));
    const joined =
      names.length <= 1
        ? names.join('')
        : `${names.slice(0, -1).join(', ')} ${t('components.serviceCard.and')} ${names[names.length - 1]}`;
    return open.length <= 4
      ? t('components.serviceCard.dayBadgeOnly', { days: joined })
      : t('components.serviceCard.dayBadgeExcept', { days: joined });
  })();

  const [descExpanded, setDescExpanded] = useState(false);
  const [descClamped, setDescClamped] = useState(false);
  const [photoFullscreen, setPhotoFullscreen] = useState(false);

  const content = (
    <View
      style={[
        styles.container,
        {
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: selected ? colors.primary : colors.border,
          borderLeftWidth: LEFT_BORDER_WIDTH,
          borderLeftColor: colors.primary,
          backgroundColor: selected ? colors.primaryLight : colors.surface,
          ...shadows.sm,
        },
        unavailable && { opacity: 0.55 },
      ]}
    >
      <View style={[styles.content, { padding: spacing.md }]}>
        {/* Top row: Photo + Name + Price */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          {photoURL && (
            <Pressable onPress={() => setPhotoFullscreen(true)} style={{ position: 'relative' }}>
              <Image
                source={{ uri: photoURL }}
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: radius.md,
                  marginRight: spacing.sm,
                }}
                resizeMode="cover"
              />
              <View style={{
                position: 'absolute',
                bottom: 2,
                right: spacing.sm + 2,
                backgroundColor: 'rgba(0,0,0,0.45)',
                borderRadius: 4,
                padding: 2,
              }}>
                <Ionicons name="expand-outline" size={10} color="#fff" />
              </View>
            </Pressable>
          )}
          <View style={{ flex: 1 }}>
            {/* Header: Name + Price Badge */}
            <View style={styles.header}>
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text variant="body" style={[styles.name, { flexShrink: 1 }]} numberOfLines={1}>
                  {name}
                </Text>
                {unavailable && (
                  <View
                    style={{
                      backgroundColor: '#FEF3C7',
                      borderRadius: 4,
                      paddingHorizontal: 5,
                      paddingVertical: 1,
                    }}
                  >
                    <Text
                      variant="caption"
                      style={{ color: '#B45309', fontWeight: '700', fontSize: 10 }}
                    >
                      {t('components.serviceCard.unavailable')}
                    </Text>
                  </View>
                )}
              </View>
          <View style={{ alignItems: 'flex-end' }}>
            {priceFrom && (
              <Text variant="caption" style={{ color: colors.textMuted, fontSize: 10 }}>
                {t('components.serviceCard.fromPrefix')}
              </Text>
            )}
            {hasPromo && (
              <Text
                variant="caption"
                style={{
                  color: colors.textMuted,
                  textDecorationLine: 'line-through',
                  fontSize: 11,
                }}
              >
                {formatPrice(originalPrice!)}
              </Text>
            )}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <View
                style={[
                  styles.priceBadge,
                  {
                    backgroundColor: hasPromo
                      ? 'rgba(225,29,72,0.12)'
                      : selected
                        ? colors.primary
                        : colors.primaryLight,
                    paddingHorizontal: spacing.sm,
                    paddingVertical: spacing.xs,
                    borderRadius: radius.md,
                  },
                ]}
              >
                <Text
                  variant="bodySmall"
                  style={[
                    styles.priceText,
                    {
                      color: hasPromo
                        ? PROMO_COLOR
                        : selected
                          ? colors.textInverse
                          : colors.primary,
                    },
                  ]}
                >
                  {formatPrice(price, priceMax)}
                </Text>
              </View>
              {hasPromo && (
                <View
                  style={{
                    backgroundColor: PROMO_COLOR,
                    borderRadius: 4,
                    paddingHorizontal: 4,
                    paddingVertical: 1,
                  }}
                >
                  <Text variant="caption" style={{ color: '#fff', fontWeight: '700', fontSize: 10 }}>
                    {promoBadge}
                  </Text>
                </View>
              )}
            </View>
            {hasPromo && promoCountdown && !unavailable && (
              <Text
                variant="caption"
                style={{ color: PROMO_COLOR, fontSize: 10, fontWeight: '600', marginTop: 2 }}
              >
                {promoCountdown}
              </Text>
            )}
            {unavailableLabel ? (
              <Text
                variant="caption"
                style={{ color: '#B45309', fontSize: 10, marginTop: 2, textAlign: 'right' }}
                numberOfLines={2}
              >
                {unavailableLabel}
              </Text>
            ) : null}

          </View>
        </View>

            {/* Les jours, à côté de la durée : même famille d'information
                (« combien de temps », « quels jours »), et surtout la pleine
                largeur — dans la colonne du prix, la mention était écrasée.
                Inutile sur une prestation suspendue, dont le motif est déjà
                affiché. */}
            {!unavailable && dayLabel ? (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.xs,
                  marginTop: spacing.xs,
                }}
              >
                <Ionicons name="calendar-outline" size={14} color="#0369A1" />
                <Text variant="caption" style={{ color: '#0369A1', flex: 1 }}>
                  {dayLabel}
                </Text>
              </View>
            ) : null}

            {/* Duration */}
            <View style={[styles.durationContainer, { marginTop: spacing.xs }]}>
              <Ionicons
                name="time-outline"
                size={14}
                color={colors.textSecondary}
                style={{ marginRight: spacing.xs }}
              />
              <Text variant="caption" color="textSecondary">
                {formatDuration(duration)}
              </Text>
              {selected && (
                <Ionicons
                  name="checkmark-circle"
                  size={20}
                  color={colors.primary}
                  style={{ marginLeft: 'auto' }}
                />
              )}
            </View>
          </View>
        </View>

        {/* Description — below the photo+title row */}
        {description && (
          <View style={{ marginTop: spacing.sm }}>
            {!descClamped && (
              <Text
                variant="caption"
                style={[styles.description, styles.hiddenMeasure]}
                onTextLayout={(e: NativeSyntheticEvent<TextLayoutEventData>) => {
                  if (e.nativeEvent.lines.length > 2) {
                    setDescClamped(true);
                  }
                }}
              >
                {description}
              </Text>
            )}
            <Text
              variant="caption"
              color="textMuted"
              numberOfLines={descExpanded ? undefined : 2}
              style={styles.description}
            >
              {description}
            </Text>
            {descClamped && (
              <Pressable
                onPress={(e) => {
                  e.stopPropagation();
                  setDescExpanded((v) => !v);
                }}
                hitSlop={8}
              >
                <Text
                  variant="caption"
                  style={{ color: colors.primary, marginTop: 2 }}
                >
                  {descExpanded
                    ? t('components.serviceCard.showLess')
                    : t('components.serviceCard.showMore')}
                </Text>
              </Pressable>
            )}
          </View>
        )}
      </View>
    </View>
  );

  const fullscreenModal = photoURL ? (
    <Modal visible={photoFullscreen} transparent animationType="fade">
      <Pressable
        onPress={() => setPhotoFullscreen(false)}
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' }}
      >
        <Pressable
          onPress={() => setPhotoFullscreen(false)}
          style={{ position: 'absolute', top: 50, right: 20, zIndex: 10 }}
        >
          <Ionicons name="close-circle" size={36} color="#fff" />
        </Pressable>
        <Image
          source={{ uri: photoURL }}
          style={{
            width: Dimensions.get('window').width - 40,
            height: Dimensions.get('window').width - 40,
            borderRadius: 12,
          }}
          resizeMode="contain"
        />
      </Pressable>
    </Modal>
  ) : null;

  if (onPress && !unavailable) {
    return (
      <>
        <Pressable
          onPress={onPress}
          style={({ pressed }) => [
            pressed && styles.pressed,
          ]}
        >
          {content}
        </Pressable>
        {fullscreenModal}
      </>
    );
  }

  return (
    <>
      {content}
      {fullscreenModal}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    overflow: 'hidden',
  },
  content: {},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  name: {
    fontWeight: '600',
    flex: 1,
    marginRight: 12,
  },
  priceBadge: {
    alignSelf: 'flex-start',
  },
  priceText: {
    fontWeight: '700',
  },
  description: {
    fontStyle: 'italic',
  },
  hiddenMeasure: {
    position: 'absolute',
    opacity: 0,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  durationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
});
