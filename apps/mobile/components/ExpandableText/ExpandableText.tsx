/**
 * ExpandableText Component
 * Displays text truncated to a configurable number of lines with a "Voir plus"/"Voir moins" toggle.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Pressable,
  NativeSyntheticEvent,
  TextLayoutEventData,
} from 'react-native';
import { useTheme } from '../../theme';
import { Text } from '../Text';

export interface ExpandableTextProps {
  /** Text content */
  text: string;
  /** Max lines when collapsed (default 3) */
  numberOfLines?: number;
}

export function ExpandableText({
  text,
  numberOfLines = 3,
}: ExpandableTextProps) {
  const { colors, spacing } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const [isTruncated, setIsTruncated] = useState(false);

  const handleTextLayout = useCallback(
    (e: NativeSyntheticEvent<TextLayoutEventData>) => {
      // Only check on first render (when not expanded)
      if (!expanded) {
        setIsTruncated(e.nativeEvent.lines.length >= numberOfLines);
      }
    },
    [expanded, numberOfLines]
  );

  return (
    <View>
      <Text
        variant="body"
        color="textSecondary"
        numberOfLines={expanded ? undefined : numberOfLines}
        onTextLayout={handleTextLayout}
      >
        {text}
      </Text>
      {isTruncated && (
        <Pressable
          onPress={() => setExpanded(!expanded)}
          style={{ marginTop: spacing.xs }}
        >
          <Text
            variant="bodySmall"
            style={{ color: colors.primary, fontWeight: '500' }}
          >
            {expanded ? 'Voir moins' : 'Voir plus'}
          </Text>
        </Pressable>
      )}
    </View>
  );
}
