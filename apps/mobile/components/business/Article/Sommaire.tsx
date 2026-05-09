/**
 * Sommaire
 *
 * Inline collapsible table of contents for the article detail
 * screen. Mirrors the web `/blog/[slug]` sidebar TOC but adapted
 * to a single-column mobile layout — collapsed by default to save
 * vertical real estate, expanded on tap. Each heading row jumps
 * the parent ScrollView to that section.
 *
 * Auto-hidden when the article has fewer than 2 headings (a TOC
 * with one entry adds noise without value).
 */

import React from 'react';
import { View, Pressable, StyleSheet, LayoutAnimation } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../../Text';
import { useTheme } from '../../../theme';
import type { Heading } from '@booking-app/shared';

interface Props {
  headings: Heading[];
  onJump: (slug: string) => void;
}

export function Sommaire({ headings, onJump }: Props) {
  const { colors, spacing, radius } = useTheme();
  const [expanded, setExpanded] = React.useState(false);

  if (headings.length < 2) return null;

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((v) => !v);
  };

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surfaceSecondary,
          borderRadius: radius.lg,
          marginVertical: spacing.md,
        },
      ]}
    >
      <Pressable
        onPress={toggle}
        style={({ pressed }) => [
          styles.header,
          {
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
      >
        <Ionicons name="list-outline" size={16} color={colors.textSecondary} />
        <Text
          variant="caption"
          color="textSecondary"
          style={{
            flex: 1,
            fontWeight: '700',
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}
        >
          Sommaire ({headings.length})
        </Text>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={colors.textSecondary}
        />
      </Pressable>

      {expanded && (
        <View
          style={{
            paddingHorizontal: spacing.md,
            paddingBottom: spacing.sm,
            gap: 2,
          }}
        >
          {headings.map((h) => (
            <Pressable
              key={h.slug}
              onPress={() => onJump(h.slug)}
              style={({ pressed }) => [
                styles.row,
                {
                  paddingLeft:
                    h.level === 1
                      ? 0
                      : h.level === 2
                        ? spacing.sm
                        : spacing.lg,
                  paddingVertical: 8,
                  opacity: pressed ? 0.6 : 1,
                  borderLeftWidth: 2,
                  borderLeftColor:
                    h.level === 1 ? colors.primary : colors.border,
                  paddingHorizontal: spacing.md,
                },
              ]}
            >
              <Text
                variant="bodySmall"
                style={{
                  color: colors.text,
                  fontWeight: h.level === 1 ? '700' : '500',
                }}
                numberOfLines={2}
              >
                {h.text}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
