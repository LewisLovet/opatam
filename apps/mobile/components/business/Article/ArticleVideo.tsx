/**
 * ArticleVideo
 *
 * Lite-YouTube pattern for the in-app blog renderer:
 *   - Show a polished thumbnail (custom poster from
 *     `videoCoverURL` if set, fallback to YouTube's hqdefault)
 *   - Big play-circle overlay
 *   - Tap → `Linking.openURL(videoUrl)` → iOS / Android route to
 *     the YouTube app if installed, otherwise the system browser
 *
 * No WebView. Native YouTube playback gives the user PiP, AirPlay,
 * 1.5× speed, captions, etc. — way better than an embedded iframe.
 * Coming back to Opatam is one tap on the system "Back to Opatam"
 * shortcut shown by iOS/Android in the status bar.
 *
 * Falls back to a graceful "Vidéo indisponible" tile when the URL
 * doesn't parse as a YouTube video.
 */

import React from 'react';
import { Pressable, View, Linking, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../../Text';
import { useTheme } from '../../../theme';
import { extractYouTubeId } from '@booking-app/shared';
import { YouTubeThumbnail } from './YouTubeThumbnail';

interface Props {
  url: string;
  /** Optional admin-uploaded poster. Falls back to YouTube auto-thumb. */
  coverUrl?: string | null;
}

export function ArticleVideo({ url, coverUrl }: Props) {
  const { colors, radius, spacing } = useTheme();
  const videoId = extractYouTubeId(url);

  if (!videoId) {
    return (
      <View
        style={[
          styles.fallback,
          {
            backgroundColor: colors.surfaceSecondary,
            borderRadius: radius.lg,
          },
        ]}
      >
        <Ionicons name="videocam-off-outline" size={28} color={colors.textMuted} />
        <Text variant="bodySmall" color="textMuted" style={{ marginTop: 6 }}>
          Vidéo indisponible
        </Text>
      </View>
    );
  }

  const open = () => {
    Linking.openURL(url).catch(() => {
      // Linking.openURL rejects if no app handles the scheme. We
      // could fall back to in-app WebView here but for now just
      // swallow — the URL is YouTube so this should virtually
      // never happen on a real device.
    });
  };

  return (
    <Pressable
      onPress={open}
      style={({ pressed }) => [
        styles.wrap,
        {
          borderRadius: radius.lg,
          marginVertical: spacing.md,
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      {/* Custom poster wins; otherwise the YouTube auto-thumbnail
          with maxres → hq fallback baked in (see YouTubeThumbnail). */}
      <YouTubeThumbnail
        videoUrl={url}
        coverUrl={coverUrl}
        style={styles.thumb}
      />
      {/* Dark scrim so the play icon stays readable on bright thumbs */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.18)' }]} />
      <View style={styles.playOverlay}>
        <View style={styles.playBg}>
          <Ionicons name="play" size={32} color="#FFFFFF" style={{ marginLeft: 4 }} />
        </View>
      </View>
      {/* "YouTube" hint corner — sets the user's expectation that
          tapping leaves the app for the YouTube player. */}
      <View style={styles.cornerLabel}>
        <Ionicons name="logo-youtube" size={12} color="#FFFFFF" />
        <Text style={styles.cornerLabelText}>YouTube</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    aspectRatio: 16 / 9,
    width: '100%',
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  thumb: {
    width: '100%',
    height: '100%',
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBg: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cornerLabel: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  cornerLabelText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  fallback: {
    aspectRatio: 16 / 9,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
