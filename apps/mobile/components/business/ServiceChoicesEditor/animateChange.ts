/**
 * Smooth insert/remove animation for the choices editors (variations,
 * options, info fields): call right before a list mutation so the new
 * card slides in (and removals collapse) instead of snapping — the pro
 * clearly SEES the editor react to their action.
 */

import { LayoutAnimation, Platform, UIManager } from 'react-native';

// Android (old architecture) needs the experimental switch once.
if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export function animateChange() {
  LayoutAnimation.configureNext(
    LayoutAnimation.create(
      260,
      LayoutAnimation.Types.easeInEaseOut,
      LayoutAnimation.Properties.opacity,
    ),
  );
}
