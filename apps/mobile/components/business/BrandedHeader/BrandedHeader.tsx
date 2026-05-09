/**
 * BrandedHeader
 *
 * Top bar painted in the brand primary colour, used for the pro
 * space's secondary screens (clients, reviews, notifications,
 * payments, blocked slots, tutorials, article detail, …).
 *
 * The component owns the safe-area inset on top, so the iOS time /
 * Dynamic Island sits over the brand colour rather than over page
 * content. Back button on the left, optional right action on the
 * right (e.g. a burger that opens a drawer), centred white title
 * in the middle. When `subtitle` is provided it sits under the
 * title in slightly muted white.
 *
 * Why a dedicated component (and not the existing `ScreenHeader`
 * in components/business/ScreenHeader): ScreenHeader paints itself
 * white because it's used in client/auth flows where the colour
 * needs to stay neutral. The pro space wants the brand chrome,
 * which is a different visual contract. Sharing components/index
 * means screens can pull either depending on their context.
 */

import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Text } from '../../Text';
import { useTheme } from '../../../theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

export interface BrandedHeaderAction {
  /** Ionicons name for the action button. */
  icon: IconName;
  /** Press handler. */
  onPress: () => void;
  /** A11y label — required when icon meaning isn't obvious. */
  accessibilityLabel?: string;
}

export interface BrandedHeaderProps {
  /** Main title (white, bold). */
  title: string;
  /** Optional caption below the title (muted white). */
  subtitle?: string;
  /**
   * Back action override. Defaults to `router.back()` with a
   * chevron-back icon. Pass `null` to hide the back slot entirely
   * (root-level screens like a tab landing page).
   */
  back?: BrandedHeaderAction | null;
  /** Optional right-side action (rendered on the far right). */
  rightAction?: BrandedHeaderAction;
  /**
   * Optional second right-side action, rendered to the LEFT of
   * `rightAction`. Useful when a screen needs both a primary
   * action (eg. a TOC burger) and a secondary one (eg. share).
   * When set, an invisible spacer is added on the left side so
   * the title stays centred.
   */
  secondaryRightAction?: BrandedHeaderAction;
}

/**
 * Visual constants. Kept here so other branded screens can match
 * exactly without redefining the same magic numbers.
 */
const ICON_BTN_SIZE = 36;

export function BrandedHeader({
  title,
  subtitle,
  back,
  rightAction,
  secondaryRightAction,
}: BrandedHeaderProps) {
  const { colors, radius } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Default back action: pop the navigation stack. Hidden if
  // explicitly nulled (eg. root-tab screens like /more).
  const backAction: BrandedHeaderAction | null =
    back === undefined
      ? { icon: 'chevron-back', onPress: () => router.back() }
      : back;

  const renderBtn = (a: BrandedHeaderAction | null | undefined) => {
    if (!a) {
      // Empty spacer — keeps the title perfectly centred when one
      // side has no action.
      return <View style={styles.iconBtn} />;
    }
    return (
      <Pressable
        onPress={a.onPress}
        accessibilityLabel={a.accessibilityLabel}
        hitSlop={6}
        style={({ pressed }) => [
          styles.iconBtn,
          {
            backgroundColor: 'rgba(255,255,255,0.18)',
            borderRadius: radius.full,
            opacity: pressed ? 0.7 : 1,
          },
        ]}
      >
        <Ionicons name={a.icon} size={22} color="#FFFFFF" />
      </Pressable>
    );
  };

  return (
    <View
      style={[
        styles.bar,
        {
          paddingTop: insets.top,
          backgroundColor: colors.primary,
        },
      ]}
    >
      <View style={styles.row}>
        {renderBtn(backAction)}
        {/* Symmetric spacer on the left when there are 2 right
            buttons — keeps the title visually centred. */}
        {secondaryRightAction ? <View style={styles.iconBtn} /> : null}
        <View style={styles.titleWrap}>
          <Text
            numberOfLines={1}
            style={styles.title}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text
              numberOfLines={1}
              style={styles.subtitle}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
        {secondaryRightAction ? renderBtn(secondaryRightAction) : null}
        {renderBtn(rightAction)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    minHeight: 52,
  },
  iconBtn: {
    width: ICON_BTN_SIZE,
    height: ICON_BTN_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
    textAlign: 'center',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    marginTop: 2,
    textAlign: 'center',
  },
});
