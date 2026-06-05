/**
 * EditorSection — a titled, collapsible card section for the mobile
 * prestation editor. Mirrors the web `EditorSection` so the form stays
 * scannable: the pro opens only what they need (Réglages, Disponibilité,
 * Variations) while "Essentiel" stays pinned open.
 *
 * Open state can be uncontrolled (internal, seeded by `defaultOpen`) or
 * controlled via `open` + `onToggle` (used to auto-expand Variations when
 * editing a service that already has choices).
 */

import React, { useState, type ReactNode } from 'react';
import { View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { Text } from '../Text';

export interface EditorSectionProps {
  title: string;
  subtitle?: string;
  /** Ionicons name shown in the leading badge. */
  icon?: keyof typeof Ionicons.glyphMap;
  /** When false the section is always open with no toggle (Essentiel). */
  collapsible?: boolean;
  /** Uncontrolled initial open state. Ignored when `open` is provided. */
  defaultOpen?: boolean;
  /** Controlled open state. When provided, `onToggle` handles changes. */
  open?: boolean;
  onToggle?: () => void;
  /** Optional pill on the right of the header (e.g. a count). */
  badge?: ReactNode;
  children: ReactNode;
}

export function EditorSection({
  title,
  subtitle,
  icon,
  collapsible = true,
  defaultOpen = false,
  open,
  onToggle,
  badge,
  children,
}: EditorSectionProps) {
  const { colors, spacing, radius } = useTheme();
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const controlled = open !== undefined;
  const isOpen = !collapsible || (controlled ? open! : internalOpen);

  const toggle = () => {
    if (!collapsible) return;
    if (controlled) onToggle?.();
    else setInternalOpen((v) => !v);
  };

  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: radius.lg,
        backgroundColor: colors.surface ?? colors.background,
        overflow: 'hidden',
      }}
    >
      <Pressable
        onPress={toggle}
        disabled={!collapsible}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          padding: spacing.md,
        }}
      >
        {icon && (
          <View
            style={{
              width: 34,
              height: 34,
              borderRadius: radius.md,
              backgroundColor: colors.primaryLight || '#e4effa',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name={icon} size={18} color={colors.primary} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text variant="body" style={{ fontWeight: '700', color: colors.text }}>
            {title}
          </Text>
          {subtitle && (
            <Text variant="caption" color="textSecondary" style={{ marginTop: 1 }}>
              {subtitle}
            </Text>
          )}
        </View>
        {badge}
        {collapsible && (
          <Ionicons
            name={isOpen ? 'chevron-up' : 'chevron-down'}
            size={20}
            color={colors.textMuted}
          />
        )}
      </Pressable>

      {isOpen && (
        <View
          style={{
            gap: spacing.md,
            paddingHorizontal: spacing.md,
            paddingBottom: spacing.md,
            paddingTop: spacing.xs,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}
        >
          {children}
        </View>
      )}
    </View>
  );
}
