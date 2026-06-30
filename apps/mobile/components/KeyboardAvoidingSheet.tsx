/**
 * KeyboardAvoidingSheet — drop-in replacement for the `<View style={modalOverlay}>`
 * wrapper used by every bottom-sheet `<Modal>` in the app.
 *
 * The sheet is anchored to the bottom (justifyContent: 'flex-end'); on iOS a
 * raw <Modal> does NOT move out of the keyboard's way, so a field near the
 * bottom gets hidden behind it. Wrapping the overlay in a KeyboardAvoidingView
 * with `behavior="padding"` adds bottom padding equal to the keyboard height,
 * lifting the whole sheet above the keyboard so what you type stays visible.
 *
 * Keep your existing children unchanged (backdrop Pressable + the sheet View) —
 * just swap the outer `<View style={styles.modalOverlay}>` for this.
 */

import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

export function KeyboardAvoidingSheet({
  children,
  style,
}: {
  children: React.ReactNode;
  /** Extra style merged over the default dim + flex-end overlay. */
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <KeyboardAvoidingView
      style={[styles.overlay, style]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {children}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
});
